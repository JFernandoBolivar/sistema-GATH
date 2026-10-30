"""
Consultas de solicitudes, catálogo de secciones y datos complementarios (B3, B13).
"""
from datetime import date

from apps.autogestion.domain.entities.solicitud_actualizacion import (
    DatosComplementarios,
    SeccionAutogestionable,
    SoporteDocumental,
    SolicitudActualizacion,
)
from apps.autogestion.domain.ports.repo_solicitudes import (
    RepoDatosComplementarios,
    RepoSecciones,
    RepoSoportes,
    RepoSolicitudes,
)
from apps.autogestion.domain.services.validacion_cambios import validar_valor
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from core.domain.exceptions import NotFoundError, ValidationError

LIMITE_DEFECTO = 10
LIMITE_MAX = 50


def _listar_acotado(
    repo: RepoSolicitudes, *, estado: str | None, cedula: str | None, limite: int, desplazamiento: int,
    desde: date | None, hasta: date | None,
) -> tuple[list[SolicitudActualizacion], int]:
    """Filtros validados y página acotada en el servidor (10 por defecto, tope 50)."""
    if estado:
        try:
            estado = EstadoSolicitud(estado).value
        except ValueError:
            raise ValidationError(f"Estado inválido: '{estado}'.") from None
    if desde and hasta and desde > hasta:
        raise ValidationError("La fecha inicial no puede ser posterior a la final.")
    limite = max(1, min(limite, LIMITE_MAX))
    return repo.listar(estado, cedula, limite, max(0, desplazamiento), desde, hasta)


def listar_mis_solicitudes(
    repo: RepoSolicitudes, cedula: str, *, estado: str | None = None, desde: date | None = None,
    hasta: date | None = None, limite: int = LIMITE_DEFECTO, desplazamiento: int = 0,
) -> tuple[list[SolicitudActualizacion], int]:
    """Solicitudes de la cédula de la sesión (Zero-IDOR: la cédula nunca viene del cliente)."""
    return _listar_acotado(
        repo, estado=estado, cedula=cedula, limite=limite, desplazamiento=desplazamiento, desde=desde, hasta=hasta,
    )


def listar_bandeja(
    repo: RepoSolicitudes, *, estado: str | None, cedula: str | None, limite: int, desplazamiento: int,
    desde: date | None = None, hasta: date | None = None,
) -> tuple[list[SolicitudActualizacion], int]:
    return _listar_acotado(
        repo, estado=estado, cedula=(cedula or '').strip() or None, limite=limite, desplazamiento=desplazamiento,
        desde=desde, hasta=hasta,
    )


def listar_secciones(repo: RepoSecciones, solo_activas: bool = True) -> list[SeccionAutogestionable]:
    return repo.listar(solo_activas=solo_activas)


def configurar_seccion(
    repo: RepoSecciones, *, codigo: str, requiere_soporte: bool | None, activa: bool | None,
) -> SeccionAutogestionable:
    """Bienestar/Administradora ajusta si una sección exige soporte o está activa (no crea secciones nuevas)."""
    actual = repo.obtener(codigo)
    if actual is None:
        raise NotFoundError(f"La sección '{codigo}' no existe.")
    return repo.guardar(SeccionAutogestionable(
        codigo=actual.codigo, nombre=actual.nombre,
        requiere_soporte=actual.requiere_soporte if requiere_soporte is None else requiere_soporte,
        activa=actual.activa if activa is None else activa,
    ))


def obtener_datos_complementarios(repo: RepoDatosComplementarios, cedula: str) -> DatosComplementarios:
    return repo.obtener(cedula) or DatosComplementarios(cedula=cedula)


def guardar_datos_complementarios(
    repo: RepoDatosComplementarios, *, cedula: str, campos: dict, actor_cedula: str,
) -> DatosComplementarios:
    """Escritura directa por RRHH (la del trabajador pasa por la solicitud de actualización)."""
    permitidos = {'correo_alternativo', 'tiene_hijos'}
    ajenos = sorted(set(campos) - permitidos)
    if ajenos or not campos:
        raise ValidationError("Solo se admiten 'correo_alternativo' y 'tiene_hijos'.")
    limpios = {k: validar_valor(k, v) for k, v in campos.items()}
    return repo.guardar(cedula, limpios, actor_cedula)


def obtener_clave_soporte(repo: RepoSoportes, soporte_id: str, cedula: str, es_bienestar: bool) -> SoporteDocumental:
    """Soporte descargable solo por su dueño o por Bienestar; para cualquier otro, 404 (no revela existencia)."""
    soporte = repo.obtener(soporte_id)
    if soporte is None or not (es_bienestar or (cedula and soporte.subido_por == cedula)):
        raise NotFoundError("El soporte no existe.")
    return soporte
