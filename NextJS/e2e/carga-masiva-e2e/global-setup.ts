import { execFileSync } from "node:child_process";

/**
 * Limpieza previa de la suite de carga masiva.
 *
 * Las pruebas aplican/revierten cargas sobre las mismas cédulas de ejemplo; si
 * una corrida anterior falla antes de revertir, la siguiente analiza filas como
 * "actualización" o "posible duplicado" y los botones de confirmación cambian.
 * Se deja la base E2E limpia: cargas de prueba y empleados 88....
 */
const LIMPIEZA = `
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "GATH.settings")
import django
django.setup()
from apps.carga_masiva.infrastructure.models import CargaMasivaModel
from apps.carga_masiva.infrastructure.aplicacion import revertir_carga
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
from django.core.cache import cache

ParametroSistemaModel.objects.filter(clave="carga_masiva.requiere_aprobacion").update(valor="false")
# El throttling de subida usa la caché: limpiarla evita 429 entre corridas.
cache.clear()
for carga in CargaMasivaModel.objects.filter(archivo_nombre__iregex=r"^c(01|13|14)"):
    if carga.estado == CargaMasivaModel.Estado.APLICADA:
        try:
            revertir_carga(carga, actor_id=1)
        except Exception as exc:
            print("LIMPIEZA_E2E_REVERTIR_ERROR", carga.id, exc)
CargaMasivaModel.objects.filter(archivo_nombre__startswith="c").delete()
try:
    EmployeeModel.objects.filter(cedulaidentidad__startswith="88").delete()
except Exception as exc:
    print("LIMPIEZA_E2E_EMPLEADOS_ERROR", exc)
print("LIMPIEZA_E2E_OK")
`;

export default async function globalSetup(): Promise<void> {
  execFileSync("docker", ["exec", "-i", "django-App", "python", "-"], {
    input: LIMPIEZA,
    stdio: ["pipe", "inherit", "inherit"],
  });
}
