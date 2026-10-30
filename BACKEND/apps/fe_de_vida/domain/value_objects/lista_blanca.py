"""
Campos que el pasivo puede proponer en el acta de fe de vida ADEMÁS de los de autogestión (plan 2.9, decisión C).

En fe de vida la identidad civil sí se puede corregir (nombres, apellidos y fecha de nacimiento), porque el
acta pasa por la doble aprobación de Bienestar antes de aplicarse. La lista de autogestión del activo no se
toca: la infraestructura une ambas. Sin Django.
"""
SECCION_IDENTIDAD = 'identidad'

CAMPOS_ADICIONALES_ACTA: dict[str, dict[str, frozenset[str]]] = {
    SECCION_IDENTIDAD: {'employee': frozenset({'nombres', 'apellidos', 'fecha_nacimiento'})},
}
