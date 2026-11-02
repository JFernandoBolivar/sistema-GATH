"""
Validación pura de los cambios propuestos (B5): lista blanca por sección, forma y tipo del valor.
La existencia de las referencias (ids de catálogos) la verifica el puerto `LectorFicha`.
"""
import re
from datetime import date

from apps.autogestion.domain.value_objects.secciones import (
    CAMPO_REGISTRO_NUEVO,
    CAMPOS_POR_SECCION,
    CAMPOS_PROHIBIDOS,
    ENTIDADES_UNICAS,
    REQUERIDOS_AL_CREAR,
    Accion,
)
from core.domain.exceptions import ValidationError

_TELEFONO = re.compile(r'^\+?\d[\d\s\-]{6,18}\d$')
_CORREO = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')
_CEDULA_FAMILIAR = re.compile(r'^[A-Za-z]?-?\d{5,10}$')
_LARGOS = {'direccion_exacta': 500, 'observaciones': 1000}
_LARGO_TEXTO = 150
_CAMPOS_BOOL = {'tiene_hijos'}
_CAMPOS_FECHA = {'fecha_nacimiento'}
_CAMPOS_TELEFONO = {'telefono_movil', 'telefono_habitacion', 'telefono'}
_OPCIONALES_NULOS = {
    'segundo_nombre', 'segundo_apellido', 'observaciones', 'cedula_familiar', 'telefono_habitacion',
    'telefono', 'correo_alternativo', 'tiene_hijos', 'mencion_id', 'carrera_id', 'institucion_id',
    'telefono_movil', 'relacion_id',
}


def validar_valor(campo: str, valor):
    """Normaliza y valida un valor; lanza `ValidationError` con el nombre del campo."""
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        if campo in _OPCIONALES_NULOS:
            return None
        raise ValidationError(f"El campo '{campo}' no puede quedar vacío.")
    if campo in _CAMPOS_BOOL:
        if not isinstance(valor, bool):
            raise ValidationError(f"El campo '{campo}' debe ser verdadero o falso.")
        return valor
    if campo.endswith('_id'):
        if isinstance(valor, bool) or not isinstance(valor, int) or valor <= 0:
            raise ValidationError(f"El campo '{campo}' debe ser un identificador numérico válido.")
        return valor
    if not isinstance(valor, str):
        raise ValidationError(f"El campo '{campo}' debe ser texto.")
    valor = valor.strip()
    if campo in _CAMPOS_TELEFONO and not _TELEFONO.match(valor):
        raise ValidationError(f"El teléfono de '{campo}' no tiene un formato válido.")
    if campo == 'correo_alternativo' and (not _CORREO.match(valor) or len(valor) > 254):
        raise ValidationError("El correo alternativo no tiene un formato válido.")
    if campo == 'cedula_familiar' and not _CEDULA_FAMILIAR.match(valor):
        raise ValidationError("La cédula del familiar no tiene un formato válido.")
    if campo in _CAMPOS_FECHA:
        try:
            fecha = date.fromisoformat(valor)
        except ValueError:
            raise ValidationError(f"El campo '{campo}' debe tener formato AAAA-MM-DD.") from None
        if fecha > date.today():
            raise ValidationError(f"El campo '{campo}' no puede ser una fecha futura.")
    maximo = 20 if campo in _CAMPOS_TELEFONO else _LARGOS.get(campo, _LARGO_TEXTO)
    if len(valor) > maximo and campo != 'correo_alternativo':
        raise ValidationError(f"El campo '{campo}' excede la longitud permitida.")
    return valor


def campos_permitidos(seccion: str, entidad: str) -> frozenset[str]:
    return CAMPOS_POR_SECCION.get(seccion, {}).get(entidad, frozenset())


def validar_estructura(seccion: str, entidad: str, accion: Accion, campo: str, entidad_id) -> None:
    """Verifica sección/entidad/campo contra la lista blanca y la coherencia acción-identificador."""
    if str(campo).lower() in CAMPOS_PROHIBIDOS:
        raise ValidationError(f"El campo '{campo}' no es autogestionable.")
    if seccion not in CAMPOS_POR_SECCION or entidad not in CAMPOS_POR_SECCION[seccion]:
        raise ValidationError(f"La entidad '{entidad}' no es autogestionable en la sección '{seccion}'.")
    if accion is Accion.CREAR:
        if entidad_id is not None:
            raise ValidationError("Un registro nuevo no lleva identificador.")
        if campo != CAMPO_REGISTRO_NUEVO or entidad in {'employee', 'datos_complementarios'}:
            raise ValidationError(f"No se puede crear un registro nuevo de '{entidad}'.")
        return
    if campo not in campos_permitidos(seccion, entidad):
        raise ValidationError(f"El campo '{campo}' no es autogestionable en la sección '{seccion}'.")
    if entidad in ENTIDADES_UNICAS and entidad_id is not None:
        raise ValidationError(f"'{entidad}' es un registro único: no lleva identificador.")
    if entidad not in ENTIDADES_UNICAS and entidad_id is None:
        raise ValidationError(f"Debe indicar el identificador del registro de '{entidad}' a modificar.")


def validar_registro_nuevo(seccion: str, entidad: str, valores: dict) -> dict:
    """Valida el dict de un CREAR: solo campos de la lista blanca y todos los requeridos."""
    if not isinstance(valores, dict) or not valores:
        raise ValidationError("El registro nuevo debe indicar sus campos.")
    permitidos = campos_permitidos(seccion, entidad)
    ajenos = sorted(set(valores) - permitidos)
    if ajenos:
        raise ValidationError(f"Campos no autogestionables en '{entidad}': {', '.join(ajenos)}.")
    limpios = {k: validar_valor(k, v) for k, v in valores.items()}
    faltan = sorted(c for c in REQUERIDOS_AL_CREAR.get(entidad, frozenset()) if limpios.get(c) is None)
    if faltan:
        raise ValidationError(f"Faltan campos obligatorios de '{entidad}': {', '.join(faltan)}.")
    return limpios
