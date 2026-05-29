from django.utils import timezone

from ..models.historial_personal_models import Tipo_movimiento, EmployeeEgresado, CargoEgresado
from ..models.personal_models import (
    AsigTrabajo, Employee, Estatus, Tipo_personal, Dependencias,
    DireccionGeneral, Denominacioncargo, Denominacioncargoespecifico,
    Tiponomina, perfil_salud, perfil_fisico, formacion_academica,
    antecedentes_servicio, contratos,
)
from ..models.family_personal_models import Employeefamily
from ..services.constants_historial import registrar_historial_movimiento
from ..services.generacion_codigo import generar_prefijo_nomina, generador_codigos
from ..utils.constants import PERSONAL_PASIVO, ESTATUS_VACANTE


def generar_codigo_nomina(tipo_nomina):
    prefix = generar_prefijo_nomina(tipo_nomina)
    return generador_codigos(prefix)


def validar_y_preparar_sobrevivientes(sobrevivientes_input):
    nomina_pension = Tiponomina.objects.get(nomina__iexact="PENSIONADO SOBREVIVIENTE")

    prefix_pension = generar_prefijo_nomina(nomina_pension)

    ultima_pension = AsigTrabajo.objects.filter(
        codigo__startswith=prefix_pension
    ).order_by("-codigo").first()

    if not ultima_pension:
        sig_num_pension = 1
    else:
        try:
            sig_num_pension = int(ultima_pension.codigo[len(prefix_pension):]) + 1
        except (ValueError, IndexError):
            sig_num_pension = 1

    codigos_ingresados = []
    familiares_validados = []

    for item in sobrevivientes_input:
        ced_fam = item["cedula_familiar"]
        cod_nuevo = item.get("codigo")

        if not cod_nuevo:
            cod_nuevo = f"{prefix_pension}{str(sig_num_pension).zfill(4)}"
            sig_num_pension += 1

        familiar = Employeefamily.objects.filter(cedulaFamiliar=ced_fam).first()
        if not familiar:
            raise ValueError(f"No se encontró familiar con la cédula {ced_fam}.")

        if Employee.objects.filter(cedulaidentidad=ced_fam).exists():
            raise ValueError(f"El familiar {ced_fam} ya es personal del sistema.")

        if cod_nuevo in codigos_ingresados:
            raise ValueError(f"Código {cod_nuevo} duplicado en la petición.")
        codigos_ingresados.append(cod_nuevo)

        if AsigTrabajo.objects.filter(
            codigo=cod_nuevo, tiponominaid=nomina_pension
        ).exists():
            raise ValueError(
                f"El código {cod_nuevo} ya existe en la nómina de sobrevivientes."
            )

        familiares_validados.append(
            {
                "familiar_obj": familiar,
                "empleado_origen": familiar.employeecedula,
                "codigo": cod_nuevo,
            }
        )

    return {"nomina_pension": nomina_pension, "familiares_validados": familiares_validados}


def procesar_egreso_total(empleado, motivo, usuario, estatus_vacante):
    estatus_egresado = Estatus.objects.get(estatus__iexact="EGRESADO")
    estatus_vencido = Estatus.objects.get(estatus__iexact="VENCIDO")

    fecha_hoy = timezone.now().date()
    asignaciones = AsigTrabajo.objects.filter(employee=empleado)

    antecedente_activo = antecedentes_servicio.objects.filter(
        empleado_id=empleado,
        fecha_egreso__isnull=True
    ).first()

    n_contrato_value = None
    fecha_ingreso_value = fecha_hoy

    if antecedente_activo:
        antecedente_activo.fecha_egreso = fecha_hoy
        antecedente_activo.save()
        fecha_ingreso_value = antecedente_activo.fecha_ingreso

        contrato = contratos.objects.filter(antecedente_id=antecedente_activo).first()
        if contrato:
            n_contrato_value = contrato.n_contrato
            contrato.estatus_id = estatus_vencido
            contrato.save()

    egreso_obj = EmployeeEgresado.objects.create(
        employee=empleado,
        n_contrato=n_contrato_value,
        fechaingresoorganismo=fecha_ingreso_value,
        motivo_egreso=motivo,
    )

    for asig in asignaciones:
        CargoEgresado.objects.create(
            egreso=egreso_obj,
            codigo=asig.codigo,
            denominacioncargoid=asig.denominacioncargoid,
            denominacioncargoespecificoid=asig.denominacioncargoespecificoid,
            gradoid=asig.gradoid,
            tiponominaid=asig.tiponominaid,
            TipoPersonalId=asig.Tipo_personal,
            Dependencia=asig.Dependencia,
            DireccionGeneral=asig.DireccionGeneral,
            DireccionLinea=asig.DireccionLinea,
            Coordinacion=None,
            OrganismoAdscritoid=asig.OrganismoAdscritoid,
        )

        asig.estatusid = estatus_egresado
        registrar_historial_movimiento(empleado, asig, "EGRESO", motivo, usuario)
        asig.employee = None
        asig.save()


