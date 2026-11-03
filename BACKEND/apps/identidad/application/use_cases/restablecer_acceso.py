"""
Caso de uso: «Restablecer acceso» de RRHH (decisión F, D8).

Repone la cédula como contraseña inicial con 7 días nuevos, marca el cambio obligatorio (la contraseña
igual a la cédula lo activa en `debe_cambiar_password`), revoca las sesiones y avisa por correo. Puro (B4).
"""
from datetime import datetime
from typing import Callable

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.resolver_permisos import resolver_politica_actor
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.events import EventoIdentidad, MotivoCambioPassword, TipoEventoIdentidad
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from apps.identidad.domain.ports.repo_password_inicial import RepoPasswordInicial
from apps.identidad.domain.ports.repo_permisos import RepoPermisos
from apps.identidad.domain.ports.repo_permisos_version import RepoPermisosVersion
from apps.identidad.domain.services.politica_password_inicial import vencimiento_desde
from apps.identidad.domain.services.reglas_administracion import (
    validar_operacion_sobre_cuenta_administrativa,
)
from core.domain.exceptions import NotFoundError, ValidationError


def restablecer_acceso(
    repo_cuentas: RepoCuentas,
    repo_password_inicial: RepoPasswordInicial,
    repo_version: RepoPermisosVersion,
    publicar: Callable[[EventoIdentidad], None],
    cuenta_id: int,
    ahora: datetime,
    dias_vigencia: int = 7,
    *,
    repo_permisos: RepoPermisos,
    actor: ActorSesionDTO,
    limpiar_bloqueo: Callable[[str], None] | None = None,
) -> Cuenta:
    cuenta = repo_cuentas.obtener_por_id(cuenta_id)
    if cuenta is None:
        raise NotFoundError('El usuario no existe.')
    if not cuenta.is_active:
        raise ValidationError('La cuenta está desactivada: actívela antes de restablecer su acceso.')

    objetivo = repo_permisos.obtener_permisos_usuario(cuenta.cedula)
    validar_operacion_sobre_cuenta_administrativa(
        politica_actor=resolver_politica_actor(repo_permisos, actor),
        politica_objetivo=objetivo.politica_efectiva if objetivo else PoliticaAcceso(),
        operacion='restablecer el acceso de',
    )

    repo_cuentas.establecer_password(cuenta.id, cuenta.cedula)
    repo_password_inicial.emitir(cuenta.id, vencimiento_desde(ahora, dias_vigencia))
    # QA 2026-11-03: quien pide el restablecimiento suele haber agotado sus intentos. Sin esto
    # seguía bloqueado (por cédula y por el correo tecleado) aunque ya usara la cédula correcta.
    if limpiar_bloqueo is not None:
        for clave in {cuenta.cedula, cuenta.correo, (cuenta.correo or '').lower()} - {None, ''}:
            limpiar_bloqueo(str(clave))
    # `establecer_password` ya incrementa `permisos_version` (M2), lo que revoca
    # las sesiones abiertas. No hace falta un segundo incremento aquí.
    publicar(EventoIdentidad(
        tipo=TipoEventoIdentidad.PASSWORD_CAMBIADA, cedula=cuenta.cedula,
        motivo=MotivoCambioPassword.RESTABLECIDO_RRHH.value,
    ))
    return cuenta
