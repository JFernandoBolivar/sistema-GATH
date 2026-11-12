"""
Paginación de los listados de plantillas, fondos fijos y biblioteca de medios.

Pura: convierte `?pagina=` y `?page_size=` en valores validados. Tamaños
permitidos 12, 24 y 48 (12 por defecto); cualquier otro tamaño se ajusta al
permitido inmediato superior sin pasar de 48.
"""
from dataclasses import dataclass

from core.domain.exceptions import ValidationError

TAMANOS_PERMITIDOS = (12, 24, 48)
TAMANO_POR_DEFECTO = 12
TAMANO_MAXIMO = 48
PAGINA_INICIAL = 1


def _entero(nombre: str, valor, defecto: int) -> int:
    if valor is None or str(valor).strip() == '':
        return defecto
    try:
        return int(str(valor).strip())
    except ValueError:
        raise ValidationError(f'El parámetro «{nombre}» debe ser un número entero.') from None


@dataclass(frozen=True)
class Paginacion:
    pagina: int = PAGINA_INICIAL
    tamano: int = TAMANO_POR_DEFECTO

    @classmethod
    def desde_parametros(cls, parametros) -> 'Paginacion':
        datos = parametros or {}
        pagina = _entero('pagina', datos.get('pagina'), PAGINA_INICIAL)
        tamano = _entero('page_size', datos.get('page_size'), TAMANO_POR_DEFECTO)
        if pagina < PAGINA_INICIAL:
            raise ValidationError('La página debe ser mayor o igual a 1.')
        if tamano < 1:
            raise ValidationError('El tamaño de página debe ser mayor o igual a 1.')
        ajustado = next((t for t in TAMANOS_PERMITIDOS if tamano <= t), TAMANO_MAXIMO)
        return cls(pagina=pagina, tamano=ajustado)

    @staticmethod
    def solicitada(parametros) -> bool:
        """True si el cliente pidió paginar (envió `pagina`); si no, se devuelve la lista completa."""
        return bool((parametros or {}).get('pagina'))

    @property
    def offset(self) -> int:
        return (self.pagina - 1) * self.tamano

    def total_paginas(self, total: int) -> int:
        return max(1, (total + self.tamano - 1) // self.tamano)

    def sobre(self, resultados, total: int) -> dict:
        """Sobre estándar `{resultados, total, pagina, tamano, total_paginas}`."""
        return {
            'resultados': resultados,
            'total': total,
            'pagina': self.pagina,
            'tamano': self.tamano,
            'total_paginas': self.total_paginas(total),
        }
