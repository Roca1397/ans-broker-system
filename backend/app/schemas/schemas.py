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
VALID_ROLES = ("admin", "ejecutivo")


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8)
    role: str = Field(default="ejecutivo")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"Rol inválido. Valores permitidos: {', '.join(VALID_ROLES)}")
        return v


class UserAdminCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8)
    role: str = Field(default="ejecutivo")
    is_active: bool = True

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"Rol inválido. Valores permitidos: {', '.join(VALID_ROLES)}")
        return v


class UserAdminUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_ROLES:
            raise ValueError(f"Rol inválido. Valores permitidos: {', '.join(VALID_ROLES)}")
        return v


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
    contacto: Optional[str] = None
    direccion: Optional[str] = None
    activo: Optional[bool] = True

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
    contacto: Optional[str] = None
    direccion: Optional[str] = None
    activo: bool = True


class AseguradoraUpdate(BaseModel):
    nombre: Optional[str] = None
    codigo: Optional[str] = None
    contacto: Optional[str] = None
    direccion: Optional[str] = None
    activo: Optional[bool] = None


# ── CLIENTES Y REMITENTES ─────────────────────────────────────────
class ClienteCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    contacto: Optional[str] = None
    direccion: Optional[str] = None
    activo: bool = True
    prioridad_id: Optional[int] = None


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    contacto: Optional[str] = None
    direccion: Optional[str] = None
    activo: Optional[bool] = None
    prioridad_id: Optional[int] = None


class ClienteOut(BaseModel):
    id: int
    nombre: str
    contacto: Optional[str] = None
    direccion: Optional[str] = None
    activo: bool
    prioridad_id: Optional[int] = None
    prioridad_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class ClienteRemitenteCreate(BaseModel):
    cliente_id: int
    remitente: EmailStr


class ClienteRemitenteUpdate(BaseModel):
    cliente_id: Optional[int] = None
    remitente: Optional[EmailStr] = None


class ClienteRemitenteOut(BaseModel):
    id: int
    cliente_id: int
    cliente_nombre: str
    remitente: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── SOLICITUDES (legado) ──────────────────────────────────────────
class SolicitudOut(BaseModel):
    id: UUID
    nro_ticket: Optional[str] = None
    aseguradora_id: Optional[int] = None
    estado: str
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
    fecha_envio_aseguradora: Optional[datetime] = None
    remitente: Optional[str] = None
    asunto: Optional[str] = None
    probabilidad: Optional[float] = None
    prediccion: Optional[str] = None
    tiene_adjuntos: bool = False
    fuente: Optional[str] = None
    ejecutivo: Optional[str] = None
    nro_atenciones: Optional[int] = None
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
    ejecutivo_id: Optional[UUID] = None


class SolicitudUpdate(BaseModel):
    cliente: Optional[str] = None
    tipo_solicitud_id: Optional[int] = None
    estado_id: Optional[int] = None
    aseguradora_id: Optional[int] = None
    prioridad_id: Optional[int] = None
    ramo_id: Optional[int] = None
    fecha_finalizado: Optional[datetime] = None
    fecha_envio_aseguradora: Optional[datetime] = None
    comentarios: Optional[str] = None
    asunto: Optional[str] = None
    cuerpo_correo: Optional[str] = None
    ejecutivo_id: Optional[UUID] = None
    nro_atenciones: Optional[int] = Field(default=None, ge=1)


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
    fecha_envio_aseguradora: Optional[datetime] = None
    comentarios: Optional[str] = None
    nro_atenciones: Optional[int] = Field(default=1, ge=1)


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
    nro_atenciones: Optional[int] = Field(default=1, ge=1)


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
    asunto: Optional[str] = None
    cuerpo: Optional[str] = None
    prioridad_nombre: Optional[str] = None


class PredictionResponse(BaseModel):
    cumple_ans: bool
    probabilidad_riesgo: float
    nivel_riesgo: str
    mensaje: str
    recomendacion: str
    modelo_version: str
    tiempo_prediccion_ms: float


# ── PREDICCIONES RF (nuevo) ───────────────────────────────────────
class PredictionRFResponse(BaseModel):
    """Respuesta del endpoint /predict-solicitud (Random Forest v2)."""
    prediccion_ans: str            # "Dentro de ANS" | "Fuera de ANS" | "Predicción pendiente"
    probabilidad_incumplimiento: float   # 0.0–1.0
    modelo_usado: str
    variables_usadas: dict
    advertencias: List[str] = []
    tiempo_prediccion_ms: float


class SolicitudConPrediccionOut(BaseModel):
    id: UUID
    nro_ticket: Optional[str] = None
    cliente: Optional[str] = None
    tipo_solicitud: Optional[str] = None
    aseguradora: Optional[str] = None
    ramo: Optional[str] = None
    ejecutivo: Optional[str] = None
    estado: str
    fuente: str
    prediccion: Optional[str] = None
    probabilidad_riesgo: Optional[float] = None
    nivel_riesgo: Optional[str] = None
    cumple_ans: Optional[bool] = None
    fecha_recepcion: Optional[datetime] = None
    prediccion_fecha: Optional[datetime] = None
    alertada: Optional[bool] = None
    modelo_version: Optional[str] = None

    class Config:
        from_attributes = True


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
