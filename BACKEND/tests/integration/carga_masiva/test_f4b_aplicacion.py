"""O28-F4-B: aplicación de cargo, salud/tallas y notificación de aprobación."""
import datetime
from unittest.mock import Mock

import pytest

from apps.carga_masiva.infrastructure.aplicacion import (
    _notificar_aprobacion,
    aplicar_carga,
    revertir_carga,
)
from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel, CargaMasivaModel
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CategoriaAlergiaModel,
    CategoriaDiscapacidadModel,
    CategoriaPatologiaModel,
    DiscapacidadModel,
    PatologiaCronicaModel,
    RegionTallaModel,
    TallaModel,
    TipoPrendaModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    PerfilFisicoModel,
    PerfilSaludModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


@pytest.fixture
def datos():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo = SexoModel.objects.create(sexo='M')
    activo = EstatusModel.objects.create(estatus='ACTIVO')
    EstatusModel.objects.create(estatus='VACANTE')
    nomina = TipoNominaModel.objects.create(nomina='CONTRATADO', es_activo=True)
    tipo_personal = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    cargo_esp = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    dep = DependenciaModel.objects.create(Codigo='D1', dependencia='CONATEL')
    direccion = DireccionGeneralModel.objects.create(
        Codigo='DG1', direccion_general='GESTION HUMANA', dependenciaId=dep,
    )
    empleado = EmployeeModel.objects.create(
        cedulaidentidad='99000400', nombres='ANA', apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1), sexoid=sexo, total_anos_apn=0,
    )
    vacante = AsigTrabajoModel.objects.create(
        codigo='C-200', denominacioncargoid=cargo, denominacioncargoespecificoid=cargo_esp,
        tiponominaid=nomina, estatusid=activo, Dependencia=dep, DireccionGeneral=direccion,
        Tipo_personal=tipo_personal,
    )
    region = RegionTallaModel.objects.create(codigo='R1', descripcion='NACIONAL')
    camisa = TipoPrendaModel.objects.create(categoria='CAMISA')
    pantalon = TipoPrendaModel.objects.create(categoria='PANTALON')
    zapato = TipoPrendaModel.objects.create(categoria='ZAPATO')
    tallas = {
        'camisa': TallaModel.objects.create(valor='M', region=region, tipo_prenda=camisa),
        'pantalon': TallaModel.objects.create(valor='34', region=region, tipo_prenda=pantalon),
        'zapato': TallaModel.objects.create(valor='42', region=region, tipo_prenda=zapato),
    }
    cat_disc = CategoriaDiscapacidadModel.objects.create(nombre_categoria='FISICA')
    disc = DiscapacidadModel.objects.create(discapacidad='MOTORA', categoria=cat_disc)
    cat_alergia = CategoriaAlergiaModel.objects.create(nombre_categoria='MEDICAMENTO')
    alergia = AlergiaModel.objects.create(alergia='PENICILINA', categoria=cat_alergia)
    cat_pat = CategoriaPatologiaModel.objects.create(nombre_categoria='CRONICA')
    patologia = PatologiaCronicaModel.objects.create(patologia='ASMA', categoria=cat_pat)
    return {
        'empleado': empleado, 'vacante': vacante, 'tallas': tallas, 'sexo': sexo,
        'discapacidad': disc, 'alergia': alergia, 'patologia': patologia,
    }


def _carga(datos_rows):
    carga = CargaMasivaModel.objects.create(
        archivo_nombre='f4b.xlsx', tipos=sorted({f['tipo'] for f in datos_rows}),
        solicitada_por_cedula='1', estado=CargaMasivaModel.Estado.ANALIZADA,
    )
    for indice, datos_fila in enumerate(datos_rows, start=1):
        CargaMasivaFilaModel.objects.create(
            carga=carga, hoja=datos_fila['tipo'], tipo=datos_fila['tipo'],
            numero_fila=indice, estado=CargaMasivaFilaModel.Estado.NUEVO,
            datos=datos_fila['datos'], anteriores={},
        )
    return carga


def test_aplica_cargo_via_movimientos_y_crea_antecedente(datos):
    carga = _carga([{
        'tipo': 'cargo_asignacion',
        'datos': {
            'cedula': '99000400',
            'denominacion_id': 'ANALISTA',
            'especifica_id': 'ANALISTA I',
            'dependencia_id': 'CONATEL',
            'direccion_general_id': 'GESTION HUMANA',
            'tipo_nomina_id': 'CONTRATADO',
            'fecha_ingreso': '2026-01-02',
        },
    }])
    aplicar_carga(carga, '1')
    fila = carga.filas.first()
    assert fila.aplicada, fila.error_aplicacion
    creada = AsigTrabajoModel.objects.get(employee_id='99000400')
    assert creada.codigo != datos['vacante'].codigo
    assert creada.denominacioncargoid.cargo == 'ANALISTA'
    assert creada.estatusid.estatus == 'ACTIVO'
    assert AsigTrabajoModel.objects.get(pk=datos['vacante'].pk).employee_id is None
    assert datos['empleado'].antecedentes_servicio.filter(fecha_ingreso='2026-01-02').exists()


def test_revertir_carga_elimina_el_cargo_creado(datos):
    carga = _carga([{
        'tipo': 'cargo_asignacion',
        'datos': {
            'cedula': '99000400',
            'denominacion_id': 'ANALISTA',
            'especifica_id': 'ANALISTA I',
            'dependencia_id': 'CONATEL',
            'direccion_general_id': 'GESTION HUMANA',
            'tipo_nomina_id': 'CONTRATADO',
            'fecha_ingreso': '2026-01-02',
        },
    }])
    aplicar_carga(carga, '1')
    creada = AsigTrabajoModel.objects.get(employee_id='99000400')
    codigo = creada.codigo
    revertir_carga(carga)
    assert not AsigTrabajoModel.objects.filter(codigo=codigo).exists()
    assert not datos['empleado'].antecedentes_servicio.filter(fecha_ingreso='2026-01-02').exists()


def test_aplica_salud_y_tallas(datos):
    carga = _carga([{
        'tipo': 'salud_tallas',
        'datos': {
            'cedula': '99000400',
            'discapacidad_id': 'MOTORA',
            'alergia_id': 'PENICILINA',
            'patologia_id': 'ASMA',
            'talla_camisa': 'M',
            'talla_pantalon': '34',
            'talla_zapato': '42',
        },
    }])
    aplicar_carga(carga, '1')
    perfil = PerfilSaludModel.objects.get(empleado_id=datos['empleado'].pk)
    assert perfil.discapacidad.filter(discapacidad='MOTORA').exists()
    assert perfil.alergias.filter(alergia='PENICILINA').exists()
    assert perfil.patologiaCronica.filter(patologia='ASMA').exists()
    fisico = PerfilFisicoModel.objects.get(empleado_id=datos['empleado'].pk)
    assert fisico.tallaCamisa.valor == 'M'
    assert fisico.tallaPantalon.valor == '34'
    assert fisico.tallaZapatos.valor == '42'


def test_genera_cedula_del_hijo_menor_en_carga(datos):
    parentesco = ParentescoModel.objects.create(descripcion_parentesco='HIJO (A)')
    carga = _carga([{
        'tipo': 'familiares',
        'datos': {
            'cedula_titular': '99000400', 'nombres': 'LUCIA', 'apellidos': 'PEREZ',
            'parentesco_id': 'HIJO (A)', 'fecha_nacimiento': '2022-01-01',
            'sexo_id': 'M', 'orden_hijo': 1,
        },
    }])
    aplicar_carga(carga, '1')
    familiar = EmployeefamilyModel.objects.get(employeecedula_id='99000400')
    assert familiar.cedulaFamiliar == '99000400-1'
    assert familiar.orden_hijo == 1


def test_notifica_al_aprobador_y_excluye_al_solicitante(datos, monkeypatch):
    carga = CargaMasivaModel.objects.create(
        archivo_nombre='pendiente.xlsx', tipos=['salud_tallas'],
        solicitada_por_cedula='99000400', filas_validas=2,
        estado=CargaMasivaModel.Estado.PENDIENTE_APROBACION,
    )
    notificador = Mock()
    monkeypatch.setattr(
        'apps.carga_masiva.infrastructure.aplicacion.obtener_notificador',
        lambda: notificador,
    )
    _notificar_aprobacion(carga)
    solicitud = notificador.notificar.call_args.args[0]
    assert solicitud.permiso_destino == 'personal.carga_masiva_aprobar'
    assert solicitud.excluir_cedulas == ('99000400',)
    assert solicitud.ref_id == str(carga.id)
