"""Catálogos de referencia para el trabajador: AUTOGESTION lee catálogos pero jamás `personal.ver`."""
import pytest

from apps.autogestion.application.use_cases.listar_catalogos_autogestion import listar_catalogo_autogestion
from apps.identidad.management.commands.seed_permisos import ROL_ASIGNACIONES
from core.domain.exceptions import NotFoundError


class RepoFalso:
    def listar(self, clave, padre_id):
        return [{'id': 1, 'nombre': f'{clave}:{padre_id}'}]


def test_catalogo_valido_pasa_el_filtro_padre():
    assert listar_catalogo_autogestion(RepoFalso(), 'carreras', 4) == [{'id': 1, 'nombre': 'carreras:4'}]


@pytest.mark.parametrize('clave', ['empleados', 'personal', '', 'politicas'])
def test_catalogo_desconocido_es_404(clave):
    with pytest.raises(NotFoundError):
        listar_catalogo_autogestion(RepoFalso(), clave)


def test_autogestion_tiene_catalogos_ver_y_nunca_personal_ver():
    permisos = set(ROL_ASIGNACIONES[3])
    assert 'catalogos.ver' in permisos and 'autogestion.ver_propio' in permisos
    assert not any(p.startswith('personal.') for p in permisos)
