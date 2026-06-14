"""
Servicio de predicción ANS — Random Forest v2

Modelo: backend/app/ml_models/modelo_random_forest_v2.pkl
Encoders: backend/app/ml_models/label_encoders_v2.pkl

Features esperadas (orden exacto del entrenamiento):
  Tipo_Solicitud_enc, Prioridad_enc, Aseguradora_enc, Producto_enc,
  Verificacion_de_dia_enc, Nro_atenciones, CRUCE_ANS_num, hora_decimal,
  mes_solicitud, semana_anio, dia_semana_num, es_fin_semana,
  es_inicio_mes, es_fin_mes, es_despues_5pm

Mapeo BD → modelo:
  tipo_solicitud.nombre  → Tipo_Solicitud       → Tipo_Solicitud_enc
  prioridad_rel.nombre   → Prioridad            → Prioridad_enc
  aseguradora.nombre     → Aseguradora          → Aseguradora_enc
  ramo.nombre            → Producto             → Producto_enc  (Producto = Ramo)
  calculado de fecha     → Verificacion_de_dia  → Verificacion_de_dia_enc
  nro_atenciones         → Nro_atenciones
  obtener_cruce_ans_num(tipo, ramo) → CRUCE_ANS_num  (tipo × línea ramo)
  fecha_recepcion        → hora_decimal, mes_solicitud, semana_anio,
                           dia_semana_num, es_fin_semana, es_inicio_mes,
                           es_fin_mes, es_despues_5pm

NOTA: fecha_envio_aseguradora existe como campo operativo en la BD
      pero NO se usa como entrada del modelo.
"""
import time
import logging
import unicodedata
import numpy as np
import joblib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ── Rutas del modelo (relativas al archivo, funciona en local y Render) ──────
_ML_DIR = Path(__file__).resolve().parent.parent / "ml_models"
_MODEL_PATH    = _ML_DIR / "modelo_random_forest_v2.pkl"
_ENCODERS_PATH = _ML_DIR / "label_encoders_v2.pkl"

# ── Orden exacto de features del entrenamiento ───────────────────────────────
FEATURES_ORDER = [
    "Tipo_Solicitud_enc",
    "Prioridad_enc",
    "Aseguradora_enc",
    "Producto_enc",
    "Verificacion_de_dia_enc",
    "Nro_atenciones",
    "CRUCE_ANS_num",
    "hora_decimal",
    "mes_solicitud",
    "semana_anio",
    "dia_semana_num",
    "es_fin_semana",
    "es_inicio_mes",
    "es_fin_mes",
    "es_despues_5pm",
]

MODEL_VERSION = "Random Forest v2"
_DEFAULT_VERIFICACION_ENC = 3

_model = None
_encoders: dict = {}
_model_loaded = False
_encoders_loaded = False


# ── Tabla de reglas ANS (tipo × línea ramo) ──────────────────────────────────
# Fuente: hoja ANS del Excel histórico (valores autoatención, simplificados).
# Estructura: {tipo_norm: {linea: dias}}
#   linea: "salud" (EPS/Salud) | "rrll" (SCTR/FOLA)
#
# Para mover a BD: ver SQL al final del módulo.
ANS_REGLAS: dict[str, dict[str, int]] = {
    "EXCLUSIONES":    {"salud": 2, "rrll": 1},
    "INCLUSIONES":    {"salud": 2, "rrll": 1},
    "MODIFICACIONES": {"salud": 2, "rrll": 3},
    "FACTURACION":    {"salud": 5, "rrll": 5},
    "CONSTANCIAS":    {"salud": 2, "rrll": 1},
}

# Tipos sin regla linea/tipo: moda histórica del dataset.
ANS_DIAS_FALLBACK: dict[str, int] = {
    "AJUSTE":                    3,
    "ANULACION":                 2,
    "CAMBIO DE PLAN":            4,
    "CENTRO DE COSTOS":          3,
    "CIERRE DE TRAMITE":         1,
    "CONSULTA OPERATIVA":        2,
    "CONSULTAS ASEGURADORAS":    2,
    "CONSULTAS CLIENTES":        2,
    "CONSULTAS SAC":             2,
    "CONTROL DE AFILIADOS":      1,
    "DECLARACION":               1,
    "ENDOSO RETROACTIVO":        4,
    "EXCLUSION RETROACTIVA":     4,
    "FACTURA CON CUADRE":        5,
    "FACTURACION ADELANTADA":    5,
    "GI-GBOR":                   5,
    "INCLUSION RETROACTIVA":     4,
    "INFORMATIVOS":              1,
    "MAPSALUD":                  2,
    "PENDIENTE":                 1,
    "REENVIO DE SUSTENTO":       2,
    "REENVIO INFORMATIVO":       1,
    "REGISTRO BROKER UP":       10,
    "REGISTRO BU SAC":          10,
    "REHABILITACION":            1,
    "REVISION EECC":             1,
    "TRAMA CONSOLIDADA":         1,
    "VALIDACION DE CALCULO":     3,
}

