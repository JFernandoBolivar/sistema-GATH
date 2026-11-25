"""Proveedor real de datos de un trabajador para documentos (N-4).

Vive en infraestructura porque lee Personal, Cargos y Familiares. La asignación
vigente solo aporta los datos laborales: un activo sin asignación, o un pasivo,
conserva su identidad, contacto, dirección y fotografía.
"""
import hashlib
from datetime import date

from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.documentos.domain.services.variables_documento import formatear_fecha
from apps.documentos.infrastructure import almacen as almacen_mod
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
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
from apps.personal.infrastructure.repositories.repo_rif_idiomas_orm import RepoRifIdiomasORM
from core.domain.exceptions import NotFoundError
from core.domain.validacion_personas import formatear_telefono

SUJETO_TRABAJADOR = 'trabajador'
_NACIONALIDAD = {'V': 'VENEZOLANO', 'E': 'EXTRANJERO'}


def normalizar_cedula_trabajador(valor) -> str:
    """Acepta la cédula numérica canónica o con prefijo V-/E-."""
    cedula = str(valor or '').strip().upper()
    if cedula.startswith(('V-', 'E-')):
        cedula = cedula[2:]
    return cedula


def _mayus(valor) -> str:
    return str(valor or '').strip().upper()


def _edad(nacimiento, hoy: date) -> str:
    if not nacimiento:
        return ''
    return str(hoy.year - nacimiento.year - ((hoy.month, hoy.day) < (nacimiento.month, nacimiento.day)))


def _nombre_completo(*partes) -> str:
    return ' '.join(_mayus(p) for p in partes if p)


