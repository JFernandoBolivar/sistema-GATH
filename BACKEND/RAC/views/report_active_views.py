from rest_framework import  status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema,OpenApiExample
from django.apps import apps
from django.db.models import  Prefetch, Q

from RAC.serializers.report_serializers import *
from RAC.utils.mapa_reporte import *
from RAC.utils.constants import *
from RAC.services.pdf.generators.employee_active_pdf import EmployeePDFGenerator
from RAC.services.pdf.generators.family_pdf import FamilyPDFGenerator
from RAC.services.pdf.generators.assignment_pdf import AssignmentPDFGenerator
from RAC.services.pdf.generators.graduate_pdf import GraduatePDFGenerator


@extend_schema(
    tags=["Reportes - Configuraciones"],
    summary="configuraciones de Reportes para empleados",
)
class EmployeeReportConfigView(APIView):
    def get(self, request):
        try:
            data = get_config_by_category('empleados')
            if not data:
                return Response({
                    "status": "Error",
                    "message": "No se pudo cargar la configuración de empleados"
                }, status=status.HTTP_400_BAD_REQUEST)
                
            return Response({
                "status": "Ok",
                "message": "Configuracion de empleados cargada correctamente",
                "data":data
                }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "Error",
                "message": "Error al obtener la configuración de empleados",
            }, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(
    tags=["Reportes - Configuraciones"],
    summary="configuraciones de Reportes para codigos de asignaciones",
)
class assignmentsReportConfigView(APIView):
    def get(self, request):
        try:
            data = get_config_by_category('asignaciones')
            if not data:
                return Response({
                    "status": "Error",
                    "message": "No se pudo cargar la configuracion de asignaciones"
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                "status": "Ok",
                "message": "Configuracion de asignaciones cargada correctamente",
                "data":data
                }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "Error",
                "message": "Error al obtener la configuracion de asignaciones",
            }, status=status.HTTP_400_BAD_REQUEST)
@extend_schema(
    tags=["Reportes - Configuraciones"],
    summary="configuraciones de Reportes para familiares",
)
class FamilyReportConfigView(APIView):
    def get(self, request):
        try:
            data = get_config_by_category('familiares')
            if not data:
                return Response({
                    "status": "Error",
                    "message": "No se pudo cargar la configuracion de familiares"
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({ 
                "status": "Ok",
                "message": "Configuracion de familiares cargada correctamente",
                "data":data
                }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "Error",
                "message": "Error al obtener la configuración de familiares",
            }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Reportes - Configuraciones"],
    summary="configuraciones de Reportes para egresados",
)
class GraduateReportConfigView(APIView):
    def get(self, request):
        try:
            data = get_config_by_category('egresados')
            if not data:
                return Response({
                    "status": "Error",
                    "message": "No se pudo cargar la configuracion de egresados"
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                "status": "Ok",
                "message": "Configuracion de egresados cargada correctamente",
                "data":data
                }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "Error",
                "message": "Error al obtener la configuracion de egresados",
            }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Reportes - Configuraciones"],
    summary="Clasificacion de los tipos de reportes",
)
class ReportTypesConfigView(APIView):
    def get(self, request):
        try:
            tipos = get_report_types_config()
            return Response({
                "status": "Ok",  
                "message": "Tipos de reporte cargados correctamente",
                "data":tipos
                }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "Error",
                "message": 'Error al obtener los tipos de reporte',
             
            }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Reportes - Configuraciones"],
    summary="Clasificacion de los tipos de reportes",
)
class AllReportsConfigView(APIView):

    def get(self, request):
        try:
            categorias = get_available_report_categories()
            return Response({
                "status": "Ok",
                "message": "Configuraciones cargadas correctamente",
                "data": categorias
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                "status": "Error",
                "message": "No se pudo cargar ninguna configuracion",
            }, status=status.HTTP_400_BAD_REQUEST)



# =============================================================================
# GENERACIÓN DE REPORTES PDF
# =============================================================================

