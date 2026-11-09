"""
Caso de uso: actualizar la configuración visual (Reglas B2, B4).

RN-009-01: el cintillo genérico es de solo lectura — no se pueden editar
nombre de empresa ni color de fondo mientras el tipo resultante sea
GENERICO (ya sea porque ya lo era, o porque la propia petición lo cambia a
GENERICO). El cambio de tipo en sí (FIJO <-> GENERICO) siempre está
permitido.
"""
from core.domain.exceptions import ValidationError
from apps.configuracion.domain.ports.repo_configuracion_visual import RepoConfiguracionVisual
from .obtener_configuracion_visual import _a_dto

_CAMPOS_SOLO_FIJO = ('nombre_empresa', 'color_fondo')


def actualizar_configuracion_visual(
    repo: RepoConfiguracionVisual, datos: dict, usuario_id: int | None = None
):
    actual = repo.obtener()
    tipo_destino = datos.get('tipo_cintillo', actual.tipo_cintillo)

    if tipo_destino == 'GENERICO':
        if any(datos.get(campo) is not None for campo in _CAMPOS_SOLO_FIJO):
            raise ValidationError(
                'El cintillo genérico es de solo lectura: no se pueden editar '
                'sus datos (RN-009-01). Seleccione "Fijo" para personalizarlo.'
            )

    entidad = repo.actualizar(datos, usuario_id)
    return _a_dto(entidad)
