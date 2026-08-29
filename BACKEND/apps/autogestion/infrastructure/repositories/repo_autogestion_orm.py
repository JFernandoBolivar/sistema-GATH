"""
Repositorio ORM de Autogestión (Reglas B4, B7).
"""
from apps.autogestion.domain.entities.pregunta_encuesta import PreguntaEncuesta
from apps.autogestion.domain.entities.respuesta_encuesta import RespuestaEncuesta
from apps.autogestion.infrastructure.mappers.mapper_autogestion import (
    pregunta_a_entidad,
    respuesta_a_entidad,
)
from apps.autogestion.infrastructure.models.autogestion_models import (
    PreguntasEncuestasModel,
    RespuestasEncuestaModel,
)


class RepoAutogestionORM:
    def listar_preguntas_activas(self) -> list[PreguntaEncuesta]:
        qs = (
            PreguntasEncuestasModel.objects.filter(activo=True)
            .select_related('tipo')
            .prefetch_related('opciones')
            .order_by('orden')
        )
        return [pregunta_a_entidad(p) for p in qs]

    def obtener_respuestas_empleado(self, empleado_cedula: str) -> list[RespuestaEncuesta]:
        qs = (
            RespuestasEncuestaModel.objects.filter(empleado_id=empleado_cedula)
            .select_related('pregunta', 'opcion')
            .order_by('pregunta__orden')
        )
        return [respuesta_a_entidad(r) for r in qs]

    def guardar_respuestas_empleado(
        self, empleado_cedula: str, respuestas: list[dict]
    ) -> list[RespuestaEncuesta]:
        for r in respuestas:
            pregunta_id = r['pregunta_id']
            opcion_id = r.get('opcion_id')
            texto = r.get('respuesta', '')
            RespuestasEncuestaModel.objects.update_or_create(
                pregunta_id=pregunta_id,
                empleado_id=empleado_cedula,
                defaults={'opcion_id': opcion_id, 'respuesta': texto},
            )
        return self.obtener_respuestas_empleado(empleado_cedula)

    def obtener_reporte_dependencias(self, dependencias_ids: list[int] | None = None) -> list[dict]:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        qs = AsigTrabajoModel.objects.select_related('Dependencia', 'employee').filter(employee__isnull=False)
        if dependencias_ids:
            qs = qs.filter(Dependencia_id__in=dependencias_ids)

        reporte = {}
        for asignacion in qs:
            dep_id = asignacion.Dependencia_id or 0
            dep_nombre = asignacion.Dependencia.dependencia if asignacion.Dependencia else "Sin Dependencia"
            cedula = str(asignacion.employee_id)
            if dep_id not in reporte:
                reporte[dep_id] = {
                    'dependencia_id': dep_id,
                    'dependencia': dep_nombre,
                    'total_empleados': 0,
                    'empleados_censados': 0,
                }
            reporte[dep_id]['total_empleados'] += 1
            if RespuestasEncuestaModel.objects.filter(empleado_id=cedula).exists():
                reporte[dep_id]['empleados_censados'] += 1

        return list(reporte.values())
