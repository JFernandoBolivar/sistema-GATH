"""
Caso de uso: RRHH elige el correo de acceso de un trabajador (pase a pasivo, decisión F, D8).

Opciones: el institucional actual (`Employee.correo`, sin cambios), el alternativo declarado en
`datos_complementarios_trabajador` (B13) o un correo explícito. `Employee.correo` es único: si otro
empleado ya lo usa se rechaza. El aviso va al correo elegido; si el cambio provoca el alta de la
cuenta (pasivo o sobreviviente sin cuenta) el aviso es el de «cuenta creada». Puro (B4).
"""
from dataclasses import dataclass
from typing import Callable

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.resolver_permisos import resolver_politica_actor
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.events import EventoIdentidad, TipoEventoIdentidad
from apps.identidad.domain.ports.repo_correo_acceso import RepoCorreoAcceso
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from apps.identidad.domain.ports.repo_permisos import RepoPermisos
from apps.identidad.domain.services.reglas_administracion import (
    validar_operacion_sobre_cuenta_administrativa,
)
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

FUENTES = ('INSTITUCIONAL', 'ALTERNATIVO', 'OTRO')


@dataclass(frozen=True)
class ResultadoCorreoAcceso:
    correo: str
    cuenta_creada: bool
    avisado: bool


def cambiar_correo_acceso(
    repo_correo: RepoCorreoAcceso,
    repo_cuentas: RepoCuentas,
    publicar: Callable[[EventoIdentidad], None],
    aprovisionar: Callable[[str], object],
    cedula: str,
    fuente: str,
    correo: str | None = None,
    *,
    repo_permisos: RepoPermisos,
    actor: ActorSesionDTO,
) -> ResultadoCorreoAcceso:
    if fuente not in FUENTES:
        raise ValidationError('Fuente de correo no válida: use INSTITUCIONAL, ALTERNATIVO u OTRO.')
    if not repo_correo.existe_empleado(cedula):
        raise NotFoundError(f"La cédula '{cedula}' no pertenece a ningún empleado registrado.")
    objetivo = repo_permisos.obtener_permisos_usuario(cedula)
    validar_operacion_sobre_cuenta_administrativa(
        politica_actor=resolver_politica_actor(repo_permisos, actor),
        politica_objetivo=objetivo.politica_efectiva if objetivo else PoliticaAcceso(),
        operacion='cambiar el correo de acceso de',
    )

    tenia_cuenta = repo_cuentas.existe_cuenta_para_cedula(cedula)  # antes de tocar el correo
    actual = repo_correo.correo_de(cedula)
    if fuente == 'INSTITUCIONAL':
        nuevo = actual
    elif fuente == 'ALTERNATIVO':
        nuevo = repo_correo.correo_alternativo_de(cedula)
    else:
        nuevo = (correo or '').strip()
    if not nuevo or '@' not in nuevo:
        raise ValidationError('No hay un correo válido para esa opción.')

    if nuevo.lower() != actual.lower():
        if repo_correo.correo_en_uso_por_otro(cedula, nuevo):
            raise ConflictError('Ese correo ya es el correo de acceso de otro trabajador.')
        repo_correo.establecer_correo(cedula, nuevo)

    aprovisionar(cedula)  # idempotente: si el post_save de Employee ya la creó, no duplica
    existe_ahora = repo_cuentas.existe_cuenta_para_cedula(cedula)
    if not existe_ahora and fuente == 'INSTITUCIONAL':
        # «Crear cuenta con este correo» desde Usuarios (QA 2026-11-03): si la regla no permite la
        # cuenta, se dice claro en vez de responder «registrado» sin haber creado nada.
        raise ValidationError(
            'No se creó la cuenta: el trabajador no tiene una asignación activa ni de pasivo vigente.'
        )
    cuenta_creada = existe_ahora and not tenia_cuenta
    avisado = cuenta_creada  # el alta ya publicó su propio aviso al correo elegido
    if tenia_cuenta:
        publicar(EventoIdentidad(tipo=TipoEventoIdentidad.CORREO_ACCESO_CAMBIADO, cedula=cedula))
        avisado = True
    return ResultadoCorreoAcceso(correo=nuevo, cuenta_creada=cuenta_creada, avisado=avisado)
