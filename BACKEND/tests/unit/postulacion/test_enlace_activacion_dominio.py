"""Reglas puras del enlace de activación (D-10): token, hash, vigencia, enmascarado y estados."""
from datetime import datetime, timedelta, timezone

import pytest

from apps.postulacion.application.use_cases.avisos import correo_enlace_activacion
from apps.postulacion.domain.entities.enlace_activacion import EnlaceActivacion
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante
from apps.postulacion.domain.errores import EnlaceBloqueado, EnlaceInvalido, EnlaceUsado, EnlaceVencido
from apps.postulacion.domain.services.enlace_activacion import (
    enmascarar_correo,
    exigir_utilizable,
    generar_token,
    hash_de_token,
    tras_cedula_incorrecta,
    vencimiento_del_enlace,
)
from apps.postulacion.domain.value_objects.estados import EstadoExpediente as E

AHORA = datetime(2026, 11, 21, 16, tzinfo=timezone.utc)


def enlace(**kw):
    base = dict(
        id='1', expediente_id='7', token_hash='h', correo_destino='juan@gmail.com', creado_por='20000001',
        creado_el=AHORA, vence_el=AHORA + timedelta(hours=48),
    )
    return EnlaceActivacion(**{**base, **kw})


def test_token_largo_unico_y_hash_sha256():
    a, b = generar_token(), generar_token()
    assert a != b and len(a) >= 43 and all(c.isalnum() or c in '-_' for c in a)
    assert hash_de_token(a) != a and len(hash_de_token(a)) == 64 and hash_de_token(a) == hash_de_token(a)


def test_vigencia_es_la_menor_entre_las_horas_y_la_ventana():
    ventana_lejos = AHORA + timedelta(days=10)
    assert vencimiento_del_enlace(AHORA, 48, ventana_lejos) == AHORA + timedelta(hours=48)
    ventana_cerca = AHORA + timedelta(hours=5)
    assert vencimiento_del_enlace(AHORA, 48, ventana_cerca) == ventana_cerca


@pytest.mark.parametrize('correo,esperado', [
    ('juan.perez@gmail.com', 'ju***@gmail.com'), ('a@x.com', 'a***@x.com'), ('sin-arroba', '***'), ('', '***'),
])
def test_correo_enmascarado(correo, esperado):
    assert enmascarar_correo(correo) == esperado


def test_estados_del_enlace_con_su_codigo():
    assert exigir_utilizable(enlace(), AHORA)
    with pytest.raises(EnlaceInvalido):
        exigir_utilizable(None, AHORA)
    with pytest.raises(EnlaceInvalido):
        exigir_utilizable(enlace(revocado=True), AHORA)
    with pytest.raises(EnlaceUsado):
        exigir_utilizable(enlace(usado_el=AHORA), AHORA)
    with pytest.raises(EnlaceVencido):
        exigir_utilizable(enlace(), AHORA + timedelta(hours=49))
    with pytest.raises(EnlaceBloqueado):
        exigir_utilizable(enlace(intentos=5), AHORA)


def test_cinco_cedulas_equivocadas_bloquean():
    e = enlace()
    for _ in range(5):
        e = tras_cedula_incorrecta(e)
    assert e.intentos == 5
    with pytest.raises(EnlaceBloqueado):
        exigir_utilizable(e, AHORA)


def test_correo_de_invitacion_sin_contrasena_ni_cedula():
    exp = ExpedientePostulacion(id='7', numero='EXP-2026-00007', postulante_id='2', estado=E.PRE_REGISTRADO)
    p = Postulante(id='2', cedula='12345678', nombres='Ana', apellidos='Pérez', correo='ana@correo.com')
    c = correo_enlace_activacion(exp, p, 'TOKEN123', AHORA + timedelta(hours=48), 'enl-1')
    assert c.enlace == '/postulacion/activar?t=TOKEN123' and c.clave == 'enl-1' and c.destinatario_correo == 'ana@correo.com'
    assert 'Captación de CONATEL te invitó' in c.mensaje and 'N.º EXP-2026-00007' in c.mensaje
    assert 'una sola vez' in c.mensaje and 'ignora este mensaje' in c.mensaje and '23/11/2026' in c.mensaje
    texto = f'{c.asunto} {c.titulo} {c.mensaje}'
    assert '12345678' not in texto and 'TOKEN123' not in texto and 'temporal' not in texto
