import sys
import openpyxl

def main():
    if len(sys.argv) < 3:
        print("Uso: python validar_excel.py <ruta_archivo> <tipo: ACTIVOS|PASIVOS>")
        sys.exit(1)

    ruta = sys.argv[1]
    tipo = sys.argv[2]

    try:
        wb = openpyxl.load_workbook(ruta)
        hojas = wb.sheetnames
    except Exception as e:
        print(f"ERROR_ABRIR: {e}")
        sys.exit(1)

    if "Datos personales" not in hojas:
        print("ERROR: Falta hoja 'Datos personales'")
        sys.exit(1)

    if "Catalogos" not in hojas:
        print("ERROR: Falta hoja 'Catalogos'")
        sys.exit(1)

    if tipo == "ACTIVOS":
        if "Cargo y asignación" not in hojas:
            print("ERROR: Falta hoja 'Cargo y asignación' en Activos")
            sys.exit(1)
        ws = wb["Datos personales"]
        headers = [ws.cell(3, c).value for c in range(1, ws.max_column+1) if ws.cell(3, c).value]
        if not any("Cédula" in str(h) for h in headers):
            print("ERROR: Falta columna Cédula en Activos")
            sys.exit(1)
        if not any("Nombres" in str(h) for h in headers):
            print("ERROR: Falta columna Nombres en Activos")
            sys.exit(1)
        print("OK_ACTIVOS")

    elif tipo == "PASIVOS":
        if "Cargo y asignación" in hojas:
            print("ERROR: Pasivos no debe tener hoja 'Cargo y asignación'")
            sys.exit(1)
        ws = wb["Datos personales"]
        headers = [ws.cell(3, c).value for c in range(1, ws.max_column+1) if ws.cell(3, c).value]
        if not any("Fecha de egreso" in str(h) for h in headers):
            print("ERROR: Falta columna 'Fecha de egreso' en Pasivos")
            sys.exit(1)
        if not any("Motivo del pase a pasivo" in str(h) for h in headers):
            print("ERROR: Falta columna 'Motivo del pase a pasivo' en Pasivos")
            sys.exit(1)
        print("OK_PASIVOS")

if __name__ == "__main__":
    main()
