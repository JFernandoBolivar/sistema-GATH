"""
Vacantes y reserva de puesto para el expediente en Presupuesto (E-1, E-2, C-4). Sin Django.

Una reserva impide que dos expedientes tomen el mismo puesto: una ACTIVA por puesto y una por expediente (constraint
en la BD) y, antes de reservar, se bloquea la fila del puesto (`select_for_update`) y se revalida que siga vacante y
sin otra reserva. Vence a los `captacion.vigencia_reserva_puesto_dias` días; al vencer, la tarea programada la libera.
"""
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from apps.postulacion.application.use_cases._comun import ahora_utc, leer_vigencias, obtener_expediente
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.reserva import (
    ACTIVA,
    LIBERADA,
    MOTIVO_CAMBIO_PUESTO,
    MOTIVO_LIBERADA_POR_USUARIO,
    ReservaPuesto,
)
from apps.postulacion.domain.entities.vacantes import FiltroVacantes, PuestoVacante
from apps.postulacion.domain.errores import ConflictoConCodigo, NoEncontradoConCodigo, ValidacionConCodigo
from apps.postulacion.domain.ports.repos import PuestosVacantes, RepoPostulacion
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.paginacion import Paginacion
from core.domain.ports import LectorConfiguracion

E = EstadoExpediente
MAX_TEXTO_BUSQUEDA = 100


@dataclass(frozen=True)
class FiltrosVacantesEntrada:
    """Lo que llega en la query. Si no llega ningún criterio de un grupo, rige la propuesta del expediente."""

    cargo_id: int | None = None
    dependencia_id: int | None = None
    direccion_general_id: int | None = None      # «oficina»
    direccion_linea_id: int | None = None
    coordinacion_id: int | None = None
    texto: str = ''

    @property
    def hay_oficina(self) -> bool:
        return any(v is not None for v in (
            self.dependencia_id, self.direccion_general_id, self.direccion_linea_id, self.coordinacion_id,
        ))


@dataclass(frozen=True)
class ResultadoVacantes:
    puestos: list[PuestoVacante]
    total: int
    filtro: FiltroVacantes
    reserva_propia: ReservaPuesto | None
    de_propuesta: bool   # True si el filtro salió de la propuesta del expediente (sin criterios explícitos)


def filtro_de_vacantes(exp: ExpedientePostulacion, entrada: FiltrosVacantesEntrada) -> tuple[FiltroVacantes, bool]:
    """Cargo y oficina de la propuesta del expediente; los criterios explícitos reemplazan al grupo correspondiente."""
    de_propuesta = entrada.cargo_id is None and not entrada.hay_oficina
    cargo = entrada.cargo_id if entrada.cargo_id is not None else exp.cargo_propuesto_id
    if entrada.hay_oficina:
        oficina = (
            entrada.dependencia_id, entrada.direccion_general_id, entrada.direccion_linea_id, entrada.coordinacion_id,
        )
    else:
        oficina = (exp.dependencia_id, exp.direccion_general_id, exp.direccion_linea_id, exp.coordinacion_id)
    return FiltroVacantes(
        cargo_id=cargo, dependencia_id=oficina[0], direccion_general_id=oficina[1], direccion_linea_id=oficina[2],
        coordinacion_id=oficina[3], texto=entrada.texto, expediente_propio_id=exp.id,
    ), de_propuesta


def vacantes_del_expediente(
    repo: RepoPostulacion, puestos: PuestosVacantes, *, expediente_id: str, entrada: FiltrosVacantesEntrada,
    paginacion: Paginacion,
) -> ResultadoVacantes:
    exp = obtener_expediente(repo, expediente_id)
    filtro, de_propuesta = filtro_de_vacantes(exp, entrada)
    lista, total = puestos.listar_vacantes(filtro, paginacion)
    return ResultadoVacantes(lista, total, filtro, repo.obtener_reserva_activa_de_expediente(exp.id), de_propuesta)


def _exigir_en_presupuesto(exp: ExpedientePostulacion, accion: str) -> None:
    if exp.estado != E.EN_PRESUPUESTO:
        raise ConflictoConCodigo(
            f"El expediente está en {exp.estado.value}: {accion} solo se hace mientras está en Presupuesto (EN_PRESUPUESTO).",
            codigo='EXPEDIENTE_NO_EN_PRESUPUESTO',
        )


