"""
Secciones autogestionables compartidas por varios módulos (kernel, regla B16).

El catálogo de secciones lo consumen la autogestión (lista blanca de campos), la
configuración (parámetros de secciones por condición) y la administración del
sistema. Vive en `core/domain` para que ningún `domain` de una app tenga que
importar el `domain` de otra. Puro: sin Django.
"""
from enum import Enum


class Seccion(str, Enum):
    IDENTIDAD = 'identidad'
    FOTO = 'foto'
    CONTACTO = 'contacto'
    VIVIENDA = 'vivienda'
    FORMACION = 'formacion'
    COMPLEMENTARIA = 'complementaria'
    FAMILIAR = 'familiar'
    SALUD = 'salud'
    ANTECEDENTES = 'antecedentes'


# Catálogo de secciones en el orden del dominio: lo consume la configuración de
# solicitudes por condición (O12) y la pantalla de Administración del sistema.
CODIGOS_SECCIONES: tuple[str, ...] = tuple(seccion.value for seccion in Seccion)
