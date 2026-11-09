"""
Filtros del listado de personal activo (Fase 2 de PLAN_REPARACION_GATH).

Traduce los query params de `GET /api/v1/personal/` a los criterios que
recibe el caso de uso `listar_personal` — sin ORM en la capa de
presentación (regla B7, mismo patrón que `apps.identidad`). El filtrado
real lo hace `RepoPersonalORM.listar_empleados` sobre las asignaciones.
"""
from core.domain.exceptions import ValidationError

# Estructura organizativa del cargo asignado (FK de `AsigTrabajoModel`).
FILTROS_ESTRUCTURA = (
    'dependencia_id',
    'direccion_general_id',
    'direccion_linea_id',
    'coordinacion_id',
)


def _entero(nombre: str, valor: str | None) -> int | None:
    if valor is None or not str(valor).strip():
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValidationError(f"El filtro '{nombre}' debe ser un id numérico (recibido: '{valor}').")


PAGINA_POR_DEFECTO = 10
TAMANO_PAGINA_POR_DEFECTO = 10
TAMANO_PAGINA_MAXIMO = 50


def _entero_positivo(nombre: str, valor: str | None, defecto: int) -> int:
    if valor is None or not str(valor).strip():
        return defecto
    try:
        numero = int(valor)
    except (TypeError, ValueError):
        raise ValidationError(
            f"El parámetro '{nombre}' debe ser un número entero (recibido: '{valor}')."
        )
    return max(numero, 1)


def paginacion_listado(query_params) -> dict:
    """`page` (1-based) y `page_size` (tope 50); `limit` se acepta como alias.

    Fuera de rango se acota (página mínima 1, tamaño máximo 50); un valor no
    numérico responde 400 en vez de ignorarse en silencio.
    """
    page = _entero_positivo('page', query_params.get('page'), 1)
    bruto = query_params.get('page_size') or query_params.get('limit')
    page_size = _entero_positivo('page_size', bruto, TAMANO_PAGINA_POR_DEFECTO)
    return {'page': page, 'page_size': min(page_size, TAMANO_PAGINA_MAXIMO)}


def filtros_listado_personal(query_params) -> dict:
    """
    Devuelve los kwargs de `listar_personal`. Acepta `q`/`busqueda`/
    `cedulaidentidad` (texto libre), `codigo`, `tipo_nomina` y los ids de
    `FILTROS_ESTRUCTURA`; un id no numérico es un error 400 explícito en vez
    de ignorarse en silencio.
    """
    busqueda = (
        query_params.get('q')
        or query_params.get('busqueda')
        or query_params.get('cedulaidentidad')
    )
    filtros = {
        'busqueda': busqueda,
        'codigo': query_params.get('codigo'),
        'tipo_nomina': query_params.get('tipo_nomina'),
    }
    for nombre in FILTROS_ESTRUCTURA:
        filtros[nombre] = _entero(nombre, query_params.get(nombre))
    return filtros
