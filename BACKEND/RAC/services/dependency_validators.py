def validate_dependency_hierarchy(dependencia, direccion_general, direccion_linea, coordinacion):
    if direccion_general and dependencia:
        if direccion_general.dependenciaId_id != dependencia.id:
            raise ValueError(
                "La Dirección General seleccionada no pertenece a la Dependencia indicada"
            )

    if direccion_linea and direccion_general:
        if direccion_linea.direccionGeneral_id != direccion_general.id:
            raise ValueError(
                "La Direccion de Linea seleccionada no pertenece a la Direccion General indicada"
            )

    if coordinacion:
        if not direccion_linea:
            raise ValueError(
                "Debe seleccionar una Dirección de Linea para asignar esta Coordinación"
            )
        parent_dl_id = getattr(coordinacion, "direccionLinea_id", None)
        if parent_dl_id and parent_dl_id != direccion_linea.id:
            raise ValueError(
                "La coordinación no pertenece a la Dirección de Línea seleccionada"
            )
