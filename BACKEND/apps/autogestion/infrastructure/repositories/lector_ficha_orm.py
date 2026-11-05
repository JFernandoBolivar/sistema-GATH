"""
Lectura de la ficha vigente del trabajador (puerto `LectorFicha`, B6).

Es la única capa de autogestión autorizada a leer los modelos de `personal`/`familiares`
(B16: solo `infrastructure` cruza módulos). Solo lectura.
"""
from datetime import date
import unicodedata

from apps.autogestion.domain.value_objects.secciones import TIPO_PRENDA_POR_CAMPO_TALLA
from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    ParentescoModel,
    SexoModel,
    TipoProcedenciaModel,
)
from apps.catalogos.infrastructure.models.geografia_models import EstadoModel, MunicipioModel, ParroquiaModel
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CapacitacionModel,
    CarreraModel,
    CodigoPostalModel,
    CondicionViviendaModel,
    DiscapacidadModel,
    GrupoCapacitacionModel,
    GrupoSanguineoModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
    TallaModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    ContactoEmergenciaModel,
    DatosViviendaModel,
    FormacionAcademicaModel,
    FormacionComplementariaModel,
    PerfilFisicoModel,
    PerfilSaludModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError


def _normalizar(texto: str) -> str:
    """Minúsculas sin acentos, para comparar categorías de catálogo sin fijar sus nombres exactos."""
    descompuesto = unicodedata.normalize('NFKD', str(texto or ''))
    return ''.join(c for c in descompuesto if not unicodedata.combining(c)).strip().lower()


