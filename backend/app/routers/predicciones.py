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
      → Tabla de solicitudes con sus predicciones almacenadas.
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
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helper: guardar/actualizar PrediccionANS ─────────────────────────────────

async def _persistir_prediccion(
    db: AsyncSession,
    solicitud: Solicitud,
    result: dict,
) -> None:
    """
    Crea o actualiza el registro en predicciones_ans y sincroniza los campos
    probabilidad / prediccion en la tabla solicitudes.
    """
    prob = result["probabilidad_incumplimiento"]
    pred = result["prediccion_ans"]
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

    await db.commit()


# ── POST /predict (legado) ────────────────────────────────────────────────────

@router.post("/predict", response_model=PredictionResponse)
async def predict_ans_legacy(
    data: PredictionRequest,
    _: User = Depends(get_current_user),
):
    """Predicción ANS basada en asunto, cuerpo y prioridad del correo (interfaz legada)."""
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
            detail="Modelo Random Forest no disponible. "
                   "Verifique que ml_models/modelo_random_forest.pkl exista.",
        )

    # Cargar solicitud con todas las relaciones necesarias
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
    limit: int = 50,
    nivel_riesgo: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tabla de solicitudes con sus predicciones almacenadas."""
    query = (
        select(Solicitud)
        .options(
            selectinload(Solicitud.prediccion_rel),
            selectinload(Solicitud.aseguradora),
        )
        .join(PrediccionANS, Solicitud.id == PrediccionANS.solicitud_id, isouter=True)
        .order_by(desc(Solicitud.created_at))
        .offset(skip)
        .limit(limit)
    )

    if current_user.role == "ejecutivo":
        query = query.where(Solicitud.ejecutivo_id == current_user.id)

    if nivel_riesgo:
        query = query.where(PrediccionANS.nivel_riesgo == nivel_riesgo)

    items = (await db.execute(query)).scalars().all()

    return [
        SolicitudConPrediccionOut(
            id=s.id,
            nro_ticket=s.nro_ticket,
            cliente=s.cliente,
            estado=s.estado,
            fuente=s.fuente,
            aseguradora=s.aseguradora.nombre if s.aseguradora else None,
            cumple_ans=s.prediccion_rel.cumple_ans if s.prediccion_rel else None,
            probabilidad_riesgo=s.prediccion_rel.probabilidad_riesgo if s.prediccion_rel else None,
            nivel_riesgo=s.prediccion_rel.nivel_riesgo if s.prediccion_rel else None,
            prediccion_fecha=s.prediccion_rel.created_at if s.prediccion_rel else None,
        )
        for s in items
    ]
