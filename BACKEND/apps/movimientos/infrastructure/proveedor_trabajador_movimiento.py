"""Proveedor ORM de datos reales del trabajador para los documentos de movimiento."""

import hashlib
from datetime import date

from apps.movimientos.domain.entities.movimiento import MovimientoCargo
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import NotFoundError
from core.domain.validacion_personas import formatear_telefono


def _mayus(valor) -> str:
    return str(valor or '').strip().upper()


def _fecha(valor) -> str:
    if not valor:
        return ''
    return valor.strftime('%d/%m/%Y') if hasattr(valor, 'strftime') else str(valor)


def _edad(nacimiento, hoy: date) -> str:
    if not nacimiento:
        return ''
    return str(hoy.year - nacimiento.year - ((hoy.month, hoy.day) < (nacimiento.month, nacimiento.day)))


class ProveedorTrabajadorMovimientoORM:
    """Lee Personal y resuelve el origen humano del traslado/egreso.

    La fotografía se toma del mismo almacén que el proveedor de documentos; si
    no existe `foto_objeto` se omite. Un fallo de almacén se propaga para que el
    orquestador lo audite, nunca para revertir el movimiento.
    """

    def datos_de(
        self,
        cedula: str,
        *,
        movimiento: MovimientoCargo,
        evento: dict | None = None,
    ) -> dict:
        empleado = (
            EmployeeModel.objects.select_related('sexoid', 'estadoCivil', 'nacionalidad')
            .filter(cedulaidentidad=cedula)
            .first()
        )
        if empleado is None:
            raise NotFoundError(f'Empleado con cédula {cedula} no encontrado.')

        hoy = date.today()
        datos = {
            'nombres': _mayus(empleado.nombres),
            'apellidos': _mayus(empleado.apellidos),
            'nombre_completo': f'{_mayus(empleado.apellidos)} {_mayus(empleado.nombres)}'.strip(),
            'cedula': empleado.cedulaidentidad,
            'cedula_numero': empleado.cedulaidentidad[1:],
            'nacionalidad': _mayus(empleado.nacionalidad.nombre) if empleado.nacionalidad_id else '',
            'sexo': _mayus(empleado.sexoid.sexo) if empleado.sexoid_id else '',
            'estado_civil': _mayus(empleado.estadoCivil.estadoCivil) if empleado.estadoCivil_id else '',
            'fecha_nacimiento': _fecha(empleado.fecha_nacimiento),
            'edad': _edad(empleado.fecha_nacimiento, hoy),
            'rif': _mayus(empleado.rif),
            'correo': empleado.correo or '',
            'telefono_principal': formatear_telefono(empleado.telefono_habitacion),
            'telefono_celular': formatear_telefono(empleado.telefono_movil),
        }
        origen = self._origen(movimiento, evento)
        if origen:
            datos['origen'] = origen
        if empleado.foto_objeto:
            from apps.documentos.infrastructure.almacen import obtener_almacen

            foto = obtener_almacen().descargar(empleado.foto_objeto)
            datos['foto'] = foto
            datos['_foto_sha256'] = hashlib.sha256(foto).hexdigest()
        return datos

    def _origen(self, movimiento: MovimientoCargo, evento: dict | None) -> str:
        evento = evento or {}
        if evento.get('origen_descripcion'):
            return str(evento['origen_descripcion'])

        if movimiento.tipo_movimiento == 'TRASLADO' and any(
            evento.get(clave) is not None
            for clave in ('dependencia_anterior_id', 'oficina_anterior_id')
        ):
            dependencia = (
                DependenciaModel.objects.filter(pk=evento['dependencia_anterior_id'])
                .values_list('dependencia', flat=True).first()
                if evento.get('dependencia_anterior_id') else None
            )
            oficina = (
                DireccionGeneralModel.objects.filter(pk=evento['oficina_anterior_id'])
                .values_list('direccion_general', flat=True).first()
                if evento.get('oficina_anterior_id') else None
            )
            return ' - '.join(str(parte) for parte in (oficina, dependencia) if parte)

        if movimiento.tipo_movimiento == 'EGRESO':
            anterior = (
                EmployeeMovementHistoryModel.objects.exclude(pk=movimiento.id)
                .filter(empleado_id=movimiento.empleado_cedula)
                .select_related('denominacioncargo', 'DependenciasId', 'DireccionGeneralid')
                .order_by('-fecha_movimiento', '-pk')
                .first()
            )
            if anterior is not None:
                return ' - '.join(str(parte) for parte in (
                    anterior.codigo_puesto,
                    anterior.denominacioncargo.cargo,
                    anterior.DireccionGeneralid.direccion_general if anterior.DireccionGeneralid_id else None,
                    anterior.DependenciasId.dependencia if anterior.DependenciasId_id else None,
                ) if parte)
        return ''
