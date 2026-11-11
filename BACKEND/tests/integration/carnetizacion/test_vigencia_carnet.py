"""Vigencia del carnet configurable: parámetros por tipo, fecha guardada al emitir y estado VENCIDO."""
import secrets
from datetime import datetime, timedelta, timezone as tz

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.carnetizacion.domain.services.vigencia_carnet import calcular_vencimiento, sumar_meses
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    MotivosEmisionModel,
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.models.credencial_externa_model import CredencialExternaModel
from apps.carnetizacion.infrastructure.repositories import repo_carnetizacion_orm as repo_mod
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.carnetizacion.infrastructure.repositories.repo_credenciales_externas_orm import (
    RepoCredencialesExternasORM,
)
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
from apps.configuracion.domain.parametros import definicion_de
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.configuracion import (
    CLAVE_CARNETIZACION_VENCIMIENTO_MESES as GLOBAL,
    CLAVE_CARNETIZACION_VIGENCIA_EXTERNO_DIAS as EXTERNO,
    CLAVE_CARNETIZACION_VIGENCIA_PASIVO_MESES as PASIVO,
    CLAVE_CARNETIZACION_VIGENCIA_TRABAJADOR_MESES as TRABAJADOR,
)

pytestmark = pytest.mark.django_db

URL = '/api/v1/integraciones/carnet/verificar/'
CLAVE = 'clave-de-prueba-silog-0123456789abcdef'


@pytest.fixture(autouse=True)
def claves(settings):
    settings.INTEGRACION_CARNET_API_KEYS = f'silog:{CLAVE}'


def _param(clave, valor):
    # Los tests corren sin migraciones: la fila de datos puede no existir todavía.
    ParametroSistemaModel.objects.update_or_create(
        clave=clave,
        defaults={'etiqueta': clave, 'descripcion': clave, 'grupo': 'carnetizacion',
                  'tipo': 'entero', 'valor': str(valor)},
    )


def _empleado(cedula='V30799436'):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'Venezolano'})
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'MASCULINO'})
    MotivosEmisionModel.objects.get_or_create(id=1, defaults={'nombre': 'Primera Emisión'})
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula, nombres='Ana', apellidos='Pérez', sexoid=sexo, nacionalidad_id=1,
    )


def _verificar(hash_):
    return APIClient().get(URL, {'hash': hash_}, HTTP_X_API_KEY=CLAVE).json()


def test_parametros_definidos_con_valores_y_rangos():
    esperado = {TRABAJADOR: ('12', 1, 60), PASIVO: ('12', 1, 60), EXTERNO: ('30', 1, 365), GLOBAL: ('12', 1, 60)}
    for clave, (defecto, minimo, maximo) in esperado.items():
        d = definicion_de(clave)
        assert (d.defecto, d.minimo, d.maximo, d.grupo) == (defecto, minimo, maximo, 'carnetizacion')


def test_calculo_por_tipo_y_respaldo():
    base = datetime(2026, 1, 31, tzinfo=tz.utc)
    assert calcular_vencimiento(base, tipo='trabajador', valor_tipo=6, respaldo_meses=12) == datetime(2026, 7, 31, tzinfo=tz.utc)
    assert calcular_vencimiento(base, tipo='externo', valor_tipo=30, respaldo_meses=12) == base + timedelta(days=30)
    # Tipo en 0 o ausente: respaldo global.
    assert calcular_vencimiento(base, tipo='pasivo', valor_tipo=0, respaldo_meses=24) == datetime(2028, 1, 31, tzinfo=tz.utc)
    # Respaldo inválido: 12 meses.
    assert calcular_vencimiento(base, tipo='pasivo', valor_tipo=0, respaldo_meses=0) == datetime(2027, 1, 31, tzinfo=tz.utc)
    assert sumar_meses(base, 1) == datetime(2026, 2, 28, tzinfo=tz.utc)


def test_emitir_guarda_vencimiento_del_tipo_trabajador():
    _empleado()
    _param(TRABAJADOR, 6)
    carnet = RepoCarnetizacionORM().emitir_carnet('V30799436', 1)
    fila = CarnetEmitidoModel.objects.get(pk=carnet.id)
    assert fila.fecha_vencimiento is not None
    assert abs(fila.fecha_vencimiento - sumar_meses(fila.fecha_emision, 6)) < timedelta(minutes=1)


def test_emitir_pasivo_usa_parametro_de_pasivo(monkeypatch):
    _empleado()
    _param(TRABAJADOR, 6)
    _param(PASIVO, 24)
    monkeypatch.setattr(repo_mod, '_es_pasivo', lambda empleado: True)
    carnet = RepoCarnetizacionORM().emitir_carnet('V30799436', 1)
    fila = CarnetEmitidoModel.objects.get(pk=carnet.id)
    assert abs(fila.fecha_vencimiento - sumar_meses(fila.fecha_emision, 24)) < timedelta(minutes=1)


