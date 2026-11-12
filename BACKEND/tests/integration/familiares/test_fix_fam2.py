"""FIX-FAM2: reglas configurables por parentesco aplicadas al registrar familiares."""
import datetime
import json
from io import StringIO

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.repositories.lector_ficha_orm import LectorFichaORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
)
from apps.configuracion.infrastructure.models.regla_parentesco_model import (
    ReglaParentescoModel,
)
from apps.familiares.application.use_cases.validaciones_familiar import (
    resolver_cedula_familiar,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.personal.infrastructure.models.catalogos_soporte_models import GrupoSanguineoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

pytestmark = pytest.mark.django_db
BASE = '/api/v1/familiares/empleado/'


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos=('familiares.crear',)):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = '1', 1, 1, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos or ('familiares.crear',)))
    return api


@pytest.fixture
def escenario():
    NacionalidadModel.objects.get_or_create(pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'})
    sexo_m = SexoModel.objects.create(sexo='MASCULINO')
    sexo_f = SexoModel.objects.create(sexo='FEMENINO')
    empleado = EmployeeModel.objects.create(
        cedulaidentidad='99000320', nombres='ANA', apellidos='PEREZ',
        fecha_nacimiento=datetime.date(1990, 1, 1), sexoid=sexo_m, total_anos_apn=0,
    )
    return {'sexo_m': sexo_m, 'sexo_f': sexo_f, 'empleado': empleado}


def _parentesco(nombre: str, **regla) -> ParentescoModel:
    parentesco = ParentescoModel.objects.create(
        descripcion_parentesco=nombre, aplica_familiar=True,
    )
    ReglaParentescoModel.objects.create(parentesco_id=parentesco.pk, **regla)
    return parentesco


def _cuerpo(parentesco, sexo, nacimiento, orden=1):
    return {
        'primer_nombre': 'FAMILIAR',
        'primer_apellido': 'PEREZ',
        'parentesco_id': parentesco.pk,
        'fecha_nacimiento': nacimiento,
        'sexo_id': sexo.pk,
        'orden_hijo': orden,
        # OC 2026-11-11: el grupo sanguíneo es obligatorio.
        'perfil_salud': {
            'grupo_sanguineo_id': GrupoSanguineoModel.objects.get_or_create(
                GrupoSanguineo='O+',
            )[0].pk,
        },
    }


def test_regla_hijo_configurable_controla_la_cedula_sintetica(escenario):
    hijo = _parentesco(
        'HIJO (A)', es_hijo=True, sin_cedula_hasta_edad=5, diferencia_tipo='NINGUNA',
    )
    api = _cliente()

    menor = api.post(
        BASE + '99000320/',
        _cuerpo(hijo, escenario['sexo_m'], '2022-01-01', orden=1),
        format='json',
    )
    assert menor.status_code == 200, menor.content
    assert menor.json()['data']['cedula_familiar'] == '99000320-1'

    mayor = api.post(
        BASE + '99000320/',
        _cuerpo(hijo, escenario['sexo_m'], '2018-01-01', orden=2),
        format='json',
    )
    assert mayor.status_code == 400
    assert 'cédula es obligatoria' in str(mayor.json())


def test_conyuge_menor_de_18_se_rechaza(escenario):
    esposa = _parentesco('ESPOSA', edad_minima=18)
    r = _cliente().post(
        BASE + '99000320/',
        _cuerpo(esposa, escenario['sexo_f'], '2010-01-01'),
        format='json',
    )
    assert r.status_code == 400
    assert 'al menos 18' in str(r.json())


def test_madre_exige_sexo_femenino(escenario):
    madre = _parentesco('MADRE', sexo_permitido='F')
    r = _cliente().post(
        BASE + '99000320/',
        _cuerpo(madre, escenario['sexo_m'], '1960-01-01'),
        format='json',
    )
    assert r.status_code == 400
    assert 'solo admite sexo femenino' in str(r.json())


def test_padre_exige_diferencia_minima_mayor(escenario):
    padre = _parentesco(
        'PADRE', sexo_permitido='M', diferencia_minima=12, diferencia_tipo='MAYOR',
    )
    api = _cliente()

    poca = api.post(
        BASE + '99000320/',
        _cuerpo(padre, escenario['sexo_m'], '1985-01-01'),
        format='json',
    )
    assert poca.status_code == 400
    assert 'al menos 12 años mayor' in str(poca.json())

    valida = api.post(
        BASE + '99000320/',
        {
            **_cuerpo(padre, escenario['sexo_m'], '1970-01-01'),
            'cedula_familiar': '12345678',
        },
        format='json',
    )
    assert valida.status_code == 200, valida.content


def test_tutelado_comparte_el_correlativo_de_los_hijos(escenario):
    tutelado = _parentesco(
        'TUTELADO', menor_a_cargo=True, sin_cedula_hasta_edad=9,
        diferencia_tipo='NINGUNA',
    )
    r = _cliente().post(
        BASE + '99000320/',
        _cuerpo(tutelado, escenario['sexo_m'], '2020-01-01', orden=2),
        format='json',
    )
    assert r.status_code == 200, r.content
    assert r.json()['data']['cedula_familiar'] == '99000320-2'


def test_reporte_de_familiares_que_violan_reglas(escenario):
    esposa = _parentesco('ESPOSA', edad_minima=18)
    EmployeefamilyModel.objects.create(
        employeecedula_id='99000320', cedulaFamiliar='99000320-9',
        primer_nombre='MENOR', primer_apellido='PEREZ',
        parentesco=esposa, sexo=escenario['sexo_f'],
        fechanacimiento=datetime.date(2015, 1, 1),
    )
    salida = StringIO()
    call_command('reportar_reglas_familiares', '--json', stdout=salida)
    reporte = json.loads(salida.getvalue())
    assert reporte['total_violaciones'] >= 1
    assert any('al menos 18' in problema for fila in reporte['filas'] for problema in fila['problemas'])

def test_resolver_rechaza_cedula_correlativa_escrita_a_mano():
    with pytest.raises(ValueError, match="correlativa"):
        resolver_cedula_familiar(
            cedula_familiar="99000320-1",
            cedula_empleado="99000320",
            fecha_nacimiento=datetime.date(1960, 1, 1),
        )


def test_lector_rechaza_cedula_correlativa_manual_para_madre(escenario):
    madre = _parentesco("MADRE", sexo_permitido="F")
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id="99000320", cedulaFamiliar="12345678",
        primer_nombre="MADRE", primer_apellido="PEREZ",
        parentesco=madre, sexo=escenario["sexo_f"],
        fechanacimiento=datetime.date(1960, 1, 1),
    )
    with pytest.raises(ValidationError, match="correlativa"):
        LectorFichaORM().validar_familiar_cambio(
            "99000320", str(familiar.pk), {"cedula_familiar": "99000320-1"},
        )


