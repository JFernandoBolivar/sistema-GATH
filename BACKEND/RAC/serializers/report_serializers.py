from rest_framework import serializers
from datetime import date
from dateutil.relativedelta import relativedelta
from RAC.utils.mapa_reporte import MAPA_REPORTES




class FiltrosReporteSerializer(serializers.Serializer):
    fecha_ingreso_Desde = serializers.DateField(required=False, allow_null=True, 
                                               input_formats=['iso-8601', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%d'])
    fecha_ingreso_Hasta = serializers.DateField(required=False, allow_null=True, 
                                               input_formats=['iso-8601', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%d'])
    fecha_apn_Desde = serializers.DateField(required=False, allow_null=True, 
                                           input_formats=['iso-8601', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%d'])
    fecha_apn_Hasta = serializers.DateField(required=False, allow_null=True, 
                                           input_formats=['iso-8601', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%d'])
    
    def get_fields(self):
        fields = super().get_fields()
      
        return fields

def transformar_edad_a_fecha(valor_edad):
    try:
        edad = int(valor_edad)
        return date.today() - relativedelta(years=edad)
    except (TypeError, ValueError):
        return None

class ReportePDFSerializer(serializers.Serializer):
    """
    Serializer para generar reportes PDF.
    Solo requiere la categoría y filtros opcionales.
    """
    CATEGORIAS = [
        ('empleados', 'Empleados'), 
        ('egresados', 'Egresados'), 
        ('familiares', 'Familiares'),
        ('asignaciones', 'Asignaciones/Cargos')
    ]
    
    categoria = serializers.ChoiceField(choices=CATEGORIAS)
    filtros = serializers.JSONField(required=False, default=dict)

    def validate(self, data):
        categoria = data.get('categoria')
        filtros = data.get('filtros', {})
        
        config = MAPA_REPORTES.get(categoria)
        
        if not config:
            raise serializers.ValidationError("Categoría no configurada")
        
        
        filtros_serializer = FiltrosReporteSerializer(data=filtros)
        if filtros_serializer.is_valid():
            filtros.update(filtros_serializer.validated_data)
        else:
            raise serializers.ValidationError({"filtros": filtros_serializer.errors})
            
        campos_edad = [
            'edad_min', 'edad_max', 
            'edad_empleado_min', 'edad_empleado_max',
            'edad_familiar_min', 'edad_familiar_max'
        ]

        for campo in campos_edad:
            if campo in filtros and filtros[campo] is not None:
                fecha_calculada = transformar_edad_a_fecha(filtros[campo])
                if fecha_calculada:
                    filtros[campo] = fecha_calculada

        return data
