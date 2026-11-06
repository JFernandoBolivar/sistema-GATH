"""
Reglas de negocio puras del alta/edición de un familiar (Regla D-09: casos
de uso testeables sin BD).

`resolver_cedula_familiar` es la ÚNICA implementación de la regla de cédula
sintética para hijos menores de 9 años. La usan el registro de familiares, los
borradores/solicitudes de autogestión y la fe de vida.
"""
from datetime import date

# Único criterio del parentesco de hijo(a): el catálogo usa "HIJO (A)" y
# variantes; se compara por prefijo, sin literales dispersos.
PREFIJO_PARENTESCO_HIJO = 'HIJO'


def es_parentesco_hijo(nombre: str | None) -> bool:
    return (nombre or '').strip().upper().startswith(PREFIJO_PARENTESCO_HIJO)

EDAD_MAXIMA_HIJO_SIN_CEDULA = 9
ORDEN_HIJO_MIN = 1
ORDEN_HIJO_MAX = 99


def es_menor_de_9_anios(fecha_nacimiento: date, hoy: date | None = None) -> bool:
    hoy = hoy or date.today()
    return hoy.year - fecha_nacimiento.year - ((hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day)) < EDAD_MAXIMA_HIJO_SIN_CEDULA


def resolver_cedula_familiar(
    *,
    cedula_familiar: str | None,
    cedula_empleado: str,
    es_hijo: bool,
    fecha_nacimiento: date | None,
    orden_hijo: int | None = None,
    cedulas_existentes: set[str] | frozenset[str] = frozenset(),
) -> str:
    """
    Devuelve la cédula a usar para el familiar.

    - Si viene una cédula propia, se valida contra la del empleado.
    - Si no viene, solo se permite para un(a) "HIJO (A)" menor de 9 años y
      exige el orden de nacimiento elegido: ``<cédula del empleado>-<orden>``.
    - Si la cédula resultante ya existe para ese titular, se lanza el mensaje
      original del legado.

    Lanza `ValueError` si no se puede resolver.
    """
    cedula = (cedula_familiar or '').strip() or None
    if cedula:
        if cedula == cedula_empleado.strip():
            raise ValueError('La cédula del familiar no puede ser igual a la cédula del trabajador.')
        return cedula

    if es_hijo and fecha_nacimiento and es_menor_de_9_anios(fecha_nacimiento):
        if orden_hijo is None:
            raise ValueError('El orden de nacimiento es obligatorio para un(a) hijo(a) menor de 9 años.')
        if not (ORDEN_HIJO_MIN <= int(orden_hijo) <= ORDEN_HIJO_MAX):
            raise ValueError(f'El orden de nacimiento debe estar entre {ORDEN_HIJO_MIN} y {ORDEN_HIJO_MAX}.')
        nueva = f"{cedula_empleado.strip()}-{int(orden_hijo)}"
        if len(nueva) > 10:
            raise ValueError(
                'La cédula del familiar no puede superar 10 caracteres; elija un orden de nacimiento menor.'
            )
        if nueva in cedulas_existentes:
            raise ValueError('El trabajador ya tiene un hijo registrado con el orden ingresado')
        return nueva
    raise ValueError('La cédula es obligatoria, salvo para un(a) hijo(a) menor de 9 años.')


def validar_cedula_no_duplicada(cedula: str, cedulas_existentes: set[str]) -> None:
    if cedula in cedulas_existentes:
        raise ValueError('Este familiar ya se encuentra registrado para este empleado.')


def validar_heredero_unico(heredero: bool, ya_existe_heredero: bool) -> None:
    if heredero and ya_existe_heredero:
        raise ValueError('Este trabajador ya posee un familiar registrado como heredero.')
