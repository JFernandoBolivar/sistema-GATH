"""Planilla de fe de vida: instantánea de datos y PDF (sin BD)."""
from io import BytesIO

from PIL import Image

from apps.fe_de_vida.infrastructure.planilla import _contactos, _familiares, _vivienda
from apps.fe_de_vida.infrastructure.pdf import planilla_pdf


def _ficha():
    return {
        'empleado': {
            'cedula': '5111111', 'nombres': 'MARIA', 'apellidos': 'PEREZ',
            'sexo_nombre': 'FEMENINO', 'fecha_nacimiento': '1950-12-05',
            'correo': 'maria@correo.test', 'telefono_movil': '04140000000',
            'telefono_habitacion': None,
            'datos_vivienda': {
                'pais_nombre': 'Venezuela', 'pais_es_venezuela': True,
                'estado_nombre': 'MIRANDA', 'municipio_nombre': 'SUCRE',
                'parroquia_nombre': 'PETARE', 'codigo_postal_nombre': '1073',
                'direccion_exacta': 'Calle 1', 'condicion_vivienda_nombre': 'PROPIA',
            },
            'contacto_emergencia': [
                {'nombres': 'LUIS', 'apellidos': 'PEREZ', 'relacion_nombre': 'HIJO', 'telefono': '04141111111'},
            ],
            'asignaciones': [{'tipo_nomina': 'JUBILADO'}],
        },
        'familiares': [
            {
                'primer_nombre': 'ANA', 'segundo_nombre': 'MARIA', 'primer_apellido': 'PEREZ',
                'segundo_apellido': 'GOMEZ', 'cedula_familiar': '12345678',
                'parentesco_nombre': 'HIJO (A)', 'fecha_nacimiento': '1990-01-01', 'sexo_nombre': 'FEMENINO',
            },
        ],
        'datos_complementarios': {'correo_alternativo': 'alt@correo.test', 'tiene_hijos': True},
    }


def _datos(foto: bool = True) -> dict:
    ficha = _ficha()
    return {
        'proceso': {'nombre': 'Fe de vida 2026', 'estado': 'CERRADO'},
        'solicitud': {
            'canal': 'EN_LINEA', 'fecha_envio': '2026-11-19T09:00:00+00:00',
            'fecha_validacion': '2026-11-19T10:00:00+00:00',
        },
        'constancia': {'numero': 'FV-2026-000001'},
        'persona': {
            'cedula': '5111111', 'nombres': 'MARIA', 'apellidos': 'PEREZ',
            'sexo': 'FEMENINO', 'fecha_nacimiento': '1950-12-05',
            'correo': 'maria@correo.test', 'telefono_movil': '04140000000',
            'telefono_habitacion': '',
        },
        'tipo_pasivo': 'JUBILADO',
        'vivienda': {
            'es_venezuela': True, 'pais': 'Venezuela', 'estado': 'MIRANDA',
            'municipio': 'SUCRE', 'parroquia': 'PETARE', 'codigo_postal': '1073',
            'direccion': 'Calle 1', 'condicion': 'PROPIA',
        },
        'familiares': _familiares(ficha),
        'contactos': _contactos(ficha),
        'complementarios': {'correo_alternativo': 'alt@correo.test', 'tiene_hijos': True},
        'foto': {'clave': 'fe_de_vida/evidencia/foto.jpg' if foto else '', 'mime': 'image/jpeg'},
    }


class _Almacen:
    def __init__(self, contenido=b''):
        self.contenido = contenido

    def descargar(self, clave):
        return self.contenido


def _foto_bytes(ancho: int = 80, alto: int = 100) -> bytes:
    buffer = BytesIO()
    Image.new('RGB', (ancho, alto), (120, 90, 60)).save(buffer, format='JPEG')
    return buffer.getvalue()


def test_familiares_contactos_y_vivienda_se_normalizan():
    ficha = _ficha()
    assert _familiares(ficha) == [{
        'nombres': 'ANA MARIA PEREZ GOMEZ', 'cedula': '12345678', 'parentesco': 'HIJO (A)',
        'fecha_nacimiento': '1990-01-01', 'sexo': 'FEMENINO',
    }]
    assert _contactos(ficha) == [{
        'nombres': 'LUIS PEREZ', 'parentesco': 'HIJO', 'telefono': '04141111111',
    }]
    assert _vivienda(ficha, {})['estado_nombre'] == 'MIRANDA'


def test_pdf_con_foto(monkeypatch):
    monkeypatch.setattr(planilla_pdf, 'construir_config_pdf', lambda: {})
    monkeypatch.setattr(planilla_pdf, 'SeaweedFSStorage', lambda: _Almacen(_foto_bytes()))
    pdf = planilla_pdf.generar_planilla_pdf(_datos(foto=True))
    assert pdf.startswith(b'%PDF') and len(pdf) > 1000


def test_pdf_con_foto_horizontal_usa_la_banda_ancha(monkeypatch):
    monkeypatch.setattr(planilla_pdf, 'construir_config_pdf', lambda: {})
    monkeypatch.setattr(planilla_pdf, 'SeaweedFSStorage', lambda: _Almacen(_foto_bytes(400, 160)))
    pdf = planilla_pdf.generar_planilla_pdf(_datos(foto=True))
    assert pdf.startswith(b'%PDF') and len(pdf) > 1000


def test_pdf_sin_foto_genera_el_aviso(monkeypatch):
    monkeypatch.setattr(planilla_pdf, 'construir_config_pdf', lambda: {})
    monkeypatch.setattr(planilla_pdf, 'SeaweedFSStorage', lambda: _Almacen(b''))
    pdf = planilla_pdf.generar_planilla_pdf(_datos(foto=False))
    assert pdf.startswith(b'%PDF') and len(pdf) > 1000