@extend_schema(
    tags=["Reportes"],
    summary="Generar Reporte PDF",
    description="""
    Genera un reporte PDF según la categoría especificada.
    
    **Categorías disponibles:**
    
    1. **empleados**: Lista de empleados con datos básicos
       - Cédula, nombres, apellidos
       - Fecha de nacimiento e ingreso
       - Años en APN, número de contrato
       - Sexo, estado civil
    
    2. **familiares**: Lista de empleados con sus familiares
       - Datos del empleado (cédula, nombre)
       - Datos del familiar (cédula, nombre, parentesco)
       - Fecha de nacimiento, sexo, estado civil
       - Heredero, mismo ente
    
    Retorna el PDF directamente para descargar.
    """,
    request=ReportePDFSerializer,
    responses={
        200: {
            'content': {'application/pdf': {}},
            'description': 'PDF generado exitosamente'
        }
    },
    examples=[
        OpenApiExample(
            'Ejemplo de PDF de Empleados',
            summary='Generar PDF de empleados filtrados',
            description='Genera un PDF con todos los empleados de una dependencia específica.',
            value={
                "categoria": "familiares",
                "agrupar_por": "tipo_nomina",
                "tipo_reporte": "lista",
                "filtros": {
                    "sexo_id": 1
                }
               
            },
            request_only=True,
        ),
        OpenApiExample(
            'Ejemplo de PDF de Familiares',
            summary='Generar PDF de familiares',
            description='Genera un PDF con empleados y sus familiares.',
            value={
                "categoria": "familiares",
                "filtros": {}
            },
            request_only=True,
        ),
    ]
)
@api_view(['POST'])
def generate_pdf_report_active(request):

    serializer = ReportePDFSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({
            'status': "Error",
            'message': serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        validated_data = serializer.validated_data
        categoria = validated_data.get('categoria', 'empleados')
        filtros = validated_data.get('filtros', {})
        
        # Categorías soportadas
        categorias_soportadas = ['empleados', 'familiares', 'asignaciones', 'egresados']
        
        if categoria not in categorias_soportadas:
            return Response({
                'status': "Error",
                'message': f"La categoría '{categoria}' no está soportada para PDF. Categorías disponibles: {', '.join(categorias_soportadas)}",
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generar PDF según la categoría
        if categoria == 'empleados':
            return _generate_employee_pdf(filtros)
        elif categoria == 'familiares':
            return _generate_family_activo_pdf(filtros)
        elif categoria == 'asignaciones':
            return _generate_assignment_pdf(filtros)
        elif categoria == 'egresados':
            return _generate_graduate_pdf(filtros)
        
    except Exception as e:
        import traceback
        return Response({
            'status': "Error",
            'message': str(e),
            'detail': traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _generate_employee_pdf(filtros):
    Employee = apps.get_model('RAC', 'Employee')
    AsigTrabajo = apps.get_model('RAC', 'AsigTrabajo')
    OrganismoAdscrito = apps.get_model('RAC', 'OrganismoAdscrito')  # Se añade para consultar los hijos

    # 3. Procesamiento de filtros
    config = MAPA_REPORTES.get('empleados', {})
    filtros_permitidos = config.get('filtros_permitidos', {})
    query_filtros = {}
    asignacion_filtros = {}

    for k, v in filtros.items():
        if v is not None and k in filtros_permitidos:
            campo = filtros_permitidos[k]
            
            if k == 'OrganismoAdscrito_id':
                # Obtenemos los IDs de los hijos y le sumamos el ID del padre (v)
                hijos_ids = OrganismoAdscrito.objects.filter(parent_id=v).values_list('id', flat=True)
                ids_busqueda = [v] + list(hijos_ids)
                
                campo_in = f"{campo}__in"
                
                query_filtros[campo_in] = ids_busqueda
                if 'assignments__' in campo_in:
                    asignacion_filtros[campo_in.replace('assignments__', '')] = ids_busqueda
                    
            else: # <--- DEBE IR EXACTAMENTE AQUÍ, ALINEADO CON EL IF ANTERIOR
                query_filtros[campo] = v
                if 'assignments__' in campo:
                    asignacion_filtros[campo.replace('assignments__', '')] = v
                    
    query_filtros['assignments__Tipo_personal__tipo_personal'] = PERSONAL_ACTIVO
    asignacion_filtros['Tipo_personal__tipo_personal'] = PERSONAL_ACTIVO

    queryset = Employee.objects.select_related(
        'sexoid', 'estadoCivil'
    ).filter(
        **query_filtros
    ).prefetch_related(
        Prefetch(
            'assignments',
            queryset=AsigTrabajo.objects.filter(**asignacion_filtros).select_related(
                'Dependencia',
                'DireccionGeneral',
                'denominacioncargoid', 
                'tiponominaid',
                'Tipo_personal'
            ).order_by('denominacioncargoid__orden_by_cargo','-fecha_actualizacion'),
            to_attr='filtered_assignments'
        )
    ).order_by(
        'cedulaidentidad'
    ).distinct()

    generator = EmployeePDFGenerator(
        employees=list(queryset),
        title="REPORTE DE TRABAJADORES (ACTIVOS)",
        filters=filtros
    )

    return generator.get_response(as_attachment=True)




def _generate_family_activo_pdf(filtros):
    """Genera el PDF de familiares activos aplicando Prefetch."""
    Employee = apps.get_model('RAC', 'Employee')
    # IMPORTANTE: Asegúrate de que el nombre del modelo de carga familiar sea el correcto
    CargaFamiliar = apps.get_model('RAC', 'Employeefamily') 
    
    config = MAPA_REPORTES.get('familiares', {})
    filtros_permitidos = config.get('filtros_permitidos', {})

    # 1. Separar los filtros dinámicamente
    filtros_empleado = {}
    filtros_familiar = {}
    
    for filtro_key, filtro_value in filtros.items():
        if filtro_value is not None and filtro_key in filtros_permitidos:
            campo_db = filtros_permitidos[filtro_key]
            
            if campo_db.startswith('carga_familiar__'):
                # Le quitamos el prefijo para poder usarlo directo en el modelo CargaFamiliar
                campo_limpio = campo_db.replace('carga_familiar__', '')
                filtros_familiar[campo_limpio] = filtro_value
            else:
                filtros_empleado[campo_db] = filtro_value

    # 2. Crear el QuerySet para los familiares (esto filtrará lo que se muestra en el PDF)
    familiares_qs = CargaFamiliar.objects.select_related(
        'parentesco', 
        'sexo', 
        'estadoCivil'
    )
    if filtros_familiar:
        familiares_qs = familiares_qs.filter(**filtros_familiar)

    # 3. Construir la consulta principal de Empleados
    queryset = Employee.objects.select_related(
        'sexoid',
        'estadoCivil'
    ).prefetch_related(
        Prefetch('carga_familiar', queryset=familiares_qs),
        'assignments',
        'assignments__Dependencia',
        'assignments__DireccionGeneral',
        'assignments__DireccionLinea',
        'assignments__Coordinacion'
    ).filter(
        carga_familiar__isnull=False,
        assignments__Tipo_personal__tipo_personal=PERSONAL_ACTIVO
    )
    
    # 4. Aplicar los filtros de nivel Empleado (Dependencia, nómina, vivienda, etc.)
    if filtros_empleado:
        queryset = queryset.filter(**filtros_empleado)
        
    # 5. Aplicar los filtros familiares al Empleado (para no traer empleados que no tengan hijos, etc.)
    # Volvemos a armar el diccionario original solo para los familiares
    if filtros_familiar:
        filtros_para_empleado = {f"carga_familiar__{k}": v for k, v in filtros_familiar.items()}
        queryset = queryset.filter(**filtros_para_empleado)

    queryset = queryset.distinct().order_by('apellidos', 'nombres')
    
    generator = FamilyPDFGenerator(
        employees=queryset,
        title="Reporte de Familiares",
        filters=filtros
    )
    
    return generator.get_response(as_attachment=True)


def _generate_assignment_pdf(filtros):
    AsigTrabajo = apps.get_model('RAC', 'AsigTrabajo')
    OrganismoAdscrito = apps.get_model('RAC', 'OrganismoAdscrito') 
    
    queryset = AsigTrabajo.objects.select_related(
        'employee', 
        'denominacioncargoid', 
        'denominacioncargoespecificoid',
        'gradoid', 
        'tiponominaid', 
        'DireccionGeneral', 
        'Tipo_personal',
        'estatusid',
        'OrganismoAdscritoid'
    ).only(
        'codigo',
        'employee__cedulaidentidad', 
        'employee__nombres', 
        'employee__apellidos',
        'denominacioncargoid__cargo',
        'denominacioncargoespecificoid__cargo',
        'OrganismoAdscritoid__Organismoadscrito',
        'gradoid__grado',
        'tiponominaid__nomina',
        'DireccionGeneral__direccion_general',
        'Tipo_personal__tipo_personal',
        'estatusid__estatus'
    )

    queryset = queryset.filter(Tipo_personal__tipo_personal=PERSONAL_ACTIVO)
    config = MAPA_REPORTES.get('asignaciones', {})
    filtros_permitidos = config.get('filtros_permitidos', {})
    

    query_filtros = Q()
    for filtro_key, filtro_value in filtros.items():
        if filtro_value is not None and filtro_key in filtros_permitidos:
            campo_db = filtros_permitidos[filtro_key]
            
            if filtro_key == 'OrganismoAdscrito_id':
                padre_id = int(filtro_value)
                hijos_ids = OrganismoAdscrito.objects.filter(parent_id=padre_id).values_list('id', flat=True)
                ids_busqueda = [padre_id] + list(hijos_ids)
                
                campo_in = f"{campo_db}__in"
                query_filtros &= Q(**{campo_in: ids_busqueda})
                
            else:
                query_filtros &= Q(**{campo_db: filtro_value})
                
    queryset = queryset.filter(query_filtros).order_by('employee__cedulaidentidad','tiponominaid__nomina')

    generator = AssignmentPDFGenerator(
        assignments=queryset,
        title="Reporte de Cargos",
        filters=filtros
    )
    
    return generator.get_response(as_attachment=True)


def _generate_graduate_pdf(filtros):
    """Genera el PDF de egresados."""
    EmployeeEgresado = apps.get_model('RAC', 'EmployeeEgresado')
    
    # Obtener egresados con relaciones
    queryset = EmployeeEgresado.objects.select_related(
        'employee',
        'motivo_egreso'
    ).prefetch_related(
        'cargos_historial',
        'cargos_historial__denominacioncargoid',
        'cargos_historial__DireccionGeneral'
    ).all().distinct()
    
    # Aplicar filtros
    config = MAPA_REPORTES.get('egresados', {})
    filtros_permitidos = config.get('filtros_permitidos', {})
    
    for filtro_key, filtro_value in filtros.items():
        if filtro_value is not None and filtro_key in filtros_permitidos:
            campo_db = filtros_permitidos[filtro_key]
            queryset = queryset.filter(**{campo_db: filtro_value})
    
    queryset = queryset.order_by('-fecha_egreso')
    
    generator = GraduatePDFGenerator(
        graduates=queryset,
        title="Reporte de Egresados",
        filters=filtros
    )
    
    return generator.get_response(as_attachment=True)