_ANS_GLOBAL_FALLBACK = 2  # mediana global del dataset


# ── Funciones de lookup ANS ───────────────────────────────────────────────────

def _normalizar(s: str) -> str:
    """Uppercase sin tildes ni espacios extra."""
    nfd = unicodedata.normalize("NFD", s)
    sin_tilde = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return sin_tilde.upper().strip()


def _inferir_linea(ramo_nombre: Optional[str]) -> Optional[str]:
    """
    Infiere línea de negocio desde el nombre del ramo/producto.
    'salud' para EPS/Salud; 'rrll' para SCTR/FOLA.
    """
    if not ramo_nombre:
        return None
    n = ramo_nombre.upper()
    if any(k in n for k in ("SCTR", "FOLA", "RRLL", "ACCIDENTE")):
        return "rrll"
    if any(k in n for k in ("EPS", "SALUD", "HEALTH", "MEDICIN")):
        return "salud"
    return None


def obtener_cruce_ans_num(
    tipo_solicitud: Optional[str],
    ramo: Optional[str] = None,
) -> tuple[float, list[str]]:
    """
    Devuelve (dias_ANS, advertencias) según reglas tipo × línea (v1).

    Cascada:
      1. ANS_REGLAS[tipo][linea]   — regla exacta
      2. ANS_REGLAS[tipo] primera  — si linea no determinada
      3. ANS_DIAS_FALLBACK[tipo]   — tipo sin tabla linea
      4. _ANS_GLOBAL_FALLBACK (2)  — tipo desconocido
    """
    advertencias: list[str] = []

    if not tipo_solicitud:
        advertencias.append("tipo_solicitud vacío; CRUCE_ANS_num=1")
        return 1.0, advertencias

    tipo_norm = _normalizar(tipo_solicitud)
    linea = _inferir_linea(ramo)

    regla = ANS_REGLAS.get(tipo_norm)
    if regla:
        if linea and linea in regla:
            return float(regla[linea]), advertencias
        # Línea desconocida → usar primera disponible
        linea_defecto = next(iter(regla))
        dias = float(regla[linea_defecto])
        advertencias.append(
            f"línea no determinada (ramo='{ramo}'); usando '{linea_defecto}' → {dias} días"
        )
        return dias, advertencias

    if tipo_norm in ANS_DIAS_FALLBACK:
        dias = float(ANS_DIAS_FALLBACK[tipo_norm])
        advertencias.append(f"tipo '{tipo_solicitud}' sin regla linea/ramo; moda histórica → {dias} días")
        return dias, advertencias

    advertencias.append(
        f"tipo '{tipo_solicitud}' desconocido; CRUCE_ANS_num={_ANS_GLOBAL_FALLBACK}"
    )
    return float(_ANS_GLOBAL_FALLBACK), advertencias


# ── Carga de artefactos ───────────────────────────────────────────────────────

def _cargar_artefactos() -> None:
    global _model, _encoders, _model_loaded, _encoders_loaded

    if _MODEL_PATH.exists():
        try:
            _model = joblib.load(_MODEL_PATH)
            _model_loaded = True
            logger.info("RF modelo cargado: %s", _MODEL_PATH)
        except Exception as exc:
            logger.error("Error cargando RF modelo: %s", exc)
            _model_loaded = False
    else:
        logger.warning("RF modelo no encontrado: %s", _MODEL_PATH)
        _model_loaded = False

    if _ENCODERS_PATH.exists():
        try:
            _encoders = joblib.load(_ENCODERS_PATH)
            _encoders_loaded = True
            logger.info("Encoders cargados: %s", _ENCODERS_PATH)
        except Exception as exc:
            logger.error("Error cargando encoders: %s", exc)
            _encoders_loaded = False
    else:
        logger.warning("Encoders no encontrados: %s", _ENCODERS_PATH)
        _encoders_loaded = False


_cargar_artefactos()


