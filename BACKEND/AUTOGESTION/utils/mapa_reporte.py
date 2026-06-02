MAPA_REPORTES = {
    "censo_vivienda": {
        "modelo": "Employee",
        "campos_permitidos": {
            "dependencia": "assignments__Dependencia__dependencia",
            "direccion_general": "assignments__DireccionGeneral__direccion_general",
            "direccion_linea": "assignments__DireccionLinea__direccion_linea",
            "coordinacion": "assignments__Coordinacion__coordinacion",
            "tipo_nomina": "assignments__tiponominaid__nomina",
        },
        "filtros_permitidos": {
            "dependencia_id": "assignments__Dependencia",
            "direccion_general_id": "assignments__DireccionGeneral",
            "direccion_linea_id": "assignments__DireccionLinea",
            "coordinacion_id": "assignments__Coordinacion",
            "nomina_id": "assignments__tiponominaid",
        }
    }
}
