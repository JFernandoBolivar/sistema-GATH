"""Aplicación de datos personales, familiares y salud de una carga masiva."""
from datetime import date



from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
)
from apps.configuracion.infrastructure.models.regla_parentesco_model import (
    ReglaParentescoModel,
)
from apps.familiares.application.use_cases.validaciones_familiar import (
    ReglaParentescoFamiliar,
    regla_por_defecto,
    resolver_cedula_familiar,
    validar_reglas_familiar,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    DiscapacidadModel,
    PatologiaCronicaModel,
    TallaModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    PerfilFisicoModel,
    PerfilSaludAlergias,
    PerfilSaludDiscapacidad,
    PerfilSaludModel,
    PerfilSaludPatologia,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError



from .aplicacion_comun import (
    _id,
)



def _aplicar_datos_personales(fila: CargaMasivaFilaModel):
    datos = fila.datos
    empleado = EmployeeModel.objects.filter(cedulaidentidad=datos['cedula']).first()
    creado = empleado is None
    sexo_id = _id(SexoModel, datos.get('sexo_id'))
    nacionalidad_id = _id(NacionalidadModel, datos.get('nacionalidad_id'))
    if creado:
        if not sexo_id or not nacionalidad_id:
            raise ValidationError('El sexo y la nacionalidad son obligatorios para crear el trabajador.')
        empleado = EmployeeModel(
            cedulaidentidad=datos['cedula'], nacionalidad_id=nacionalidad_id, sexoid_id=sexo_id,
        )
    empleado.nombres = datos.get('nombres') or empleado.nombres
    empleado.apellidos = datos.get('apellidos') or empleado.apellidos
    if sexo_id:
        empleado.sexoid_id = sexo_id
    if nacionalidad_id:
        empleado.nacionalidad_id = nacionalidad_id
    estado_civil_id = _id(EstadoCivilModel, datos.get('estado_civil_id'))
    if creado and not estado_civil_id:
        raise ValidationError('El estado civil es obligatorio para crear el trabajador.')
    if estado_civil_id:
        empleado.estadoCivil_id = estado_civil_id
    if datos.get('fecha_nacimiento'):
        empleado.fecha_nacimiento = datos['fecha_nacimiento']
    for campo in ('correo', 'telefono_movil', 'telefono_habitacion'):
        if datos.get(campo):
            setattr(empleado, campo, datos[campo])
    empleado.save()
    return {'creado': creado}

def _aplicar_familiar(fila: CargaMasivaFilaModel):
    datos = fila.datos
    titular = EmployeeModel.objects.filter(cedulaidentidad=datos['cedula_titular']).first()
    if titular is None:
        raise ValidationError('El titular no existe.', campo='cedula_titular')
    parentesco = ParentescoModel.objects.filter(
        descripcion_parentesco__iexact=datos.get('parentesco_id', ''),
    ).first()
    if parentesco is None:
        raise ValidationError('El parentesco no existe.', campo='parentesco_id')
    sexo = SexoModel.objects.filter(sexo__iexact=datos.get('sexo_id', '')).first()
    if sexo is None:
        raise ValidationError('El sexo del familiar no existe.', campo='sexo_id')
    regla_guardada = ReglaParentescoModel.objects.filter(parentesco_id=parentesco.pk).first()
    regla = regla_por_defecto(parentesco.descripcion_parentesco)
    if regla_guardada is not None:
        regla = ReglaParentescoFamiliar(
            descripcion=parentesco.descripcion_parentesco,
            es_hijo=regla_guardada.es_hijo,
            menor_a_cargo=regla_guardada.menor_a_cargo,
            sin_cedula_hasta_edad=regla_guardada.sin_cedula_hasta_edad,
            edad_minima=regla_guardada.edad_minima,
            diferencia_minima=regla_guardada.diferencia_minima,
            diferencia_tipo=regla_guardada.diferencia_tipo,
            sexo_permitido=regla_guardada.sexo_permitido,
            soporte_sugerido=regla_guardada.soporte_sugerido,
            activo=regla_guardada.activo,
        )
    familiar = EmployeefamilyModel.objects.filter(
        employeecedula_id=titular.cedulaidentidad,
        cedulaFamiliar=datos.get('cedula_familiar') or None,
    ).first()
    creado = familiar is None
    if creado:
        familiar = EmployeefamilyModel(employeecedula_id=titular.cedulaidentidad)
    fecha_nacimiento = datos.get('fecha_nacimiento')
    if isinstance(fecha_nacimiento, str):
        fecha_nacimiento = date.fromisoformat(fecha_nacimiento)
    try:
        validar_reglas_familiar(
            regla=regla,
            fecha_nacimiento=fecha_nacimiento,
            fecha_nacimiento_titular=titular.fecha_nacimiento,
            sexo=sexo.sexo,
        )
    except ValueError as exc:
        raise ValidationError(str(exc), campo='fecha_nacimiento') from None
    cedula = (datos.get('cedula_familiar') or '').strip() or None
    if creado:
        existentes = {
            str(c) for c in EmployeefamilyModel.objects.filter(
                employeecedula_id=titular.cedulaidentidad,
            ).values_list('cedulaFamiliar', flat=True) if c
        }
        cedula = resolver_cedula_familiar(
            cedula_familiar=cedula,
            cedula_empleado=str(titular.cedulaidentidad),
            fecha_nacimiento=fecha_nacimiento,
            orden_hijo=datos.get('orden_hijo'),
            cedulas_existentes=existentes,
            regla=regla,
        )
    familiar.cedulaFamiliar = cedula or familiar.cedulaFamiliar
    familiar.primer_nombre = datos.get('nombres') or familiar.primer_nombre
    familiar.primer_apellido = datos.get('apellidos') or familiar.primer_apellido
    familiar.parentesco = parentesco
    familiar.sexo = sexo
    familiar.fechanacimiento = fecha_nacimiento
    familiar.orden_hijo = datos.get('orden_hijo') or familiar.orden_hijo
    familiar.save()
    return {'creado': creado, 'id': familiar.pk}

def _aplicar_salud_tallas(fila: CargaMasivaFilaModel):
    datos = fila.datos
    empleado = EmployeeModel.objects.filter(cedulaidentidad=datos.get('cedula', '')).first()
    if empleado is None:
        raise ValidationError('El trabajador no existe.', campo='cedula')

    perfil = PerfilSaludModel.objects.filter(empleado_id=empleado.pk).first()
    if perfil is None:
        perfil = PerfilSaludModel.objects.create(empleado_id=empleado.pk)

    discapacidad = DiscapacidadModel.objects.filter(
        discapacidad__iexact=datos.get('discapacidad_id', ''),
    ).first()
    if datos.get('discapacidad_id') and discapacidad is None:
        raise ValidationError('La discapacidad no existe.', campo='discapacidad_id')
    if discapacidad:
        PerfilSaludDiscapacidad.objects.get_or_create(
            perfil_salud=perfil, discapacidades=discapacidad,
        )

    alergia = AlergiaModel.objects.filter(alergia__iexact=datos.get('alergia_id', '')).first()
    if datos.get('alergia_id') and alergia is None:
        raise ValidationError('La alergia no existe.', campo='alergia_id')
    if alergia:
        PerfilSaludAlergias.objects.get_or_create(perfil_salud=perfil, alergias=alergia)

    patologia = PatologiaCronicaModel.objects.filter(
        patologia__iexact=datos.get('patologia_id', ''),
    ).first()
    if datos.get('patologia_id') and patologia is None:
        raise ValidationError('La patología no existe.', campo='patologia_id')
    if patologia:
        PerfilSaludPatologia.objects.get_or_create(
            perfil_salud=perfil, patologias_cronicas=patologia,
        )

    fisico = PerfilFisicoModel.objects.filter(empleado_id=empleado.pk).first()
    if fisico is None:
        fisico = PerfilFisicoModel(empleado_id=empleado.pk)
    campos_talla = {
        'talla_camisa': ('tallaCamisa', 'camisa'),
        'talla_pantalon': ('tallaPantalon', 'pantalon'),
        'talla_zapato': ('tallaZapatos', 'zapato'),
    }
    for clave, (campo, prenda) in campos_talla.items():
        valor = datos.get(clave)
        if not valor:
            continue
        talla = TallaModel.objects.filter(
            valor__iexact=valor, tipo_prenda__categoria__icontains=prenda,
        ).first()
        if talla is None:
            raise ValidationError(f'La talla de {prenda} no existe.', campo=clave)
        setattr(fisico, campo, talla)
    fisico.save()
    return {'perfil_salud_id': perfil.pk, 'perfil_fisico_id': fisico.pk}
