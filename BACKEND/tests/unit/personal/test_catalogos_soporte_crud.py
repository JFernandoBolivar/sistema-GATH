"""
Tests unitarios del CRUD de catálogos de soporte de personal (Arquitectura Onion pura sin BD).
"""
import pytest

from core.domain.exceptions import NotFoundError, ValidationError
from apps.personal.domain.entities.catalogos_soporte import (
    Alergia,
    CategoriaItem,
    Discapacidad,
    Patologia,
    RegionTalla,
    Talla,
    TipoPrenda,
)
from apps.personal.application.use_cases.gestionar_catalogos_soporte import (
    actualizar_alergia,
    actualizar_discapacidad,
    actualizar_patologia,
    actualizar_region_talla,
    actualizar_talla,
    actualizar_tipo_prenda,
    crear_alergia,
    crear_categoria_alergia,
    crear_categoria_discapacidad,
    crear_categoria_patologia,
    crear_discapacidad,
    crear_patologia,
    crear_region_talla,
    crear_talla,
    crear_tipo_prenda,
    eliminar_alergia,
    eliminar_categoria_alergia,
    eliminar_categoria_discapacidad,
    eliminar_categoria_patologia,
    eliminar_discapacidad,
    eliminar_patologia,
    eliminar_region_talla,
    eliminar_talla,
    eliminar_tipo_prenda,
    listar_categorias_alergia,
    listar_categorias_discapacidad,
    listar_categorias_patologia,
)


