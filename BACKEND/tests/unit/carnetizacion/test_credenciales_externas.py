"""O45-A: credenciales externas, temporales, PDF por lote, correo y QR."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    TipoCredencialModel,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import (
    RepoCarnetizacionORM,
)
from apps.carnetizacion.infrastructure.repositories.repo_credenciales_externas_orm import (
    RepoCredencialesExternasORM,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    SexoModel,
)
from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


def _tipo(codigo: str, grupo: str) -> TipoCredencialModel:
    return TipoCredencialModel.objects.get_or_create(
        codigo=codigo,
        defaults={
            'nombre': codigo.title(),
            'descripcion': codigo,
            'grupo': grupo,
            'ancho_mm': 54,
            'alto_mm': 85.6,
            'orientacion': 'vertical',
            'activo': True,
            'orden': 99,
        },
    )[0]


def _empleado(cedula: str = 'O45A0001') -> EmployeeModel:
    NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'}
    )
    sexo = SexoModel.objects.first() or SexoModel.objects.create(sexo='M')
    return EmployeeModel.objects.create(
        cedulaidentidad=cedula,
        nombres='ANA',
        apellidos='PRUEBA',
        sexoid=sexo,
        nacionalidad_id=1,
    )


def test_crear_visitante_y_devolver():
    _tipo('visitante', 'externo')
    repo = RepoCredencialesExternasORM()
    ahora = timezone.now()
    fila = repo.crear(
        tipo_codigo='visitante',
        grupo_esperado='externo',
        nombre='VISITANTE PRUEBA',
        documento='V-12345678',
        motivo='Reunión',
        vigencia_desde=ahora,
        vigencia_hasta=ahora + timedelta(hours=4),
        empresa='Proveedor CA',
        persona_visitada='JEFE DE PRUEBA',
    )
    assert fila.estado == 'ACTIVA'
    assert len(fila.security_hash) == 22

    devuelta = repo.devolver(fila.id)
    assert devuelta.estado == 'DEVUELTA'
    assert devuelta.devuelta_en is not None


def test_credencial_temporal_vencida_se_marca_automaticamente():
    _tipo('trabajador_temporal', 'temporal')
    empleado = _empleado()
    repo = RepoCredencialesExternasORM()
    ahora = timezone.now()
    fila = repo.crear(
        tipo_codigo='trabajador_temporal',
        grupo_esperado='temporal',
        nombre='ANA PRUEBA',
        documento=empleado.cedulaidentidad,
        motivo='Olvido',
        vigencia_desde=ahora - timedelta(hours=2),
        vigencia_hasta=ahora - timedelta(hours=1),
        empleado_cedula=empleado.cedulaidentidad,
    )
    assert fila.estado == 'ACTIVA'

    filas = repo.listar(grupo='temporal')
    assert len(filas) == 1
    assert filas[0].estado == 'VENCIDA'


def test_pdf_individual_y_lote_generan_pdf_valido():
    _tipo('visitante', 'externo')
    repo = RepoCredencialesExternasORM()
    ahora = timezone.now()
    ids = []
    for indice in range(2):
        fila = repo.crear(
            tipo_codigo='visitante',
            grupo_esperado='externo',
            nombre=f'VISITANTE {indice}',
            documento=f'V-9000000{indice}',
            motivo='Visita',
            vigencia_desde=ahora,
            vigencia_hasta=ahora + timedelta(hours=2),
        )
        ids.append(fila.id)

    pdf = repo.generar_pdf(ids[0])
    assert pdf.startswith(b'%PDF')
    lote = repo.generar_pdf_lote(ids)
    assert lote.startswith(b'%PDF')
    # El lote agrupa varias credenciales por hoja A4; el tamaño/páginas depende
    # del acomodo. Lo relevante es que ambos sean PDF válidos y no vacíos.
    assert len(pdf) > 1000
    assert len(lote) > 1000


def test_enviar_credencial_encola_correo_en_outbox():
    _tipo('visitante', 'externo')
    repo = RepoCredencialesExternasORM()
    ahora = timezone.now()
    fila = repo.crear(
        tipo_codigo='visitante',
        grupo_esperado='externo',
        nombre='VISITANTE CORREO',
        documento='V-87654321',
        motivo='Visita',
        vigencia_desde=ahora,
        vigencia_hasta=ahora + timedelta(hours=2),
        correo='visitante@example.com',
    )

    assert repo.enviar_correo(fila.id) is True
    assert EventoOutboxModel.objects.filter(destinatario='visitante@example.com').count() == 1


def test_ficha_qr_externa_es_valida_y_no_expone_salud():
    _tipo('visitante', 'externo')
    repo = RepoCredencialesExternasORM()
    ahora = timezone.now()
    fila = repo.crear(
        tipo_codigo='visitante',
        grupo_esperado='externo',
        nombre='VISITANTE QR',
        documento='V-11223344',
        motivo='Visita',
        vigencia_desde=ahora,
        vigencia_hasta=ahora + timedelta(hours=2),
        empresa='Proveedor',
    )

    ficha = RepoCarnetizacionORM().consultar_ficha_qr(fila.security_hash)
    assert ficha.es_valido is True
    assert ficha.datos is not None
    assert ficha.datos['nombre'] == 'VISITANTE QR'
    assert 'salud' not in ficha.datos


def _pdf_de_visitante(valores: dict) -> bytes:
    """PDF de un visitante con una plantilla cuyo rectángulo usa `rule:primario` por nómina."""
    from apps.carnetizacion.infrastructure.models.credencial_externa_model import CredencialExternaModel

    _tipo('visitante', 'externo')
    repo = RepoCredencialesExternasORM()
    ahora = timezone.now()
    fila = repo.crear(
        tipo_codigo='visitante', grupo_esperado='externo', nombre='VISITANTE COLOR',
        documento='V-90000009', motivo='Visita', vigencia_desde=ahora,
        vigencia_hasta=ahora + timedelta(hours=2),
    )
    CredencialExternaModel.objects.filter(pk=fila.id).update(plantilla_snapshot={
        'ancho_mm': 54, 'alto_mm': 85.6, 'bg': {},
        'reglas': {
            'criterio': 'nomina',
            'respaldo': {'primario': '#0000FF', 'acento': '#0000FF', 'texto': '#ffffff'},
            'valores': valores,
        },
        'anverso': [{'tipo': 'rect', 'x': 0, 'y': 0, 'w': 50, 'h': 20, 'fill': 'rule:primario'}],
        'reverso': [],
    })
    return repo.generar_pdf(fila.id)


def test_pdf_de_visitante_aplica_el_color_de_la_regla_visitante():
    pdf = _pdf_de_visitante({'VISITANTE': {'primario': '#AA0000', 'acento': '#AA0000', 'texto': '#ffffff'}})
    assert b'.666667 0 0 rg' in pdf  # #AA0000


def test_pdf_de_visitante_sin_regla_usa_el_color_de_respaldo():
    pdf = _pdf_de_visitante({'CONTRATISTA': {'primario': '#AA0000', 'acento': '#AA0000', 'texto': '#ffffff'}})
    assert b'.666667 0 0 rg' not in pdf
    assert b'0 0 1 rg' in pdf  # #0000FF
