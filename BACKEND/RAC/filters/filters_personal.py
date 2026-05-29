import django_filters
from USER.models.user_models import cuenta
from RAC.models.personal_models import Employee, AsigTrabajo
from RAC.models.family_personal_models import Employeefamily


class CuentaFilter(django_filters.FilterSet):
    cedulaidentidad = django_filters.CharFilter(
        field_name='cedula__cedulaidentidad', 
        lookup_expr='exact'
    )
    codigo = django_filters.CharFilter(
        field_name='cedula__assignments__codigo', 
        lookup_expr='exact'
    )
    dependencia_id = django_filters.NumberFilter(
        field_name='cedula__assignments__Dependencia'
    )
    direccion_general_id = django_filters.NumberFilter(
        field_name='cedula__assignments__DireccionGeneral'
    )
    direccion_linea_id = django_filters.NumberFilter(
        field_name='cedula__assignments__DireccionLinea'
    )
    coordinacion_id = django_filters.NumberFilter(
        field_name='cedula__assignments__Coordinacion'
    )    

    class Meta:
        model = cuenta
        fields = []
class EmployeeFilter(django_filters.FilterSet):
    cedulaidentidad = django_filters.CharFilter( lookup_expr='exact')
    codigo = django_filters.CharFilter(field_name='assignments__codigo', lookup_expr='exact')
    tipo_nomina = django_filters.NumberFilter(field_name='assignments__tiponominaid')
    dependencia_id = django_filters.NumberFilter(field_name='assignments__DireccionGeneral__dependenciaId')
    direccion_general_id = django_filters.NumberFilter(field_name='assignments__DireccionGeneral')
    direccion_linea_id = django_filters.NumberFilter(field_name='assignments__DireccionLinea')
    coordinacion_id = django_filters.NumberFilter(field_name='assignments__Coordinacion')

    class Meta:
        model = Employee
        fields = []
    
    
        
        
class AsigTrabajoFilter(django_filters.FilterSet):
    codigo = django_filters.CharFilter(lookup_expr='exact')
    estatus_id = django_filters.NumberFilter(field_name='estatusid')
    tipo_nomina = django_filters.NumberFilter(field_name='tiponominaid')
    dependencia_id = django_filters.NumberFilter(field_name='DireccionGeneral__dependenciaId')
    direccion_general_id = django_filters.NumberFilter(field_name='DireccionGeneral')
    direccion_linea_id = django_filters.NumberFilter(field_name='DireccionLinea')
    coordinacion_id = django_filters.NumberFilter(field_name='Coordinacion')

    class Meta:
        model = AsigTrabajo
        fields = []
        
        
        
class EmployeeFamilyFilter(django_filters.FilterSet):
    id_empleado = django_filters.NumberFilter(
        field_name='employeecedula__id', 
        lookup_expr='exact'
    )
    cedula_empleado = django_filters.CharFilter(
        field_name='employeecedula__cedulaidentidad', lookup_expr='exact')
    dependencia_id = django_filters.NumberFilter(
        field_name='employeecedula__assignments__DireccionGeneral__dependenciaId'
    )
    direccion_general_id = django_filters.NumberFilter(
        field_name='employeecedula__assignments__DireccionGeneral'
    )
    direccion_linea_id = django_filters.NumberFilter(
        field_name='employeecedula__assignments__DireccionLinea'
    )
    coordinacion_id = django_filters.NumberFilter(
        field_name='employeecedula__assignments__Coordinacion'
    )

    class Meta:
        model = Employeefamily
        fields = []