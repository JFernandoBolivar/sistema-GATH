"""O10 (D19/D21): identidad con copia de cédula y salud/tallas sin documento."""
import pytest

from apps.autogestion.application.dtos.actualizacion_dtos import DecisionCampoDTO, ItemCambioDTO
from apps.autogestion.domain.value_objects.secciones import CAMPOS_PROHIBIDOS, SECCION_DE_CAMPO
from core.domain.exceptions import ValidationError

from .memoria_actualizacion import Mundo
from .test_actualizacion_flujo import borrador, decidir, enviar, habilitar, solicitar, soporte


def test_identidad_es_autogestionable_salvo_la_cedula():
    # O49-BLOQUEO: la cédula no se ofrece como campo editable; el resto sí.
    assert 'employee.cedulaidentidad' not in SECCION_DE_CAMPO
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


def test_cambiar_cedula_se_rechaza_y_la_fecha_de_nacimiento_se_aplica():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('identidad',)))
    empleado_antes = dict(m.ficha.datos[('employee', None)])

    # O49-BLOQUEO: la cédula no es un campo autogestionable.
    with pytest.raises(ValidationError, match='no es autogestionable'):
        borrador(m, sol, [
            ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'cedulaidentidad', '20999999'),
        ])

    borrador(m, sol, [
        ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'fecha_nacimiento', '1990-05-04'),
    ])
    soporte(m, sol, 'identidad', 'CEDULA')
    sol = enviar(m, sol)
    decidir(m, sol, [DecisionCampoDTO(c.id, True) for c in m.cambios.listar('ACTUALIZACION', sol.id)])
    empleado = m.ficha.datos[('employee', None)]
    assert empleado.get('cedulaidentidad') == empleado_antes.get('cedulaidentidad')
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
    # O49-BLOQUEO: aunque el valor tenga formato válido, el campo no se ofrece.
    with pytest.raises(ValidationError, match='no es autogestionable'):
        borrador(m, sol, [
            ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'cedulaidentidad', '20999999'),
        ])
    with pytest.raises(ValidationError, match='10 dígitos'):
        borrador(m, sol, [
            ItemCambioDTO('identidad', 'employee', 'MODIFICAR', 'carnet_patria', '123'),
        ])
    with pytest.raises(ValidationError, match='lista'):
        borrador(m, sol, [
            ItemCambioDTO('salud', 'perfil_salud', 'MODIFICAR', 'alergias', 'no-es-lista'),
        ])
