"""O48: bloqueo por solicitud pendiente y espera tras aprobación (infraestructura)."""
from datetime import date, timedelta

from django.utils import timezone

from apps.autogestion.domain.value_objects.estado_solicitud import (
    ESTADOS_ABIERTOS,
    EstadoSolicitud,
)
from apps.autogestion.domain.value_objects.secciones import (
    CODIGOS_SECCIONES,
    SECCIONES_CATALOGO_INICIAL,
    seccion_de_clave,
)
from apps.autogestion.infrastructure.repositories.repo_solicitudes_orm import (
    RepoSolicitudesORM,
)
from apps.configuracion.domain.parametros import DEFINICIONES_POR_CLAVE
from core.domain.configuracion import (
    CLAVE_AUTOGESTION_BLOQUEO_PENDIENTE,
    CLAVE_AUTOGESTION_ESPERA_ACCIONES,
    CLAVE_AUTOGESTION_ESPERA_CONTACTO,
    CLAVE_AUTOGESTION_ESPERA_FORMACION,
    CLAVE_AUTOGESTION_ESPERA_IDENTIDAD,
    como_entero,
)
from core.infrastructure.providers import obtener_lector_configuracion

NOMBRES_SECCIONES = {
    codigo: nombre for codigo, nombre, _ in SECCIONES_CATALOGO_INICIAL
}
CLAVES_DIAS = {
    'contacto': CLAVE_AUTOGESTION_ESPERA_CONTACTO,
    'formacion': CLAVE_AUTOGESTION_ESPERA_FORMACION,
    'identidad': CLAVE_AUTOGESTION_ESPERA_IDENTIDAD,
}
ACCIONES_VALIDAS = ('corregir', 'quitar', 'agregar')


def _texto(clave: str) -> str:
    lector = obtener_lector_configuracion()
    if lector is not None:
        return lector.obtener_texto(clave)
    definicion = DEFINICIONES_POR_CLAVE.get(clave)
    return definicion.defecto if definicion is not None else ''


def _entero(clave: str) -> int:
    lector = obtener_lector_configuracion()
    if lector is not None:
        return lector.obtener_entero(clave)
    definicion = DEFINICIONES_POR_CLAVE.get(clave)
    return como_entero(definicion.defecto if definicion else '0', 0)


def bloqueo_alcance() -> str:
    valor = (_texto(CLAVE_AUTOGESTION_BLOQUEO_PENDIENTE) or 'registro').strip().lower()
    return valor if valor in ('registro', 'seccion', 'desactivado') else 'registro'


def espera_acciones() -> frozenset[str]:
    texto = _texto(CLAVE_AUTOGESTION_ESPERA_ACCIONES) or 'corregir,quitar'
    acciones = {
        parte.strip().lower()
        for parte in texto.replace(';', ',').split(',')
        if parte.strip().lower() in ACCIONES_VALIDAS
    }
    return frozenset(acciones)


def _seccion_de(clave: str) -> str | None:
    return seccion_de_clave(clave) or (
        clave if clave in CODIGOS_SECCIONES else None
    )


def bloqueos(cedula: str, alcance: str) -> list[dict]:
    """Solicitudes abiertas que impiden pedir los mismos campos o secciones."""
    if alcance not in ('registro', 'seccion'):
        return []
    filas, _ = RepoSolicitudesORM().listar(None, cedula, 200, 0)
    resultado: list[dict] = []
    for solicitud in filas:
        if solicitud.estado not in ESTADOS_ABIERTOS:
            continue
        fecha = solicitud.fecha_envio or solicitud.fecha_solicitud
        fecha_txt = fecha.strftime('%d/%m/%Y') if fecha else ''
        claves = (
            solicitud.secciones_solicitadas
            if alcance == 'seccion'
            else (solicitud.campos_solicitados or solicitud.secciones_solicitadas)
        )
        for clave in dict.fromkeys(claves):
            seccion = _seccion_de(clave)
            nombre = NOMBRES_SECCIONES.get(seccion or '', seccion or clave)
            resultado.append({
                'clave': clave,
                'seccion': seccion or '',
                'solicitud_id': str(solicitud.id),
                'fecha': fecha_txt,
                'alcance': alcance,
                'mensaje': (
                    f'Ya tienes una solicitud pendiente sobre {nombre}'
                    + (f' (enviada el {fecha_txt})' if fecha_txt else '')
                    + '.'
                ),
            })
    return resultado


def esperas(cedula: str, ahora: date | None = None) -> list[dict]:
    """Secciones aprobadas recientemente que aún deben esperar para volver a pedirse."""
    hoy = ahora or timezone.localdate()
    filas, _ = RepoSolicitudesORM().listar(None, cedula, 200, 0)
    hasta_por_seccion: dict[str, date] = {}
    for solicitud in filas:
        if solicitud.estado not in (EstadoSolicitud.APROBADA, EstadoSolicitud.APROBADA_PARCIAL):
            continue
        if solicitud.fecha_decision is None:
            continue
        aprobada = solicitud.fecha_decision.date()
        for seccion in solicitud.secciones_solicitadas:
            clave = CLAVES_DIAS.get(seccion)
            dias = _entero(clave) if clave else 0
            if dias <= 0:
                continue
            candidato = aprobada + timedelta(days=dias)
            if candidato >= hoy and candidato > hasta_por_seccion.get(seccion, date.min):
                hasta_por_seccion[seccion] = candidato
    resultado = []
    for seccion, hasta in hasta_por_seccion.items():
        resultado.append({
            'seccion': seccion,
            'hasta': hasta.isoformat(),
            'dias': (hasta - hoy).days,
            'acciones': sorted(espera_acciones()),
            'mensaje': (
                f'Podrás volver a solicitar cambios en '
                f'{NOMBRES_SECCIONES.get(seccion, seccion)} a partir del '
                f'{hasta.strftime("%d/%m/%Y")}.'
            ),
        })
    return resultado
