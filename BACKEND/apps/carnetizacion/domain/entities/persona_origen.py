"""Persona registrada que puede añadirse como invitada a un evento (trabajador o credencial externa)."""
from dataclasses import dataclass

TIPO_TRABAJADOR = "TRABAJADOR"
TIPO_EXTERNO = "EXTERNO"

POBLACIONES = ("TODOS", "ACTIVOS", "PASIVOS")

# Tope de invitados que una sola operación en bloque puede agregar.
TOPE_AGREGAR_EN_BLOQUE = 2000


@dataclass
class PersonaOrigen:
    tipo: str
    clave: str  # cédula (trabajador) o id de la credencial (externo)
    nombre: str
    documento: str
    empleado_id: int | None = None
    cargo: str = ""
    dependencia: str = ""
    condicion: str = ""
    foto_cedula: str = ""  # cédula si tiene foto (se sirve por el proxy de fotos)
    correo: str = ""
    organizacion: str = ""
    ya_invitado: bool = False
