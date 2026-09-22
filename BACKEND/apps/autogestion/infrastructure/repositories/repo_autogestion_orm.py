"""
Repositorio ORM de Autogestión (Reglas B4, B7).
Provee acceso a preguntas, detalle de censo, registro completo,
gráficos agregados por jerarquía y exportación a Excel.
"""
from django.db import transaction
from apps.autogestion.domain.entities.pregunta_encuesta import PreguntaEncuesta
from apps.autogestion.domain.entities.respuesta_encuesta import RespuestaEncuesta
from apps.autogestion.infrastructure.mappers.mapper_autogestion import (
    pregunta_a_entidad,
    respuesta_a_entidad,
)
from apps.autogestion.infrastructure.models.autogestion_models import (
    PreguntasEncuestasModel,
    RespuestasEncuestaModel,
    OpcionesPreguntaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.models.expediente_models import DatosViviendaModel
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.autogestion.infrastructure.services.censo_report_service import (
    construir_grafico_torta,
    construir_grafico_barras,
)
from apps.autogestion.infrastructure.services.excel_service import generar_excel_censo


class RepoAutogestionORM:
    def listar_preguntas_activas(self) -> list[PreguntaEncuesta]:
        qs = (
            PreguntasEncuestasModel.objects.filter(activo=True)
            .select_related('tipo')
            .prefetch_related('opciones')
            .order_by('orden')
        )
        return [pregunta_a_entidad(p) for p in qs]

    def listar_preguntas_con_detalle(self) -> list[dict]:
        qs = (
            PreguntasEncuestasModel.objects.filter(activo=True)
            .select_related('tipo')
            .prefetch_related('opciones')
            .order_by('orden')
        )
        data = []
        for p in qs:
            data.append({
                'id': p.id,
                'enunciado': p.enunciado,
                'tipo': {
                    'id': p.tipo_id if p.tipo else 1,
                    'nombre': p.tipo.nombre if p.tipo else 'string',
                },
                'orden': p.orden,
                'activo': p.activo,
                'validacion': p.validacion,
                'opciones': [
                    {
                        'id': o.id,
                        'tipo_opcion': o.tipo_opcion,
                        'texto': o.tipo_opcion,
                        'orden': o.orden,
                    }
                    for o in p.opciones.all().order_by('orden')
                ],
            })
        return data

    def obtener_respuestas_empleado(self, empleado_cedula: str) -> list[RespuestaEncuesta]:
        qs = (
            RespuestasEncuestaModel.objects.filter(empleado_id=empleado_cedula)
            .select_related('pregunta', 'opcion')
            .order_by('pregunta__orden')
        )
        return [respuesta_a_entidad(r) for r in qs]

    def obtener_detalle_empleado_censo(self, cedula: str) -> dict | None:
        try:
            emp = EmployeeModel.objects.get(cedulaidentidad=cedula)
        except EmployeeModel.DoesNotExist:
            return None

        return self._serializar_censo_empleado(emp)

    def consultar_todos_censos(self, cedula: str | None = None) -> list[dict]:
        if cedula:
            emp = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
            if not emp:
                return []
            return [self._serializar_censo_empleado(emp)]

        empleados_cedulas = list(
            RespuestasEncuestaModel.objects.values_list('empleado_id', flat=True).distinct()
        )
        empleados = (
            EmployeeModel.objects.filter(cedulaidentidad__in=empleados_cedulas)
            .order_by('cedulaidentidad')
        )
        return [self._serializar_censo_empleado(emp) for emp in empleados]

    def _serializar_censo_empleado(self, emp: EmployeeModel) -> dict:
        cargos_qs = (
            AsigTrabajoModel.objects.filter(employee_id=emp.cedulaidentidad)
            .select_related(
                'denominacioncargoid', 'denominacioncargoespecificoid',
                'Dependencia', 'DireccionGeneral', 'DireccionLinea', 'Coordinacion', 'tiponominaid'
            )
        )
        cargos = []
        for c in cargos_qs:
            cargos.append({
                'id': c.id,
                'codigo': c.codigo,
                'denominacioncargo': {
                    'id': c.denominacioncargoid_id,
                    'cargo': c.denominacioncargoid.cargo if c.denominacioncargoid else '',
                } if c.denominacioncargoid else {'id': 0, 'cargo': 'Sin Cargo'},
                'denominacioncargoespecifico': {
                    'id': c.denominacioncargoespecificoid_id,
                    'cargo': c.denominacioncargoespecificoid.cargo if c.denominacioncargoespecificoid else '',
                } if c.denominacioncargoespecificoid else None,
                'Dependencia': {
                    'id': c.Dependencia_id,
                    'dependencia': c.Dependencia.dependencia if c.Dependencia else '',
                    'Codigo': getattr(c.Dependencia, 'Codigo', ''),
                } if c.Dependencia else None,
                'DireccionGeneral': {
                    'id': c.DireccionGeneral_id,
                    'direccion_general': c.DireccionGeneral.direccion_general if c.DireccionGeneral else '',
                    'Codigo': getattr(c.DireccionGeneral, 'Codigo', ''),
                } if c.DireccionGeneral else None,
                'DireccionLinea': {
                    'id': c.DireccionLinea_id,
                    'direccion_linea': c.DireccionLinea.direccion_linea if c.DireccionLinea else '',
                    'Codigo': getattr(c.DireccionLinea, 'Codigo', ''),
                } if c.DireccionLinea else None,
                'Coordinacion': {
                    'id': c.Coordinacion_id,
                    'coordinacion': c.Coordinacion.coordinacion if c.Coordinacion else '',
                    'Codigo': getattr(c.Coordinacion, 'Codigo', ''),
                } if c.Coordinacion else None,
                'tiponomina': {
                    'id': c.tiponominaid_id,
                    'nomina': c.tiponominaid.nomina if c.tiponominaid else '',
                } if c.tiponominaid else None,
            })

        vivienda = (
            DatosViviendaModel.objects.filter(empleado_id=emp.id)
            .select_related('estado', 'municipio', 'parroquia', 'condicion_vivienda', 'codigo_postal')
            .first()
        )
        datos_vivienda = None
        if vivienda:
            datos_vivienda = {
                'id': vivienda.id,
                'direccion_exacta': vivienda.direccion_exacta,
                'estado': {
                    'id': vivienda.estado_id,
                    'estado': vivienda.estado.estado if vivienda.estado else '',
                } if vivienda.estado else None,
                'municipio': {
                    'id': vivienda.municipio_id,
                    'municipio': vivienda.municipio.municipio if vivienda.municipio else '',
                } if vivienda.municipio else None,
                'parroquia': {
                    'id': vivienda.parroquia_id,
                    'parroquia': vivienda.parroquia.parroquia if vivienda.parroquia else '',
                } if vivienda.parroquia else None,
                'condicion_vivienda': {
                    'id': vivienda.condicion_vivienda_id,
                    'condicion': vivienda.condicion_vivienda.condicion if vivienda.condicion_vivienda else '',
                } if vivienda.condicion_vivienda else None,
                'codigo_postal': {
                    'id': vivienda.codigo_postal_id,
                    'codigo': vivienda.codigo_postal.codigo if vivienda.codigo_postal else '',
                } if vivienda.codigo_postal else None,
            }

        respuestas = (
            RespuestasEncuestaModel.objects.filter(empleado_id=emp.cedulaidentidad)
            .select_related('pregunta', 'pregunta__tipo', 'opcion')
            .order_by('pregunta__orden')
        )
        preguntas = [
            {
                'id': r.pregunta_id,
                'pregunta': r.pregunta.enunciado if r.pregunta else '',
                'tipo': r.pregunta.tipo.nombre if r.pregunta and r.pregunta.tipo else 'texto',
                'opcion': {'id': r.opcion_id, 'opcion': r.opcion.tipo_opcion} if r.opcion else None,
                'respuesta': r.respuesta,
            }
            for r in respuestas
        ]

        apn_anos = float(emp.total_anos_apn or 0)
        years = int(apn_anos)
        months = int((apn_anos - years) * 12)
        total_apn = {
            'years': years,
            'months': months,
            'days': 0,
        }

        return {
            'id': emp.id,
            'cedula': emp.cedulaidentidad,
            'nombres': emp.nombres,
            'apellidos': emp.apellidos,
            'fecha_nacimiento': emp.fecha_nacimiento.isoformat() if emp.fecha_nacimiento else None,
            'carnet_patria': emp.carnet_patria or '',
            'cargos': cargos,
            'datos_vivienda': datos_vivienda,
            'total_apn': total_apn,
            'fecha_ingreso_organismo': None,
            'preguntas': preguntas,
        }

    @transaction.atomic
    def guardar_censo_vivienda(
        self,
        cedula: str,
        carnet_patria: str,
        datos_vivienda: dict | None,
        respuestas: list[dict],
    ) -> dict:
        emp = EmployeeModel.objects.get(cedulaidentidad=cedula)

        if carnet_patria:
            emp.carnet_patria = carnet_patria
            emp.save(update_fields=['carnet_patria', 'fecha_actualizacion'])

        if datos_vivienda:
            vivienda_defaults = {
                'direccion_exacta': datos_vivienda.get('direccion_exacta', ''),
            }
            if datos_vivienda.get('estado_id'):
                vivienda_defaults['estado_id'] = datos_vivienda['estado_id']
            if datos_vivienda.get('municipio_id'):
                vivienda_defaults['municipio_id'] = datos_vivienda['municipio_id']
            if datos_vivienda.get('parroquia'):
                vivienda_defaults['parroquia_id'] = datos_vivienda['parroquia']
            if datos_vivienda.get('condicion_vivienda_id'):
                vivienda_defaults['condicion_vivienda_id'] = datos_vivienda['condicion_vivienda_id']
            if datos_vivienda.get('codigo_postal_id'):
                vivienda_defaults['codigo_postal_id'] = datos_vivienda['codigo_postal_id']

            DatosViviendaModel.objects.update_or_create(
                empleado_id=emp.id,
                defaults=vivienda_defaults,
            )

        for item in respuestas:
            pregunta_id = item.get('pregunta') or item.get('pregunta_id')
            opcion_id = item.get('opcion') or item.get('opcion_id')
            texto = item.get('respuesta', '')

            RespuestasEncuestaModel.objects.update_or_create(
                pregunta_id=pregunta_id,
                empleado_id=emp.cedulaidentidad,
                defaults={
                    'opcion_id': opcion_id,
                    'respuesta': str(texto) if texto is not None else '',
                },
            )

        return self._serializar_censo_empleado(emp)

    def guardar_respuestas_empleado(
        self, empleado_cedula: str, respuestas: list[dict]
    ) -> list[RespuestaEncuesta]:
        for r in respuestas:
            pregunta_id = r.get('pregunta_id') or r.get('pregunta')
            opcion_id = r.get('opcion_id') or r.get('opcion')
            texto = r.get('respuesta', '')
            RespuestasEncuestaModel.objects.update_or_create(
                pregunta_id=pregunta_id,
                empleado_id=empleado_cedula,
                defaults={'opcion_id': opcion_id, 'respuesta': str(texto) if texto is not None else ''},
            )
        return self.obtener_respuestas_empleado(empleado_cedula)

    def obtener_reporte_dependencias(
        self,
        dep_ids: list[int] | None = None,
        dg_ids: list[int] | None = None,
        dl_ids: list[int] | None = None,
        coord_ids: list[int] | None = None,
    ) -> dict:
        pie_chart = construir_grafico_torta(dep_ids, dg_ids, dl_ids, coord_ids)
        bar_chart = construir_grafico_barras(dep_ids, dg_ids, dl_ids, coord_ids)
        return {
            'pie_chart': pie_chart,
            'bar_chart': bar_chart,
        }

    def obtener_todas_respuestas(self) -> list[dict]:
        qs = (
            RespuestasEncuestaModel.objects.select_related('empleado', 'pregunta', 'opcion')
            .order_by('empleado_id', 'pregunta__orden')
        )
        filas = []
        for r in qs:
            emp = r.empleado
            filas.append({
                'cedula': str(r.empleado_id),
                'empleado': f"{emp.nombres} {emp.apellidos}".strip() if emp else '',
                'pregunta': r.pregunta.enunciado if r.pregunta else '',
                'respuesta': r.opcion.tipo_opcion if r.opcion else r.respuesta,
            })
        return filas

    def obtener_metricas_censo(self) -> dict:
        reporte = self.obtener_reporte_dependencias()
        total_empleados_censados = (
            RespuestasEncuestaModel.objects.values('empleado_id').distinct().count()
        )
        total_respuestas = RespuestasEncuestaModel.objects.count()
        return {
            'total_empleados_censados': total_empleados_censados,
            'total_respuestas': total_respuestas,
            **reporte,
        }

    def generar_excel_censo(self, filtros: dict | None = None):
        return generar_excel_censo(filtros)
