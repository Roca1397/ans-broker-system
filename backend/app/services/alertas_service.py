"""
Servicio de gestión de alertas de riesgo ANS.

Regla principal:
  probabilidad_incumplimiento >= 0.80  →  crear/actualizar alerta activa
  probabilidad_incumplimiento  < 0.80  →  resolver alerta activa existente

Tipos de alerta:
  "critico"      → prob >= 0.90
  "alto_riesgo"  → 0.80 <= prob < 0.90

Anti-duplicado:
  Se busca la alerta activa (resuelta=False) para la solicitud antes de crear.
  Solo se re-notifica (leida=False) cuando el tipo cambia o la prob varía > 5 pp.

Asignación:
  usuario_id = solicitud.ejecutivo_id   (puede ser None → visible para todos)
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.solicitud import Alerta, Solicitud

UMBRAL_ALERTA = 0.80
_TIPOS_RIESGO = {"alto_riesgo", "critico"}


async def gestionar_alerta_riesgo(
    db: AsyncSession,
    solicitud: Solicitud,
    prob: float,
) -> None:
    """
    Crea, actualiza o resuelve la alerta de riesgo ANS para una solicitud.
    Debe llamarse ANTES del commit final de la transacción que invoca esta función.
    """
    existing = (await db.execute(
        select(Alerta).where(
            Alerta.solicitud_id == solicitud.id,
            Alerta.resuelta == False,
            Alerta.tipo.in_(list(_TIPOS_RIESGO)),
        )
    )).scalar_one_or_none()

    if prob < UMBRAL_ALERTA:
        if existing:
            existing.resuelta = True
        return

    tipo = "critico" if prob >= 0.90 else "alto_riesgo"
    pct = round(prob * 100)
    ticket = solicitud.nro_ticket or str(solicitud.id)[:8].upper()
    mensaje = (
        f"{ticket} — Riesgo {pct}%. "
        f"Solicitud con alta probabilidad de incumplimiento ANS."
    )

    if existing:
        prev_prob = existing.probabilidad or 0.0
        tipo_cambio = existing.tipo != tipo
        prob_cambio = abs(prev_prob - prob) > 0.05
        if tipo_cambio or prob_cambio:
            existing.tipo = tipo
            existing.mensaje = mensaje
            existing.probabilidad = prob
            existing.leida = False
    else:
        db.add(Alerta(
            solicitud_id=solicitud.id,
            tipo=tipo,
            mensaje=mensaje,
            probabilidad=prob,
            usuario_id=solicitud.ejecutivo_id,
            resuelta=False,
        ))
