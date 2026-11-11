"""Generación del código corto del QR con reintento ante colisión (restricción de unicidad)."""
from apps.carnetizacion.domain.value_objects.security_hash import generar_codigo_qr
from apps.carnetizacion.infrastructure.models.carnetizacion_models import CarnetEmitidoModel
from apps.carnetizacion.infrastructure.models.credencial_externa_model import CredencialExternaModel

_INTENTOS = 5


def codigo_qr_unico() -> str:
    """22 caracteres base64url que no existen aún ni como carnet ni como credencial externa."""
    for _ in range(_INTENTOS):
        codigo = generar_codigo_qr()
        if not (
            CarnetEmitidoModel.objects.filter(security_hash=codigo).exists()
            or CredencialExternaModel.objects.filter(security_hash=codigo).exists()
        ):
            return codigo
    raise RuntimeError('No se pudo generar un código QR único.')
