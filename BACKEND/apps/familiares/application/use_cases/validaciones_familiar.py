"""
Reglas de negocio puras del alta/edición de un familiar (Regla D-09: casos
de uso testeables sin BD).

`resolver_cedula_familiar` es la ÚNICA implementación de la regla de cédula
sintética para hijos y menores a cargo. La usan el registro de familiares, los
borradores/solicitudes de autogestión y la carga masiva.

FIX-FAM2: las reglas viven en el catálogo de parentescos (Gestión del sistema)
y llegan aquí como `ReglaParentescoFamiliar`. El dominio no consulta Django.
"""
import re
from dataclasses import dataclass
from datetime import date

from apps.familiares.domain.entities.familiar import CEDULA_FAMILIAR_MAX
from apps.familiares.domain.value_objects.regla_parentesco import (  # noqa: F401 (reexport)
    ReglaParentescoFamiliar,
)

# Compatibilidad con llamadores antiguos: el prefijo ya no decide la regla,
# pero se conserva el helper para no romper pruebas o integraciones externas.
PREFIJO_PARENTESCO_HIJO = 'HIJO'

EDAD_MAXIMA_HIJO_SIN_CEDULA = 9
ORDEN_HIJO_MIN = 1
ORDEN_HIJO_MAX = 99
EDAD_MAXIMA_FAMILIAR = 120


def regla_por_defecto(descripcion: str | None) -> ReglaParentescoFamiliar:
    """Respaldo para filas legadas creadas antes de configurar sus reglas.

    La fuente de verdad es la regla guardada en Gestión del sistema; esto solo
    evita romper la lectura de parentescos históricos mientras se configuran.
    """
    nombre = ' '.join((descripcion or '').split()).upper()
    if 'HIJO' in nombre or 'HIJA' in nombre:
        return ReglaParentescoFamiliar(
            descripcion=descripcion or '',
            es_hijo=True,
            sin_cedula_hasta_edad=9,
            diferencia_minima=12,
            diferencia_tipo='MENOR',
            soporte_sugerido='PARTIDA DE NACIMIENTO',
        )
    if 'TUTELADO' in nombre or 'TUTELADA' in nombre:
        return ReglaParentescoFamiliar(
            descripcion=descripcion or '',
            menor_a_cargo=True,
            sin_cedula_hasta_edad=9,
            diferencia_minima=12,
            diferencia_tipo='MENOR',
            soporte_sugerido='SENTENCIA DE TUTELA',
        )
    if 'CONYUGE' in nombre or 'CÓNYUGE' in nombre:
        return ReglaParentescoFamiliar(
            descripcion=descripcion or '',
            edad_minima=18,
            soporte_sugerido='ACTA DE MATRIMONIO',
        )
    if nombre == 'MADRE':
        return ReglaParentescoFamiliar(
            descripcion=descripcion or '',
            sexo_permitido='F',
            diferencia_minima=12,
            diferencia_tipo='MAYOR',
            soporte_sugerido='PARTIDA DE NACIMIENTO',
        )
    if nombre == 'PADRE':
        return ReglaParentescoFamiliar(
            descripcion=descripcion or '',
            sexo_permitido='M',
            diferencia_minima=12,
            diferencia_tipo='MAYOR',
            soporte_sugerido='PARTIDA DE NACIMIENTO',
        )
    return ReglaParentescoFamiliar(descripcion=descripcion or '')


def es_parentesco_hijo(nombre: str | None) -> bool:
    """Compatibilidad. La decisión real usa `ReglaParentescoFamiliar.es_hijo`."""
    return (nombre or '').strip().upper().startswith(PREFIJO_PARENTESCO_HIJO)


def es_cedula_correlativa(cedula: str | None, cedula_titular: str) -> bool:
    """`<cedula del titular>-<orden>`: solo lo genera el sistema, no se escribe a mano."""
    return bool(
        (cedula or '').strip()
        and re.fullmatch(rf'{re.escape(cedula_titular.strip())}-\d+', (cedula or '').strip())
    )


