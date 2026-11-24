"""
Credencial del postulante: emisión, reposición, acceso, cambio de clave y revalidación de la sesión (D-3). Sin Django.

Orden de bloqueos: SIEMPRE primero el expediente y luego su credencial (igual que `aplicar_transicion_expediente`),
para que dos peticiones concurrentes nunca se esperen en círculo.

Un intento fallido se confirma aunque la petición termine en error: el contador de intentos se guarda dentro de la
transacción y el error se lanza DESPUÉS de cerrarla.
"""
from dataclasses import dataclass, replace
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente
from apps.postulacion.application.use_cases.enlace_emision import (
    ENTREGA_CORREO,
    ENTREGAS,
    TIPO_HISTORIAL_REVOCADO,
    EnlaceEmitido,
    asentar,
    crear_y_enviar_enlace,
)
from apps.postulacion.application.use_cases.postulantes import crear_postulante_con_expediente
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.credencial import CredencialPostulante
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante
from apps.postulacion.domain.errores import (
    CredencialesInvalidas,
    CredencialBloqueada,
    SesionInvalida,
    ValidacionConCodigo,
)
from apps.postulacion.domain.ports.repos import BuscadorEmpleados, HasheadorClaves, RepoPostulacion
from apps.postulacion.domain.services.credencial import (
    exigir_sin_bloqueo,
    exigir_vigente,
    generar_clave_temporal,
    tras_exito,
    tras_fallo,
    validar_clave_nueva,
)
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from apps.postulacion.domain.value_objects.estados import ACTOR_USUARIO
from core.domain.exceptions import ConflictError, NotFoundError
from core.domain.ports import LectorConfiguracion, Notificador

MENSAJE_CREDENCIALES_INVALIDAS = "Cédula o contraseña incorrectas."


@dataclass(frozen=True)
class EmisionCredencial:
    """La contraseña temporal viaja SOLO aquí, una vez: no se persiste en claro ni se vuelve a poder leer."""

    credencial: CredencialPostulante
    clave_temporal: str
    enlace: EnlaceEmitido | None = None  # entrega por correo: no hay contraseña temporal que mostrar


@dataclass(frozen=True)
class AltaPostulante:
    postulante: Postulante
    expediente: ExpedientePostulacion
    es_reingreso: bool
    emision: EmisionCredencial


@dataclass(frozen=True)
class AccesoConcedido:
    credencial: CredencialPostulante
    expediente: ExpedientePostulacion
    primer_acceso: bool


@dataclass(frozen=True)
class SesionResuelta:
    credencial: CredencialPostulante
    expediente: ExpedientePostulacion


def emitir_credencial(
    repo: RepoPostulacion, hasheador: HasheadorClaves, *, expediente_id: str, emitida_por: str,
    ahora: datetime | None = None,
) -> EmisionCredencial:
    """
    Emite la credencial del expediente o la REPONE: genera una contraseña temporal nueva, que invalida la anterior
    (y cierra las sesiones abiertas), reinicia intentos y bloqueo y obliga a cambiarla al entrar. La vigencia es la
    de la ventana del expediente. Anula también el enlace de activación pendiente (D-10): «en persona» lo reemplaza.
    """
    ahora = ahora or ahora_utc()
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        if exp.es_terminal:
            raise ConflictError("El expediente está cerrado: no admite credencial de acceso.")
        if exp.ventana_vence_el is None or ahora > exp.ventana_vence_el:
            raise ConflictError(
                "La ventana del expediente venció: no se puede emitir una credencial vigente. "
                "Reabra la ventana primero."
            )
        postulante = repo.obtener_postulante(exp.postulante_id)
        if postulante is None:
            raise NotFoundError("El postulante del expediente no existe.")
        previa = repo.obtener_credencial_de_expediente(exp.id, bloquear=True)
        clave = generar_clave_temporal()
        guardada = repo.guardar_credencial(CredencialPostulante(
            id=previa.id if previa else '', expediente_id=exp.id, usuario=postulante.cedula,
            clave_hash=hasheador.hashear(clave), ventana=exp.ventana or 1, vence_el=exp.ventana_vence_el,
            debe_cambiar_clave=True, intentos_fallidos=0, bloqueada_hasta=None, ultimo_acceso=None,
            emitida_por=emitida_por, emitida_el=ahora, version_sesion=(previa.version_sesion + 1) if previa else 1,
            revocada=False,
        ))
        if repo.revocar_enlaces_pendientes(exp.id):
            asentar(
                repo, exp, actor_cedula=emitida_por, actor_tipo=ACTOR_USUARIO, fecha=ahora,
                tipo=TIPO_HISTORIAL_REVOCADO, origen='captacion',
            )
    return EmisionCredencial(guardada, clave)


def alta_postulante_con_credencial(
    repo: RepoPostulacion, empleados: BuscadorEmpleados, config: LectorConfiguracion, hasheador: HasheadorClaves, *,
    cedula: str, nombres: str, apellidos: str, creado_por: str, correo: str = '', telefono_movil: str = '',
    ahora: datetime | None = None, entrega: str = 'persona', notificador: Notificador | None = None,
) -> AltaPostulante:
    """
    Postulante + expediente + credencial en UNA transacción (si algo falla no queda nada a medias). Con `entrega='correo'`
    el acceso se manda como enlace de activación (tras el commit) y NO se devuelve contraseña temporal; sin correo, 409 `SIN_CORREO`.
    """
    if entrega not in ENTREGAS:
        raise ValidacionConCodigo("La entrega debe ser «persona» o «correo».", campo='entrega', codigo='ENTREGA_INVALIDA')
    ahora = ahora or ahora_utc()
    with repo.transaccion():
        postulante, expediente, reingreso = crear_postulante_con_expediente(
            repo, empleados, config, cedula=cedula, nombres=nombres, apellidos=apellidos, creado_por=creado_por,
            correo=correo, telefono_movil=telefono_movil, ahora=ahora,
        )
        emision = emitir_credencial(repo, hasheador, expediente_id=expediente.id, emitida_por=creado_por, ahora=ahora)
        if entrega == ENTREGA_CORREO:
            enlace = crear_y_enviar_enlace(
                repo, notificador, config, exp=expediente, postulante=postulante, creado_por=creado_por, ahora=ahora,
            )
            emision = EmisionCredencial(emision.credencial, '', enlace)
    return AltaPostulante(postulante, expediente, reingreso, emision)