def test_tipo_en_cero_usa_el_respaldo_global():
    _empleado()
    _param(TRABAJADOR, 0)
    _param(GLOBAL, 3)
    carnet = RepoCarnetizacionORM().emitir_carnet('V30799436', 1)
    fila = CarnetEmitidoModel.objects.get(pk=carnet.id)
    assert abs(fila.fecha_vencimiento - sumar_meses(fila.fecha_emision, 3)) < timedelta(minutes=1)


def test_cambio_posterior_del_parametro_no_altera_el_emitido():
    _empleado()
    carnet = RepoCarnetizacionORM().emitir_carnet('V30799436', 1)
    antes = CarnetEmitidoModel.objects.get(pk=carnet.id).fecha_vencimiento
    _param(TRABAJADOR, 1)
    despues = CarnetEmitidoModel.objects.get(pk=carnet.id).fecha_vencimiento
    assert antes == despues
    assert _verificar(carnet.security_hash)['valido'] is True


def test_carnet_vencido_responde_vencido_en_ficha_e_integracion():
    emp = _empleado()
    carnet = CarnetEmitidoModel.objects.create(
        employee=emp, motivo_id=1, security_hash=secrets.token_hex(32),
        fecha_vencimiento=timezone.now() - timedelta(days=1),
    )
    d = _verificar(carnet.security_hash)
    assert d['valido'] is False and d['estado'] == 'VENCIDO' and d['cedula'] is None
    assert d['fecha_vencimiento']
    ficha = RepoCarnetizacionORM().consultar_ficha_qr(carnet.security_hash)
    assert ficha.estado == 'VENCIDO' and ficha.es_valido is False and ficha.datos is None


def test_carnet_vigente_devuelve_fecha_vencimiento_real():
    emp = _empleado()
    vence = timezone.now() + timedelta(days=10)
    carnet = CarnetEmitidoModel.objects.create(
        employee=emp, motivo_id=1, security_hash=secrets.token_hex(32), fecha_vencimiento=vence,
    )
    d = _verificar(carnet.security_hash)
    assert d['valido'] is True and d['fecha_vencimiento'] == vence.date().isoformat()


def test_carnet_viejo_con_null_se_calcula_en_lectura():
    emp = _empleado()
    carnet = CarnetEmitidoModel.objects.create(employee=emp, motivo_id=1, security_hash=secrets.token_hex(32))
    assert carnet.fecha_vencimiento is None
    CarnetEmitidoModel.objects.filter(pk=carnet.pk).update(fecha_emision=timezone.now() - timedelta(days=400))
    assert _verificar(carnet.security_hash)['estado'] == 'VENCIDO'  # 12 meses vigentes < 400 días
    _param(TRABAJADOR, 60)  # el parámetro vigente aplica a los carnets sin fecha guardada
    d = _verificar(carnet.security_hash)
    assert d['valido'] is True and d['fecha_vencimiento']


def _tipo_externo():
    return TipoCredencialModel.objects.get_or_create(
        codigo='visitante',
        defaults={'nombre': 'Visitante', 'descripcion': 'v', 'grupo': 'externo', 'ancho_mm': 54,
                  'alto_mm': 85.6, 'orientacion': 'vertical', 'activo': True, 'orden': 99},
    )[0]


def test_credencial_externa_sin_fecha_final_usa_parametro_de_dias():
    _tipo_externo()
    _param(EXTERNO, 15)
    ahora = timezone.now()
    cred = RepoCredencialesExternasORM().crear(
        tipo_codigo='visitante', grupo_esperado='externo', nombre='LUIS', documento='V1',
        motivo='Reunión', vigencia_desde=ahora,
    )
    assert abs(datetime.fromisoformat(str(cred.vigencia_hasta)) - (ahora + timedelta(days=15))) < timedelta(minutes=1)


def test_credencial_externa_vencida_responde_vencido():
    tipo = _tipo_externo()
    ahora = timezone.now()
    cred = CredencialExternaModel.objects.create(
        security_hash=secrets.token_hex(32), tipo_credencial=tipo, nombre='Luis', documento='V1',
        motivo='x', vigencia_desde=ahora - timedelta(days=3), vigencia_hasta=ahora - timedelta(days=1),
    )
    d = _verificar(cred.security_hash)
    assert d['valido'] is False and d['estado'] == 'VENCIDO' and d['fecha_vencimiento']
    ficha = RepoCarnetizacionORM().consultar_ficha_qr(cred.security_hash)
    assert ficha.estado == 'VENCIDO' and ficha.datos is None
