"""El mapper del motor conserva tipo, definición y versión de la plantilla."""
from types import SimpleNamespace

from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    plantilla_motor_a_entidad,
)


def _modelo(estado='publicada', activa=True):
    return SimpleNamespace(
        id='01a1d510-aab8-752f-a778-e9ab6d96e337',
        nombre='Plantilla institucional',
        tipo_credencial_id='trabajador',
        ancho_mm=54.0,
        alto_mm=85.6,
        orientacion='vertical',
        regla_criterio='nomina',
        regla_valor='*',
        estado=estado,
        activa=activa,
        version=1,
        definicion={'anverso': [], 'reverso': []},
        created_at='2026-01-01',
        updated_at='2026-01-02',
        plantilla_raiz_id=None,
        creado_por_id=None,
        descripcion='',
    )


def test_mapper_motor_conserva_estado_y_definicion():
    entidad = plantilla_motor_a_entidad(_modelo())
    assert entidad.id == '01a1d510-aab8-752f-a778-e9ab6d96e337'
    assert entidad.codigo_tipo == 'trabajador'
    assert entidad.estado == 'publicada'
    assert entidad.activa is True
    assert entidad.definicion == {'anverso': [], 'reverso': []}
    assert entidad.imagen_url == ''


def test_mapper_motor_representa_el_estado_legacy():
    entidad = plantilla_motor_a_entidad(_modelo(estado='LEGACY', activa=False))
    assert entidad.estado == 'LEGACY'
    assert entidad.activa is False
