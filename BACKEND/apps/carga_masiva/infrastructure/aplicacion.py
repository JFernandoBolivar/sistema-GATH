"""Aplicación y reversión de una carga masiva (O28-F4, FIX-CARGA1).

Ningún cambio de condición se escribe con un `update` directo: se registra por
los flujos existentes de Movimientos/Cargos y Pasivos, que emiten
`cargo_movimiento_ejecutado` (historial, avisos, ciclo de vida de cuentas y
carnetización por egreso).
"""
from datetime import date, datetime, time

import logging

from django.db import transaction
from django.db.models import ProtectedError
from django.utils import timezone

from core.domain.catalogos import TIPO_PERSONAL_PASIVO
from apps.carga_masiva.domain.condicion import puede_aplicarse, puede_confirmarse
from apps.carga_masiva.domain.registro_campos import POBLACION_ACTIVOS, POBLACION_PASIVOS
from apps.carga_masiva.infrastructure.cargo_resolucion import resolver_datos_cargo
from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel, CargaMasivaModel
from apps.cargos.application.dtos.cargos_dtos import CrearCargoDTO
from apps.cargos.application.use_cases.crear_cargo import crear_cargo
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
)
from apps.catalogos.infrastructure.models.geografia_models import (
    EstadoModel,
    MunicipioModel,
    ParroquiaModel,
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
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.pasivos.infrastructure.models.pasivo_models import (
    CargoEgresadoModel,
    EmployeeEgresadoModel,
)
from apps.pasivos.infrastructure.repositories.repo_pasivos_orm import RepoPasivosORM
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CapacitacionModel,
    CarreraModel,
    CodigoPostalModel,
    CondicionViviendaModel,
    DiscapacidadModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
    TallaModel,
    TipoPrendaModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import PaisModel, TipoProcedenciaModel
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContactoEmergenciaModel,
    DatosViviendaModel,
    FormacionAcademicaModel,
    FormacionComplementariaModel,
    PerfilFisicoModel,
    PerfilSaludAlergias,
    PerfilSaludDiscapacidad,
    PerfilSaludModel,
    PerfilSaludPatologia,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.configuracion import CLAVE_CARGA_MASIVA_APROBACION
from core.domain.exceptions import ConflictError, ValidationError
from core.domain.validacion_personas import normalizar_ciudad_region
from core.domain.notificaciones import SolicitudNotificacion
from core.infrastructure.providers import obtener_lector_configuracion, obtener_notificador
from core.presentation.audit import registrar_auditoria

from apps.carga_masiva.domain.constantes import (
    PERMISO_APROBAR,
    TIPO_NOTIFICACION_PENDIENTE,
)


def _id(modelo, nombre):
    if not nombre:
        return None
    campo = 'sexo' if modelo is SexoModel else 'nombre' if modelo is NacionalidadModel else 'estadoCivil'
    return modelo.objects.filter(**{f'{campo}__iexact': nombre}).values_list('id', flat=True).first()


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


def _aplicar_cargo(fila: CargaMasivaFilaModel, usuario_id: int | None):
    datos = fila.datos
    empleado = EmployeeModel.objects.filter(cedulaidentidad=datos.get('cedula', '')).first()
    if empleado is None:
        raise ValidationError('El trabajador no existe.', campo='cedula')

    datos_cargo = (fila.anteriores or {}).get('cargo_datos') or resolver_datos_cargo(datos)
    motivo_id = datos_cargo.get('motivo_id') or (fila.movimiento or {}).get('motivo_id')
    repo = RepoCargosORM()
    # FIX-CARGA4: se reutiliza el MISMO caso de uso de crear cargo y la
    # asignación por Movimientos, sin duplicar la generación del código.
    nuevo = crear_cargo(repo, CrearCargoDTO(
        denominacion_id=datos_cargo['denominacion_id'],
        especifica_id=datos_cargo['especifica_id'],
        tipo_nomina_id=datos_cargo['tipo_nomina_id'],
        dependencia_id=datos_cargo.get('dependencia_id'),
        direccion_general_id=datos_cargo.get('direccion_general_id'),
        direccion_linea_id=datos_cargo.get('direccion_linea_id'),
        coordinacion_id=datos_cargo.get('coordinacion_id'),
        organismo_id=datos_cargo.get('organismo_id'),
        grado_id=datos_cargo.get('grado_id'),
        observaciones=datos_cargo.get('observaciones') or '',
    ))
    repo.asignar_cargo_a_empleado(
        nuevo.id, empleado.cedulaidentidad,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )
    fecha_ingreso = datos.get('fecha_ingreso')
    antecedente = None
    antecedente_creado = False
    if fecha_ingreso:
        antecedente, antecedente_creado = AntecedenteServicioModel.objects.get_or_create(
            empleado_id=empleado.pk,
            fecha_ingreso=fecha_ingreso,
            defaults={'fecha_egreso': None},
        )
    return {
        'cargo_id': nuevo.id,
        'cargo_codigo': nuevo.codigo,
        'cargo_creado': True,
        'antecedente_id': antecedente.pk if antecedente else None,
        'antecedente_creado': antecedente_creado,
    }


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


def _fecha(valor) -> date | None:
    if isinstance(valor, date):
        return valor
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        return None


def _es_origen_movimiento(fila: CargaMasivaFilaModel) -> bool:
    movimiento = fila.movimiento or {}
    origen = movimiento.get('origen') or {}
    return (
        origen.get('tipo') == fila.tipo
        and int(origen.get('numero_fila') or 0) == int(fila.numero_fila)
    )


def _cedula_de(fila: CargaMasivaFilaModel) -> str:
    return str(fila.datos.get('cedula') or fila.datos.get('cedula_titular') or '')


def _mover_a_pasivo(fila: CargaMasivaFilaModel, movimiento: dict, actor_id: int | None) -> None:
    """Activo → pasivo por el flujo existente; guarda el rastro para revertir."""
    cedula = _cedula_de(fila)
    empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
    if empleado is None:
        raise ValidationError('El trabajador no existe.', campo='cedula')
    motivo_id = movimiento.get('motivo_id')
    tipo_nomina_id = movimiento.get('tipo_nomina_id')
    if not motivo_id or not tipo_nomina_id:
        raise ValidationError(
            'El movimiento a pasivo requiere motivo y tipo de nómina de pasivo.',
            campo='movimiento',
        )
    cargos_activos = list(
        AsigTrabajoModel.objects.filter(employee=empleado)
        .exclude(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO)
        .values_list('pk', flat=True)
    )
    egresos_previos = set(
        EmployeeEgresadoModel.objects.filter(employee=empleado).values_list('pk', flat=True)
    )
    fecha = _fecha(movimiento.get('fecha'))
    fecha_egreso = (
        timezone.make_aware(datetime.combine(fecha, time.min)) if fecha else None
    )
    RepoPasivosORM().procesar_egreso_a_pasivo(
        cedula=cedula,
        motivo_movimiento_id=int(motivo_id),
        tipo_nomina_id=int(tipo_nomina_id),
        liberar_activos=True,
        usuario_id=actor_id,
        fecha_egreso=fecha_egreso,
    )
    pasivo = (
        AsigTrabajoModel.objects.filter(
            employee=empleado, Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
        )
        .order_by('-fecha_actualizacion')
        .first()
    )
    egreso = (
        EmployeeEgresadoModel.objects.filter(employee=empleado)
        .exclude(pk__in=egresos_previos)
        .order_by('-pk')
        .first()
    )
    movimiento.update({
        'aplicado': True,
        'pasivo_cargo_id': pasivo.pk if pasivo else None,
        'cargos_activos_liberados': cargos_activos,
        'egreso_id': egreso.pk if egreso else None,
    })
    fila.movimiento = movimiento


def _mover_a_activo(fila: CargaMasivaFilaModel, movimiento: dict, actor_id: int | None) -> None:
    """Pasivo → activo: libera el puesto pasivo y deja que Cargos asigne el activo.

    El cargo activo lo asigna `_aplicar_cargo` con
    `RepoCargosORM.asignar_cargo_a_empleado`, que emite INGRESO. Aquí solo se
    cierra la asignación pasiva con el flujo existente `desasignar_cargo` y se
    retiran los snapshots de egreso que impedían que la condición derivada
    volviera a ACTIVO.
    """
    cedula = _cedula_de(fila)
    pasivo = (
        AsigTrabajoModel.objects.filter(
            employee_id=cedula, Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
        )
        .order_by('-fecha_actualizacion')
        .first()
    )
    if pasivo is None:
        raise ValidationError('La cédula no tiene una asignación pasiva vigente.', campo='cedula')
    mov = dict(movimiento)
    mov.update({
        'aplicado': True,
        'pasivo_cargo_id': pasivo.pk,
        'tipo_nomina_pasivo_id': pasivo.tiponominaid_id,
        'cargo_activo_id': mov.get('cargo_id'),
        'egresos_eliminados': list(
            EmployeeEgresadoModel.objects.filter(employee_id=cedula).values_list('pk', flat=True)
        ),
    })
    RepoCargosORM().desasignar_cargo(pasivo.pk, usuario_id=actor_id)
    for egreso in EmployeeEgresadoModel.objects.filter(employee_id=cedula):
        CargoEgresadoModel.objects.filter(egreso=egreso).delete()
        egreso.delete()
    fila.movimiento = mov


def _aplicar_cambio_condicion(
    fila: CargaMasivaFilaModel, movimientos_hechos: set[str], actor_id: int | None,
) -> None:
    movimiento = dict(fila.movimiento or {})
    if not movimiento:
        raise ValidationError('La fila requiere confirmación pero no tiene movimiento.')
    completo, mensaje = puede_confirmarse(fila.estado, movimiento)
    if not completo:
        raise ValidationError(mensaje, campo='movimiento')
    cedula = _cedula_de(fila)
    if _es_origen_movimiento(fila):
        if cedula in movimientos_hechos:
            return
        if movimiento.get('tipo') == 'ACTIVO_A_PASIVO':
            _mover_a_pasivo(fila, movimiento, actor_id)
        elif movimiento.get('tipo') == 'PASIVO_A_ACTIVO':
            _mover_a_activo(fila, movimiento, actor_id)
        else:
            raise ValidationError('El tipo de movimiento de condición no es válido.', campo='movimiento')
        movimientos_hechos.add(cedula)
        return
    if cedula not in movimientos_hechos:
        raise ValidationError(
            'Primero confirme y aplique la fila que registra el cambio de condición de esta cédula.',
            campo='movimiento',
        )


logger = logging.getLogger(__name__)


def _requiere_aprobacion() -> bool:
    lector = obtener_lector_configuracion()
    if lector is None:
        return False
    return bool(lector.obtener_booleano(CLAVE_CARGA_MASIVA_APROBACION))


def aplicar_carga(
    carga: CargaMasivaModel, actor_cedula: str, actor_id: int | None = None,
) -> CargaMasivaModel:
    if carga.estado == CargaMasivaModel.Estado.PENDIENTE_APROBACION:
        if carga.solicitada_por_cedula == actor_cedula:
            raise ConflictError('Otra persona debe aprobar esta carga.')
    elif carga.estado != CargaMasivaModel.Estado.ANALIZADA:
        raise ConflictError('La carga no está lista para aplicarse.')
    if _requiere_aprobacion() and carga.aprobada_por_cedula == '':
        carga.estado = CargaMasivaModel.Estado.PENDIENTE_APROBACION
        carga.save(update_fields=['estado'])
        _notificar_aprobacion(carga)
        raise ConflictError('La carga requiere la aprobación de otra persona.')
    aplicadas = 0
    fallidas = 0
    with transaction.atomic():
        # L2-05: se revalida el estado con la carga bloqueada; una segunda
        # aplicación concurrente espera aquí y encuentra la carga ya aplicada.
        bloqueada = CargaMasivaModel.objects.select_for_update().get(pk=carga.pk)
        if bloqueada.estado not in (
            CargaMasivaModel.Estado.ANALIZADA,
            CargaMasivaModel.Estado.PENDIENTE_APROBACION,
        ):
            raise ConflictError('La carga no está lista para aplicarse.')
        carga.estado = bloqueada.estado
        filas = list(carga.filas.select_for_update())
        # Los movimientos de condición se resuelven primero para que las demás
        # filas de la misma cédula encuentren el movimiento ya ejecutado.
        # Las altas de datos personales van primero: el cargo y las demás
        # secciones de una cédula nueva necesitan que el empleado exista.
        filas.sort(key=lambda f: (
            0 if f.tipo == 'datos_personales' else (
                1 if _es_origen_movimiento(f) else 2
            ),
            f.numero_fila,
        ))
        movimientos_hechos: set[str] = set()
        for fila in filas:
            if fila.aplicada or not puede_aplicarse(fila.estado, fila.confirmada):
                continue
            cedula = _cedula_de(fila)
            try:
                # Savepoint por fila: un error de BD no invalida el lote completo.
                with transaction.atomic():
                    if fila.estado == CargaMasivaFilaModel.Estado.REQUIERE_CONFIRMACION:
                        _aplicar_cambio_condicion(fila, movimientos_hechos, actor_id)
                    if fila.tipo == 'datos_personales':
                        anteriores = _aplicar_datos_personales(fila)
                    elif fila.tipo == 'familiares':
                        anteriores = _aplicar_familiar(fila)
                    elif fila.tipo == 'cargo_asignacion':
                        anteriores = _aplicar_cargo(fila, actor_id)
                        if fila.movimiento.get('tipo') == 'PASIVO_A_ACTIVO':
                            fila.movimiento['cargo_activo_id'] = anteriores.get('cargo_id')
                    elif fila.tipo == 'salud_tallas':
                        anteriores = _aplicar_salud_tallas(fila)
                    else:
                        anteriores = _aplicar_otras(fila, actor_id)
                    fila.anteriores = {**fila.anteriores, **anteriores}
                    fila.aplicada = True
                    fila.error_aplicacion = ''
                _auditar_fila(carga, fila, actor_id, actor_cedula)
                aplicadas += 1
            except Exception as exc:  # noqa: BLE001
                movimientos_hechos.discard(cedula)
                fila.error_aplicacion = str(exc)[:300]
                fallidas += 1
            fila.save(update_fields=['aplicada', 'anteriores', 'error_aplicacion', 'movimiento'])
        carga.filas_confirmadas = carga.filas.filter(confirmada=True).count()
        carga.estado = CargaMasivaModel.Estado.APLICADA
        carga.aplicada_en = timezone.now()
        carga.save(update_fields=['estado', 'aplicada_en', 'filas_confirmadas'])
    # L2-11: no existe un estado intermedio sin cambiar la interfaz; la carga
    # queda APLICADA y el conteo de filas fallidas se registra en el log. El
    # detalle por fila sigue en `error_aplicacion`.
    carga.filas_fallidas_aplicacion = fallidas
    if fallidas:
        logger.warning(
            'Carga masiva %s aplicada con %s fila(s) fallida(s) de %s.',
            carga.pk, fallidas, aplicadas + fallidas,
        )
    return carga


def confirmar_filas(
    carga: CargaMasivaModel,
    fila_ids: list[str],
    actor_cedula: str,
    actor_id: int | None = None,
) -> CargaMasivaModel:
    """Confirma el movimiento de una o varias filas de cambio de condición.

    Sin esta confirmación explícita la fila no se aplica. La confirmación es
    idempotente y puede hacerse mientras la carga espera aprobación.
    """
    if carga.estado not in (
        CargaMasivaModel.Estado.ANALIZADA,
        CargaMasivaModel.Estado.PENDIENTE_APROBACION,
    ):
        raise ConflictError('Solo se confirman filas de una carga analizada o pendiente de aprobación.')
    if not fila_ids:
        raise ValidationError('Seleccione al menos una fila para confirmar.', campo='filas')
    with transaction.atomic():
        filas = list(carga.filas.select_for_update().filter(pk__in=fila_ids))
        if len(filas) != len(set(fila_ids)):
            raise ValidationError('Alguna de las filas indicadas no existe en esta carga.', campo='filas')
        for fila in filas:
            completo, mensaje = puede_confirmarse(fila.estado, fila.movimiento)
            if not completo:
                raise ValidationError(
                    f'Fila {fila.numero_fila}: {mensaje}', campo='filas',
                )
        ahora = timezone.now()
        for fila in filas:
            fila.confirmada = True
            fila.confirmada_por_cedula = actor_cedula or ''
            fila.confirmada_en = ahora
            fila.save(update_fields=['confirmada', 'confirmada_por_cedula', 'confirmada_en'])
        carga.filas_confirmadas = carga.filas.filter(confirmada=True).count()
        carga.save(update_fields=['filas_confirmadas'])
    return carga


def _auditar_fila(
    carga: CargaMasivaModel, fila: CargaMasivaFilaModel,
    actor_id: int | None, actor_cedula: str,
) -> None:
    recurso = (
        fila.datos.get('cedula')
        or fila.datos.get('cedula_titular')
        or str(fila.pk)
    )
    estado_nuevo = {'carga_id': str(carga.id), 'fila': fila.numero_fila}
    if fila.movimiento:
        estado_nuevo['movimiento'] = fila.movimiento.get('tipo')
        estado_nuevo['condicion'] = (
            f"{fila.movimiento.get('condicion_actual')} -> "
            f"{fila.movimiento.get('condicion_nueva')}"
        )
    registrar_auditoria(
        trace_id=str(carga.id), actor_id=actor_id, actor_cedula=actor_cedula,
        actor_rol='', accion='CARGA_MASIVA_REGISTRO_APLICADO', modulo=carga.modulo,
        recurso_tipo=fila.tipo, recurso_id=str(recurso),
        estado_nuevo=estado_nuevo,
    )


def _notificar_aprobacion(carga: CargaMasivaModel) -> None:
    notificador = obtener_notificador()
    if notificador is None:
        return
    notificador.notificar(SolicitudNotificacion(
        tipo=TIPO_NOTIFICACION_PENDIENTE,
        titulo='Carga masiva pendiente de aprobación',
        mensaje=(
            f'La carga «{carga.archivo_nombre}» ({carga.poblacion.lower()}) tiene '
            f'{carga.filas_validas} registro(s) listos. Revísela y apruébela o '
            'rechácela con un motivo.'
        ),
        permiso_destino=PERMISO_APROBAR,
        excluir_cedulas=(carga.solicitada_por_cedula,),
        ref_tipo='carga_masiva',
        ref_id=str(carga.id),
        clave='pendiente-aprobacion',
        modulo=carga.modulo,
    ))


def aprobar_carga(
    carga: CargaMasivaModel, actor_cedula: str, actor_id: int | None = None,
) -> CargaMasivaModel:
    if carga.estado != CargaMasivaModel.Estado.PENDIENTE_APROBACION:
        raise ConflictError('La carga no está pendiente de aprobación.')
    if carga.solicitada_por_cedula == actor_cedula:
        raise ConflictError('Quien cargó el archivo no puede aprobarlo.')
    carga.aprobada_por_cedula = actor_cedula
    carga.save(update_fields=['aprobada_por_cedula'])
    return aplicar_carga(carga, actor_cedula, actor_id)


def rechazar_carga(carga: CargaMasivaModel, actor_cedula: str, motivo: str) -> CargaMasivaModel:
    if carga.estado != CargaMasivaModel.Estado.PENDIENTE_APROBACION:
        raise ConflictError('La carga no está pendiente de aprobación.')
    if carga.solicitada_por_cedula == actor_cedula:
        raise ConflictError('Quien cargó el archivo no puede rechazarlo.')
    if not motivo or not motivo.strip():
        raise ValidationError('Indique el motivo del rechazo.', campo='motivo')
    carga.estado = CargaMasivaModel.Estado.RECHAZADA
    carga.motivo_rechazo = motivo.strip()
    carga.save(update_fields=['estado', 'motivo_rechazo'])
    return carga


def _revertir_movimiento(
    fila: CargaMasivaFilaModel, movimiento: dict, actor_id: int | None = None,
) -> None:
    """Compensa el movimiento de condición con los mismos flujos existentes."""
    if not movimiento.get('aplicado'):
        return
    cedula = _cedula_de(fila)
    if movimiento.get('tipo') == 'ACTIVO_A_PASIVO':
        pasivo_id = movimiento.get('pasivo_cargo_id')
        if pasivo_id:
            RepoCargosORM().desasignar_cargo(int(pasivo_id), usuario_id=actor_id)
        for cargo_id in movimiento.get('cargos_activos_liberados') or []:
            if AsigTrabajoModel.objects.filter(pk=cargo_id, employee__isnull=True).exists():
                RepoCargosORM().asignar_cargo_a_empleado(
                    int(cargo_id), cedula, usuario_id=actor_id,
                )
        egreso_id = movimiento.get('egreso_id')
        if egreso_id:
            egreso = EmployeeEgresadoModel.objects.filter(pk=egreso_id).first()
            if egreso is not None:
                CargoEgresadoModel.objects.filter(egreso=egreso).delete()
                egreso.delete()
    elif movimiento.get('tipo') == 'PASIVO_A_ACTIVO':
        cargo_activo_id = movimiento.get('cargo_activo_id')
        if cargo_activo_id:
            RepoCargosORM().desasignar_cargo(int(cargo_activo_id), usuario_id=actor_id)
        pasivo_id = movimiento.get('pasivo_cargo_id')
        if pasivo_id and AsigTrabajoModel.objects.filter(
            pk=pasivo_id, employee__isnull=True,
        ).exists():
            RepoCargosORM().asignar_cargo_a_empleado(
                int(pasivo_id), cedula, usuario_id=actor_id,
            )


def revertir_carga(carga: CargaMasivaModel, actor_id: int | None = None) -> CargaMasivaModel:
    if carga.estado != CargaMasivaModel.Estado.APLICADA:
        raise ConflictError('Solo se puede revertir una carga aplicada.')
    try:
        return _revertir_carga_bloqueada(carga, actor_id)
    except ProtectedError as exc:
        # L2-10: registros posteriores (cuenta, cargo, carnet...) impiden el borrado.
        raise ConflictError(
            'No se puede revertir la carga: algunos registros creados por ella ya '
            'tienen datos asociados (cuenta, cargo, carnet u otros).'
        ) from exc


def _revertir_carga_bloqueada(carga: CargaMasivaModel, actor_id: int | None) -> CargaMasivaModel:
    with transaction.atomic():
        bloqueada = CargaMasivaModel.objects.select_for_update().get(pk=carga.pk)
        if bloqueada.estado != CargaMasivaModel.Estado.APLICADA:
            raise ConflictError('Solo se puede revertir una carga aplicada.')
        filas = list(carga.filas.filter(aplicada=True).order_by('numero_fila'))
        movimientos_revertidos: set[str] = set()
        for fila in filas:
            movimiento = dict(fila.movimiento or {})
            cedula = _cedula_de(fila)
            if movimiento.get('aplicado') and cedula not in movimientos_revertidos:
                _revertir_movimiento(fila, movimiento, actor_id)
                movimientos_revertidos.add(cedula)
                movimiento['aplicado'] = False
                movimiento['revertido'] = True
                fila.movimiento = movimiento
        for fila in filas:
            if fila.tipo == 'datos_personales':
                empleado = EmployeeModel.objects.filter(cedulaidentidad=fila.datos.get('cedula')).first()
                if empleado and fila.anteriores.get('creado'):
                    empleado.delete()
                elif empleado:
                    for campo in ('nombres', 'apellidos', 'correo', 'telefono_movil', 'telefono_habitacion'):
                        valor = fila.anteriores.get(campo) or None
                        if valor is None and campo in ('nombres', 'apellidos'):
                            continue  # columnas obligatorias: no se vacían
                        setattr(empleado, campo, valor)
                    empleado.save()
            elif fila.tipo == 'familiares' and fila.anteriores.get('id'):
                familiar = EmployeefamilyModel.objects.filter(pk=fila.anteriores['id']).first()
                if familiar:
                    if fila.anteriores.get('creado'):
                        familiar.delete()
            elif fila.tipo == 'cargo_asignacion' and fila.anteriores.get('cargo_creado'):
                # FIX-CARGA4: la reversión elimina el cargo creado por la carga.
                cargo_id = fila.anteriores.get('cargo_id')
                asignacion = AsigTrabajoModel.objects.filter(pk=cargo_id).first()
                if asignacion is not None:
                    if asignacion.employee_id:
                        RepoCargosORM().desasignar_cargo(
                            asignacion.pk, usuario_id=actor_id,
                        )
                    asignacion.delete()
                if fila.anteriores.get('antecedente_creado') and fila.anteriores.get('antecedente_id'):
                    AntecedenteServicioModel.objects.filter(
                        pk=fila.anteriores['antecedente_id'],
                    ).delete()
            fila.aplicada = False
            fila.save(update_fields=['aplicada', 'movimiento'])
        carga.estado = CargaMasivaModel.Estado.REVERTIDA
        carga.revertida_en = timezone.now()
        carga.save(update_fields=['estado', 'revertida_en'])
    return carga
