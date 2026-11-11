"""
Adaptador ORM/SQL de la corrección de cédula (implementa `RepoCorreccionCedula`).

Las FK hacia `Employee` son DEFERRABLE INITIALLY DEFERRED y sin ON UPDATE CASCADE: dentro de la
transacción se reescribe `Employee` y cada tabla por su cédula, y la integridad se comprueba al
confirmar. Los nombres de tabla y columna salen de la lista fija de abajo (nunca de la entrada);
los valores siempre van parametrizados.

Lista explícita, verificada contra los modelos y la base. Se actualiza todo campo cuyo valor sea
exactamente la cédula vieja, incluidos los de «actor» (quién hizo algo). NO se tocan:
`auditoria_log` (cadena de hash), los PDF y rutas de SeaweedFS, `RAC_*.cedulaFamiliar` (cédula del
familiar, no del titular; solo se reescribe el prefijo de la sintética) ni `configuracion_regla_parentesco.sin_cedula_hasta_edad` (una edad).
"""
from typing import Sequence

from django.db import connection

from apps.personal.infrastructure.models.personal_models import EmployeeModel

# (nombre legible, tabla, columna). Varias filas pueden compartir nombre: se suman.
_EMPLOYEE = ('Ficha del trabajador', 'Employee', 'cedulaIdentidad')
REFERENCIAS_CEDULA: tuple[tuple[str, str, str], ...] = (
    ('Cuenta de acceso', 'USER_cuenta', 'cedula'),
    ('Asignación de cargo', 'AsigTrabajo', 'employeeCedula'),
    ('Encargaduría de cargo', 'PrestamoCargo', 'empleadoEncargadoCedula'),
    ('Familiares', 'RAC_employeefamily', 'employeeCedula'),
    ('Historial de familiares', 'RAC_historicalemployeefamily', 'employeeCedula'),
    ('Egreso o pasivo', 'EmployeeEgresado', 'employeeCedula'),
    ('Respuestas de encuesta', 'RespuestasEncuesta', 'empleado_cedula'),
    ('Permisos individuales', 'identidad_usuario_permiso', 'cedula'),
    ('Intentos fallidos de acceso', 'identidad_intento_fallido', 'cedula'),
    ('Excepción de correo de acceso', 'configuracion_excepcion_correo_acceso', 'cedula'),
    ('Excepción de correo de acceso', 'configuracion_excepcion_correo_acceso', 'actor_cedula'),
    ('Solicitudes de fe de vida', 'fe_de_vida_solicitud', 'cedula'),
    ('Solicitudes de fe de vida', 'fe_de_vida_solicitud', 'registrada_por_cedula'),
    ('Prórrogas de fe de vida', 'fe_de_vida_prorroga_proceso', 'cedula'),
    ('Guías vistas de fe de vida', 'fe_de_vida_guia_vista', 'cedula'),
    ('Decisiones de fe de vida', 'fe_de_vida_decision', 'actor_cedula'),
    ('Reenvíos de constancia de fe de vida', 'fe_de_vida_reenvio_constancia', 'actor_cedula'),
    ('Datos complementarios', 'datos_complementarios_trabajador', 'cedula'),
    ('Solicitudes de actualización de datos', 'autogestion_solicitud_actualizacion', 'cedula'),
    ('Secciones abiertas de autogestión', 'autogestion_seccion_abierta', 'cedula'),
    ('Guías vistas de autogestión', 'autogestion_guia_vista', 'cedula'),
    ('Puntos de cuenta', 'puntocuenta_punto_cuenta', 'empleado_cedula'),
    ('Notificaciones', 'notificaciones_notificacion', 'destinatario_cedula'),
    ('Eventos de notificación', 'notificaciones_evento_outbox', 'destinatario_cedula'),
    ('Reportes de error de datos', 'personal_reporte_error_dato_laboral', 'trabajador_cedula'),
    ('Reportes de error de datos', 'personal_reporte_error_dato_laboral', 'atendido_por_cedula'),
    ('Cargas masivas', 'carga_masiva', 'solicitada_por_cedula'),
    ('Cargas masivas', 'carga_masiva', 'aprobada_por_cedula'),
    ('Filas de carga masiva', 'carga_masiva_fila', 'confirmada_por_cedula'),
    ('Exportaciones', 'exportaciones_trabajo', 'solicitante_cedula'),
    ('Procesos de fe de vida (actor)', 'fe_de_vida_proceso', 'creado_por'),
    ('Procesos de fe de vida (actor)', 'fe_de_vida_proceso', 'abierto_por'),
    ('Procesos de fe de vida (actor)', 'fe_de_vida_proceso', 'cerrado_por'),
    ('Prórrogas de fe de vida', 'fe_de_vida_prorroga_proceso', 'concedida_por'),
    ('Solicitudes de actualización de datos', 'autogestion_solicitud_actualizacion', 'decidida_por'),
    ('Solicitudes de actualización de datos', 'autogestion_solicitud_actualizacion', 'devuelta_por'),
    ('Solicitudes de actualización de datos', 'autogestion_solicitud_actualizacion', 'habilitada_por'),
    ('Cambios propuestos de autogestión', 'autogestion_cambio_propuesto', 'decidido_por'),
    ('Soportes documentales', 'autogestion_soporte_documental', 'subido_por'),
    ('Prórrogas de ventana de autogestión', 'autogestion_prorroga_ventana', 'prorrogada_por'),
    ('Datos complementarios', 'datos_complementarios_trabajador', 'actualizado_por'),
    ('Imágenes del cintillo', 'configuracion_version_imagen_cintillo', 'subido_por_cedula'),
)

