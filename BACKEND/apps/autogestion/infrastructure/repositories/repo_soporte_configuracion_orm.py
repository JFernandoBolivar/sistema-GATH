"""Implementación ORM del catálogo configurable de tipos de soporte (O41)."""
from __future__ import annotations

from typing import Sequence

from apps.autogestion.infrastructure.models.soporte_config_models import (
    ChecklistSoporteSeccionModel,
    TipoSoporteDocumentoModel,
)
from core.domain.tipos_soporte import ChecklistSoporteConfigurado, TipoSoporteConfigurado


def _tipo_a_entidad(t: TipoSoporteDocumentoModel) -> TipoSoporteConfigurado:
    return TipoSoporteConfigurado(
        id=t.pk,
        codigo=t.codigo,
        nombre=t.nombre,
        es_reservado=bool(t.es_reservado),
        es_protegido=bool(t.es_protegido),
        orden=t.orden,
    )


def _checklist_a_entidad(c: ChecklistSoporteSeccionModel) -> ChecklistSoporteConfigurado:
    tipo = c.tipo_soporte
    return ChecklistSoporteConfigurado(
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


class RepoSoporteConfiguracionORM:
    def listar_tipos(self) -> Sequence[TipoSoporteConfigurado]:
        return [
            _tipo_a_entidad(t)
            for t in TipoSoporteDocumentoModel.objects.all().order_by('orden', 'nombre')
        ]

    def listar_checklist(self) -> Sequence[ChecklistSoporteConfigurado]:
        qs = (
            ChecklistSoporteSeccionModel.objects.select_related('tipo_soporte')
            .all()
            .order_by('seccion', 'orden', 'tipo_soporte__nombre')
        )
        return [_checklist_a_entidad(c) for c in qs]

    def checklist_de_seccion(self, seccion: str) -> Sequence[ChecklistSoporteConfigurado]:
        qs = (
            ChecklistSoporteSeccionModel.objects.select_related('tipo_soporte')
            .filter(seccion=seccion)
            .order_by('orden', 'tipo_soporte__nombre')
        )
        return [_checklist_a_entidad(c) for c in qs]
