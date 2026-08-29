"""
Autorización por código de permiso (Contrato C-3, B2.5 + B3.2).

`HasPermission("modulo.accion")` y `IsOwnerOrHasPermission` son *fábricas*:
se invocan con el código en el cuerpo de la vista y devuelven una clase de
permiso, tal como espera `permission_classes` de DRF.

    permission_classes = [IsAuthenticated, HasPermission('personal.crear')]

Desde B3.2 la verificación consulta, vía el puerto
`core.domain.ports.ResolutorPermisos`, la matriz de permisos del dominio que
implementa `apps.identidad` (registrada en `AppConfig.ready()`). Si no hay
resolutor registrado se deniega con 403 y el incidente se registra en
`security_backend.txt` — fallo cerrado (regla S2).
"""
import logging

from rest_framework.permissions import BasePermission

from core.infrastructure.providers import obtener_resolutor_permisos

# Canal de seguridad (settings.LOGGING → logs/backend/security_backend.txt).
logger_seguridad = logging.getLogger('security_backend')


def _cedula_de_usuario(user) -> str:
    """Cédula del titular autenticado, o cadena vacía si no se pudo resolver."""
    return (
        getattr(getattr(user, 'cedula', None), 'cedulaidentidad', None)
        or str(getattr(user, 'cedula_id', getattr(user, 'cedula', '')))
    )


def _usuario_tiene_permiso(user, codigo: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    resolutor_legado = getattr(user, 'tiene_permiso', None)
    if callable(resolutor_legado):
        return bool(resolutor_legado(codigo))
    resolutor = obtener_resolutor_permisos()
    if resolutor is None:
        # Sin proveedor registrado no hay de dónde leer la matriz: deniega y
        # deja rastro en security_backend.txt (B3.2, regla S2).
        logger_seguridad.warning(
            'HasPermission("%s") denegado: sin resolutor de permisos registrado '
            '(apps.identidad no cargó su implementación).',
            codigo,
        )
        return False
    cedula = _cedula_de_usuario(user)
    return bool(
        resolutor.tiene_permiso(
            actor_id=getattr(user, 'pk', None),
            rol_id=getattr(user, 'rol_id', None),
            codigo=codigo,
            cedula=cedula or None,
        )
    )


# Alias público para chequeos programáticos en vistas/servicios
usuario_tiene_permiso = _usuario_tiene_permiso


def HasPermission(codigo: str):
    """Devuelve una clase de permiso DRF ligada al código `[modulo].[accion]`."""

    class _HasPermission(BasePermission):
        message = f"No posee el permiso requerido: '{codigo}'."

        def has_permission(self, request, view) -> bool:
            return _usuario_tiene_permiso(request.user, codigo)

    _HasPermission.__name__ = f'HasPermission_{codigo.replace(".", "_")}'
    return _HasPermission


def IsOwnerOrHasPermission(codigo: str, campo_propietario: str = 'cuenta_id'):
    """
    Autoriza si el usuario es propietario del objeto (`obj.<campo_propietario>`
    coincide con `request.user.id`) o si posee el código de permiso indicado.

    Uso típico: endpoints de autogestión donde el propio empleado consulta o
    edita su expediente (ALTA-07).
    """

    class _IsOwnerOrHasPermission(BasePermission):
        message = f"Debe ser propietario del recurso o poseer el permiso '{codigo}'."

        def has_permission(self, request, view) -> bool:
            return bool(request.user and request.user.is_authenticated)

        def has_object_permission(self, request, view, obj) -> bool:
            propietario_id = getattr(obj, campo_propietario, None)
            if propietario_id is not None and propietario_id == request.user.id:
                return True
            return _usuario_tiene_permiso(request.user, codigo)

    _IsOwnerOrHasPermission.__name__ = f'IsOwnerOrHasPermission_{codigo.replace(".", "_")}'
    return _IsOwnerOrHasPermission


def EsPropiaCedulaOTienePermiso(codigo_propio: str, codigo_bypass: str | None = None, kwarg: str = 'cedula'):
    """
    Autoriza si la cédula en la URL (`view.kwargs[kwarg]`) es la del usuario
    autenticado y este posee `codigo_propio`, o si posee `codigo_bypass`
    (acceso a cédulas ajenas, típicamente RRHH/administración). Sin
    `codigo_bypass`, el acceso a cédulas ajenas queda denegado sin excepción.

    Pensado para recursos identificados directamente por cédula en la ruta
    (p.ej. `/autogestion/censo/<cedula>/`), donde `IsOwnerOrHasPermission` no
    aplica: no hay un objeto ORM con un campo `cuenta_id` que comparar, y la
    vista es un `APIView` plano que nunca dispara `has_object_permission`
    (eso solo ocurre si la vista llama `check_object_permissions()` sobre un
    objeto obtenido, como hacen `generics`/`ViewSet`). Corrige ALTA-07.
    """

    class _EsPropiaCedulaOTienePermiso(BasePermission):
        message = (
            f"Debe ser la cédula propia (con '{codigo_propio}')"
            + (f" o poseer '{codigo_bypass}'." if codigo_bypass else '.')
        )

        def has_permission(self, request, view) -> bool:
            if not request.user or not request.user.is_authenticated:
                return False
            cedula_solicitada = view.kwargs.get(kwarg)
            if cedula_solicitada is not None and cedula_solicitada == _cedula_de_usuario(request.user):
                return _usuario_tiene_permiso(request.user, codigo_propio)
            if codigo_bypass is None:
                logger_seguridad.warning(
                    'EsPropiaCedulaOTienePermiso("%s") denegado: %s intentó acceder '
                    'a la cédula %s sin código de bypass configurado.',
                    codigo_propio, getattr(request.user, 'pk', None), cedula_solicitada,
                )
                return False
            return _usuario_tiene_permiso(request.user, codigo_bypass)

    _EsPropiaCedulaOTienePermiso.__name__ = f'EsPropiaCedulaOTienePermiso_{codigo_propio.replace(".", "_")}'
    return _EsPropiaCedulaOTienePermiso
