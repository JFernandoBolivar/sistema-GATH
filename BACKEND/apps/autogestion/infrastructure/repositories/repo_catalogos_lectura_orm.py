"""
Catálogos de referencia (no sensibles) que necesitan los formularios de autogestión del trabajador.
Equivalentes de solo lectura de los catálogos de `personal`, que exigen `personal.ver` (que un
trabajador NO debe tener porque expone datos de otras personas).
"""
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM


def _item(pk, nombre, **extra) -> dict:
    return {'id': pk, 'nombre': nombre, **extra}


class RepoCatalogosLecturaORM:
    def __init__(self, repo=None):
        self._r = repo or RepoPersonalORM()

    def listar(self, clave: str, padre_id: int | None) -> list[dict]:
        r = self._r
        if clave == 'condiciones-vivienda':
            return [_item(i.pk, i.condicion) for i in r.listar_condiciones_vivienda()]
        if clave == 'codigos-postales':
            return [_item(i.pk, i.codigo, estado_id=i.estado_id_id) for i in r.listar_codigos_postales(estado_id=padre_id)]
        if clave == 'niveles-academicos':
            return [_item(i.pk, i.nivelacademico) for i in r.listar_niveles_academicos()]
        if clave == 'carreras':
            return [_item(i.pk, i.nombre_carrera) for i in r.listar_carreras(nivel_academico_id=padre_id)]
        if clave == 'menciones':
            return [_item(i.pk, i.nombre_mencion) for i in r.listar_menciones(carrera_id=padre_id)]
        return [_item(i.pk, i.nombre_institucion) for i in r.listar_instituciones()]
