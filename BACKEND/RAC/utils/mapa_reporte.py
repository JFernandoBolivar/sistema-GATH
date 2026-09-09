from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

# Filtros de edad (años) que deben convertirse a un umbral real de fecha de
# nacimiento antes de compararlos contra un DateField: comparar el entero de
# "edad" directo contra fecha_nacimiento (DateField) es invalido/no produce
# el resultado esperado.
FILTROS_EDAD_MIN = {"edad_min", "edad_empleado_min", "edad_familiar_min"}
FILTROS_EDAD_MAX = {"edad_max", "edad_empleado_max", "edad_familiar_max"}

# Filtros de años en APN que en realidad no pueden resolverse con un simple
# WHERE de SQL porque el total se calcula (30E/360, fusion de periodos) en
# Python via calcular_total_apn, no en un campo de BD mantenido al dia.
FILTROS_APN = {"apn_min", "apn_max"}


def convertir_filtro_edad(filtro_key, valor):
    """
    Convierte un filtro de edad en años (ej. edad_min=25) en la fecha de
    nacimiento umbral equivalente, respetando el sentido de la comparacion
    ya definido en filtros_permitidos (edad_min -> fecha_nacimiento__lte,
    edad_max -> fecha_nacimiento__gte).
    """
    if filtro_key not in FILTROS_EDAD_MIN and filtro_key not in FILTROS_EDAD_MAX:
        return valor
    try:
        anios = int(valor)
    except (TypeError, ValueError):
        return valor

    hoy = date.today()
    if filtro_key in FILTROS_EDAD_MIN:
        # Tener al menos N anios: nacio en o antes de (hoy - N anios)
        return hoy - relativedelta(years=anios)
    # Tener a lo sumo N anios: nacio en o despues de (hoy - (N+1) anios + 1 dia)
    return hoy - relativedelta(years=anios + 1) + timedelta(days=1)


