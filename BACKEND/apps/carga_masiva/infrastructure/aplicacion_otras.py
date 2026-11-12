"""Aplicación de las demás secciones de una carga masiva."""



from apps.carga_masiva.domain.registro_campos import POBLACION_PASIVOS
from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    ParentescoModel,
)
from apps.catalogos.infrastructure.models.geografia_models import (
    EstadoModel,
    MunicipioModel,
    ParroquiaModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    CapacitacionModel,
    CarreraModel,
    CodigoPostalModel,
    CondicionViviendaModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import PaisModel, TipoProcedenciaModel
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContactoEmergenciaModel,
    DatosViviendaModel,
    FormacionAcademicaModel,
    FormacionComplementariaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError
from core.domain.validacion_personas import normalizar_ciudad_region



from .aplicacion_comun import (
    _fecha,
)





def _aplicar_otras(fila: CargaMasivaFilaModel, usuario_id: int | None = None):
    datos = fila.datos
    empleado = EmployeeModel.objects.filter(cedulaidentidad=datos.get('cedula', '')).first()
    if empleado is None and fila.tipo != 'antecedentes_laborales':
        raise ValidationError('El trabajador no existe.', campo='cedula')
    if fila.tipo == 'contactos_emergencia':
        relacion = ParentescoModel.objects.filter(
            descripcion_parentesco__iexact=datos.get('parentesco_id', ''),
        ).first()
        contacto = ContactoEmergenciaModel.objects.filter(
            empleado_id=empleado.pk, nombres__iexact=datos.get('nombres', ''),
            apellidos__iexact=datos.get('apellidos', ''),
        ).first() or ContactoEmergenciaModel(empleado_id=empleado.pk)
        creado = contacto.pk is None
        contacto.nombres = datos.get('nombres') or contacto.nombres
        contacto.apellidos = datos.get('apellidos') or contacto.apellidos
        contacto.telefono = datos.get('telefono') or contacto.telefono
        contacto.relacion = relacion or contacto.relacion
        contacto.save()
        return {'id': contacto.pk, 'creado': creado}
    if fila.tipo == 'vivienda':
        pais_raw = (datos.get('pais_id') or '').strip()
        pais = None
        es_venezuela = True
        if fila.carga.poblacion == POBLACION_PASIVOS:
            if not pais_raw:
                raise ValidationError('El país es obligatorio para pasivos.', campo='pais_id')
            pais = PaisModel.objects.filter(nombre__iexact=pais_raw).first()
            if not pais:
                raise ValidationError(f'El país «{pais_raw}» no existe en el catálogo.', campo='pais_id')
            es_venezuela = bool(pais.es_venezuela)
        else:
            pais = PaisModel.objects.filter(es_venezuela=True).first()

        vivienda = DatosViviendaModel.objects.filter(empleado_id=empleado.pk).first()
        creado = vivienda is None
        vivienda = vivienda or DatosViviendaModel(empleado_id=empleado.pk)

        if es_venezuela:
            edo_nombre = (datos.get('estado_id') or '').strip()
            estado = EstadoModel.objects.filter(estado__iexact=edo_nombre).first()
            if estado is None:
                raise ValidationError('El estado no existe.', campo='estado_id')

            mun_raw = (datos.get('municipio_id') or '').strip()
            mun_base = mun_raw.split('(')[0].strip() if mun_raw else ''
            municipio = MunicipioModel.objects.filter(estadoid=estado, municipio__iexact=mun_base).first() if mun_base else None
            if municipio is None:
                raise ValidationError(f'El municipio «{mun_raw}» no corresponde al estado «{estado.estado}».', campo='municipio_id')

            par_raw = (datos.get('parroquia_id') or '').strip()
            par_base = par_raw.split('(')[0].strip() if par_raw else ''
            parroquia = ParroquiaModel.objects.filter(municipioid=municipio, parroquia__iexact=par_base).first() if par_base else None
            if parroquia is None:
                raise ValidationError(f'La parroquia «{par_raw}» no corresponde al municipio «{municipio.municipio}».', campo='parroquia_id')

            cp_raw = (datos.get('codigo_postal') or '').strip()
            if not cp_raw:
                raise ValidationError('El código postal es obligatorio para Venezuela.', campo='codigo_postal')
            codigo_postal = CodigoPostalModel.objects.filter(codigo__iexact=cp_raw).first()
            if codigo_postal is None:
                raise ValidationError(f'El código postal «{cp_raw}» no existe.', campo='codigo_postal')
            if codigo_postal.estado_id_id != estado.pk:
                raise ValidationError(
                    f'El código postal «{cp_raw}» no corresponde al estado «{estado.estado}».',
                    campo='codigo_postal',
                )

            vivienda.pais = pais
            vivienda.ciudad_region = ''
            vivienda.estado = estado
            vivienda.municipio = municipio
            vivienda.parroquia = parroquia
            vivienda.codigo_postal = codigo_postal
        else:
            ciudad = normalizar_ciudad_region(datos.get('ciudad_region'))
            if not ciudad:
                raise ValidationError('Indique la ciudad o región para residencia en el exterior.', campo='ciudad_region')
            vivienda.pais = pais
            vivienda.ciudad_region = ciudad
            vivienda.estado = None
            vivienda.municipio = None
            vivienda.parroquia = None
            vivienda.codigo_postal = None

        cond_raw = (datos.get('condicion_vivienda_id') or '').strip()
        condicion = CondicionViviendaModel.objects.filter(condicion__iexact=cond_raw).first() if cond_raw else None
        if not condicion:
            raise ValidationError('Debe indicar una condición de vivienda válida.', campo='condicion_vivienda_id')
        vivienda.condicion_vivienda = condicion

        dir_raw = (datos.get('direccion_exacta') or '').strip()
        if not dir_raw:
            raise ValidationError('La dirección exacta es obligatoria.', campo='direccion_exacta')
        vivienda.direccion_exacta = dir_raw

        vivienda.save()
        return {'id': vivienda.pk, 'creado': creado}
    if fila.tipo == 'formacion_academica':
        nivel_nombre = (datos.get('nivel_academico_id') or datos.get('nivel_academico') or '').strip()
        nivel = NivelAcademicoModel.objects.filter(nivelacademico__iexact=nivel_nombre).first() if nivel_nombre else None
        if nivel is None:
            raise ValidationError('Debe indicar un nivel académico válido.', campo='nivel_academico_id')

        titulo_nombre = (datos.get('titulo') or datos.get('carrera') or '').strip()
        carrera = CarreraModel.objects.filter(nombre_carrera__iexact=titulo_nombre).first() if titulo_nombre else None
        if carrera is None and titulo_nombre:
            carrera, _ = CarreraModel.objects.get_or_create(nombre_carrera=titulo_nombre[:200])

        mencion_nombre = (datos.get('mencion_id') or datos.get('mencion') or '').strip()
        mencion = None
        if mencion_nombre:
            if carrera is None:
                raise ValidationError(
                    'Debe indicar la carrera para registrar la mención.',
                    campo='mencion_id',
                )
            mencion = MencionModel.objects.filter(
                carrera_id=carrera, nombre_mencion__iexact=mencion_nombre,
            ).first()
            if mencion is None:
                raise ValidationError(
                    f'La mención «{mencion_nombre}» no corresponde a la carrera «{carrera.nombre_carrera}».',
                    campo='mencion_id',
                )

        inst_nombre = (datos.get('institucion') or '').strip()
        if titulo_nombre and not inst_nombre:
            raise ValidationError('Debe indicar la institución correspondiente al título/carrera.', campo='institucion')
        institucion = InstitucionModel.objects.filter(nombre_institucion__iexact=inst_nombre).first() if inst_nombre else None
        if institucion is None and inst_nombre:
            institucion, _ = InstitucionModel.objects.get_or_create(nombre_institucion=inst_nombre[:200])

        formacion = FormacionAcademicaModel.objects.filter(
            empleado_id=empleado.pk, nivel_academico=nivel, carrera=carrera,
        ).first() or FormacionAcademicaModel(empleado_id=empleado.pk)
        creado = formacion.pk is None
        formacion.nivel_academico = nivel
        formacion.carrera = carrera
        formacion.mencion = mencion
        formacion.institucion = institucion
        formacion.save()
        return {'id': formacion.pk, 'creado': creado, 'titulo': carrera.nombre_carrera if carrera else ''}
    if fila.tipo == 'formacion_complementaria':
        curso = (datos.get('curso') or '').strip()
        capacitacion, _ = CapacitacionModel.objects.get_or_create(nombre_capacitacion=curso[:200])

        procedencia_nombre = (datos.get('procedencia') or '').strip().upper()
        procedencia = (
            TipoProcedenciaModel.objects.filter(
                tipo_procedencia__iexact=procedencia_nombre,
            ).first()
            if procedencia_nombre else None
        )
        if procedencia is None:
            procedencia = TipoProcedenciaModel.objects.first()
        es_interna = (
            procedencia is not None
            and (procedencia.tipo_procedencia or '').strip().upper() == 'INTERNA'
        )

        inst_nombre = '' if es_interna else (datos.get('institucion') or '').strip()
        institucion = InstitucionModel.objects.filter(nombre_institucion__iexact=inst_nombre).first() if inst_nombre else None
        if institucion is None and inst_nombre:
            institucion, _ = InstitucionModel.objects.get_or_create(nombre_institucion=inst_nombre[:200])

        f_ini = _fecha(datos.get('fecha_inicio'))
        f_fin = _fecha(datos.get('fecha_fin'))
        if f_ini and f_fin and f_fin < f_ini:
            raise ValidationError('La fecha de fin debe ser mayor o igual a la fecha de inicio.', campo='fecha_fin')

        formacion = FormacionComplementariaModel.objects.filter(
            empleado_id=empleado.pk, capacitacion=capacitacion,
        ).first()
        if formacion is None:
            formacion = FormacionComplementariaModel(
                empleado_id=empleado.pk,
                capacitacion=capacitacion,
                procedencia=procedencia,
            )
        formacion.procedencia = procedencia
        formacion.institucion = institucion
        formacion.fechaInicio = f_ini or formacion.fechaInicio
        formacion.fechaFin = f_fin or formacion.fechaFin
        formacion.horas_completadas = str(datos.get('horas') or formacion.horas_completadas or '')
        formacion.save()
        return {'id': formacion.pk}
    if fila.tipo == 'antecedentes_laborales':
        org_nombre = (datos.get('organismo') or datos.get('organismo_id') or '').strip()
        organismo = OrganismoAdscritoModel.objects.filter(Organismoadscrito__iexact=org_nombre).first()
        if organismo is None:
            raise ValidationError(f'El organismo «{org_nombre}» no existe en el catálogo.', campo='organismo')

        f_ing = _fecha(datos.get('fecha_ingreso'))
        f_egr = _fecha(datos.get('fecha_egreso'))
        if not f_ing:
            raise ValidationError('La fecha de ingreso es obligatoria.', campo='fecha_ingreso')
        if f_egr and f_egr < f_ing:
            raise ValidationError('La fecha de egreso debe ser mayor o igual a la fecha de ingreso.', campo='fecha_egreso')

        antecedente = AntecedenteServicioModel.objects.filter(
            empleado_id=empleado.pk, organismo=organismo, fecha_ingreso=f_ing,
        ).first() or AntecedenteServicioModel(
            empleado_id=empleado.pk, organismo=organismo, fecha_ingreso=f_ing,
        )
        antecedente.organismo = organismo
        antecedente.fecha_ingreso = f_ing
        antecedente.fecha_egreso = f_egr
        antecedente.save()
        return {'id': antecedente.pk}
    raise ValidationError(f'Tipo aún no aplicable: {fila.tipo}.')
