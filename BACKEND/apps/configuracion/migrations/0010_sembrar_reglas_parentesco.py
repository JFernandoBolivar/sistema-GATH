"""FIX-FAM2: siembra las reglas iniciales de los parentescos existentes.

Los valores iniciales acordados son:
- hijo/tutelado: cédula sintética hasta los 9 años, diferencia mínima de 12
  años menor que el titular;
- cónyuge: edad mínima 18;
- madre: sexo F y 12 años mayor que el titular;
- padre: sexo M y 12 años mayor que el titular.

`RAC_parentesco` es una tabla legada (`managed=False`); se lee con SQL y solo
se escribe en la tabla propia de reglas. Si la tabla no existe en una base
nueva, la siembra se omite y el dominio usa el respaldo por descripción.
"""
from django.db import migrations


def _valores(descripcion: str) -> dict:
    nombre = ' '.join((descripcion or '').split()).upper()
    base = {
        'es_hijo': False,
        'menor_a_cargo': False,
        'sin_cedula_hasta_edad': None,
        'edad_minima': None,
        'diferencia_minima': None,
        'diferencia_tipo': 'NINGUNA',
        'sexo_permitido': '',
        'soporte_sugerido': '',
        'activo': True,
    }
    if 'HIJO' in nombre or 'HIJA' in nombre:
        base.update({
            'es_hijo': True,
            'sin_cedula_hasta_edad': 9,
            'diferencia_minima': 12,
            'diferencia_tipo': 'MENOR',
            'soporte_sugerido': 'PARTIDA DE NACIMIENTO',
        })
    elif 'TUTELADO' in nombre or 'TUTELADA' in nombre:
        base.update({
            'menor_a_cargo': True,
            'sin_cedula_hasta_edad': 9,
            'diferencia_minima': 12,
            'diferencia_tipo': 'MENOR',
            'soporte_sugerido': 'SENTENCIA DE TUTELA',
        })
    elif 'CONYUGE' in nombre or 'CÓNYUGE' in nombre:
        base.update({'edad_minima': 18, 'soporte_sugerido': 'ACTA DE MATRIMONIO'})
    elif nombre == 'MADRE':
        base.update({
            'sexo_permitido': 'F',
            'diferencia_minima': 12,
            'diferencia_tipo': 'MAYOR',
            'soporte_sugerido': 'PARTIDA DE NACIMIENTO',
        })
    elif nombre == 'PADRE':
        base.update({
            'sexo_permitido': 'M',
            'diferencia_minima': 12,
            'diferencia_tipo': 'MAYOR',
            'soporte_sugerido': 'PARTIDA DE NACIMIENTO',
        })
    return base


def sembrar(apps, schema_editor):
    Regla = apps.get_model('configuracion', 'ReglaParentescoModel')
    try:
        with schema_editor.connection.cursor() as cursor:
            cursor.execute('SELECT id, descripcion_parentesco FROM "RAC_parentesco"')
            filas = cursor.fetchall()
    except Exception:  # tabla legada ausente en una base nueva
        return
    for parentesco_id, descripcion in filas:
        if Regla.objects.filter(parentesco_id=parentesco_id).exists():
            continue
        Regla.objects.create(parentesco_id=parentesco_id, **_valores(descripcion))


def revertir(apps, schema_editor):
    Regla = apps.get_model('configuracion', 'ReglaParentescoModel')
    Regla.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracion', '0009_reglaparentescomodel'),
    ]

    operations = [
        migrations.RunPython(sembrar, revertir),
    ]
