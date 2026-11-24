"""Promoción atómica del postulante a trabajador (G-4) por la API, contra la BD: caso feliz, reingreso, revalidación y rollback."""
from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.desactivacion_egreso_model import DesactivacionEgresoModel
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel
from apps.personal.infrastructure.models.expediente_models import (
    ContactoEmergenciaModel,
    DatosViviendaModel,
    PerfilFisicoModel,
    PerfilSaludModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.postulacion.infrastructure.models.credencial_models import CredencialPostulanteModel
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)
from apps.postulacion.infrastructure.models.presupuesto_models import ReservaPuestoModel
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.postulacion._presupuesto_mundo import BASE, Notificador, codigo, crear_expediente, datos
from tests.integration.postulacion._ventana2_mundo import (
    CAPTACION,
    Mundo2,
    cliente_personal,
    instalar_dobles_g,
    listo_para_asignar,
)

pytestmark = pytest.mark.django_db

CEDULA = '12345678'


@pytest.fixture(autouse=True)
def dobles(monkeypatch, settings):
    instalar_dobles_g(monkeypatch)
    settings.DOMINIO_CORREO_INSTITUCIONAL = '@conatel.gob.ve'


@pytest.fixture
def m2(mundo):
    return Mundo2(mundo)


@pytest.fixture
def captacion(m2):
    return m2.captacion()


def asignar(c, exp):
    return c.post(f'{BASE}/expedientes/{exp}/asignar/', {}, format='json')


def sin_efectos(m2, exp, cedula=CEDULA, puesto='p1'):
    """Nada de la promoción quedó en la base: el expediente sigue LISTO y todo lo demás intacto."""
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.estado == 'LISTO_PARA_ASIGNAR' and e.fecha_cierre is None and e.reserva_vence_el is not None
    assert not EmployeeModel.objects.filter(cedulaidentidad=cedula).exists()
    assert not EmployeefamilyModel.objects.filter(employeecedula_id=cedula).exists()
    assert not DatosViviendaModel.objects.filter(empleado__cedulaidentidad=cedula).exists()
    assert not PerfilSaludModel.objects.filter(empleado__cedulaidentidad=cedula).exists()
    assert not PerfilFisicoModel.objects.filter(empleado__cedulaidentidad=cedula).exists()
    assert not CuentaModel.objects.filter(cedula_id=cedula).exists()
    assert not EmployeeMovementHistoryModel.objects.filter(empleado__cedulaidentidad=cedula).exists()
    p = AsigTrabajoModel.objects.get(pk=m2.mundo[puesto].pk)
    assert p.employee_id is None and p.estatusid.estatus == 'VACANTE'
    reserva = ReservaPuestoModel.objects.get(expediente_id=exp)
    assert reserva.estado == 'ACTIVA' and reserva.cerrada_el is None
    assert PostulanteModel.objects.get(cedula=cedula).employee_cedula == ''
    assert CredencialPostulanteModel.objects.filter(expediente_id=exp, revocada=True).count() == 0
    assert not TransicionExpedienteModel.objects.filter(expediente_id=exp, estado_destino='CONTRATADO').exists()


