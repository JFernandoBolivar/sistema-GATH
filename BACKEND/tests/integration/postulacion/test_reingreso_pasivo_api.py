"""C-9: reingreso de un jubilado o pensionado por Captación según `captacion.reingreso_pasivo`, contra la BD."""
import pytest

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.catalogos.infrastructure.models.catalogo_models import EstatusModel, TipoPersonalModel
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import RepoCondicionTrabajadorORM
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel, PostulanteModel
from tests.integration.postulacion._presupuesto_mundo import BASE, Config, codigo, datos
from tests.integration.postulacion._ventana2_mundo import Mundo2, instalar_dobles_g, listo_para_asignar

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


def crear_pasivo(m2, cedula=CEDULA):
    """Un jubilado: Employee con una asignación PASIVO vigente."""
    empleado = EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres='Ana Maria', apellidos='Perez Jubilada', sexoid=m2.cat['femenino'])
    EstatusModel.objects.get_or_create(estatus='EGRESADO')
    estatus = EstatusModel.objects.get_or_create(estatus='PASIVO')[0]
    tipo = TipoPersonalModel.objects.get_or_create(tipo_personal='PASIVO')[0]
    base = m2.mundo['p3']
    asignacion = AsigTrabajoModel.objects.create(
        codigo='PAS-001', employee=empleado, denominacioncargoid=base.denominacioncargoid,
        denominacioncargoespecificoid=base.denominacioncargoespecificoid, tiponominaid=base.tiponominaid,
        estatusid=estatus, Tipo_personal=tipo, Dependencia=base.Dependencia,
    )
    assert RepoCondicionTrabajadorORM().condicion_por_cedula(cedula) is CondicionTrabajador.PASIVO
    return empleado, asignacion


def alta(c, monkeypatch, modo, cedula=CEDULA):
    monkeypatch.setattr(
        'apps.postulacion.presentation.views.captacion_views.configuracion', lambda: Config(reingreso_pasivo=modo))
    return c.post(f'{BASE}/postulantes/', {'cedula': cedula, 'nombres': 'Ana', 'apellidos': 'Perez'}, format='json')


def asignar(c, exp):
    return c.post(f'{BASE}/expedientes/{exp}/asignar/', {}, format='json')


def test_el_parametro_existe_con_tres_opciones_y_defecto_permitir():
    from apps.configuracion.domain.parametros import DEFINICIONES, SECCION_PROCESO_INGRESO, validar_valor
    from core.domain.exceptions import ValidationError

    d = {x.clave: x for x in DEFINICIONES}['captacion.reingreso_pasivo']
    assert (d.tipo, d.defecto, d.grupo, d.seccion) == ('texto', 'permitir', 'captacion', SECCION_PROCESO_INGRESO)
    assert [v for v, _ in d.opciones] == ['permitir', 'cerrar_al_contratar', 'no_permitir']
    assert validar_valor(d, 'no_permitir') == 'no_permitir'
    with pytest.raises(ValidationError):
        validar_valor(d, 'otra')


def test_la_siembra_de_la_migracion_crea_el_parametro():
    from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
    import importlib

    mig = importlib.import_module('apps.configuracion.migrations.0019_sembrar_reingreso_pasivo')
    from django.apps import apps
    mig.sembrar(apps, None)
    mig.sembrar(apps, None)   # idempotente
    assert ParametroSistemaModel.objects.filter(clave='captacion.reingreso_pasivo', valor='permitir').count() == 1
    mig.retirar(apps, None)
    assert not ParametroSistemaModel.objects.filter(clave='captacion.reingreso_pasivo').exists()


# ------------------------------------------------------------------------------------------------ no_permitir
def test_no_permitir_rechaza_el_alta_de_un_pasivo_con_codigo(m2, captacion, monkeypatch):
    crear_pasivo(m2)
    r = alta(captacion, monkeypatch, 'no_permitir')
    assert r.status_code == 409 and codigo(r) == 'REINGRESO_PASIVO_NO_PERMITIDO', r.content
    assert not PostulanteModel.objects.exists() and not ExpedientePostulacionModel.objects.exists()


def test_no_permitir_no_afecta_a_quien_no_es_pasivo(m2, captacion, monkeypatch):
    r = alta(captacion, monkeypatch, 'no_permitir')
    assert r.status_code == 201, r.content


@pytest.mark.parametrize('modo', ['permitir', 'cerrar_al_contratar'])
def test_permitir_y_cerrar_aceptan_el_alta_de_un_pasivo_y_guardan_el_snapshot(m2, captacion, monkeypatch, modo):
    crear_pasivo(m2)
    r = alta(captacion, monkeypatch, modo)
    assert r.status_code == 201, r.content
    exp = datos(r)['expediente']['id']
    assert ExpedientePostulacionModel.objects.get(pk=exp).reingreso_pasivo == modo
    # cambiar el parámetro después no altera el expediente en curso, y el detalle lo muestra con la marca de pasivo
    monkeypatch.setattr(
        'apps.postulacion.presentation.views.captacion_views.configuracion', lambda: Config(reingreso_pasivo='no_permitir'))
    d = datos(captacion.get(f'{BASE}/expedientes/{exp}/'))
    assert d['flujo']['reingreso_pasivo'] == modo
    assert d['postulante']['es_pasivo'] is True and d['postulante']['es_reingreso'] is True


