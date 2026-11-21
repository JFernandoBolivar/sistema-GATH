"""
Esquema mínimo y documentado del formulario de la Ventana 1 (`datos_ventana1`). Puro: sin Django.

Los formularios completos (familiares, vivienda, salud, tallas, planillas) vienen en tareas posteriores; este
esquema solo cubre lo básico y se reemplaza sin tocar el resto. Todas las claves son OPCIONALES al guardar un
borrador; las de `CAMPOS_OBLIGATORIOS_ENVIO` deben estar presentes para ENVIAR la Ventana 1. Una clave que no
está en el esquema se rechaza (nada de datos arbitrarios en el JSON).

    {
      "fecha_nacimiento":   "AAAA-MM-DD"       fecha pasada, no futura
      "sexo":               "M" | "F"
      "nacionalidad":       "V" | "E"
      "estado_civil":       texto, máx. 30
      "direccion_habitacion": texto, máx. 300
      "telefono_alterno":   teléfono válido (se normaliza a E.164)
      "contacto_emergencia": {"nombre": máx. 150, "telefono": teléfono válido, "parentesco": máx. 40}
    }
"""
from datetime import date

from core.domain.exceptions import ValidationError
from core.domain.validacion_personas import validar_nombre, validar_telefono

CAMPOS_OBLIGATORIOS_ENVIO: tuple[str, ...] = ('fecha_nacimiento', 'sexo')
_CLAVES = frozenset({
    'fecha_nacimiento', 'sexo', 'nacionalidad', 'estado_civil', 'direccion_habitacion', 'telefono_alterno',
    'contacto_emergencia',
})
_CLAVES_CONTACTO = frozenset({'nombre', 'telefono', 'parentesco'})


def _texto(valor, etiqueta: str, campo: str, maximo: int) -> str:
    if not isinstance(valor, str):
        raise ValidationError(f"{etiqueta} debe ser un texto.", campo=campo)
    valor = ' '.join(valor.split())
    if len(valor) > maximo:
        raise ValidationError(f"{etiqueta} admite como máximo {maximo} caracteres.", campo=campo)
    return valor


def _telefono(valor, etiqueta: str, campo: str) -> str:
    try:
        return validar_telefono(_texto(valor, etiqueta, campo, 30), etiqueta=etiqueta) or ''
    except ValueError as e:
        raise ValidationError(str(e), campo=campo) from e


def validar_datos_ventana1(datos: dict, hoy: date) -> dict:
    """Devuelve los datos normalizados o lanza `ValidationError` indicando el campo."""
    if not isinstance(datos, dict):
        raise ValidationError("Los datos de la Ventana 1 deben ser un objeto.", campo='datos_ventana1')
    desconocidas = sorted(set(datos) - _CLAVES)
    if desconocidas:
        raise ValidationError(
            f"Datos no admitidos en la Ventana 1: {', '.join(desconocidas)}.", campo='datos_ventana1',
        )
    limpio: dict = {}
    for clave, valor in datos.items():
        campo = f'datos_ventana1.{clave}'
        if valor in (None, ''):
            continue  # un campo vacío equivale a no informado
        if clave == 'fecha_nacimiento':
            try:
                fecha = date.fromisoformat(str(valor))
            except ValueError as e:
                raise ValidationError("La fecha de nacimiento debe tener el formato AAAA-MM-DD.", campo=campo) from e
            if fecha > hoy:
                raise ValidationError("La fecha de nacimiento no puede ser futura.", campo=campo)
            limpio[clave] = fecha.isoformat()
        elif clave == 'sexo':
            if valor not in ('M', 'F'):
                raise ValidationError("El sexo debe ser M o F.", campo=campo)
            limpio[clave] = valor
        elif clave == 'nacionalidad':
            if valor not in ('V', 'E'):
                raise ValidationError("La nacionalidad debe ser V o E.", campo=campo)
            limpio[clave] = valor
        elif clave == 'estado_civil':
            limpio[clave] = _texto(valor, "El estado civil", campo, 30)
        elif clave == 'direccion_habitacion':
            limpio[clave] = _texto(valor, "La dirección", campo, 300)
        elif clave == 'telefono_alterno':
            limpio[clave] = _telefono(valor, "El teléfono alterno", campo)
        elif clave == 'contacto_emergencia':
            limpio[clave] = _contacto(valor, campo)
    return limpio


def _contacto(valor, campo: str) -> dict:
    if not isinstance(valor, dict):
        raise ValidationError("El contacto de emergencia debe ser un objeto.", campo=campo)
    desconocidas = sorted(set(valor) - _CLAVES_CONTACTO)
    if desconocidas:
        raise ValidationError(f"Datos no admitidos en el contacto: {', '.join(desconocidas)}.", campo=campo)
    contacto: dict = {}
    if valor.get('nombre'):
        try:
            contacto['nombre'] = validar_nombre(
                _texto(valor['nombre'], "El nombre del contacto", f'{campo}.nombre', 150),
                edicion=True, etiqueta="El nombre del contacto",
            )
        except ValueError as e:
            raise ValidationError(str(e), campo=f'{campo}.nombre') from e
    if valor.get('telefono'):
        contacto['telefono'] = _telefono(valor['telefono'], "El teléfono del contacto", f'{campo}.telefono')
    if valor.get('parentesco'):
        contacto['parentesco'] = _texto(valor['parentesco'], "El parentesco", f'{campo}.parentesco', 40)
    return contacto


def campos_obligatorios_faltantes(datos: dict | None) -> list[str]:
    """Claves de `CAMPOS_OBLIGATORIOS_ENVIO` que aún no están en el borrador."""
    datos = datos or {}
    return [c for c in CAMPOS_OBLIGATORIOS_ENVIO if not datos.get(c)]
