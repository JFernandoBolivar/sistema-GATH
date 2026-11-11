"""
Reglas de administración de usuarios y permisos (D4), puras y sin Django.

Aquí viven las garantías a), b) y c) exigidas por el plan, y las reglas
adicionales de la revisión de seguridad:

- a) Nadie puede quitarse su propio acceso a la administración ni desactivar su
  propia cuenta.
- b) Siempre queda al menos una cuenta activa con permiso para editar la matriz
  (`identidad.asignar_permisos`); si un cambio dejaría cero, se rechaza con 409.
- c) Nadie puede otorgarse permisos individuales ni cambiarse su propio rol;
  otra persona con permiso debe hacerlo.
- A1/A2: solo un administrador puede restablecer el acceso o cambiar el correo
  de acceso de una cuenta con permisos de administración.
- M3: nadie asigna un rol con permisos de administración que él mismo no tenga
  todos.
- M4: el actor no puede modificar la fila de matriz de su propio rol.

Las reglas se aplican en el dominio (no en la vista ni en el frontend) y los
casos de uso/vistas las invocan antes de persistir. La evaluación de permisos
efectivos (incluido *deny* explícito) no se reimplementa: se delega en
`evaluar_permiso`.
"""
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.services.evaluador_permisos import evaluar_permiso
from core.domain.exceptions import ConflictError, PermissionDeniedError

PERMISO_EDITAR_MATRIZ = 'identidad.asignar_permisos'
PERMISO_GESTIONAR_OVERRIDES = 'identidad.gestionar_permisos_individuales'

# Lista NOMBRADA de permisos que convierten una cuenta en «cuenta con permisos
# de administración» (A1/A2/M3). Es la fuente única: no se escriben literales
# sueltos en las vistas.
PERMISOS_ADMINISTRACION = (
    PERMISO_EDITAR_MATRIZ,
    PERMISO_GESTIONAR_OVERRIDES,
    'identidad.crear_usuarios',
    'identidad.editar_usuarios',
    'identidad.restablecer_acceso',
    'identidad.cambiar_correo_acceso',
    'configuracion.editar',
    'personal.corregir_cedula',
)


def validar_concesion_administracion(
    *,
    politica_actor: PoliticaAcceso,
    codigos_agregados: frozenset[str],
) -> None:
    """Nadie concede un permiso de administración que él mismo no tenga.

    Se aplica al agregar códigos en la matriz de cualquier rol y al agregar
    códigos como `allow` individual. Quitar permisos o conceder permisos
    operativos no se bloquea aquí.
    """
    faltantes = sorted(
        codigo
        for codigo in codigos_agregados
        if codigo in PERMISOS_ADMINISTRACION
        and not evaluar_permiso(politica_actor, codigo)
    )
    if faltantes:
        raise PermissionDeniedError(
            'No puede conceder permisos de administración que usted no tiene: '
            f'{", ".join(faltantes)}.'
        )


def es_cuenta_administrativa(politica: PoliticaAcceso) -> bool:
    """¿La política efectiva concede ALGUNO de los permisos de administración?"""
    return any(evaluar_permiso(politica, codigo) for codigo in PERMISOS_ADMINISTRACION)


def es_administrador(politica: PoliticaAcceso) -> bool:
    """¿La política efectiva concede TODOS los permisos de administración?

    Es la condición del actor para operar sobre una cuenta administrativa
    (A1/A2): un ANALISTA con `restablecer_acceso` no alcanza este umbral.
    """
    return all(evaluar_permiso(politica, codigo) for codigo in PERMISOS_ADMINISTRACION)


def permisos_administracion_de(politica: PoliticaAcceso) -> frozenset[str]:
    """Subconjunto de PERMISOS_ADMINISTRACION que la política concede."""
    return frozenset(
        codigo for codigo in PERMISOS_ADMINISTRACION if evaluar_permiso(politica, codigo)
    )


