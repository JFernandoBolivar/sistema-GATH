"""
Receivers de Movimientos (patrón evento→signal→receiver, Regla B16).

Se suscribe al evento `cargo_movimiento_ejecutado` de `apps.cargos` sin que
`apps.cargos` conozca ni importe `apps.movimientos` — el desacople lo da el
`django.dispatch.Signal`. Conectado en `MovimientosConfig.ready()`.
"""
from django.dispatch import receiver

from apps.cargos.domain.events import cargo_movimiento_ejecutado
from apps.movimientos.application.use_cases.registrar_movimiento import registrar_movimiento
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM


@receiver(cargo_movimiento_ejecutado)
def despachar_registro_historial(sender, cargo_id, cedula, tipo_movimiento, motivo_id, usuario_id, **kwargs):
    if not cedula:
        # Sin empleado en el puesto (p. ej. desasignar un cargo ya vacante)
        # no hay a quién atribuirle el movimiento — se omite el registro.
        return
    repo = RepoMovimientosORM()
    registrar_movimiento(
        repo,
        cargo_id=cargo_id,
        cedula=cedula,
        tipo_movimiento=tipo_movimiento,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )
