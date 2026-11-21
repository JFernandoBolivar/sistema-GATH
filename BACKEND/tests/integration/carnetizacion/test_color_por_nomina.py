"""El carnet toma el color y la plantilla según el tipo de nómina del titular (K-11).

Antes el PDF nunca recibía la nómina: todos los carnets salían con el color de
Funcionario (azul marino) aunque la plantilla tuviera reglas por nómina, y la regla de
uso de cada plantilla (p. ej. «nómina = CONTRATADO») se ignoraba al emitir.
"""
import importlib
import uuid

import pytest
from django.apps import apps as apps_vivas
from django.db import connection
from pdf2image import convert_from_bytes

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.carnetizacion.domain.services.plantilla_defecto import plantilla_defecto_trabajador
from apps.carnetizacion.domain.services.resolver_color import resolver_color_carnet, valor_segun_criterio
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    MotivosEmisionModel,
    PlantillaCarnetModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.models.credencial_externa_model import CredencialExternaModel
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import _normalizar_datos
from apps.carnetizacion.infrastructure.repositories import repo_carnetizacion_comun as comun
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import CarnetEmitidoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

m0021 = importlib.import_module('apps.carnetizacion.migrations.0021_retirar_tipo_autoridad')

AMARILLO_CONTRATADO = '#f2b705'
ROJO_OBRERO = '#b3122b'
AZUL_FUNCIONARIO = '#14284b'


@pytest.fixture
def titulares(django_db_setup, django_db_blocker, monkeypatch):
    with django_db_blocker.unblock():
        existentes = set(connection.introspection.table_names())
        with connection.schema_editor() as schema:
            for modelo in (MotivosEmisionModel, CarnetEmitidoModel):
                if modelo._meta.db_table not in existentes:
                    schema.create_model(modelo)
    monkeypatch.setattr(comun, 'condicion_titular', lambda empleado: 'ACTIVO')
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANA'})
    MotivosEmisionModel.objects.get_or_create(id=1, defaults={'nombre': 'Primera Emisión'})
    TipoCredencialModel.objects.get_or_create(codigo='trabajador', defaults={'nombre': 'Trabajador'})
    sexo = SexoModel.objects.create(sexo='F')
    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    tipo_personal = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    cargo_esp = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA')
    dep = DependenciaModel.objects.create(Codigo='NA', dependencia='NIVEL DE APOYO')
    dg = DireccionGeneralModel.objects.create(
        Codigo='DG-GH', direccion_general='OFICINA DE GESTION HUMANA', dependenciaId=dep,
    )

    def crear(cedula: str, nomina: str) -> EmployeeModel:
        tipo_nomina, _ = TipoNominaModel.objects.get_or_create(nomina=nomina, defaults={'es_activo': True})
        empleado = EmployeeModel.objects.create(
            cedulaidentidad=cedula, nombres='ANA', apellidos=nomina, sexoid=sexo, nacionalidad_id=1,
        )
        AsigTrabajoModel.objects.create(
            employee=empleado, codigo=f'C-{uuid.uuid4().hex[:12]}',
            denominacioncargoid=cargo, denominacioncargoespecificoid=cargo_esp, tiponominaid=tipo_nomina,
            estatusid=estatus, Tipo_personal=tipo_personal, Dependencia=dep, DireccionGeneral=dg,
        )
        return empleado

    return crear


def _color_franja_superior(pdf: bytes) -> tuple[int, int, int]:
    """Píxel de la franja superior (x=35 mm, y=13 mm), fuera del logo y del acento."""
    with convert_from_bytes(pdf, first_page=1, last_page=1, dpi=150)[0] as img:
        ancho, alto = img.size
        return img.convert('RGB').getpixel((int(ancho * 35 / 54), int(alto * 13 / 85.6)))


def _hex(rgb: tuple[int, int, int]) -> str:
    return '#%02x%02x%02x' % rgb


def _cerca(rgb: tuple[int, int, int], esperado: str, tolerancia: int = 6) -> bool:
    e = tuple(int(esperado[i:i + 2], 16) for i in (1, 3, 5))
    return all(abs(a - b) <= tolerancia for a, b in zip(rgb, e))


