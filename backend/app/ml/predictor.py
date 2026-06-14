"""
Servicio legacy de predicción ANS — solo heurística de palabras clave.

predict_simple() NO usa el modelo Random Forest v2.
El resultado lleva modelo_version='legacy_no_persistente' y nunca se guarda en BD.

Para predicciones reales con RF v2 usar el helper _predecir_con_rf()
del router de solicitudes, que llama a prediction_service.predecir_ans().
"""
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MODEL_VERSION_LEGACY = "legacy_no_persistente"


class ANSPredictorService:
    """Singleton legacy — solo expone predict_simple() para el endpoint /predict."""

    _instance: Optional["ANSPredictorService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load_model(self, model_path: str) -> bool:
        """
        Hook de compatibilidad con main.py (lifespan).
        La carga real del RF la hace prediction_service.py al importarse.
        """
        from app.services.prediction_service import is_loaded, reload
        if is_loaded():
            logger.info("Modelo RF v2 ya cargado por prediction_service.")
            return True
        ok = reload()
        if ok:
            logger.info("Modelo RF v2 cargado via prediction_service.reload()")
        else:
            logger.warning(
                "prediction_service no pudo cargar el modelo RF v2. "
                "predict_simple usará solo heurística."
            )
        return ok

    def predict_simple(
        self,
        asunto: str = "",
        cuerpo: str = "",
        prioridad_nombre: Optional[str] = None,
        umbral: float = 0.45,
    ) -> dict:
        """
        [LEGACY] Heurística de palabras clave pura.

        NO usa el modelo Random Forest v2.
        El resultado no se guarda en BD (modelo_version = 'legacy_no_persistente').
        Solo debe usarse desde el endpoint GET /predicciones/predict.
        """
        result = self._predict_heuristico(asunto, cuerpo, prioridad_nombre, umbral)
        result["modelo_version"] = MODEL_VERSION_LEGACY
        return result

    def _predict_heuristico(
        self,
        asunto: str,
        cuerpo: str,
        prioridad_nombre: Optional[str],
        umbral: float,
    ) -> dict:
        """Heurística de palabras clave — fallback textual, no es predicción real."""
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
            "modelo_version": MODEL_VERSION_LEGACY,
            "tiempo_prediccion_ms": round(elapsed_ms, 2),
        }


# Instancia singleton
predictor = ANSPredictorService()
