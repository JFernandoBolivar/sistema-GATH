import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

from core.domain.exceptions import NotFoundError, ValidationError
from apps.personal.domain.entities.reporte_error import (
    ReporteErrorDatoLaboral,
    DatoLaboralReportado,
    EstadoReporteError,
)
from apps.personal.application.dtos.reporte_error_dtos import (
    CrearReporteErrorDTO,
    AtenderReporteErrorDTO,
)
from apps.personal.application.use_cases.reportar_error_laboral import (
    crear_reporte_error_laboral,
)
from apps.personal.application.use_cases.gestionar_reportes_error_laboral import (
    listar_reportes_error_laboral,
    obtener_reporte_error_laboral,
    atender_reporte_error_laboral,
)


class FakeRepoReportesError:
    def __init__(self):
        self.reportes = {}

    def guardar(self, reporte: ReporteErrorDatoLaboral) -> ReporteErrorDatoLaboral:
        self.reportes[reporte.id] = reporte
        return reporte

    def obtener_por_id(self, reporte_id):
        return self.reportes.get(reporte_id)

    def listar(
        self,
        trabajador_cedula=None,
        estado=None,
        dato=None,
        texto_busqueda=None,
        limite=50,
        desplazamiento=0,
    ):
        items = list(self.reportes.values())
        if trabajador_cedula:
            items = [r for r in items if r.trabajador_cedula == trabajador_cedula]
        if estado:
            items = [r for r in items if r.estado.value == estado]
        if dato:
            items = [r for r in items if r.dato.value == dato]
        if texto_busqueda:
            texto = texto_busqueda.lower()
            items = [
                r for r in items
                if texto in r.descripcion.lower() or texto in r.trabajador_nombre.lower()
            ]
        return items[desplazamiento:desplazamiento + limite], len(items)


def test_crear_reporte_exitoso_y_notifica():
    repo = FakeRepoReportesError()
    mock_notificador = MagicMock()

    dto = CrearReporteErrorDTO(
        trabajador_cedula='12345678',
        dato='cargo',
        descripcion='El cargo actual que figura en el sistema no corresponde con mi designacion.',
    )

    resultado = crear_reporte_error_laboral(
        repo=repo,
        dto=dto,
        trabajador_nombre='Juan Perez',
        notificador_fn=mock_notificador,
    )

    assert resultado.id is not None
    assert resultado.trabajador_cedula == '12345678'
    assert resultado.trabajador_nombre == 'Juan Perez'
    assert resultado.dato == DatoLaboralReportado.CARGO
    assert resultado.estado == EstadoReporteError.PENDIENTE
    assert resultado.descripcion == dto.descripcion
    assert resultado.atendido_por_id is None

    # Verifica persistencia
    assert repo.obtener_por_id(resultado.id) is not None

    # Verifica notificación a RRHH
    mock_notificador.assert_called_once()
    solicitud_notif = mock_notificador.call_args[0][0]
    assert solicitud_notif.permiso_destino == 'personal.reportes_error_ver'
    assert 'cargo' in solicitud_notif.titulo.lower() or 'error' in solicitud_notif.titulo.lower()


def test_crear_reporte_rechaza_descripcion_muy_corta():
    repo = FakeRepoReportesError()
    dto = CrearReporteErrorDTO(
        trabajador_cedula='12345678',
        dato='oficina',
        descripcion='Corta',  # < 10 chars
    )

    with pytest.raises(ValidationError, match='entre 10 y 500'):
        crear_reporte_error_laboral(repo=repo, dto=dto, trabajador_nombre='Juan')


def test_crear_reporte_rechaza_descripcion_muy_larga():
    repo = FakeRepoReportesError()
    dto = CrearReporteErrorDTO(
        trabajador_cedula='12345678',
        dato='oficina',
        descripcion='X' * 501,
    )

    with pytest.raises(ValidationError, match='entre 10 y 500'):
        crear_reporte_error_laboral(repo=repo, dto=dto, trabajador_nombre='Juan')


