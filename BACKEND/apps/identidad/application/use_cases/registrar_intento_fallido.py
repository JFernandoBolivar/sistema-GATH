"""
Caso de uso `registrar_intento_fallido` (B3.12).

Política de bloqueo progresivo — constante de módulo, documentada:
- Tras **5 intentos fallidos consecutivos** (`UMBRAL_INTENTOS`) se bloquea la
  cuenta.
- La duración progresa según los bloqueos previos registrados en BD dentro de
  la ventana `VENTANA_PROGRESION_HORAS`: **1º → 15 min, 2º → 30 min, 3º en
  adelante → 60 min** (`PROGRESION_MINUTOS`; el último valor se reutiliza).
- Al alcanzar el umbral el incidente se registra en ambos destinos del sistema
  dual (D-04): línea en `security_backend.txt` (logger 'security_backend') y
  fila en DB vía `repo.registrar_incidente` (resultado 'bloqueo_aplicado').

Puro: recibe el puerto por inyección (B4/B21). Solo stdlib.
"""
import logging
from datetime import datetime, timedelta, timezone

from apps.identidad.application.dtos.bloqueo_dto import IntentoFallidoDTO
from apps.identidad.domain.entities.bloqueo_cuenta import BloqueoCuenta
from apps.identidad.domain.ports.repo_bloqueos import RepoBloqueos
from apps.identidad.domain.value_objects.umbral_intentos import UmbralIntentos

# Canal de seguridad (settings.LOGGING → logs/backend/security_backend.txt).
logger_seguridad = logging.getLogger('security_backend')

UMBRAL_INTENTOS = UmbralIntentos(5)
PROGRESION_MINUTOS = (15, 30, 60)
VENTANA_PROGRESION_HORAS = 24
RESULTADO_BLOQUEO = 'bloqueo_aplicado'


def registrar_intento_fallido(
    repo: RepoBloqueos,
    dto: IntentoFallidoDTO,
    ahora: datetime | None = None,
) -> BloqueoCuenta:
    """Anota el fallo y aplica el bloqueo progresivo al alcanzar el umbral."""
    ahora = ahora or datetime.now(timezone.utc)
    estado = repo.registrar_intento(dto.cedula)

    if estado.intentos < UMBRAL_INTENTOS.valor:
        return estado

    # Umbral alcanzado: la progresión gradúa con los incidentes recientes.
    indice = min(
        repo.bloqueos_previos(dto.cedula), len(PROGRESION_MINUTOS) - 1
    )
    duracion_min = PROGRESION_MINUTOS[indice]
    hasta = ahora + timedelta(minutes=duracion_min)
    motivo = f'{UMBRAL_INTENTOS.valor} intentos fallidos consecutivos'

    bloqueo = repo.aplicar_bloqueo(dto.cedula, hasta, motivo)
    repo.registrar_incidente(dto.cedula, dto.ip, RESULTADO_BLOQUEO)

    # Incidente forense (D-04): línea estructurada en security_backend.txt.
    logger_seguridad.warning(
        '[BLOQUEO_CUENTA] [CEDULA:%s] [IP:%s] [INTENTOS:%d] '
        '[DURACION_MIN:%d] [HASTA:%s] [RESULTADO:%s]',
        dto.cedula,
        dto.ip or '-',
        UMBRAL_INTENTOS.valor,
        duracion_min,
        hasta.isoformat(),
        RESULTADO_BLOQUEO,
    )
    return bloqueo
