"""
Lectura de la ficha vigente del trabajador (puerto `LectorFicha`, B6).

Es la única capa de autogestión autorizada a leer los modelos de `personal`/`familiares`
(B16: solo `infrastructure` cruza módulos). Solo lectura.
"""
from datetime import date
import re
import unicodedata

from apps.autogestion.domain.value_objects.secciones import TIPO_PRENDA_POR_CAMPO_TALLA
from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    PaisModel,
    ParentescoModel,
    SexoModel,
    TipoProcedenciaModel,
)
from apps.catalogos.infrastructure.models.geografia_models import EstadoModel, MunicipioModel, ParroquiaModel
from apps.configuracion.infrastructure.models.regla_parentesco_model import (
    ReglaParentescoModel,
)
from apps.familiares.application.use_cases.validaciones_familiar import (
    ReglaParentescoFamiliar,
    es_menor_de_edad,
    regla_por_defecto,
    resolver_cedula_familiar,
    validar_reglas_familiar,
)
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
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
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
    'estadoCivil_id': EstadoCivilModel, 'pais_id': PaisModel, 'grupo_sanguineo_id': GrupoSanguineoModel,
    'organismo_id': OrganismoAdscritoModel,
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
        if entidad == 'antecedente_servicio':
            return AntecedenteServicioModel.objects.filter(pk=pk, empleado__cedulaidentidad=cedula).first()
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
        if entidad == 'antecedente_servicio':
            return AntecedenteServicioModel.objects.filter(empleado__cedulaidentidad=cedula).count()
        return 0

    def datos_registro(self, cedula: str, entidad: str, entidad_id: str | None) -> dict:
        """Resumen de los valores del registro (para mostrar el «antes» de un QUITAR)."""
        fila = self._registro(cedula, entidad, entidad_id)
        if fila is None:
            return {}
        resultado = {}
        for campo in ('nombres', 'apellidos', 'primer_nombre', 'primer_apellido', 'cedulaFamiliar',
                      'fechaInicio', 'fechaFin', 'nivel_academico_id', 'capacitacion_id',
                      'organismo_id', 'fecha_ingreso', 'fecha_egreso'):
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

    def es_pais_venezuela(self, pais_id: int | None) -> bool:
        """Sin país se asume Venezuela: es el valor por defecto del sistema."""
        if pais_id is None:
            return True
        return bool(
            PaisModel.objects.filter(pk=pais_id, es_venezuela=True).exists()
        )

    def _regla_familiar(self, parentesco_id) -> ReglaParentescoFamiliar:
        if parentesco_id is None:
            return ReglaParentescoFamiliar()
        parentesco = ParentescoModel.objects.filter(pk=parentesco_id).first()
        if parentesco is None:
            return ReglaParentescoFamiliar()
        guardada = ReglaParentescoModel.objects.filter(
            parentesco_id=parentesco_id,
        ).first()
        if guardada is None:
            return regla_por_defecto(parentesco.descripcion_parentesco)
        return ReglaParentescoFamiliar(
            descripcion=parentesco.descripcion_parentesco,
            es_hijo=guardada.es_hijo,
            menor_a_cargo=guardada.menor_a_cargo,
            sin_cedula_hasta_edad=guardada.sin_cedula_hasta_edad,
            edad_minima=guardada.edad_minima,
            diferencia_minima=guardada.diferencia_minima,
            diferencia_tipo=guardada.diferencia_tipo,
            sexo_permitido=guardada.sexo_permitido,
            soporte_sugerido=guardada.soporte_sugerido,
            activo=guardada.activo,
        )

    def es_parentesco_hijo(self, parentesco_id) -> bool:
        return self._regla_familiar(parentesco_id).es_hijo

    def validar_familiar_alta(self, cedula: str, valores: dict) -> str | None:
        """Alta de familiar: reutiliza `resolver_cedula_familiar` del módulo de familiares.

        La cédula es obligatoria salvo para un(a) hijo(a) menor de 9 años, a quien se le
        genera `<cédula del titular>-<orden elegido>`. El orden es obligatorio y aquí se
        valida también el duplicado.

        Devuelve la cédula que se generará al aprobar (o `None` si el familiar trae la
        suya) y **no modifica `valores`**: la revisión la calcula para mostrarla y la
        aprobación la vuelve a resolver. Escribirla en el valor propuesto dejaba el
        borrador trabado, porque al reenviarlo se rechazaba como campo no editable.
        """
        from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel

        fecha = valores.get('fecha_nacimiento')
        if isinstance(fecha, str):
            try:
                fecha = date.fromisoformat(fecha)
            except ValueError:
                fecha = None
        existentes = {
            str(c) for c in EmployeefamilyModel.objects.filter(
                employeecedula_id=cedula,
            ).values_list('cedulaFamiliar', flat=True) if c
        }
        regla = self._regla_familiar(valores.get('parentesco_id'))
        if not regla.activo:
            raise ValidationError(
                'El parentesco seleccionado está desactivado en el catálogo.',
                campo='parentesco_id',
            )
        titular = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        sexo_id = valores.get('sexo_id')
        sexo_nombre = (
            SexoModel.objects.filter(pk=sexo_id).values_list('sexo', flat=True).first()
            if sexo_id is not None else None
        )
        try:
            validar_reglas_familiar(
                regla=regla,
                fecha_nacimiento=fecha,
                fecha_nacimiento_titular=titular.fecha_nacimiento if titular else None,
                sexo=sexo_nombre,
            )
        except ValueError as exc:
            campo = 'sexo_id' if 'sexo' in str(exc).lower() else 'fecha_nacimiento'
            raise ValidationError(str(exc), campo=campo) from None
        try:
            resuelta = resolver_cedula_familiar(
                cedula_familiar=valores.get('cedula_familiar'),
                cedula_empleado=cedula,
                fecha_nacimiento=fecha,
                orden_hijo=valores.get('orden_hijo'),
                cedulas_existentes=existentes,
                regla=regla,
            )
        except ValueError as exc:
            campo = 'orden_hijo' if 'orden' in str(exc).lower() else 'cedula_familiar'
            raise ValidationError(str(exc), campo=campo) from None
        if (valores.get('cedula_familiar') or '').strip():
            return None
        return resuelta

    def validar_familiar_cambio(self, cedula: str, entidad_id: str, valores: dict) -> None:
        """FIX-FAM2: valida el estado final del familiar al editar campos sensibles."""
        familiar = EmployeefamilyModel.objects.filter(
            pk=entidad_id, employeecedula_id=cedula,
        ).first()
        if familiar is None:
            return
        parentesco_id = valores.get('parentesco_id', familiar.parentesco_id)
        regla = self._regla_familiar(parentesco_id)
        if not regla.activo:
            raise ValidationError(
                'El parentesco seleccionado está desactivado en el catálogo.',
                campo='parentesco_id',
            )
        fecha = valores.get('fecha_nacimiento', familiar.fechanacimiento)
        if isinstance(fecha, str):
            try:
                fecha = date.fromisoformat(fecha)
            except ValueError:
                fecha = None
        sexo_id = valores.get('sexo_id', familiar.sexo_id)
        sexo_nombre = (
            SexoModel.objects.filter(pk=sexo_id).values_list('sexo', flat=True).first()
            if sexo_id is not None else None
        )
        titular = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        try:
            validar_reglas_familiar(
                regla=regla,
                fecha_nacimiento=fecha,
                fecha_nacimiento_titular=titular.fecha_nacimiento if titular else None,
                sexo=sexo_nombre,
            )
        except ValueError as exc:
            campo = 'sexo_id' if 'sexo' in str(exc).lower() else 'fecha_nacimiento'
            raise ValidationError(str(exc), campo=campo) from None

        cedula_final = str(
            valores.get('cedula_familiar', familiar.cedulaFamiliar) or ''
        ).strip()
        if not cedula_final:
            raise ValidationError(
                'La cédula del familiar es obligatoria.', campo='cedula_familiar',
            )
        es_correlativa = bool(
            re.fullmatch(rf'{re.escape(cedula.strip())}-\d+', cedula_final)
        )
        if es_correlativa:
            if (
                'cedula_familiar' in valores
                and cedula_final != (familiar.cedulaFamiliar or '')
            ):
                raise ValidationError(
                    'No escriba la cédula correlativa a mano: deje la cédula vacía '
                    'y seleccione el orden de nacimiento.',
                    campo='cedula_familiar',
                )
            if not regla.permite_cedula_sintetica:
                raise ValidationError(
                    f'El parentesco «{regla.descripcion}» no permite la cédula '
                    'correlativa; registre la cédula propia del familiar.',
                    campo='cedula_familiar',
                )
            if (
                regla.sin_cedula_hasta_edad is None
                or fecha is None
                or not es_menor_de_edad(fecha, regla.sin_cedula_hasta_edad)
            ):
                raise ValidationError(
                    'El familiar ya no cumple la edad para la cédula correlativa; '
                    'registre su cédula propia.',
                    campo='cedula_familiar',
                )

    def validar_correo_alternativo(self, cedula: str, correo_alternativo: str) -> None:
        if not correo_alternativo or not str(correo_alternativo).strip():
            return
        alt = str(correo_alternativo).strip().lower()
        propio = EmployeeModel.objects.filter(
            cedulaidentidad=str(cedula).strip()
        ).values_list('correo', flat=True).first()
        if propio and propio.strip().lower() == alt:
            raise ValidationError(
                'El correo alternativo debe ser distinto del institucional.',
                campo='correo_alternativo',
            )
        if EmployeeModel.objects.filter(correo__iexact=alt).exists():
            raise ValidationError(
                'El correo alternativo ya está en uso como correo institucional.',
                campo='correo_alternativo',
            )
        qs_alt = DatosComplementariosTrabajadorModel.objects.filter(correo_alternativo__iexact=alt)
        if cedula:
            qs_alt = qs_alt.exclude(cedula=str(cedula).strip())
        if qs_alt.exists():
            raise ValidationError(
                'El correo alternativo ya está en uso por otro trabajador.',
                campo='correo_alternativo',
            )
