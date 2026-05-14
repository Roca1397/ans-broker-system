# Cambios de v1.0 → v2.0

Lista detallada de archivos creados, modificados y conservados respecto al proyecto original.

---

## 🆕 Archivos NUEVOS

### Backend
| Archivo | Descripción |
|---|---|
| `backend/app/core/api_key.py` | Dependency `verify_api_key` que valida el header `x-api-key` para Power Automate |
| `backend/app/services/__init__.py` | Paquete de servicios |
| `backend/app/services/outlook_service.py` | Generación de `nro_ticket`, detección de tipo por asunto, persistencia de `.eml` y adjuntos |
| `backend/app/routers/admin.py` | CRUD completo de catálogos, clientes y asociaciones cliente-remitente (sólo admin) |
| `backend/migrations/002_outlook_integration.sql` | Migración SQL incremental e idempotente |
| `backend/uploads/emails/` | Carpeta para almacenar correos `.eml` y adjuntos |

### Frontend
| Archivo | Descripción |
|---|---|
| `frontend/src/app/guards/admin.guard.ts` | Guard que restringe rutas de admin |
| `frontend/src/app/admin/clientes-remitentes/clientes-remitentes.component.ts` | Pantalla CRUD de asociaciones cliente ↔ remitente |
| `frontend/src/app/admin/catalogos/catalogos.component.ts` | Pantalla CRUD de todos los catálogos con tabs |

### Documentación
| Archivo | Descripción |
|---|---|
| `docs/POWER_AUTOMATE.md` | Guía completa de configuración de Power Automate |
| `docs/ejemplo_body_outlook.json` | Body JSON de ejemplo para enviar al endpoint Outlook |
| `docs/CAMBIOS_v2.md` | Este archivo |

---

## ✏️ Archivos MODIFICADOS

### Backend

#### `backend/app/main.py`
- Incluye el nuevo router `admin`
- Crea `UPLOADS_DIR/emails/` al iniciar
- Llama a `predictor.load_model(settings.MODEL_PATH)` en el startup
- Versión bumped a 2.0.0

#### `backend/app/core/config.py`
- Agregadas: `POWER_AUTOMATE_API_KEY`, `UPLOADS_DIR`, `EMAILS_SUBDIR`, `PROBABILIDAD_UMBRAL_ANS`
- Property `emails_dir` que crea/devuelve el path

#### `backend/app/models/solicitud.py`
- **Solicitud** (extendida, sin breaking changes):
  - Nuevos campos: `nro_ticket`, `cliente`, `remitente`, `asunto`, `cuerpo_correo`, `fecha_recepcion`, `fecha_finalizado`, `datos_adjuntos`, `probabilidad`, `prediccion`, `comentarios`
  - Nuevos FK: `tipo_solicitud_id`, `estado_id`, `prioridad_id`, `ramo_id`
  - Campos legados (`numero_solicitud`, `fecha_ingreso`, `cantidad_asegurados`, etc.) ahora son nullable
  - Renombrada relación `prediccion` → `prediccion_rel` (porque ahora hay una columna `prediccion` string)
- **Aseguradora**: agregadas `activo` y `updated_at` (alias para compatibilidad)
- **Nuevos modelos**: `TipoSolicitud`, `EstadoSolicitud`, `Prioridad`, `Ramo`, `Cliente`, `ClienteRemitente`

#### `backend/app/schemas/schemas.py`
- Schemas legados preservados intactos
- Nuevos schemas:
  - `OutlookSolicitudIn`, `OutlookSolicitudOut`, `AdjuntoIn`
  - `SolicitudListItem`, `SolicitudDetail`, `SolicitudUpdate`, `SolicitudCreateManual`
  - `CatalogoCreate`, `CatalogoUpdate`, `CatalogoOut`
  - `AseguradoraCreate`, `AseguradoraUpdate`
  - `ClienteCreate`, `ClienteUpdate`, `ClienteOut`
  - `ClienteRemitenteCreate`, `ClienteRemitenteUpdate`, `ClienteRemitenteOut`
  - `ComentarioAdd`

