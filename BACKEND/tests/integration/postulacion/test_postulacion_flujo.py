"""Postulación (D-1, D-2) contra la BD: reingreso, transición con historial y un solo expediente abierto."""
from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.postulacion.application.use_cases.consultas import consultar_expediente
from apps.postulacion.application.use_cases.postulantes import crear_postulante_con_expediente
from apps.postulacion.application.use_cases.transiciones import HechosExternos, aplicar_transicion_expediente
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente as E
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import BuscadorEmpleadosORM, RepoPostulacionORM
from core.domain.exceptions import ConflictError, PermissionDeniedError, ValidationError

pytestmark = pytest.mark.django_db


class ConfigFalsa:
    """Puerto LectorConfiguracion con los valores de captación fijos para la prueba."""

    def __init__(self, psicofisico=True):
        self.valores = {
            'captacion.vigencia_ventana1_dias': 15, 'captacion.vigencia_ventana2_dias': 10,
            'captacion.vigencia_reserva_puesto_dias': 30,
            'captacion.espera_diferido_dias': 90, 'captacion.horas_escalamiento_contacto': 48, 'captacion.psicofisico_obligatorio': psicofisico,
            'captacion.requiere_presupuesto': True, 'captacion.requiere_direccion_general': True,
        }

    def obtener_texto(self, clave):
        return str(self.valores[clave])

    def obtener_booleano(self, clave):
        return bool(self.valores[clave])

    def obtener_entero(self, clave):
        return int(self.valores[clave])


CAPTACION = Actor(cedula='20000001', permisos=frozenset({
    'postulacion.verificar', 'postulacion.rechazar', 'postulacion.abrir_expediente', 'postulacion.revision_final',
}))


def _crear(cedula='12345678', **kw):
    return crear_postulante_con_expediente(
        RepoPostulacionORM(), BuscadorEmpleadosORM(), ConfigFalsa(), cedula=cedula, nombres='Ana María',
        apellidos='Pérez', creado_por='20000001', **kw,
    )


def test_alta_crea_postulante_y_expediente_pre_registrado_con_numero_y_asiento_inicial():
    postulante, exp, reingreso = _crear()
    assert not reingreso and postulante.employee_cedula == ''
    assert exp.estado == E.PRE_REGISTRADO and exp.numero.startswith('EXP-') and exp.numero.endswith('00001')
    assert exp.ventana == 1 and exp.ventana_vence_el - exp.fecha_apertura == timedelta(days=15)
    historial = consultar_expediente(RepoPostulacionORM(), exp.id).transiciones
    assert [(t.estado_origen, t.estado_destino) for t in historial] == [('', 'PRE_REGISTRADO')]


def test_numeros_de_expediente_consecutivos():
    _, e1, _ = _crear('11111111')
    _, e2, _ = _crear('22222222')
    assert int(e2.numero[-5:]) == int(e1.numero[-5:]) + 1


def test_reingreso_vincula_el_empleado_existente_sin_duplicar_persona():
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'V'})
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='M')
    EmployeeModel.objects.create(cedulaidentidad='7711001', nombres='Luis', apellidos='Egresado', sexoid=sexo)
    antes = EmployeeModel.objects.count()
    postulante, exp, reingreso = _crear('7711001')
    assert reingreso and postulante.employee_cedula == '7711001'
    assert EmployeeModel.objects.count() == antes
    assert PostulanteModel.objects.filter(cedula='7711001').count() == 1


def test_reingreso_de_postulante_previo_abre_expediente_nuevo_sobre_la_misma_persona():
    repo = RepoPostulacionORM()
    p1, e1, _ = _crear('33333333')
    aplicar_transicion_expediente(
        repo, ConfigFalsa(), expediente_id=e1.id, destino=E.EXPIRADO, actor=Actor.sistema(),
        ahora=e1.ventana_vence_el + timedelta(days=1),
    )
    p2, e2, _ = _crear('33333333')
    assert p2.id == p1.id and e2.id != e1.id
    assert ExpedientePostulacionModel.objects.filter(postulante_id=p1.id).count() == 2


