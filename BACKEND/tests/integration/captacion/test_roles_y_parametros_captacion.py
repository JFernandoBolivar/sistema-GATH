"""Fase 2, Captación (C-8 y parámetros C-3, C-4, C-6, C-7): roles, permisos y parámetros sembrados."""
import importlib
from io import StringIO

import pytest
from django.core.management import call_command

from apps.configuracion.domain.parametros import DEFINICIONES_POR_CLAVE, GRUPO_CAPTACION
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
from apps.identidad.infrastructure.models.cuenta_models import RolModel
from apps.identidad.infrastructure.models.permiso_model import PermisoModel, RolPermisoModel
from apps.identidad.management.commands.seed_permisos import (
    PERMISOS_BASE_CAPTACION,
    PERMISOS_BASE_DIRECCION_GENERAL,
    PERMISOS_CATALOGO,
    PERMISOS_POSTULACION_CAPTACION,
    PERMISOS_POSTULACION_DIRECCION_GENERAL,
    PERMISOS_POSTULACION_PRESUPUESTO,
)

pytestmark = pytest.mark.django_db

PERMISOS_POSTULACION = (
    set(PERMISOS_POSTULACION_CAPTACION)
    | set(PERMISOS_POSTULACION_PRESUPUESTO)
    | set(PERMISOS_POSTULACION_DIRECCION_GENERAL)
)

PARAMETROS_ESPERADOS = {
    'captacion.vigencia_ventana1_dias': ('15', 1, 90, 'entero'),
    'captacion.vigencia_ventana2_dias': ('15', 1, 90, 'entero'),
    'captacion.vigencia_reserva_puesto_dias': ('30', 1, 180, 'entero'),
    'captacion.psicofisico_obligatorio': ('true', None, None, 'booleano'),
    'captacion.retencion_rechazados_meses': ('24', 1, 120, 'entero'),
    'captacion.espera_diferido_dias': ('90', 1, 365, 'entero'),
    'captacion.horas_escalamiento_contacto': ('48', 1, 720, 'entero'),
}


MIGRACIONES_CAPTACION = (
    'apps.configuracion.migrations.0014_sembrar_parametros_captacion',
    'apps.configuracion.migrations.0015_sembrar_espera_diferido',
    'apps.configuracion.migrations.0016_sembrar_horas_escalamiento_contacto',
)


def _sembrar_captacion(registro):
    for nombre in MIGRACIONES_CAPTACION:
        importlib.import_module(nombre).sembrar(registro, None)


def _seed():
    call_command('seed_permisos', '--no-invalidar-sesiones', stdout=StringIO())


def _codigos(nombre_rol):
    rol = RolModel.objects.get(nombre_rol=nombre_rol)
    return set(
        RolPermisoModel.objects.filter(rol_id=rol.id).values_list('permiso__codigo', flat=True)
    )


def _crear_roles_base():
    for nombre in ('ADMINISTRADOR', 'ANALISTA', 'AUTOGESTION', 'PRESUPUESTO', 'BIENSTAR SOCIAL'):
        RolModel.objects.get_or_create(nombre_rol=nombre)


def test_permisos_de_postulacion_estan_en_el_catalogo_con_descripcion():
    catalogo = dict(PERMISOS_CATALOGO)
    assert len(PERMISOS_POSTULACION) == 15
    for codigo in PERMISOS_POSTULACION:
        assert codigo.startswith('postulacion.')
        assert len(catalogo[codigo]) > 10
    _seed()
    assert set(
        PermisoModel.objects.filter(codigo__startswith='postulacion.').values_list('codigo', flat=True)
    ) == PERMISOS_POSTULACION


def test_roles_captacion_y_direccion_general_tienen_exactamente_sus_permisos():
    _crear_roles_base()
    _seed()
    assert _codigos('CAPTACION') == set(PERMISOS_BASE_CAPTACION) | set(PERMISOS_POSTULACION_CAPTACION)
    assert _codigos('DIRECCION_GENERAL') == (
        set(PERMISOS_BASE_DIRECCION_GENERAL) | set(PERMISOS_POSTULACION_DIRECCION_GENERAL)
    )
    assert RolModel.objects.get(nombre_rol='CAPTACION').nombre_visible == 'Captación'
    assert RolModel.objects.get(nombre_rol='DIRECCION_GENERAL').nombre_visible == 'Dirección General'


def test_presupuesto_recibe_solo_los_permisos_de_postulacion_de_presupuesto():
    _crear_roles_base()
    _seed()
    de_postulacion = {c for c in _codigos('PRESUPUESTO') if c.startswith('postulacion.')}
    assert de_postulacion == set(PERMISOS_POSTULACION_PRESUPUESTO)
    assert 'postulacion.declarar_disponibilidad' in de_postulacion