class RepoCatalogosSoporteMemoria:
    def __init__(self):
        self.categorias_alergia = [CategoriaItem(id=1, nombre="Alimentos")]
        self.alergias = [Alergia(id=1, nombre="Maní", categoria_id=1, categoria_nombre="Alimentos")]
        self.categorias_patologia = [CategoriaItem(id=1, nombre="Respiratorias")]
        self.patologias = [Patologia(id=1, nombre="Asma", categoria_id=1, categoria_nombre="Respiratorias")]
        self.categorias_discapacidad = [CategoriaItem(id=1, nombre="Visual")]
        self.discapacidades = [Discapacidad(id=1, nombre="Baja visión", categoria_id=1, categoria_nombre="Visual")]
        self.regiones = [RegionTalla(id=1, codigo="ADULTO", descripcion="Adultos")]
        self.tipos_prenda = [TipoPrenda(id=1, categoria="Camisa")]
        self.tallas = [Talla(id=1, valor="M", region_id=1, tipo_prenda_id=1, region_codigo="ADULTO", tipo_prenda_nombre="Camisa")]

    # Alergias
    def crear_alergia(self, nombre, categoria_id):
        cat = next((c for c in self.categorias_alergia if c.id == categoria_id), None)
        if not cat:
            raise NotFoundError("Categoría no encontrada")
        nuevo = Alergia(id=len(self.alergias) + 1, nombre=nombre, categoria_id=categoria_id, categoria_nombre=cat.nombre)
        self.alergias.append(nuevo)
        return nuevo

    def actualizar_alergia(self, id, nombre, categoria_id):
        a = next((x for x in self.alergias if x.id == id), None)
        if not a:
            raise NotFoundError("Alergia no encontrada")
        cat = next((c for c in self.categorias_alergia if c.id == categoria_id), None)
        if not cat:
            raise NotFoundError("Categoría no encontrada")
        idx = self.alergias.index(a)
        act = Alergia(id=id, nombre=nombre, categoria_id=categoria_id, categoria_nombre=cat.nombre)
        self.alergias[idx] = act
        return act

    def eliminar_alergia(self, id):
        a = next((x for x in self.alergias if x.id == id), None)
        if not a:
            raise NotFoundError("Alergia no encontrada")
        self.alergias.remove(a)

    def listar_categorias_alergia(self):
        return list(self.categorias_alergia)

    def crear_categoria_alergia(self, nombre):
        nuevo = CategoriaItem(id=len(self.categorias_alergia) + 1, nombre=nombre)
        self.categorias_alergia.append(nuevo)
        return nuevo

    def eliminar_categoria_alergia(self, id):
        c = next((x for x in self.categorias_alergia if x.id == id), None)
        if not c:
            raise NotFoundError("Categoría no encontrada")
        self.categorias_alergia.remove(c)

    # Patologías
    def crear_patologia(self, nombre, categoria_id):
        cat = next((c for c in self.categorias_patologia if c.id == categoria_id), None)
        if not cat:
            raise NotFoundError("Categoría no encontrada")
        nuevo = Patologia(id=len(self.patologias) + 1, nombre=nombre, categoria_id=categoria_id, categoria_nombre=cat.nombre)
        self.patologias.append(nuevo)
        return nuevo

    def actualizar_patologia(self, id, nombre, categoria_id):
        p = next((x for x in self.patologias if x.id == id), None)
        if not p:
            raise NotFoundError("Patología no encontrada")
        cat = next((c for c in self.categorias_patologia if c.id == categoria_id), None)
        if not cat:
            raise NotFoundError("Categoría no encontrada")
        idx = self.patologias.index(p)
        act = Patologia(id=id, nombre=nombre, categoria_id=categoria_id, categoria_nombre=cat.nombre)
        self.patologias[idx] = act
        return act

    def eliminar_patologia(self, id):
        p = next((x for x in self.patologias if x.id == id), None)
        if not p:
            raise NotFoundError("Patología no encontrada")
        self.patologias.remove(p)

    def listar_categorias_patologia(self):
        return list(self.categorias_patologia)

    def crear_categoria_patologia(self, nombre):
        nuevo = CategoriaItem(id=len(self.categorias_patologia) + 1, nombre=nombre)
        self.categorias_patologia.append(nuevo)
        return nuevo

    def eliminar_categoria_patologia(self, id):
        c = next((x for x in self.categorias_patologia if x.id == id), None)
        if not c:
            raise NotFoundError("Categoría no encontrada")
        self.categorias_patologia.remove(c)

    # Discapacidades
    def crear_discapacidad(self, nombre, categoria_id):
        cat = next((c for c in self.categorias_discapacidad if c.id == categoria_id), None)
        if not cat:
            raise NotFoundError("Categoría no encontrada")
        nuevo = Discapacidad(id=len(self.discapacidades) + 1, nombre=nombre, categoria_id=categoria_id, categoria_nombre=cat.nombre)
        self.discapacidades.append(nuevo)
        return nuevo

    def actualizar_discapacidad(self, id, nombre, categoria_id):
        d = next((x for x in self.discapacidades if x.id == id), None)
        if not d:
            raise NotFoundError("Discapacidad no encontrada")
        cat = next((c for c in self.categorias_discapacidad if c.id == categoria_id), None)
        if not cat:
            raise NotFoundError("Categoría no encontrada")
        idx = self.discapacidades.index(d)
        act = Discapacidad(id=id, nombre=nombre, categoria_id=categoria_id, categoria_nombre=cat.nombre)
        self.discapacidades[idx] = act
        return act

    def eliminar_discapacidad(self, id):
        d = next((x for x in self.discapacidades if x.id == id), None)
        if not d:
            raise NotFoundError("Discapacidad no encontrada")
        self.discapacidades.remove(d)

    def listar_categorias_discapacidad(self):
        return list(self.categorias_discapacidad)

    def crear_categoria_discapacidad(self, nombre):
        nuevo = CategoriaItem(id=len(self.categorias_discapacidad) + 1, nombre=nombre)
        self.categorias_discapacidad.append(nuevo)
        return nuevo

    def eliminar_categoria_discapacidad(self, id):
        c = next((x for x in self.categorias_discapacidad if x.id == id), None)
        if not c:
            raise NotFoundError("Categoría no encontrada")
        self.categorias_discapacidad.remove(c)

    # Tallas
    def crear_talla(self, valor, region_id, tipo_prenda_id):
        nuevo = Talla(id=len(self.tallas) + 1, valor=valor, region_id=region_id, tipo_prenda_id=tipo_prenda_id)
        self.tallas.append(nuevo)
        return nuevo

    def actualizar_talla(self, id, valor, region_id, tipo_prenda_id):
        t = next((x for x in self.tallas if x.id == id), None)
        if not t:
            raise NotFoundError("Talla no encontrada")
        idx = self.tallas.index(t)
        act = Talla(id=id, valor=valor, region_id=region_id, tipo_prenda_id=tipo_prenda_id)
        self.tallas[idx] = act
        return act

    def eliminar_talla(self, id):
        t = next((x for x in self.tallas if x.id == id), None)
        if not t:
            raise NotFoundError("Talla no encontrada")
        self.tallas.remove(t)

    # Regiones
    def crear_region_talla(self, codigo, descripcion=None):
        nuevo = RegionTalla(id=len(self.regiones) + 1, codigo=codigo, descripcion=descripcion or "")
        self.regiones.append(nuevo)
        return nuevo

    def actualizar_region_talla(self, id, codigo, descripcion=None):
        r = next((x for x in self.regiones if x.id == id), None)
        if not r:
            raise NotFoundError("Región no encontrada")
        idx = self.regiones.index(r)
        act = RegionTalla(id=id, codigo=codigo, descripcion=descripcion or "")
        self.regiones[idx] = act
        return act

    def eliminar_region_talla(self, id):
        r = next((x for x in self.regiones if x.id == id), None)
        if not r:
            raise NotFoundError("Región no encontrada")
        self.regiones.remove(r)

    # Tipos Prenda
    def crear_tipo_prenda(self, categoria):
        nuevo = TipoPrenda(id=len(self.tipos_prenda) + 1, categoria=categoria)
        self.tipos_prenda.append(nuevo)
        return nuevo

    def actualizar_tipo_prenda(self, id, categoria):
        tp = next((x for x in self.tipos_prenda if x.id == id), None)
        if not tp:
            raise NotFoundError("Tipo de prenda no encontrado")
        idx = self.tipos_prenda.index(tp)
        act = TipoPrenda(id=id, categoria=categoria)
        self.tipos_prenda[idx] = act
        return act

    def eliminar_tipo_prenda(self, id):
        tp = next((x for x in self.tipos_prenda if x.id == id), None)
        if not tp:
            raise NotFoundError("Tipo de prenda no encontrado")
        self.tipos_prenda.remove(tp)


