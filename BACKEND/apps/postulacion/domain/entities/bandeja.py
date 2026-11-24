"""Filas y filtros de la bandeja de Captación (D-7). Sin Django."""
from dataclasses import dataclass
from datetime import date, datetime

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante
from apps.postulacion.domain.value_objects.estados import EstadoExpediente

# Los que esperan una acción de Captación van primero en la bandeja.
ESTADOS_PENDIENTES_CAPTACION: frozenset[EstadoExpediente] = frozenset({
    EstadoExpediente.ENVIADO_CAPTACION, EstadoExpediente.EN_REVISION_FINAL,
})


@dataclass(frozen=True)
class FiltrosBandeja:
    estados: tuple[EstadoExpediente, ...] = ()
    texto: str = ''                      # cédula, nombre o número (cada palabra debe aparecer)
    desde: date | None = None            # fecha del último cambio (inclusive)
    hasta: date | None = None
    # «o con Punto de Cuenta de ingreso en alguno de estos estados» (histórico de Dirección General, E-6).
    o_punto_cuenta_estados: tuple[str, ...] = ()
    # Estados que van primero en la bandeja (los que esperan al área que consulta); por defecto, los de Captación.
    prioritarios: tuple[EstadoExpediente, ...] = tuple(ESTADOS_PENDIENTES_CAPTACION)


@dataclass(frozen=True)
class FilaBandeja:
    expediente: ExpedientePostulacion
    postulante: Postulante
    ultimo_cambio: datetime | None = None

    @property
    def es_reingreso(self) -> bool:
        return self.postulante.es_reingreso

    @property
    def pendiente_de_captacion(self) -> bool:
        return self.expediente.estado in ESTADOS_PENDIENTES_CAPTACION


@dataclass(frozen=True)
class PropuestaCatalogo:
    """Ids de la propuesta de Captación que hay que comprobar contra los catálogos heredados."""

    cargo_propuesto_id: int | None = None
    cargo_especifico_propuesto_id: int | None = None
    tipo_nomina_propuesto_id: int | None = None
    direccion_general_id: int | None = None
    direccion_linea_id: int | None = None
    coordinacion_id: int | None = None
    dependencia_id: int | None = None

    def con_valores(self) -> dict[str, int]:
        return {k: v for k, v in self.__dict__.items() if v is not None}

