"""
Trámite del pasivo (C3): iniciar la solicitud del proceso, guardar el borrador del acta (cambios
propuestos), subir la foto con la cédula y enviar. Sin Django.
"""
import hashlib
import uuid
from datetime import datetime

from apps.fe_de_vida.application.use_cases._comun import evento, obtener_proceso, obtener_solicitud_propia
from apps.fe_de_vida.application.use_cases.consultas import obtener_proceso_vigente
from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.domain.events import PublicadorEventos, PublicadorNulo, TipoEvento
from apps.fe_de_vida.domain.ports.repos import (
    RepoCambiosActa,
    RepoProcesos,
    RepoSolicitudesFeDeVida,
    ValidadorCambiosActa,
    VerificadorPasivo,
)
from apps.fe_de_vida.domain.services.reglas_proceso import exigir_puede_enviar
from apps.fe_de_vida.domain.value_objects.estados import OrigenEvidencia
from core.domain.exceptions import ConflictError, PermissionDeniedError, ValidationError
from core.domain.ports import FileStorage

MIME_A_EXTENSION = {'image/jpeg': '.jpg', 'image/png': '.png'}


def _exigir_ventana(repo_proc: RepoProcesos, proceso_id: str, cedula: str, ahora: datetime) -> None:
    proceso = obtener_proceso(repo_proc, proceso_id)
    exigir_puede_enviar(proceso, repo_proc.listar_prorrogas(proceso_id), cedula, ahora)


def iniciar_solicitud(
    repo_proc: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, verificador: VerificadorPasivo,
    *, proceso_id: str, cedula: str, ahora: datetime,
) -> SolicitudFeDeVida:
    """Crea (o devuelve) la única solicitud del pasivo en el proceso. Solo pasivos y solo con plazo vigente."""
    if not verificador.es_pasivo(cedula):
        raise PermissionDeniedError("La fe de vida es solo para personal pasivo.")
    existente = repo_sol.obtener_de(proceso_id, cedula)
    if existente is not None:
        return existente
    _exigir_ventana(repo_proc, proceso_id, cedula, ahora)
    return repo_sol.crear(SolicitudFeDeVida(id='', proceso_id=proceso_id, cedula=cedula))


def guardar_borrador(
    repo_proc: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, repo_cambios: RepoCambiosActa,
    validador: ValidadorCambiosActa, *, solicitud_id: str, cedula: str, cambios: list[CambioActa], ahora: datetime,
) -> list[CambioActa]:
    """Reemplaza las respuestas del acta (cambios propuestos). Solo mientras es editable y hay plazo."""
    solicitud = obtener_solicitud_propia(repo_sol, solicitud_id, cedula, bloquear=True)
    if not solicitud.editable:
        raise ValidationError(f"La solicitud está {solicitud.estado.value}: ya no admite cambios.")
    _exigir_ventana(repo_proc, solicitud.proceso_id, cedula, ahora)
    vistos: set[tuple] = set()
    validados = []
    for c in cambios:
        clave = (c.entidad_destino, c.entidad_id, c.campo) if c.accion == 'MODIFICAR' else None
        if clave is not None:
            if clave in vistos:
                raise ValidationError(f"Cambio repetido para '{c.entidad_destino}.{c.campo}'.")
            vistos.add(clave)
        validado = validador.validar(cedula, c)
        if validado is not None:  # sin diferencia real con el dato actual: no se propone
            validados.append(validado)
    repo_cambios.reemplazar(solicitud.id, validados)
    return repo_cambios.listar(solicitud.id)


def subir_evidencia(
    repo_proc: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, storage: FileStorage,
    *, solicitud_id: str, cedula: str, contenido: bytes, mime: str, origen: str, metadatos: dict | None, ahora: datetime,
) -> SolicitudFeDeVida:
    """
    Guarda la selfie con la cédula en el almacenamiento seguro (la presentación ya validó firma de bytes y
    tamaño con `validar_archivo`). `origen` es CAMARA o ARCHIVO: ambas vías son equivalentes.
    """
    try:
        origen_ev = OrigenEvidencia(origen)
    except ValueError:
        raise ValidationError("El origen de la foto debe ser CAMARA o ARCHIVO.") from None
    if mime not in MIME_A_EXTENSION:
        raise ValidationError("La foto debe ser JPG o PNG.")
    if not contenido:
        raise ValidationError("La foto está vacía.")
    solicitud = obtener_solicitud_propia(repo_sol, solicitud_id, cedula, bloquear=True)
    if not solicitud.editable:
        raise ValidationError(f"La solicitud está {solicitud.estado.value}: no admite una nueva foto.")
    _exigir_ventana(repo_proc, solicitud.proceso_id, cedula, ahora)
    clave = f"fe_de_vida/{solicitud.id}/{solicitud.envios + 1}-{uuid.uuid4().hex}{MIME_A_EXTENSION[mime]}"
    storage.subir(clave, contenido, mime)  # si falla (AlmacenamientoNoDisponible) no se toca la solicitud
    meta = dict(metadatos or {})
    meta['origen'] = origen_ev.value
    actualizada = solicitud.con_evidencia(
        origen_ev, clave, hashlib.sha256(contenido).hexdigest(), mime, len(contenido), meta,
    )
    return repo_sol.guardar(actualizada, solicitud.version)


def enviar_solicitud(
    repo_proc: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, publicador: PublicadorEventos | None = None,
    *, solicitud_id: str, cedula: str, ahora: datetime,
) -> SolicitudFeDeVida:
    """BORRADOR o REPETICION_SOLICITADA -> PENDIENTE_REVISION; exige foto y proceso abierto o prórroga vigente."""
    solicitud = obtener_solicitud_propia(repo_sol, solicitud_id, cedula, bloquear=True)
    _exigir_ventana(repo_proc, solicitud.proceso_id, cedula, ahora)
    enviada = repo_sol.guardar(solicitud.enviar(ahora), solicitud.version)
    (publicador or PublicadorNulo()).publicar(evento(TipoEvento.SOLICITUD_ENVIADA, enviada, cedula, envio=enviada.envios))
    return enviada


def iniciar_solicitud_vigente(
    repo_proc: RepoProcesos, repo_sol: RepoSolicitudesFeDeVida, verificador: VerificadorPasivo,
    *, cedula: str, ahora: datetime,
) -> SolicitudFeDeVida:
    """Inicia (o devuelve) la solicitud del pasivo en el proceso vigente para él."""
    vigente = obtener_proceso_vigente(repo_proc, repo_sol, cedula=cedula, ahora=ahora)
    if vigente is None:
        raise ConflictError("No hay un proceso de fe de vida disponible para usted en este momento.")
    return iniciar_solicitud(
        repo_proc, repo_sol, verificador, proceso_id=vigente.proceso.id, cedula=cedula, ahora=ahora,
    )