MAPA_REPORTES = {
    "empleados": {
        "modelo": "Employee",
        "campos_permitidos": {
            "dependencia": "assignments__Dependencia__dependencia",
            "direccion_general": "assignments__DireccionGeneral__direccion_general",
            "direccion_linea": "assignments__DireccionLinea__direccion_linea",
            "coordinacion": "assignments__Coordinacion__coordinacion",
            "sexo": "sexoid__sexo",
            "estado_civil": "estadoCivil__estadoCivil",
            "talla_camisa": "perfil_fisico__tallaCamisa__valor",
            "talla_pantalon": "perfil_fisico__tallaPantalon__valor",
            "talla_zapatos": "perfil_fisico__tallaZapatos__valor",
            "grupo_sanguineo": "perfil_salud__grupoSanguineo__GrupoSanguineo",
            "discapacidades": "perfil_salud__discapacidad__discapacidad",
            "patologias": "perfil_salud__patologiaCronica__patologia",
            "nivel_academico": "formacion_academica__nivel_Academico_id__nivelacademico",
            "carrera": "formacion_academica__carrera_id__nombre_carrera",
            "mencion": "formacion_academica__mencion_id__mencion",
            "cargo": "assignments__denominacioncargoid",
            "cargo_especifico": "assignments__denominacioncargoespecificoid",
            "grado": "assignments__gradoid",
            "tipo_nomina": "assignments__tiponominaid__nomina",
            "estatus": "assignments__estatusid__estatus",
            "años_apn": "total_anos_apn",
            "edad": "edad_trabajador",
            "region": "datos_vivienda_set__estado_id__Region__region",
            "estado": "datos_vivienda_set__estado_id__estado",
            "municipio": "datos_vivienda_set__municipio_id__municipio",
            "condicion_vivienda": "datos_vivienda_set__condicion_vivienda_id__condicion",
        },
        "filtros_permitidos": {
            "dependencia_id": "assignments__Dependencia",
            "direccion_general_id": "assignments__DireccionGeneral",
            "direccion_linea_id": "assignments__DireccionLinea",
            'OrganismoAdscrito_id': "assignments__OrganismoAdscritoid",
            "coordinacion_id": "assignments__Coordinacion",
            "sexo_id": "sexoid",
            "discapacidad_id": "perfil_salud__discapacidad",
            "grupo_sanguineo_id": "perfil_salud__grupoSanguineo",
            "patologia_id": "perfil_salud__patologiaCronica",
            "nomina_id": "assignments__tiponominaid",
            "grado_id": "assignments__gradoid",
            "cargo_id": "assignments__denominacioncargoid",
            "cargo_especifico_id": "assignments__denominacioncargoespecificoid",
            "nivel_academico_id": "formacion_academica__nivel_Academico_id",
            "carrera_id": "formacion_academica__carrera_id",
            "mencion_id": "formacion_academica__mencion_id",
            "estatus_id": "assignments__estatusid",
            "tipo_personal": "assignments__Tipo_personal",
            "apn_min": "total_anos_apn__gte",
            "apn_max": "total_anos_apn__lte",
            "edad_min": "fecha_nacimiento__lte",
            "edad_max": "fecha_nacimiento__gte",
            "fecha_ingreso_Desde": "antecedentes_servicio__fecha_ingreso__gte",
            "fecha_ingreso_Hasta": "antecedentes_servicio__fecha_ingreso__lte",
            "fecha_apn_Desde": "antecedentes_servicio__fecha_ingreso__gte",
            "fecha_apn_Hasta": "antecedentes_servicio__fecha_ingreso__lte",
            "region_id": "datos_vivienda__estado_id__Region",
            "estado_id": "datos_vivienda__estado_id",
            "municipio_id": "datos_vivienda__municipio_id",
            "parroquia_id": "datos_vivienda__parroquia_id",
            "condicion_vivienda_id": "datos_vivienda__condicion_vivienda_id",
            "capacitacion_id": "formacion_complementaria__capacitacion_id",
            "procedencia_id": "formacion_complementaria__procedencia_id",
            "grupo_id": "formacion_complementaria__grupo_id",
            
        }
    },
    "familiares": {
       "modelo": "Employee",
        "campos_permitidos": {
            "parentesco": "carga_familiar__parentesco__descripcion_parentesco",
            "sexo": "carga_familiar__sexo__sexo",
            "estado_civil": "carga_familiar__estadoCivil__estadoCivil",
            "talla_camisa": "carga_familiar__perfil_fisico_set__tallaCamisa__valor",
            "talla_pantalon": "carga_familiar__perfil_fisico__tallaPantalon__valor",
            "talla_zapatos": "carga_familiar__perfil_fisico__tallaZapatos__valor",
            "grupo_sanguineo": "carga_familiar__perfil_salud__grupoSanguineo__GrupoSanguineo",
            "discapacidades": "carga_familiar__perfil_salud__discapacidad__discapacidad",
            "patologias": "carga_familiar__perfil_salud__patologiaCronica__patologia",
            "tipo_nomina": "assignments__tiponominaid__nomina",
            "dependencia": "assignments__Dependencia__dependencia",
            "direccion_general": "assignments__DireccionGeneral__direccion_general",
            "direccion_linea": "assignments__DireccionLinea__direccion_linea",
            "coordinacion": "assignments__Coordinacion__coordinacion",
        },
        "filtros_permitidos": {
            "parentesco_id": "carga_familiar__parentesco",
            "patologias_id": "carga_familiar__perfil_salud__patologiaCronica",
            "grupo_sanguineo_id": "carga_familiar__perfil_salud__grupoSanguineo",
            "discapacidades_id": "carga_familiar__perfil_salud__discapacidad",
            "sexo_familiar_id": "carga_familiar__sexo",
            "estado_civil_id": "carga_familiar__estadoCivil",
            "sexo_empleado_id": "sexoid",
             "edad_empleado_min": "fecha_nacimiento__lte",
            "edad_empleado_max": "fecha_nacimiento__gte",
            "edad_familiar_min": "carga_familiar__fechanacimiento__lte",
            "edad_familiar_max": "carga_familiar__fechanacimiento__gte", 
            "nomina_id": "assignments__tiponominaid",
            "dependencia_id": "assignments__Dependencia",
            "direccion_general_id": "assignments__DireccionGeneral",
            "direccion_linea_id": "assignments__DireccionLinea",
            "coordinacion_id": "assignments__Coordinacion",
            "region_id": "datos_vivienda__estado_id__Region",
            "estado_id": "datos_vivienda__estado_id",
            "municipio_id": "datos_vivienda__municipio_id",
            "parroquia_id": "datos_vivienda__parroquia_id",
            "condicion_vivienda_id": "datos_vivienda__condicion_vivienda_id",
            
            
        }
    },
    "egresados": {
        "modelo": "EmployeeEgresado",
        "campos_permitidos": {
            "motivo": "motivo_egreso__movimiento",
            "direccion_general": "cargos_historial__DireccionGeneral__direccion_general",
            "direccion_linea": "cargos_historial__DireccionLinea__direccion_linea",
            "coordinacion": "cargos_historial__Coordinacion__coordinacion",
            "cargo": "cargos_historial__denominacioncargoid__cargo",
            "cargo_especifico": "cargos_historial__denominacioncargoespecificoid__cargo",
            "grado": "cargos_historial__gradoid__grado",
            "tipo_nomina": "cargos_historial__tiponominaid__nomina",
            "organismo": "cargos_historial__OrganismoAdscritoid__Organismoadscrito", 
        },
        "filtros_permitidos": {
            "motivo_id": "motivo_egreso",
            "fecha_egreso_Desde": "fecha_egreso__gte",
            "fecha_egreso_Hasta": "fecha_egreso__lte",
            
            "cargo_id": "cargos_historial__denominacioncargoid",
            "cargo_especifico_id": "cargos_historial__denominacioncargoespecificoid",
            "grado_id": "cargos_historial__gradoid",
            "nomina_id": "cargos_historial__tiponominaid",
            "dependencia_id": "cargos_historial__Dependencia",
            "direccion_general_id": "cargos_historial__DireccionGeneral",
            "direccion_linea_id": "cargos_historial__DireccionLinea",
            "coordinacion_id": "cargos_historial__Coordinacion",
            "organismo_id": "cargos_historial__OrganismoAdscritoid",
            "edad_min": "employee__fecha_nacimiento__lte",
            "edad_max": "employee__fecha_nacimiento__gte",
            "sexo_id": "employee__sexoid",
            
        }
    },
    "asignaciones": {
        "modelo": "AsigTrabajo",
        "campos_permitidos": {
            "codigo": "codigo",
            "cargo": "denominacioncargoid__cargo",
            "cargo_especifico": "denominacioncargoespecificoid__cargo",
            "tipo_nomina": "tiponominaid__nomina",
            "grado": "gradoid__grado",
            "dependencia": "DireccionGeneral__Dependencia_dependencia",
            "direccion_general": "DireccionGeneral__direccion_general",
            "direccion_linea": "DireccionLinea__direccion_linea",
            "estatus": "estatusid__estatus",
        },
        "filtros_permitidos": {
            "cargo_id": "denominacioncargoid",
            "cargo_especifico_id": "denominacioncargoespecificoid",
            "nomina_id": "tiponominaid",
            "grado_id": "gradoid",
            "dependencia_id": "Dependencia",
            "general_id": "DireccionGeneral", 
            "linea_id": "DireccionLinea",     
            "coordinacion_id": "Coordinacion",
            'OrganismoAdscrito_id': "OrganismoAdscritoid",
            "estatus_id": "estatusid",
            
        }
    }
}

def get_config_by_category(category):
    cat_data = MAPA_REPORTES.get(category)
    if not cat_data:
        return None
    return {
        "agrupaciones": list(cat_data["campos_permitidos"].keys()),
        "filtros": list(cat_data["filtros_permitidos"].keys())
    }

def get_report_types_config():
    return {"conteo", "lista"}

def get_available_report_categories():
  
    return list(MAPA_REPORTES.keys())
