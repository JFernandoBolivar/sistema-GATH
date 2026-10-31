"""
G6/G8 sobre la BD de pruebas: historial de movimientos con paginación, orden
determinista, RN-008-01, truncado y PDF con filtros; y los avisos del sistema
que genera el evento `cargo_movimiento_ejecutado`.
"""
import datetime
from io import StringIO

import pytest
from django.core.management import call_command

from apps.cargos.domain.events import (
    ORIGEN_CARGOS,
    ORIGEN_SOBREVIVIENTES,
    cargo_movimiento_ejecutado,
)
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    GradoModel,
    NacionalidadModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.identidad.infrastructure.models.permiso_model import (
    PermisoModel,
    RolPermisoModel,
)
from apps.movimientos.application.use_cases.listar_historial import (
    consultar_historial,
    exportar_historial,
)
from apps.movimientos.domain.value_objects.filtros_historial import (
    MENSAJE_RANGO_INVALIDO,
    FiltrosHistorial,
)
from apps.movimientos.domain.value_objects.paginacion import Paginacion
from apps.movimientos.infrastructure.pdf_movimientos import construir_pdf_historial_movimientos
from apps.movimientos.infrastructure.receivers import notificar_movimiento
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from apps.movimientos.infrastructure.models.movimiento_models import (
    EmployeeMovementHistoryModel,
)
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db

TRABAJADOR = 'V70000001'
ANALISTA = 'V70000002'
PERMISO_AVISOS = 'personal.recibir_avisos_movimientos'


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='F')
    activo = EstatusModel.objects.create(estatus='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='FIJO')
    grado = GradoModel.objects.create(grado='GRADO 1')
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    cargo_especifico = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dependencia = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    direccion = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dependencia)
    personal = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    motivo = TipoMovimientoModel.objects.create(movimiento='TRASLADO FISICO Y ADMINISTRATIVO')

    trabajador = EmployeeModel.objects.create(
        cedulaidentidad=TRABAJADOR, nombres='Trabajador', apellidos='Prueba',
        fecha_nacimiento=datetime.date(1985, 1, 1), sexoid=sexo)
    analista = EmployeeModel.objects.create(
        cedulaidentidad=ANALISTA, nombres='Analista', apellidos='Rrhh',
        fecha_nacimiento=datetime.date(1980, 1, 1), sexoid=sexo)

    rol = RolModel.objects.create(nombre_rol='ANALISTA RRHH')
    rol_trabajador = RolModel.objects.create(nombre_rol='AUTOGESTION')
    permiso, _ = PermisoModel.objects.get_or_create(
        codigo=PERMISO_AVISOS, defaults={'nombre': 'avisos de movimientos'})
    RolPermisoModel.objects.create(rol_id=rol.pk, permiso=permiso)
    cuenta = CuentaModel.objects.create(cedula=analista, rol=rol, password='!')
    CuentaModel.objects.create(cedula=trabajador, rol=rol_trabajador, password='!')

    asignacion = AsigTrabajoModel.objects.create(
        employee=trabajador,
        codigo='COD-100',
        denominacioncargoid=cargo,
        denominacioncargoespecificoid=cargo_especifico,
        tiponominaid=nomina,
        estatusid=activo,
        Dependencia=dependencia,
        DireccionGeneral=direccion,
        gradoid=grado,
        Tipo_personal=personal,
    )

    def crear_movimiento(tipo, fecha, empleado=trabajador, motivo_=motivo):
        fila = EmployeeMovementHistoryModel.objects.create(
            empleado=empleado,
            codigo_puesto='COD-100',
            denominacioncargo_id=cargo.pk,
            denominacioncargoespecifico_id=cargo_especifico.pk,
            gradoid_id=grado.pk,
            tiponomina_id=nomina.pk,
            estatus_id=activo.pk,
            tipo_personal_id=personal.pk,
            DependenciasId_id=dependencia.pk,
            DireccionGeneralid_id=direccion.pk,
            tipo_movimiento=tipo,
            motivo_id=motivo_.pk if motivo_ else None,
            ejecutado_por_id=cuenta.pk,
        )
        EmployeeMovementHistoryModel.objects.filter(pk=fila.pk).update(
            fecha_movimiento=fecha)
        return fila.pk

    return {
        'trabajador': trabajador,
        'cuenta': cuenta,
        'rol': rol,
        'asignacion': asignacion,
        'motivo': motivo,
        'crear_movimiento': crear_movimiento,
        'repo': RepoMovimientosORM(),
    }


def _fecha(dia):
    return datetime.datetime(2026, 1, dia, 10, 0, tzinfo=datetime.timezone.utc)


# ─── Historial: orden, paginación, filtros ────────────────────────────────────