def reservar_puesto(
    repo: RepoPostulacion, puestos: PuestosVacantes, config: LectorConfiguracion, *, expediente_id: str,
    puesto_id: int, reservado_por: str, ahora: datetime | None = None,
) -> tuple[ReservaPuesto, ReservaPuesto | None]:
    """Reserva (o cambia la reserva) del expediente. Devuelve `(reserva_nueva, reserva_anterior_liberada | None)`.

    Reservar el mismo puesto otra vez no cambia nada (devuelve la que ya existe, sin renovar el plazo).
    """
    if isinstance(puesto_id, bool) or not isinstance(puesto_id, int) or puesto_id < 1:
        raise ValidacionConCodigo("Indique un puesto válido.", campo='puesto_id', codigo='PUESTO_INVALIDO')
    ahora = ahora or ahora_utc()
    dias = leer_vigencias(config).reserva_puesto_dias
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        _exigir_en_presupuesto(exp, 'reservar el puesto')
        puesto = puestos.obtener_puesto(puesto_id, bloquear=True)   # serializa a quienes reservan el mismo puesto
        if puesto is None:
            raise NoEncontradoConCodigo("El puesto indicado no existe.", codigo='PUESTO_NO_ENCONTRADO')
        propia = repo.obtener_reserva_activa_de_expediente(exp.id, bloquear=True)
        if propia is not None and propia.puesto_id == puesto_id:
            return propia, None
        if not puesto.vacante:
            raise ConflictoConCodigo(
                f"El puesto {puesto.codigo} ya no está vacante.", campo='puesto_id', codigo='PUESTO_NO_VACANTE',
            )
        if repo.obtener_reserva_activa_de_puesto(puesto_id, bloquear=True) is not None:
            raise ConflictoConCodigo(
                f"El puesto {puesto.codigo} ya está reservado por otro expediente.", campo='puesto_id',
                codigo='PUESTO_RESERVADO',
            )
        liberada = None
        if propia is not None:
            liberada = repo.guardar_reserva(replace(
                propia, estado=LIBERADA, motivo_liberacion=MOTIVO_CAMBIO_PUESTO, cerrada_el=ahora,
            ))
        nueva = repo.crear_reserva(ReservaPuesto(
            id='', expediente_id=exp.id, puesto_id=puesto_id, reservado_por=reservado_por, reservado_el=ahora,
            vence_el=ahora + timedelta(days=dias),
        ))
    return nueva, liberada


def liberar_reserva(
    repo: RepoPostulacion, *, expediente_id: str, motivo: str = '', ahora: datetime | None = None,
) -> ReservaPuesto:
    """Libera a mano la reserva activa (solo mientras el expediente sigue en Presupuesto)."""
    ahora = ahora or ahora_utc()
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        _exigir_en_presupuesto(exp, 'liberar la reserva')
        reserva = repo.obtener_reserva_activa_de_expediente(exp.id, bloquear=True)
        if reserva is None:
            raise NoEncontradoConCodigo("El expediente no tiene una reserva activa.", codigo='RESERVA_NO_ENCONTRADA')
        motivo = ' '.join((motivo or '').split())[:200]
        return repo.guardar_reserva(replace(
            reserva, estado=LIBERADA, cerrada_el=ahora, motivo_liberacion=motivo or MOTIVO_LIBERADA_POR_USUARIO,
        ))


def liberar_reserva_activa(
    repo: RepoPostulacion, expediente_id: str, motivo: str, ahora: datetime,
) -> ReservaPuesto | None:
    """Libera la reserva activa, si hay, como parte de otra operación (devolver, diferir, rechazar). Dentro de su transacción."""
    reserva = repo.obtener_reserva_activa_de_expediente(expediente_id, bloquear=True)
    if reserva is None or reserva.estado != ACTIVA:
        return None
    return repo.guardar_reserva(replace(reserva, estado=LIBERADA, cerrada_el=ahora, motivo_liberacion=motivo))
