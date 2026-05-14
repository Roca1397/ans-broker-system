"""
=======================================================
ANS Broker System — Entrenamiento del Modelo Predictivo
Google Colab Training Script
=======================================================

Ejecutar en Google Colab:
  1. Abre este archivo en Colab
  2. Ejecuta todas las celdas
  3. Descarga el archivo ans_model.pkl generado
  4. Coloca el archivo en: backend/app/ml/models/ans_model.pkl

"""

# ── Celda 1: Instalar dependencias ──────────────────────────────────
# !pip install scikit-learn pandas numpy joblib

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import joblib
import warnings
warnings.filterwarnings('ignore')

print("✅ Dependencias cargadas")

# ── Celda 2: Generar datos sintéticos de entrenamiento ──────────────
np.random.seed(42)
N = 5000

# Simular datos reales de un bróker de seguros peruano
data = {
    'cantidad_asegurados':        np.random.randint(1, 800, N),
    'tiempo_estimado_atencion':   np.random.uniform(1, 120, N),
    'ans_horas_limite':           np.random.choice([24, 36, 48, 72], N, p=[0.1, 0.15, 0.5, 0.25]),
    'peso_complejidad':           np.random.choice([0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.5, 2.0], N),
    'horas_disponibles':          np.random.uniform(4, 200, N),
    'dia_semana_ingreso':         np.random.randint(0, 7, N),
    'hora_ingreso':               np.random.randint(7, 20, N),
}

df = pd.DataFrame(data)

# Features derivadas
df['ratio_tiempo_ans']       = df['tiempo_estimado_atencion'] * df['peso_complejidad'] / df['ans_horas_limite']
df['ratio_asegurados_tiempo'] = df['cantidad_asegurados'] / df['tiempo_estimado_atencion'].clip(lower=0.1)
df['dias_hasta_vencimiento']  = df['horas_disponibles'] / 24

# Etiqueta: cumple ANS (1) o no cumple (0)
# Reglas de negocio para etiquetado sintético realista:
score_riesgo = (
    0.40 * (df['ratio_tiempo_ans'].clip(0, 2) / 2) +
    0.20 * (df['cantidad_asegurados'] / 800) +
    0.20 * (1 - (df['horas_disponibles'] / 200).clip(0, 1)) +
    0.10 * (df['peso_complejidad'] / 2) +
    0.10 * np.where(df['dia_semana_ingreso'] >= 5, 0.7, 0.3)
)

# Añadir ruido para simular varianza real
score_riesgo += np.random.normal(0, 0.08, N)
score_riesgo = score_riesgo.clip(0, 1)

# 1 = cumple ANS, 0 = no cumple ANS
df['cumple_ans'] = (score_riesgo < 0.50).astype(int)

print(f"✅ Dataset generado: {N} registros")
print(f"   Cumple ANS: {df['cumple_ans'].sum()} ({df['cumple_ans'].mean()*100:.1f}%)")
print(f"   No cumple:  {(~df['cumple_ans'].astype(bool)).sum()} ({(1-df['cumple_ans'].mean())*100:.1f}%)")

# ── Celda 3: Preparar features ───────────────────────────────────────
FEATURES = [
    'cantidad_asegurados',
    'tiempo_estimado_atencion',
    'ans_horas_limite',
    'peso_complejidad',
    'horas_disponibles',
    'ratio_tiempo_ans',
    'ratio_asegurados_tiempo',
    'dia_semana_ingreso',
    'hora_ingreso',
    'dias_hasta_vencimiento',
]

X = df[FEATURES]
y = df['cumple_ans']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
print(f"✅ Train: {len(X_train)} | Test: {len(X_test)}")

# ── Celda 4: Entrenar modelo ─────────────────────────────────────────
model = Pipeline([
    ('scaler', StandardScaler()),
    ('clf', GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.08,
        max_depth=5,
        min_samples_split=10,
        min_samples_leaf=5,
        subsample=0.85,
        random_state=42,
    ))
])

print("🔄 Entrenando modelo Gradient Boosting...")
model.fit(X_train, y_train)

# ── Celda 5: Evaluación ──────────────────────────────────────────────
y_pred  = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

print("\n" + "="*50)
print("MÉTRICAS DE EVALUACIÓN")
print("="*50)
print(classification_report(y_test, y_pred, target_names=['No Cumple ANS', 'Cumple ANS']))
print(f"ROC-AUC Score: {roc_auc_score(y_test, y_proba):.4f}")

cv_scores = cross_val_score(model, X, y, cv=5, scoring='roc_auc')
print(f"CV ROC-AUC:    {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

# Feature importance
clf = model.named_steps['clf']
importances = pd.Series(clf.feature_importances_, index=FEATURES).sort_values(ascending=False)
print("\nFeature Importances:")
for feat, imp in importances.items():
    bar = '█' * int(imp * 50)
    print(f"  {feat:<35} {bar} {imp:.4f}")

# ── Celda 6: Guardar modelo ──────────────────────────────────────────
MODEL_PATH = 'ans_model.pkl'
joblib.dump(model, MODEL_PATH)
print(f"\n✅ Modelo guardado en: {MODEL_PATH}")
print(f"   Tamaño: {__import__('os').path.getsize(MODEL_PATH) / 1024:.1f} KB")

# ── Celda 7: Verificar modelo cargado ───────────────────────────────
loaded_model = joblib.load(MODEL_PATH)
test_input = np.array([[50, 24, 48, 1.0, 48, 0.5, 2.08, 1, 9, 2.0]])
pred = loaded_model.predict(test_input)[0]
proba = loaded_model.predict_proba(test_input)[0]
print(f"\n🧪 Test de verificación:")
print(f"   Input: 50 asegurados, 24h estimadas, ANS 48h")
print(f"   Predicción: {'✓ CUMPLE ANS' if pred == 1 else '✗ NO CUMPLE ANS'}")
print(f"   Probabilidad cumple: {proba[1]:.4f}")
print(f"   Probabilidad no cumple: {proba[0]:.4f}")

# ── Celda 8: Descargar (solo en Colab) ──────────────────────────────
try:
    from google.colab import files
    files.download(MODEL_PATH)
    print(f"\n📥 Descargando {MODEL_PATH}...")
    print("   → Coloca el archivo en: backend/app/ml/models/ans_model.pkl")
except ImportError:
    print(f"\n📁 Archivo disponible en: {MODEL_PATH}")
    print("   → Copia a: backend/app/ml/models/ans_model.pkl")

print("\n✅ ¡Listo! El modelo está exportado y verificado.")
