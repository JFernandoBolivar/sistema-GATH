"""Adaptador ORM de cuentas activas y cuentas con clave inicial (U2)."""
from typing import Sequence

from django.contrib.auth.hashers import check_password, identify_hasher

from apps.identidad.domain.entities.restablecimiento_bloque import CuentaClaveInicial
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel

TAMANO_DE_LOTE = 200


class RepoCuentasClaveInicialORM:
    def activas(self) -> Sequence[CuentaClaveInicial]:
        return [
            CuentaClaveInicial(cuenta_id=cuenta_id, cedula=str(cedula))
            for cuenta_id, cedula in (
                CuentaModel.objects.filter(is_active=True)
                .values_list('pk', 'cedula_id')
                .order_by('pk')
            )
            if cedula not in (None, '')
        ]

    def con_clave_inicial(self) -> Sequence[CuentaClaveInicial]:
        """Cuentas activas con la cédula como clave.

        U2-bis: una fila en `identidad_cuenta_password_inicial` significa que la
        clave sigue siendo la cédula (la fila se borra al cambiarla), así que
        esas cuentas entran **sin** `check_password`. Solo se comprueba el hash
        de las activas sin fila, y se descartan los hashes vacíos, inutilizables
        (`!...`) o de un algoritmo desconocido.
        """
        con_fila = set(PasswordInicialModel.objects.values_list('cuenta_id', flat=True))
        filas = (
            CuentaModel.objects.filter(is_active=True)
            .values_list('pk', 'cedula_id', 'password')
            .order_by('pk')
        )
        encontradas: list[CuentaClaveInicial] = []
        for cuenta_id, cedula, hash_actual in filas.iterator(chunk_size=TAMANO_DE_LOTE):
            if cedula in (None, ''):
                continue
            if cuenta_id in con_fila:
                encontradas.append(CuentaClaveInicial(cuenta_id=cuenta_id, cedula=str(cedula)))
                continue
            if not hash_actual or hash_actual.startswith('!'):
                continue
            try:
                identify_hasher(hash_actual)
            except ValueError:
                continue
            if check_password(str(cedula), hash_actual):
                encontradas.append(CuentaClaveInicial(cuenta_id=cuenta_id, cedula=str(cedula)))
        return encontradas
