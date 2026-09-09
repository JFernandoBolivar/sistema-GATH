



_FIELD_LABELS = {
    'codigo_postal': 'Código Postal',
    'estado_id': 'Estado',
    'municipio_id': 'Municipio',
    'parroquia_id': 'Parroquia',
    'condicion_vivienda_id': 'Condición de Vivienda',
    'direccion_exacta': 'Dirección Exacta',
    'datos_vivienda': 'Datos de Vivienda',
    'fecha_ingreso': 'Fecha de Ingreso',
    'fecha_egreso': 'Fecha de Egreso',
    'organismo_id': 'Organismo',
    'antecedentes': 'Antecedentes',
    'cedulaidentidad': 'Cédula de Identidad',
    'nombres': 'Nombres',
    'apellidos': 'Apellidos',
    'fecha_nacimiento': 'Fecha de Nacimiento',
    'sexoid': 'Sexo',
    'estadoCivil': 'Estado Civil',
}

# Traducciones de los mensajes de validacion mas comunes que devuelve DRF
# en ingles por defecto, para no mostrarlos crudos al usuario final.
_MESSAGE_TRANSLATIONS = {
    'This field may not be null.': 'este campo es obligatorio.',
    'This field is required.': 'este campo es obligatorio.',
    'This field may not be blank.': 'este campo no puede estar vacío.',
    'This list may not be empty.': 'debe incluir al menos un elemento.',
    'A valid integer is required.': 'debe ser un número entero válido.',
    'A valid number is required.': 'debe ser un número válido.',
    'Date has wrong format.': 'la fecha tiene un formato inválido.',
    'Invalid pk "{pk_value}" - object does not exist.': 'la referencia seleccionada no existe.',
}


def _humanize_field(field_name):
    label = _FIELD_LABELS.get(field_name)
    if label:
        return label
    return field_name.replace('_id', '').replace('_', ' ').strip().capitalize()


def extract_first_error(errors, field_name=None):
    if isinstance(errors, dict):
        for key, value in errors.items():
            if key in ('non_field_errors', 'detail'):
                return extract_first_error(value, field_name)
            return extract_first_error(value, key)
        return ""
    if isinstance(errors, list):
        # Los errores de listas anidadas (ej. antecedentes[i]) suelen traer un
        # dict vacio por cada item sin error -- hay que saltarlos y quedarse
        # con el primero que realmente tenga contenido.
        for item in errors:
            if item:
                return extract_first_error(item, field_name)
        return ""

    message = _MESSAGE_TRANSLATIONS.get(str(errors), str(errors))
    if field_name:
        return f"{_humanize_field(field_name)}: {message}"
    return message

class CleanZerosMixin:
    def to_internal_value(self, data):
        def limpiar_recursivo(item):
            if isinstance(item, dict):
                nuevo_dict = {}
                for k, v in item.items():
                    if v in [0, "0", "None", None, "undefined", "null", ""]:
                        nuevo_dict[k] = None
                    else:
                        nuevo_dict[k] = limpiar_recursivo(v)
                return nuevo_dict
            
            elif isinstance(item, list):
                return [limpiar_recursivo(i) for i in item if i]
            
            return item
            
        data_limpia = limpiar_recursivo(data)
        return super().to_internal_value(data_limpia)