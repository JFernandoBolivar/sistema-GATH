"""
Tests unitarios del historial de movimientos de cargo (Fase 2.5 del plan de
reparación). Puros, sin BD: repositorio en memoria implementando el puerto
`RepoMovimientos`.
"""
from apps.movimientos.application.use_cases.listar_historial import (
    listar_historial_por_cargo,
    listar_historial_por_empleado,
)
from apps.movimientos.application.use_cases.registrar_movimiento import registrar_movimiento
from apps.movimientos.domain.entities.movimiento import MovimientoCargo


class RepoMovimientosMemoria:
    def __init__(self):
        self.registros = []
        self.siguiente_id = 1

    def registrar_movimiento(self, cargo_id, cedula, tipo_movimiento, motivo_id, usuario_id):
        entidad = MovimientoCargo(
            id=self.siguiente_id,
            empleado_cedula=cedula,
            codigo_puesto=f"COD-{cargo_id}",
            tipo_movimiento=tipo_movimiento,
            motivo_id=motivo_id,
            motivo_nombre='TRASLADO POR NECESIDAD' if motivo_id else None,
            denominacion_nombre='ANALISTA',
            especifica_nombre='ANALISTA I',
            grado_nombre=None,
            tipo_nomina_nombre='FIJO',
            estatus_nombre='ACTIVO',
            tipo_personal_nombre='ACTIVO',
            dependencia_nombre='RECURSOS HUMANOS',
            direccion_general_nombre=None,
            direccion_linea_nombre=None,
            coordinacion_nombre=None,
            fecha_movimiento='2026-01-15T10:00:00+00:00',
            ejecutado_por_id=usuario_id,
            ejecutado_por_nombre='Analista de Prueba',
        )
        self.registros.append(entidad)
        self.siguiente_id += 1
        return entidad

    def listar_historial_por_empleado(self, cedula):
        return [r for r in self.registros if r.empleado_cedula == cedula]

    def listar_historial_por_cargo(self, codigo_puesto):
        return [r for r in self.registros if r.codigo_puesto == codigo_puesto]

    def listar_historial(self, filtros, limite, offset=0):
        filas = self.registros
        if filtros.cedula:
            filas = [f for f in filas if f.empleado_cedula == filtros.cedula]
        if filtros.codigo_puesto:
            filas = [f for f in filas if filtros.codigo_puesto in f.codigo_puesto]
        if filtros.tipo_movimiento:
            filas = [f for f in filas if f.tipo_movimiento == filtros.tipo_movimiento]
        total = len(filas)
        pagina = filas[offset:offset + limite] if limite else filas[offset:]
        return pagina, total

    def listar_tipos_movimiento_disponibles(self):
        return {'categorias': ['INGRESO'], 'motivos_por_categoria': {'INGRESO': ['INGRESO']}}


def test_registrar_movimiento_devuelve_dto_con_los_datos_del_evento():
    repo = RepoMovimientosMemoria()
    dto = registrar_movimiento(
        repo, cargo_id=10, cedula='V12345678', tipo_movimiento='TRASLADO', motivo_id=3, usuario_id=7,
    )
    assert dto.empleado_cedula == 'V12345678'
    assert dto.tipo_movimiento == 'TRASLADO'
    assert dto.codigo_puesto == 'COD-10'


def test_listar_historial_por_empleado_filtra_por_cedula():
    repo = RepoMovimientosMemoria()
    registrar_movimiento(repo, cargo_id=10, cedula='V12345678', tipo_movimiento='INGRESO', motivo_id=None, usuario_id=7)
    registrar_movimiento(repo, cargo_id=11, cedula='V99999999', tipo_movimiento='INGRESO', motivo_id=None, usuario_id=7)

    resultado = listar_historial_por_empleado(repo, 'V12345678')
    assert len(resultado) == 1
    assert resultado[0].empleado_cedula == 'V12345678'


def test_listar_historial_por_cargo_filtra_por_codigo_puesto():
    repo = RepoMovimientosMemoria()
    registrar_movimiento(repo, cargo_id=10, cedula='V12345678', tipo_movimiento='INGRESO', motivo_id=None, usuario_id=7)
    registrar_movimiento(repo, cargo_id=10, cedula='V88888888', tipo_movimiento='TRASLADO', motivo_id=1, usuario_id=7)
    registrar_movimiento(repo, cargo_id=11, cedula='V99999999', tipo_movimiento='INGRESO', motivo_id=None, usuario_id=7)

    resultado = listar_historial_por_cargo(repo, 'COD-10')
    assert len(resultado) == 2
