"""O7: acciones por registro (agregar/corregir/quitar) y documentos por registro."""
import pytest

from apps.autogestion.application.dtos.actualizacion_dtos import DecisionCampoDTO, ItemCambioDTO
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from apps.autogestion.domain.value_objects.secciones import (
    CAMPO_ELIMINAR,
    MAX_CONTACTOS_EMERGENCIA,
)
from core.domain.exceptions import NotFoundError, ValidationError

from .memoria_actualizacion import Mundo
from .test_actualizacion_flujo import borrador, decidir, enviar, habilitar, solicitar, soporte

FAMILIAR_BASE = {
    'primer_nombre': 'PEDRO',
    'primer_apellido': 'PEREZ',
    'parentesco_id': 3,
    'fecha_nacimiento': '2020-01-15',
    'sexo_id': 1,
}


def test_quitar_familiar_guarda_motivo_y_accion():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('familiar',)))
    borrador(m, sol, [
        ItemCambioDTO(
            'familiar', 'familiar', 'ELIMINAR', CAMPO_ELIMINAR,
            {'motivo': 'Ya no vive con el trabajador'}, entidad_id='7',
        ),
    ])
    cambios = m.cambios.listar('ACTUALIZACION', sol.id)
    assert len(cambios) == 1
    assert cambios[0].accion == 'ELIMINAR'
    assert cambios[0].valor_propuesto == {'motivo': 'Ya no vive con el trabajador'}


def test_quitar_exige_motivo_de_10_a_300_caracteres():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('familiar',)))
    with pytest.raises(ValidationError, match='al menos 10'):
        borrador(m, sol, [
            ItemCambioDTO('familiar', 'familiar', 'ELIMINAR', CAMPO_ELIMINAR, {'motivo': 'corto'}, entidad_id='7'),
        ])
    with pytest.raises(ValidationError, match='300'):
        borrador(m, sol, [
            ItemCambioDTO('familiar', 'familiar', 'ELIMINAR', CAMPO_ELIMINAR, {'motivo': 'x' * 301}, entidad_id='7'),
        ])


def test_quitar_registro_de_otro_trabajador_no_se_permite():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('familiar',)))
    with pytest.raises(NotFoundError):
        borrador(m, sol, [
            ItemCambioDTO('familiar', 'familiar', 'ELIMINAR', CAMPO_ELIMINAR,
                          {'motivo': 'Registro que no es del trabajador'}, entidad_id='999'),
        ])


def test_enviar_y_aprobar_quitar_aplica_la_eliminacion():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('familiar',)))
    borrador(m, sol, [
        ItemCambioDTO('familiar', 'familiar', 'ELIMINAR', CAMPO_ELIMINAR,
                      {'motivo': 'Ya no vive con el trabajador'}, entidad_id='7'),
    ])
    sol = enviar(m, sol)
    decidir(m, sol, [DecisionCampoDTO(c.id, True) for c in m.cambios.listar('ACTUALIZACION', sol.id)])
    assert ('familiar', '7') not in m.ficha.datos


def test_crear_hijo_menor_de_9_sin_cedula_exige_partida_de_nacimiento():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('familiar',)))
    borrador(m, sol, [
        ItemCambioDTO('familiar', 'familiar', 'CREAR', '*', dict(FAMILIAR_BASE), referencia='ref-hijo'),
    ])
    with pytest.raises(ValidationError, match='soporte obligatorio'):
        enviar(m, sol)
    soporte(m, sol, 'familiar', 'CONSTANCIA')  # soporte de sección: no respalda una partida
    with pytest.raises(ValidationError, match='ACTA_NACIMIENTO'):
        enviar(m, sol)
    soporte(m, sol, 'familiar', 'ACTA_NACIMIENTO', referencia='ref-hijo')
    assert enviar(m, sol).estado is EstadoSolicitud.ENVIADA


def test_familiar_con_cedula_exige_copia_de_cedula_ademas_de_la_partida_si_es_hijo():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('familiar',)))
    valores = dict(FAMILIAR_BASE, cedula_familiar='V-12345678')
    borrador(m, sol, [
        ItemCambioDTO('familiar', 'familiar', 'CREAR', '*', valores, referencia='ref-hijo-cedula'),
    ])
    soporte(m, sol, 'familiar', 'ACTA_NACIMIENTO', referencia='ref-hijo-cedula')
    with pytest.raises(ValidationError, match='CEDULA'):
        enviar(m, sol)
    soporte(m, sol, 'familiar', 'CEDULA', referencia='ref-hijo-cedula')
    assert enviar(m, sol).estado is EstadoSolicitud.ENVIADA


