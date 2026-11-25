"""Transacción de emisión: correlativo, registro y compensación del PDF externo."""
from datetime import datetime

import pytest

from apps.puntocuenta.domain.ports.generador_punto_cuenta import DocumentoPuntoCuenta
from apps.puntocuenta.infrastructure.emision_punto_cuenta import (
    ServicioEmisionPuntoCuenta,
)
from apps.puntocuenta.infrastructure.models.configuracion_punto_cuenta_model import (
    SecuenciaPuntoCuentaModel,
)
from apps.puntocuenta.infrastructure.models.punto_cuenta_model import PuntoCuentaModel
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import (
    RepoSecuenciaPuntoCuentaORM,
)
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_orm import (
    RepoPuntoCuentaORM,
)

pytestmark = pytest.mark.django_db


class AlmacenMemoria:
    def __init__(self):
        self.objetos = {}

    def eliminar(self, clave):
        self.objetos.pop(clave, None)


class GeneradorFallo:
    def validar(self, proceso):
        return None

    def generar(self, proceso, **kwargs):
        raise RuntimeError('fallo del diseñador')


class GeneradorDocumento:
    def __init__(self, clave):
        self.clave = clave

    def validar(self, proceso):
        return None

    def generar(self, proceso, **kwargs):
        return DocumentoPuntoCuenta(
            id='00000000-0000-4000-8000-000000000099',
            pdf_clave=self.clave,
            pdf_sha256='a' * 64,
        )


class RepoFalloAlAdjuntar:
    def __init__(self, repo):
        self.repo = repo

    def crear(self, **kwargs):
        return self.repo.crear(**kwargs)

    def adjuntar_documento(self, *args, **kwargs):
        raise RuntimeError('fallo al vincular')


def _emitir(servicio):
    return servicio.emitir(
        proceso='cambio_oficina', cargo_id=10, cedula='V-12345678',
        dependencia_origen_id=1, dependencia_destino_id=2, motivo_id=None, usuario_id=7,
        ahora=datetime(2026, 11, 24, 9, 0),
    )


def test_si_el_disenador_falla_revierte_registro_y_correlativo():
    servicio = ServicioEmisionPuntoCuenta(
        repo=RepoPuntoCuentaORM(), repo_secuencia=RepoSecuenciaPuntoCuentaORM(),
        generador=GeneradorFallo(), almacen=AlmacenMemoria(),
    )
    with pytest.raises(RuntimeError, match='fallo del diseñador'):
        _emitir(servicio)
    assert not PuntoCuentaModel.objects.exists()
    assert not SecuenciaPuntoCuentaModel.objects.filter(anio=2026).exists()
    assert RepoSecuenciaPuntoCuentaORM().siguiente(2026) == 1


def test_si_falla_la_vinculacion_elimina_el_pdf_y_revierte_todo():
    almacen = AlmacenMemoria()
    clave = 'documentos/generados/huerfano.pdf'
    almacen.objetos[clave] = b'%PDF-prueba'
    servicio = ServicioEmisionPuntoCuenta(
        repo=RepoFalloAlAdjuntar(RepoPuntoCuentaORM()), repo_secuencia=RepoSecuenciaPuntoCuentaORM(),
        generador=GeneradorDocumento(clave), almacen=almacen,
    )
    with pytest.raises(RuntimeError, match='fallo al vincular'):
        _emitir(servicio)
    assert not PuntoCuentaModel.objects.exists()
    assert almacen.objetos == {}
    assert RepoSecuenciaPuntoCuentaORM().siguiente(2026) == 1


def test_emision_exitosa_guarda_proceso_documento_pdf_y_correlativo():
    almacen = AlmacenMemoria()
    clave = 'documentos/generados/original.pdf'
    almacen.objetos[clave] = b'%PDF-prueba'
    servicio = ServicioEmisionPuntoCuenta(
        repo=RepoPuntoCuentaORM(), repo_secuencia=RepoSecuenciaPuntoCuentaORM(),
        generador=GeneradorDocumento(clave), almacen=almacen,
    )
    dto = _emitir(servicio)
    fila = PuntoCuentaModel.objects.get(pk=dto.id)
    assert fila.proceso == 'cambio_oficina' and fila.numero == '0001-2026' and fila.secuencia == 1
    assert fila.documento_pdf_clave == clave
    assert str(fila.documento_generado_id) == '00000000-0000-4000-8000-000000000099'
    assert fila.snapshot_formato['proceso'] == 'cambio_oficina'
    assert almacen.objetos[clave] == b'%PDF-prueba'
