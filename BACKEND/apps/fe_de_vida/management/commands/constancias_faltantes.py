"""Detecta y emite las constancias que faltan (L2-02).

Una solicitud VALIDADA debe tener su constancia con PDF. Si la emisión falló
(almacén caído, plantilla inactiva, error del generador), la solicitud quedó sin
constancia y hasta ahora no había forma de recuperarla.

Por defecto solo lista (dry-run). Con `--aplicar` emite las que faltan usando el
mismo caso de uso idempotente de la validación: conserva el número ya reservado
si lo hubiera.

Uso:
    python manage.py constancias_faltantes
    python manage.py constancias_faltantes --aplicar
    python manage.py constancias_faltantes --proceso <uuid> --aplicar
"""
import logging
from datetime import datetime, timezone

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from apps.fe_de_vida.application.use_cases.constancias import emitir_constancia
from apps.fe_de_vida.infrastructure.models.solicitud_models import SolicitudFeDeVidaModel
from apps.fe_de_vida.infrastructure.pdf.constancia_pdf import GeneradorConstanciaPDF
from apps.fe_de_vida.infrastructure.repositories.lector_pasivos_orm import LectorPasivosORM
from apps.fe_de_vida.infrastructure.repositories.repo_constancias_orm import RepoConstanciasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

logger = logging.getLogger('gath.fe_de_vida')


class Command(BaseCommand):
    help = 'Detecta las solicitudes VALIDADA sin constancia emitida y, con --aplicar, las emite.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--aplicar', action='store_true', default=False,
            help='Emite las constancias que faltan. Sin esta opción solo lista (dry-run).',
        )
        parser.add_argument(
            '--proceso', type=str, default=None,
            help='UUID del proceso de fe de vida a filtrar (opcional).',
        )

    def handle(self, *args, **options):
        aplicar = options['aplicar']
        modo = 'APLICACIÓN' if aplicar else 'SIMULACIÓN (dry-run)'
        self.stdout.write(self.style.NOTICE(f'Constancias faltantes en modo: {modo}'))

        qs = (
            SolicitudFeDeVidaModel.objects.filter(estado='VALIDADA')
            .filter(
                Q(constancia__isnull=True)
                | Q(constancia__clave_pdf__isnull=True)
                | Q(constancia__clave_pdf='')
            )
            .select_related('proceso')
            .order_by('fecha_validacion')
        )
        if options.get('proceso'):
            qs = qs.filter(proceso_id=options['proceso'])

        total = qs.count()
        self.stdout.write(f'Solicitudes VALIDADA sin constancia con PDF: {total}')
        logger.info('constancias_faltantes: modo=%s total=%s', modo, total)
        if total == 0:
            self.stdout.write('Nada que emitir.')
            return

        repo_proc = RepoProcesosORM()
        repo_sol = RepoSolicitudesFeDeVidaORM()
        repo_const = RepoConstanciasORM()
        lector = LectorPasivosORM()
        generador = GeneradorConstanciaPDF()
        storage = SeaweedFSStorage()
        ahora = datetime.now(timezone.utc)
        url_base = settings.FE_DE_VIDA_URL_VERIFICACION

        emitidas = 0
        errores = 0
        for solicitud in qs.iterator():
            if not aplicar:
                self.stdout.write(
                    f'  [DRY-RUN] Solicitud {solicitud.id} (cédula: {solicitud.cedula}, '
                    f'validada: {solicitud.fecha_validacion:%d/%m/%Y})'
                )
                emitidas += 1
                continue
            try:
                with transaction.atomic():
                    constancia = emitir_constancia(
                        repo_proc, repo_sol, repo_const, lector, generador, storage,
                        solicitud_id=str(solicitud.id), url_verificacion_base=url_base, ahora=ahora,
                    )
                self.stdout.write(
                    self.style.SUCCESS(f'  [OK] Constancia {constancia.numero} emitida (cédula: {solicitud.cedula})')
                )
                emitidas += 1
            except Exception as exc:  # noqa: BLE001 - una solicitud mala no debe parar el lote
                errores += 1
                logger.exception('constancias_faltantes: falló la solicitud %s', solicitud.id)
                self.stderr.write(
                    self.style.ERROR(f'  [ERROR] Solicitud {solicitud.id}: {exc}')
                )

        self.stdout.write(self.style.SUCCESS(
            f'\nProceso finalizado. Modo: {modo}. Total: {total}, Emitidas: {emitidas}, Errores: {errores}.'
        ))
