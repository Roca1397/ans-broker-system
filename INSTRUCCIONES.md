# Cómo aplicar este Patch v2.0 sobre tu proyecto v1.0

Este paquete contiene **únicamente** los archivos que cambian respecto a la
versión 1.0 del ANS Broker System. Para aplicar la actualización:

---

## 📦 Contenido del paquete

```
ans-broker-system-v2-patch/
├── README.md                              ← documentación principal v2.0
├── INSTRUCCIONES.md                       ← este archivo
├── docker-compose.yml                     ← (REEMPLAZA el original)
├── backend/
│   ├── .env.example                       ← (REEMPLAZA el original)
│   ├── app/
│   │   ├── main.py                        ← (REEMPLAZA)
│   │   ├── core/
│   │   │   ├── config.py                  ← (REEMPLAZA)
│   │   │   └── api_key.py                 ← NUEVO
│   │   ├── models/solicitud.py            ← (REEMPLAZA)
│   │   ├── schemas/schemas.py             ← (REEMPLAZA)
│   │   ├── routers/
│   │   │   ├── solicitudes.py             ← (REEMPLAZA)
│   │   │   ├── catalogos.py               ← (REEMPLAZA)
│   │   │   └── admin.py                   ← NUEVO
│   │   ├── services/
│   │   │   ├── __init__.py                ← NUEVO
│   │   │   └── outlook_service.py         ← NUEVO
│   │   └── ml/predictor.py                ← (REEMPLAZA)
│   ├── migrations/
│   │   └── 002_outlook_integration.sql    ← NUEVO
│   └── uploads/emails/                    ← NUEVO (carpeta vacía para .eml)
├── frontend/
│   └── src/
│       ├── styles.scss                    ← (REEMPLAZA)
│       └── app/
│           ├── app.routes.ts              ← (REEMPLAZA)
│           ├── models/models.ts           ← (REEMPLAZA)
│           ├── services/
│           │   ├── auth.service.ts        ← (REEMPLAZA)
│           │   └── api.service.ts         ← (REEMPLAZA)
│           ├── guards/admin.guard.ts      ← NUEVO
│           ├── shared/layout/layout.component.ts ← (REEMPLAZA)
│           ├── solicitudes/lista/lista.component.ts ← (REEMPLAZA)
│           └── admin/                     ← NUEVA CARPETA
│               ├── clientes-remitentes/clientes-remitentes.component.ts
│               └── catalogos/catalogos.component.ts
└── docs/
    ├── POWER_AUTOMATE.md                  ← guía de Power Automate
    ├── CAMBIOS_v2.md                      ← lista detallada de cambios
    └── ejemplo_body_outlook.json          ← body de ejemplo
```

> Los archivos NO incluidos aquí (Dockerfile, requirements.txt, package.json,
> auth.guard.ts, login/register/dashboard/nueva/carga-masiva/predicciones, etc.)
> **NO requieren cambios** — déjalos tal como están.

---

## 🚀 Paso a paso para aplicar el patch

### Opción A — Recomendado (sobre v1.0 ya funcionando)

```bash
# 1. Backup por seguridad
cd ~/ruta/a/ans-broker-system    # tu proyecto v1.0
cp -r . ../ans-broker-system-backup
pg_dump -U postgres ans_broker_db > ../ans-broker-backup-v1.sql

# 2. Copiar los archivos del patch encima del proyecto
cp -r /ruta/al/ans-broker-system-v2-patch/. .

# 3. Actualizar variables de entorno
cd backend
cp .env .env.bak                # backup del .env actual
# Edita el .env y AGREGA estas líneas (sin tocar las existentes):
echo "" >> .env
echo "POWER_AUTOMATE_API_KEY=$(openssl rand -hex 32)" >> .env
echo "UPLOADS_DIR=./uploads" >> .env
echo "EMAILS_SUBDIR=emails" >> .env
echo "PROBABILIDAD_UMBRAL_ANS=0.70" >> .env

# 4. Aplicar migración SQL
psql -U postgres -d ans_broker_db -f migrations/002_outlook_integration.sql

# 5. Crear carpeta para .eml
mkdir -p uploads/emails

# 6. Reiniciar backend (NO requiere npm install ni pip install adicional)
uvicorn app.main:app --reload --port 8000

# 7. Reiniciar frontend
cd ../frontend
npm start
```

### Opción B — Con Docker (proyecto en limpio)

```bash
# 1. Copiar los archivos del patch sobre tu proyecto
cp -r /ruta/al/ans-broker-system-v2-patch/. /ruta/a/ans-broker-system/

# 2. Levantar todo
cd /ruta/a/ans-broker-system
docker-compose down -v          # ⚠️ -v borra los datos de BD; sólo si es entorno limpio
docker-compose up -d
docker-compose logs -f backend
```

