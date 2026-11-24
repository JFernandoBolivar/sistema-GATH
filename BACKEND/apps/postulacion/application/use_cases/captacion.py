"""
Transiciones del flujo de Captación por la API (D-7). Sin Django.

Envuelve `aplicar_transicion_expediente`: la máquina valida permiso, guardas y motivo; aquí se limita el endpoint a
las transiciones de Captación (`PARES_CAPTACION`) y se traduce `datos` a la propuesta de cargo y oficina, con los
ids comprobados contra los catálogos por un puerto.
"""
from datetime import datetime

from apps.postulacion.application.use_cases._comun import obtener_expediente, texto_normalizado
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.bandeja import PropuestaCatalogo
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import TransicionRegistrada
from apps.postulacion.domain.errores import ConflictoConCodigo, ValidacionConCodigo
from apps.postulacion.domain.ports.repos import CatalogoPropuesta, RepoPostulacion
from apps.postulacion.domain.services.acciones import es_par_de_captacion
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.ports import LectorConfiguracion, Notificador

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
    ahora: datetime | None = None,
) -> tuple[ExpedientePostulacion, TransicionRegistrada | None, str]:
    """Devuelve `(expediente, asiento, estado_origen)`. Los errores son `DomainError` con `codigo` en español."""
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
    exp, asiento = aplicar_transicion_expediente(
        repo, config, expediente_id=expediente_id, destino=destino, actor=actor, motivo=motivo, propuesta=propuesta,
        datos_extra={'origen': 'captacion', **({'propuesta': propuesta} if propuesta else {})},
        ahora=ahora, notificador=notificador,
    )
    return exp, asiento, asiento.estado_origen if asiento else actual.estado.value
