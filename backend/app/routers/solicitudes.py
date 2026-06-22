"""
Router de Solicitudes.

Mantiene los endpoints legados (POST /, GET /) y agrega:

  POST /api/solicitudes/outlook         <- Power Automate (header x-api-key)
  GET  /api/solicitudes/lista           <- listado SharePoint-like (con joins)
  GET  /api/solicitudes/{id}/detalle    <- detalle (panel lateral)
  PATCH /api/solicitudes/{id}           <- editar campos permitidos
  POST /api/solicitudes/{id}/comentario <- agregar comentario
  GET  /api/solicitudes/{id}/adjunto    <- descargar primer .eml
  GET  /api/solicitudes/{id}/adjuntos/{nombre} <- descargar adjunto específico
  POST /api/solicitudes/{id}/adjuntos   <- subir adjuntos desde frontend
  DELETE /api/solicitudes/{id}/adjuntos/{nombre} <- eliminar adjunto por nombre
  DELETE /api/solicitudes/{id}          <- eliminar (solo admin)
  POST /api/solicitudes/manual          <- creación manual desde frontend

REEMPLAZA: backend/app/routers/solicitudes.py
"""
import os
import re
import uuid
from pathlib import Path
from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File,
    Query, status,
)
import mimetypes
import shutil
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, update
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin
from app.core.api_key import verify_api_key
from app.core.config import settings
from app.models.solicitud import (
    Solicitud, Aseguradora,
    TipoSolicitud, EstadoSolicitud, Prioridad, Ramo, Alerta,
)
from app.models.user import User
from app.schemas.schemas import (
    SolicitudOut, PaginatedResponse,
    OutlookSolicitudIn, OutlookSolicitudOut,
    SolicitudUpdate, SolicitudCreateManual,
    ComentarioAdd,
)
from app.services.prediction_service import predecir_ans, is_loaded as rf_loaded
from app.services.alertas_service import gestionar_alerta_riesgo

from app.models.solicitud import PrediccionANS
from app.services.outlook_service import (
    generar_nro_ticket,
    extraer_desde_asunto,
    resolver_cliente_por_remitente, resolver_prioridad_id,
    resolver_prioridad_id_desde_remitente,
    resolver_estado_pendiente_id,
    guardar_eml, guardar_adjunto,
)

router = APIRouter()


# ════════════════════════════════════════════════════════════════════
# Helper ML
# ════════════════════════════════════════════════════════════════════

def _pred_sin_modelo() -> dict:
    """Devuelto cuando el modelo RF v2 no está cargado. No se persiste en BD."""
    return {
        "probabilidad": None,
        "prediccion": "Modelo no disponible",
        "modelo_version": "no_disponible",
        "tiempo_prediccion_ms": 0.0,
    }


def _pred_pendiente(campos_faltantes: list) -> dict:
    """Devuelto cuando faltan campos obligatorios para el RF. No se persiste en BD."""
    return {
        "probabilidad": None,
        "prediccion": "Predicción pendiente",
        "modelo_version": "pendiente",
        "tiempo_prediccion_ms": 0.0,
        "advertencias": [
            f"Campos insuficientes para predicción RF v2: {', '.join(campos_faltantes)}"
        ],
    }


