"""
PDF tal como se emitió (seguimiento B-4): se guarda al emitir con clave opaca y sha256, y la
reimpresión en formato normal entrega esa copia. Si el almacén falla, la emisión no se cae.
"""
import hashlib
import re
from types import SimpleNamespace
from uuid import UUID

import pytest

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoArchivoModel,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
    RepoCarnetizacionORM,
)
from core.infrastructure.storage import validacion_archivo

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


def test_guarda_y_devuelve_el_pdf_tal_como_se_emitio(monkeypatch):
    # UUID fijo que contiene «501» por casualidad: la opacidad no depende de
    # que el ID aparezca o no dentro del UUID aleatorio.
    uuid_fijo = UUID('00000000000000000000000000005010')
    monkeypatch.setattr(validacion_archivo, 'uuid', SimpleNamespace(uuid4=lambda: uuid_fijo))
    almacen = AlmacenMemoria()
    repo = RepoCarnetizacionORM(almacen=almacen)

    repo.guardar_pdf_emitido(501, b'%PDF-emitido')

    registro = CarnetEmitidoArchivoModel.objects.get(carnet_id=501)
    # La clave es un UUID opaco, no una ruta derivada del ID. No se comprueba
    # que un fragmento del ID no aparezca por casualidad dentro del UUID.
    assert re.fullmatch(r'carnets/[0-9a-f]{32}\.pdf', registro.clave)
    assert registro.clave == f'carnets/{uuid_fijo.hex}.pdf'
    assert registro.sha256 == hashlib.sha256(b'%PDF-emitido').hexdigest()
    assert registro.tamano == len(b'%PDF-emitido')
    assert registro.formato == 'normal'
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
