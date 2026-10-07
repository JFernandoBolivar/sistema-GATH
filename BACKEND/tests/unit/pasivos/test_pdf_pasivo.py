"""
Tests del generador de PDF del expediente de pasivo. No usan BD: construyen
el `PasivoDTO` a mano, con y sin secciones vacías, y mockean
`construir_config_pdf()` para no depender de SeaweedFS.
"""
from unittest.mock import patch

from apps.pasivos.application.dtos.pasivos_dtos import PasivoDTO
from apps.pasivos.infrastructure.pdf_pasivo import construir_pdf_expediente_pasivo


def _dto_base(**overrides) -> PasivoDTO:
    base = dict(
        id=1,
        cedula="12345678",
        nombres="Juan",
        apellidos="Pérez",
        nombre_completo="Juan Pérez",
        tipo_pasivo="JUBILADO",
        fecha_egreso="2026-01-15",
        resolucion="RES-001",
        datos_vivienda={"direccion_exacta": "Calle Falsa 123"},
        perfil_salud={
            "grupo_sanguineo_nombre": "O+",
            "alergias_nombres": ["Penicilina"],
            "patologias_cronicas_nombres": [],
            "discapacidades_nombres": [],
        },
        perfil_fisico={"talla_camisa_nombre": "M", "talla_pantalon_nombre": "32", "talla_zapatos_nombre": "42"},
        formacion_academica=[
            {"nivel_academico_nombre": "Universitario", "carrera_nombre": "Ingeniería",
             "mencion_nombre": None, "institucion_nombre": "UCV"},
        ],
        antecedentes=[
            {"fecha_ingreso": "2000-01-01", "fecha_egreso": "2020-01-01", "organismo_nombre": "Ministerio X"},
        ],
        cargos_historial=[
            {"codigo": "C-01", "denominacioncargoespecifico_nombre": "Analista",
             "tipo_nomina_nombre": "EMPLEADO", "dependencia_nombre": "Dirección General"},
        ],
    )
    base.update(overrides)
    return PasivoDTO(**base)


@patch("apps.pasivos.infrastructure.pdf_pasivo.construir_config_pdf", return_value=None)
def test_genera_pdf_valido_con_todas_las_secciones_pobladas(_mock_config):
    pdf = construir_pdf_expediente_pasivo(_dto_base())
    assert pdf.startswith(b"%PDF")


@patch("apps.pasivos.infrastructure.pdf_pasivo.construir_config_pdf", return_value=None)
def test_genera_pdf_valido_con_secciones_vacias(_mock_config):
    dto = _dto_base(
        datos_vivienda=None,
        perfil_salud=None,
        perfil_fisico=None,
        formacion_academica=[],
        antecedentes=[],
        cargos_historial=[],
    )
    pdf = construir_pdf_expediente_pasivo(dto)
    assert pdf.startswith(b"%PDF")


@patch("apps.pasivos.infrastructure.pdf_pasivo.construir_config_pdf", return_value={"tipo_cintillo": "GENERICO"})
def test_respeta_cintillo_generico(_mock_config):
    pdf = construir_pdf_expediente_pasivo(_dto_base())
    assert pdf.startswith(b"%PDF")
