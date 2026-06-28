from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, and_, or_, not_, desc, update
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import (
    Solicitud, PrediccionANS, Aseguradora, TipoSolicitud, Alerta, EstadoSolicitud,
)
from app.models.user import User

router = APIRouter()

# ── Estados que indican solicitud "cerrada" / no operativa ────────────────────
# Se usan como filtro de exclusión en todas las métricas de riesgo operativo.
# Coincidencia por subcadena (ILIKE) contra solicitudes.estado (campo sincronizado
# con estados_solicitud.nombre cuando se actualiza via estado_id).
_KEYWORDS_FINALIZADAS = ("finaliz", "cerrad", "atendid", "complet")


def _filtro_no_finalizada():
    """
    Devuelve un filtro SQLAlchemy que excluye solicitudes cuyo campo `estado`
    contenga alguna de las palabras clave de estados finalizados.
    Aplica sobre Solicitud.estado (string), que siempre está sincronizado con
    el catálogo estados_solicitud.nombre cuando se edita vía estado_id.
    """
    return not_(
        or_(*[Solicitud.estado.ilike(f"%{kw}%") for kw in _KEYWORDS_FINALIZADAS])
    )


# ── Endpoint legado /stats ─────────────────────────────────────────────────────

@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Totales generales (históricos — sin filtro de estado)
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
        "por_tipo_solicitud": por_tipo,
        "tendencia_semanal": tendencia_semanal,
    }


# ── Endpoint principal /resumen ────────────────────────────────────────────────

