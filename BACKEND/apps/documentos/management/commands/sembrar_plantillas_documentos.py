"""Siembra las plantillas de documentos del ingreso de personal, en BORRADOR e idempotente (F-1, F-4, F-5).

    python manage.py sembrar_plantillas_documentos [--pdf-caja-ahorro "/ruta/3- AFILIACION CAJA DE AHORRO.pdf"]
                                                   [--pdf-hcm "/ruta/7- PLANILLA HCM SEGUROS MIRANDAA.pdf"]
                                                   [--actualizar] [--solo CODIGO ...]

Formularios propios (no necesitan archivos):
  NOTIFICACION_ITINERANCIA, OFERTA_SERVICIOS, CONTRATO_TRABAJO, DECLARACION_JURADA_INCOMPATIBILIDAD,
  AUTORIZACION_DATOS_PERSONALES.
Formatos de terceros (necesitan la ruta del PDF oficial, que se sube al almacén configurado):
  AFILIACION_CAJA_AHORRO (--pdf-caja-ahorro) y HCM_SEGUROS_MIRANDA (--pdf-hcm).

Si el código ya existe NO se toca (se informa y se sigue). Con `--actualizar` se reemplaza el contenido del BORRADOR
(definición, campos propios y metadatos) por el del comando: sirve para corregir el diseño sembrado, pero pisa los
ajustes hechos desde el diseñador; no toca las versiones ya publicadas. `--solo` limita la acción a esos códigos.
NO use este comando contra producción con los PDF reales sin revisarlos: son un primer diseño para que el área lo ajuste.
"""
import hashlib
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.documentos.application.use_cases import gestionar_plantillas as uc
from apps.documentos.infrastructure import almacen as almacen_mod
from apps.documentos.infrastructure import plantillas_ejemplo as ej
from apps.documentos.infrastructure import plantillas_ingreso as ing
from apps.documentos.infrastructure.pdf.motor import InspectorPdfDocumentos
from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoPlantillasORM

# Formularios propios: (código, nombre, descripción, proceso, firmante, definición, campos propios).
FORMULARIOS = [
    ('NOTIFICACION_ITINERANCIA', 'Notificación de Itinerancia',
     'Declaración de la ruta habitual vivienda-trabajo (reproduce la planilla «Notificación itinere»).',
     'ingreso_contratacion', 'postulante', ej.definicion_itinerancia, ej.campos_propios_itinerancia),
    ('OFERTA_SERVICIOS', 'Oferta de Servicios',
     'Formato propio de CONATEL con los datos personales, académicos y laborales del postulante (reproduce la «Oferta de servicios»).',
     'ingreso_ventana2', 'postulante', ing.definicion_oferta, ing.campos_propios_oferta),
    ('CONTRATO_TRABAJO', 'Contrato de trabajo',
     'MODELO de contrato por tiempo determinado para personal contratado. Revisar el texto legal con Consultoría Jurídica antes de publicar.',
     'ingreso_contratacion', 'ambos', ing.definicion_contrato, ing.campos_propios_contrato),
    ('DECLARACION_JURADA_INCOMPATIBILIDAD', 'Declaración jurada de no incompatibilidad',
     'MODELO de declaración de no incompatibilidad y veracidad de datos. Revisar el texto con Consultoría Jurídica antes de publicar.',
     'ingreso_ventana2', 'postulante', ing.definicion_declaracion_jurada, lambda: []),
    ('AUTORIZACION_DATOS_PERSONALES', 'Autorización de tratamiento de datos personales',
     'MODELO de autorización para el uso de los datos en la relación laboral. Revisar el texto con Consultoría Jurídica antes de publicar.',
     'ingreso_ventana2', 'postulante', ing.definicion_autorizacion_datos, lambda: []),
]

# Formatos de terceros: (código, nombre, descripción, proceso, firmante, definición, campos propios, opción de la ruta).
TERCEROS = [
    ('AFILIACION_CAJA_AHORRO', 'Afiliación Caja de Ahorro',
     'Solicitud de afiliación a la Caja de Ahorro de los Trabajadores de CONATEL (F-CA002).',
     'ingreso_ventana2', 'postulante', ej.definicion_caja_ahorro, lambda: ej.campos_propios_caja_ahorro(), 'pdf_caja_ahorro'),
    ('HCM_SEGUROS_MIRANDA', 'Planilla HCM Seguros Miranda',
     'Solicitud de seguros Ramos de Personas (hospitalización, cirugía y maternidad) de Seguros Miranda; formato de la aseguradora.',
     'ingreso_ventana2', 'postulante', ing.definicion_hcm, ing.campos_propios_hcm, 'pdf_hcm'),
]