def edad_en_anios(fecha_nacimiento: date, hoy: date | None = None) -> int:
    hoy = hoy or date.today()
    return hoy.year - fecha_nacimiento.year - (
        (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    )


def es_menor_de_edad(
    fecha_nacimiento: date, edad_maxima: int, hoy: date | None = None,
) -> bool:
    return edad_en_anios(fecha_nacimiento, hoy) < edad_maxima


def es_menor_de_9_anios(fecha_nacimiento: date, hoy: date | None = None) -> bool:
    """Compatibilidad con llamadores antiguos; usa `es_menor_de_edad`."""
    return es_menor_de_edad(fecha_nacimiento, EDAD_MAXIMA_HIJO_SIN_CEDULA, hoy)


def _sexo_permitido(sexo: str | None) -> str:
    """Normaliza el sexo a M/F aceptando nombres ('MASCULINO', 'FEMENINO')."""
    texto = (sexo or '').strip().upper()
    if texto.startswith('M'):
        return 'M'
    if texto.startswith('F'):
        return 'F'
    return ''


def violaciones_reglas_familiar(
    *,
    regla: ReglaParentescoFamiliar,
    fecha_nacimiento: date | None,
    fecha_nacimiento_titular: date | None = None,
    sexo: str | None = None,
    hoy: date | None = None,
) -> list[str]:
    """Devuelve todas las reglas que incumple el familiar (vacío si cumple)."""
    hoy = hoy or date.today()
    problemas: list[str] = []
    if fecha_nacimiento is None:
        return ['La fecha de nacimiento es obligatoria.']
    if fecha_nacimiento > hoy:
        problemas.append('La fecha de nacimiento no puede ser futura.')
    edad = edad_en_anios(fecha_nacimiento, hoy)
    if edad > EDAD_MAXIMA_FAMILIAR:
        problemas.append(
            f'La fecha de nacimiento no puede superar {EDAD_MAXIMA_FAMILIAR} años.'
        )
    if regla.edad_minima is not None and edad < regla.edad_minima:
        problemas.append(
            f'El parentesco «{regla.descripcion}» exige al menos {regla.edad_minima} años.'
        )
    if (
        regla.diferencia_minima is not None
        and regla.diferencia_tipo in ('MENOR', 'MAYOR')
        and fecha_nacimiento_titular is not None
    ):
        edad_titular = edad_en_anios(fecha_nacimiento_titular, hoy)
        if regla.diferencia_tipo == 'MENOR':
            diferencia = edad_titular - edad
            if diferencia < regla.diferencia_minima:
                problemas.append(
                    f'El familiar debe ser al menos {regla.diferencia_minima} años '
                    f'menor que el titular (diferencia actual: {diferencia}).'
                )
        else:
            diferencia = edad - edad_titular
            if diferencia < regla.diferencia_minima:
                problemas.append(
                    f'El familiar debe ser al menos {regla.diferencia_minima} años '
                    f'mayor que el titular (diferencia actual: {diferencia}).'
                )
    permitido = _sexo_permitido(regla.sexo_permitido)
    if permitido and _sexo_permitido(sexo) != permitido:
        etiqueta = 'femenino' if permitido == 'F' else 'masculino'
        problemas.append(
            f'El parentesco «{regla.descripcion}» solo admite sexo {etiqueta}.'
        )
    return problemas


def validar_reglas_familiar(**kwargs) -> None:
    """Lanza `ValueError` con la primera violación de las reglas del parentesco."""
    problemas = violaciones_reglas_familiar(**kwargs)
    if problemas:
        raise ValueError(problemas[0])


def resolver_cedula_familiar(
    *,
    cedula_familiar: str | None,
    cedula_empleado: str,
    es_hijo: bool | None = None,
    fecha_nacimiento: date | None,
    orden_hijo: int | None = None,
    cedulas_existentes: set[str] | frozenset[str] = frozenset(),
    regla: ReglaParentescoFamiliar | None = None,
) -> str:
    """
    Devuelve la cédula a usar para el familiar.

    - Si viene una cédula propia, se valida contra la del empleado.
    - Si no viene, solo se permite cuando la regla del parentesco marca
      `es_hijo` o `menor_a_cargo` y el familiar no supera
      `sin_cedula_hasta_edad`: se genera ``<cédula del empleado>-<orden>``.
    - El orden debe caber en `CEDULA_FAMILIAR_MAX`; hijos y tutelados comparten
      la misma secuencia porque usan el mismo prefijo.

    Lanza `ValueError` si no se puede resolver.
    """
    cedula = (cedula_familiar or '').strip() or None
    if cedula:
        if cedula == cedula_empleado.strip():
            raise ValueError(
                'No se puede generar la cédula del hijo con la cédula del titular; '
                'registre la cédula propia del hijo.'
            )
        if re.search(r'\d+-\d+', cedula) or ('-' in cedula and not cedula.startswith(('V-', 'E-', 'v-', 'e-'))):
            raise ValueError(
                'El formato de cédula correlativa (titular-orden) solo se genera '
                'automáticamente para hijos o tutelados menores sin cédula; '
                'no puede escribirse manualmente.'
            )
        return cedula

    regla = regla or ReglaParentescoFamiliar(es_hijo=bool(es_hijo))
    permite = regla.permite_cedula_sintetica
    edad_maxima = regla.sin_cedula_hasta_edad
    if regla.es_hijo and edad_maxima is None:
        edad_maxima = EDAD_MAXIMA_HIJO_SIN_CEDULA
    if (
        permite
        and edad_maxima is not None
        and fecha_nacimiento is not None
        and es_menor_de_edad(fecha_nacimiento, edad_maxima)
    ):
        if orden_hijo is None:
            raise ValueError(
                f'El orden de nacimiento es obligatorio para un(a) hijo(a) o '
                f'menor a cargo de {edad_maxima} años o menos.'
            )
        if not (ORDEN_HIJO_MIN <= int(orden_hijo) <= ORDEN_HIJO_MAX):
            raise ValueError(
                f'El orden de nacimiento debe estar entre {ORDEN_HIJO_MIN} y {ORDEN_HIJO_MAX}.'
            )
        nueva = f'{cedula_empleado.strip()}-{int(orden_hijo)}'
        if len(nueva) > CEDULA_FAMILIAR_MAX:
            raise ValueError(
                f'La cédula del familiar no puede superar {CEDULA_FAMILIAR_MAX} caracteres; '
                'elija un orden de nacimiento menor.'
            )
        if nueva in cedulas_existentes:
            raise ValueError('El trabajador ya tiene un hijo o menor a cargo con el orden ingresado')
        return nueva
    raise ValueError(
        'La cédula es obligatoria, salvo para un(a) hijo(a) o menor a cargo que '
        'cumpla la edad configurada en el parentesco.'
    )


def validar_cedula_no_duplicada(cedula: str, cedulas_existentes: set[str]) -> None:
    if cedula in cedulas_existentes:
        raise ValueError('Este familiar ya se encuentra registrado para este empleado.')


def validar_heredero_unico(heredero: bool, ya_existe_heredero: bool) -> None:
    if heredero and ya_existe_heredero:
        raise ValueError('Este trabajador ya posee un familiar registrado como heredero.')
