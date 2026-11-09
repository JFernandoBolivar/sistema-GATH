"""
Entidad de Dominio `Familiar` (Regla B1).
Representa la carga familiar de un empleado o pasivo.
"""
from dataclasses import dataclass

# Longitud máxima de la cédula del familiar en la BD (varchar(10)). Incluye la
# cédula sintética `<cédula del titular>-<orden>` de los hijos menores.
CEDULA_FAMILIAR_MAX = 10


@dataclass(frozen=True)
class Familiar:
    id: int
    empleado_cedula: str
    primer_nombre: str
    primer_apellido: str
    parentesco_id: int
    parentesco_nombre: str
    fecha_nacimiento: str
    sexo_id: int
    sexo_nombre: str
    segundo_nombre: str | None = None
    segundo_apellido: str | None = None
    cedula_familiar: str | None = None
    orden_hijo: int | None = None
    mismo_ente: bool = False
    heredero: bool = False
    observaciones: str | None = None
    perfil_salud: dict | None = None
    perfil_fisico: dict | None = None
    formacion_academica: dict | None = None
