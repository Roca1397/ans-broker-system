"""
Servicio de predicción ANS — singleton legacy.

Interfaz mantenida para compatibilidad con los flujos existentes
(Outlook, creación manual, carga masiva).

predict_simple(asunto, cuerpo, prioridad_nombre)
  → Usa el modelo Random Forest cuando está cargado.
  → Cae a heurística de texto cuando el modelo no está disponible.

Para predicciones con datos estructurados completos usar directamente:
  from app.services.prediction_service import predecir_ans
"""
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MODEL_VERSION_HEURISTIC = "1.0.0-heuristic"


class ANSPredictorService:
    """Singleton que expone predict_simple() para el flujo de solicitudes."""

    _instance: Optional["ANSPredictorService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # load_model se mantiene por compatibilidad con main.py (lifespan)
    def load_model(self, model_path: str) -> bool:
        """
        Intenta cargar el modelo desde model_path.
        En la nueva arquitectura, prediction_service.py ya carga los artefactos
        de ml_models/ al importarse. Este método es un hook de compatibilidad.
        """
        from app.services.prediction_service import is_loaded, reload
        if is_loaded():
            logger.info("Modelo RF ya cargado por prediction_service.")
            return True
        # Intentar recarga explícita
        ok = reload()
        if ok:
            logger.info("Modelo RF cargado via prediction_service.reload()")
        else:
            logger.warning(
                "prediction_service no pudo cargar el modelo. "
                "predict_simple usará heurística de fallback."
            )
        return ok

    @property
    def _rf_disponible(self) -> bool:
        try:
            from app.services.prediction_service import is_loaded
            return is_loaded()
        except ImportError:
            return False

    def predict_simple(
        self,
        asunto: str = "",
        cuerpo: str = "",
        prioridad_nombre: Optional[str] = None,
        umbral: float = 0.70,
    ) -> dict:
        """
        Interfaz legada usada por los routers de solicitudes.

        Cuando el modelo RF está disponible intenta usarlo con los datos
        textuales disponibles (prioridad) más variables de fecha actual.
        Cuando no está disponible usa la heurística de palabras clave.

        Para predicciones de mayor precisión usar prediction_service.predecir_ans()
        con todos los campos estructurados.
        """
        if self._rf_disponible:
            return self._predict_con_rf(prioridad_nombre, umbral)
        return self._predict_heuristico(asunto, cuerpo, prioridad_nombre, umbral)

    def _predict_con_rf(self, prioridad_nombre: Optional[str], umbral: float) -> dict:
        """Delega al RF con los datos disponibles (fecha actual + prioridad)."""
        from app.services.prediction_service import predecir_ans
        result = predecir_ans(
            tipo_solicitud=None,
            prioridad=prioridad_nombre,
            aseguradora=None,
            producto=None,
            nro_atenciones=1,
            fecha_recepcion=None,
            umbral=umbral,
        )
        return {
            "probabilidad": result["probabilidad_incumplimiento"],
            "prediccion": result["prediccion_ans"],
            "modelo_version": result["modelo_usado"],
            "tiempo_prediccion_ms": result["tiempo_prediccion_ms"],
        }

    def _predict_heuristico(
        self,
        asunto: str,
        cuerpo: str,
        prioridad_nombre: Optional[str],
        umbral: float,
    ) -> dict:
        """Heurística de palabras clave — fallback cuando el RF no está disponible."""
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
            "modelo_version": MODEL_VERSION_HEURISTIC,
            "tiempo_prediccion_ms": round(elapsed_ms, 2),
        }


# Instancia singleton
predictor = ANSPredictorService()