def test_un_postulante_que_no_es_pasivo_no_se_marca(m2, captacion, monkeypatch):
    exp = datos(alta(captacion, monkeypatch, 'permitir'))['expediente']['id']
    d = datos(captacion.get(f'{BASE}/expedientes/{exp}/'))
    assert d['postulante']['es_pasivo'] is False and d['flujo']['reingreso_pasivo'] == 'permitir'


# ------------------------------------------------------------------------------------------------ contratación
def test_permitir_contrata_y_deja_el_registro_de_pasivo_como_esta(m2, captacion):
    _, asignacion = crear_pasivo(m2)
    exp = listo_para_asignar(m2)
    r = asignar(captacion, exp)
    assert r.status_code == 200, r.content
    asignacion.refresh_from_db()
    assert asignacion.estatusid.estatus == 'PASIVO'
    assert not EmployeeEgresadoModel.objects.filter(employee__cedulaidentidad=CEDULA).exists()
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'CONTRATADO'


def test_cerrar_al_contratar_cierra_el_pasivo_en_la_misma_operacion(m2, captacion):
    empleado, asignacion = crear_pasivo(m2)
    exp = listo_para_asignar(m2)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(reingreso_pasivo='cerrar_al_contratar')
    r = asignar(captacion, exp)
    assert r.status_code == 200, r.content
    asignacion.refresh_from_db()
    assert asignacion.estatusid.estatus == 'EGRESADO'
    egreso = EmployeeEgresadoModel.objects.get(employee=empleado)
    assert egreso.motivo_egreso.movimiento == 'REINGRESO COMO PERSONAL ACTIVO'
    assert egreso.motivo_egreso.categoria.categoria == 'EGRESO PASIVO'
    assert RepoCondicionTrabajadorORM().condicion_por_cedula(CEDULA) is CondicionTrabajador.ACTIVO
    tipos = list(EmployeeMovementHistoryModel.objects.filter(empleado=empleado).values_list('tipo_movimiento', flat=True))
    assert 'EGRESO' in tipos and 'INGRESO' in tipos
    exp_db = ExpedientePostulacionModel.objects.get(pk=exp)
    assert exp_db.estado == 'CONTRATADO'
    assert AsigTrabajoModel.objects.get(pk=m2.mundo['p1'].pk).employee_id == CEDULA
    assert datos(r)['expediente']['estado'] == 'CONTRATADO'


def test_cerrar_al_contratar_no_hace_nada_si_la_persona_no_era_pasivo(m2, captacion):
    exp = listo_para_asignar(m2)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(reingreso_pasivo='cerrar_al_contratar')
    assert asignar(captacion, exp).status_code == 200
    assert not EmployeeEgresadoModel.objects.exists()


def test_si_falla_la_contratacion_el_cierre_del_pasivo_se_revierte(m2, captacion, monkeypatch):
    from core.domain.exceptions import ConflictError

    empleado, asignacion = crear_pasivo(m2)
    exp = listo_para_asignar(m2)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(reingreso_pasivo='cerrar_al_contratar')

    def ocupado(*a, **k):
        raise ConflictError('Este código ya está ocupado por el empleado.')

    monkeypatch.setattr('apps.cargos.infrastructure.repositories.repo_cargos_orm.RepoCargosORM.asignar_cargo_a_empleado', ocupado)
    assert asignar(captacion, exp).status_code == 409
    asignacion.refresh_from_db()
    assert asignacion.estatusid.estatus == 'PASIVO'
    assert not EmployeeEgresadoModel.objects.filter(employee=empleado).exists()
    assert not EmployeeMovementHistoryModel.objects.filter(empleado=empleado).exists()
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'LISTO_PARA_ASIGNAR'


def test_si_falla_el_cierre_del_pasivo_se_aborta_toda_la_contratacion(m2, captacion, monkeypatch):
    from core.domain.exceptions import NotFoundError

    crear_pasivo(m2)
    exp = listo_para_asignar(m2)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(reingreso_pasivo='cerrar_al_contratar')

    def falla(*a, **k):
        raise NotFoundError('sin asignación pasiva')

    monkeypatch.setattr('apps.pasivos.infrastructure.repositories.repo_pasivos_orm.RepoPasivosORM.egresar_pasivo', falla)
    r = asignar(captacion, exp)
    assert r.status_code == 409 and codigo(r) == 'CIERRE_PASIVO_FALLIDO', r.content
    assert AsigTrabajoModel.objects.get(pk=m2.mundo['p1'].pk).employee_id is None
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'LISTO_PARA_ASIGNAR'