async def _predecir_con_rf(
    db: AsyncSession,
    tipo_solicitud_id: Optional[int],
    prioridad_id: Optional[int],
    aseguradora_id: Optional[int],
    ramo_id: Optional[int],
    nro_atenciones: Optional[int],
    fecha_recepcion,
) -> dict:
    """
    Resuelve IDs a nombres y ejecuta el Random Forest v2.

    Si falta cualquier campo categórico obligatorio (tipo, prioridad, aseguradora, ramo),
    retorna _pred_pendiente() sin tocar la BD.
    Solo incluye _rf_result cuando el RF corrió y produjo un resultado válido.
    """
    tipo_nombre = prioridad_nombre = aseg_nombre = ramo_nombre = None
    faltantes: list = []

    if tipo_solicitud_id:
        ts = (await db.execute(
            select(TipoSolicitud).where(TipoSolicitud.id == tipo_solicitud_id)
        )).scalar_one_or_none()
        tipo_nombre = ts.nombre if ts else None
    if not tipo_nombre:
        faltantes.append("tipo_solicitud")

    if prioridad_id:
        pr = (await db.execute(
            select(Prioridad).where(Prioridad.id == prioridad_id)
        )).scalar_one_or_none()
        prioridad_nombre = pr.nombre if pr else None
    if not prioridad_nombre:
        faltantes.append("prioridad")

    if aseguradora_id:
        aseg = (await db.execute(
            select(Aseguradora).where(Aseguradora.id == aseguradora_id)
        )).scalar_one_or_none()
        aseg_nombre = aseg.nombre if aseg else None
    if not aseg_nombre:
        faltantes.append("aseguradora")

    if ramo_id:
        ramo = (await db.execute(
            select(Ramo).where(Ramo.id == ramo_id)
        )).scalar_one_or_none()
        ramo_nombre = ramo.nombre if ramo else None
    if not ramo_nombre:
        faltantes.append("ramo")

    if faltantes:
        return _pred_pendiente(faltantes)

    result = predecir_ans(
        tipo_solicitud=tipo_nombre,
        prioridad=prioridad_nombre,
        aseguradora=aseg_nombre,
        producto=ramo_nombre,
        nro_atenciones=nro_atenciones,
        fecha_recepcion=fecha_recepcion,
        umbral=settings.PROBABILIDAD_UMBRAL_ANS,
    )

    if result["prediccion_ans"] not in ("Dentro de ANS", "Fuera de ANS"):
        return _pred_pendiente(result.get("advertencias", ["Error interno del modelo RF v2"]))

    return {
        "probabilidad": result["probabilidad_incumplimiento"],
        "prediccion": result["prediccion_ans"],
        "modelo_version": result["modelo_usado"],
        "tiempo_prediccion_ms": result["tiempo_prediccion_ms"],
        "_rf_result": result,
    }


async def _guardar_prediccion_ans(
    db: AsyncSession,
    solicitud: Solicitud,
    rf_result: dict,
) -> None:
    """Crea o actualiza el registro en predicciones_ans."""
    prob = rf_result["probabilidad_incumplimiento"]
    pred = rf_result["prediccion_ans"]
    nivel = (
        "critico" if prob >= 0.85
        else "alto" if prob >= 0.70
        else "medio" if prob >= 0.40
        else "bajo"
    )

    existing = (await db.execute(
        select(PrediccionANS).where(PrediccionANS.solicitud_id == solicitud.id)
    )).scalar_one_or_none()

    if existing:
        existing.cumple_ans = (pred == "Dentro de ANS")
        existing.probabilidad_riesgo = prob
        existing.nivel_riesgo = nivel
        existing.features_input = rf_result.get("variables_usadas", {})
        existing.modelo_version = rf_result.get("modelo_usado", "")
        existing.tiempo_prediccion_ms = rf_result.get("tiempo_prediccion_ms", 0.0)
    else:
        db.add(PrediccionANS(
            solicitud_id=solicitud.id,
            cumple_ans=(pred == "Dentro de ANS"),
            probabilidad_riesgo=prob,
            nivel_riesgo=nivel,
            features_input=rf_result.get("variables_usadas", {}),
            modelo_version=rf_result.get("modelo_usado", ""),
            tiempo_prediccion_ms=rf_result.get("tiempo_prediccion_ms", 0.0),
        ))

    await gestionar_alerta_riesgo(db, solicitud, prob)


# ════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════

def _strip_html(text: str | None, maxlen: int = 200) -> str | None:
    if not text:
        return None
    clean = re.sub(r'<[^>]+>', ' ', text)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return (clean[:maxlen] + '…') if len(clean) > maxlen else clean or None


def _solicitud_to_list_item(s: Solicitud) -> dict:
    return {
        "id": s.id,
        "nro_ticket": s.nro_ticket,
        "cliente": s.cliente,
        "tipo_solicitud": s.tipo_solicitud.nombre if s.tipo_solicitud else None,
        "estado": s.estado_rel.nombre if s.estado_rel else (s.estado or None),
        "aseguradora": s.aseguradora.nombre if s.aseguradora else None,
        "prioridad": s.prioridad_rel.nombre if s.prioridad_rel else None,
        "ramo": s.ramo.nombre if s.ramo else None,
        "fecha_recepcion": s.fecha_recepcion,
        "fecha_finalizado": s.fecha_finalizado,
        "fecha_envio_aseguradora": s.fecha_envio_aseguradora,
        "remitente": s.remitente,
        "asunto": s.asunto,
        "detalle_correo": _strip_html(s.cuerpo_correo, 200),
        "probabilidad": s.probabilidad,
        "prediccion": s.prediccion,
        "tiene_adjuntos": bool(s.datos_adjuntos),
        "fuente": s.fuente,
        "ejecutivo": s.ejecutivo_rel.full_name if s.ejecutivo_rel else None,
        "nro_atenciones": s.nro_atenciones,
        "created_at": s.created_at,
    }


