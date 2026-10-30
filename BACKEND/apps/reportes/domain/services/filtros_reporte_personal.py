"""
Preparación pura de los filtros del reporte de personal (B5, B10).

Traduce los filtros que envía el formulario (`report-employees.tsx`,
~30 claves) a los lookups del registro de campos (`ReportFieldRegistry`,
R-06), que es la única fuente de verdad del mapeo filtro → ORM. Aquí no hay
Django: la función recibe la configuración del registro y devuelve una
`ConsultaReportePersonal`.

Reglas:
- Una clave de filtro que el registro no conoce es un **error explícito**
  (400), no un descarte silencioso.
- Los rangos se validan (`desde` no puede ser posterior a `hasta`).
- `edad_min`/`edad_max` se convierten a fechas de nacimiento; `apn_min`/
  `apn_max` a decimales.
- `fecha_ingreso_*` y `fecha_apn_*` comparten ruta en el registro (así las
  definió el legado): sus valores se combinan por intersección
  (`__gte` → el mayor, `__lte` → el menor) en vez de pisarse.
"""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from core.domain.exceptions import ValidationError

from ..entities.consulta_reporte import TIPOS_REPORTE, ConsultaReportePersonal

# Claves del cuerpo de la petición que no son filtros del reporte.
CLAVES_DE_CONTROL = frozenset({
    'agrupar_por',
    'tipo_reporte',
    'categoria',
    'formato',
})

FILTROS_DE_EDAD = frozenset({'edad_min', 'edad_max'})
FILTROS_DECIMALES = frozenset({'apn_min', 'apn_max'})
FILTROS_DE_FECHA = frozenset({
    'fecha_ingreso_Desde',
    'fecha_ingreso_Hasta',
    'fecha_apn_Desde',
    'fecha_apn_Hasta',
})

# Un año comercial no existe aquí: se compara con el calendario real.
_UN_DIA = timedelta(days=1)


def preparar_consulta_personal(
    filtros: dict | None,
    configuracion: dict | None,
    hoy: date | None = None,
) -> ConsultaReportePersonal:
    """Valida los filtros crudos y los traduce a lookups del registro."""
    if not configuracion:
        raise ValidationError('El reporte de personal no está configurado.')

    permitidos: dict = configuracion.get('filtros_permitidos') or {}
    agrupaciones: dict = configuracion.get('campos_permitidos') or {}
    referencia = hoy or date.today()

    limpios = {
        clave: valor
        for clave, valor in (filtros or {}).items()
        if _tiene_valor(valor)
    }

    desconocidos = sorted(
        clave
        for clave in limpios
        if clave not in CLAVES_DE_CONTROL and clave not in permitidos
    )
    if desconocidos:
        raise ValidationError(
            'Filtros no válidos para el reporte de personal: '
            f'{", ".join(desconocidos)}.'
        )

    lookups: dict = {}
    for clave, valor in limpios.items():
        if clave in CLAVES_DE_CONTROL:
            continue
        _acumular(lookups, permitidos[clave], _convertir(clave, valor, referencia))

    _validar_rangos(lookups)

    tipo_reporte = str(limpios.get('tipo_reporte') or 'lista').strip().lower()
    if tipo_reporte not in TIPOS_REPORTE:
        raise ValidationError(
            f'Tipo de reporte no válido: {tipo_reporte}. '
            f'Opciones: {", ".join(TIPOS_REPORTE)}.'
        )

    agrupar_por, agrupar_por_ruta = _resolver_agrupacion(
        limpios.get('agrupar_por'), agrupaciones, tipo_reporte
    )

    return ConsultaReportePersonal(
        lookups=lookups,
        tipo_reporte=tipo_reporte,
        agrupar_por=agrupar_por,
        agrupar_por_ruta=agrupar_por_ruta,
    )


def _tiene_valor(valor) -> bool:
    return valor is not None and str(valor).strip() != ''


def _convertir(clave: str, valor, hoy: date):
    """Convierte el valor crudo al tipo que espera el lookup del registro."""
    texto = str(valor).strip()

    if clave in FILTROS_DE_EDAD:
        anios = _entero(clave, texto)
        if anios < 0:
            raise ValidationError(f'El filtro «{clave}» no puede ser negativo.')
        return _fecha_de_edad(clave, anios, hoy)

    if clave in FILTROS_DECIMALES:
        try:
            return Decimal(texto)
        except (InvalidOperation, ValueError):
            raise ValidationError(f'El filtro «{clave}» debe ser un número.')

    if clave in FILTROS_DE_FECHA:
        return _fecha(clave, texto)

    return _entero(clave, texto)


def _entero(clave: str, texto: str) -> int:
    try:
        return int(texto)
    except (TypeError, ValueError):
        raise ValidationError(f'El filtro «{clave}» debe ser un número entero.')


def _fecha(clave: str, texto: str) -> date:
    try:
        return date.fromisoformat(texto[:10])
    except ValueError:
        raise ValidationError(
            f'El filtro «{clave}» debe ser una fecha con formato AAAA-MM-DD.'
        )


def _fecha_de_edad(clave: str, anios: int, hoy: date) -> date:
    """`edad_min` → nacido en o antes de hoy − n años; `edad_max` → después."""
    if clave == 'edad_min':
        return _restar_anios(hoy, anios)
    # Cumplir «edad_max» significa haber nacido después de hoy − (n + 1) años.
    return _restar_anios(hoy, anios + 1) + _UN_DIA


def _restar_anios(fecha: date, anios: int) -> date:
    try:
        return fecha.replace(year=fecha.year - anios)
    except ValueError:  # 29 de febrero en un año no bisiesto
        return fecha.replace(year=fecha.year - anios, day=28)


def _acumular(lookups: dict, ruta: str, valor) -> None:
    """Combina dos filtros que el registro mapea a la misma ruta (intersección)."""
    if ruta not in lookups:
        lookups[ruta] = valor
        return
    if ruta.endswith('__gte'):
        lookups[ruta] = max(lookups[ruta], valor)
        return
    if ruta.endswith('__lte'):
        lookups[ruta] = min(lookups[ruta], valor)
        return
    if lookups[ruta] != valor:
        raise ValidationError(f'Los filtros que usan «{ruta}» se contradicen.')


def _validar_rangos(lookups: dict) -> None:
    for ruta, valor in lookups.items():
        if not ruta.endswith('__gte'):
            continue
        hasta = lookups.get(f'{ruta[:-len("__gte")]}__lte')
        if hasta is not None and valor > hasta:
            raise ValidationError(
                'El rango de fechas o de valores es inválido: '
                'el extremo inicial es posterior al final.'
            )


def _resolver_agrupacion(
    agrupar_por, agrupaciones: dict, tipo_reporte: str
) -> tuple[str | None, str | None]:
    if not _tiene_valor(agrupar_por):
        if tipo_reporte == 'conteo':
            raise ValidationError(
                'Indique el campo de agrupación («agrupar_por») para un reporte de conteo.'
            )
        return None, None

    clave = str(agrupar_por).strip()
    if clave not in agrupaciones:
        raise ValidationError(
            f'No se puede agrupar por «{clave}». '
            f'Opciones: {", ".join(sorted(agrupaciones))}.'
        )
    ruta = agrupaciones[clave]
    if tipo_reporte == 'conteo' and not ruta:
        raise ValidationError(f'El campo «{clave}» no sirve para agrupar el conteo.')
    return clave, ruta
