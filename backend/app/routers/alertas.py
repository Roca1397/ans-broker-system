from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, or_, not_
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import Alerta, Solicitud
from app.models.user import User

router = APIRouter()

_TIPOS_RIESGO      = ("alto_riesgo", "critico")
_ESTADOS_TERMINALES = ("finaliz", "cerrad", "atendid", "complet")


def _filtro_solicitud_activa():
    """Excluye alertas cuya solicitud ya está en estado terminal."""
    return not_(
        or_(*[Solicitud.estado.ilike(f"%{kw}%") for kw in _ESTADOS_TERMINALES])
    )


def _alerta_to_dict(a: Alerta) -> dict:
    return {
        "id": str(a.id),
        "tipo": a.tipo,
        "mensaje": a.mensaje,
        "leida": a.leida,
        "resuelta": a.resuelta,
        "probabilidad": a.probabilidad,
        "created_at": a.created_at,
        "nro_ticket": a.solicitud.nro_ticket if a.solicitud else None,
        "solicitud_id": str(a.solicitud_id),
        "estado_solicitud": a.solicitud.estado if a.solicitud else None,
    }


@router.get("/")
async def get_alertas(
    skip: int = 0,
    limit: int = 30,
    solo_no_leidas: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve alertas activas (resuelta=False).
    - Admins: ven TODAS las alertas activas (sin filtro por usuario).
    - Ejecutivos: ven las propias + las broadcast (usuario_id=NULL).
    """
    base_filter = [
        Alerta.resuelta == False,
        Alerta.tipo.in_(list(_TIPOS_RIESGO)),
    ]

    if current_user.role != "admin":
        base_filter.append(
            or_(
                Alerta.usuario_id == current_user.id,
                Alerta.usuario_id == None,
            )
        )

    query = (
        select(Alerta)
        .join(Solicitud, Alerta.solicitud_id == Solicitud.id)
        .options(selectinload(Alerta.solicitud))
        .where(*base_filter)
        .where(_filtro_solicitud_activa())
        .order_by(desc(Alerta.created_at))
        .offset(skip)
        .limit(limit)
    )
    if solo_no_leidas:
        query = query.where(Alerta.leida == False)

    items = (await db.execute(query)).scalars().all()
    return [_alerta_to_dict(a) for a in items]


@router.get("/count")
async def count_alertas_no_leidas(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve el conteo de alertas activas no leídas para el badge de la campanita."""
    from sqlalchemy import func

    count_filter = [
        Alerta.resuelta == False,
        Alerta.leida == False,
        Alerta.tipo.in_(list(_TIPOS_RIESGO)),
    ]
    if current_user.role != "admin":
        count_filter.append(
            or_(
                Alerta.usuario_id == current_user.id,
                Alerta.usuario_id == None,
            )
        )

    q = (
        select(func.count())
        .select_from(Alerta)
        .join(Solicitud, Alerta.solicitud_id == Solicitud.id)
        .where(*count_filter)
        .where(_filtro_solicitud_activa())
    )
    count = (await db.execute(q)).scalar() or 0
    return {"count": count}


@router.patch("/{alerta_id}/marcar-leida")
async def marcar_leida(
    alerta_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Alerta)
        .where(
            Alerta.id == alerta_id,
            or_(
                Alerta.usuario_id == current_user.id,
                Alerta.usuario_id == None,
            ),
        )
        .values(leida=True)
    )
    await db.commit()
    return {"ok": True}


@router.patch("/marcar-todas-leidas")
async def marcar_todas_leidas(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Alerta)
        .where(
            or_(
                Alerta.usuario_id == current_user.id,
                Alerta.usuario_id == None,
            ),
            Alerta.resuelta == False,
            Alerta.leida == False,
        )
        .values(leida=True)
    )
    await db.commit()
    return {"ok": True}


# ── Backfill: genera alertas para solicitudes ya predichas "Fuera de ANS" ────

_KEYWORDS_FINALIZADAS = ("finaliz", "cerrad", "atendid", "complet")
_UMBRAL_BACKFILL = 0.45


@router.post("/backfill", status_code=200)
async def backfill_alertas(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Genera alertas para todas las solicitudes que ya tienen prediccion='Fuera de ANS'
    y no tienen alerta activa. Idempotente: no duplica si ya existe una alerta activa.

    Solo accesible para administradores.
    """
    if current_user.role != "admin":
        raise HTTPException(403, "Solo administradores pueden ejecutar el backfill de alertas")

    candidatas = (await db.execute(
        select(Solicitud).where(
            Solicitud.prediccion == "Fuera de ANS",
            Solicitud.probabilidad.isnot(None),
            Solicitud.probabilidad >= _UMBRAL_BACKFILL,
            not_(
                or_(*[Solicitud.estado.ilike(f"%{kw}%") for kw in _KEYWORDS_FINALIZADAS])
            ),
        )
    )).scalars().all()

    creadas = 0
    omitidas = 0

    for sol in candidatas:
        existing = (await db.execute(
            select(Alerta).where(
                Alerta.solicitud_id == sol.id,
                Alerta.resuelta == False,
                Alerta.tipo.in_(list(_TIPOS_RIESGO)),
            )
        )).scalar_one_or_none()

        if existing:
            omitidas += 1
            continue

        prob = sol.probabilidad
        pct = round(prob * 100)
        ticket = sol.nro_ticket or str(sol.id)[:8].upper()
        cliente = sol.cliente or "Sin cliente"
        tipo = "critico" if prob >= 0.80 else "alto_riesgo"
        mensaje = f"{ticket} — {cliente} — Riesgo de incumplimiento: {pct}%"

        db.add(Alerta(
            solicitud_id=sol.id,
            tipo=tipo,
            mensaje=mensaje,
            probabilidad=prob,
            usuario_id=None,   # broadcast: visible a todos los usuarios
            resuelta=False,
            leida=False,
        ))
        creadas += 1

    await db.commit()
    return {
        "ok": True,
        "candidatas": len(candidatas),
        "alertas_creadas": creadas,
        "ya_tenian_alerta": omitidas,
    }
