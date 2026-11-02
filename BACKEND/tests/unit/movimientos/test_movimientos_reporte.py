"""
G6/G8 de movimientos, sin BD: filtros (RN-008-01), paginación, exportación y
las notificaciones del movimiento.
"""
from datetime import date

import pytest

from apps.movimientos.application.use_cases.listar_historial import (
    consultar_historial,
    exportar_historial,
)
from apps.movimientos.domain.entities.movimiento import MovimientoCargo
from apps.movimientos.domain.services.notificaciones_movimiento import (
    TIPO_CAMBIO_ESTATUS,
    TIPO_EGRESO,
    TIPO_INGRESO,
    TIPO_SOBREVIVIENTE,
    TIPO_TRASLADO,
    solicitudes_de_movimiento,
)
from apps.movimientos.domain.value_objects.filtros_historial import (
    MENSAJE_RANGO_INVALIDO,
    FiltrosHistorial,
)
from apps.movimientos.domain.value_objects.paginacion import (
    TAMANO_PAGINA_MAXIMO,
    Paginacion,
)
from core.domain.exceptions import ValidationError


def _movimiento(**cambios):
    base = dict(
        id=1,
        empleado_cedula='V12345678',
        codigo_puesto='COD-1',
        tipo_movimiento='TRASLADO',
        motivo_id=None,
        motivo_nombre=None,
        denominacion_nombre='ANALISTA',
        especifica_nombre='ANALISTA I',
        grado_nombre=None,
        tipo_nomina_nombre='FIJO',
        estatus_nombre='ACTIVO',
        tipo_personal_nombre='ACTIVO',
        dependencia_nombre='GESTION HUMANA',
        direccion_general_nombre='OFICINA DE GESTION HUMANA',
        direccion_linea_nombre=None,
        coordinacion_nombre=None,
        fecha_movimiento='2026-01-15T10:00:00+00:00',
        ejecutado_por_id=7,
        ejecutado_por_nombre='Analista de Prueba',
    )
    base.update(cambios)
    return MovimientoCargo(**base)


class _RepoMemoria:
    def __init__(self, total=0):
        self.total = total
        self.recibido = None

    def listar_historial(self, filtros, limite, offset=0):
        self.recibido = (filtros, limite, offset)
        filas = [_movimiento(id=i + 1) for i in range(min(limite or self.total, self.total))]
        return filas, self.total


# ─── RN-008-01 y fechas ───────────────────────────────────────────────────────


def test_rn_008_01_falla_en_el_dominio():
    with pytest.raises(ValidationError) as exc:
        FiltrosHistorial.desde_parametros({'fecha_inicio': '2026-02-01', 'fecha_fin': '2026-01-01'})
    assert str(exc.value) == MENSAJE_RANGO_INVALIDO


def test_fecha_invalida_falla():
    with pytest.raises(ValidationError):
        FiltrosHistorial.desde_parametros({'fecha_inicio': 'ayer'})


def test_fechas_validas_se_normalizan():
    filtros = FiltrosHistorial.desde_parametros(
        {'fecha_inicio': '2026-01-01', 'fecha_fin': '2026-01-31'}
    )
    assert filtros.fecha_inicio == date(2026, 1, 1)
    assert filtros.fecha_fin == date(2026, 1, 31)


def test_las_etiquetas_del_pdf_no_muestran_ids():
    filtros = FiltrosHistorial.desde_parametros({
        'cedula': 'V12345678',
        'codigo_puesto': 'COD-1',
        'categoria': 'TRASLADO',
        'gerencia': 'OFICINA DE GESTION HUMANA',
        'estatus': 'ACTIVO',
        'fecha_inicio': '2026-01-01',
        'fecha_fin': '2026-01-31',
    })
    etiquetas = dict(filtros.como_etiquetas())

    assert etiquetas['Cédula del trabajador'] == 'V12345678'
    assert etiquetas['Categoría de movimiento'] == 'TRASLADO'
    assert etiquetas['Desde'] == '01/01/2026'
    assert etiquetas['Hasta'] == '31/01/2026'


# ─── Paginación ──────────────────────────────────────────────────────────────


def test_paginacion_por_defecto_y_tope():
    assert Paginacion.desde_parametros({}) == Paginacion(pagina=1, tamano=10)
    assert Paginacion.desde_parametros({'page_size': '500'}).tamano == TAMANO_PAGINA_MAXIMO
    assert Paginacion.desde_parametros({'pagina': '3', 'page_size': '20'}).offset == 40