def _strip_content(adjuntos: list) -> list:
    """Remove content_b64 from adjunto dicts — it's only needed for download, not for the frontend."""
    return [{k: v for k, v in a.items() if k != "content_b64"} for a in adjuntos]


def _solicitud_to_detail(s: Solicitud) -> dict:
    base = _solicitud_to_list_item(s)
    base.update({
        "cuerpo_correo": s.cuerpo_correo,
        "comentarios": s.comentarios,
        "datos_adjuntos": _strip_content(s.datos_adjuntos or []),
        "tipo_solicitud_id": s.tipo_solicitud_id,
        "estado_id": s.estado_id,
        "aseguradora_id": s.aseguradora_id,
        "prioridad_id": s.prioridad_id,
        "ramo_id": s.ramo_id,
        "ejecutivo_id": str(s.ejecutivo_id) if s.ejecutivo_id else None,
    })
    return base


# ════════════════════════════════════════════════════════════════════
# 1) ENDPOINT POWER AUTOMATE (sin JWT, solo x-api-key)
# ════════════════════════════════════════════════════════════════════

@router.post(
    "/outlook",
    response_model=OutlookSolicitudOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear solicitud desde Power Automate / Outlook",
    description="Endpoint para Power Automate. Requiere header `x-api-key`.",
    dependencies=[Depends(verify_api_key)],
)
async def crear_desde_outlook(
    payload: OutlookSolicitudIn,
    db: AsyncSession = Depends(get_db),
):
    nro_ticket = await generar_nro_ticket(db)

    # 1. Resolver cliente desde tabla de asociaciones remitente→cliente
    cliente = await resolver_cliente_por_remitente(db, payload.remitente)

    # 2. Extraer tipo, ramo, aseguradora y nro_atenciones desde el asunto
    extraido = await extraer_desde_asunto(db, payload.asunto or "")

    # 3. Aseguradora y ramo vienen únicamente del asunto (no de clientes_remitentes)
    tipo_solicitud_id = extraido["tipo_solicitud_id"]
    aseguradora_id    = extraido["aseg_id"]
    ramo_id           = extraido["ramo_id"]

    # nro_atenciones: preferir el extraído del asunto si es explícito (> 1)
    nro_atenciones = (
        extraido["nro_atenciones"]
        if extraido["nro_atenciones"] > 1
        else (payload.nro_atenciones or 1)
    )

    estado_id = await resolver_estado_pendiente_id(db)

    # 4. Prioridad: usar la configurada en el cliente; si no tiene, "Normal"
    if cliente == "Pendiente de asignar":
        prioridad_id = await resolver_prioridad_id(db, "Normal")
    else:
        prioridad_id = await resolver_prioridad_id_desde_remitente(db, payload.remitente)
        if prioridad_id is None:
            prioridad_id = await resolver_prioridad_id(db, "Normal")

    if rf_loaded():
        pred = await _predecir_con_rf(
            db,
            tipo_solicitud_id=tipo_solicitud_id,
            prioridad_id=prioridad_id,
            aseguradora_id=aseguradora_id,
            ramo_id=ramo_id,
            nro_atenciones=nro_atenciones,
            fecha_recepcion=payload.fecha_recepcion,
        )
    else:
        pred = _pred_sin_modelo()

    import logging as _logging
    _log = _logging.getLogger(__name__)

    adjuntos_meta: List[dict] = []
    if payload.eml_base64:
        _log.info(
            "[outlook] %s: recibido eml_base64 (tipo=%s len=%s) eml_filename=%r",
            nro_ticket,
            type(payload.eml_base64).__name__,
            len(str(payload.eml_base64)) if payload.eml_base64 else 0,
            payload.eml_filename,
        )
        try:
            meta = guardar_eml(payload.eml_base64, payload.eml_filename, nro_ticket)
            _log.info(
                "[outlook] %s: .eml guardado → stored_filename=%r path=%r size=%d",
                nro_ticket, meta["stored_filename"], meta["path"], meta["size"],
            )
            adjuntos_meta.append(meta)
        except Exception as e:
            _log.error("[outlook] %s: FALLO guardando .eml: %s", nro_ticket, e)
            raise HTTPException(400, f"Error guardando .eml: {e}")
    else:
        _log.info("[outlook] %s: no se recibió eml_base64, solicitud sin archivo .eml", nro_ticket)

    if payload.adjuntos:
        for adj in payload.adjuntos:
            try:
                meta = guardar_adjunto(adj.content_base64, adj.filename, nro_ticket)
                meta["content_type"] = adj.content_type
                adjuntos_meta.append(meta)
                _log.info(
                    "[outlook] %s: adjunto guardado → %r path=%r size=%d",
                    nro_ticket, meta["stored_filename"], meta["path"], meta["size"],
                )
            except Exception as e:
                _log.error("[outlook] %s: FALLO guardando adjunto '%s': %s", nro_ticket, adj.filename, e)
                raise HTTPException(400, f"Error guardando adjunto '{adj.filename}': {e}")

    solicitud = Solicitud(
        nro_ticket=nro_ticket,
        cliente=cliente,
        remitente=payload.remitente,
        tipo_solicitud_id=tipo_solicitud_id,
        estado_id=estado_id,
        aseguradora_id=aseguradora_id,
        ramo_id=ramo_id,
        prioridad_id=prioridad_id,
        asunto=payload.asunto,
        cuerpo_correo=payload.cuerpo_correo,
        fecha_recepcion=payload.fecha_recepcion or datetime.now(timezone.utc),
        datos_adjuntos=adjuntos_meta if adjuntos_meta else None,
        probabilidad=pred.get("probabilidad"),
        prediccion=pred.get("prediccion"),

        estado="Pendiente",
        fuente="outlook",
        nro_atenciones=nro_atenciones,
    )
    db.add(solicitud)
    await db.commit()
    await db.refresh(solicitud)

    # Persistir predicción detallada en predicciones_ans (solo cuando usamos RF)
    if rf_loaded() and "_rf_result" in pred:
        await _guardar_prediccion_ans(db, solicitud, pred["_rf_result"])
        await db.commit()

    if tipo_solicitud_id:
        ts = (await db.execute(select(TipoSolicitud).where(TipoSolicitud.id == tipo_solicitud_id))).scalar_one_or_none()
    else:
        ts = None
    if aseguradora_id:
        aseg = (await db.execute(select(Aseguradora).where(Aseguradora.id == aseguradora_id))).scalar_one_or_none()
    else:
        aseg = None
    if ramo_id:
        ramo = (await db.execute(select(Ramo).where(Ramo.id == ramo_id))).scalar_one_or_none()
    else:
        ramo = None

    return OutlookSolicitudOut(
        ok=True,
        id=solicitud.id,
        nro_ticket=nro_ticket,
        cliente=cliente,
        tipo_solicitud=ts.nombre if ts else None,
        aseguradora=aseg.nombre if aseg else None,
        ramo=ramo.nombre if ramo else None,
        prediccion=pred["prediccion"],
        probabilidad=pred["probabilidad"],
        mensaje="Solicitud registrada correctamente desde Outlook.",
    )


