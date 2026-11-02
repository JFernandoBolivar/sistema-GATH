"""
Generador y validador de tokens seguros para recuperación de contraseña (C-2, S4, S5).

Utiliza `TimestampSigner` de Django con salt específico. El payload firmado
incluye los primeros 16 caracteres del hash actual de la contraseña del usuario:
en cuanto la contraseña se cambia, cualquier token generado previamente queda
invalidado inmediatamente (un solo uso, protección anti-replay).
La vigencia por defecto es de 15 minutos (900 segundos).
"""
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner

from core.domain.exceptions import ValidationError

SALT_RECUPERACION = 'gath-password-reset'
MAX_AGE_DEFAULT = 900  # 15 minutos en segundos


def generar_token_recuperacion(cuenta_id: int, cedula: str, password_hash: str) -> str:
    """Genera un token firmado con timestamp para recuperación de contraseña."""
    signer = TimestampSigner(salt=SALT_RECUPERACION)
    hash_slice = (password_hash or '')[:16]
    payload = f"{cuenta_id}:{cedula}:{hash_slice}"
    return signer.sign(payload)


def validar_token_recuperacion(token: str, max_age: int = MAX_AGE_DEFAULT) -> tuple[int, str, str]:
    """
    Valida la firma y vigencia del token de recuperación.
    Retorna una tupla (cuenta_id, cedula, hash_slice).
    Lanza ValidationError si ha expirado o la firma es inválida.
    """
    if not token or not isinstance(token, str):
        raise ValidationError('El token de recuperación es requerido.')

    signer = TimestampSigner(salt=SALT_RECUPERACION)
    try:
        data = signer.unsign(token, max_age=max_age)
    except SignatureExpired:
        raise ValidationError('El enlace de recuperación ha expirado. Por favor solicite uno nuevo.')
    except BadSignature:
        raise ValidationError('El enlace de recuperación es inválido o ya ha sido utilizado.')

    partes = data.split(':', 2)
    if len(partes) != 3:
        raise ValidationError('Formato de token de recuperación inválido.')

    try:
        cuenta_id = int(partes[0])
    except (ValueError, TypeError):
        raise ValidationError('Identificador de cuenta inválido en el token.')

    return cuenta_id, partes[1], partes[2]
