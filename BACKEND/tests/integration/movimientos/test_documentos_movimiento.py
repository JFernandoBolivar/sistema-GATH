"""Regresión de documentos automáticos después de confirmar un movimiento."""

import hashlib
from types import SimpleNamespace

import pytest
from django.db import transaction

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.documentos.infrastructure import almacen as almacen_mod
from apps.documentos.infrastructure.models.documentos_models import (
    DocumentoGeneradoModel,
    PlantillaDocumentoModel,
    VersionPlantillaDocumentoModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.movimientos.domain.ports.generador_documentos_movimiento import (
    DocumentoGeneradoMovimiento,
    PlantillaDocumentoMovimiento,
)
from apps.movimientos.infrastructure import generacion_documentos_movimiento as generacion_mod
from apps.movimientos.infrastructure import receivers
from apps.movimientos.infrastructure.generacion_documentos_movimiento import (
    generar_documentos_despues_de_commit,
)
from apps.movimientos.infrastructure.generador_documentos_movimiento import (
    GeneradorDocumentosMovimientoExternos,
)
from apps.movimientos.infrastructure.repositories.repo_documentos_movimiento_orm import (
    RepoDocumentosMovimientoORM,
)
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.documentos.conftest import AlmacenMemoria
from tests.unit.documentos._ayudas import texto_de

pytestmark = pytest.mark.django_db

TRABAJADOR = 'V81000001'
ANALISTA = 'V81000002'


class GeneradorFalso:
    def __init__(self, plantillas=None, error=None):
        self.plantillas = plantillas if plantillas is not None else [
            PlantillaDocumentoMovimiento('p-1', 'INGRESO', 'Constancia de ingreso'),
        ]
        self.error = error
        self.llamadas = []

    def plantillas_activas(self, proceso):
        self.llamadas.append(('plantillas', proceso))
        return self.plantillas

    def generar_plantilla(self, plantilla_id, **kwargs):
        self.llamadas.append(('generar', plantilla_id, kwargs))
        if self.error:
            raise self.error
        return DocumentoGeneradoMovimiento(
            id=f'doc-{plantilla_id}',
            plantilla_id=plantilla_id,
            sujeto_tipo=kwargs['sujeto_tipo'],
            sujeto_id=kwargs['sujeto_id'],
            datos_snapshot=kwargs['datos'],
            pdf_sha256='a' * 64,
            version_numero=1,
        )


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='F')
    EstatusModel.objects.create(estatus='ACTIVO')
    vacante = EstatusModel.objects.create(estatus='VACANTE')
    nomina = TipoNominaModel.objects.create(nomina='FIJO')
    denominacion = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    especifica = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dependencia = DependenciaModel.objects.create(Codigo='D-DOC', dependencia='GESTION HUMANA')
    direccion = DireccionGeneralModel.objects.create(
        Codigo='DG-DOC', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dependencia,
    )
    personal = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    trabajador = EmployeeModel.objects.create(
        cedulaidentidad=TRABAJADOR, nombres='Ana', apellidos='Perez', sexoid=sexo,
    )
    analista = EmployeeModel.objects.create(
        cedulaidentidad=ANALISTA, nombres='Analista', apellidos='Rrhh', sexoid=sexo,
    )
    rol = RolModel.objects.create(nombre_rol='ANALISTA RRHH DOC')
    cuenta = CuentaModel.objects.create(cedula=analista, rol=rol, password='!')
    cargo = AsigTrabajoModel.objects.create(
        codigo='COD-DOC-1',
        employee=None,
        denominacioncargoid=denominacion,
        denominacioncargoespecificoid=especifica,
        tiponominaid=nomina,
        estatusid=vacante,
        Tipo_personal=personal,
        Dependencia=dependencia,
        DireccionGeneral=direccion,
    )
    return {'cargo': cargo, 'cuenta': cuenta, 'trabajador': trabajador}


@pytest.fixture
def generador(monkeypatch):
    falso = GeneradorFalso()
    monkeypatch.setattr(generacion_mod, 'GeneradorDocumentosMovimientoExternos', lambda: falso)
    monkeypatch.setattr(receivers, 'notificar_movimiento', lambda *args: None)
    return falso


def _asignar(escenario):
    return RepoCargosORM().asignar_cargo_a_empleado(
        escenario['cargo'].pk, TRABAJADOR, usuario_id=escenario['cuenta'].pk,
    )


