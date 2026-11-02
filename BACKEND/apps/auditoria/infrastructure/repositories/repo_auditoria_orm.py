"""Repositorio ORM de auditoría (solo lectura) sobre `AuditoriaLog` e incidentes."""
from django.db.models import Q
from django.utils import timezone

from apps.auditoria.domain.entities.registro import (
    IncidenteSeguridad,
    OpcionesAuditoria,
    RegistroAuditoria,
)
from apps.auditoria.domain.value_objects.filtros_auditoria import FiltrosAuditoria
from apps.identidad.infrastructure.models.intento_fallido_model import IntentoFallidoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog


def _nombres(cedulas: list[str]) -> dict[str, str]:
    if not cedulas:
        return {}
    filas = EmployeeModel.objects.filter(cedulaidentidad__in=set(cedulas)).values(
        'cedulaidentidad', 'nombres', 'apellidos'
    )
    return {
        fila['cedulaidentidad']: f"{fila['nombres']} {fila['apellidos']}".strip()
        for fila in filas
    }


class RepoAuditoriaORM:
    def listar(
        self, filtros: FiltrosAuditoria, limite: int, offset: int = 0
    ) -> tuple[list[RegistroAuditoria], int]:
        qs = AuditoriaLog.objects.all()
        if filtros.usuario:
            cedulas = list(
                EmployeeModel.objects.filter(
                    Q(nombres__icontains=filtros.usuario) | Q(apellidos__icontains=filtros.usuario)
                ).values_list('cedulaidentidad', flat=True)
            )
            qs = qs.filter(
                Q(actor_cedula__icontains=filtros.usuario) | Q(actor_cedula__in=cedulas)
            )
        if filtros.accion:
            qs = qs.filter(accion=filtros.accion)
        if filtros.modulo:
            qs = qs.filter(modulo=filtros.modulo)
        if filtros.recurso:
            qs = qs.filter(
                Q(recurso_tipo__icontains=filtros.recurso)
                | Q(recurso_id__icontains=filtros.recurso)
            )
        if filtros.ip:
            qs = qs.filter(ip_origen__icontains=filtros.ip)
        if filtros.resultado:
            qs = qs.filter(resultado=filtros.resultado)
        if filtros.desde:
            qs = qs.filter(fecha_hora__date__gte=filtros.desde)
        if filtros.hasta:
            qs = qs.filter(fecha_hora__date__lte=filtros.hasta)

        qs = qs.order_by('-fecha_hora', '-id')
        total = qs.count()
        filas = list(qs[offset:offset + limite] if limite > 0 else qs[offset:])
        nombres = _nombres([f.actor_cedula for f in filas if f.actor_cedula])
        return [self._a_entidad(fila, nombres.get(fila.actor_cedula, '')) for fila in filas], total

    def obtener(self, id: str) -> RegistroAuditoria | None:
        fila = AuditoriaLog.objects.filter(pk=id).first()
        if fila is None:
            return None
        nombre = _nombres([fila.actor_cedula]).get(fila.actor_cedula, '')
        return self._a_entidad(fila, nombre)

    @staticmethod
    def _a_entidad(fila: AuditoriaLog, nombre: str) -> RegistroAuditoria:
        return RegistroAuditoria(
            id=str(fila.pk),
            fecha_hora=timezone.localtime(fila.fecha_hora).isoformat(),
            actor_cedula=fila.actor_cedula,
            actor_nombre=nombre,
            actor_rol=fila.actor_rol,
            modulo=fila.modulo,
            accion=fila.accion,
            recurso_tipo=fila.recurso_tipo,
            recurso_id=fila.recurso_id,
            ip=str(fila.ip_origen or ''),
            user_agent=fila.user_agent,
            resultado=fila.resultado,
            estado_previo=fila.estado_previo,
            estado_nuevo=fila.estado_nuevo,
        )

    def opciones(self) -> OpcionesAuditoria:
        return OpcionesAuditoria(
            acciones=list(
                AuditoriaLog.objects.exclude(accion='')
                .values_list('accion', flat=True).distinct().order_by('accion')
            ),
            modulos=list(
                AuditoriaLog.objects.exclude(modulo='')
                .values_list('modulo', flat=True).distinct().order_by('modulo')
            ),
            resultados=list(
                AuditoriaLog.objects.values_list('resultado', flat=True).distinct().order_by('resultado')
            ),
        )

    def listar_incidentes(
        self, filtros: FiltrosAuditoria, limite: int, offset: int = 0
    ) -> tuple[list[IncidenteSeguridad], int]:
        qs = IntentoFallidoModel.objects.all()
        if filtros.usuario:
            cedulas = list(
                EmployeeModel.objects.filter(
                    Q(nombres__icontains=filtros.usuario) | Q(apellidos__icontains=filtros.usuario)
                ).values_list('cedulaidentidad', flat=True)
            )
            qs = qs.filter(
                Q(cedula__icontains=filtros.usuario) | Q(cedula__in=cedulas)
            )
        if filtros.ip:
            qs = qs.filter(ip__icontains=filtros.ip)
        if filtros.resultado:
            qs = qs.filter(resultado__iexact=filtros.resultado)
        if filtros.desde:
            qs = qs.filter(fecha_hora__date__gte=filtros.desde)
        if filtros.hasta:
            qs = qs.filter(fecha_hora__date__lte=filtros.hasta)

        qs = qs.order_by('-fecha_hora', '-id')
        total = qs.count()
        filas = list(qs[offset:offset + limite] if limite > 0 else qs[offset:])
        nombres = _nombres([f.cedula for f in filas])
        return [
            IncidenteSeguridad(
                id=str(fila.pk),
                fecha_hora=timezone.localtime(fila.fecha_hora).isoformat(),
                cedula=fila.cedula,
                nombre=nombres.get(fila.cedula, ''),
                ip=str(fila.ip or ''),
                resultado=fila.resultado,
            )
            for fila in filas
        ], total