# ----------------------------------------------------------------------
# Tests
# ----------------------------------------------------------------------

def test_alergias_crud():
    repo = RepoCatalogosSoporteMemoria()
    nueva = crear_alergia(repo, "Penicilina", 1)
    assert nueva.nombre == "Penicilina"
    assert nueva.categoria_id == 1

    act = actualizar_alergia(repo, nueva.id, "Penicilina G", 1)
    assert act.nombre == "Penicilina G"

    eliminar_alergia(repo, nueva.id)
    assert len(repo.alergias) == 1


def test_alergia_validaciones():
    repo = RepoCatalogosSoporteMemoria()
    with pytest.raises(ValidationError):
        crear_alergia(repo, "", 1)
    with pytest.raises(ValidationError):
        crear_alergia(repo, "Alergia", -1)


def test_categorias_alergia_crud():
    repo = RepoCatalogosSoporteMemoria()
    cat = crear_categoria_alergia(repo, "Medicamentos")
    assert cat.nombre == "Medicamentos"
    assert len(listar_categorias_alergia(repo)) == 2

    eliminar_categoria_alergia(repo, cat.id)
    assert len(listar_categorias_alergia(repo)) == 1


def test_patologias_crud():
    repo = RepoCatalogosSoporteMemoria()
    nueva = crear_patologia(repo, "Diabetes", 1)
    assert nueva.nombre == "Diabetes"

    act = actualizar_patologia(repo, nueva.id, "Diabetes Tipo 2", 1)
    assert act.nombre == "Diabetes Tipo 2"

    eliminar_patologia(repo, nueva.id)
    assert len(repo.patologias) == 1


def test_categorias_patologia_crud():
    repo = RepoCatalogosSoporteMemoria()
    cat = crear_categoria_patologia(repo, "Cardiovasculares")
    assert cat.nombre == "Cardiovasculares"
    assert len(listar_categorias_patologia(repo)) == 2

    eliminar_categoria_patologia(repo, cat.id)
    assert len(listar_categorias_patologia(repo)) == 1


def test_discapacidades_crud():
    repo = RepoCatalogosSoporteMemoria()
    nueva = crear_discapacidad(repo, "Auditiva", 1)
    assert nueva.nombre == "Auditiva"

    act = actualizar_discapacidad(repo, nueva.id, "Hipoacusia", 1)
    assert act.nombre == "Hipoacusia"

    eliminar_discapacidad(repo, nueva.id)
    assert len(repo.discapacidades) == 1


def test_categorias_discapacidad_crud():
    repo = RepoCatalogosSoporteMemoria()
    cat = crear_categoria_discapacidad(repo, "Motora")
    assert cat.nombre == "Motora"
    assert len(listar_categorias_discapacidad(repo)) == 2

    eliminar_categoria_discapacidad(repo, cat.id)
    assert len(listar_categorias_discapacidad(repo)) == 1


def test_tallas_crud():
    repo = RepoCatalogosSoporteMemoria()
    nueva = crear_talla(repo, "L", 1, 1)
    assert nueva.valor == "L"
    assert nueva.region_id == 1
    assert nueva.tipo_prenda_id == 1

    act = actualizar_talla(repo, nueva.id, "XL", 1, 1)
    assert act.valor == "XL"

    eliminar_talla(repo, nueva.id)
    assert len(repo.tallas) == 1


