"""
Router /api/admin
Sólo accesible por usuarios con rol = 'admin'.

Endpoints:
  - CRUD de catálogos: tipos-solicitud, estados-solicitud, prioridades, ramos
  - CRUD de aseguradoras (con campos extendidos)
  - CRUD de clientes
  - CRUD de asociaciones cliente <-> remitente

ARCHIVO NUEVO: backend/app/routers/admin.py
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.core.security import get_current_admin
from app.models.solicitud import (
    Aseguradora, TipoSolicitud, EstadoSolicitud, Prioridad, Ramo,
    Cliente, ClienteRemitente,
)
from app.schemas.schemas import (
    CatalogoCreate, CatalogoUpdate, CatalogoOut,
    AseguradoraOut, AseguradoraCreate, AseguradoraUpdate,
    ClienteCreate, ClienteUpdate, ClienteOut,
    ClienteRemitenteCreate, ClienteRemitenteUpdate, ClienteRemitenteOut,
)

router = APIRouter()


def _make_catalog_router(prefix: str, model_cls, response_model):
    """Genera dinámicamente un sub-router con CRUD para un catálogo simple."""
    sub = APIRouter(prefix=prefix, tags=[f"Admin · {prefix.strip('/')}"])

    @sub.get("", response_model=List[response_model])
    async def listar(db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
        result = await db.execute(select(model_cls).order_by(model_cls.id))
        return result.scalars().all()

    @sub.post("", response_model=response_model, status_code=status.HTTP_201_CREATED)
    async def crear(data: CatalogoCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
        obj = model_cls(nombre=data.nombre, activo=data.activo)
        db.add(obj)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(409, f"Ya existe un registro con nombre '{data.nombre}'")
        await db.refresh(obj)
        return obj

    @sub.patch("/{item_id}", response_model=response_model)
    async def actualizar(item_id: int, data: CatalogoUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
        obj = (await db.execute(select(model_cls).where(model_cls.id == item_id))).scalar_one_or_none()
        if not obj:
            raise HTTPException(404, "Registro no encontrado")
        payload = data.model_dump(exclude_unset=True)
        for k, v in payload.items():
            setattr(obj, k, v)
        await db.commit()
        await db.refresh(obj)
        return obj

    @sub.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def eliminar(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
        obj = (await db.execute(select(model_cls).where(model_cls.id == item_id))).scalar_one_or_none()
        if not obj:
            raise HTTPException(404, "Registro no encontrado")
        await db.delete(obj)
        await db.commit()
        return None

    return sub


router.include_router(_make_catalog_router("/tipos-solicitud", TipoSolicitud, CatalogoOut))
router.include_router(_make_catalog_router("/estados-solicitud", EstadoSolicitud, CatalogoOut))
router.include_router(_make_catalog_router("/prioridades", Prioridad, CatalogoOut))
router.include_router(_make_catalog_router("/ramos", Ramo, CatalogoOut))


# ════════════════════════════════════════════════════════════════════
# ASEGURADORAS
# ════════════════════════════════════════════════════════════════════

@router.get("/aseguradoras", response_model=List[AseguradoraOut], tags=["Admin · aseguradoras"])
async def admin_listar_aseguradoras(db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(select(Aseguradora).order_by(Aseguradora.nombre))
    return result.scalars().all()


@router.post("/aseguradoras", response_model=AseguradoraOut, tags=["Admin · aseguradoras"])
async def admin_crear_aseguradora(data: AseguradoraCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    obj = Aseguradora(
        nombre=data.nombre, codigo=data.codigo,
        ans_horas_limite=data.ans_horas_limite,
        contacto=data.contacto, direccion=data.direccion,
        is_active=data.activo, activo=data.activo,
    )
    db.add(obj)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, f"Ya existe una aseguradora con código '{data.codigo}'")
    await db.refresh(obj)
    return obj


@router.patch("/aseguradoras/{item_id}", response_model=AseguradoraOut, tags=["Admin · aseguradoras"])
async def admin_actualizar_aseguradora(item_id: int, data: AseguradoraUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    obj = (await db.execute(select(Aseguradora).where(Aseguradora.id == item_id))).scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Aseguradora no encontrada")
    payload = data.model_dump(exclude_unset=True)
    if "activo" in payload:
        obj.is_active = payload["activo"]
    for k, v in payload.items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/aseguradoras/{item_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Admin · aseguradoras"])
async def admin_eliminar_aseguradora(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    obj = (await db.execute(select(Aseguradora).where(Aseguradora.id == item_id))).scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Aseguradora no encontrada")
    await db.delete(obj)
    await db.commit()
    return None


# ════════════════════════════════════════════════════════════════════
# CLIENTES
# ════════════════════════════════════════════════════════════════════

@router.get("/clientes", response_model=List[ClienteOut], tags=["Admin · clientes"])
async def admin_listar_clientes(db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(select(Cliente).order_by(Cliente.nombre))
    return result.scalars().all()


@router.post("/clientes", response_model=ClienteOut, tags=["Admin · clientes"])
async def admin_crear_cliente(data: ClienteCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    obj = Cliente(nombre=data.nombre, contacto=data.contacto, direccion=data.direccion, activo=data.activo)
    db.add(obj)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, f"Ya existe un cliente con nombre '{data.nombre}'")
    await db.refresh(obj)
    return obj


@router.patch("/clientes/{item_id}", response_model=ClienteOut, tags=["Admin · clientes"])
async def admin_actualizar_cliente(item_id: int, data: ClienteUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    obj = (await db.execute(select(Cliente).where(Cliente.id == item_id))).scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Cliente no encontrado")
    payload = data.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/clientes/{item_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Admin · clientes"])
async def admin_eliminar_cliente(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    obj = (await db.execute(select(Cliente).where(Cliente.id == item_id))).scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Cliente no encontrado")
    await db.delete(obj)
    await db.commit()
    return None


# ════════════════════════════════════════════════════════════════════
# RELACIÓN CLIENTE-REMITENTE
# ════════════════════════════════════════════════════════════════════

def _to_cr_out(obj: ClienteRemitente) -> dict:
    return {
        "id": obj.id,
        "cliente": obj.cliente,
        "remitente": obj.remitente,
        "cliente_id": obj.cliente_id,
        "aseguradora_id": obj.aseguradora_id,
        "ramo_id": obj.ramo_id,
        "activo": obj.activo,
        "aseguradora_nombre": obj.aseguradora.nombre if obj.aseguradora else None,
        "ramo_nombre": obj.ramo.nombre if obj.ramo else None,
    }


@router.get("/clientes-remitentes", response_model=List[ClienteRemitenteOut], tags=["Admin · clientes-remitentes"])
async def admin_listar_asociaciones(db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(
        select(ClienteRemitente).options(
            selectinload(ClienteRemitente.aseguradora),
            selectinload(ClienteRemitente.ramo),
        ).order_by(ClienteRemitente.cliente)
    )
    return [_to_cr_out(o) for o in result.scalars().all()]


@router.post("/clientes-remitentes", response_model=ClienteRemitenteOut, tags=["Admin · clientes-remitentes"])
async def admin_crear_asociacion(
    data: ClienteRemitenteCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    obj = ClienteRemitente(
        cliente=data.cliente,
        remitente=str(data.remitente).lower(),
        cliente_id=data.cliente_id,
        aseguradora_id=data.aseguradora_id,
        ramo_id=data.ramo_id,
        activo=data.activo,
    )
    db.add(obj)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, f"Ya existe la asociación '{data.remitente}' -> '{data.cliente}'")

    result = await db.execute(
        select(ClienteRemitente).options(
            selectinload(ClienteRemitente.aseguradora),
            selectinload(ClienteRemitente.ramo),
        ).where(ClienteRemitente.id == obj.id)
    )
    return _to_cr_out(result.scalar_one())


@router.patch("/clientes-remitentes/{item_id}", response_model=ClienteRemitenteOut, tags=["Admin · clientes-remitentes"])
async def admin_actualizar_asociacion(
    item_id: int,
    data: ClienteRemitenteUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    obj = (await db.execute(select(ClienteRemitente).where(ClienteRemitente.id == item_id))).scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Asociación no encontrada")
    payload = data.model_dump(exclude_unset=True)
    if "remitente" in payload and payload["remitente"]:
        payload["remitente"] = str(payload["remitente"]).lower()
    for k, v in payload.items():
        setattr(obj, k, v)
    await db.commit()

    result = await db.execute(
        select(ClienteRemitente).options(
            selectinload(ClienteRemitente.aseguradora),
            selectinload(ClienteRemitente.ramo),
        ).where(ClienteRemitente.id == item_id)
    )
    return _to_cr_out(result.scalar_one())


@router.delete("/clientes-remitentes/{item_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Admin · clientes-remitentes"])
async def admin_eliminar_asociacion(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    obj = (await db.execute(select(ClienteRemitente).where(ClienteRemitente.id == item_id))).scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Asociación no encontrada")
    await db.delete(obj)
    await db.commit()
    return None