### Opción C — Producción (BD con datos críticos)

```bash
# 1. Backup obligatorio
pg_dump -U postgres ans_broker_db > backup_v1_$(date +%Y%m%d_%H%M%S).sql

# 2. Aplicar SOLO la migración nueva (NO ejecutar 001_init.sql otra vez)
psql -U postgres -d ans_broker_db -f backend/migrations/002_outlook_integration.sql

# 3. Sobrescribir archivos de aplicación
cp -r ans-broker-system-v2-patch/. /opt/ans-broker-system/

# 4. Configurar nuevas vars en .env
nano /opt/ans-broker-system/backend/.env
# Agrega:
#   POWER_AUTOMATE_API_KEY=<llave-secreta-larga>
#   UPLOADS_DIR=/var/lib/ans-uploads
#   PROBABILIDAD_UMBRAL_ANS=0.70

# 5. Crear carpeta de uploads con permisos
mkdir -p /var/lib/ans-uploads/emails
chown -R appuser:appuser /var/lib/ans-uploads

# 6. Reiniciar servicios
systemctl restart ans-backend
# o si usas docker:
docker-compose restart backend
```

---

## ✅ Verificación post-instalación

### 1. Backend arrancó correctamente
```bash
curl http://localhost:8000/api/health
# {"status":"ok","service":"ANS Broker System","version":"2.0.0"}
```

### 2. Migración SQL aplicada
```bash
psql -U postgres -d ans_broker_db -c "\dt"
# Deberías ver las tablas nuevas:
#   tipos_solicitud, estados_solicitud, prioridades, ramos,
#   clientes, clientes_remitentes
```

### 3. Catálogos seed cargados
```bash
psql -U postgres -d ans_broker_db -c "SELECT * FROM tipos_solicitud;"
# Deberías ver: Inclusión, Exclusión, Renovación, Emisión
```

### 4. Frontend muestra el nuevo layout
- Inicia sesión.
- El sidebar debe tener fondo azul corporativo en su cabecera.
- Si tu usuario es admin, deberías ver la sección "Administración" con
  los enlaces "Cliente · Remitente" y "Catálogos".

### 5. El endpoint de Outlook responde
```bash
curl -X POST http://localhost:8000/api/solicitudes/outlook \
  -H "Content-Type: application/json" \
  -H "x-api-key: <TU-API-KEY-DEL-ENV>" \
  -d '{
    "remitente": "test@cliente.com",
    "asunto": "Renovación de póliza - URGENTE",
    "cuerpo_correo": "Solicitamos la renovación inmediata...",
    "prioridad": "Alta"
  }'
# Debe responder 201 con un nro_ticket NT2026XXX
```

---

## ⚠️ Compatibilidad con datos existentes

- **Solicitudes v1.0**: siguen funcionando intactas.
- **Migración 002**: idempotente — puede ejecutarse varias veces sin error.
- Todos los campos antiguos de `solicitudes` siguen existiendo (con NULL permitido para los obligatorios anteriores).
- Los endpoints legados (`POST /api/solicitudes/`, `GET /api/solicitudes/`, `/bulk-upload`) se preservan.

Las solicitudes antiguas:
- No tendrán `nro_ticket` (ese campo aparecerá vacío).
- Mantendrán su `numero_solicitud` legado.
- Aparecerán en la nueva lista SharePoint sin tipo/estado del nuevo catálogo.
- Puedes editarlas desde el panel lateral para asignarles los nuevos campos.

---

## 📚 Documentación adicional

- `README.md` — manual completo del sistema v2.0
- `docs/POWER_AUTOMATE.md` — guía paso a paso de Power Automate (con ngrok)
- `docs/CAMBIOS_v2.md` — lista detallada de archivos nuevos / modificados / preservados
- `docs/ejemplo_body_outlook.json` — body JSON de ejemplo para pruebas

---

## ❓ Preguntas frecuentes

**P: ¿Necesito reinstalar npm o pip packages?**
R: No. Los `package.json` y `requirements.txt` no cambiaron.

**P: ¿Qué pasa si ya tengo solicitudes con datos viejos?**
R: Siguen funcionando intactas. Aparecen en la lista nueva con los campos nuevos vacíos.

**P: ¿Cómo creo un usuario admin?**
R: Si no tienes uno, regístralo con:
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@broker.com","full_name":"Admin","password":"password123","role":"admin"}'
```
O actualiza un usuario existente:
```bash
psql -U postgres -d ans_broker_db -c "UPDATE users SET role='admin' WHERE email='tu@email.com';"
```

**P: ¿Cómo deshago el patch si algo sale mal?**
R: Restaura el backup:
```bash
rm -rf /ruta/proyecto
mv /ruta/proyecto-backup /ruta/proyecto
psql -U postgres -d ans_broker_db < backup_v1.sql
```
