"""
Casos de uso para la Biblioteca Compartida de Logos, Firmas e Imágenes (O44 - E4).
"""
from collections.abc import Callable

from apps.carnetizacion.application.dtos.carnetizacion_dtos import ElementoBibliotecaDTO
from apps.carnetizacion.domain.entities.elemento_biblioteca import ElementoBiblioteca
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from apps.carnetizacion.domain.services.validador_multimedia import (
    detectar_mime,
    validar_archivo_biblioteca,
)
from apps.carnetizacion.domain.value_objects.paginacion import Paginacion
from core.domain.exceptions import ValidationError

MIMES_FONDO_RASTER = ('image/png', 'image/jpeg', 'image/webp')
MENSAJE_FONDO_NO_SOPORTADO = (
    "Para el fondo del carnet use una imagen PNG, JPEG o WebP, o un PDF cuya "
    "primera página se convierta a PNG. Los SVG, GIF y otros formatos no se "
    "pueden incrustar en el PDF."
)


def elemento_biblioteca_a_dto(e: ElementoBiblioteca) -> ElementoBibliotecaDTO:
    return ElementoBibliotecaDTO(
        id=str(e.id),
        nombre=e.nombre,
        categoria=e.categoria,
        archivo_url=e.archivo_url,
        tamano_bytes=e.tamano_bytes,
        mime_type=e.mime_type,
        ancho_px=e.ancho_px,
        alto_px=e.alto_px,
        creado=e.creado.isoformat() if e.creado else "",
        creado_por=e.creado_por,
        descripcion=e.descripcion,
    )


def listar_elementos_biblioteca_uc(
    repo: RepoCarnetizacion,
    categoria: str | None = None,
) -> list[ElementoBibliotecaDTO]:
    """Lista todos los recursos de la biblioteca o filtra por categoría."""
    elementos = repo.listar_elementos_biblioteca(categoria=categoria)
    return [elemento_biblioteca_a_dto(e) for e in elementos]


def listar_elementos_biblioteca_paginado_uc(
    repo: RepoCarnetizacion,
    paginacion: Paginacion,
    categoria: str | None = None,
    busqueda: str = "",
) -> tuple[list[ElementoBibliotecaDTO], int]:
    """Una página de la biblioteca con filtro por categoría y búsqueda por nombre en el servidor."""
    elementos, total = repo.listar_elementos_biblioteca_paginado(
        categoria=categoria or None,
        busqueda=busqueda.strip(),
        offset=paginacion.offset,
        limite=paginacion.tamano,
    )
    return [elemento_biblioteca_a_dto(e) for e in elementos], total


def subir_elemento_biblioteca_uc(
    repo: RepoCarnetizacion,
    nombre: str,
    categoria: str,
    contenido: bytes,
    nombre_archivo: str,
    creado_por: str | None = None,
    descripcion: str = "",
) -> ElementoBibliotecaDTO:
    """Valida y guarda un nuevo recurso institucional en la biblioteca."""
    # Validación estricta a nivel de dominio
    validar_archivo_biblioteca(
        contenido=contenido,
        nombre_archivo=nombre_archivo,
        categoria=categoria,
    )
    guardado = repo.guardar_elemento_biblioteca(
        nombre=nombre.strip(),
        categoria=categoria,
        contenido=contenido,
        nombre_archivo=nombre_archivo,
        creado_por=creado_por,
        descripcion=descripcion.strip(),
    )
    return elemento_biblioteca_a_dto(guardado)


def eliminar_elemento_biblioteca_uc(
    repo: RepoCarnetizacion,
    elemento_id: str | int,
    forzar: bool = False,
) -> bool:
    """Elimina un recurso de la biblioteca compartida. Si una plantilla lo usa, se rechaza
    (409, con los nombres) salvo que se confirme con `forzar`."""
    return repo.eliminar_elemento_biblioteca(elemento_id, forzar=forzar)


def rasterizar_fondo_biblioteca_uc(
    repo: RepoCarnetizacion,
    elemento_id: str | int,
    rasterizador: Callable[[bytes, int], bytes],
    creado_por: str | None = None,
    pagina: int = 1,
) -> tuple[ElementoBibliotecaDTO, bool]:
    """Convierte en PNG una página (H-13; 1 = primera) de un PDF de la biblioteca para fondo.

    Devuelve ``(elemento, creado)``. Una imagen raster ya válida se reutiliza sin
    duplicarla; un PDF se rasteriza y se guarda como un nuevo medio PNG (nunca se
    sirve el PDF inline en el diseñador ni en el PDF del carnet). ``rasterizador``
    lo inyecta la infraestructura para no acoplar la capa de aplicación a
    pdf2image/Poppler.
    """
    contenido, mime_guardado, nombre_archivo = repo.obtener_archivo_biblioteca(elemento_id)
    mime_real = detectar_mime(contenido) or (mime_guardado or '').lower()

    if mime_real in MIMES_FONDO_RASTER:
        return elemento_biblioteca_a_dto(repo.obtener_elemento_biblioteca(elemento_id)), False
    if mime_real != 'application/pdf':
        raise ValidationError(MENSAJE_FONDO_NO_SOPORTADO)

    try:
        pagina = int(pagina)
    except (TypeError, ValueError):
        raise ValidationError('La página indicada no es válida.', campo='pagina') from None
    png = rasterizador(contenido, pagina)
    if detectar_mime(png) != 'image/png':
        raise ValidationError(MENSAJE_FONDO_NO_SOPORTADO)

    base = (nombre_archivo or 'fondo').rsplit('.', 1)[0][:80] or 'fondo'
    if pagina > 1:
        base = f"{base} p{pagina}"
    # Reutiliza el PNG si ese mismo PDF ya se convirtió antes (evita copias idénticas).
    existente = repo.buscar_elemento_biblioteca_por_contenido(png)
    if existente:
        return existente, False
    guardado = repo.guardar_elemento_biblioteca(
        nombre=f"{base} (fondo)"[:150],
        categoria='imagen',
        contenido=png,
        nombre_archivo=f"{base}-fondo.png",
        creado_por=creado_por,
        descripcion=f"Página {pagina} de {nombre_archivo} convertida a PNG para fondo de carnet.",
    )
    return elemento_biblioteca_a_dto(guardado), True
