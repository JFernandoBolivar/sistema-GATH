"""
Política de acceso a «Mi carnet» en Autogestión (O44 - E1).

Controlado por los parámetros del sistema en Gestión del sistema:
- 'carnetizacion.mi_carnet_alcance':
    - 'nadie': Nadie puede ver, solicitar ni descargar (defecto).
    - 'todos': Todos los trabajadores con expediente.
    - 'activos': Solo trabajadores en condición ACTIVO.
    - 'pasivos': Solo trabajadores en condición PASIVO.
    - 'usuarios_especificos': Solo cédulas listadas en 'carnetizacion.mi_carnet_usuarios'.
- 'carnetizacion.mi_carnet_usuarios': Lista de cédulas separadas por coma.

Puro: sin Django ni dependencias de framework.
"""
from core.domain.catalogos import (
    CONDICION_ACTIVO,
    CONDICION_PASIVO,
)
from core.domain.configuracion import (
    ALCANCE_CARNET_ACTIVOS,
    ALCANCE_CARNET_ESPECIFICOS,
    ALCANCE_CARNET_NADIE,
    ALCANCE_CARNET_PASIVOS,
    ALCANCE_CARNET_TODOS,
)
from core.domain.exceptions import PermissionDeniedError


def normalizar_cedula(cedula: str | None) -> str:
    if not cedula:
        return ''
    c = str(cedula).strip().upper()
    for prefijo in ('V-', 'E-', 'V', 'E', 'J-', 'G-'):
        if c.startswith(prefijo):
            c = c[len(prefijo):]
            break
    return c.strip()


def parsear_usuarios_especificos(texto_usuarios: str | None) -> frozenset[str]:
    if not texto_usuarios:
        return frozenset()
    partes = texto_usuarios.replace(';', ',').split(',')
    return frozenset(normalizar_cedula(p) for p in partes if normalizar_cedula(p))


def puede_acceder_mi_carnet(
    alcance: str | None,
    condicion: str | None,
    cedula: str | None,
    usuarios_especificos: frozenset[str] | set[str] = frozenset(),
) -> bool:
    alc = (alcance or ALCANCE_CARNET_NADIE).strip().lower()
    if alc == ALCANCE_CARNET_NADIE:
        return False
    if alc == ALCANCE_CARNET_TODOS:
        return True
    cond = (condicion or '').strip().upper()
    if alc in (ALCANCE_CARNET_ACTIVOS, 'solo_activos'):
        return cond == CONDICION_ACTIVO
    if alc in (ALCANCE_CARNET_PASIVOS, 'solo_pasivos'):
        return cond == CONDICION_PASIVO
    if alc in (ALCANCE_CARNET_ESPECIFICOS, 'especificos'):
        ced_norm = normalizar_cedula(cedula)
        return bool(ced_norm and ced_norm in usuarios_especificos)
    return False


def exigir_acceso_mi_carnet(
    alcance: str | None,
    condicion: str | None,
    cedula: str | None,
    usuarios_especificos: frozenset[str] | set[str] = frozenset(),
) -> None:
    if not puede_acceder_mi_carnet(alcance, condicion, cedula, usuarios_especificos):
        raise PermissionDeniedError(
            'El módulo de carnet digital institucional no está habilitado para su usuario.'
        )