def test_lector_rechaza_madre_con_sexo_masculino(escenario):
    madre = _parentesco("MADRE", sexo_permitido="F")
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id="99000320", cedulaFamiliar="12345678",
        primer_nombre="MADRE", primer_apellido="PEREZ",
        parentesco=madre, sexo=escenario["sexo_f"],
        fechanacimiento=datetime.date(1960, 1, 1),
    )
    with pytest.raises(ValidationError, match="sexo femenino"):
        LectorFichaORM().validar_familiar_cambio(
            "99000320", str(familiar.pk), {"sexo_id": escenario["sexo_m"].pk},
        )


def test_lector_rechaza_fecha_futura_en_familiar(escenario):
    madre = _parentesco("MADRE", sexo_permitido="F")
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id="99000320", cedulaFamiliar="12345678",
        primer_nombre="MADRE", primer_apellido="PEREZ",
        parentesco=madre, sexo=escenario["sexo_f"],
        fechanacimiento=datetime.date(1960, 1, 1),
    )
    with pytest.raises(ValidationError, match="futura"):
        LectorFichaORM().validar_familiar_cambio(
            "99000320", str(familiar.pk), {"fecha_nacimiento": "2099-01-01"},
        )

def test_validador_acta_fe_de_vida_aplica_reglas_de_parentesco(escenario):
    from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
    from apps.fe_de_vida.infrastructure.adaptadores_autogestion import (
        ValidadorCambiosActaORM,
    )

    madre = _parentesco("MADRE", sexo_permitido="F")
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id="99000320", cedulaFamiliar="12345678",
        primer_nombre="MADRE", primer_apellido="PEREZ",
        parentesco=madre, sexo=escenario["sexo_f"],
        fechanacimiento=datetime.date(1960, 1, 1),
    )
    with pytest.raises(ValidationError, match="correlativa"):
        ValidadorCambiosActaORM().validar_conjunto(
            "99000320",
            [
                CambioActa(
                    "familiar", "MODIFICAR", "familiar", "cedula_familiar",
                    "99000320-1", entidad_id=str(familiar.pk),
                )
            ],
        )


