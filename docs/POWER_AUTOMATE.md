# Integración con Power Automate / Outlook

Esta guía explica cómo conectar Power Automate (Microsoft 365) al backend
del ANS Broker System para que las solicitudes que lleguen por correo a
Outlook se registren automáticamente en el sistema.

---

## Arquitectura

```
┌──────────────┐    ┌──────────────────┐    ┌─────────────────────┐    ┌──────────────┐
│   Outlook    │───▶│  Power Automate  │───▶│    FastAPI Backend   │───▶│  PostgreSQL  │
│  (correo)    │    │  (flujo HTTP)    │    │  POST /api/...       │    │              │
└──────────────┘    └──────────────────┘    └─────────────────────┘    └──────────────┘
                                                       │
                                                       ▼
                                                ┌────────────┐
                                                │ /uploads/  │
                                                │  emails/   │  (archivos .eml)
                                                └────────────┘
```

---

## 1. Endpoint del backend

```
POST {BASE_URL}/api/solicitudes/outlook
Headers:
  Content-Type: application/json
  x-api-key:    <POWER_AUTOMATE_API_KEY>   (definida en backend/.env)
```

Si la `x-api-key` falla → **HTTP 401 Unauthorized**.

### Body JSON esperado

```json
{
  "remitente": "juan.perez@cliente.com",
  "asunto": "Inclusión de asegurados - Empresa ABC SAC",
  "cuerpo_correo": "Estimados, solicitamos la inclusión de los siguientes trabajadores...\nGracias.",
  "fecha_recepcion": "2026-05-08T14:30:00Z",
  "prioridad": "Alta",
  "adjuntos": [
    {
      "filename": "lista_asegurados.xlsx",
      "content_base64": "UEsDBBQAAAAIA...",
      "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
  ],
  "eml_base64": "UmVjZWl2ZWQ6IGZyb20...",
  "eml_filename": "correo_2026_05_08_143000.eml"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `remitente` | string (email) | ✅ | Correo del remitente |
| `asunto` | string | ✅ | Asunto del correo |
| `cuerpo_correo` | string | ❌ | Cuerpo en texto plano |
| `fecha_recepcion` | datetime ISO | ❌ | Si se omite, se usa la hora del servidor |
| `prioridad` | string | ❌ | "Alta" \| "Media" \| "Baja" |
| `adjuntos` | array | ❌ | Cada uno con `filename` + `content_base64` |
| `eml_base64` | string | ❌ | El correo completo exportado como `.eml` (recomendado) |
| `eml_filename` | string | ❌ | Nombre sugerido para el archivo |

### Respuesta JSON (201 Created)

```json
{
  "ok": true,
  "id": "f7c1b2a3-...",
  "nro_ticket": "NT2026001",
  "cliente": "Empresa ABC SAC",
  "tipo_solicitud": "Inclusión",
  "aseguradora": "Rimac Seguros",
  "ramo": "EPS",
  "prediccion": "Fuera de ANS",
  "probabilidad": 0.78,
  "mensaje": "Solicitud registrada correctamente desde Outlook."
}
```

---

## 2. Configuración paso a paso en Power Automate

### Requisitos previos
1. Cuenta de Microsoft 365 con licencia de Power Automate.
2. La cuenta de Outlook donde llegarán los correos.
3. Backend desplegado en una URL pública (o expuesto vía ngrok para pruebas locales).

### Paso 1. Crear el flujo
1. Ve a [https://make.powerautomate.com](https://make.powerautomate.com).
2. Click en **"Crear" → "Flujo de nube automatizado"**.
3. Nombre: `ANS Broker - Correos entrantes`.
4. Trigger: busca y selecciona **"Cuando llega un nuevo correo electrónico (V3)"** (Office 365 Outlook).

### Paso 2. Configurar el trigger
| Campo | Valor sugerido |
|---|---|
| **Carpeta** | `Inbox` (o subcarpeta dedicada, ej. `Solicitudes ANS`) |
| **Importancia** | Cualquiera |
| **Sólo con archivos adjuntos** | No |
| **Incluir datos adjuntos** | **Sí** ✅ |
| **De** | (vacío) o filtra por dominio |
| **Asunto contiene** | (vacío) o palabras clave |

### Paso 3. (Opcional) Exportar el correo como .eml
Algunas regiones tienen disponible la acción **"Exportar mensaje de correo"** (Office 365 Outlook). Si está disponible:
- Acción: **`Exportar mensaje de correo`**
- ID del mensaje: `Id del correo` (del trigger)

Si no está disponible en tu tenant, puedes saltarte este paso (el sistema funciona igual, sólo no tendrás el .eml descargable).

### Paso 4. Componer el body JSON
Agrega una acción **"Redactar"** (`Compose`) con el siguiente JSON:

```json
{
  "remitente": "@{triggerOutputs()?['body/From']}",
  "asunto": "@{triggerOutputs()?['body/Subject']}",
  "cuerpo_correo": "@{triggerOutputs()?['body/Body']}",
  "fecha_recepcion": "@{triggerOutputs()?['body/DateTimeReceived']}",
  "prioridad": "@{if(equals(triggerOutputs()?['body/Importance'],'high'),'Alta',if(equals(triggerOutputs()?['body/Importance'],'low'),'Baja','Media'))}",
  "eml_base64": "@{base64(outputs('Exportar_mensaje_de_correo')?['body'])}",
  "eml_filename": "@{triggerOutputs()?['body/Subject']}.eml",
  "adjuntos": @{body('Seleccionar')}
}
```

#### Paso 4.b — Mapeo de adjuntos con `Select`
- Acción: **Seleccionar** (`Select`)
- **De:** `@triggerOutputs()?['body/Attachments']`
- **Mapa:** modo "Texto":

```json
{
  "filename": "@{item()?['Name']}",
  "content_base64": "@{item()?['ContentBytes']}",
  "content_type": "@{item()?['ContentType']}"
}
```

### Paso 5. HTTP POST al backend
Acción **"HTTP"** (categoría "Solicitud HTTP"):

| Campo | Valor |
|---|---|
| **Método** | `POST` |
| **URI** | `https://TU-BACKEND/api/solicitudes/outlook` |
| **Headers** | `Content-Type: application/json` <br> `x-api-key: tu-api-key-secreta` |
| **Body** | La salida de la acción "Redactar" del paso 4 |

