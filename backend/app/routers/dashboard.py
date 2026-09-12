from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, and_, or_, not_, desc, update
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import (
    Solicitud, PrediccionANS, Aseguradora, TipoSolicitud, Alerta, EstadoSolicitud, Ramo,
)
from app.models.user import User

router = APIRouter()

# ── Estados que indican solicitud "cerrada" / no operativa ────────────────────
_KEYWORDS_FINALIZADAS = ("finaliz", "cerrad", "atendid", "complet")


def _filtro_no_finalizada():
    return not_(
        or_(*[Solicitud.estado.ilike(f"%{kw}%") for kw in _KEYWORDS_FINALIZADAS])
    )


def _scope_filters(user: User) -> list:
    """
    Devuelve filtros SQLAlchemy según el rol del usuario autenticado.

    - admin     → lista vacía (sin filtro, ve todo el sistema)
    - ejecutivo → filtra por ejecutivo_id == user.id
                  (solo sus solicitudes asignadas; las sin asignar quedan excluidas)

    El filtrado se hace por UUID (user.id), nunca por nombre,
    para evitar colisiones y problemas ante cambios de nombre.
    """
    if user.role == "admin":
        return []
    return [Solicitud.ejecutivo_id == user.id]


def _scope_text(user: User) -> tuple[str, dict]:
    """
    Devuelve (cláusula SQL extra, params) para queries raw text().
    Uso: WHERE s.created_at >= ... {clause}, params
    """
    if user.role == "admin":
        return "", {}
    return "AND s.ejecutivo_id = :eid", {"eid": str(user.id)}


# ── Endpoint legado /stats ─────────────────────────────────────────────────────

