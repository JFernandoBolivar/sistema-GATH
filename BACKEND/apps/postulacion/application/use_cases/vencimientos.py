"""
Vencimientos que ejecuta el SISTEMA (E-7): tarea periódica `postulacion.liberar_reservas_vencidas`. Sin Django.

  * Reserva ACTIVA con `vence_el` vencido -> VENCIDA. Si el expediente estaba en LISTO_PARA_ASIGNAR, vuelve a
    EN_PRESUPUESTO (transición de sistema «el puesto se perdió»).
  * DIFERIDO_PRESUPUESTO con la espera vencida (C-10) -> DESISTIDO.
  * PRE_REGISTRADO / EN_CAPTURA con la ventana vencida -> EXPIRADO.
  * CONSOLIDANDO con el contacto al postulante pendiente más de `captacion.horas_escalamiento_contacto` horas (48 por defecto)
    -> se ESCALA: aviso CONTACTO_ATRASADO (una sola vez por reapertura: se deduplica por `clave`). No cambia el estado.

Idempotente: cada paso relee el estado bajo bloqueo y no hace nada si ya no corresponde. Un fallo en un expediente se
registra y no detiene a los demás. En el historial queda el actor «sistema» (`actor_tipo=SISTEMA`, sin cédula).
"""
import logging
from dataclasses import dataclass, replace
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, leer_horas_escalamiento_contacto, obtener_expediente
from apps.postulacion.application.use_cases.avisos import (
    ENLACE_BANDEJA,
    MODULO,
    PERMISO_BANDEJA,
    REF_TIPO,
    TIPO_CONTACTO_ATRASADO,
)
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.reserva import MOTIVO_VENCIMIENTO, VENCIDA
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.contacto import limite_de_atraso
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import DomainError
from core.domain.notificaciones import SolicitudNotificacion
from core.domain.ports import LectorConfiguracion, Notificador

logger = logging.getLogger('gath.postulacion')
E = EstadoExpediente

MOTIVO_PUESTO_PERDIDO = 'La reserva del puesto venció: el expediente vuelve a Presupuesto para reservar otro.'
MOTIVO_ESPERA_VENCIDA = 'Venció la espera del expediente diferido por falta de disponibilidad presupuestaria.'
MOTIVO_VENTANA_VENCIDA = 'Venció el plazo de acceso del postulante.'


@dataclass(frozen=True)
class ResumenVencimientos:
    reservas_vencidas: int = 0
    vueltos_a_presupuesto: int = 0
    desistidos: int = 0
    expirados: int = 0
    contactos_escalados: int = 0
    errores: int = 0

    @property
    def total(self) -> int:
        return self.reservas_vencidas + self.vueltos_a_presupuesto + self.desistidos + self.expirados


def _transicion_de_sistema(
    repo: RepoPostulacion, config: LectorConfiguracion, notificador: Notificador | None, expediente_id: str,
    origen: EstadoExpediente, destino: EstadoExpediente, motivo: str, ahora: datetime,
) -> bool:
    """True si aplicó la transición. Si el expediente ya cambió de estado (otra ejecución, un usuario), no hace nada."""
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        if exp.estado != origen:
            return False
        aplicar_transicion_expediente(
            repo, config, expediente_id=expediente_id, destino=destino, actor=Actor.sistema(), motivo=motivo,
            ahora=ahora, notificador=notificador, datos_extra={'origen': 'vencimiento'},
        )
    return True


