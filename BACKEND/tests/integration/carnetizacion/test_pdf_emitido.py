"""
PDF tal como se emitió (seguimiento B-4): se guarda al emitir con clave opaca y sha256, y la
reimpresión en formato normal entrega esa copia. Si el almacén falla, la emisión no se cae.
"""
import pytest

from apps.carnetizacion.infrastructure.models.carnetizacion_models import CarnetEmitidoArchivoModel
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM

pytestmark = pytest.mark.django_db


class AlmacenMemoria:
    def __init__(self):
        self.objetos: dict[str, bytes] = {}

    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        self.objetos[clave] = contenido
        return clave

    def descargar(self, clave):
        return self.objetos[clave]

    def eliminar(self, clave):
        self.objetos.pop(clave, None)


class AlmacenCaido(AlmacenMemoria):
    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        raise ConnectionError('SeaweedFS no responde')


def test_guarda_y_devuelve_el_pdf_tal_como_se_emitio():
    almacen = AlmacenMemoria()
    repo = RepoCarnetizacionORM(almacen=almacen)

    repo.guardar_pdf_emitido(501, b'%PDF-emitido')

    registro = CarnetEmitidoArchivoModel.objects.get(carnet_id=501)
    assert registro.clave.startswith('carnets/') and '501' not in registro.clave  # clave opaca
    assert registro.tamano == len(b'%PDF-emitido')
    assert repo.pdf_emitido_guardado(501) == b'%PDF-emitido'


def test_una_copia_alterada_no_se_entrega():
    almacen = AlmacenMemoria()
    repo = RepoCarnetizacionORM(almacen=almacen)
    repo.guardar_pdf_emitido(502, b'%PDF-original')
    almacen.objetos[CarnetEmitidoArchivoModel.objects.get(carnet_id=502).clave] = b'%PDF-alterado'

    assert repo.pdf_emitido_guardado(502) is None


def test_solo_la_copia_normal_se_usa_para_reimprimir():
    repo = RepoCarnetizacionORM(almacen=AlmacenMemoria())
    repo.guardar_pdf_emitido(503, b'%PDF-imprenta', formato='imprenta')

    assert repo.pdf_emitido_guardado(503) is None


def test_si_el_almacen_falla_la_emision_sigue():
    repo = RepoCarnetizacionORM(almacen=AlmacenCaido())

    repo.guardar_pdf_emitido(504, b'%PDF')  # no lanza

    assert not CarnetEmitidoArchivoModel.objects.filter(carnet_id=504).exists()
    assert repo.pdf_emitido_guardado(504) is None
