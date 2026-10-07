"""
Caso de uso: registrar la clave de un logo/imagen ya subido a SeaweedFS
(Reglas B2, B4). La subida física (bytes) ocurre en la vista, igual que
`EmpleadoFotoView` (patrón ya establecido en el proyecto) — este caso de uso
solo persiste la referencia y aplica RN-009-01.
"""
from core.domain.exceptions import ValidationError
from apps.configuracion.domain.ports.repo_configuracion_visual import RepoConfiguracionVisual
from .obtener_configuracion_visual import _a_dto

CAMPOS_LOGO = ('logo_principal_clave', 'logo_secundario_clave', 'cintillo_pie_clave')


def guardar_logo_configuracion(
    repo: RepoConfiguracionVisual, campo: str, clave: str, usuario_id: int | None = None
):
    if campo not in CAMPOS_LOGO:
        raise ValidationError(f"Campo de imagen inválido: {campo}")

    actual = repo.obtener()
    if actual.tipo_cintillo == 'GENERICO':
        raise ValidationError(
            'El cintillo genérico es de solo lectura: no se pueden subir '
            'imágenes mientras esté seleccionado (RN-009-01).'
        )

    entidad = repo.guardar_logo(campo, clave, usuario_id)
    return _a_dto(entidad)
