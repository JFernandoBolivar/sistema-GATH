"""FIX-QA14: filas de reportes con el APN legible.

El decimal crudo (0.0082) se convierte a «3 días de servicio en APN»; sin fecha
de ingreso se muestra «—»; la columna interna `apn_aviso` no sale en el archivo.
"""
from apps.reportes.infrastructure.exportacion import preparar_filas_reporte


def test_formatea_el_apn_y_quita_el_aviso_de_las_filas_exportadas():
    filas = [
        {'cedula': '1', 'total_anos_apn': 0.0082, 'apn_aviso': ''},
        {'cedula': '2', 'total_anos_apn': 0, 'apn_aviso': 'Fecha de ingreso pendiente'},
        {'cedula': '3', 'total_anos_apn': 4.5},
    ]

    resultado = preparar_filas_reporte(filas)

    assert resultado[0]['total_anos_apn'] == '3 días de servicio en APN'
    assert 'apn_aviso' not in resultado[0]
    assert resultado[1]['total_anos_apn'] == '—'
    assert 'apn_aviso' not in resultado[1]
    assert resultado[2]['total_anos_apn'] == '4 años y 6 meses de servicio en APN'


def test_no_muta_las_filas_originales_que_usa_la_pantalla():
    filas = [{'total_anos_apn': 0.0082, 'apn_aviso': ''}]

    preparar_filas_reporte(filas)

    assert filas[0]['total_anos_apn'] == 0.0082
    assert filas[0]['apn_aviso'] == ''