# Cédula sintética de los hijos menores sin cédula: `<cédula del titular>-<orden>`. Se cambia solo
# el prefijo. (Etiqueta, tabla, columna).
SINTETICAS: tuple[tuple[str, str, str], ...] = (
    ('Cédulas sintéticas de familiares', 'RAC_employeefamily', 'cedulaFamiliar'),
    ('Cédulas sintéticas de familiares', 'RAC_historicalemployeefamily', 'cedulaFamiliar'),
)

# Tablas donde la cédula es única: una cédula nueva no puede estar ya en ninguna.
_TABLAS_UNICAS: tuple[tuple[str, str], ...] = (
    ('Employee', 'cedulaIdentidad'),
    ('USER_cuenta', 'cedula'),
    ('identidad_usuario_permiso', 'cedula'),
    ('configuracion_excepcion_correo_acceso', 'cedula'),
    ('datos_complementarios_trabajador', 'cedula'),
)


def _columnas_existentes(cursor, pares) -> set[tuple[str, str]]:
    """Las tablas legadas pueden faltar en una base reconstruida (pruebas)."""
    cursor.execute(
        """
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = ANY(%s)
        """,
        [sorted({tabla for tabla, _ in pares})],
    )
    return {(t, c) for t, c in cursor.fetchall()}


class RepoCorreccionCedulaORM:
    def obtener_nombre(self, cedula: str) -> str | None:
        fila = (
            EmployeeModel.objects.filter(cedulaidentidad=cedula)
            .values_list('apellidos', 'nombres')
            .first()
        )
        if fila is None:
            return None
        return ' '.join(p.strip() for p in fila if p and p.strip())

    def contar_afectados(self, cedula: str) -> Sequence[tuple[str, int]]:
        recursos = (_EMPLOYEE, *REFERENCIAS_CEDULA)
        totales: dict[str, int] = {}
        with connection.cursor() as cursor:
            existentes = _columnas_existentes(cursor, [(t, c) for _, t, c in (*recursos, *SINTETICAS)])
            for etiqueta, tabla, columna in recursos:
                if (tabla, columna) not in existentes:
                    continue
                cursor.execute(
                    f'SELECT COUNT(*) FROM "{tabla}" WHERE "{columna}" = %s', [cedula],
                )
                totales[etiqueta] = totales.get(etiqueta, 0) + cursor.fetchone()[0]
            for etiqueta, tabla, columna in SINTETICAS:
                if (tabla, columna) not in existentes:
                    continue
                cursor.execute(
                    f'SELECT COUNT(*) FROM "{tabla}" WHERE LEFT("{columna}", %s) = %s',
                    [len(cedula) + 1, f'{cedula}-'],
                )
                totales[etiqueta] = totales.get(etiqueta, 0) + cursor.fetchone()[0]
        return [(etiqueta, n) for etiqueta, n in totales.items() if n > 0]

    def existe_cedula(self, cedula: str) -> bool:
        with connection.cursor() as cursor:
            existentes = _columnas_existentes(cursor, _TABLAS_UNICAS)
            for tabla, columna in _TABLAS_UNICAS:
                if (tabla, columna) not in existentes:
                    continue
                cursor.execute(
                    f'SELECT 1 FROM "{tabla}" WHERE "{columna}" = %s LIMIT 1', [cedula],
                )
                if cursor.fetchone():
                    return True
        return False

    def aplicar(self, cedula_vieja: str, cedula_nueva: str) -> Sequence[tuple[str, int]]:
        recursos = (_EMPLOYEE, *REFERENCIAS_CEDULA)
        totales: dict[str, int] = {}
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT 1 FROM "Employee" WHERE "cedulaIdentidad" = %s FOR UPDATE', [cedula_vieja],
            )
            existentes = _columnas_existentes(cursor, [(t, c) for _, t, c in (*recursos, *SINTETICAS)])
            for etiqueta, tabla, columna in recursos:
                if (tabla, columna) not in existentes:
                    continue
                cursor.execute(
                    f'UPDATE "{tabla}" SET "{columna}" = %s WHERE "{columna}" = %s',
                    [cedula_nueva, cedula_vieja],
                )
                totales[etiqueta] = totales.get(etiqueta, 0) + cursor.rowcount
            for etiqueta, tabla, columna in SINTETICAS:
                if (tabla, columna) not in existentes:
                    continue
                cursor.execute(
                    f'UPDATE "{tabla}" SET "{columna}" = %s || SUBSTRING("{columna}" FROM %s) '
                    f'WHERE LEFT("{columna}", %s) = %s',
                    [cedula_nueva, len(cedula_vieja) + 1, len(cedula_vieja) + 1, f'{cedula_vieja}-'],
                )
                totales[etiqueta] = totales.get(etiqueta, 0) + cursor.rowcount
        return [(etiqueta, n) for etiqueta, n in totales.items() if n > 0]
