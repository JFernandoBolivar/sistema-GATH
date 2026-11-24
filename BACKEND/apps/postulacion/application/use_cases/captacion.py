"""
Transiciones del flujo de Captación por la API (D-7). Sin Django.

Envuelve `aplicar_transicion_expediente`: la máquina valida permiso, guardas y motivo; aquí se limita el endpoint a
las transiciones de Captación (`PARES_CAPTACION`) y se traduce `datos` a la propuesta de cargo y oficina, con los
ids comprobados contra los catálogos por un puerto.

Reabrir la Ventana 2 (G-1, G-3): APROBADO -> CONSOLIDANDO y EN_REVISION_FINAL -> CONSOLIDANDO («observar faltantes») emiten
en la MISMA transacción una contraseña temporal NUEVA (misma que `reponer-credencial`: ventana 2, vence según el parámetro,
cambio de clave obligatorio) que se devuelve UNA sola vez. La tarea «contactar al postulante» queda pendiente hasta que
Captación la marca con `registrar_contacto`.
"""
import logging
from dataclasses import replace
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente, texto_normalizado
from apps.postulacion.application.use_cases.avisos import TIPO_CONTACTAR_POSTULANTE, TIPO_CONTACTO_ATRASADO, REF_TIPO
from apps.postulacion.application.use_cases.credenciales import EmisionCredencial, emitir_credencial
from apps.postulacion.application.use_cases.enlace_emision import ENTREGA_CORREO, ENTREGAS, crear_y_enviar_enlace, exigir_envio_posible
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.bandeja import PropuestaCatalogo
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import TransicionRegistrada
from apps.postulacion.domain.errores import ConflictoConCodigo, ValidacionConCodigo
from apps.postulacion.domain.ports.repos import CatalogoPropuesta, HasheadorClaves, RepoPostulacion
from apps.postulacion.domain.services.acciones import es_par_de_captacion
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.ports import LectorConfiguracion, Notificador

logger = logging.getLogger('gath.postulacion')

# clave de `datos` -> campo del expediente, para los ids (enteros positivos) y los textos.
_IDS = {
    'cargo_id': 'cargo_propuesto_id', 'cargo_especifico_id': 'cargo_especifico_propuesto_id',
    'tipo_nomina_id': 'tipo_nomina_propuesto_id', 'direccion_general_id': 'direccion_general_id',
    'direccion_linea_id': 'direccion_linea_id', 'coordinacion_id': 'coordinacion_id', 'dependencia_id': 'dependencia_id',
}
_TEXTOS = {
    'cargo_texto': ('cargo_propuesto_texto', 'El cargo propuesto (texto)', 200),
    'oficina_texto': ('oficina_propuesta_texto', 'La oficina propuesta (texto)', 200),
    'observaciones': ('observaciones', 'Las observaciones', 2000),
}
CLAVES_DATOS_PROPUESTA = tuple(_IDS) + tuple(_TEXTOS)


def _entero_positivo(clave: str, valor) -> int:
    if isinstance(valor, bool) or not isinstance(valor, (int, str)) or not str(valor).strip().isdigit() or int(valor) < 1:
        raise ValidacionConCodigo(
            f"«{clave}» debe ser un identificador numérico válido.", campo=f'datos.{clave}', codigo='PROPUESTA_INVALIDA',
        )
    return int(valor)


