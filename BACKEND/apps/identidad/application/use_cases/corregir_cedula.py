"""
Caso de uso: corregir la cédula de un trabajador (solo superadministrador).

Puro (B4): repositorios, transacción, auditoría y limpieza de cachés se inyectan. La reescritura
de las tablas la hace el puerto `RepoCorreccionCedula`; aquí se decide el efecto sobre la cuenta:
si la clave sigue siendo la inicial (la cédula) pasa a ser la nueva; si no, se conserva. Siempre se
sube `permisos_version` para cerrar las sesiones. No se envía correo.
"""
import re
from datetime import datetime
from typing import Callable, ContextManager

from apps.identidad.application.use_cases.obtener_condicion_trabajador import (
    obtener_condicion_trabajador,
)
from apps.identidad.domain.entities.correccion_cedula import (
    CuentaCorreccion,
    ResultadoCorreccion,
    TrabajadorCorreccion,
    VistaPreviaCorreccion,
)
from apps.identidad.domain.ports.repo_condicion_trabajador import RepoCondicionTrabajador
from apps.identidad.domain.ports.repo_correccion_cedula import RepoCorreccionCedula
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from apps.identidad.domain.ports.repo_password_inicial import RepoPasswordInicial
from apps.identidad.domain.ports.repo_permisos_version import RepoPermisosVersion
from apps.identidad.domain.services.politica_password_inicial import vencimiento_desde
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

MOTIVO_MIN = 10
MOTIVO_MAX = 500
_FORMATO = re.compile(r'^\d{6,9}$')


def validar_cedulas(cedula_actual: str, cedula_nueva: str) -> tuple[str, str]:
    actual, nueva = str(cedula_actual or '').strip(), str(cedula_nueva or '').strip()
    for valor in (actual, nueva):
        if not _FORMATO.match(valor):
            raise ValidationError('La cédula debe tener solo dígitos, de 6 a 9.')
    if actual == nueva:
        raise ValidationError('La cédula nueva no puede ser igual a la actual.')
    return actual, nueva


def _validar_motivo(motivo: str) -> str:
    motivo = str(motivo or '').strip()
    if not MOTIVO_MIN <= len(motivo) <= MOTIVO_MAX:
        raise ValidationError(f'El motivo debe tener de {MOTIVO_MIN} a {MOTIVO_MAX} caracteres.')
    return motivo


def _exigir_trabajador_y_libre(repo: RepoCorreccionCedula, actual: str, nueva: str) -> str:
    nombre = repo.obtener_nombre(actual)
    if nombre is None:
        raise NotFoundError('No existe un trabajador con esa cédula.')
    if repo.existe_cedula(nueva):
        raise ConflictError(f'La cédula {nueva} ya está registrada.')
    return nombre


def previsualizar_correccion_cedula(
    repo: RepoCorreccionCedula,
    repo_condicion: RepoCondicionTrabajador,
    repo_cuentas: RepoCuentas,
    repo_password_inicial: RepoPasswordInicial,
    cedula_actual: str,
    cedula_nueva: str,
) -> VistaPreviaCorreccion:
    actual, nueva = validar_cedulas(cedula_actual, cedula_nueva)
    nombre = _exigir_trabajador_y_libre(repo, actual, nueva)
    cuenta = repo_cuentas.obtener_por_cedula(actual)
    return VistaPreviaCorreccion(
        trabajador=TrabajadorCorreccion(
            cedula_actual=actual,
            nombre=nombre,
            condicion=obtener_condicion_trabajador(repo_condicion, actual).value,
        ),
        cedula_nueva=nueva,
        cuenta=CuentaCorreccion(
            existe=cuenta is not None,
            correo=cuenta.correo if cuenta else None,
            clave_inicial_pendiente=bool(
                cuenta and repo_password_inicial.vencimiento(cuenta.id) is not None
            ),
        ),
        afectados=tuple(repo.contar_afectados(actual)),
    )


def corregir_cedula(
    repo: RepoCorreccionCedula,
    repo_cuentas: RepoCuentas,
    repo_password_inicial: RepoPasswordInicial,
    repo_version: RepoPermisosVersion,
    *,
    atomico: Callable[[], ContextManager],
    auditar: Callable[[dict, dict], None],
    invalidar_caches: Callable[[str, str, str | None, int | None], None],
    ahora: datetime,
    dias_vigencia: int,
    cedula_actual: str,
    cedula_nueva: str,
    motivo: str,
    confirmacion: str,
) -> ResultadoCorreccion:
    actual, nueva = validar_cedulas(cedula_actual, cedula_nueva)
    motivo = _validar_motivo(motivo)
    if str(confirmacion or '').strip() != nueva:
        raise ValidationError('La confirmación debe ser igual a la cédula nueva.')

    with atomico():
        nombre = _exigir_trabajador_y_libre(repo, actual, nueva)
        cuenta = repo_cuentas.obtener_por_cedula(actual)
        clave_inicial = bool(cuenta and repo_password_inicial.vencimiento(cuenta.id) is not None)

        afectados = tuple(repo.aplicar(actual, nueva))

        version = None
        if cuenta is not None:
            if clave_inicial:
                # `establecer_password` sube `permisos_version` y borra la fila inicial: se reemite.
                repo_cuentas.establecer_password(cuenta.id, nueva)
                repo_password_inicial.emitir(cuenta.id, vencimiento_desde(ahora, dias_vigencia))
                version = repo_version.obtener(cuenta.id)
            else:
                version = repo_version.incrementar_cuenta(cuenta.id)

        resultado = ResultadoCorreccion(
            cedula_anterior=actual,
            cedula_nueva=nueva,
            afectados=afectados,
            clave_inicial_actualizada=clave_inicial,
        )
        auditar(
            {'cedula': actual},
            {
                'cedula': nueva,
                'nombre': nombre,
                'afectados': [{'tabla': t, 'registros': n} for t, n in afectados],
                'total_registros': resultado.total_registros,
                'clave_inicial_actualizada': clave_inicial,
                'motivo': motivo,
            },
        )

    invalidar_caches(actual, nueva, cuenta.correo if cuenta else None, version)
    return resultado
