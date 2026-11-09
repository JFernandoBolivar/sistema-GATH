"""
Pruebas de integración para antecedentes de servicio en solicitudes de actualización (O37).
- Permiso propio personal.aprobar_antecedentes exigido para decidir cambios de antecedentes.
- AplicadorCambiosORM aplicando CREAR, MODIFICAR y ELIMINAR sobre AntecedenteServicioModel.
- LectorFichaORM resolviendo valores y pertenencia de antecedentes.
"""
from datetime import date
import uuid
import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.autogestion.domain.entities.solicitud_actualizacion import CambioPropuesto, SolicitudActualizacion
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from apps.autogestion.domain.value_objects.secciones import Accion, DecisionCambio, ORIGEN_ACTUALIZACION
from apps.autogestion.infrastructure.repositories.aplicador_cambios_orm import AplicadorCambiosORM
from apps.autogestion.infrastructure.repositories.lector_ficha_orm import LectorFichaORM
from apps.autogestion.infrastructure.repositories.repo_cambios_soportes_orm import RepoCambiosPropuestosORM
from apps.autogestion.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesORM
from apps.autogestion.presentation.views.solicitud_bienestar_views import DecidirView
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class UsuarioFake:
    def __init__(self, cedula: str, permisos: set[str]):
        self.is_authenticated = True
        self.cedula = cedula
        self.cedula_id = cedula
        self.permisos = permisos
        self.pk = 9999
        self.rol_id = 1
        self.permisos_version = 1

    def tiene_permiso(self, codigo: str) -> bool:
        return codigo in self.permisos


@pytest.fixture
def empleado(db):
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='M')
    nacionalidad = NacionalidadModel.objects.first() or NacionalidadModel.objects.create(
        codigo='V', nombre='VENEZOLANA'
    )
    return EmployeeModel.objects.create(
        cedulaidentidad='19876543',
        nombres='CARLOS',
        apellidos='RODRIGUEZ',
        correo='carlos.rodriguez@conatel.gob.ve',
        fecha_nacimiento=date(1988, 5, 20),
        sexoid=sexo,
        nacionalidad=nacionalidad,
    )


@pytest.fixture
def organismo(db):
    return OrganismoAdscritoModel.objects.create(
        Organismoadscrito='MINCI'
    )


@pytest.fixture
def organismo_dos(db):
    return OrganismoAdscritoModel.objects.create(
        Organismoadscrito='CANTV'
    )


@pytest.mark.django_db
def test_aplicador_cambios_crear_modificar_eliminar_antecedente(empleado, organismo, organismo_dos):
    aplicador = AplicadorCambiosORM()
    lector = LectorFichaORM()

    # 1. CREAR antecedente
    cambio_crear = CambioPropuesto(
        id='c-ant-1',
        seccion='antecedentes',
        entidad_destino='antecedente_servicio',
        accion=Accion.CREAR.value,
        campo='*',
        valor_propuesto={'organismo_id': organismo.id, 'fecha_ingreso': '2018-02-01', 'fecha_egreso': '2021-12-15'},
        decision=DecisionCambio.APROBADO,
        referencia='ref-1',
        origen_tipo=ORIGEN_ACTUALIZACION,
        origen_id='origen-test',
    )
    aplicador.aplicar(empleado.cedulaidentidad, [cambio_crear], [], 'actor-1')

    ant = AntecedenteServicioModel.objects.filter(empleado=empleado).first()
    assert ant is not None
    assert ant.organismo_id == organismo.id
    assert ant.fecha_ingreso == date(2018, 2, 1)
    assert ant.fecha_egreso == date(2021, 12, 15)

    # LectorFichaORM verifica el registro creado
    assert lector.pertenece_al_trabajador(empleado.cedulaidentidad, 'antecedente_servicio', str(ant.id)) is True
    assert lector.contar_registros(empleado.cedulaidentidad, 'antecedente_servicio') == 1
    assert lector.valor_actual(empleado.cedulaidentidad, 'antecedente_servicio', str(ant.id), 'organismo_id') == organismo.id

    # 2. MODIFICAR antecedente
    cambio_mod = CambioPropuesto(
        id='c-ant-2',
        seccion='antecedentes',
        entidad_destino='antecedente_servicio',
        accion=Accion.MODIFICAR.value,
        campo='organismo_id',
        valor_propuesto=organismo_dos.id,
        valor_anterior=organismo.id,
        entidad_id=str(ant.id),
        decision=DecisionCambio.APROBADO,
        origen_tipo=ORIGEN_ACTUALIZACION,
        origen_id='origen-test',
    )
    aplicador.aplicar(empleado.cedulaidentidad, [cambio_mod], [], 'actor-1')

    ant.refresh_from_db()
    assert ant.organismo_id == organismo_dos.id

    # 3. ELIMINAR antecedente
    cambio_elim = CambioPropuesto(
        id='c-ant-3',
        seccion='antecedentes',
        entidad_destino='antecedente_servicio',
        accion=Accion.ELIMINAR.value,
        campo='*',
        valor_propuesto={'motivo': 'Registro duplicado o erróneo'},
        entidad_id=str(ant.id),
        decision=DecisionCambio.APROBADO,
        origen_tipo=ORIGEN_ACTUALIZACION,
        origen_id='origen-test',
    )
    aplicador.aplicar(empleado.cedulaidentidad, [cambio_elim], [], 'actor-1')

    assert AntecedenteServicioModel.objects.filter(empleado=empleado).count() == 0
    assert lector.pertenece_al_trabajador(empleado.cedulaidentidad, 'antecedente_servicio', str(ant.id)) is False


