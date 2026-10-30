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
- Los valores fuera de rango también son un 400: nunca deben llegar al ORM ni
  al cálculo de fechas (edad, enteros de PostgreSQL, decimales no finitos).
- Los rangos se validan (`desde` no puede ser posterior a `hasta`).
- `edad_min`/`edad_max` se convierten a fechas de nacimiento; `apn_min`/
  `apn_max` a decimales.
- `fecha_ingreso_*` y `fecha_apn_*` comparten ruta en el registro (así las
  definió el legado): sus valores se combinan por intersección
  (`__gte` → el mayor, `__lte` → el menor) en vez de pisarse.
- Filtrar por estructura organizativa exige `organizacion.ver`: la regla vive
  aquí (dominio) para que ninguna vista pueda saltársela. El permiso se evalúa
  fuera, con el motor IAM real, y se recibe como booleano ya resuelto.
"""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from core.domain.exceptions import PermissionDeniedError, ValidationError

from ..entities.consulta_reporte import ConsultaReportePersonal

# Claves del cuerpo de la petición que no son filtros del reporte.
CLAVES_DE_CONTROL = frozenset({
    'agrupar_por',
    'tipo_reporte',
    'categoria',
    'formato',
})

# Filtros que segmentan la plantilla por unidad organizativa.
FILTROS_DE_ESTRUCTURA = frozenset({
    'dependencia_id',
    'direccion_general_id',
    'direccion_linea_id',
    'coordinacion_id',
})

FILTROS_DE_EDAD = frozenset({'edad_min', 'edad_max'})
FILTROS_DECIMALES = frozenset({'apn_min', 'apn_max'})
FILTROS_DE_FECHA = frozenset({
    'fecha_ingreso_Desde',
    'fecha_ingreso_Hasta',
    'fecha_apn_Desde',
    'fecha_apn_Hasta',
})

# Límites de dominio de los valores numéricos. `int4` de PostgreSQL y una vida
# humana razonable: fuera de ahí el dato es un error del cliente, no del sistema.
EDAD_MINIMA_PERMITIDA = 0
EDAD_MAXIMA_PERMITIDA = 150
IDENTIFICADOR_MINIMO = 1
ENTERO_MAXIMO_EXCLUSIVO = 2**31
# Un decimal mayor que esto (años de servicio) no es un dato del dominio y
# desborda el `numeric` de PostgreSQL.
DECIMAL_MAXIMO_PERMITIDO = Decimal('1000000')

# Un año comercial no existe aquí: se compara con el calendario real.
_UN_DIA = timedelta(days=1)
_MENSAJE_EDAD_FUERA_DE_RANGO = (
    'El filtro de edad no permite calcular la fecha de nacimiento.'
)


def preparar_consulta_personal(
    filtros: dict | None,
    configuracion: dict | None,
    puede_filtrar_estructura: bool = False,
    hoy: date | None = None,
) -> ConsultaReportePersonal:
    """Valida los filtros crudos y los traduce a lookups del registro.

    `puede_filtrar_estructura` es el resultado ya evaluado del permiso
    `organizacion.ver` (el motor IAM vive en `apps.identidad`); el dominio
    decide con ese booleano y deniega si es falso.
    """
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

    _exigir_permiso_de_estructura(limpios, puede_filtrar_estructura)

    lookups: dict = {}
    for clave, valor in limpios.items():
        if clave in CLAVES_DE_CONTROL:
            continue
        _acumular(lookups, permitidos[clave], _convertir(clave, valor, referencia))

    _validar_rangos(lookups)

    tipo_reporte = str(limpios.get('tipo_reporte') or 'lista').strip().lower()

    agrupar_por, agrupar_por_ruta = _resolver_agrupacion(
        limpios.get('agrupar_por'), agrupaciones, tipo_reporte
    )

    # El tipo de reporte lo valida la entidad (`ConsultaReportePersonal`), que
    # es la dueña de esa invariante: aquí no se duplica el mensaje.
    return ConsultaReportePersonal(
        lookups=lookups,
        tipo_reporte=tipo_reporte,
        agrupar_por=agrupar_por,
        agrupar_por_ruta=agrupar_por_ruta,
    )


def _exigir_permiso_de_estructura(filtros: dict, puede_filtrar_estructura: bool) -> None:
    """403 si se piden filtros de estructura sin `organizacion.ver`."""
    if not FILTROS_DE_ESTRUCTURA.intersection(filtros):
        return
    if puede_filtrar_estructura:
        return
    raise PermissionDeniedError(
        'No tiene permiso para filtrar por estructura organizativa.'
    )


def _tiene_valor(valor) -> bool:
    return valor is not None and str(valor).strip() != ''


def _convertir(clave: str, valor, hoy: date):
    """Convierte el valor crudo al tipo que espera el lookup del registro."""
    texto = str(valor).strip()

    if clave in FILTROS_DE_EDAD:
        anios = _entero_en_rango(
            clave, texto, EDAD_MINIMA_PERMITIDA, EDAD_MAXIMA_PERMITIDA + 1
        )
        return _fecha_de_edad(clave, anios, hoy)

    if clave in FILTROS_DECIMALES:
        return _decimal(clave, texto)

    if clave in FILTROS_DE_FECHA:
        return _fecha(clave, texto)

    return _entero_en_rango(
        clave, texto, IDENTIFICADOR_MINIMO, ENTERO_MAXIMO_EXCLUSIVO
    )


def _entero_en_rango(clave: str, texto: str, minimo: int, maximo_exclusivo: int) -> int:
    """Entero escrito solo con dígitos ASCII dentro de `[minimo, maximo_exclusivo)`.

    `int()` acepta formas que no son un número escrito (``"1_0"`` → 10) y
    `str.isdigit()` acepta dígitos no ASCII (``"١٢٣"``, ``"１２３"``) que no son
    un identificador válido. Un entero mayor que `int4` desborda la consulta en
    PostgreSQL (500). Todos esos casos se rechazan aquí con un 400.
    """
    if not (texto.isascii() and texto.isdigit()):
        raise ValidationError(f'El filtro «{clave}» debe ser un número entero.')
    try:
        valor = int(texto)
    except (ValueError, OverflowError) as exc:
        # Python limita la conversión de cadenas de miles de dígitos.
        raise ValidationError(
            f'El filtro «{clave}» debe ser un número entero.'
        ) from exc
    if not minimo <= valor < maximo_exclusivo:
        raise ValidationError(
            f'El filtro «{clave}» debe estar entre {minimo} y {maximo_exclusivo - 1}.'
        )
    return valor


def _decimal(clave: str, texto: str) -> Decimal:
    """Decimal finito y dentro de un rango representable (400 si no lo es)."""
    try:
        valor = Decimal(texto)
    except (InvalidOperation, ValueError, ArithmeticError):
        raise ValidationError(f'El filtro «{clave}» debe ser un número.')
    if not valor.is_finite():
        raise ValidationError(f'El filtro «{clave}» debe ser un número finito.')
    try:
        fuera_de_rango = abs(valor) > DECIMAL_MAXIMO_PERMITIDO
    except (ArithmeticError, OverflowError) as exc:
        raise ValidationError(f'El filtro «{clave}» no es un número válido.') from exc
    if fuera_de_rango:
        raise ValidationError(
            f'El filtro «{clave}» debe estar entre -{DECIMAL_MAXIMO_PERMITIDO} '
            f'y {DECIMAL_MAXIMO_PERMITIDO}.'
        )
    return valor


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
    anio = fecha.year - anios
    try:
        return fecha.replace(year=anio)
    except ValueError:
        # 29 de febrero: se ajusta al 28 solo en ese caso; cualquier otro
        # ValueError significa un año fuera del rango representable.
        if fecha.month == 2 and fecha.day == 29:
            try:
                return fecha.replace(year=anio, day=28)
            except (ValueError, OverflowError) as exc:
                raise ValidationError(_MENSAJE_EDAD_FUERA_DE_RANGO) from exc
        raise ValidationError(_MENSAJE_EDAD_FUERA_DE_RANGO)
    except OverflowError as exc:
        raise ValidationError(_MENSAJE_EDAD_FUERA_DE_RANGO) from exc


def _acumular(lookups: dict, ruta: str, valor) -> None:
    """Combina dos filtros que el registro mapea a la misma ruta (intersección)."""
    if ruta not in lookups:
        lookups[ruta] = valor
        return
    try:
        if ruta.endswith('__gte'):
            lookups[ruta] = max(lookups[ruta], valor)
            return
        if ruta.endswith('__lte'):
            lookups[ruta] = min(lookups[ruta], valor)
            return
    except (ArithmeticError, OverflowError) as exc:
        raise ValidationError(
            f'Los valores de los filtros que usan «{ruta}» no son comparables.'
        ) from exc
    if lookups[ruta] != valor:
        raise ValidationError(f'Los filtros que usan «{ruta}» se contradicen.')


def _validar_rangos(lookups: dict) -> None:
    for ruta, valor in lookups.items():
        if not ruta.endswith('__gte'):
            continue
        hasta = lookups.get(f'{ruta[:-len("__gte")]}__lte')
        if hasta is None:
            continue
        try:
            invalido = valor > hasta
        except (ArithmeticError, OverflowError) as exc:
            raise ValidationError(
                'El rango de fechas o de valores no se puede comparar.'
            ) from exc
        if invalido:
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
