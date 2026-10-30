"""
Caso de uso de transición activo → pasivo (Fase 2.1 del plan de reparación,
`PLAN_REPARACION_GATH.md`).

Réplica de `RAC/services/egreso_services.py::procesar_egreso_total`/
`procesar_pasivo`. Alta de sobrevivientes:
  - `ejecutar_creacion_sobrevivientes` (C20) vive en
    `crear_sobrevivientes.py` y se encadena aquí si el DTO trae
    `sobrevivientes_familiar_ids`.

El registro de historial de movimiento (Fase 2.5 del plan de reparación) sí
se reproduce: `RepoPasivosORM.procesar_egreso_a_pasivo` emite el mismo
evento `apps.cargos.domain.events.cargo_movimiento_ejecutado` que usa
`apps.cargos`, y `apps.movimientos` lo registra sin que `apps.pasivos` lo
importe directamente.
"""
from apps.pasivos.application.dtos.pasivos_dtos import (
    CrearSobrevivientesDTO,
    PasivoDTO,
    ProcesarEgresoDTO,
)
from apps.pasivos.application.use_cases.crear_sobrevivientes import (
    ejecutar_creacion_sobrevivientes,
)
from apps.pasivos.application.use_cases.listar_pasivos import pasivo_a_dto
from apps.pasivos.domain.ports.repo_pasivos import RepoPasivos


def procesar_egreso(repo: RepoPasivos, dto: ProcesarEgresoDTO) -> PasivoDTO:
    entidad = repo.procesar_egreso_a_pasivo(
        cedula=dto.cedula,
        motivo_movimiento_id=dto.motivo_movimiento_id,
        tipo_nomina_id=dto.tipo_nomina_id,
        liberar_activos=dto.liberar_activos,
        usuario_id=dto.usuario_id,
    )
    if dto.sobrevivientes_familiar_ids:
        ejecutar_creacion_sobrevivientes(
            repo,
            CrearSobrevivientesDTO(
                cedula_titular=dto.cedula,
                tipo_nomina_id=dto.tipo_nomina_id,
                familiar_ids=dto.sobrevivientes_familiar_ids,
                usuario_id=dto.usuario_id,
            ),
        )
    return pasivo_a_dto(entidad)