# ════════════════════════════════════════════════════════════════════
# 2) LISTADO SHAREPOINT-LIKE
# ════════════════════════════════════════════════════════════════════

@router.get("/lista", response_model=PaginatedResponse)
async def listar_solicitudes_sharepoint(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    estado_id: Optional[int] = None,
    prioridad_id: Optional[int] = None,
    aseguradora_id: Optional[int] = None,
    ramo_id: Optional[int] = None,
    tipo_solicitud_id: Optional[int] = None,
    prediccion: Optional[str] = None,
    search: Optional[str] = None,
    order_by: str = Query("created_at"),
    order_dir: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Solicitud).options(
        selectinload(Solicitud.aseguradora),
        selectinload(Solicitud.tipo_solicitud),
        selectinload(Solicitud.ramo),
        selectinload(Solicitud.estado_rel),
        selectinload(Solicitud.prioridad_rel),
        selectinload(Solicitud.ejecutivo_rel),
    )

    # Ejecutivos solo ven sus propias solicitudes
    if current_user.role == "ejecutivo":
        query = query.where(Solicitud.ejecutivo_id == current_user.id)

    if estado_id is not None:
        query = query.where(Solicitud.estado_id == estado_id)
    if prioridad_id is not None:
        query = query.where(Solicitud.prioridad_id == prioridad_id)
    if aseguradora_id is not None:
        query = query.where(Solicitud.aseguradora_id == aseguradora_id)
    if ramo_id is not None:
        query = query.where(Solicitud.ramo_id == ramo_id)
    if tipo_solicitud_id is not None:
        query = query.where(Solicitud.tipo_solicitud_id == tipo_solicitud_id)
    if prediccion:
        query = query.where(Solicitud.prediccion == prediccion)
    if search:
        like = f"%{search}%"
        query = query.where(or_(
            Solicitud.nro_ticket.ilike(like),
            Solicitud.cliente.ilike(like),
            Solicitud.remitente.ilike(like),
            Solicitud.asunto.ilike(like),
        ))

    order_map = {
        "created_at": Solicitud.created_at,
        "probabilidad": Solicitud.probabilidad,
        "prioridad": Solicitud.prioridad_id,
        "estado": Solicitud.estado_id,
        "fecha_recepcion": Solicitud.fecha_recepcion,
    }
    order_col = order_map.get(order_by, Solicitud.created_at)
    query = query.order_by(order_col.desc() if order_dir == "desc" else order_col.asc())

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    items = (await db.execute(query.offset((page - 1) * size).limit(size))).scalars().all()

    return PaginatedResponse(
        items=[_solicitud_to_list_item(s) for s in items],
        total=total, page=page, size=size,
        pages=(total + size - 1) // size if total else 0,
    )


