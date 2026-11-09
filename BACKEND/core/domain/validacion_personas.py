"""Reglas puras para datos de personas: nombres solo con letras y números solo con dígitos.

Paridad con `NextJS/src/shared/domain/validation` (NAME, NAME_EDICION, CEDULA_NUM,
TELEFONO_NUM). El backend no confía en el frontend: cada serializer de escritura
las vuelve a aplicar. Devuelven el valor normalizado o lanzan `ValueError` con
un mensaje para el usuario.
"""
import re

import phonenumbers

_LETRAS = "a-zA-ZáéíóúüñàèìòùÁÉÍÓÚÜÑÀÈÌÒÙ"
# Letras, espacios y apóstrofo (D'EMILIO). Sin dígitos ni otros símbolos.
NOMBRE_RE = re.compile(rf"^[{_LETRAS}\s'’`]+$")
# Al EDITAR se tolera además el punto de las iniciales del legado ("JOSE A.").
NOMBRE_EDICION_RE = re.compile(rf"^[{_LETRAS}\s'’`.]+$")
CEDULA_RE = re.compile(r"^\d{5,10}$")
PAIS_POR_DEFECTO = "VE"
SERIAL_CARNET_RE = re.compile(r"^[A-Za-z0-9]{0,30}$")
_SOLO_NUMEROS_RE = re.compile(r"^\+?\d+$")
_SEPARADORES_TELEFONO = re.compile(r"[\s().\-]")


def validar_nombre(valor: str | None, *, edicion: bool = False, etiqueta: str = "El nombre") -> str | None:
    """Solo letras y espacios. Vacío → se devuelve tal cual (la obligatoriedad la decide el serializer)."""
    if valor is None:
        return None
    valor = " ".join(str(valor).split())
    if not valor:
        return valor
    patron = NOMBRE_EDICION_RE if edicion else NOMBRE_RE
    if not patron.match(valor):
        raise ValueError(f"{etiqueta} solo admite letras y espacios.")
    return valor


def validar_serial_carnet_patria(valor: str | None) -> str | None:
    """Serial del Carnet de la Patria: opcional; solo letras y números, máximo 30."""
    if valor is None:
        return None
    valor = str(valor).strip()
    if not SERIAL_CARNET_RE.match(valor):
        raise ValueError("El serial del Carnet de la Patria solo admite letras y números (máximo 30)")
    return valor


def validar_cedula(valor: str | None, *, etiqueta: str = "La cédula") -> str | None:
    """Solo dígitos, de 5 a 10. Vacío → None."""
    if valor is None or not str(valor).strip():
        return None
    valor = str(valor).strip()
    if not CEDULA_RE.match(valor):
        raise ValueError(f"{etiqueta} solo admite números (5 a 10 dígitos).")
    return valor


def validar_telefono(valor: str | None, *, tipo: str = "cualquiera", etiqueta: str = "El teléfono") -> str | None:
    """Valida por país y devuelve E.164 (`+584121234567`). Vacío/None → None.

    Venezuela (+58) es el país por defecto: acepta `0412-1234567`, `4121234567`,
    `0212 1234567` o `+58 412 1234567`. `tipo='movil'` exige número móvil.
    Paridad con `NextJS/src/shared/domain/validation/telefono.ts` (D-13).
    """
    if valor is None:
        return None
    limpio = _SEPARADORES_TELEFONO.sub("", str(valor).strip())
    if not limpio:
        return None
    if not _SOLO_NUMEROS_RE.match(limpio):
        raise ValueError(f"{etiqueta} solo admite números (y + al inicio para el código de país)")
    try:
        numero = phonenumbers.parse(limpio, PAIS_POR_DEFECTO)
    except phonenumbers.NumberParseException:
        numero = None
    if numero is None or not phonenumbers.is_valid_number(numero):
        prefijo = numero.country_code if numero is not None else phonenumbers.country_code_for_region(PAIS_POR_DEFECTO)
        if prefijo == phonenumbers.country_code_for_region(PAIS_POR_DEFECTO):
            raise ValueError("Número venezolano inválido. Ejemplos: móvil 0412-1234567, fijo 0212-1234567")
        raise ValueError(f"Número inválido para el país (+{prefijo}). Revise la cantidad de dígitos.")
    if tipo == "movil" and phonenumbers.number_type(numero) not in (
        phonenumbers.PhoneNumberType.MOBILE,
        phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE,
    ):
        raise ValueError("Debe ser un número móvil (en Venezuela: 0412, 0414, 0416, 0422, 0424 o 0426)")
    return phonenumbers.format_number(numero, phonenumbers.PhoneNumberFormat.E164)


def formatear_telefono(valor: str | None) -> str:
    """Para mostrar: `+58 412 1234567`. Si no es un teléfono válido, se devuelve el texto tal cual."""
    texto = (valor or "").strip()
    if not texto:
        return ""
    try:
        numero = phonenumbers.parse(_SEPARADORES_TELEFONO.sub("", texto), PAIS_POR_DEFECTO)
    except phonenumbers.NumberParseException:
        return texto
    if not phonenumbers.is_valid_number(numero):
        return texto
    return phonenumbers.format_number(numero, phonenumbers.PhoneNumberFormat.INTERNATIONAL).replace('-', ' ')


MAX_LONGITUD_CIUDAD_REGION = 120


def normalizar_ciudad_region(valor: str | None) -> str:
    """
    Normaliza el texto de ciudad o región para residencia en el exterior:
    - Elimina espacios exteriores y colapsa secuencias de espacios a uno solo.
    - Convierte a MAYÚSCULAS.
    - Trunca a MAX_LONGITUD_CIUDAD_REGION (120 caracteres).
    """
    if not valor:
        return ""
    colapsado = " ".join(str(valor).split())
    return colapsado.upper()[:MAX_LONGITUD_CIUDAD_REGION]

