"""Dominio de la Ventana 2 (G-2) y de la tarea de contacto (G-1): esquema, completitud, efectos, avisos y escalamiento. Sin BD."""
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

import pytest

from apps.postulacion.application.use_cases.avisos import (
    solicitudes_de_transicion,
    tipos_a_resolver,
)
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante
from apps.postulacion.domain.services.contacto import contacto_atrasado, contacto_pendiente, limite_de_atraso
from apps.postulacion.domain.services.datos_ventana2 import (
    combinar_borrador,
    faltantes_ventana2,
    ids_de_catalogo,
    validar_datos_ventana2,
)
from apps.postulacion.domain.services.efectos import Vigencias, aplicar_transicion
from apps.postulacion.domain.services.maquina_estados import Actor, buscar_transicion
from apps.postulacion.domain.value_objects.estados import EstadoExpediente as E
from core.domain.exceptions import ValidationError

HOY = date(2026, 11, 24)
AHORA = datetime(2026, 11, 24, 12, tzinfo=timezone.utc)
VIG = Vigencias(ventana1_dias=15, ventana2_dias=10, reserva_puesto_dias=30, espera_diferido_dias=90)

COMPLETO = {
    'familiares': [{'primer_nombre': 'Luis', 'primer_apellido': 'Gómez', 'parentesco_id': 1, 'sexo_id': 2,
                    'fecha_nacimiento': '1988-02-10', 'depende_economicamente': False}],
    'vivienda': {'condicion_vivienda_id': 1, 'estado_id': 1, 'municipio_id': 1, 'parroquia_id': 1, 'direccion_exacta': 'Calle 1'},
    'salud': {'grupo_sanguineo_id': 1},
    'tallas': {'talla_camisa_id': 1, 'talla_pantalon_id': 2, 'talla_zapatos_id': 3},
}


def exp(estado=E.CONSOLIDANDO, **cambios):
    return ExpedientePostulacion(id='e1', numero='EXP-1', postulante_id='p1', estado=estado, **cambios)


# ------------------------------------------------------------------------------------------------ esquema
def test_borrador_normaliza_y_acepta_secciones_parciales():
    limpio = validar_datos_ventana2({
        'familiares': [{'primer_nombre': '  Ana   María ', 'cedula': 'v123', 'orden_hijo': '2', 'depende_economicamente': False,
                        'segundo_nombre': '', 'fecha_nacimiento': '2020-01-01'}],
        'salud': {'alergias': [3, '1', 3], 'grupo_sanguineo_id': ''},
        'tallas': {'talla_camisa_id': '4', 'talla_chaqueta_id': None},
    }, HOY)
    f = limpio['familiares'][0]
    assert f['primer_nombre'] == 'Ana María' and f['cedula'] == 'V123' and f['orden_hijo'] == 2
    assert f['depende_economicamente'] is False and 'segundo_nombre' not in f      # `False` se conserva; el vacío no
    assert limpio['salud'] == {'alergias': [1, 3]} and limpio['tallas'] == {'talla_camisa_id': 4}
    assert set(limpio) == {'familiares', 'salud', 'tallas'}                        # solo las secciones enviadas


@pytest.mark.parametrize('datos', [
    [], 'x', {'otra': 1}, {'familiares': {}}, {'familiares': ['x']}, {'familiares': [{'raro': 1}]},
    {'familiares': [{'fecha_nacimiento': '2026-11-25'}]}, {'familiares': [{'fecha_nacimiento': '24/11/2020'}]},
    {'familiares': [{'depende_economicamente': 1}]}, {'familiares': [{'orden_hijo': 0}]}, {'familiares': [{'orden_hijo': 100}]},
    {'familiares': [{}] * 21}, {'sin_familiares': 'si'}, {'vivienda': 'x'}, {'vivienda': {'x': 1}},
    {'vivienda': {'estado_id': 0}}, {'vivienda': {'estado_id': True}}, {'vivienda': {'direccion_exacta': 5}},
    {'salud': {'alergias': '1'}}, {'salud': {'alergias': [0]}}, {'salud': {'otra': []}},
    {'tallas': {'talla_camisa_id': 'XL'}}, {'tallas': {'otra': 1}},
])
def test_borrador_rechaza_lo_que_no_es_del_esquema(datos):
    with pytest.raises(ValidationError):
        validar_datos_ventana2(datos, HOY)


def test_el_error_indica_la_ruta_del_campo():
    with pytest.raises(ValidationError) as e:
        validar_datos_ventana2({'familiares': [{}, {'sexo_id': 'x'}]}, HOY)
    assert e.value.campo == 'datos_ventana2.familiares.1.sexo_id'


def test_combinar_reemplaza_la_seccion_enviada_y_conserva_las_otras():
    actual = {'vivienda': {'direccion_exacta': 'A'}, 'tallas': {'talla_camisa_id': 1}}
    assert combinar_borrador(actual, {'vivienda': {'direccion_exacta': 'B'}}) == {
        'vivienda': {'direccion_exacta': 'B'}, 'tallas': {'talla_camisa_id': 1}}
    assert combinar_borrador(None, {'sin_familiares': True}) == {'sin_familiares': True}


