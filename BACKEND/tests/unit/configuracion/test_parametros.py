"""Parámetros del sistema (D9) sin BD: validación por tipo y actualización pura."""
import pytest

from apps.configuracion.application.use_cases.gestionar_parametros import (
    actualizar_parametro,
    historial_parametro,
    listar_parametros,
)
from apps.configuracion.domain.entities.parametro import CambioParametro, ParametroSistema
from apps.configuracion.domain.parametros import (
    CLAVE_AUTOGESTION_MAX_PRORROGAS,
    CLAVE_FE_DE_VIDA_RECORDATORIOS,
    CLAVE_PASSWORD_INICIAL_DIAS,
    DEFINICIONES_POR_CLAVE,
    validar_valor,
)
from apps.configuracion.domain.value_objects.paginacion import Paginacion
from core.domain.exceptions import NotFoundError, ValidationError


class RepoParametrosMemoria:
    def __init__(self):
        self.filas: dict[str, ParametroSistema] = {}
        self.cambios: list[CambioParametro] = []

    def listar(self):
        return list(self.filas.values())

    def obtener(self, clave):
        return self.filas.get(clave)

    def guardar(self, parametro, actor_id):
        self.filas[parametro.clave] = parametro
        return parametro

    def historial(self, clave, limite, offset=0):
        return self.cambios[offset:offset + limite], len(self.cambios)


def test_listar_devuelve_todas_las_definiciones_con_su_defecto():
    parametros = listar_parametros(RepoParametrosMemoria())
    assert len(parametros) == len(DEFINICIONES_POR_CLAVE)
    assert {p.clave for p in parametros} == set(DEFINICIONES_POR_CLAVE)
    assert all(p.valor == p.defecto for p in parametros)


def test_actualizar_valida_y_devuelve_el_valor_anterior():
    repo = RepoParametrosMemoria()
    anterior, parametro = actualizar_parametro(
        repo, CLAVE_AUTOGESTION_MAX_PRORROGAS, ' 8 ', actor_id=1
    )
    assert anterior == '5'
    assert parametro.valor == '8'
    assert repo.filas[CLAVE_AUTOGESTION_MAX_PRORROGAS].actualizado_por_id == 1


@pytest.mark.parametrize(
    'clave, valor',
    [
        (CLAVE_AUTOGESTION_MAX_PRORROGAS, '51'),
        (CLAVE_AUTOGESTION_MAX_PRORROGAS, '-1'),
        (CLAVE_AUTOGESTION_MAX_PRORROGAS, 'muchas'),
        (CLAVE_PASSWORD_INICIAL_DIAS, '0'),
        (CLAVE_PASSWORD_INICIAL_DIAS, '366'),
        (CLAVE_FE_DE_VIDA_RECORDATORIOS, '0,abc'),
        (CLAVE_FE_DE_VIDA_RECORDATORIOS, ''),
    ],
)
def test_valores_invalidos_fallan_en_el_dominio(clave, valor):
    with pytest.raises(ValidationError):
        validar_valor(DEFINICIONES_POR_CLAVE[clave], valor)


def test_los_dias_de_recordatorio_se_normalizan_sin_repetidos_y_descendentes():
    definicion = DEFINICIONES_POR_CLAVE[CLAVE_FE_DE_VIDA_RECORDATORIOS]
    assert validar_valor(definicion, '7, 30, 7, 1') == '30,7,1'


def test_clave_desconocida_da_not_found():
    with pytest.raises(NotFoundError):
        actualizar_parametro(RepoParametrosMemoria(), 'no.existe', '1', actor_id=1)


def test_historial_pagina_en_el_servidor():
    repo = RepoParametrosMemoria()
    repo.cambios = [CambioParametro('2026-01-01', '1', '5', '6') for _ in range(12)]
    filas, total = historial_parametro(
        repo, CLAVE_AUTOGESTION_MAX_PRORROGAS, Paginacion(pagina=2, tamano=10)
    )
    assert total == 12
    assert len(filas) == 2
