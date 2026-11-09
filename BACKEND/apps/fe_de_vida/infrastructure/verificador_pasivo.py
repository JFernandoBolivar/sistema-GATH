"""Verificador de condición PASIVO sobre el resolutor del kernel (la condición se calcula en servidor)."""
from apps.fe_de_vida.domain.value_objects.estados import CONDICION_PASIVO
from core.infrastructure.providers import obtener_resolutor_condicion


class VerificadorPasivoKernel:
    def es_pasivo(self, cedula: str) -> bool:
        resolutor = obtener_resolutor_condicion()
        return resolutor is not None and resolutor.condicion_de(cedula) == CONDICION_PASIVO  # fallo cerrado sin resolutor
