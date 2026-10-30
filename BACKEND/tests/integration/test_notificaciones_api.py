"""
Integración (BD de pruebas, nunca la real) de la Fase 3: API de la campana, difusión por permiso
contra la matriz real, eventos de autogestión -> notificación + outbox en la misma transacción, tarea
de envío con backend de correo en memoria y recordatorio de ventana por expirar.
"""
from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.models.actualizacion_models import (
    SeccionAutogestionableModel,
    SolicitudActualizacionModel,
)
from apps.autogestion.infrastructure.tasks.avisar_ventanas_tasks import avisar_ventanas_por_expirar_tarea
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel
from apps.identidad.infrastructure.models.usuario_permiso_model import UsuarioPermisoModel
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel
from apps.notificaciones.infrastructure.resolutor_destinatarios_orm import ResolutorDestinatariosORM
from apps.notificaciones.infrastructure.tasks import correo_tasks
from apps.personal.infrastructure.models.personal_models import EmployeeModel

BASE = '/api/v1/notificaciones'
AG = '/api/v1/autogestion'
TRABAJADOR, OTRO, ANALISTA, INACTIVA, DENEGADA, EXTRA = '20111234', '20444444', '20222222', '20555555', '20666666', '20777777'
ROL_BIENESTAR, ROL_OTRO = 5, 6


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula, permisos, pk):
        self.cedula_id, self.pk, self.id, self._permisos = cedula, pk, pk, set(permisos)
        self.rol = None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


class ResolutorCondicion:
    def condicion_de(self, cedula):
        return 'ACTIVO'


def cliente(cedula, permisos=('notificaciones.ver_propias',), pk=1):
    c = APIClient()
    c.force_authenticate(user=Usuario(cedula, permisos, pk))
    return c


def data(r):
    return r.json()['data']


@pytest.fixture(autouse=True)
def entorno(monkeypatch, settings):
    monkeypatch.setattr('core.presentation.permissions.obtener_resolutor_condicion', lambda: ResolutorCondicion())
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'


@pytest.fixture
def mundo(db):
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    for cedula in (TRABAJADOR, OTRO, ANALISTA, INACTIVA, DENEGADA, EXTRA):
        EmployeeModel.objects.get_or_create(cedulaidentidad=cedula, defaults={
            'nombres': 'PERSONA', 'apellidos': cedula, 'sexoid': sexo, 'correo': f'{cedula}@conatel.gob.ve',
        })
    for codigo in ('contacto', 'foto'):
        SeccionAutogestionableModel.objects.get_or_create(codigo=codigo, defaults={'nombre': codigo})
    RolModel.objects.get_or_create(id=ROL_BIENESTAR, defaults={'nombre_rol': 'BIENESTAR SOCIAL'})
    RolModel.objects.get_or_create(id=ROL_OTRO, defaults={'nombre_rol': 'OTRO'})
    permiso, _ = PermisoModel.objects.get_or_create(codigo='bienestar.habilitar_ventana', defaults={'nombre': 'habilitar'})
    RolPermisoModel.objects.get_or_create(rol_id=ROL_BIENESTAR, permiso=permiso)
    cuentas = ((ANALISTA, ROL_BIENESTAR, True), (INACTIVA, ROL_BIENESTAR, False), (DENEGADA, ROL_BIENESTAR, True),
               (EXTRA, ROL_OTRO, True), (TRABAJADOR, ROL_OTRO, True))
    for cedula, rol, activa in cuentas:
        CuentaModel.objects.create(cedula_id=cedula, rol_id=rol, is_active=activa, password='!')
    UsuarioPermisoModel.objects.create(cedula=DENEGADA, permisos_custom={'deny': ['bienestar.habilitar_ventana']})
    UsuarioPermisoModel.objects.create(cedula=EXTRA, permisos_custom={'allow': ['bienestar.*']})


def crear(cedula, n=1, **extra):
    return [NotificacionModel.objects.create(
        destinatario_cedula=cedula, tipo='t', titulo=f'T{i}', mensaje='M', **extra) for i in range(n)]


# ─── API de la campana ────────────────────────────────────────────────────────────────────────────

