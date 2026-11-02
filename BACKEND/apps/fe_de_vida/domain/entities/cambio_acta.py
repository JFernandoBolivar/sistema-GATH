"""
Respuesta del acta como CAMBIO PROPUESTO (PLAN §2.9). No es una tabla nueva: la infraestructura lo
persiste como `CambioPropuesto` de autogestión con `origen_tipo = FE_DE_VIDA` (B1) y se aplica al
validarse con `aplicar_cambios_aprobados` (C19). Sin Django.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CambioActa:
    seccion: str
    accion: str                 # MODIFICAR | CREAR
    entidad_destino: str
    campo: str
    valor_propuesto: object
    entidad_id: str | None = None
    valor_anterior: object = None
    id: str = ''
