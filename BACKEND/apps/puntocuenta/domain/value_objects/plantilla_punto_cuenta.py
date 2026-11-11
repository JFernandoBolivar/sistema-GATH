"""
Valores por defecto de la plantilla del Punto de Cuenta (puro, sin Django).

Vivían en el modelo ORM; el caso de uso los necesita y `application` no puede
importar `infrastructure` (regla B2/B4). El modelo los reutiliza.
"""

PROCESOS_POR_DEFECTO = {
    'cambio_oficina': True,  # RN-006-01: activado por defecto
    'cambio_nivel': False,
    'cambio_division': False,
    'cambio_cargo_misma_oficina': False,
    'egreso_activo': False,
    'pase_a_pasivo': False,
    'encargaduria_prestamo': False,
    'cambio_estatus': False,
}

FIRMAS_POR_DEFECTO = [
    {
        'cargo': 'Director(a) General de Gestión Humana',
        'nombre': '',
    },
]

TITULO_POR_DEFECTO = 'PUNTO DE CUENTA'
ENCABEZADO_POR_DEFECTO = 'Para su conocimiento y fines pertinentes, se notifica el siguiente movimiento de personal:'
CUERPO_POR_DEFECTO = (
    'Por medio del presente punto de cuenta, se deja constancia del movimiento del funcionario '
    '{nombre}, titular de la cédula de identidad N.º {cedula}, en el cargo {cargo}. '
    'Movimiento desde {origen} hacia {destino}, con fecha {fecha} y motivo {motivo}, '
    'bajo el Punto de Cuenta N.º {numero}.'
)
