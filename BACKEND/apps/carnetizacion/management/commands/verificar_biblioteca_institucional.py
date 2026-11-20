"""Verifica y siembra los medios institucionales de la Biblioteca de Medios.

La migración 0008 creó filas para tres medios (logo, firma y sello) sin subir
el archivo a SeaweedFS. El resultado eran claves en base de datos sin objeto:
el diseñador mostraba una imagen rota (404) y el PDF un recuadro.

Este comando es el punto único y repetible para corregirlo:

* Si el área usuaria entregó el archivo en ``--directorio`` (por defecto
  ``MEDIA_ROOT/biblioteca_institucional``), lo valida, lo sube y actualiza la
  fila existente sin crear duplicados.
* Si el archivo no existe y la fila apunta a un objeto inexistente, con
  ``--limpiar-huerfanos`` retira la fila fantasma para que el diseñador no
  ofrezca un medio roto.

Uso::

    python manage.py verificar_biblioteca_institucional
    python manage.py verificar_biblioteca_institucional --limpiar-huerfanos
    python manage.py verificar_biblioteca_institucional --directorio /ruta/entregada

El comando es idempotente: se puede ejecutar en cada despliegue sin duplicar
filas ni volver a subir objetos que ya existen.
"""
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.carnetizacion.domain.services.validador_multimedia import (
    validar_archivo_biblioteca,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    ElementoBibliotecaModel,
)
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

# Claves sembradas por la migración 0008. Se conservan para poder actualizar
# esas filas sin duplicarlas y para retirar exactamente las filas fantasma.
MEDIOS_INSTITUCIONALES = (
    {
        'nombre': 'Logo Oficial CONATEL',
        'categoria': 'logo',
        'archivo_clave': 'logos/logo_conatel_oficial.png',
        'nombre_archivo': 'logo_conatel_oficial.png',
        'mime_type': 'image/png',
        'ancho_px': 450,
        'alto_px': 140,
        'descripcion': (
            'Isotipo y logotipo oficial de la Comisión Nacional de '
            'Telecomunicaciones.'
        ),
    },
    {
        'nombre': 'Firma Dirección General',
        'categoria': 'firma',
        'archivo_clave': 'firmas/firma_autoridad_dg.png',
        'nombre_archivo': 'firma_autoridad_dg.png',
        'mime_type': 'image/png',
        'ancho_px': 320,
        'alto_px': 120,
        'descripcion': (
            'Rúbrica autorizada para emisión y verificación de credenciales '
            'institucionales.'
        ),
    },
    {
        'nombre': 'Sello y Marca de Agua CONATEL',
        'categoria': 'imagen',
        'archivo_clave': 'marcas/sello_institucional_seguridad.png',
        'nombre_archivo': 'sello_institucional_seguridad.png',
        'mime_type': 'image/png',
        'ancho_px': 300,
        'alto_px': 300,
        'descripcion': (
            'Sello de seguridad institucional para fondos y reverso de carnet.'
        ),
    },
)


def _dimensiones(contenido: bytes, mime_type: str) -> tuple[int | None, int | None]:
    """Ancho y alto en píxeles; ``(None, None)`` si no se pueden leer."""
    if mime_type == 'image/png' and len(contenido) >= 24:
        try:
            return (
                int.from_bytes(contenido[16:20], 'big'),
                int.from_bytes(contenido[20:24], 'big'),
            )
        except Exception:  # noqa: BLE001 - metadatos opcionales
            return None, None
    try:
        from io import BytesIO

        from PIL import Image

        with Image.open(BytesIO(contenido)) as img:
            return img.size
    except Exception:  # noqa: BLE001 - metadatos opcionales
        return None, None


