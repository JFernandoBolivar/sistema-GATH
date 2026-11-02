"""
Lectura de la ficha vigente del trabajador (puerto `LectorFicha`, B6).

Es la única capa de autogestión autorizada a leer los modelos de `personal`/`familiares`
(B16: solo `infrastructure` cruza módulos). Solo lectura.
"""
from datetime import date

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.catalogos.infrastructure.models.catalogo_models import ParentescoModel, SexoModel
from apps.catalogos.infrastructure.models.geografia_models import EstadoModel, MunicipioModel, ParroquiaModel
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    CarreraModel,
    CodigoPostalModel,
    CondicionViviendaModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    ContactoEmergenciaModel,
    DatosViviendaModel,
    FormacionAcademicaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError

_CATALOGOS = {
    'estado_id': EstadoModel, 'municipio_id': MunicipioModel, 'parroquia_id': ParroquiaModel,
    'condicion_vivienda_id': CondicionViviendaModel, 'codigo_postal_id': CodigoPostalModel,
    'nivel_academico_id': NivelAcademicoModel, 'carrera_id': CarreraModel, 'mencion_id': MencionModel,
    'institucion_id': InstitucionModel, 'parentesco_id': ParentescoModel, 'sexo_id': SexoModel,
    'relacion_id': ParentescoModel,
}
_ALIAS_FAMILIAR = {'cedula_familiar': 'cedulaFamiliar', 'fecha_nacimiento': 'fechanacimiento'}


def _id_entero(valor) -> int | None:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


class LectorFichaORM:
    def _registro(self, cedula: str, entidad: str, entidad_id):
        if entidad == 'employee':
            return EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if entidad == 'datos_complementarios':
            return DatosComplementariosTrabajadorModel.objects.filter(cedula=cedula).first()
        if entidad == 'datos_vivienda':
            return DatosViviendaModel.objects.filter(empleado__cedulaidentidad=cedula).first()
        pk = _id_entero(entidad_id)
        if pk is None:
            return None
        if entidad == 'formacion_academica':
            return FormacionAcademicaModel.objects.filter(pk=pk, empleado__cedulaidentidad=cedula).first()
        if entidad == 'contacto_emergencia':
            return ContactoEmergenciaModel.objects.filter(pk=pk, empleado__cedulaidentidad=cedula).first()
        if entidad == 'familiar':
            return EmployeefamilyModel.objects.filter(pk=pk, employeecedula_id=cedula).first()
        return None

    def valor_actual(self, cedula, entidad, entidad_id, campo):
        fila = self._registro(cedula, entidad, entidad_id)
        if fila is None:
            return None
        atributo = _ALIAS_FAMILIAR.get(campo, campo) if entidad == 'familiar' else campo
        valor = getattr(fila, atributo, None)
        return valor.isoformat() if isinstance(valor, date) else valor

    def pertenece_al_trabajador(self, cedula, entidad, entidad_id) -> bool:
        return self._registro(cedula, entidad, entidad_id) is not None

    def existe_registro_unico(self, cedula, entidad) -> bool:
        return self._registro(cedula, entidad, None) is not None

    def validar_referencias(self, valores: dict) -> None:
        for campo, valor in valores.items():
            modelo = _CATALOGOS.get(campo)
            if modelo is not None and valor is not None and not modelo.objects.filter(pk=valor).exists():
                raise ValidationError(f"El valor {valor} de '{campo}' no existe en su catálogo.")
