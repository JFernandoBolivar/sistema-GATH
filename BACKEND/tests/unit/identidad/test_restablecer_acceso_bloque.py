"""U2: restablecimiento de acceso en bloque (caso de uso con puertos en memoria)."""
from dataclasses import replace
from datetime import datetime, timezone

import pytest

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.restablecer_acceso_en_bloque import (
    restablecer_acceso_en_bloque,
)
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.entities.restablecimiento_bloque import CuentaClaveInicial
from apps.identidad.domain.entities.usuario_permisos import UsuarioPermisos
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from core.domain.exceptions import ConflictError, ValidationError

AHORA = datetime(2026, 11, 11, 12, 0, tzinfo=timezone.utc)
ACTOR = ActorSesionDTO(cuenta_id=99, rol_id=1, cedula='30799436')
MOTIVO = 'Restablecimiento masivo de claves vencidas'


class RepoCuentasFake:
    def __init__(self, cuentas: dict[int, Cuenta]):
        self.cuentas = cuentas
        self.passwords: dict[int, str] = {}

    def obtener_por_id(self, cuenta_id):
        return self.cuentas.get(cuenta_id)

    def establecer_password(self, cuenta_id, password):
        self.passwords[cuenta_id] = password


class RepoPasswordInicialFake:
    def __init__(self):
        self.emitidos = []

    def emitir(self, cuenta_id, vence_en):
        self.emitidos.append((cuenta_id, vence_en))


class RepoVersionFake:
    pass


class RepoPermisosFake:
    def __init__(self, politicas: dict[str, PoliticaAcceso]):
        self.politicas = politicas

    def obtener_permisos_usuario(self, cedula):
        politica = self.politicas.get(cedula)
        if politica is None:
            return None
        return UsuarioPermisos(cedula=cedula, politica_efectiva=politica)

    def politica_del_rol(self, rol_id):
        return PoliticaAcceso(allow=frozenset({'*'}))


class RepoCondicionFake:
    def __init__(self, activos: set[str], pasivos: set[str]):
        self.activos, self.pasivos = activos, pasivos

    def cedulas_por_condicion(self, condicion):
        if condicion == CondicionTrabajador.PASIVO.value:
            return self.pasivos
        return self.activos


class RepoClaveInicialFake:
    def __init__(self, con_clave, activas, vencidas=()):
        self._con_clave, self._activas = list(con_clave), list(activas)
        self._vencidas = list(vencidas)

    def vencidas(self, ahora):
        return self._vencidas

    def con_clave_inicial(self):
        return self._con_clave

    def activas(self):
        return self._activas


ADMIN = PoliticaAcceso(allow=frozenset({'configuracion.editar', 'identidad.asignar_permisos'}))


@pytest.fixture
def mundo():
    cuentas = {
        1: Cuenta(id=1, cedula='10000001'),
        2: Cuenta(id=2, cedula='10000002'),
        3: Cuenta(id=3, cedula='10000003'),
        4: Cuenta(id=4, cedula='30799436'),
    }
    con_clave = [
        CuentaClaveInicial(1, '10000001'),
        CuentaClaveInicial(2, '10000002'),
        CuentaClaveInicial(4, '30799436'),  # administrativa: nunca entra
    ]
    activas = list(con_clave) + [CuentaClaveInicial(3, '10000003')]
    permisos = RepoPermisosFake({
        '10000001': PoliticaAcceso(),
        '10000002': PoliticaAcceso(),
        '10000003': PoliticaAcceso(),
        '30799436': ADMIN,
    })
    return {
        'cuentas': RepoCuentasFake(cuentas),
        'password': RepoPasswordInicialFake(),
        'version': RepoVersionFake(),
        'permisos': permisos,
        'condicion': RepoCondicionFake({'10000001', '10000003', '30799436'}, {'10000002'}),
        'clave': RepoClaveInicialFake(con_clave, activas, vencidas=[con_clave[1]]),
        'eventos': [],
    }


def _ejecutar(mundo, **cambios):
    params = {
        'repo_cuentas': mundo['cuentas'],
        'repo_password_inicial': mundo['password'],
        'repo_version': mundo['version'],
        'repo_permisos': mundo['permisos'],
        'repo_condicion': mundo['condicion'],
        'repo_clave_inicial': mundo['clave'],
        'publicar': mundo['eventos'].append,
        'actor': ACTOR,
        'clasificacion': 'AMBOS',
        'alcance': 'SIN_PRIMER_INGRESO',
        'enviar_correo': True,
        'motivo': MOTIVO,
        'ahora': AHORA,
        'dias_vigencia': 7,
    }
    params.update(cambios)
    return restablecer_acceso_en_bloque(**params)


def test_vista_previa_filtra_por_clasificacion_y_excluye_administrativas(mundo):
    activos = _ejecutar(mundo, clasificacion='ACTIVOS', dry_run=True)
    assert (activos.activos, activos.pasivos, activos.total) == (1, 0, 1)
    assert activos.omitidas_administrativas == 1

    pasivos = _ejecutar(mundo, clasificacion='PASIVOS', dry_run=True)
    assert (pasivos.activos, pasivos.pasivos, pasivos.total) == (0, 1, 1)

    todos = _ejecutar(mundo, clasificacion='AMBOS', dry_run=True)
    assert todos.total == 2 and todos.omitidas_administrativas == 1


