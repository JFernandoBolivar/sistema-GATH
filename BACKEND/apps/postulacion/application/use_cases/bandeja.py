"""Bandeja y detalle de Captación (D-7). Sin Django."""
from dataclasses import dataclass, replace
from datetime import date, datetime

from apps.postulacion.application.use_cases._comun import (
    ahora_utc,
    leer_horas_escalamiento_contacto,
    leer_psicofisico_obligatorio,
    texto_normalizado,
)
from apps.postulacion.application.use_cases.consultas import ExpedienteConHistorial, consultar_expediente
from apps.postulacion.domain.entities.bandeja import FilaBandeja, FiltrosBandeja
from apps.postulacion.domain.entities.psicofisico import ResultadoPsicofisico
from apps.postulacion.domain.ports.repos import CatalogosVentana2, RepoPostulacion
from apps.postulacion.domain.services.acciones import (
    PARES_ASIGNACION,
    PARES_CAPTACION,
    AccionDisponible,
    acciones_disponibles,
)
from apps.postulacion.domain.services.contacto import limite_de_atraso
from apps.postulacion.domain.services.datos_ventana2 import faltantes_ventana2
from apps.postulacion.domain.services.maquina_estados import Hechos
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import ValidationError
from core.domain.paginacion import Paginacion
from core.domain.ports import LectorConfiguracion

MAX_TEXTO_BUSQUEDA = 100


def construir_filtros(
    estados: list[str] | None = None, texto: str | None = None, desde: date | None = None, hasta: date | None = None,
    por_contactar: bool = False,
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
    return FiltrosBandeja(
        estados=tuple(dict.fromkeys(validos)), texto=texto, desde=desde, hasta=hasta, solo_por_contactar=bool(por_contactar),
    )


def listar_bandeja(
    repo: RepoPostulacion, filtros: FiltrosBandeja, paginacion: Paginacion, config: LectorConfiguracion | None = None,
    ahora: datetime | None = None,
) -> tuple[list[FilaBandeja], int]:
    """Con `config`, los contactos pendientes ATRASADOS (más de `captacion.horas_escalamiento_contacto`) van primero (G-1)."""
    if config is not None:
        filtros = replace(filtros, atraso_antes_de=limite_de_atraso(ahora or ahora_utc(), leer_horas_escalamiento_contacto(config)))
    return repo.listar_bandeja(filtros, paginacion)


@dataclass(frozen=True)
class DetalleCaptacion:
    base: ExpedienteConHistorial
    psicofisico: ResultadoPsicofisico | None
    psicofisico_obligatorio: bool
    acciones: list[AccionDisponible]
    horas_escalamiento_contacto: int = 48
    ventana2_legible: dict | None = None        # los datos de la Ventana 2 con el nombre de cada catálogo
    ventana2_faltantes: list[dict] | None = None
    ultimo_enlace: object | None = None         # último enlace de activación enviado (D-10)


def detalle_para_captacion(
    repo: RepoPostulacion, config: LectorConfiguracion, *, expediente_id: str, permisos: frozenset[str],
    ahora: datetime | None = None, catalogos: CatalogosVentana2 | None = None,
) -> DetalleCaptacion:
    """Expediente completo y las acciones que ESTE usuario puede ejecutar hoy (máquina de estados + permisos)."""
    base = consultar_expediente(repo, expediente_id)
    exp = base.expediente
    psicofisico = repo.obtener_psicofisico(exp.id)
    obligatorio = leer_psicofisico_obligatorio(config)
    # Para MOSTRAR la acción de contratar basta una reserva activa; la revalidación real (con bloqueo del puesto) ocurre
    # al ejecutar `asignar/`.
    reserva = repo.obtener_reserva_activa_de_expediente(exp.id) if exp.estado == EstadoExpediente.LISTO_PARA_ASIGNAR else None
    hechos = Hechos(
        ahora=ahora or ahora_utc(), ventana_vence_el=exp.ventana_vence_el,
        reserva_vence_el=reserva.vence_el if reserva is not None else exp.reserva_vence_el,
        puesto_reservado=reserva is not None, puesto_revalidado=reserva is not None,
        diferido_vence_el=exp.diferido_vence_el, cargo_definido=exp.cargo_definido,
        oficina_definida=exp.oficina_definida, psicofisico_obligatorio=obligatorio,
        psicofisico_registrado=psicofisico is not None,
    )
    legible = faltantes = None
    if exp.datos_ventana2 or exp.ventana == 2 or exp.tiene_foto:
        legible = catalogos.legible(exp.datos_ventana2 or {}) if catalogos is not None else None
        faltantes = faltantes_ventana2(exp.datos_ventana2, exp.tiene_foto)
    return DetalleCaptacion(
        base, psicofisico, obligatorio, acciones_disponibles(
            exp, permisos, hechos, psicofisico, pares={**PARES_CAPTACION, **PARES_ASIGNACION},
        ),
        horas_escalamiento_contacto=leer_horas_escalamiento_contacto(config), ventana2_legible=legible,
        ventana2_faltantes=faltantes, ultimo_enlace=repo.ultimo_enlace_de_expediente(exp.id),
    )

