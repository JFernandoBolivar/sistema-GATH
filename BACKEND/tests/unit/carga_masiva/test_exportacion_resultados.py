"""S6-02: la cabecera del Excel de resultados también se neutraliza.

Las claves de columna salen del archivo `.xlsx` que sube el usuario: sin
neutralizar la fila de cabeceras, una clave como `=HYPERLINK(...)` se abriría
como fórmula al pulsar la celda. Puro: no usa base de datos.
"""
from io import BytesIO
from types import SimpleNamespace

from openpyxl import load_workbook

from apps.carga_masiva.infrastructure.exportacion_resultados import (
    ExportadorResultadosCargaORM,
)


class _FilasDeCarga(list):
    """Doble de `carga.filas` (un related manager solo necesita `.all()`)."""

    def all(self):
        return list(self)


def _carga(claves: list[str]):
    filas = [
        SimpleNamespace(
            tipo='ACTIVO', numero_fila=2, estado='NUEVO', detalle='ok',
            datos={clave: '' for clave in claves},
        ),
    ]
    return SimpleNamespace(
        poblacion='ACTIVOS', archivo_nombre='carga.xlsx', filas=_FilasDeCarga(filas),
    )


def _hoja(contenido: bytes):
    return load_workbook(BytesIO(contenido)).active


def test_cabecera_con_formula_del_archivo_del_usuario_queda_como_texto():
    hoja = _hoja(ExportadorResultadosCargaORM().generar_bytes(
        _carga(['=HYPERLINK("http://x","clic")', '@SUM(1+1)']),
    ))
    cabecera = [celda.value for celda in hoja[1]]
    assert "'=HYPERLINK(\"http://x\",\"clic\")" in cabecera
    assert "'@SUM(1+1)" in cabecera


def test_cabecera_normal_y_fijas_no_se_tocan():
    hoja = _hoja(ExportadorResultadosCargaORM().generar_bytes(_carga(['Cédula', 'Nombres'])))
    cabecera = [celda.value for celda in hoja[1]]
    assert cabecera[:6] == ['Población', 'Archivo', 'Tipo', 'Fila', 'Estado', 'Detalle']
    assert 'Cédula' in cabecera and 'Nombres' in cabecera


def test_celdas_de_datos_siguen_neutralizadas():
    hoja = _hoja(ExportadorResultadosCargaORM().generar_bytes(_carga(['Cédula'])))
    fila = [celda.value for celda in hoja[2]]
    assert fila[0] == 'ACTIVOS'
    assert fila[1] == 'carga.xlsx'