def construir_propuesta(datos: dict, catalogo: CatalogoPropuesta) -> dict:
    """Propuesta (campos del expediente) a partir de `datos`; valida claves, tipos y la existencia en los catálogos."""
    desconocidas = sorted(set(datos) - set(CLAVES_DATOS_PROPUESTA))
    if desconocidas:
        raise ValidacionConCodigo(
            f"Datos no válidos para abrir hacia Presupuesto: {', '.join(desconocidas)}.", campo='datos',
            codigo='PROPUESTA_INVALIDA',
        )
    propuesta: dict = {}
    for clave, campo in _IDS.items():
        if datos.get(clave) not in (None, ''):
            propuesta[campo] = _entero_positivo(clave, datos[clave])
    for clave, (campo, etiqueta, maximo) in _TEXTOS.items():
        if clave in datos and datos[clave] is not None:
            propuesta[campo] = texto_normalizado(datos[clave], etiqueta, maximo=maximo, obligatorio=False)
    errores = catalogo.errores_de_propuesta(PropuestaCatalogo(**{
        k: v for k, v in propuesta.items() if k in PropuestaCatalogo.__dataclass_fields__
    }))
    if errores:
        campo, mensaje = next(iter(errores.items()))
        raise ValidacionConCodigo(mensaje, campo=f'datos.{campo}', codigo='PROPUESTA_INVALIDA')
    # Sin texto libre, los textos se completan con los nombres del catálogo: así los listados de Presupuesto,
    # Dirección General y Captación muestran el cargo y la oficina sin consultar los catálogos fila por fila.
    nombres = catalogo.nombres_de_propuesta(PropuestaCatalogo(**{
        k: v for k, v in propuesta.items() if k in PropuestaCatalogo.__dataclass_fields__
    }))
    if not propuesta.get('cargo_propuesto_texto'):
        cargo = nombres.get('cargo_especifico') or nombres.get('cargo') or ''
        if cargo:
            propuesta['cargo_propuesto_texto'] = cargo[:200]
    if not propuesta.get('oficina_propuesta_texto'):
        partes = [nombres.get(k, '') for k in ('direccion_general', 'direccion_linea', 'coordinacion')]
        oficina = ' › '.join(p for p in partes if p)
        if oficina:
            propuesta['oficina_propuesta_texto'] = oficina[:200]
    return propuesta


def transicionar_captacion(
    repo: RepoPostulacion, config: LectorConfiguracion, catalogo: CatalogoPropuesta, notificador: Notificador | None, *,
    expediente_id: str, destino: EstadoExpediente | str, actor: Actor, motivo: str = '', datos: dict | None = None,
    ahora: datetime | None = None, hasheador: HasheadorClaves | None = None, entrega: str = 'persona',
) -> tuple[ExpedientePostulacion, TransicionRegistrada | None, str, EmisionCredencial | None]:
    """
    Devuelve `(expediente, asiento, estado_origen, emision)`; `emision` es la credencial NUEVA (con su contraseña temporal, que
    solo viaja aquí) cuando la transición reabre la Ventana 2, y None en las demás. Los errores son `DomainError` con `codigo`.
    Con `entrega='correo'` (solo al reabrir la Ventana 2) la emisión trae `enlace` y NO hay contraseña temporal: el enlace de
    activación sale por correo tras el commit (409 `SIN_CORREO` si el postulante no tiene correo).
    """
    if entrega not in ENTREGAS:
        raise ValidacionConCodigo("La entrega debe ser «persona» o «correo».", campo='entrega', codigo='ENTREGA_INVALIDA')
    try:
        destino = EstadoExpediente(destino)
    except ValueError as e:
        raise ValidacionConCodigo(
            f"El estado de destino «{destino}» no existe.", campo='destino', codigo='DESTINO_INVALIDO',
        ) from e
    datos = dict(datos or {})
    actual = obtener_expediente(repo, expediente_id)
    # Un expediente final lo rechaza la máquina con su mensaje propio (EXPEDIENTE_FINAL).
    if not actual.es_terminal and not es_par_de_captacion(actual.estado, destino):
        raise ConflictoConCodigo(
            f"De {actual.estado.value} a {destino.value} no es una acción de Captación.",
            codigo='TRANSICION_NO_PERMITIDA',
        )
    propuesta = None
    if datos:
        if destino != EstadoExpediente.EN_PRESUPUESTO:
            raise ValidacionConCodigo(
                "Solo se envían datos adicionales al abrir hacia Presupuesto (cargo y oficina).", campo='datos',
                codigo='PROPUESTA_INVALIDA',
            )
        propuesta = construir_propuesta(datos, catalogo) or None
    reabre_ventana2 = destino == EstadoExpediente.CONSOLIDANDO and actual.estado != EstadoExpediente.CONSOLIDANDO
    if reabre_ventana2 and hasheador is None:
        raise ValidacionConCodigo(
            "No se puede reabrir la Ventana 2 sin emitir la credencial nueva.", campo='destino', codigo='DESTINO_INVALIDO',
        )
    ahora = ahora or ahora_utc()
    emision = None
    with repo.transaccion():
        exp, asiento = aplicar_transicion_expediente(
            repo, config, expediente_id=expediente_id, destino=destino, actor=actor, motivo=motivo, propuesta=propuesta,
            datos_extra={
                'origen': 'captacion', **({'propuesta': propuesta} if propuesta else {}),
                **({'credencial_repuesta': True} if reabre_ventana2 else {}),
                **({'entrega': ENTREGA_CORREO} if reabre_ventana2 and entrega == ENTREGA_CORREO else {}),
            },
            ahora=ahora, notificador=notificador,
        )
        if reabre_ventana2:
            # La nueva contraseña invalida la anterior y las sesiones abiertas; el correo de cortesía NUNCA la incluye.
            emision = emitir_credencial(repo, hasheador, expediente_id=exp.id, emitida_por=actor.cedula, ahora=ahora)
            if entrega == ENTREGA_CORREO:
                postulante = repo.obtener_postulante(exp.postulante_id)
                exigir_envio_posible(exp, postulante, ahora)
                enlace = crear_y_enviar_enlace(
                    repo, notificador, config, exp=exp, postulante=postulante, creado_por=actor.cedula, ahora=ahora,
                )
                emision = EmisionCredencial(emision.credencial, '', enlace)
    return exp, asiento, asiento.estado_origen if asiento else actual.estado.value, emision


