"""
Router de Predicciones ANS.

Endpoints:
  POST /api/predicciones/predict
      → Predicción con datos textuales (legado, sin solicitud_id)

  POST /api/predicciones/predict-solicitud
      → Predicción completa a partir de un solicitud_id.
        Carga la solicitud con sus relaciones, aplica el RF y persiste
        el resultado en predicciones_ans + solicitudes.probabilidad/prediccion.

  GET  /api/predicciones/resultados
      → Tabla de solicitudes con predicción real del RF v2.
        Solo devuelve filas que tienen registro en predicciones_ans
        con modelo_version = "Random Forest v2".
        Soporta filtros: prediccion_ans, nivel_riesgo, min_probabilidad.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import Solicitud, PrediccionANS
from app.models.user import User
from app.schemas.schemas import (
    PredictionRequest, PredictionResponse,
    PredictionRFResponse, SolicitudConPrediccionOut,
)
from app.ml.predictor import predictor
from app.services.prediction_service import predecir_ans, is_loaded
from app.services.alertas_service import gestionar_alerta_riesgo
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

MODEL_VERSION_RF2 = "Random Forest v2"


# ── Helper: guardar/actualizar PrediccionANS ─────────────────────────────────

async def _persistir_prediccion(
    db: AsyncSession,
    solicitud: Solicitud,
    result: dict,
) -> None:
    """
    Persiste en predicciones_ans SOLO cuando el RF v2 produjo un resultado válido.
    Si prediccion_ans no es 'Dentro de ANS' ni 'Fuera de ANS', no guarda nada.
    Tras persistir, gestiona la alerta de riesgo correspondiente.
    """
    pred = result["prediccion_ans"]
    if pred not in ("Dentro de ANS", "Fuera de ANS"):
        return

    prob = result["probabilidad_incumplimiento"]
    nivel = (
        "critico" if prob >= 0.85
        else "alto" if prob >= 0.70
        else "medio" if prob >= 0.40
        else "bajo"
    )

    # Actualizar campos resumen en solicitudes
    solicitud.probabilidad = prob
    solicitud.prediccion = pred

    # Crear o reemplazar registro en predicciones_ans
    existing = (await db.execute(
        select(PrediccionANS).where(PrediccionANS.solicitud_id == solicitud.id)
    )).scalar_one_or_none()

    if existing:
        existing.cumple_ans = (pred == "Dentro de ANS")
        existing.probabilidad_riesgo = prob
        existing.nivel_riesgo = nivel
        existing.features_input = result.get("variables_usadas", {})
        existing.modelo_version = result.get("modelo_usado", "")
        existing.tiempo_prediccion_ms = result.get("tiempo_prediccion_ms", 0.0)
    else:
        db.add(PrediccionANS(
            solicitud_id=solicitud.id,
            cumple_ans=(pred == "Dentro de ANS"),
            probabilidad_riesgo=prob,
            nivel_riesgo=nivel,
            features_input=result.get("variables_usadas", {}),
            modelo_version=result.get("modelo_usado", ""),
            tiempo_prediccion_ms=result.get("tiempo_prediccion_ms", 0.0),
        ))

    await gestionar_alerta_riesgo(db, solicitud, prob, pred)
    await db.commit()


# ── POST /predict (legado) ────────────────────────────────────────────────────

@router.post("/predict", response_model=PredictionResponse)
async def predict_ans_legacy(
    data: PredictionRequest,
    _: User = Depends(get_current_user),
):
    """
    [LEGACY] Heurística de palabras clave pura. No usa RF v2. No persiste en BD.
    modelo_version siempre será 'legacy_no_persistente'.
    """
    result = predictor.predict_simple(
        asunto=data.asunto or "",
        cuerpo=data.cuerpo or "",
        prioridad_nombre=data.prioridad_nombre,
    )
    prob = result["probabilidad"]
    return PredictionResponse(
        cumple_ans=result["prediccion"] == "Dentro de ANS",
        probabilidad_riesgo=prob,
        nivel_riesgo=(
            "critico" if prob >= 0.85
            else "alto" if prob >= 0.70
            else "medio" if prob >= 0.40
            else "bajo"
        ),
        mensaje=result["prediccion"],
        recomendacion="",
        modelo_version=result["modelo_version"],
        tiempo_prediccion_ms=result["tiempo_prediccion_ms"],
    )


# ── POST /predict-solicitud (RF completo) ─────────────────────────────────────

@router.post("/predict-solicitud", response_model=PredictionRFResponse)
async def predict_por_solicitud(
    solicitud_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Carga una solicitud desde la BD, construye el vector de features con sus
    relaciones reales y ejecuta el modelo Random Forest.

    Persiste el resultado en predicciones_ans y actualiza solicitudes.probabilidad.
    """
    if not is_loaded():
        raise HTTPException(
            status_code=503,
            detail="Modelo Random Forest v2 no disponible. "
                   "Verifique que ml_models/modelo_random_forest_v2.pkl exista.",
        )

    sol = (await db.execute(
        select(Solicitud).options(
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.prioridad_rel),
            selectinload(Solicitud.aseguradora),
            selectinload(Solicitud.ramo),
        ).where(Solicitud.id == solicitud_id)
    )).scalar_one_or_none()

    if sol is None:
        raise HTTPException(404, "Solicitud no encontrada")

    if current_user.role == "ejecutivo" and str(sol.ejecutivo_id) != str(current_user.id):
        raise HTTPException(403, "No tienes acceso a esta solicitud")

    result = predecir_ans(
        tipo_solicitud=sol.tipo_solicitud.nombre if sol.tipo_solicitud else None,
        prioridad=sol.prioridad_rel.nombre if sol.prioridad_rel else None,
        aseguradora=sol.aseguradora.nombre if sol.aseguradora else None,
        producto=sol.ramo.nombre if sol.ramo else None,
        nro_atenciones=sol.nro_atenciones,
        fecha_recepcion=sol.fecha_recepcion,
        umbral=settings.PROBABILIDAD_UMBRAL_ANS,
    )

    await _persistir_prediccion(db, sol, result)

    return PredictionRFResponse(
        prediccion_ans=result["prediccion_ans"],
        probabilidad_incumplimiento=result["probabilidad_incumplimiento"],
        modelo_usado=result["modelo_usado"],
        variables_usadas=result["variables_usadas"],
        advertencias=result.get("advertencias", []),
        tiempo_prediccion_ms=result["tiempo_prediccion_ms"],
    )


