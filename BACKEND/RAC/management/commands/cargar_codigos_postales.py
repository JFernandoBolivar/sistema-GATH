import re
import pandas as pd
from django.core.management.base import BaseCommand
from RAC.models.personal_models import codigo_postal
from RAC.models.ubicacion_models import Estado


def normalizar(texto):
    """Quita tildes, pasa a mayúsculas y elimina espacios extra."""
    reemplazos = {
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'á': 'A', 'é': 'E', 'í': 'I', 'ó': 'O', 'ú': 'U',
    }
    for acento, sin in reemplazos.items():
        texto = texto.replace(acento, sin)
    return re.sub(r'\s+', ' ', texto).strip().upper()


class Command(BaseCommand):
    help = "Carga los códigos postales desde el Excel (Downloads/codigos postales.xlsx) a la BD."

    def handle(self, *args, **options):
        ruta = r"C:\Users\josef\Downloads\codigos postales.xlsx"
        self.stdout.write(f"Leyendo archivo: {ruta}")

        df = pd.read_excel(ruta)
        df = df.dropna(subset=['Estado', 'Código Postal'])
        df['Código Postal'] = df['Código Postal'].apply(
            lambda x: str(int(x)).zfill(4)
        )

        estados_cache = {
            normalizar(e.estado): e for e in Estado.objects.all()
        }

        mapeo_especial = {
            'VARGAS': 'LA GUAIRA',
        }

        creados = 0
        existentes = 0
        errores = []

        for _, row in df.iterrows():
            nombre_normalizado = normalizar(str(row['Estado']))
            nombre_normalizado = mapeo_especial.get(nombre_normalizado, nombre_normalizado)
            codigo = str(row['Código Postal'])

            estado = estados_cache.get(nombre_normalizado)

            if not estado:
                errores.append(f"Estado no encontrado: '{nombre_normalizado}' (código {codigo})")
                continue

            obj, created = codigo_postal.objects.get_or_create(
                codigo=codigo,
                estado_id=estado,
            )

            if created:
                creados += 1
            else:
                existentes += 1

        self.stdout.write(self.style.SUCCESS(
            f"Carga completada: {creados} creados, {existentes} ya existían."
        ))

        if errores:
            self.stdout.write(self.style.WARNING(
                f"\n{len(errores)} errores (estados no encontrados):"
            ))
            for err in errores[:20]:
                self.stdout.write(f"  - {err}")
            if len(errores) > 20:
                self.stdout.write(f"  ... y {len(errores) - 20} más")
