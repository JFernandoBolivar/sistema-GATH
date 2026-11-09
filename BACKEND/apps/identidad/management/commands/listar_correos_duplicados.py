"""Comando para RRHH: lista los correos institucionales y alternativos duplicados en el sistema (FIX-QA11)."""
from django.core.management.base import BaseCommand

from apps.identidad.domain.services.colisiones_correo import detectar_colisiones
from apps.identidad.infrastructure.repositories.repo_correo_acceso_orm import RepoCorreoAccesoORM


class Command(BaseCommand):
    help = 'Lista los correos institucionales y alternativos repetidos o en colisión para RRHH.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('=== REPORTE DE CORREOS DUPLICADOS PARA RRHH ===\n'))
        inst_por_correo, alt_por_correo = RepoCorreoAccesoORM().cedulas_por_correo()
        colisiones = detectar_colisiones(inst_por_correo, alt_por_correo)
        afectadas: set[str] = set()
        for colision in colisiones:
            afectadas |= colision.cedulas
            self.stdout.write(f'Correo en colisión: {colision.correo}')
            if colision.cedulas_institucional:
                self.stdout.write(f'  - Institucional de: {", ".join(sorted(colision.cedulas_institucional))}')
            if colision.cedulas_alternativo:
                self.stdout.write(f'  - Alternativo de: {", ".join(sorted(colision.cedulas_alternativo))}')

        self.stdout.write(self.style.SUCCESS(
            f'\nTotal de correos con colisión: {len(colisiones)}. '
            f'Total de trabajadores afectados (sin cuenta hasta corregirse): {len(afectadas)}.'
        ))
