"""Puerto del generador de archivos de una exportación."""
from dataclasses import dataclass, field
from typing import Callable, Protocol


@dataclass(frozen=True)
class ArchivoGenerado:
    contenido: bytes
    metadatos: dict = field(default_factory=dict)


class GeneradorExportacion(Protocol):
    def generar(
        self, tipo: str, formato: str, parametros: dict, progreso: Callable[[int], None],
    ) -> ArchivoGenerado:
        """Produce el archivo con el mismo generador que usaban las vistas síncronas."""
        ...
