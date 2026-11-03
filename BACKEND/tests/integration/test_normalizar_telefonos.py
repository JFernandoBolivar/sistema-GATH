"""Comando `normalizar_telefonos` (D-13): simula por defecto, --aplicar convierte y es idempotente."""
import io

import pytest
from django.core.management import call_command

from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
from apps.personal.infrastructure.models.expediente_models import ContactoEmergenciaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db


@pytest.fixture
def datos():
    sexo = SexoModel.objects.create(sexo='F')
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANA'})
    filas = [
        ('1000001', '4122295258', 'nan'),         # sin 0 / basura
        ('1000002', '0412-1234567', '0212 1234567'),
        ('1000003', '+584141234567', None),       # ya E.164
        ('1000004', '12345', '   '),              # inválido / basura
    ]
    for cedula, movil, hab in filas:
        EmployeeModel.objects.create(cedulaidentidad=cedula, nombres='A', apellidos='B', sexoid=sexo,
                                     telefono_movil=movil, telefono_habitacion=hab)
    e = EmployeeModel.objects.get(cedulaidentidad='1000001')
    ContactoEmergenciaModel.objects.create(empleado=e, nombres='X', apellidos='Y', telefono='04241112233')


def _valores():
    return {
        'movil': list(EmployeeModel.objects.order_by('cedulaidentidad').values_list('telefono_movil', flat=True)),
        'hab': list(EmployeeModel.objects.order_by('cedulaidentidad').values_list('telefono_habitacion', flat=True)),
        'contacto': list(ContactoEmergenciaModel.objects.values_list('telefono', flat=True)),
    }


def _correr(*args):
    salida = io.StringIO()
    call_command('normalizar_telefonos', *args, stdout=salida)
    return salida.getvalue()


def test_dry_run_no_cambia_nada_y_resume(datos):
    antes = _valores()
    texto = _correr()
    assert _valores() == antes
    assert 'EmployeeModel.telefono_movil: ya E.164=1, a convertir=2, basura (a NULL)=0, inválidos=1' in texto
    assert 'telefono_habitacion: ya E.164=0, a convertir=1, basura (a NULL)=2, inválidos=0' in texto
    assert "'12345'" in texto


def test_aplicar_convierte_pone_null_y_es_idempotente(datos):
    _correr('--aplicar')
    assert _valores() == {
        'movil': ['+584122295258', '+584121234567', '+584141234567', '12345'],  # inválido intacto
        'hab': [None, '+582121234567', None, None],
        'contacto': ['+584241112233'],
    }
    despues = _valores()
    texto = _correr('--aplicar')
    assert _valores() == despues
    assert 'a convertir=0' in texto
