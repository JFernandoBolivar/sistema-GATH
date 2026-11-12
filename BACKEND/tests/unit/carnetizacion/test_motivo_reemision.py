"""T2 (OC 2026-11-11): motivo obligatorio para reemitir el carnet (sin BD)."""
import pytest

from apps.carnetizacion.application.use_cases.emitir_carnet import emitir_carnet_y_pdf
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.exceptions import ReemisionSinMotivoError
from apps.carnetizacion.domain.services.motivo_reemision import (
    MOTIVO_CAMBIO_CARGO,
    MOTIVO_OTRO,
    MOTIVO_PERDIDA_ROBO,
    normalizar_reemision,
)
from core.domain.exceptions import ValidationError


def _carnet(id_=10, fecha='2026-11-01T10:00:00+00:00') -> Carnet:
    return Carnet(
        id=id_,
        empleado_cedula='V-1',
        empleado_nombres='ANA',
        empleado_apellidos='API',
        security_hash='hash',
        fecha_emision=fecha,
        motivo_id=1,
        motivo_nombre='PRIMERA EMISIÓN',
    )


class RepoCarnetsMemoria:
    def __init__(self, vigente=None):
        self.vigente = vigente
        self.emitidos = []
        self.pdf_pedido = None

    def obtener_carnet_vigente(self, empleado_cedula):
        return self.vigente

    def motivo_id_para_reemision(self, motivo_reemision):
        return {'PERDIDA_ROBO': 3, 'DETERIORO': 4}.get(motivo_reemision)

    def emitir_carnet(self, empleado_cedula, motivo_id, observaciones=None, plantilla_id=None):
        self.emitidos.append(
            {'cedula': empleado_cedula, 'motivo_id': motivo_id, 'observaciones': observaciones}
        )
        return _carnet(id_=99)

    def generar_pdf(self, carnet_id, nombre_override=None):
        self.pdf_pedido = carnet_id
        return b'%PDF-1.4'


def test_normalizar_motivo():
    assert normalizar_reemision(None) is None
    assert normalizar_reemision('') is None
    assert normalizar_reemision('perdida_robo').motivo == MOTIVO_PERDIDA_ROBO
    assert normalizar_reemision(MOTIVO_CAMBIO_CARGO, 'ignorado').detalle == ''


def test_normalizar_rechaza_motivo_desconocido():
    with pytest.raises(ValidationError) as error:
        normalizar_reemision('CAMBIO_DE_PUESTO')
    assert error.value.campo == 'motivo_reemision'


def test_otro_exige_detalle_de_diez_caracteres():
    with pytest.raises(ValidationError) as error:
        normalizar_reemision(MOTIVO_OTRO, 'corto')
    assert error.value.campo == 'detalle'
    assert normalizar_reemision(MOTIVO_OTRO, 'Se rompió el plástico').detalle


def test_sin_carnet_vigente_emite_sin_motivo():
    repo = RepoCarnetsMemoria(vigente=None)

    emision = emitir_carnet_y_pdf(
        repo, empleado_cedula='V-1', motivo_id=1, observaciones='',
    )

    assert emision.motivo_reemision is None
    assert emision.pdf == b'%PDF-1.4'
    assert repo.emitidos[0]['motivo_id'] == 1
    assert repo.emitidos[0]['observaciones'] == ''


def test_carnet_vigente_sin_motivo_da_conflicto_con_la_fecha():
    repo = RepoCarnetsMemoria(vigente=_carnet())

    with pytest.raises(ReemisionSinMotivoError) as error:
        emitir_carnet_y_pdf(repo, empleado_cedula='V-1', motivo_id=1)

    assert '01/11/2026' in str(error.value)
    assert error.value.carnet_vigente['numero'] == 10
    assert error.value.carnet_vigente['id'] == 10
    assert not repo.emitidos


def test_carnet_vigente_con_motivo_mapea_el_catalogo_y_registra_el_detalle():
    repo = RepoCarnetsMemoria(vigente=_carnet())

    emision = emitir_carnet_y_pdf(
        repo,
        empleado_cedula='V-1',
        motivo_id=2,
        observaciones='Entrega en sede',
        motivo_reemision=MOTIVO_PERDIDA_ROBO,
    )

    assert emision.motivo_reemision == MOTIVO_PERDIDA_ROBO
    assert repo.emitidos[0]['motivo_id'] == 3  # PÉRDIDA del catálogo
    assert repo.emitidos[0]['observaciones'] == 'Reemisión: PERDIDA_ROBO | Entrega en sede'
    assert repo.pdf_pedido == 99


def test_otro_incluye_el_detalle_en_las_observaciones():
    repo = RepoCarnetsMemoria(vigente=_carnet())

    emision = emitir_carnet_y_pdf(
        repo,
        empleado_cedula='V-1',
        motivo_id=2,
        motivo_reemision=MOTIVO_OTRO,
        detalle='Se mojó en una lluvia fuerte',
    )

    assert emision.detalle == 'Se mojó en una lluvia fuerte'
    assert 'Se mojó en una lluvia fuerte' in repo.emitidos[0]['observaciones']