def test_rechaza_el_segundo_expediente_abierto():
    _crear('44444444')
    with pytest.raises(ConflictError, match='expediente abierto'):
        _crear('44444444')
    assert ExpedientePostulacionModel.objects.filter(postulante__cedula='44444444').count() == 1


def test_constraint_de_bd_impide_dos_abiertos_aunque_se_salte_el_caso_de_uso():
    postulante, _, _ = _crear('55555555')
    with pytest.raises(IntegrityError), transaction.atomic():
        ExpedientePostulacionModel.objects.create(
            numero='EXP-2026-99999', postulante_id=postulante.id, estado='EN_CAPTURA',
        )


def test_cedula_invalida_o_datos_obligatorios():
    with pytest.raises(ValidationError):
        _crear('ABC')
    with pytest.raises(ValidationError):
        crear_postulante_con_expediente(
            RepoPostulacionORM(), BuscadorEmpleadosORM(), ConfigFalsa(), cedula='12345678', nombres=' ',
            apellidos='X', creado_por='1',
        )


def test_transicion_guarda_estado_y_registra_historial_con_actor_y_motivo():
    repo = RepoPostulacionORM()
    postulante, exp, _ = _crear('66666666')
    exp, asiento = aplicar_transicion_expediente(
        repo, ConfigFalsa(), expediente_id=exp.id, destino=E.EN_CAPTURA, actor=Actor.postulante('66666666'),
    )
    assert exp.estado == E.EN_CAPTURA and asiento.actor_tipo == 'POSTULANTE'
    exp, _ = aplicar_transicion_expediente(
        repo, ConfigFalsa(), expediente_id=exp.id, destino=E.ENVIADO_CAPTACION,
        actor=Actor.postulante('66666666'), datos_extra={'origen': 'web'},
    )
    exp, asiento = aplicar_transicion_expediente(
        repo, ConfigFalsa(), expediente_id=exp.id, destino=E.EN_CORRECCION_DATOS, actor=CAPTACION,
        motivo='Falta el segundo apellido',
    )
    assert exp.estado == E.EN_CORRECCION_DATOS and asiento.motivo == 'Falta el segundo apellido'
    vista = consultar_expediente(repo, exp.id)
    assert vista.postulante.cedula == '66666666'
    assert [t.estado_destino for t in vista.transiciones] == [
        'PRE_REGISTRADO', 'EN_CAPTURA', 'ENVIADO_CAPTACION', 'EN_CORRECCION_DATOS',
    ]
    assert vista.transiciones[2].datos_extra == {'origen': 'web'}
    assert vista.transiciones[3].actor_cedula == '20000001'


def test_guardar_borrador_no_deja_historial():
    repo = RepoPostulacionORM()
    _, exp, _ = _crear('77777777')
    aplicar_transicion_expediente(repo, ConfigFalsa(), expediente_id=exp.id, destino=E.EN_CAPTURA, actor=Actor.postulante('1'))
    _, asiento = aplicar_transicion_expediente(
        repo, ConfigFalsa(), expediente_id=exp.id, destino=E.EN_CAPTURA, actor=Actor.postulante('1'),
    )
    assert asiento is None
    assert TransicionExpedienteModel.objects.filter(expediente_id=exp.id).count() == 2


def test_transicion_rechazada_no_cambia_nada():
    repo = RepoPostulacionORM()
    _, exp, _ = _crear('88888888')
    with pytest.raises(PermissionDeniedError):
        aplicar_transicion_expediente(repo, ConfigFalsa(), expediente_id=exp.id, destino=E.EN_CAPTURA, actor=CAPTACION)
    with pytest.raises(ConflictError):
        aplicar_transicion_expediente(repo, ConfigFalsa(), expediente_id=exp.id, destino=E.CONTRATADO, actor=CAPTACION)
    assert ExpedientePostulacionModel.objects.get(pk=exp.id).estado == 'PRE_REGISTRADO'
    assert TransicionExpedienteModel.objects.filter(expediente_id=exp.id).count() == 1


def _hasta_enviado(cedula):
    repo = RepoPostulacionORM()
    _, exp, _ = _crear(cedula)
    for destino in (E.EN_CAPTURA, E.ENVIADO_CAPTACION):
        aplicar_transicion_expediente(repo, ConfigFalsa(), expediente_id=exp.id, destino=destino, actor=Actor.postulante(cedula))
    return repo, exp