@pytest.mark.django_db
def test_decidir_view_exige_permiso_personal_aprobar_antecedentes(empleado, organismo):
    from datetime import datetime, timezone

    repo_sol = RepoSolicitudesORM()
    repo_cambios = RepoCambiosPropuestosORM()

    sol_id = str(uuid.uuid4())
    cambio_id = str(uuid.uuid4())

    sol = SolicitudActualizacion(
        id=sol_id,
        cedula=empleado.cedulaidentidad,
        estado=EstadoSolicitud.ENVIADA,
        secciones_solicitadas=('antecedentes',),
        secciones_habilitadas=('antecedentes',),
        motivo='Deseo registrar mis antecedentes laborales previos',
        ventana_inicio=datetime.now(timezone.utc),
        ventana_fin=datetime.now(timezone.utc),
        version=1,
    )
    sol_guardada = repo_sol.crear(sol)

    cambio = CambioPropuesto(
        id=cambio_id,
        seccion='antecedentes',
        entidad_destino='antecedente_servicio',
        accion=Accion.CREAR.value,
        campo='*',
        valor_propuesto={'organismo_id': organismo.id, 'fecha_ingreso': '2019-03-01', 'fecha_egreso': None},
        origen_tipo=ORIGEN_ACTUALIZACION,
        origen_id=sol_guardada.id,
    )
    repo_cambios.reemplazar(ORIGEN_ACTUALIZACION, sol_guardada.id, [cambio])
    cambio_guardado = repo_cambios.listar(ORIGEN_ACTUALIZACION, sol_guardada.id)[0]

    factory = APIRequestFactory()

    # Usuario con bienestar.aprobar pero SIN personal.aprobar_antecedentes debe ser rechazado con 403
    user_sin_permiso = UsuarioFake('analista-bienestar', {'bienestar.aprobar'})
    req_denegado = factory.post(
        f'/api/v1/autogestion/bienestar/solicitudes/{sol_guardada.id}/decidir/',
        {
            'version': sol_guardada.version,
            'decisiones': [{'cambio_id': cambio_guardado.id, 'aprobado': True}],
        },
        format='json',
    )
    force_authenticate(req_denegado, user=user_sin_permiso)
    view = DecidirView.as_view()
    resp_denegada = view(req_denegado, solicitud_id=sol_guardada.id)
    assert resp_denegada.status_code == 403
    assert 'personal.aprobar_antecedentes' in str(resp_denegada.data)

    # Usuario CON personal.aprobar_antecedentes (ej. JEFE_RRHH o ADMIN) puede decidir
    user_con_permiso = UsuarioFake('jefe-rrhh', {'personal.aprobar_antecedentes'})
    req_aprobado = factory.post(
        f'/api/v1/autogestion/bienestar/solicitudes/{sol_guardada.id}/decidir/',
        {
            'version': sol_guardada.version,
            'decisiones': [{'cambio_id': cambio_guardado.id, 'aprobado': True}],
        },
        format='json',
    )
    force_authenticate(req_aprobado, user=user_con_permiso)
    resp_aprobada = view(req_aprobado, solicitud_id=sol_guardada.id)
    assert resp_aprobada.status_code == 200
    assert AntecedenteServicioModel.objects.filter(empleado=empleado, organismo=organismo).exists()