class ProveedorDatosTrabajadorORM:
    """`datos_de('trabajador', <cédula>)`: variables reales del catálogo de documentos."""

    def __init__(self, almacen=None):
        self._almacen = almacen

    def existe(self, cedula: str) -> bool:
        return EmployeeModel.objects.filter(cedulaidentidad=normalizar_cedula_trabajador(cedula)).exists()

    def datos_de(self, sujeto_tipo: str, sujeto_id: str, con_foto: bool = True) -> dict:
        if sujeto_tipo != SUJETO_TRABAJADOR:
            raise NotFoundError('El sujeto del documento no existe.')
        cedula = normalizar_cedula_trabajador(sujeto_id)
        empleado = (EmployeeModel.objects.select_related('sexoid', 'estadoCivil', 'nacionalidad')
                    .filter(cedulaidentidad=cedula).first())
        if empleado is None:
            raise NotFoundError('El trabajador no existe.')
        hoy = date.today()
        nombres, apellidos = _mayus(empleado.nombres), _mayus(empleado.apellidos)
        codigo_nacionalidad = _mayus(getattr(empleado.nacionalidad, 'codigo', '')) or 'V'

        datos = {
            'nombres': nombres, 'apellidos': apellidos, 'nombre_completo': f'{apellidos} {nombres}'.strip(),
            'cedula': f'{codigo_nacionalidad}-{cedula}', 'cedula_numero': cedula,
            'nacionalidad': _NACIONALIDAD.get(codigo_nacionalidad, _mayus(getattr(empleado.nacionalidad, 'nombre', ''))),
            'sexo': _mayus(getattr(empleado.sexoid, 'sexo', '')),
            'estado_civil': _mayus(getattr(empleado.estadoCivil, 'estadoCivil', '')),
            'fecha_nacimiento': formatear_fecha(empleado.fecha_nacimiento),
            'lugar_nacimiento': '', 'edad': _edad(empleado.fecha_nacimiento, hoy), 'rif': _mayus(empleado.rif),
            'profesion': '', 'numero_colegio': '',
            'telefono_principal': formatear_telefono(empleado.telefono_habitacion),
            'telefono_celular': formatear_telefono(empleado.telefono_movil),
            'correo': empleado.correo or '', 'contacto_emergencia': '',
            'estado_residencia': '', 'municipio': '', 'parroquia': '', 'direccion': '',
            'direccion_alterna': '', 'tipo_vivienda': '', 'tenencia_vivienda': '', 'monto_vivienda': '',
            'cargo': '', 'codigo_cargo': '', 'oficina': '', 'division': '', 'coordinacion': '',
            'ubicacion_fisica': '', 'nomina': '', 'tipo_empleado': '', 'fecha_ingreso': '',
            'codigo_empleado': '', 'numero_expediente': str(empleado.origen_expediente or ''),
            'grupo_sanguineo': '', 'alergias': '', 'condiciones_salud': '', 'discapacidad': '',
            'talla_camisa': '', 'talla_pantalon': '', 'talla_calzado': '',
        }
        self._agregar_contacto_y_direccion(datos, empleado, hoy)
        self._agregar_asignacion_vigente(datos, empleado)
        self._agregar_salud_tallas_y_formacion(datos, empleado, hoy)
        self._agregar_listas(datos, empleado, hoy)
        self._agregar_foto(datos, empleado, con_foto)
        return datos

    @staticmethod
    def _agregar_contacto_y_direccion(datos: dict, empleado, hoy: date) -> None:
        emergencia = (ContactoEmergenciaModel.objects.filter(empleado=empleado)
                      .select_related('relacion').order_by('pk').first())
        if emergencia:
            datos['contacto_emergencia'] = ' - '.join(p for p in (
                _nombre_completo(emergencia.nombres, emergencia.apellidos),
                formatear_telefono(emergencia.telefono),
            ) if p)
        vivienda = (DatosViviendaModel.objects.filter(empleado=empleado)
                    .select_related('estado', 'municipio', 'parroquia', 'condicion_vivienda').first())
        if vivienda:
            datos.update({
                'estado_residencia': _mayus(getattr(vivienda.estado, 'estado', '')),
                'municipio': _mayus(getattr(vivienda.municipio, 'municipio', '')),
                'parroquia': _mayus(getattr(vivienda.parroquia, 'parroquia', '')),
                'direccion': _mayus(vivienda.direccion_exacta),
                'tenencia_vivienda': _mayus(getattr(vivienda.condicion_vivienda, 'condicion', '')),
            })

    @staticmethod
    def _agregar_asignacion_vigente(datos: dict, empleado) -> None:
        asignacion = (AsigTrabajoModel.objects
                      .filter(employee=empleado, estatusid__estatus__iexact='ACTIVO')
                      .select_related(
                          'denominacioncargoid', 'denominacioncargoespecificoid', 'tiponominaid',
                          'Dependencia', 'DireccionGeneral', 'DireccionLinea', 'Coordinacion', 'Tipo_personal',
                      ).order_by('-fecha_actualizacion', '-pk').first())
        if asignacion is None:
            return
        especifico = getattr(asignacion.denominacioncargoespecificoid, 'cargo', '')
        datos.update({
            'cargo': _mayus(especifico or getattr(asignacion.denominacioncargoid, 'cargo', '')),
            'codigo_cargo': asignacion.codigo or '', 'codigo_empleado': asignacion.codigo or '',
            'oficina': _mayus(getattr(asignacion.DireccionGeneral, 'direccion_general', '')
                             or getattr(asignacion.Dependencia, 'dependencia', '')),
            'division': _mayus(getattr(asignacion.DireccionLinea, 'direccion_linea', '')),
            'coordinacion': _mayus(getattr(asignacion.Coordinacion, 'coordinacion', '')),
            'nomina': _mayus(getattr(asignacion.tiponominaid, 'nomina', '')),
            'tipo_empleado': _mayus(getattr(asignacion.Tipo_personal, 'tipo_personal', '')),
        })
        ingreso = (AntecedenteServicioModel.objects.filter(empleado=empleado, fecha_egreso__isnull=True)
                   .order_by('-fecha_ingreso', '-pk').values_list('fecha_ingreso', flat=True).first())
        datos['fecha_ingreso'] = formatear_fecha(ingreso)

    @staticmethod
    def _agregar_salud_tallas_y_formacion(datos: dict, empleado, hoy: date) -> None:
        salud = (PerfilSaludModel.objects.filter(empleado=empleado).select_related('grupo_sanguineo')
                 .prefetch_related('alergias', 'patologiaCronica', 'discapacidad').first())
        if salud:
            datos.update({
                'grupo_sanguineo': _mayus(getattr(salud.grupo_sanguineo, 'GrupoSanguineo', '')),
                'alergias': _mayus(', '.join(a.alergia for a in salud.alergias.all())) or 'NINGUNA',
                'condiciones_salud': _mayus(', '.join(p.patologia for p in salud.patologiaCronica.all())) or 'NINGUNA',
                'discapacidad': 'SI' if salud.discapacidad.exists() else 'NO',
            })
        fisico = (PerfilFisicoModel.objects.filter(empleado=empleado)
                  .select_related('tallaCamisa', 'tallaPantalon', 'tallaZapatos').first())
        if fisico:
            datos.update({
                'talla_camisa': _mayus(getattr(fisico.tallaCamisa, 'valor', '')),
                'talla_pantalon': _mayus(getattr(fisico.tallaPantalon, 'valor', '')),
                'talla_calzado': _mayus(getattr(fisico.tallaZapatos, 'valor', '')),
            })
        formacion = (FormacionAcademicaModel.objects.filter(empleado=empleado)
                     .select_related('carrera', 'mencion', 'nivel_academico', 'institucion')
                     .order_by('-pk'))
        primera = formacion.first()
        if primera:
            datos['profesion'] = _mayus(getattr(primera.carrera, 'nombre_carrera', '')
                                       or getattr(primera.nivel_academico, 'nivelacademico', ''))
        datos['estudios'] = [{
            'nivel': _mayus(getattr(f.nivel_academico, 'nivelacademico', '')),
            'titulo': ' - '.join(p for p in (
                _mayus(getattr(f.carrera, 'nombre_carrera', '')), _mayus(getattr(f.mencion, 'nombre_mencion', '')),
            ) if p),
            'institucion': _mayus(getattr(f.institucion, 'nombre_institucion', '')), 'fecha_grado': '',
        } for f in formacion]

    @staticmethod
    def _agregar_listas(datos: dict, empleado, hoy: date) -> None:
        familiares = (EmployeefamilyModel.objects.filter(employeecedula=empleado)
                      .select_related('parentesco', 'sexo').order_by('-updatedat', '-pk'))
        datos['familiares'] = [{
            'nombre_completo': _nombre_completo(
                f.primer_apellido, f.segundo_apellido, f.primer_nombre, f.segundo_nombre,
            ),
            'parentesco': _mayus(getattr(f.parentesco, 'descripcion_parentesco', '')),
            'sexo': _mayus(getattr(f.sexo, 'sexo', ''))[:1], 'cedula': f.cedulaFamiliar or '',
            'fecha_nacimiento': formatear_fecha(f.fechanacimiento),
            'edad': _edad(f.fechanacimiento, hoy), 'ocupacion': '',
        } for f in familiares]
        cursos = (FormacionComplementariaModel.objects.filter(empleado=empleado)
                  .select_related('capacitacion', 'institucion').order_by('-fechaFin', '-pk'))
        datos['cursos'] = [{
            'nombre': _mayus(getattr(c.capacitacion, 'nombre_capacitacion', '')),
            'institucion': _mayus(getattr(c.institucion, 'nombre_institucion', '')),
            'horas': str(c.horas_completadas or ''), 'fecha': formatear_fecha(c.fechaFin),
        } for c in cursos]
        antecedentes = (AntecedenteServicioModel.objects.filter(empleado=empleado)
                        .select_related('organismo').order_by('fecha_ingreso', 'pk'))
        datos['antecedentes'] = [{
            'institucion': _mayus(getattr(a.organismo, 'Organismoadscrito', '')), 'cargo': '',
            'desde': formatear_fecha(a.fecha_ingreso), 'hasta': formatear_fecha(a.fecha_egreso), 'motivo_egreso': '',
        } for a in antecedentes]
        datos['idiomas'] = [{
            'idioma': _mayus(i['nombre']), 'habla': i['nivel'], 'lee': i['nivel'], 'escribe': i['nivel'],
        } for i in RepoRifIdiomasORM().idiomas_de(empleado.cedulaidentidad)]

    def _agregar_foto(self, datos: dict, empleado, con_foto: bool) -> None:
        clave = empleado.foto_objeto or empleado.profile or ''
        if not clave or not isinstance(clave, str) or clave.startswith('data:image/'):
            return
        if not con_foto:
            return
        almacen = self._almacen or almacen_mod.obtener_almacen()
        foto = almacen.descargar(clave)
        datos['foto'] = foto
        datos['_foto_sha256'] = hashlib.sha256(foto).hexdigest()