@router.get("/resumen")
async def get_dashboard_resumen(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Endpoint operativo del dashboard ANS.

    Métricas HISTÓRICAS (incluyen finalizadas):
      - total, fuera_ans, dentro_ans, tendencia_semanal
      - desglose de estados (pendientes, en_proceso, finalizadas)

    Métricas OPERATIVAS (solo solicitudes activas — excluyen finalizadas):
      - solicitudes_riesgo, alto_riesgo, criticos, dist_riesgo,
        promedio_riesgo, sin_asignar, carga_ejecutivos.en_riesgo
    """
    from app.models.user import User as UserORM

    activa = _filtro_no_finalizada()

    # ── KPIs históricos (sin filtro de estado) ──────────────────────────────
    total = (await db.execute(select(func.count(Solicitud.id)))).scalar() or 0

    fuera_ans_n = (await db.execute(
        select(func.count(Solicitud.id)).where(Solicitud.prediccion == "Fuera de ANS")
    )).scalar() or 0

    dentro_ans_n = (await db.execute(
        select(func.count(Solicitud.id)).where(Solicitud.prediccion == "Dentro de ANS")
    )).scalar() or 0

    # ── KPIs operativos (solo solicitudes activas) ──────────────────────────
    sin_asignar_n = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.ejecutivo_id.is_(None),
        )
    )).scalar() or 0

    alto_riesgo_n = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
            Solicitud.probabilidad >= 0.70,
            Solicitud.probabilidad < 0.90,
        )
    )).scalar() or 0

    criticos_n = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
            Solicitud.probabilidad >= 0.90,
        )
    )).scalar() or 0

    promedio_riesgo = float((await db.execute(
        select(func.avg(Solicitud.probabilidad)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
        )
    )).scalar() or 0.0)

    # Alertas no leídas: solo alertas activas (resuelta=False) del usuario actual
    # Como las alertas se auto-resuelven al finalizar la solicitud, este conteo
    # es naturalmente correcto, pero filtramos resuelta=False por seguridad.
    alertas_no_leidas_n = (await db.execute(
        select(func.count(Alerta.id)).where(
            or_(
                Alerta.usuario_id == current_user.id,
                Alerta.usuario_id == None,
            ),
            Alerta.leida == False,
            Alerta.resuelta == False,
        )
    )).scalar() or 0

    # ── Breakdown de estados (histórico — todos los estados) ─────────────────
    estado_q = await db.execute(text("""
        SELECT COALESCE(es.nombre, s.estado) AS est, COUNT(*) AS n
        FROM solicitudes s
        LEFT JOIN estados_solicitud es ON s.estado_id = es.id
        GROUP BY COALESCE(es.nombre, s.estado)
    """))
    estados_raw = [(r[0] or "", r[1]) for r in estado_q]
    estados_list = [{"nombre": nombre, "count": int(count)}
                    for nombre, count in estados_raw if nombre]

    def _match(*keywords: str) -> int:
        return sum(count for nombre, count in estados_raw
                   if any(kw in (nombre or "").lower() for kw in keywords))

    pendientes_n  = _match("pendiente")
    en_proceso_n  = _match("proceso", "progreso", "curso")
    finalizadas_n = _match("finaliz", "complet", "cerrad", "atendid")

    # ── Distribución de riesgo — SOLO solicitudes activas ───────────────────
    dist_bajo = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
            Solicitud.probabilidad < 0.40,
        )
    )).scalar() or 0

    dist_medio = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
            Solicitud.probabilidad >= 0.40,
            Solicitud.probabilidad < 0.70,
        )
    )).scalar() or 0

    # ── Top 10 solicitudes en riesgo — SOLO activas ──────────────────────────
    riesgo_rows = (await db.execute(
        select(Solicitud).options(
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.aseguradora),
            selectinload(Solicitud.ramo),
            selectinload(Solicitud.estado_rel),
            selectinload(Solicitud.prioridad_rel),
            selectinload(Solicitud.ejecutivo_rel),
        )
        .where(
            activa,
            or_(
                Solicitud.prediccion == "Fuera de ANS",
                and_(Solicitud.probabilidad.isnot(None), Solicitud.probabilidad >= 0.70),
            ),
        )
        .order_by(desc(Solicitud.probabilidad))
        .limit(10)
    )).scalars().all()

    solicitudes_riesgo = [
        {
            "id": str(s.id),
            "nro_ticket": s.nro_ticket,
            "cliente": s.cliente,
            "tipo_solicitud": s.tipo_solicitud.nombre if s.tipo_solicitud else None,
            "ejecutivo": s.ejecutivo_rel.full_name if s.ejecutivo_rel else None,
            "aseguradora": s.aseguradora.nombre if s.aseguradora else None,
            "ramo": s.ramo.nombre if s.ramo else None,
            "probabilidad": round(s.probabilidad, 3) if s.probabilidad is not None else None,
            "prediccion": s.prediccion,
            "estado": s.estado_rel.nombre if s.estado_rel else s.estado,
            "prioridad": s.prioridad_rel.nombre if s.prioridad_rel else None,
            "fecha_recepcion": s.fecha_recepcion.isoformat() if s.fecha_recepcion else None,
        }
        for s in riesgo_rows
    ]

    # ── Top 5 sin asignar — SOLO activas ────────────────────────────────────
    sin_asig_rows = (await db.execute(
        select(Solicitud).options(
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.prioridad_rel),
        )
        .where(activa, Solicitud.ejecutivo_id.is_(None))
        .order_by(desc(Solicitud.created_at))
        .limit(5)
    )).scalars().all()

    sin_asignar_lista = [
        {
            "id": str(s.id),
            "nro_ticket": s.nro_ticket,
            "cliente": s.cliente,
            "tipo_solicitud": s.tipo_solicitud.nombre if s.tipo_solicitud else None,
            "prioridad": s.prioridad_rel.nombre if s.prioridad_rel else None,
            "fecha_recepcion": s.fecha_recepcion.isoformat() if s.fecha_recepcion else None,
        }
        for s in sin_asig_rows
    ]

    # ── Carga por ejecutivo — en_riesgo solo cuenta solicitudes activas ──────
    carga_q = await db.execute(
        select(
            UserORM.full_name,
            func.count(Solicitud.id).label("total"),
            func.count(Solicitud.id).filter(
                activa,
                Solicitud.probabilidad.isnot(None),
                Solicitud.probabilidad >= 0.70,
            ).label("en_riesgo"),
        )
        .join(Solicitud, Solicitud.ejecutivo_id == UserORM.id)
        .where(UserORM.role == "ejecutivo", UserORM.is_active == True)
        .group_by(UserORM.id, UserORM.full_name)
        .order_by(func.count(Solicitud.id).desc())
        .limit(10)
    )
    carga_rows = carga_q.all()
    max_carga = max((r[1] for r in carga_rows), default=1) or 1
    carga_ejecutivos = [
        {
            "ejecutivo": r[0],
            "total": r[1],
            "en_riesgo": r[2] or 0,
            "carga_pct": round((r[1] / max_carga) * 100),
        }
        for r in carga_rows
        if r[1] > 0
    ]

    # ── Tendencia semanal (histórico — incluye todas) ────────────────────────
    tendencia_q = await db.execute(text("""
        SELECT
            DATE(s.created_at AT TIME ZONE 'UTC') AS fecha,
            COUNT(*) AS ingresadas,
            COUNT(*) FILTER (WHERE s.prediccion = 'Fuera de ANS') AS fuera_ans
        FROM solicitudes s
        WHERE s.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(s.created_at AT TIME ZONE 'UTC')
        ORDER BY fecha ASC
    """))
    tendencia_semanal = [
        {"fecha": str(r[0]), "ingresadas": int(r[1]), "fuera_ans": int(r[2])}
        for r in tendencia_q
    ]

    return {
        # KPIs históricos
        "total": total,
        "fuera_ans": fuera_ans_n,
        "dentro_ans": dentro_ans_n,
        # KPIs operativos (activas)
        "pendientes": pendientes_n,
        "en_proceso": en_proceso_n,
        "finalizadas": finalizadas_n,
        "sin_asignar": sin_asignar_n,
        "alto_riesgo": alto_riesgo_n,
        "criticos": criticos_n,
        "promedio_riesgo": round(promedio_riesgo, 3),
        "alertas_no_leidas": alertas_no_leidas_n,
        # Distribuciones (activas)
        "estados": estados_list,
        "dist_riesgo": {
            "bajo": dist_bajo,
            "medio": dist_medio,
            "alto": alto_riesgo_n,
            "critico": criticos_n,
        },
        # Listas operativas (activas)
        "solicitudes_riesgo": solicitudes_riesgo,
        "sin_asignar_lista": sin_asignar_lista,
        "carga_ejecutivos": carga_ejecutivos,
        "tendencia_semanal": tendencia_semanal,
    }
