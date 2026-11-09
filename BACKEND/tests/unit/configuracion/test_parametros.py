"""Parámetros del sistema (D9) sin BD: validación por tipo y actualización pura."""
import pytest

from apps.configuracion.application.use_cases.gestionar_parametros import (
    actualizar_parametro,
    historial_parametro,
    listar_parametros,
)
from apps.configuracion.domain.entities.parametro import CambioParametro, ParametroSistema
from apps.configuracion.domain.parametros import (
    CLAVE_AUTOGESTION_ACTIVOS_HABILITADO,
    CLAVE_AUTOGESTION_ACTIVOS_SECCIONES,
    CLAVE_AUTOGESTION_MAX_PRORROGAS,
    CLAVE_AUTOGESTION_PASIVOS_HABILITADO,
    CLAVE_AUTOGESTION_PASIVOS_SECCIONES,
    CLAVE_FE_DE_VIDA_RECORDATORIOS,
    CLAVE_PASSWORD_INICIAL_DIAS,
    DEFINICIONES_POR_CLAVE,
    validar_valor,
)
from core.domain.configuracion import (
    CLAVE_CARNETIZACION_MI_CARNET_ALCANCE,
    CLAVE_CARNETIZACION_MI_CARNET_USUARIOS,
)
from apps.configuracion.domain.value_objects.paginacion import Paginacion
from core.domain.exceptions import NotFoundError, ValidationError


class RepoParametrosMemoria:
    def __init__(self):
        self.filas: dict[str, ParametroSistema] = {}
        self.cambios: list[CambioParametro] = []
        self.usuarios_validos: dict[str, tuple[str, bool]] = {}  # cedula -> (nombre, activa)

    def listar(self):
        return list(self.filas.values())

    def obtener(self, clave):
        return self.filas.get(clave)

    def guardar(self, parametro, actor_id):
        self.filas[parametro.clave] = parametro
        return parametro

    def historial(self, clave, limite, offset=0):
        return self.cambios[offset:offset + limite], len(self.cambios)

    def validar_cuentas_activas(self, cedulas):
        resultado = []
        for c in cedulas:
            if c not in self.usuarios_validos:
                raise ValidationError(f'«{c}»: no está registrado como trabajador.')
            nombre, activa = self.usuarios_validos[c]
            if not activa:
                raise ValidationError(f'«{c}»: no tiene cuenta de usuario activa en GATH.')
            resultado.append((c, nombre))
        return resultado

    def obtener_nombres_por_cedulas(self, cedulas):
        return {c: self.usuarios_validos[c][0] for c in cedulas if c in self.usuarios_validos}

    def buscar_trabajadores(self, query, cedulas=None):
        return []


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


CLAVES_RETENCION = [
    d.clave for d in DEFINICIONES_POR_CLAVE.values() if d.grupo == 'retencion'
]


@pytest.mark.parametrize('clave', CLAVES_RETENCION)
@pytest.mark.parametrize('valor', ['30', '90', '180', '365', '1095', '2190', '0'])
def test_retencion_acepta_solo_las_opciones(clave, valor):
    assert validar_valor(DEFINICIONES_POR_CLAVE[clave], valor) == valor


@pytest.mark.parametrize('clave', CLAVES_RETENCION)
@pytest.mark.parametrize('valor', ['1', '31', '3650', '-1', 'nunca'])
def test_retencion_rechaza_otros_valores(clave, valor):
    with pytest.raises(ValidationError):
        validar_valor(DEFINICIONES_POR_CLAVE[clave], valor)


def test_retencion_conserva_un_valor_actual_fuera_de_la_lista():
    definicion = DEFINICIONES_POR_CLAVE[CLAVES_RETENCION[0]]
    assert validar_valor(definicion, '45', valor_actual='45') == '45'
    with pytest.raises(ValidationError):
        validar_valor(definicion, '46', valor_actual='45')


def test_autogestion_define_activos_encendido_y_pasivos_apagado_por_defecto():
    assert DEFINICIONES_POR_CLAVE[CLAVE_AUTOGESTION_ACTIVOS_HABILITADO].defecto == 'true'
    assert DEFINICIONES_POR_CLAVE[CLAVE_AUTOGESTION_PASIVOS_HABILITADO].defecto == 'false'


