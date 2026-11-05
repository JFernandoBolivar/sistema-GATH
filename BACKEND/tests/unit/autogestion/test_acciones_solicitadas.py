"""Secciones de lista: la solicitud pide ACCIONES (agregar, corregir, quitar) y el borrador solo admite esas."""
import pytest

from apps.autogestion.application.dtos.actualizacion_dtos import ItemCambioDTO
from apps.autogestion.application.use_cases.solicitud_ciclo import solicitar_actualizacion
from apps.autogestion.domain.value_objects.secciones import (
    CAMPO_ELIMINAR,
    ENTIDADES_DE_LISTA,
    Accion,
    acciones_solicitadas,
    clave_accion,
)
from core.domain.exceptions import ValidationError

from .memoria_actualizacion import TRABAJADOR, Mundo
from .test_actualizacion_flujo import borrador, enviar, habilitar, solicitar

MOTIVO = 'Quiero actualizar mi grupo familiar con urgencia'
FAMILIAR = {
    'primer_nombre': 'PEDRO', 'primer_apellido': 'PEREZ', 'parentesco_id': 3,
    'fecha_nacimiento': '2020-01-15', 'sexo_id': 1,
}


def pedir(m, claves):
    return solicitar_actualizacion(m.solicitudes, m.secciones, m.publicador, cedula=TRABAJADOR, campos=claves, motivo=MOTIVO)


def crear():
    return ItemCambioDTO('familiar', 'familiar', 'CREAR', '*', dict(FAMILIAR), referencia='r1')


def quitar():
    return ItemCambioDTO('familiar', 'familiar', 'ELIMINAR', CAMPO_ELIMINAR, {'motivo': 'Ya no vive con el trabajador'}, entidad_id='7')


def corregir():
    return ItemCambioDTO('familiar', 'familiar', 'MODIFICAR', 'primer_nombre', 'LUIS', entidad_id='7')


def test_las_acciones_son_solicitables_y_derivan_la_seccion():
    m = Mundo()
    sol = pedir(m, [clave_accion('familiar', Accion.CREAR)])
    assert sol.campos_solicitados == ('familiar.@CREAR',)
    assert sol.secciones_solicitadas == ('familiar',)


def test_accion_desconocida_no_se_acepta():
    with pytest.raises(ValidationError):
        pedir(Mundo(), ['familiar.@BORRAR'])
    with pytest.raises(ValidationError):  # entidad que no es de lista
        pedir(Mundo(), ['employee.@CREAR'])


def test_si_solo_pidio_agregar_no_puede_corregir_ni_quitar():
    m = Mundo()
    sol = habilitar(m, pedir(m, [clave_accion('familiar', Accion.CREAR)]))
    borrador(m, sol, [crear()])
    for item, verbo in ((corregir(), 'corregir'), (quitar(), 'quitar')):
        with pytest.raises(ValidationError, match=verbo) as e:
            borrador(m, sol, [item])
        assert e.value.campo == 'accion'


def test_varias_acciones_se_permiten_juntas():
    m = Mundo()
    sol = habilitar(m, pedir(m, [clave_accion('familiar', Accion.CREAR), clave_accion('familiar', Accion.ELIMINAR)]))
    borrador(m, sol, [crear(), quitar()])
    with pytest.raises(ValidationError, match='corregir'):
        borrador(m, sol, [corregir()])


def test_el_envio_tambien_rechaza_acciones_no_solicitadas():
    m = Mundo()
    sol = habilitar(m, pedir(m, [clave_accion('familiar', Accion.CREAR)]))
    borrador(m, sol, [crear()])
    # Se simula un borrador previo con una acción no pedida.
    cambio = m.cambios.listar('ACTUALIZACION', sol.id)[0]
    from dataclasses import replace
    m.cambios.guardar(replace(cambio, id='', accion='ELIMINAR', campo=CAMPO_ELIMINAR, entidad_id='7'))
    with pytest.raises(ValidationError, match='quitar'):
        enviar(m, sol)


def test_solicitud_vieja_con_campos_sueltos_permite_todas_las_acciones():
    m = Mundo()
    sol = habilitar(m, solicitar(m, ('familiar',)))
    assert not any(c.endswith(('@CREAR', '@MODIFICAR', '@ELIMINAR')) for c in sol.campos_habilitados)
    borrador(m, sol, [crear(), quitar()])
    assert acciones_solicitadas('familiar', sol.campos_habilitados) == {a.value for a in Accion}


def test_sin_claves_de_la_entidad_no_hay_acciones():
    assert acciones_solicitadas('familiar', ['employee.telefono_movil']) == frozenset()


def test_las_cuatro_secciones_de_lista_aceptan_acciones():
    m = Mundo()
    claves = [clave_accion(e, Accion.CREAR) for e in sorted(ENTIDADES_DE_LISTA)]
    sol = pedir(m, claves)
    assert set(sol.secciones_solicitadas) == {'familiar', 'contacto', 'formacion', 'complementaria'}