# ════════════════════════════════════════════════════════════════════
# 3) DETALLE
# ════════════════════════════════════════════════════════════════════

@router.get("/{solicitud_id}/detalle")
async def detalle_solicitud(
    solicitud_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Solicitud).options(
            selectinload(Solicitud.aseguradora),
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.ramo),
            selectinload(Solicitud.estado_rel),
            selectinload(Solicitud.prioridad_rel),
            selectinload(Solicitud.ejecutivo_rel),
        ).where(Solicitud.id == solicitud_id)
    )
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if current_user.role == "ejecutivo" and str(sol.ejecutivo_id) != str(current_user.id):
        raise HTTPException(403, "No tienes acceso a esta solicitud")
    return _solicitud_to_detail(sol)


# ════════════════════════════════════════════════════════════════════
# 4) EDITAR SOLICITUD
# ════════════════════════════════════════════════════════════════════

@router.patch("/{solicitud_id}")
async def editar_solicitud(
    solicitud_id: str,
    data: SolicitudUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Solicitud).where(Solicitud.id == solicitud_id))
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if current_user.role == "ejecutivo" and str(sol.ejecutivo_id) != str(current_user.id):
        raise HTTPException(403, "No tienes permiso para editar esta solicitud")

    payload = data.model_dump(exclude_unset=True)

    # Ejecutivos no pueden cambiar el campo ejecutivo_id
    if current_user.role == "ejecutivo":
        payload.pop("ejecutivo_id", None)

    if "estado_id" in payload and payload["estado_id"]:
        estado = (await db.execute(
            select(EstadoSolicitud).where(EstadoSolicitud.id == payload["estado_id"])
        )).scalar_one_or_none()
        if estado:
            nombre_estado = estado.nombre
            # Marcar fecha_finalizado cuando corresponde
            if nombre_estado.lower() == "finalizado" and not sol.fecha_finalizado:
                sol.fecha_finalizado = datetime.now(timezone.utc)
            sol.estado = nombre_estado
            # Resolver alertas activas si la solicitud pasa a estado terminal
            _ESTADOS_TERMINALES = ("finaliz", "cerrad", "atendid", "complet")
            if any(kw in nombre_estado.lower() for kw in _ESTADOS_TERMINALES):
                await db.execute(
                    update(Alerta)
                    .where(
                        Alerta.solicitud_id == sol.id,
                        Alerta.resuelta == False,
                    )
                    .values(resuelta=True)
                )
        else:
            pass  # estado_id inválido, no modificar sol.estado

    _campos_prediccion = {"tipo_solicitud_id", "prioridad_id", "aseguradora_id", "ramo_id", "nro_atenciones"}
    recalcular = rf_loaded() and bool(_campos_prediccion & set(payload.keys()))

    for k, v in payload.items():
        setattr(sol, k, v)

    await db.commit()
    await db.refresh(sol)

    # Recalcular predicción si cambió algún campo relevante
    if recalcular:
        pred = await _predecir_con_rf(
            db,
            tipo_solicitud_id=sol.tipo_solicitud_id,
            prioridad_id=sol.prioridad_id,
            aseguradora_id=sol.aseguradora_id,
            ramo_id=sol.ramo_id,
            nro_atenciones=sol.nro_atenciones,
            fecha_recepcion=sol.fecha_recepcion,
        )
        sol.probabilidad = pred.get("probabilidad")
        sol.prediccion = pred.get("prediccion")
        await db.commit()
        await db.refresh(sol)
        if "_rf_result" in pred:
            await _guardar_prediccion_ans(db, sol, pred["_rf_result"])
            await db.commit()

    result = await db.execute(
        select(Solicitud).options(
            selectinload(Solicitud.aseguradora),
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.ramo),
            selectinload(Solicitud.estado_rel),
            selectinload(Solicitud.prioridad_rel),
            selectinload(Solicitud.ejecutivo_rel),
        ).where(Solicitud.id == solicitud_id)
    )
    sol = result.scalar_one()
    return _solicitud_to_detail(sol)


