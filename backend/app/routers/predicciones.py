from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import Solicitud, PrediccionANS
from app.models.user import User
from app.schemas.schemas import PredictionRequest, PredictionResponse, SolicitudConPrediccionOut
from app.ml.predictor import predictor

router = APIRouter()


@router.post("/predict", response_model=PredictionResponse)
async def predict_ans(
    data: PredictionRequest,
    _: User = Depends(get_current_user),
):
    """Predicción ANS basada en asunto, cuerpo y prioridad del correo."""
    result = predictor.predict_simple(
        asunto=data.asunto or "",
        cuerpo=data.cuerpo or "",
        prioridad_nombre=data.prioridad_nombre,
    )
    return PredictionResponse(
        cumple_ans=result["prediccion"] == "Dentro de ANS",
        probabilidad_riesgo=result["probabilidad"],
        nivel_riesgo="alto" if result["probabilidad"] > 0.70 else ("medio" if result["probabilidad"] > 0.40 else "bajo"),
        mensaje=result["prediccion"],
        recomendacion="",
        modelo_version=result["modelo_version"],
        tiempo_prediccion_ms=result["tiempo_prediccion_ms"],
    )


@router.get("/resultados", response_model=List[SolicitudConPrediccionOut])
async def resultados_predicciones(
    skip: int = 0,
    limit: int = 50,
    nivel_riesgo: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tabla de resultados con predicciones."""
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

    result = []
    for s in items:
        result.append(SolicitudConPrediccionOut(
            id=s.id,
            nro_ticket=s.nro_ticket,
            cliente=s.cliente,
            estado=s.estado,
            fuente=s.fuente,
            aseguradora=s.aseguradora.nombre if s.aseguradora else None,
            ans_horas_limite=s.aseguradora.ans_horas_limite if s.aseguradora else None,
            cumple_ans=s.prediccion_rel.cumple_ans if s.prediccion_rel else None,
            probabilidad_riesgo=s.prediccion_rel.probabilidad_riesgo if s.prediccion_rel else None,
            nivel_riesgo=s.prediccion_rel.nivel_riesgo if s.prediccion_rel else None,
            prediccion_fecha=s.prediccion_rel.created_at if s.prediccion_rel else None,
        ))
    return result
