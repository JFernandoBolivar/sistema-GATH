"""Verifica la plantilla LEGACY antes de desplegar (auditoría K-10).

Los carnets emitidos antes del versionado de plantillas (sin diseño congelado ni plantilla)
se reimprimen con la plantilla LEGACY que siembra la migración 0017. Si esa migración no
encontró la imagen de `CarnetTemplate`, sembró un fondo vectorial de respaldo y esos carnets
saldrían distintos a los originales. Este comando lo informa y genera una muestra para
compararla con un carnet impreso de la época.

Uso:
    python manage.py verificar_plantilla_legacy
    python manage.py verificar_plantilla_legacy --muestra /tmp/legacy.png
"""
from django.core.management.base import BaseCommand, CommandError

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    PlantillaCarnetModel,
)


def _usa_imagen_heredada(definicion: dict) -> bool:
    return any(
        e.get('id') == 'legacy-fondo' and str((e.get('props') or {}).get('data', '')).startswith('data:image/')
        for e in definicion.get('anverso', []) or []
    )


class Command(BaseCommand):
    help = 'Informa si la plantilla LEGACY usa la imagen heredada real y genera una muestra (solo lectura).'

    def add_arguments(self, parser):
        parser.add_argument('--muestra', help='Ruta de un PNG donde guardar el anverso de muestra.')

    def handle(self, *args, **opciones):
        legacy = PlantillaCarnetModel.objects.filter(estado='LEGACY').order_by('created_at').first()
        if legacy is None:
            raise CommandError('No existe la plantilla LEGACY: aplique la migración carnetizacion.0017.')

        dependientes = CarnetEmitidoModel.objects.filter(
            plantilla_snapshot__isnull=True, plantilla_id__isnull=True,
        )
        total = dependientes.count()
        activos = dependientes.filter(activo=True).count()
        real = _usa_imagen_heredada(legacy.definicion or {})

        self.stdout.write(f'Plantilla LEGACY: {legacy.nombre} (id {legacy.pk})')
        self.stdout.write(f'Carnets que se reimprimen con ella: {total} (activos: {activos})')
        if real:
            self.stdout.write(self.style.SUCCESS('Usa la imagen heredada real de CarnetTemplate.'))
        else:
            self.stdout.write(self.style.WARNING(
                'Usa el FONDO VECTORIAL DE RESPALDO: la imagen de CarnetTemplate no se encontró al '
                'migrar. Esos carnets se reimprimirán con un diseño distinto al original.'
            ))

        if opciones.get('muestra'):
            from pdf2image import convert_from_bytes

            from apps.carnetizacion.infrastructure.pdf.carnet_pdf import DatosCarnetPdf, generar_carnet_pdf_fiel

            datos = DatosCarnetPdf(
                nombre_completo='NOMBRE DE MUESTRA', cedula='00000000', cargo='CARGO',
                departamento='OFICINA', security_hash='muestra-legacy',
            )
            pdf = generar_carnet_pdf_fiel(legacy.definicion, datos)
            convert_from_bytes(pdf, first_page=1, last_page=1, dpi=150)[0].save(opciones['muestra'])
            self.stdout.write(f"Muestra guardada en {opciones['muestra']}")
