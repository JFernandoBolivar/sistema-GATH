"""Repositorio ORM de postulantes, expedientes e historial; y el buscador de empleados previos (C-1)."""
from datetime import date

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import EmpleadoPrevio, Postulante, TransicionRegistrada
from apps.postulacion.infrastructure.mappers.mapper_postulacion import (
    campos_de_expediente,
    expediente_a_entidad,
    postulante_a_entidad,
    transicion_a_entidad,
)
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)
from core.infrastructure.providers import obtener_resolutor_condicion
from apps.postulacion.domain.value_objects.estados import VALORES_TERMINALES
from core.domain.exceptions import ConflictError, NotFoundError

_REINTENTOS_NUMERO = 5


def _uuid_valido(valor: str):
    import uuid
    try:
        return uuid.UUID(str(valor))
    except (ValueError, TypeError, AttributeError):
        return None


class RepoPostulacionORM:
    def transaccion(self):
        return transaction.atomic()

    # --- postulantes ---
    def obtener_postulante_por_cedula(self, cedula: str, bloquear: bool = False) -> Postulante | None:
        qs = PostulanteModel.objects.select_for_update() if bloquear else PostulanteModel.objects
        m = qs.filter(cedula=cedula).first()
        return postulante_a_entidad(m) if m else None

    def obtener_postulante(self, postulante_id: str) -> Postulante | None:
        pk = _uuid_valido(postulante_id)
        m = PostulanteModel.objects.filter(pk=pk).first() if pk else None
        return postulante_a_entidad(m) if m else None

    def crear_postulante(self, p: Postulante) -> Postulante:
        m = PostulanteModel.objects.create(
            cedula=p.cedula, nombres=p.nombres, apellidos=p.apellidos, correo=p.correo,
            telefono_movil=p.telefono_movil, employee_cedula=p.employee_cedula, creado_por=p.creado_por,
        )
        return postulante_a_entidad(m)

    def vincular_empleado(self, postulante_id: str, employee_cedula: str) -> Postulante:
        actualizadas = PostulanteModel.objects.filter(pk=postulante_id).update(employee_cedula=employee_cedula)
        if not actualizadas:
            raise NotFoundError("El postulante no existe.")
        return self.obtener_postulante(postulante_id)

    # --- expedientes ---
    def tiene_expediente_abierto(self, postulante_id: str) -> bool:
        return ExpedientePostulacionModel.objects.filter(postulante_id=postulante_id).exclude(
            estado__in=VALORES_TERMINALES,
        ).exists()

    def _siguiente_numero(self, anio: int) -> str:
        prefijo = f'EXP-{anio}-'
        ultimo = (
            ExpedientePostulacionModel.objects.filter(numero__startswith=prefijo)
            .order_by('-numero').values_list('numero', flat=True).first()
        )
        n = int(ultimo.rsplit('-', 1)[1]) + 1 if ultimo else 1
        return f'{prefijo}{n:05d}'

    def crear_expediente(self, e: ExpedientePostulacion) -> ExpedientePostulacion:
        anio = (e.fecha_apertura.year if e.fecha_apertura else None) or date.today().year
        campos = campos_de_expediente(e)
        for _ in range(_REINTENTOS_NUMERO):
            try:
                with transaction.atomic():  # savepoint: un choque de número o de constraint no envenena la transacción
                    m = ExpedientePostulacionModel.objects.create(
                        numero=self._siguiente_numero(anio), postulante_id=e.postulante_id,
                        fecha_apertura=e.fecha_apertura or timezone.now(), **campos,
                    )
                return expediente_a_entidad(m)
            except IntegrityError:
                if self.tiene_expediente_abierto(e.postulante_id):
                    raise ConflictError("El postulante ya tiene un expediente abierto.") from None
        raise ConflictError("No se pudo asignar el número del expediente; intente de nuevo.")

    def obtener_expediente(self, expediente_id: str, bloquear: bool = False) -> ExpedientePostulacion | None:
        pk = _uuid_valido(expediente_id)
        if pk is None:
            return None
        qs = ExpedientePostulacionModel.objects.select_for_update() if bloquear else ExpedientePostulacionModel.objects
        m = qs.filter(pk=pk).first()
        return expediente_a_entidad(m) if m else None

    def guardar_expediente(self, e: ExpedientePostulacion) -> ExpedientePostulacion:
        actualizadas = ExpedientePostulacionModel.objects.filter(pk=e.id).update(**campos_de_expediente(e))
        if not actualizadas:
            raise NotFoundError("El expediente de postulación no existe.")
        return self.obtener_expediente(e.id)

    # --- historial ---
    def registrar_transicion(self, t: TransicionRegistrada) -> TransicionRegistrada:
        m = TransicionExpedienteModel.objects.create(
            expediente_id=t.expediente_id, estado_origen=t.estado_origen, estado_destino=t.estado_destino,
            actor_cedula=t.actor_cedula, actor_tipo=t.actor_tipo, fecha=t.fecha, motivo=t.motivo,
            datos_extra=t.datos_extra,
        )
        return transicion_a_entidad(m)

    def listar_transiciones(self, expediente_id: str) -> list[TransicionRegistrada]:
        return [transicion_a_entidad(m) for m in TransicionExpedienteModel.objects.filter(expediente_id=expediente_id)]


class BuscadorEmpleadosORM:
    """Lee el `Employee` heredado por cédula (solo lectura; sin FK desde las tablas nuevas)."""

    def por_cedula(self, cedula: str) -> EmpleadoPrevio | None:
        e = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if e is None:
            return None
        # Mismo criterio de condición que el resto del sistema (apps.identidad).
        resolutor = obtener_resolutor_condicion()
        condicion = str(resolutor.condicion_de(e.cedulaidentidad) or '') if resolutor else ''
        return EmpleadoPrevio(cedula=e.cedulaidentidad, nombres=e.nombres, apellidos=e.apellidos, condicion=condicion)