def validar_operacion_sobre_cuenta_administrativa(
    *,
    politica_actor: PoliticaAcceso,
    politica_objetivo: PoliticaAcceso,
    operacion: str,
) -> None:
    """A1/A2: para operar sobre una cuenta administrativa hay que ser administrador.

    Las cuentas de trabajadores y pasivos comunes (sin permisos de
    administración) pueden seguir siendo atendidas por RRHH con
    `identidad.restablecer_acceso` / `identidad.cambiar_correo_acceso`.
    """
    if es_cuenta_administrativa(politica_objetivo) and not es_administrador(politica_actor):
        raise PermissionDeniedError(
            f'Solo un administrador puede {operacion} una cuenta con permisos de '
            'administración.'
        )


def validar_asignacion_rol(
    *,
    politica_actor: PoliticaAcceso,
    codigos_rol_destino: frozenset[str],
    rol_id: int | None,
) -> None:
    """M3: no se asigna un rol administrativo si al actor le falta alguno de sus permisos.

    «Faltan todos» se evalúa contra la política efectiva del actor (rol +
    overrides + deny), no contra su rol nominal.
    """
    if rol_id is None:
        return
    requeridos = permisos_administracion_de(
        PoliticaAcceso(allow=frozenset(codigos_rol_destino))
    )
    faltantes = sorted(
        codigo for codigo in requeridos if not evaluar_permiso(politica_actor, codigo)
    )
    if faltantes:
        raise PermissionDeniedError(
            'No puede asignar ese rol: le faltan permisos de administración que el rol '
            f'concede ({", ".join(faltantes)}).'
        )


def validar_matriz_propia(*, rol_actor_id: int | None, rol_objetivo_id: int) -> None:
    """M4: el actor no puede modificar la matriz de su propio rol.

    Evita la escalada indirecta (agregarse permisos a través de su rol) y el
    auto-bloqueo (quitarse el acceso editando su propia fila).
    """
    if rol_actor_id is not None and rol_actor_id == rol_objetivo_id:
        raise PermissionDeniedError(
            'No puede modificar la matriz de su propio rol. Otro administrador debe hacerlo.'
        )


def validar_cambio_estado(*, actor_id: int | None, objetivo_id: int, is_active: bool) -> None:
    """a) La propia cuenta no puede desactivarse (ni bloquearse) a sí misma."""
    if actor_id is not None and actor_id == objetivo_id and is_active is False:
        raise PermissionDeniedError(
            'No puede desactivar su propia cuenta. Otro administrador debe hacerlo.'
        )


def validar_cambio_rol(*, actor_id: int | None, objetivo_id: int, cambia_rol: bool) -> None:
    """c) Nadie se cambia su propio rol: eso lo hace otra persona con permiso."""
    if cambia_rol and actor_id is not None and actor_id == objetivo_id:
        raise PermissionDeniedError(
            'No puede cambiar su propio rol. Otro administrador debe hacerlo.'
        )


def validar_override_propio(*, actor_cedula: str | None, objetivo_cedula: str) -> None:
    """c) Nadie se otorga (ni se quita) permisos individuales a sí mismo."""
    if actor_cedula and actor_cedula == objetivo_cedula:
        raise PermissionDeniedError(
            'No puede modificar sus propios permisos individuales. '
            'Otro administrador debe hacerlo.'
        )


def exigir_al_menos_un_editor_matriz(*, antes: int, despues: int) -> None:
    """b) Si había editores y el cambio deja cero cuentas activas, se rechaza (409).

    Si el sistema ya venía sin editores (por ejemplo, una base recién creada
    antes de correr el seed), no se bloquea una operación que no lo empeora;
    la comprobación impide *causar* el estado inválido, no arreglarlo.
    """
    if antes >= 1 and despues < 1:
        raise ConflictError(
            'El cambio dejaría al sistema sin ninguna cuenta activa con permiso para '
            'editar la matriz de permisos. Asigne ese permiso a otra cuenta activa primero.'
        )
