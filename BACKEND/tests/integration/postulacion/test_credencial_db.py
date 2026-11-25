"""Credencial del postulante (D-3) contra la BD: hash, bloqueo, vigencia, reposición y seguimiento del expediente."""
from datetime import timedelta

import pytest

from apps.postulacion.application.use_cases.credenciales import (
    alta_postulante_con_credencial,
    autenticar_postulante,
    cambiar_clave,
    emitir_credencial,
    resolver_sesion,
)
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.errores import (
    AccesoNoDisponible,
    CredencialBloqueada,
    CredencialesInvalidas,
    CredencialVencida,
    SesionInvalida,
)
from apps.postulacion.domain.services.credencial import MAX_INTENTOS_FALLIDOS, MINUTOS_BLOQUEO
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente as E
from apps.postulacion.infrastructure.hasheador_django import HasheadorDjango
from apps.postulacion.infrastructure.models.credencial_models import CredencialPostulanteModel
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel, TransicionExpedienteModel
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import BuscadorEmpleadosORM, RepoPostulacionORM
from core.domain.exceptions import ConflictError, ValidationError

pytestmark = pytest.mark.django_db

CEDULA = '12345678'
CAPTACION = Actor(cedula='20000001', permisos=frozenset({'postulacion.verificar', 'postulacion.revision_final'}))


class ConfigFalsa:
    valores = {
        'captacion.vigencia_ventana1_dias': 15, 'captacion.vigencia_ventana2_dias': 10,
        'captacion.vigencia_reserva_puesto_dias': 30, 'captacion.espera_diferido_dias': 90, 'captacion.horas_escalamiento_contacto': 48,
        'captacion.psicofisico_obligatorio': True,
        'captacion.requiere_presupuesto': True, 'captacion.requiere_direccion_general': True,
    }

    def obtener_texto(self, clave):
        return str(self.valores[clave])

    def obtener_booleano(self, clave):
        return bool(self.valores[clave])

    def obtener_entero(self, clave):
        return int(self.valores[clave])


REPO = RepoPostulacionORM()
HASH = HasheadorDjango()


def _alta(cedula=CEDULA):
    return alta_postulante_con_credencial(
        REPO, BuscadorEmpleadosORM(), ConfigFalsa(), HASH, cedula=cedula, nombres='Ana', apellidos='Pérez',
        creado_por='20000001',
    )


def _entrar(cedula, clave, **kw):
    return autenticar_postulante(REPO, HASH, ConfigFalsa(), cedula=cedula, clave=clave, **kw)


def test_la_clave_solo_existe_como_hash_en_la_base():
    alta = _alta()
    clave = alta.emision.clave_temporal
    fila = CredencialPostulanteModel.objects.get(expediente_id=alta.expediente.id)
    assert fila.clave_hash != clave and clave not in fila.clave_hash
    assert fila.clave_hash.startswith(('argon2', 'pbkdf2_'))
    assert HASH.verificar(clave, fila.clave_hash) and not HASH.verificar(clave + 'x', fila.clave_hash)
    # Ningún campo de ninguna fila guarda el texto en claro.
    valores = ' '.join(str(v) for v in CredencialPostulanteModel.objects.values().first().values())
    assert clave not in valores
    assert (fila.usuario, fila.ventana, fila.debe_cambiar_clave, fila.emitida_por) == (CEDULA, 1, True, '20000001')
    assert fila.vence_el == alta.expediente.ventana_vence_el


def test_acceso_correcto_pasa_a_en_captura_una_sola_vez_y_deja_historial():
    alta = _alta()
    acceso = _entrar(CEDULA, alta.emision.clave_temporal)
    assert acceso.primer_acceso and acceso.expediente.estado == E.EN_CAPTURA
    assert acceso.credencial.ultimo_acceso is not None
    segundo = _entrar(CEDULA, alta.emision.clave_temporal)
    assert not segundo.primer_acceso
    historial = list(TransicionExpedienteModel.objects.filter(expediente_id=alta.expediente.id).values_list(
        'estado_destino', 'actor_tipo'))
    assert historial == [('PRE_REGISTRADO', 'USUARIO'), ('EN_CAPTURA', 'POSTULANTE')]


def test_cedula_inexistente_y_clave_incorrecta_dan_el_mismo_mensaje():
    alta = _alta()
    with pytest.raises(CredencialesInvalidas) as a:
        _entrar('99999999', 'cualquiera')
    with pytest.raises(CredencialesInvalidas) as b:
        _entrar(CEDULA, 'incorrecta')
    assert str(a.value) == str(b.value)
    assert alta.emision.credencial.usuario == CEDULA


