"""
Ayudas compartidas de las vistas de fe de vida: identidad de sesión, validación de entrada (cuerpo y
parámetros), reloj, rol de revisión y auditoría. Las vistas no tocan el ORM (B7).
"""
import uuid
from datetime import datetime, timezone

from apps.fe_de_vida.application.use_cases._comun import normalizar_pagina
from apps.fe_de_vida.domain.entities.solicitud import ActorRevision, SolicitudFeDeVida
from apps.fe_de_vida.domain.value_objects.estados import RolRevision
from apps.fe_de_vida.presentation.permissions import fe_de_vida_permissions as permisos
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import pagina
from core.domain.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from core.infrastructure.error_utils import extract_first_error
from core.infrastructure.models.auditoria import AuditoriaLog
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.permissions import usuario_tiene_permiso

MODULO_AUDITORIA = 'fe_de_vida'
RECURSO_SOLICITUD = 'SolicitudFeDeVida'
RECURSO_PROCESO = 'ProcesoFeDeVida'
RECURSO_COBERTURA = 'CoberturaFeDeVida'


def cedula_de_sesion(request) -> str:
    """Zero-IDOR: la cédula SIEMPRE sale de la sesión autenticada, nunca del cuerpo ni de la URL."""
    cedula = getattr(request.user, 'cedula_id', None)
    if not cedula:
        raise NotFoundError("El usuario autenticado no tiene un expediente de trabajador asociado.")
    return str(cedula)


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def validar_entrada(serializer_cls, data):
    """Valida y devuelve `validated_data`; el primer error llega al cliente como 400 legible."""
    serializer = serializer_cls(data=data)
    if not serializer.is_valid():
        errores = serializer.errors
        campo = next(iter(errores), '')
        detalle = extract_first_error(errores)
        raise ValidationError(f"{campo}: {detalle}" if campo and campo != 'non_field_errors' else detalle)
    return serializer.validated_data


def parametros_pagina(datos) -> tuple[int, int]:
    """(limite, desplazamiento) ya normalizados: 10 por defecto, tope 50."""
    return normalizar_pagina(datos.get('limit'), datos.get('offset'))


def respuesta_pagina(total: int, datos_consulta, resultados: list) -> dict:
    limite, desplazamiento = parametros_pagina(datos_consulta)
    return pagina(total, limite, desplazamiento, resultados)


def nombres_de_tipos(*procesos) -> dict[int, str]:
    """Nombre de cada tipo de pensión citado por los procesos (una sola consulta)."""
    from apps.fe_de_vida.infrastructure.repositories.lector_alcance_orm import LectorAlcanceORM

    ids = sorted({t for p in procesos for t in p.tipos_nomina})
    return LectorAlcanceORM().nombres_tipos(ids) if ids else {}


def rol_de_revision(request, *, exigir_check: bool = False) -> RolRevision:
    """
    Rol con que actúa el revisor, derivado de su PERMISO (no de un nombre de rol). Un revisor sin ningún
    check (solo `fe_de_vida.revisar`) actúa como Analista, salvo que se exija un check.
    """
    if usuario_tiene_permiso(request.user, permisos.CHECK_ADMINISTRADORA):
        return RolRevision.ADMINISTRADORA
    if usuario_tiene_permiso(request.user, permisos.CHECK_ANALISTA) or not exigir_check:
        return RolRevision.ANALISTA
    raise PermissionDeniedError("No posee un permiso de check de fe de vida.")


def actor_revision(request, *, exigir_check: bool = False) -> ActorRevision:
    return ActorRevision(cedula_de_sesion(request), rol_de_revision(request, exigir_check=exigir_check))


def auditar(
    request, accion: str, recurso_id: str, previo: dict | None = None, nuevo: dict | None = None,
    *, recurso_tipo: str = RECURSO_SOLICITUD, resultado: str = AuditoriaLog.Resultado.SUCCESS,
) -> None:
    user = request.user
    rol = getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''
    registrar_auditoria(
        trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
        actor_id=getattr(user, 'pk', None), actor_cedula=str(getattr(user, 'cedula_id', '') or ''), actor_rol=rol,
        accion=accion, modulo=MODULO_AUDITORIA, recurso_tipo=recurso_tipo, recurso_id=str(recurso_id),
        estado_previo=previo, estado_nuevo=nuevo, resultado=resultado, **origen_de_peticion(request),
    )


def resumen(s: SolicitudFeDeVida) -> dict:
    """Estado mínimo de la solicitud para la bitácora (sin datos personales ni rutas)."""
    return {'estado': s.estado.value, 'version': s.version, 'envios': s.envios}
