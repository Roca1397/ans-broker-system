"""
Servicio de procesamiento de correos provenientes de Outlook (Power Automate).

Responsabilidades:
  1. Generar el nro_ticket en formato NT{AÑO}{correlativo} (NT2026001).
  2. Detectar tipo_solicitud a partir del asunto del correo.
  3. Resolver cliente / aseguradora / ramo a partir del remitente.
  4. Persistir el archivo .eml y los adjuntos en disco.

ARCHIVO NUEVO: backend/app/services/outlook_service.py
"""
import base64
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.models.solicitud import (
    Solicitud, ClienteRemitente, TipoSolicitud,
    EstadoSolicitud, Prioridad,
)


# ════════════════════════════════════════════════════════════════════
# 1. Generación de nro_ticket
# ════════════════════════════════════════════════════════════════════

async def generar_nro_ticket(db: AsyncSession) -> str:
    """
    Genera el siguiente número de ticket: NT{AÑO}{correlativo de 3 dígitos}.
    Ejemplo: NT2026001, NT2026002, ...
    El correlativo se reinicia cada año.
    """
    anio = datetime.now(timezone.utc).year
    prefijo = f"NT{anio}"

    stmt = select(func.max(Solicitud.nro_ticket)).where(
        Solicitud.nro_ticket.like(f"{prefijo}%")
    )
    result = await db.execute(stmt)
    max_ticket: Optional[str] = result.scalar()

    if max_ticket:
        try:
            ultimo = int(max_ticket.replace(prefijo, ""))
        except ValueError:
            ultimo = 0
    else:
        ultimo = 0

    nuevo = ultimo + 1
    return f"{prefijo}{nuevo:03d}"


# ════════════════════════════════════════════════════════════════════
# 2. Detección de tipo de solicitud por asunto
# ════════════════════════════════════════════════════════════════════

PATRONES_TIPO = [
    ("Inclusión", [r"\binclusi[oó]n\b", r"\binclusion\b", r"\bagregar\b", r"\balta\b"]),
    ("Exclusión", [r"\bexclusi[oó]n\b", r"\bexclusion\b", r"\bbaja\b", r"\bretirar\b"]),
    ("Renovación", [r"\brenovaci[oó]n\b", r"\brenovacion\b", r"\brenovar\b"]),
    ("Emisión",   [r"\bemisi[oó]n\b", r"\bemision\b", r"\bemitir\b", r"\bnueva\s+p[oó]liza\b"]),
]


def detectar_tipo_solicitud(asunto: str) -> Optional[str]:
    """Devuelve el nombre canónico del tipo de solicitud detectado en el asunto."""
    if not asunto:
        return None
    asunto_norm = asunto.lower()
    for nombre, patrones in PATRONES_TIPO:
        for patron in patrones:
            if re.search(patron, asunto_norm):
                return nombre
    return None


async def resolver_tipo_solicitud_id(db: AsyncSession, asunto: str) -> Optional[int]:
    nombre = detectar_tipo_solicitud(asunto)
    if not nombre:
        return None
    result = await db.execute(
        select(TipoSolicitud).where(
            func.lower(TipoSolicitud.nombre) == nombre.lower()
        )
    )
    tipo = result.scalar_one_or_none()
    return tipo.id if tipo else None


# ════════════════════════════════════════════════════════════════════
# 3. Resolución de cliente a partir del remitente
# ════════════════════════════════════════════════════════════════════

async def resolver_cliente_por_remitente(
    db: AsyncSession, remitente: str
) -> Tuple[str, Optional[int], Optional[int]]:
    """
    Devuelve (cliente_str, aseguradora_id, ramo_id).
    Si no existe asociación, devuelve ("Pendiente de asignar", None, None).
    """
    if not remitente:
        return "Pendiente de asignar", None, None

    stmt = select(ClienteRemitente).where(
        func.lower(ClienteRemitente.remitente) == remitente.lower(),
        ClienteRemitente.activo == True,
    )
    result = await db.execute(stmt)
    asoc = result.scalar_one_or_none()
    if asoc:
        return asoc.cliente, asoc.aseguradora_id, asoc.ramo_id
    return "Pendiente de asignar", None, None


# ════════════════════════════════════════════════════════════════════
# 4. Resolución de prioridad / estado
# ════════════════════════════════════════════════════════════════════

async def resolver_prioridad_id(db: AsyncSession, nombre: Optional[str]) -> Optional[int]:
    if not nombre:
        return None
    result = await db.execute(
        select(Prioridad).where(func.lower(Prioridad.nombre) == nombre.lower())
    )
    p = result.scalar_one_or_none()
    return p.id if p else None


