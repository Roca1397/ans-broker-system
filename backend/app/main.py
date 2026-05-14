"""
ANS Broker System - FastAPI Backend
Gestión Predictiva de ANS para Brókers de Seguros
con integración Outlook (Power Automate).

REEMPLAZA: backend/app/main.py
"""
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import (
    auth, users, solicitudes, predicciones,
    catalogos, dashboard, alertas, admin,
)
from app.ml.predictor import predictor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 ANS Broker System iniciando...")

    # Asegurar carpeta de uploads
    Path(settings.UPLOADS_DIR).mkdir(parents=True, exist_ok=True)
    settings.emails_dir.mkdir(parents=True, exist_ok=True)

    # Crear tablas si no existen (en producción usar migraciones SQL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Base de datos conectada")

    # Cargar modelo ML (si existe .pkl, si no usa heurística)
    predictor.load_model(settings.MODEL_PATH)
    print("✅ Predictor inicializado")

    yield
    print("🛑 ANS Broker System apagándose...")
    await engine.dispose()


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ANS Broker System API",
    description=(
        "Sistema de Gestión Predictiva de ANS para Brókers de Seguros. "
        "Integración con Outlook vía Power Automate."
    ),
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Autenticación"])
app.include_router(users.router, prefix="/api/users", tags=["Usuarios"])
app.include_router(solicitudes.router, prefix="/api/solicitudes", tags=["Solicitudes"])
app.include_router(predicciones.router, prefix="/api/predicciones", tags=["Predicciones"])
app.include_router(catalogos.router, prefix="/api/catalogos", tags=["Catálogos"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(alertas.router, prefix="/api/alertas", tags=["Alertas"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "ANS Broker System", "version": "2.0.0"}
