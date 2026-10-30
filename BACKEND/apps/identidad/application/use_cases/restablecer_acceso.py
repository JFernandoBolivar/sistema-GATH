"""
Caso de uso: «Restablecer acceso» de RRHH (decisión F, D8).

Repone la cédula como contraseña inicial con 7 días nuevos, marca el cambio obligatorio (la contraseña
igual a la cédula lo activa en `debe_cambiar_password`), revoca las sesiones y avisa por correo. Puro (B4).
"""
from datetime import datetime
from typing import Callable

from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.events import EventoIdentidad, MotivoCambioPassword, TipoEventoIdentidad
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from apps.identidad.domain.ports.repo_password_inicial import RepoPasswordInicial
from apps.identidad.domain.ports.repo_permisos_version import RepoPermisosVersion
from apps.identidad.domain.services.politica_password_inicial import vencimiento_desde
from core.domain.exceptions import NotFoundError, ValidationError


def restablecer_acceso(
    repo_cuentas: RepoCuentas,
    repo_password_inicial: RepoPasswordInicial,
    repo_version: RepoPermisosVersion,
    publicar: Callable[[EventoIdentidad], None],
    cuenta_id: int,
    ahora: datetime,
) -> Cuenta:
    cuenta = repo_cuentas.obtener_por_id(cuenta_id)
    if cuenta is None:
        raise NotFoundError('El usuario no existe.')
    if not cuenta.is_active:
        raise ValidationError('La cuenta está desactivada: actívela antes de restablecer su acceso.')

    repo_cuentas.establecer_password(cuenta.id, cuenta.cedula)
    repo_password_inicial.emitir(cuenta.id, vencimiento_desde(ahora))
    repo_version.incrementar_cuenta(cuenta.id)  # revoca las sesiones abiertas
    publicar(EventoIdentidad(
        tipo=TipoEventoIdentidad.PASSWORD_CAMBIADA, cedula=cuenta.cedula,
        motivo=MotivoCambioPassword.RESTABLECIDO_RRHH.value,
    ))
    return cuenta
