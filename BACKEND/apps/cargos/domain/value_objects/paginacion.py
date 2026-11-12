"""
Paginación del listado de puestos (cargos y vacantes).

Se pagina en el SERVIDOR: tamaño por defecto y tope máximo como constantes de
dominio. El listado solo se pagina cuando la petición trae `pagina` o
`page_size`; sin ellos se mantiene la lista completa que consumen los combos de
Movimientos (asignar, cambiar y préstamo de cargo).
"""
from dataclasses import dataclass

from core.domain.exceptions import ValidationError

PAGINA_INICIAL = 1
TAMANO_PAGINA_POR_DEFECTO = 10
TAMANO_PAGINA_MAXIMO = 50


@dataclass(frozen=True)
class Paginacion:
    pagina: int = PAGINA_INICIAL
    tamano: int = TAMANO_PAGINA_POR_DEFECTO

    @classmethod
    def solicitada(cls, parametros) -> bool:
        datos = parametros or {}
        return datos.get('pagina') is not None or datos.get('page_size') is not None

    @classmethod
    def desde_parametros(cls, parametros) -> 'Paginacion':
        datos = parametros or {}
        pagina = _entero('pagina', datos.get('pagina'), PAGINA_INICIAL)
        tamano = _entero('page_size', datos.get('page_size'), TAMANO_PAGINA_POR_DEFECTO)
        if pagina < PAGINA_INICIAL:
            raise ValidationError('La página debe ser mayor o igual a 1.')
        if tamano < 1:
            raise ValidationError('El tamaño de página debe ser mayor o igual a 1.')
        return cls(pagina=pagina, tamano=min(tamano, TAMANO_PAGINA_MAXIMO))

    @property
    def offset(self) -> int:
        return (self.pagina - 1) * self.tamano

    def total_paginas(self, total: int) -> int:
        return max(1, (total + self.tamano - 1) // self.tamano)


def _entero(nombre: str, valor, por_defecto: int) -> int:
    texto = str(valor).strip() if valor is not None else ''
    if not texto:
        return por_defecto
    if not (texto.isascii() and texto.isdigit()):
        raise ValidationError(f'El parámetro «{nombre}» debe ser un número entero.')
    return int(texto)
