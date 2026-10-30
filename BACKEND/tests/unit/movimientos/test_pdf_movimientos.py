"""
Tests del generador de PDF del historial de movimientos. No usan BD: construyen
`MovimientoCargoDTO` a mano y mockean `construir_config_pdf()` para no
depender de SeaweedFS.
"""
from unittest.mock import patch

from apps.movimientos.application.dtos.movimientos_dtos import MovimientoCargoDTO
from apps.movimientos.infrastructure.pdf_movimientos import construir_pdf_historial_movimientos


def _movimiento(**overrides) -> MovimientoCargoDTO:
    base = dict(
        id=1,
        empleado_cedula="12345678",
        codigo_puesto="C-01",
        tipo_movimiento="TRASLADO",
        motivo_id=1,
        motivo_nombre="TRASLADO DE NOMINA",
        denominacion_nombre="ANALISTA",
        especifica_nombre="ANALISTA III",
        grado_nombre="III",
        tipo_nomina_nombre="EMPLEADO",
        estatus_nombre="ACTIVO",
        tipo_personal_nombre="EMPLEADO",
        dependencia_nombre="DIRECCION GENERAL X",
        direccion_general_nombre=None,
        direccion_linea_nombre=None,
        coordinacion_nombre=None,
        fecha_movimiento="2026-01-15",
        ejecutado_por_id=1,
        ejecutado_por_nombre="Admin Prueba",
    )
    base.update(overrides)
    return MovimientoCargoDTO(**base)


@patch("apps.movimientos.infrastructure.pdf_movimientos.construir_config_pdf", return_value=None)
def test_genera_pdf_valido_con_movimientos(_mock_config):
    pdf = construir_pdf_historial_movimientos(
        [_movimiento(), _movimiento(id=2)],
        filtros=[("Cédula del trabajador", "12345678")],
        usuario_nombre="Admin",
    )
    assert pdf.startswith(b"%PDF")


@patch("apps.movimientos.infrastructure.pdf_movimientos.construir_config_pdf", return_value=None)
def test_genera_pdf_valido_sin_movimientos(_mock_config):
    pdf = construir_pdf_historial_movimientos([], filtros=[], usuario_nombre=None)
    assert pdf.startswith(b"%PDF")


@patch("apps.movimientos.infrastructure.pdf_movimientos.construir_config_pdf", return_value={"tipo_cintillo": "GENERICO"})
def test_respeta_cintillo_generico(_mock_config):
    pdf = construir_pdf_historial_movimientos(
        [_movimiento()], filtros=[("Cédula del trabajador", "12345678")]
    )
    assert pdf.startswith(b"%PDF")
