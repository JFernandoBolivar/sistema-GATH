"""Regenera en lote las constancias de fe de vida ya emitidas.

Mantiene el mismo número, código de verificación, plantilla y URL de verificación vigentes.
Sin reenviar correos.
Por defecto corre en modo simulación (--dry-run). Use --aplicar para ejecutar.

Uso:
    python manage.py regenerar_constancias
    python manage.py regenerar_constancias --proceso <uuid>
    python manage.py regenerar_constancias --aplicar
"""
import logging
from datetime import datetime, timezone

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.fe_de_vida.application.use_cases.constancias import regenerar_constancia
from apps.fe_de_vida.infrastructure.models.solicitud_models import ConstanciaFeDeVidaModel
from apps.fe_de_vida.infrastructure.pdf.constancia_pdf import GeneradorConstanciaPDF
from apps.fe_de_vida.infrastructure.repositories.lector_pasivos_orm import LectorPasivosORM
from apps.fe_de_vida.infrastructure.repositories.repo_constancias_orm import RepoConstanciasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Regenera en lote las constancias de fe de vida ya emitidas con la plantilla vigente, sin reenviar correos.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--aplicar', action='store_true', default=False,
            help='Aplica la regeneración en el almacén de archivos y BD. Por defecto es dry-run.',
        )
        parser.add_argument(
            '--dry-run', action='store_true', default=False,
            help='Modo simulación sin escribir cambios (por defecto activo).',
        )
        parser.add_argument(
            '--proceso', type=str, default=None,
            help='UUID del proceso de fe de vida a filtrar (opcional).',
        )
        parser.add_argument(
            '--cedula', type=str, default=None,
            help='Cédula del pasivo a regenerar (opcional).',
        )

    def handle(self, *args, **options):
        aplicar = options['aplicar'] and not options['dry_run']
        modo = 'APLICACIÓN' if aplicar else 'SIMULACIÓN (dry-run)'
        self.stdout.write(self.style.NOTICE(f"Iniciando regeneración de constancias en modo: {modo}"))

        repo_const = RepoConstanciasORM()
        plantilla_activa = repo_const.plantilla_activa()
        if not plantilla_activa:
            self.stderr.write(self.style.ERROR("No hay una plantilla de constancia activa en el sistema."))
            return

        qs = ConstanciaFeDeVidaModel.objects.filter(
            solicitud__estado='VALIDADA',
            clave_pdf__isnull=False,
        ).exclude(clave_pdf='').select_related('solicitud')

        if options.get('proceso'):
            qs = qs.filter(solicitud__proceso_id=options['proceso'])
        if options.get('cedula'):
            qs = qs.filter(solicitud__cedula=options['cedula'])

        total = qs.count()
        self.stdout.write(f"Constancias encontradas para procesar: {total}")
        if total == 0:
            self.stdout.write("Nada que procesar.")
            return

        repo_proc = RepoProcesosORM()
        repo_sol = RepoSolicitudesFeDeVidaORM()
        lector = LectorPasivosORM()
        generador = GeneradorConstanciaPDF()
        storage = SeaweedFSStorage()
        ahora = datetime.now(timezone.utc)
        url_base = settings.FE_DE_VIDA_URL_VERIFICACION

        regeneradas = 0
        errores = 0

        for constancia_model in qs.iterator():
            num = constancia_model.numero
            sol_id = str(constancia_model.solicitud_id)
            ced = constancia_model.solicitud.cedula
            v_actual = constancia_model.plantilla_version

            if not aplicar:
                self.stdout.write(
                    f"  [DRY-RUN] Constancia {num} (solicitud: {sol_id}, cédula: {ced}): "
                    f"plantilla actual v{v_actual} -> activa v{plantilla_activa.version}"
                )
                regeneradas += 1
                continue

            try:
                with transaction.atomic():
                    regenerar_constancia(
                        repo_proc, repo_sol, repo_const, lector, generador, storage,
                        solicitud_id=sol_id, url_verificacion_base=url_base, ahora=ahora,
                    )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  [OK] Constancia {num} (cédula: {ced}) regenerada con plantilla v{plantilla_activa.version}"
                    )
                )
                regeneradas += 1
            except Exception as e:
                errores += 1
                self.stderr.write(
                    self.style.ERROR(f"  [ERROR] Falló regenerar constancia {num} (solicitud {sol_id}): {e}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nProceso finalizado. Modo: {modo}. Total: {total}, Procesadas: {regeneradas}, Errores: {errores}."
            )
        )