# ------------------------------------------------------------------------------------------------ caso feliz
def test_asignar_crea_al_trabajador_con_todo_y_cierra_el_expediente(m2, captacion, django_capture_on_commit_callbacks):
    exp = listo_para_asignar(m2)
    Notificador.emitidas.clear(), Notificador.resueltas.clear()
    with django_capture_on_commit_callbacks(execute=True):
        r = asignar(captacion, exp)
    assert r.status_code == 200, r.content
    d = datos(r)
    empleado = EmployeeModel.objects.get(cedulaidentidad=CEDULA)
    assert d['employee_id'] == empleado.pk and d['cedula'] == CEDULA and d['es_reingreso'] is False
    assert d['expediente']['estado'] == 'CONTRATADO' and d['puesto'] == {'id': m2.mundo['p1'].pk, 'codigo': 'A-001'}
    assert d['familiares_copiados'] == 2 and d['reserva']['estado'] == 'CONSUMIDA'
    assert d['cuenta']['creada'] is True and d['cuenta']['correo'] == 'ana.perez@conatel.gob.ve' and d['cuenta']['dias_vigencia_clave_inicial']
    assert 'clave' not in str(d).replace('clave_inicial', '').replace('dias_vigencia_clave_inicial', '')   # nunca contraseñas
    # Employee con los datos de V1 y del postulante, más la foto y el origen (G-5)
    assert (empleado.nombres, empleado.apellidos) == ('Ana María', 'Pérez') and empleado.sexoid.sexo == 'F'
    assert empleado.fecha_nacimiento == date(1990, 5, 17) and empleado.telefono_movil == '04141234567'
    assert empleado.correo == 'ana.perez@conatel.gob.ve' and empleado.nacionalidad_id == 1
    assert empleado.foto_objeto == 'postulacion/foto/semilla.jpg' and empleado.profile == empleado.foto_objeto
    assert empleado.foto_actualizada is not None and str(empleado.origen_expediente) == exp
    # vivienda, salud y tallas con los mismos catálogos
    v = DatosViviendaModel.objects.get(empleado=empleado)
    assert (v.condicion_vivienda_id, v.estado_id, v.municipio_id, v.parroquia_id) == tuple(
        m2.cat[k].pk for k in ('condicion', 'estado', 'municipio', 'parroquia'))
    assert v.direccion_exacta.startswith('Av. Principal') and v.ciudad_region == 'Caracas'
    s = PerfilSaludModel.objects.get(empleado=empleado)
    assert s.grupo_sanguineo_id == m2.cat['sangre'].pk and [a.pk for a in s.alergias.all()] == [m2.cat['alergia'].pk]
    assert [p.pk for p in s.patologiaCronica.all()] == [m2.cat['patologia'].pk] and not s.discapacidad.exists()
    f = PerfilFisicoModel.objects.get(empleado=empleado)
    assert (f.tallaCamisa_id, f.tallaPantalon_id, f.tallaZapatos_id, f.tallaChaqueta_id) == (
        m2.cat['tallas']['CAMISA'].pk, m2.cat['tallas']['PANTALON'].pk, m2.cat['tallas']['ZAPATOS'].pk, None)
    # familiares: el cónyuge con su cédula y la hija menor con la cédula correlativa del titular
    assert EmployeefamilyModel.objects.filter(employeecedula_id=CEDULA).count() == 2
    conyuge = EmployeefamilyModel.objects.get(cedulaFamiliar='9876543')
    hija = EmployeefamilyModel.objects.get(cedulaFamiliar=f'{CEDULA}-1')
    assert (conyuge.primer_nombre, conyuge.cedulaFamiliar, conyuge.parentesco.descripcion_parentesco) == ('Luis', '9876543', 'CONYUGE')
    assert conyuge.observaciones is None and conyuge.fechanacimiento == date(1988, 2, 10)
    assert (hija.primer_nombre, hija.segundo_nombre, hija.cedulaFamiliar, hija.orden_hijo) == ('Sofía', 'Ana', f'{CEDULA}-1', 1)
    assert hija.observaciones == 'Depende económicamente del titular.'
    # puesto ocupado, movimiento INGRESO, cuenta
    puesto = AsigTrabajoModel.objects.get(pk=m2.mundo['p1'].pk)
    assert puesto.employee_id == CEDULA and puesto.estatusid.estatus == 'ACTIVO'
    mov = EmployeeMovementHistoryModel.objects.get(empleado=empleado)
    assert (mov.tipo_movimiento, mov.codigo_puesto, mov.ejecutado_por_id) == ('INGRESO', 'A-001', m2.cuenta.pk)
    cuenta = CuentaModel.objects.get(cedula_id=CEDULA)
    assert cuenta.is_active and cuenta.check_password(CEDULA)    # contraseña inicial = cédula (política vigente)
    # reserva, postulante, credencial y expediente
    reserva = ReservaPuestoModel.objects.get(expediente_id=exp)
    assert reserva.estado == 'CONSUMIDA' and reserva.cerrada_el and reserva.motivo_liberacion == 'contratación'
    # Ingreso nuevo: el postulante NO queda marcado como reingreso; la trazabilidad es Employee.origen_expediente.
    assert PostulanteModel.objects.get(cedula=CEDULA).employee_cedula == ''
    assert CredencialPostulanteModel.objects.get(expediente_id=exp).revocada is True
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.estado == 'CONTRATADO' and e.fecha_cierre and e.reserva_vence_el is None and e.contacto_pendiente_desde is None
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=exp).order_by('fecha', 'created_at').last()
    assert (asiento.estado_origen, asiento.estado_destino, asiento.actor_cedula) == ('LISTO_PARA_ASIGNAR', 'CONTRATADO', '20000001')
    assert asiento.datos_extra['employee_id'] == empleado.pk and asiento.datos_extra['puesto_codigo'] == 'A-001'
    assert asiento.datos_extra['origen'] == 'asignacion' and asiento.datos_extra['cuenta_creada'] is True
    # auditoría y avisos tras el commit
    aud = AuditoriaLog.objects.get(accion='POSTULANTE_CONTRATADO').estado_nuevo
    assert aud['employee_id'] == empleado.pk and 'clave' not in str(aud)
    assert ('expediente_postulacion', exp, '20000001', 'CONTACTAR_POSTULANTE') in Notificador.resueltas
    assert ('expediente_postulacion', exp, '20000001', 'EXPEDIENTE_REVISION_FINAL') in Notificador.resueltas
    tipos = {a.tipo: a for a in Notificador.emitidas}
    assert tipos['CONTRATACION_COMPLETADA'].permiso_destino == 'postulacion.ver_bandeja'
    assert tipos['CARNET_PENDIENTE'].permiso_destino == 'carnetizacion.emitir'
    assert 'CORREO_INSTITUCIONAL_PENDIENTE' not in tipos   # la cuenta se creó: nada que gestionar con Tecnología
    # no se puede asignar dos veces
    r = asignar(captacion, exp)
    assert r.status_code == 409 and codigo(r) == 'EXPEDIENTE_FINAL'


