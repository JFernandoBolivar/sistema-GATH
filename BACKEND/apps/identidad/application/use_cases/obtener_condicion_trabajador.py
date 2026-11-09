"""Caso de uso: condición (ACTIVO/PASIVO) del trabajador a partir de su cédula."""
from apps.identidad.domain.ports.repo_condicion_trabajador import RepoCondicionTrabajador
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador


def obtener_condicion_trabajador(repo: RepoCondicionTrabajador, cedula: str | None) -> CondicionTrabajador:
    cedula_limpia = str(cedula).strip() if cedula else ''
    if not cedula_limpia:
        return CondicionTrabajador.SIN_ASIGNACION
    return repo.condicion_por_cedula(cedula_limpia)
