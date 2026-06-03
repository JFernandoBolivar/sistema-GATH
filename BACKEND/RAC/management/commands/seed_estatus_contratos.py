from django.core.management.base import BaseCommand
from RAC.models.personal_models import Estatus
from RAC.utils.constants import ESTATUS_ACTIVO, ESTATUS_VENCIDO, ESTATUS_POR_VENCER


ESTATUS_REQUERIDOS = [ESTATUS_ACTIVO, ESTATUS_VENCIDO, ESTATUS_POR_VENCER]


class Command(BaseCommand):
    help = (
        "Garantiza que existan los estatus requeridos para la lógica de contratos: "
        f"{', '.join(ESTATUS_REQUERIDOS)}. Seguro de ejecutar múltiples veces (idempotente)."
    )

    def handle(self, *args, **options):
        self.stdout.write("Verificando estatus de contratos...")
        for nombre in ESTATUS_REQUERIDOS:
            obj, created = Estatus.objects.get_or_create(estatus=nombre)
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f"  ✓ Estatus '{nombre}' creado (id={obj.pk})")
                )
            else:
                self.stdout.write(f"  · Estatus '{nombre}' ya existe (id={obj.pk})")
        self.stdout.write(self.style.SUCCESS("Listo."))
