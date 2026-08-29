"""
Filtros de entrega del catálogo de permisos (B3.1).

Operan sobre entidades ya resueltas por los casos de uso — sin ORM en la capa
de presentación (regla B7). Cuando el catálogo crezca (B9), el repositorio
asumirá la paginación/filtrado server-side.
"""


def filtrar_permisos(permisos, texto: str | None = None) -> list:
    """
    Filtra entidades `Permiso` por coincidencia del texto (insensible a
    mayúsculas) contra código o nombre. Sin texto devuelve la lista tal cual.
    """
    if not texto or not texto.strip():
        return list(permisos)
    aguja = texto.strip().lower()
    return [
        p
        for p in permisos
        if aguja in p.codigo.valor.lower() or aguja in p.nombre.lower()
    ]