_CATALOGOS = {
    'estado_id': EstadoModel, 'municipio_id': MunicipioModel, 'parroquia_id': ParroquiaModel,
    'condicion_vivienda_id': CondicionViviendaModel, 'codigo_postal_id': CodigoPostalModel,
    'nivel_academico_id': NivelAcademicoModel, 'carrera_id': CarreraModel, 'mencion_id': MencionModel,
    'institucion_id': InstitucionModel, 'parentesco_id': ParentescoModel, 'sexo_id': SexoModel,
    'relacion_id': ParentescoModel, 'capacitacion_id': CapacitacionModel,
    'grupo_id': GrupoCapacitacionModel, 'procedencia_id': TipoProcedenciaModel,
    'estadoCivil_id': EstadoCivilModel, 'grupo_sanguineo_id': GrupoSanguineoModel,
    'talla_camisa_id': TallaModel, 'talla_pantalon_id': TallaModel,
    'talla_zapatos_id': TallaModel, 'talla_chaqueta_id': TallaModel,
}
_CAMPOS_MULTIPLES = {'alergias': AlergiaModel, 'patologias_cronicas': PatologiaCronicaModel, 'discapacidades': DiscapacidadModel}
_ALIAS_PERFIL_SALUD_M2M = {
    'alergias': 'alergias', 'patologias_cronicas': 'patologiaCronica', 'discapacidades': 'discapacidad',
}
_ALIAS_FAMILIAR = {'cedula_familiar': 'cedulaFamiliar', 'fecha_nacimiento': 'fechanacimiento'}
_ALIAS_PERFIL_FISICO = {
    'talla_camisa_id': 'tallaCamisa_id',
    'talla_pantalon_id': 'tallaPantalon_id',
    'talla_zapatos_id': 'tallaZapatos_id',
    'talla_chaqueta_id': 'tallaChaqueta_id',
}


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
        if entidad == 'perfil_salud':
            return PerfilSaludModel.objects.filter(empleado__cedulaidentidad=cedula).first()
        if entidad == 'perfil_fisico':
            return PerfilFisicoModel.objects.filter(empleado__cedulaidentidad=cedula).first()
        pk = _id_entero(entidad_id)
        if pk is None:
            return None
        if entidad == 'formacion_academica':
            return FormacionAcademicaModel.objects.filter(pk=pk, empleado__cedulaidentidad=cedula).first()
        if entidad == 'formacion_complementaria':
            return FormacionComplementariaModel.objects.filter(pk=pk, empleado__cedulaidentidad=cedula).first()
        if entidad == 'contacto_emergencia':
            return ContactoEmergenciaModel.objects.filter(pk=pk, empleado__cedulaidentidad=cedula).first()
        if entidad == 'familiar':
            return EmployeefamilyModel.objects.filter(pk=pk, employeecedula_id=cedula).first()
        return None

    def valor_actual(self, cedula, entidad, entidad_id, campo):
        fila = self._registro(cedula, entidad, entidad_id)
        if fila is None:
            return None
        if entidad == 'perfil_salud' and campo in _CAMPOS_MULTIPLES:
            return sorted(getattr(fila, _ALIAS_PERFIL_SALUD_M2M[campo]).values_list('pk', flat=True))
        if entidad == 'perfil_fisico':
            atributo = _ALIAS_PERFIL_FISICO.get(campo, campo)
        elif entidad == 'familiar':
            atributo = _ALIAS_FAMILIAR.get(campo, campo)
        else:
            atributo = campo
        valor = getattr(fila, atributo, None)
        return valor.isoformat() if isinstance(valor, date) else valor

    def pertenece_al_trabajador(self, cedula, entidad, entidad_id) -> bool:
        return self._registro(cedula, entidad, entidad_id) is not None

    def existe_registro_unico(self, cedula, entidad) -> bool:
        return self._registro(cedula, entidad, None) is not None

    def contar_registros(self, cedula: str, entidad: str) -> int:
        """Cuántos registros de `entidad` tiene hoy el trabajador (para límites como 3 contactos)."""
        if entidad == 'contacto_emergencia':
            return ContactoEmergenciaModel.objects.filter(empleado__cedulaidentidad=cedula).count()
        if entidad == 'formacion_academica':
            return FormacionAcademicaModel.objects.filter(empleado__cedulaidentidad=cedula).count()
        if entidad == 'formacion_complementaria':
            return FormacionComplementariaModel.objects.filter(empleado__cedulaidentidad=cedula).count()
        if entidad == 'familiar':
            return EmployeefamilyModel.objects.filter(employeecedula_id=cedula).count()
        return 0

    def datos_registro(self, cedula: str, entidad: str, entidad_id: str | None) -> dict:
        """Resumen de los valores del registro (para mostrar el «antes» de un QUITAR)."""
        fila = self._registro(cedula, entidad, entidad_id)
        if fila is None:
            return {}
        resultado = {}
        for campo in ('nombres', 'apellidos', 'primer_nombre', 'primer_apellido', 'cedulaFamiliar',
                      'fechaInicio', 'fechaFin', 'nivel_academico_id', 'capacitacion_id'):
            valor = getattr(fila, campo, None)
            if valor is not None:
                resultado[campo] = valor.isoformat() if isinstance(valor, date) else valor
        return resultado

    def validar_referencias(self, valores: dict) -> None:
        for campo, valor in valores.items():
            if campo in _CAMPOS_MULTIPLES:
                modelo = _CAMPOS_MULTIPLES[campo]
                ids = valor or []
                existentes = set(modelo.objects.filter(pk__in=ids).values_list('pk', flat=True))
                faltan = sorted(set(ids) - existentes)
                if faltan:
                    raise ValidationError(
                        f"Los valores {', '.join(map(str, faltan))} de '{campo}' no existen en su catálogo."
                    )
                continue
            modelo = _CATALOGOS.get(campo)
            if modelo is not None and valor is not None and not modelo.objects.filter(pk=valor).exists():
                raise ValidationError(f"El valor {valor} de '{campo}' no existe en su catálogo.")
            token = TIPO_PRENDA_POR_CAMPO_TALLA.get(campo)
            if token and valor is not None:
                talla = TallaModel.objects.select_related('tipo_prenda').filter(pk=valor).first()
                if talla is None or not _normalizar(talla.tipo_prenda.categoria).startswith(token):
                    raise ValidationError(
                        f"La talla elegida para '{campo}' no corresponde al tipo de prenda esperado."
                    )

    def es_parentesco_hijo(self, parentesco_id) -> bool:
        if parentesco_id is None:
            return False
        nombre = ParentescoModel.objects.filter(pk=parentesco_id).values_list(
            'descripcion_parentesco', flat=True,
        ).first() or ''
        return nombre.upper().startswith('HIJO')