# ════════════════════════════════════════════════════════════════════
# 5) AGREGAR COMENTARIO
# ════════════════════════════════════════════════════════════════════

@router.post("/{solicitud_id}/comentario")
async def agregar_comentario(
    solicitud_id: str,
    data: ComentarioAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Solicitud).where(Solicitud.id == solicitud_id))
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if current_user.role == "ejecutivo" and str(sol.ejecutivo_id) != str(current_user.id):
        raise HTTPException(403, "No tienes acceso a esta solicitud")

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    nuevo = f"[{timestamp}] {current_user.full_name}: {data.comentarios}"
    if sol.comentarios:
        sol.comentarios = f"{sol.comentarios}\n{nuevo}"
    else:
        sol.comentarios = nuevo
    await db.commit()
    await db.refresh(sol)
    return {"ok": True, "comentarios": sol.comentarios}


# ════════════════════════════════════════════════════════════════════
# Helper: resolve physical path from adjunto metadata
# ════════════════════════════════════════════════════════════════════

def _find_file(a: dict, nro_ticket: Optional[str] = None) -> Optional[str]:
    """
    Locates the physical file for an adjunto entry.
    Tries (in order):
      1. Backward compat: decode content_b64 if present (old records).
         Returns None so callers can handle it separately.
      2. The stored 'path' value — works as absolute OR relative to CWD.
      3. emails_dir / stored_filename (flat layout — eml files).
      4. emails_dir / nro_ticket / stored_filename (nested — adjuntos).
    Returns the first path string that exists on disk, or None.
    """
    stored = a.get("stored_filename") or a.get("filename")
    path_val = a.get("path")

    candidates: list[Optional[str]] = []

    if path_val:
        p = Path(path_val)
        # absolute path (legacy)
        if p.is_absolute():
            candidates.append(str(p))
        else:
            # relative: resolve from CWD
            candidates.append(str(Path.cwd() / p))
            # also try from the backend root (one level up from app/)
            candidates.append(str(Path(__file__).parent.parent.parent / p))

    if stored:
        candidates.append(str(settings.emails_dir / stored))
        if nro_ticket:
            candidates.append(str(settings.emails_dir / nro_ticket / stored))

    for c in candidates:
        if c and os.path.exists(c):
            return c
    return None


# ════════════════════════════════════════════════════════════════════
# 6) DESCARGA DE ADJUNTOS
# ════════════════════════════════════════════════════════════════════

