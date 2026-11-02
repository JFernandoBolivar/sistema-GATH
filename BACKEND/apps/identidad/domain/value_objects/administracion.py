"""
Filtros y paginación del listado de usuarios (D4).

Puros: convierten los parámetros HTTP en valores validados. El listado se
pagina en el servidor (10 por defecto, tope 50) y acepta cédula, nombre,
correo, rol, estado activo/inactivo y condición ACTIVO/PASIVO.
"""
from dataclasses import dataclass

from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from core.domain.exceptions import ValidationError

PAGINA_INICIAL = 1
TAMANO_POR_DEFECTO = 10
TAMANO_MAXIMO = 50


@dataclass(frozen=True)
class PaginacionUsuarios:
    pagina: int = PAGINA_INICIAL
    tamano: int = TAMANO_POR_DEFECTO

    @classmethod
    def desde_parametros(cls, parametros) -> 'PaginacionUsuarios':
        datos = parametros or {}
        pagina = _entero('pagina', datos.get('pagina'), PAGINA_INICIAL)
        tamano = _entero('page_size', datos.get('page_size'), TAMANO_POR_DEFECTO)
        if pagina < PAGINA_INICIAL:
            raise ValidationError('La página debe ser mayor o igual a 1.')
        if tamano < 1:
            raise ValidationError('El tamaño de página debe ser mayor o igual a 1.')
        return cls(pagina=pagina, tamano=min(tamano, TAMANO_MAXIMO))

    @property
    def offset(self) -> int:
        return (self.pagina - 1) * self.tamano

    def total_paginas(self, total: int) -> int:
        return max(1, (total + self.tamano - 1) // self.tamano)


@dataclass(frozen=True)
class FiltrosUsuarios:
    cedula: str = ''
    nombre: str = ''
    correo: str = ''
    rol_id: int | None = None
    is_active: bool | None = None
    condicion: str | None = None

    @classmethod
    def desde_parametros(cls, parametros) -> 'FiltrosUsuarios':
        datos = parametros or {}
        condicion = _texto(datos.get('condicion')).upper() or None
        if condicion is not None and condicion not in (
            CondicionTrabajador.ACTIVO.value,
            CondicionTrabajador.PASIVO.value,
        ):
            raise ValidationError('La condición debe ser ACTIVO o PASIVO.')
        return cls(
            cedula=_texto(datos.get('cedula'))[:20],
            nombre=_texto(datos.get('nombre'))[:100],
            correo=_texto(datos.get('correo'))[:120],
            rol_id=_entero_opcional('rol', datos.get('rol_id') or datos.get('rol')),
            is_active=_booleano(datos.get('is_active')),
            condicion=condicion,
        )

    def a_dict(self) -> dict:
        return {
            'cedula': self.cedula,
            'nombre': self.nombre,
            'correo': self.correo,
            'rol_id': self.rol_id,
            'is_active': self.is_active,
        }


def _texto(valor) -> str:
    return str(valor).strip() if valor is not None else ''


def _entero(nombre: str, valor, por_defecto: int) -> int:
    texto = _texto(valor)
    if not texto:
        return por_defecto
    if not (texto.isascii() and texto.isdigit()):
        raise ValidationError(f'El parámetro «{nombre}» debe ser un número entero.')
    return int(texto)


def _entero_opcional(nombre: str, valor) -> int | None:
    texto = _texto(valor)
    if not texto:
        return None
    if not (texto.isascii() and texto.isdigit()):
        raise ValidationError(f'El parámetro «{nombre}» debe ser un número entero.')
    return int(texto)


def _booleano(valor) -> bool | None:
    texto = _texto(valor).lower()
    if not texto:
        return None
    if texto in ('1', 'true', 'si', 'sí', 'yes'):
        return True
    if texto in ('0', 'false', 'no'):
        return False
    raise ValidationError('El parámetro «is_active» debe ser verdadero o falso.')
