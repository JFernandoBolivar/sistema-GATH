"""
Casos de uso de administración de usuarios y de la matriz de permisos (D4).

Puros: reciben los puertos por inyección (B4/B21). Las reglas a), b) y c)
viven en `domain/services/reglas_administracion.py`; la evaluación del permiso
efectivo se delega siempre en el motor IAM (`UsuarioPermisos.tiene_permiso`),
de modo que un `deny` explícito sigue ganando.
"""
from dataclasses import replace

from apps.identidad.application.dtos.administracion_dto import (
    ColumnaRol,
    DetalleUsuario,
    FilaMatriz,
    GuardarMatrizDTO,
    GuardarOverridesDTO,
    MatrizPermisos,
    PaginaUsuarios,
    PermisosUsuarioVista,
)
from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.resolver_permisos import resolver_politica_actor
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.services.reglas_administracion import (
    PERMISO_EDITAR_MATRIZ,
    exigir_al_menos_un_editor_matriz,
    validar_concesion_administracion,
    validar_operacion_sobre_cuenta_administrativa,
    validar_override_propio,
)
from apps.identidad.domain.value_objects.administracion import (
    FiltrosUsuarios,
    PaginacionUsuarios,
)
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from core.domain.exceptions import NotFoundError, ValidationError


def listar_usuarios_admin(
    repo_cuentas,
    repo_condicion,
    filtros: FiltrosUsuarios,
    paginacion: PaginacionUsuarios,
) -> PaginaUsuarios:
    """Página de cuentas con condición y contraseña inicial pendiente resueltas."""
    criterios = filtros.a_dict()
    if filtros.condicion:
        criterios['cedulas_condicion'] = repo_condicion.cedulas_por_condicion(filtros.condicion)

    cuentas, total = repo_cuentas.listar_paginado(
        criterios, paginacion.offset, paginacion.tamano
    )

    # La condición y la contraseña inicial llegan anotadas en la misma fila
    # (`_contexto_sesion_qs`): sin barridos completos de cédulas ni bcrypt por
    # cuenta. El filtro por condición sigue usando el repositorio de condición.
    resultados = [
        replace(
            cuenta,
            password_inicial_pendiente=bool(cuenta.debe_cambiar_password),
        )
        for cuenta in cuentas
    ]
    return PaginaUsuarios(
        resultados=resultados,
        total=total,
        pagina=paginacion.pagina,
        tamano=paginacion.tamano,
        total_paginas=paginacion.total_paginas(total),
    )


def obtener_detalle_usuario(repo_cuentas, repo_permisos, repo_condicion, id: int) -> DetalleUsuario:
    cuenta = repo_cuentas.obtener_por_id(id)
    if cuenta is None:
        raise NotFoundError('El usuario no existe.')
    return DetalleUsuario(
        cuenta=replace(
            cuenta,
            condicion=repo_condicion.condicion_por_cedula(cuenta.cedula).value,
            password_inicial_pendiente=repo_cuentas.verificar_password(cuenta.id, cuenta.cedula),
        ),
        permisos=_permisos_de(repo_permisos, cuenta),
    )


def contar_editores_matriz(repo_permisos) -> int:
    """Cuentas activas con permiso efectivo para editar la matriz (regla b).

    M5: el repositorio cuenta en bloque (solo cédula/rol, matriz de esos roles y
    overrides) sin cargar entidades ni paginar todas las cuentas.
    """
    return repo_permisos.contar_cuentas_activas_con_permiso(PERMISO_EDITAR_MATRIZ)


def guardar_permisos_individuales(
    repo_cuentas,
    repo_permisos,
    repo_condicion,
    *,
    id: int,
    actor: ActorSesionDTO,
    datos: GuardarOverridesDTO,
) -> DetalleUsuario:
    """Reemplaza los overrides allow/deny de una cuenta y recalcula el permiso efectivo."""
    cuenta = repo_cuentas.obtener_por_id(id)
    if cuenta is None:
        raise NotFoundError('El usuario no existe.')

    actor_cedula = actor.cedula
    validar_override_propio(actor_cedula=actor_cedula, objetivo_cedula=cuenta.cedula)
    politica_actor = resolver_politica_actor(repo_permisos, actor)
    permisos_objetivo = repo_permisos.obtener_permisos_usuario(cuenta.cedula)
    validar_operacion_sobre_cuenta_administrativa(
        politica_actor=politica_actor,
        politica_objetivo=(
            permisos_objetivo.politica_efectiva if permisos_objetivo else PoliticaAcceso()
        ),
        operacion='modificar los permisos individuales de',
    )

    previo = obtener_detalle_usuario(repo_cuentas, repo_permisos, repo_condicion, id)
    allow = _codigos_validos(repo_permisos, datos.allow)
    deny = _codigos_validos(repo_permisos, datos.deny)
    if allow & deny:
        raise ValidationError(
            'Un permiso no puede concederse y denegarse a la vez en el mismo usuario.'
        )
    validar_concesion_administracion(
        politica_actor=politica_actor,
        codigos_agregados=allow - frozenset(previo.permisos.allow),
    )

    editores_antes = contar_editores_matriz(repo_permisos)
    repo_permisos.guardar_override_usuario(cuenta.cedula, allow, deny)
    exigir_al_menos_un_editor_matriz(
        antes=editores_antes,
        despues=contar_editores_matriz(repo_permisos),
    )
    return obtener_detalle_usuario(repo_cuentas, repo_permisos, repo_condicion, id)


