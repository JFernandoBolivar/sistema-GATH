"""
Implementación ORM del Repositorio de Catálogos de Soporte (Reglas B2, B21).
Traduce excepciones de base de datos a excepciones puras de dominio.
"""
from django.db import IntegrityError
from django.db.models import ProtectedError

from core.domain.exceptions import ConflictError, NotFoundError
from apps.personal.domain.entities.catalogos_soporte import (
    Alergia,
    CategoriaItem,
    Discapacidad,
    Patologia,
    RegionTalla,
    Talla,
    TipoPrenda,
    Carrera,
)
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CarreraModel,
    NivelAcademicoModel,
    CategoriaAlergiaModel,
    CategoriaDiscapacidadModel,
    CategoriaPatologiaModel,
    DiscapacidadModel,
    PatologiaCronicaModel,
    RegionTallaModel,
    TallaModel,
    TipoPrendaModel,
)


class RepoCatalogosSoporteORM:
    # ------------------------------------------------------------------
    # Alergias
    # ------------------------------------------------------------------
    def crear_alergia(self, nombre: str, categoria_id: int) -> Alergia:
        if not CategoriaAlergiaModel.objects.filter(pk=categoria_id).exists():
            raise NotFoundError(f"Categoría de alergia con ID {categoria_id} no existe.")
        try:
            obj = AlergiaModel.objects.create(alergia=nombre, categoria_id=categoria_id)
            cat_nom = obj.categoria.nombre_categoria if obj.categoria else ""
            return Alergia(id=obj.pk, nombre=obj.alergia, categoria_id=obj.categoria_id, categoria_nombre=cat_nom)
        except IntegrityError:
            raise ConflictError(f"La alergia '{nombre}' ya existe.")

    def actualizar_alergia(self, id: int, nombre: str, categoria_id: int) -> Alergia:
        obj = AlergiaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Alergia con ID {id} no encontrada.")
        if not CategoriaAlergiaModel.objects.filter(pk=categoria_id).exists():
            raise NotFoundError(f"Categoría de alergia con ID {categoria_id} no existe.")
        try:
            obj.alergia = nombre
            obj.categoria_id = categoria_id
            obj.save()
            cat_nom = obj.categoria.nombre_categoria if obj.categoria else ""
            return Alergia(id=obj.pk, nombre=obj.alergia, categoria_id=obj.categoria_id, categoria_nombre=cat_nom)
        except IntegrityError:
            raise ConflictError(f"La alergia '{nombre}' ya existe.")

    def eliminar_alergia(self, id: int) -> None:
        obj = AlergiaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Alergia con ID {id} no encontrada.")
        try:
            obj.delete()
        except (IntegrityError, ProtectedError):
            raise ConflictError(f"No se puede eliminar la alergia '{obj.alergia}' porque está asignada a empleados.")

    def listar_categorias_alergia(self) -> list[CategoriaItem]:
        return [
            CategoriaItem(id=c.pk, nombre=c.nombre_categoria)
            for c in CategoriaAlergiaModel.objects.all().order_by('nombre_categoria')
        ]

    def crear_categoria_alergia(self, nombre: str) -> CategoriaItem:
        try:
            obj = CategoriaAlergiaModel.objects.create(nombre_categoria=nombre)
            return CategoriaItem(id=obj.pk, nombre=obj.nombre_categoria)
        except IntegrityError:
            raise ConflictError(f"La categoría de alergia '{nombre}' ya existe.")

    def eliminar_categoria_alergia(self, id: int) -> None:
        obj = CategoriaAlergiaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Categoría de alergia con ID {id} no encontrada.")
        if AlergiaModel.objects.filter(categoria_id=id).exists():
            raise ConflictError(f"No se puede eliminar la categoría '{obj.nombre_categoria}' porque contiene alergias asociadas.")
        try:
            obj.delete()
        except (IntegrityError, ProtectedError):
            raise ConflictError(f"No se puede eliminar la categoría '{obj.nombre_categoria}' porque está en uso.")

    # ------------------------------------------------------------------
    # Patologías
    # ------------------------------------------------------------------
    def crear_patologia(self, nombre: str, categoria_id: int) -> Patologia:
        if not CategoriaPatologiaModel.objects.filter(pk=categoria_id).exists():
            raise NotFoundError(f"Categoría de patología con ID {categoria_id} no existe.")
        try:
            obj = PatologiaCronicaModel.objects.create(patologia=nombre, categoria_id=categoria_id)
            cat_nom = obj.categoria.nombre_categoria if obj.categoria else ""
            return Patologia(id=obj.pk, nombre=obj.patologia, categoria_id=obj.categoria_id, categoria_nombre=cat_nom)
        except IntegrityError:
            raise ConflictError(f"La patología '{nombre}' ya existe.")

    def actualizar_patologia(self, id: int, nombre: str, categoria_id: int) -> Patologia:
        obj = PatologiaCronicaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Patología con ID {id} no encontrada.")
        if not CategoriaPatologiaModel.objects.filter(pk=categoria_id).exists():
            raise NotFoundError(f"Categoría de patología con ID {categoria_id} no existe.")
        try:
            obj.patologia = nombre
            obj.categoria_id = categoria_id
            obj.save()
            cat_nom = obj.categoria.nombre_categoria if obj.categoria else ""
            return Patologia(id=obj.pk, nombre=obj.patologia, categoria_id=obj.categoria_id, categoria_nombre=cat_nom)
        except IntegrityError:
            raise ConflictError(f"La patología '{nombre}' ya existe.")

    def eliminar_patologia(self, id: int) -> None:
        obj = PatologiaCronicaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Patología con ID {id} no encontrada.")
        try:
            obj.delete()
        except (IntegrityError, ProtectedError):
            raise ConflictError(f"No se puede eliminar la patología '{obj.patologia}' porque está asignada a empleados.")

    def listar_categorias_patologia(self) -> list[CategoriaItem]:
        return [
            CategoriaItem(id=c.pk, nombre=c.nombre_categoria)
            for c in CategoriaPatologiaModel.objects.all().order_by('nombre_categoria')
        ]

    def crear_categoria_patologia(self, nombre: str) -> CategoriaItem:
        try:
            obj = CategoriaPatologiaModel.objects.create(nombre_categoria=nombre)
            return CategoriaItem(id=obj.pk, nombre=obj.nombre_categoria)
        except IntegrityError:
            raise ConflictError(f"La categoría de patología '{nombre}' ya existe.")

    def eliminar_categoria_patologia(self, id: int) -> None:
        obj = CategoriaPatologiaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Categoría de patología con ID {id} no encontrada.")
        if PatologiaCronicaModel.objects.filter(categoria_id=id).exists():
            raise ConflictError(f"No se puede eliminar la categoría '{obj.nombre_categoria}' porque contiene patologías asociadas.")
        try:
            obj.delete()
        except (IntegrityError, ProtectedError):
            raise ConflictError(f"No se puede eliminar la categoría '{obj.nombre_categoria}' porque está en uso.")

    # ------------------------------------------------------------------
    # Discapacidades
    # ------------------------------------------------------------------
    def crear_discapacidad(self, nombre: str, categoria_id: int) -> Discapacidad:
        if not CategoriaDiscapacidadModel.objects.filter(pk=categoria_id).exists():
            raise NotFoundError(f"Categoría de discapacidad con ID {categoria_id} no existe.")
        try:
            obj = DiscapacidadModel.objects.create(discapacidad=nombre, categoria_id=categoria_id)
            cat_nom = obj.categoria.nombre_categoria if obj.categoria else ""
            return Discapacidad(id=obj.pk, nombre=obj.discapacidad, categoria_id=obj.categoria_id, categoria_nombre=cat_nom)
        except IntegrityError:
            raise ConflictError(f"La discapacidad '{nombre}' ya existe.")

    def actualizar_discapacidad(self, id: int, nombre: str, categoria_id: int) -> Discapacidad:
        obj = DiscapacidadModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Discapacidad con ID {id} no encontrada.")
        if not CategoriaDiscapacidadModel.objects.filter(pk=categoria_id).exists():
            raise NotFoundError(f"Categoría de discapacidad con ID {categoria_id} no existe.")
        try:
            obj.discapacidad = nombre
            obj.categoria_id = categoria_id
            obj.save()
            cat_nom = obj.categoria.nombre_categoria if obj.categoria else ""
            return Discapacidad(id=obj.pk, nombre=obj.discapacidad, categoria_id=obj.categoria_id, categoria_nombre=cat_nom)
        except IntegrityError:
            raise ConflictError(f"La discapacidad '{nombre}' ya existe.")

    def eliminar_discapacidad(self, id: int) -> None:
        obj = DiscapacidadModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Discapacidad con ID {id} no encontrada.")
        try:
            obj.delete()
        except (IntegrityError, ProtectedError):
            raise ConflictError(f"No se puede eliminar la discapacidad '{obj.discapacidad}' porque está asignada a empleados.")

    def listar_categorias_discapacidad(self) -> list[CategoriaItem]:
        return [
            CategoriaItem(id=c.pk, nombre=c.nombre_categoria)
            for c in CategoriaDiscapacidadModel.objects.all().order_by('nombre_categoria')
        ]

    def crear_categoria_discapacidad(self, nombre: str) -> CategoriaItem:
        try:
            obj = CategoriaDiscapacidadModel.objects.create(nombre_categoria=nombre)
            return CategoriaItem(id=obj.pk, nombre=obj.nombre_categoria)
        except IntegrityError:
            raise ConflictError(f"La categoría de discapacidad '{nombre}' ya existe.")

    def eliminar_categoria_discapacidad(self, id: int) -> None:
        obj = CategoriaDiscapacidadModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Categoría de discapacidad con ID {id} no encontrada.")
        if DiscapacidadModel.objects.filter(categoria_id=id).exists():
            raise ConflictError(f"No se puede eliminar la categoría '{obj.nombre_categoria}' porque contiene discapacidades asociadas.")
        try:
            obj.delete()
        except (IntegrityError, ProtectedError):
            raise ConflictError(f"No se puede eliminar la categoría '{obj.nombre_categoria}' porque está en uso.")

    # ------------------------------------------------------------------
    # Tallas
    # ------------------------------------------------------------------
    def crear_talla(self, valor: str, region_id: int, tipo_prenda_id: int) -> Talla:
        if not RegionTallaModel.objects.filter(pk=region_id).exists():
            raise NotFoundError(f"Región de talla con ID {region_id} no existe.")
        if not TipoPrendaModel.objects.filter(pk=tipo_prenda_id).exists():
            raise NotFoundError(f"Tipo de prenda con ID {tipo_prenda_id} no existe.")
        try:
            obj = TallaModel.objects.create(valor=valor, region_id=region_id, tipo_prenda_id=tipo_prenda_id)
            reg_cod = obj.region.codigo if obj.region else ""
            prenda_nom = obj.tipo_prenda.categoria if obj.tipo_prenda else ""
            return Talla(id=obj.pk, valor=obj.valor, region_id=obj.region_id, tipo_prenda_id=obj.tipo_prenda_id, region_codigo=reg_cod, tipo_prenda_nombre=prenda_nom)
        except IntegrityError:
            raise ConflictError(f"La talla '{valor}' ya existe para esa región y tipo de prenda.")

    def actualizar_talla(self, id: int, valor: str, region_id: int, tipo_prenda_id: int) -> Talla:
        obj = TallaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Talla con ID {id} no encontrada.")
        if not RegionTallaModel.objects.filter(pk=region_id).exists():
            raise NotFoundError(f"Región de talla con ID {region_id} no existe.")
        if not TipoPrendaModel.objects.filter(pk=tipo_prenda_id).exists():
            raise NotFoundError(f"Tipo de prenda con ID {tipo_prenda_id} no existe.")
        try:
            obj.valor = valor
            obj.region_id = region_id
            obj.tipo_prenda_id = tipo_prenda_id
            obj.save()
            reg_cod = obj.region.codigo if obj.region else ""
            prenda_nom = obj.tipo_prenda.categoria if obj.tipo_prenda else ""
            return Talla(id=obj.pk, valor=obj.valor, region_id=obj.region_id, tipo_prenda_id=obj.tipo_prenda_id, region_codigo=reg_cod, tipo_prenda_nombre=prenda_nom)
        except IntegrityError:
            raise ConflictError(f"La talla '{valor}' ya existe para esa región y tipo de prenda.")

    def eliminar_talla(self, id: int) -> None:
        obj = TallaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Talla con ID {id} no encontrada.")
        try:
            obj.delete()
        except (IntegrityError, ProtectedError):
            raise ConflictError(f"No se puede eliminar la talla '{obj.valor}' porque está asociada al perfil físico de empleados.")

    # ------------------------------------------------------------------
    # Regiones de Talla
    # ------------------------------------------------------------------
    def crear_region_talla(self, codigo: str, descripcion: str | None = None) -> RegionTalla:
        try:
            obj = RegionTallaModel.objects.create(codigo=codigo, descripcion=descripcion)
            return RegionTalla(id=obj.pk, codigo=obj.codigo, descripcion=obj.descripcion or "")
        except IntegrityError:
            raise ConflictError(f"La región de talla '{codigo}' ya existe.")

    def actualizar_region_talla(self, id: int, codigo: str, descripcion: str | None = None) -> RegionTalla:
        obj = RegionTallaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Región de talla con ID {id} no encontrada.")
        try:
            obj.codigo = codigo
            obj.descripcion = descripcion
            obj.save()
            return RegionTalla(id=obj.pk, codigo=obj.codigo, descripcion=obj.descripcion or "")
        except IntegrityError:
            raise ConflictError(f"La región de talla '{codigo}' ya existe.")

    def eliminar_region_talla(self, id: int) -> None:
        obj = RegionTallaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Región de talla con ID {id} no encontrada.")
        if TallaModel.objects.filter(region_id=id).exists():
            raise ConflictError(f"No se puede eliminar la región '{obj.codigo}' porque contiene tallas asociadas.")
        try:
            obj.delete()
        except (IntegrityError, ProtectedError):
            raise ConflictError(f"No se puede eliminar la región '{obj.codigo}' porque está en uso.")

    # ------------------------------------------------------------------
    # Tipos de Prenda
    # ------------------------------------------------------------------
    def crear_tipo_prenda(self, categoria: str) -> TipoPrenda:
        try:
            obj = TipoPrendaModel.objects.create(categoria=categoria)
            return TipoPrenda(id=obj.pk, categoria=obj.categoria)
        except IntegrityError:
            raise ConflictError(f"El tipo de prenda '{categoria}' ya existe.")

    def actualizar_tipo_prenda(self, id: int, categoria: str) -> TipoPrenda:
        obj = TipoPrendaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Tipo de prenda con ID {id} no encontrado.")
        try:
            obj.categoria = categoria
            obj.save()
            return TipoPrenda(id=obj.pk, categoria=obj.categoria)
        except IntegrityError:
            raise ConflictError(f"El tipo de prenda '{categoria}' ya existe.")

    def eliminar_tipo_prenda(self, id: int) -> None:
        obj = TipoPrendaModel.objects.filter(pk=id).first()
        if not obj:
            raise NotFoundError(f"Tipo de prenda con ID {id} no encontrado.")
        if TallaModel.objects.filter(tipo_prenda_id=id).exists():
            raise ConflictError(f"No se puede eliminar el tipo de prenda '{obj.categoria}' porque contiene tallas asociadas.")
        try:
            obj.delete()
        except (IntegrityError, ProtectedError):
            raise ConflictError(f"No se puede eliminar el tipo de prenda '{obj.categoria}' porque está en uso.")

    # ------------------------------------------------------------------
    # Alta inline de catálogos académicos ("Otra X" del registro)
    # ------------------------------------------------------------------
    def crear_carrera(self, nombre: str, nivel_academico_id: int) -> Carrera:
        if not NivelAcademicoModel.objects.filter(pk=nivel_academico_id).exists():
            raise NotFoundError(f"Nivel académico con ID {nivel_academico_id} no existe.")
        if CarreraModel.objects.filter(nombre_carrera__iexact=nombre).exists():
            raise ConflictError(f"La carrera '{nombre}' ya existe.")
        try:
            obj = CarreraModel.objects.create(nombre_carrera=nombre, nivel_academico_id_id=nivel_academico_id)
        except IntegrityError:
            raise ConflictError(f"La carrera '{nombre}' ya existe.")
        return Carrera(id=obj.pk, nombre=obj.nombre_carrera, nivel_academico_id=obj.nivel_academico_id_id)
