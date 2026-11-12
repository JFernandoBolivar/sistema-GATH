"""Repositorio de carnetizaciÃ³n: biblioteca."""
import hashlib
from io import BytesIO

from core.domain.exceptions import NotFoundError
from apps.carnetizacion.domain.entities.elemento_biblioteca import ElementoBiblioteca
from apps.carnetizacion.domain.services.validador_multimedia import validar_archivo_biblioteca
from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    elemento_biblioteca_a_entidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    ElementoBibliotecaModel,
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

    def eliminar_elemento_biblioteca(self, elemento_id: str | int) -> bool:
        obj = ElementoBibliotecaModel.objects.filter(pk=elemento_id).first()
        if not obj:
            raise NotFoundError(f"Elemento de biblioteca con id {elemento_id} no encontrado")
        if obj.archivo_clave:
            try:
                self._almacen.eliminar(obj.archivo_clave)
            except Exception as e:
                logger.warning("No se pudo borrar el archivo del storage para biblioteca %s: %s", elemento_id, e)
        obj.delete()
        return True

    def obtener_archivo_biblioteca(self, elemento_id: str | int) -> tuple[bytes, str, str]:
        obj = ElementoBibliotecaModel.objects.filter(pk=elemento_id).first()
        if not obj:
            raise NotFoundError(f"Elemento de biblioteca con id {elemento_id} no encontrado")
        try:
            data = self._almacen.descargar(obj.archivo_clave)
        except Exception as e:
            raise NotFoundError(f"No fue posible leer el archivo de biblioteca: {e}")
        return data, obj.mime_type, obj.nombre_archivo or "archivo"
