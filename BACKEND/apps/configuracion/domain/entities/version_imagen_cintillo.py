"""
Entidad `VersionImagenCintillo`: una versión (vigente o anterior) de una de las
3 imágenes del cintillo. Se conservan las últimas `MAX_VERSIONES_IMAGEN` por campo.
"""
from dataclasses import dataclass

MAX_VERSIONES_IMAGEN = 5
CAMPOS_IMAGEN = ('logo_principal_clave', 'logo_secundario_clave', 'cintillo_pie_clave')

ACCION_IMAGEN_SUBIDA = 'configuracion.imagen_cintillo_subida'
ACCION_IMAGEN_RESTAURADA = 'configuracion.imagen_cintillo_restaurada'
RECURSO_IMAGEN_CINTILLO = 'imagen_cintillo'


@dataclass(frozen=True)
class VersionImagenCintillo:
    id: str
    campo: str
    clave: str
    mime: str
    tamano: int
    subido_en: str
    subido_por_id: int | None
    subido_por_cedula: str
    subido_por_nombre: str
    es_vigente: bool