@pytest.mark.parametrize('parametros', [{'pagina': '0'}, {'page_size': '0'}, {'pagina': 'x'}])
def test_paginacion_invalida_falla(parametros):
    with pytest.raises(ValidationError):
        Paginacion.desde_parametros(parametros)


def test_consultar_historial_pagina_en_el_servidor():
    repo = _RepoMemoria(total=25)
    pagina = consultar_historial(repo, {}, Paginacion(pagina=2, tamano=10))

    filtros, limite, offset = repo.recibido
    assert (limite, offset) == (10, 10)
    assert pagina.total == 25
    assert pagina.pagina == 2
    assert pagina.total_paginas == 3
    assert len(pagina.resultados) == 10


# ─── Exportación ────────────────────────────────────────────────────────────


def test_exportar_historial_informa_el_truncado():
    repo = _RepoMemoria(total=25)
    documento = exportar_historial(repo, {'cedula': 'V12345678'}, limite=10)

    assert documento.total_encontrados == 25
    assert documento.limite == 10
    assert documento.truncado is True
    assert len(documento.movimientos) == 10
    assert documento.filtros == [('Cédula del trabajador', 'V12345678')]


def test_exportar_historial_sin_tope_no_trunca():
    documento = exportar_historial(_RepoMemoria(total=3), {}, limite=0)

    assert documento.truncado is False
    assert documento.total_encontrados == 3


# ─── G8: notificaciones del movimiento ──────────────────────────────────────


def test_traslado_notifica_a_rrhh_y_al_trabajador():
    solicitudes = solicitudes_de_movimiento(_movimiento(), TIPO_TRASLADO)

    assert len(solicitudes) == 2
    a_rrhh, al_trabajador = solicitudes
    assert a_rrhh.permiso_destino == 'personal.recibir_avisos_movimientos'
    assert a_rrhh.modulo == 'personal'
    assert a_rrhh.enlace == '/movimientos'
    assert a_rrhh.ref_id == '1' and a_rrhh.clave == '1'
    assert 'C.I. V12345678' in a_rrhh.mensaje
    assert 'OFICINA DE GESTION HUMANA' in a_rrhh.mensaje
    assert al_trabajador.cedula_destino == 'V12345678'
    assert al_trabajador.modulo == 'autogestion'
    assert al_trabajador.enlace == '/autogestion'


def test_el_aviso_del_trabajador_tiene_clave_propia():
    """G12-1: RRHH y el trabajador no comparten clave (la unicidad no mira el módulo)."""
    a_rrhh, al_trabajador = solicitudes_de_movimiento(_movimiento(), TIPO_TRASLADO)

    assert a_rrhh.clave == '1'
    assert al_trabajador.clave == '1:trabajador'
    assert a_rrhh.clave != al_trabajador.clave
    assert a_rrhh.ref_id == al_trabajador.ref_id == '1'


def test_egreso_no_notifica_al_trabajador():
    solicitudes = solicitudes_de_movimiento(_movimiento(), TIPO_EGRESO)

    assert len(solicitudes) == 1
    assert solicitudes[0].modulo == 'personal'
    assert solicitudes[0].cedula_destino == ''


@pytest.mark.parametrize(
    'tipo, codigo',
    [
        (TIPO_INGRESO, 'movimiento.ingreso'),
        (TIPO_SOBREVIVIENTE, 'movimiento.sobreviviente'),
        (TIPO_CAMBIO_ESTATUS, 'movimiento.cambio_estatus'),
    ],
)
def test_tipos_de_notificacion(tipo, codigo):
    assert solicitudes_de_movimiento(_movimiento(), tipo)[0].tipo == codigo


def test_tipo_desconocido_no_genera_avisos():
    assert solicitudes_de_movimiento(_movimiento(), 'OTRO') == []


def test_el_correo_solo_se_solicita_si_el_ajuste_esta_activo():
    sin_correo = solicitudes_de_movimiento(_movimiento(), TIPO_TRASLADO)
    con_correo = solicitudes_de_movimiento(_movimiento(), TIPO_TRASLADO, correo_activo=True)

    assert all(s.correo is None for s in sin_correo)
    assert all(s.correo is not None for s in con_correo)
