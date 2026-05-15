"""
Router de Solicitudes.

Mantiene los endpoints legados (POST /, GET /, /bulk-upload, etc.) y agrega:

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
import io
import os
import re
import uuid
import pandas as pd
from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File,
    Query, status,
)
import mimetypes
import shutil
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin
from app.core.api_key import verify_api_key
from app.core.config import settings
from app.models.solicitud import (
    Solicitud, Aseguradora, TipoOperacion, PrediccionANS, Alerta,
    TipoSolicitud, EstadoSolicitud, Prioridad, Ramo,
)
from app.models.user import User
from app.schemas.schemas import (
    SolicitudCreate, SolicitudOut, BulkUploadResult, PaginatedResponse,
    OutlookSolicitudIn, OutlookSolicitudOut,
    SolicitudUpdate, SolicitudCreateManual,
    ComentarioAdd,
)
from app.ml.predictor import predictor
from app.services.outlook_service import (
    generar_nro_ticket, resolver_tipo_solicitud_id,
    resolver_cliente_por_remitente, resolver_prioridad_id,
    resolver_estado_pendiente_id,
    guardar_eml, guardar_adjunto,
)

router = APIRouter()


# ════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════

def generar_numero_solicitud_legacy() -> str:
    """Identificador legado SOL-YYYYMMDD-XXXXXX (compatibilidad bulk-upload)."""
    now = datetime.now(timezone.utc)
    return f"SOL-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"


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
        "remitente": s.remitente,
        "asunto": s.asunto,
        "detalle_correo": _strip_html(s.cuerpo_correo, 200),
        "probabilidad": s.probabilidad,
        "prediccion": s.prediccion,
        "tiene_adjuntos": bool(s.datos_adjuntos),
        "fuente": s.fuente,
        "created_at": s.created_at,
    }


def _solicitud_to_detail(s: Solicitud) -> dict:
    base = _solicitud_to_list_item(s)
    base.update({
        "cuerpo_correo": s.cuerpo_correo,
        "comentarios": s.comentarios,
        "datos_adjuntos": s.datos_adjuntos or [],
        "tipo_solicitud_id": s.tipo_solicitud_id,
        "estado_id": s.estado_id,
        "aseguradora_id": s.aseguradora_id,
        "prioridad_id": s.prioridad_id,
        "ramo_id": s.ramo_id,
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

    cliente, aseguradora_id, ramo_id = await resolver_cliente_por_remitente(
        db, payload.remitente
    )

    tipo_solicitud_id = await resolver_tipo_solicitud_id(db, payload.asunto)
    estado_id = await resolver_estado_pendiente_id(db)
    prioridad_id = await resolver_prioridad_id(db, payload.prioridad)

    pred = predictor.predict_simple(
        asunto=payload.asunto,
        cuerpo=payload.cuerpo_correo or "",
        prioridad_nombre=payload.prioridad,
        umbral=settings.PROBABILIDAD_UMBRAL_ANS,
    )

    adjuntos_meta: List[dict] = []
    if payload.eml_base64:
        try:
            meta = guardar_eml(payload.eml_base64, payload.eml_filename, nro_ticket)
            adjuntos_meta.append(meta)
        except Exception as e:
            raise HTTPException(400, f"Error guardando .eml: {e}")

    if payload.adjuntos:
        for adj in payload.adjuntos:
            try:
                meta = guardar_adjunto(adj.content_base64, adj.filename, nro_ticket)
                meta["content_type"] = adj.content_type
                adjuntos_meta.append(meta)
            except Exception as e:
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
        probabilidad=pred["probabilidad"],
        prediccion=pred["prediccion"],
        estado="Pendiente",
        fuente="outlook",
    )
    db.add(solicitud)
    await db.commit()
    await db.refresh(solicitud)

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
    )

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
        ).where(Solicitud.id == solicitud_id)
    )
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
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

    payload = data.model_dump(exclude_unset=True)

    if "estado_id" in payload and payload["estado_id"]:
        estado = (await db.execute(
            select(EstadoSolicitud).where(EstadoSolicitud.id == payload["estado_id"])
        )).scalar_one_or_none()
        if estado and estado.nombre.lower() == "finalizado" and not sol.fecha_finalizado:
            sol.fecha_finalizado = datetime.now(timezone.utc)
        sol.estado = estado.nombre if estado else sol.estado

    for k, v in payload.items():
        setattr(sol, k, v)

    await db.commit()
    await db.refresh(sol)

    result = await db.execute(
        select(Solicitud).options(
            selectinload(Solicitud.aseguradora),
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.ramo),
            selectinload(Solicitud.estado_rel),
            selectinload(Solicitud.prioridad_rel),
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
# 6) DESCARGA DE ADJUNTOS
# ════════════════════════════════════════════════════════════════════

@router.get("/{solicitud_id}/adjunto")
async def descargar_eml_principal(
    solicitud_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Solicitud).where(Solicitud.id == solicitud_id))
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    if not sol.datos_adjuntos:
        raise HTTPException(404, "Esta solicitud no tiene adjuntos")

    eml = next((a for a in sol.datos_adjuntos if a.get("tipo") == "eml"), None)
    if not eml:
        eml = sol.datos_adjuntos[0]

    path = eml.get("path")
    if not path or not os.path.exists(path):
        raise HTTPException(404, f"Archivo no encontrado en disco: {path}")

    return FileResponse(
        path=path,
        filename=eml.get("filename", "correo.eml"),
        media_type="message/rfc822",
    )


@router.get("/{solicitud_id}/adjuntos/{nombre}")
async def descargar_adjunto_por_nombre(
    solicitud_id: str,
    nombre: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Solicitud).where(Solicitud.id == solicitud_id))
    sol = result.scalar_one_or_none()
    if not sol or not sol.datos_adjuntos:
        raise HTTPException(404, "Adjunto no encontrado")

    for a in sol.datos_adjuntos:
        if a.get("filename") == nombre or a.get("stored_filename") == nombre:
            display_name = a.get("filename", nombre)
            stored = a.get("stored_filename") or a.get("filename")
            # 1) stored path
            candidates = [a.get("path")]
            # 2) fallback: look in emails_dir by stored_filename, then by filename
            if stored:
                candidates.append(str(settings.emails_dir / stored))
            if a.get("filename"):
                candidates.append(str(settings.emails_dir / a["filename"]))
            # 3) fallback: nro_ticket subfolder
            if sol.nro_ticket and stored:
                candidates.append(str(settings.emails_dir / sol.nro_ticket / stored))
            if sol.nro_ticket and a.get("filename"):
                candidates.append(str(settings.emails_dir / sol.nro_ticket / a["filename"]))

            for candidate in candidates:
                if candidate and os.path.exists(candidate):
                    return FileResponse(path=candidate, filename=display_name)

            raise HTTPException(
                404,
                f"Archivo '{stored}' registrado en la solicitud pero no encontrado en disco "
                f"(rutas buscadas: {[c for c in candidates if c]})"
            )

    raise HTTPException(404, f"No se encontró ningún adjunto con nombre '{nombre}' en esta solicitud")


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

    base_dir = settings.emails_dir / (sol.nro_ticket or solicitud_id)
    base_dir.mkdir(parents=True, exist_ok=True)

    adjuntos_meta: List[dict] = list(sol.datos_adjuntos or [])
    for upload in files:
        safe_name = re.sub(r"[^\w.\-]", "_", upload.filename or "adjunto")
        # Avoid overwriting — prefix with short uuid if name already exists
        if any(a.get("filename") == safe_name for a in adjuntos_meta):
            safe_name = f"{uuid.uuid4().hex[:6]}_{safe_name}"
        dest = base_dir / safe_name
        content_type = upload.content_type or (mimetypes.guess_type(safe_name)[0] or "application/octet-stream")
        data = await upload.read()
        dest.write_bytes(data)
        adjuntos_meta.append({
            "filename": safe_name,
            "stored_filename": safe_name,
            "path": str(dest),
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
    current_user: User = Depends(get_current_user),
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

    pred = predictor.predict_simple(
        asunto=data.asunto or "",
        cuerpo=data.cuerpo_correo or "",
        prioridad_nombre=None,
        umbral=settings.PROBABILIDAD_UMBRAL_ANS,
    )

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
        probabilidad=pred["probabilidad"],
        prediccion=pred["prediccion"],
        estado="Pendiente",
        fuente="manual",
        usuario_id=current_user.id,
    )
    db.add(sol)
    await db.commit()
    await db.refresh(sol)
    return {
        "id": str(sol.id),
        "nro_ticket": nro_ticket,
        "prediccion": pred["prediccion"],
        "probabilidad": pred["probabilidad"],
    }


# ════════════════════════════════════════════════════════════════════
# ENDPOINTS LEGADOS (preservados)
# ════════════════════════════════════════════════════════════════════

async def _crear_prediccion_legacy(db, solicitud, aseguradora, tipo_op, current_user):
    pred_data = {
        "fecha_ingreso": solicitud.fecha_ingreso.isoformat(),
        "fecha_esperada_atencion": solicitud.fecha_esperada_atencion.isoformat(),
        "cantidad_asegurados": solicitud.cantidad_asegurados,
        "tiempo_estimado_atencion": solicitud.tiempo_estimado_atencion,
        "ans_horas_limite": aseguradora.ans_horas_limite if aseguradora else 48.0,
        "peso_complejidad": tipo_op.peso_complejidad if tipo_op else 1.0,
        "tipo_operacion_id": solicitud.tipo_operacion_id,
        "aseguradora_id": solicitud.aseguradora_id,
    }
    result = predictor.predict(pred_data)

    prediccion = PrediccionANS(
        solicitud_id=solicitud.id,
        cumple_ans=result["cumple_ans"],
        probabilidad_riesgo=result["probabilidad_riesgo"],
        nivel_riesgo=result["nivel_riesgo"],
        features_input=pred_data,
        modelo_version=result["modelo_version"],
        tiempo_prediccion_ms=result["tiempo_prediccion_ms"],
    )
    db.add(prediccion)

    if result["nivel_riesgo"] in ("alto", "critico"):
        alerta = Alerta(
            solicitud_id=solicitud.id,
            tipo="alto_riesgo" if result["nivel_riesgo"] == "alto" else "critico",
            mensaje=result["mensaje"],
            usuario_id=current_user.id,
        )
        db.add(alerta)


@router.post("/", response_model=SolicitudOut, status_code=status.HTTP_201_CREATED)
async def crear_solicitud_legacy(
    data: SolicitudCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    aseg = (await db.execute(select(Aseguradora).where(Aseguradora.id == data.aseguradora_id))).scalar_one_or_none()
    if not aseg:
        raise HTTPException(404, "Aseguradora no encontrada")
    tipo_op = (await db.execute(select(TipoOperacion).where(TipoOperacion.id == data.tipo_operacion_id))).scalar_one_or_none()
    if not tipo_op:
        raise HTTPException(404, "Tipo de operación no encontrado")

    solicitud = Solicitud(
        numero_solicitud=generar_numero_solicitud_legacy(),
        nro_ticket=await generar_nro_ticket(db),
        usuario_id=current_user.id,
        fuente="manual",
        estado="Pendiente",
        **data.model_dump(),
    )
    db.add(solicitud)
    await db.flush()
    await _crear_prediccion_legacy(db, solicitud, aseg, tipo_op, current_user)
    await db.commit()
    await db.refresh(solicitud)
    return solicitud


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
        selectinload(Solicitud.tipo_operacion),
    ).order_by(desc(Solicitud.created_at))

    if estado:
        query = query.where(Solicitud.estado == estado)
    if aseguradora_id:
        query = query.where(Solicitud.aseguradora_id == aseguradora_id)
    if search:
        query = query.where(or_(
            Solicitud.numero_solicitud.ilike(f"%{search}%"),
            Solicitud.nro_ticket.ilike(f"%{search}%"),
        ))

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
            selectinload(Solicitud.tipo_operacion),
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.ramo),
            selectinload(Solicitud.estado_rel),
            selectinload(Solicitud.prioridad_rel),
        ).where(Solicitud.id == solicitud_id)
    )
    sol = result.scalar_one_or_none()
    if not sol:
        raise HTTPException(404, "Solicitud no encontrada")
    return _solicitud_to_detail(sol)


@router.post("/bulk-upload", response_model=BulkUploadResult)
async def carga_masiva(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(400, "Formato no soportado. Use .xlsx, .xls o .csv")

    content = await file.read()
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Error al leer el archivo: {str(e)}")

    required_cols = {
        "fecha_ingreso", "tipo_operacion_id", "aseguradora_id",
        "cantidad_asegurados", "tiempo_estimado_atencion", "fecha_esperada_atencion"
    }
    missing = required_cols - set(df.columns)
    if missing:
        raise HTTPException(400, f"Columnas faltantes: {missing}")

    exitosos, errores, detalles = 0, 0, []
    aseg_cache = {a.id: a for a in (await db.execute(select(Aseguradora))).scalars().all()}
    tipo_cache = {t.id: t for t in (await db.execute(select(TipoOperacion))).scalars().all()}

    for idx, row in df.iterrows():
        try:
            fecha_ingreso = pd.to_datetime(row["fecha_ingreso"]).to_pydatetime()
            fecha_esperada = pd.to_datetime(row["fecha_esperada_atencion"]).to_pydatetime()
            if fecha_ingreso.tzinfo is None:
                fecha_ingreso = fecha_ingreso.replace(tzinfo=timezone.utc)
            if fecha_esperada.tzinfo is None:
                fecha_esperada = fecha_esperada.replace(tzinfo=timezone.utc)

            aseg_id = int(row["aseguradora_id"])
            tipo_id = int(row["tipo_operacion_id"])

            if aseg_id not in aseg_cache:
                raise ValueError(f"Aseguradora ID {aseg_id} no existe")
            if tipo_id not in tipo_cache:
                raise ValueError(f"Tipo operación ID {tipo_id} no existe")

            solicitud = Solicitud(
                numero_solicitud=generar_numero_solicitud_legacy(),
                nro_ticket=await generar_nro_ticket(db),
                fecha_ingreso=fecha_ingreso,
                tipo_operacion_id=tipo_id,
                aseguradora_id=aseg_id,
                cantidad_asegurados=int(row["cantidad_asegurados"]),
                tiempo_estimado_atencion=float(row["tiempo_estimado_atencion"]),
                fecha_esperada_atencion=fecha_esperada,
                usuario_id=current_user.id,
                observaciones=str(row.get("observaciones", "")) or None,
                fuente="excel" if not file.filename.endswith(".csv") else "csv",
                estado="Pendiente",
            )
            db.add(solicitud)
            await db.flush()
            await _crear_prediccion_legacy(db, solicitud, aseg_cache[aseg_id], tipo_cache[tipo_id], current_user)
            exitosos += 1
        except Exception as e:
            errores += 1
            detalles.append({"fila": idx + 2, "error": str(e)})
    await db.commit()
    return BulkUploadResult(total=len(df), exitosos=exitosos, errores=errores, detalles_errores=detalles)
