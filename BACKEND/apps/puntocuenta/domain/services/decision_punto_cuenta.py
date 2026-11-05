"""
Servicio de dominio para decidir si una operación administrativa genera Punto de Cuenta (RN-006-01).
Puro: evalúa las reglas según la configuración activa.
"""
from typing import Any, Mapping


def evaluar_generacion_punto_cuenta(
    *,
    generacion_activa: bool,
    cedula: str | None,
    procesos: Mapping[str, Any] | None,
    oficina_origen_id: int | None = None,
    oficina_destino_id: int | None = None,
    dependencia_origen_id: int | None = None,
    dependencia_destino_id: int | None = None,
    division_origen_id: int | None = None,
    division_destino_id: int | None = None,
    cargo_origen_id: int | None = None,
    cargo_destino_id: int | None = None,
    tipo_movimiento: str | None = None,
    operacion: str | None = None,
) -> bool:
    """
    Decide si se debe generar un punto de cuenta para la operación dada.
    """
    if not generacion_activa:
        return False

    if not cedula or not str(cedula).strip():
        return False

    cfg = dict(procesos or {})
    # Por defecto, solo cambio_oficina es True si no está especificado
    cambio_oficina_habilitado = cfg.get('cambio_oficina', True)
    cambio_nivel_habilitado = cfg.get('cambio_nivel', False)
    cambio_division_habilitado = cfg.get('cambio_division', False)
    cambio_cargo_habilitado = cfg.get('cambio_cargo_misma_oficina', False)
    egreso_activo_habilitado = cfg.get('egreso_activo', False)
    pase_a_pasivo_habilitado = cfg.get('pase_a_pasivo', False)
    encargaduria_habilitada = cfg.get('encargaduria_prestamo', False)
    cambio_estatus_habilitado = cfg.get('cambio_estatus', False)

    # Revisar operaciones puntuales por tipo o nombre
    op = (operacion or '').lower()
    tipo = (tipo_movimiento or '').upper()

    if tipo == 'EGRESO' or op == 'egreso_activo':
        return bool(egreso_activo_habilitado)

    if tipo in ('PASE A PASIVO', 'PASE_A_PASIVO') or op == 'pase_a_pasivo':
        return bool(pase_a_pasivo_habilitado)

    if tipo == 'ENCARGADURIA' or op == 'prestamo_cargo':
        return bool(encargaduria_habilitada)

    if tipo == 'ESTATUS' or op in ('cambiar_estatus_puesto', 'desasignar_cargo'):
        return bool(cambio_estatus_habilitado)

    # Evaluar movimientos de cargo / traslados / actualizaciones
    # 1. ¿Cambio de Gerencia / Oficina?
    if oficina_origen_id != oficina_destino_id:
        return bool(cambio_oficina_habilitado)

    # 2. Misma oficina: ¿Cambio de Nivel (Dependencia)?
    if dependencia_origen_id != dependencia_destino_id:
        return bool(cambio_nivel_habilitado)

    # 3. Misma oficina y nivel: ¿Cambio de División / Coordinación?
    if division_origen_id is not None and division_destino_id is not None and division_origen_id != division_destino_id:
        return bool(cambio_division_habilitado)

    # 4. Misma oficina: ¿Cambio de cargo / puesto dentro de la misma oficina?
    if cargo_origen_id is not None and cargo_destino_id is not None and cargo_origen_id != cargo_destino_id:
        return bool(cambio_cargo_habilitado)

    return False