def test_cinco_intentos_bloquean_y_se_desbloquea_al_vencer():
    alta = _alta()
    clave = alta.emision.clave_temporal
    inicio = alta.expediente.fecha_apertura
    for _ in range(MAX_INTENTOS_FALLIDOS - 1):
        with pytest.raises(CredencialesInvalidas):
            _entrar(CEDULA, 'mala', ahora=inicio)
    # El fallo que alcanza el máximo ya responde «bloqueada» y el contador quedó guardado.
    with pytest.raises(CredencialBloqueada) as e:
        _entrar(CEDULA, 'mala', ahora=inicio)
    assert e.value.bloqueada_hasta == inicio + timedelta(minutes=MINUTOS_BLOQUEO)
    # Mientras dura el bloqueo ni la clave correcta entra.
    with pytest.raises(CredencialBloqueada):
        _entrar(CEDULA, clave, ahora=inicio + timedelta(minutes=MINUTOS_BLOQUEO - 1))
    fila = CredencialPostulanteModel.objects.get(expediente_id=alta.expediente.id)
    assert fila.bloqueada_hasta is not None and fila.intentos_fallidos == 0
    # Al vencer el bloqueo, entra y todo se limpia.
    acceso = _entrar(CEDULA, clave, ahora=inicio + timedelta(minutes=MINUTOS_BLOQUEO, seconds=1))
    assert acceso.credencial.bloqueada_hasta is None and acceso.credencial.intentos_fallidos == 0


def test_un_acierto_antes_del_maximo_reinicia_el_contador():
    alta = _alta()
    for _ in range(MAX_INTENTOS_FALLIDOS - 1):
        with pytest.raises(CredencialesInvalidas):
            _entrar(CEDULA, 'mala')
    _entrar(CEDULA, alta.emision.clave_temporal)
    with pytest.raises(CredencialesInvalidas):  # vuelve a contar desde uno, no bloquea
        _entrar(CEDULA, 'mala')


def test_ventana_vencida_rechaza_el_acceso_con_mensaje_claro():
    alta = _alta()
    despues = alta.expediente.ventana_vence_el + timedelta(seconds=1)
    with pytest.raises(CredencialVencida, match='venció'):
        _entrar(CEDULA, alta.emision.clave_temporal, ahora=despues)
    # Con la clave mala sigue siendo el mensaje genérico: la vigencia no se revela sin la clave.
    with pytest.raises(CredencialesInvalidas):
        _entrar(CEDULA, 'mala', ahora=despues)


def test_reponer_invalida_la_clave_anterior_y_las_sesiones_abiertas():
    alta = _alta()
    vieja = alta.emision.clave_temporal
    acceso = _entrar(CEDULA, vieja)
    nueva = emitir_credencial(REPO, HASH, expediente_id=alta.expediente.id, emitida_por='20000002')
    assert nueva.clave_temporal != vieja
    assert CredencialPostulanteModel.objects.filter(expediente_id=alta.expediente.id).count() == 1
    with pytest.raises(CredencialesInvalidas):
        _entrar(CEDULA, vieja)
    with pytest.raises(SesionInvalida):  # la sesión abierta con la clave vieja cae
        resolver_sesion(REPO, cedula=CEDULA, expediente_id=alta.expediente.id,
                        version_sesion=acceso.credencial.version_sesion)
    entrada = _entrar(CEDULA, nueva.clave_temporal)
    assert entrada.credencial.debe_cambiar_clave and entrada.credencial.emitida_por == '20000002'


def test_reponer_reinicia_intentos_y_bloqueo():
    alta = _alta()
    for _ in range(MAX_INTENTOS_FALLIDOS):
        with pytest.raises((CredencialesInvalidas, CredencialBloqueada)):
            _entrar(CEDULA, 'mala')
    nueva = emitir_credencial(REPO, HASH, expediente_id=alta.expediente.id, emitida_por='20000002')
    assert _entrar(CEDULA, nueva.clave_temporal).credencial.intentos_fallidos == 0


def test_no_se_emite_credencial_con_la_ventana_vencida_ni_en_expediente_cerrado():
    alta = _alta()
    with pytest.raises(ConflictError, match='venció'):
        emitir_credencial(REPO, HASH, expediente_id=alta.expediente.id, emitida_por='1',
                          ahora=alta.expediente.ventana_vence_el + timedelta(seconds=1))
    aplicar_transicion_expediente(
        REPO, ConfigFalsa(), expediente_id=alta.expediente.id, destino=E.EXPIRADO, actor=Actor.sistema(),
        ahora=alta.expediente.ventana_vence_el + timedelta(days=1),
    )
    with pytest.raises(ConflictError, match='cerrado'):
        emitir_credencial(REPO, HASH, expediente_id=alta.expediente.id, emitida_por='1')


def test_el_alta_es_atomica_si_falla_no_queda_nada():
    _alta('11111111')
    with pytest.raises(ConflictError):  # segundo expediente abierto para la misma cédula
        _alta('11111111')
    assert CredencialPostulanteModel.objects.filter(usuario='11111111').count() == 1
    with pytest.raises(ValidationError):
        _alta('ABC')
    assert not CredencialPostulanteModel.objects.filter(usuario='ABC').exists()


