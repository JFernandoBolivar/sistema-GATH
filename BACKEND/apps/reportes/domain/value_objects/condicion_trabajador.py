"""
Condición del trabajador en los reportes: solo `ACTIVO` o `PASIVO`.

Es un valor cerrado y validado: nunca un texto libre que llegue al ORM. La regla
de qué trabajador cae en cada condición vive en la infraestructura
(`consultas_reporte.filtro_por_condicion`), el mismo criterio del listado de
Personal Activo y del de Pasivos.
"""
from core.domain.exceptions import ValidationError

CONDICION_ACTIVO = 'ACTIVO'
CONDICION_PASIVO = 'PASIVO'
CONDICIONES = (CONDICION_ACTIVO, CONDICION_PASIVO)


def normalizar_condicion(valor, defecto: str = CONDICION_ACTIVO) -> str:
    """`valor` vacío usa `defecto`; cualquier otro que no sea ACTIVO/PASIVO es un 400."""
    if valor is None or str(valor).strip() == '':
        return defecto
    texto = str(valor).strip().upper()
    if texto not in CONDICIONES:
        raise ValidationError(
            f'Condición no válida: «{valor}». Opciones: {", ".join(CONDICIONES)}.',
            campo='condicion',
        )
    return texto
