"""
Casos de uso de gestión (escritura/CRUD) de catálogos de soporte del personal
(Reglas B2, B4, B21). Puros: sin dependencias de Django ni DRF.
"""
from core.domain.exceptions import ValidationError
from apps.personal.domain.entities.catalogos_soporte import (
    Alergia,
    CategoriaItem,
    Discapacidad,
    Patologia,
    RegionTalla,
    Talla,
    TipoPrenda,
)
from apps.personal.domain.ports.repo_catalogos_soporte import RepoCatalogosSoporte


def _validar_texto(campo: str, valor: str, max_len: int = 200) -> str:
    limpio = (valor or "").strip()
    if not limpio:
        raise ValidationError(f"El campo '{campo}' no puede estar vacío.")
    if len(limpio) > max_len:
        raise ValidationError(f"El campo '{campo}' no puede superar los {max_len} caracteres.")
    return limpio


def _validar_id(campo: str, valor: int) -> int:
    if not isinstance(valor, int) or valor <= 0:
        raise ValidationError(f"El campo '{campo}' debe ser un identificador positivo.")
    return valor


# ----------------------------------------------------------------------
# Alergias y sus Categorías
# ----------------------------------------------------------------------

def crear_alergia(repo: RepoCatalogosSoporte, nombre: str, categoria_id: int) -> Alergia:
    nombre_limpio = _validar_texto("alergia", nombre, 100)
    cat_id = _validar_id("categoria_id", categoria_id)
    return repo.crear_alergia(nombre_limpio, cat_id)


def actualizar_alergia(repo: RepoCatalogosSoporte, id: int, nombre: str, categoria_id: int) -> Alergia:
    alergia_id = _validar_id("id", id)
    nombre_limpio = _validar_texto("alergia", nombre, 100)
    cat_id = _validar_id("categoria_id", categoria_id)
    return repo.actualizar_alergia(alergia_id, nombre_limpio, cat_id)


def eliminar_alergia(repo: RepoCatalogosSoporte, id: int) -> None:
    alergia_id = _validar_id("id", id)
    repo.eliminar_alergia(alergia_id)


def listar_categorias_alergia(repo: RepoCatalogosSoporte) -> list[CategoriaItem]:
    return repo.listar_categorias_alergia()


def crear_categoria_alergia(repo: RepoCatalogosSoporte, nombre: str) -> CategoriaItem:
    nombre_limpio = _validar_texto("nombre_categoria", nombre, 100)
    return repo.crear_categoria_alergia(nombre_limpio)


def eliminar_categoria_alergia(repo: RepoCatalogosSoporte, id: int) -> None:
    cat_id = _validar_id("id", id)
    repo.eliminar_categoria_alergia(cat_id)


# ----------------------------------------------------------------------
# Patologías y sus Categorías
# ----------------------------------------------------------------------

def crear_patologia(repo: RepoCatalogosSoporte, nombre: str, categoria_id: int) -> Patologia:
    nombre_limpio = _validar_texto("patologia", nombre, 100)
    cat_id = _validar_id("categoria_id", categoria_id)
    return repo.crear_patologia(nombre_limpio, cat_id)


def actualizar_patologia(repo: RepoCatalogosSoporte, id: int, nombre: str, categoria_id: int) -> Patologia:
    patologia_id = _validar_id("id", id)
    nombre_limpio = _validar_texto("patologia", nombre, 100)
    cat_id = _validar_id("categoria_id", categoria_id)
    return repo.actualizar_patologia(patologia_id, nombre_limpio, cat_id)


def eliminar_patologia(repo: RepoCatalogosSoporte, id: int) -> None:
    patologia_id = _validar_id("id", id)
    repo.eliminar_patologia(patologia_id)


def listar_categorias_patologia(repo: RepoCatalogosSoporte) -> list[CategoriaItem]:
    return repo.listar_categorias_patologia()


def crear_categoria_patologia(repo: RepoCatalogosSoporte, nombre: str) -> CategoriaItem:
    nombre_limpio = _validar_texto("nombre_categoria", nombre, 100)
    return repo.crear_categoria_patologia(nombre_limpio)


def eliminar_categoria_patologia(repo: RepoCatalogosSoporte, id: int) -> None:
    cat_id = _validar_id("id", id)
    repo.eliminar_categoria_patologia(cat_id)


# ----------------------------------------------------------------------
# Discapacidades y sus Categorías
# ----------------------------------------------------------------------

