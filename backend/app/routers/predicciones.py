from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import Solicitud, Aseguradora, TipoOperacion, PrediccionANS
from app.models.user import User
from app.schemas.schemas import PredictionRequest, PredictionResponse, SolicitudConPrediccionOut
from app.ml.predictor import predictor

router = APIRouter()


@router.post("/predict", response_model=PredictionResponse)
async def predict_ans(
    data: PredictionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recibe datos de una solicitud y devuelve la predicción ANS."""
    aseg = None
    tipo = None

    if data.aseguradora_id:
        r = await db.execute(select(Aseguradora).where(Aseguradora.id == data.aseguradora_id))
        aseg = r.scalar_one_or_none()

    if data.tipo_operacion_id:
        r = await db.execute(select(TipoOperacion).where(TipoOperacion.id == data.tipo_operacion_id))
        tipo = r.scalar_one_or_none()

    pred_input = data.model_dump()
    pred_input["ans_horas_limite"] = aseg.ans_horas_limite if aseg else (data.ans_horas_limite or 48.0)
    pred_input["peso_complejidad"] = tipo.peso_complejidad if tipo else (data.peso_complejidad or 1.0)

    result = predictor.predict(pred_input)
    return PredictionResponse(**result)


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
            selectinload(Solicitud.prediccion),
            selectinload(Solicitud.aseguradora),
            selectinload(Solicitud.tipo_operacion),
            selectinload(Solicitud.usuario),
        )
        .join(PrediccionANS, Solicitud.id == PrediccionANS.solicitud_id, isouter=True)
        .order_by(desc(Solicitud.created_at))
        .offset(skip)
        .limit(limit)
    )

    if nivel_riesgo:
        query = query.where(PrediccionANS.nivel_riesgo == nivel_riesgo)

    items = (await db.execute(query)).scalars().all()

    result = []
    for s in items:
        result.append(SolicitudConPrediccionOut(
            id=s.id,
            numero_solicitud=s.numero_solicitud,
            fecha_ingreso=s.fecha_ingreso,
            fecha_esperada_atencion=s.fecha_esperada_atencion,
            cantidad_asegurados=s.cantidad_asegurados,
            tiempo_estimado_atencion=s.tiempo_estimado_atencion,
            estado=s.estado,
            fuente=s.fuente,
            tipo_operacion=s.tipo_operacion.nombre if s.tipo_operacion else None,
            aseguradora=s.aseguradora.nombre if s.aseguradora else None,
            ans_horas_limite=s.aseguradora.ans_horas_limite if s.aseguradora else None,
            usuario_nombre=s.usuario.full_name if s.usuario else None,
            cumple_ans=s.prediccion.cumple_ans if s.prediccion else None,
            probabilidad_riesgo=s.prediccion.probabilidad_riesgo if s.prediccion else None,
            nivel_riesgo=s.prediccion.nivel_riesgo if s.prediccion else None,
            prediccion_fecha=s.prediccion.created_at if s.prediccion else None,
        ))
    return result
