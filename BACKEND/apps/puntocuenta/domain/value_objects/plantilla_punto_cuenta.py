"""Procesos administrativos que pueden emitir un Punto de Cuenta.

El contenido y las firmas ya no pertenecen a esta aplicación: viven en las
plantillas publicadas del diseñador de documentos, identificadas por
``punto_cuenta:<proceso>``.
"""

# Proceso del Punto de Cuenta que emite Presupuesto al enviar un expediente de postulación a Dirección General (E-5).
PROCESO_INGRESO_POSTULACION = 'ingreso_postulacion'

PROCESOS_POR_DEFECTO = {
    'cambio_oficina': True,  # RN-006-01: activado por defecto
    'cambio_nivel': False,
    'cambio_division': False,
    'cambio_cargo_misma_oficina': False,
    'egreso_activo': False,
    'pase_a_pasivo': False,
    'encargaduria_prestamo': False,
    'cambio_estatus': False,
    # El ingreso de un postulante siempre genera su Punto de Cuenta (es parte del flujo): esta clave habilita la
    # plantilla propia del proceso en la configuración; no lo apaga.
    PROCESO_INGRESO_POSTULACION: True,
}
