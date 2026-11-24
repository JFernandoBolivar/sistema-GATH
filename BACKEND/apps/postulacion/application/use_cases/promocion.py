"""
Promoción atómica del postulante a trabajador (G-4): LISTO_PARA_ASIGNAR -> CONTRATADO. Sin Django.

TODO ocurre en UNA transacción; si cualquier paso falla no queda NADA a medias (ni Employee, ni familiares, ni puesto ocupado,
ni movimiento, ni cuenta, ni reserva consumida, ni cambio de estado). El orden es:

  1. Bloquear el expediente, el puesto y la reserva (siempre en ese orden, igual que `reservar_puesto`) y REVALIDAR con datos
     reales: la reserva es de este expediente, está ACTIVA y vigente, y el puesto sigue vacante. Si no, `PUESTO_NO_DISPONIBLE`
     y no se toca nada. La guarda `RESERVA_VIGENTE_Y_REVALIDADA` de la máquina lee estos mismos datos.
  2-5. Por el puerto `PromotorEmpleado`: Employee (o el existente en un reingreso, C-1), sus datos de V1 y V2, los familiares,
     la asignación del puesto con el movimiento INGRESO y la cuenta de acceso.
  6. La reserva pasa a CONSUMIDA, el postulante queda enlazado al Employee, se revoca la credencial del postulante y el
     expediente pasa a CONTRATADO (con su asiento).

Los avisos (resolver los pendientes y avisar la contratación) salen DESPUÉS del commit, como el resto del flujo.
"""
from dataclasses import dataclass, replace
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente
from apps.postulacion.application.use_cases.transiciones import HechosExternos, aplicar_transicion_expediente
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import TransicionRegistrada
from apps.postulacion.domain.entities.promocion import ResultadoPromocion, SolicitudPromocion
from apps.postulacion.domain.entities.reserva import ACTIVA, CONSUMIDA, MOTIVO_CONTRATACION, ReservaPuesto
from apps.postulacion.domain.entities.vacantes import PuestoVacante
from apps.postulacion.domain.errores import ConflictoConCodigo
from apps.postulacion.domain.ports.repos import PromotorEmpleado, PuestosVacantes, RepoPostulacion
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import NotFoundError
from core.domain.ports import LectorConfiguracion, Notificador

E = EstadoExpediente


@dataclass(frozen=True)
class ResultadoContratacion:
    expediente: ExpedientePostulacion
    asiento: TransicionRegistrada | None
    promocion: ResultadoPromocion
    reserva: ReservaPuesto
    puesto: PuestoVacante


def _no_disponible(detalle: str) -> ConflictoConCodigo:
    return ConflictoConCodigo(
        f"El puesto ya no está disponible para este expediente: {detalle} No se hizo ningún cambio.",
        codigo='PUESTO_NO_DISPONIBLE',
    )


def revalidar_puesto(
    repo: RepoPostulacion, puestos: PuestosVacantes, exp: ExpedientePostulacion, ahora: datetime,
) -> tuple[ReservaPuesto, PuestoVacante]:
    """
    Bloquea y revalida con datos reales. Orden de bloqueos: expediente (ya tomado), puesto y reserva. Lanza
    `PUESTO_NO_DISPONIBLE` si la reserva no es de este expediente, no está ACTIVA o venció, o el puesto no está vacante.
    """
    previa = repo.obtener_reserva_activa_de_expediente(exp.id)
    if previa is None:
        raise _no_disponible("el expediente no tiene una reserva activa (pudo vencer o liberarse).")
    puesto = puestos.obtener_puesto(previa.puesto_id, bloquear=True)   # serializa a quienes disputan el mismo puesto
    reserva = repo.obtener_reserva_activa_de_expediente(exp.id, bloquear=True)
    if reserva is None or reserva.estado != ACTIVA or reserva.expediente_id != exp.id or reserva.puesto_id != previa.puesto_id:
        raise _no_disponible("la reserva cambió o se liberó mientras tanto.")
    if not reserva.vigente(ahora):
        raise _no_disponible("la reserva del puesto venció.")
    if puesto is None:
        raise _no_disponible("el puesto ya no existe.")
    if not puesto.vacante:
        raise _no_disponible(f"el puesto {puesto.codigo} ya fue ocupado.")
    return reserva, puesto


def promover_postulante(
    repo: RepoPostulacion, config: LectorConfiguracion, puestos: PuestosVacantes, promotor: PromotorEmpleado,
    notificador: Notificador | None, *, expediente_id: str, actor: Actor, usuario_id: int | None,
    ahora: datetime | None = None,
) -> ResultadoContratacion:
    ahora = ahora or ahora_utc()
    capturado: dict = {}

    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        externos = HechosExternos()
        if exp.estado == E.LISTO_PARA_ASIGNAR:
            reserva, puesto = revalidar_puesto(repo, puestos, exp, ahora)
            capturado.update(reserva=reserva, puesto=puesto)
            externos = HechosExternos(
                puesto_reservado=True, puesto_revalidado=True, reserva_vence_el=reserva.vence_el,
            )
        # En cualquier otro estado la máquina rechaza la transición (final, no permitida, sin permiso) antes del hook.

        def promover(actual: ExpedientePostulacion, nuevo: ExpedientePostulacion) -> dict:
            postulante = repo.obtener_postulante(actual.postulante_id)
            if postulante is None:
                raise NotFoundError("El postulante del expediente no existe.")
            resultado = promotor.promover(SolicitudPromocion(
                expediente_id=actual.id, numero=actual.numero, cedula=postulante.cedula, nombres=postulante.nombres,
                apellidos=postulante.apellidos, correo=postulante.correo, telefono_movil=postulante.telefono_movil,
                puesto_id=capturado['reserva'].puesto_id, datos_ventana1=actual.datos_ventana1,
                datos_ventana2=actual.datos_ventana2, foto_clave=actual.foto_clave, usuario_id=usuario_id,
                ahora=ahora, hoy=ahora.date(),
            ))
            capturado['promocion'] = resultado
            capturado['reserva'] = repo.guardar_reserva(replace(
                capturado['reserva'], estado=CONSUMIDA, cerrada_el=ahora, motivo_liberacion=MOTIVO_CONTRATACION,
            ))
            # `employee_cedula` significa «empleado PREVIO» (reingreso, C-1): una contratación nueva no lo llena (si no, el
            # expediente se mostraría como reingreso). La trazabilidad de un ingreso nuevo es `Employee.origen_expediente`.
            if resultado.es_reingreso and not postulante.employee_cedula:
                repo.vincular_empleado(postulante.id, postulante.cedula)
            return {
                'puesto_id': capturado['reserva'].puesto_id, 'puesto_codigo': resultado.puesto_codigo,
                'employee_id': resultado.employee_id, 'reingreso': resultado.es_reingreso,
                'cuenta_creada': resultado.cuenta.creada, 'cuenta_motivo': resultado.cuenta.motivo,
                'contratado_el': ahora.date().isoformat(), 'familiares': resultado.familiares_copiados,
                'ficha': resultado.ficha_copiada,
            }

        guardado, asiento = aplicar_transicion_expediente(
            repo, config, expediente_id=exp.id, destino=E.CONTRATADO, actor=actor, externos=externos,
            antes_de_guardar=promover, datos_extra={'origen': 'asignacion'}, ahora=ahora, notificador=notificador,
        )
    return ResultadoContratacion(
        expediente=guardado, asiento=asiento, promocion=capturado['promocion'], reserva=capturado['reserva'],
        puesto=capturado['puesto'],
    )