def crear_discapacidad(repo: RepoCatalogosSoporte, nombre: str, categoria_id: int) -> Discapacidad:
    nombre_limpio = _validar_texto("discapacidad", nombre, 100)
    cat_id = _validar_id("categoria_id", categoria_id)
    return repo.crear_discapacidad(nombre_limpio, cat_id)


def actualizar_discapacidad(repo: RepoCatalogosSoporte, id: int, nombre: str, categoria_id: int) -> Discapacidad:
    discapacidad_id = _validar_id("id", id)
    nombre_limpio = _validar_texto("discapacidad", nombre, 100)
    cat_id = _validar_id("categoria_id", categoria_id)
    return repo.actualizar_discapacidad(discapacidad_id, nombre_limpio, cat_id)


def eliminar_discapacidad(repo: RepoCatalogosSoporte, id: int) -> None:
    discapacidad_id = _validar_id("id", id)
    repo.eliminar_discapacidad(discapacidad_id)


def listar_categorias_discapacidad(repo: RepoCatalogosSoporte) -> list[CategoriaItem]:
    return repo.listar_categorias_discapacidad()


def crear_categoria_discapacidad(repo: RepoCatalogosSoporte, nombre: str) -> CategoriaItem:
    nombre_limpio = _validar_texto("nombre_categoria", nombre, 100)
    return repo.crear_categoria_discapacidad(nombre_limpio)


def eliminar_categoria_discapacidad(repo: RepoCatalogosSoporte, id: int) -> None:
    cat_id = _validar_id("id", id)
    repo.eliminar_categoria_discapacidad(cat_id)


# ----------------------------------------------------------------------
# Tallas
# ----------------------------------------------------------------------

def crear_talla(repo: RepoCatalogosSoporte, valor: str, region_id: int, tipo_prenda_id: int) -> Talla:
    valor_limpio = _validar_texto("valor", valor, 50)
    reg_id = _validar_id("region_id", region_id)
    prenda_id = _validar_id("tipo_prenda_id", tipo_prenda_id)
    return repo.crear_talla(valor_limpio, reg_id, prenda_id)


def actualizar_talla(repo: RepoCatalogosSoporte, id: int, valor: str, region_id: int, tipo_prenda_id: int) -> Talla:
    talla_id = _validar_id("id", id)
    valor_limpio = _validar_texto("valor", valor, 50)
    reg_id = _validar_id("region_id", region_id)
    prenda_id = _validar_id("tipo_prenda_id", tipo_prenda_id)
    return repo.actualizar_talla(talla_id, valor_limpio, reg_id, prenda_id)


def eliminar_talla(repo: RepoCatalogosSoporte, id: int) -> None:
    talla_id = _validar_id("id", id)
    repo.eliminar_talla(talla_id)


# ----------------------------------------------------------------------
# Regiones de Talla
# ----------------------------------------------------------------------

def crear_region_talla(repo: RepoCatalogosSoporte, codigo: str, descripcion: str | None = None) -> RegionTalla:
    codigo_limpio = _validar_texto("codigo", codigo, 10)
    desc_limpia = (descripcion or "").strip()
    return repo.crear_region_talla(codigo_limpio, desc_limpia or None)


def actualizar_region_talla(repo: RepoCatalogosSoporte, id: int, codigo: str, descripcion: str | None = None) -> RegionTalla:
    reg_id = _validar_id("id", id)
    codigo_limpio = _validar_texto("codigo", codigo, 10)
    desc_limpia = (descripcion or "").strip()
    return repo.actualizar_region_talla(reg_id, codigo_limpio, desc_limpia or None)


def eliminar_region_talla(repo: RepoCatalogosSoporte, id: int) -> None:
    reg_id = _validar_id("id", id)
    repo.eliminar_region_talla(reg_id)


# ----------------------------------------------------------------------
# Tipos de Prenda
# ----------------------------------------------------------------------

def crear_tipo_prenda(repo: RepoCatalogosSoporte, categoria: str) -> TipoPrenda:
    cat_limpia = _validar_texto("categoria", categoria, 50)
    return repo.crear_tipo_prenda(cat_limpia)


def actualizar_tipo_prenda(repo: RepoCatalogosSoporte, id: int, categoria: str) -> TipoPrenda:
    prenda_id = _validar_id("id", id)
    cat_limpia = _validar_texto("categoria", categoria, 50)
    return repo.actualizar_tipo_prenda(prenda_id, cat_limpia)


def eliminar_tipo_prenda(repo: RepoCatalogosSoporte, id: int) -> None:
    prenda_id = _validar_id("id", id)
    repo.eliminar_tipo_prenda(prenda_id)
