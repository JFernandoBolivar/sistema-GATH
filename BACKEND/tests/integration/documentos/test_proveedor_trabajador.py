"""N-4: proveedor real del trabajador, con y sin asignación laboral vigente."""
import datetime

import pytest

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
)
from apps.documentos.infrastructure.proveedor_trabajador import (
    SUJETO_TRABAJADOR,
    ProveedorDatosTrabajadorORM,
    normalizar_cedula_trabajador,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

pytestmark = pytest.mark.django_db
CEDULA = '12345678'


@pytest.fixture
def trabajador():
    nacionalidad = NacionalidadModel.objects.get_or_create(
        pk=1, defaults={'codigo': 'V', 'nombre': 'Venezolana'},
    )[0]
    sexo = SexoModel.objects.create(sexo='F')
    return EmployeeModel.objects.create(
        cedulaidentidad=CEDULA, nombres='ana maría', apellidos='pérez', sexoid=sexo,
        nacionalidad=nacionalidad, fecha_nacimiento=datetime.date(1990, 1, 1),
        correo='ana@example.com', telefono_movil='04145550123', rif='V-12345678-9',
        foto_objeto='fotos/ana.png',
    )


def test_sin_asignacion_vigente_conserva_identidad_contacto_y_foto(trabajador, almacen):
    almacen.objetos['fotos/ana.png'] = b'foto-de-ana'
    datos = ProveedorDatosTrabajadorORM(almacen).datos_de(SUJETO_TRABAJADOR, 'V-12345678')
    assert datos['nombre_completo'] == 'PÉREZ ANA MARÍA'
    assert datos['cedula'] == 'V-12345678' and datos['cedula_numero'] == CEDULA
    assert datos['correo'] == 'ana@example.com' and datos['telefono_celular']
    assert datos['foto'] == b'foto-de-ana'
    assert datos['cargo'] == datos['oficina'] == datos['nomina'] == ''
    assert normalizar_cedula_trabajador('v-12345678') == CEDULA


def test_la_asignacion_activa_aporta_cargo_codigo_y_nomina(trabajador):
    activo = EstatusModel.objects.create(estatus='ACTIVO')
    inactivo = EstatusModel.objects.create(estatus='INACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='FUNCIONARIO')
    denominacion = DenominacionCargoModel.objects.create(cargo='PROFESIONAL')
    especifica = DenominacionCargoEspecificoModel.objects.create(cargo='ESPECIALISTA')
    AsigTrabajoModel.objects.create(
        employee=trabajador, codigo='Viejo', denominacioncargoid=denominacion,
        denominacioncargoespecificoid=especifica, tiponominaid=nomina, estatusid=inactivo,
    )
    AsigTrabajoModel.objects.create(
        employee=trabajador, codigo='ACT-042', denominacioncargoid=denominacion,
        denominacioncargoespecificoid=especifica, tiponominaid=nomina, estatusid=activo,
    )
    datos = ProveedorDatosTrabajadorORM().datos_de(SUJETO_TRABAJADOR, CEDULA, con_foto=False)
    assert (datos['cargo'], datos['codigo_cargo'], datos['codigo_empleado'], datos['nomina']) == (
        'ESPECIALISTA', 'ACT-042', 'ACT-042', 'FUNCIONARIO',
    )