#### `backend/app/routers/solicitudes.py`
- **Nuevos endpoints**:
  - `POST /outlook` (con `x-api-key`) — entrada de Power Automate
  - `GET /lista` — listado SharePoint-like con filtros y orden
  - `GET /{id}/detalle` — detalle completo (panel lateral)
  - `PATCH /{id}` — editar campos permitidos
  - `POST /{id}/comentario` — agregar comentario
  - `GET /{id}/adjunto` — descargar primer .eml
  - `GET /{id}/adjuntos/{nombre}` — descargar adjunto específico
  - `DELETE /{id}` — eliminar (admin only)
  - `POST /manual` — creación manual desde frontend
- **Endpoints legados preservados**: `POST /`, `GET /`, `GET /{id}`, `POST /bulk-upload`

#### `backend/app/routers/catalogos.py`
- Nuevos endpoints públicos: `tipos-solicitud`, `estados-solicitud`, `prioridades`, `ramos`, `clientes`
- Mantiene: `aseguradoras`, `tipos-operacion`

#### `backend/app/ml/predictor.py`
- Mantiene la interfaz legada `predict(data)` para carga masiva
- **Nuevo método**: `predict_simple(asunto, cuerpo, prioridad_nombre, umbral)` — heurística temporal
- Implementa la regla `probabilidad > 0.70 → "Fuera de ANS"`
- Estructura preparada para reemplazar la heurística por Random Forest entrenado

#### `backend/.env.example`
- Agregadas: `POWER_AUTOMATE_API_KEY`, `UPLOADS_DIR`, `EMAILS_SUBDIR`, `PROBABILIDAD_UMBRAL_ANS`

#### `docker-compose.yml`
- Incluye automáticamente `002_outlook_integration.sql`
- Volumen `ans_uploads` para persistir los `.eml` entre reinicios
- Variables de entorno extendidas

### Frontend

#### `frontend/src/app/services/auth.service.ts`
- Agregado método `isAdmin()` y signal computado `isAdminSig`

#### `frontend/src/app/services/api.service.ts`
- **`SolicitudesService` extendido**:
  - `listarSharepoint(params)` — listado con filtros nuevos
  - `detalle(id)` — detalle completo
  - `actualizar(id, data)` — PATCH de campos permitidos
  - `agregarComentario(id, comentario)`
  - `eliminar(id)`
  - `crearManual(data)`
  - `descargarAdjunto(id)`, `descargarAdjuntoPorNombre(id, nombre)`
  - URLs helpers: `urlAdjunto(id)`, `urlAdjuntoPorNombre(id, nombre)`
- **`CatalogosService` extendido**: `getTiposSolicitud()`, `getEstadosSolicitud()`, `getPrioridades()`, `getRamos()`, `getClientes()`
- **Nuevo `AdminService`**: CRUD genérico para catálogos, clientes, aseguradoras y asociaciones

#### `frontend/src/app/models/models.ts`
- Nuevos tipos: `SolicitudListItem`, `SolicitudDetail`, `SolicitudUpdate`, `CatalogoItem`, `Cliente`, `ClienteRemitente`, `AdjuntoMeta`
- `Solicitud` y `Aseguradora` extendidas

#### `frontend/src/app/app.routes.ts`
- Nuevas rutas (con `adminGuard`):
  - `/admin/clientes-remitentes`
  - `/admin/catalogos`

#### `frontend/src/app/shared/layout/layout.component.ts`
- Restyle visual completo con paleta corporativa (azul + dorado)
- Sección "Administración" en sidebar visible sólo para admins
- Header del sidebar ahora con fondo azul corporativo

#### `frontend/src/app/solicitudes/lista/lista.component.ts`
- **Reemplazo completo**: nuevo diseño tipo SharePoint con:
  - Tarjetas de resumen de riesgo (verde/amarillo/rojo)
  - Filtros múltiples (estado, prioridad, aseguradora, ramo, predicción)
  - Orden por: recientes / mayor riesgo / prioridad / estado
  - Barra de riesgo visual en cada fila
  - Panel lateral animado al hacer clic
  - Edición inline de campos
  - Comentarios con timestamp
  - Descarga de adjuntos
  - Indicador de adjuntos en la tabla

