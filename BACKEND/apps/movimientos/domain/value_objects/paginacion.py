"""
Paginación del historial de movimientos (HU 0008).

Los listados se paginan en el SERVIDOR: tamaño por defecto y tope máximo como
constantes de dominio, validados aquí y reutilizables por la pantalla, el PDF
y el Excel.
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


def _entero(nombre: str, valor, por_defecto: int) -> int:
    texto = str(valor).strip() if valor is not None else ''
    if not texto:
        return por_defecto
    if not (texto.isascii() and texto.isdigit()):
        raise ValidationError(f'El parámetro «{nombre}» debe ser un número entero.')
    return int(texto)
