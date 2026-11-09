"""
Modelo base abstracto del kernel (parte de B2.1 / convención de la skill
`arquitectura-onion-feature-scream`).

Todo modelo ORM nuevo de `core/` y de los módulos de dominio hereda de
`BaseModel` para compartir clave primaria UUID y timestamps de auditoría básica.
"""
import time
import uuid

from django.db import models


def uuid7() -> uuid.UUID:
    """
    Genera un UUID versión 7 (ordenable por tiempo, RFC 9562).

    Implementación mínima sin dependencia externa: no hay paquete `uuid7`/`uuid6`
    en `requirements.txt` (BACKEND/requirements.txt). Si en el futuro se añade
    una librería dedicada, este helper se reemplaza sin tocar los llamadores.
    """
    unix_ts_ms = int(time.time() * 1000)
    rand_bytes = uuid.uuid4().bytes[6:]

    ts_bytes = unix_ts_ms.to_bytes(6, byteorder='big')
    version_and_rand_a = bytes([0x70 | (rand_bytes[0] & 0x0F), rand_bytes[1]])
    variant_and_rand_b = bytes([0x80 | (rand_bytes[2] & 0x3F)]) + rand_bytes[3:]

    return uuid.UUID(bytes=ts_bytes + version_and_rand_a + variant_and_rand_b)


class BaseModel(models.Model):
    """Clave primaria UUIDv7 + timestamps. Abstracta: no crea tabla propia."""

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
