"""
Casos de uso de consulta de catálogos de soporte del expediente de personal
(Reglas B2, B4, B21).

Solo lectura: listan tablas maestras que viven junto a los datos anidados
(`apps/personal/infrastructure/models/catalogos_soporte_models.py`). No se
mueven a `apps/catalogos/` porque el plan (B16) solo permite que la capa
`infrastructure` cruce módulos, y estos modelos están fuertemente acoplados al
expediente (FK `'personal.*'`).
"""
from apps.personal.application.dtos.catalogos_soporte_dtos import (
    CatalogoItemDTO,
    CodigoPostalDTO,
)


def listar_politicas(items) -> list[CatalogoItemDTO]:
    return [CatalogoItemDTO(id=i.pk, nombre=i.tipo_politica) for i in items]


def listar_condiciones_vivienda(items) -> list[CatalogoItemDTO]:
    return [CatalogoItemDTO(id=i.pk, nombre=i.condicion) for i in items]


def listar_codigos_postales(items) -> list[CodigoPostalDTO]:
    return [
        CodigoPostalDTO(id=i.pk, nombre=i.codigo, estado_id=i.estado_id_id)
        for i in items
    ]


def listar_grupos_sanguineos(items) -> list[CatalogoItemDTO]:
    return [CatalogoItemDTO(id=i.pk, nombre=i.GrupoSanguineo) for i in items]


def listar_niveles_academicos(items) -> list[CatalogoItemDTO]:
    return [CatalogoItemDTO(id=i.pk, nombre=i.nivelacademico) for i in items]


def listar_carreras(items) -> list[CatalogoItemDTO]:
    return [CatalogoItemDTO(id=i.pk, nombre=i.nombre_carrera) for i in items]


def listar_menciones(items) -> list[CatalogoItemDTO]:
    return [CatalogoItemDTO(id=i.pk, nombre=i.nombre_mencion) for i in items]


def listar_instituciones(items) -> list[CatalogoItemDTO]:
    return [CatalogoItemDTO(id=i.pk, nombre=i.nombre_institucion) for i in items]