# ── GET /resultados ────────────────────────────────────────────────────────────

@router.get("/resultados", response_model=List[SolicitudConPrediccionOut])
async def resultados_predicciones(
    skip: int = 0,
    limit: int = 100,
    nivel_riesgo: Optional[str] = None,
    prediccion_ans: Optional[str] = None,
    min_probabilidad: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tabla de solicitudes con predicción real del RF v2.
    Solo devuelve solicitudes que tienen registro en predicciones_ans
    con modelo_version = 'Random Forest v2' (INNER JOIN).
    Ordenadas por probabilidad_riesgo descendente.
    """
    query = (
        select(Solicitud)
        .options(
            selectinload(Solicitud.prediccion_rel),
            selectinload(Solicitud.aseguradora),
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.ramo),
            selectinload(Solicitud.estado_rel),
            selectinload(Solicitud.ejecutivo_rel),
            selectinload(Solicitud.alertas),
        )
        .join(PrediccionANS, Solicitud.id == PrediccionANS.solicitud_id)
        .where(PrediccionANS.modelo_version == MODEL_VERSION_RF2)
        .order_by(desc(PrediccionANS.probabilidad_riesgo))
        .offset(skip)
        .limit(limit)
    )

    if current_user.role == "ejecutivo":
        query = query.where(Solicitud.ejecutivo_id == current_user.id)

    if nivel_riesgo:
        query = query.where(PrediccionANS.nivel_riesgo == nivel_riesgo)

    if prediccion_ans == "Dentro de ANS":
        query = query.where(PrediccionANS.cumple_ans == True)
    elif prediccion_ans == "Fuera de ANS":
        query = query.where(PrediccionANS.cumple_ans == False)

    if min_probabilidad is not None:
        query = query.where(PrediccionANS.probabilidad_riesgo >= min_probabilidad)

    items = (await db.execute(query)).scalars().all()

    return [_to_prediccion_out(s) for s in items]


def _to_prediccion_out(s: Solicitud) -> SolicitudConPrediccionOut:
    pred = s.prediccion_rel
    tiene_alerta_activa = any(
        not a.resuelta and a.tipo in ("alto_riesgo", "critico")
        for a in (s.alertas or [])
    )
    return SolicitudConPrediccionOut(
        id=s.id,
        nro_ticket=s.nro_ticket,
        cliente=s.cliente,
        tipo_solicitud=s.tipo_solicitud.nombre if s.tipo_solicitud else None,
        aseguradora=s.aseguradora.nombre if s.aseguradora else None,
        ramo=s.ramo.nombre if s.ramo else None,
        ejecutivo=s.ejecutivo_rel.full_name if s.ejecutivo_rel else None,
        estado=s.estado_rel.nombre if s.estado_rel else (s.estado or ""),
        fuente=s.fuente,
        prediccion=s.prediccion,
        probabilidad_riesgo=pred.probabilidad_riesgo if pred else None,
        nivel_riesgo=pred.nivel_riesgo if pred else None,
        cumple_ans=pred.cumple_ans if pred else None,
        fecha_recepcion=s.fecha_recepcion,
        prediccion_fecha=pred.created_at if pred else None,
        alertada=tiene_alerta_activa,
        modelo_version=pred.modelo_version if pred else None,
    )
