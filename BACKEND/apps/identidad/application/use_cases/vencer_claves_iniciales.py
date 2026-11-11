"""
Caso de uso S2-02: vencer la contraseña inicial de las cuentas antiguas.

Las cuentas creadas antes del control de vencimiento (decisión F) tienen la cédula como
contraseña y no tienen fila en `identidad_cuenta_password_inicial`, así que nunca
vencían. Este caso de uso las iguala al resto: **solo** si la clave vigente sigue
siendo la cédula, emite la fila con `vence_en = ahora + plazos.password_inicial_dias`.

Es idempotente: las cuentas que ya tienen fila y las que cambiaron su clave no se tocan.
"""
from datetime import datetime, timedelta

from apps.identidad.application.dtos.clave_inicial_dto import ResultadoVencimientoClaves
from apps.identidad.domain.ports.repo_password_inicial import RepoPasswordInicial
from core.domain.configuracion import CLAVE_PASSWORD_INICIAL_DIAS

# Piso defensivo: el parámetro admite 1..365, pero un valor corrupto en la tabla no
# debe hacer vencer todas las claves en el acto.
DIAS_MINIMOS = 1


def vencer_claves_iniciales_antiguas(
    repo: RepoPasswordInicial,
    lector_parametros,
    *,
    ahora: datetime,
    dry_run: bool = False,
) -> ResultadoVencimientoClaves:
    """Emite el vencimiento de las cuentas activas cuya clave sigue siendo la cédula."""
    dias = max(DIAS_MINIMOS, int(lector_parametros.obtener_entero(CLAVE_PASSWORD_INICIAL_DIAS)))
    revision = repo.cuentas_activas_sin_vencimiento_con_clave_inicial()

    if dry_run:
        return ResultadoVencimientoClaves(
            revisadas=revision.revisadas,
            ajustadas=len(revision.cuenta_ids),
            dias=dias,
            dry_run=True,
        )
    if not revision.cuenta_ids:
        return ResultadoVencimientoClaves(revisadas=revision.revisadas, ajustadas=0, dias=dias)

    emitidas = repo.emitir_varias(revision.cuenta_ids, ahora + timedelta(days=dias))
    return ResultadoVencimientoClaves(
        revisadas=revision.revisadas, ajustadas=emitidas, dias=dias,
    )
