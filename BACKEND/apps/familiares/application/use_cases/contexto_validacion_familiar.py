"""
Casos de uso de apoyo a la validación de un familiar (S5-01).

Son lecturas puntuales: el serializer de entrada ya no consulta el ORM, pide
estos datos a la infraestructura a través del puerto
`LectorValidacionFamiliar`. Las reglas puras siguen en
`validaciones_familiar.py`.
"""
from apps.familiares.application.use_cases.validaciones_familiar import (
    ReglaParentescoFamiliar,
)
from apps.familiares.domain.ports.lector_validacion_familiar import (
    LectorValidacionFamiliar,
    ParentescoDeFamiliar,
    TitularDeFamiliar,
)


def titular_del_familiar(
    lector: LectorValidacionFamiliar, empleado_cedula: str,
) -> TitularDeFamiliar | None:
    """Titular del familiar (existencia + fecha de nacimiento) con una sola consulta."""
    return lector.titular(empleado_cedula)


def parentesco_y_regla(
    lector: LectorValidacionFamiliar, parentesco_id: int | None,
) -> tuple[ParentescoDeFamiliar | None, ReglaParentescoFamiliar]:
    """Parentesco elegido (si existe) y la regla configurada para él."""
    if parentesco_id is None:
        return None, ReglaParentescoFamiliar()
    parentesco = lector.parentesco(parentesco_id)
    if parentesco is None:
        return None, ReglaParentescoFamiliar()
    return parentesco, lector.regla_de_parentesco(parentesco)


def sexo_del_familiar(lector: LectorValidacionFamiliar, sexo_id: int) -> str | None:
    return lector.sexo_nombre(sexo_id)


def cedulas_del_familiar(
    lector: LectorValidacionFamiliar, empleado_cedula: str, excluir_id: int | None,
) -> set[str]:
    return lector.cedulas_familiares(empleado_cedula, excluir_id)


def heredero_existente(
    lector: LectorValidacionFamiliar, empleado_cedula: str, excluir_id: int | None,
) -> bool:
    return lector.existe_heredero(empleado_cedula, excluir_id)