def test_cada_rol_solo_tiene_los_permisos_de_postulacion_de_su_etapa():
    _crear_roles_base()
    _seed()
    captacion = {c for c in _codigos('CAPTACION') if c.startswith('postulacion.')}
    direccion = {c for c in _codigos('DIRECCION_GENERAL') if c.startswith('postulacion.')}
    assert not captacion & (set(PERMISOS_POSTULACION_PRESUPUESTO) | set(PERMISOS_POSTULACION_DIRECCION_GENERAL))
    assert not direccion & (set(PERMISOS_POSTULACION_CAPTACION) | set(PERMISOS_POSTULACION_PRESUPUESTO))


def test_administrador_recibe_todos_los_permisos_de_postulacion():
    _crear_roles_base()
    _seed()
    assert PERMISOS_POSTULACION <= _codigos('ADMINISTRADOR')


def test_seed_de_roles_de_captacion_es_idempotente_y_no_asigna_personas():
    _crear_roles_base()
    _seed()
    antes = (RolModel.objects.count(), RolPermisoModel.objects.count(), PermisoModel.objects.count())
    segunda = StringIO()
    call_command('seed_permisos', '--no-invalidar-sesiones', stdout=segunda)
    assert antes == (RolModel.objects.count(), RolPermisoModel.objects.count(), PermisoModel.objects.count())
    assert 'Roles nuevos creados: 0' in segunda.getvalue()
    assert RolModel.objects.filter(nombre_rol='CAPTACION').count() == 1


def test_migracion_de_roles_es_idempotente():
    migracion = importlib.import_module('apps.identidad.migrations.0016_seed_roles_captacion')
    _crear_roles_base()
    migracion.aplicar(None, None)
    estado = (RolModel.objects.count(), RolPermisoModel.objects.count())
    migracion.aplicar(None, None)
    assert estado == (RolModel.objects.count(), RolPermisoModel.objects.count())
    assert _codigos('CAPTACION') >= set(PERMISOS_POSTULACION_CAPTACION)


def test_parametros_de_captacion_se_siembran_con_valores_y_limites():
    from django.apps import apps as registro

    _sembrar_captacion(registro)
    filas = {p.clave: p for p in ParametroSistemaModel.objects.filter(grupo=GRUPO_CAPTACION)}
    assert set(filas) == set(PARAMETROS_ESPERADOS)
    for clave, (valor, minimo, maximo, tipo) in PARAMETROS_ESPERADOS.items():
        fila = filas[clave]
        assert (fila.valor, fila.valor_min, fila.valor_max, fila.tipo) == (valor, minimo, maximo, tipo)
        assert fila.etiqueta and fila.descripcion
        definicion = DEFINICIONES_POR_CLAVE[clave]
        assert (definicion.defecto, definicion.minimo, definicion.maximo, definicion.tipo) == (
            valor, minimo, maximo, tipo,
        )


def test_migracion_de_parametros_es_idempotente_reversible_y_no_pisa_valores():
    from django.apps import apps as registro

    _sembrar_captacion(registro)
    ParametroSistemaModel.objects.filter(clave='captacion.vigencia_ventana1_dias').update(valor='20')
    _sembrar_captacion(registro)
    assert ParametroSistemaModel.objects.filter(grupo=GRUPO_CAPTACION).count() == 7
    assert ParametroSistemaModel.objects.get(clave='captacion.vigencia_ventana1_dias').valor == '20'

    for nombre in MIGRACIONES_CAPTACION:
        importlib.import_module(nombre).retirar(registro, None)
    assert not ParametroSistemaModel.objects.filter(grupo=GRUPO_CAPTACION).exists()
    _sembrar_captacion(registro)
    assert ParametroSistemaModel.objects.filter(grupo=GRUPO_CAPTACION).count() == 7


def test_migracion_0015_es_idempotente_reversible_y_no_pisa_el_valor_editado():
    from django.apps import apps as registro

    migracion = importlib.import_module('apps.configuracion.migrations.0015_sembrar_espera_diferido')
    migracion.sembrar(registro, None)
    ParametroSistemaModel.objects.filter(clave='captacion.espera_diferido_dias').update(valor='120')
    migracion.sembrar(registro, None)
    assert ParametroSistemaModel.objects.get(clave='captacion.espera_diferido_dias').valor == '120'
    migracion.retirar(registro, None)
    assert not ParametroSistemaModel.objects.filter(clave='captacion.espera_diferido_dias').exists()


def test_migracion_0016_es_idempotente_reversible_y_no_pisa_el_valor_editado():
    from django.apps import apps as registro

    migracion = importlib.import_module('apps.configuracion.migrations.0016_sembrar_horas_escalamiento_contacto')
    migracion.sembrar(registro, None)
    ParametroSistemaModel.objects.filter(clave='captacion.horas_escalamiento_contacto').update(valor='72')
    migracion.sembrar(registro, None)
    assert ParametroSistemaModel.objects.get(clave='captacion.horas_escalamiento_contacto').valor == '72'
    migracion.retirar(registro, None)
    assert not ParametroSistemaModel.objects.filter(clave='captacion.horas_escalamiento_contacto').exists()
