from types import SimpleNamespace
from RAC.models import Employee, AsigTrabajo


def employee_to_carnet_data(employee, datos_editados=None):
    nombre_completo = f"{employee.nombres} {employee.apellidos}".strip()

    cargo_nombre = ""
    departamento_nombre = ""

    asig = AsigTrabajo.objects.filter(
        employee=employee.cedulaidentidad
    ).select_related(
        'denominacioncargoid',
        'DireccionGeneral',
    ).first()

    if asig:
        if asig.denominacioncargoid:
            cargo_nombre = asig.denominacioncargoid.cargo
        if asig.DireccionGeneral:
            departamento_nombre = asig.DireccionGeneral.direccion_general

    codigo = ""
    if asig:
        codigo = asig.codigo

    if datos_editados:
        nombre_editado = datos_editados.get('nombre')
        if nombre_editado:
            nombre_completo = nombre_editado

    personal_virtual = SimpleNamespace()
    personal_virtual.nombre_completo = nombre_completo
    personal_virtual.cedula = employee.cedulaidentidad
    personal_virtual.codigo = codigo

    personal_virtual.cargo_ref = SimpleNamespace()
    personal_virtual.cargo_ref.nombre = cargo_nombre

    personal_virtual.departamento_ref = SimpleNamespace()
    personal_virtual.departamento_ref.nombre = departamento_nombre

    return personal_virtual


def get_employee_carnet_info(employee):
    nombre_completo = f"{employee.nombres} {employee.apellidos}".strip()

    cargo_nombre = ""
    departamento_nombre = ""
    codigo = ""

    asig = AsigTrabajo.objects.filter(
        employee=employee.cedulaidentidad
    ).select_related(
        'denominacioncargoid',
        'DireccionGeneral',
    ).first()

    if asig:
        if asig.denominacioncargoid:
            cargo_nombre = asig.denominacioncargoid.cargo
        if asig.DireccionGeneral:
            departamento_nombre = asig.DireccionGeneral.direccion_general
        codigo = asig.codigo

    return {
        'id': employee.id,
        'cedula': employee.cedulaidentidad,
        'nombre_completo': nombre_completo,
        'cargo': cargo_nombre,
        'departamento': departamento_nombre,
        'codigo': codigo,
        'correo': employee.correo or '',
        'telefono': employee.telefono_movil or '',
    }
