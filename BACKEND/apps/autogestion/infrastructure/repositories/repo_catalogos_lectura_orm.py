"""
Catálogos de referencia (no sensibles) que necesitan los formularios de autogestión del trabajador.

Equivalentes de solo lectura de los catálogos de `personal`, que exigen `personal.ver` (que un
trabajador NO debe tener porque expone datos de otras personas).
"""
import unicodedata

from apps.autogestion.domain.value_objects.secciones import CATALOGOS_TALLA
from apps.catalogos.infrastructure.models.catalogo_models import EstadoCivilModel, PaisModel
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM


def _item(pk, nombre, **extra) -> dict:
    return {'id': pk, 'nombre': nombre, **extra}


def _normalizar(texto: str) -> str:
    """Minúsculas sin acentos: la categoría real del catálogo vive en la base de datos."""
    descompuesto = unicodedata.normalize('NFKD', str(texto or ''))
    return ''.join(c for c in descompuesto if not unicodedata.combining(c)).strip().lower()


class RepoCatalogosLecturaORM:
    def __init__(self, repo=None):
        self._r = repo or RepoPersonalORM()

    def listar(self, clave: str, padre_id: int | None) -> list[dict]:
        r = self._r
        if clave == 'paises':
            return [
                _item(p.pk, p.nombre, codigo=p.codigo, es_venezuela=bool(p.es_venezuela))
                for p in PaisModel.objects.all().order_by('nombre')
            ]
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
        if clave == 'organismos':
            from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
            return [
                _item(o.pk, o.Organismoadscrito)
                for o in OrganismoAdscritoModel.objects.all().order_by('Organismoadscrito')
            ]
        if clave == 'capacitaciones':
            return [_item(i.pk, i.nombre_capacitacion) for i in r.listar_capacitaciones()]
        if clave == 'grupos-capacitacion':
            return [_item(i.pk, i.nombre_grupo) for i in r.listar_grupos_capacitacion()]
        if clave == 'estados-civiles':
            return [
                _item(e.pk, e.estadoCivil)
                for e in EstadoCivilModel.objects.all().order_by('estadoCivil')
            ]
        if clave == 'grupos-sanguineos':
            return [_item(i.pk, i.GrupoSanguineo) for i in r.listar_grupos_sanguineos()]
        if clave == 'alergias':
            return [_item(i.pk, i.alergia) for i in r.listar_alergias()]
        if clave == 'patologias':
            return [_item(i.pk, i.patologia) for i in r.listar_patologias()]
        if clave == 'discapacidades':
            return [_item(i.pk, i.discapacidad) for i in r.listar_discapacidades()]
        if clave in CATALOGOS_TALLA:
            tipo = self._tipo_prenda(CATALOGOS_TALLA[clave])
            if tipo is None:
                return []
            return [_item(i.pk, i.valor) for i in r.listar_tallas(tipo_prenda_id=tipo)]
        return [_item(i.pk, i.nombre_institucion) for i in r.listar_instituciones()]

    def _tipo_prenda(self, token: str) -> int | None:
        """Id del tipo de prenda cuya categoría empieza por el token (p. ej. `pantalon`)."""
        for tipo in self._r.listar_tipos_prenda():
            if _normalizar(tipo.categoria).startswith(token):
                return tipo.pk
        return None
