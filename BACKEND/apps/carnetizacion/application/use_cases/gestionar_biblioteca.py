"""
Casos de uso para la Biblioteca Compartida de Logos, Firmas e Imágenes (O44 - E4).
"""
from apps.carnetizacion.application.dtos.carnetizacion_dtos import ElementoBibliotecaDTO
from apps.carnetizacion.domain.entities.elemento_biblioteca import ElementoBiblioteca
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from apps.carnetizacion.domain.value_objects.paginacion import Paginacion
from apps.carnetizacion.domain.services.validador_multimedia import validar_archivo_biblioteca


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
) -> bool:
    """Elimina un recurso de la biblioteca compartida."""
    return repo.eliminar_elemento_biblioteca(elemento_id)
