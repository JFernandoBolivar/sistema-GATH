import pytest

from apps.carnetizacion.application.use_cases.gestionar_plantillas import (
    crear_plantilla_borrador,
    publicar_plantilla,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.configuracion.infrastructure.lector_configuracion import LectorConfiguracionORM
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
from core.domain.exceptions import ValidationError


class _Lector:
    def __init__(self, minimo: int):
        self.minimo = minimo

    def obtener_entero(self, clave: str) -> int:
        assert clave == 'carnetizacion.qr_tamano_minimo_mm'
        return self.minimo


def _qr(lado: float) -> dict:
    return {'id': 'qr', 'tipo': 'qr', 'x': 1, 'y': 1, 'w': lado, 'h': lado}


def _borrador(anverso=(), reverso=()):
    return crear_plantilla_borrador(
        RepoCarnetizacionORM(),
        nombre='Plantilla QR',
        codigo_tipo='trabajador',
        definicion={'anverso': list(anverso), 'reverso': list(reverso)},
    )


@pytest.mark.django_db
def test_qr_de_16_mm_con_minimo_20_falla_con_mensaje_claro():
    b = _borrador([_qr(16)])
    with pytest.raises(ValidationError) as exc:
        publicar_plantilla(RepoCarnetizacionORM(), b.id, lector=_Lector(20))
    msg = str(exc.value)
    assert '20 × 20 mm' in msg and 'SILOG' in msg and 'mide 16 × 16 mm' in msg


@pytest.mark.django_db
def test_qr_de_20_mm_publica():
    b = _borrador([_qr(20)])
    assert publicar_plantilla(RepoCarnetizacionORM(), b.id, lector=_Lector(20)).estado == 'publicada'


@pytest.mark.django_db
def test_qr_pequeno_en_anverso_y_grande_en_reverso_publica():
    b = _borrador([_qr(9.5)], [_qr(25)])
    assert publicar_plantilla(RepoCarnetizacionORM(), b.id, lector=_Lector(20)).estado == 'publicada'


@pytest.mark.django_db
def test_sin_qr_falla_y_el_borrador_no_se_bloquea():
    b = _borrador()  # guardar el borrador sin QR es válido
    assert b.estado == 'borrador'
    with pytest.raises(ValidationError):
        publicar_plantilla(RepoCarnetizacionORM(), b.id, lector=_Lector(20))


@pytest.mark.django_db
def test_el_minimo_sale_del_parametro_del_sistema():
    # Los tests corren sin migraciones: sin fila vale el defecto (20); con fila, la fila.
    b = _borrador([_qr(16)])
    with pytest.raises(ValidationError):
        publicar_plantilla(RepoCarnetizacionORM(), b.id, lector=LectorConfiguracionORM())
    ParametroSistemaModel.objects.update_or_create(
        clave='carnetizacion.qr_tamano_minimo_mm',
        defaults={'etiqueta': 'x', 'descripcion': 'x', 'grupo': 'carnetizacion', 'tipo': 'entero', 'valor': '12'},
    )
    assert LectorConfiguracionORM().obtener_entero('carnetizacion.qr_tamano_minimo_mm') == 12
    assert publicar_plantilla(RepoCarnetizacionORM(), b.id, lector=LectorConfiguracionORM()).estado == 'publicada'