def test_sin_correo_no_se_crea_cuenta_y_se_dice_por_que(m2, captacion, django_capture_on_commit_callbacks):
    exp = listo_para_asignar(m2, correo='')
    Notificador.emitidas.clear()
    with django_capture_on_commit_callbacks(execute=True):
        r = asignar(captacion, exp)
    aviso = {a.tipo: a for a in Notificador.emitidas}['CORREO_INSTITUCIONAL_PENDIENTE']
    assert (aviso.permiso_destino, aviso.modulo, aviso.ref_tipo, aviso.ref_id) == (
        'personal.editar_personales', 'personal', 'empleado', CEDULA)
    assert aviso.enlace == f'/personal/consultar?cedula={CEDULA}' and 'correo personal' not in aviso.mensaje
    assert 'Solicite a Tecnología' in aviso.mensaje and 'A-001' in aviso.mensaje
    assert r.status_code == 200, r.content
    assert datos(r)['cuenta'] == {'creada': False, 'reactivada': False, 'motivo': 'sin_correo', 'correo': '',
                                  'correo_alternativo': '', 'dias_vigencia_clave_inicial': None, 'entrega': None}
    assert EmployeeModel.objects.get(cedulaidentidad=CEDULA).correo is None and not CuentaModel.objects.filter(cedula_id=CEDULA).exists()


