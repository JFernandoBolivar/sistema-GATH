"""O10 (D19/D21): identidad con copia de cédula y salud/tallas sin documento."""
import pytest

from apps.autogestion.application.dtos.actualizacion_dtos import DecisionCampoDTO, ItemCambioDTO
from apps.autogestion.domain.value_objects.secciones import CAMPOS_PROHIBIDOS, SECCION_DE_CAMPO
from core.domain.exceptions import ValidationError

from .memoria_actualizacion import Mundo
from .test_actualizacion_flujo import borrador, decidir, enviar, habilitar, solicitar, soporte


def test_identidad_ya_es_autogestionable_y_no_esta_prohibida():
    assert 'employee.cedulaidentidad' in SECCION_DE_CAMPO
    assert 'employee.nombres' in SECCION_DE_CAMPO
    assert 'cedulaidentidad' not in CAMPOS_PROHIBIDOS


def test_cambiar_nombres_exige_copia_de_cedula():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('identidad',)))
    borrador(m, sol, [
        ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'nombres', 'MARIA ELENA'),
    ])
    with pytest.raises(ValidationError, match='CEDULA'):
        enviar(m, sol)
    soporte(m, sol, 'identidad', 'CEDULA')
    assert enviar(m, sol).estado.value == 'ENVIADA'


def test_cambiar_cedula_y_fecha_de_nacimiento_se_propone_y_aplica():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('identidad',)))
    borrador(m, sol, [
        ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'cedulaidentidad', '20999999'),
        ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'fecha_nacimiento', '1990-05-04'),
    ])
    soporte(m, sol, 'identidad', 'CEDULA')
    sol = enviar(m, sol)
    decidir(m, sol, [DecisionCampoDTO(c.id, True) for c in m.cambios.listar('ACTUALIZACION', sol.id)])
    empleado = m.ficha.datos[('employee', None)]
    assert empleado['cedulaidentidad'] == '20999999'
    assert empleado['fecha_nacimiento'] == '1990-05-04'


def test_estado_civil_y_carnet_no_exigen_documento():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('identidad',)))
    borrador(m, sol, [
        ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'estadoCivil_id', 2),
        ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'carnet_patria', '123-4567890-1'),
        ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'carnet_patria_serial', 'ABC123'),
    ])
    assert enviar(m, sol).estado.value == 'ENVIADA'


def test_salud_y_tallas_entran_sin_documento():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('salud',)))
    borrador(m, sol, [
        ItemCambioDTO('salud', 'perfil_salud', 'MODIFICAR', 'alergias', [2, 1]),
        ItemCambioDTO('salud', 'perfil_salud', 'MODIFICAR', 'discapacidades', [5]),
        ItemCambioDTO('salud', 'perfil_fisico', 'MODIFICAR', 'talla_camisa_id', 10),
    ])
    sol = enviar(m, sol)
    cambios = m.cambios.listar('ACTUALIZACION', sol.id)
    assert next(c for c in cambios if c.campo == 'alergias').valor_propuesto == [1, 2]
    decidir(m, sol, [DecisionCampoDTO(c.id, True) for c in cambios])
    assert m.ficha.datos[('perfil_salud', None)]['alergias'] == [1, 2]
    assert m.ficha.datos[('perfil_fisico', None)]['talla_camisa_id'] == 10


def test_cedula_carnet_y_campos_de_salud_invalidos_se_rechazan():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('identidad', 'salud')))
    with pytest.raises(ValidationError, match='5 y 9'):
        borrador(m, sol, [
            ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'cedulaidentidad', '1234'),
        ])
    with pytest.raises(ValidationError, match='10 dígitos'):
        borrador(m, sol, [
            ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'carnet_patria', '123'),
        ])
    with pytest.raises(ValidationError, match='lista'):
        borrador(m, sol, [
            ItemCambioDTO('salud', 'perfil_salud', 'MODIFICAR', 'alergias', 'no-es-lista'),
        ])