async def resolver_estado_pendiente_id(db: AsyncSession) -> Optional[int]:
    result = await db.execute(
        select(EstadoSolicitud).where(func.lower(EstadoSolicitud.nombre) == "pendiente")
    )
    e = result.scalar_one_or_none()
    return e.id if e else None


# ════════════════════════════════════════════════════════════════════
# 5. Persistencia de archivos
# ════════════════════════════════════════════════════════════════════

def _safe_filename(name: str) -> str:
    name = re.sub(r"[^A-Za-z0-9_.\-]", "_", name)
    return name[:200] if len(name) > 200 else name


def _decode_pa_content(value: Any) -> bytes:
    """
    Decodifica contenido binario enviado por Power Automate.

    Power Automate puede enviar archivos binarios de tres formas:

    Formato A – str base64 puro:
        "TUlNRS1WZXJzaW9uOiAxLjA..."

    Formato B – str base64 que al decodificarse da un JSON con $content
    (Power Automate double-encode cuando el campo es binario):
        base64( '{"$content-type":"message/rfc822","$content":"<base64eml>"}' )

    Formato C – dict JSON anidado en el body (Power Automate no lo convirtió a str):
        {"$content-type": "message/rfc822", "$content": "<base64eml>"}
    """
    # ── Formato C: ya es un dict ──────────────────────────────────────
    if isinstance(value, dict):
        inner = value.get("$content") or value.get("content")
        if not inner:
            raise ValueError("El dict recibido no contiene '$content'")
        # $content puede ser a su vez base64 del EML real
        return _decode_pa_content(inner)

    raw = str(value).strip()

    # ── Formato A/B: es un string; limpiar y decodificar ─────────────
    # Eliminar saltos de línea y espacios (PA a veces los inserta)
    raw_clean = re.sub(r"\s+", "", raw)

    # Añadir padding faltante
    pad = len(raw_clean) % 4
    if pad:
        raw_clean += "=" * (4 - pad)

    # Intentar decodificación estándar y luego urlsafe
    try:
        decoded = base64.b64decode(raw_clean, validate=False)
    except Exception:
        try:
            decoded = base64.urlsafe_b64decode(raw_clean)
        except Exception as exc:
            raise ValueError(f"No se pudo decodificar el base64: {exc}")

    # ── Formato B: el resultado es un JSON con $content ───────────────
    stripped = decoded.lstrip()
    if stripped.startswith(b"{"):
        try:
            obj = json.loads(decoded)
            if "$content" in obj:
                # Recursivo: $content es otro base64 (el EML real)
                return _decode_pa_content(obj["$content"])
        except (json.JSONDecodeError, KeyError):
            pass  # No era JSON válido; asumimos que es el EML en sí

    return decoded


def guardar_eml(eml_base64: Any, eml_filename: Optional[str], nro_ticket: str) -> dict:
    """Guarda el archivo .eml en disco, manejando todos los formatos de Power Automate."""
    base_dir: Path = settings.emails_dir
    base_dir.mkdir(parents=True, exist_ok=True)

    if not eml_filename:
        eml_filename = f"{nro_ticket}.eml"
    eml_filename = _safe_filename(eml_filename)
    if not eml_filename.lower().endswith(".eml"):
        eml_filename += ".eml"

    final_name = f"{nro_ticket}_{uuid.uuid4().hex[:6]}_{eml_filename}"
    full_path = base_dir / final_name

    try:
        data = _decode_pa_content(eml_base64)
    except Exception as exc:
        raise ValueError(f"eml_base64 inválido: {exc}")

    full_path.write_bytes(data)

    return {
        "filename": eml_filename,
        "stored_filename": final_name,
        "path": str(full_path),
        "size": len(data),
        "tipo": "eml",
    }


def guardar_adjunto(content_base64: Any, filename: str, nro_ticket: str) -> dict:
    """Guarda un adjunto genérico bajo emails_dir/{nro_ticket}/."""
    base_dir: Path = settings.emails_dir / nro_ticket
    base_dir.mkdir(parents=True, exist_ok=True)

    safe_name = _safe_filename(filename or f"adjunto_{uuid.uuid4().hex[:6]}")
    full_path = base_dir / safe_name

    try:
        data = _decode_pa_content(content_base64)
    except Exception as exc:
        raise ValueError(f"content_base64 inválido: {exc}")

    full_path.write_bytes(data)

    return {
        "filename": safe_name,
        "path": str(full_path),
        "size": len(data),
        "tipo": "adjunto",
    }