def test_validador_conjunto_acepta_madre_con_fecha_corregida(escenario):
    """El estado final se valida con TODOS los cambios del familiar, no campo a campo."""
    from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
    from apps.fe_de_vida.infrastructure.adaptadores_autogestion import (
        ValidadorCambiosActaORM,
    )

    hijo = _parentesco(
        "HIJO (A)", es_hijo=True, sin_cedula_hasta_edad=9, diferencia_tipo="NINGUNA",
    )
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id="99000320", cedulaFamiliar="12345678",
        primer_nombre="FAMILIAR", primer_apellido="PEREZ",
        parentesco=hijo, sexo=escenario["sexo_f"],
        fechanacimiento=datetime.date(2026, 10, 14),
    )
    madre = _parentesco(
        "MADRE", sexo_permitido="F", diferencia_minima=12, diferencia_tipo="MAYOR",
    )

    # Cambiar a MADRE con su fecha real (1913) en el mismo guardado debe pasar,
    # aunque la fecha guardada del registro sea la del hijo (2026).
    ValidadorCambiosActaORM().validar_conjunto(
        "99000320",
        [
            CambioActa(
                "familiar", "MODIFICAR", "familiar", "parentesco_id",
                madre.pk, entidad_id=str(familiar.pk),
            ),
            CambioActa(
                "familiar", "MODIFICAR", "familiar", "fecha_nacimiento",
                datetime.date(1913, 1, 1), entidad_id=str(familiar.pk),
            ),
            CambioActa(
                "familiar", "MODIFICAR", "familiar", "sexo_id",
                escenario["sexo_f"].pk, entidad_id=str(familiar.pk),
            ),
        ],
    )


def test_validador_conjunto_rechaza_madre_con_fecha_guardada(escenario):
    from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
    from apps.fe_de_vida.infrastructure.adaptadores_autogestion import (
        ValidadorCambiosActaORM,
    )

    hijo = _parentesco(
        "HIJO (A)", es_hijo=True, sin_cedula_hasta_edad=9, diferencia_tipo="NINGUNA",
    )
    familiar = EmployeefamilyModel.objects.create(
        employeecedula_id="99000320", cedulaFamiliar="12345678",
        primer_nombre="FAMILIAR", primer_apellido="PEREZ",
        parentesco=hijo, sexo=escenario["sexo_f"],
        fechanacimiento=datetime.date(2026, 10, 14),
    )
    madre = _parentesco(
        "MADRE", sexo_permitido="F", diferencia_minima=12, diferencia_tipo="MAYOR",
    )

    with pytest.raises(ValidationError, match="mayor"):
        ValidadorCambiosActaORM().validar_conjunto(
            "99000320",
            [
                CambioActa(
                    "familiar", "MODIFICAR", "familiar", "parentesco_id",
                    madre.pk, entidad_id=str(familiar.pk),
                )
            ],
        )
