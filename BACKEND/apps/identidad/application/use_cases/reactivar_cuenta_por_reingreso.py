"""
Caso de uso: reingreso. Si el trabajador vuelve a ser ACTIVO y su cuenta fue desactivada POR UN EGRESO
(marca propia), se reactiva sola. Una cuenta desactivada a mano por un administrador no se toca. Puro (B4).
"""
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.ports.repo_condicion_trabajador import RepoCondicionTrabajador
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from apps.identidad.domain.ports.repo_desactivacion_egreso import RepoDesactivacionEgreso
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador


def reactivar_cuenta_por_reingreso(
    repo_cuentas: RepoCuentas,
    repo_condicion: RepoCondicionTrabajador,
    repo_marca: RepoDesactivacionEgreso,
    cedula: str,
) -> Cuenta | None:
    cedula = str(cedula or '').strip()
    if not cedula:
        return None
    cuenta = repo_cuentas.obtener_por_cedula(cedula)
    if cuenta is None or cuenta.is_active or not repo_marca.existe(cuenta.id):
        return None
    if repo_condicion.condicion_por_cedula(cedula) is not CondicionTrabajador.ACTIVO:
        return None
    guardada = repo_cuentas.guardar(cuenta.activar())
    repo_marca.limpiar(cuenta.id)
    return guardada
