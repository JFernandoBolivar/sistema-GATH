"""Expediente de Postulación: entidad pura e inmutable (se reemplaza con `dataclasses.replace`)."""
from dataclasses import dataclass
from datetime import datetime

from apps.postulacion.domain.value_objects.estados import ESTADOS_TERMINALES, EstadoExpediente

# Campos de la propuesta de Captación que el caso de uso de transición puede modificar.
CAMPOS_PROPUESTA = (
    'cargo_propuesto_id', 'cargo_especifico_propuesto_id', 'tipo_nomina_propuesto_id',
    'direccion_general_id', 'direccion_linea_id', 'coordinacion_id', 'dependencia_id',
    'cargo_propuesto_texto', 'oficina_propuesta_texto', 'observaciones',
)


@dataclass(frozen=True)
class ExpedientePostulacion:
    id: str
    numero: str
    postulante_id: str
    estado: EstadoExpediente
    creado_por: str = ''
    # Propuesta de Captación: ids de catálogos heredados (sin FK dura) y/o texto libre.
    cargo_propuesto_id: int | None = None
    cargo_especifico_propuesto_id: int | None = None
    tipo_nomina_propuesto_id: int | None = None
    direccion_general_id: int | None = None
    direccion_linea_id: int | None = None
    coordinacion_id: int | None = None
    dependencia_id: int | None = None
    cargo_propuesto_texto: str = ''
    oficina_propuesta_texto: str = ''
    # Ventana del postulante en curso (1 o 2) y su vencimiento.
    ventana: int | None = None
    ventana_vence_el: datetime | None = None
    # Vencimiento de la reserva del puesto (C-4); lo fija la entrada a EN_DIRECCION_GENERAL.
    reserva_vence_el: datetime | None = None
    # Fin de la espera del diferido (C-10); lo fija la entrada a DIFERIDO_PRESUPUESTO.
    diferido_vence_el: datetime | None = None
    observaciones: str = ''
    fecha_apertura: datetime | None = None
    fecha_cierre: datetime | None = None

    @property
    def es_terminal(self) -> bool:
        return self.estado in ESTADOS_TERMINALES

    @property
    def cargo_definido(self) -> bool:
        return bool(self.cargo_propuesto_id or self.cargo_propuesto_texto.strip())

    @property
    def oficina_definida(self) -> bool:
        return bool(
            self.direccion_general_id or self.direccion_linea_id or self.coordinacion_id
            or self.dependencia_id or self.oficina_propuesta_texto.strip()
        )
