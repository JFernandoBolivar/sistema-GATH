"""
Caso de uso U2: restablecer el acceso (contraseña inicial = cédula) en bloque.

La **selección** (qué cuentas entran) se hace una sola vez en la vista previa
(síncrona: solo consultas) y se reutiliza en la ejecución por la lista de
`cuenta_id`. La ejecución con alcance `VENCIDA` o `SIN_PRIMER_INGRESO` no
rehashea: la clave ya es la cédula, solo renueva el vencimiento y limpia
bloqueos; `TODOS` sí usa `restablecer_acceso` completo.

Puro (B4): repositorios, publicación de eventos y limpieza de bloqueos se
inyectan.
"""
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Sequence

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.restablecer_acceso import restablecer_acceso
from apps.identidad.application.use_cases.resolver_permisos import resolver_politica_actor
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.entities.restablecimiento_bloque import (
    FilaBloque,
    ResultadoRestablecimientoBloque,
)
from apps.identidad.domain.events import (
    EventoIdentidad,
    MotivoCambioPassword,
    TipoEventoIdentidad,
)
from apps.identidad.domain.ports.repo_condicion_trabajador import RepoCondicionTrabajador
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from apps.identidad.domain.ports.repo_cuentas_clave_inicial import RepoCuentasClaveInicial
from apps.identidad.domain.ports.repo_detalle_cuentas_bloque import RepoDetalleCuentasBloque
from apps.identidad.domain.ports.repo_password_inicial import RepoPasswordInicial
from apps.identidad.domain.ports.repo_permisos import RepoPermisos
from apps.identidad.domain.ports.repo_permisos_version import RepoPermisosVersion
from apps.identidad.domain.services.politica_password_inicial import vencimiento_desde
from apps.identidad.domain.services.reglas_administracion import (
    es_cuenta_administrativa,
    validar_operacion_sobre_cuenta_administrativa,
)
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.domain.value_objects.restablecimiento_bloque import Alcance, Clasificacion
from core.domain.exceptions import ConflictError, PermissionDeniedError, ValidationError

logger = logging.getLogger('security_backend')

MOTIVO_MINIMO = 10


@dataclass(frozen=True)
class SeleccionBloque:
    """Resultado de seleccionar las cuentas del lote (sin tocar credenciales)."""

    revisadas: int
    activos: int
    pasivos: int
    omitidas: int
    cuenta_ids: tuple[int, ...]


def seleccionar_cuentas(
    repo_condicion: RepoCondicionTrabajador,
    repo_permisos: RepoPermisos,
    repo_clave_inicial: RepoCuentasClaveInicial,
    actor: ActorSesionDTO,
    clasificacion: Clasificacion,
    alcance: Alcance,
    ahora: datetime,
) -> SeleccionBloque:
    """Cuentas que entran al lote, separadas por condición y sin administrativas.

    `VENCIDA`: con fila de contraseña inicial y `vence_en <= ahora`.
    `SIN_PRIMER_INGRESO`: con fila de contraseña inicial, vigente o vencida.
    `TODOS`: todas las activas.
    """
    if alcance is Alcance.VENCIDA:
        candidatas = list(repo_clave_inicial.vencidas(ahora))
    elif alcance is Alcance.SIN_PRIMER_INGRESO:
        candidatas = list(repo_clave_inicial.con_clave_inicial())
    else:
        candidatas = list(repo_clave_inicial.activas())
    activos = repo_condicion.cedulas_por_condicion(CondicionTrabajador.ACTIVO.value)
    pasivos = repo_condicion.cedulas_por_condicion(CondicionTrabajador.PASIVO.value)
    politica_actor = resolver_politica_actor(repo_permisos, actor)

    elegidas: list[int] = []
    omitidas = 0
    cuenta_activos = 0
    cuenta_pasivos = 0
    for cuenta in candidatas:
        if cuenta.cedula in pasivos:
            condicion = CondicionTrabajador.PASIVO.value
        elif cuenta.cedula in activos:
            condicion = CondicionTrabajador.ACTIVO.value
        else:
            condicion = CondicionTrabajador.SIN_ASIGNACION.value

        if clasificacion is Clasificacion.ACTIVOS and condicion != CondicionTrabajador.ACTIVO.value:
            continue
        if clasificacion is Clasificacion.PASIVOS and condicion != CondicionTrabajador.PASIVO.value:
            continue

        usuario_permisos = repo_permisos.obtener_permisos_usuario(cuenta.cedula)
        politica_objetivo = (
            usuario_permisos.politica_efectiva if usuario_permisos else PoliticaAcceso()
        )
        try:
            validar_operacion_sobre_cuenta_administrativa(
                politica_actor=politica_actor,
                politica_objetivo=politica_objetivo,
                operacion='restablecer el acceso de',
            )
        except PermissionDeniedError:
            omitidas += 1
            continue
        # U2: aunque el actor sea administrador, las cuentas administrativas
        # nunca entran al lote (superadministrador, analistas, etc.).
        if es_cuenta_administrativa(politica_objetivo):
            omitidas += 1
            continue
        elegidas.append(cuenta.cuenta_id)
        if condicion == CondicionTrabajador.PASIVO.value:
            cuenta_pasivos += 1
        elif condicion == CondicionTrabajador.ACTIVO.value:
            cuenta_activos += 1

    return SeleccionBloque(
        revisadas=len(candidatas),
        activos=cuenta_activos,
        pasivos=cuenta_pasivos,
        omitidas=omitidas,
        cuenta_ids=tuple(elegidas),
    )