def test_cambiar_clave_exige_la_actual_aplica_politica_y_cierra_las_demas_sesiones():
    alta = _alta()
    acceso = _entrar(CEDULA, alta.emision.clave_temporal)
    kw = dict(expediente_id=alta.expediente.id, cedula=CEDULA)
    with pytest.raises(CredencialesInvalidas):
        cambiar_clave(REPO, HASH, clave_actual='no-es', clave_nueva='Nueva-clave-77', **kw)
    with pytest.raises(ValidationError):
        cambiar_clave(REPO, HASH, clave_actual=alta.emision.clave_temporal, clave_nueva='corta', **kw)
    cred = cambiar_clave(REPO, HASH, clave_actual=alta.emision.clave_temporal, clave_nueva='Nueva-clave-77', **kw)
    assert not cred.debe_cambiar_clave and cred.version_sesion == acceso.credencial.version_sesion + 1
    with pytest.raises(CredencialesInvalidas):
        _entrar(CEDULA, alta.emision.clave_temporal)
    assert not _entrar(CEDULA, 'Nueva-clave-77').credencial.debe_cambiar_clave


def test_los_fallos_al_cambiar_la_clave_tambien_cuentan_para_el_bloqueo():
    alta = _alta()
    _entrar(CEDULA, alta.emision.clave_temporal)
    for _ in range(MAX_INTENTOS_FALLIDOS - 1):
        with pytest.raises(CredencialesInvalidas):
            cambiar_clave(REPO, HASH, expediente_id=alta.expediente.id, cedula=CEDULA,
                          clave_actual='mala', clave_nueva='Nueva-clave-77')
    with pytest.raises(CredencialBloqueada):
        cambiar_clave(REPO, HASH, expediente_id=alta.expediente.id, cedula=CEDULA,
                      clave_actual='mala', clave_nueva='Nueva-clave-77')


def test_enviar_suspende_la_credencial_y_devolver_la_extiende():
    alta = _alta()
    exp_id = alta.expediente.id
    acceso = _entrar(CEDULA, alta.emision.clave_temporal)
    base = alta.expediente.fecha_apertura
    aplicar_transicion_expediente(REPO, ConfigFalsa(), expediente_id=exp_id, destino=E.ENVIADO_CAPTACION,
                                  actor=Actor.postulante(CEDULA), ahora=base)
    fila = CredencialPostulanteModel.objects.get(expediente_id=exp_id)
    assert fila.version_sesion == acceso.credencial.version_sesion + 1 and not fila.revocada
    with pytest.raises(SesionInvalida):
        resolver_sesion(REPO, cedula=CEDULA, expediente_id=exp_id, version_sesion=acceso.credencial.version_sesion)
    with pytest.raises(AccesoNoDisponible):  # suspendida: la clave es correcta pero la etapa no es del postulante
        _entrar(CEDULA, alta.emision.clave_temporal, ahora=base)
    # Captación devuelve el expediente mucho después: la credencial se extiende con la ventana reabierta.
    tarde = base + timedelta(days=40)
    exp, _ = aplicar_transicion_expediente(
        REPO, ConfigFalsa(), expediente_id=exp_id, destino=E.EN_CORRECCION_DATOS, actor=CAPTACION,
        motivo='Falta el segundo apellido', ahora=tarde,
    )
    fila.refresh_from_db()
    assert fila.vence_el == exp.ventana_vence_el == tarde + timedelta(days=15) and fila.ventana == 1
    assert _entrar(CEDULA, alta.emision.clave_temporal, ahora=tarde).expediente.estado == E.EN_CORRECCION_DATOS


def test_un_estado_final_revoca_la_credencial_y_cierra_el_acceso():
    alta = _alta()
    aplicar_transicion_expediente(
        REPO, ConfigFalsa(), expediente_id=alta.expediente.id, destino=E.EXPIRADO, actor=Actor.sistema(),
        ahora=alta.expediente.ventana_vence_el + timedelta(days=1),
    )
    assert CredencialPostulanteModel.objects.get(expediente_id=alta.expediente.id).revocada
    with pytest.raises(CredencialesInvalidas):
        _entrar(CEDULA, alta.emision.clave_temporal)


def test_la_credencial_extiende_la_ventana_2_al_reabrir():
    alta = _alta()
    exp_id = alta.expediente.id
    ExpedientePostulacionModel.objects.filter(pk=exp_id).update(estado='APROBADO')
    ahora = alta.expediente.fecha_apertura + timedelta(days=60)
    exp, _ = aplicar_transicion_expediente(
        REPO, ConfigFalsa(), expediente_id=exp_id, destino=E.CONSOLIDANDO, actor=CAPTACION, ahora=ahora,
    )
    fila = CredencialPostulanteModel.objects.get(expediente_id=exp_id)
    assert (fila.ventana, fila.vence_el) == (2, ahora + timedelta(days=10)) and exp.ventana == 2
