from django.core.management.base import BaseCommand
from RAC.models.personal_models import contratos
from RAC.services.profile_services import verificar_estatus_contrato


class Command(BaseCommand):
    help = (
        "Recalcula y actualiza el estatus de todos los contratos no-fijos. "
        "Puede ejecutarse como tarea programada diaria (cron / Celery Beat)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra los contratos que cambiarían sin guardar nada.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        qs = contratos.objects.filter(es_fijo=False).select_related(
            'estatus_id', 'antecedente_id'
        )
        total = qs.count()

        if dry_run:
            self.stdout.write(f"[DRY-RUN] {total} contratos a verificar (sin cambios).")
            return

        self.stdout.write(f"Verificando {total} contratos...")
        errores = []
        actualizados = 0

        for c in qs:
            try:
                verificar_estatus_contrato(c)
                actualizados += 1
            except ValueError as e:
                errores.append(str(e))
                break  # error de configuración global → detener

        if errores:
            self.stderr.write(self.style.ERROR(f"ERROR: {errores[0]}"))
            self.stderr.write("Ejecute primero: python manage.py seed_estatus_contratos")
        else:
            self.stdout.write(
                self.style.SUCCESS(f"✓ {actualizados}/{total} contratos verificados correctamente.")
            )