class Command(BaseCommand):
    help = (
        'Verifica los medios institucionales de la Biblioteca contra SeaweedFS '
        'y los siembra desde el directorio de entrega si están disponibles.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--directorio',
            default=str(Path(settings.MEDIA_ROOT) / 'biblioteca_institucional'),
            help=(
                'Directorio con los archivos entregados por el área usuaria. '
                'Debe conservar las subcarpetas logos/, firmas/ y marcas/.'
            ),
        )
        parser.add_argument(
            '--limpiar-huerfanos',
            action='store_true',
            help=(
                'Elimina las filas sembradas cuyo objeto no existe en SeaweedFS '
                'y para las que tampoco hay archivo fuente. No toca medios '
                'subidos por usuarios (creado_por no nulo).'
            ),
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Vuelve a subir el archivo aunque el objeto ya exista.',
        )

    def handle(self, *args, **opciones):
        directorio = Path(opciones['directorio'])
        almacen = SeaweedFSStorage()
        sembrados = limpiados = faltantes = 0

        self.stdout.write(f'Directorio de entrega: {directorio}')
        if not directorio.is_dir():
            self.stdout.write(
                self.style.WARNING(
                    'El directorio de entrega no existe. '
                    'Solo se verificará la biblioteca.'
                )
            )

        for medio in MEDIOS_INSTITUCIONALES:
            nombre = medio['nombre']
            clave = medio['archivo_clave']
            ruta_fuente = directorio / clave
            fila = ElementoBibliotecaModel.objects.filter(
                nombre=nombre, archivo_clave=clave,
            ).first()

            try:
                objeto_existe = bool(fila) and almacen.existe(clave)
            except Exception as exc:  # noqa: BLE001 - almacén caído o mal configurado
                self.stderr.write(
                    self.style.ERROR(
                        f'[{nombre}] No fue posible consultar SeaweedFS: {exc}'
                    )
                )
                continue

            if ruta_fuente.is_file():
                if objeto_existe and not opciones['force']:
                    self.stdout.write(
                        f'[ok] {nombre}: el objeto ya existe ({clave}).'
                    )
                    continue
                try:
                    contenido = ruta_fuente.read_bytes()
                    mime_type, tamano = validar_archivo_biblioteca(
                        contenido=contenido,
                        nombre_archivo=medio['nombre_archivo'],
                        categoria=medio['categoria'],
                    )
                    ancho_px, alto_px = _dimensiones(contenido, mime_type)
                    almacen.subir(clave, contenido, mime_type)
                    with transaction.atomic():
                        if fila is None:
                            ElementoBibliotecaModel.objects.create(
                                nombre=nombre,
                                categoria=medio['categoria'],
                                archivo_clave=clave,
                                nombre_archivo=medio['nombre_archivo'],
                                tamano_bytes=tamano,
                                mime_type=mime_type,
                                ancho_px=ancho_px,
                                alto_px=alto_px,
                                descripcion=medio['descripcion'],
                            )
                        else:
                            fila.nombre_archivo = medio['nombre_archivo']
                            fila.tamano_bytes = tamano
                            fila.mime_type = mime_type
                            fila.ancho_px = ancho_px
                            fila.alto_px = alto_px
                            fila.descripcion = medio['descripcion']
                            fila.save(
                                update_fields=[
                                    'nombre_archivo', 'tamano_bytes', 'mime_type',
                                    'ancho_px', 'alto_px', 'descripcion',
                                ]
                            )
                    sembrados += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'[sembrado] {nombre}: {ruta_fuente} → {clave}'
                        )
                    )
                except Exception as exc:  # noqa: BLE001 - se informa y se continúa
                    self.stderr.write(
                        self.style.ERROR(f'[{nombre}] No se pudo sembrar: {exc}')
                    )
                continue

            if objeto_existe:
                self.stdout.write(
                    f'[ok] {nombre}: el objeto existe; falta el archivo fuente '
                    f'en {ruta_fuente} (no es necesario para operar).'
                )
                continue

            if fila is not None:
                if opciones['limpiar_huerfanos'] and fila.creado_por_id is None:
                    fila.delete()
                    limpiados += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'[limpiado] {nombre}: fila sin objeto ni archivo '
                            f'fuente retirada de la biblioteca.'
                        )
                    )
                else:
                    faltantes += 1
                    self.stderr.write(
                        self.style.WARNING(
                            f'[falta] {nombre}: la fila existe pero el objeto '
                            f'{clave} no está en SeaweedFS. Entregue el archivo '
                            f'en {ruta_fuente} o ejecute --limpiar-huerfanos.'
                        )
                    )
                continue

            faltantes += 1
            self.stderr.write(
                self.style.WARNING(
                    f'[falta] {nombre}: no hay fila ni archivo. Entregue '
                    f'{ruta_fuente} y vuelva a ejecutar el comando.'
                )
            )

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'Resumen: {sembrados} sembrado(s), {limpiados} limpiado(s), '
                f'{faltantes} pendiente(s).'
            )
        )
