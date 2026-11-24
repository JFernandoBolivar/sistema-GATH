"""Concurrencia (G-6): dos expedientes disputando el mismo puesto, en la reserva y en la promoción. Hilos reales, BD real.

Cada hilo usa su propia conexión (se cierra al terminar). Hay una barrera para que arranquen a la vez, y el resultado debe
ser el mismo sea cual sea el orden en que el motor los serialice: UNO gana y el otro recibe su error SIN efectos.
"""
import threading
from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.postulacion.application.use_cases.promocion import promover_postulante
from apps.postulacion.application.use_cases.reservas import reservar_puesto
from apps.postulacion.domain.errores import ConflictoConCodigo
from apps.postulacion.domain.services.maquina_estados import P_REVISION_FINAL, Actor
from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel
from apps.postulacion.infrastructure.models.presupuesto_models import ReservaPuestoModel
from apps.postulacion.infrastructure.promotor_empleado_orm import PromotorEmpleadoORM
from apps.postulacion.infrastructure.repositories.puestos_vacantes_orm import PuestosVacantesORM
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from core.domain.exceptions import DomainError
from tests.integration.postulacion._presupuesto_mundo import Config, crear_expediente, crear_mundo
from tests.integration.postulacion._ventana2_mundo import Mundo2, listo_para_asignar

pytestmark = pytest.mark.django_db(transaction=True)


