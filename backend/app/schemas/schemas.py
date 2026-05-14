"""
Schemas Pydantic.

Se preservan los schemas legados (UserCreate, AseguradoraOut, SolicitudCreate, etc.)
y se AGREGAN los schemas nuevos para soportar:
  - integración con Outlook / Power Automate
  - catálogos extendidos (ramos, tipos_solicitud, estados, prioridades)
  - clientes y relaciones cliente-remitente

REEMPLAZA: backend/app/schemas/schemas.py
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Any, Optional, List, Union
from datetime import datetime
from uuid import UUID


# ── AUTH ──────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8)
    role: str = Field(default="user")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── CATÁLOGOS LEGADOS ─────────────────────────────────────────────
class AseguradoraOut(BaseModel):
    id: int
    nombre: str
    codigo: str
    ans_horas_limite: int

    class Config:
        from_attributes = True


class TipoOperacionOut(BaseModel):
    id: int
    nombre: str
    codigo: str
    peso_complejidad: float

    class Config:
        from_attributes = True


# ── CATÁLOGOS NUEVOS ──────────────────────────────────────────────
class CatalogoBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    activo: bool = True


class CatalogoCreate(CatalogoBase):
    pass


class CatalogoUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None


class CatalogoOut(BaseModel):
    id: int
    nombre: str
    activo: bool

    class Config:
        from_attributes = True


class AseguradoraCreate(BaseModel):
    nombre: str
    codigo: str = Field(..., max_length=50)
    ans_horas_limite: int = 48
    activo: bool = True


class AseguradoraUpdate(BaseModel):
    nombre: Optional[str] = None
    codigo: Optional[str] = None
    ans_horas_limite: Optional[int] = None
    activo: Optional[bool] = None


# ── CLIENTES Y REMITENTES ─────────────────────────────────────────
class ClienteCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    activo: bool = True


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None


class ClienteOut(BaseModel):
    id: int
    nombre: str
    activo: bool

    class Config:
        from_attributes = True


class ClienteRemitenteCreate(BaseModel):
    cliente: str = Field(..., min_length=1)
    remitente: EmailStr
    cliente_id: Optional[int] = None
    aseguradora_id: Optional[int] = None
    ramo_id: Optional[int] = None
    activo: bool = True


class ClienteRemitenteUpdate(BaseModel):
    cliente: Optional[str] = None
    remitente: Optional[EmailStr] = None
    cliente_id: Optional[int] = None
    aseguradora_id: Optional[int] = None
    ramo_id: Optional[int] = None
    activo: Optional[bool] = None


class ClienteRemitenteOut(BaseModel):
    id: int
    cliente: str
    remitente: str
    cliente_id: Optional[int] = None
    aseguradora_id: Optional[int] = None
    ramo_id: Optional[int] = None
    activo: bool
    aseguradora_nombre: Optional[str] = None
    ramo_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# ── SOLICITUDES (legado) ──────────────────────────────────────────
class SolicitudCreate(BaseModel):
    fecha_ingreso: datetime
    tipo_operacion_id: int
    aseguradora_id: int
    cantidad_asegurados: int = Field(..., gt=0)
    tiempo_estimado_atencion: float = Field(..., gt=0)
    fecha_esperada_atencion: datetime
    observaciones: Optional[str] = None

    @field_validator("fecha_esperada_atencion")
    @classmethod
    def fecha_esperada_after_ingreso(cls, v, info):
        if "fecha_ingreso" in info.data and v <= info.data["fecha_ingreso"]:
            raise ValueError("La fecha esperada debe ser posterior a la fecha de ingreso")
        return v


class SolicitudOut(BaseModel):
    id: UUID
    numero_solicitud: Optional[str] = None
    nro_ticket: Optional[str] = None
    fecha_ingreso: Optional[datetime] = None
    tipo_operacion_id: Optional[int] = None
    aseguradora_id: Optional[int] = None
    cantidad_asegurados: Optional[int] = None
    tiempo_estimado_atencion: Optional[float] = None
    fecha_esperada_atencion: Optional[datetime] = None
    estado: str
    observaciones: Optional[str] = None
    fuente: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── SOLICITUDES NUEVAS (módulo SharePoint-like) ───────────────────
class SolicitudListItem(BaseModel):
    id: UUID
    nro_ticket: Optional[str] = None
    cliente: Optional[str] = None
    tipo_solicitud: Optional[str] = None
    estado: Optional[str] = None
    aseguradora: Optional[str] = None
    prioridad: Optional[str] = None
    ramo: Optional[str] = None
    fecha_recepcion: Optional[datetime] = None
    fecha_finalizado: Optional[datetime] = None
    remitente: Optional[str] = None
    asunto: Optional[str] = None
    probabilidad: Optional[float] = None
    prediccion: Optional[str] = None
    tiene_adjuntos: bool = False
    fuente: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SolicitudDetail(SolicitudListItem):
    cuerpo_correo: Optional[str] = None
    comentarios: Optional[str] = None
    datos_adjuntos: Optional[List[dict]] = None
    tipo_solicitud_id: Optional[int] = None
    estado_id: Optional[int] = None
    aseguradora_id: Optional[int] = None
    prioridad_id: Optional[int] = None
    ramo_id: Optional[int] = None


class SolicitudUpdate(BaseModel):
    cliente: Optional[str] = None
    tipo_solicitud_id: Optional[int] = None
    estado_id: Optional[int] = None
    aseguradora_id: Optional[int] = None
    prioridad_id: Optional[int] = None
    ramo_id: Optional[int] = None
    fecha_finalizado: Optional[datetime] = None
    comentarios: Optional[str] = None
    asunto: Optional[str] = None


class SolicitudCreateManual(BaseModel):
    cliente: Optional[str] = None
    remitente: Optional[EmailStr] = None
    tipo_solicitud_id: Optional[int] = None
    estado_id: Optional[int] = None
    aseguradora_id: Optional[int] = None
    prioridad_id: Optional[int] = None
    ramo_id: Optional[int] = None
    asunto: Optional[str] = None
    cuerpo_correo: Optional[str] = None
    fecha_recepcion: Optional[datetime] = None
    comentarios: Optional[str] = None


# ── ENTRADA POWER AUTOMATE / OUTLOOK ──────────────────────────────
class AdjuntoIn(BaseModel):
    filename: str
    # Power Automate puede enviar el contenido como str base64 puro
    # o como {"$content":"<base64>","$content-type":"<mime>"}.
    content_base64: Union[str, dict, Any]
    content_type: Optional[str] = "application/octet-stream"


class OutlookSolicitudIn(BaseModel):
    """
    Body que envía Power Automate a POST /api/solicitudes/outlook.

    eml_base64 acepta:
      - str  : base64 puro del .eml
      - dict : {"$content":"<base64>","$content-type":"message/rfc822"}
               (formato interno de Power Automate para binarios)
    """
    remitente: EmailStr
    asunto: str
    cuerpo_correo: Optional[str] = ""
    fecha_recepcion: Optional[datetime] = None
    prioridad: Optional[str] = None
    adjuntos: Optional[List[AdjuntoIn]] = []
    eml_base64: Optional[Union[str, dict, Any]] = None
    eml_filename: Optional[str] = None


class OutlookSolicitudOut(BaseModel):
    ok: bool
    id: UUID
    nro_ticket: str
    cliente: str
    tipo_solicitud: Optional[str] = None
    aseguradora: Optional[str] = None
    ramo: Optional[str] = None
    prediccion: Optional[str] = None
    probabilidad: Optional[float] = None
    mensaje: str


# ── PREDICCIONES (legado) ─────────────────────────────────────────
class PredictionRequest(BaseModel):
    solicitud_id: Optional[str] = None
    fecha_ingreso: datetime
    tipo_operacion_id: int
    aseguradora_id: int
    cantidad_asegurados: int
    tiempo_estimado_atencion: float
    fecha_esperada_atencion: datetime
    ans_horas_limite: Optional[float] = 48.0
    peso_complejidad: Optional[float] = 1.0


class PredictionResponse(BaseModel):
    cumple_ans: bool
    probabilidad_riesgo: float
    nivel_riesgo: str
    mensaje: str
    recomendacion: str
    modelo_version: str
    tiempo_prediccion_ms: float


class SolicitudConPrediccionOut(BaseModel):
    id: UUID
    numero_solicitud: Optional[str] = None
    fecha_ingreso: Optional[datetime] = None
    fecha_esperada_atencion: Optional[datetime] = None
    cantidad_asegurados: Optional[int] = None
    tiempo_estimado_atencion: Optional[float] = None
    estado: str
    fuente: str
    tipo_operacion: Optional[str]
    aseguradora: Optional[str]
    ans_horas_limite: Optional[int]
    usuario_nombre: Optional[str]
    cumple_ans: Optional[bool]
    probabilidad_riesgo: Optional[float]
    nivel_riesgo: Optional[str]
    prediccion_fecha: Optional[datetime]

    class Config:
        from_attributes = True


# ── BULK UPLOAD ────────────────────────────────────────────────────
class BulkUploadResult(BaseModel):
    total: int
    exitosos: int
    errores: int
    detalles_errores: List[dict]


# ── DASHBOARD ─────────────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_solicitudes: int
    dentro_ans: int
    fuera_ans: int
    criticos: int
    alto_riesgo: int
    promedio_riesgo: float
    pendientes: int
    vencidos: int
    por_aseguradora: List[dict]
    por_tipo_operacion: List[dict]
    tendencia_semanal: List[dict]


# ── ALERTAS ───────────────────────────────────────────────────────
class AlertaOut(BaseModel):
    id: UUID
    solicitud_id: UUID
    tipo: str
    mensaje: str
    leida: bool
    created_at: datetime
    numero_solicitud: Optional[str] = None

    class Config:
        from_attributes = True


# ── PAGINATION ────────────────────────────────────────────────────
class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int


# ── COMENTARIO ────────────────────────────────────────────────────
class ComentarioAdd(BaseModel):
    comentarios: str = Field(..., min_length=1)