#### `frontend/src/styles.scss`
- Paleta nueva: variables `--primary` (#0d2c54 azul corporativo), `--accent` (#f5c542 dorado)
- Fuente principal cambiada a Inter (más profesional)
- Sistema de buttons, badges, tablas, alerts actualizado
- Theme claro (light) en lugar del dark theme anterior

---

## ✅ Archivos PRESERVADOS sin cambios

### Backend
- `backend/Dockerfile`
- `backend/requirements.txt`
- `backend/app/__init__.py`
- `backend/app/core/__init__.py`
- `backend/app/core/database.py`
- `backend/app/core/security.py`
- `backend/app/models/__init__.py`
- `backend/app/models/user.py`
- `backend/app/schemas/__init__.py`
- `backend/app/routers/__init__.py`
- `backend/app/routers/auth.py`
- `backend/app/routers/users.py`
- `backend/app/routers/predicciones.py`
- `backend/app/routers/dashboard.py`
- `backend/app/routers/alertas.py`
- `backend/app/ml/__init__.py`
- `backend/migrations/001_init.sql`

### Frontend
- `frontend/angular.json`
- `frontend/package.json`
- `frontend/proxy.conf.json`
- `frontend/tsconfig.json`
- `frontend/tsconfig.app.json`
- `frontend/src/main.ts`
- `frontend/src/index.html`
- `frontend/src/environments/environment.ts`
- `frontend/src/app/app.component.ts`
- `frontend/src/app/app.config.ts`
- `frontend/src/app/auth/login/login.component.ts`
- `frontend/src/app/auth/register/register.component.ts`
- `frontend/src/app/dashboard/dashboard.component.ts`
- `frontend/src/app/guards/auth.guard.ts`
- `frontend/src/app/interceptors/auth.interceptor.ts`
- `frontend/src/app/solicitudes/nueva/nueva.component.ts`
- `frontend/src/app/solicitudes/carga-masiva/carga-masiva.component.ts`
- `frontend/src/app/solicitudes/predicciones/predicciones.component.ts`

---

## ⚠️ Compatibilidad

- **Modelo de datos**: 100% retro-compatible. Todos los campos antiguos siguen existiendo (con NULL permitido).
- **Endpoints legados**: preservados, no se rompió ninguno (`POST /api/solicitudes/`, `GET /api/solicitudes/`, `/bulk-upload`, etc.).
- **Migración 002**: idempotente. Puede ejecutarse en una BD existente con datos sin perder nada. Sólo agrega columnas y tablas.
- **Usuarios existentes**: siguen funcionando. La columna `role` ya existía con valores `admin`/`user`/`analyst`.

---

## 🔄 Pasos de migración para una instalación existente

Si ya tenías el sistema v1.0 corriendo:

```bash
# 1. Backup por si acaso
pg_dump -U postgres ans_broker_db > backup_v1.sql

# 2. Aplicar la migración incremental
psql -U postgres -d ans_broker_db -f backend/migrations/002_outlook_integration.sql

# 3. Configurar nuevas variables de entorno
echo "POWER_AUTOMATE_API_KEY=$(openssl rand -hex 32)" >> backend/.env
echo "UPLOADS_DIR=./uploads" >> backend/.env
echo "PROBABILIDAD_UMBRAL_ANS=0.70" >> backend/.env

# 4. Crear carpeta de uploads
mkdir -p backend/uploads/emails

# 5. Reiniciar backend y frontend
# Backend: pip install -r requirements.txt (sin cambios) y reiniciar uvicorn
# Frontend: npm install (sin cambios) y reiniciar npm start
```

Tus solicitudes existentes seguirán funcionando. Las solicitudes antiguas:
- No tendrán `nro_ticket` (campo NULL)
- Mantendrán `numero_solicitud` (formato `SOL-YYYYMMDD-XXXXXX`)
- Aparecerán en la lista SharePoint sin tipo/estado del nuevo catálogo
- Puedes editarlas desde el panel lateral para asignarles los nuevos catálogos
