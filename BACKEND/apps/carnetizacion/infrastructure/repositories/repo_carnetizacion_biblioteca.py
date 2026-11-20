"""Repositorio de carnetización: biblioteca."""
import hashlib
from io import BytesIO
from typing import Any

from django.db import transaction

from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from apps.carnetizacion.domain.entities.elemento_biblioteca import ElementoBiblioteca
from apps.carnetizacion.domain.services.validador_multimedia import (
    MAX_PIXELES_IMAGEN,
    validar_archivo_biblioteca,
)
from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    elemento_biblioteca_a_entidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    ElementoBibliotecaModel,
    PlantillaCarnetModel,
)

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.


from .repo_carnetizacion_comun import (
    logger,
)


class RepoBibliotecaMixin:
    def listar_elementos_biblioteca(self, categoria: str | None = None) -> list[ElementoBiblioteca]:
        qs = ElementoBibliotecaModel.objects.all()
        if categoria:
            qs = qs.filter(categoria=categoria)
        return [elemento_biblioteca_a_entidad(e) for e in qs]

    def listar_elementos_biblioteca_paginado(
        self,
        categoria: str | None = None,
        busqueda: str = '',
        offset: int = 0,
        limite: int = 12,
    ) -> tuple[list[ElementoBiblioteca], int]:
        qs = ElementoBibliotecaModel.objects.all()
        if categoria:
            qs = qs.filter(categoria=categoria)
        if busqueda:
            qs = qs.filter(nombre__icontains=busqueda)
        total = qs.count()
        return [elemento_biblioteca_a_entidad(e) for e in qs[offset:offset + limite]], total

    def obtener_elemento_biblioteca(self, elemento_id: str | int) -> ElementoBiblioteca:
        obj = ElementoBibliotecaModel.objects.filter(pk=elemento_id).first()
        if not obj:
            raise NotFoundError(f"Elemento de biblioteca con id {elemento_id} no encontrado")
        return elemento_biblioteca_a_entidad(obj)

    def guardar_elemento_biblioteca(
        self,
        nombre: str,
        categoria: str,
        contenido: bytes,
        nombre_archivo: str,
        creado_por: str | None = None,
        descripcion: str = "",
    ) -> ElementoBiblioteca:
        mime_type, tamano = validar_archivo_biblioteca(
            contenido=contenido,
            nombre_archivo=nombre_archivo,
            categoria=categoria,
        )

        ancho_px, alto_px = None, None
        if mime_type == 'image/png' and len(contenido) >= 24:
            try:
                ancho_px = int.from_bytes(contenido[16:20], 'big')
                alto_px = int.from_bytes(contenido[20:24], 'big')
            except Exception:
                logger.warning(
                    'No se pudieron leer las dimensiones del PNG de biblioteca %s.',
                    nombre_archivo, exc_info=True,
                )
        elif mime_type in ('image/jpeg', 'image/webp'):
            try:
                from PIL import Image
                with Image.open(BytesIO(contenido)) as img:
                    ancho_px, alto_px = img.size
            except Exception:
                logger.warning(
                    'No se pudieron leer las dimensiones de la imagen de biblioteca %s.',
                    nombre_archivo, exc_info=True,
                )
        elif mime_type == 'application/pdf':
            # B-2/K-4: se valida al subir (páginas, tamaño, tiempo) para no guardar un PDF
            # que después no se pueda rasterizar o que cuelgue el servidor.
            from apps.carnetizacion.infrastructure.pdf.rasterizar_pdf import inspeccionar_pdf
            inspeccionar_pdf(contenido)
        # K-5: imágenes enormes en píxeles se rechazan aunque pesen poco.
        if ancho_px and alto_px and ancho_px * alto_px > MAX_PIXELES_IMAGEN:
            raise ValidationError(
                f'La imagen mide {ancho_px} x {alto_px} px; el máximo es {MAX_PIXELES_IMAGEN // 1_000_000} '
                'megapíxeles. Redúzcala antes de subirla.'
            )

        clave = f"carnet_biblioteca/{hashlib.sha256(contenido).hexdigest()[:16]}_{nombre_archivo}"
        self._almacen.subir(clave, contenido, mime_type)

        obj = ElementoBibliotecaModel.objects.create(
            nombre=nombre,
            categoria=categoria,
            archivo_clave=clave,
            nombre_archivo=nombre_archivo,
            tamano_bytes=tamano,
            mime_type=mime_type,
            ancho_px=ancho_px,
            alto_px=alto_px,
            descripcion=descripcion,
            creado_por_id=creado_por,
        )
        return elemento_biblioteca_a_entidad(obj)

    def buscar_elemento_biblioteca_por_contenido(
        self, contenido: bytes
    ) -> ElementoBiblioteca | None:
        """Reutiliza un medio idéntico ya guardado (misma huella SHA-256).

        La clave incluye el hash del contenido, así que basta buscar por su prefijo.
        Evita duplicar, por ejemplo, el PNG que se genera al elegir dos veces el mismo
        PDF como fondo.
        """
        prefijo = f"carnet_biblioteca/{hashlib.sha256(contenido).hexdigest()[:16]}_"
        obj = ElementoBibliotecaModel.objects.filter(archivo_clave__startswith=prefijo).first()
        return elemento_biblioteca_a_entidad(obj) if obj else None

    def plantillas_que_usan_medio(self, elemento_id: str | int) -> list[str]:
        """Nombres de las plantillas no archivadas que usan el medio (fondo o imagen)."""
        medio = str(elemento_id)

        def usa(definicion: Any) -> bool:
            if not isinstance(definicion, dict):
                return False
            fondos = definicion.get('fondos') or {}
            if isinstance(fondos, dict):
                for entrada in fondos.values():
                    valor = entrada.get('biblioteca_id') if isinstance(entrada, dict) else entrada
                    if str(valor or '') == medio:
                        return True
            for cara in ('anverso', 'reverso', 'elementos'):
                for el in definicion.get(cara) or []:
                    if isinstance(el, dict) and str((el.get('props') or {}).get('biblioteca_id') or '') == medio:
                        return True
            return False

        return [
            f'{p.nombre} v{p.version}'
            for p in PlantillaCarnetModel.objects.exclude(estado='archivada').only('nombre', 'version', 'definicion')
            if usa(p.definicion)
        ]

    def eliminar_elemento_biblioteca(self, elemento_id: str | int, forzar: bool = False) -> bool:
        with transaction.atomic():
            obj = ElementoBibliotecaModel.objects.select_for_update().filter(pk=elemento_id).first()
            if not obj:
                raise NotFoundError(f"Elemento de biblioteca con id {elemento_id} no encontrado")
            # K-12: borrar un medio que una plantilla usa la deja sin fondo o con un recuadro.
            if not forzar:
                usadas = self.plantillas_que_usan_medio(obj.pk)
                if usadas:
                    raise ConflictError(
                        'Este medio se usa en: ' + ', '.join(usadas[:5])
                        + ('…' if len(usadas) > 5 else '')
                        + '. Confirme para eliminarlo igualmente.'
                    )
            clave = obj.archivo_clave
            if clave:
                # Bloquea todas las filas que comparten el archivo: dos borrados simultáneos no
                # pueden dejar el objeto huérfano ni borrarlo mientras otra fila lo usa.
                list(ElementoBibliotecaModel.objects.select_for_update().filter(archivo_clave=clave))
            obj.delete()
            if clave and not ElementoBibliotecaModel.objects.filter(archivo_clave=clave).exists():
                transaction.on_commit(lambda: self._borrar_objeto_si_huerfano(clave))
            elif clave:
                logger.info("Se conserva el objeto %s: otra fila de biblioteca lo comparte.", clave)
        return True

    def _borrar_objeto_si_huerfano(self, clave: str) -> None:
        """Tras confirmar: se vuelve a comprobar (una subida del mismo contenido pudo reusarlo)."""
        if ElementoBibliotecaModel.objects.filter(archivo_clave=clave).exists():
            return
        try:
            self._almacen.eliminar(clave)
        except Exception as e:  # noqa: BLE001 - el registro ya se borró; queda en el log
            logger.warning("No se pudo borrar el archivo %s del storage: %s", clave, e)

    def obtener_archivo_biblioteca(self, elemento_id: str | int) -> tuple[bytes, str, str]:
        obj = ElementoBibliotecaModel.objects.filter(pk=elemento_id).first()
        if not obj:
            raise NotFoundError(f"Elemento de biblioteca con id {elemento_id} no encontrado")
        try:
            data = self._almacen.descargar(obj.archivo_clave)
        except Exception as e:
            raise NotFoundError(f"No fue posible leer el archivo de biblioteca: {e}")
        return data, obj.mime_type, obj.nombre_archivo or "archivo"