def procesar_vencimientos(
    repo: RepoPostulacion, config: LectorConfiguracion, notificador: Notificador | None = None, *,
    ahora: datetime | None = None,
) -> ResumenVencimientos:
    ahora = ahora or ahora_utc()
    resumen = ResumenVencimientos()

    def contar(**cambios) -> None:
        nonlocal resumen
        resumen = replace(resumen, **{k: getattr(resumen, k) + v for k, v in cambios.items()})

    for candidata in repo.listar_reservas_vencidas(ahora):
        vencida = vuelta = False
        try:
            with repo.transaccion():
                exp = obtener_expediente(repo, candidata.expediente_id, bloquear=True)
                reserva = repo.obtener_reserva_activa_de_expediente(exp.id, bloquear=True)
                if reserva is None or reserva.id != candidata.id or reserva.vence_el >= ahora:
                    continue   # ya la liberaron o la renovaron mientras tanto
                repo.guardar_reserva(replace(reserva, estado=VENCIDA, cerrada_el=ahora, motivo_liberacion=MOTIVO_VENCIMIENTO))
                vencida = True
                if exp.estado == E.LISTO_PARA_ASIGNAR:
                    aplicar_transicion_expediente(
                        repo, config, expediente_id=exp.id, destino=E.EN_PRESUPUESTO, actor=Actor.sistema(),
                        motivo=MOTIVO_PUESTO_PERDIDO, ahora=ahora, notificador=notificador,
                        datos_extra={'origen': 'vencimiento', 'puesto_id': reserva.puesto_id},
                    )
                    vuelta = True
            contar(reservas_vencidas=int(vencida), vueltos_a_presupuesto=int(vuelta))
        except DomainError:
            logger.exception('No se pudo vencer la reserva %s del expediente %s', candidata.id, candidata.expediente_id)
            contar(errores=1)
        except Exception:  # noqa: BLE001 - un expediente con problemas no detiene al resto
            logger.exception('Error inesperado al vencer la reserva %s', candidata.id)
            contar(errores=1)

    pasos = (
        (repo.listar_ids_con_diferido_vencido(ahora), E.DIFERIDO_PRESUPUESTO, E.DESISTIDO, MOTIVO_ESPERA_VENCIDA, 'desistidos'),
        (repo.listar_ids_con_ventana_vencida(ahora), None, E.EXPIRADO, MOTIVO_VENTANA_VENCIDA, 'expirados'),
    )
    for ids, origen, destino, motivo, contador in pasos:
        for expediente_id in ids:
            try:
                if origen is None:   # PRE_REGISTRADO o EN_CAPTURA: el estado actual es el origen
                    with repo.transaccion():
                        origen_real = obtener_expediente(repo, expediente_id, bloquear=True).estado
                    if origen_real not in (E.PRE_REGISTRADO, E.EN_CAPTURA):
                        continue
                else:
                    origen_real = origen
                if _transicion_de_sistema(repo, config, notificador, expediente_id, origen_real, destino, motivo, ahora):
                    contar(**{contador: 1})
            except DomainError:
                logger.exception('No se pudo pasar el expediente %s a %s', expediente_id, destino.value)
                contar(errores=1)
            except Exception:  # noqa: BLE001
                logger.exception('Error inesperado con el expediente %s', expediente_id)
                contar(errores=1)
    contar(contactos_escalados=escalar_contactos_atrasados(repo, config, notificador, ahora))
    return resumen


def escalar_contactos_atrasados(
    repo: RepoPostulacion, config: LectorConfiguracion, notificador: Notificador | None, ahora: datetime,
) -> int:
    """
    Avisa (CONTACTO_ATRASADO, a `postulacion.ver_bandeja`) de cada expediente cuyo contacto con el postulante lleva más de las
    horas del parámetro sin atenderse. Idempotente: la `clave` es la fecha desde la que está pendiente, así que el mismo
    atraso no se avisa dos veces (una nueva reapertura sí genera un aviso nuevo). Devuelve cuántos avisó.
    """
    if notificador is None:
        return 0
    horas = leer_horas_escalamiento_contacto(config)
    avisados = 0
    for expediente_id in repo.listar_ids_con_contacto_atrasado(limite_de_atraso(ahora, horas)):
        try:
            exp = obtener_expediente(repo, expediente_id)
            postulante = repo.obtener_postulante(exp.postulante_id)
            desde = exp.contacto_pendiente_desde
            if postulante is None or desde is None:
                continue
            transcurridas = int((ahora - desde).total_seconds() // 3600)
            creadas = notificador.notificar(SolicitudNotificacion(
                tipo=TIPO_CONTACTO_ATRASADO, permiso_destino=PERMISO_BANDEJA,
                enlace=ENLACE_BANDEJA.format(id=exp.id), ref_tipo=REF_TIPO, ref_id=exp.id, clave=desde.isoformat(),
                modulo=MODULO, titulo='Contacto con el postulante atrasado',
                mensaje=(
                    f'Hace más de {transcurridas} horas se reabrió la Ventana 2 de {postulante.nombres} {postulante.apellidos} '
                    f'({exp.numero}) y nadie lo ha contactado. Si no se le avisa, el expediente queda detenido.'
                ),
            ))
            avisados += 1 if creadas else 0   # el notificador deduplica: solo cuenta lo que creó
        except Exception:  # noqa: BLE001 - un expediente con problemas no detiene al resto
            logger.exception('No se pudo escalar el contacto del expediente %s', expediente_id)
    return avisados