def procesar_pasivo(empleado, codigo_nuevo, tiponominaid, motivo_obj, usuario, estatus_vacante, liberar_activos=False):
    dg_humana = DireccionGeneral.objects.get(
        direccion_general__iexact="OFICINA DE GESTION HUMANA"
    )

    ultima_asig = AsigTrabajo.objects.filter(employee=empleado).first()
    if not ultima_asig:
        raise ValueError(
            "El empleado no tiene cargos previos para realizar el pase a pasivo."
        )

    if liberar_activos:
        procesar_egreso_total(empleado, motivo_obj, usuario, estatus_vacante)

    estatus_activo = Estatus.objects.get(estatus__iexact="ACTIVO")
    tipo_pasivo = Tipo_personal.objects.get(tipo_personal__iexact=PERSONAL_PASIVO)

    nueva_asig = AsigTrabajo.objects.create(
        employee=empleado,
        codigo=codigo_nuevo,
        denominacioncargoid=ultima_asig.denominacioncargoid,
        denominacioncargoespecificoid=ultima_asig.denominacioncargoespecificoid,
        tiponominaid_id=tiponominaid,
        estatusid=estatus_activo,
        Tipo_personal=tipo_pasivo,
        gradoid=None,
        Dependencia=dg_humana.dependenciaId if dg_humana else Dependencias.objects.get(id=1),
        DireccionGeneral=dg_humana,
        DireccionLinea=None,
        Coordinacion=None,
        OrganismoAdscritoid=ultima_asig.OrganismoAdscritoid,
        observaciones=f"Cargo pasivo generado. {motivo_obj.movimiento}",
    )
    nueva_asig.save()

    registrar_historial_movimiento(
        empleado, nueva_asig, "CAMBIO_NOMINA", motivo_obj, usuario
    )
    return empleado


def ejecutar_creacion_sobrevivientes(familiares_validados, nomina_pension, usuario):
    estatus_activo = Estatus.objects.get(estatus__iexact="ACTIVO")
    tipo_pasivo = Tipo_personal.objects.get(tipo_personal__iexact="PASIVO")
    dependencia = Dependencias.objects.get(dependencia__iexact="NIVEL DE APOYO")
    dg_humana = DireccionGeneral.objects.get(
        direccion_general__iexact="OFICINA DE GESTION HUMANA"
    )
    denom_pasivo = Denominacioncargo.objects.get(cargo__iexact="PERSONAL PASIVO")
    espec_pasivo = Denominacioncargoespecifico.objects.get(
        cargo__iexact="PERSONAL PASIVO"
    )
    motivo_ingreso = Tipo_movimiento.objects.get(
        movimiento__iexact="PENSION POR SOBREVIVIENTE"
    )

    for item in familiares_validados:
        fam = item["familiar_obj"]
        emp_origen = item["empleado_origen"]
        codigo = item["codigo"]

        nuevo_emp = Employee.objects.create(
            cedulaidentidad=fam.cedulaFamiliar,
            nombres=f"{fam.primer_nombre or ''} {fam.segundo_nombre or ''}".strip(),
            apellidos=f"{fam.primer_apellido or ''} {fam.segundo_apellido or ''}".strip(),
            fecha_nacimiento=fam.fechanacimiento,
            sexoid=fam.sexo,
            estadoCivil=fam.estadoCivil,
        )

        salud = perfil_salud.objects.filter(familiar_id=fam).first()
        if salud:
            n_salud = perfil_salud.objects.create(
                empleado_id=nuevo_emp, grupoSanguineo=salud.grupoSanguineo
            )
            n_salud.patologiaCronica.set(salud.patologiaCronica.all())
            n_salud.discapacidad.set(salud.discapacidad.all())
            n_salud.alergias.set(salud.alergias.all())

        fisico = perfil_fisico.objects.filter(familiar_id=fam).first()
        if fisico:
            perfil_fisico.objects.create(
                empleado_id=nuevo_emp,
                tallaCamisa=fisico.tallaCamisa,
                tallaPantalon=fisico.tallaPantalon,
                tallaZapatos=fisico.tallaZapatos,
            )

        acad = formacion_academica.objects.filter(familiar_id=fam).first()
        if acad:
            formacion_academica.objects.create(
                empleado_id=nuevo_emp,
                nivel_Academico_id=acad.nivel_Academico_id,
                carrera_id=acad.carrera_id,
                mencion_id=acad.mencion_id,
                institucion=acad.institucion,
            )

        asig = AsigTrabajo.objects.create(
            employee=nuevo_emp,
            codigo=codigo,
            denominacioncargoid=denom_pasivo,
            denominacioncargoespecificoid=espec_pasivo,
            tiponominaid=nomina_pension,
            estatusid=estatus_activo,
            Tipo_personal=tipo_pasivo,
            Dependencia=dependencia,
            DireccionGeneral=dg_humana,
            observaciones=f"Pensión sobreviviente derivada de C.I. {emp_origen.cedulaidentidad}",
        )
        asig.save()

        registrar_historial_movimiento(
            nuevo_emp, asig, "INGRESO", motivo_ingreso, usuario
        )
