"""
Casos de uso del histórico de imágenes del cintillo: registrar una subida,
listar versiones y restaurar una anterior. La subida/borrado físico de bytes
ocurre en la vista; aquí solo se persisten referencias (patrón de
`guardar_logo_configuracion`). La vigente sigue siendo la clave guardada en
`ConfiguracionVisual`, así que los PDF no cambian su forma de leerla.
"""
from core.domain.exceptions import NotFoundError, ValidationError
from apps.configuracion.domain.entities.version_imagen_cintillo import (
    CAMPOS_IMAGEN,
    MAX_VERSIONES_IMAGEN,
    VersionImagenCintillo,
)
from apps.configuracion.domain.ports.repo_configuracion_visual import RepoConfiguracionVisual
from apps.configuracion.domain.ports.repo_versiones_imagen_cintillo import RepoVersionesImagenCintillo
from .guardar_logo_configuracion import guardar_logo_configuracion


def _validar_campo(campo: str) -> None:
    if campo not in CAMPOS_IMAGEN:
        raise ValidationError(f"Campo de imagen inválido: {campo}")


def registrar_version_imagen(
    repo: RepoConfiguracionVisual, versiones: RepoVersionesImagenCintillo,
    campo: str, clave: str, mime: str, tamano: int,
    usuario_id: int | None = None, usuario_cedula: str = '',
):
    """Devuelve (dto de configuración, versión nueva, claves a borrar del almacén)."""
    dto = guardar_logo_configuracion(repo, campo, clave, usuario_id)
    version, descartadas = versiones.registrar(
        campo, clave, mime, tamano, usuario_id, usuario_cedula, MAX_VERSIONES_IMAGEN,
    )
    return dto, version, descartadas


def listar_versiones_imagen(versiones: RepoVersionesImagenCintillo, campo: str) -> list[VersionImagenCintillo]:
    _validar_campo(campo)
    return versiones.listar(campo)


def obtener_version_imagen(
    versiones: RepoVersionesImagenCintillo, campo: str, version_id: str,
) -> VersionImagenCintillo:
    _validar_campo(campo)
    version = versiones.obtener(version_id)
    if version is None or version.campo != campo:
        raise NotFoundError('La versión de la imagen no existe.')
    return version


def restaurar_version_imagen(
    repo: RepoConfiguracionVisual, versiones: RepoVersionesImagenCintillo,
    campo: str, version_id: str, usuario_id: int | None = None,
):
    """Devuelve (dto de configuración, versión restaurada, versión que era vigente o None)."""
    version = obtener_version_imagen(versiones, campo, version_id)
    if repo.obtener().tipo_cintillo == 'GENERICO':
        raise ValidationError(
            'El cintillo genérico es de solo lectura: no se pueden restaurar '
            'imágenes mientras esté seleccionado (RN-009-01).'
        )
    previa = next((v for v in versiones.listar(campo) if v.es_vigente), None)
    versiones.marcar_vigente(version.id)
    dto = guardar_logo_configuracion(repo, campo, version.clave, usuario_id)
    return dto, version, previa