def test_un_correo_personal_queda_como_alternativo_y_la_cuenta_espera_al_institucional(m2, captacion, django_capture_on_commit_callbacks):
    from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel

    exp = listo_para_asignar(m2, correo='ana@ejemplo.invalid')
    Notificador.emitidas.clear(), Notificador.resueltas.clear()
    with django_capture_on_commit_callbacks(execute=True):
        r = asignar(captacion, exp)
    aviso = {a.tipo: a for a in Notificador.emitidas}['CORREO_INSTITUCIONAL_PENDIENTE']
    assert 'ana@ejemplo.invalid' in aviso.mensaje and 'dato de contacto' in aviso.mensaje
    assert r.status_code == 200, r.content
    assert datos(r)['cuenta']['creada'] is False and datos(r)['cuenta']['motivo'] == 'sin_correo_institucional'
    assert datos(r)['cuenta']['correo_alternativo'] == 'ana@ejemplo.invalid'
    assert EmployeeModel.objects.get(cedulaidentidad=CEDULA).correo is None
    assert DatosComplementariosTrabajadorModel.objects.get(cedula=CEDULA).correo_alternativo == 'ana@ejemplo.invalid'
    assert not CuentaModel.objects.filter(cedula_id=CEDULA).exists()


def test_un_correo_que_ya_usa_otro_trabajador_no_se_copia_ni_rompe_la_contratacion(m2, captacion):
    otro = EmployeeModel.objects.create(cedulaidentidad='9000009', nombres='Pedro', apellidos='Dueño',
                                        sexoid=m2.cat['masculino'], correo='ana.perez@conatel.gob.ve')
    exp = listo_para_asignar(m2)
    r = asignar(captacion, exp)
    assert r.status_code == 200, r.content
    assert EmployeeModel.objects.get(cedulaidentidad=CEDULA).correo is None and datos(r)['cuenta']['motivo'] == 'sin_correo'
    assert EmployeeModel.objects.get(pk=otro.pk).correo == 'ana.perez@conatel.gob.ve'


def test_sin_foto_se_contrata_igual_y_no_se_pide_carnet(m2, captacion, django_capture_on_commit_callbacks):
    exp = listo_para_asignar(m2)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(foto_clave='', foto_tamano=0)
    Notificador.emitidas.clear()
    with django_capture_on_commit_callbacks(execute=True):
        assert asignar(captacion, exp).status_code == 200
    e = EmployeeModel.objects.get(cedulaidentidad=CEDULA)
    assert e.foto_objeto is None and e.foto_actualizada is None and str(e.origen_expediente) == exp
    assert {a.tipo for a in Notificador.emitidas} == {'CONTRATACION_COMPLETADA'}


def test_el_contacto_de_emergencia_de_la_ventana_1_pasa_a_la_ficha(m2, captacion):
    exp = listo_para_asignar(m2)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(datos_ventana1={
        'fecha_nacimiento': '1990-05-17', 'sexo': 'F', 'telefono_alterno': '02125551234',
        'contacto_emergencia': {'nombre': 'María Luisa Pérez', 'telefono': '04241234567', 'parentesco': 'Madre'}})
    assert asignar(captacion, exp).status_code == 200
    c = ContactoEmergenciaModel.objects.get(empleado__cedulaidentidad=CEDULA)
    assert (c.nombres, c.apellidos, c.telefono) == ('María Luisa', 'Pérez', '04241234567')
    assert EmployeeModel.objects.get(cedulaidentidad=CEDULA).telefono_habitacion == '02125551234'


