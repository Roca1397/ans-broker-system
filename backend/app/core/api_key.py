"""
Validación del header x-api-key utilizado por Power Automate
para autenticarse con el endpoint /api/solicitudes/outlook.

ARCHIVO NUEVO: backend/app/core/api_key.py
"""
from fastapi import Header, HTTPException, status
from typing import Optional
from app.core.config import settings


async def verify_api_key(x_api_key: Optional[str] = Header(None, alias="x-api-key")):
    """
    Dependency que valida la API key compartida con Power Automate.

    Power Automate debe enviar:
        Headers:
            x-api-key: <POWER_AUTOMATE_API_KEY>
    """
    if not x_api_key or x_api_key != settings.POWER_AUTOMATE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida o ausente. Header 'x-api-key' requerido.",
        )
    return True
