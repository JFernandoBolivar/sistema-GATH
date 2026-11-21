"""Reglas puras de la credencial del postulante (D-3) y del esquema de la Ventana 1 (D-4). Sin base de datos."""
from datetime import date, datetime, timedelta, timezone

import pytest

from apps.postulacion.domain.entities.credencial import CredencialPostulante
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.errores import AccesoNoDisponible, CredencialBloqueada, CredencialVencida
from apps.postulacion.domain.services.credencial import (
    DURACION_SESION_INVITADO,
    ESTADOS_CON_ACCESO,
    MAX_INTENTOS_FALLIDOS,
    MINUTOS_BLOQUEO,
    credencial_tras_transicion,
    exigir_sin_bloqueo,
    exigir_vigente,
    expiracion_sesion,
    generar_clave_temporal,
    tras_exito,
    tras_fallo,
    validar_clave_nueva,
)
from apps.postulacion.domain.services.datos_ventana import campos_obligatorios_faltantes, validar_datos_ventana1
from apps.postulacion.domain.value_objects.estados import ESTADOS_TERMINALES, EstadoExpediente as E
from core.domain.exceptions import ValidationError

AHORA = datetime(2026, 11, 21, 12, 0, tzinfo=timezone.utc)
HOY = date(2026, 11, 21)


def _cred(**kw) -> CredencialPostulante:
    base = dict(id='c1', expediente_id='e1', usuario='12345678', clave_hash='hash', ventana=1,
                vence_el=AHORA + timedelta(days=15))
    base.update(kw)
    return CredencialPostulante(**base)


def _exp(estado, **kw) -> ExpedientePostulacion:
    base = dict(id='e1', numero='EXP-2026-00001', postulante_id='p1', estado=estado, ventana=1,
                ventana_vence_el=AHORA + timedelta(days=15))
    base.update(kw)
    return ExpedientePostulacion(**base)


def test_clave_temporal_aleatoria_de_al_menos_10_caracteres_con_letras_y_digitos():
    claves = {generar_clave_temporal() for _ in range(50)}
    assert len(claves) == 50
    for c in claves:
        assert len(c) >= 10
        assert any(x.isupper() for x in c) and any(x.islower() for x in c) and any(x.isdigit() for x in c)
        assert not set(c) & set('0O1lI')
    with pytest.raises(ValueError):
        generar_clave_temporal(8)


def test_la_representacion_de_la_credencial_no_expone_el_hash():
    assert 'hash' not in repr(_cred(clave_hash='secreto-hash'))


def test_cinco_fallos_bloquean_quince_minutos_y_reinician_el_contador():
    cred = _cred()
    for n in range(1, MAX_INTENTOS_FALLIDOS):
        cred = tras_fallo(cred, AHORA)
        assert cred.intentos_fallidos == n and cred.bloqueada_hasta is None
    cred = tras_fallo(cred, AHORA)
    assert cred.intentos_fallidos == 0
    assert cred.bloqueada_hasta == AHORA + timedelta(minutes=MINUTOS_BLOQUEO)
    with pytest.raises(CredencialBloqueada) as e:
        exigir_sin_bloqueo(cred, AHORA + timedelta(minutes=MINUTOS_BLOQUEO - 1))
    assert e.value.bloqueada_hasta == cred.bloqueada_hasta
    exigir_sin_bloqueo(cred, AHORA + timedelta(minutes=MINUTOS_BLOQUEO, seconds=1))  # desbloqueada al vencer


def test_el_exito_limpia_intentos_y_bloqueo_y_anota_el_ultimo_acceso():
    cred = tras_exito(_cred(intentos_fallidos=3, bloqueada_hasta=AHORA - timedelta(minutes=1)), AHORA)
    assert (cred.intentos_fallidos, cred.bloqueada_hasta, cred.ultimo_acceso) == (0, None, AHORA)


def test_vigencia_ventana_vencida_revocada_y_etapa_de_revision():
    exigir_vigente(_cred(), E.EN_CAPTURA, AHORA)
    with pytest.raises(CredencialVencida, match='venció'):
        exigir_vigente(_cred(vence_el=AHORA - timedelta(seconds=1)), E.EN_CAPTURA, AHORA)
    with pytest.raises(CredencialVencida):
        exigir_vigente(_cred(revocada=True), E.EN_CAPTURA, AHORA)
    for estado in set(E) - ESTADOS_CON_ACCESO - ESTADOS_TERMINALES:
        with pytest.raises(AccesoNoDisponible):
            exigir_vigente(_cred(), estado, AHORA)


def test_la_sesion_dura_como_mucho_2_horas_y_nunca_pasa_del_vencimiento():
    assert expiracion_sesion(_cred(), AHORA) == AHORA + DURACION_SESION_INVITADO == AHORA + timedelta(hours=2)
    corta = _cred(vence_el=AHORA + timedelta(minutes=30))
    assert expiracion_sesion(corta, AHORA) == corta.vence_el


