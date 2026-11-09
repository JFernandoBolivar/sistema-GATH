"""Constantes compartidas de la fe de vida (O39).

La justificación de «No tiene correo» (excepción presencial) usa el mismo
mínimo, tope y mensaje en la vista, el serializer y el dominio.
"""

MIN_JUSTIFICACION_SIN_CORREO = 10
MAX_JUSTIFICACION_SIN_CORREO = 500

MENSAJE_JUSTIFICACION_SIN_CORREO = (
    "Indique la justificación de por qué el pasivo no tiene correo "
    f"(mínimo {MIN_JUSTIFICACION_SIN_CORREO} caracteres)."
)

MENSAJE_CORREO_ALTERNATIVO = "El correo alternativo es obligatorio para la fe de vida."
