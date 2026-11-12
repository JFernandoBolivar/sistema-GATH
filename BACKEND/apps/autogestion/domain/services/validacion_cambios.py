"""
Validación pura de los cambios propuestos (B5): lista blanca por sección, forma y tipo del valor.
La existencia de las referencias (ids de catálogos) la verifica el puerto `LectorFicha`.
"""
from core.domain.limites_texto import DIRECCION_MAX, DIRECCION_MIN, OBSERVACION_MAX, OBSERVACION_MIN
import re
from datetime import date

from apps.autogestion.domain.value_objects.secciones import (
    CAMPO_ELIMINAR,
    CAMPO_REGISTRO_NUEVO,
    CAMPOS_LOCALIZACION_VENEZUELA,
    CAMPOS_POR_SECCION,
    CAMPOS_PROHIBIDOS,
    ENTIDADES_ELIMINABLES,
    ENTIDADES_UNICAS,
    MOTIVO_QUITAR_MAX,
    MOTIVO_QUITAR_MIN,
    REQUERIDOS_AL_CREAR,
    REQUERIDOS_VIVIENDA_BASE,
    REQUERIDOS_VIVIENDA_EXTERIOR,
    Accion,
)
from core.domain.exceptions import ValidationError
from core.domain.validacion_personas import (
    normalizar_ciudad_region,
    validar_nombre,
    validar_serial_carnet_patria,
    validar_telefono,
)

# Campo derivado que la revisión muestra pero nunca se guarda en el valor propuesto.
CAMPO_CEDULA_GENERADA = 'cedula_generada'

ETIQUETAS_CAMPOS = {
    'codigo_postal_id': 'Código postal',
    'estado_id': 'Estado',
    'municipio_id': 'Municipio',
    'parroquia_id': 'Parroquia',
    'direccion_exacta': 'Dirección',
    'condicion_vivienda_id': 'Condición de la vivienda',
    'ciudad_region': 'Ciudad o región',
    'pais_id': 'País',
    'primer_nombre': 'Primer nombre',
    'primer_apellido': 'Primer apellido',
    'parentesco_id': 'Parentesco',
    'fecha_nacimiento': 'Fecha de nacimiento',
    'sexo_id': 'Sexo',
    'nombres': 'Nombres',
    'apellidos': 'Apellidos',
    'telefono': 'Teléfono',
    'relacion_id': 'Relación',
    'capacitacion_id': 'Capacitación',
    'institucion_id': 'Institución',
    'nivel_academico_id': 'Nivel académico',
    'organismo_id': 'Organismo',
    'fecha_ingreso': 'Fecha de ingreso',
    'fecha_egreso': 'Fecha de egreso',
}

_CORREO = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')
_CEDULA_FAMILIAR = re.compile(r'^[A-Za-z]?-?\d{5,9}$')
_LARGOS = {
    'direccion_exacta': DIRECCION_MAX, 'observaciones': OBSERVACION_MAX,
    'ciudad_region': 120,
}
_MINIMOS = {'direccion_exacta': DIRECCION_MIN, 'observaciones': OBSERVACION_MIN}
_LARGO_TEXTO = 150
_CAMPOS_BOOL = {'tiene_hijos'}
_CAMPOS_ENTERO = {'orden_hijo'}
_CAMPOS_FECHA = {'fecha_nacimiento', 'fecha_inicio', 'fecha_fin'}
_CAMPOS_TELEFONO = {'telefono_movil', 'telefono_habitacion', 'telefono'}
# Nombres de personas: solo letras y espacios (paridad con NAME del frontend).
_CAMPOS_NOMBRE = {
    'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'nombres', 'apellidos',
}
# Listas de ids de catálogo (M2M del perfil de salud): se guardan ordenadas y sin repetidos.
_CAMPOS_LISTA = {'alergias', 'patologias_cronicas', 'discapacidades'}
_OPCIONALES_NULOS = {
    'segundo_nombre', 'segundo_apellido', 'observaciones', 'cedula_familiar', 'telefono_habitacion',
    'telefono', 'correo_alternativo', 'tiene_hijos', 'mencion_id', 'carrera_id', 'institucion_id',
    'telefono_movil', 'relacion_id', 'fecha_inicio', 'fecha_fin', 'dias_completados',
    'horas_completadas', 'grupo_id', 'carnet_patria', 'carnet_patria_serial',
    'grupo_sanguineo_id', 'talla_camisa_id', 'talla_pantalon_id', 'talla_zapatos_id',
    'talla_chaqueta_id', 'orden_hijo', 'ciudad_region', 'estado_id', 'municipio_id',
    'parroquia_id', 'codigo_postal_id',
}
_CEDULA_EMPLEADO = re.compile(r'^\d{5,9}$')