def autenticar_postulante(
    repo: RepoPostulacion, hasheador: HasheadorClaves, config: LectorConfiguracion, *,
    cedula: str, clave: str, ahora: datetime | None = None,
) -> AccesoConcedido:
    """
    Verifica cédula y contraseña (hash), bloqueo por intentos, vigencia y etapa del expediente. La primera entrada
    válida con el expediente PRE_REGISTRADO aplica PRE_REGISTRADO -> EN_CAPTURA (con su asiento en el historial).
    """
    ahora = ahora or ahora_utc()
    cedula = (cedula or '').strip()
    clave = clave or ''
    previa = repo.obtener_credencial_por_usuario(cedula)
    if previa is None:
        hasheador.verificar_ficticio(clave)
        raise CredencialesInvalidas(MENSAJE_CREDENCIALES_INVALIDAS)
    fallo: Exception | None = None
    primer_acceso = False
    with repo.transaccion():
        exp = obtener_expediente(repo, previa.expediente_id, bloquear=True)
        cred = repo.obtener_credencial_de_expediente(exp.id, bloquear=True)
        if cred is None:
            hasheador.verificar_ficticio(clave)
            raise CredencialesInvalidas(MENSAJE_CREDENCIALES_INVALIDAS)
        exigir_sin_bloqueo(cred, ahora)
        if not hasheador.verificar(clave, cred.clave_hash):
            cred = repo.guardar_credencial(tras_fallo(cred, ahora))
            try:
                exigir_sin_bloqueo(cred, ahora)
                fallo = CredencialesInvalidas(MENSAJE_CREDENCIALES_INVALIDAS)
            except CredencialBloqueada as e:
                fallo = e  # este fue el intento que alcanzó el máximo
        else:
            exigir_vigente(cred, exp.estado, ahora)
            primer_acceso = exp.estado == EstadoExpediente.PRE_REGISTRADO
            if primer_acceso:
                exp, _ = aplicar_transicion_expediente(
                    repo, config, expediente_id=exp.id, destino=EstadoExpediente.EN_CAPTURA,
                    actor=Actor.postulante(cedula), datos_extra={'origen': 'primer_acceso'}, ahora=ahora,
                )
            cred = repo.obtener_credencial_de_expediente(exp.id, bloquear=True)
            cred = repo.guardar_credencial(tras_exito(cred, ahora))
    if fallo is not None:
        raise fallo
    return AccesoConcedido(cred, exp, primer_acceso)


def cambiar_clave(
    repo: RepoPostulacion, hasheador: HasheadorClaves, *, expediente_id: str, cedula: str,
    clave_actual: str, clave_nueva: str, ahora: datetime | None = None,
) -> CredencialPostulante:
    """
    Cambia la contraseña del postulante autenticado. Pide la actual (un fallo cuenta para el bloqueo), aplica la
    política de la nueva, apaga `debe_cambiar_clave` y sube `version_sesion`: las demás sesiones abiertas caen y
    quien llama recibe un token nuevo.
    """
    ahora = ahora or ahora_utc()
    fallo: Exception | None = None
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        cred = repo.obtener_credencial_de_expediente(exp.id, bloquear=True)
        if cred is None or cred.usuario != cedula:
            raise SesionInvalida("La sesión venció o no es válida. Ingrese de nuevo con su cédula y contraseña.")
        exigir_vigente(cred, exp.estado, ahora)
        exigir_sin_bloqueo(cred, ahora)
        if not hasheador.verificar(clave_actual or '', cred.clave_hash):
            cred = repo.guardar_credencial(tras_fallo(cred, ahora))
            try:
                exigir_sin_bloqueo(cred, ahora)
                fallo = CredencialesInvalidas("La contraseña actual no es correcta.", campo='clave_actual')
            except CredencialBloqueada as e:
                fallo = e
        else:
            validar_clave_nueva(clave_nueva, cedula=cedula, clave_actual=clave_actual or '')
            cred = repo.guardar_credencial(replace(
                tras_exito(cred, ahora), clave_hash=hasheador.hashear(clave_nueva), debe_cambiar_clave=False,
                version_sesion=cred.version_sesion + 1,
            ))
    if fallo is not None:
        raise fallo
    return cred


def resolver_sesion(
    repo: RepoPostulacion, *, cedula: str, expediente_id: str, version_sesion: int, ahora: datetime | None = None,
) -> SesionResuelta:
    """
    Revalida en CADA petición lo que dice el token contra la base: la credencial existe, es de esa cédula y de ese
    expediente, no fue revocada ni reemplazada (versión), no venció y el expediente sigue en una etapa del postulante.
    """
    ahora = ahora or ahora_utc()
    cred = repo.obtener_credencial_de_expediente(expediente_id)
    if cred is None or cred.usuario != cedula or cred.version_sesion != version_sesion or cred.revocada:
        raise SesionInvalida("La sesión venció o no es válida. Ingrese de nuevo con su cédula y contraseña.")
    exp = obtener_expediente(repo, expediente_id)
    exigir_vigente(cred, exp.estado, ahora)
    return SesionResuelta(cred, exp)
