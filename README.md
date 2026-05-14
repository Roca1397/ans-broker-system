# ANS Broker System v2.0
## Sistema de Gestión Predictiva de ANS para Brókers de Seguros
### Con integración Outlook + Power Automate

---

## Novedades v2.0 (sobre v1.0)

- 📧 **Integración con Outlook vía Power Automate**: las solicitudes que lleguen por correo se registran automáticamente.
- 🎫 **Numeración tipo ticket**: `NT2026001`, `NT2026002`... reiniciada cada año.
- 📋 **Lista tipo SharePoint** con panel lateral de detalle, búsqueda, filtros y orden por riesgo.
- 👥 **Asociación cliente ↔ remitente**: el sistema autocompleta cliente, aseguradora y ramo según el remitente.
- 🛡️ **Roles**: Admin (acceso total) y Usuario (operativo).
- ⚙️ **Catálogos administrables**: tipos de solicitud, estados, prioridades, ramos, aseguradoras, clientes.
- 📎 **Manejo de adjuntos `.eml`** descargables.
- 🤖 **ML preparado para Random Forest**: regla temporal `probabilidad > 70% → Fuera de ANS`.
- 🎨 **Restyle visual** inspirado en confianzacorredores.com (azul corporativo + dorado).

---

## Arquitectura

```
Frontend:      Angular 17 (standalone components, signals)
Backend:       FastAPI + SQLAlchemy (async) + Uvicorn
Base de datos: PostgreSQL 16
ML Model:      scikit-learn (preparado para RandomForest .pkl)
Integración:   Power Automate → POST /api/solicitudes/outlook
Auth:          JWT (frontend) + x-api-key (Power Automate)
```

---

## Estructura del proyecto

```
ans-broker-system/
├── frontend/                              # Angular 17
│   └── src/app/
│       ├── auth/                          # login + register
│       ├── dashboard/
│       ├── solicitudes/
│       │   ├── lista/                     # ★ Lista tipo SharePoint con panel lateral
│       │   ├── nueva/
│       │   ├── carga-masiva/
│       │   └── predicciones/
│       ├── admin/                         # ★ NUEVO
│       │   ├── clientes-remitentes/
│       │   └── catalogos/
│       ├── shared/layout/                 # ✱ restyle Confianza
│       ├── services/
│       │   ├── auth.service.ts            # ✱ +isAdmin()
│       │   └── api.service.ts             # ✱ +SolicitudesService(SharePoint), AdminService, CatalogosService extendido
│       ├── guards/
│       │   ├── auth.guard.ts
│       │   └── admin.guard.ts             # ★ NUEVO
│       └── models/models.ts               # ✱ +SolicitudListItem, SolicitudDetail, ClienteRemitente, ...
│
├── backend/                               # FastAPI
│   ├── app/
│   │   ├── main.py                        # ✱ +router admin, +creación dirs uploads
│   │   ├── core/
│   │   │   ├── config.py                  # ✱ +POWER_AUTOMATE_API_KEY, +UPLOADS_DIR
│   │   │   ├── api_key.py                 # ★ NUEVO – verify_api_key
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   └── solicitud.py               # ✱ extendido: nro_ticket, cliente, remitente, asunto,
│   │   │                                   #             cuerpo_correo, datos_adjuntos, probabilidad,
│   │   │                                   #             prediccion + nuevos catálogos
│   │   ├── schemas/schemas.py             # ✱ +Outlook*, +Catalogo*, +Cliente*, +SolicitudListItem...
│   │   ├── routers/
│   │   │   ├── solicitudes.py             # ✱ +outlook, +/lista, +/{id}/detalle, +/{id}/comentario, +/manual, +DELETE
│   │   │   ├── catalogos.py               # ✱ +tipos-solicitud, +estados-solicitud, +prioridades, +ramos, +clientes
│   │   │   ├── admin.py                   # ★ NUEVO - CRUD catálogos + clientes + asociaciones
│   │   │   └── (auth, users, predicciones, dashboard, alertas sin cambios)
│   │   ├── services/outlook_service.py    # ★ NUEVO - generar nro_ticket, detección tipo, persistencia .eml
│   │   └── ml/predictor.py                # ✱ +predict_simple() para Outlook
│   ├── migrations/
│   │   ├── 001_init.sql
│   │   └── 002_outlook_integration.sql    # ★ NUEVO – migración incremental idempotente
│   ├── uploads/emails/                    # ★ NUEVO – almacenamiento de .eml
│   ├── requirements.txt
│   ├── .env.example                       # ✱ +POWER_AUTOMATE_API_KEY...
│   └── Dockerfile
│
├── docs/
│   ├── POWER_AUTOMATE.md                  # ★ Guía paso a paso
│   ├── ejemplo_body_outlook.json          # ★ Body de ejemplo
│   ├── CAMBIOS_v2.md                      # ★ Resumen de cambios
│   └── train_model_colab.py               # Script de entrenamiento ML (legado)
├── docker-compose.yml                     # ✱ +volumen uploads, +migración 002
└── README.md                              # este archivo
```