class Command(BaseCommand):
    help = 'Siembra las plantillas de documentos del ingreso de personal (borrador, idempotente).'

    def add_arguments(self, parser):
        parser.add_argument('--pdf-caja-ahorro', help='Ruta del PDF oficial «3- AFILIACION CAJA DE AHORRO.pdf».')
        parser.add_argument('--pdf-hcm', help='Ruta del PDF oficial «7- PLANILLA HCM SEGUROS MIRANDAA.pdf».')
        parser.add_argument('--actualizar', action='store_true',
                            help='Reemplaza el borrador de las plantillas que ya existen por el diseño sembrado.')
        parser.add_argument('--solo', action='append', default=[], metavar='CODIGO',
                            help='Limita la siembra a este código (se puede repetir).')

    def handle(self, *args, **opciones):
        repo = RepoPlantillasORM()
        actualizar = opciones['actualizar']
        solo = {c.upper() for c in opciones['solo']}
        conocidos = {f[0] for f in FORMULARIOS} | {t[0] for t in TERCEROS}
        if solo - conocidos:
            raise CommandError('Código desconocido: ' + ', '.join(sorted(solo - conocidos)))
        for codigo, nombre, descripcion, proceso, firmante, definicion, propios in FORMULARIOS:
            if solo and codigo not in solo:
                continue
            self._formulario(repo, codigo, nombre, descripcion, proceso, firmante, definicion(), propios(), actualizar)
        for codigo, nombre, descripcion, proceso, firmante, definicion, propios, opcion_pdf in TERCEROS:
            if solo and codigo not in solo:
                continue
            self._tercero(repo, codigo, nombre, descripcion, proceso, firmante, definicion(), propios(),
                          opciones.get(opcion_pdf), opcion_pdf.replace('_', '-'), actualizar)

    # ───────── formularios propios ─────────

    def _formulario(self, repo, codigo, nombre, descripcion, proceso, firmante, definicion, propios, actualizar):
        existente = repo.obtener_por_codigo(codigo)
        if existente and not actualizar:
            self.stdout.write(f'Ya existe {codigo}: no se modifica.')
            return
        datos = {'nombre': nombre, 'descripcion': descripcion, 'proceso': proceso, 'firmante': firmante,
                 'requiere_firma_clic': True, 'definicion': definicion, 'campos_propios': propios}
        if existente:
            uc.actualizar_borrador(repo, existente.id, datos, None)
            self.stdout.write(self.style.SUCCESS(f'Actualizado el borrador de {codigo}.'))
            return
        uc.crear_plantilla(repo, {'codigo': codigo, 'modo': 'formulario', **datos}, None)
        self.stdout.write(self.style.SUCCESS(f'Creada {codigo} (borrador).'))

    # ───────── formatos de terceros ─────────

    def _tercero(self, repo, codigo, nombre, descripcion, proceso, firmante, definicion, propios, ruta, flag, actualizar):
        """Todo o nada: si falla la subida del PDF no queda la plantilla a medias.

        Si la plantilla ya existe pero sin fondo (siembra anterior fallida) y se pasa el PDF, se completa.
        Con `--actualizar` se reemplaza su diseño; el PDF solo se vuelve a subir si se indica la ruta y cambió.
        """
        existente = repo.obtener_por_codigo(codigo)
        completa = bool(existente and existente.fondo_clave)
        if completa and not actualizar:
            self.stdout.write(f'Ya existe {codigo}: no se modifica.')
            return
        if not ruta and not completa:
            if existente:
                self.stdout.write(self.style.WARNING(f'{codigo} existe sin PDF de fondo: indique --{flag} para completarla.'))
            else:
                self.stdout.write(self.style.WARNING(f'{codigo} se omite: indique --{flag} con la ruta del PDF oficial.'))
            return
        contenido, archivo = None, None
        if ruta:
            archivo = Path(ruta)
            if not archivo.is_file():
                raise CommandError(f'No existe el archivo {ruta}.')
            contenido = archivo.read_bytes()
        datos = {'nombre': nombre, 'descripcion': descripcion, 'proceso': proceso, 'firmante': firmante,
                 'requiere_firma_clic': True, 'campos_propios': propios}
        with transaction.atomic():
            plantilla = existente or uc.crear_plantilla(repo, {'codigo': codigo, 'modo': 'pdf_overlay', **datos}, None)
            if contenido and (not completa or hashlib.sha256(contenido).hexdigest() != plantilla.fondo_sha256):
                plantilla = uc.subir_fondo(repo, almacen_mod.obtener_almacen(), InspectorPdfDocumentos(), plantilla.id,
                                           contenido, archivo.name, None)
            uc.actualizar_borrador(repo, plantilla.id, {**datos, 'definicion': definicion}, None)
        verbo = 'Actualizada' if completa else ('Completada' if existente else 'Creada')
        self.stdout.write(self.style.SUCCESS(f'{verbo} {codigo} (borrador, con su PDF de fondo).'))
