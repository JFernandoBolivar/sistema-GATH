"""Adaptador ORM del detalle de cuentas de un lote: nombre, correo de acceso y vencimiento."""
from typing import Sequence

from apps.identidad.domain.entities.restablecimiento_bloque import DetalleCuentaBloque
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.password_inicial_model import PasswordInicialModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

_TROZO = 5000  # evita listas IN gigantes en una sola consulta


class RepoDetalleCuentasBloqueORM:
    def detalle(self, cuenta_ids: Sequence[int]) -> Sequence[DetalleCuentaBloque]:
        ids = list(cuenta_ids)
        cuentas: list[tuple[int, str]] = []
        vencimientos: dict[int, object] = {}
        for i in range(0, len(ids), _TROZO):
            trozo = ids[i:i + _TROZO]
            cuentas += [
                (pk, str(cedula))
                for pk, cedula in CuentaModel.objects.filter(pk__in=trozo)
                .values_list('pk', 'cedula_id')
            ]
            vencimientos.update(
                PasswordInicialModel.objects.filter(cuenta_id__in=trozo)
                .values_list('cuenta_id', 'vence_en')
            )
        cedulas = [cedula for _, cedula in cuentas]
        empleados: dict[str, tuple[str, str]] = {}
        for i in range(0, len(cedulas), _TROZO):
            for cedula, apellidos, nombres, correo in EmployeeModel.objects.filter(
                cedulaidentidad__in=cedulas[i:i + _TROZO],
            ).values_list('cedulaidentidad', 'apellidos', 'nombres', 'correo'):
                nombre = f'{apellidos or ""} {nombres or ""}'.strip()
                empleados[cedula] = (nombre, (correo or '').strip())
        return [
            DetalleCuentaBloque(
                cuenta_id=pk,
                cedula=cedula,
                nombre=empleados.get(cedula, ('', ''))[0],
                correo=empleados.get(cedula, ('', ''))[1],
                vence_en=vencimientos.get(pk),
            )
            for pk, cedula in cuentas
        ]
