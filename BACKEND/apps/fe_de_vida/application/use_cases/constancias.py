"""
Emisión de la constancia de fe de vida (C4, PLAN §2.11): al VALIDARSE la solicitud se numera, se genera el
PDF y se guarda en el almacén privado. Sin firma ni sello: certifican el nombre y la cédula de quien aprobó.
Sin Django.
"""
from datetime import datetime

from apps.fe_de_vida.application.use_cases._comun import obtener_proceso, obtener_solicitud
from apps.fe_de_vida.domain.entities.constancia import Certificador, ConstanciaFeDeVida
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.domain.ports.repos import (
    GeneradorConstancia,
    LectorPasivos,
    RepoConstancias,
    RepoProcesos,
    RepoSolicitudesFeDeVida,
)
from apps.fe_de_vida.domain.services.constancia import texto_constancia
from apps.fe_de_vida.domain.value_objects.estados import EstadoSolicitud, TipoDecision, ViaAprobacion
from core.domain.exceptions import ConflictError
from core.domain.ports import FileStorage

MIME_PDF = 'application/pdf'
PREFIJO_CLAVE_PDF = 'fe_de_vida/constancias'


def certificadores_de(solicitud: SolicitudFeDeVida, lector: LectorPasivos) -> tuple[Certificador, ...]:
    """Quien(es) aprobó: ambos checks (doble check) o solo la Administradora (aprobación directa)."""
    if solicitud.via_aprobacion is ViaAprobacion.DIRECTA_ADMINISTRADORA:
        aprobaron = [d for d in solicitud.decisiones if d.tipo is TipoDecision.APROBACION_DIRECTA]
    else:
        aprobaron = list(solicitud.checks_vigentes())
    return tuple(Certificador(lector.nombre_de(d.actor_cedula), d.actor_cedula, d.rol.value) for d in aprobaron)


def emitir_constancia(
    repo_proc: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, repo_const: RepoConstancias,
    lector: LectorPasivos, generador: GeneradorConstancia, storage: FileStorage,
    *, solicitud_id: str, url_verificacion_base: str, ahora: datetime,
) -> ConstanciaFeDeVida:
    """Idempotente: si la solicitud ya tiene constancia con PDF, la devuelve. Debe correr en una transacción."""
    solicitud = obtener_solicitud(repo_sol, solicitud_id, bloquear=True)
    if solicitud.estado is not EstadoSolicitud.VALIDADA:
        raise ConflictError("Solo una solicitud VALIDADA genera constancia.")
    existente = repo_const.obtener_de_solicitud(solicitud.id)
    if existente is not None and existente.clave_pdf:
        return existente
    plantilla = repo_const.plantilla_activa()
    if plantilla is None:
        raise ConflictError("No hay una plantilla de constancia activa.")
    fecha = solicitud.fecha_validacion or ahora
    constancia = existente or repo_const.reservar(
        solicitud.id, solicitud.cedula, fecha.year, certificadores_de(solicitud, lector), plantilla.version, ahora,
    )
    pasivo = lector.datos(solicitud.cedula)
    pdf = generador.generar(
        constancia=constancia, plantilla=plantilla, texto=texto_constancia(plantilla, pasivo, fecha),
        proceso_nombre=obtener_proceso(repo_proc, solicitud.proceso_id).nombre, emitida_en=ahora,
        via_directa=solicitud.via_aprobacion is ViaAprobacion.DIRECTA_ADMINISTRADORA,
        url_verificacion=f'{url_verificacion_base.rstrip("/")}/{constancia.codigo_verificacion}',
    )
    clave = f'{PREFIJO_CLAVE_PDF}/{constancia.numero}.pdf'
    storage.subir(clave, pdf, MIME_PDF)  # si falla, la transacción se revierte y el número queda libre
    return repo_const.registrar_pdf(constancia.id, clave)
