"""
Eventos de dominio de Cargos (patrón evento→signal→receiver, regla B16).

`apps.cargos` no conoce ni importa `apps.movimientos`: emite este evento
cada vez que cambia la ocupación o el estatus de un puesto, y quien quiera
reaccionar (hoy, `apps.movimientos.infrastructure.receivers`, para dejar
constancia en el historial) se suscribe desde su propio módulo.
"""
import django.dispatch

cargo_movimiento_ejecutado = django.dispatch.Signal()