def is_loaded() -> bool:
    return _model_loaded and _encoders_loaded


def reload() -> bool:
    _cargar_artefactos()
    return is_loaded()


# ── Encoding de variables categóricas ────────────────────────────────────────

def _encode_cat(encoder_key: str, value: str) -> int:
    le = _encoders.get(encoder_key)
    if le is None:
        return 0
    try:
        return int(le.transform([value])[0])
    except ValueError:
        fallback = len(le.classes_) // 2
        logger.warning("Categoría desconocida '%s' para '%s'. Fallback: %d", value, encoder_key, fallback)
        return fallback


def _verificacion_de_dia_str(fecha: Optional[datetime]) -> str:
    if fecha is None:
        return "laborable"
    if fecha.weekday() >= 5:
        return "fin_semana"
    if fecha.hour >= 17:
        return "despues_5pm"
    return "laborable"


def _encode_verificacion(fecha: Optional[datetime]) -> int:
    cat = _verificacion_de_dia_str(fecha)
    le = _encoders.get("Verificacion_de_dia")
    if le is None:
        return _DEFAULT_VERIFICACION_ENC
    try:
        return int(le.transform([cat])[0])
    except ValueError:
        return _DEFAULT_VERIFICACION_ENC


# ── Preparación del vector de features ───────────────────────────────────────

def preparar_datos_para_modelo(
    tipo_solicitud: Optional[str],
    prioridad: Optional[str],
    aseguradora: Optional[str],
    producto: Optional[str],       # = ramo.nombre
    nro_atenciones: Optional[int],
    fecha_recepcion: Optional[datetime],
) -> tuple[dict, list[str]]:
    """
    Convierte los campos de una solicitud al diccionario de features del RF.

    Returns:
        (features_dict, advertencias)
        features_dict tiene exactamente las claves de FEATURES_ORDER.
    """
    advertencias: list[str] = []
    fecha = fecha_recepcion or datetime.now(timezone.utc)

    tipo_str = (tipo_solicitud or "DESCONOCIDO").strip()
    prio_str = (prioridad       or "DESCONOCIDO").strip()
    aseg_str = (aseguradora     or "DESCONOCIDO").strip()
    prod_str = (producto        or "DESCONOCIDO").strip()

    if tipo_solicitud is None:
        advertencias.append("tipo_solicitud no disponible; usando 'DESCONOCIDO'")
    if prioridad is None:
        advertencias.append("prioridad no disponible; usando 'DESCONOCIDO'")
    if aseguradora is None:
        advertencias.append("aseguradora no disponible; usando 'DESCONOCIDO'")
    if producto is None:
        advertencias.append("ramo/producto no disponible; usando 'DESCONOCIDO'")
    if fecha_recepcion is None:
        advertencias.append("fecha_recepcion no disponible; usando fecha actual")

    tipo_enc  = _encode_cat("Tipo_Solicitud", tipo_str)
    prio_enc  = _encode_cat("Prioridad", prio_str)
    aseg_enc  = _encode_cat("Aseguradora", aseg_str)
    prod_enc  = _encode_cat("Producto", prod_str)
    verif_enc = _encode_verificacion(fecha)

    nro = float(nro_atenciones) if nro_atenciones is not None else 1.0

    cruce, adv_cruce = obtener_cruce_ans_num(tipo_solicitud, ramo=producto)
    advertencias.extend(adv_cruce)

    hora_dec     = fecha.hour + fecha.minute / 60
    mes          = fecha.month
    semana       = int(fecha.isocalendar()[1])
    dia_sem      = fecha.weekday()
    fin_sem      = 1 if dia_sem >= 5 else 0
    inicio_mes   = 1 if fecha.day <= 5 else 0
    fin_mes_flag = 1 if fecha.day >= 25 else 0
    despues_5pm  = 1 if fecha.hour >= 17 else 0

    features = {
        "Tipo_Solicitud_enc":      tipo_enc,
        "Prioridad_enc":           prio_enc,
        "Aseguradora_enc":         aseg_enc,
        "Producto_enc":            prod_enc,
        "Verificacion_de_dia_enc": verif_enc,
        "Nro_atenciones":          nro,
        "CRUCE_ANS_num":           cruce,
        "hora_decimal":            hora_dec,
        "mes_solicitud":           mes,
        "semana_anio":             semana,
        "dia_semana_num":          dia_sem,
        "es_fin_semana":           fin_sem,
        "es_inicio_mes":           inicio_mes,
        "es_fin_mes":              fin_mes_flag,
        "es_despues_5pm":          despues_5pm,
    }

    return features, advertencias