def test_listar_conteo_y_marcar_leidas_solo_de_la_sesion(db, django_capture_on_commit_callbacks):
    mias, ajenas = crear(TRABAJADOR, 3), crear(OTRO, 2)
    c = cliente(TRABAJADOR)
    assert data(c.get(f'{BASE}/conteo/?modulo=autogestion')) == {'no_leidas': 3}
    pagina = data(c.get(f'{BASE}/?modulo=autogestion&limit=2'))
    assert pagina['count'] == 3 and len(pagina['results']) == 2 and pagina['limit'] == 2

    with django_capture_on_commit_callbacks(execute=True):  # la invalidación de la caché ocurre tras el commit
        r = c.post(f'{BASE}/{mias[0].id}/leer/')
        assert r.status_code == 200 and data(r)['leida'] is True
        assert c.post(f'{BASE}/{mias[0].id}/leer/').status_code == 200  # idempotente
    assert data(c.get(f'{BASE}/conteo/?modulo=autogestion')) == {'no_leidas': 2}  # la caché se invalidó
    assert data(c.get(f'{BASE}/?modulo=autogestion&no_leidas=1'))['count'] == 2

    with django_capture_on_commit_callbacks(execute=True):
        assert data(c.post(f'{BASE}/leer-todas/?modulo=autogestion'))['marcadas'] == 2
    assert data(c.get(f'{BASE}/conteo/?modulo=autogestion')) == {'no_leidas': 0}
    assert NotificacionModel.objects.filter(destinatario_cedula=OTRO, leida=False).count() == 2
    assert ajenas[0].leida is False


def test_listado_filtros_limite_y_fechas(db):
    mias = crear(TRABAJADOR, 4)
    crear(OTRO, 2)
    NotificacionModel.objects.filter(pk=mias[0].pk).update(tipo='especial', titulo='Ventana Especial', leida=True)
    NotificacionModel.objects.filter(pk=mias[1].pk).update(created_at=timezone.now() - timedelta(days=10))
    c = cliente(TRABAJADOR)
    assert data(c.get(f'{BASE}/?modulo=autogestion&q=especial'))['count'] == 1
    assert data(c.get(f'{BASE}/?modulo=autogestion&tipo=especial'))['count'] == 1
    assert data(c.get(f'{BASE}/?modulo=autogestion&leida=si'))['count'] == 1
    assert data(c.get(f'{BASE}/?modulo=autogestion&leida=no'))['count'] == 3
    assert data(c.get(f'{BASE}/?modulo=autogestion&leida='))['count'] == 4
    assert data(c.get(f'{BASE}/?modulo=autogestion&desde={timezone.localdate().isoformat()}'))['count'] == 3
    assert data(c.get(f'{BASE}/?modulo=autogestion&hasta={(timezone.localdate() - timedelta(days=5)).isoformat()}'))['count'] == 1
    pagina = data(c.get(f'{BASE}/?modulo=autogestion&limit=500&offset=1'))
    assert pagina['limit'] == 50 and pagina['offset'] == 1 and len(pagina['results']) == 3
    fechas = [n['creada_en'] for n in data(c.get(f'{BASE}/?modulo=autogestion'))['results']]
    assert fechas == sorted(fechas, reverse=True)
    assert c.get(f'{BASE}/?modulo=autogestion&desde=ayer').status_code == 400
    assert c.get(f'{BASE}/?modulo=autogestion&desde=2026-05-02&hasta=2026-05-01').status_code == 400


def test_aislamiento_por_modulo_en_listado_conteo_y_leer_todas(db, django_capture_on_commit_callbacks):
    crear(TRABAJADOR, 3)
    crear(TRABAJADOR, 2, modulo='personal')
    c = cliente(TRABAJADOR)
    assert data(c.get(f'{BASE}/?modulo=personal'))['count'] == 2
    assert data(c.get(f'{BASE}/?modulo=autogestion'))['count'] == 3
    assert data(c.get(f'{BASE}/?modulo=carnetizacion'))['count'] == 0
    assert data(c.get(f'{BASE}/conteo/?modulo=personal')) == {'no_leidas': 2}
    assert data(c.get(f'{BASE}/conteo/?modulo=autogestion')) == {'no_leidas': 3}
    with django_capture_on_commit_callbacks(execute=True):
        assert data(c.post(f'{BASE}/leer-todas/?modulo=personal'))['marcadas'] == 2
    assert data(c.get(f'{BASE}/conteo/?modulo=personal')) == {'no_leidas': 0}
    assert data(c.get(f'{BASE}/conteo/?modulo=autogestion')) == {'no_leidas': 3}
    for url in (f'{BASE}/', f'{BASE}/?modulo=zzz', f'{BASE}/conteo/'):
        assert c.get(url).status_code == 400
    assert c.post(f'{BASE}/leer-todas/').status_code == 400


