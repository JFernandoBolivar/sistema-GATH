"""
Casos de uso para verificación QR y preferencias de privacidad (O44 - E9).
Puro: sin framework ni dependencias externas.
"""
from typing import Any
from apps.carnetizacion.application.dtos.carnetizacion_dtos import FichaQrDTO
from apps.carnetizacion.domain.entities.privacidad import FichaQr
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from apps.carnetizacion.domain.value_objects.security_hash import normalizar_codigo_qr


def consultar_ficha_qr_uc(
    repo: RepoCarnetizacion,
    security_hash: str,
    usuario_sesion: Any | None = None,
    ip: str = "",
    user_agent: str = "",
    accion: str = "ESCANEO",
) -> FichaQrDTO:
    """Consulta la ficha institucional de un carnet aplicando el nivel de privacidad correspondiente.

    Un código que no es 22 base64url ni 64 hex se responde como NO_REGISTRADO sin tocar la BD.
    """
    if normalizar_codigo_qr(security_hash) != security_hash:
        return FichaQr(
            es_valido=False,
            estado='NO_REGISTRADO',
            mensaje='Carnet no encontrado en el sistema.',
        )
    return repo.consultar_ficha_qr(
        security_hash=security_hash,
        usuario_sesion=usuario_sesion,
        ip=ip,
        user_agent=user_agent,
        accion=accion,
    )


def obtener_privacidad_trabajador_uc(
    repo: RepoCarnetizacion,
    employee_id: int,
) -> dict[str, str]:
    """Obtiene las preferencias de visibilidad por dato configuradas por el titular."""
    return repo.obtener_preferencia_privacidad(employee_id=employee_id)


def guardar_privacidad_trabajador_uc(
    repo: RepoCarnetizacion,
    employee_id: int,
    preferencias: dict[str, str],
) -> dict[str, str]:
    """Guarda las preferencias de visibilidad por dato del titular tras validarlas."""
    return repo.guardar_preferencia_privacidad(
        employee_id=employee_id,
        preferencias=preferencias,
    )


def obtener_privacidad_por_cedula_uc(
    repo: RepoCarnetizacion,
    cedula: str,
) -> dict[str, str]:
    """Obtiene las preferencias de visibilidad por dato a partir de la cédula del titular."""
    return repo.obtener_privacidad_por_cedula(cedula=cedula)


def guardar_privacidad_por_cedula_uc(
    repo: RepoCarnetizacion,
    cedula: str,
    preferencias: dict[str, str],
) -> dict[str, str]:
    """Guarda las preferencias de visibilidad por dato a partir de la cédula del titular."""
    return repo.guardar_privacidad_por_cedula(cedula=cedula, preferencias=preferencias)