★ = archivo nuevo · ✱ = archivo modificado

---

## Instalación local (Setup manual)

### Requisitos
- Python 3.11+
- Node.js 20+
- PostgreSQL 16
- npm 10+

### 1. PostgreSQL

```bash
# Crear la base
psql -U postgres -c "CREATE DATABASE ans_broker_db;"

# Ejecutar migraciones EN ORDEN
psql -U postgres -d ans_broker_db -f backend/migrations/001_init.sql
psql -U postgres -d ans_broker_db -f backend/migrations/002_outlook_integration.sql

# Verificar tablas
psql -U postgres -d ans_broker_db -c "\dt"
```

> Si ya tenías el sistema v1.0 funcionando, **NO** vuelvas a ejecutar `001_init.sql`. Sólo ejecuta `002_outlook_integration.sql` — es idempotente y sólo extiende lo existente.

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Linux/Mac
# .\venv\Scripts\activate   # Windows

pip install -r requirements.txt
cp .env.example .env
# Edita .env y configura DATABASE_URL, SECRET_KEY y POWER_AUTOMATE_API_KEY

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Backend: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/api/docs

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

- Frontend: http://localhost:4200

### 4. Crear usuario admin

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@broker.com",
    "full_name": "Administrador",
    "password": "password123",
    "role": "admin"
  }'
```

### 5. (Opcional) Crear usuario operativo

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operador@broker.com",
    "full_name": "Operador",
    "password": "password123",
    "role": "user"
  }'
```

---

## Setup rápido con Docker

```bash
docker-compose up -d
docker-compose logs -f
```

- Frontend: http://localhost:4200
- Backend:  http://localhost:8000
- API Docs: http://localhost:8000/api/docs

Las migraciones 001 y 002 se aplican automáticamente al crear el contenedor de PostgreSQL.

---

## Roles del sistema

| Acción | Admin | Usuario |
|---|:---:|:---:|
| Ver solicitudes | ✅ | ✅ |
| Abrir detalle de solicitud | ✅ | ✅ |
| Editar campos permitidos | ✅ | ✅ |
| Agregar comentarios | ✅ | ✅ |
| Crear solicitud manual | ✅ | ✅ |
| Eliminar solicitud | ✅ | ❌ |
| Carga masiva (Excel/CSV) | ✅ | ✅ |
| Gestionar catálogos (CRUD) | ✅ | ❌ |
| Gestionar clientes-remitentes | ✅ | ❌ |
| Gestionar aseguradoras | ✅ | ❌ |

---

## Endpoints principales

### Autenticación
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET  /api/users/me`

### Solicitudes (módulo SharePoint-like)
- `GET  /api/solicitudes/lista` — listado con filtros y orden por riesgo
- `GET  /api/solicitudes/{id}/detalle` — detalle completo (panel lateral)
- `PATCH /api/solicitudes/{id}` — editar campos permitidos
- `POST /api/solicitudes/{id}/comentario` — agregar comentario timestamped
- `GET  /api/solicitudes/{id}/adjunto` — descargar primer .eml
- `GET  /api/solicitudes/{id}/adjuntos/{nombre}` — descargar adjunto específico
- `DELETE /api/solicitudes/{id}` — eliminar (sólo admin)
- `POST /api/solicitudes/manual` — creación manual desde el frontend

### Solicitudes (legado, sin cambios)
- `POST /api/solicitudes/` — crear con campos legados
- `GET  /api/solicitudes/` — listado paginado legado
- `GET  /api/solicitudes/{id}` — detalle (alias de `/detalle`)
- `POST /api/solicitudes/bulk-upload` — carga masiva Excel/CSV

### Outlook / Power Automate
- `POST /api/solicitudes/outlook` 🔑 (header `x-api-key`)

### Catálogos (lectura, cualquier usuario)
- `GET /api/catalogos/aseguradoras`
- `GET /api/catalogos/tipos-solicitud`
- `GET /api/catalogos/estados-solicitud`
- `GET /api/catalogos/prioridades`
- `GET /api/catalogos/ramos`
- `GET /api/catalogos/clientes`
- `GET /api/catalogos/tipos-operacion` (legacy)

### Admin (sólo admin)
- CRUD `/api/admin/tipos-solicitud`
- CRUD `/api/admin/estados-solicitud`
- CRUD `/api/admin/prioridades`
- CRUD `/api/admin/ramos`
- CRUD `/api/admin/aseguradoras`
- CRUD `/api/admin/clientes`
- CRUD `/api/admin/clientes-remitentes`

---

## Integración con Power Automate

Lee la guía completa en [`docs/POWER_AUTOMATE.md`](docs/POWER_AUTOMATE.md).

### Endpoint
```
POST {BASE_URL}/api/solicitudes/outlook
Headers:
  Content-Type: application/json
  x-api-key:    <POWER_AUTOMATE_API_KEY>