def test_orden_determinista_del_mas_reciente_al_mas_antiguo(escenario):
    antiguo = escenario['crear_movimiento']('INGRESO', _fecha(1))
    reciente = escenario['crear_movimiento']('TRASLADO', _fecha(3))
    intermedio = escenario['crear_movimiento']('CAMBIO DE ESTATUS', _fecha(2))

    primera = [m.id for m in escenario['repo'].listar_historial(FiltrosHistorial(), 50)[0]]
    segunda = [m.id for m in escenario['repo'].listar_historial(FiltrosHistorial(), 50)[0]]

    assert primera == segunda == [reciente, intermedio, antiguo]


def test_paginacion_en_el_servidor(escenario):
    for dia in (1, 2, 3):
        escenario['crear_movimiento']('INGRESO', _fecha(dia))

    pagina_1 = consultar_historial(escenario['repo'], {}, Paginacion(pagina=1, tamano=2))
    pagina_2 = consultar_historial(escenario['repo'], {}, Paginacion(pagina=2, tamano=2))

    assert pagina_1.total == 3
    assert pagina_1.total_paginas == 2
    assert len(pagina_1.resultados) == 2
    assert len(pagina_2.resultados) == 1
    assert {m.id for m in pagina_1.resultados}.isdisjoint({m.id for m in pagina_2.resultados})


def test_rn_008_01_en_el_backend(escenario):
    with pytest.raises(ValidationError) as exc:
        consultar_historial(
            escenario['repo'],
            {'fecha_inicio': '2026-02-01', 'fecha_fin': '2026-01-01'},
            Paginacion(),
        )
    assert str(exc.value) == MENSAJE_RANGO_INVALIDO


def test_filtros_del_historial(escenario):
    escenario['crear_movimiento']('INGRESO', _fecha(1), motivo_=None)
    escenario['crear_movimiento']('TRASLADO', _fecha(5))

    pagina = consultar_historial(
        escenario['repo'], {'tipo_movimiento': 'TRASLADO', 'cedula': TRABAJADOR}, Paginacion()
    )
    assert pagina.total == 1
    assert pagina.resultados[0].tipo_movimiento == 'TRASLADO'

    rango = consultar_historial(
        escenario['repo'], {'fecha_inicio': '2026-01-04', 'fecha_fin': '2026-01-31'}, Paginacion()
    )
    assert rango.total == 1

    gerencia = consultar_historial(
        escenario['repo'], {'gerencia': 'GESTION HUMANA', 'estatus': 'ACTIVO'}, Paginacion()
    )
    assert gerencia.total == 2


def test_el_listado_no_hace_una_consulta_por_fila(escenario, django_assert_num_queries):
    """G12-6: proteger el `select_related` del historial contra un N+1.

    Son dos consultas fijas (conteo + página) y no crecen con el número de
    movimientos; si alguien quita el `select_related`, el mapeo de cada fila
    dispara consultas por sus relaciones y este test falla.
    """
    for dia in range(1, 6):
        escenario['crear_movimiento']('TRASLADO', _fecha(dia))

    with django_assert_num_queries(2):
        filas, total = escenario['repo'].listar_historial(FiltrosHistorial(), 10)

    assert total == 5
    assert len(filas) == 5
    assert filas[0].denominacion_nombre == 'ANALISTA'
    assert filas[0].ejecutado_por_nombre


# ─── Exportación ────────────────────────────────────────────────────────────


def test_exportacion_truncada_con_filtros_legibles(escenario):
    for dia in (1, 2, 3):
        escenario['crear_movimiento']('INGRESO', _fecha(dia))

    documento = exportar_historial(
        escenario['repo'], {'categoria': 'INGRESO', 'fecha_inicio': '2026-01-01'}, limite=2
    )

    assert documento.total_encontrados == 3
    assert documento.truncado is True
    assert len(documento.movimientos) == 2
    assert ('Categoría de movimiento', 'INGRESO') in documento.filtros
    assert ('Desde', '01/01/2026') in documento.filtros


def test_pdf_imprime_filtros_y_aviso_de_truncado(escenario):
    for dia in (1, 2, 3):
        escenario['crear_movimiento']('INGRESO', _fecha(dia))
    documento = exportar_historial(escenario['repo'], {'cedula': TRABAJADOR}, limite=2)

    pdf = construir_pdf_historial_movimientos(
        documento.movimientos,
        filtros=documento.filtros,
        usuario_nombre='Analista de Prueba',
        total_encontrados=documento.total_encontrados,
        limite=documento.limite,
        truncado=documento.truncado,
    )

    assert pdf.startswith(b'%PDF')
    assert len(pdf) > 1000


# ─── G8: avisos del movimiento ──────────────────────────────────────────────


