"""
Modelos SQLAlchemy del módulo de Solicitudes (Outlook + Power Automate ready).

Se preserva la estructura original (Aseguradora, TipoOperacion, PrediccionANS, Alerta)
y se EXTIENDE con:
  - nuevos catálogos: ramos, tipos_solicitud, estados_solicitud, prioridades
  - nuevas entidades: clientes, clientes_remitentes
  - nuevos campos en Solicitud para integración con correos Outlook (.eml).

REEMPLAZA: backend/app/models/solicitud.py
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Float,
    ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# ════════════════════════════════════════════════════════════════════
# CATÁLOGOS (existentes + nuevos)
# ════════════════════════════════════════════════════════════════════

class Aseguradora(Base):
    __tablename__ = "aseguradoras"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(255), nullable=False)
    codigo = Column(String(50), unique=True, nullable=False)
    ans_horas_limite = Column(Integer, nullable=False, default=48)
    contacto = Column(String(255), nullable=True)
    direccion = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    activo = Column(Boolean, default=True)  # alias para nueva nomenclatura
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    solicitudes = relationship("Solicitud", back_populates="aseguradora")


class TipoOperacion(Base):
    """Catálogo legado mantenido para compatibilidad (carga masiva Excel)."""
    __tablename__ = "tipos_operacion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(255), nullable=False)
    codigo = Column(String(50), unique=True, nullable=False)
    peso_complejidad = Column(Float, default=1.0)
    is_active = Column(Boolean, default=True)


class TipoSolicitud(Base):
    """Nuevo catálogo: Inclusión, Exclusión, Renovación, Emisión..."""
    __tablename__ = "tipos_solicitud"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    solicitudes = relationship("Solicitud", back_populates="tipo_solicitud")


class EstadoSolicitud(Base):
    """Catálogo de estados: Pendiente, En Proceso, Finalizado..."""
    __tablename__ = "estados_solicitud"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Prioridad(Base):
    """Catálogo de prioridades: Baja, Media, Alta..."""
    __tablename__ = "prioridades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), nullable=False, unique=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Ramo(Base):
    """Catálogo de ramos: EPS, FOLA, SCTR-S, SCTR-P..."""
    __tablename__ = "ramos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    solicitudes = relationship("Solicitud", back_populates="ramo")
    asociaciones = relationship("ClienteRemitente", back_populates="ramo")


# ════════════════════════════════════════════════════════════════════
# CLIENTES y RELACIÓN CLIENTE-REMITENTE
# ════════════════════════════════════════════════════════════════════

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(255), nullable=False, unique=True)
    contacto = Column(String(255), nullable=True)
    direccion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)
    prioridad_id = Column(Integer, ForeignKey("prioridades.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    prioridad_rel = relationship("Prioridad")
    asociaciones = relationship("ClienteRemitente", back_populates="cliente_rel")


class ClienteRemitente(Base):
    """
    Asociación remitente (correo) -> cliente, aseguradora y ramo.
    Cuando llega un correo desde Power Automate se busca el remitente aquí
    para autocompletar los datos de la solicitud.
    """
    __tablename__ = "clientes_remitentes"
    __table_args__ = (
        UniqueConstraint("remitente", "cliente", name="uq_remitente_cliente"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    cliente = Column(String(255), nullable=False)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    remitente = Column(String(255), nullable=False, index=True)
    aseguradora_id = Column(Integer, ForeignKey("aseguradoras.id"), nullable=True)
    ramo_id = Column(Integer, ForeignKey("ramos.id"), nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    cliente_rel = relationship("Cliente", back_populates="asociaciones")
    aseguradora = relationship("Aseguradora")
    ramo = relationship("Ramo", back_populates="asociaciones")


# ════════════════════════════════════════════════════════════════════
# SOLICITUD (extendida con campos de Outlook)
# ════════════════════════════════════════════════════════════════════

class Solicitud(Base):
    __tablename__ = "solicitudes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Identificadores ────────────────────────────────────────────
    nro_ticket = Column(String(20), unique=True, nullable=True, index=True)  # NT2026001

    # ── Datos del cliente / remitente ──────────────────────────────
    cliente = Column(String(255), nullable=True, default="Pendiente de asignar")
    remitente = Column(String(255), nullable=True, index=True)

    # ── Tipificación ───────────────────────────────────────────────
    tipo_solicitud_id = Column(Integer, ForeignKey("tipos_solicitud.id"), nullable=True)
    estado_id = Column(Integer, ForeignKey("estados_solicitud.id"), nullable=True)
    prioridad_id = Column(Integer, ForeignKey("prioridades.id"), nullable=True)
    aseguradora_id = Column(Integer, ForeignKey("aseguradoras.id"), nullable=True)
    ramo_id = Column(Integer, ForeignKey("ramos.id"), nullable=True)

    # estado legacy (string) para compatibilidad con código antiguo
    estado = Column(String(50), default="Pendiente")

    # ── Datos del correo ───────────────────────────────────────────
    asunto = Column(String(500), nullable=True)
    cuerpo_correo = Column(Text, nullable=True)
    fecha_recepcion = Column(DateTime(timezone=True), nullable=True)
    fecha_finalizado = Column(DateTime(timezone=True), nullable=True)

    # ── Adjuntos ───────────────────────────────────────────────────
    datos_adjuntos = Column(JSONB, nullable=True)

    # ── ML ─────────────────────────────────────────────────────────
    probabilidad = Column(Float, nullable=True)
    prediccion = Column(String(50), nullable=True)

    # ── Comentarios ────────────────────────────────────────────────
    comentarios = Column(Text, nullable=True)

    # ── Trazabilidad ───────────────────────────────────────────────
    fuente = Column(String(50), default="manual")
    ejecutivo_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # ── Relaciones ─────────────────────────────────────────────────
    ejecutivo_rel = relationship("User", foreign_keys=[ejecutivo_id])
    aseguradora = relationship("Aseguradora", back_populates="solicitudes")
    tipo_solicitud = relationship("TipoSolicitud", back_populates="solicitudes")
    ramo = relationship("Ramo", back_populates="solicitudes")
    estado_rel = relationship("EstadoSolicitud", foreign_keys=[estado_id])
    prioridad_rel = relationship("Prioridad", foreign_keys=[prioridad_id])
    prediccion_rel = relationship("PrediccionANS", back_populates="solicitud", uselist=False)
    alertas = relationship("Alerta", back_populates="solicitud")


# ════════════════════════════════════════════════════════════════════
# PREDICCIONES Y ALERTAS (sin cambios estructurales)
# ════════════════════════════════════════════════════════════════════

class PrediccionANS(Base):
    __tablename__ = "predicciones_ans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    solicitud_id = Column(UUID(as_uuid=True), ForeignKey("solicitudes.id", ondelete="CASCADE"), unique=True)
    cumple_ans = Column(Boolean, nullable=False)
    probabilidad_riesgo = Column(Float, nullable=False)
    nivel_riesgo = Column(String(20), nullable=False)
    features_input = Column(JSONB)
    modelo_version = Column(String(50))
    tiempo_prediccion_ms = Column(Float)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    solicitud = relationship("Solicitud", back_populates="prediccion_rel")


class Alerta(Base):
    __tablename__ = "alertas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    solicitud_id = Column(UUID(as_uuid=True), ForeignKey("solicitudes.id", ondelete="CASCADE"))
    tipo = Column(String(50), nullable=False)
    mensaje = Column(Text, nullable=False)
    leida = Column(Boolean, default=False)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    solicitud = relationship("Solicitud", back_populates="alertas")
    usuario = relationship("User", back_populates="alertas")
