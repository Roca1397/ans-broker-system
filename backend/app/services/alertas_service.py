"""
Servicio de gestión de alertas de riesgo ANS.

Regla principal:
  prediccion == "Fuera de ANS"  →  crear/actualizar alerta activa
  prediccion != "Fuera de ANS"  →  resolver alerta activa existente

Tipos de alerta (nivel):
  "critico"      → prob >= 0.80
  "alto_riesgo"  → 0.45 <= prob < 0.80

Mensaje visible en campanita:
  "{ticket} — {cliente} — Riesgo de incumplimiento: {pct}%"

Anti-duplicado:
  Se busca la alerta activa (resuelta=False) para la solicitud antes de crear.
  Solo se re-notifica (leida=False) cuando el tipo cambia o la prob varía > 5 pp.

Asignación:
  usuario_id = solicitud.ejecutivo_id   (puede ser None → visible para todos)
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.solicitud import Alerta, Solicitud

UMBRAL_ALERTA = 0.45  # alineado con PROBABILIDAD_UMBRAL_ANS del RF v2
_TIPOS_RIESGO = {"alto_riesgo", "critico"}


async def gestionar_alerta_riesgo(
    db: AsyncSession,
    solicitud: Solicitud,
    prob: float,
    prediccion: str = "",
) -> None:
    """
    Crea, actualiza o resuelve la alerta de riesgo ANS para una solicitud.
    Debe llamarse ANTES del commit final de la transacción que invoca esta función.

    - prediccion == "Fuera de ANS" → genera alerta (critico o alto_riesgo según prob)
    - cualquier otro valor          → resuelve alerta activa si existe
    """
    existing = (await db.execute(
        select(Alerta).where(
            Alerta.solicitud_id == solicitud.id,
            Alerta.resuelta == False,
            Alerta.tipo.in_(list(_TIPOS_RIESGO)),
        )
    )).scalar_one_or_none()

    if prediccion != "Fuera de ANS":
        if existing:
            existing.resuelta = True
        return

    tipo = "critico" if prob >= 0.80 else "alto_riesgo"
    pct = round(prob * 100)
    ticket = solicitud.nro_ticket or str(solicitud.id)[:8].upper()
    cliente = solicitud.cliente or "Sin cliente"
    mensaje = f"{ticket} — {cliente} — Riesgo de incumplimiento: {pct}%"

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
