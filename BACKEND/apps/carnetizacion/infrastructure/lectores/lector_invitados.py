"""
Lectura de archivos de invitados (XLSX/CSV) para la importación de eventos.

Vive en infraestructura: la vista solo valida la entrada y el caso de uso
orquesta la importación. Conserva los mensajes y el límite de tamaño que ya
exponía la API.
"""
import csv
import io
import logging

from core.domain.exceptions import ValidationError
from core.infrastructure.storage.validacion_archivo import MAX_BYTES_DOCUMENTO

logger = logging.getLogger('security_backend')


def leer_archivo_invitados(archivo) -> list[dict[str, str]]:
    """Devuelve las filas del archivo como diccionarios; lanza `ValidationError`."""
    if archivo.size > MAX_BYTES_DOCUMENTO:
        raise ValidationError(
            'El archivo excede el tamaño máximo de '
            f'{MAX_BYTES_DOCUMENTO // (1024 * 1024)} MB.'
        )
    nombre = (getattr(archivo, 'name', '') or '').lower()
    if not nombre.endswith(('.xlsx', '.csv')):
        raise ValidationError('El archivo debe ser .xlsx o .csv.')
    if nombre.endswith('.xlsx'):
        return _leer_xlsx(archivo)
    return _leer_csv(archivo)


def _leer_xlsx(archivo) -> list[dict[str, str]]:
    try:
        import openpyxl

        wb = openpyxl.load_workbook(
            io.BytesIO(archivo.read()), read_only=True, data_only=True,
        )
        ws = wb.active
        filas_iter = ws.iter_rows(values_only=True)
        encabezados = next(filas_iter, None)
        if not encabezados:
            raise ValidationError('El archivo Excel está vacío')
        claves = [
            str(col).strip().lower() if col is not None else ''
            for col in encabezados
        ]
        filas: list[dict[str, str]] = []
        for fila_val in filas_iter:
            if not any(fila_val):
                continue
            fila_dict: dict[str, str] = {}
            for idx_c, val in enumerate(fila_val):
                if idx_c < len(claves) and claves[idx_c]:
                    fila_dict[claves[idx_c]] = str(val if val is not None else '').strip()
            filas.append(fila_dict)
        return filas
    except ValidationError:
        raise
    except Exception:  # noqa: BLE001 - el archivo lo sube el usuario
        logger.exception('No se pudo leer el archivo Excel de invitados')
        raise ValidationError(
            'No se pudo leer el archivo Excel. Verifique el formato e intente de nuevo.'
        ) from None


def _leer_csv(archivo) -> list[dict[str, str]]:
    try:
        contenido = archivo.read().decode('utf-8-sig')
        return [dict(fila) for fila in csv.DictReader(io.StringIO(contenido))]
    except Exception:  # noqa: BLE001 - el archivo lo sube el usuario
        logger.exception('No se pudo leer el archivo CSV de invitados')
        raise ValidationError(
            'No se pudo leer el archivo CSV. Verifique el formato e intente de nuevo.'
        ) from None