def armar_filas(
    repo_detalle: RepoDetalleCuentasBloque,
    repo_condicion: RepoCondicionTrabajador,
    cuenta_ids: Sequence[int],
) -> list[FilaBloque]:
    """Filas (cédula, nombre, condición, correo, vencimiento) ordenadas por nombre."""
    pasivos = repo_condicion.cedulas_por_condicion(CondicionTrabajador.PASIVO.value)
    activos = repo_condicion.cedulas_por_condicion(CondicionTrabajador.ACTIVO.value)
    filas = []
    for detalle in repo_detalle.detalle(cuenta_ids):
        if detalle.cedula in pasivos:
            condicion = CondicionTrabajador.PASIVO.value
        elif detalle.cedula in activos:
            condicion = CondicionTrabajador.ACTIVO.value
        else:
            condicion = CondicionTrabajador.SIN_ASIGNACION.value
        filas.append(FilaBloque(
            cuenta_id=detalle.cuenta_id, cedula=detalle.cedula, nombre=detalle.nombre,
            condicion=condicion, correo=detalle.correo, vence_en=detalle.vence_en,
        ))
    filas.sort(key=lambda fila: (fila.nombre.upper(), fila.cedula))
    return filas


def _renovar_vencimiento_sin_rehash(
    repo_cuentas: RepoCuentas,
    repo_password_inicial: RepoPasswordInicial,
    publicar: Callable[[EventoIdentidad], None],
    *,
    cuenta_id: int,
    ahora: datetime,
    dias_vigencia: int,
    enviar_correo: bool,
    limpiar_bloqueo: Callable[[str], None] | None,
) -> None:
    """U2-bis: la clave ya es la cédula; solo se renueva el plazo y se desbloquea."""
    cuenta = repo_cuentas.obtener_por_id(cuenta_id)
    if cuenta is None or not cuenta.is_active:
        raise ValidationError('La cuenta no existe o está desactivada.')
    repo_password_inicial.emitir(cuenta_id, vencimiento_desde(ahora, dias_vigencia))
    if limpiar_bloqueo is not None:
        for clave in {cuenta.cedula, cuenta.correo, (cuenta.correo or '').lower()} - {None, ''}:
            limpiar_bloqueo(str(clave))
    if enviar_correo:
        publicar(EventoIdentidad(
            tipo=TipoEventoIdentidad.PASSWORD_CAMBIADA, cedula=cuenta.cedula,
            motivo=MotivoCambioPassword.RESTABLECIDO_RRHH.value, dias_vigencia=dias_vigencia,
        ))