def test_pagina_por_defecto_10_y_tope_50(db):
    crear(TRABAJADOR, 55)
    c = cliente(TRABAJADOR)
    p = data(c.get(f'{BASE}/?modulo=autogestion'))
    assert p['limit'] == 10 and len(p['results']) == 10 and p['count'] == 55
    p = data(c.get(f'{BASE}/?modulo=autogestion&limit=500'))
    assert p['limit'] == 50 and len(p['results']) == 50


def test_zero_idor_no_se_puede_leer_ni_marcar_la_notificacion_de_otro(db):
    ajena = crear(OTRO)[0]
    c = cliente(TRABAJADOR)
    assert c.post(f'{BASE}/{ajena.id}/leer/').status_code == 404
    assert c.get(f'{BASE}/?modulo=autogestion&cedula={OTRO}').json()['data']['count'] == 0  # el filtro por cédula no existe
    ajena.refresh_from_db()
    assert ajena.leida is False


def test_sin_permiso_o_sin_sesion_se_deniega(db):
    assert cliente(TRABAJADOR, permisos=()).get(f'{BASE}/conteo/?modulo=autogestion').status_code == 403
    assert APIClient().get(f'{BASE}/?modulo=autogestion').status_code in (401, 403)


def test_conteo_degrada_a_la_bd_si_la_cache_falla(db, monkeypatch):
    crear(TRABAJADOR, 2)
    roto = MagicMock(side_effect=ConnectionError('redis caído'))
    # Solo la caché del contador falla (el throttling de DRF usa la caché real de las pruebas).
    monkeypatch.setattr('apps.notificaciones.infrastructure.cache_conteo_django.cache', MagicMock(get=roto, set=roto, delete=roto))
    assert data(cliente(TRABAJADOR).get(f'{BASE}/conteo/?modulo=autogestion')) == {'no_leidas': 2}


# ─── Destinatarios por permiso ───────────────────────────────────────────────────────────────────

def test_resolutor_por_permiso_respeta_activas_denegaciones_y_ajustes(mundo):
    cedulas = ResolutorDestinatariosORM().cedulas_con_permiso('bienestar.habilitar_ventana')
    assert cedulas == sorted([ANALISTA, EXTRA])  # sin INACTIVA, sin DENEGADA; EXTRA entra por su ajuste 'bienestar.*'


def test_resolutor_devuelve_el_correo_principal(mundo):
    assert ResolutorDestinatariosORM().correo_de(TRABAJADOR) == f'{TRABAJADOR}@conatel.gob.ve'
    assert ResolutorDestinatariosORM().correo_de('00000000') == ''


# ─── Eventos de autogestión -> notificación + outbox ──────────────────────────────────────────────

PERMISOS_TRAB = {'autogestion.ver_propio', 'autogestion.solicitar_actualizacion'}


def test_solicitud_creada_notifica_a_bienestar_y_habilitar_notifica_al_trabajador_con_correo(mundo, django_capture_on_commit_callbacks):
    trabajador = cliente(TRABAJADOR, PERMISOS_TRAB, 1)
    bienestar = cliente(ANALISTA, {'bienestar.habilitar_ventana', 'bienestar.ver_solicitudes', 'notificaciones.ver_propias'}, 2)
    with django_capture_on_commit_callbacks(execute=False):
        r = trabajador.post(f'{AG}/solicitudes/', {'secciones': ['contacto'], 'motivo': 'Cambié mi número de teléfono móvil'}, format='json')
    assert r.status_code == 201, r.content
    sid = data(r)['id']
    # Bienestar (por permiso) recibe el aviso; el trabajador, no; el inactivo y el denegado, tampoco.
    destinos = set(NotificacionModel.objects.filter(tipo='autogestion.solicitud_creada').values_list('destinatario_cedula', flat=True))
    assert destinos == {ANALISTA, EXTRA}
    assert data(bienestar.get(f'{BASE}/conteo/?modulo=personal'))['no_leidas'] == 1
    # Por defecto Bienestar solo recibe el aviso en el sistema (correo pendiente de confirmar).
    assert not EventoOutboxModel.objects.filter(destinatario_cedula=ANALISTA).exists()

    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        r = bienestar.post(f'{AG}/bienestar/solicitudes/{sid}/habilitar/', {'plazo_dias': 7}, format='json')
    assert r.status_code == 200, r.content
    aviso = NotificacionModel.objects.get(destinatario_cedula=TRABAJADOR, tipo='autogestion.ventana_habilitada')
    assert aviso.ref_id == sid and aviso.enlace == f'/autogestion/solicitudes/{sid}'
    correo = EventoOutboxModel.objects.get(destinatario=f'{TRABAJADOR}@conatel.gob.ve')  # outbox en la misma transacción
    assert correo.estado == 'PENDIENTE' and correo.payload['asunto'].startswith('Actualización de datos habilitada')
    assert len(callbacks) >= 1  # el envío se programa tras el commit, no antes


