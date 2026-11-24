"""
Ventana 2 del postulante (G-2): borrador del formulario (familiares, vivienda, salud, tallas) y foto de carnet. Sin Django.

Zero-IDOR igual que la Ventana 1: el expediente y la cédula salen SIEMPRE de la sesión de invitado. Solo en CONSOLIDANDO
y con la ventana vigente (la autotransición de la máquina lo exige, sin dejar asiento en el historial). Enviar la
Ventana 2 es `mi_expediente.enviar_expediente` (comprueba la completitud con `faltantes_de`).

La foto llega ya validada por la capa de presentación (firma real, tamaño y dimensiones; reencodificada sin EXIF) y se
guarda en el almacén con una clave opaca SIN la cédula. Una por expediente: subir otra REEMPLAZA a la anterior y el
objeto viejo se borra solo si todo se confirmó.
"""
import hashlib
import logging
from dataclasses import dataclass, replace
from datetime import datetime

from apps.postulacion.application.use_cases._comun import ahora_utc, obtener_expediente
from apps.postulacion.application.use_cases.mi_expediente import _propio, faltantes_de, fecha_de
from apps.postulacion.application.use_cases.psicofisico import _borrar_si_existe
from apps.postulacion.application.use_cases.transiciones import aplicar_transicion_expediente
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.errores import ConflictoConCodigo, DatosVentana2Invalidos
from apps.postulacion.domain.ports.repos import CatalogosVentana2, RepoPostulacion
from apps.postulacion.domain.services.datos_ventana2 import combinar_borrador, validar_datos_ventana2
from apps.postulacion.domain.services.maquina_estados import Actor
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from core.domain.exceptions import NotFoundError
from core.domain.ports import FileStorage, LectorConfiguracion

logger = logging.getLogger('gath.postulacion')

E = EstadoExpediente
PREFIJO_CLAVE_FOTO = 'postulacion/foto'


@dataclass(frozen=True)
class FotoSubida:
    """Foto ya validada y normalizada por quien invoca: contenido, MIME y la clave opaca para el almacén."""

    contenido: bytes
    mime: str
    clave: str


@dataclass(frozen=True)
class VistaVentana2:
    expediente: ExpedientePostulacion
    datos: dict
    faltantes: list[dict]

    @property
    def completa(self) -> bool:
        return not self.faltantes


def exigir_ventana2(exp: ExpedientePostulacion, ahora: datetime) -> None:
    """Solo en CONSOLIDANDO y con la ventana vigente (segunda línea: la sesión ya lo comprueba al autenticar)."""
    if exp.estado != E.CONSOLIDANDO or exp.ventana != 2:
        raise ConflictoConCodigo(
            f"Este formulario es de la Ventana 2 y el expediente está en {exp.estado.value}"
            f"{' (Ventana ' + str(exp.ventana) + ')' if exp.ventana else ''}.", codigo='VENTANA_INCORRECTA',
        )
    if exp.ventana_vence_el is None or ahora > exp.ventana_vence_el:
        raise ConflictoConCodigo("La ventana de acceso del postulante venció o no está vigente.", codigo='VENTANA_VENCIDA')


def consultar_ventana2(
    repo: RepoPostulacion, catalogos: CatalogosVentana2, *, expediente_id: str, cedula: str,
    ahora: datetime | None = None,
) -> VistaVentana2:
    ahora = ahora or ahora_utc()
    exp = obtener_expediente(repo, expediente_id)
    _propio(repo, exp, cedula)
    exigir_ventana2(exp, ahora)
    return VistaVentana2(exp, exp.datos_ventana2 or {}, faltantes_de(exp, cedula, catalogos, ahora))


def guardar_ventana2(
    repo: RepoPostulacion, config: LectorConfiguracion, catalogos: CatalogosVentana2, *, expediente_id: str,
    cedula: str, datos: dict, ahora: datetime | None = None,
) -> VistaVentana2:
    """
    Guarda el borrador: cada sección enviada REEMPLAZA a la anterior (las omitidas no cambian). Valida el esquema y que los
    ids existan en los catálogos; la completitud se exige solo al enviar.
    """
    ahora = ahora or ahora_utc()
    limpio = validar_datos_ventana2(datos, ahora.date())
    with repo.transaccion():
        exp = obtener_expediente(repo, expediente_id, bloquear=True)
        _propio(repo, exp, cedula)
        exigir_ventana2(exp, ahora)
        nacimiento = fecha_de(exp.datos_ventana1.get('fecha_nacimiento'))
        errores = catalogos.errores(
            limpio, cedula_titular=cedula, fecha_nacimiento_titular=nacimiento, hoy=ahora.date(), completo=False,
        )
        if errores:
            raise DatosVentana2Invalidos(errores)
        exp, _ = aplicar_transicion_expediente(
            repo, config, expediente_id=exp.id, destino=E.CONSOLIDANDO, actor=Actor.postulante(cedula), ahora=ahora,
        )
        exp = repo.guardar_expediente(replace(exp, datos_ventana2=combinar_borrador(exp.datos_ventana2, limpio)))
    return VistaVentana2(exp, exp.datos_ventana2, faltantes_de(exp, cedula, catalogos, ahora))


def subir_foto(
    repo: RepoPostulacion, almacen: FileStorage, config: LectorConfiguracion, *, expediente_id: str, cedula: str,
    foto: FotoSubida, ahora: datetime | None = None,
) -> ExpedientePostulacion:
    """Guarda (o reemplaza) la foto de carnet del expediente. Si algo falla, el objeto subido no queda huérfano."""
    ahora = ahora or ahora_utc()
    previa_clave = ''
    try:
        with repo.transaccion():
            exp = obtener_expediente(repo, expediente_id, bloquear=True)
            _propio(repo, exp, cedula)
            exigir_ventana2(exp, ahora)
            exp, _ = aplicar_transicion_expediente(
                repo, config, expediente_id=exp.id, destino=E.CONSOLIDANDO, actor=Actor.postulante(cedula), ahora=ahora,
            )
            previa_clave = exp.foto_clave
            almacen.subir(foto.clave, foto.contenido, foto.mime)
            exp = repo.guardar_expediente(replace(
                exp, foto_clave=foto.clave, foto_sha256=hashlib.sha256(foto.contenido).hexdigest(),
                foto_tamano=len(foto.contenido), foto_subida_el=ahora,
            ))
            if previa_clave:  # el objeto anterior se borra solo si todo se confirmó
                repo.al_confirmar(lambda: _borrar_si_existe(almacen, previa_clave))
    except Exception:
        _borrar_si_existe(almacen, foto.clave)
        raise
    return exp


def foto_propia(repo: RepoPostulacion, *, expediente_id: str, cedula: str, ahora: datetime | None = None) -> str:
    """Clave de la foto del propio postulante (404 si no ha subido ninguna)."""
    ahora = ahora or ahora_utc()
    exp = obtener_expediente(repo, expediente_id)
    _propio(repo, exp, cedula)
    exigir_ventana2(exp, ahora)
    if not exp.tiene_foto:
        raise NotFoundError("Todavía no ha subido su foto de carnet.")
    return exp.foto_clave


def foto_de_expediente(repo: RepoPostulacion, *, expediente_id: str) -> tuple[str, str]:
    """`(clave, número)` para que Captación vea la foto; 404 si el expediente no tiene."""
    exp = obtener_expediente(repo, expediente_id)
    if not exp.tiene_foto:
        raise NotFoundError("El expediente no tiene foto de carnet.")
    return exp.foto_clave, exp.numero
