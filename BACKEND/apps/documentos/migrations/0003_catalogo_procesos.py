"""N-1: catálogo de procesos, rename de `momento` y migración idempotente de datos.

Las funciones no importan modelos vivos. La huella de cada versión se recalcula
con el algoritmo congelado equivalente al de `huella_borrador`, usando ya la
clave `proceso`, para conservar la comparación con el borrador.
"""
import hashlib
import json

from django.db import migrations, models

EQUIVALENCIAS = {
    'ventana2': 'ingreso_ventana2',
    'contratacion': 'ingreso_contratacion',
    'otro': 'bajo_demanda',
}
INVERSA = {nuevo: viejo for viejo, nuevo in EQUIVALENCIAS.items()}
ETIQUETAS = {
    'ingreso_ventana2': 'Ingreso por Ventana 2',
    'ingreso_contratacion': 'Ingreso por contratación',
    'punto_cuenta:ingreso_postulacion': 'Punto de Cuenta: ingreso por postulación',
    'punto_cuenta:cambio_oficina': 'Punto de Cuenta: cambio de oficina',
    'punto_cuenta:cambio_nivel': 'Punto de Cuenta: cambio de nivel',
    'punto_cuenta:cambio_division': 'Punto de Cuenta: cambio de división',
    'punto_cuenta:cambio_cargo_misma_oficina': 'Punto de Cuenta: cambio de cargo en la misma oficina',
    'punto_cuenta:egreso_activo': 'Punto de Cuenta: egreso de personal activo',
    'punto_cuenta:pase_a_pasivo': 'Punto de Cuenta: pase a pasivo',
    'punto_cuenta:encargaduria_prestamo': 'Punto de Cuenta: encargaduría o préstamo de cargo',
    'punto_cuenta:cambio_estatus': 'Punto de Cuenta: cambio de estatus',
    'movimiento:ingreso': 'Movimiento: ingreso',
    'movimiento:traslado': 'Movimiento: traslado',
    'movimiento:egreso': 'Movimiento: egreso',
    'movimiento:cambio_de_estatus': 'Movimiento: cambio de estatus',
    'bajo_demanda': 'Bajo demanda',
}


def _huella(version, clave_proceso: str, valor_proceso: str, meta: dict) -> str:
    contenido = {
        'modo': version.modo,
        'definicion': version.definicion,
        'campos_propios': version.campos_propios,
        'fondo_sha256': version.fondo_sha256,
        'metadatos': {
            'nombre': meta.get('nombre'),
            clave_proceso: valor_proceso,
            'firmante': meta.get('firmante'),
            'requiere_firma_clic': meta.get('requiere_firma_clic'),
        },
    }
    return hashlib.sha256(json.dumps(contenido, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _normalizar_proceso(valor, mapa, defecto):
    return mapa.get(valor, valor if valor in ETIQUETAS else defecto)


def _convertir(apps, mapa: dict, clave_vieja: str, clave_nueva: str, defecto: str):
    Plantilla = apps.get_model('documentos', 'PlantillaDocumentoModel')
    Version = apps.get_model('documentos', 'VersionPlantillaDocumentoModel')
    Documento = apps.get_model('documentos', 'DocumentoGeneradoModel')
    for plantilla in Plantilla.objects.all():
        plantilla.proceso = _normalizar_proceso(plantilla.proceso, mapa, defecto)
        plantilla.save(update_fields=['proceso'])
    for version in Version.objects.all():
        meta = dict(version.metadatos or {})
        previo = meta.pop(clave_vieja, None)
        valor = _normalizar_proceso(previo or meta.get(clave_nueva), mapa, defecto)
        meta.pop('momento', None)
        meta.pop('proceso', None)
        meta[clave_nueva] = valor
        version.metadatos = meta
        version.definicion_sha256 = _huella(version, clave_nueva, valor, meta)
        version.save(update_fields=['metadatos', 'definicion_sha256'])
    for documento in Documento.objects.select_related('version', 'plantilla').all():
        documento.plantilla_codigo = documento.plantilla.codigo
        documento.plantilla_nombre = documento.plantilla.nombre
        # El borrador podía cambiar de momento sin publicar: el documento pertenece
        # al proceso congelado en los metadatos de la versión que realmente usó.
        meta_version = documento.version.metadatos or {}
        documento.proceso = _normalizar_proceso(
            meta_version.get('proceso') or meta_version.get('momento'), mapa, defecto,
        )
        documento.proceso_etiqueta = ETIQUETAS.get(documento.proceso, '')
        documento.save(update_fields=['plantilla_codigo', 'plantilla_nombre', 'proceso', 'proceso_etiqueta'])


def adelante(apps, schema_editor):
    _convertir(apps, EQUIVALENCIAS, 'momento', 'proceso', 'bajo_demanda')


def atras(apps, schema_editor):
    _convertir(apps, INVERSA, 'proceso', 'momento', 'otro')


class Migration(migrations.Migration):
    dependencies = [
        ('documentos', '0002_integracion_expediente'),
    ]

    operations = [
        migrations.RenameField(
            model_name='plantilladocumentomodel', old_name='momento', new_name='proceso',
        ),
        migrations.AlterField(
            model_name='plantilladocumentomodel', name='proceso',
            field=models.CharField(db_index=True, default='bajo_demanda', max_length=80),
        ),
        migrations.AddField(
            model_name='documentogeneradomodel', name='plantilla_codigo',
            field=models.CharField(blank=True, default='', max_length=60),
        ),
        migrations.AddField(
            model_name='documentogeneradomodel', name='plantilla_nombre',
            field=models.CharField(blank=True, default='', max_length=160),
        ),
        migrations.AddField(
            model_name='documentogeneradomodel', name='proceso',
            field=models.CharField(db_index=True, default='bajo_demanda', max_length=80),
        ),
        migrations.AddField(
            model_name='documentogeneradomodel', name='proceso_etiqueta',
            field=models.CharField(blank=True, default='', max_length=160),
        ),
        migrations.RunPython(adelante, atras),
    ]
