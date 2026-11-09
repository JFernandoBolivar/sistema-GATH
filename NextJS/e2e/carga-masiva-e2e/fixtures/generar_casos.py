import os
import io
import shutil
import openpyxl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_ACTIVOS = os.path.join(BASE_DIR, "base_activos.xlsx")
BASE_PASIVOS = os.path.join(BASE_DIR, "base_pasivos.xlsx")

def get_col_map(ws, header_row=3):
    col_map = {}
    for col in range(1, ws.max_column + 1):
        val = ws.cell(row=header_row, column=col).value
        if val:
            clean = str(val).replace("*", "").strip()
            col_map[clean] = col
    return col_map

def fill_row(ws, row_idx, data, col_map):
    for label, val in data.items():
        if label in col_map:
            ws.cell(row=row_idx, column=col_map[label], value=val)

def main():
    print("Iniciando generación de fixtures para O47-E2E...")

    # 1. c01_activos_valido.xlsx
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    fill_row(ws, 5, {
        "Cédula": "88001001",
        "Nombres": "E2E CARLOS",
        "Apellidos": "E2E PEREZ",
        "Sexo": "MASCULINO",
        "Fecha de nacimiento": "1990-05-15",
        "Nacionalidad": "VENEZOLANO",
        "Estado civil": "Soltero(a)",
        "Correo": "e2e.carlos@conatel.gob.ve",
        "Teléfono móvil": "04121234567"
    }, col_map)
    fill_row(ws, 6, {
        "Cédula": "88001002",
        "Nombres": "E2E LAURA",
        "Apellidos": "E2E GOMEZ",
        "Sexo": "FEMENINO",
        "Fecha de nacimiento": "1992-08-20",
        "Nacionalidad": "VENEZOLANO",
        "Estado civil": "Casado(a)",
        "Correo": "e2e.laura@conatel.gob.ve",
        "Teléfono móvil": "04149876543"
    }, col_map)
    wb.save(os.path.join(BASE_DIR, "c01_activos_valido.xlsx"))

    # 1b. c01_pasivos_valido.xlsx (Cédula de pasivo real para actualizar)
    wb = openpyxl.load_workbook(BASE_PASIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    fill_row(ws, 5, {
        "Cédula": "4588543",
        "Nombres": "E2E PASIVO EDIT",
        "Apellidos": "E2E ACTUALIZADO",
        "Sexo": "MASCULINO",
        "Fecha de nacimiento": "1955-01-01",
        "Nacionalidad": "VENEZOLANO",
        "Estado civil": "Soltero(a)",
        "Correo": "e2e.pasivo.edit@conatel.gob.ve",
        "Teléfono móvil": "04161112233"
    }, col_map)
    wb.save(os.path.join(BASE_DIR, "c01_pasivos_valido.xlsx"))

    # 2. c02_archivo_vacio.xlsx (Sin filas de datos)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    # Dejamos solo hasta fila 4 (instrucciones y ejemplos), sin filas de datos
    wb.save(os.path.join(BASE_DIR, "c02_archivo_vacio.xlsx"))

    # 3. c03_formato_no_excel.xlsx (Texto plano renombrado)
    with open(os.path.join(BASE_DIR, "c03_formato_no_excel.xlsx"), "w", encoding="utf-8") as f:
        f.write("Este archivo es texto plano y no un libro Excel válido.")

    # 4. c04_columnas_alteradas.xlsx (Columnas faltantes / alteradas)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    # Alteramos la celda de la columna Nombres
    ws.cell(row=3, column=2, value="ColumnaInvalida")
    wb.save(os.path.join(BASE_DIR, "c04_columnas_alteradas.xlsx"))

    # 5. c05_filas_duplicadas.xlsx (Misma cédula repetida)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    for r in [5, 6]:
        fill_row(ws, r, {
            "Cédula": "88002001",
            "Nombres": f"E2E REPETIDO {r}",
            "Apellidos": "E2E DUPLICADO",
            "Sexo": "MASCULINO",
            "Fecha de nacimiento": "1988-03-10",
            "Nacionalidad": "VENEZOLANO",
            "Estado civil": "Soltero(a)",
        }, col_map)
    wb.save(os.path.join(BASE_DIR, "c05_filas_duplicadas.xlsx"))

    # 6. c06_cedula_invalida.xlsx (Cédula no numérica / formato inválido)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    fill_row(ws, 5, {
        "Cédula": "E2E-LETRAS",
        "Nombres": "E2E INVALIDO",
        "Apellidos": "E2E CEDULA",
        "Sexo": "MASCULINO",
        "Fecha de nacimiento": "1990-01-01",
        "Nacionalidad": "VENEZOLANO",
    }, col_map)
    wb.save(os.path.join(BASE_DIR, "c06_cedula_invalida.xlsx"))

    # 7. c07_fechas_imposibles.xlsx (Fecha imposible 2026-15-40)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    fill_row(ws, 5, {
        "Cédula": "88003001",
        "Nombres": "E2E FECHA",
        "Apellidos": "E2E IMPOSIBLE",
        "Sexo": "MASCULINO",
        "Fecha de nacimiento": "2026-15-40",
        "Nacionalidad": "VENEZOLANO",
    }, col_map)
    wb.save(os.path.join(BASE_DIR, "c07_fechas_imposibles.xlsx"))

    # 8. c08_valores_fuera_catalogo.xlsx (Sexo y Nacionalidad inexistentes)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    fill_row(ws, 5, {
        "Cédula": "88004001",
        "Nombres": "E2E CATALOGO",
        "Apellidos": "E2E INVALIDO",
        "Sexo": "NO_EXISTE",
        "Fecha de nacimiento": "1990-01-01",
        "Nacionalidad": "MARTE",
    }, col_map)
    wb.save(os.path.join(BASE_DIR, "c08_valores_fuera_catalogo.xlsx"))

    # 9. c09_campos_obligatorios_vacios.xlsx (Nombres y Apellidos vacíos)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    fill_row(ws, 5, {
        "Cédula": "88005001",
        "Nombres": "",
        "Apellidos": "",
        "Sexo": "MASCULINO",
        "Fecha de nacimiento": "1990-01-01",
        "Nacionalidad": "VENEZOLANO",
    }, col_map)
    wb.save(os.path.join(BASE_DIR, "c09_campos_obligatorios_vacios.xlsx"))

    # 10. c10_textos_largos_especiales.xlsx (Textos muy largos y acentos/ñ)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    fill_row(ws, 5, {
        "Cédula": "88006001",
        "Nombres": "Juan José María de la Santísima Trinidad Peña-Gómez 'El Ágil' & Cía (E2E-Acción) Ñandú",
        "Apellidos": "Rodríguez-Pérez de los Ríos y Montañas " * 4,
        "Sexo": "MASCULINO",
        "Fecha de nacimiento": "1991-12-31",
        "Nacionalidad": "VENEZOLANO",
        "Estado civil": "Soltero(a)",
        "Correo": "e2e.acento_y_largos_conatel@gobierno.gob.ve",
    }, col_map)
    wb.save(os.path.join(BASE_DIR, "c10_textos_largos_especiales.xlsx"))

    # 11. c11_archivo_1000_filas.xlsx (1000 filas sintéticas)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    for idx in range(1000):
        row_num = 5 + idx
        fill_row(ws, row_num, {
            "Cédula": str(88100000 + idx),
            "Nombres": f"E2E_NOMBRE_{idx}",
            "Apellidos": f"E2E_APELLIDO_{idx}",
            "Sexo": "FEMENINO" if idx % 2 == 0 else "MASCULINO",
            "Fecha de nacimiento": "1990-01-01",
            "Nacionalidad": "VENEZOLANO",
            "Estado civil": "Soltero(a)",
        }, col_map)
    wb.save(os.path.join(BASE_DIR, "c11_archivo_1000_filas.xlsx"))

    # 12. c12_cedula_otra_poblacion.xlsx (Cédula de pasivo en Activos sin datos de reingreso)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    fill_row(ws, 5, {
        "Cédula": "4588543", # Pasivo existente
        "Nombres": "E2E PASIVO",
        "Apellidos": "EN ACTIVOS",
        "Sexo": "MASCULINO",
        "Fecha de nacimiento": "1955-01-01",
        "Nacionalidad": "VENEZOLANO",
    }, col_map)
    wb.save(os.path.join(BASE_DIR, "c12_cedula_otra_poblacion.xlsx"))

    # 13. c13_cambio_condicion.xlsx (Activo que pasa a Pasivo con fecha_egreso y motivo)
    wb = openpyxl.load_workbook(BASE_PASIVOS)
    ws = wb["Datos personales"]
    col_map = get_col_map(ws)
    fill_row(ws, 5, {
        "Cédula": "30799436", # Activo existente
        "Nombres": "E2E ACTIVO A PASIVO",
        "Apellidos": "JUBILADO",
        "Sexo": "MASCULINO",
        "Fecha de nacimiento": "1960-01-01",
        "Nacionalidad": "VENEZOLANO",
        "Estado civil": "Casado(a)",
        "Fecha de egreso": "2026-01-15",
        "Motivo del pase a pasivo": "JUBILACION DE DERECHO",
        "Tipo de nómina de pasivo": "JUBILADO"
    }, col_map)
    wb.save(os.path.join(BASE_DIR, "c13_cambio_condicion.xlsx"))

    # 14. c14_hijo_menor_correlativa.xlsx (Familiar hijo menor de 9 años sin cédula)
    wb = openpyxl.load_workbook(BASE_ACTIVOS)
    ws_dp = wb["Datos personales"]
    col_dp = get_col_map(ws_dp)
    fill_row(ws_dp, 5, {
        "Cédula": "88007001",
        "Nombres": "E2E TITULAR",
        "Apellidos": "FAMILIAR",
        "Sexo": "MASCULINO",
        "Fecha de nacimiento": "1985-05-15",
        "Nacionalidad": "VENEZOLANO",
        "Estado civil": "Soltero(a)"
    }, col_dp)
    ws_fam = wb["Familiares"]
    col_fam = get_col_map(ws_fam)
    fill_row(ws_fam, 5, {
        "Cédula del titular": "88007001",
        "Cédula del familiar": "",
        "Nombres": "E2E BEBE",
        "Apellidos": "E2E HIJO",
        "Parentesco": "HIJO (A)",
        "Fecha de nacimiento": "2022-06-10",
        "Sexo": "MASCULINO",
        "Orden del hijo": "1"
    }, col_fam)
    wb.save(os.path.join(BASE_DIR, "c14_hijo_menor_correlativa.xlsx"))

    # 16. c16_archivo_duplicado.xlsx (Copia de c01)
    shutil.copyfile(os.path.join(BASE_DIR, "c01_activos_valido.xlsx"), os.path.join(BASE_DIR, "c16_archivo_duplicado.xlsx"))

    print("¡Fixtures generados con éxito!")

if __name__ == "__main__":
    main()
