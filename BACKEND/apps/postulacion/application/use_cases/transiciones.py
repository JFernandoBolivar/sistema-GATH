"""
Aplicar una transición al expediente (D-2). Sin Django.

Todo ocurre en UNA transacción con el expediente bloqueado (`select_for_update`): se valida la transición
(legal, autorizada, con sus guardas), se guarda el nuevo estado y se registra el asiento inmutable.

Credencial (D-3): en la misma transacción se alinea la credencial del postulante con el nuevo estado.

Psicofísico (D-8): si quien invoca no declara el hecho, se lee del resultado registrado del expediente.
Reserva y constancia (E-2, E-3): igual; la guarda «puesto reservado y disponibilidad declarada» lee la reserva ACTIVA
y vigente y la constancia reales del expediente.

Notificaciones (D-9): con `notificador`, los avisos del §5.6 salen DESPUÉS del commit (ver `avisos.py`). Sin él
(tareas programadas, pruebas), no se avisa.
"""
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Callable

from apps.postulacion.application.use_cases._comun import (
    ahora_utc,
    leer_psicofisico_obligatorio,
    leer_vigencias,
    obtener_expediente,
)
from apps.postulacion.application.use_cases.avisos import programar_avisos
from apps.postulacion.domain.entities.expediente import CAMPOS_PROPUESTA, ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import TransicionRegistrada
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.credencial import credencial_tras_transicion
from apps.postulacion.domain.services.efectos import aplicar_transicion
from apps.postulacion.domain.services.maquina_estados import (
    Actor,
    Guarda,
    Hechos,
    buscar_transicion,
    validar_transicion,
)
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import ValidationError
from core.domain.ports import LectorConfiguracion, Notificador


@dataclass(frozen=True)
class HechosExternos:
    """Hechos que viven en tablas de otras tareas (D-8, E-2, E-3); quien invoca los resuelve. Por defecto, no cumplidos."""

    psicofisico_registrado: bool = False
    disponibilidad_declarada: bool = False
    puesto_reservado: bool = False
    puesto_revalidado: bool = False


def aplicar_transicion_expediente(
    repo: RepoPostulacion, config: LectorConfiguracion, *, expediente_id: str,
    destino: EstadoExpediente | str, actor: Actor, motivo: str = '',
    externos: HechosExternos | None = None, propuesta: dict | None = None, datos_extra: dict | None = None,
    ahora: datetime | None = None, notificador: Notificador | None = None,
    antes_de_guardar: Callable[[ExpedientePostulacion, ExpedientePostulacion], dict | None] | None = None,
) -> tuple[ExpedientePostulacion, TransicionRegistrada | None]:
    """
    Devuelve `(expediente, asiento)`; `asiento` es None en las autotransiciones (guardar borrador), que no
    dejan historial. `propuesta` permite fijar cargo/oficina/observaciones, solo al pasar a EN_PRESUPUESTO.

    `antes_de_guardar(actual, nuevo)` se ejecuta DENTRO de la transacción, con la transición ya validada y antes de
    guardar el expediente (p. ej. emitir el Punto de Cuenta al pasar a Dirección General); su `dict` se suma a
    `datos_extra` del asiento. Si lanza, todo se revierte.
    """
    try:
        destino = EstadoExpediente(destino)
    except ValueError as e:
        raise ValidationError(f"El estado de destino «{destino}» no existe.", campo='estado') from e
    ahora = ahora or ahora_utc()
    externos = externos or HechosExternos()
    vigencias = leer_vigencias(config)
    psicofisico_obligatorio = leer_psicofisico_obligatorio(config)
    motivo = (motivo or '').strip()

    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        origen = exp.estado
        if propuesta:
            if destino != EstadoExpediente.EN_PRESUPUESTO:
                raise ValidationError("La propuesta de cargo y oficina solo se modifica al enviar a Presupuesto.")
            desconocidos = set(propuesta) - set(CAMPOS_PROPUESTA)
            if desconocidos:
                raise ValidationError(f"Campos de propuesta no válidos: {sorted(desconocidos)}.")
            exp = replace(exp, **propuesta)
        previa = buscar_transicion(origen, destino)
        guardas = set(previa.guardas) if previa is not None else set()
        # Solo se consultan la reserva y la constancia cuando la transición las exige (guarda de Presupuesto).
        exige_presupuesto = Guarda.PUESTO_RESERVADO_Y_DISPONIBLE in guardas
        reservado = externos.puesto_reservado
        if not reservado and exige_presupuesto:
            reserva = repo.obtener_reserva_activa_de_expediente(exp.id)
            reservado = reserva is not None and reserva.vigente(ahora)
        declarada = externos.disponibilidad_declarada or (
            exige_presupuesto and repo.obtener_constancia(exp.id) is not None
        )
        hechos = Hechos(
            ahora=ahora, ventana_vence_el=exp.ventana_vence_el, reserva_vence_el=exp.reserva_vence_el,
            diferido_vence_el=exp.diferido_vence_el,
            cargo_definido=exp.cargo_definido, oficina_definida=exp.oficina_definida,
            psicofisico_obligatorio=psicofisico_obligatorio,
            psicofisico_registrado=externos.psicofisico_registrado or repo.obtener_psicofisico(exp.id) is not None,
            disponibilidad_declarada=declarada,
            puesto_reservado=reservado, puesto_revalidado=externos.puesto_revalidado,
        )
        transicion = validar_transicion(origen, destino, actor, hechos, motivo)
        nuevo = aplicar_transicion(exp, transicion, ahora, vigencias)
        if antes_de_guardar is not None:
            datos_extra = {**(datos_extra or {}), **(antes_de_guardar(exp, nuevo) or {})}
        guardado = repo.guardar_expediente(nuevo)
        if not transicion.es_autotransicion:
            # La credencial sigue al expediente: reabrir una ventana la extiende; pasar a revisión la suspende y
            # cierra las sesiones abiertas; un estado final la revoca (D-3).
            credencial = repo.obtener_credencial_de_expediente(guardado.id, bloquear=True)
            if credencial is not None:
                actualizada = credencial_tras_transicion(credencial, origen, guardado)
                if actualizada != credencial:
                    repo.guardar_credencial(actualizada)
        if not transicion.registra_historial:
            return guardado, None
        asiento = repo.registrar_transicion(TransicionRegistrada(
            id='', expediente_id=guardado.id, estado_origen=origen.value, estado_destino=destino.value,
            actor_cedula=actor.cedula, actor_tipo=actor.tipo, fecha=ahora, motivo=motivo,
            datos_extra=dict(datos_extra or {}),
        ))
        postulante = repo.obtener_postulante(guardado.postulante_id) if notificador is not None else None
        if postulante is not None:
            programar_avisos(
                repo, notificador, exp=guardado, postulante=postulante, origen=origen, destino=destino, actor=actor,
                asiento_id=asiento.id, motivo=motivo,
            )
    return guardado, asiento