def test_crear_reporte_rechaza_dato_invalido():
    repo = FakeRepoReportesError()
    dto = CrearReporteErrorDTO(
        trabajador_cedula='12345678',
        dato='sueldo_falso',
        descripcion='Texto suficientemente largo para validar.',
    )

    with pytest.raises(ValidationError, match='Dato laboral'):
        crear_reporte_error_laboral(repo=repo, dto=dto, trabajador_nombre='Juan')


def test_listar_reportes_con_filtros():
    repo = FakeRepoReportesError()
    ahora = datetime.now(timezone.utc)
    r1 = ReporteErrorDatoLaboral(
        id=uuid4(),
        trabajador_cedula='10000001',
        trabajador_nombre='Trabajador 1',
        dato=DatoLaboralReportado.CARGO,
        descripcion='Descripcion valida numero uno.',
        estado=EstadoReporteError.PENDIENTE,
        creado_el=ahora,
        actualizado_el=ahora,
    )
    r2 = ReporteErrorDatoLaboral(
        id=uuid4(),
        trabajador_cedula='20000002',
        trabajador_nombre='Trabajador 2',
        dato=DatoLaboralReportado.OFICINA,
        descripcion='Descripcion valida numero dos.',
        estado=EstadoReporteError.PENDIENTE,
        creado_el=ahora,
        actualizado_el=ahora,
    )
    repo.guardar(r1)
    repo.guardar(r2)

    # Filtrar por trabajador
    items, total = listar_reportes_error_laboral(repo=repo, trabajador_cedula='10000001')
    assert total == 1
    assert items[0].id == r1.id

    # Filtrar por dato
    items, total = listar_reportes_error_laboral(repo=repo, dato='oficina')
    assert total == 1
    assert items[0].id == r2.id


def test_atender_reporte_exitoso():
    repo = FakeRepoReportesError()
    ahora = datetime.now(timezone.utc)
    r = ReporteErrorDatoLaboral(
        id=uuid4(),
        trabajador_cedula='10000001',
        trabajador_nombre='Trabajador 1',
        dato=DatoLaboralReportado.FECHA_INGRESO,
        descripcion='Mi fecha de ingreso es el 15/01/2020 y no 15/01/2021.',
        estado=EstadoReporteError.PENDIENTE,
        creado_el=ahora,
        actualizado_el=ahora,
    )
    repo.guardar(r)

    dto = AtenderReporteErrorDTO(
        reporte_id=r.id,
        funcionario_id=99,
        funcionario_cedula='99999999',
        funcionario_nombre='Analista RRHH',
        observacion='Corregido en el sistema de personal.',
    )
    resultado = atender_reporte_error_laboral(repo=repo, dto=dto)

    assert resultado.estado == EstadoReporteError.ATENDIDO
    assert resultado.atendido_por_id == 99
    assert resultado.observacion_atencion == 'Corregido en el sistema de personal.'
    assert resultado.atendido_el is not None


def test_atender_reporte_ya_atendido_falla():
    repo = FakeRepoReportesError()
    ahora = datetime.now(timezone.utc)
    r = ReporteErrorDatoLaboral(
        id=uuid4(),
        trabajador_cedula='10000001',
        trabajador_nombre='Trabajador 1',
        dato=DatoLaboralReportado.OTRO,
        descripcion='Otro dato incorrecto en el expediente.',
        estado=EstadoReporteError.PENDIENTE,
        creado_el=ahora,
        actualizado_el=ahora,
    )
    repo.guardar(r)

    dto = AtenderReporteErrorDTO(
        reporte_id=r.id,
        funcionario_id=99,
        funcionario_cedula='99999999',
        funcionario_nombre='Analista RRHH',
    )
    atender_reporte_error_laboral(repo=repo, dto=dto)

    with pytest.raises(ValidationError, match='ya se encuentra atendido'):
        atender_reporte_error_laboral(repo=repo, dto=dto)


def test_atender_reporte_inexistente_falla():
    repo = FakeRepoReportesError()
    dto = AtenderReporteErrorDTO(
        reporte_id=uuid4(),
        funcionario_id=99,
        funcionario_cedula='99999999',
        funcionario_nombre='Analista RRHH',
    )

    with pytest.raises(NotFoundError, match='no encontrado'):
        atender_reporte_error_laboral(repo=repo, dto=dto)
