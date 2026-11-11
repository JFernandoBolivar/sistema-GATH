"""Adaptador ORM de cuentas activas y cuentas con clave inicial (U2)."""
from typing import Sequence


from apps.identidad.domain.entities.restablecimiento_bloque import CuentaClaveInicial
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel



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
        """Cuentas activas cuya clave sigue siendo la cédula, sin comparar hashes.

        Una fila en `identidad_cuenta_password_inicial` significa que la clave es la
        cédula: se crea al aprovisionar o restablecer y se borra en
        `establecer_password` cuando la persona elige la suya. Comparar el hash
        (Argon2) de cada cuenta tardaba minutos; con la fila es una sola consulta.

        Las cuentas antiguas sin fila no tienen vencimiento, así que pueden entrar con
        la cédula y no necesitan restablecerse. S2-02 les crea la fila al desplegar.
        """
        return [
            CuentaClaveInicial(cuenta_id=cuenta_id, cedula=str(cedula))
            for cuenta_id, cedula in (
                CuentaModel.objects.filter(
                    is_active=True,
                    pk__in=PasswordInicialModel.objects.values('cuenta_id'),
                )
                .values_list('pk', 'cedula_id')
                .order_by('pk')
            )
            if cedula not in (None, '')
        ]
