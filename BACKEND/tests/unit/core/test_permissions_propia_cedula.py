"""
Tests unitarios de `EsPropiaCedulaOTienePermiso` (ALTA-07, sin BD).

Usa el escape hatch de duck-typing de `_usuario_tiene_permiso`
(`user.tiene_permiso` callable) para no depender del resolutor de permisos
real ni de Django/BD — mismo patrón que ya usan otros tests puros del
kernel (`test_r02_r03_r06_reubicaciones.py`).
"""
from core.presentation.permissions import EsPropiaCedulaOTienePermiso


class _Cedula:
    def __init__(self, valor):
        self.cedulaidentidad = valor


class _Usuario:
    def __init__(self, cedula: str, permisos: set[str]):
        self.is_authenticated = True
        self.cedula = _Cedula(cedula)
        self._permisos = permisos

    def tiene_permiso(self, codigo: str) -> bool:
        return codigo in self._permisos


class _Vista:
    def __init__(self, kwargs):
        self.kwargs = kwargs


class _Request:
    def __init__(self, user):
        self.user = user


def test_propietario_con_permiso_propio_es_autorizado():
    permiso_cls = EsPropiaCedulaOTienePermiso('autogestion.censo_ver_propio', 'autogestion.censo_ver_todos')
    usuario = _Usuario('12345678', {'autogestion.censo_ver_propio'})
    assert permiso_cls().has_permission(_Request(usuario), _Vista({'cedula': '12345678'})) is True


def test_propietario_sin_permiso_propio_es_denegado():
    permiso_cls = EsPropiaCedulaOTienePermiso('autogestion.censo_ver_propio', 'autogestion.censo_ver_todos')
    usuario = _Usuario('12345678', set())
    assert permiso_cls().has_permission(_Request(usuario), _Vista({'cedula': '12345678'})) is False


def test_cedula_ajena_con_bypass_es_autorizada():
    permiso_cls = EsPropiaCedulaOTienePermiso('autogestion.censo_ver_propio', 'autogestion.censo_ver_todos')
    rrhh = _Usuario('99999999', {'autogestion.censo_ver_todos'})
    assert permiso_cls().has_permission(_Request(rrhh), _Vista({'cedula': '12345678'})) is True


def test_cedula_ajena_sin_bypass_es_denegada_incluso_con_permiso_propio():
    """Regresión ALTA-07: el permiso propio NUNCA autoriza cédulas ajenas."""
    permiso_cls = EsPropiaCedulaOTienePermiso('autogestion.censo_ver_propio', 'autogestion.censo_ver_todos')
    atacante = _Usuario('11111111', {'autogestion.censo_ver_propio'})
    assert permiso_cls().has_permission(_Request(atacante), _Vista({'cedula': '99999999'})) is False


def test_cedula_ajena_sin_codigo_de_bypass_configurado_siempre_deniega():
    """Caso de escritura (POST del censo): no existe bypass, ni RRHH puede editar el censo ajeno."""
    permiso_cls = EsPropiaCedulaOTienePermiso('autogestion.censo_actualizar_propio')
    rrhh = _Usuario('99999999', {'autogestion.censo_ver_todos', 'autogestion.censo_exportar'})
    assert permiso_cls().has_permission(_Request(rrhh), _Vista({'cedula': '12345678'})) is False


def test_usuario_no_autenticado_es_denegado():
    permiso_cls = EsPropiaCedulaOTienePermiso('autogestion.censo_ver_propio', 'autogestion.censo_ver_todos')

    class _Anonimo:
        is_authenticated = False

    assert permiso_cls().has_permission(_Request(_Anonimo()), _Vista({'cedula': '12345678'})) is False
