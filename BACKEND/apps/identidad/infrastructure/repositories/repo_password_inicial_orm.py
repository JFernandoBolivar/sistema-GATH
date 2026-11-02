"""Repositorio ORM de la vigencia de la contraseña inicial (implementa `RepoPasswordInicial`)."""
from datetime import datetime

from django.utils import timezone

from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel


class RepoPasswordInicialORM:
    def emitir(self, cuenta_id: int, vence_en: datetime) -> None:
        PasswordInicialModel.objects.update_or_create(
            cuenta_id=cuenta_id, defaults={'emitida_en': timezone.now(), 'vence_en': vence_en}
        )

    def vencimiento(self, cuenta_id: int) -> datetime | None:
        return (
            PasswordInicialModel.objects.filter(cuenta_id=cuenta_id)
            .values_list('vence_en', flat=True)
            .first()
        )

    def limpiar(self, cuenta_id: int) -> None:
        PasswordInicialModel.objects.filter(cuenta_id=cuenta_id).delete()
