from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import Alerta, Solicitud
from app.models.user import User

router = APIRouter()


@router.get("/")
async def get_alertas(
    skip: int = 0,
    limit: int = 20,
    solo_no_leidas: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Alerta)
        .options(selectinload(Alerta.solicitud))
        .where(Alerta.usuario_id == current_user.id)
        .order_by(desc(Alerta.created_at))
        .offset(skip)
        .limit(limit)
    )
    if solo_no_leidas:
        query = query.where(Alerta.leida == False)

    items = (await db.execute(query)).scalars().all()
    return [
        {
            "id": str(a.id),
            "tipo": a.tipo,
            "mensaje": a.mensaje,
            "leida": a.leida,
            "created_at": a.created_at,
            "numero_solicitud": a.solicitud.numero_solicitud if a.solicitud else None,
            "solicitud_id": str(a.solicitud_id),
        }
        for a in items
    ]


@router.patch("/{alerta_id}/marcar-leida")
async def marcar_leida(
    alerta_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Alerta)
        .where(Alerta.id == alerta_id, Alerta.usuario_id == current_user.id)
        .values(leida=True)
    )
    return {"ok": True}


@router.patch("/marcar-todas-leidas")
async def marcar_todas_leidas(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Alerta)
        .where(Alerta.usuario_id == current_user.id, Alerta.leida == False)
        .values(leida=True)
    )
    return {"ok": True}