@router.get("/{solicitud_id}/adjunto")
async def descargar_eml_principal(
    solicitud_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import base64 as _b64
    result = await db.execute(select(Solicitud).where(Solicitud.id == solicitud_id))
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if current_user.role == "ejecutivo" and str(sol.ejecutivo_id) != str(current_user.id):
        raise HTTPException(403, "No tienes acceso a esta solicitud")
    if not sol.datos_adjuntos:
        raise HTTPException(404, "Esta solicitud no tiene adjuntos")

    eml = next((a for a in sol.datos_adjuntos if a.get("tipo") == "eml"), sol.datos_adjuntos[0])
    display_name = eml.get("filename", "correo.eml")

    # Backward compat: old records stored content in DB
    if eml.get("content_b64"):
        try:
            return Response(
                content=_b64.b64decode(eml["content_b64"]),
                media_type="message/rfc822",
                headers={"Content-Disposition": f'attachment; filename="{display_name}"'},
            )
        except Exception:
            pass

    # New records: serve from disk
    file_path = _find_file(eml, sol.nro_ticket)
    if file_path:
        return FileResponse(path=file_path, filename=display_name, media_type="message/rfc822")

    raise HTTPException(404, "Archivo .eml no disponible en disco")


@router.get("/{solicitud_id}/adjuntos/{nombre}")
async def descargar_adjunto_por_nombre(
    solicitud_id: str,
    nombre: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import base64 as _b64
    result = await db.execute(select(Solicitud).where(Solicitud.id == solicitud_id))
    sol = result.scalar_one_or_none()
    if not sol or not sol.datos_adjuntos:
        raise HTTPException(404, "Adjunto no encontrado")
    if current_user.role == "ejecutivo" and str(sol.ejecutivo_id) != str(current_user.id):
        raise HTTPException(403, "No tienes acceso a esta solicitud")

    for a in sol.datos_adjuntos:
        if a.get("filename") == nombre or a.get("stored_filename") == nombre:
            display_name = a.get("filename", nombre)
            content_type = a.get("content_type") or (
                "message/rfc822" if a.get("tipo") == "eml" else "application/octet-stream"
            )

            # Backward compat: old records stored content in DB
            if a.get("content_b64"):
                try:
                    return Response(
                        content=_b64.b64decode(a["content_b64"]),
                        media_type=content_type,
                        headers={"Content-Disposition": f'attachment; filename="{display_name}"'},
                    )
                except Exception:
                    pass

            # New records: serve from disk
            file_path = _find_file(a, sol.nro_ticket)
            if file_path:
                return FileResponse(path=file_path, filename=display_name, media_type=content_type)

            raise HTTPException(404, "Archivo no disponible en disco")

    raise HTTPException(404, f"Adjunto '{nombre}' no encontrado en esta solicitud")


# ════════════════════════════════════════════════════════════════════
# 6b) SUBIR ADJUNTOS DESDE FRONTEND
# ════════════════════════════════════════════════════════════════════

@router.post("/{solicitud_id}/adjuntos", status_code=status.HTTP_200_OK)
async def subir_adjuntos(
    solicitud_id: str,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Solicitud).where(Solicitud.id == solicitud_id))
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if current_user.role == "ejecutivo" and str(sol.ejecutivo_id) != str(current_user.id):
        raise HTTPException(403, "No tienes acceso a esta solicitud")

    base_dir = settings.emails_dir / (sol.nro_ticket or solicitud_id)
    base_dir.mkdir(parents=True, exist_ok=True)

    adjuntos_meta: List[dict] = list(sol.datos_adjuntos or [])
    for upload in files:
        safe_name = re.sub(r"[^\w.\-]", "_", upload.filename or "adjunto")
        if any(a.get("filename") == safe_name for a in adjuntos_meta):
            safe_name = f"{uuid.uuid4().hex[:6]}_{safe_name}"
        dest = base_dir / safe_name
        content_type = upload.content_type or (mimetypes.guess_type(safe_name)[0] or "application/octet-stream")
        data = await upload.read()
        dest.write_bytes(data)
        # Store relative path so it is portable across environments
        nro = sol.nro_ticket or solicitud_id
        relative_path = f"uploads/emails/{nro}/{safe_name}"
        adjuntos_meta.append({
            "filename": safe_name,
            "stored_filename": safe_name,
            "path": relative_path,
            "size": len(data),
            "content_type": content_type,
            "tipo": "adjunto",
        })

    sol.datos_adjuntos = adjuntos_meta
    await db.commit()
    await db.refresh(sol)
    return {"ok": True, "datos_adjuntos": sol.datos_adjuntos}


# ════════════════════════════════════════════════════════════════════
# 6c) ELIMINAR ADJUNTO POR NOMBRE
# ════════════════════════════════════════════════════════════════════

@router.delete("/{solicitud_id}/adjuntos/{nombre}", status_code=status.HTTP_200_OK)
async def eliminar_adjunto(
    solicitud_id: str,
    nombre: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Solicitud).where(Solicitud.id == solicitud_id))
    sol = result.scalar_one_or_none()
    if not sol or not sol.datos_adjuntos:
        raise HTTPException(404, "Solicitud o adjunto no encontrado")
    if current_user.role == "ejecutivo" and str(sol.ejecutivo_id) != str(current_user.id):
        raise HTTPException(403, "No tienes acceso a esta solicitud")

    nuevo_listado = []
    eliminado = False
    for a in sol.datos_adjuntos:
        if not eliminado and (a.get("filename") == nombre or a.get("stored_filename") == nombre):
            path = a.get("path")
            if path and os.path.exists(path):
                try:
                    shutil.os.remove(path)
                except OSError:
                    pass
            eliminado = True
        else:
            nuevo_listado.append(a)

    if not eliminado:
        raise HTTPException(404, "Adjunto no encontrado")

    sol.datos_adjuntos = nuevo_listado or None
    await db.commit()
    await db.refresh(sol)
    return {"ok": True, "datos_adjuntos": sol.datos_adjuntos}


