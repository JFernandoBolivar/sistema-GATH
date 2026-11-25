"""
Avisos del flujo de Captación (D-9, catálogo §5.6). Sin Django.

Todo aviso se programa con `repo.al_confirmar`: sale DESPUÉS del commit y jamás si la transacción se revierte. Un
fallo al avisar no deshace la transición: queda en el log (el expediente ya cambió de estado).

Qué se emite (el postulante no recibe campana: no tiene cuenta):
  - ENVIADO_CAPTACION (postulante envía Ventana 1 o su corrección)  -> EXPEDIENTE_RECIBIDO a `postulacion.ver_bandeja`.
  - EN_REVISION_FINAL (postulante envía Ventana 2)                  -> EXPEDIENTE_REVISION_FINAL a `postulacion.ver_bandeja`.
  - EN_PRESUPUESTO (Captación abre o reabre hacia Presupuesto)       -> EXPEDIENTE_EN_PRESUPUESTO a `postulacion.ver_solicitudes`.
  - EN_DIRECCION_GENERAL (Presupuesto emite el Punto de Cuenta)     -> EXPEDIENTE_EN_DIRECCION a `postulacion.ver_ingresos`.
  - EN_CORRECCION_CARGO (Presupuesto devuelve por cargo u oficina)  -> EXPEDIENTE_CORRECCION_CARGO a `postulacion.ver_bandeja`.
  - APROBADO (Dirección General aprueba)                            -> INGRESO_APROBADO a `postulacion.ver_bandeja`: Captación
    reabre la Ventana 2.
  - CONSOLIDANDO (Captación reabre la Ventana 2, o la reabre por faltantes) -> CONTACTAR_POSTULANTE a `postulacion.ver_bandeja`
    (tarea crítica: el postulante no tiene cuenta, hay que llamarlo). Reabrir resuelve INGRESO_APROBADO / EXPEDIENTE_REVISION_FINAL;
    marcarlo contactado (endpoint `contactado`) o que el postulante envíe resuelve CONTACTAR_POSTULANTE.
  - CONTRATADO (promoción atómica)                                  -> CONTRATACION_COMPLETADA a `postulacion.ver_bandeja` y, si hay foto,
    CARNET_PENDIENTE a `carnetizacion.emitir` y, si la cuenta no se creó por falta de correo institucional,
    CORREO_INSTITUCIONAL_PENDIENTE a `personal.editar_personales` (módulo personal, ref `empleado`/cédula; lo resuelve
    `identidad` al crearse la cuenta); se cierran todos los avisos pendientes del expediente.
  - EXPIRADO desde CONSOLIDANDO (venció la Ventana 2 del postulante) -> EXPEDIENTE_EXPIRADO a `postulacion.ver_bandeja`
    (el puesto reservado vuelve a quedar libre).
  - Un usuario actúa sobre un expediente que esperaba su acción     -> `resolver_avisos`: el aviso compartido deja de estar
    pendiente para todos los que tienen el permiso (ENVIADO_CAPTACION, EN_REVISION_FINAL, EN_PRESUPUESTO,
    EN_DIRECCION_GENERAL, EN_CORRECCION_CARGO y APROBADO).

Correo al postulante (no tiene cuenta, por eso no usa campana): puerto `Notificador.enviar_correo_directo` (kernel), que
escribe en el outbox de `apps.notificaciones` (asíncrono, con reintentos y deduplicado por asiento). Solo si el postulante
tiene correo, y siempre tras el commit:
  - ENVIADO_CAPTACION -> EN_CORRECCION_DATOS (devolución con observaciones): «Tu postulación necesita correcciones».
  - APROBADO -> CONSOLIDANDO (reapertura de la Ventana 2): «¡Tu ingreso fue aprobado! Completa tus datos».
  - EN_REVISION_FINAL -> CONSOLIDANDO (faltantes): «Tu expediente necesita completar datos», con el motivo y el plazo.
  - ENVIADO_CAPTACION -> RECHAZADO_CAPTACION: aviso cordial, sin el motivo interno ni más detalle.
Nunca se envía la contraseña ni la cédula: el correo solo remite al portal y recuerda que entra con la suya.
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import ACTOR_POSTULANTE, ACTOR_USUARIO, EstadoExpediente
from core.domain.notificaciones import SolicitudCorreoDirecto, SolicitudNotificacion
from core.domain.ports import Notificador

logger = logging.getLogger('gath.postulacion')

E = EstadoExpediente
MODULO = 'postulacion'
REF_TIPO = 'expediente_postulacion'
PERMISO_BANDEJA = 'postulacion.ver_bandeja'
PERMISO_SOLICITUDES = 'postulacion.ver_solicitudes'
PERMISO_INGRESOS = 'postulacion.ver_ingresos'
ENLACE_BANDEJA = '/captacion/expedientes/{id}'
ENLACE_SOLICITUD = '/presupuesto/solicitudes/{id}'
ENLACE_INGRESO = '/direccion/ingresos/{id}'
ENLACE_PORTAL_POSTULANTE = '/postulacion/acceso'  # el enlace del correo: el envío le antepone FRONTEND_URL
ZONA_VENEZUELA = ZoneInfo('America/Caracas')

TIPO_RECIBIDO = 'EXPEDIENTE_RECIBIDO'
TIPO_REVISION_FINAL = 'EXPEDIENTE_REVISION_FINAL'
TIPO_EN_PRESUPUESTO = 'EXPEDIENTE_EN_PRESUPUESTO'
TIPO_EN_DIRECCION = 'EXPEDIENTE_EN_DIRECCION'
TIPO_CORRECCION_CARGO = 'EXPEDIENTE_CORRECCION_CARGO'
TIPO_INGRESO_APROBADO = 'INGRESO_APROBADO'
TIPO_CONTACTAR_POSTULANTE = 'CONTACTAR_POSTULANTE'
TIPO_CONTACTO_ATRASADO = 'CONTACTO_ATRASADO'
TIPO_EXPIRADO = 'EXPEDIENTE_EXPIRADO'
TIPO_CONTRATACION_COMPLETADA = 'CONTRATACION_COMPLETADA'
TIPO_CARNET_PENDIENTE = 'CARNET_PENDIENTE'
PERMISO_EMITIR_CARNET = 'carnetizacion.emitir'
ENLACE_FICHA_TRABAJADOR = '/personal/consultar'
TIPO_CORREO_INSTITUCIONAL_PENDIENTE = 'CORREO_INSTITUCIONAL_PENDIENTE'
MODULO_PERSONAL = 'personal'
REF_TIPO_EMPLEADO = 'empleado'
# Quien puede editar la ficha del trabajador (PUT/PATCH de Gestión de Trabajadores, donde se carga el correo).
PERMISO_EDITAR_FICHA = 'personal.editar_personales'
ENLACE_FICHA_CEDULA = '/personal/consultar?cedula={cedula}'
MOTIVOS_SIN_CORREO_INSTITUCIONAL = ('sin_correo_institucional', 'sin_correo')
TIPO_CORREO_CORRECCION = 'POSTULACION_CORRECCION'
TIPO_CORREO_VENTANA2 = 'POSTULACION_VENTANA2'
TIPO_CORREO_FALTANTES = 'POSTULACION_FALTANTES'
TIPO_CORREO_RECHAZO = 'POSTULACION_RECHAZO'
TIPO_CORREO_ACTIVACION = 'POSTULACION_ACTIVACION'
RUTA_ACTIVACION = '/postulacion/activar'

# Estado que un área atiende -> tipo de aviso compartido que esa acción cierra.
_AVISO_PENDIENTE_DE: dict[EstadoExpediente, str] = {
    E.ENVIADO_CAPTACION: TIPO_RECIBIDO,
    E.EN_REVISION_FINAL: TIPO_REVISION_FINAL,
    E.EN_PRESUPUESTO: TIPO_EN_PRESUPUESTO,
    E.EN_DIRECCION_GENERAL: TIPO_EN_DIRECCION,
    E.EN_CORRECCION_CARGO: TIPO_CORRECCION_CARGO,
    E.APROBADO: TIPO_INGRESO_APROBADO,
}


def tipos_a_resolver(origen: EstadoExpediente, destino: EstadoExpediente, actor: Actor) -> list[str]:
    """Avisos compartidos que este paso deja atendidos (quien actúa con cédula los cierra para todos)."""
    if not actor.cedula or actor.tipo not in (ACTOR_USUARIO, ACTOR_POSTULANTE):
        return []
    if actor.tipo == ACTOR_POSTULANTE:
        # El postulante envía su Ventana 2: ya no hay a quién contactar (ni escalar).
        return [TIPO_CONTACTAR_POSTULANTE, TIPO_CONTACTO_ATRASADO] if destino == E.EN_REVISION_FINAL else []
    if destino == E.CONTRATADO:
        return [TIPO_CONTACTAR_POSTULANTE, TIPO_CONTACTO_ATRASADO, TIPO_REVISION_FINAL, TIPO_INGRESO_APROBADO]
    tipo = _AVISO_PENDIENTE_DE.get(origen)
    return [tipo] if tipo else []


def _quien(p: Postulante, exp: ExpedientePostulacion) -> str:
    return f'{p.nombres} {p.apellidos} ({exp.numero})'.strip()


def solicitudes_de_transicion(
    exp: ExpedientePostulacion, postulante: Postulante, origen: EstadoExpediente, destino: EstadoExpediente,
    actor: Actor, asiento_id: str, motivo: str = '', datos_extra: dict | None = None,
) -> list[SolicitudNotificacion]:
    """Avisos de campana de este paso. `clave` = id del asiento: un reenvío tras corregir genera un aviso nuevo."""
    quien = _quien(postulante, exp)
    comunes = {'ref_tipo': REF_TIPO, 'ref_id': exp.id, 'clave': asiento_id, 'modulo': MODULO}
    if destino == E.ENVIADO_CAPTACION and actor.tipo == ACTOR_POSTULANTE:
        reingreso = ' Es un reingreso.' if postulante.es_reingreso else ''
        reenvio = origen == E.EN_CORRECCION_DATOS
        return [SolicitudNotificacion(
            tipo=TIPO_RECIBIDO, permiso_destino=PERMISO_BANDEJA, enlace=ENLACE_BANDEJA.format(id=exp.id), **comunes,
            titulo='Expediente corregido por el postulante' if reenvio else 'Expediente recibido',
            mensaje=f'{quien} {"envió de nuevo sus datos corregidos" if reenvio else "envió su Ventana 1"}.{reingreso}',
        )]
    if destino == E.EN_REVISION_FINAL and actor.tipo == ACTOR_POSTULANTE:
        return [SolicitudNotificacion(
            tipo=TIPO_REVISION_FINAL, permiso_destino=PERMISO_BANDEJA, enlace=ENLACE_BANDEJA.format(id=exp.id),
            titulo='Ventana 2 recibida', mensaje=f'{quien} envió su Ventana 2: pasa a revisión final.', **comunes,
        )]
    if destino == E.EN_PRESUPUESTO and origen != E.DIFERIDO_PRESUPUESTO:  # retomar un diferido lo hace Presupuesto mismo
        if not exp.requiere_presupuesto:
            return []
        if actor.tipo == ACTOR_USUARIO:
            mensaje = f'Captación abrió el expediente de {quien} hacia Presupuesto: revise la solicitud de personal.'
        else:
            mensaje = f'El puesto reservado para {quien} se perdió: el expediente volvió a Presupuesto para reservar otro.'
        return [SolicitudNotificacion(
            tipo=TIPO_EN_PRESUPUESTO, permiso_destino=PERMISO_SOLICITUDES, enlace=ENLACE_SOLICITUD.format(id=exp.id),
            titulo='Expediente en Presupuesto', mensaje=mensaje, **comunes,
        )]
    if destino == E.EN_DIRECCION_GENERAL:
        if not exp.requiere_direccion_general:
            return []
        emisor = 'Captación generó' if not exp.requiere_presupuesto else 'Presupuesto emitió'
        return [SolicitudNotificacion(
            tipo=TIPO_EN_DIRECCION, permiso_destino=PERMISO_INGRESOS, enlace=ENLACE_INGRESO.format(id=exp.id),
            titulo='Punto de Cuenta para decisión',
            mensaje=f'{emisor} el Punto de Cuenta del ingreso de {quien}: pendiente de su decisión.',
            **comunes,
        )]
    if destino == E.EN_CORRECCION_CARGO:
        detalle = f' Motivo: {motivo.strip()}' if (motivo or '').strip() else ''
        return [SolicitudNotificacion(
            tipo=TIPO_CORRECCION_CARGO, permiso_destino=PERMISO_BANDEJA, enlace=ENLACE_BANDEJA.format(id=exp.id),
            titulo='Corregir cargo u oficina',
            mensaje=f'Presupuesto devolvió el expediente de {quien} para corregir el cargo o la oficina.{detalle}',
            **comunes,
        )]
    if destino == E.CONSOLIDANDO and origen != E.CONSOLIDANDO and actor.tipo == ACTOR_USUARIO:
        if origen == E.EN_REVISION_FINAL:
            detalle = f' Faltante: {motivo.strip()}' if (motivo or '').strip() else ''
            titulo, mensaje = 'Contactar al postulante: faltan datos', (
                f'Captación observó la Ventana 2 de {quien}: hay que contactarlo para que complete lo que falta.{detalle}'
            )
        else:
            titulo, mensaje = 'Contactar al postulante', (
                f'Se reabrió la Ventana 2 de {quien}: contáctelo y entréguele su nueva contraseña temporal para que complete sus datos.'
            )
        return [SolicitudNotificacion(
            tipo=TIPO_CONTACTAR_POSTULANTE, permiso_destino=PERMISO_BANDEJA, enlace=ENLACE_BANDEJA.format(id=exp.id),
            titulo=titulo, mensaje=mensaje, **comunes,
        )]
    if destino == E.EXPIRADO and origen == E.CONSOLIDANDO:
        liberada = bool((datos_extra or {}).get('reserva_liberada'))
        return [SolicitudNotificacion(
            tipo=TIPO_EXPIRADO, permiso_destino=PERMISO_BANDEJA, enlace=ENLACE_BANDEJA.format(id=exp.id),
            titulo='Ventana 2 vencida',
            mensaje=(
                f'Venció el plazo de {quien} para completar la Ventana 2: el expediente expiró'
                + (' y la reserva del puesto quedó libre.' if liberada else '.')
            ),
            **comunes,
        )]
    if destino == E.CONTRATADO:
        avisos = [SolicitudNotificacion(
            tipo=TIPO_CONTRATACION_COMPLETADA, permiso_destino=PERMISO_BANDEJA, enlace=ENLACE_FICHA_TRABAJADOR,
            titulo='Contratación completada',
            mensaje=f'{quien} ya es trabajador de CONATEL: se le asignó el cargo y se creó su ficha.', **comunes,
        )]
        if exp.tiene_foto:
            avisos.append(SolicitudNotificacion(
                tipo=TIPO_CARNET_PENDIENTE, permiso_destino=PERMISO_EMITIR_CARNET, enlace='/carnetizacion',
                titulo='Carnet pendiente', mensaje=f'{quien} ya tiene foto cargada y aún no tiene carnet: emítalo.',
                **comunes,
            ))
        extra = datos_extra or {}
        if extra.get('cuenta_motivo') in MOTIVOS_SIN_CORREO_INSTITUCIONAL:
            avisos.append(_aviso_correo_institucional(postulante, exp, extra, asiento_id))
        return avisos
    if destino == E.APROBADO:
        if not exp.requiere_direccion_general:
            return []
        return [SolicitudNotificacion(
            tipo=TIPO_INGRESO_APROBADO, permiso_destino=PERMISO_BANDEJA, enlace=ENLACE_BANDEJA.format(id=exp.id),
            titulo='Ingreso aprobado',
            mensaje=f'Dirección General aprobó el ingreso de {quien}: reabra la Ventana 2 para que complete sus datos.',
            **comunes,
        )]
    return []


def _aviso_correo_institucional(postulante: Postulante, exp: ExpedientePostulacion, extra: dict, asiento_id: str):
    nombre = f'{postulante.nombres} {postulante.apellidos}'.strip()
    try:
        fecha = datetime.fromisoformat(str(extra.get('contratado_el'))).strftime('%d/%m/%Y')
    except (TypeError, ValueError):
        fecha = 'la fecha de hoy'
    puesto = extra.get('puesto_codigo') or ''
    en_puesto = f' en el puesto {puesto}' if puesto else ''
    personal = (
        f' Dejó el correo personal {postulante.correo.strip()} como dato de contacto.'
        if (postulante.correo or '').strip() else ''
    )
    return SolicitudNotificacion(
        tipo=TIPO_CORREO_INSTITUCIONAL_PENDIENTE, permiso_destino=PERMISO_EDITAR_FICHA, modulo=MODULO_PERSONAL,
        ref_tipo=REF_TIPO_EMPLEADO, ref_id=str(postulante.cedula), clave=asiento_id,
        enlace=ENLACE_FICHA_CEDULA.format(cedula=postulante.cedula),
        titulo='Correo institucional por gestionar',
        mensaje=(
            f'La contratación de {nombre} se completó el {fecha}{en_puesto}. Solicite a Tecnología la creación de su '
            f'correo institucional y cárguelo en su ficha: al guardarlo se crea su cuenta de acceso.{personal}'
        ),
    )


def _fecha_plazo(vence: datetime | None) -> str:
    if vence is None:
        return ''
    return vence.astimezone(ZONA_VENEZUELA).strftime('%d/%m/%Y a las %H:%M (hora de Venezuela)')


def correo_al_postulante(
    exp: ExpedientePostulacion, postulante: Postulante, origen: EstadoExpediente, destino: EstadoExpediente,
    actor: Actor, asiento_id: str, motivo: str = '', datos_extra: dict | None = None,
) -> SolicitudCorreoDirecto | None:
    """Correo que el postulante recibe en este paso, o None (sin correo, o paso que no lo avisa). Sin datos sensibles."""
    if not (postulante.correo or '').strip() or actor.tipo != ACTOR_USUARIO:
        return None
    base = {
        'destinatario_correo': postulante.correo, 'ref_tipo': REF_TIPO, 'ref_id': exp.id, 'clave': asiento_id,
        'enlace': ENLACE_PORTAL_POSTULANTE,
    }
    plazo = _fecha_plazo(exp.ventana_vence_el)
    if origen == E.ENVIADO_CAPTACION and destino == E.EN_CORRECCION_DATOS:
        asunto = 'Tu postulación necesita correcciones'
        cuando = (
            f'Tienes hasta el {plazo} para enviarla de nuevo: es el plazo de la ventana que reabrimos para ti.'
            if plazo else 'El plazo para enviarla de nuevo es el de la ventana que reabrimos para ti; lo verás al ingresar.'
        )
        return SolicitudCorreoDirecto(
            tipo=TIPO_CORREO_CORRECCION, asunto=asunto, titulo=asunto, mensaje=(
                f'Revisamos tu postulación N.º {exp.numero} y necesitamos que corrijas algunos datos para poder continuar.\n'
                f'Lo que debes corregir: {motivo.strip()}\n'
                'Ingresa al portal con tu cédula y la contraseña que creaste, corrige lo indicado y envía tu postulación otra vez.\n'
                f'{cuando}'
            ), **base,
        )
    if origen == E.APROBADO and destino == E.CONSOLIDANDO:
        asunto = '¡Tu ingreso fue aprobado! Completa tus datos'
        cuando = (
            f'Tienes hasta el {plazo} para completarlos y enviarlos.'
            if plazo else 'Completa y envía tus datos dentro del plazo que verás al ingresar al portal.'
        )
        return SolicitudCorreoDirecto(
            tipo=TIPO_CORREO_VENTANA2, asunto=asunto, titulo=asunto, mensaje=(
                f'¡Felicitaciones! Tu ingreso a CONATEL (postulación N.º {exp.numero}) fue aprobado.\n'
                'Para continuar con el proceso, ingresa al portal con tu cédula y la contraseña que creaste, y completa tus datos.\n'
                f'{cuando}'
            ), **base,
        )
    if origen == E.EN_REVISION_FINAL and destino == E.CONSOLIDANDO:
        asunto = 'Tu expediente necesita completar datos'
        cuando = (
            f'Tienes hasta el {plazo} para completarlos y enviarlos de nuevo.'
            if plazo else 'Completa y envía tus datos dentro del plazo que verás al ingresar al portal.'
        )
        if (datos_extra or {}).get('entrega') == 'correo':
            acceso = (
                'Te enviamos en otro correo un enlace para crear tu nueva contraseña. '
                'Con ella ingresa al portal con tu cédula, completa lo indicado y envía tus datos otra vez.\n'
            )
        else:
            acceso = (
                'Captación se comunicará contigo para entregarte tu nueva contraseña temporal. '
                'Con ella ingresa al portal con tu cédula, completa lo indicado y envía tus datos otra vez.\n'
            )
        return SolicitudCorreoDirecto(
            tipo=TIPO_CORREO_FALTANTES, asunto=asunto, titulo=asunto, mensaje=(
                f'Revisamos tu expediente N.º {exp.numero} y necesitamos que completes algunos datos para poder continuar.\n'
                f'Lo que falta: {motivo.strip()}\n'
                f'{acceso}'
                f'{cuando}'
            ), **base,
        )
    if origen == E.ENVIADO_CAPTACION and destino == E.RECHAZADO_CAPTACION:
        asunto = 'Sobre tu postulación a CONATEL'
        base.pop('enlace')
        return SolicitudCorreoDirecto(
            tipo=TIPO_CORREO_RECHAZO, asunto=asunto, titulo=asunto, mensaje=(
                f'Gracias por tu interés en formar parte de CONATEL. Revisamos tu postulación N.º {exp.numero} y, '
                'en esta oportunidad, no podemos continuar con ella.\n'
                'Te agradecemos el tiempo dedicado y te deseamos éxito en tus próximos proyectos.'
            ), **base,
        )
    return None


def correo_enlace_activacion(
    exp: ExpedientePostulacion, postulante: Postulante, token: str, vence_el: datetime, enlace_id: str,
) -> SolicitudCorreoDirecto:
    """
    Invitación a crear la contraseña (D-10). Lleva el enlace con el token (el envío le antepone FRONTEND_URL) y NUNCA una
    contraseña ni la cédula. `clave` = id del enlace: cada reenvío es un hecho nuevo y se envía.
    """
    asunto = 'Crea tu contraseña para tu postulación en CONATEL'
    return SolicitudCorreoDirecto(
        tipo=TIPO_CORREO_ACTIVACION, destinatario_correo=postulante.correo, asunto=asunto, titulo=asunto, mensaje=(
            f'Captación de CONATEL te invitó a completar tu postulación N.º {exp.numero}. '
            'Crea tu contraseña con el enlace que aparece abajo; te pediremos tu cédula para confirmar que eres tú.\n'
            f'El enlace sirve una sola vez y vence el {_fecha_plazo(vence_el)}.\n'
            'Si no solicitaste esto, ignora este mensaje.'
        ),
        enlace=f'{RUTA_ACTIVACION}?t={token}', ref_tipo=REF_TIPO, ref_id=exp.id, clave=enlace_id,
        texto_boton='Crear mi contraseña', enlace_sensible=True,
    )


def programar_avisos(
    repo: RepoPostulacion, notificador: Notificador | None, *, exp: ExpedientePostulacion, postulante: Postulante,
    origen: EstadoExpediente, destino: EstadoExpediente, actor: Actor, asiento_id: str, motivo: str = '',
    datos_extra: dict | None = None,
) -> None:
    """Llamar dentro de la transacción de la transición: los avisos salen al confirmarla."""
    if notificador is None:
        return
    solicitudes = solicitudes_de_transicion(exp, postulante, origen, destino, actor, asiento_id, motivo, datos_extra)
    resolver = tipos_a_resolver(origen, destino, actor)
    correo = correo_al_postulante(exp, postulante, origen, destino, actor, asiento_id, motivo, datos_extra)
    if not solicitudes and not resolver and correo is None:
        return

    def emitir() -> None:
        # Primero se cierra el aviso que esta acción atiende y después se emiten los nuevos (no se pisan: distinto tipo).
        for tipo in resolver:
            try:
                notificador.resolver_avisos(REF_TIPO, exp.id, por_cedula=actor.cedula, tipo=tipo)
            except Exception:  # noqa: BLE001 - el aviso nunca deshace la transición
                logger.exception('No se pudo resolver el aviso %s del expediente %s', tipo, exp.numero)
        for s in solicitudes:
            try:
                notificador.notificar(s)
            except Exception:  # noqa: BLE001
                logger.exception('No se pudo notificar %s del expediente %s', s.tipo, exp.numero)
        if correo is not None:
            try:
                notificador.enviar_correo_directo(correo)
            except Exception:  # noqa: BLE001 - el correo nunca deshace la transición
                logger.exception('No se pudo encolar el correo %s del expediente %s', correo.tipo, exp.numero)

    repo.al_confirmar(emitir)
