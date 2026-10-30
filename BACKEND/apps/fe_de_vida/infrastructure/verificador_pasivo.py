"""Verificador de condición PASIVO sobre el resolutor del kernel (la condición se calcula en servidor)."""
from core.infrastructure.providers import obtener_resolutor_condicion


class VerificadorPasivoKernel:
    def es_pasivo(self, cedula: str) -> bool:
        resolutor = obtener_resolutor_condicion()
        return resolutor is not None and resolutor.condicion_de(cedula) == 'PASIVO'  # fallo cerrado sin resolutor