def test_ids_de_catalogo_agrupa_lo_que_hay_que_comprobar():
    ids = ids_de_catalogo({**COMPLETO, 'salud': {'grupo_sanguineo_id': 5, 'alergias': [7], 'discapacidades': [8, 9]}})
    assert ids['parentesco'] == [1] and ids['sexo'] == [2] and ids['condicion_vivienda'] == [1] and ids['grupo_sanguineo'] == [5]
    assert ids['alergia'] == [7] and ids['patologia_cronica'] == [] and ids['discapacidad'] == [8, 9] and ids['talla'] == [1, 2, 3]


# ------------------------------------------------------------------------------------------------ completitud
def test_completa_con_foto_no_falta_nada_y_sin_foto_solo_la_foto():
    assert faltantes_ventana2(COMPLETO, tiene_foto=True) == []
    assert [f['campo'] for f in faltantes_ventana2(COMPLETO, tiene_foto=False)] == ['foto']


def test_vacia_lista_cada_campo_obligatorio_de_cada_seccion_con_su_ruta():
    faltan = faltantes_ventana2({}, tiene_foto=False)
    campos = {f['campo'] for f in faltan}
    assert campos == {
        'familiares', 'vivienda.condicion_vivienda_id', 'vivienda.estado_id', 'vivienda.municipio_id', 'vivienda.parroquia_id',
        'vivienda.direccion_exacta', 'salud.grupo_sanguineo_id', 'tallas.talla_camisa_id', 'tallas.talla_pantalon_id',
        'tallas.talla_zapatos_id', 'foto',
    }
    assert all({'seccion', 'campo', 'mensaje'} == set(f) and f['mensaje'] for f in faltan)
    assert {f['seccion'] for f in faltan} == {'familiares', 'vivienda', 'salud', 'tallas', 'foto'}


def test_sin_familiares_se_declara_expresamente_y_no_se_mezcla_con_familiares():
    sin = {**COMPLETO, 'familiares': [], 'sin_familiares': True}
    assert faltantes_ventana2(sin, True) == []
    contradictorio = {**COMPLETO, 'sin_familiares': True}
    assert [f['campo'] for f in faltantes_ventana2(contradictorio, True)] == ['sin_familiares']
    assert [f['campo'] for f in faltantes_ventana2({**COMPLETO, 'familiares': []}, True)] == ['familiares']


def test_cada_familiar_exige_sus_campos_y_la_dependencia_economica():
    incompleto = {**COMPLETO, 'familiares': [COMPLETO['familiares'][0], {'primer_nombre': 'Ana'}]}
    campos = {f['campo'] for f in faltantes_ventana2(incompleto, True)}
    assert campos == {'familiares.1.primer_apellido', 'familiares.1.parentesco_id', 'familiares.1.sexo_id',
                      'familiares.1.fecha_nacimiento', 'familiares.1.depende_economicamente'}


# ------------------------------------------------------------------------------------------------ contacto y efectos
def test_reabrir_la_ventana_2_deja_el_contacto_pendiente_y_salir_de_consolidando_lo_limpia():
    reabre = aplicar_transicion(exp(E.APROBADO), buscar_transicion(E.APROBADO, E.CONSOLIDANDO), AHORA, VIG)
    assert reabre.contacto_pendiente_desde == AHORA and reabre.ventana == 2 and reabre.ventana_vence_el == AHORA + timedelta(days=10)
    observa = aplicar_transicion(exp(E.EN_REVISION_FINAL), buscar_transicion(E.EN_REVISION_FINAL, E.CONSOLIDANDO), AHORA, VIG)
    assert observa.contacto_pendiente_desde == AHORA
    # guardar borrador (autotransición) no toca la tarea
    guarda = aplicar_transicion(reabre, buscar_transicion(E.CONSOLIDANDO, E.CONSOLIDANDO), AHORA + timedelta(hours=5), VIG)
    assert guarda.contacto_pendiente_desde == AHORA
    envia = aplicar_transicion(reabre, buscar_transicion(E.CONSOLIDANDO, E.EN_REVISION_FINAL), AHORA, VIG)
    assert envia.contacto_pendiente_desde is None


def test_atraso_del_contacto_segun_las_horas_del_parametro():
    e = exp(contacto_pendiente_desde=AHORA - timedelta(hours=48))
    assert contacto_pendiente(e) and contacto_atrasado(e, AHORA, 48) and not contacto_atrasado(e, AHORA, 49)
    assert not contacto_atrasado(exp(contacto_pendiente_desde=AHORA - timedelta(hours=47, minutes=59)), AHORA, 48)
    assert not contacto_pendiente(exp()) and not contacto_atrasado(exp(), AHORA, 1)
    assert limite_de_atraso(AHORA, 24) == AHORA - timedelta(hours=24)


