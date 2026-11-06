"""
Implementación ORM de RepoReglasCatalogos (A5).
"""
from __future__ import annotations

from typing import Sequence

from apps.catalogos.infrastructure.models.catalogo_models import (
    CategoriaMovimientoModel,
    ParentescoModel,
    TipoMovimientoModel,
    TipoNominaModel,
)
from apps.configuracion.domain.ports.repo_reglas_catalogos import RepoReglasCatalogos
from apps.configuracion.domain.reglas_catalogos import (
    CategoriaMotivoItem,
    ReglaMotivo,
    ReglaNomina,
    ReglaParentesco,
    es_motivo_reservado,
)
from core.domain.categorias_motivo import normalizar_nombre_motivo
from core.domain.exceptions import NotFoundError, ValidationError
from core.presentation.cache_catalogos import invalidar_catalogos


class RepoReglasCatalogosORM(RepoReglasCatalogos):
    def listar_parentescos(self) -> Sequence[ReglaParentesco]:
        qs = ParentescoModel.objects.all().order_by('descripcion_parentesco')
        return [
            ReglaParentesco(
                id=p.id,
                descripcion=p.descripcion_parentesco,
                aplica_familiar=bool(getattr(p, 'aplica_familiar', True)),
            )
            for p in qs
        ]

    def obtener_parentesco(self, parentesco_id: int) -> ReglaParentesco:
        try:
            p = ParentescoModel.objects.get(id=parentesco_id)
        except ParentescoModel.DoesNotExist:
            raise NotFoundError(f'Parentesco con id {parentesco_id} no encontrado.')
        return ReglaParentesco(
            id=p.id,
            descripcion=p.descripcion_parentesco,
            aplica_familiar=bool(getattr(p, 'aplica_familiar', True)),
        )

    def actualizar_parentesco(self, parentesco_id: int, aplica_familiar: bool) -> ReglaParentesco:
        try:
            p = ParentescoModel.objects.get(id=parentesco_id)
        except ParentescoModel.DoesNotExist:
            raise NotFoundError(f'Parentesco con id {parentesco_id} no encontrado.')
        p.aplica_familiar = bool(aplica_familiar)
        p.save(update_fields=['aplica_familiar'])
        invalidar_catalogos()
        return ReglaParentesco(
            id=p.id,
            descripcion=p.descripcion_parentesco,
            aplica_familiar=p.aplica_familiar,
        )

    def listar_categorias_motivo(self) -> Sequence[CategoriaMotivoItem]:
        qs = CategoriaMovimientoModel.objects.all().order_by('categoria')
        return [CategoriaMotivoItem(id=c.id, categoria=c.categoria) for c in qs]

    def obtener_categoria_motivo(self, categoria_id: int) -> CategoriaMotivoItem:
        try:
            c = CategoriaMovimientoModel.objects.get(id=categoria_id)
        except CategoriaMovimientoModel.DoesNotExist:
            raise NotFoundError(f'Categoría con id {categoria_id} no encontrada.')
        return CategoriaMotivoItem(id=c.id, categoria=c.categoria)

    def listar_motivos(self) -> Sequence[ReglaMotivo]:
        qs = (
            TipoMovimientoModel.objects.select_related('categoria')
            .all()
            .order_by('categoria__categoria', 'movimiento')
        )
        items = []
        for m in qs:
            cat_id = m.categoria_id or 0
            cat_nombre = m.categoria.categoria if m.categoria else ''
            items.append(
                ReglaMotivo(
                    id=m.id,
                    movimiento=m.movimiento,
                    categoria_id=cat_id,
                    categoria_nombre=cat_nombre,
                    es_reservado=es_motivo_reservado(m.movimiento, cat_nombre),
                    activo=bool(getattr(m, 'activo', True)),
                )
            )
        return items

    def obtener_motivo(self, motivo_id: int) -> ReglaMotivo:
        try:
            m = TipoMovimientoModel.objects.select_related('categoria').get(id=motivo_id)
        except TipoMovimientoModel.DoesNotExist:
            raise NotFoundError(f'Motivo de movimiento con id {motivo_id} no encontrado.')
        cat_id = m.categoria_id or 0
        cat_nombre = m.categoria.categoria if m.categoria else ''
        return ReglaMotivo(
            id=m.id,
            movimiento=m.movimiento,
            categoria_id=cat_id,
            categoria_nombre=cat_nombre,
            es_reservado=es_motivo_reservado(m.movimiento, cat_nombre),
            activo=bool(getattr(m, 'activo', True)),
        )

    def contar_motivos_en_categoria(self, categoria_id: int) -> int:
        return TipoMovimientoModel.objects.filter(categoria_id=categoria_id).count()

    def contar_motivos_activos_en_categoria(self, categoria_id: int) -> int:
        return TipoMovimientoModel.objects.filter(categoria_id=categoria_id, activo=True).count()

    def cambiar_categoria_motivo(self, motivo_id: int, nueva_categoria_id: int) -> ReglaMotivo:
        return self.actualizar_motivo(motivo_id, categoria_id=nueva_categoria_id)

    def actualizar_motivo(
        self,
        motivo_id: int,
        movimiento: str | None = None,
        categoria_id: int | None = None,
        activo: bool | None = None,
    ) -> ReglaMotivo:
        try:
            m = TipoMovimientoModel.objects.select_related('categoria').get(id=motivo_id)
        except TipoMovimientoModel.DoesNotExist:
            raise NotFoundError(f'Motivo de movimiento con id {motivo_id} no encontrado.')

        target_cat_id = categoria_id if categoria_id is not None else (m.categoria_id or 0)
        target_nombre = m.movimiento

        fields_to_update = []
        if movimiento is not None:
            nombre_limpio = normalizar_nombre_motivo(movimiento, campo='movimiento')
            target_nombre = nombre_limpio
            m.movimiento = nombre_limpio
            fields_to_update.append('movimiento')

        if categoria_id is not None and categoria_id != m.categoria_id:
            try:
                cat = CategoriaMovimientoModel.objects.get(id=categoria_id)
            except CategoriaMovimientoModel.DoesNotExist:
                raise NotFoundError(f'Categoría con id {categoria_id} no encontrada.')
            m.categoria = cat
            fields_to_update.append('categoria')

        # Verificar unicidad dentro de la categoría destino
        if movimiento is not None or categoria_id is not None:
            if TipoMovimientoModel.objects.filter(
                movimiento__iexact=target_nombre,
                categoria_id=target_cat_id,
            ).exclude(id=motivo_id).exists():
                cat_nombre = m.categoria.categoria if m.categoria else ''
                raise ValidationError(
                    f'Ya existe un motivo «{target_nombre}» en la categoría «{cat_nombre}».',
                    campo='movimiento',
                )

        if activo is not None:
            m.activo = bool(activo)
            fields_to_update.append('activo')

        if fields_to_update:
            m.save(update_fields=fields_to_update)
            invalidar_catalogos()

        m.refresh_from_db()
        cat_id = m.categoria_id or 0
        cat_nombre = m.categoria.categoria if m.categoria else ''
        return ReglaMotivo(
            id=m.id,
            movimiento=m.movimiento,
            categoria_id=cat_id,
            categoria_nombre=cat_nombre,
            es_reservado=es_motivo_reservado(m.movimiento, cat_nombre),
            activo=bool(getattr(m, 'activo', True)),
        )

    def motivo_tiene_referencias(self, motivo_id: int) -> bool:
        """Verifica si el motivo está siendo utilizado en algún registro histórico o de movimiento."""
        # 1. Movimientos
        try:
            from apps.movimientos.infrastructure.models.movimiento_models import HistorialMovimiento
            if HistorialMovimiento.objects.filter(motivo_movimiento_id=motivo_id).exists():
                return True
        except Exception:
            pass

        # 2. Préstamos de cargo
        try:
            from apps.cargos.infrastructure.models.prestamo_models import PrestamoModel
            if PrestamoModel.objects.filter(motivo_prestamo_id=motivo_id).exists():
                return True
        except Exception:
            pass

        # 3. Egresados
        try:
            from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
            if EmployeeEgresadoModel.objects.filter(motivo_egreso_id=motivo_id).exists():
                return True
        except Exception:
            pass

        return False

    def eliminar_motivo(self, motivo_id: int) -> ReglaMotivo:
        try:
            m = TipoMovimientoModel.objects.select_related('categoria').get(id=motivo_id)
        except TipoMovimientoModel.DoesNotExist:
            raise NotFoundError(f'Motivo de movimiento con id {motivo_id} no encontrado.')

        cat_id = m.categoria_id or 0
        cat_nombre = m.categoria.categoria if m.categoria else ''
        resultado = ReglaMotivo(
            id=m.id,
            movimiento=m.movimiento,
            categoria_id=cat_id,
            categoria_nombre=cat_nombre,
            es_reservado=es_motivo_reservado(m.movimiento, cat_nombre),
            activo=bool(getattr(m, 'activo', True)),
        )

        try:
            m.delete()
        except Exception:
            raise ValidationError(
                'No es posible eliminar el motivo porque tiene registros asociados. Puede desactivarlo en su lugar.',
                campo='motivo',
            )

        invalidar_catalogos()
        return resultado

    def crear_motivo(self, movimiento: str, categoria_id: int) -> ReglaMotivo:
        try:
            cat = CategoriaMovimientoModel.objects.get(id=categoria_id)
        except CategoriaMovimientoModel.DoesNotExist:
            raise NotFoundError(f'Categoría con id {categoria_id} no encontrada.')

        # Verificar si ya existe en esta categoría
        if TipoMovimientoModel.objects.filter(
            movimiento__iexact=movimiento, categoria_id=categoria_id
        ).exists():
            raise ValidationError(
                f'Ya existe un motivo «{movimiento}» en la categoría «{cat.categoria}».',
                campo='movimiento',
            )

        m = TipoMovimientoModel.objects.create(
            movimiento=movimiento,
            categoria=cat,
            activo=True,
        )
        invalidar_catalogos()
        return ReglaMotivo(
            id=m.id,
            movimiento=m.movimiento,
            categoria_id=cat.id,
            categoria_nombre=cat.categoria,
            es_reservado=False,
            activo=True,
        )

    def listar_nominas(self) -> Sequence[ReglaNomina]:
        qs = TipoNominaModel.objects.all().order_by('nomina')
        return [
            ReglaNomina(
                id=n.id,
                nomina=n.nomina,
                requiere_codig=bool(n.requiere_codig),
                es_activo=bool(n.es_activo),
            )
            for n in qs
        ]

    def obtener_nomina(self, nomina_id: int) -> ReglaNomina:
        try:
            n = TipoNominaModel.objects.get(id=nomina_id)
        except TipoNominaModel.DoesNotExist:
            raise NotFoundError(f'Tipo de nómina con id {nomina_id} no encontrado.')
        return ReglaNomina(
            id=n.id,
            nomina=n.nomina,
            requiere_codig=bool(n.requiere_codig),
            es_activo=bool(n.es_activo),
        )

    def actualizar_nomina(
        self, nomina_id: int, es_activo: bool | None, requiere_codig: bool | None
    ) -> ReglaNomina:
        try:
            n = TipoNominaModel.objects.get(id=nomina_id)
        except TipoNominaModel.DoesNotExist:
            raise NotFoundError(f'Tipo de nómina con id {nomina_id} no encontrado.')

        fields_to_update = []
        if es_activo is not None:
            n.es_activo = bool(es_activo)
            fields_to_update.append('es_activo')
        if requiere_codig is not None:
            n.requiere_codig = bool(requiere_codig)
            fields_to_update.append('requiere_codig')

        if fields_to_update:
            n.save(update_fields=fields_to_update)
            invalidar_catalogos()

        return ReglaNomina(
            id=n.id,
            nomina=n.nomina,
            requiere_codig=bool(n.requiere_codig),
            es_activo=bool(n.es_activo),
        )
