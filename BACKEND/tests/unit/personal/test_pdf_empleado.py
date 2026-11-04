"""
Tests del generador de PDF del expediente de empleado. No usan BD: construyen
el `EmpleadoDTO` a mano, con y sin secciones opcionales, y mockean
`construir_config_pdf()` para no depender de SeaweedFS.
"""
from unittest.mock import patch

from apps.personal.application.dtos.personal_dtos import EmpleadoDTO
from apps.personal.infrastructure.pdf_empleado import construir_pdf_expediente_empleado


def _dto_base(**overrides) -> EmpleadoDTO:
    base = dict(
        id=1,
        cedula="12345678",
        nombres="Juan",
        apellidos="Pérez",
        nombre_completo="Juan Pérez",
        sexo_id=1,
        sexo_nombre="MASCULINO",
        correo="juan@example.com",
        total_anos_apn=5.5,
        datos_vivienda={"estado_nombre": "Miranda", "direccion_exacta": "Calle Falsa 123"},
        perfil_salud={"grupo_sanguineo_nombre": "O+", "alergias_nombres": [], "patologias_cronicas_nombres": [], "discapacidades_nombres": []},
        perfil_fisico={"talla_camisa_nombre": "M"},
        formacion_academica=[
            {"nivel_academico_nombre": "Universitario", "carrera_nombre": "Ingeniería", "mencion_nombre": None, "institucion_nombre": "UCV"},
        ],
        contratos=[{"fecha_ingreso": "2015-03-01", "n_contrato": "C-1"}],
        contrato_actual={"n_contrato": "C-1", "fecha_culminacion": None, "politica_nombre": "Regular", "es_fijo": True},
        antecedentes=[{"fecha_ingreso": "2010-01-01", "fecha_egreso": "2014-01-01", "organismo_nombre": "Ministerio X"}],
        asignaciones=[
            {"codigo": "C-01", "denominacion_cargo_especifico": "Analista", "grado": "III",
             "tipo_nomina": "EMPLEADO", "coordinacion": None, "direccion_linea": None, "direccion_general": "Dirección General X"},
        ],
        encargadurias=[
            {"cargo_encargado": "Jefe de División", "titular_nombre": "Ana Gómez", "titular_cedula": "87654321",
             "fecha_inicio": "2023-01-01", "fecha_fin": None, "estatus_nombre": "ACTIVO"},
        ],
    )
    base.update(overrides)
    return EmpleadoDTO(**base)


@patch("apps.personal.infrastructure.pdf_empleado.construir_config_pdf", return_value=None)
def test_genera_pdf_valido_con_todas_las_secciones_pobladas(_mock_config):
    pdf = construir_pdf_expediente_empleado(_dto_base(), usuario_nombre="Admin Prueba")
    assert pdf.startswith(b"%PDF")


@patch("apps.personal.infrastructure.pdf_empleado.construir_config_pdf", return_value=None)
def test_genera_pdf_valido_con_secciones_opcionales_vacias(_mock_config):
    dto = _dto_base(
        datos_vivienda=None,
        perfil_salud=None,
        perfil_fisico=None,
        contrato_actual=None,
        contratos=[],
        antecedentes=[],
        asignaciones=[],
        encargadurias=[],
        formacion_academica=[],
    )
    pdf = construir_pdf_expediente_empleado(dto)
    assert pdf.startswith(b"%PDF")


@patch("apps.personal.infrastructure.pdf_empleado.construir_config_pdf", return_value={"tipo_cintillo": "GENERICO"})
def test_respeta_cintillo_generico(_mock_config):
    pdf = construir_pdf_expediente_empleado(_dto_base())
    assert pdf.startswith(b"%PDF")


@patch("apps.personal.infrastructure.pdf_empleado.construir_config_pdf", return_value=None)
def test_quien_genero_va_en_el_pie_y_no_arriba(_mock_config):
    from reportlab.pdfgen.canvas import Canvas
    dibujadas = []
    orig = Canvas.drawCentredString

    def captura(self, x, y, text, *a, **kw):
        dibujadas.append(text)
        return orig(self, x, y, text, *a, **kw)

    with patch.object(Canvas, "drawCentredString", captura):
        pdf = construir_pdf_expediente_empleado(_dto_base(), usuario_nombre="Admin Prueba (3333333)")
    assert pdf.startswith(b"%PDF")
    assert any(t.startswith("Generado el ") and "por Admin Prueba (3333333)" in t and "Página 1 de " in t for t in dibujadas)
    assert not any(t.startswith("Usuario:") for t in dibujadas)


@patch("apps.personal.infrastructure.pdf_empleado.construir_config_pdf", return_value=None)
def test_contactos_de_emergencia_limita_a_tres_con_nota(_mock_config):
    from reportlab.pdfgen.canvas import Canvas

    contactos = [
        {"id": i, "nombres": f"Nom{i}", "apellidos": "Ape", "telefono": "04141234567", "relacion_nombre": "HERMANO"}
        for i in (5, 1, 4, 2, 3)
    ]
    from reportlab.platypus import Paragraph
    textos = []
    orig_init = Paragraph.__init__

    def init(self, text, *a, **kw):
        textos.append(text)
        orig_init(self, text, *a, **kw)

    with patch.object(Paragraph, "__init__", init):
        pdf = construir_pdf_expediente_empleado(_dto_base(contacto_emergencia=contactos))
    assert pdf.startswith(b"%PDF")
    assert "Se muestran 3 de 5 contactos registrados." in textos
    nombres = [t for t in textos if t.startswith("Nom") and t.endswith(" Ape")]
    assert list(dict.fromkeys(nombres)) == ["Nom1 Ape", "Nom2 Ape", "Nom3 Ape"]