# ------------------------------------------------------------------------------------------------ reingreso (C-1)
def test_reingreso_reutiliza_al_mismo_employee_sin_duplicar_y_reactiva_su_cuenta(m2, captacion):
    previo = EmployeeModel.objects.create(
        cedulaidentidad=CEDULA, nombres='Ana Maria', apellidos='Perez Antigua', sexoid=m2.cat['femenino'],
        correo='ana.vieja@conatel.gob.ve', fecha_nacimiento=date(1985, 1, 1))
    ya = EmployeefamilyModel.objects.create(
        employeecedula=previo, primer_nombre='Luis', primer_apellido='Gómez', parentesco=m2.cat['conyuge'],
        fechanacimiento=date(1988, 2, 10), sexo=m2.cat['masculino'], cedulaFamiliar='9876543')
    cuenta = CuentaModel.objects.create_user(cedula=previo, password='Vieja-Clave-1', rol_id=3, is_active=False)
    DesactivacionEgresoModel.objects.create(cuenta_id=cuenta.pk, motivo='egreso')
    exp = listo_para_asignar(m2)
    r = asignar(captacion, exp)
    assert r.status_code == 200, r.content
    d = datos(r)
    assert d['es_reingreso'] is True and d['employee_id'] == previo.pk and d['familiares_copiados'] == 1   # el cónyuge ya estaba
    assert EmployeeModel.objects.filter(cedulaidentidad=CEDULA).count() == 1
    e = EmployeeModel.objects.get(pk=previo.pk)
    assert (e.nombres, e.apellidos, e.fecha_nacimiento) == ('Ana Maria', 'Perez Antigua', date(1985, 1, 1))   # la identidad no se pisa
    assert e.correo == 'ana.vieja@conatel.gob.ve' and e.telefono_movil == '04141234567' and str(e.origen_expediente) == exp
    assert e.foto_objeto == 'postulacion/foto/semilla.jpg'
    assert EmployeefamilyModel.objects.filter(employeecedula_id=CEDULA).count() == 2 and EmployeefamilyModel.objects.filter(pk=ya.pk).exists()
    assert DatosViviendaModel.objects.filter(empleado=e).count() == 1
    assert d['cuenta']['reactivada'] is True and d['cuenta']['creada'] is False and d['cuenta']['motivo'] == 'ya_existia'
    cuenta.refresh_from_db()
    assert cuenta.is_active and not DesactivacionEgresoModel.objects.filter(cuenta_id=cuenta.pk).exists()
    assert CuentaModel.objects.filter(cedula_id=CEDULA).count() == 1
    mov = EmployeeMovementHistoryModel.objects.get(empleado=e)
    assert mov.tipo_movimiento == 'INGRESO' and AsigTrabajoModel.objects.get(pk=m2.mundo['p1'].pk).employee_id == CEDULA
    assert PostulanteModel.objects.get(cedula=CEDULA).employee_cedula == CEDULA


def test_un_trabajador_activo_no_se_puede_contratar_de_nuevo(m2, captacion):
    exp = listo_para_asignar(m2)
    activo = EmployeeModel.objects.create(cedulaidentidad=CEDULA, nombres='Ana', apellidos='Activa', sexoid=m2.cat['femenino'])
    AsigTrabajoModel.objects.filter(pk=m2.mundo['ocupado'].pk).update(employee=activo)   # pasó a ser activo tras el alta
    r = asignar(captacion, exp)
    assert r.status_code == 409 and codigo(r) == 'EMPLEADO_ACTIVO'
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.estado == 'LISTO_PARA_ASIGNAR' and ReservaPuestoModel.objects.get(expediente_id=exp).estado == 'ACTIVA'
    assert AsigTrabajoModel.objects.get(pk=m2.mundo['p1'].pk).employee_id is None


