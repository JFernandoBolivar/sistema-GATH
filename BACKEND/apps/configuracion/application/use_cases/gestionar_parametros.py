"""
Casos de uso de los parámetros del sistema (D9). Puros: reciben el repositorio y
devuelven entidades; la auditoría (valor anterior y nuevo) la registra la capa
de presentación con el puerto `AuditLogger`, como en el resto de módulos.
"""
from dataclasses import replace

from apps.configuracion.domain.entities.parametro import CambioParametro, ParametroSistema
from apps.configuracion.domain.parametros import (
    DEFINICIONES,
    definicion_de,
    validar_valor,
)
from apps.configuracion.domain.ports.repo_parametros import RepoParametros
from apps.configuracion.domain.value_objects.paginacion import Paginacion
from core.domain.configuracion import (
    CLAVE_CARNETIZACION_MI_CARNET_ALCANCE,
    CLAVE_CARNETIZACION_MI_CARNET_USUARIOS,
)
from core.domain.exceptions import NotFoundError, ValidationError


def listar_parametros(repo: RepoParametros) -> list[ParametroSistema]:
    """Todos los parámetros definidos, con su valor vigente (o el de defecto)."""
    parametros = {p.clave: p for p in repo.listar()}
    resultado: list[ParametroSistema] = []
    for definicion in DEFINICIONES:
        parametro = parametros.get(definicion.clave)
        if parametro is None:
            parametro = ParametroSistema(
                clave=definicion.clave,
                etiqueta=definicion.etiqueta,
                descripcion=definicion.descripcion,
                grupo=definicion.grupo,
                tipo=definicion.tipo,
                valor=definicion.defecto,
                defecto=definicion.defecto,
                minimo=definicion.minimo,
                maximo=definicion.maximo,
                depende_de=definicion.depende_de,
            )
        # La definición es la fuente de verdad de textos y rangos (la fila solo guarda el valor).
        resultado.append(replace(
            parametro,
            etiqueta=definicion.etiqueta,
            descripcion=definicion.descripcion,
            minimo=definicion.minimo,
            maximo=definicion.maximo,
            opciones=definicion.opciones,
            depende_de=definicion.depende_de,
        ))
    return resultado


def actualizar_parametro(
    repo: RepoParametros, clave: str, valor_crudo, actor_id: int | None
) -> tuple[str, ParametroSistema]:
    """Valida y guarda; devuelve (valor anterior, parámetro actualizado)."""
    definicion = definicion_de(clave)
    actual = repo.obtener(clave)
    nuevo_valor = validar_valor(
        definicion, valor_crudo, actual.valor if actual is not None else None
    )

    if clave == CLAVE_CARNETIZACION_MI_CARNET_USUARIOS:
        cedulas = [c.strip() for c in nuevo_valor.split(',') if c.strip()]
        actual_alcance = repo.obtener(CLAVE_CARNETIZACION_MI_CARNET_ALCANCE)
        alcance_valor = actual_alcance.valor if actual_alcance is not None else 'nadie'
        if alcance_valor == 'usuarios_especificos' and not cedulas:
            raise ValidationError(
                'Debe especificar al menos un trabajador cuando el alcance es «Usuarios específicos».'
            )
        if cedulas:
            repo.validar_cuentas_activas(cedulas)
    elif clave == CLAVE_CARNETIZACION_MI_CARNET_ALCANCE and nuevo_valor == 'usuarios_especificos':
        actual_usuarios = repo.obtener(CLAVE_CARNETIZACION_MI_CARNET_USUARIOS)
        cedulas = [
            c.strip()
            for c in (actual_usuarios.valor if actual_usuarios is not None else '').split(',')
            if c.strip()
        ]
        if not cedulas:
            raise ValidationError(
                'No puede activar «Usuarios específicos» sin configurar al menos un trabajador con cuenta de usuario activa.'
            )
        repo.validar_cuentas_activas(cedulas)

    anterior = actual.valor if actual is not None else definicion.defecto
    parametro = ParametroSistema(
        clave=definicion.clave,
        etiqueta=definicion.etiqueta,
        descripcion=definicion.descripcion,
        grupo=definicion.grupo,
        tipo=definicion.tipo,
        valor=nuevo_valor,
        defecto=definicion.defecto,
        minimo=definicion.minimo,
        maximo=definicion.maximo,
        actualizado_por_id=actor_id,
        opciones=definicion.opciones,
        depende_de=definicion.depende_de,
    )
    guardado = repo.guardar(parametro, actor_id)
    return anterior, replace(
        guardado,
        opciones=definicion.opciones,
        depende_de=definicion.depende_de,
    )


def historial_parametro(
    repo: RepoParametros, clave: str, paginacion: Paginacion
) -> tuple[list[CambioParametro], int]:
    definicion_de(clave)  # 404 si la clave no existe
    return repo.historial(clave, paginacion.tamano, paginacion.offset)
