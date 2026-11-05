"""
Emisión de la constancia de fe de vida (C4, PLAN §2.11): al VALIDARSE la solicitud se numera, se genera el
PDF y se guarda en el almacén privado. Sin firma ni sello: certifican el nombre y la cédula de quien aprobó.
Sin Django.
"""
from dataclasses import replace
from datetime import datetime

from apps.fe_de_vida.application.use_cases._comun import obtener_proceso, obtener_solicitud
from apps.fe_de_vida.domain.entities.constancia import Certificador, ConstanciaFeDeVida
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida
from apps.fe_de_vida.domain.events import EventoFeDeVida, TipoEvento
from apps.fe_de_vida.domain.ports.repos import (
    GeneradorConstancia,
    LectorPasivos,
    RepoConstancias,
    RepoProcesos,
    RepoSolicitudesFeDeVida,
)
from apps.fe_de_vida.domain.services.constancia import enmascarar_correo, texto_constancia
from apps.fe_de_vida.domain.services.notificaciones_eventos import notificacion_validada
from apps.fe_de_vida.domain.value_objects.estados import EstadoSolicitud, TipoDecision, ViaAprobacion
from core.domain.exceptions import ConflictError
from core.domain.ports import FileStorage, Notificador

MIME_PDF = 'application/pdf'
PREFIJO_CLAVE_PDF = 'fe_de_vida/constancias'
LIMITE_REENVIOS_DIARIOS = 3


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


def reenviar_constancia(
    repo_sol: RepoSolicitudesFeDeVida,
    repo_const: RepoConstancias,
    repo_proc: RepoProcesos,
    lector: LectorPasivos,
    notificador: Notificador,
    *,
    solicitud_id: str,
    actor_cedula: str,
    ahora: datetime,
) -> dict:
    """
    Reenvía el correo con el PDF al correo de acceso del pasivo (+ copia al alternativo si es distinto).
    Límite de 3 reenvíos por día por constancia.
    """
    solicitud = obtener_solicitud(repo_sol, solicitud_id)
    if solicitud.estado is not EstadoSolicitud.VALIDADA:
        raise ConflictError("Solo una solicitud VALIDADA permite reenviar la constancia.")
    constancia = repo_const.obtener_de_solicitud(solicitud.id)
    if constancia is None or not constancia.clave_pdf:
        raise ConflictError("La constancia aún no ha sido emitida o no tiene archivo PDF disponible.")

    hoy = ahora.date()
    conteo = repo_const.contar_reenvios_hoy(constancia.id, hoy)
    if conteo >= LIMITE_REENVIOS_DIARIOS:
        raise ConflictError("Se ha alcanzado el límite de 3 reenvíos por día para esta constancia.")

    pasivo = lector.datos(solicitud.cedula)
    correo_destino = (pasivo.correo or '').strip()
    if not correo_destino:
        raise ConflictError("El pasivo no tiene correo de acceso registrado para recibir la constancia.")

    correo_alt = (pasivo.correo_alternativo or '').strip()
    copia = (correo_alt,) if correo_alt and correo_alt != correo_destino else ()

    evento = EventoFeDeVida(
        solicitud_id=solicitud.id,
        proceso_id=solicitud.proceso_id,
        cedula=solicitud.cedula,
        tipo=TipoEvento.VALIDADA,
        actor_cedula=actor_cedula,
        detalle={'reenvio': True},
    )
    proceso = repo_proc.obtener(solicitud.proceso_id)
    notificacion = notificacion_validada(
        evento,
        numero=constancia.numero,
        proceso_nombre=proceso.nombre if proceso else '',
        clave_pdf=constancia.clave_pdf,
        nombre_pdf=f'{constancia.numero}.pdf',
        correos_copia=copia,
    )
    notificador.notificar(notificacion)
    repo_const.registrar_reenvio(
        constancia.id,
        actor_cedula,
        correo_destino,
        copia[0] if copia else '',
        hoy,
    )
    return {
        'numero': constancia.numero,
        'destinatario': correo_destino,
        'destinatario_enmascarado': enmascarar_correo(correo_destino),
        'copia': copia[0] if copia else None,
        'copia_enmascarada': enmascarar_correo(copia[0]) if copia else None,
        'reenvios_hoy': conteo + 1,
        'limite_diario': LIMITE_REENVIOS_DIARIOS,
    }


def regenerar_constancia(
    repo_proc: RepoProcesos,
    repo_sol: RepoSolicitudesFeDeVida,
    repo_const: RepoConstancias,
    lector: LectorPasivos,
    generador: GeneradorConstancia,
    storage: FileStorage,
    *,
    solicitud_id: str,
    url_verificacion_base: str,
    ahora: datetime,
) -> ConstanciaFeDeVida:
    """
    Regenera el PDF con el MISMO número y código de verificación, plantilla y URL de verificación vigentes.
    Actualiza la versión de plantilla de la constancia si es diferente a la activa.
    """
    solicitud = obtener_solicitud(repo_sol, solicitud_id)
    if solicitud.estado is not EstadoSolicitud.VALIDADA:
        raise ConflictError("Solo una solicitud VALIDADA permite regenerar la constancia.")
    constancia = repo_const.obtener_de_solicitud(solicitud.id)
    if constancia is None:
        raise ConflictError("La constancia no existe para esta solicitud.")
    plantilla = repo_const.plantilla_activa()
    if plantilla is None:
        raise ConflictError("No hay una plantilla de constancia activa.")

    fecha = solicitud.fecha_validacion or ahora
    pasivo = lector.datos(solicitud.cedula)
    pdf = generador.generar(
        constancia=constancia,
        plantilla=plantilla,
        texto=texto_constancia(plantilla, pasivo, fecha),
        proceso_nombre=obtener_proceso(repo_proc, solicitud.proceso_id).nombre,
        emitida_en=constancia.emitida_en or ahora,
        via_directa=solicitud.via_aprobacion is ViaAprobacion.DIRECTA_ADMINISTRADORA,
        url_verificacion=f'{url_verificacion_base.rstrip("/")}/{constancia.codigo_verificacion}',
    )
    clave = f'{PREFIJO_CLAVE_PDF}/{constancia.numero}.pdf'
    storage.subir(clave, pdf, MIME_PDF)
    if constancia.plantilla_version != plantilla.version:
        repo_const.actualizar_plantilla_version(constancia.id, plantilla.version)
        constancia = replace(constancia, plantilla_version=plantilla.version, clave_pdf=clave)
    else:
        constancia = replace(constancia, clave_pdf=clave)
    return constancia

