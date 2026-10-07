"""
Eventos de dominio de Cargos (patrón evento→signal→receiver, regla B16).

`apps.cargos` no conoce ni importa `apps.movimientos` ni `apps.puntocuenta`:
emite estos eventos cada vez que cambia la ocupación/estatus/dependencia de
un puesto, y quien quiera reaccionar se suscribe desde su propio módulo.
"""
import django.dispatch

cargo_movimiento_ejecutado = django.dispatch.Signal()
"""
Payload: cargo_id, cedula, tipo_movimiento, motivo_id, usuario_id.
Emitido desde `infrastructure/repositories/repo_cargos_orm.py` en
asignar_cargo_a_empleado/desasignar_cargo/crear_cargo_especial_y_asignar/
gestionar_estatus_puesto (INGRESO/CAMBIO DE ESTATUS) y en cambiar_cargo
(TRASLADO, que además incluye `dependencia_anterior_id`/`dependencia_nueva_id`
para el punto de cuenta automático — Punto de Cuenta automático).
"""

cargo_dependencia_cambiada = django.dispatch.Signal()
"""
Payload: cargo_id, cedula, dependencia_anterior_id, dependencia_nueva_id,
motivo_id, usuario_id. Se emite ÚNICAMENTE desde `actualizar_cargo()` cuando
el campo Dependencia (Gerencia/Oficina) cambió en la misma petición (nunca
si solo cambian otros campos del cargo, como denominación o nómina, dentro
de la misma oficina) — Punto de Cuenta automático, RN-006-01.
"""
