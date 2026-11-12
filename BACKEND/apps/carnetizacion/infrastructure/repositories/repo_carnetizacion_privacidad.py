"""Repositorio de carnetizaciÃ³n: qr."""
from django.utils import timezone

from core.domain.catalogos import (
    ESTATUS_ACTIVO,
)
from core.domain.exceptions import NotFoundError
from apps.carnetizacion.domain.entities.privacidad import (
    PRIVACIDAD_POR_DEFECTO,
    validar_preferencias_privacidad,
)
from apps.carnetizacion.domain.entities.verificacion_integracion import (
    VerificacionCarnet,
    normalizar_documento,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    PreferenciaPrivacidadCarnetModel,
    BitacoraAccesoQrModel,
)

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


from .repo_carnetizacion_comun import (
    vencimiento_de_carnet,
)


class RepoPrivacidadMixin:
    def verificar_carnet_integracion(self, security_hash: str) -> VerificacionCarnet:
        """Verificación para sistemas integrados: cédula siempre (canal autenticado), nunca salud ni foto."""
        from apps.carnetizacion.infrastructure.models.credencial_externa_model import (
            CredencialExternaModel,
        )

        carnet = (
            CarnetEmitidoModel.objects.select_related('employee', 'employee__nacionalidad')
            .filter(security_hash=security_hash)
            .first()
        )
        if carnet is None:
            externa = (
                CredencialExternaModel.objects.select_related('tipo_credencial')
                .filter(security_hash=security_hash)
                .first()
            )
            if externa is None:
                return VerificacionCarnet(
                    valido=False, estado='NO_REGISTRADO', mensaje='Carnet no encontrado en el sistema.'
                )
            vence = externa.vigencia_hasta
            if externa.estado == CredencialExternaModel.Estado.ACTIVA and vence < timezone.now():
                return VerificacionCarnet(
                    valido=False,
                    estado='VENCIDO',
                    mensaje='Credencial vencida.',
                    fecha_vencimiento=vence.date().isoformat(),
                )
            if externa.estado != CredencialExternaModel.Estado.ACTIVA:
                estado = 'VENCIDO' if externa.estado == CredencialExternaModel.Estado.VENCIDA else 'ANULADO'
                return VerificacionCarnet(valido=False, estado=estado, mensaje='Credencial no vigente.')
            cedula_externa, nacionalidad_externa = normalizar_documento(externa.documento)
            return VerificacionCarnet(
                valido=True,
                estado='VIGENTE',
                cedula=cedula_externa,
                nacionalidad=nacionalidad_externa,
                documento=externa.documento,
                nombre=externa.nombre,
                tipo_credencial=str(externa.tipo_credencial_id),
                fecha_emision=externa.vigencia_desde.date().isoformat(),
                fecha_vencimiento=vence.date().isoformat(),
            )

        if not carnet.activo:
            return VerificacionCarnet(valido=False, estado='ANULADO', mensaje='Carnet anulado.')

        fecha_venc = vencimiento_de_carnet(carnet)
        if fecha_venc and timezone.now() > fecha_venc:
            return VerificacionCarnet(
                valido=False,
                estado='VENCIDO',
                mensaje='Carnet vencido.',
                fecha_vencimiento=fecha_venc.date().isoformat(),
            )

        empleado = carnet.employee
        asig = (
            AsigTrabajoModel.objects.select_related('estatusid')
            .filter(employee=empleado)
            .order_by('-pk')
            .first()
        )
        estatus = ((asig.estatusid.estatus or '').upper() if asig and asig.estatusid else '') or None
        es_pasivo = estatus != ESTATUS_ACTIVO and EmployeeEgresadoModel.objects.filter(employee=empleado).exists()
        return VerificacionCarnet(
            valido=True,
            estado='VIGENTE',
            cedula=empleado.cedulaidentidad,
            nacionalidad=(getattr(empleado.nacionalidad, 'codigo', None) or None) if empleado.nacionalidad_id else None,
            nombre=f"{empleado.nombres} {empleado.apellidos}".strip(),
            tipo_credencial='pasivo' if es_pasivo else 'trabajador',
            estado_laboral='PASIVO' if es_pasivo else estatus,
            fecha_emision=carnet.fecha_emision.date().isoformat() if carnet.fecha_emision else None,
            fecha_vencimiento=fecha_venc.date().isoformat() if fecha_venc else None,
        )

    def obtener_preferencia_privacidad(self, employee_id: int) -> dict[str, str]:
        obj =PreferenciaPrivacidadCarnetModel.objects.filter(employee_id=employee_id).first()
        if obj and obj.preferencias:
            return validar_preferencias_privacidad(obj.preferencias)
        return dict(PRIVACIDAD_POR_DEFECTO)

    def guardar_preferencia_privacidad(
        self,
        employee_id: int,
        preferencias: dict[str, str],
    ) -> dict[str, str]:
        validadas = validar_preferencias_privacidad(preferencias)
        PreferenciaPrivacidadCarnetModel.objects.update_or_create(
            employee_id=employee_id,
            defaults={'preferencias': validadas},
        )
        return validadas

    def obtener_privacidad_por_cedula(self, cedula: str) -> dict[str, str]:
        emp = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not emp:
            raise NotFoundError(f"Empleado con cédula '{cedula}' no encontrado")
        return self.obtener_preferencia_privacidad(emp.id)

    def guardar_privacidad_por_cedula(
        self,
        cedula: str,
        preferencias: dict[str, str],
    ) -> dict[str, str]:
        emp = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if not emp:
            raise NotFoundError(f"Empleado con cédula '{cedula}' no encontrado")
        return self.guardar_preferencia_privacidad(emp.id, preferencias)

    def anular_carnet_por_egreso(
        self,
        employee_id: int,
        motivo: str = "Egreso de la institución",
    ) -> int:
        carnets = CarnetEmitidoModel.objects.filter(employee_id=employee_id, activo=True)
        count = 0
        for c in carnets:
            c.activo = False
            obs = c.observaciones or ""
            c.observaciones = f"{obs} [ANULADO: {motivo}]".strip()
            c.save(update_fields=['activo', 'observaciones'])
            BitacoraAccesoQrModel.objects.create(
                security_hash=c.security_hash,
                carnet_id=c.id,
                accion='ANULADO_POR_EGRESO',
                ip='127.0.0.1',
                user_agent='Sistema (evento egreso)',
            )
            count += 1
        return count
