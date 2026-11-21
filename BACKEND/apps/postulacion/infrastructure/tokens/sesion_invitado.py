"""
Token de la sesión de invitado del postulante (§13.3). JWT propio, NO el de los empleados.

Aislamiento frente al token de empleado (`dj_access`, simplejwt):
  1. Se firma con una clave DERIVADA (HMAC-SHA256 de la clave JWT del proyecto con una etiqueta fija; o la de
     `POSTULACION_JWT_SIGNING_KEY` si se define): un token de empleado no valida aquí y uno de postulante no
     valida en `CookieJWTAuthentication`, que es la autenticación de TODAS las vistas de personal.
  2. Lleva `typ='postulante'` e `iss` propios, y NO lleva `user_id` ni `token_type='access'`: aunque las claves
     coincidieran, simplejwt lo rechazaría.
  3. El `scope` es `expediente:<id>` y se compara contra la credencial en base de datos en cada petición.
"""
import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import jwt
from django.conf import settings

from apps.postulacion.domain.errores import SesionInvalida

TIPO_TOKEN = 'postulante'
EMISOR = 'gath.postulacion'
ALGORITMO = 'HS256'
_ETIQUETA_CLAVE = b'gath.postulacion.sesion-invitado.v1'


@dataclass(frozen=True)
class ClaimsInvitado:
    cedula: str
    expediente_id: str
    version_sesion: int
    expira_el: datetime


def _clave_firma() -> bytes:
    propia = getattr(settings, 'POSTULACION_JWT_SIGNING_KEY', None)
    if propia:
        return str(propia).encode()
    base = str(settings.SIMPLE_JWT['SIGNING_KEY']).encode()
    return hmac.new(base, _ETIQUETA_CLAVE, hashlib.sha256).digest()


def emitir_token_invitado(
    *, cedula: str, expediente_id: str, version_sesion: int, ahora: datetime, expira_el: datetime,
) -> str:
    return jwt.encode(
        {
            'iss': EMISOR, 'typ': TIPO_TOKEN, 'sub': cedula, 'scope': f'expediente:{expediente_id}',
            'ver': version_sesion, 'jti': uuid.uuid4().hex,
            'iat': int(ahora.timestamp()), 'exp': int(expira_el.timestamp()),
        },
        _clave_firma(), algorithm=ALGORITMO,
    )


def leer_token_invitado(token: str) -> ClaimsInvitado:
    """Valida firma, vigencia, emisor y clase. Cualquier defecto es `SesionInvalida` (mensaje genérico)."""
    try:
        datos = jwt.decode(
            token, _clave_firma(), algorithms=[ALGORITMO], issuer=EMISOR,
            options={'require': ['exp', 'iat', 'sub', 'iss']},
        )
        scope = str(datos.get('scope', ''))
        if datos.get('typ') != TIPO_TOKEN or not scope.startswith('expediente:'):
            raise ValueError('clase de token')
        return ClaimsInvitado(
            cedula=str(datos['sub']), expediente_id=scope.split(':', 1)[1], version_sesion=int(datos['ver']),
            expira_el=datetime.fromtimestamp(int(datos['exp']), tz=timezone.utc),
        )
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        raise SesionInvalida("La sesión venció o no es válida. Ingrese de nuevo con su cédula y contraseña.") from None
