"""
Servicio de procesamiento de correos provenientes de Outlook (Power Automate).

Responsabilidades:
  1. Generar el nro_ticket en formato NT{AÑO}{correlativo} (NT2026001).
  2. Detectar tipo_solicitud a partir del asunto del correo.
  3. Resolver cliente / aseguradora / ramo a partir del remitente.
  4. Persistir el archivo .eml y los adjuntos en disco.

ARCHIVO NUEVO: backend/app/services/outlook_service.py
"""
import base64  # still needed by _decode_pa_content
import json
import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, List, Tuple

logger = logging.getLogger(__name__)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.solicitud import (
    Solicitud, ClienteRemitente, TipoSolicitud,
    EstadoSolicitud, Prioridad, Ramo, Aseguradora,
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
# 2. Helpers de normalización y matching
# ════════════════════════════════════════════════════════════════════

def _normalizar(texto: str) -> str:
    """
    Elimina tildes, convierte a minúsculas y normaliza guiones/espacios a un espacio.

    Ejemplos:
        "SCTR - S"    → "sctr s"
        "Inclusión"   → "inclusion"
        "Pacífico"    → "pacifico"
        "Nro. 4"      → "nro. 4"
    """
    texto = unicodedata.normalize("NFKD", texto).encode("ASCII", "ignore").decode("ASCII")
    texto = texto.lower()
    texto = re.sub(r"[\s\-]+", " ", texto)
    return texto.strip()


def _buscar_frase(palabras_texto: List[str], frase_norm: str) -> bool:
    """
    Devuelve True si frase_norm (como secuencia de palabras) aparece
    como tokens consecutivos en palabras_texto.

    Ejemplo: _buscar_frase(["sctr", "s", "rimac"], "sctr s") → True
    """
    frase_palabras = frase_norm.split()
    n = len(frase_palabras)
    for i in range(len(palabras_texto) - n + 1):
        if palabras_texto[i : i + n] == frase_palabras:
            return True
    return False


# Palabras irrelevantes al buscar aseguradoras por nombre
_ASEG_STOPWORDS = {"seguros", "peru", "s.a", "sac", "cia", "compania", "eps", "del", "de", "la"}

# Patrón para número de atenciones (N° 4, Nro 4, No. 4, Número 4, etc.)
_RE_NRO_ATENCIONES = re.compile(
    r"(?:n[°oºº]|nro\.?|n[uú]mero|no\.?)\s*[:\-]?\s*(\d+)",
    re.IGNORECASE,
)


def extraer_nro_atenciones(asunto: str) -> int:
    """
    Extrae el número de atenciones del asunto.
    Reconoce: N° 4, Nº 4, Nro 4, Nro. 4, Número 4, No. 4
    Retorna 1 si no se encuentra ningún patrón.
    """
    if not asunto:
        return 1
    m = _RE_NRO_ATENCIONES.search(asunto)
    try:
        return int(m.group(1)) if m else 1
    except (ValueError, AttributeError):
        return 1


# ════════════════════════════════════════════════════════════════════
# 3. Extracción dinámica desde el asunto (consulta catálogos de BD)
# ════════════════════════════════════════════════════════════════════

async def extraer_desde_asunto(db: AsyncSession, asunto: str) -> dict:
    """
    Extrae tipo_solicitud_id, ramo_id, aseg_id y nro_atenciones
    del asunto, consultando dinámicamente los catálogos de la BD.

    Reglas de matching:
    - Ignora mayúsculas, minúsculas y tildes.
    - Normaliza guiones y espacios ("SCTR-S" == "SCTR - S" == "SCTR S").
    - Tipo: busca nombres del catálogo como secuencia de palabras en el asunto
            (más largo primero para evitar match parcial).
    - Ramo: ídem.
    - Aseguradora: primero por código, luego por palabras clave del nombre.

    Returns:
        {
            "tipo_solicitud_id": int | None,
            "ramo_id":           int | None,
            "aseg_id":           int | None,
            "nro_atenciones":    int,
        }
    """
    if not asunto:
        return {"tipo_solicitud_id": None, "ramo_id": None, "aseg_id": None, "nro_atenciones": 1}

    nro_atenciones = extraer_nro_atenciones(asunto)

    # Normalizar el asunto completo y dividir en palabras
    asunto_norm = _normalizar(asunto)
    palabras = asunto_norm.split()

    # ── Tipo de solicitud ────────────────────────────────────────────
    tipos = (await db.execute(
        select(TipoSolicitud).where(TipoSolicitud.activo == True)
    )).scalars().all()

    tipo_id = None
    # Ordenar por longitud desc: "Inclusión retroactiva" antes que "Inclusión"
    for tipo in sorted(tipos, key=lambda t: len(t.nombre), reverse=True):
        tipo_norm = _normalizar(tipo.nombre)
        if tipo_norm and _buscar_frase(palabras, tipo_norm):
            tipo_id = tipo.id
            logger.debug("[asunto] tipo=%r id=%d", tipo.nombre, tipo.id)
            break

    # ── Ramo ────────────────────────────────────────────────────────
    ramos = (await db.execute(
        select(Ramo).where(Ramo.activo == True)
    )).scalars().all()

    ramo_id = None
    for ramo in sorted(ramos, key=lambda r: len(r.nombre), reverse=True):
        ramo_norm = _normalizar(ramo.nombre)
        if ramo_norm and _buscar_frase(palabras, ramo_norm):
            ramo_id = ramo.id
            logger.debug("[asunto] ramo=%r id=%d", ramo.nombre, ramo.id)
            break

    # ── Aseguradora ──────────────────────────────────────────────────
    aseguradoras = (await db.execute(
        select(Aseguradora).where(Aseguradora.activo == True)
    )).scalars().all()

    aseg_id = None
    for aseg in sorted(aseguradoras, key=lambda a: len(a.nombre), reverse=True):
        encontrado = False

        # Intento 1: match por código (ej. "RIMAC", "PACIFICO")
        if aseg.codigo:
            codigo_norm = _normalizar(aseg.codigo)
            if codigo_norm and _buscar_frase(palabras, codigo_norm):
                encontrado = True

        # Intento 2: match por palabras clave del nombre
        if not encontrado:
            nombre_norm = _normalizar(aseg.nombre)
            tokens_clave = [
                t for t in nombre_norm.split()
                if len(t) >= 4 and t not in _ASEG_STOPWORDS
            ]
            for token in tokens_clave:
                if token in palabras:
                    encontrado = True
                    break

        if encontrado:
            aseg_id = aseg.id
            logger.debug("[asunto] aseguradora=%r id=%d", aseg.nombre, aseg.id)
            break

    return {
        "tipo_solicitud_id": tipo_id,
        "ramo_id":           ramo_id,
        "aseg_id":           aseg_id,
        "nro_atenciones":    nro_atenciones,
    }


async def resolver_tipo_solicitud_id(db: AsyncSession, asunto: str) -> Optional[int]:
    """Compatibilidad con código existente — delega a extraer_desde_asunto."""
    extraido = await extraer_desde_asunto(db, asunto)
    return extraido["tipo_solicitud_id"]


# ════════════════════════════════════════════════════════════════════
# 4. Resolución de cliente a partir del remitente
# ════════════════════════════════════════════════════════════════════

async def resolver_cliente_por_remitente(
    db: AsyncSession, remitente: str
) -> str:
    """
    Devuelve el nombre del cliente asociado al remitente.
    Si no existe asociación, devuelve "Pendiente de asignar".
    Aseguradora y ramo ya no se resuelven aquí; se extraen del asunto.
    """
    if not remitente:
        return "Pendiente de asignar"

    stmt = (
        select(ClienteRemitente)
        .options(selectinload(ClienteRemitente.cliente_rel))
        .where(func.lower(ClienteRemitente.remitente) == remitente.lower())
    )
    result = await db.execute(stmt)
    asoc = result.scalar_one_or_none()
    if asoc and asoc.cliente_rel:
        return asoc.cliente_rel.nombre
    return "Pendiente de asignar"


async def resolver_prioridad_id_desde_remitente(
    db: AsyncSession, remitente: str
) -> Optional[int]:
    """
    Devuelve el prioridad_id configurado en el cliente asociado al remitente.
    Retorna None si no existe asociación o si el cliente no tiene prioridad configurada.
    """
    if not remitente:
        return None
    stmt = (
        select(ClienteRemitente)
        .options(selectinload(ClienteRemitente.cliente_rel))
        .where(func.lower(ClienteRemitente.remitente) == remitente.lower())
    )
    result = await db.execute(stmt)
    asoc = result.scalar_one_or_none()
    if asoc and asoc.cliente_rel:
        return asoc.cliente_rel.prioridad_id
    return None


# ════════════════════════════════════════════════════════════════════
# 5. Resolución de prioridad / estado
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
# 6. Persistencia de archivos
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
    """
    Guarda el archivo .eml en disco y devuelve solo metadata (sin content_b64).
    El path guardado es relativo a la raíz del proyecto para ser portable.
    Lanza ValueError si el archivo no pudo escribirse o verificarse.
    """
    base_dir: Path = settings.emails_dir
    base_dir.mkdir(parents=True, exist_ok=True)

    raw_filename = eml_filename or f"{nro_ticket}.eml"
    display_name = _safe_filename(raw_filename)
    if not display_name.lower().endswith(".eml"):
        display_name += ".eml"

    stored_filename = f"{nro_ticket}_{display_name}"
    full_path = base_dir / stored_filename

    logger.info(
        "[guardar_eml] ticket=%s | eml_filename_recibido=%r | display_name=%r | "
        "stored_filename=%r | ruta=%s",
        nro_ticket, raw_filename, display_name, stored_filename, full_path,
    )

    try:
        data = _decode_pa_content(eml_base64)
    except Exception as exc:
        logger.error("[guardar_eml] Error decodificando eml_base64: %s", exc)
        raise ValueError(f"eml_base64 inválido: {exc}")

    logger.info("[guardar_eml] eml decodificado: %d bytes", len(data))

    try:
        full_path.write_bytes(data)
    except OSError as exc:
        logger.error("[guardar_eml] No se pudo escribir en disco: %s", exc)
        raise ValueError(f"No se pudo escribir el archivo .eml en disco: {exc}")

    if not full_path.exists():
        logger.error("[guardar_eml] Archivo NO encontrado en disco tras escritura: %s", full_path)
        raise ValueError(f"El archivo fue escrito pero no se puede verificar en disco: {full_path}")

    written_size = full_path.stat().st_size
    logger.info("[guardar_eml] Archivo verificado: %s (%d bytes)", full_path, written_size)

    # Path relativo: uploads/emails/<stored_filename>
    relative_path = f"{settings.UPLOADS_DIR.lstrip('./')}/{settings.EMAILS_SUBDIR}/{stored_filename}".lstrip("/")

    return {
        "filename": display_name,
        "stored_filename": stored_filename,
        "path": relative_path,
        "size": written_size,
        "tipo": "eml",
    }


def guardar_adjunto(content_base64: Any, filename: str, nro_ticket: str) -> dict:
    """
    Guarda un adjunto genérico bajo emails_dir/{nro_ticket}/.
    Solo guarda metadata (sin content_b64).
    """
    base_dir: Path = settings.emails_dir / nro_ticket
    base_dir.mkdir(parents=True, exist_ok=True)

    safe_name = _safe_filename(filename or f"adjunto_{uuid.uuid4().hex[:6]}")
    full_path = base_dir / safe_name

    logger.info(
        "[guardar_adjunto] ticket=%s | filename=%r | ruta=%s",
        nro_ticket, safe_name, full_path,
    )

    try:
        data = _decode_pa_content(content_base64)
    except Exception as exc:
        logger.error("[guardar_adjunto] Error decodificando content_base64: %s", exc)
        raise ValueError(f"content_base64 inválido: {exc}")

    try:
        full_path.write_bytes(data)
    except OSError as exc:
        logger.error("[guardar_adjunto] No se pudo escribir en disco: %s", exc)
        raise ValueError(f"No se pudo escribir el adjunto en disco: {exc}")

    if not full_path.exists():
        logger.error("[guardar_adjunto] Archivo NO encontrado tras escritura: %s", full_path)
        raise ValueError(f"Adjunto escrito pero no verificado en disco: {full_path}")

    written_size = full_path.stat().st_size
    logger.info("[guardar_adjunto] Archivo verificado: %s (%d bytes)", full_path, written_size)

    relative_path = f"{settings.UPLOADS_DIR.lstrip('./')}/{settings.EMAILS_SUBDIR}/{nro_ticket}/{safe_name}".lstrip("/")

    return {
        "filename": safe_name,
        "stored_filename": safe_name,
        "path": relative_path,
        "size": written_size,
        "tipo": "adjunto",
    }
