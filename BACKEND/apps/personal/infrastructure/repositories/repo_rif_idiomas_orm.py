"""
Persistencia del RIF y los idiomas del trabajador (Fase 2, F-8). Implementa `RepoRifIdiomas`.

`agregar_*` es la variante NO destructiva que usa la promoción del postulante (incluido el reingreso, C-1): suma lo que no
estaba y no toca lo que RRHH ya tenía, de modo que contratar dos veces a la misma persona no duplica registros.
"""
from django.db import transaction

from apps.personal.infrastructure.models.idioma_models import EmpleadoIdiomaModel, IdiomaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import NotFoundError, ValidationError


def _fila(cedula: str) -> EmployeeModel:
    fila = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
    if fila is None:
        raise NotFoundError(f"Empleado con cédula {cedula} no encontrado")
    return fila


class RepoRifIdiomasORM:
    def existe_trabajador(self, cedula: str) -> bool:
        return EmployeeModel.objects.filter(cedulaidentidad=cedula).exists()

    # ------------------------------------------------------------------------------------------------ RIF
    def rif_de(self, cedula: str) -> str | None:
        valor = EmployeeModel.objects.filter(cedulaidentidad=cedula).values_list('rif', flat=True).first()
        return (valor or '').strip() or None

    def guardar_rif(self, cedula: str, rif: str | None) -> None:
        fila = _fila(cedula)
        fila.rif = rif or None
        fila.save(update_fields=['rif'])   # save() y no update(): invalida la caché de «Mi ficha»

    def guardar_rif_si_falta(self, cedula: str, rif: str | None) -> bool:
        """Para la promoción: pone el RIF solo si el trabajador no tiene uno. `True` si lo guardó."""
        if not rif or self.rif_de(cedula):
            return False
        self.guardar_rif(cedula, rif)
        return True

    # ------------------------------------------------------------------------------------------------ idiomas
    def idiomas_de(self, cedula: str) -> list[dict]:
        filas = EmpleadoIdiomaModel.objects.filter(empleado__cedulaidentidad=cedula).select_related('idioma').order_by('id')
        return [{
            'id': f.pk, 'idioma_id': f.idioma_id, 'idioma_nombre': f.idioma.nombre if f.idioma_id else '',
            'otro_idioma': f.otro_idioma, 'nombre': f.idioma.nombre if f.idioma_id else f.otro_idioma, 'nivel': f.nivel,
        } for f in filas]

    @staticmethod
    def _exigir_en_catalogo(idiomas: list[dict]) -> None:
        ids = {i['idioma_id'] for i in idiomas if i.get('idioma_id')}
        faltan = ids - set(IdiomaModel.objects.filter(pk__in=ids, activo=True).values_list('pk', flat=True))
        if faltan:
            raise ValidationError(
                f"Hay idiomas que no existen en el catálogo: {', '.join(map(str, sorted(faltan)))}.", campo='idiomas',
            )

    def reemplazar_idiomas(self, cedula: str, idiomas: list[dict]) -> None:
        self._exigir_en_catalogo(idiomas)
        with transaction.atomic():
            fila = _fila(cedula)
            EmpleadoIdiomaModel.objects.filter(empleado=fila).delete()
            EmpleadoIdiomaModel.objects.bulk_create([
                EmpleadoIdiomaModel(
                    empleado=fila, idioma_id=i.get('idioma_id'), otro_idioma=i.get('otro_idioma') or '', nivel=i['nivel'],
                ) for i in idiomas
            ])
            fila.save(update_fields=['fecha_actualizacion'])   # el expediente cambió: reordena los listados e invalida cachés

    def agregar_idiomas(self, cedula: str, idiomas: list[dict]) -> int:
        """Suma los idiomas que el trabajador aún no tiene (por catálogo o por nombre). Devuelve cuántos agregó."""
        if not idiomas:
            return 0
        self._exigir_en_catalogo(idiomas)
        fila = _fila(cedula)
        tiene_catalogo = set(EmpleadoIdiomaModel.objects.filter(empleado=fila, idioma__isnull=False).values_list('idioma_id', flat=True))
        tiene_otros = {o.casefold() for o in EmpleadoIdiomaModel.objects.filter(empleado=fila, idioma__isnull=True).values_list('otro_idioma', flat=True)}
        nuevos = 0
        for i in idiomas:
            if i.get('idioma_id'):
                if i['idioma_id'] in tiene_catalogo:
                    continue
                tiene_catalogo.add(i['idioma_id'])
            else:
                if i['otro_idioma'].casefold() in tiene_otros:
                    continue
                tiene_otros.add(i['otro_idioma'].casefold())
            EmpleadoIdiomaModel.objects.create(
                empleado=fila, idioma_id=i.get('idioma_id'), otro_idioma=i.get('otro_idioma') or '', nivel=i['nivel'],
            )
            nuevos += 1
        return nuevos

    @staticmethod
    def listar_catalogo_idiomas() -> list[dict]:
        return [{'id': pk, 'nombre': nombre} for pk, nombre in IdiomaModel.objects.filter(activo=True).values_list('pk', 'nombre')]