@pytest.mark.parametrize('clave', (CLAVE_AUTOGESTION_ACTIVOS_SECCIONES, CLAVE_AUTOGESTION_PASIVOS_SECCIONES))
def test_autogestion_secciones_normaliza_y_rechaza_desconocidas(clave):
    definicion = DEFINICIONES_POR_CLAVE[clave]
    assert validar_valor(definicion, 'vivienda, contacto, contacto') == 'contacto,vivienda'
    with pytest.raises(ValidationError, match='desconocidas'):
        validar_valor(definicion, 'contacto,inventada')
    with pytest.raises(ValidationError, match='al menos una sección'):
        validar_valor(definicion, ' , ')


def test_listar_expone_las_opciones_de_retencion():
    parametros = {p.clave: p for p in listar_parametros(RepoParametrosMemoria())}
    for clave in CLAVES_RETENCION:
        assert [v for v, _ in parametros[clave].opciones] == [30, 90, 180, 365, 1095, 2190, 0]
        assert parametros[clave].opciones[-1][1] == 'Nunca'
        assert int(parametros[clave].defecto) in {v for v, _ in parametros[clave].opciones}
    assert parametros[CLAVE_PASSWORD_INICIAL_DIAS].opciones == ()


def test_parametros_dependientes_exponen_depende_de():
    parametros = {p.clave: p for p in listar_parametros(RepoParametrosMemoria())}
    assert parametros[CLAVE_CARNETIZACION_MI_CARNET_USUARIOS].depende_de == (
        CLAVE_CARNETIZACION_MI_CARNET_ALCANCE,
        'usuarios_especificos',
    )
    assert parametros[CLAVE_AUTOGESTION_ACTIVOS_SECCIONES].depende_de == (
        CLAVE_AUTOGESTION_ACTIVOS_HABILITADO,
        'true',
    )
    assert parametros[CLAVE_AUTOGESTION_PASIVOS_SECCIONES].depende_de == (
        CLAVE_AUTOGESTION_PASIVOS_HABILITADO,
        'true',
    )


def test_mi_carnet_usuarios_valida_cedulas_y_cuentas():
    repo = RepoParametrosMemoria()
    repo.usuarios_validos['12345678'] = ('Juan Pérez', True)
    repo.usuarios_validos['87654321'] = ('María Gómez', False)  # inactiva

    # Cédula no registrada
    with pytest.raises(ValidationError, match='no está registrado como trabajador'):
        actualizar_parametro(repo, CLAVE_CARNETIZACION_MI_CARNET_USUARIOS, '99999999', actor_id=1)

    # Cédula sin cuenta activa
    with pytest.raises(ValidationError, match='no tiene cuenta de usuario activa en GATH'):
        actualizar_parametro(repo, CLAVE_CARNETIZACION_MI_CARNET_USUARIOS, '87654321', actor_id=1)

    # Cédula válida con cuenta activa
    _, param = actualizar_parametro(repo, CLAVE_CARNETIZACION_MI_CARNET_USUARIOS, '12345678', actor_id=1)
    assert param.valor == '12345678'


def test_mi_carnet_alcance_usuarios_especificos_requiere_usuarios():
    repo = RepoParametrosMemoria()
    repo.usuarios_validos['12345678'] = ('Juan Pérez', True)

    # Sin usuarios configurados no puede activarse
    with pytest.raises(ValidationError, match='No puede activar «Usuarios específicos» sin configurar'):
        actualizar_parametro(repo, CLAVE_CARNETIZACION_MI_CARNET_ALCANCE, 'usuarios_especificos', actor_id=1)

    # Con usuarios configurados sí se puede activar
    actualizar_parametro(repo, CLAVE_CARNETIZACION_MI_CARNET_USUARIOS, '12345678', actor_id=1)
    _, param_alcance = actualizar_parametro(repo, CLAVE_CARNETIZACION_MI_CARNET_ALCANCE, 'usuarios_especificos', actor_id=1)
    assert param_alcance.valor == 'usuarios_especificos'

    # Una vez activo usuarios_especificos, no se puede vaciar la lista de usuarios
    with pytest.raises(ValidationError, match='Debe especificar al menos un trabajador'):
        actualizar_parametro(repo, CLAVE_CARNETIZACION_MI_CARNET_USUARIOS, '', actor_id=1)
