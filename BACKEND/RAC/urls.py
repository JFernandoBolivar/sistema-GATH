from django.urls import path
from . import views

app_name = 'Registro de asignacion de cargos'
urlpatterns = [
    # --------------------
    #  DATOS PERSONALES 
    # --------------------
    
    
    # crear empleado (datos personales)
    path('employees_register/',views.create_employee, name='employee-register'),
    # actulizacion de datos personales
    path('Employee/<int:id>/', views.update_employee, name='actualizar-empleado'),
    # solo sus datos personales 
    path('listar-data-empleados/<str:cedulaidentidad>/', views.retrieve_employee, name='listar-data-empleados'),
    # PERSONAL PASIVO 
    path('employee/pasivo/',views.list_employees_pasive, name='personal-pasivo-list'),
    path('employee/pasivo/<str:cedulaidentidad>/', views.employee__passive_by, name='listar-data-empleados-pasivos-detail'),
   
    
    # --------------------
    # DATOS DE SALUD 
    # --------------------
    
     # grupo sanguineo
    path('listar-grupoSanguineos/', views.list_blood_types, name='listar-grupoSanguineo'),
    path('patologias/categorias/', views.list_pathology_categories, name='listar-categorias-patologias '),
    path('Patologias/', views.list_chronic_pathologies, name='listar-patologias'),
    path('discapacidad/categorias/', views.list_disability_categories, name='listar-categorias-discapacidades'),
    path('Discapacidades/', views.list_disabilities, name='listar-discapacidades'),
    path('alergias/categorias/', views.list_allergies_categories, name="categorias de alergias"),
    path('alergias/', views.list_allergies, name='listar-alergias '),
    path('releciones/', views.list_relationship, name='listar-relacion-de-contacto-de-emergencia'),
    
    # --------------------
    # DATOS DE VESTIMENTA
    # --------------------

    path('listar-tallasCamisas/', views.list_shirt_sizes, name='listar tallas de camisa'),
    path('listar-tallaPantalones/',views.list_pant_sizes, name='listar tallas de pantalones'),
    path('listar-tallaZapatos/', views.list_shoe_sizes, name='listar tallas de Zapatos'),
    path('listar-tallas/', views.list_tallas, name='listar-tallas'),
    path('listar-tipo-prenda/', views.list_tipo_prenda, name='listar-tipo-prenda'),
    path('listar-region-talla/', views.list_region_talla, name='listar-region-talla'),
    
    
    # --------------------
    # DATOS DE ACADEMICOS
    # --------------------
    path('listar-nivel-academico/', views.list_academic_levels, name='listar-nivel-academico'),
    path('Menciones/<int:carrera_id>/', views.list_career_specializations, name='listar-menciones'),
    path('carreras/', views.list_careers, name='listar-carreras'),
    path('carreras/create/', views.create_carrera, name='crear-carrera'),
    path('carreras/<int:nivel_academico_id>/', views.list_careers, name='listar-carreras-por-nivel'),
    path('instituciones/', views.list_institutions, name='listar-instituciones'),
    path('institucion/', views.create_Institucion, name='crear-instituciones'),
    path('capacitaciones/', views.list_capacitaciones, name='listar-capacitaciones'),
    path('capacitacion/', views.create_Capacitacion, name='crear-capacitacion'),
    path('grupos-capacitacion/', views.list_grupos_capacitacion, name='listar-grupos-capacitacion'),


    
    # --------------------
    # UBICACION DEL VIVIENDA
    # --------------------
     #path para la ubicacion del personal
   path('direccion/regiones/', views.list_region, name='regiones'),
   path('direccion/estado/<int:region_id>/', views.list_estados_by_region, name='estado'),
    path('direccion/estados/', views.list_estados, name='estados'),    
    path('direccion/municipios/<int:estadoid>/', views.list_municipios, name='municipios_por_estado'),
    path('direccion/parroquias/<int:municipioid>/', views.list_parroquias, name='parroquias'),
    path('condicion_vivienda/', views.list_housing_conditions, name='listar-condiciones-vivienda'),
    
    
     # --------------------
    # DATOS PERFIL
    # --------------------
    path('listar-sexo/',views.list_genders, name='listar-sexo'),
    path('listar-politicas/',views.list_politicas, name='listar-politicas'),
    path('listar-estadoCivil/',views.list_marital_statuses, name='listar-estadoCivil'),
    
  
   # --------------------
    # DEPENDENCIAS
    # --------------------

     
       #  CREACION 
    path('dependencia/', views.create_dependencia, name= "registro-dependencia"),
    path('register-direccionGeneral/', views.create_general_directorate, name= "registro-direccion-general"),
    path('register-direccionLinea/', views.create_line_directorate, name= "registro-direccion-linea"),  
    path('register-Coordinacion/', views.create_coordination, name= "registro-coordinacion"), 
    
       #  ACTUALIZACION
    path('Dependencia/<int:id>/', views.update_dependencia, name= "actualizar-dependencia"),
    path('DireccionGeneral/<int:id>/',views.update_direccion_general, name= "actualizar-direccion-general"),
    path('DireccionLinea/<int:id>/', views.update_line_directorate, name= "actualizar-direccion-linea "),
    path('Coordinacion/<int:id>/', views.update_coordinacion, name= "actualizar-coordinacion "),
        
        #  LISTAR
    path('dependencias/', views.list_dependencies, name='lista de dependencias'),
    path('direccionGeneral/<int:dependencia_id>/', views.list_general_directorates_by_dependencia, name='lista las direcciones generales'),
    path('listar-DireccionGeneral/', views.list_general_directorates, name='lista las direcciones de linea'),
    path('listar-DireccionLinea/<int:general_id>/',views.list_line_directorates_by_general, name='lista las direcciones generales'),
    path('listar-Coordinacion/<int:line_id>/', views.list_coordinations_by_line, name='lista de las coordinaciones'),
      
# ------------------
# Gestion del codigo
# -------------------   
   
    path('empleados-codigo/', views.create_position, name='registrar-codigo'),
      # editar codigo
    path('codigos/<int:id>/', views.update_position, name='codigos-actualizacion'),
#     # lista unicamente los codigos vacantes
    path('cargos/vacantes/',views.list_general_vacants_codes, name='listos-todos-codigos-vacantes'),
#     # listar codigo  tanto activos como vacantes
    path('cargos/general/', views.list_general_work_codes, name='lista-codigos-generales-activos'),
    path('cargos/pasivo/',views.work_codes_passive, name='lista-codigos-pasivos'),
    path('cargos/pasivo/<int:id>/',views.update_position_passive, name='actualizar-codigos-pasivos'),
    
# ------------------
# ASIGNACION DE CARGO
# -------------------

    path('asignar_codigo/<int:id>/', views.assign_employee, name='asignacion-cargo'),
    # asignar codigo especial (tipos de nomina que requieren que el codigo sea autogenerable)
    path('asignacion_CodigoEspecia/',views.assign_employee_special, name='asignacion-cargo-especial'),
    # listar empleados con su cargo
    path('Employee/cargos/', views.list_employees_active, name='empleados-listar'),
    #   # D
    # path('empleados/', views.list_employees_active, name='empleado-list-create'),
#     # BUSCA EMPLEADOS POR CEDULA 
    path('empleados-cedula/<str:cedulaidentidad>/', views.get_employee_by_id, name='empleado-por-cedula'),
    # # D
    # path('empleados/<str:cedulaidentidad>/', views.get_employee_by_id, name='empleado-detail'),
    
# ------------------
# DATOS PARA EL CARGO 
# -------------------

    # denominacion de cargo 
    path('listar-denominacion-cargo/', views.list_position_denominations, name='lista de denominacion de cargo'),
    path('listar-denominacion-cargo-especifico/', views.list_specific_position_denominations, name='listar-denominacion-cargo-especifico'),
     
    path('listar-grado/', views.list_job_grades, name='lista de grados'), 
    path('nomina/general/', views.list_payroll_types, name='lista de tipos de nominas generales'),
    path('listar-nominaPasivo/', views.list_retired_payroll_types, name='lista de tipos de nominas para personal pasivo'),
    path('listar-tipo-nomina/', views.list_active_payroll_types, name='lista de tipos de nominas sin CS Y HP'),
    # tipo de nominas con asignacion de codigo autogenerables (CS y HP)
    path('listar-nomina-especial/', views.list_special_payroll_types, name='lista de tipos de nominas solo CS Y HP'),
    
    #  estatus de gestion (BLOQUEADO, SUSPENDIDO,ACTIVO)
    path('estatus/reports/', views.list_status_reports, name="lista de estatus para los reportes"),
    path('estatus-gestion/',  views.list_management_statuses, name='lista de estatus para la gestion de cambio de estatus'),
   #  estatus de egreso (EGRESADO, PASIVO)
    path('estatus/',  views.list_exit_statuses, name='lista de estatus para egresar'),

# ---------------
# ORGANISMOS ADSCRITOS 
# ------------------- 
   path('OrganismoAdscrito/',views.create_subsidiary_organism, name= "registro-organismo-Adscrito"),
   path('OrganismoAdscrito/<int:id>/',views.update_organism, name= 'actualizacion-organismo-adscrito'),
   path('organismos-adscritos/', views.list_subsidiary_organisms, name='lista de organismos adscritos'),
   path('organismos-adscritos/padre/', views.list_subsidiary_organisms_report, name="listar-organismos-repors"),
   path('tiposProcedencia/', views.list_types_comision, name="listar-tipos-procedencia"),

    
  
# ------------------
# RUTAS HISTORIAL DE EMPLEADOS
# -------------------  
    path('EmployeeMovementHistory/<str:cedulaidentidad>/', views.listar_historial_cargo, name='historial-por-cedula'),


    
# ------------------
# MOVIMIENTO DE PERSONAL Y ESTATUS
# ------------------- 
    path('historyEmployee/cargo-movimiento/<int:cargo_id>/', views.cambiar_cargo, name='cargo-movimiento'),
    path('historyEmployee/egreso/<str:cedulaidentidad>/', views.gestion_egreso_pasivo, name='empleado-egreso'),
    path('historyEmployee/Estatus/<int:cargo_id>/',views.gestionar_estatus_puesto, name='gestion-puestos'),
    path('motivos/egreso/', views.listar_motivos_egreso, name='api-motivos-egreso'),
    path('motivos/egreso/fallecimineto/', views.listar_motivos_fallecimiento, name='api-motivos-egreso-fallecimiento'),
    path('motivos/movimiento/', views.listar_motivos_internos, name='api-motivos-internos'),
    path('motivos/estatus/', views.listar_suspendido, name='api-motivos-suspendido'),
    path('motivos/estatus/pasivos/', views.listar_suspendido_pasivo, name='motivos-suspendido'),
    
    # MOVIMIENTO A PASIVO HEREDERO 


# ------------------
# GESTION DE FAMILIARES
# ------------------- 
    path('Employeefamily/<str:cedula_empleado>/', views.registrar_familiar, name='creacion-empleadoFamiliar'),
    path('Employeefamily/masivo/<str:cedula_empleado>/', views.registrar_familiares_masivo, name='creacion-masiva-empleadoFamiliar'),
    path('Employeefamily/<int:familiar_id>', views.actualizar_familiar, name='actualizar_familiar'),
    path('Passivefamily/', views.listar_familiares_pasivo, name='listar-empleadoFamiliar-pasive-list'),
    path('Passivefamily/<int:id_empleado>/', views.familiares_pasivo_by, name='listar-empleadoFamiliar-pasive-detail'),
    path('Employeefamily/', views.listar_familiares, name='listar-empleadoFamiliar'),
    
    path('Employeefamilys/<int:id_empleado>/', views.familiares_active_by, name='listar-empleadoFamiliar'),
    path('Parentesco/', views.listar_parentesco, name="listar-parentesco"),
    path('Employeefamily/<int:familiar_id>/documentos/', views.subir_documento_familiar, name='subir-documento-familiar'),
    path('Employeefamily/<int:familiar_id>/documentos/list/', views.listar_documentos_familiar, name='listar-documentos-familiar'),
    
    
    
#   reporte
    path('EmployeeMovementHistory/reporte/',views.reporte_movimientos, name='reporte-movimiento'),
   

    # path('reports/', views.generate_dynamic_report, name='reporte_generico'),
    
    # Generación de reportes PDF
    path('reports/pdf/', views.generate_pdf_report_active, name='reporte_activo_pdf'),
    path('reports/pasivo/', views.generate_pdf_report_passive, name='reporte_pasivo_pdf'),
    
    
    
    path('menciones/create/', views.crear_menciones_view, name='menciones-creadas'),
    path('carga/cargos/', views.ImportarCargosESPECIALESView.as_view(), name="carga-trabajador-masiva"),
    path('carga/trabajador/', views.ImportFullEmployeeDataView.as_view(), name="carga-trabajador-masiva"),
    path('carga/familiares/',views.ImportFullFamilyDataView.as_view(), name="carga_masiva_familiares"),

    # --------------------
    # PRESTAMO DE CARGO (ENCARGADURIA)
    # --------------------
    path('prestamo-cargo/', views.create_prestamo_cargo, name='crear-prestamo-cargo'),
    path('prestamo-cargo/list/', views.list_prestamo_cargo, name='listar-prestamo-cargo'),
    path('prestamo-cargo/<int:id>/', views.update_prestamo_cargo, name='actualizar-prestamo-cargo'),
    path('motivos/encargaduria/', views.list_motivos_encargaduria, name='listar-motivos-encargaduria'),
    path('motivos/encargaduria/create/', views.create_motivo_encargaduria, name='crear-motivo-encargaduria'),
    
]