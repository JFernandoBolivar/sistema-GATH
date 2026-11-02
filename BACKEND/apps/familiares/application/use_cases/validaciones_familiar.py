"""
Reglas de negocio puras del alta/edición de un familiar (Regla D-09: casos
de uso testeables sin BD). Réplica funcional de
`RAC/services/family_services.py` del legado, separada del serializer para
poder testearse con datos en memoria en vez de contra la base real.
"""
from datetime import date


def es_menor_de_9_anios(fecha_nacimiento: date, hoy: date | None = None) -> bool:
    hoy = hoy or date.today()
    return hoy.year - fecha_nacimiento.year - ((hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day)) < 9


def resolver_cedula_familiar(
    *,
    cedula_familiar: str | None,
    cedula_empleado: str,
    es_hijo: bool,
    fecha_nacimiento: date | None,
    siguiente_orden_hijo: int,
) -> str:
    """
    Devuelve la cédula a usar para el familiar. Si viene una cédula propia,
    la valida contra la del empleado; si no viene ninguna, solo se permite
    para un(a) "HIJO (A)" menor de 9 años, generando una sintética
    "<cédula del empleado>-<n>". Lanza `ValueError` si no se puede resolver.
    """
    cedula = (cedula_familiar or '').strip() or None
    if cedula:
        if cedula == cedula_empleado.strip():
            raise ValueError('La cédula del familiar no puede ser igual a la cédula del trabajador.')
        return cedula
    if es_hijo and fecha_nacimiento and es_menor_de_9_anios(fecha_nacimiento):
        return f"{cedula_empleado.strip()}-{siguiente_orden_hijo}"
    raise ValueError('La cédula es obligatoria, salvo para un(a) hijo(a) menor de 9 años.')


def validar_cedula_no_duplicada(cedula: str, cedulas_existentes: set[str]) -> None:
    if cedula in cedulas_existentes:
        raise ValueError('Este familiar ya se encuentra registrado para este empleado.')


def validar_heredero_unico(heredero: bool, ya_existe_heredero: bool) -> None:
    if heredero and ya_existe_heredero:
        raise ValueError('Este trabajador ya posee un familiar registrado como heredero.')
