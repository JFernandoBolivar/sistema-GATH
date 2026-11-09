"""
Implementación ORM de RepoReglasCatalogos (A5).
"""
from __future__ import annotations

from typing import Sequence

from django.db import transaction

from apps.catalogos.infrastructure.models.catalogo_models import (
    CategoriaMovimientoModel,
    PaisModel,
    ParentescoModel,
    TipoMovimientoModel,
    TipoNominaModel,
)
from apps.autogestion.domain.value_objects.secciones import SECCIONES_CATALOGO_INICIAL
from apps.autogestion.infrastructure.models.soporte_config_models import (
    ChecklistSoporteSeccionModel,
    TipoSoporteDocumentoModel,
)
from apps.configuracion.domain.ports.repo_reglas_catalogos import RepoReglasCatalogos
from apps.configuracion.domain.reglas_catalogos import (
    CategoriaMotivoItem,
    ReglaChecklistSoporte,
    ReglaMotivo,
    ReglaNomina,
    ReglaPais,
    ReglaParentesco,
    ReglaTipoSoporte,
    es_motivo_reservado,
    normalizar_regla_parentesco,
    regla_parentesco_por_defecto,
)
from apps.configuracion.infrastructure.models.regla_parentesco_model import (
    ReglaParentescoModel,
)
from core.domain.categorias_motivo import normalizar_nombre_motivo
from core.domain.exceptions import NotFoundError, ValidationError
from core.domain.tipos_soporte import ItemChecklistSoporte, SeccionSoporte
from core.presentation.cache_catalogos import invalidar_catalogos


