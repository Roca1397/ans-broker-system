"""
Configuración global. Se preservan las variables originales y se agregan:
  - POWER_AUTOMATE_API_KEY: clave compartida con Power Automate (header x-api-key)
  - UPLOADS_DIR: carpeta para archivos .eml y adjuntos

REEMPLAZA: backend/app/core/config.py
"""
from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path
import os

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:password@localhost:5432/ans_broker_db")
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MODEL_PATH: str = "./app/ml/models/ans_model.pkl"
    ALLOWED_ORIGINS: List[str] = [
    "http://localhost:4200",
    "https://slaguardian.vercel.app"]
    ENVIRONMENT: str = "development"

    # ── Integración Power Automate / Outlook ──────────────────────
    POWER_AUTOMATE_API_KEY: str = "change-this-power-automate-api-key"
    UPLOADS_DIR: str = "./uploads"
    EMAILS_SUBDIR: str = "emails"

    # ── ML ────────────────────────────────────────────────────────
    PROBABILIDAD_UMBRAL_ANS: float = 0.70  # > 70% = "Fuera de ANS"

    class Config:
        env_file = ".env"
        extra = "allow"

    @property
    def emails_dir(self) -> Path:
        p = Path(self.UPLOADS_DIR) / self.EMAILS_SUBDIR
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
