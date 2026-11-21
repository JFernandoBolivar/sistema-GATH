"""Bandeja y detalle de Captación (D-7). Sin Django."""
from dataclasses import dataclass
from datetime import date, datetime

from apps.postulacion.application.use_cases._comun import (
    ahora_utc,
    leer_psicofisico_obligatorio,
    texto_normalizado,
)
from apps.postulacion.application.use_cases.consultas import ExpedienteConHistorial, consultar_expediente
from apps.postulacion.domain.entities.bandeja import FilaBandeja, FiltrosBandeja
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.acciones import AccionDisponible, acciones_disponibles
from apps.postulacion.domain.services.maquina_estados import Hechos
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import ValidationError
from core.domain.paginacion import Paginacion
from core.domain.ports import LectorConfiguracion

MAX_TEXTO_BUSQUEDA = 100


def construir_filtros(
    estados: list[str] | None = None, texto: str | None = None, desde: date | None = None, hasta: date | None = None,
) -> FiltrosBandeja:
    validos = []
    for e in estados or []:
        try:
            validos.append(EstadoExpediente(e))
        except ValueError as exc:
            raise ValidationError(f"El estado «{e}» no existe.", campo='estado') from exc
    if desde and hasta and desde > hasta:
        raise ValidationError("La fecha «desde» no puede ser posterior a «hasta».", campo='desde')
    texto = texto_normalizado(texto, "La búsqueda", maximo=MAX_TEXTO_BUSQUEDA, obligatorio=False)
    return FiltrosBandeja(estados=tuple(dict.fromkeys(validos)), texto=texto, desde=desde, hasta=hasta)


def listar_bandeja(repo: RepoPostulacion, filtros: FiltrosBandeja, paginacion: Paginacion) -> tuple[list[FilaBandeja], int]:
    return repo.listar_bandeja(filtros, paginacion)


@dataclass(frozen=True)
class DetalleCaptacion:
    base: ExpedienteConHistorial
    psicofisico: ResultadoPsicofisico | None
    psicofisico_obligatorio: bool
    acciones: list[AccionDisponible]


def detalle_para_captacion(
    repo: RepoPostulacion, config: LectorConfiguracion, *, expediente_id: str, permisos: frozenset[str],
    ahora: datetime | None = None,
) -> DetalleCaptacion:
    """Expediente completo y las acciones que ESTE usuario puede ejecutar hoy (máquina de estados + permisos)."""
    base = consultar_expediente(repo, expediente_id)
    exp = base.expediente
    psicofisico = repo.obtener_psicofisico(exp.id)
    obligatorio = leer_psicofisico_obligatorio(config)
    hechos = Hechos(
        ahora=ahora or ahora_utc(), ventana_vence_el=exp.ventana_vence_el, reserva_vence_el=exp.reserva_vence_el,
        diferido_vence_el=exp.diferido_vence_el, cargo_definido=exp.cargo_definido,
        oficina_definida=exp.oficina_definida, psicofisico_obligatorio=obligatorio,
        psicofisico_registrado=psicofisico is not None,
    )
    return DetalleCaptacion(base, psicofisico, obligatorio, acciones_disponibles(exp, permisos, hechos, psicofisico))

