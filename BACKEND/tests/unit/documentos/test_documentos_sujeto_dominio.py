"""Huella de datos, IP enmascarada y validación de fechas de los campos propios (F-4/F-6)."""
import pytest

from apps.documentos.domain.services.variables_documento import enmascarar_ip, huella_datos
from apps.documentos.domain.value_objects.esquema_documento import validar_valores_propios
from core.domain.exceptions import ValidationError

BASE = {'nombres': 'ANA', 'foto': b'imagen', 'fecha_hoy': '24/11/2026', 'dia': '24', 'propio.sueldo': '10'}


def test_la_huella_ignora_las_fechas_del_dia_pero_no_los_datos():
    a = huella_datos(BASE, 'v1')
    assert a == huella_datos({**BASE, 'fecha_hoy': '25/11/2026', 'dia': '25'}, 'v1')
    assert a != huella_datos({**BASE, 'nombres': 'ANITA'}, 'v1')
    assert a != huella_datos({**BASE, 'propio.sueldo': '11'}, 'v1')
    assert a != huella_datos(BASE, 'v2')   # otra versión de la plantilla: otro documento


def test_la_huella_usa_la_huella_de_la_foto_con_o_sin_los_bytes():
    import hashlib
    sha = hashlib.sha256(b'imagen').hexdigest()
    con_bytes = huella_datos(BASE, 'v1')
    sin_bytes = huella_datos({k: v for k, v in BASE.items() if k != 'foto'} | {'_foto_sha256': sha}, 'v1')
    assert con_bytes == sin_bytes
    assert con_bytes != huella_datos({**BASE, 'foto': b'otra'}, 'v1')


@pytest.mark.parametrize('ip, esperado', [
    ('190.12.34.56', '190.12.•.•'), ('2001:db8:85a3::1', '2001:db8:•'), ('', ''), ('rara', '•'),
])
def test_enmascarar_ip(ip, esperado):
    assert enmascarar_ip(ip) == esperado


def test_fecha_propia_acepta_iso_y_latina_y_rechaza_lo_demas():
    campos = [{'clave': 'f', 'etiqueta': 'Fecha', 'tipo': 'fecha'}]
    assert validar_valores_propios(campos, {'f': '2026-12-01'}) == {'propio.f': '01/12/2026'}
    assert validar_valores_propios(campos, {'f': '01/12/2026'}) == {'propio.f': '01/12/2026'}
    for malo in ('2026-13-01', '31/04/2026', 'hoy'):
        with pytest.raises(ValidationError):
            validar_valores_propios(campos, {'f': malo})
