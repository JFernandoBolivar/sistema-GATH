"""Consulta del listado exportable de la bandeja de fe de vida (O23).

Usa exactamente los mismos filtros y el mismo criterio de proceso que la bandeja
(proceso pedido, histórico de cerrados o abiertos), con subconsultas para los
datos del trabajador y el número de constancia: sin N+1.
"""
from django.db.models import OuterRef, Subquery

from apps.fe_de_vida.domain.entities.bandeja_exportacion import PasivoBandeja
from apps.fe_de_vida.domain.entities.filtros import FiltroBandeja
from apps.fe_de_vida.infrastructure.models.solicitud_models import (
    ConstanciaFeDeVidaModel,
    SolicitudFeDeVidaModel,
)
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import _coincide_texto
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class RepoBandejaExportacionORM:
    def listar(self, filtro: FiltroBandeja, limite: int, desplazamiento: int) -> tuple[list[PasivoBandeja], int]:
        empleado = EmployeeModel.objects.filter(cedulaidentidad=OuterRef('cedula'))
        constancia = ConstanciaFeDeVidaModel.objects.filter(solicitud_id=OuterRef('pk'))

        qs = SolicitudFeDeVidaModel.objects.all()
        if filtro.proceso_ids is not None:
            qs = qs.filter(proceso_id__in=filtro.proceso_ids)
        elif filtro.proceso_id:
            qs = qs.filter(proceso_id=filtro.proceso_id)
        elif filtro.historico:
            qs = qs.filter(proceso__estado='CERRADO')
        else:
            qs = qs.filter(proceso__estado='ABIERTO')
        if filtro.estado:
            qs = qs.filter(estado=filtro.estado)
        if filtro.texto:
            qs = qs.filter(_coincide_texto(filtro.texto))
        if filtro.desde:
            qs = qs.filter(fecha_envio__date__gte=filtro.desde)
        if filtro.hasta:
            qs = qs.filter(fecha_envio__date__lte=filtro.hasta)
        qs = qs.order_by('-fecha_envio', '-created_at')
        total = qs.count()
        filas = qs.annotate(
            nombres=Subquery(empleado.values('nombres')[:1]),
            apellidos=Subquery(empleado.values('apellidos')[:1]),
            correo=Subquery(empleado.values('correo')[:1]),
            telefono_movil=Subquery(empleado.values('telefono_movil')[:1]),
            telefono_habitacion=Subquery(empleado.values('telefono_habitacion')[:1]),
            numero_acta=Subquery(constancia.values('numero')[:1]),
        ).values(
            'cedula', 'nombres', 'apellidos', 'correo', 'telefono_movil', 'telefono_habitacion',
            'estado', 'fecha_envio', 'numero_acta',
        )[desplazamiento:desplazamiento + limite]
        return [
            PasivoBandeja(
                cedula=fila['cedula'],
                nombres=fila['nombres'] or '',
                apellidos=fila['apellidos'] or '',
                correo=(fila['correo'] or '').strip(),
                telefono=(fila['telefono_movil'] or fila['telefono_habitacion'] or '').strip(),
                estado=fila['estado'],
                fecha_envio=fila['fecha_envio'],
                numero_acta=fila['numero_acta'] or '',
            )
            for fila in filas
        ], total
