"""
Casos de uso del propio postulante sobre su expediente (D-4). Sin Django.

Zero-IDOR: el expediente y la cédula salen SIEMPRE de la sesión (token + credencial), nunca de la URL ni del cuerpo.
Ninguna de estas funciones recibe un id ajeno: solo el de la sesión, y además se comprueba que el expediente
pertenezca a esa cédula.
"""
from dataclasses import dataclass, replace
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente, texto_normalizado
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante, TransicionRegistrada
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.datos_ventana import campos_obligatorios_faltantes, validar_datos_ventana1
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError
from core.domain.ports import LectorConfiguracion, Notificador
from core.domain.validacion_personas import validar_nombre, validar_telefono

E = EstadoExpediente

# Estados en que el postulante edita y qué ocurre al enviar (§4.2).
ESTADOS_EDITABLES = frozenset({E.EN_CAPTURA, E.EN_CORRECCION_DATOS, E.CONSOLIDANDO})
ENVIO_DESDE: dict[EstadoExpediente, EstadoExpediente] = {
    E.EN_CAPTURA: E.ENVIADO_CAPTACION,
    E.EN_CORRECCION_DATOS: E.ENVIADO_CAPTACION,
    E.CONSOLIDANDO: E.EN_REVISION_FINAL,
}


@dataclass(frozen=True)
class VistaMiExpediente:
    expediente: ExpedientePostulacion
    postulante: Postulante
    ultima_observacion: TransicionRegistrada | None
    campos_pendientes: list[str]


def _propio(repo: RepoPostulacion, exp: ExpedientePostulacion, cedula: str) -> Postulante:
    postulante = repo.obtener_postulante(exp.postulante_id)
    if postulante is None or postulante.cedula != cedula:
        # No se distingue «no existe» de «es de otro»: nunca se confirma la existencia de un expediente ajeno.
        raise NotFoundError("El expediente de postulación no existe.")
    return postulante


def consultar_mi_expediente(repo: RepoPostulacion, *, expediente_id: str, cedula: str) -> VistaMiExpediente:
    exp = obtener_expediente(repo, expediente_id)
    postulante = _propio(repo, exp, cedula)
    # La observación vigente es el motivo con que Captación devolvió el expediente al estado actual.
    ultima = next(
        (t for t in reversed(repo.listar_transiciones(exp.id))
         if t.estado_destino == exp.estado.value and t.actor_tipo != 'POSTULANTE' and t.motivo),
        None,
    )
    pendientes = campos_obligatorios_faltantes(exp.datos_ventana1) if exp.ventana == 1 else []
    return VistaMiExpediente(exp, postulante, ultima, pendientes)


def guardar_borrador(
    repo: RepoPostulacion, config: LectorConfiguracion, *, expediente_id: str, cedula: str, nombres: str,
    apellidos: str, correo: str | None = None, telefono_movil: str | None = None, datos_ventana1: dict | None = None,
    ahora: datetime | None = None,
) -> tuple[Postulante, ExpedientePostulacion]:
    """
    Guarda los datos básicos del postulante y, si se envían, REEMPLAZA `datos_ventana1` (omitido = sin cambios).
    `correo` y `telefono_movil` omitidos (None) conservan lo guardado: antes un borrador sin esos campos borraba
    el correo que Captación registró al dar de alta, y el postulante dejaba de recibir los avisos por correo.
    En EN_CAPTURA y CONSOLIDANDO pasa por la autotransición de la máquina (valida la ventana vigente; sin asiento
    de historial). EN_CORRECCION_DATOS no tiene autotransición en §4.2: allí se exige la ventana vigente aquí mismo.
    """
    ahora = ahora or ahora_utc()
    try:
        nombres = validar_nombre(texto_normalizado(nombres, "Los nombres", maximo=150), edicion=True, etiqueta="Los nombres")
        apellidos = validar_nombre(
            texto_normalizado(apellidos, "Los apellidos", maximo=150), edicion=True, etiqueta="Los apellidos",
        )
        telefono = (
            None if telefono_movil is None
            else validar_telefono(telefono_movil, tipo='movil', etiqueta="El teléfono") or ''
        )
    except ValueError as e:
        raise ValidationError(str(e)) from e
    correo = None if correo is None else texto_normalizado(correo, "El correo", maximo=254, obligatorio=False)
    datos = validar_datos_ventana1(datos_ventana1, ahora.date()) if datos_ventana1 is not None else None

    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        postulante = _propio(repo, exp, cedula)
        if exp.estado not in ESTADOS_EDITABLES:
            raise ConflictError(f"El expediente está en {exp.estado.value} y no admite cambios del postulante.")
        if datos is not None and exp.ventana != 1:
            raise ValidationError(
                "La Ventana 2 todavía no tiene formulario de datos: solo se actualizan los datos básicos.",
                campo='datos_ventana1',
            )
        if exp.estado == E.EN_CORRECCION_DATOS:
            if exp.ventana_vence_el is None or ahora > exp.ventana_vence_el:
                raise ConflictError("La ventana de acceso del postulante venció o no está vigente.")
        else:
            exp, _ = aplicar_transicion_expediente(
                repo, config, expediente_id=exp.id, destino=exp.estado, actor=Actor.postulante(cedula), ahora=ahora,
            )
        if datos is not None:
            exp = repo.guardar_expediente(replace(exp, datos_ventana1=datos))
        postulante = repo.guardar_postulante(replace(
            postulante, nombres=nombres, apellidos=apellidos,
            correo=postulante.correo if correo is None else correo,
            telefono_movil=postulante.telefono_movil if telefono is None else telefono,
        ))
    return postulante, exp


def enviar_expediente(
    repo: RepoPostulacion, config: LectorConfiguracion, *, expediente_id: str, cedula: str,
    ahora: datetime | None = None, notificador: Notificador | None = None,
) -> ExpedientePostulacion:
    """EN_CAPTURA|EN_CORRECCION_DATOS -> ENVIADO_CAPTACION o CONSOLIDANDO -> EN_REVISION_FINAL, con historial."""
    ahora = ahora or ahora_utc()
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        _propio(repo, exp, cedula)
        destino = ENVIO_DESDE.get(exp.estado)
        if destino is None:
            raise ConflictError(f"El expediente está en {exp.estado.value} y no puede enviarse.")
        if exp.ventana == 1:
            faltan = campos_obligatorios_faltantes(exp.datos_ventana1)
            if faltan:
                raise ValidationError(
                    f"Complete los datos obligatorios antes de enviar: {', '.join(faltan)}.", campo='datos_ventana1',
                )
        guardado, _ = aplicar_transicion_expediente(
            repo, config, expediente_id=exp.id, destino=destino, actor=Actor.postulante(cedula),
            datos_extra={'origen': 'postulante'}, ahora=ahora, notificador=notificador,
        )
    return guardado