# ------------------------------------------------------------------------------------------------ avisos
def post():
    return Postulante(id='p1', cedula='12345678', nombres='Ana', apellidos='Pérez', correo='ana@correo.com')


def avisos(origen, destino, actor=None, motivo='', **expediente):
    return solicitudes_de_transicion(
        exp(destino, **expediente), post(), origen, destino, actor or Actor(cedula='1', permisos=frozenset()), 'asiento-1', motivo,
    )


def test_reabrir_avisa_contactar_al_postulante_a_la_bandeja_de_captacion():
    (a,) = avisos(E.APROBADO, E.CONSOLIDANDO)
    assert (a.tipo, a.permiso_destino, a.enlace, a.clave) == ('CONTACTAR_POSTULANTE', 'postulacion.ver_bandeja', '/captacion/expedientes/e1', 'asiento-1')
    assert 'contraseña temporal' in a.mensaje and '12345678' not in a.mensaje and a.modulo == 'postulacion'
    (a,) = avisos(E.EN_REVISION_FINAL, E.CONSOLIDANDO, motivo='Falta la foto')
    assert a.tipo == 'CONTACTAR_POSTULANTE' and 'Falta la foto' in a.mensaje and 'faltan datos' in a.titulo


def test_el_postulante_o_el_sistema_no_generan_la_tarea_de_contacto_ni_guardar_borrador():
    assert avisos(E.APROBADO, E.CONSOLIDANDO, Actor.sistema()) == []
    assert avisos(E.CONSOLIDANDO, E.CONSOLIDANDO) == []


def test_la_contratacion_avisa_a_captacion_y_pide_el_carnet_solo_si_hay_foto():
    sin = avisos(E.LISTO_PARA_ASIGNAR, E.CONTRATADO)
    assert [a.tipo for a in sin] == ['CONTRATACION_COMPLETADA'] and sin[0].permiso_destino == 'postulacion.ver_bandeja'
    con = avisos(E.LISTO_PARA_ASIGNAR, E.CONTRATADO, foto_clave='postulacion/foto/x.jpg')
    assert [a.tipo for a in con] == ['CONTRATACION_COMPLETADA', 'CARNET_PENDIENTE']
    assert con[1].permiso_destino == 'carnetizacion.emitir' and all(a.clave == 'asiento-1' for a in con)


def test_que_avisos_cierra_cada_paso():
    captacion = Actor(cedula='20000001', permisos=frozenset({'postulacion.revision_final'}))
    assert tipos_a_resolver(E.APROBADO, E.CONSOLIDANDO, captacion) == ['INGRESO_APROBADO']
    assert tipos_a_resolver(E.EN_REVISION_FINAL, E.CONSOLIDANDO, captacion) == ['EXPEDIENTE_REVISION_FINAL']
    assert tipos_a_resolver(E.EN_REVISION_FINAL, E.LISTO_PARA_ASIGNAR, captacion) == ['EXPEDIENTE_REVISION_FINAL']
    assert set(tipos_a_resolver(E.LISTO_PARA_ASIGNAR, E.CONTRATADO, captacion)) == {
        'CONTACTAR_POSTULANTE', 'CONTACTO_ATRASADO', 'EXPEDIENTE_REVISION_FINAL', 'INGRESO_APROBADO'}
    postulante = Actor.postulante('12345678')
    assert tipos_a_resolver(E.CONSOLIDANDO, E.EN_REVISION_FINAL, postulante) == ['CONTACTAR_POSTULANTE', 'CONTACTO_ATRASADO']
    assert tipos_a_resolver(E.EN_CAPTURA, E.ENVIADO_CAPTACION, postulante) == []
    assert tipos_a_resolver(E.APROBADO, E.CONSOLIDANDO, Actor.sistema()) == []
    assert tipos_a_resolver(E.APROBADO, E.CONSOLIDANDO, Actor(permisos=frozenset())) == []   # sin cédula no hay quien resuelva


def test_la_maquina_exige_motivo_al_observar_y_solo_captacion_reabre():
    from apps.postulacion.domain.services.maquina_estados import Hechos, validar_transicion

    h = Hechos(ahora=AHORA)
    with pytest.raises(Exception) as e:
        validar_transicion(E.EN_REVISION_FINAL, E.CONSOLIDANDO, Actor(cedula='1', permisos=frozenset({'postulacion.revision_final'})), h, '')
    assert getattr(e.value, 'codigo', '') == 'MOTIVO_OBLIGATORIO'
    with pytest.raises(Exception) as e:
        validar_transicion(E.APROBADO, E.CONSOLIDANDO, Actor(cedula='1', permisos=frozenset({'postulacion.verificar'})), h)
    assert getattr(e.value, 'codigo', '') == 'SIN_PERMISO'
    assert replace(exp(), foto_clave='x').tiene_foto and not exp().tiene_foto