def test_movimiento_ejecutado_genera_documento_solo_despues_del_commit(escenario, generador, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        with transaction.atomic():
            _asignar(escenario)
            assert generador.llamadas == []

    movimiento = EmployeeMovementHistoryModel.objects.get(empleado__cedulaidentidad=TRABAJADOR)
    assert movimiento.tipo_movimiento == 'INGRESO'
    assert generador.llamadas[0] == ('plantillas', 'movimiento:ingreso')
    llamada = generador.llamadas[1]
    assert llamada[0] == 'generar' and llamada[1] == 'p-1'
    datos = llamada[2]['datos']
    assert llamada[2]['estricto'] is False
    assert datos['movimiento_id'] == movimiento.pk
    assert datos['nombre_completo'] == 'PEREZ ANA'
    assert datos['destino'] == 'COD-DOC-1 - ANALISTA - OFICINA DE GESTION HUMANA'
    assert datos['numero'] == str(movimiento.pk)


def test_movimiento_genera_un_pdf_real_con_snapshot_y_sha256(escenario, monkeypatch, django_capture_on_commit_callbacks):
    memoria = AlmacenMemoria()
    monkeypatch.setattr(almacen_mod, 'obtener_almacen', lambda: memoria)
    monkeypatch.setattr(receivers, 'notificar_movimiento', lambda *args: None)
    definicion = {
        'pagina': {'tamano': 'carta', 'orientacion': 'vertical'},
        'encabezado': {'tipo': 'ninguno', 'titulo': '', 'subtitulo': ''},
        'bloques': [{
            'id': 'texto', 'tipo': 'parrafo', 'alineacion': 'justificado',
            'texto': 'Ingreso de {nombre_completo}. Destino: {destino}.',
        }],
    }
    plantilla = PlantillaDocumentoModel.objects.create(
        codigo='INGRESO_REAL', nombre='Constancia real de ingreso', modo='formulario',
        proceso='movimiento:ingreso', activa=True, ultima_version=1, definicion=definicion,
    )
    VersionPlantillaDocumentoModel.objects.create(
        plantilla=plantilla, numero=1, modo='formulario', definicion=definicion,
        definicion_sha256='d' * 64, metadatos={'proceso': 'movimiento:ingreso'},
    )

    with django_capture_on_commit_callbacks(execute=True):
        _asignar(escenario)

    documento = DocumentoGeneradoModel.objects.get(plantilla=plantilla)
    pdf = memoria.descargar(documento.pdf_clave)
    assert documento.pdf_sha256 == hashlib.sha256(pdf).hexdigest()
    assert documento.trabajador_cedula == TRABAJADOR
    assert int(documento.datos_snapshot['movimiento_id']) > 0
    assert documento.datos_snapshot['nombre_completo'] == 'PEREZ ANA'
    texto = ' '.join(texto_de(pdf).split())
    assert 'Ingreso de PEREZ ANA.' in texto
    assert 'Destino: COD-DOC-1 - ANALISTA - OFICINA DE GESTION HUMANA.' in texto


def test_sin_plantillas_no_genera_documentos_ni_audita_error(escenario, generador, monkeypatch, django_capture_on_commit_callbacks):
    generador.plantillas = []

    class ProveedorProhibido:
        def datos_de(self, *args, **kwargs):
            raise AssertionError('sin plantillas no se consulta el trabajador')

    monkeypatch.setattr(generacion_mod, 'ProveedorTrabajadorMovimientoORM', ProveedorProhibido)
    with django_capture_on_commit_callbacks(execute=True):
        _asignar(escenario)

    assert EmployeeMovementHistoryModel.objects.filter(empleado__cedulaidentidad=TRABAJADOR).count() == 1
    assert generador.llamadas == [('plantillas', 'movimiento:ingreso')]
    assert not AuditoriaLog.objects.filter(accion=generacion_mod.ACCION_AUDITORIA).exists()


def test_fallo_documental_deja_movimiento_persistido_y_registra_bitacora(escenario, generador, django_capture_on_commit_callbacks):
    generador.error = RuntimeError('motor documental no disponible')

    with django_capture_on_commit_callbacks(execute=True):
        _asignar(escenario)

    movimiento = EmployeeMovementHistoryModel.objects.get(empleado__cedulaidentidad=TRABAJADOR)
    escenario['cargo'].refresh_from_db()
    assert escenario['cargo'].employee_id == TRABAJADOR
    bitacora = AuditoriaLog.objects.get(accion=generacion_mod.ACCION_AUDITORIA)
    assert bitacora.resultado == AuditoriaLog.Resultado.FAILED
    assert bitacora.actor_id == escenario['cuenta'].pk
    assert bitacora.recurso_tipo == 'movimiento'
    assert bitacora.recurso_id == str(movimiento.pk)
    assert bitacora.estado_nuevo['proceso'] == 'movimiento:ingreso'
    assert bitacora.estado_nuevo['error'] == 'motor documental no disponible'


class ServicioExternoFalso:
    """Persiste el documento para comprobar la idempotencia del adaptador."""

    def __init__(self, plantilla, version):
        self.plantilla = plantilla
        self.version = version
        self.llamadas = []

    def plantillas_activas(self, proceso):
        return [SimpleNamespace(id=self.plantilla.pk, codigo=self.plantilla.codigo, nombre=self.plantilla.nombre)]

    def generar_plantilla(self, plantilla_id, **kwargs):
        self.llamadas.append((plantilla_id, kwargs))
        datos = kwargs['datos']
        fila = DocumentoGeneradoModel.objects.create(
            plantilla=self.plantilla,
            version=self.version,
            sujeto_tipo=kwargs['sujeto_tipo'],
            sujeto_id=kwargs['sujeto_id'],
            datos_snapshot=datos,
            pdf_clave=f'documentos/{self.plantilla.pk}.pdf',
            pdf_sha256='b' * 64,
            generado_por_id=kwargs['actor_id'],
            trabajador_cedula=kwargs['trabajador_cedula'],
            plantilla_codigo=self.plantilla.codigo,
            plantilla_nombre=self.plantilla.nombre,
            proceso='movimiento:ingreso',
            proceso_etiqueta='Movimiento: ingreso',
        )
        return SimpleNamespace(
            id=fila.pk,
            plantilla_id=fila.plantilla_id,
            sujeto_tipo=fila.sujeto_tipo,
            sujeto_id=fila.sujeto_id,
            datos_snapshot=fila.datos_snapshot,
            pdf_sha256=fila.pdf_sha256,
            version_numero=self.version.numero,
        )


def test_reintento_no_duplica_y_el_historial_expone_metadata_con_enlace(escenario):
    plantilla = PlantillaDocumentoModel.objects.create(
        codigo='MOV-INGRESO', nombre='Constancia de ingreso', modo='formulario',
        proceso='movimiento:ingreso', activa=True, ultima_version=1,
    )
    version = VersionPlantillaDocumentoModel.objects.create(
        plantilla=plantilla, numero=1, modo='formulario', definicion={}, definicion_sha256='c' * 64,
        metadatos={'proceso': 'movimiento:ingreso'},
    )
    movimiento = RepoMovimientosORM().registrar_movimiento(
        cargo_id=escenario['cargo'].pk,
        cedula=TRABAJADOR,
        tipo_movimiento='INGRESO',
        motivo_id=None,
        usuario_id=escenario['cuenta'].pk,
    )
    servicio = ServicioExternoFalso(plantilla, version)
    adaptador = GeneradorDocumentosMovimientoExternos(servicio=servicio)

    generar_documentos_despues_de_commit(
        movimiento, 'movimiento:ingreso', generador=adaptador,
    )
    generar_documentos_despues_de_commit(
        movimiento, 'movimiento:ingreso', generador=adaptador,
    )

    assert len(servicio.llamadas) == 1
    assert DocumentoGeneradoModel.objects.filter(
        plantilla=plantilla, datos_snapshot__movimiento_id=movimiento.id,
    ).count() == 1
    metadata = RepoDocumentosMovimientoORM().para_movimientos([movimiento])[movimiento.id]
    assert len(metadata) == 1
    assert metadata[0]['nombre'] == 'Constancia de ingreso'
    assert metadata[0]['proceso'] == 'movimiento:ingreso'
    assert metadata[0]['version'] == 1
    assert metadata[0]['sha'] == 'b' * 64
    assert metadata[0]['url'].endswith(f'/api/v1/documentos/generados/{metadata[0]["id"]}/archivo/')
    assert metadata[0]['detalle_url'].endswith(f'/api/v1/documentos/generados/{metadata[0]["id"]}/')