def registrar_contacto(
    repo: RepoPostulacion, notificador: Notificador | None, *, expediente_id: str, actor: Actor, nota: str = '',
    ahora: datetime | None = None,
) -> ExpedientePostulacion:
    """
    Captación registra que contactó al postulante (G-1): queda en el historial SIN cambiar de estado (la nota va en
    `datos_extra`, no en `motivo`, para que el postulante no la lea como observación), limpia la tarea pendiente y cierra
    el aviso CONTACTAR_POSTULANTE (y su escalamiento) para todos.
    """
    ahora = ahora or ahora_utc()
    nota = texto_normalizado(nota, "La nota", maximo=500, obligatorio=False)
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        if exp.estado != EstadoExpediente.CONSOLIDANDO or exp.contacto_pendiente_desde is None:
            raise ConflictoConCodigo(
                "Este expediente no tiene un contacto con el postulante pendiente.", codigo='CONTACTO_NO_PENDIENTE',
            )
        desde = exp.contacto_pendiente_desde
        guardado = repo.guardar_expediente(replace(exp, contacto_pendiente_desde=None))
        repo.registrar_transicion(TransicionRegistrada(
            id='', expediente_id=guardado.id, estado_origen=exp.estado.value, estado_destino=exp.estado.value,
            actor_cedula=actor.cedula, actor_tipo=actor.tipo, fecha=ahora,
            datos_extra={
                'tipo': 'CONTACTADO', 'origen': 'captacion', 'pendiente_desde': desde.isoformat(),
                **({'nota': nota} if nota else {}),
            },
        ))
        if notificador is not None and actor.cedula:
            def cerrar() -> None:
                for tipo in (TIPO_CONTACTAR_POSTULANTE, TIPO_CONTACTO_ATRASADO):
                    try:
                        notificador.resolver_avisos(REF_TIPO, guardado.id, por_cedula=actor.cedula, tipo=tipo)
                    except Exception:  # noqa: BLE001 - el aviso nunca deshace el registro
                        logger.exception('No se pudo resolver el aviso %s del expediente %s', tipo, guardado.numero)
            repo.al_confirmar(cerrar)
    return guardado