def restablecer_acceso_en_bloque(
    repo_cuentas: RepoCuentas,
    repo_password_inicial: RepoPasswordInicial,
    repo_version: RepoPermisosVersion,
    repo_permisos: RepoPermisos,
    repo_condicion: RepoCondicionTrabajador,
    repo_clave_inicial: RepoCuentasClaveInicial,
    publicar: Callable[[EventoIdentidad], None],
    actor: ActorSesionDTO,
    *,
    clasificacion: str,
    alcance: str,
    enviar_correo: bool,
    motivo: str,
    ahora: datetime,
    dias_vigencia: int,
    confirmacion: int | None = None,
    dry_run: bool = False,
    cuenta_ids: Sequence[int] | None = None,
    limpiar_bloqueo: Callable[[str], None] | None = None,
) -> ResultadoRestablecimientoBloque:
    """Vista previa (`dry_run`) o ejecución del lote.

    En ejecución, `cuenta_ids` es la lista que guardó la vista previa (evita
    repetir `check_password`). Si no se pasa, se recalcula la selección.
    """
    motivo = (motivo or '').strip()
    if len(motivo) < MOTIVO_MINIMO:
        raise ValidationError(
            f'Indique el motivo del restablecimiento (mínimo {MOTIVO_MINIMO} caracteres).',
            campo='motivo',
        )
    try:
        clasificacion_enum = Clasificacion(clasificacion)
    except ValueError:
        raise ValidationError('La clasificación no es válida.', campo='clasificacion') from None
    try:
        alcance_enum = Alcance(alcance)
    except ValueError:
        raise ValidationError('El alcance no es válido.', campo='alcance') from None

    seleccion = None
    if cuenta_ids is None:
        seleccion = seleccionar_cuentas(
            repo_condicion, repo_permisos, repo_clave_inicial, actor,
            clasificacion_enum, alcance_enum, ahora,
        )
        ids = list(seleccion.cuenta_ids)
    else:
        ids = [int(cuenta_id) for cuenta_id in cuenta_ids]

    total = len(ids)
    resultado = ResultadoRestablecimientoBloque(
        revisadas=seleccion.revisadas if seleccion else total,
        activos=seleccion.activos if seleccion else 0,
        pasivos=seleccion.pasivos if seleccion else 0,
        total=total,
        omitidas_administrativas=seleccion.omitidas if seleccion else 0,
        enviar_correo=enviar_correo,
        dry_run=dry_run,
    )
    if dry_run:
        return resultado

    if confirmacion is None or confirmacion != total:
        raise ConflictError(
            'El número de cuentas cambió desde la vista previa: vuelva a calcularla e intente de nuevo.'
        )

    restablecidas = 0
    errores = 0
    for cuenta_id in ids:
        try:
            if alcance_enum is not Alcance.TODOS:
                _renovar_vencimiento_sin_rehash(
                    repo_cuentas,
                    repo_password_inicial,
                    publicar,
                    cuenta_id=cuenta_id,
                    ahora=ahora,
                    dias_vigencia=dias_vigencia,
                    enviar_correo=enviar_correo,
                    limpiar_bloqueo=limpiar_bloqueo,
                )
            else:
                restablecer_acceso(
                    repo_cuentas,
                    repo_password_inicial,
                    repo_version,
                    publicar,
                    cuenta_id,
                    ahora,
                    dias_vigencia,
                    repo_permisos=repo_permisos,
                    actor=actor,
                    limpiar_bloqueo=limpiar_bloqueo,
                    publicar_correo=enviar_correo,
                    verificar_politica=False,
                )
            restablecidas += 1
        except Exception:  # noqa: BLE001 - una cuenta no detiene el lote
            errores += 1
            logger.exception(
                'restablecimiento en bloque: falló la cuenta %s', cuenta_id,
            )

    return ResultadoRestablecimientoBloque(
        revisadas=resultado.revisadas,
        activos=resultado.activos,
        pasivos=resultado.pasivos,
        total=resultado.total,
        omitidas_administrativas=resultado.omitidas_administrativas,
        restablecidas=restablecidas,
        errores=errores,
        enviar_correo=enviar_correo,
        dry_run=False,
    )
