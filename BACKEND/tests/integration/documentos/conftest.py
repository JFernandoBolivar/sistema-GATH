"""Fixtures de las pruebas de documentos: almacén en memoria, usuarios con/sin permiso y proveedor de datos falso."""
import pytest
from rest_framework.test import APIClient

from apps.documentos.domain.services.variables_documento import datos_ejemplo
from apps.documentos.infrastructure import almacen as almacen_mod


class AlmacenMemoria:
    """Almacén falso: ningún objeto sale a un SeaweedFS real."""

    def __init__(self):
        self.objetos = {}

    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        self.objetos[clave] = contenido
        return clave

    def descargar(self, clave):
        return self.objetos[clave]

    def descargar_flujo(self, clave, tamano_bloque=64 * 1024):
        from core.domain.exceptions import NotFoundError
        if clave not in self.objetos:
            raise NotFoundError('El archivo solicitado no existe.')
        return iter([self.objetos[clave]])


class ProveedorFalso:
    """«Proveedor de datos» falso: la integración real con postulación llega en otra etapa."""

    def __init__(self):
        self.llamadas = []

    def datos_de(self, sujeto_tipo, sujeto_id, con_foto=True):
        self.llamadas.append((sujeto_tipo, sujeto_id))
        datos = datos_ejemplo()
        datos['cedula'] = f'V-{sujeto_id}'
        return datos


class Usuario:
    is_authenticated = True
    is_active = True
    pk = 7
    id = 7
    cedula_id = '7730000'
    rol_id = None

    def __init__(self, permisos):
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


@pytest.fixture
def almacen(monkeypatch):
    memoria = AlmacenMemoria()
    monkeypatch.setattr(almacen_mod, 'obtener_almacen', lambda: memoria)
    return memoria


@pytest.fixture
def proveedor():
    return ProveedorFalso()


def _cliente(*permisos):
    c = APIClient()
    c.force_authenticate(user=Usuario(permisos))
    return c


@pytest.fixture
def admin():
    return _cliente('documentos.ver_plantillas', 'documentos.gestionar_plantillas')


@pytest.fixture
def lector():
    return _cliente('documentos.ver_plantillas')


@pytest.fixture
def sin_permisos():
    return _cliente()
