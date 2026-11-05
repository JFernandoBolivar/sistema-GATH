"""Consultas agregadas de las estadísticas de fe de vida (O21).

Todo se resuelve en la base con subconsultas correlacionadas y `GROUP BY`:
no se recorren pasivos en Python (sin N+1). El universo es la asignación
laboral PASIVO del trabajador (la más reciente), acotada por el alcance del
proceso (sus tipos de nómina).
"""
from django.db.models import Count, Exists, OuterRef, Q, Subquery

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.fe_de_vida.domain.entities.estadisticas import (
    ConteosEstadistica,
    FilaCanal,
    FilaEstado,
    FilaMatriz,
    FilaTipo,
    FiltroEstadisticas,
    PasivoEstadistica,
)
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida
from apps.fe_de_vida.domain.value_objects.estados import CONDICION_PASIVO
from apps.fe_de_vida.infrastructure.models.solicitud_models import SolicitudFeDeVidaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

ESTADO_VALIDADA = 'VALIDADA'


def _asignaciones_pasivas(tipos_nomina: tuple[int, ...]) -> Q:
    filtro = Q(
        employee_id=OuterRef('cedulaidentidad'),
        Tipo_personal__tipo_personal__iexact=CONDICION_PASIVO,
    )
    if tipos_nomina:
        filtro &= Q(tiponominaid_id__in=tipos_nomina)
    return filtro


class RepoEstadisticasORM:
    def _base(self, proceso: ProcesoFeDeVida, filtro: FiltroEstadisticas):
        pasivas = (
            AsigTrabajoModel.objects
            .filter(_asignaciones_pasivas(tuple(proceso.tipos_nomina)))
            .order_by('-fecha_actualizacion')
        )
        solicitudes = SolicitudFeDeVidaModel.objects.filter(proceso_id=proceso.id)
        complementarios = DatosComplementariosTrabajadorModel.objects.filter(
            cedula=OuterRef('cedulaidentidad'),
        )

        qs = EmployeeModel.objects.filter(Exists(pasivas)).annotate(
            tipo_nomina_id=Subquery(pasivas.values('tiponominaid_id')[:1]),
            tipo_nomina=Subquery(pasivas.values('tiponominaid__nomina')[:1]),
            correo_alt=Subquery(complementarios.values('correo_alternativo')[:1]),
            estado_fv=Subquery(
                solicitudes.filter(cedula=OuterRef('cedulaidentidad')).values('estado')[:1],
            ),
            canal_fv=Subquery(
                solicitudes.filter(cedula=OuterRef('cedulaidentidad')).values('canal')[:1],
            ),
            fecha_envio_fv=Subquery(
                solicitudes.filter(cedula=OuterRef('cedulaidentidad')).values('fecha_envio')[:1],
            ),
        )
        if filtro.tipo_nomina_id:
            qs = qs.filter(tipo_nomina_id=filtro.tipo_nomina_id)
        return qs

    @staticmethod
    def _con_filtros_de_solicitud(qs, filtro: FiltroEstadisticas):
        """Los filtros de estado/canal/fechas refinan el análisis, no los KPI del proceso."""
        if filtro.estado:
            qs = qs.filter(estado_fv=filtro.estado)
        if filtro.canal:
            qs = qs.filter(canal_fv=filtro.canal)
        if filtro.desde:
            qs = qs.filter(fecha_envio_fv__date__gte=filtro.desde)
        if filtro.hasta:
            qs = qs.filter(fecha_envio_fv__date__lte=filtro.hasta)
        return qs

    def contar(self, proceso: ProcesoFeDeVida, filtro: FiltroEstadisticas) -> ConteosEstadistica:
        base = self._base(proceso, filtro)

        filas_tipo = [
            FilaTipo(
                tipo_nomina_id=fila['tipo_nomina_id'],
                tipo_nomina=fila['tipo_nomina'] or 'Sin tipo de pasivo',
                total=fila['total'],
                respondieron=fila['respondieron'],
                faltan=fila['total'] - fila['respondieron'],
                validadas=fila['validadas'],
            )
            for fila in base.values('tipo_nomina_id', 'tipo_nomina').annotate(
                total=Count('cedulaidentidad'),
                respondieron=Count('cedulaidentidad', filter=Q(fecha_envio_fv__isnull=False)),
                validadas=Count('cedulaidentidad', filter=Q(estado_fv=ESTADO_VALIDADA)),
            ).order_by('tipo_nomina')
        ]

        filtrada = self._con_filtros_de_solicitud(base, filtro)
        por_estado = [
            FilaEstado(estado=fila['estado_fv'], total=fila['total'])
            for fila in filtrada.exclude(estado_fv__isnull=True).values('estado_fv').annotate(
                total=Count('cedulaidentidad'),
            ).order_by('estado_fv')
        ]
        por_canal = [
            FilaCanal(canal=fila['canal_fv'] or '', total=fila['total'])
            for fila in filtrada.filter(fecha_envio_fv__isnull=False).values('canal_fv').annotate(
                total=Count('cedulaidentidad'),
            ).order_by('canal_fv')
        ]
        matriz = [
            FilaMatriz(
                tipo_nomina_id=fila['tipo_nomina_id'],
                tipo_nomina=fila['tipo_nomina'] or 'Sin tipo de pasivo',
                estado=fila['estado_fv'],
                total=fila['total'],
            )
            for fila in filtrada.exclude(estado_fv__isnull=True)
            .values('tipo_nomina_id', 'tipo_nomina', 'estado_fv')
            .annotate(total=Count('cedulaidentidad'))
            .order_by('tipo_nomina', 'estado_fv')
        ]

        total = sum(f.total for f in filas_tipo)
        respondieron = sum(f.respondieron for f in filas_tipo)
        validadas = sum(f.validadas for f in filas_tipo)
        return ConteosEstadistica(
            total=total,
            respondieron=respondieron,
            faltan=total - respondieron,
            validadas=validadas,
            por_tipo=tuple(filas_tipo),
            por_estado=tuple(por_estado),
            por_canal=tuple(por_canal),
            matriz=tuple(matriz),
        )

    def listar(
        self, proceso: ProcesoFeDeVida, filtro: FiltroEstadisticas, *,
        faltantes: bool, limite: int, desplazamiento: int,
    ) -> tuple[list[PasivoEstadistica], int]:
        qs = self._base(proceso, filtro)
        if faltantes:
            qs = qs.filter(fecha_envio_fv__isnull=True)
        else:
            qs = self._con_filtros_de_solicitud(qs, filtro).exclude(estado_fv__isnull=True)
        qs = qs.order_by('apellidos', 'nombres')
        total = qs.count()
        filas = qs.values(
            'cedulaidentidad', 'nombres', 'apellidos', 'correo', 'correo_alt',
            'telefono_movil', 'telefono_habitacion', 'tipo_nomina',
            'estado_fv', 'canal_fv', 'fecha_envio_fv',
        )[desplazamiento:desplazamiento + limite]
        return [
            PasivoEstadistica(
                cedula=fila['cedulaidentidad'],
                nombre_completo=f"{fila['nombres']} {fila['apellidos']}".strip(),
                tipo_nomina=fila['tipo_nomina'] or '',
                correo=(fila['correo'] or fila['correo_alt'] or '').strip(),
                telefono=(fila['telefono_movil'] or fila['telefono_habitacion'] or '').strip(),
                estado=fila['estado_fv'] or '',
                canal=fila['canal_fv'] or '',
                fecha_envio=fila['fecha_envio_fv'],
            )
            for fila in filas
        ], total
