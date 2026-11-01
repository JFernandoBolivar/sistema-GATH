"""Verifica la cadena SHA-256 de `AuditoriaLog` (E1)."""
from django.core.management.base import BaseCommand, CommandError

from core.domain.auditoria import GENESIS_AUDITORIA, calcular_hash_registro
from core.infrastructure.models.auditoria import AuditoriaLog


class Command(BaseCommand):
    help = 'Verifica la cadena de hashes de la bitácora de auditoría.'

    def handle(self, *args, **options):
        anterior = GENESIS_AUDITORIA
        total = 0
        for total, fila in enumerate(
            AuditoriaLog.objects.order_by('fecha_hora', 'id').iterator(), start=1
        ):
            if fila.hash_anterior != anterior:
                raise CommandError(
                    f'Cadena rota en el registro {fila.id} (#{total}): '
                    'hash_anterior no coincide con el registro previo.'
                )
            esperado = calcular_hash_registro(fila, anterior)
            if fila.hash_actual != esperado:
                raise CommandError(
                    f'Cadena rota en el registro {fila.id} (#{total}): '
                    'el contenido no coincide con su hash_actual.'
                )
            anterior = fila.hash_actual

        self.stdout.write(
            self.style.SUCCESS(
                f'Cadena de auditoría verificada: {total} registro(s), génesis {GENESIS_AUDITORIA[:12]}…'
            )
        )
