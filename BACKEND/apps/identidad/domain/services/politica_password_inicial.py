"""Política de la contraseña inicial (decisión F): es la cédula y solo sirve durante 7 días."""
from datetime import datetime, timedelta

DIAS_VIGENCIA_PASSWORD_INICIAL = 7
ROL_AUTOGESTION_ID = 3
MENSAJE_PASSWORD_INICIAL_VENCIDA = (
    'Su contraseña inicial venció. Use ¿Olvidó su contraseña? o pida a RRHH restablecer el acceso.'
)


def vencimiento_desde(ahora: datetime, dias: int = DIAS_VIGENCIA_PASSWORD_INICIAL) -> datetime:
    return ahora + timedelta(days=dias)


def es_correo_institucional(correo: str, dominio: str) -> bool:
    correo = (correo or '').strip().lower()
    dominio = (dominio or '').strip().lower().lstrip('@')
    return bool(dominio) and correo.endswith('@' + dominio)