# ------------------------------------------------------------------------------------------------ revalidación
def test_reserva_vencida_puesto_ocupado_o_reserva_ajena_dan_puesto_no_disponible_sin_efectos(m2, captacion):
    exp = listo_para_asignar(m2)
    # 1. la reserva venció (la tarea aún no la barrió)
    ReservaPuestoModel.objects.filter(expediente_id=exp).update(vence_el=timezone.now() - timedelta(minutes=1))
    r = asignar(captacion, exp)
    assert r.status_code == 409 and codigo(r) == 'PUESTO_NO_DISPONIBLE' and 'venció' in r.json()['message']
    sin_efectos(m2, exp)
    # 2. otro ocupó el puesto mientras tanto (alta directa de RRHH)
    ReservaPuestoModel.objects.filter(expediente_id=exp).update(vence_el=timezone.now() + timedelta(days=5))
    intruso = EmployeeModel.objects.create(cedulaidentidad='9000002', nombres='Rita', apellidos='Intrusa', sexoid=m2.cat['femenino'])
    AsigTrabajoModel.objects.filter(pk=m2.mundo['p1'].pk).update(employee=intruso)
    r = asignar(captacion, exp)
    assert r.status_code == 409 and codigo(r) == 'PUESTO_NO_DISPONIBLE' and 'ocupado' in r.json()['message']
    AsigTrabajoModel.objects.filter(pk=m2.mundo['p1'].pk).update(employee=None)
    sin_efectos(m2, exp)
    # 3. la reserva activa es de OTRO expediente (la de este se liberó): este no tiene reserva
    otro = crear_expediente(m2.mundo, '87654321')
    ReservaPuestoModel.objects.filter(expediente_id=exp).update(estado='LIBERADA', cerrada_el=timezone.now())
    ReservaPuestoModel.objects.create(expediente_id=otro, puesto_id=m2.mundo['p1'].pk, reservado_por='20000001',
                                      vence_el=timezone.now() + timedelta(days=5))
    r = asignar(captacion, exp)
    assert r.status_code == 409 and codigo(r) == 'PUESTO_NO_DISPONIBLE' and 'no tiene una reserva activa' in r.json()['message']
    assert ReservaPuestoModel.objects.get(expediente_id=otro).estado == 'ACTIVA'
    assert not EmployeeModel.objects.filter(cedulaidentidad=CEDULA).exists()
    assert AsigTrabajoModel.objects.get(pk=m2.mundo['p1'].pk).employee_id is None
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'LISTO_PARA_ASIGNAR'


def test_el_puesto_borrado_tambien_es_no_disponible(m2, captacion):
    exp = listo_para_asignar(m2)
    ReservaPuestoModel.objects.filter(expediente_id=exp).update(puesto_id=99999999)
    r = asignar(captacion, exp)
    assert r.status_code == 409 and codigo(r) == 'PUESTO_NO_DISPONIBLE'
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'LISTO_PARA_ASIGNAR'


def test_solo_se_asigna_desde_listo_para_asignar(m2, captacion):
    for estado in ('EN_REVISION_FINAL', 'CONSOLIDANDO', 'APROBADO', 'EN_PRESUPUESTO'):
        exp = crear_expediente(m2.mundo, '1000000' + str(len(estado) % 10), estado=estado)
        r = asignar(captacion, exp)
        assert r.status_code == 409 and codigo(r) == 'TRANSICION_NO_PERMITIDA', estado
    assert not EmployeeModel.objects.exclude(cedulaidentidad__in=['9000001', '20000001']).exists()


def test_asignar_exige_el_permiso_de_revision_final(m2, captacion):
    exp = listo_para_asignar(m2)
    for permisos in (('postulacion.ver_bandeja',), ('postulacion.verificar', 'postulacion.abrir_expediente'),
                     ('postulacion.ver_solicitudes', 'postulacion.reservar_puesto')):
        assert asignar(cliente_personal(*permisos, pk=m2.cuenta.pk), exp).status_code == 403
    assert APIClient().post(f'{BASE}/expedientes/{exp}/asignar/', {}, format='json').status_code in (401, 403)
    assert asignar(captacion, '00000000-0000-4000-8000-000000000000').status_code == 404
    sin_efectos(m2, exp)