@pytest.mark.parametrize('clave,error', [
    ('Corta1', 'al menos'), ('soloLetrasLargas', 'letras y números'), ('1234567890123', 'letras y números'),
    ('Abc12345678', 'cédula'), ('Actual12345x', 'distinta'),
])
def test_politica_de_la_clave_nueva(clave, error):
    with pytest.raises(ValidationError, match=error) as e:
        validar_clave_nueva(clave, cedula='12345678', clave_actual='Actual12345x')
    assert e.value.campo == 'clave_nueva'
    assert validar_clave_nueva('Nueva-clave-77', cedula='12345678', clave_actual='Actual12345x')


def test_reabrir_una_ventana_extiende_la_vigencia_de_la_credencial():
    cred = _cred(vence_el=AHORA - timedelta(days=1))
    nueva_vence = AHORA + timedelta(days=10)
    # Devolución por observaciones (ENVIADO_CAPTACION -> EN_CORRECCION_DATOS)
    r = credencial_tras_transicion(cred, E.ENVIADO_CAPTACION, _exp(E.EN_CORRECCION_DATOS, ventana_vence_el=nueva_vence))
    assert (r.vence_el, r.ventana, r.version_sesion) == (nueva_vence, 1, cred.version_sesion)
    # Ventana 2 (APROBADO -> CONSOLIDANDO)
    r = credencial_tras_transicion(cred, E.APROBADO, _exp(E.CONSOLIDANDO, ventana=2, ventana_vence_el=nueva_vence))
    assert (r.vence_el, r.ventana) == (nueva_vence, 2)


def test_enviar_suspende_la_credencial_y_cierra_las_sesiones_abiertas():
    cred = _cred()
    r = credencial_tras_transicion(cred, E.EN_CAPTURA, _exp(E.ENVIADO_CAPTACION))
    assert r.version_sesion == cred.version_sesion + 1 and not r.revocada
    # Ya suspendida: pasar entre estados de revisión no vuelve a tocarla.
    assert credencial_tras_transicion(r, E.ENVIADO_CAPTACION, _exp(E.EN_PRESUPUESTO)) == r


@pytest.mark.parametrize('terminal', sorted(ESTADOS_TERMINALES, key=lambda e: e.value))
def test_un_estado_final_revoca_la_credencial(terminal):
    r = credencial_tras_transicion(_cred(), E.ENVIADO_CAPTACION, _exp(terminal))
    assert r.revocada
    assert credencial_tras_transicion(r, terminal, _exp(terminal)) == r


def test_datos_ventana1_normaliza_y_valida():
    datos = validar_datos_ventana1({
        'fecha_nacimiento': '1990-05-17', 'sexo': 'F', 'nacionalidad': 'V', 'estado_civil': '  soltera ',
        'telefono_alterno': '0412-1234567', 'direccion_habitacion': 'Av.  Principal',
        'contacto_emergencia': {'nombre': 'María  Pérez', 'telefono': '0414 7654321', 'parentesco': 'Madre'},
    }, HOY)
    assert datos['estado_civil'] == 'soltera' and datos['direccion_habitacion'] == 'Av. Principal'
    assert datos['telefono_alterno'] == '+584121234567'
    assert datos['contacto_emergencia'] == {'nombre': 'María Pérez', 'telefono': '+584147654321', 'parentesco': 'Madre'}


@pytest.mark.parametrize('datos,campo', [
    ({'cedula': '1'}, 'datos_ventana1'),
    ({'fecha_nacimiento': '17/05/1990'}, 'datos_ventana1.fecha_nacimiento'),
    ({'fecha_nacimiento': '2030-01-01'}, 'datos_ventana1.fecha_nacimiento'),
    ({'sexo': 'X'}, 'datos_ventana1.sexo'),
    ({'estado_civil': 'x' * 31}, 'datos_ventana1.estado_civil'),
    ({'telefono_alterno': 'abc'}, 'datos_ventana1.telefono_alterno'),
    ({'contacto_emergencia': {'otro': 'x'}}, 'datos_ventana1.contacto_emergencia'),
    ({'contacto_emergencia': 'x'}, 'datos_ventana1.contacto_emergencia'),
])
def test_datos_ventana1_rechaza_lo_invalido_indicando_el_campo(datos, campo):
    with pytest.raises(ValidationError) as e:
        validar_datos_ventana1(datos, HOY)
    assert e.value.campo == campo


def test_campos_obligatorios_para_enviar_la_ventana1():
    assert campos_obligatorios_faltantes({}) == ['fecha_nacimiento', 'sexo']
    assert campos_obligatorios_faltantes({'fecha_nacimiento': '1990-05-17'}) == ['sexo']
    assert campos_obligatorios_faltantes({'fecha_nacimiento': '1990-05-17', 'sexo': 'M'}) == []
