"""
Casos de uso del portal del trabajador: expediente completo y carnet propio.
Consolida datos de personal (básicos, cargo/laboral, vivienda, salud, educación),
cargas familiares y carnets. Todo se lee exclusivamente para la cédula del
usuario autenticado (Zero-IDOR) a través del puerto `RepoPortalTrabajador`.
"""
from dataclasses import dataclass, field
from typing import Any

from apps.autogestion.domain.ports.repo_portal_trabajador import RepoPortalTrabajador
from core.domain.exceptions import NotFoundError, PermissionDeniedError, ValidationError

MOTIVO_PRIMERA_EMISION = 1
MOTIVO_REPOSICION = 2
OBSERVACION_SOLICITUD_PORTAL = 'Solicitud desde Portal de Autogestión CONATEL'


def _es_primera_emision(motivo: dict) -> bool:
    """«Primera emisión» solo aplica a quien nunca ha tenido carnet."""
    texto = f"{motivo.get('nombre', '')} {motivo.get('descripcion', '')}"
    texto = texto.upper().replace('Ó', 'O').replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ú', 'U')
    return 'PRIMERA EMISION' in texto or 'PRIMERA VEZ' in texto


@dataclass(frozen=True)
class MiExpedienteDTO:
    empleado: Any
    familiares: list[Any]
    carnets: list[Any] = field(default_factory=list)
    motivos_carnet: list[dict] = field(default_factory=list)
    datos_complementarios: Any = None
    puede_ver_carnet: bool = False

    @property
    def carnet_activo(self):
        return next((c for c in self.carnets if getattr(c, 'activo', False)), None)


def _cedula_limpia(cedula: str) -> str:
    if not cedula or not str(cedula).strip():
        raise NotFoundError("La cédula del trabajador es obligatoria.")
    return str(cedula).strip()


def obtener_mi_expediente(repo: RepoPortalTrabajador, cedula: str) -> MiExpedienteDTO:
    cedula = _cedula_limpia(cedula)

    empleado = repo.obtener_empleado(cedula)
    if not empleado:
        raise NotFoundError(f"No se encontró el expediente del trabajador con cédula {cedula}.")

    puede_carnet = repo.puede_ver_carnet(cedula) if hasattr(repo, 'puede_ver_carnet') else False
    motivos = repo.listar_motivos_carnet() if puede_carnet else []
    # Quien ya tuvo un carnet no puede volver a pedir «primera emisión».
    if puede_carnet and hasattr(repo, 'tiene_carnet_previo') and repo.tiene_carnet_previo(cedula):
        motivos = [m for m in motivos if not _es_primera_emision(m)]
    return MiExpedienteDTO(
        empleado=empleado,
        familiares=repo.listar_familiares(cedula),
        carnets=repo.listar_carnets(cedula) if puede_carnet else [],
        motivos_carnet=motivos,
        datos_complementarios=repo.obtener_datos_complementarios(cedula),
        puede_ver_carnet=puede_carnet,
    )


def solicitar_mi_carnet(
    repo: RepoPortalTrabajador, cedula: str, motivo_id: Any = None, observaciones: str | None = None
):
    """Emite el carnet del propio trabajador; sin motivo, 1ª emisión o reposición según su historial."""
    cedula = _cedula_limpia(cedula)
    if hasattr(repo, 'puede_ver_carnet') and not repo.puede_ver_carnet(cedula):
        raise PermissionDeniedError("El módulo de carnet institucional no está habilitado para su usuario.")
    if motivo_id in (None, ''):
        motivo_id = MOTIVO_REPOSICION if repo.tiene_carnet_previo(cedula) else MOTIVO_PRIMERA_EMISION
    try:
        motivo_id = int(motivo_id)
    except (TypeError, ValueError):
        raise ValidationError("El motivo de emisión no es válido.") from None
    if motivo_id == MOTIVO_PRIMERA_EMISION and repo.tiene_carnet_previo(cedula):
        raise ValidationError(
            "Usted ya posee un carnet institucional. Seleccione renovación, reposición o actualización."
        )
    return repo.emitir_carnet(cedula, motivo_id, observaciones or OBSERVACION_SOLICITUD_PORTAL)


def obtener_mi_carnet_pdf(repo: RepoPortalTrabajador, cedula: str) -> bytes:
    cedula = _cedula_limpia(cedula)
    if hasattr(repo, 'puede_ver_carnet') and not repo.puede_ver_carnet(cedula):
        raise PermissionDeniedError("El módulo de carnet institucional no está habilitado para su usuario.")
    pdf = repo.generar_pdf_carnet_activo(cedula)
    if pdf is None:
        raise NotFoundError("No posee carnet activo emitido.")
    return pdf
