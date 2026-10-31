"""
Casos de uso de los parámetros del sistema (D9). Puros: reciben el repositorio y
devuelven entidades; la auditoría (valor anterior y nuevo) la registra la capa
de presentación con el puerto `AuditLogger`, como en el resto de módulos.
"""
from apps.configuracion.domain.entities.parametro import CambioParametro, ParametroSistema
from apps.configuracion.domain.parametros import (
    DEFINICIONES,
    definicion_de,
    validar_valor,
)
from apps.configuracion.domain.ports.repo_parametros import RepoParametros
from apps.configuracion.domain.value_objects.paginacion import Paginacion
from core.domain.exceptions import NotFoundError


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
            )
        resultado.append(parametro)
    return resultado


def actualizar_parametro(
    repo: RepoParametros, clave: str, valor_crudo, actor_id: int | None
) -> tuple[str, ParametroSistema]:
    """Valida y guarda; devuelve (valor anterior, parámetro actualizado)."""
    definicion = definicion_de(clave)
    nuevo_valor = validar_valor(definicion, valor_crudo)
    actual = repo.obtener(clave)
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
    )
    return anterior, repo.guardar(parametro, actor_id)


def historial_parametro(
    repo: RepoParametros, clave: str, paginacion: Paginacion
) -> tuple[list[CambioParametro], int]:
    definicion_de(clave)  # 404 si la clave no existe
    return repo.historial(clave, paginacion.tamano, paginacion.offset)
