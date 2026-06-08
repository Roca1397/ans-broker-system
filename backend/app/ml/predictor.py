"""
Servicio de predicción ANS.

Extendido para soportar DOS interfaces:

1) Interfaz LEGADA: predict(data: dict) con features avanzados.
2) Interfaz NUEVA: predict_simple(asunto, cuerpo, prioridad_nombre) usada por
   el flujo Outlook. Aplica regla temporal: probabilidad > 0.70 => "Fuera de ANS".

Cuando entrenes el modelo Random Forest:
  - Coloca el .pkl en backend/app/ml/models/ans_model.pkl
  - Si expone predict_proba(X), `predict_simple` puede ser modificado para usarlo.

REEMPLAZA: backend/app/ml/predictor.py
"""
import time
import joblib
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

MODEL_VERSION = "1.0.0-heuristic"


class ANSPredictorService:
    """Servicio singleton para cargar y usar el modelo predictivo."""

    _instance: Optional["ANSPredictorService"] = None
    _model = None
    _model_loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # ════════════════════════════════════════════════════════════════
    # Carga del modelo
    # ════════════════════════════════════════════════════════════════

    def load_model(self, model_path: str) -> bool:
        path = Path(model_path)
        if path.exists():
            try:
                self._model = joblib.load(path)
                self._model_loaded = True
                logger.info(f"✅ Modelo cargado desde: {path}")
                return True
            except Exception as e:
                logger.warning(f"⚠️ No se pudo cargar el modelo: {e}. Usando modelo de fallback.")
        else:
            logger.warning(f"⚠️ Archivo de modelo no encontrado: {path}. Usando modelo de fallback.")
        self._model_loaded = False
        return False

    # ════════════════════════════════════════════════════════════════
    # Interfaz de predicción (Outlook / Power Automate / manual)
    # ════════════════════════════════════════════════════════════════

    def predict_simple(
        self,
        asunto: str = "",
        cuerpo: str = "",
        prioridad_nombre: Optional[str] = None,
        umbral: float = 0.70,
    ) -> dict:
        """
        Lógica TEMPORAL (heurística) utilizada para correos Outlook.
        Cuando entrenes Random Forest, REEMPLAZA el cuerpo de este método
        por self._model.predict_proba(features) y mantén el contrato de retorno.
        """
        start_time = time.time()
        score = 0.30

        texto = f"{asunto or ''} {cuerpo or ''}".lower()

        urgentes = ["urgente", "urgent", "vence", "vencimiento", "inmediato",
                    "hoy", "asap", "critico", "crítico", "prioridad alta"]
        moderadas = ["importante", "atención", "atencion", "pronto", "esta semana"]

        for palabra in urgentes:
            if palabra in texto:
                score += 0.15
        for palabra in moderadas:
            if palabra in texto:
                score += 0.07

        if prioridad_nombre:
            mapping = {"alta": 0.30, "media": 0.10, "baja": -0.10}
            score += mapping.get(prioridad_nombre.strip().lower(), 0.0)

        if cuerpo and len(cuerpo) > 1500:
            score += 0.05

        score = min(max(score, 0.02), 0.98)
        prediccion = "Fuera de ANS" if score > umbral else "Dentro de ANS"

        elapsed_ms = (time.time() - start_time) * 1000

        return {
            "probabilidad": round(score, 4),
            "prediccion": prediccion,
            "modelo_version": MODEL_VERSION,
            "tiempo_prediccion_ms": round(elapsed_ms, 2),
        }



# Instancia singleton
predictor = ANSPredictorService()
