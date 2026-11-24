"""
Enlace de activación del postulante (D-10): enviarlo, consultarlo y usarlo para crear la contraseña. Sin Django.

Orden de bloqueos: SIEMPRE el expediente, luego la credencial y luego el enlace (el expediente se descubre con una lectura
sin bloqueo del enlace). Un intento con cédula equivocada se confirma aunque la petición termine en error: el contador se
guarda dentro de la transacción y el error se lanza DESPUÉS de cerrarla (igual que el acceso con contraseña).
"""
import hmac
from dataclasses import replace
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente
from apps.postulacion.application.use_cases.credenciales import AccesoConcedido, emitir_credencial
from apps.postulacion.application.use_cases.enlace_emision import (
    TIPO_HISTORIAL_USADO,
    EnlaceEmitido,
    asentar,
    crear_y_enviar_enlace,
    exigir_envio_posible,
)
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.enlace_activacion import EnlaceActivacion
from apps.postulacion.domain.errores import DatosActivacionIncorrectos, EnlaceBloqueado, EnlaceInvalido
from apps.postulacion.domain.ports.repos import HasheadorClaves, RepoPostulacion
from apps.postulacion.domain.services.credencial import ESTADOS_CON_ACCESO, tras_exito, validar_clave_nueva
from apps.postulacion.domain.services.enlace_activacion import (
    MAX_INTENTOS_CEDULA,
    exigir_utilizable,
    hash_de_token,
    tras_cedula_incorrecta,
)
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import ACTOR_POSTULANTE, EstadoExpediente
from core.domain.exceptions import NotFoundError
from core.domain.ports import LectorConfiguracion, Notificador


def enviar_enlace_activacion(
    repo: RepoPostulacion, hasheador: HasheadorClaves, config: LectorConfiguracion, notificador: Notificador | None, *,
    expediente_id: str, enviado_por: str, ahora: datetime | None = None,
) -> EnlaceEmitido:
    """
    Captación envía (o reenvía) el enlace. Deja la credencial con una contraseña que nadie conoce (la temporal anterior y
    las sesiones abiertas caen), anula el enlace anterior y manda el correo tras el commit. 409 `SIN_VENTANA_ABIERTA` o `SIN_CORREO`.
    """
    ahora = ahora or ahora_utc()
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        postulante = repo.obtener_postulante(exp.postulante_id)
        if postulante is None:
            raise NotFoundError("El postulante del expediente no existe.")
        exigir_envio_posible(exp, postulante, ahora)
        emitir_credencial(repo, hasheador, expediente_id=exp.id, emitida_por=enviado_por, ahora=ahora)  # la clave se descarta
        return crear_y_enviar_enlace(
            repo, notificador, config, exp=exp, postulante=postulante, creado_por=enviado_por, ahora=ahora,
        )


def consultar_enlace(repo: RepoPostulacion, *, token: str, ahora: datetime | None = None) -> tuple[EnlaceActivacion, str]:
    """Valida el enlace SIN consumirlo ni contar intentos. Devuelve (enlace, número de expediente) o un error con código."""
    ahora = ahora or ahora_utc()
    enlace = exigir_utilizable(repo.obtener_enlace_por_hash(hash_de_token(token)), ahora)
    exp = repo.obtener_expediente(enlace.expediente_id)
    cred = repo.obtener_credencial_de_expediente(enlace.expediente_id)
    if exp is None or cred is None or cred.revocada or exp.estado not in ESTADOS_CON_ACCESO:
        raise EnlaceInvalido()
    return enlace, exp.numero


def activar_con_enlace(
    repo: RepoPostulacion, hasheador: HasheadorClaves, config: LectorConfiguracion, *, token: str, cedula: str,
    clave_nueva: str, ip: str | None = None, ahora: datetime | None = None,
) -> AccesoConcedido:
    """
    Usa el enlace: comprueba la cédula (segundo factor), fija la contraseña de la credencial (sin cambio obligatorio),
    marca el enlace usado con la IP y deja la sesión lista (versión nueva: cualquier sesión previa cae). Si el expediente
    estaba PRE_REGISTRADO pasa a EN_CAPTURA, como en el primer acceso normal.
    """
    ahora = ahora or ahora_utc()
    cedula = (cedula or '').strip()
    token_hash = hash_de_token(token)
    previo = repo.obtener_enlace_por_hash(token_hash)
    if previo is None:
        hasheador.verificar_ficticio(clave_nueva or '')  # tiempo parecido exista o no el enlace
        raise EnlaceInvalido()
    fallo: Exception | None = None
    with repo.transaccion():
        exp = obtener_expediente(repo, previo.expediente_id, bloquear=True)
        cred = repo.obtener_credencial_de_expediente(exp.id, bloquear=True)
        enlace = exigir_utilizable(repo.obtener_enlace_por_hash(token_hash, bloquear=True), ahora)
        if cred is None or cred.revocada or exp.estado not in ESTADOS_CON_ACCESO or ahora > cred.vence_el:
            raise EnlaceInvalido()
        if not hmac.compare_digest(cedula.encode(), cred.usuario.encode()):
            enlace = repo.guardar_enlace_activacion(tras_cedula_incorrecta(enlace))
            fallo = EnlaceBloqueado() if enlace.intentos >= MAX_INTENTOS_CEDULA else DatosActivacionIncorrectos()
        else:
            validar_clave_nueva(clave_nueva, cedula=cedula, clave_actual='')
            repo.guardar_enlace_activacion(replace(enlace, usado_el=ahora, ip_uso=ip))
            primer_acceso = exp.estado == EstadoExpediente.PRE_REGISTRADO
            asentar(
                repo, exp, actor_cedula=cedula, actor_tipo=ACTOR_POSTULANTE, fecha=ahora, tipo=TIPO_HISTORIAL_USADO,
                origen='enlace_activacion',
            )
            if primer_acceso:
                exp, _ = aplicar_transicion_expediente(
                    repo, config, expediente_id=exp.id, destino=EstadoExpediente.EN_CAPTURA,
                    actor=Actor.postulante(cedula), datos_extra={'origen': 'enlace_activacion'}, ahora=ahora,
                )
            cred = repo.obtener_credencial_de_expediente(exp.id, bloquear=True)
            cred = repo.guardar_credencial(replace(
                tras_exito(cred, ahora), clave_hash=hasheador.hashear(clave_nueva), debe_cambiar_clave=False,
                version_sesion=cred.version_sesion + 1,
            ))
    if fallo is not None:
        raise fallo
    return AccesoConcedido(cred, exp, primer_acceso)