def correr_en_paralelo(*tareas):
    """Ejecuta cada tarea en su hilo (conexión propia) tras una barrera. Devuelve `[('ok', valor) | ('error', excepción)]`."""
    barrera = threading.Barrier(len(tareas))
    resultados: list = [None] * len(tareas)

    def hilo(i, tarea):
        try:
            barrera.wait(timeout=10)
            resultados[i] = ('ok', tarea())
        except Exception as e:  # noqa: BLE001 - se devuelve para que la prueba lo inspeccione
            resultados[i] = ('error', e)
        finally:
            connection.close()

    hilos = [threading.Thread(target=hilo, args=(i, t)) for i, t in enumerate(tareas)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join(timeout=60)
    assert all(r is not None for r in resultados), 'un hilo no terminó'
    return resultados


ACTOR = Actor(cedula='20000001', permisos=frozenset({P_REVISION_FINAL}))


def contratar(m2, exp):
    return lambda: promover_postulante(
        RepoPostulacionORM(), Config(), PuestosVacantesORM(), PromotorEmpleadoORM(), None, expediente_id=exp, actor=ACTOR,
        usuario_id=m2.cuenta.pk,
    )


def test_dos_expedientes_reservando_el_mismo_puesto_solo_uno_gana():
    mundo = crear_mundo()
    a, b = crear_expediente(mundo, '10000001'), crear_expediente(mundo, '10000002')
    puesto = mundo['p1'].pk

    def reservar(exp):
        return lambda: reservar_puesto(
            RepoPostulacionORM(), PuestosVacantesORM(), Config(), expediente_id=exp, puesto_id=puesto, reservado_por='20000001')

    resultados = correr_en_paralelo(reservar(a), reservar(b))
    ganadores = [r for r in resultados if r[0] == 'ok']
    perdedores = [r for r in resultados if r[0] == 'error']
    assert len(ganadores) == 1 and len(perdedores) == 1
    assert isinstance(perdedores[0][1], ConflictoConCodigo) and perdedores[0][1].codigo == 'PUESTO_RESERVADO'
    activas = ReservaPuestoModel.objects.filter(puesto_id=puesto, estado='ACTIVA')
    assert activas.count() == 1 and str(activas.get().expediente_id) == ganadores[0][1][0].expediente_id
    assert ReservaPuestoModel.objects.count() == 1    # el perdedor no dejó ni una fila


def test_el_mismo_expediente_contratado_dos_veces_a_la_vez_solo_se_contrata_una():
    m2 = Mundo2(crear_mundo())
    exp = listo_para_asignar(m2)
    resultados = correr_en_paralelo(contratar(m2, exp), contratar(m2, exp))
    assert sorted(r[0] for r in resultados) == ['error', 'ok']
    error = next(r[1] for r in resultados if r[0] == 'error')
    assert isinstance(error, DomainError) and getattr(error, 'codigo', '') in ('EXPEDIENTE_FINAL', 'TRANSICION_NO_PERMITIDA', 'PUESTO_NO_DISPONIBLE')
    assert EmployeeModel.objects.filter(cedulaidentidad='12345678').count() == 1
    assert EmployeeMovementHistoryModel.objects.filter(empleado__cedulaidentidad='12345678').count() == 1
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'CONTRATADO'
    assert ReservaPuestoModel.objects.get(expediente_id=exp).estado == 'CONSUMIDA'


def test_la_promocion_contra_una_asignacion_directa_del_mismo_puesto_solo_deja_un_ocupante():
    m2 = Mundo2(crear_mundo())
    exp = listo_para_asignar(m2)
    intruso = EmployeeModel.objects.create(cedulaidentidad='9000002', nombres='Rita', apellidos='Intrusa', sexoid=m2.cat['femenino'])
    puesto = m2.mundo['p1'].pk

    def asignar_directo():
        return RepoCargosORM().asignar_cargo_a_empleado(cargo_id=puesto, cedula=intruso.cedulaidentidad, usuario_id=m2.cuenta.pk)

    resultados = correr_en_paralelo(contratar(m2, exp), asignar_directo)
    assert sorted(r[0] for r in resultados) == ['error', 'ok']
    ocupante = AsigTrabajoModel.objects.get(pk=puesto).employee_id
    promocion_gano = resultados[0][0] == 'ok'
    if promocion_gano:   # el alta directa fue rechazada: el puesto ya estaba ocupado
        assert ocupante == '12345678' and isinstance(resultados[1][1], DomainError)
        assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'CONTRATADO'
    else:                # ganó el alta directa: la promoción dijo PUESTO_NO_DISPONIBLE y NO dejó rastro
        error = resultados[0][1]
        assert ocupante == '9000002' and isinstance(error, ConflictoConCodigo) and error.codigo == 'PUESTO_NO_DISPONIBLE'
        assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'LISTO_PARA_ASIGNAR'
        assert not EmployeeModel.objects.filter(cedulaidentidad='12345678').exists()
        assert ReservaPuestoModel.objects.get(expediente_id=exp).estado == 'ACTIVA'
        assert not EmployeeMovementHistoryModel.objects.filter(empleado__cedulaidentidad='12345678').exists()


def test_dos_expedientes_mismo_puesto_la_reserva_vencida_de_uno_no_le_sirve_cuando_el_otro_ya_reservo():
    """Secuencial pero con el reloj real: A tenía el puesto, su reserva venció y la tarea la barrió; B la tomó y contrata;
    A ya no puede contratar y no deja nada."""
    from apps.postulacion.application.use_cases.vencimientos import procesar_vencimientos

    m2 = Mundo2(crear_mundo())
    a = listo_para_asignar(m2, '10000001')
    ReservaPuestoModel.objects.filter(expediente_id=a).update(vence_el=timezone.now() - timedelta(hours=1))
    # antes de que la tarea la barra, B no puede reservar (la de A sigue ACTIVA)
    b = crear_expediente(m2.mundo, '10000002')
    ExpedientePostulacionModel.objects.filter(pk=b).update(estado='EN_PRESUPUESTO')
    with pytest.raises(ConflictoConCodigo) as e:
        reservar_puesto(RepoPostulacionORM(), PuestosVacantesORM(), Config(), expediente_id=b, puesto_id=m2.mundo['p1'].pk, reservado_por='x')
    assert e.value.codigo == 'PUESTO_RESERVADO'
    # y A tampoco puede contratar con su reserva vencida, aunque la tarea no haya corrido
    with pytest.raises(ConflictoConCodigo) as e:
        contratar(m2, a)()
    assert e.value.codigo == 'PUESTO_NO_DISPONIBLE'
    # la tarea barre: A vuelve a Presupuesto y el puesto queda libre para B, que lo reserva
    procesar_vencimientos(RepoPostulacionORM(), Config(), None, ahora=timezone.now())
    assert ExpedientePostulacionModel.objects.get(pk=a).estado == 'EN_PRESUPUESTO'
    reservar_puesto(RepoPostulacionORM(), PuestosVacantesORM(), Config(), expediente_id=b, puesto_id=m2.mundo['p1'].pk, reservado_por='x')
    assert ReservaPuestoModel.objects.get(expediente_id=b, estado='ACTIVA').puesto_id == m2.mundo['p1'].pk
    assert not EmployeeModel.objects.filter(cedulaidentidad='10000001').exists()
