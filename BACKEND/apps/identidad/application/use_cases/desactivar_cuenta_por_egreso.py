"""
Caso de uso: egreso sin pase a pasivo (renuncia, destitución, fin de contrato, fallecimiento).

Se invoca solo para un movimiento de egreso real y con la transacción ya confirmada. Si el trabajador no
tiene ninguna asignación (ni activa ni pasiva) su cuenta se desactiva —para cualquier rol— y las sesiones
se revocan al instante (el repositorio sube `permisos_version` al cambiar `is_active`). La baja queda
marcada como «por egreso» para poder revertirla en un reingreso (una baja manual no se revierte).
Un trabajador que pasa a pasivo o conserva un cargo NO se desactiva. Puro (B4).
"""
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.ports.repo_condicion_trabajador import RepoCondicionTrabajador
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from apps.identidad.domain.ports.repo_desactivacion_egreso import RepoDesactivacionEgreso
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador


def desactivar_cuenta_por_egreso(
    repo_cuentas: RepoCuentas,
    repo_condicion: RepoCondicionTrabajador,
    repo_marca: RepoDesactivacionEgreso,
    cedula: str,
    motivo: str = 'EGRESO',
) -> Cuenta | None:
    cedula = str(cedula or '').strip()
    if not cedula:
        return None
    if repo_condicion.condicion_por_cedula(cedula) is not CondicionTrabajador.SIN_ASIGNACION:
        return None
    cuenta = repo_cuentas.obtener_por_cedula(cedula)
    if cuenta is None or not cuenta.is_active:
        return None
    guardada = repo_cuentas.guardar(cuenta.desactivar())
    repo_marca.marcar(cuenta.id, motivo)
    return guardada