def test_si_la_transaccion_se_revierte_no_quedan_notificaciones_ni_correo(mundo):
    from django.db import transaction

    from apps.autogestion.domain.events import EventoAutogestion, TipoEvento
    from apps.autogestion.infrastructure.signals import PublicadorSenales

    class Reversion(Exception):
        pass

    with pytest.raises(Reversion):
        with transaction.atomic():
            PublicadorSenales().publicar(EventoAutogestion(
                TipoEvento.SOLICITUD_RECHAZADA, '0194c1a0-0000-7000-8000-000000000001', TRABAJADOR, ANALISTA, {'motivo': 'x'},
            ))
            assert NotificacionModel.objects.filter(destinatario_cedula=TRABAJADOR).exists()
            raise Reversion
    assert not NotificacionModel.objects.exists() and not EventoOutboxModel.objects.exists()


def test_un_fallo_al_notificar_no_tumba_la_operacion_de_negocio(mundo, monkeypatch, django_capture_on_commit_callbacks):
    monkeypatch.setattr('apps.autogestion.infrastructure.receivers.solicitudes_de_evento', MagicMock(side_effect=RuntimeError('boom')))
    with django_capture_on_commit_callbacks(execute=False):
        r = cliente(TRABAJADOR, PERMISOS_TRAB, 1).post(
            f'{AG}/solicitudes/', {'secciones': ['contacto'], 'motivo': 'Cambié mi número de teléfono móvil'}, format='json')
    assert r.status_code == 201 and SolicitudActualizacionModel.objects.count() == 1


# ─── Tarea de envío ──────────────────────────────────────────────────────────────────────────────

def _outbox(**extra):
    return EventoOutboxModel.objects.create(
        tipo='t', destinatario='trabajador@conatel.gob.ve', idempotency_key=f'k-{EventoOutboxModel.objects.count()}',
        payload={'asunto': 'Asunto de prueba', 'titulo': 'Título', 'mensaje': 'Cuerpo del mensaje',
                 'enlace': '/autogestion/solicitudes/1', 'copia_a': ['alt@gmail.com'], 'adjuntos': []},
        **extra,
    )


def test_tarea_envia_el_correo_una_sola_vez_con_html_y_copia(db):
    fila = _outbox()
    assert correo_tasks.enviar_correo_outbox.apply(args=[str(fila.id)]).get() == 'ENVIADO'
    assert correo_tasks.enviar_correo_outbox.apply(args=[str(fila.id)]).get() == 'OMITIDO'  # idempotente
    assert len(mail.outbox) == 1
    enviado = mail.outbox[0]
    assert enviado.subject == 'Asunto de prueba' and enviado.to == ['trabajador@conatel.gob.ve'] and enviado.cc == ['alt@gmail.com']
    assert 'correo automático' in enviado.body and enviado.alternatives[0][1] == 'text/html'
    fila.refresh_from_db()
    assert fila.estado == 'ENVIADO' and fila.enviado_en is not None


