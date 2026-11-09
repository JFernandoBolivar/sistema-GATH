"""Listado de solo lectura de los tipos de soporte permitidos por sección (O41)."""
from __future__ import annotations

from apps.autogestion.domain.ports.repo_soporte_configuracion import RepoSoporteConfiguracion


def listar_tipos_soporte_permitidos(repo: RepoSoporteConfiguracion) -> list[dict]:
    """Tipos que el trabajador puede subir en cada sección, en el orden del catálogo."""
    return [
        {
            'seccion': fila.seccion,
            'codigo': fila.codigo,
            'nombre': fila.etiqueta,
            'requerido': fila.requerido,
            'orden': fila.orden,
        }
        for fila in repo.listar_checklist()
        if fila.permitido
    ]