@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = _scope_filters(current_user)

    total = (await db.execute(
        select(func.count(Solicitud.id)).where(*scope)
    )).scalar() or 0

    # PrediccionANS debe joinarse con Solicitud para aplicar el scope
    dentro_ans = (await db.execute(
        select(func.count(PrediccionANS.id))
        .join(Solicitud, PrediccionANS.solicitud_id == Solicitud.id)
        .where(PrediccionANS.cumple_ans == True, *scope)
    )).scalar() or 0

    fuera_ans = (await db.execute(
        select(func.count(PrediccionANS.id))
        .join(Solicitud, PrediccionANS.solicitud_id == Solicitud.id)
        .where(PrediccionANS.cumple_ans == False, *scope)
    )).scalar() or 0

    criticos = (await db.execute(
        select(func.count(PrediccionANS.id))
        .join(Solicitud, PrediccionANS.solicitud_id == Solicitud.id)
        .where(PrediccionANS.nivel_riesgo == "critico", *scope)
    )).scalar() or 0

    alto_riesgo = (await db.execute(
        select(func.count(PrediccionANS.id))
        .join(Solicitud, PrediccionANS.solicitud_id == Solicitud.id)
        .where(PrediccionANS.nivel_riesgo == "alto", *scope)
    )).scalar() or 0

    promedio_riesgo = (await db.execute(
        select(func.avg(PrediccionANS.probabilidad_riesgo))
        .join(Solicitud, PrediccionANS.solicitud_id == Solicitud.id)
        .where(*scope)
    )).scalar() or 0.0

    pendientes = (await db.execute(
        select(func.count(Solicitud.id))
        .where(Solicitud.estado == "pendiente", *scope)
    )).scalar() or 0

    if current_user.role == "admin":
        alertas_no_leidas = (await db.execute(
            select(func.count(Alerta.id))
            .where(Alerta.leida == False)
        )).scalar() or 0
    else:
        alertas_no_leidas = (await db.execute(
            select(func.count(Alerta.id))
            .where(
                or_(Alerta.usuario_id == current_user.id, Alerta.usuario_id == None),
                Alerta.leida == False,
            )
        )).scalar() or 0

    # Por aseguradora — outer join; con scope activo se filtra a las del ejecutivo
    por_aseg_q = await db.execute(
        select(Aseguradora.nombre, func.count(Solicitud.id).label("total"))
        .join(Solicitud, Solicitud.aseguradora_id == Aseguradora.id, isouter=True)
        .where(*scope)
        .group_by(Aseguradora.nombre)
        .order_by(func.count(Solicitud.id).desc())
        .limit(8)
    )
    por_aseguradora = [{"nombre": r[0], "total": r[1]} for r in por_aseg_q]

    por_tipo_q = await db.execute(
        select(TipoSolicitud.nombre, func.count(Solicitud.id).label("total"))
        .join(Solicitud, Solicitud.tipo_solicitud_id == TipoSolicitud.id, isouter=True)
        .where(*scope)
        .group_by(TipoSolicitud.nombre)
        .order_by(func.count(Solicitud.id).desc())
        .limit(8)
    )
    por_tipo = [{"nombre": r[0], "total": r[1]} for r in por_tipo_q]

    t_clause, t_params = _scope_text(current_user)
    tendencia_q = await db.execute(
        text(f"""
            SELECT
                DATE(s.created_at AT TIME ZONE 'UTC') as fecha,
                COUNT(*) as total,
                COUNT(p.id) FILTER (WHERE p.cumple_ans = true) as dentro,
                COUNT(p.id) FILTER (WHERE p.cumple_ans = false) as fuera
            FROM solicitudes s
            LEFT JOIN predicciones_ans p ON s.id = p.solicitud_id
            WHERE s.created_at >= NOW() - INTERVAL '7 days'
            {t_clause}
            GROUP BY DATE(s.created_at AT TIME ZONE 'UTC')
            ORDER BY fecha ASC
        """),
        t_params,
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
    Respeta el rol del usuario autenticado:
      - admin     → métricas globales de todo el sistema
      - ejecutivo → métricas únicamente de sus solicitudes asignadas

    El filtrado se realiza por user.id (UUID), nunca por nombre.
    Las solicitudes sin asignar (ejecutivo_id IS NULL) son exclusivas del admin.

    Métricas HISTÓRICAS (incluyen finalizadas):
      - total, fuera_ans, dentro_ans, tendencia_semanal
      - desglose de estados (pendientes, en_proceso, finalizadas)

    Métricas OPERATIVAS (solo solicitudes activas — excluyen finalizadas):
      - solicitudes_riesgo, alto_riesgo, criticos, dist_riesgo,
        promedio_riesgo, sin_asignar, carga_ejecutivos.en_riesgo
    """
    from app.models.user import User as UserORM

    scope = _scope_filters(current_user)
    activa = _filtro_no_finalizada()

    # ── KPIs históricos ──────────────────────────────────────────────────────
    total = (await db.execute(
        select(func.count(Solicitud.id)).where(*scope)
    )).scalar() or 0

    fuera_ans_n = (await db.execute(
        select(func.count(Solicitud.id))
        .where(Solicitud.prediccion == "Fuera de ANS", *scope)
    )).scalar() or 0

    dentro_ans_n = (await db.execute(
        select(func.count(Solicitud.id))
        .where(Solicitud.prediccion == "Dentro de ANS", *scope)
    )).scalar() or 0

    # ── KPIs operativos (activas) ────────────────────────────────────────────
    # sin_asignar: para un ejecutivo siempre es 0 porque su scope ya filtra
    # por ejecutivo_id != NULL (su propio ID), lo que excluye ejecutivo_id IS NULL.
    sin_asignar_n = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.ejecutivo_id.is_(None),
            *scope,
        )
    )).scalar() or 0

    alto_riesgo_n = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
            Solicitud.probabilidad >= 0.70,
            Solicitud.probabilidad < 0.90,
            *scope,
        )
    )).scalar() or 0

    criticos_n = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
            Solicitud.probabilidad >= 0.90,
            *scope,
        )
    )).scalar() or 0

    promedio_riesgo = float((await db.execute(
        select(func.avg(Solicitud.probabilidad)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
            *scope,
        )
    )).scalar() or 0.0)

    # ── Alertas no leídas ────────────────────────────────────────────────────
    # Admin ve todas; ejecutivo ve las propias + broadcast (usuario_id=NULL).
    if current_user.role == "admin":
        alertas_no_leidas_n = (await db.execute(
            select(func.count(Alerta.id)).where(
                Alerta.leida == False,
                Alerta.resuelta == False,
            )
        )).scalar() or 0
    else:
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

    # ── Breakdown de estados (histórico) ─────────────────────────────────────
    # Convertido de text() a ORM para soportar el scope por rol.
    estado_q = await db.execute(
        select(
            func.coalesce(EstadoSolicitud.nombre, Solicitud.estado).label("est"),
            func.count(Solicitud.id).label("n"),
        )
        .outerjoin(EstadoSolicitud, Solicitud.estado_id == EstadoSolicitud.id)
        .where(*scope)
        .group_by(func.coalesce(EstadoSolicitud.nombre, Solicitud.estado))
    )
    estados_raw = [(r[0] or "", r[1]) for r in estado_q]
    estados_list = [{"nombre": nombre, "count": int(count)}
                    for nombre, count in estados_raw if nombre]

    def _match(*keywords: str) -> int:
        return sum(count for nombre, count in estados_raw
                   if any(kw in (nombre or "").lower() for kw in keywords))

    pendientes_n  = _match("pendiente")
    en_proceso_n  = _match("proceso", "progreso", "curso")
    finalizadas_n = _match("finaliz", "complet", "cerrad", "atendid")

    # ── Distribución de riesgo (activas) ────────────────────────────────────
    dist_bajo = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
            Solicitud.probabilidad < 0.40,
            *scope,
        )
    )).scalar() or 0

    dist_medio = (await db.execute(
        select(func.count(Solicitud.id)).where(
            activa,
            Solicitud.probabilidad.isnot(None),
            Solicitud.probabilidad >= 0.40,
            Solicitud.probabilidad < 0.70,
            *scope,
        )
    )).scalar() or 0

    # ── Top 10 solicitudes en riesgo (activas) ───────────────────────────────
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
            *scope,
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

    # ── Top 5 sin asignar (activas) — solo admin recibe datos aquí ──────────
    # Para ejecutivos, scope = [ejecutivo_id == user.id] es incompatible con
    # ejecutivo_id IS NULL, por lo que la query devuelve 0 filas naturalmente.
    sin_asig_rows = (await db.execute(
        select(Solicitud).options(
            selectinload(Solicitud.tipo_solicitud),
            selectinload(Solicitud.prioridad_rel),
        )
        .where(activa, Solicitud.ejecutivo_id.is_(None), *scope)
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

    # ── Carga por ejecutivo ──────────────────────────────────────────────────
    # Admin: ve todos los ejecutivos activos con solicitudes.
    # Ejecutivo: ve solo su propia fila.
    carga_where = [UserORM.role == "ejecutivo", UserORM.is_active == True]
    if current_user.role != "admin":
        carga_where.append(UserORM.id == current_user.id)

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
        .where(*carga_where)
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

    # ── Tendencia semanal (histórica) ────────────────────────────────────────
    t_clause, t_params = _scope_text(current_user)
    tendencia_q = await db.execute(
        text(f"""
            SELECT
                DATE(s.created_at AT TIME ZONE 'UTC') AS fecha,
                COUNT(*) AS ingresadas,
                COUNT(*) FILTER (WHERE s.prediccion = 'Fuera de ANS') AS fuera_ans
            FROM solicitudes s
            WHERE s.created_at >= NOW() - INTERVAL '7 days'
            {t_clause}
            GROUP BY DATE(s.created_at AT TIME ZONE 'UTC')
            ORDER BY fecha ASC
        """),
        t_params,
    )
    tendencia_semanal = [
        {"fecha": str(r[0]), "ingresadas": int(r[1]), "fuera_ans": int(r[2])}
        for r in tendencia_q
    ]

    return {
        # KPIs historicos
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


# ── Endpoint: Cumplimiento ANS por cliente y ramo ────────────────────────────

@router.get("/ans-cumplimiento")
async def get_ans_cumplimiento(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Desglose de cumplimiento ANS agrupado por cliente y ramo.
    Respeta el rol: admin ve todo; ejecutivo solo sus solicitudes asignadas.
    """
    scope = _scope_filters(current_user)

    rows = (await db.execute(
        select(
            Solicitud.cliente,
            Ramo.nombre.label("ramo"),
            func.count(Solicitud.id).filter(
                Solicitud.prediccion == "Dentro de ANS"
            ).label("dentro"),
            func.count(Solicitud.id).filter(
                Solicitud.prediccion == "Fuera de ANS"
            ).label("fuera"),
        )
        .outerjoin(Ramo, Solicitud.ramo_id == Ramo.id)
        .where(
            Solicitud.prediccion.in_(["Dentro de ANS", "Fuera de ANS"]),
            *scope,
        )
        .group_by(Solicitud.cliente, Ramo.nombre)
        .order_by(Solicitud.cliente, Ramo.nombre)
    )).all()

    return {
        "breakdown": [
            {
                "cliente": r[0] or "Sin cliente",
                "ramo": r[1] or "Sin ramo",
                "dentro": int(r[2] or 0),
                "fuera": int(r[3] or 0),
            }
            for r in rows
        ]
    }