def obtener_matriz(repo_permisos, repo_roles) -> MatrizPermisos:
    matriz = repo_permisos.listar_matriz()
    filas = [
        FilaMatriz(codigo=p.codigo.valor, nombre=p.nombre, modulo=p.codigo.modulo)
        for p in sorted(repo_permisos.listar(), key=lambda x: x.codigo.valor)
    ]
    roles = [
        ColumnaRol(
            rol_id=rol.identificador,
            nombre=rol.nombre,
            nombre_visible=rol.etiqueta,
            codigos=tuple(sorted(matriz.get(rol.identificador, frozenset()))),
        )
        for rol in repo_roles.listar()
    ]
    return MatrizPermisos(filas=filas, roles=roles)


def guardar_matriz_rol(
    repo_cuentas,
    repo_permisos,
    repo_roles,
    repo_version,
    *,
    rol_id: int,
    actor: ActorSesionDTO,
    datos: GuardarMatrizDTO,
) -> tuple[frozenset[str], frozenset[str]]:
    """Reemplaza la fila de un rol en la matriz; devuelve (antes, después).

    Incrementa `permisos_version` de todas las cuentas del rol (invalida sus
    sesiones) y aplica la regla b) después del cambio: si el sistema queda sin
    ninguna cuenta activa con la matriz, el llamador revierte la transacción.
    """
    if repo_roles.obtener_por_id(rol_id) is None:
        raise NotFoundError('El rol no existe.')

    codigos = _codigos_validos(repo_permisos, datos.codigos)
    antes = repo_permisos.codigos_del_rol(rol_id)
    validar_concesion_administracion(
        politica_actor=resolver_politica_actor(repo_permisos, actor),
        codigos_agregados=codigos - antes,
    )
    editores_antes = contar_editores_matriz(repo_permisos)
    antes, despues = repo_permisos.reemplazar_permisos_rol(rol_id, codigos)
    if antes != despues:
        repo_version.incrementar_por_rol(rol_id)
        exigir_al_menos_un_editor_matriz(
            antes=editores_antes,
            despues=contar_editores_matriz(repo_permisos),
        )
    return antes, despues


def _permisos_de(repo_permisos, cuenta: Cuenta) -> PermisosUsuarioVista:
    usuario = repo_permisos.obtener_permisos_usuario(cuenta.cedula)
    catalogo = repo_permisos.listar()
    if usuario is None:
        return PermisosUsuarioVista(
            rol_id=cuenta.rol_id,
            rol_nombre=cuenta.rol_nombre,
            rol_nombre_visible=cuenta.rol_nombre_visible or cuenta.rol_nombre,
            del_rol=(),
            allow=(),
            deny=(),
            efectivos=(),
            version=1,
        )
    return PermisosUsuarioVista(
        rol_id=usuario.rol_id,
        rol_nombre=usuario.nombre_rol,
        rol_nombre_visible=usuario.nombre_rol_visible or usuario.nombre_rol,
        del_rol=tuple(
            sorted(p.codigo.valor for p in repo_permisos.permisos_del_rol(usuario.rol_id))
        ) if usuario.rol_id is not None else (),
        allow=tuple(sorted(usuario.permisos_custom.allow)),
        deny=tuple(sorted(usuario.permisos_custom.deny)),
        efectivos=tuple(
            sorted(p.codigo.valor for p in catalogo if usuario.tiene_permiso(p.codigo.valor))
        ),
        version=usuario.version,
    )


def _codigos_validos(repo_permisos, codigos) -> frozenset[str]:
    normalizados = frozenset(str(c).strip().lower() for c in codigos if str(c).strip())
    inexistentes = sorted(c for c in normalizados if not repo_permisos.existe_codigo(c))
    if inexistentes:
        raise ValidationError(
            'Permiso(s) inexistente(s) en el catálogo: ' + ', '.join(inexistentes)
        )
    return normalizados
