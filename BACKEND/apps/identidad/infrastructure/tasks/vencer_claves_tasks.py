"""
Tarea de arranque S2-02: vence la clave inicial de las cuentas antiguas.

Se ejecuta sola tras el despliegue: el arranque del contenedor la encola
(`docker-entrypoint.sh` → `manage.py vencer_claves_iniciales_antiguas --encolar`)
y, como red de seguridad, el *beat* la reintenta cada 15 minutos hasta que
termine. Corre en el worker porque revisar ~1000 hashes tarda minutos y no debe
bloquear a gunicorn.

Garantías:
- **Una sola vez**: marca persistente `identidad_ejecucion_unica`; solo se escribe
  cuando la pasada termina bien (si algo falla, se reintenta).
- **Sin carreras**: candado en la caché (Redis en el despliegue) para que dos
  ejecuciones no se solapen; caduca solo, por si el worker muere a mitad.
"""
import logging

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from apps.identidad.application.use_cases.vencer_claves_iniciales import (
    vencer_claves_iniciales_antiguas,
)
from apps.identidad.infrastructure.repositories.repo_ejecucion_unica_orm import (
    marcar_ejecutada,
    ya_ejecutada,
)
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.configuracion.infrastructure.lector_configuracion import LectorConfiguracionORM

logger = logging.getLogger('gath.identidad')

CLAVE_EJECUCION = 'vencer_claves_iniciales_antiguas'
CANDADO = 'identidad:lock:vencer_claves_iniciales_antiguas'
# Si el worker muere a mitad, el candado caduca y la siguiente pasada reintenta.
CANDADO_SEGUNDOS = 2 * 60 * 60


def encolar_si_falta() -> bool:
    """Encola la tarea si no se ejecutó nunca. Se llama desde el arranque.

    `retry=False`: si el broker aún no está listo, falla en el acto en vez de
    dejar el arranque esperando; el beat la reintenta más tarde.
    Devuelve `True` solo si esta llamada encoló la tarea.
    """
    if ya_ejecutada(CLAVE_EJECUCION):
        return False
    vencer_claves_iniciales_antiguas_tarea.apply_async(retry=False)
    return True


@shared_task(name='identidad.vencer_claves_iniciales_antiguas', acks_late=True)
def vencer_claves_iniciales_antiguas_tarea() -> str:
    """Recorre las cuentas antiguas y les emite el vencimiento (idempotente)."""
    if ya_ejecutada(CLAVE_EJECUCION):
        return 'ya ejecutada'
    if not cache.add(CANDADO, timezone.now().isoformat(), timeout=CANDADO_SEGUNDOS):
        return 'en curso'

    try:
        resultado = vencer_claves_iniciales_antiguas(
            RepoPasswordInicialORM(),
            LectorConfiguracionORM(),
            ahora=timezone.now(),
        )
        marcar_ejecutada(CLAVE_EJECUCION)
    except Exception:
        logger.exception('claves_iniciales_antiguas: fallo la pasada; se reintenta')
        raise
    finally:
        cache.delete(CANDADO)

    logger.info(
        'claves_iniciales_antiguas: revisadas=%s ajustadas=%s dias=%s',
        resultado.revisadas, resultado.ajustadas, resultado.dias,
    )
    return f'revisadas={resultado.revisadas} ajustadas={resultado.ajustadas}'
