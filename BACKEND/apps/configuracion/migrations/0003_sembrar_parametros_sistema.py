"""
Siembra idempotente de los parámetros del sistema (D9 / B3).

Las filas se crean aquí, no en el GET de la pantalla: así el listado es de solo
lectura. Los valores son los de `apps.configuracion.domain.parametros`; si una
fila ya existe se respeta su valor.
"""
from django.db import migrations


PARAMETROS = (
    {
        'clave': 'notificaciones.bienestar_por_correo',
        'etiqueta': 'Avisar a Bienestar por correo',
        'descripcion': (
            'Además del aviso en el sistema, envía un correo a las cuentas de Bienestar '
            'cuando hay una solicitud nueva, una actualización enviada o una corrección.'
        ),
        'grupo': 'notificaciones',
        'tipo': 'booleano',
        'valor': 'false',
        'valor_min': None,
        'valor_max': None,
    },
    {
        'clave': 'notificaciones.movimientos_por_correo',
        'etiqueta': 'Avisar movimientos por correo',
        'descripcion': (
            'Envía por correo los avisos de ingreso, traslado, cambio de estatus y egreso '
            'del personal. Apagado, solo se muestran en el sistema.'
        ),
        'grupo': 'notificaciones',
        'tipo': 'booleano',
        'valor': 'false',
        'valor_min': None,
        'valor_max': None,
    },
    {
        'clave': 'plazos.password_inicial_dias',
        'etiqueta': 'Vigencia de la contraseña inicial',
        'descripcion': (
            'Días que dura la contraseña inicial (la cédula) antes de vencer. Aplica al alta '
            'automática de la cuenta y a «Restablecer acceso».'
        ),
        'grupo': 'plazos',
        'tipo': 'entero',
        'valor': '7',
        'valor_min': 1,
        'valor_max': 365,
    },
    {
        'clave': 'plazos.autogestion_max_prorrogas',
        'etiqueta': 'Máximo de prórrogas por ventana',
        'descripcion': (
            'Cantidad máxima de prórrogas que Bienestar puede conceder a una ventana de '
            'actualización. 0 = sin límite.'
        ),
        'grupo': 'plazos',
        'tipo': 'entero',
        'valor': '5',
        'valor_min': 0,
        'valor_max': 50,
    },
    {
        'clave': 'plazos.autogestion_aviso_dias',
        'etiqueta': 'Anticipación del aviso de vencimiento',
        'descripcion': (
            'Días antes del vencimiento en que se avisa al trabajador que su ventana de '
            'actualización está por cerrar.'
        ),
        'grupo': 'plazos',
        'tipo': 'entero',
        'valor': '1',
        'valor_min': 1,
        'valor_max': 30,
    },
    {
        'clave': 'fe_de_vida.dias_recordatorio',
        'etiqueta': 'Días de recordatorio sugeridos',
        'descripcion': (
            'Días antes del cierre que se ofrecen como recordatorio al crear un proceso de '
            'fe de vida. Sepárelos con coma (por ejemplo 30,15,7,3,1).'
        ),
        'grupo': 'fe_de_vida',
        'tipo': 'texto',
        'valor': '30,15,7,3,1',
        'valor_min': None,
        'valor_max': None,
    },
)


def sembrar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    for datos in PARAMETROS:
        ParametroSistema.objects.get_or_create(clave=datos['clave'], defaults=datos)


def retirar(apps, schema_editor):
    ParametroSistema = apps.get_model('configuracion', 'ParametroSistemaModel')
    ParametroSistema.objects.filter(clave__in=[p['clave'] for p in PARAMETROS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0002_parametrosistemamodel'),
    ]

    operations = [
        migrations.RunPython(sembrar, retirar),
    ]
