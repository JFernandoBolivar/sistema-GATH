"""Campos personalizados del carnet: origen del dato (lista cerrada), permiso propio y valor en el PDF."""
import datetime
from types import SimpleNamespace

import pytest
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.carnetizacion.domain.entities.campo_credencial import ORIGENES_CAMPO_PERSONALIZADO
from apps.carnetizacion.domain.value_objects.security_hash import generar_codigo_qr
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CampoPersonalizadoModel,
    CarnetEmitidoModel,
    MotivosEmisionModel,
)
from apps.carnetizacion.infrastructure.pdf import carnet_pdf
from apps.carnetizacion.infrastructure.pdf.carnet_pdf import DatosCarnetPdf, generar_carnet_pdf_fiel
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.carnetizacion.infrastructure.resolver_origen_campos import valores_campos_personalizados
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.identidad.management.commands.seed_permisos import PERMISOS_CATALOGO, ROL_ASIGNACIONES
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db

CAMPOS = '/api/v1/carnetizacion/campos/'
PERMISO = 'carnetizacion.campos_personalizados'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos):
        self.pk = 1
        self.id = None
        self.cedula_id = 'V-1'
        self.rol_id = None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


def _cuerpo(**extra):
    base = {'codigo': 'tel_contacto', 'etiqueta': 'Teléfono de contacto', 'origen': 'telefono_movil'}
    base.update(extra)
    return base


def test_origenes_cerrados_son_los_diez_acordados():
    assert set(ORIGENES_CAMPO_PERSONALIZADO) == {
        'tipo_sangre', 'telefono_movil', 'correo_acceso', 'correo_alternativo', 'fecha_ingreso',
        'nivel', 'tipo_nomina', 'sexo', 'fecha_nacimiento', 'nacionalidad',
    }


def test_crear_con_origen_valido_lo_guarda_y_lo_lista():
    api = _cliente(PERMISO, 'carnetizacion.ver')
    r = api.post(f'{CAMPOS}personalizados/', _cuerpo(), format='json')
    assert r.status_code == 201, r.content
    assert r.json()['data']['origen'] == 'telefono_movil'
    assert CampoPersonalizadoModel.objects.get(codigo='tel_contacto').origen == 'telefono_movil'
    listado = _cliente('carnetizacion.ver').get(CAMPOS).json()['data']
    assert next(c for c in listado if c['codigo'] == 'tel_contacto')['origen'] == 'telefono_movil'


@pytest.mark.parametrize('origen', ['salario', 'cedula', ''])
def test_origen_invalido_da_400(origen):
    r = _cliente(PERMISO).post(f'{CAMPOS}personalizados/', _cuerpo(origen=origen), format='json')
    assert r.status_code == 400, r.content
    assert not CampoPersonalizadoModel.objects.filter(codigo='tel_contacto').exists()


def test_crear_sin_origen_da_400():
    cuerpo = _cuerpo()
    del cuerpo['origen']
    assert _cliente(PERMISO).post(f'{CAMPOS}personalizados/', cuerpo, format='json').status_code == 400


def test_sin_permiso_crear_editar_y_eliminar_dan_403_aunque_pueda_disenar():
    CampoPersonalizadoModel.objects.create(codigo='viejo', etiqueta='Viejo')
    api = _cliente('carnetizacion.ver', 'carnetizacion.disenar')
    assert api.post(f'{CAMPOS}personalizados/', _cuerpo(), format='json').status_code == 403
    assert api.patch(
        f'{CAMPOS}personalizados/viejo/', {'etiqueta': 'Nuevo', 'origen': 'sexo'}, format='json',
    ).status_code == 403
    assert api.delete(f'{CAMPOS}personalizados/viejo/').status_code == 403
    assert CampoPersonalizadoModel.objects.filter(codigo='viejo', origen='').exists()


def test_consultar_no_exige_el_permiso_nuevo():
    assert _cliente('carnetizacion.ver').get(CAMPOS).status_code == 200


def test_editar_asigna_origen_a_un_campo_viejo():
    CampoPersonalizadoModel.objects.create(codigo='viejo', etiqueta='Viejo')
    api = _cliente(PERMISO)
    assert api.patch(
        f'{CAMPOS}personalizados/viejo/', {'etiqueta': 'Viejo', 'origen': 'invalido'}, format='json',
    ).status_code == 400
    r = api.patch(f'{CAMPOS}personalizados/viejo/', {'etiqueta': 'Sexo', 'origen': 'sexo'}, format='json')
    assert r.status_code == 200, r.content
    campo = CampoPersonalizadoModel.objects.get(codigo='viejo')
    assert (campo.etiqueta, campo.origen) == ('Sexo', 'sexo')