# ── Función principal de predicción ──────────────────────────────────────────

def predecir_ans(
    tipo_solicitud: Optional[str],
    prioridad: Optional[str],
    aseguradora: Optional[str],
    producto: Optional[str],
    nro_atenciones: Optional[int] = 1,
    fecha_recepcion: Optional[datetime] = None,
    umbral: float = 0.45,
) -> dict:
    """
    Ejecuta la predicción ANS con el modelo Random Forest.

    Args:
        tipo_solicitud: nombre del tipo (ej. 'INCLUSIONES')
        prioridad:      nombre (ej. 'Alta', 'Media')
        aseguradora:    nombre de la aseguradora
        producto:       nombre del ramo (ej. 'EPS', 'SCTR-S')
        nro_atenciones: número de atenciones
        fecha_recepcion: datetime de recepción
        umbral:         probabilidad de clasificación 'Fuera de ANS'

    Returns:
        {
            "prediccion_ans":              "Dentro de ANS" | "Fuera de ANS",
            "probabilidad_incumplimiento": float (0.0–1.0),
            "modelo_usado":                str,
            "variables_usadas":            dict,
            "advertencias":                list[str],
            "tiempo_prediccion_ms":        float,
        }
    """
    start = time.time()

    if not is_loaded():
        return {
            "prediccion_ans": "Desconocido",
            "probabilidad_incumplimiento": 0.0,
            "modelo_usado": "no_cargado",
            "variables_usadas": {},
            "advertencias": ["Modelo RF no disponible. Verifique ml_models/modelo_random_forest_v2.pkl"],
            "tiempo_prediccion_ms": 0.0,
        }

    features, advertencias = preparar_datos_para_modelo(
        tipo_solicitud, prioridad, aseguradora, producto,
        nro_atenciones, fecha_recepcion,
    )

    X = np.array([[features[f] for f in FEATURES_ORDER]], dtype=float)

    try:
        prob_array = _model.predict_proba(X)[0]
        prob_fuera = float(prob_array[1])
        prediccion = "Fuera de ANS" if prob_fuera >= umbral else "Dentro de ANS"
    except Exception as exc:
        logger.error("Error en predict_proba: %s", exc)
        return {
            "prediccion_ans": "Error",
            "probabilidad_incumplimiento": 0.0,
            "modelo_usado": MODEL_VERSION,
            "variables_usadas": features,
            "advertencias": [f"Error interno del modelo: {exc}"],
            "tiempo_prediccion_ms": round((time.time() - start) * 1000, 2),
        }

    return {
        "prediccion_ans": prediccion,
        "probabilidad_incumplimiento": round(prob_fuera, 4),
        "modelo_usado": MODEL_VERSION,
        "variables_usadas": features,
        "advertencias": advertencias,
        "tiempo_prediccion_ms": round((time.time() - start) * 1000, 2),
    }


# ── SQL: agregar fecha_envio_aseguradora a solicitudes ───────────────────────
# Ejecutar una sola vez en la base de datos:
#
# ALTER TABLE solicitudes
#   ADD COLUMN IF NOT EXISTS fecha_envio_aseguradora TIMESTAMP WITH TIME ZONE;
#
# ── SQL opcional: tabla ans_reglas (para futura migración a BD) ───────────────
#
# CREATE TABLE ans_reglas (
#     id              SERIAL PRIMARY KEY,
#     tipo_solicitud  VARCHAR(100) NOT NULL,
#     linea_negocio   VARCHAR(20)  NOT NULL,  -- 'salud' | 'rrll'
#     ans_dias        INTEGER      NOT NULL,
#     activo          BOOLEAN      DEFAULT TRUE,
#     UNIQUE (tipo_solicitud, linea_negocio)
# );
#
# INSERT INTO ans_reglas (tipo_solicitud, linea_negocio, ans_dias) VALUES
#   ('EXCLUSIONES',    'salud', 2), ('EXCLUSIONES',    'rrll', 1),
#   ('INCLUSIONES',    'salud', 2), ('INCLUSIONES',    'rrll', 1),
#   ('MODIFICACIONES', 'salud', 2), ('MODIFICACIONES', 'rrll', 3),
#   ('FACTURACION',    'salud', 5), ('FACTURACION',    'rrll', 5),
#   ('CONSTANCIAS',    'salud', 2), ('CONSTANCIAS',    'rrll', 1);