### Paso 6. Probar
1. Guarda el flujo.
2. Envía un correo de prueba a la cuenta de Outlook.
3. En Power Automate verás "Ejecuciones" con el resultado.

---

## 3. Pruebas en local con ngrok

### Paso 1. Levantar el backend localmente
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Paso 2. Levantar ngrok
```bash
# Descarga ngrok desde https://ngrok.com/download
ngrok http 8000
```

ngrok te dará una URL pública: `https://abcd-1234.ngrok-free.app`

### Paso 3. Usar esa URL en Power Automate
En la acción HTTP del flujo, pon como URI:
```
https://abcd-1234.ngrok-free.app/api/solicitudes/outlook
```

### Paso 4. Probar con curl
```bash
curl -X POST https://abcd-1234.ngrok-free.app/api/solicitudes/outlook \
  -H "Content-Type: application/json" \
  -H "x-api-key: tu-api-key-secreta" \
  -d '{
    "remitente": "test@cliente.com",
    "asunto": "Renovación de póliza EPS - Empresa Demo",
    "cuerpo_correo": "Estimados, solicitamos la renovación...",
    "prioridad": "Alta"
  }'
```

Respuesta esperada: `201 Created` con `nro_ticket: "NT2026001"`.

---

## 4. Lógica del backend al recibir un correo

1. Valida la `x-api-key`. Si es inválida → **401**.
2. Genera el `nro_ticket` único: `NT{AÑO}{correlativo}` (ej. `NT2026001`).
3. Busca el remitente en la tabla `clientes_remitentes`:
   - Si existe → completa `cliente`, `aseguradora_id`, `ramo_id` automáticamente.
   - Si no existe → `cliente = "Pendiente de asignar"`.
4. Detecta el `tipo_solicitud` analizando el asunto con regex (`inclusión`, `exclusión`, `renovación`, `emisión`).
5. Calcula la predicción ML (heurística temporal). Si `probabilidad > 0.70` → "Fuera de ANS".
6. Persiste el `.eml` en `backend/uploads/emails/{nro_ticket}_{uuid}_{filename}.eml`.
7. Persiste cada adjunto en `backend/uploads/emails/{nro_ticket}/`.
8. Guarda la solicitud en PostgreSQL con `estado = "Pendiente"` y `fuente = "outlook"`.
9. Devuelve la respuesta JSON.

---

## 5. Configurar la asociación cliente ↔ remitente

Para que el sistema autocomplete el cliente al recibir un correo:

1. Inicia sesión como **admin**.
2. Menú lateral → **Administración → Cliente · Remitente**.
3. Click en **"+ Agregar"** y completa:
   - Cliente: `Empresa ABC SAC`
   - Remitente: `juan.perez@empresaabc.com`
   - Aseguradora: `Rimac Seguros`
   - Ramo: `EPS`
4. Guarda.

A partir de ahora, cualquier correo de `juan.perez@empresaabc.com` será asignado automáticamente al cliente `Empresa ABC SAC` con aseguradora Rimac y ramo EPS.

---

## 6. Variables de entorno relevantes

En `backend/.env`:

```env
POWER_AUTOMATE_API_KEY=tu-api-key-secreta
UPLOADS_DIR=./uploads
PROBABILIDAD_UMBRAL_ANS=0.70
```

> **Importante:** la `POWER_AUTOMATE_API_KEY` debe coincidir EXACTAMENTE con
> el valor del header `x-api-key` en Power Automate.
> Usa una clave aleatoria larga (mínimo 32 caracteres).

---

## 7. Troubleshooting

| Problema | Solución |
|---|---|
| **401 Unauthorized** | La `x-api-key` no coincide. Verifica el header en Power Automate y la variable en `.env`. |
| **422 Unprocessable Entity** | Falta algún campo obligatorio (`remitente`, `asunto`). |
| **El cliente sale como "Pendiente de asignar"** | El remitente no está registrado. Agrégalo en `Admin → Cliente · Remitente`. |
| **No detecta el tipo_solicitud** | El asunto no contiene la palabra clave. Edita manualmente desde el panel lateral. |
| **El .eml no se descarga** | Verifica que `backend/uploads/emails/` exista y tenga permisos de escritura. |
| **CORS en el frontend** | Asegúrate de que `ALLOWED_ORIGINS` incluye tu dominio del frontend. |