@pytest.mark.parametrize('nomina, color', [
    ('CONTRATADO', AMARILLO_CONTRATADO),
    ('OBRERO FIJO', ROJO_OBRERO),
    ('FUNCIONARIO', AZUL_FUNCIONARIO),
])
def test_el_carnet_emitido_lleva_el_color_de_su_nomina(titulares, nomina, color):
    titulares('8810001', nomina)
    repo = RepoCarnetizacionORM()
    carnet = repo.emitir_carnet('8810001', 1)

    fila = CarnetEmitidoModel.objects.select_related('employee').get(pk=carnet.id)
    datos, definicion = repo._datos_y_definicion_de_carnet(fila)
    assert datos.nomina == nomina
    assert resolver_color_carnet(definicion, _normalizar_datos(datos)[0])['primario'] == color

    franja = _color_franja_superior(repo.generar_pdf(carnet.id))
    assert _cerca(franja, color), f'{nomina}: franja {_hex(franja)}, se esperaba {color}'


def test_la_vista_previa_usa_la_nomina_del_titular(titulares):
    titulares('8810002', 'CONTRATADO')
    datos = RepoCarnetizacionORM()._datos_titular_vista_previa(EmployeeModel.objects.get(cedulaidentidad='8810002'))
    assert datos.nomina == 'CONTRATADO'
    assert datos.nivel == 'NIVEL DE APOYO'


def _plantilla(nombre, criterio, valor):
    definicion = plantilla_defecto_trabajador()
    return PlantillaCarnetModel.objects.create(
        nombre=nombre, tipo_credencial_id='trabajador', estado='publicada', activa=True, version=1,
        regla_criterio=criterio, regla_valor=valor, definicion=definicion,
    )


def test_al_emitir_gana_la_plantilla_cuya_regla_coincide_con_el_titular(titulares):
    generica = _plantilla('Institucional', 'nomina', '*')
    contratados = _plantilla('Solo contratados', 'nomina', 'Contratado')
    titulares('8810003', 'CONTRATADO')
    titulares('8810004', 'FUNCIONARIO')
    repo = RepoCarnetizacionORM()

    assert str(repo.emitir_carnet('8810003', 1).plantilla_id) == str(contratados.id)
    assert str(repo.emitir_carnet('8810004', 1).plantilla_id) == str(generica.id)


def test_plantilla_vigente_sin_titular_usa_la_generica():
    TipoCredencialModel.objects.get_or_create(codigo='trabajador', defaults={'nombre': 'Trabajador'})
    especifica = _plantilla('Solo obreros', 'nomina', 'OBRERO FIJO')
    generica = _plantilla('Genérica', 'todos', '*')
    assert comun.plantilla_vigente('trabajador') == generica
    assert comun.plantilla_vigente('trabajador', {'nomina': 'obrero fijo'}) == especifica
    assert comun.plantilla_vigente('trabajador', {'nomina': 'PASANTE'}) == generica


def test_valor_segun_criterio():
    persona = {'nomina': 'CONTRATADO', 'cargo': 'ANALISTA', 'oficina': 'OGH', 'nivel': 'APOYO', 'x': '1'}
    assert valor_segun_criterio('nomina', persona) == 'CONTRATADO'
    assert valor_segun_criterio('cargo', persona) == 'ANALISTA'
    assert valor_segun_criterio('unidad', persona) == 'OGH'
    assert valor_segun_criterio('nivel', persona) == 'APOYO'
    assert valor_segun_criterio('otro', persona, 'x') == '1'
    assert valor_segun_criterio('todos', persona) == ''


def _tipo(codigo, grupo='trabajador'):
    TipoCredencialModel.objects.update_or_create(
        codigo=codigo, defaults={'nombre': codigo.title(), 'grupo': grupo, 'activo': True},
    )


def test_0021_borra_autoridad_sin_uso_y_pasa_contratado_y_pasante_a_externos():
    for codigo in ('autoridad', 'contratado', 'pasante'):
        _tipo(codigo)
    m0021.aplicar(apps_vivas, None)
    assert not TipoCredencialModel.objects.filter(codigo='autoridad').exists()
    assert set(TipoCredencialModel.objects.filter(codigo__in=['contratado', 'pasante']).values_list('grupo', flat=True)) == {'externo'}

    m0021.revertir(apps_vivas, None)
    assert TipoCredencialModel.objects.get(codigo='autoridad').activo is True
    assert TipoCredencialModel.objects.get(codigo='contratado').grupo == 'trabajador'


def test_0021_solo_desactiva_autoridad_si_ya_tiene_plantillas():
    _tipo('autoridad')
    PlantillaCarnetModel.objects.create(
        nombre='Autoridades', tipo_credencial_id='autoridad', estado='borrador', definicion={},
    )
    m0021.aplicar(apps_vivas, None)
    assert TipoCredencialModel.objects.get(codigo='autoridad').activo is False
    assert CredencialExternaModel.objects.filter(tipo_credencial_id='autoridad').count() == 0