def test_asignar_sin_cuenta_de_usuario_no_registraria_el_ingreso_y_se_rechaza(m2, captacion):
    exp = listo_para_asignar(m2)
    c = cliente_personal(*CAPTACION, pk=None)
    r = asignar(c, exp)
    assert r.status_code == 400 and codigo(r) == 'USUARIO_SIN_CUENTA'
    sin_efectos(m2, exp)


def test_datos_que_no_alcanzan_para_crear_la_ficha_revierten_todo(m2, captacion):
    exp = listo_para_asignar(m2)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(datos_ventana1={})
    r = asignar(captacion, exp)
    assert r.status_code == 400 and codigo(r) == 'DATOS_INSUFICIENTES'
    sin_efectos(m2, exp)


def test_un_familiar_que_no_cumple_las_reglas_revierte_todo(m2, captacion):
    exp = listo_para_asignar(m2)
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    familiares = e.datos_ventana2['familiares']
    familiares[1].pop('orden_hijo')    # hijo menor sin cédula ni orden (se colaría si la validación del envío se saltara)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(datos_ventana2={**e.datos_ventana2, 'familiares': familiares})
    r = asignar(captacion, exp)
    assert r.status_code == 409 and codigo(r) == 'FAMILIAR_INVALIDO'
    sin_efectos(m2, exp)


# ------------------------------------------------------------------------------------------------ rollback total
FALLOS = [
    ('crear el Employee', 'apps.personal.infrastructure.repositories.repo_personal_orm.RepoPersonalORM.crear_empleado'),
    ('anotar foto y origen', 'apps.personal.infrastructure.repositories.repo_personal_orm.RepoPersonalORM.registrar_procedencia_ingreso'),
    ('copiar un familiar', 'apps.familiares.infrastructure.repositories.repo_familiares_orm.RepoFamiliaresORM.crear_familiar'),
    ('ocupar el puesto', 'apps.cargos.infrastructure.repositories.repo_cargos_orm.RepoCargosORM.asignar_cargo_a_empleado'),
    ('crear la cuenta', 'apps.postulacion.infrastructure.promotor_empleado_orm.aprovisionar_por_cedula'),
    ('consumir la reserva', 'apps.postulacion.infrastructure.repositories.repo_postulacion_orm.RepoPostulacionORM.guardar_reserva'),
    ('revocar la credencial', 'apps.postulacion.infrastructure.repositories.repo_postulacion_orm.RepoPostulacionORM.guardar_credencial'),
    ('guardar el expediente', 'apps.postulacion.infrastructure.repositories.repo_postulacion_orm.RepoPostulacionORM.guardar_expediente'),
    ('registrar el asiento', 'apps.postulacion.infrastructure.repositories.repo_postulacion_orm.RepoPostulacionORM.registrar_transicion'),
]


@pytest.mark.parametrize('paso, destino', FALLOS, ids=[f[0] for f in FALLOS])
def test_si_falla_cualquier_paso_no_queda_nada_a_medias(m2, monkeypatch, paso, destino):
    exp = listo_para_asignar(m2)
    def falla(*a, **k):
        raise RuntimeError(f'falla simulada al {paso}')

    monkeypatch.setattr(destino, falla)
    r = asignar(m2.captacion(sin_excepciones=True), exp)
    assert r.status_code == 500, (paso, r.content)
    sin_efectos(m2, exp)


def test_un_fallo_con_error_de_dominio_en_el_puesto_tambien_revierte_lo_anterior(m2, captacion, monkeypatch):
    from core.domain.exceptions import ConflictError

    exp = listo_para_asignar(m2)

    def ocupado(*a, **k):
        raise ConflictError('Este código ya está ocupado por el empleado.')

    monkeypatch.setattr('apps.cargos.infrastructure.repositories.repo_cargos_orm.RepoCargosORM.asignar_cargo_a_empleado', ocupado)
    assert asignar(captacion, exp).status_code == 409
    sin_efectos(m2, exp)


