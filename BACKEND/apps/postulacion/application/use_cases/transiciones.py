"""
Aplicar una transición al expediente (D-2). Sin Django.

Todo ocurre en UNA transacción con el expediente bloqueado (`select_for_update`): se valida la transición
(legal, autorizada, con sus guardas), se guarda el nuevo estado y se registra el asiento inmutable.

Notificaciones (D-9, NO se emiten aún). Tras confirmar la transacción, aquí mismo se llamarán:
  - `core.infrastructure.providers.obtener_notificador().notificar(...)` con el tipo de §5.6 del destino
    (p. ej. ENVIADO_CAPTACION -> EXPEDIENTE_RECIBIDO, EN_PRESUPUESTO -> EXPEDIENTE_EN_PRESUPUESTO), y
  - `obtener_notificador().resolver_avisos(ref_tipo='expediente', ref_id=expediente.id, por_cedula=actor.cedula,
    tipo=<aviso que el origen dejó pendiente>)` para cerrar los avisos de bandeja compartida que esta acción atiende.
La application no importa infraestructura: D-9 inyectará un puerto o lo invocará la presentación.
"""
from dataclasses import dataclass, replace
from datetime import datetime

from apps.postulacion.application.use_cases._comun import (
    ahora_utc,
    leer_psicofisico_obligatorio,
    leer_vigencias,
    obtener_expediente,
)
from apps.postulacion.domain.entities.expediente import CAMPOS_PROPUESTA, ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import TransicionRegistrada
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.efectos import aplicar_transicion
from apps.postulacion.domain.services.maquina_estados import Actor, Hechos, validar_transicion
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import ValidationError
from core.domain.ports import LectorConfiguracion


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
    ahora: datetime | None = None,
) -> tuple[ExpedientePostulacion, TransicionRegistrada | None]:
    """
    Devuelve `(expediente, asiento)`; `asiento` es None en las autotransiciones (guardar borrador), que no
    dejan historial. `propuesta` permite fijar cargo/oficina/observaciones, solo al pasar a EN_PRESUPUESTO.
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
        hechos = Hechos(
            ahora=ahora, ventana_vence_el=exp.ventana_vence_el, reserva_vence_el=exp.reserva_vence_el,
            diferido_vence_el=exp.diferido_vence_el,
            cargo_definido=exp.cargo_definido, oficina_definida=exp.oficina_definida,
            psicofisico_obligatorio=psicofisico_obligatorio,
            psicofisico_registrado=externos.psicofisico_registrado,
            disponibilidad_declarada=externos.disponibilidad_declarada,
            puesto_reservado=externos.puesto_reservado, puesto_revalidado=externos.puesto_revalidado,
        )
        transicion = validar_transicion(origen, destino, actor, hechos, motivo)
        nuevo = aplicar_transicion(exp, transicion, ahora, vigencias)
        guardado = repo.guardar_expediente(nuevo)
        if not transicion.registra_historial:
            return guardado, None
        asiento = repo.registrar_transicion(TransicionRegistrada(
            id='', expediente_id=guardado.id, estado_origen=origen.value, estado_destino=destino.value,
            actor_cedula=actor.cedula, actor_tipo=actor.tipo, fecha=ahora, motivo=motivo,
            datos_extra=dict(datos_extra or {}),
        ))
    return guardado, asiento