def test_corregir_titulo_sin_documento_no_se_envia():
    m = Mundo()
    m.ficha.datos[('formacion_academica', '5')] = {'nivel_academico_id': 1}
    sol = habilitar(m, solicitar(m, ('formacion',)))
    borrador(m, sol, [
        ItemCambioDTO('formacion', 'formacion_academica', 'MODIFICAR', 'nivel_academico_id', 4, entidad_id='5'),
    ])
    soporte(m, sol, 'formacion', 'CONSTANCIA', entidad_id='otro')  # respalda otro registro
    with pytest.raises(ValidationError, match='TITULO'):
        enviar(m, sol)
    soporte(m, sol, 'formacion', 'CONSTANCIA', entidad_id='5')
    assert enviar(m, sol).estado is EstadoSolicitud.ENVIADA


def test_quitar_formacion_complementaria_no_exige_documento():
    m = Mundo()
    m.ficha.datos[('formacion_complementaria', '9')] = {'capacitacion_id': 2}
    sol = habilitar(m, solicitar(m, ('complementaria',)))
    borrador(m, sol, [
        ItemCambioDTO('complementaria', 'formacion_complementaria', 'ELIMINAR', CAMPO_ELIMINAR,
                      {'motivo': 'El curso no corresponde al trabajador'}, entidad_id='9'),
    ])
    assert enviar(m, sol).estado is EstadoSolicitud.ENVIADA


def test_curso_con_fecha_fin_anterior_a_inicio_se_rechaza():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('complementaria',)))
    with pytest.raises(ValidationError, match='anterior'):
        borrador(m, sol, [
            ItemCambioDTO('complementaria', 'formacion_complementaria', 'CREAR', '*', {
                'capacitacion_id': 2, 'fecha_inicio': '2025-05-01', 'fecha_fin': '2025-04-01',
            }, referencia='ref-curso-malo'),
        ])


def test_crear_curso_exige_certificado():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('complementaria',)))
    borrador(m, sol, [
        ItemCambioDTO('complementaria', 'formacion_complementaria', 'CREAR', '*',
                      {'capacitacion_id': 2}, referencia='ref-curso'),
    ])
    soporte(m, sol, 'complementaria', 'CONSTANCIA', entidad_id='otro')
    with pytest.raises(ValidationError, match='CONSTANCIA'):
        enviar(m, sol)
    soporte(m, sol, 'complementaria', 'CONSTANCIA', referencia='ref-curso')
    assert enviar(m, sol).estado is EstadoSolicitud.ENVIADA


def test_no_se_pueden_superar_tres_contactos_de_emergencia():
    m = Mundo()
    m.ficha.datos[('contacto_emergencia', '1')] = {'nombres': 'ANA'}
    m.ficha.datos[('contacto_emergencia', '2')] = {'nombres': 'LUIS'}
    sol = habilitar(m, solicitar(m, ('contacto',)))
    nuevo = {
        'nombres': 'CARLOS', 'apellidos': 'GOMEZ', 'telefono': '04141234567', 'relacion_id': 1,
    }
    with pytest.raises(ValidationError, match=str(MAX_CONTACTOS_EMERGENCIA)):
        borrador(m, sol, [
            ItemCambioDTO('contacto', 'contacto_emergencia', 'CREAR', '*', dict(nuevo)),
            ItemCambioDTO('contacto', 'contacto_emergencia', 'CREAR', '*', dict(nuevo, nombres='MARIA')),
        ])


def test_quitar_un_contacto_permite_agregar_otro():
    m = Mundo()
    m.ficha.datos[('contacto_emergencia', '1')] = {'nombres': 'ANA'}
    m.ficha.datos[('contacto_emergencia', '2')] = {'nombres': 'LUIS'}
    m.ficha.datos[('contacto_emergencia', '3')] = {'nombres': 'PEDRO'}
    sol = habilitar(m, solicitar(m, ('contacto',)))
    borrador(m, sol, [
        ItemCambioDTO('contacto', 'contacto_emergencia', 'ELIMINAR', CAMPO_ELIMINAR,
                      {'motivo': 'El contacto ya no está disponible'}, entidad_id='3'),
        ItemCambioDTO('contacto', 'contacto_emergencia', 'CREAR', '*', {
            'nombres': 'CARLOS', 'apellidos': 'GOMEZ', 'telefono': '04141234567', 'relacion_id': 1,
        }),
    ])
    assert len(m.cambios.listar('ACTUALIZACION', sol.id)) == 2
