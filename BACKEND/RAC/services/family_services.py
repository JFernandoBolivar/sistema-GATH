from datetime import date

from ..models.family_personal_models import Employeefamily


def validate_cedula_no_repetida(empleado, cedula_familiar):
    if not empleado or not cedula_familiar:
        return
    cedula = str(cedula_familiar).strip()
    if cedula == str(empleado.cedulaidentidad).strip():
        raise ValueError("La cédula del familiar no puede ser igual a la cédula del trabajador")


def validate_cedula_unica_por_empleado(empleado, cedula_familiar, exclude_id=None):
    if not empleado or not cedula_familiar:
        return
    cedula = str(cedula_familiar).strip()
    if cedula.lower() in ("", "null", "none"):
        return
    qs = Employeefamily.objects.filter(
        employeecedula=empleado, cedulaFamiliar=cedula
    )
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    if qs.exists():
        raise ValueError("Este familiar ya se encuentra registrado para este empleado")


def generar_cedula_hijo_menor(empleado, parentesco, fecha_nac, orden_manual=None, exclude_id=None):
    if not parentesco or not fecha_nac or not empleado:
        return None
    nombre_p = str(parentesco.descripcion_parentesco).upper().strip()
    if nombre_p != "HIJO (A)":
        return None
    today = date.today()
    edad = today.year - fecha_nac.year - (
        (today.month, today.day) < (fecha_nac.month, fecha_nac.day)
    )
    if edad >= 9:
        return None
    cedula_trabajador = str(empleado.cedulaidentidad)
    if orden_manual is not None:
        numero_final = orden_manual
    else:
        hijos = Employeefamily.objects.filter(
            employeecedula=empleado,
            cedulaFamiliar__startswith=f"{cedula_trabajador}-",
        ).count()
        numero_final = hijos + 1
    nueva_cedula = f"{cedula_trabajador}-{numero_final}"
    check = Employeefamily.objects.filter(
        employeecedula=empleado, cedulaFamiliar=nueva_cedula
    )
    if exclude_id is not None:
        check = check.exclude(pk=exclude_id)
    if check.exists():
        raise ValueError("El trabajador ya tiene un hijo registrado con el orden ingresado")
    return nueva_cedula


def validate_heredero_unico(empleado, heredero, exclude_id=None):
    if not heredero or not empleado:
        return
    qs = Employeefamily.objects.filter(employeecedula=empleado, heredero=True)
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    if qs.exists():
        raise ValueError("Este trabajador ya posee un familiar registrado como heredero")
