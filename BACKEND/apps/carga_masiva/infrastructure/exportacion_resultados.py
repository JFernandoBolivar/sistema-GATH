"""
Exportación Excel de los resultados de una carga masiva (S5-01).

Antes construía el libro dentro de la vista. Mismo contenido, mismas columnas
y misma neutralización de fórmulas (S6-02).
"""
from io import BytesIO

from openpyxl import Workbook

from core.infrastructure.pdf.excel_seguro import neutralizar_fila_valores


class ExportadorResultadosCargaORM:
    """Implementa el puerto `ExportadorResultadosCarga`."""

    def generar_bytes(self, carga) -> bytes:
        filas = list(carga.filas.all())
        claves = []
        for fila in filas:
            for clave in fila.datos:
                if clave not in claves:
                    claves.append(clave)
        columnas = ['Población', 'Archivo', 'Tipo', 'Fila', 'Estado', 'Detalle', *claves]
        libro = Workbook()
        hoja = libro.active
        hoja.title = 'Resultados'
        # Las claves salen del archivo que sube el usuario: la cabecera también
        # se neutraliza (S6-02) o abriría una fórmula al pulsar la celda.
        hoja.append(neutralizar_fila_valores(columnas))
        for fila in filas:
            hoja.append(neutralizar_fila_valores([
                carga.poblacion, carga.archivo_nombre, fila.tipo, fila.numero_fila, fila.estado,
                fila.detalle, *[fila.datos.get(clave, '') for clave in claves],
            ]))
        buffer = BytesIO()
        libro.save(buffer)
        return buffer.getvalue()