def test_alcance_todos_incluye_a_quien_ya_cambio_su_clave(mundo):
    # `con_clave_inicial` no trae la cuenta 3; `activas` sí.
    resultado = _ejecutar(mundo, alcance='TODOS', clasificacion='ACTIVOS', dry_run=True)
    assert resultado.total == 2  # cuentas 1 y 3 (la 4 es administrativa)


def test_sin_correo_no_publica_eventos(mundo):
    resultado = _ejecutar(mundo, clasificacion='ACTIVOS', confirmacion=1, enviar_correo=False)
    assert resultado.restablecidas == 1
    assert mundo['eventos'] == []
    assert mundo['password'].emitidos[0][0] == 1


def test_con_correo_publica_un_evento_por_cuenta(mundo):
    resultado = _ejecutar(mundo, clasificacion='AMBOS', confirmacion=2, enviar_correo=True)
    assert resultado.restablecidas == 2
    assert len(mundo['eventos']) == 2


def test_confirmacion_distinta_da_conflicto_y_no_toca_nada(mundo):
    with pytest.raises(ConflictError):
        _ejecutar(mundo, clasificacion='AMBOS', confirmacion=1)
    assert mundo['cuentas'].passwords == {}
    assert mundo['password'].emitidos == []


def test_motivo_corto_es_validacion(mundo):
    with pytest.raises(ValidationError) as error:
        _ejecutar(mundo, motivo='corto', dry_run=True)
    assert error.value.campo == 'motivo'


def test_sin_primer_ingreso_no_rehashea_y_solo_renueva_vencimiento(mundo):
    """U2-bis: la clave ya es la cédula; no se llama a `establecer_password`."""
    resultado = _ejecutar(mundo, clasificacion='ACTIVOS', confirmacion=1)
    assert resultado.restablecidas == 1
    assert mundo['cuentas'].passwords == {}
    assert [cuenta for cuenta, _ in mundo['password'].emitidos] == [1]


def test_alcance_todos_mantiene_el_flujo_completo(mundo):
    resultado = _ejecutar(
        mundo, clasificacion='ACTIVOS', alcance='TODOS', confirmacion=2,
    )
    assert resultado.restablecidas == 2
    assert set(mundo['cuentas'].passwords) == {1, 3}


def test_ejecucion_reutiliza_la_lista_de_la_vista_previa(mundo):
    resultado = _ejecutar(
        mundo, clasificacion='ACTIVOS', confirmacion=1, cuenta_ids=[2],
    )
    assert resultado.restablecidas == 1
    assert [cuenta for cuenta, _ in mundo['password'].emitidos] == [2]
    assert mundo['cuentas'].passwords == {}


def test_idempotente_dos_pasadas_dejan_el_mismo_estado(mundo):
    _ejecutar(mundo, clasificacion='ACTIVOS', confirmacion=1)
    primera = dict(mundo['cuentas'].passwords)
    _ejecutar(mundo, clasificacion='ACTIVOS', confirmacion=1)
    assert mundo['cuentas'].passwords == primera
    assert [c for c, _ in mundo['password'].emitidos] == [1, 1]


def test_alcance_vencida_solo_trae_las_cuentas_vencidas(mundo):
    resultado = _ejecutar(mundo, alcance='VENCIDA', dry_run=True)
    assert resultado.total == 1 and resultado.pasivos == 1  # solo la cuenta 2
    sin_primer_ingreso = _ejecutar(mundo, alcance='SIN_PRIMER_INGRESO', dry_run=True)
    assert sin_primer_ingreso.total == 2


def test_vencida_no_rehashea_y_renueva_el_plazo(mundo):
    resultado = _ejecutar(mundo, alcance='VENCIDA', confirmacion=1)
    assert resultado.restablecidas == 1
    assert mundo['cuentas'].passwords == {}
    assert [cuenta for cuenta, _ in mundo['password'].emitidos] == [2]


def test_armar_filas_trae_nombre_condicion_y_orden():
    from apps.identidad.application.use_cases.restablecer_acceso_en_bloque import armar_filas
    from apps.identidad.domain.entities.restablecimiento_bloque import DetalleCuentaBloque

    class Detalle:
        def detalle(self, ids):
            return [
                DetalleCuentaBloque(1, '10000001', 'PEREZ ANA', 'a@x.com', None),
                DetalleCuentaBloque(2, '10000002', 'ALVAREZ LUIS', 'l@x.com', AHORA),
            ]

    filas = armar_filas(Detalle(), RepoCondicionFake({'10000001'}, {'10000002'}), [1, 2])
    assert [(f.nombre, f.condicion) for f in filas] == [
        ('ALVAREZ LUIS', 'PASIVO'), ('PEREZ ANA', 'ACTIVO'),
    ]
