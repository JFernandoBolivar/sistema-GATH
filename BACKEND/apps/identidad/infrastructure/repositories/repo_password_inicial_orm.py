"""Repositorio ORM de la vigencia de la contraseña inicial (implementa `RepoPasswordInicial`)."""
from datetime import datetime
from typing import Sequence

from django.contrib.auth.hashers import check_password
from django.utils import timezone

from apps.identidad.domain.value_objects.clave_inicial import CuentasConClaveInicial
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel

TAMANO_DE_LOTE = 200


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

    def cuentas_activas_sin_vencimiento_con_clave_inicial(self) -> CuentasConClaveInicial:
        """Recorre en lotes las cuentas activas sin fila y compara el hash con la cédula.

        `check_password` solo verifica (no regraba el hash), que es justo lo que se
        necesita aquí: `CuentaModel.check_password` pasa por el backend de
        autenticación y puede reescribir el hash al detectar un algoritmo antiguo.
        """
        con_fila = PasswordInicialModel.objects.values('cuenta_id')
        cuentas = (
            CuentaModel.objects.filter(is_active=True)
            .exclude(pk__in=con_fila)
            .values_list('pk', 'cedula_id', 'password')
            .order_by('pk')
        )
        revisadas = 0
        con_clave_inicial: list[int] = []
        for cuenta_id, cedula, hash_actual in cuentas.iterator(chunk_size=TAMANO_DE_LOTE):
            revisadas += 1
            if not hash_actual or cedula in (None, ''):
                continue
            if check_password(str(cedula), hash_actual):
                con_clave_inicial.append(cuenta_id)
        return CuentasConClaveInicial(cuenta_ids=tuple(con_clave_inicial), revisadas=revisadas)

    def emitir_varias(self, cuenta_ids: Sequence[int], vence_en: datetime) -> int:
        ahora = timezone.now()
        filas = [
            PasswordInicialModel(cuenta_id=cuenta_id, emitida_en=ahora, vence_en=vence_en)
            for cuenta_id in cuenta_ids
        ]
        if not filas:
            return 0
        # `ignore_conflicts`: si dos procesos coinciden, la fila existente manda.
        PasswordInicialModel.objects.bulk_create(filas, ignore_conflicts=True)
        return len(filas)
