"""
Tests unitarios de Configuración Visual (HU 0009). Puros, sin BD: repositorio
en memoria implementando el puerto `RepoConfiguracionVisual`.
"""
import pytest

from apps.configuracion.application.use_cases.actualizar_configuracion_visual import actualizar_configuracion_visual
from apps.configuracion.application.use_cases.guardar_logo_configuracion import guardar_logo_configuracion
from apps.configuracion.application.use_cases.obtener_configuracion_visual import obtener_configuracion_visual
from apps.configuracion.domain.entities.configuracion_visual import ConfiguracionVisual
from core.domain.exceptions import ValidationError


class RepoConfiguracionVisualMemoria:
    def __init__(self):
        self.fila = ConfiguracionVisual(
            id=1,
            tipo_cintillo='FIJO',
            nombre_empresa='Comisión Nacional de Telecomunicaciones (CONATEL)',
            logo_principal_clave=None,
            logo_secundario_clave=None,
            cintillo_pie_clave=None,
            color_fondo=None,
            actualizado_por_id=None,
            actualizado_en=None,
        )

    def obtener(self):
        return self.fila

    def actualizar(self, datos, usuario_id):
        from dataclasses import replace
        campos = {k: v for k, v in datos.items() if v is not None}
        self.fila = replace(self.fila, **campos, actualizado_por_id=usuario_id)
        return self.fila

    def guardar_logo(self, campo, clave, usuario_id):
        from dataclasses import replace
        self.fila = replace(self.fila, **{campo: clave}, actualizado_por_id=usuario_id)
        return self.fila


def test_obtener_configuracion_visual_devuelve_el_dto():
    repo = RepoConfiguracionVisualMemoria()
    dto = obtener_configuracion_visual(repo)
    assert dto.tipo_cintillo == 'FIJO'
    assert dto.nombre_empresa == 'Comisión Nacional de Telecomunicaciones (CONATEL)'


def test_actualizar_configuracion_visual_cambia_a_fijo_y_edita_datos():
    repo = RepoConfiguracionVisualMemoria()
    dto = actualizar_configuracion_visual(
        repo, {'nombre_empresa': 'Otra Empresa', 'color_fondo': '#1E3A8A'}, usuario_id=7,
    )
    assert dto.nombre_empresa == 'Otra Empresa'
    assert dto.color_fondo == '#1E3A8A'
    assert dto.actualizado_por_id == 7


def test_rn_009_01_no_permite_editar_datos_si_el_tipo_destino_es_generico():
    repo = RepoConfiguracionVisualMemoria()
    with pytest.raises(ValidationError, match='RN-009-01'):
        actualizar_configuracion_visual(
            repo, {'tipo_cintillo': 'GENERICO', 'nombre_empresa': 'Otra Empresa'}, usuario_id=7,
        )


def test_rn_009_01_no_permite_editar_datos_si_ya_es_generico():
    repo = RepoConfiguracionVisualMemoria()
    repo.fila = type(repo.fila)(**{**repo.fila.__dict__, 'tipo_cintillo': 'GENERICO'})
    with pytest.raises(ValidationError, match='RN-009-01'):
        actualizar_configuracion_visual(repo, {'color_fondo': '#000000'}, usuario_id=7)


def test_rn_009_01_si_permite_cambiar_de_generico_a_fijo_sin_otros_campos():
    repo = RepoConfiguracionVisualMemoria()
    repo.fila = type(repo.fila)(**{**repo.fila.__dict__, 'tipo_cintillo': 'GENERICO'})
    dto = actualizar_configuracion_visual(repo, {'tipo_cintillo': 'FIJO'}, usuario_id=7)
    assert dto.tipo_cintillo == 'FIJO'


def test_guardar_logo_configuracion_persiste_la_clave():
    repo = RepoConfiguracionVisualMemoria()
    dto = guardar_logo_configuracion(repo, 'logo_principal_clave', 'configuracion/logo-principal_x.png', usuario_id=3)
    assert dto.logo_principal_clave == 'configuracion/logo-principal_x.png'


def test_guardar_logo_configuracion_rechaza_campo_invalido():
    repo = RepoConfiguracionVisualMemoria()
    with pytest.raises(ValidationError):
        guardar_logo_configuracion(repo, 'nombre_empresa', 'algo', usuario_id=3)


def test_guardar_logo_configuracion_rechaza_si_es_generico():
    repo = RepoConfiguracionVisualMemoria()
    repo.fila = type(repo.fila)(**{**repo.fila.__dict__, 'tipo_cintillo': 'GENERICO'})
    with pytest.raises(ValidationError, match='RN-009-01'):
        guardar_logo_configuracion(repo, 'logo_principal_clave', 'x.png', usuario_id=3)