# ════════════════════════════════════════════════════════════════════
# 7) ELIMINAR (admin only)
# ════════════════════════════════════════════════════════════════════

@router.delete("/{solicitud_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_solicitud(
    solicitud_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(select(Solicitud).where(Solicitud.id == solicitud_id))
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    await db.delete(sol)
    await db.commit()
    return None


# ════════════════════════════════════════════════════════════════════
# 8) CREACIÓN MANUAL DESDE FRONTEND
# ════════════════════════════════════════════════════════════════════

@router.post("/manual", status_code=status.HTTP_201_CREATED)
async def crear_solicitud_manual(
    data: SolicitudCreateManual,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    nro_ticket = await generar_nro_ticket(db)
    estado_id = data.estado_id or await resolver_estado_pendiente_id(db)

    cliente = data.cliente
    aseg_id = data.aseguradora_id
    ramo_id_v = data.ramo_id
    if data.remitente and not cliente:
        cli, aseg_auto, ramo_auto = await resolver_cliente_por_remitente(db, data.remitente)
        cliente = cli
        aseg_id = aseg_id or aseg_auto
        ramo_id_v = ramo_id_v or ramo_auto

    if rf_loaded():
        pred = await _predecir_con_rf(
            db,
            tipo_solicitud_id=data.tipo_solicitud_id,
            prioridad_id=data.prioridad_id,
            aseguradora_id=aseg_id,
            ramo_id=ramo_id_v,
            nro_atenciones=data.nro_atenciones or 1,
            fecha_recepcion=data.fecha_recepcion,
        )
    else:
        pred = _pred_sin_modelo()

    sol = Solicitud(
        nro_ticket=nro_ticket,
        cliente=cliente or "Pendiente de asignar",
        remitente=data.remitente,
        tipo_solicitud_id=data.tipo_solicitud_id,
        estado_id=estado_id,
        aseguradora_id=aseg_id,
        prioridad_id=data.prioridad_id,
        ramo_id=ramo_id_v,
        asunto=data.asunto,
        cuerpo_correo=data.cuerpo_correo,
        fecha_recepcion=data.fecha_recepcion or datetime.now(timezone.utc),
        comentarios=data.comentarios,
        probabilidad=pred.get("probabilidad"),
        prediccion=pred.get("prediccion"),

        estado="Pendiente",
        fuente="manual",
        nro_atenciones=data.nro_atenciones or 1,
    )
    db.add(sol)
    await db.commit()
    await db.refresh(sol)

    if rf_loaded() and "_rf_result" in pred:
        await _guardar_prediccion_ans(db, sol, pred["_rf_result"])
        await db.commit()

    return {
        "id": str(sol.id),
        "nro_ticket": nro_ticket,
        "prediccion": pred["prediccion"],
        "probabilidad": pred["probabilidad"],
    }


# ════════════════════════════════════════════════════════════════════
# ENDPOINTS LEGADOS (preservados — simplificados)
# ════════════════════════════════════════════════════════════════════


@router.get("/", response_model=PaginatedResponse)
async def listar_solicitudes_legacy(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    estado: Optional[str] = None,
    aseguradora_id: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Solicitud).options(
        selectinload(Solicitud.aseguradora),
    ).order_by(desc(Solicitud.created_at))

    if current_user.role == "ejecutivo":
        query = query.where(Solicitud.ejecutivo_id == current_user.id)

    if estado:
        query = query.where(Solicitud.estado == estado)
    if aseguradora_id:
        query = query.where(Solicitud.aseguradora_id == aseguradora_id)
    if search:
        query = query.where(Solicitud.nro_ticket.ilike(f"%{search}%"))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    items = (await db.execute(query.offset((page - 1) * size).limit(size))).scalars().all()

    return PaginatedResponse(
        items=[SolicitudOut.model_validate(s) for s in items],
        total=total, page=page, size=size,
        pages=(total + size - 1) // size if total else 0,
    )


@router.get("/{solicitud_id}")
async def obtener_solicitud_legacy(
    solicitud_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Solicitud).options(
            selectinload(Solicitud.aseguradora),
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.ramo),
            selectinload(Solicitud.estado_rel),
            selectinload(Solicitud.prioridad_rel),
        ).where(Solicitud.id == solicitud_id)
    )
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if current_user.role == "ejecutivo" and str(sol.ejecutivo_id) != str(current_user.id):
        raise HTTPException(403, "No tienes acceso a esta solicitud")
    return _solicitud_to_detail(sol)
