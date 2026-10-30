"""
Caso de uso: alta automática de la cuenta de un trabajador (decisión F, D8).

- ACTIVO: cuando su `Employee.correo` es institucional (dominio de `DOMINIO_CORREO_INSTITUCIONAL`).
- PASIVO / sobreviviente: cuando RRHH le carga un correo (cualquier dominio).
Sin autorregistro. Si ya tiene cuenta no se duplica. Rol AUTOGESTION; contraseña inicial = la cédula,
con vencimiento a 7 días (los validadores de fortaleza no se aplican a esa clave inicial). Puro (B4).
"""
from datetime import datetime
from typing import Callable

from apps.identidad.application.dtos.cuenta_dto import RegistrarCuentaDTO
from apps.identidad.application.use_cases.registrar_usuario import registrar_usuario
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.events import EventoIdentidad, TipoEventoIdentidad
from apps.identidad.domain.ports.repo_condicion_trabajador import RepoCondicionTrabajador
from apps.identidad.domain.ports.repo_correo_acceso import RepoCorreoAcceso
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from apps.identidad.domain.ports.repo_password_inicial import RepoPasswordInicial
from apps.identidad.domain.services.politica_password_inicial import (
    DIAS_VIGENCIA_PASSWORD_INICIAL,
    ROL_AUTOGESTION_ID,
    es_correo_institucional,
    vencimiento_desde,
)
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador


def aprovisionar_cuenta_trabajador(
    repo_cuentas: RepoCuentas,
    repo_correo: RepoCorreoAcceso,
    repo_condicion: RepoCondicionTrabajador,
    repo_password_inicial: RepoPasswordInicial,
    publicar: Callable[[EventoIdentidad], None],
    cedula: str,
    dominio_institucional: str,
    ahora: datetime,
    permitir_pasivo: bool = False,
) -> Cuenta | None:
    """Crea la cuenta si corresponde; devuelve la cuenta nueva o None si no hacía falta/no aplica.

    `permitir_pasivo` solo lo activa la elección explícita de RRHH (endpoint `correo-acceso`): editar la ficha
    de un pasivo que ya trae correo personal no le crea cuenta."""
    cedula = str(cedula or '').strip()
    if not cedula:
        return None
    correo = repo_correo.correo_de(cedula)
    if not correo or repo_cuentas.existe_cuenta_para_cedula(cedula):
        return None

    condicion = repo_condicion.condicion_por_cedula(cedula)
    if condicion is CondicionTrabajador.PASIVO:
        if not permitir_pasivo:
            return None
        # RRHH eligió su correo de acceso: cualquier dominio
    elif condicion is CondicionTrabajador.ACTIVO and es_correo_institucional(correo, dominio_institucional):
        pass
    else:
        return None

    cuenta = registrar_usuario(
        repo_cuentas, RegistrarCuentaDTO(cedula=cedula, password=cedula, rol_id=ROL_AUTOGESTION_ID)
    )
    repo_password_inicial.emitir(cuenta.id, vencimiento_desde(ahora))
    publicar(EventoIdentidad(
        tipo=TipoEventoIdentidad.CUENTA_CREADA, cedula=cedula, dias_vigencia=DIAS_VIGENCIA_PASSWORD_INICIAL,
    ))
    return cuenta