def test_eliminar_con_permiso():
    CampoPersonalizadoModel.objects.create(codigo='viejo', etiqueta='Viejo')
    assert _cliente(PERMISO).delete(f'{CAMPOS}personalizados/viejo/').status_code == 200
    assert not CampoPersonalizadoModel.objects.filter(codigo='viejo').exists()


def test_el_permiso_esta_en_el_catalogo_y_en_el_administrador():
    assert (PERMISO, 'Gestionar campos personalizados del carnet') in PERMISOS_CATALOGO
    assert PERMISO in ROL_ASIGNACIONES[1]


# ─── Valor en el PDF ───

def _empleado():
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'Venezolano'})
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    MotivosEmisionModel.objects.get_or_create(id=1, defaults={'nombre': 'Primera Emisión'})
    return EmployeeModel.objects.create(
        cedulaidentidad='V-4001', nombres='Ana', apellidos='Pérez', sexoid=sexo, nacionalidad_id=1,
        telefono_movil='0414-5550142', correo='ana@conatel.gob.ve', fecha_nacimiento=datetime.date(1985, 4, 12),
    )


def test_resuelve_cada_origen_desde_el_expediente():
    ana = _empleado()
    DatosComplementariosTrabajadorModel.objects.create(cedula=ana.cedulaidentidad, correo_alternativo='ana@gmail.com')
    for codigo, origen in (
        ('c_tel', 'telefono_movil'), ('c_acceso', 'correo_acceso'), ('c_alt', 'correo_alternativo'),
        ('c_sexo', 'sexo'), ('c_nac', 'fecha_nacimiento'), ('c_nacion', 'nacionalidad'),
        ('c_nivel', 'nivel'), ('c_viejo', ''),
    ):
        CampoPersonalizadoModel.objects.create(codigo=codigo, etiqueta=codigo, origen=origen)

    valores = valores_campos_personalizados(ana, None)

    assert valores == {
        'c_tel': '0414-5550142', 'c_acceso': 'ana@conatel.gob.ve', 'c_alt': 'ana@gmail.com',
        'c_sexo': 'FEMENINO', 'c_nac': '12/04/1985', 'c_nacion': 'Venezolano', 'c_nivel': '',
    }  # el campo sin origen no aparece: se imprime vacío


def test_generar_pdf_pasa_el_valor_del_origen_al_documento(monkeypatch):
    ana = _empleado()
    CampoPersonalizadoModel.objects.create(codigo='tel_contacto', etiqueta='Tel', origen='telefono_movil')
    carnet = CarnetEmitidoModel.objects.create(
        employee=ana, security_hash=generar_codigo_qr(), motivo_id=1,
        plantilla_snapshot={'anverso': [], 'reverso': []},
    )
    capturado = {}

    def falso(datos, definicion=None):
        capturado['datos'] = datos
        return b'%PDF'

    monkeypatch.setattr(
        'apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_pdf.generar_carnet_pdf', falso,
    )

    RepoCarnetizacionORM(almacen=SimpleNamespace()).generar_pdf(carnet.pk)

    assert capturado['datos'].campos_extra == {'tel_contacto': '0414-5550142'}


def test_el_pdf_imprime_el_valor_del_campo_personalizado(monkeypatch):
    textos = []
    original = carnet_pdf.ajustar_texto

    def espia(texto, *a, **k):
        textos.append(texto)
        return original(texto, *a, **k)

    monkeypatch.setattr(carnet_pdf, 'ajustar_texto', espia)
    definicion = {
        'ancho_mm': 54.0, 'alto_mm': 85.6, 'reverso': [], 'bg': {},
        'anverso': [
            {'tipo': 'field', 'campo': 'tel_contacto', 'nombre': 'Tel', 'x': 2, 'y': 2, 'w': 40, 'h': 6},
            {'tipo': 'field', 'campo': 'campo_viejo', 'nombre': '', 'x': 2, 'y': 12, 'w': 40, 'h': 6},
        ],
    }
    datos = DatosCarnetPdf(
        nombre_completo='Ana Pérez', cedula='V-4001', cargo='C', departamento='D', security_hash='h' * 22,
        campos_extra={'tel_contacto': '0414-5550142'},
    )

    assert generar_carnet_pdf_fiel(definicion, datos).startswith(b'%PDF')
    assert '0414-5550142' in textos
    assert '' in textos  # el campo sin origen se muestra vacío