@pytest.mark.parametrize('obligatorio,registrado,pasa', [(True, False, False), (True, True, True), (False, False, True)])
def test_abrir_hacia_presupuesto_segun_psicofisico_y_propuesta(obligatorio, registrado, pasa):
    repo, exp = _hasta_enviado('99999991')
    propuesta = {'cargo_propuesto_id': 10, 'direccion_general_id': 3}
    kwargs = dict(
        expediente_id=exp.id, destino=E.EN_PRESUPUESTO, actor=CAPTACION, propuesta=propuesta,
        externos=HechosExternos(psicofisico_registrado=registrado),
    )
    if pasa:
        nuevo, _ = aplicar_transicion_expediente(repo, ConfigFalsa(obligatorio), **kwargs)
        assert nuevo.estado == E.EN_PRESUPUESTO and nuevo.cargo_propuesto_id == 10
    else:
        with pytest.raises(ConflictError, match='psicofísico'):
            aplicar_transicion_expediente(repo, ConfigFalsa(obligatorio), **kwargs)
        assert ExpedientePostulacionModel.objects.get(pk=exp.id).estado == 'ENVIADO_CAPTACION'


def test_abrir_sin_cargo_ni_oficina_se_rechaza_y_propuesta_ajena_tambien():
    repo, exp = _hasta_enviado('99999992')
    with pytest.raises(ValidationError, match='cargo y la oficina'):
        aplicar_transicion_expediente(
            repo, ConfigFalsa(False), expediente_id=exp.id, destino=E.EN_PRESUPUESTO, actor=CAPTACION,
        )
    with pytest.raises(ValidationError, match='solo se modifica'):
        aplicar_transicion_expediente(
            repo, ConfigFalsa(), expediente_id=exp.id, destino=E.RECHAZADO_CAPTACION, actor=CAPTACION,
            motivo='x', propuesta={'cargo_propuesto_id': 1},
        )


def test_rechazo_exige_motivo_y_cierra_el_expediente_permitiendo_uno_nuevo():
    repo, exp = _hasta_enviado('99999993')
    with pytest.raises(ValidationError, match='motivo'):
        aplicar_transicion_expediente(repo, ConfigFalsa(), expediente_id=exp.id, destino=E.RECHAZADO_CAPTACION, actor=CAPTACION)
    cerrado, _ = aplicar_transicion_expediente(
        repo, ConfigFalsa(), expediente_id=exp.id, destino=E.RECHAZADO_CAPTACION, actor=CAPTACION, motivo='Datos falsos',
    )
    assert cerrado.es_terminal and cerrado.fecha_cierre is not None
    _, nuevo, _ = _crear('99999993')
    assert nuevo.id != exp.id


def test_el_historial_es_inmutable():
    _, exp, _ = _crear('99999994')
    asiento = TransicionExpedienteModel.objects.get(expediente_id=exp.id)
    asiento.motivo = 'cambiado'
    with pytest.raises(ValueError, match='inmutable'):
        asiento.save()
    with pytest.raises(ValueError, match='inmutable'):
        asiento.delete()


def test_expediente_inexistente():
    from core.domain.exceptions import NotFoundError
    with pytest.raises(NotFoundError):
        aplicar_transicion_expediente(
            RepoPostulacionORM(), ConfigFalsa(), expediente_id='no-es-uuid', destino=E.EN_CAPTURA, actor=CAPTACION,
        )


class _BuscadorActivo:
    def por_cedula(self, cedula):
        from apps.postulacion.domain.entities.postulante import EmpleadoPrevio
        return EmpleadoPrevio(cedula=cedula, nombres='ANA', apellidos='ACTIVA', condicion='ACTIVO')


def test_un_trabajador_activo_no_puede_postularse():
    from core.domain.exceptions import ConflictError
    with pytest.raises(ConflictError, match='trabajador activo'):
        crear_postulante_con_expediente(
            RepoPostulacionORM(), _BuscadorActivo(), ConfigFalsa(), cedula='7711999', nombres='Ana',
            apellidos='Activa', creado_por='20000001',
        )