class RepoReglasCatalogosORM(RepoReglasCatalogos):
    @staticmethod
    def _pais_a_entidad(p: PaisModel) -> ReglaPais:
        return ReglaPais(
            id=p.pk, nombre=p.nombre, codigo=p.codigo, es_venezuela=bool(p.es_venezuela),
        )

    def listar_paises(self) -> Sequence[ReglaPais]:
        return [self._pais_a_entidad(p) for p in PaisModel.objects.all().order_by('nombre')]

    def obtener_pais(self, pais_id: int) -> ReglaPais:
        try:
            return self._pais_a_entidad(PaisModel.objects.get(pk=pais_id))
        except PaisModel.DoesNotExist:
            raise NotFoundError(f'País con id {pais_id} no encontrado.')

    def crear_pais(self, nombre: str, codigo: str) -> ReglaPais:
        if PaisModel.objects.filter(nombre__iexact=nombre).exists():
            raise ValidationError(f'Ya existe un país «{nombre}».', campo='nombre')
        if PaisModel.objects.filter(codigo__iexact=codigo).exists():
            raise ValidationError(f'Ya existe un país con el código «{codigo}».', campo='codigo')
        pais = PaisModel.objects.create(nombre=nombre, codigo=codigo, es_venezuela=False)
        invalidar_catalogos()
        return self._pais_a_entidad(pais)

    def actualizar_pais(
        self, pais_id: int, nombre: str | None, codigo: str | None,
    ) -> ReglaPais:
        try:
            pais = PaisModel.objects.get(pk=pais_id)
        except PaisModel.DoesNotExist:
            raise NotFoundError(f'País con id {pais_id} no encontrado.')
        campos = []
        if nombre is not None and nombre != pais.nombre:
            if PaisModel.objects.filter(nombre__iexact=nombre).exclude(pk=pais_id).exists():
                raise ValidationError(f'Ya existe un país «{nombre}».', campo='nombre')
            pais.nombre = nombre
            campos.append('nombre')
        if codigo is not None and codigo.upper() != pais.codigo.upper():
            if PaisModel.objects.filter(codigo__iexact=codigo).exclude(pk=pais_id).exists():
                raise ValidationError(f'Ya existe un país con el código «{codigo}».', campo='codigo')
            pais.codigo = codigo.upper()
            campos.append('codigo')
        if campos:
            pais.save(update_fields=campos)
            invalidar_catalogos()
        return self._pais_a_entidad(pais)

    def pais_tiene_referencias(self, pais_id: int) -> bool:
        from apps.personal.infrastructure.models.expediente_models import DatosViviendaModel

        return DatosViviendaModel.objects.filter(pais_id=pais_id).exists()

    def eliminar_pais(self, pais_id: int) -> ReglaPais:
        try:
            pais = PaisModel.objects.get(pk=pais_id)
        except PaisModel.DoesNotExist:
            raise NotFoundError(f'País con id {pais_id} no encontrado.')
        resultado = self._pais_a_entidad(pais)
        try:
            pais.delete()
        except Exception:
            raise ValidationError(
                'No es posible eliminar el país porque hay viviendas registradas en él.',
                campo='nombre',
            )
        invalidar_catalogos()
        return resultado

    @staticmethod
    def _valores_regla(regla, descripcion: str) -> dict:
        valores = regla_parentesco_por_defecto(descripcion)
        if regla is not None:
            for campo in (
                'es_hijo', 'menor_a_cargo', 'sin_cedula_hasta_edad', 'edad_minima',
                'diferencia_minima', 'diferencia_tipo', 'sexo_permitido',
                'soporte_sugerido', 'activo',
            ):
                valores[campo] = getattr(regla, campo)
        return valores

    @classmethod
    def _parentesco_a_entidad(cls, p, regla=None) -> ReglaParentesco:
        valores = cls._valores_regla(regla, p.descripcion_parentesco)
        return ReglaParentesco(
            id=p.id,
            descripcion=p.descripcion_parentesco,
            aplica_familiar=bool(getattr(p, 'aplica_familiar', True)),
            **valores,
        )

    def listar_parentescos(self) -> Sequence[ReglaParentesco]:
        qs = ParentescoModel.objects.all().order_by('descripcion_parentesco')
        reglas = {
            r.parentesco_id: r for r in ReglaParentescoModel.objects.all()
        }
        return [self._parentesco_a_entidad(p, reglas.get(p.id)) for p in qs]

    def obtener_parentesco(self, parentesco_id: int) -> ReglaParentesco:
        try:
            p = ParentescoModel.objects.get(id=parentesco_id)
        except ParentescoModel.DoesNotExist:
            raise NotFoundError(f'Parentesco con id {parentesco_id} no encontrado.')
        regla = ReglaParentescoModel.objects.filter(parentesco_id=parentesco_id).first()
        return self._parentesco_a_entidad(p, regla)

    def actualizar_parentesco(
        self, parentesco_id: int, aplica_familiar: bool, descripcion: str | None = None,
        regla: dict | None = None,
    ) -> ReglaParentesco:
        try:
            p = ParentescoModel.objects.get(id=parentesco_id)
        except ParentescoModel.DoesNotExist:
            raise NotFoundError(f'Parentesco con id {parentesco_id} no encontrado.')
        fields = ['aplica_familiar']
        p.aplica_familiar = bool(aplica_familiar)
        if descripcion is not None and descripcion != p.descripcion_parentesco:
            if ParentescoModel.objects.filter(
                descripcion_parentesco__iexact=descripcion,
            ).exclude(id=parentesco_id).exists():
                raise ValidationError(
                    f'Ya existe un parentesco «{descripcion}».', campo='descripcion',
                )
            p.descripcion_parentesco = descripcion
            fields.append('descripcion_parentesco')
        p.save(update_fields=fields)
        guardada = ReglaParentescoModel.objects.filter(
            parentesco_id=parentesco_id,
        ).first()
        if regla is not None:
            base = regla_parentesco_por_defecto(p.descripcion_parentesco)
            if guardada is not None:
                for campo in (
                    'es_hijo', 'menor_a_cargo', 'sin_cedula_hasta_edad', 'edad_minima',
                    'diferencia_minima', 'diferencia_tipo', 'sexo_permitido',
                    'soporte_sugerido', 'activo',
                ):
                    base[campo] = getattr(guardada, campo)
            base.update(regla)
            limpia = normalizar_regla_parentesco(base)
            guardada, _ = ReglaParentescoModel.objects.update_or_create(
                parentesco_id=parentesco_id, defaults=limpia,
            )
        invalidar_catalogos()
        return self._parentesco_a_entidad(p, guardada)

    def crear_parentesco(
        self, descripcion: str, aplica_familiar: bool, regla: dict | None = None,
    ) -> ReglaParentesco:
        if ParentescoModel.objects.filter(descripcion_parentesco__iexact=descripcion).exists():
            raise ValidationError(f'Ya existe un parentesco «{descripcion}».', campo='descripcion')
        p = ParentescoModel.objects.create(
            descripcion_parentesco=descripcion,
            aplica_familiar=bool(aplica_familiar),
        )
        valores = normalizar_regla_parentesco(
            regla if regla is not None else regla_parentesco_por_defecto(descripcion),
        )
        guardada = ReglaParentescoModel.objects.create(
            parentesco_id=p.id, **valores,
        )
        invalidar_catalogos()
        return self._parentesco_a_entidad(p, guardada)

    def parentesco_tiene_referencias(self, parentesco_id: int) -> bool:
        from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel

        return EmployeefamilyModel.objects.filter(parentesco_id=parentesco_id).exists()

    def eliminar_parentesco(self, parentesco_id: int) -> ReglaParentesco:
        try:
            p = ParentescoModel.objects.get(id=parentesco_id)
        except ParentescoModel.DoesNotExist:
            raise NotFoundError(f'Parentesco con id {parentesco_id} no encontrado.')
        regla = ReglaParentescoModel.objects.filter(parentesco_id=parentesco_id).first()
        resultado = self._parentesco_a_entidad(p, regla)
        try:
            with transaction.atomic():
                ReglaParentescoModel.objects.filter(parentesco_id=parentesco_id).delete()
                p.delete()
        except Exception:
            raise ValidationError(
                'No es posible eliminar el parentesco porque está asignado a familiares registrados.',
                campo='descripcion',
            )
        invalidar_catalogos()
        return resultado

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
        self,
        nomina_id: int,
        es_activo: bool | None,
        requiere_codig: bool | None,
        nomina: str | None = None,
    ) -> ReglaNomina:
        try:
            n = TipoNominaModel.objects.get(id=nomina_id)
        except TipoNominaModel.DoesNotExist:
            raise NotFoundError(f'Tipo de nómina con id {nomina_id} no encontrado.')

        fields_to_update = []
        if nomina is not None and nomina != n.nomina:
            if TipoNominaModel.objects.filter(nomina__iexact=nomina).exclude(id=nomina_id).exists():
                raise ValidationError(f'Ya existe una nómina «{nomina}».', campo='nomina')
            n.nomina = nomina
            fields_to_update.append('nomina')
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

    def crear_nomina(self, nomina: str, es_activo: bool, requiere_codig: bool) -> ReglaNomina:
        if TipoNominaModel.objects.filter(nomina__iexact=nomina).exists():
            raise ValidationError(f'Ya existe una nómina «{nomina}».', campo='nomina')
        n = TipoNominaModel.objects.create(
            nomina=nomina,
            es_activo=bool(es_activo),
            requiere_codig=bool(requiere_codig),
        )
        invalidar_catalogos()
        return ReglaNomina(
            id=n.id,
            nomina=n.nomina,
            requiere_codig=bool(n.requiere_codig),
            es_activo=bool(n.es_activo),
        )

    def nomina_tiene_referencias(self, nomina_id: int) -> bool:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        from apps.fe_de_vida.infrastructure.models.solicitud_models import ProcesoFeDeVidaModel

        if AsigTrabajoModel.objects.filter(tiponominaid_id=nomina_id).exists():
            return True
        return ProcesoFeDeVidaModel.objects.filter(tipos_nomina__contains=[nomina_id]).exists()

    def eliminar_nomina(self, nomina_id: int) -> ReglaNomina:
        try:
            n = TipoNominaModel.objects.get(id=nomina_id)
        except TipoNominaModel.DoesNotExist:
            raise NotFoundError(f'Tipo de nómina con id {nomina_id} no encontrado.')
        resultado = ReglaNomina(
            id=n.id,
            nomina=n.nomina,
            requiere_codig=bool(n.requiere_codig),
            es_activo=bool(n.es_activo),
        )
        try:
            n.delete()
        except Exception:
            raise ValidationError(
                'No es posible eliminar la nómina porque está asignada a cargos o procesos.',
                campo='nomina',
            )
        invalidar_catalogos()
        return resultado

    # ------------------------------------------------------------------
    # Tipos de soporte documental y checklist por sección (O41)
    # ------------------------------------------------------------------
    @staticmethod
    def _tipo_soporte_a_entidad(t: TipoSoporteDocumentoModel) -> ReglaTipoSoporte:
        return ReglaTipoSoporte(
            id=t.pk,
            codigo=t.codigo,
            nombre=t.nombre,
            es_reservado=bool(t.es_reservado),
            es_protegido=bool(t.es_protegido),
            orden=t.orden,
        )

    @staticmethod
    def _checklist_a_entidad(c: ChecklistSoporteSeccionModel) -> ReglaChecklistSoporte:
        tipo = c.tipo_soporte
        return ReglaChecklistSoporte(
            id=c.pk,
            seccion=c.seccion,
            tipo_soporte_id=tipo.pk,
            codigo=tipo.codigo,
            nombre=tipo.nombre,
            etiqueta=c.etiqueta or tipo.nombre,
            permitido=bool(c.permitido),
            requerido=bool(c.requerido),
            orden=c.orden,
        )

    def listar_tipos_soporte(self) -> Sequence[ReglaTipoSoporte]:
        qs = TipoSoporteDocumentoModel.objects.all().order_by('orden', 'nombre')
        return [self._tipo_soporte_a_entidad(t) for t in qs]

    def obtener_tipo_soporte(self, tipo_id: int) -> ReglaTipoSoporte:
        try:
            t = TipoSoporteDocumentoModel.objects.get(pk=tipo_id)
        except TipoSoporteDocumentoModel.DoesNotExist:
            raise NotFoundError(f'Tipo de soporte con id {tipo_id} no encontrado.')
        return self._tipo_soporte_a_entidad(t)

    def crear_tipo_soporte(self, codigo: str, nombre: str, orden: int) -> ReglaTipoSoporte:
        if TipoSoporteDocumentoModel.objects.filter(codigo__iexact=codigo).exists():
            raise ValidationError(f'Ya existe un tipo de soporte con el código «{codigo}».', campo='codigo')
        t = TipoSoporteDocumentoModel.objects.create(
            codigo=codigo, nombre=nombre, es_reservado=False, es_protegido=False, orden=orden,
        )
        invalidar_catalogos()
        return self._tipo_soporte_a_entidad(t)

    def actualizar_tipo_soporte(
        self,
        tipo_id: int,
        codigo: str | None,
        nombre: str | None,
        orden: int | None,
    ) -> ReglaTipoSoporte:
        try:
            t = TipoSoporteDocumentoModel.objects.get(pk=tipo_id)
        except TipoSoporteDocumentoModel.DoesNotExist:
            raise NotFoundError(f'Tipo de soporte con id {tipo_id} no encontrado.')
        campos: list[str] = []
        if codigo is not None and codigo.upper() != t.codigo.upper():
            if TipoSoporteDocumentoModel.objects.filter(codigo__iexact=codigo).exclude(pk=tipo_id).exists():
                raise ValidationError(
                    f'Ya existe un tipo de soporte con el código «{codigo}».', campo='codigo',
                )
            t.codigo = codigo
            campos.append('codigo')
        if nombre is not None and nombre != t.nombre:
            t.nombre = nombre
            campos.append('nombre')
        if orden is not None and orden != t.orden:
            t.orden = orden
            campos.append('orden')
        if campos:
            t.save(update_fields=campos)
            invalidar_catalogos()
        return self._tipo_soporte_a_entidad(t)

    def tipo_soporte_tiene_secciones(self, tipo_id: int) -> bool:
        return ChecklistSoporteSeccionModel.objects.filter(tipo_soporte_id=tipo_id).exists()

    def eliminar_tipo_soporte(self, tipo_id: int) -> ReglaTipoSoporte:
        try:
            t = TipoSoporteDocumentoModel.objects.get(pk=tipo_id)
        except TipoSoporteDocumentoModel.DoesNotExist:
            raise NotFoundError(f'Tipo de soporte con id {tipo_id} no encontrado.')
        resultado = self._tipo_soporte_a_entidad(t)
        try:
            t.delete()
        except Exception:
            raise ValidationError(
                'No es posible eliminar el tipo de soporte porque está asignado a una sección.',
                campo='codigo',
            )
        invalidar_catalogos()
        return resultado

    def reordenar_tipos_soporte(
        self, ordenes: Sequence[tuple[int, int]],
    ) -> Sequence[ReglaTipoSoporte]:
        with transaction.atomic():
            for tipo_id, nuevo_orden in ordenes:
                TipoSoporteDocumentoModel.objects.filter(pk=tipo_id).update(orden=nuevo_orden)
        invalidar_catalogos()
        return self.listar_tipos_soporte()

    def listar_checklist_soporte(
        self, seccion: str | None = None,
    ) -> Sequence[ReglaChecklistSoporte]:
        qs = ChecklistSoporteSeccionModel.objects.select_related('tipo_soporte').all()
        if seccion is not None:
            qs = qs.filter(seccion=seccion)
        qs = qs.order_by('seccion', 'orden', 'tipo_soporte__nombre')
        return [self._checklist_a_entidad(c) for c in qs]

    def reemplazar_checklist_soporte(
        self, seccion: str, items: Sequence[ItemChecklistSoporte],
    ) -> Sequence[ReglaChecklistSoporte]:
        existentes = {
            c.tipo_soporte_id: c
            for c in ChecklistSoporteSeccionModel.objects.filter(seccion=seccion)
        }
        ids_conservados: set[int] = set()
        for item in items:
            fila = existentes.get(item.tipo_soporte_id)
            if fila is None:
                try:
                    tipo = TipoSoporteDocumentoModel.objects.get(pk=item.tipo_soporte_id)
                except TipoSoporteDocumentoModel.DoesNotExist:
                    raise NotFoundError(
                        f'Tipo de soporte con id {item.tipo_soporte_id} no encontrado.',
                    )
                ChecklistSoporteSeccionModel.objects.create(
                    seccion=seccion,
                    tipo_soporte=tipo,
                    etiqueta=tipo.nombre,
                    permitido=item.permitido,
                    requerido=item.requerido,
                    orden=tipo.orden,
                )
            else:
                fila.permitido = item.permitido
                fila.requerido = item.requerido
                fila.save(update_fields=['permitido', 'requerido'])
            ids_conservados.add(item.tipo_soporte_id)
        ChecklistSoporteSeccionModel.objects.filter(seccion=seccion).exclude(
            tipo_soporte_id__in=ids_conservados,
        ).delete()
        invalidar_catalogos()
        return self.listar_checklist_soporte(seccion)

    def listar_secciones_soporte(self) -> Sequence[SeccionSoporte]:
        return tuple(
            SeccionSoporte(codigo=codigo, nombre=nombre)
            for codigo, nombre, _requiere in SECCIONES_CATALOGO_INICIAL
        )
