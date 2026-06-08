from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import Solicitud, PrediccionANS, Aseguradora, TipoSolicitud, Alerta
from app.models.user import User

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Totales generales
    total = (await db.execute(select(func.count(Solicitud.id)))).scalar() or 0
    dentro_ans = (await db.execute(
        select(func.count(PrediccionANS.id)).where(PrediccionANS.cumple_ans == True)
    )).scalar() or 0
    fuera_ans = (await db.execute(
        select(func.count(PrediccionANS.id)).where(PrediccionANS.cumple_ans == False)
    )).scalar() or 0
    criticos = (await db.execute(
        select(func.count(PrediccionANS.id)).where(PrediccionANS.nivel_riesgo == "critico")
    )).scalar() or 0
    alto_riesgo = (await db.execute(
        select(func.count(PrediccionANS.id)).where(PrediccionANS.nivel_riesgo == "alto")
    )).scalar() or 0
    promedio_riesgo = (await db.execute(
        select(func.avg(PrediccionANS.probabilidad_riesgo))
    )).scalar() or 0.0
    pendientes = (await db.execute(
        select(func.count(Solicitud.id)).where(Solicitud.estado == "pendiente")
    )).scalar() or 0
    alertas_no_leidas = (await db.execute(
        select(func.count(Alerta.id)).where(Alerta.leida == False)
    )).scalar() or 0

    # Por aseguradora
    por_aseg_q = await db.execute(
        select(Aseguradora.nombre, func.count(Solicitud.id).label("total"))
        .join(Solicitud, Solicitud.aseguradora_id == Aseguradora.id, isouter=True)
        .group_by(Aseguradora.nombre)
        .order_by(func.count(Solicitud.id).desc())
        .limit(8)
    )
    por_aseguradora = [{"nombre": r[0], "total": r[1]} for r in por_aseg_q]

    # Por tipo de solicitud
    por_tipo_q = await db.execute(
        select(TipoSolicitud.nombre, func.count(Solicitud.id).label("total"))
        .join(Solicitud, Solicitud.tipo_solicitud_id == TipoSolicitud.id, isouter=True)
        .group_by(TipoSolicitud.nombre)
        .order_by(func.count(Solicitud.id).desc())
        .limit(8)
    )
    por_tipo = [{"nombre": r[0], "total": r[1]} for r in por_tipo_q]

    # Tendencia últimos 7 días
    tendencia_q = await db.execute(
        text("""
            SELECT 
                DATE(s.created_at AT TIME ZONE 'UTC') as fecha,
                COUNT(*) as total,
                COUNT(p.id) FILTER (WHERE p.cumple_ans = true) as dentro,
                COUNT(p.id) FILTER (WHERE p.cumple_ans = false) as fuera
            FROM solicitudes s
            LEFT JOIN predicciones_ans p ON s.id = p.solicitud_id
            WHERE s.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(s.created_at AT TIME ZONE 'UTC')
            ORDER BY fecha ASC
        """)
    )
    tendencia_semanal = [
        {"fecha": str(r[0]), "total": r[1], "dentro": r[2], "fuera": r[3]}
        for r in tendencia_q
    ]

    return {
        "total_solicitudes": total,
        "dentro_ans": dentro_ans,
        "fuera_ans": fuera_ans,
        "criticos": criticos,
        "alto_riesgo": alto_riesgo,
        "promedio_riesgo": round(float(promedio_riesgo), 3),
        "pendientes": pendientes,
        "alertas_no_leidas": alertas_no_leidas,
        "por_aseguradora": por_aseguradora,
        "por_tipo_operacion": por_tipo,
        "tendencia_semanal": tendencia_semanal,
    }