def test_talla_validaciones():
    repo = RepoCatalogosSoporteMemoria()
    with pytest.raises(ValidationError):
        crear_talla(repo, "", 1, 1)
    with pytest.raises(ValidationError):
        crear_talla(repo, "M", 0, 1)
    with pytest.raises(ValidationError):
        crear_talla(repo, "M", 1, -5)


def test_regiones_talla_crud():
    repo = RepoCatalogosSoporteMemoria()
    nueva = crear_region_talla(repo, "JUVENIL", "Tallas juveniles")
    assert nueva.codigo == "JUVENIL"
    assert nueva.descripcion == "Tallas juveniles"

    act = actualizar_region_talla(repo, nueva.id, "JUV_REV", "Juvenil revisado")
    assert act.codigo == "JUV_REV"

    eliminar_region_talla(repo, nueva.id)
    assert len(repo.regiones) == 1


def test_tipos_prenda_crud():
    repo = RepoCatalogosSoporteMemoria()
    nuevo = crear_tipo_prenda(repo, "Pantalón")
    assert nuevo.categoria == "Pantalón"

    act = actualizar_tipo_prenda(repo, nuevo.id, "Pantalón de faena")
    assert act.categoria == "Pantalón de faena"

    eliminar_tipo_prenda(repo, nuevo.id)
    assert len(repo.tipos_prenda) == 1


def test_listar_tallas_con_region_y_tipo_prenda():
    from apps.personal.application.use_cases.listar_catalogos_soporte import listar_tallas
    from apps.personal.presentation.serializers.catalogos_soporte_serializers import CatalogoItemSerializer

    class DummyRegion:
        id = 1
        codigo = "ADULTO"
        descripcion = "Adultos"

    class DummyTipoPrenda:
        id = 2
        categoria = "Camisa"

    class DummyTalla:
        pk = 10
        valor = "L"
        region_id = 1
        tipo_prenda_id = 2
        region = DummyRegion()
        tipo_prenda = DummyTipoPrenda()

    dtos = listar_tallas([DummyTalla()])
    assert len(dtos) == 1
    dto = dtos[0]
    assert dto.id == 10
    assert dto.nombre == "L"
    assert dto.tipo_prenda_id == 2
    assert dto.tipo_prenda_nombre == "Camisa"
    assert dto.categoria_id == 2
    assert dto.categoria_nombre == "Camisa"
    assert dto.region_id == 1
    assert dto.region_codigo == "ADULTO"

    data = CatalogoItemSerializer(dto).data
    assert data["id"] == 10
    assert data["nombre"] == "L"
    assert data["tipo_prenda_id"] == 2
    assert data["tipo_prenda_nombre"] == "Camisa"
    assert data["tipo_prenda"] == {"id": 2, "categoria": "Camisa"}
    assert data["region"] == {"id": 1, "codigo": "ADULTO", "descripcion": "Adultos"}


def test_listar_salud_con_categoria():
    from apps.personal.application.use_cases.listar_catalogos_soporte import (
        listar_alergias,
        listar_discapacidades,
        listar_patologias,
    )
    from apps.personal.presentation.serializers.catalogos_soporte_serializers import CatalogoItemSerializer

    class DummyCategoria:
        id = 3
        nombre_categoria = "Respiratorias"

    class DummyItem:
        pk = 5
        alergia = "Polen"
        patologia = "Asma"
        discapacidad = "Motriz"
        categoria_id = 3
        categoria = DummyCategoria()

    alergias = listar_alergias([DummyItem()])
    assert alergias[0].categoria_id == 3
    assert alergias[0].categoria_nombre == "Respiratorias"

    patologias = listar_patologias([DummyItem()])
    assert patologias[0].categoria_id == 3
    assert patologias[0].categoria_nombre == "Respiratorias"

    discapacidades = listar_discapacidades([DummyItem()])
    assert discapacidades[0].categoria_id == 3
    assert discapacidades[0].categoria_nombre == "Respiratorias"

    data = CatalogoItemSerializer(alergias[0]).data
    assert data["id"] == 5
    assert data["nombre"] == "Polen"
    assert data["categoria_id"] == 3
    assert data["categoria_nombre"] == "Respiratorias"
    assert data["categoria"] == {"id": 3, "nombre": "Respiratorias", "nombre_categoria": "Respiratorias"}

