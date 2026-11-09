import subprocess

def run_django_code(code: str):
    cmd = ["docker", "compose", "exec", "-T", "django", "python", "manage.py", "shell", "-c", code]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.stdout, res.stderr

CLEANUP_CODE = """
from apps.carga_masiva.infrastructure.models import CargaMasivaModel, CargaMasivaFilaModel
from apps.carga_masiva.infrastructure.aplicacion import revertir_carga
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel

# 1. Resetear parametro requiere_aprobacion a false
ParametroSistemaModel.objects.filter(clave='carga_masiva.requiere_aprobacion').update(valor='false')
print('Parámetro requiere_aprobacion reseteado a false')

# 2. Revertir cargas aplicadas de prueba
cargas_e2e = CargaMasivaModel.objects.filter(archivo_nombre__icontains='c01_') | CargaMasivaModel.objects.filter(archivo_nombre__icontains='c13_') | CargaMasivaModel.objects.filter(archivo_nombre__icontains='c14_')
for c in cargas_e2e:
    if c.estado == CargaMasivaModel.Estado.APLICADA:
        try:
            revertir_carga(c, actor_id=1)
            print(f'Carga {c.id} ({c.archivo_nombre}) revertida exitosamente.')
        except Exception as e:
            print(f'Error al revertir {c.id}: {e}')

# 3. Eliminar filas y cargas E2E creadas durante las pruebas
cargas_test = CargaMasivaModel.objects.filter(archivo_nombre__startswith='c')
count_cargas = cargas_test.count()
cargas_test.delete()
print(f'Eliminadas {count_cargas} cargas masivas de prueba.')

# 4. Eliminar empleados creados con prefijo 8800...
emps = EmployeeModel.objects.filter(cedulaidentidad__startswith='88')
count_emps = emps.count()
emps.delete()
print(f'Eliminados {count_emps} empleados de prueba (88...).')
"""

if __name__ == "__main__":
    out, err = run_django_code(CLEANUP_CODE)
    print("Salida de limpieza:\n", out)
    if err and "Traceback" in err:
        print("Error de limpieza:\n", err)