def _enviar_evento(escenario, tipo_movimiento, origen=ORIGEN_CARGOS):
    cargo_movimiento_ejecutado.send(
        sender=None,
        cargo_id=escenario['asignacion'].pk,
        cedula=TRABAJADOR,
        tipo_movimiento=tipo_movimiento,
        motivo_id=escenario['motivo'].pk,
        usuario_id=escenario['cuenta'].pk,
        origen=origen,
    )


def test_el_evento_notifica_a_rrhh_y_al_trabajador(escenario, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        _enviar_evento(escenario, 'TRASLADO')

    a_rrhh = NotificacionModel.objects.get(destinatario_cedula=ANALISTA)
    al_trabajador = NotificacionModel.objects.get(destinatario_cedula=TRABAJADOR)

    assert a_rrhh.modulo == 'personal'
    assert a_rrhh.tipo == 'movimiento.traslado'
    assert a_rrhh.enlace == '/movimientos'
    assert a_rrhh.ref_tipo == 'movimiento'
    assert al_trabajador.modulo == 'autogestion'
    assert al_trabajador.enlace == '/autogestion'


def test_un_egreso_no_notifica_al_trabajador(escenario, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        _enviar_evento(escenario, 'EGRESO')

    assert NotificacionModel.objects.filter(destinatario_cedula=ANALISTA).count() == 1
    assert NotificacionModel.objects.filter(destinatario_cedula=TRABAJADOR).count() == 0


def test_el_alta_de_sobreviviente_tiene_su_propio_tipo(escenario, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        _enviar_evento(escenario, 'INGRESO', origen=ORIGEN_SOBREVIVIENTES)

    assert NotificacionModel.objects.get(
        destinatario_cedula=ANALISTA).tipo == 'movimiento.sobreviviente'
    # El trabajador (sobreviviente) tampoco recibe: su cuenta aún no existe.
    assert not NotificacionModel.objects.filter(destinatario_cedula=TRABAJADOR).exists()


def test_los_avisos_son_idempotentes_por_movimiento(escenario, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        _enviar_evento(escenario, 'TRASLADO')

    movimiento = consultar_historial(escenario['repo'], {}, Paginacion()).resultados[0]
    notificar_movimiento(movimiento, 'TRASLADO')

    assert NotificacionModel.objects.filter(destinatario_cedula=ANALISTA).count() == 1
    assert NotificacionModel.objects.filter(destinatario_cedula=TRABAJADOR).count() == 1


def test_el_trabajador_que_tambien_recibe_avisos_de_rrhh_recibe_los_dos(
    escenario, django_capture_on_commit_callbacks
):
    """G12-1: la clave del aviso al trabajador es propia y no se descarta.

    La campana deduplica por (destinatario, clave) sin mirar el módulo. Si el
    trabajador también tiene `personal.recibir_avisos_movimientos` (un ANALISTA,
    por ejemplo), su aviso de `autogestion` debe sobrevivir al de `personal`.
    """
    CuentaModel.objects.filter(cedula_id=TRABAJADOR).update(rol_id=escenario['rol'].pk)

    with django_capture_on_commit_callbacks(execute=True):
        _enviar_evento(escenario, 'TRASLADO')

    avisos = NotificacionModel.objects.filter(destinatario_cedula=TRABAJADOR)
    assert avisos.count() == 2
    assert {a.modulo for a in avisos} == {'personal', 'autogestion'}
    assert len({a.clave_unica for a in avisos}) == 2

    # La idempotencia se mantiene: reprocesar el mismo movimiento no duplica.
    movimiento = consultar_historial(escenario['repo'], {}, Paginacion()).resultados[0]
    notificar_movimiento(movimiento, 'TRASLADO')
    assert NotificacionModel.objects.filter(destinatario_cedula=TRABAJADOR).count() == 2


def test_un_movimiento_no_notifica_al_rol_administrador(
    escenario, django_capture_on_commit_callbacks
):
    """G12-9: tras el seed, el rol ADMINISTRADOR no recibe avisos de movimientos."""
    RolModel.objects.create(id=1, nombre_rol='ADMINISTRADOR')
    call_command('seed_permisos', '--no-invalidar-sesiones', stdout=StringIO())

    admin = EmployeeModel.objects.create(
        cedulaidentidad='V70000009',
        nombres='Admin',
        apellidos='Sistema',
        fecha_nacimiento=datetime.date(1980, 1, 1),
        sexoid_id=escenario['trabajador'].sexoid_id,
    )
    CuentaModel.objects.create(cedula=admin, rol_id=1, password='!')

    with django_capture_on_commit_callbacks(execute=True):
        _enviar_evento(escenario, 'TRASLADO')

    assert not NotificacionModel.objects.filter(destinatario_cedula='V70000009').exists()
    assert NotificacionModel.objects.filter(
        destinatario_cedula=ANALISTA, modulo='personal'
    ).exists()
