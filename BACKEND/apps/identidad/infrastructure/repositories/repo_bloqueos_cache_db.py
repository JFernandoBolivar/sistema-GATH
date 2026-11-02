"""
Repositorio compuesto del bloqueo de cuentas (B3.12, D-09/D-11).

Implementa el puerto `domain/ports/repo_bloqueos.py` combinando:
- **Caché** (`django.core.cache.cache`, DatabaseCache sobre PostgreSQL — D-11):
  claves `bloqueo:<cedula>` con el contador de intentos y TTL deslizante igual
  a la ventana de conteo (15 min). Al aplicar un bloqueo, el TTL se extiende
  hasta el vencimiento del bloqueo (+1 min de buffer) para que la sanción no
  expire antes de tiempo.
- **BD** (`IntentoFallidoModel`): incidentes append-only; de ahí sale la
  cantidad de bloqueos previos que gradúa la progresión (ventana 24 h), dato
  que sobrevive al vencimiento de la caché.

Aquí vive el único acceso a Django del flujo de bloqueo (B3/B21).
"""
from datetime import datetime, timedelta, timezone

from django.core.cache import cache

from apps.identidad.domain.entities.bloqueo_cuenta import BloqueoCuenta
from apps.identidad.infrastructure.models.intento_fallido_model import (
    IntentoFallidoModel,
)

PREFIJO_CLAVE = 'bloqueo:'
VENTANA_CONTEO_SEGUNDOS = 15 * 60  # ventana deslizante del contador (B3.12)
BUFFER_BLOQUEO_SEGUNDOS = 60  # margen sobre `bloqueada_hasta`
VENTANA_PROGRESION_HORAS = 24  # horizonte para graduar la progresión
RESULTADO_BLOQUEO = 'bloqueo_aplicado'


def _clave(cedula: str) -> str:
    return f'{PREFIJO_CLAVE}{cedula}'


def _guardar(estado: BloqueoCuenta, timeout_segundos: int) -> None:
    cache.set(
        _clave(estado.cedula),
        {
            'intentos': estado.intentos,
            'motivo': estado.motivo,
            'bloqueada_hasta': (
                estado.bloqueada_hasta.isoformat()
                if estado.bloqueada_hasta
                else None
            ),
        },
        timeout=timeout_segundos,
    )


def _leer(cedula: str) -> BloqueoCuenta | None:
    datos = cache.get(_clave(cedula))
    if not datos:
        return None
    vencimiento = datos.get('bloqueada_hasta')
    return BloqueoCuenta(
        cedula=cedula,
        intentos=int(datos.get('intentos', 0)),
        motivo=datos.get('motivo', ''),
        bloqueada_hasta=(
            datetime.fromisoformat(vencimiento) if vencimiento else None
        ),
    )


class RepoBloqueosCacheDB:
    """Contador de intentos en caché + incidentes en PostgreSQL (B3.12)."""

    def registrar_intento(self, cedula: str) -> BloqueoCuenta:
        actual = _leer(cedula)
        estado = BloqueoCuenta(
            cedula=cedula,
            intentos=(actual.intentos if actual else 0) + 1,
            motivo=actual.motivo if actual else '',
            bloqueada_hasta=actual.bloqueada_hasta if actual else None,
        )
        # TTL deslizante: cada intento reinicia la ventana de conteo.
        _guardar(estado, VENTANA_CONTEO_SEGUNDOS)
        return estado

    def intentos_registrados(self, cedula: str) -> int:
        actual = _leer(cedula)
        return actual.intentos if actual else 0

    def aplicar_bloqueo(self, cedula: str, hasta: datetime, motivo: str) -> BloqueoCuenta:
        # El bloqueo deja el contador a cero: los siguientes N fallos vuelven a
        # dispararlo; la progresión la aporta la BD (sobrevive a la caché).
        estado = BloqueoCuenta(
            cedula=cedula,
            intentos=0,
            bloqueada_hasta=hasta,
            motivo=motivo,
        )
        restante = max(
            VENTANA_CONTEO_SEGUNDOS,
            int((hasta - datetime.now(timezone.utc)).total_seconds())
            + BUFFER_BLOQUEO_SEGUNDOS,
        )
        _guardar(estado, restante)
        return estado

    def esta_bloqueada(self, cedula: str) -> datetime | None:
        actual = _leer(cedula)
        return actual.bloqueada_hasta if actual else None

    def bloqueos_previos(self, cedula: str) -> int:
        limite = datetime.now(timezone.utc) - timedelta(
            hours=VENTANA_PROGRESION_HORAS
        )
        return IntentoFallidoModel.objects.filter(
            cedula=cedula,
            resultado=RESULTADO_BLOQUEO,
            fecha_hora__gte=limite,
        ).count()

    def registrar_incidente(
        self, cedula: str, ip: str | None, resultado: str
    ) -> None:
        IntentoFallidoModel.objects.create(
            cedula=cedula, ip=ip, resultado=resultado
        )

    def resetear(self, cedula: str) -> None:
        cache.delete(_clave(cedula))
