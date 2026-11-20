"""Estados de una solicitud de carnet hecha por el trabajador desde Autogestión.

El trabajador SOLICITA y Recursos Humanos revisa foto y datos y emite (APROBADA) o
rechaza con motivo (RECHAZADA). El trabajador puede retirar la suya mientras está
PENDIENTE (CANCELADA). Puro: sin Django (regla B1).
"""
PENDIENTE = 'PENDIENTE'
APROBADA = 'APROBADA'
RECHAZADA = 'RECHAZADA'
CANCELADA = 'CANCELADA'

ESTADOS = (PENDIENTE, APROBADA, RECHAZADA, CANCELADA)
ESTADOS_FINALES = (APROBADA, RECHAZADA, CANCELADA)

LARGO_MAXIMO_TEXTO = 500