def test_el_detalle_ofrece_contratar_y_la_bloquea_sin_reserva_pero_no_se_puede_por_transicion(m2, captacion):
    exp = listo_para_asignar(m2)
    acciones = captacion.get(f'{BASE}/expedientes/{exp}/').json()['data']['acciones']
    contratar = [a for a in acciones if a['destino'] == 'CONTRATADO']
    assert len(contratar) == 1 and contratar[0]['etiqueta'] == 'Contratar y asignar puesto'
    assert contratar[0]['bloqueada'] is False
    # La contratación solo va por `asignar/`: el endpoint de transición la sigue rechazando.
    r = captacion.post(f'{BASE}/expedientes/{exp}/transicion/', {'destino': 'CONTRATADO'}, format='json')
    assert r.status_code == 409 and codigo(r) == 'TRANSICION_NO_PERMITIDA'
    # Sin reserva activa se muestra bloqueada, con su motivo.
    ReservaPuestoModel.objects.filter(expediente_id=exp).update(estado='VENCIDA')
    acciones = captacion.get(f'{BASE}/expedientes/{exp}/').json()['data']['acciones']
    contratar = [a for a in acciones if a['destino'] == 'CONTRATADO'][0]
    assert contratar['bloqueada'] is True and contratar['motivo_bloqueo']
    # Quien no tiene revisión final no la ve.
    solo_ver = cliente_personal('postulacion.ver_bandeja', pk=m2.cuenta.pk)
    assert not [a for a in solo_ver.get(f'{BASE}/expedientes/{exp}/').json()['data']['acciones'] if a['destino'] == 'CONTRATADO']


def test_no_se_repone_la_credencial_sin_una_ventana_abierta(m2, captacion):
    exp = listo_para_asignar(m2)
    r = captacion.post(f'{BASE}/expedientes/{exp}/reponer-credencial/', {}, format='json')
    assert r.status_code == 409 and codigo(r) == 'SIN_VENTANA_ABIERTA'
    assert CredencialPostulanteModel.objects.filter(expediente_id=exp, revocada=False).count() <= 1


def test_al_cargar_el_correo_institucional_se_crea_la_cuenta_y_se_resuelve_el_aviso(
    m2, captacion, monkeypatch, django_capture_on_commit_callbacks,
):
    exp = listo_para_asignar(m2, correo='')
    assert asignar(captacion, exp).status_code == 200
    monkeypatch.setattr('apps.identidad.infrastructure.receivers.obtener_notificador', lambda: Notificador())
    Notificador.resueltas.clear()
    with django_capture_on_commit_callbacks(execute=True):
        empleado = EmployeeModel.objects.get(cedulaidentidad=CEDULA)
        empleado.correo = 'ana.perez@conatel.gob.ve'
        empleado.save()
    assert CuentaModel.objects.filter(cedula_id=CEDULA).exists()
    assert ('empleado', CEDULA, 'sistema', 'CORREO_INSTITUCIONAL_PENDIENTE') in Notificador.resueltas


def test_un_fallo_al_resolver_el_aviso_no_rompe_el_guardado_de_la_ficha(
    m2, captacion, monkeypatch, django_capture_on_commit_callbacks,
):
    class Roto(Notificador):
        def resolver_avisos(self, *a, **k):
            raise RuntimeError('boom')

    exp = listo_para_asignar(m2, correo='')
    assert asignar(captacion, exp).status_code == 200
    monkeypatch.setattr('apps.identidad.infrastructure.receivers.obtener_notificador', lambda: Roto())
    with django_capture_on_commit_callbacks(execute=True):
        empleado = EmployeeModel.objects.get(cedulaidentidad=CEDULA)
        empleado.correo = 'ana.perez@conatel.gob.ve'
        empleado.save()
    assert EmployeeModel.objects.get(cedulaidentidad=CEDULA).correo == 'ana.perez@conatel.gob.ve'
    assert CuentaModel.objects.filter(cedula_id=CEDULA).exists()
