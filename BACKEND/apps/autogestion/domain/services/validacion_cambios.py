"""
Validación pura de los cambios propuestos (B5): lista blanca por sección, forma y tipo del valor.
La existencia de las referencias (ids de catálogos) la verifica el puerto `LectorFicha`.
"""
import re
from datetime import date

from apps.autogestion.domain.value_objects.secciones import (
    CAMPO_ELIMINAR,
    CAMPO_REGISTRO_NUEVO,
    CAMPOS_POR_SECCION,
    CAMPOS_PROHIBIDOS,
    ENTIDADES_ELIMINABLES,
    ENTIDADES_UNICAS,
    MOTIVO_QUITAR_MAX,
    MOTIVO_QUITAR_MIN,
    REQUERIDOS_AL_CREAR,
    Accion,
)
from core.domain.exceptions import ValidationError
from core.domain.validacion_personas import validar_nombre, validar_telefono

_CORREO = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')
_CEDULA_FAMILIAR = re.compile(r'^[A-Za-z]?-?\d{5,9}$')
_LARGOS = {'direccion_exacta': 500, 'observaciones': 1000}
_LARGO_TEXTO = 150
_CAMPOS_BOOL = {'tiene_hijos'}
_CAMPOS_FECHA = {'fecha_nacimiento', 'fecha_inicio', 'fecha_fin'}
_CAMPOS_TELEFONO = {'telefono_movil', 'telefono_habitacion', 'telefono'}
# Nombres de personas: solo letras y espacios (paridad con NAME del frontend).
_CAMPOS_NOMBRE = {
    'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'nombres', 'apellidos',
}
_OPCIONALES_NULOS = {
    'segundo_nombre', 'segundo_apellido', 'observaciones', 'cedula_familiar', 'telefono_habitacion',
    'telefono', 'correo_alternativo', 'tiene_hijos', 'mencion_id', 'carrera_id', 'institucion_id',
    'telefono_movil', 'relacion_id', 'fecha_inicio', 'fecha_fin', 'dias_completados',
    'horas_completadas', 'grupo_id',
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
    if campo in _CAMPOS_TELEFONO:
        try:
            valor = validar_telefono(valor, tipo='movil' if campo == 'telefono_movil' else 'cualquiera')
        except ValueError as exc:
            raise ValidationError(str(exc)) from None
        if valor is None:
            if campo in _OPCIONALES_NULOS:
                return None
            raise ValidationError(f"El campo '{campo}' no puede quedar vacío.")
    if campo == 'correo_alternativo' and (not _CORREO.match(valor) or len(valor) > 254):
        raise ValidationError("El correo alternativo no tiene un formato válido.")
    if campo in _CAMPOS_NOMBRE:
        try:
            valor = validar_nombre(valor, edicion=True, etiqueta=f"El campo '{campo}'")
        except ValueError as exc:
            raise ValidationError(str(exc)) from None
    if campo == 'cedula_familiar' and not _CEDULA_FAMILIAR.match(valor):
        raise ValidationError("La cédula del familiar no tiene un formato válido.")
    if campo in _CAMPOS_FECHA:
        try:
            fecha = date.fromisoformat(valor)
        except ValueError:
            raise ValidationError(f"El campo '{campo}' debe tener formato AAAA-MM-DD.") from None
        if fecha > date.today():
            raise ValidationError(f"El campo '{campo}' no puede ser una fecha futura.")
    maximo = _LARGOS.get(campo, _LARGO_TEXTO)
    if campo not in _CAMPOS_TELEFONO and len(valor) > maximo and campo != 'correo_alternativo':
        raise ValidationError(f"El campo '{campo}' excede la longitud permitida.")
    return valor


def mismo_valor(campo: str, nuevo, actual) -> bool:
    """Igualdad de valores; los teléfonos guardados en formato legado se comparan ya normalizados (E.164)."""
    if nuevo == actual:
        return True
    if campo in _CAMPOS_TELEFONO and isinstance(actual, str):
        try:
            return nuevo == validar_telefono(actual)
        except ValueError:
            return False
    return False


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
    if accion is Accion.ELIMINAR:
        if entidad not in ENTIDADES_ELIMINABLES:
            raise ValidationError(f"No se puede quitar un registro de '{entidad}'.")
        if campo != CAMPO_ELIMINAR:
            raise ValidationError("La acción QUITAR no lleva un campo concreto.")
        if entidad_id is None:
            raise ValidationError(f"Debe indicar el identificador del registro de '{entidad}' a quitar.")
        return
    if campo not in campos_permitidos(seccion, entidad):
        raise ValidationError(f"El campo '{campo}' no es autogestionable en la sección '{seccion}'.")
    if entidad in ENTIDADES_UNICAS and entidad_id is not None:
        raise ValidationError(f"'{entidad}' es un registro único: no lleva identificador.")
    if entidad not in ENTIDADES_UNICAS and entidad_id is None:
        raise ValidationError(f"Debe indicar el identificador del registro de '{entidad}' a modificar.")


def validar_motivo_eliminar(valor) -> str:
    """Motivo obligatorio de una acción QUITAR: 10 a 300 caracteres."""
    motivo = (valor or {}).get('motivo') if isinstance(valor, dict) else None
    motivo = (motivo or '').strip()
    if len(motivo) < MOTIVO_QUITAR_MIN:
        raise ValidationError(f"El motivo para quitar el registro debe tener al menos {MOTIVO_QUITAR_MIN} caracteres.")
    if len(motivo) > MOTIVO_QUITAR_MAX:
        raise ValidationError(f"El motivo para quitar el registro no puede superar {MOTIVO_QUITAR_MAX} caracteres.")
    return motivo


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
    if entidad == 'formacion_complementaria':
        inicio, fin = limpios.get('fecha_inicio'), limpios.get('fecha_fin')
        if inicio and fin and fin < inicio:
            raise ValidationError("La fecha de fin del curso no puede ser anterior a la de inicio.")
    return limpios
