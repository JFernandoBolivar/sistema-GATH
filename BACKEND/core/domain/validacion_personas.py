"""Reglas puras para datos de personas: nombres solo con letras y números solo con dígitos.

Paridad con `NextJS/src/shared/domain/validation` (NAME, NAME_EDICION, CEDULA_NUM,
TELEFONO_NUM). El backend no confía en el frontend: cada serializer de escritura
las vuelve a aplicar. Devuelven el valor normalizado o lanzan `ValueError` con
un mensaje para el usuario.
"""
import re

_LETRAS = "a-zA-ZáéíóúüñàèìòùÁÉÍÓÚÜÑÀÈÌÒÙ"
# Letras, espacios y apóstrofo (D'EMILIO). Sin dígitos ni otros símbolos.
NOMBRE_RE = re.compile(rf"^[{_LETRAS}\s'’`]+$")
# Al EDITAR se tolera además el punto de las iniciales del legado ("JOSE A.").
NOMBRE_EDICION_RE = re.compile(rf"^[{_LETRAS}\s'’`.]+$")
CEDULA_RE = re.compile(r"^\d{5,10}$")
TELEFONO_RE = re.compile(r"^\d{10,11}$")
_SEPARADORES_TELEFONO = re.compile(r"[\s()+\-]")


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


def validar_cedula(valor: str | None, *, etiqueta: str = "La cédula") -> str | None:
    """Solo dígitos, de 5 a 10. Vacío → None."""
    if valor is None or not str(valor).strip():
        return None
    valor = str(valor).strip()
    if not CEDULA_RE.match(valor):
        raise ValueError(f"{etiqueta} solo admite números (5 a 10 dígitos).")
    return valor


def validar_telefono(valor: str | None, *, etiqueta: str = "El teléfono") -> str | None:
    """Solo dígitos (10 u 11) admitiendo espacios, guiones, paréntesis o '+' como separadores."""
    if valor is None or not str(valor).strip():
        return valor
    valor = str(valor).strip()
    if not TELEFONO_RE.match(_SEPARADORES_TELEFONO.sub("", valor)):
        raise ValueError(f"{etiqueta} solo admite números (10 u 11 dígitos).")
    return valor