```

### Ejemplo de body
Ver [`docs/ejemplo_body_outlook.json`](docs/ejemplo_body_outlook.json).

### Prueba rápida con curl
```bash
curl -X POST http://localhost:8000/api/solicitudes/outlook \
  -H "Content-Type: application/json" \
  -H "x-api-key: cambia-esta-clave" \
  -d '{
    "remitente": "test@cliente.com",
    "asunto": "Renovación de póliza EPS - URGENTE",
    "cuerpo_correo": "Solicitamos renovación inmediata de la póliza...",
    "prioridad": "Alta"
  }'
```

### Probar desde Power Automate con ngrok (sin desplegar)

```bash
# Terminal 1 — backend
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — ngrok
ngrok http 8000
```

Usa la URL pública de ngrok (`https://abcd-1234.ngrok-free.app`) como `URI` en la acción HTTP de Power Automate.

---

## Modelo de Machine Learning

### Estado actual
El sistema usa una **lógica heurística temporal** que combina:
- palabras clave de urgencia en asunto/cuerpo
- prioridad asignada (Alta/Media/Baja)
- longitud del cuerpo

Aplica la regla del requerimiento:
```
si probabilidad > 0.70 → "Fuera de ANS"
si probabilidad ≤ 0.70 → "Dentro de ANS"
```

El umbral es configurable vía `PROBABILIDAD_UMBRAL_ANS` en `.env`.

### Integrar tu Random Forest

Cuando entrenes tu modelo Random Forest:

1. Coloca el `.pkl` en: `backend/app/ml/models/ans_model.pkl`.
2. Reinicia el backend.
3. El predictor lo cargará automáticamente.

El método `predict_simple(asunto, cuerpo, prioridad_nombre)` en `app/ml/predictor.py` mantiene un contrato estable: devuelve `{probabilidad, prediccion, modelo_version, tiempo_prediccion_ms}`. Cuando integres Random Forest, modifica el cuerpo de ese método para llamar a `self._model.predict_proba(features)` en vez de la heurística — el resto del sistema no necesita cambios.

---

## Niveles de Riesgo (visualización)

| Nivel | Color | Probabilidad | Descripción |
|---|---|:---:|---|
| **Bajo** | 🟢 Verde | < 40% | Cumplimiento seguro · Dentro de ANS |
| **Medio** | 🟡 Amarillo | 40% – 70% | Monitorear · Dentro de ANS |
| **Alto** | 🔴 Rojo | > 70% | Acción requerida · **Fuera de ANS** |

---

## Documentación adicional

- [`docs/POWER_AUTOMATE.md`](docs/POWER_AUTOMATE.md) — Configuración paso a paso
- [`docs/CAMBIOS_v2.md`](docs/CAMBIOS_v2.md) — Lista detallada de cambios respecto a v1.0
- [`docs/ejemplo_body_outlook.json`](docs/ejemplo_body_outlook.json) — Body JSON de ejemplo
- [`docs/train_model_colab.py`](docs/train_model_colab.py) — Script de entrenamiento (legado)

---

## Solución de problemas

### Error de conexión a PostgreSQL
```bash
sudo systemctl status postgresql       # Linux
pg_ctl status -D /var/lib/postgresql/data
```

### Error de CORS
Verifica `ALLOWED_ORIGINS` en `backend/.env`.

### Power Automate recibe 401
La `x-api-key` no coincide con `POWER_AUTOMATE_API_KEY` en `.env`.

### El cliente sale como "Pendiente de asignar"
El remitente del correo no está registrado. Ve a **Admin → Cliente · Remitente** y agrégalo.

### El frontend no muestra opciones admin
El usuario no tiene `role = 'admin'`. Crea uno con el endpoint de registro o actualiza el usuario en la BD.

### Puerto ya en uso
```bash
uvicorn app.main:app --reload --port 8001
npm start -- --port 4201
```
