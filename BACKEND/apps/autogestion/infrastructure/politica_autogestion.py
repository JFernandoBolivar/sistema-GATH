"""
Resolución de la política de solicitudes de actualización (O12) desde los
parámetros del sistema y la condición del trabajador (calculada en servidor).
"""
from apps.autogestion.domain.services.politica_condicion import (
    CONDICION_ACTIVO,
    CONDICION_PASIVO,
    CONDICIONES,
    PoliticaAutogestion,
    normalizar_secciones,
)
from apps.configuracion.domain.parametros import DEFINICIONES_POR_CLAVE
from core.domain.configuracion import (
    CLAVE_AUTOGESTION_ACTIVOS_HABILITADO,
    CLAVE_AUTOGESTION_ACTIVOS_SECCIONES,
    CLAVE_AUTOGESTION_PASIVOS_HABILITADO,
    CLAVE_AUTOGESTION_PASIVOS_SECCIONES,
    como_booleano,
)
from core.infrastructure.providers import (
    obtener_lector_configuracion,
    obtener_resolutor_condicion,
)


def condicion_de(cedula: str) -> str:
    """Condición vigente del trabajador; sin resolutor se asume PASIVO (fallo cerrado)."""
    resolutor = obtener_resolutor_condicion()
    if resolutor is None or not cedula:
        return CONDICION_PASIVO
    return resolutor.condicion_de(cedula) or CONDICION_PASIVO


def _valor_texto(clave: str) -> str:
    lector = obtener_lector_configuracion()
    if lector is not None:
        return lector.obtener_texto(clave)
    definicion = DEFINICIONES_POR_CLAVE.get(clave)
    return definicion.defecto if definicion is not None else ''


def obtener_politica(cedula: str, condicion: str | None = None) -> PoliticaAutogestion:
    condicion = condicion or condicion_de(cedula)
    if condicion not in CONDICIONES:
        # Sin asignación (u otra condición sin política): no puede solicitar ni pedir secciones.
        return PoliticaAutogestion(condicion=condicion, habilitado=False, secciones=frozenset())
    if condicion == CONDICION_PASIVO:
        clave_habilitado = CLAVE_AUTOGESTION_PASIVOS_HABILITADO
        clave_secciones = CLAVE_AUTOGESTION_PASIVOS_SECCIONES
    else:
        clave_habilitado = CLAVE_AUTOGESTION_ACTIVOS_HABILITADO
        clave_secciones = CLAVE_AUTOGESTION_ACTIVOS_SECCIONES
    definicion = DEFINICIONES_POR_CLAVE[clave_habilitado]
    defecto = como_booleano(definicion.defecto, False)
    lector = obtener_lector_configuracion()
    if lector is not None:
        habilitado = lector.obtener_booleano(clave_habilitado)
    else:
        habilitado = defecto
    return PoliticaAutogestion(
        condicion=condicion,
        habilitado=habilitado,
        secciones=normalizar_secciones(_valor_texto(clave_secciones)),
    )
