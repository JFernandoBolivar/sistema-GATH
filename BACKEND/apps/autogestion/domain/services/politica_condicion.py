"""
Política de solicitudes de actualización por condición del trabajador (O12).

La configuración vive en los parámetros del sistema (`apps.configuracion`) y la
resuelve la infraestructura; este módulo solo aplica la regla, sin Django.
"""
from dataclasses import dataclass

from apps.autogestion.domain.value_objects.secciones import CODIGOS_SECCIONES
from core.domain.exceptions import ValidationError

CONDICION_ACTIVO = 'ACTIVO'
CONDICION_PASIVO = 'PASIVO'
CONDICIONES = (CONDICION_ACTIVO, CONDICION_PASIVO)


@dataclass(frozen=True)
class PoliticaAutogestion:
    """Condición del trabajador, si puede solicitar y qué secciones tiene permitidas."""

    condicion: str
    habilitado: bool
    secciones: frozenset[str]

    def exigir_habilitado(self) -> None:
        if not self.habilitado:
            raise ValidationError(
                'Las solicitudes de actualización de datos no están habilitadas para su '
                f'condición ({self.condicion}). Comuníquese con Bienestar Social.'
            )

    def permite(self, seccion: str) -> bool:
        return seccion in self.secciones

    def exigir_secciones(self, secciones, *, campo: str = 'secciones') -> None:
        no_permitidas = sorted(set(secciones) - set(self.secciones))
        if no_permitidas:
            raise ValidationError(
                'Estas secciones no están habilitadas para su condición '
                f'({self.condicion}): {", ".join(no_permitidas)}.',
                campo=campo,
            )


def normalizar_secciones(texto: str | None) -> frozenset[str]:
    """Lista de secciones separada por comas; vacía o inválida = todas (compatibilidad)."""
    if not texto:
        return frozenset(CODIGOS_SECCIONES)
    pedidas = {
        parte.strip().lower()
        for parte in str(texto).replace(';', ',').split(',')
        if parte.strip()
    }
    conocidas = pedidas & set(CODIGOS_SECCIONES)
    return frozenset(conocidas) if conocidas else frozenset(CODIGOS_SECCIONES)