def test_tarea_con_transporte_caido_reprograma_con_backoff_y_luego_marca_fallido(db, monkeypatch, settings):
    settings.NOTIFICACIONES_CORREO_MAX_INTENTOS = 2
    reprogramado = MagicMock()
    monkeypatch.setattr(correo_tasks.enviar_correo_outbox, 'apply_async', reprogramado)
    monkeypatch.setattr(
        'apps.notificaciones.infrastructure.enviador_correo_django.EmailMultiAlternatives.send',
        MagicMock(side_effect=ConnectionRefusedError('relay caído')),
    )
    fila = _outbox()
    assert correo_tasks.enviar_correo_outbox.apply(args=[str(fila.id)]).get() == 'REINTENTAR'
    reprogramado.assert_called_once()
    assert reprogramado.call_args.kwargs['countdown'] == 60
    fila.refresh_from_db()
    assert fila.estado == 'PENDIENTE' and fila.intentos == 1 and 'relay caído' in fila.ultimo_error
    EventoOutboxModel.objects.filter(pk=fila.pk).update(proximo_intento=timezone.now() - timedelta(seconds=1))
    assert correo_tasks.enviar_correo_outbox.apply(args=[str(fila.id)]).get() == 'FALLIDO'
    fila.refresh_from_db()
    assert fila.estado == 'FALLIDO' and fila.intentos == 2


def test_tarea_beat_reprocesa_los_pendientes_olvidados(db, monkeypatch, django_capture_on_commit_callbacks):
    olvidado = _outbox()
    EventoOutboxModel.objects.filter(pk=olvidado.pk).update(created_at=timezone.now() - timedelta(minutes=10))
    reciente = _outbox()
    enviados = []
    monkeypatch.setattr('apps.notificaciones.infrastructure.planificador_envio_celery.CeleryTaskQueue',
                        lambda: MagicMock(encolar=lambda nombre, **kw: enviados.append((nombre, kw))))
    with django_capture_on_commit_callbacks(execute=True):  # el envío se encola tras el commit
        assert correo_tasks.reprocesar_outbox.apply().get() == 1
    assert enviados == [('notificaciones.enviar_correo_outbox', {'outbox_id': str(olvidado.id)})]
    assert reciente.estado == 'PENDIENTE'


# ─── Recordatorio de ventana por expirar ─────────────────────────────────────────────────────────

def test_ventana_por_expirar_avisa_una_sola_vez_y_se_rearma_con_la_prorroga(mundo):
    ahora = timezone.now()
    sol = SolicitudActualizacionModel.objects.create(
        cedula=TRABAJADOR, estado='HABILITADA', secciones_solicitadas=['contacto'], secciones_habilitadas=['contacto'],
        motivo='x', ventana_inicio=ahora - timedelta(days=6), ventana_fin=ahora + timedelta(hours=12),
    )
    lejana = SolicitudActualizacionModel.objects.create(
        cedula=OTRO, estado='HABILITADA', secciones_solicitadas=['contacto'], secciones_habilitadas=['contacto'],
        motivo='x', ventana_inicio=ahora, ventana_fin=ahora + timedelta(days=5),
    )
    assert avisar_ventanas_por_expirar_tarea() == 1
    assert avisar_ventanas_por_expirar_tarea() == 1  # la tarea corre cada 30 min...
    avisos = NotificacionModel.objects.filter(tipo='autogestion.ventana_por_expirar')
    assert avisos.count() == 1 and avisos[0].destinatario_cedula == TRABAJADOR  # ...pero el aviso no se repite
    assert EventoOutboxModel.objects.count() == 1  # también por correo (B16), sin duplicarse
    SolicitudActualizacionModel.objects.filter(pk=sol.pk).update(ventana_fin=ahora + timedelta(hours=20))  # prórroga
    avisar_ventanas_por_expirar_tarea()
    assert avisos.count() == 2
    assert lejana.cedula == OTRO and not avisos.filter(destinatario_cedula=OTRO).exists()


def test_con_el_ajuste_activado_bienestar_tambien_recibe_correo_de_acceso(mundo, settings, django_capture_on_commit_callbacks):
    settings.NOTIFICAR_BIENESTAR_POR_CORREO = True
    trabajador = cliente(TRABAJADOR, PERMISOS_TRAB, 1)
    with django_capture_on_commit_callbacks(execute=False):
        r = trabajador.post(f'{AG}/solicitudes/', {'campos': ['employee.telefono_movil'], 'motivo': 'Cambié mi número de teléfono móvil'}, format='json')
    assert r.status_code == 201, r.content
    assert EventoOutboxModel.objects.filter(destinatario=f'{ANALISTA}@conatel.gob.ve', destinatario_cedula=ANALISTA).count() == 1
    assert not EventoOutboxModel.objects.filter(destinatario_cedula=TRABAJADOR).exists()
