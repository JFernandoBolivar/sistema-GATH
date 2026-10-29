"""
Casos de uso del portal del trabajador: expediente completo y carnet propio.
Consolida datos de personal (básicos, cargo/laboral, vivienda, salud, educación),
cargas familiares y carnets. Todo se lee exclusivamente para la cédula del
usuario autenticado (Zero-IDOR) a través del puerto `RepoPortalTrabajador`.
"""
from dataclasses import dataclass, field
from typing import Any

from apps.autogestion.domain.ports.repo_portal_trabajador import RepoPortalTrabajador
from core.domain.exceptions import NotFoundError, ValidationError

MOTIVO_PRIMERA_EMISION = 1
MOTIVO_REPOSICION = 2
OBSERVACION_SOLICITUD_PORTAL = 'Solicitud desde Portal de Autogestión CONATEL'


@dataclass(frozen=True)
class MiExpedienteDTO:
    empleado: Any
    familiares: list[Any]
    carnets: list[Any] = field(default_factory=list)
    motivos_carnet: list[dict] = field(default_factory=list)
    datos_complementarios: Any = None

    @property
    def carnet_activo(self):
        return next((c for c in self.carnets if getattr(c, 'activo', False)), (self.carnets[0] if self.carnets else None))


def _cedula_limpia(cedula: str) -> str:
    if not cedula or not str(cedula).strip():
        raise NotFoundError("La cédula del trabajador es obligatoria.")
    return str(cedula).strip()


def obtener_mi_expediente(repo: RepoPortalTrabajador, cedula: str) -> MiExpedienteDTO:
    cedula = _cedula_limpia(cedula)

    empleado = repo.obtener_empleado(cedula)
    if not empleado:
        raise NotFoundError(f"No se encontró el expediente del trabajador con cédula {cedula}.")

    return MiExpedienteDTO(
        empleado=empleado,
        familiares=repo.listar_familiares(cedula),
        carnets=repo.listar_carnets(cedula),
        motivos_carnet=repo.listar_motivos_carnet(),
        datos_complementarios=repo.obtener_datos_complementarios(cedula),
    )


def solicitar_mi_carnet(
    repo: RepoPortalTrabajador, cedula: str, motivo_id: Any = None, observaciones: str | None = None
):
    """Emite el carnet del propio trabajador; sin motivo, 1ª emisión o reposición según su historial."""
    cedula = _cedula_limpia(cedula)
    if motivo_id in (None, ''):
        motivo_id = MOTIVO_REPOSICION if repo.tiene_carnet_previo(cedula) else MOTIVO_PRIMERA_EMISION
    try:
        motivo_id = int(motivo_id)
    except (TypeError, ValueError):
        raise ValidationError("El motivo de emisión no es válido.") from None
    return repo.emitir_carnet(cedula, motivo_id, observaciones or OBSERVACION_SOLICITUD_PORTAL)


def obtener_mi_carnet_pdf(repo: RepoPortalTrabajador, cedula: str) -> bytes:
    pdf = repo.generar_pdf_carnet_activo(_cedula_limpia(cedula))
    if pdf is None:
        raise NotFoundError("No posee carnet activo emitido.")
    return pdf
