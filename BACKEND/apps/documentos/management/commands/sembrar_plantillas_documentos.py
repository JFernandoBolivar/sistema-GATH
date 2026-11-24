"""Siembra las plantillas de documentos de ejemplo, en borrador e idempotente (F-1).

    python manage.py sembrar_plantillas_documentos [--pdf-caja-ahorro "/ruta/3- AFILIACION CAJA DE AHORRO.pdf"]

- «Notificación de Itinerancia»: formulario propio (no necesita archivos).
- «Afiliación Caja de Ahorro»: formato de terceros; necesita la ruta del PDF oficial, que se sube al almacén
  configurado. NO use este comando contra producción con el PDF real: son datos de ejemplo para desarrollo.
Si el código ya existe no se toca (se informa y se sigue).
"""
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.documentos.application.use_cases import gestionar_plantillas as uc
from apps.documentos.infrastructure import almacen as almacen_mod
from apps.documentos.infrastructure import plantillas_ejemplo as ej
from apps.documentos.infrastructure.pdf.motor import InspectorPdfDocumentos
from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoPlantillasORM


class Command(BaseCommand):
    help = 'Siembra las plantillas de documentos de ejemplo (borrador, idempotente).'

    def add_arguments(self, parser):
        parser.add_argument('--pdf-caja-ahorro', help='Ruta del PDF oficial «3- AFILIACION CAJA DE AHORRO.pdf».')

    def handle(self, *args, **opciones):
        repo = RepoPlantillasORM()
        self._itinerancia(repo)
        self._caja_ahorro(repo, opciones.get('pdf_caja_ahorro'))

    def _itinerancia(self, repo):
        codigo = 'NOTIFICACION_ITINERANCIA'
        if repo.obtener_por_codigo(codigo):
            self.stdout.write(f'Ya existe {codigo}: no se modifica.')
            return
        uc.crear_plantilla(repo, {
            'codigo': codigo, 'nombre': 'Notificación de Itinerancia', 'modo': 'formulario',
            'descripcion': 'Declaración de la ruta habitual vivienda-trabajo (reproduce la planilla «Notificación itinere»). Ejemplo.',
            'momento': 'contratacion', 'firmante': 'postulante', 'requiere_firma_clic': True,
            'definicion': ej.definicion_itinerancia(), 'campos_propios': ej.campos_propios_itinerancia(),
        }, None)
        self.stdout.write(self.style.SUCCESS(f'Creada {codigo} (borrador).'))

    def _caja_ahorro(self, repo, ruta):
        """Todo o nada: si falla la subida del PDF no queda la plantilla a medias.

        Si la plantilla ya existe pero sin fondo (siembra anterior fallida) y se pasa el PDF, se completa.
        """
        codigo = 'AFILIACION_CAJA_AHORRO'
        existente = repo.obtener_por_codigo(codigo)
        if existente and existente.fondo_clave:
            self.stdout.write(f'Ya existe {codigo}: no se modifica.')
            return
        if not ruta:
            if existente:
                self.stdout.write(self.style.WARNING(
                    f'{codigo} existe sin PDF de fondo: indique --pdf-caja-ahorro para completarla.'))
            else:
                self.stdout.write(self.style.WARNING(f'{codigo} se omite: indique --pdf-caja-ahorro con la ruta del PDF oficial.'))
            return
        archivo = Path(ruta)
        if not archivo.is_file():
            raise CommandError(f'No existe el archivo {ruta}.')
        contenido = archivo.read_bytes()
        with transaction.atomic():
            plantilla = existente or uc.crear_plantilla(repo, {
                'codigo': codigo, 'nombre': 'Afiliación Caja de Ahorro', 'modo': 'pdf_overlay',
                'descripcion': 'Solicitud de afiliación a la Caja de Ahorro de los Trabajadores de CONATEL (F-CA002). Ejemplo.',
                'momento': 'ventana2', 'firmante': 'postulante', 'requiere_firma_clic': True,
            }, None)
            plantilla = uc.subir_fondo(repo, almacen_mod.obtener_almacen(), InspectorPdfDocumentos(), plantilla.id,
                                       contenido, archivo.name, None)
            uc.actualizar_borrador(repo, plantilla.id, {'definicion': ej.definicion_caja_ahorro()}, None)
        verbo = 'Completada' if existente else 'Creada'
        self.stdout.write(self.style.SUCCESS(f'{verbo} {codigo} (borrador, con su PDF de fondo).'))
