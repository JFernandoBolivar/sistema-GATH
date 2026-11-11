"""
S2-02: vencimiento de la contraseña inicial de las cuentas antiguas.

En la BD real hay cuentas creadas antes del control de vencimiento: tienen la
cédula como contraseña y ninguna fila en `identidad_cuenta_password_inicial`,
así que nunca caducaban. El caso de uso las iguala al resto sin tocar a las que
cambiaron la clave ni a las que ya tienen fila.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.configuracion.infrastructure.lector_configuracion import LectorConfiguracionORM
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
from apps.identidad.application.use_cases.vencer_claves_iniciales import (
    vencer_claves_iniciales_antiguas,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.configuracion import CLAVE_PASSWORD_INICIAL_DIAS

CEDULAS = ('57000001', '57000002', '57000003')


@pytest.fixture(autouse=True)
def _catalogos(db):
    """El empleado legado exige sexo y nacionalidad existentes (FK diferida al commit)."""
    from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel

    SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})


def _cuenta(cedula: str, clave: str | None = None) -> CuentaModel:
    empleado = EmployeeModel.objects.create(
        cedulaidentidad=cedula,
        nombres='CLAVE',
        apellidos='PRUEBA',
        sexoid_id=1,
        correo=f'{cedula}@conatel.gob.ve',
    )
    return CuentaModel.objects.create_user(cedula=empleado, password=clave or cedula)


def _plazo(dias: int) -> None:
    ParametroSistemaModel.objects.update_or_create(
        clave=CLAVE_PASSWORD_INICIAL_DIAS,
        defaults={
            'etiqueta': 'Vigencia de la contraseña inicial',
            'descripcion': 'Días de vigencia',
            'grupo': 'plazos',
            'tipo': 'entero',
            'valor': str(dias),
            'valor_min': 1,
            'valor_max': 365,
        },
    )


def _ejecutar(ahora, *, dry_run=False):
    return vencer_claves_iniciales_antiguas(
        RepoPasswordInicialORM(), LectorConfiguracionORM(), ahora=ahora, dry_run=dry_run,
    )


@pytest.mark.django_db
def test_cuenta_antigua_con_la_cedula_recibe_vencimiento_y_la_cambiada_no():
    antigua = _cuenta(CEDULAS[0])
    _cuenta(CEDULAS[1], clave='ClaveDistinta.2026')
    ahora = timezone.now()

    resultado = _ejecutar(ahora)

    assert resultado.revisadas == 2
    assert resultado.ajustadas == 1
    fila = PasswordInicialModel.objects.get(cuenta_id=antigua.pk)
    assert fila.vence_en == ahora + timedelta(days=7)
    assert not PasswordInicialModel.objects.filter(
        cuenta_id=CuentaModel.objects.get(cedula_id=CEDULAS[1]).pk
    ).exists()


@pytest.mark.django_db
def test_cuenta_con_fila_queda_intacta():
    cuenta = _cuenta(CEDULAS[0])
    vencimiento_previo = timezone.now() - timedelta(days=1)
    PasswordInicialModel.objects.create(
        cuenta_id=cuenta.pk,
        emitida_en=timezone.now() - timedelta(days=8),
        vence_en=vencimiento_previo,
    )
    ahora = timezone.now()

    resultado = _ejecutar(ahora)

    assert resultado.revisadas == 0
    assert resultado.ajustadas == 0
    fila = PasswordInicialModel.objects.get(cuenta_id=cuenta.pk)
    assert fila.vence_en == vencimiento_previo


@pytest.mark.django_db
def test_segunda_ejecucion_no_hace_nada():
    cuenta = _cuenta(CEDULAS[0])
    ahora = timezone.now()
    primera = _ejecutar(ahora)
    assert primera.ajustadas == 1
    vence_en_primera = PasswordInicialModel.objects.get(cuenta_id=cuenta.pk).vence_en

    segunda = _ejecutar(ahora + timedelta(minutes=5))

    assert segunda.revisadas == 0 and segunda.ajustadas == 0
    assert PasswordInicialModel.objects.filter(cuenta_id=cuenta.pk).count() == 1
    assert PasswordInicialModel.objects.get(cuenta_id=cuenta.pk).vence_en == vence_en_primera


@pytest.mark.django_db
def test_el_plazo_sale_del_parametro():
    _plazo(3)
    cuenta = _cuenta(CEDULAS[0])
    ahora = timezone.now()

    resultado = _ejecutar(ahora)

    assert resultado.dias == 3
    assert PasswordInicialModel.objects.get(cuenta_id=cuenta.pk).vence_en == ahora + timedelta(days=3)


@pytest.mark.django_db
def test_dry_run_cuenta_pero_no_escribe():
    _cuenta(CEDULAS[0])
    _cuenta(CEDULAS[1], clave='OtraClave.2026')

    resultado = _ejecutar(timezone.now(), dry_run=True)

    assert resultado.revisadas == 2
    assert resultado.ajustadas == 1
    assert not PasswordInicialModel.objects.exists()


@pytest.mark.django_db
def test_comando_aplica_y_reporta_sin_cedulas():
    from io import StringIO

    from django.core.management import call_command

    _cuenta(CEDULAS[0])
    salida = StringIO()

    call_command('vencer_claves_iniciales_antiguas', stdout=salida)

    texto = salida.getvalue()
    assert 'revisadas=1 ajustadas=1' in texto
    assert CEDULAS[0] not in texto
    assert PasswordInicialModel.objects.count() == 1


@pytest.mark.django_db
def test_comando_dry_run_no_escribe():
    from io import StringIO

    from django.core.management import call_command

    _cuenta(CEDULAS[0])
    salida = StringIO()

    call_command('vencer_claves_iniciales_antiguas', '--dry-run', stdout=salida)

    assert 'dry-run' in salida.getvalue()
    assert PasswordInicialModel.objects.count() == 0


@pytest.mark.django_db
def test_el_arranque_encola_una_sola_vez_y_respeta_la_marca(monkeypatch):
    """Marca persistente: tras ejecutarse, el arranque ya no encola."""
    from apps.identidad.infrastructure.models.ejecucion_unica_model import EjecucionUnicaModel
    from apps.identidad.infrastructure.tasks import vencer_claves_tasks as tareas

    encoladas: list[int] = []
    monkeypatch.setattr(
        tareas.vencer_claves_iniciales_antiguas_tarea,
        'apply_async',
        lambda *a, **k: encoladas.append(1),
    )
    EjecucionUnicaModel.objects.filter(clave=tareas.CLAVE_EJECUCION).delete()
    try:
        assert tareas.encolar_si_falta() is True
        tareas.marcar_ejecutada(tareas.CLAVE_EJECUCION)
        assert tareas.encolar_si_falta() is False  # marca persistente
        assert len(encoladas) == 1
    finally:
        EjecucionUnicaModel.objects.filter(clave=tareas.CLAVE_EJECUCION).delete()


@pytest.mark.django_db
def test_la_tarea_no_se_solapa_con_el_candado():
    """Dos ejecuciones a la vez: la segunda no hace nada."""
    from apps.identidad.infrastructure.tasks import vencer_claves_tasks as tareas

    cache = tareas.cache
    cache.delete(tareas.CANDADO)
    try:
        cache.add(tareas.CANDADO, 'otra-ejecucion', timeout=60)
        assert tareas.vencer_claves_iniciales_antiguas_tarea() == 'en curso'
    finally:
        cache.delete(tareas.CANDADO)
