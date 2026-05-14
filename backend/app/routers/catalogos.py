"""
Router de Catálogos.

Endpoints públicos (cualquier usuario autenticado) para listar:
  - aseguradoras
  - tipos-operacion (legacy)
  - tipos-solicitud
  - estados-solicitud
  - prioridades
  - ramos
  - clientes

REEMPLAZA: backend/app/routers/catalogos.py
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.solicitud import (
    Aseguradora, TipoOperacion,
    TipoSolicitud, EstadoSolicitud, Prioridad, Ramo, Cliente,
)
from app.schemas.schemas import AseguradoraOut, TipoOperacionOut, CatalogoOut, ClienteOut

router = APIRouter()


@router.get("/aseguradoras", response_model=List[AseguradoraOut])
async def get_aseguradoras(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Aseguradora).where(Aseguradora.is_active == True).order_by(Aseguradora.nombre)
    )
    return result.scalars().all()


@router.get("/tipos-operacion", response_model=List[TipoOperacionOut])
async def get_tipos_operacion(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(TipoOperacion).where(TipoOperacion.is_active == True).order_by(TipoOperacion.nombre)
    )
    return result.scalars().all()


@router.get("/tipos-solicitud", response_model=List[CatalogoOut])
async def get_tipos_solicitud(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(TipoSolicitud).where(TipoSolicitud.activo == True).order_by(TipoSolicitud.nombre)
    )
    return result.scalars().all()


@router.get("/estados-solicitud", response_model=List[CatalogoOut])
async def get_estados_solicitud(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(EstadoSolicitud).where(EstadoSolicitud.activo == True).order_by(EstadoSolicitud.id)
    )
    return result.scalars().all()


@router.get("/prioridades", response_model=List[CatalogoOut])
async def get_prioridades(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Prioridad).where(Prioridad.activo == True).order_by(Prioridad.id)
    )
    return result.scalars().all()


@router.get("/ramos", response_model=List[CatalogoOut])
async def get_ramos(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Ramo).where(Ramo.activo == True).order_by(Ramo.nombre)
    )
    return result.scalars().all()


@router.get("/clientes", response_model=List[ClienteOut])
async def get_clientes(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Cliente).where(Cliente.activo == True).order_by(Cliente.nombre)
    )
    return result.scalars().all()
