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
import numpy as np
from pathlib import Path
from datetime import datetime
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
    # Interfaz LEGADA (carga masiva, formularios manuales antiguos)
    # ════════════════════════════════════════════════════════════════

    def _extract_features(self, data: dict) -> np.ndarray:
        fecha_ingreso = data["fecha_ingreso"]
        fecha_esperada = data["fecha_esperada_atencion"]

        if not isinstance(fecha_ingreso, datetime):
            fecha_ingreso = datetime.fromisoformat(str(fecha_ingreso))
        if not isinstance(fecha_esperada, datetime):
            fecha_esperada = datetime.fromisoformat(str(fecha_esperada))

        horas_disponibles = (fecha_esperada - fecha_ingreso).total_seconds() / 3600
        ans_horas = data.get("ans_horas_limite", 48.0) or 48.0
        peso_complejidad = data.get("peso_complejidad", 1.0) or 1.0
        tiempo_estimado = data["tiempo_estimado_atencion"]
        cantidad = data["cantidad_asegurados"]

        ratio_tiempo_ans = tiempo_estimado / ans_horas if ans_horas > 0 else 1.0
        ratio_asegurados_tiempo = cantidad / tiempo_estimado if tiempo_estimado > 0 else 0.0
        dias_hasta_vencimiento = horas_disponibles / 24

        features = np.array([[
            cantidad, tiempo_estimado, ans_horas, peso_complejidad,
            horas_disponibles, ratio_tiempo_ans, ratio_asegurados_tiempo,
            fecha_ingreso.weekday(), fecha_ingreso.hour, dias_hasta_vencimiento,
        ]])
        return features

    def predict(self, data: dict) -> dict:
        """Interfaz legada utilizada por el módulo de carga masiva."""
        start_time = time.time()
        features = self._extract_features(data)

        if self._model_loaded and self._model is not None:
            try:
                prediction = self._model.predict(features)[0]
                if hasattr(self._model, "predict_proba"):
                    proba = self._model.predict_proba(features)[0]
                    prob_riesgo = float(proba[0]) if prediction == 1 else float(proba[1])
                else:
                    prob_riesgo = 0.85 if prediction == 0 else 0.2
                cumple_ans = bool(prediction == 1)
            except Exception as e:
                logger.error(f"Error en predicción del modelo: {e}")
                cumple_ans, prob_riesgo = self._fallback_predict(features[0])
        else:
            cumple_ans, prob_riesgo = self._fallback_predict(features[0])

        nivel_riesgo = self._calcular_nivel_riesgo(prob_riesgo, cumple_ans)
        mensaje = self._generar_mensaje(cumple_ans, nivel_riesgo)
        recomendacion = self._generar_recomendacion(nivel_riesgo, features[0])

        elapsed_ms = (time.time() - start_time) * 1000

        return {
            "cumple_ans": cumple_ans,
            "probabilidad_riesgo": round(prob_riesgo, 4),
            "nivel_riesgo": nivel_riesgo,
            "mensaje": mensaje,
            "recomendacion": recomendacion,
            "modelo_version": MODEL_VERSION,
            "tiempo_prediccion_ms": round(elapsed_ms, 2),
        }

    # ════════════════════════════════════════════════════════════════
    # Interfaz NUEVA (Outlook / Power Automate)
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

    # ════════════════════════════════════════════════════════════════
    # Helpers
    # ════════════════════════════════════════════════════════════════

    def _fallback_predict(self, features: np.ndarray) -> tuple:
        cantidad = features[0]
        tiempo_estimado = features[1]
        ans_horas = features[2]
        peso_complejidad = features[3]
        horas_disponibles = features[4]

        risk_score = 0.0
        if ans_horas > 0:
            ratio = (tiempo_estimado * peso_complejidad) / ans_horas
            risk_score += min(ratio * 0.4, 0.4)

        if cantidad > 500:
            risk_score += 0.25
        elif cantidad > 200:
            risk_score += 0.15
        elif cantidad > 50:
            risk_score += 0.05

        if horas_disponibles > 0:
            eficiencia = tiempo_estimado / horas_disponibles
            risk_score += min(eficiencia * 0.25, 0.25)

        if peso_complejidad > 1.5:
            risk_score += 0.1

        risk_score = min(max(risk_score, 0.02), 0.98)
        cumple_ans = risk_score < 0.5
        return cumple_ans, risk_score

    def _calcular_nivel_riesgo(self, prob_riesgo: float, cumple_ans: bool) -> str:
        if not cumple_ans:
            if prob_riesgo >= 0.85:
                return "critico"
            return "alto"
        if prob_riesgo >= 0.4:
            return "medio"
        return "bajo"

    def _generar_mensaje(self, cumple_ans: bool, nivel_riesgo: str) -> str:
        mensajes = {
            ("cumple", "bajo"): "✅ Solicitud dentro del ANS con riesgo bajo.",
            ("cumple", "medio"): "⚠️ Solicitud dentro del ANS pero con riesgo moderado a considerar.",
            ("no_cumple", "alto"): "🔴 Solicitud en riesgo de incumplir el ANS. Se requiere acción.",
            ("no_cumple", "critico"): "🚨 CRÍTICO: Alta probabilidad de incumplimiento del ANS. Acción inmediata.",
        }
        key = ("cumple" if cumple_ans else "no_cumple", nivel_riesgo)
        return mensajes.get(key, "Predicción generada por el sistema ANS.")

    def _generar_recomendacion(self, nivel_riesgo: str, features: np.ndarray) -> str:
        if nivel_riesgo == "critico":
            return "Asignar gestor prioritario, notificar a la aseguradora y escalar al supervisor inmediatamente."
        elif nivel_riesgo == "alto":
            return "Revisar la asignación de recursos. Considerar incrementar el equipo de atención."
        elif nivel_riesgo == "medio":
            return "Monitorear el avance. Verificar disponibilidad del equipo asignado."
        return "Continuar el proceso normal de atención según protocolo estándar."


# Instancia singleton
predictor = ANSPredictorService()
