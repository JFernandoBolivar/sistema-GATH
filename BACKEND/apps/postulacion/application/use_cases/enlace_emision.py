"""
Emisión del enlace de activación (D-10), sin Django. Pieza baja: la usan el alta, la reapertura de la Ventana 2 y
«enviar enlace» DESPUÉS de dejar la credencial al día, siempre dentro de la transacción del llamador.

El token en claro solo existe aquí y en el cuerpo del correo (que sale tras el commit): ni se persiste, ni se devuelve, ni se audita.
"""
import logging
from dataclasses import dataclass
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc
from apps.postulacion.application.use_cases.avisos import correo_enlace_activacion
from apps.postulacion.domain.entities.enlace_activacion import EnlaceActivacion
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante, TransicionRegistrada
from apps.postulacion.domain.errores import ConflictoConCodigo
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.credencial import ESTADOS_CON_ACCESO
from apps.postulacion.domain.services.enlace_activacion import (
    HORAS_VIGENCIA_DEFECTO,
    enmascarar_correo,
    generar_token,
    hash_de_token,
    vencimiento_del_enlace,
)
from apps.postulacion.domain.value_objects.estados import ACTOR_USUARIO
from core.domain.configuracion import CLAVE_CAPTACION_HORAS_VIGENCIA_ENLACE_ACTIVACION
from core.domain.ports import LectorConfiguracion, Notificador

logger = logging.getLogger('gath.postulacion')

ENTREGA_PERSONA = 'persona'
ENTREGA_CORREO = 'correo'
ENTREGAS = (ENTREGA_PERSONA, ENTREGA_CORREO)
TIPO_HISTORIAL_ENVIADO = 'ENLACE_ACTIVACION_ENVIADO'
TIPO_HISTORIAL_USADO = 'ENLACE_ACTIVACION_USADO'
TIPO_HISTORIAL_REVOCADO = 'ENLACE_ACTIVACION_REVOCADO'


@dataclass(frozen=True)
class EnlaceEmitido:
    """Lo que se puede mostrar de un envío: nunca el token ni el correo completo."""

    enlace: EnlaceActivacion
    enviado_a: str  # correo enmascarado


def leer_horas_vigencia_enlace(config: LectorConfiguracion) -> int:
    try:
        horas = config.obtener_entero(CLAVE_CAPTACION_HORAS_VIGENCIA_ENLACE_ACTIVACION)
    except (KeyError, ValueError, TypeError):
        horas = None
    return min(168, max(1, horas or HORAS_VIGENCIA_DEFECTO))


def exigir_envio_posible(exp: ExpedientePostulacion, postulante: Postulante, ahora: datetime) -> None:
    """409 con código claro: sin ventana abierta o sin correo no hay a dónde mandar el enlace."""
    if exp.estado not in ESTADOS_CON_ACCESO or exp.ventana_vence_el is None or ahora > exp.ventana_vence_el:
        raise ConflictoConCodigo(
            'El postulante no tiene una ventana abierta en este estado: no se puede enviar un enlace de acceso.',
            codigo='SIN_VENTANA_ABIERTA',
        )
    if not (postulante.correo or '').strip():
        raise ConflictoConCodigo(
            'El postulante no tiene correo registrado: entregue el acceso en persona o registre su correo primero.',
            codigo='SIN_CORREO',
        )


def asentar(repo: RepoPostulacion, exp: ExpedientePostulacion, *, actor_cedula: str, actor_tipo: str, fecha: datetime, **extra) -> None:
    """Asiento en el historial SIN cambiar de estado (como el contacto con el postulante)."""
    repo.registrar_transicion(TransicionRegistrada(
        id='', expediente_id=exp.id, estado_origen=exp.estado.value, estado_destino=exp.estado.value,
        actor_cedula=actor_cedula, actor_tipo=actor_tipo, fecha=fecha, datos_extra=dict(extra),
    ))


def crear_y_enviar_enlace(
    repo: RepoPostulacion, notificador: Notificador | None, config: LectorConfiguracion, *,
    exp: ExpedientePostulacion, postulante: Postulante, creado_por: str, ahora: datetime | None = None,
) -> EnlaceEmitido:
    """
    Crea el enlace (anulando los pendientes), lo asienta en el historial y programa el correo para DESPUÉS del commit.
    Debe llamarse dentro de `repo.transaccion()` y con la credencial ya emitida/repuesta.
    """
    ahora = ahora or ahora_utc()
    exigir_envio_posible(exp, postulante, ahora)
    token = generar_token()
    repo.revocar_enlaces_pendientes(exp.id)
    vence = vencimiento_del_enlace(ahora, leer_horas_vigencia_enlace(config), exp.ventana_vence_el)
    enlace = repo.crear_enlace_activacion(EnlaceActivacion(
        id='', expediente_id=exp.id, token_hash=hash_de_token(token), correo_destino=postulante.correo.strip(),
        creado_por=creado_por, creado_el=ahora, vence_el=vence,
    ))
    enmascarado = enmascarar_correo(enlace.correo_destino)
    asentar(
        repo, exp, actor_cedula=creado_por, actor_tipo=ACTOR_USUARIO, fecha=ahora, tipo=TIPO_HISTORIAL_ENVIADO,
        origen='captacion', correo_enmascarado=enmascarado, vence_el=vence.isoformat(),
    )
    if notificador is not None:
        solicitud = correo_enlace_activacion(exp, postulante, token, vence, enlace.id)

        def enviar() -> None:
            try:
                notificador.enviar_correo_directo(solicitud)
            except Exception:  # noqa: BLE001 - el correo nunca deshace el envío; Captación puede reenviar
                logger.exception('No se pudo encolar el enlace de activación del expediente %s', exp.numero)

        repo.al_confirmar(enviar)
    return EnlaceEmitido(enlace, enmascarado)
