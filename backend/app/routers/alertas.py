from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, or_
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import Alerta, Solicitud
from app.models.user import User

router = APIRouter()

_TIPOS_RIESGO = ("alto_riesgo", "critico")


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
    Devuelve alertas activas (resuelta=False) del usuario actual.
    Incluye alertas sin usuario asignado (usuario_id=NULL) — visibles para todos.
    """
    query = (
        select(Alerta)
        .options(selectinload(Alerta.solicitud))
        .where(
            or_(
                Alerta.usuario_id == current_user.id,
                Alerta.usuario_id == None,
            ),
            Alerta.resuelta == False,
            Alerta.tipo.in_(list(_TIPOS_RIESGO)),
        )
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
    q = (
        select(func.count())
        .select_from(Alerta)
        .where(
            or_(
                Alerta.usuario_id == current_user.id,
                Alerta.usuario_id == None,
            ),
            Alerta.resuelta == False,
            Alerta.leida == False,
            Alerta.tipo.in_(list(_TIPOS_RIESGO)),
        )
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