def _normalizar_carnet_patria(valor: str) -> str:
    """Código del Carnet de la Patria: 10 dígitos (tolera el formato legado `000-0000000-0`)."""
    texto = valor.strip()
    limpio = ''.join(ch for ch in texto if ch not in ' -')
    if re.fullmatch(r'\d{3}-\d{7}-\d', texto):
        limpio = limpio[:10]
    if not (limpio.isascii() and limpio.isdigit() and len(limpio) == 10):
        raise ValidationError('El código del Carnet de la Patria debe tener 10 dígitos.')
    return limpio


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
    if campo in _CAMPOS_ENTERO:
        try:
            numero = int(str(valor).strip())
        except (TypeError, ValueError):
            raise ValidationError('El orden de nacimiento debe ser un número entero.') from None
        if not 1 <= numero <= 99:
            raise ValidationError('El orden de nacimiento debe estar entre 1 y 99.')
        return numero
    if campo in _CAMPOS_LISTA:
        if not isinstance(valor, list):
            raise ValidationError(f"El campo '{campo}' debe ser una lista de identificadores.")
        ids: list[int] = []
        for item in valor:
            if isinstance(item, bool) or not isinstance(item, int) or item <= 0:
                raise ValidationError(f"El campo '{campo}' debe contener identificadores numéricos válidos.")
            ids.append(item)
        if len(ids) > 100:
            raise ValidationError(f"El campo '{campo}' tiene demasiados valores seleccionados.")
        return sorted(set(ids))
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
    if campo == 'cedulaidentidad' and not _CEDULA_EMPLEADO.match(valor):
        raise ValidationError("La cédula de identidad debe tener entre 5 y 9 dígitos.")
    if campo == 'carnet_patria':
        valor = _normalizar_carnet_patria(valor)
    if campo == 'carnet_patria_serial':
        try:
            valor = validar_serial_carnet_patria(valor) or ''
        except ValueError as exc:
            raise ValidationError(str(exc)) from None
    if campo == 'ciudad_region':
        valor = normalizar_ciudad_region(valor)
    if campo in _CAMPOS_NOMBRE:
        try:
            valor = validar_nombre(valor, edicion=True, etiqueta=f"El campo '{campo}'")
        except ValueError as exc:
            raise ValidationError(str(exc)) from None
    if campo == 'cedula_familiar':
        if re.fullmatch(r'\d{5,9}-\d+', valor):
            raise ValidationError(
                'No escriba la cédula correlativa a mano: deje la cédula vacía y '
                'seleccione el orden de nacimiento.'
            )
        if not _CEDULA_FAMILIAR.match(valor):
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
    minimo = _MINIMOS.get(campo)
    if minimo and valor and len(valor) < minimo:
        raise ValidationError(f"El campo '{campo}' debe tener al menos {minimo} caracteres.")
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


def _requeridos_de_vivienda(es_venezuela: bool) -> frozenset[str]:
    if es_venezuela:
        return REQUERIDOS_VIVIENDA_BASE | CAMPOS_LOCALIZACION_VENEZUELA
    return REQUERIDOS_VIVIENDA_EXTERIOR


def validar_vivienda_condicional(valores: dict, es_venezuela: bool) -> None:
    """O40: Venezuela exige la ubicación completa; el exterior, ciudad/región y sin estado, municipio ni parroquia."""
    faltan = sorted(
        campo for campo in _requeridos_de_vivienda(es_venezuela)
        if valores.get(campo) in (None, '')
    )
    if faltan:
        nombres = [ETIQUETAS_CAMPOS.get(c, c) for c in faltan]
        raise ValidationError(
            "Faltan campos obligatorios de la vivienda: " + ', '.join(nombres) + '.'
        )
    if not es_venezuela:
        sobran = [
            ETIQUETAS_CAMPOS[c] for c in ('estado_id', 'municipio_id', 'parroquia_id')
            if valores.get(c) not in (None, '')
        ]
        if sobran:
            raise ValidationError(
                'Una vivienda fuera de Venezuela no lleva ' + ', '.join(sobran).lower()
                + ': deje vacíos el estado, el municipio y la parroquia e indique la ciudad o región.'
            )


def validar_registro_nuevo(
    seccion: str, entidad: str, valores: dict, es_venezuela: bool = True,
) -> dict:
    """Valida el dict de un CREAR: solo campos de la lista blanca y todos los requeridos."""
    if not isinstance(valores, dict) or not valores:
        raise ValidationError("El registro nuevo debe indicar sus campos.")
    # Los borradores guardados antes del fix del hijo sin cédula traen
    # `cedula_generada` dentro del valor propuesto (la escribe la revisión al
    # mostrarla). Se descarta: no es un campo editable y no debe rechazar el
    # borrador que el trabajador vuelve a guardar.
    valores = {k: v for k, v in valores.items() if k != CAMPO_CEDULA_GENERADA}
    permitidos = campos_permitidos(seccion, entidad)
    ajenos = sorted(set(valores) - permitidos)
    if ajenos:
        raise ValidationError(f"Campos no autogestionables en '{entidad}': {', '.join(ajenos)}.")
    limpios = {k: validar_valor(k, v) for k, v in valores.items()}
    if entidad == 'datos_vivienda':
        validar_vivienda_condicional(limpios, es_venezuela)
    else:
        faltan = sorted(c for c in REQUERIDOS_AL_CREAR.get(entidad, frozenset()) if limpios.get(c) is None)
        if faltan:
            nombres = [ETIQUETAS_CAMPOS.get(c, c) for c in faltan]
            raise ValidationError(f"Faltan campos obligatorios de '{entidad}': {', '.join(nombres)}.")
    if entidad == 'formacion_complementaria':
        inicio, fin = limpios.get('fecha_inicio'), limpios.get('fecha_fin')
        if inicio and fin and fin < inicio:
            raise ValidationError("La fecha de fin del curso no puede ser anterior a la de inicio.")
    return limpios
