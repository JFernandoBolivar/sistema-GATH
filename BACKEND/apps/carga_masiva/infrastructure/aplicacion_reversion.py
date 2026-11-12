"""Reversión de una carga masiva ya aplicada."""


from django.db import transaction
from django.utils import timezone

from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel, CargaMasivaModel
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.pasivos.infrastructure.models.pasivo_models import (
    CargoEgresadoModel,
    EmployeeEgresadoModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ConflictError



from .aplicacion_comun import (
    _cedula_de,
)



def _revertir_movimiento(
    fila: CargaMasivaFilaModel, movimiento: dict, actor_id: int | None = None,
) -> None:
    """Compensa el movimiento de condición con los mismos flujos existentes."""
    if not movimiento.get('aplicado'):
        return
    cedula = _cedula_de(fila)
    if movimiento.get('tipo') == 'ACTIVO_A_PASIVO':
        pasivo_id = movimiento.get('pasivo_cargo_id')
        if pasivo_id:
            RepoCargosORM().desasignar_cargo(int(pasivo_id), usuario_id=actor_id)
        for cargo_id in movimiento.get('cargos_activos_liberados') or []:
            if AsigTrabajoModel.objects.filter(pk=cargo_id, employee__isnull=True).exists():
                RepoCargosORM().asignar_cargo_a_empleado(
                    int(cargo_id), cedula, usuario_id=actor_id,
                )
        egreso_id = movimiento.get('egreso_id')
        if egreso_id:
            egreso = EmployeeEgresadoModel.objects.filter(pk=egreso_id).first()
            if egreso is not None:
                CargoEgresadoModel.objects.filter(egreso=egreso).delete()
                egreso.delete()
    elif movimiento.get('tipo') == 'PASIVO_A_ACTIVO':
        cargo_activo_id = movimiento.get('cargo_activo_id')
        if cargo_activo_id:
            RepoCargosORM().desasignar_cargo(int(cargo_activo_id), usuario_id=actor_id)
        pasivo_id = movimiento.get('pasivo_cargo_id')
        if pasivo_id and AsigTrabajoModel.objects.filter(
            pk=pasivo_id, employee__isnull=True,
        ).exists():
            RepoCargosORM().asignar_cargo_a_empleado(
                int(pasivo_id), cedula, usuario_id=actor_id,
            )

def _revertir_carga_bloqueada(carga: CargaMasivaModel, actor_id: int | None) -> CargaMasivaModel:
    with transaction.atomic():
        bloqueada = CargaMasivaModel.objects.select_for_update().get(pk=carga.pk)
        if bloqueada.estado != CargaMasivaModel.Estado.APLICADA:
            raise ConflictError('Solo se puede revertir una carga aplicada.')
        filas = list(carga.filas.filter(aplicada=True).order_by('numero_fila'))
        movimientos_revertidos: set[str] = set()
        for fila in filas:
            movimiento = dict(fila.movimiento or {})
            cedula = _cedula_de(fila)
            if movimiento.get('aplicado') and cedula not in movimientos_revertidos:
                _revertir_movimiento(fila, movimiento, actor_id)
                movimientos_revertidos.add(cedula)
                movimiento['aplicado'] = False
                movimiento['revertido'] = True
                fila.movimiento = movimiento
        for fila in filas:
            if fila.tipo == 'datos_personales':
                empleado = EmployeeModel.objects.filter(cedulaidentidad=fila.datos.get('cedula')).first()
                if empleado and fila.anteriores.get('creado'):
                    empleado.delete()
                elif empleado:
                    for campo in ('nombres', 'apellidos', 'correo', 'telefono_movil', 'telefono_habitacion'):
                        valor = fila.anteriores.get(campo) or None
                        if valor is None and campo in ('nombres', 'apellidos'):
                            continue  # columnas obligatorias: no se vacían
                        setattr(empleado, campo, valor)
                    empleado.save()
            elif fila.tipo == 'familiares' and fila.anteriores.get('id'):
                familiar = EmployeefamilyModel.objects.filter(pk=fila.anteriores['id']).first()
                if familiar:
                    if fila.anteriores.get('creado'):
                        familiar.delete()
            elif fila.tipo == 'cargo_asignacion' and fila.anteriores.get('cargo_creado'):
                # FIX-CARGA4: la reversión elimina el cargo creado por la carga.
                cargo_id = fila.anteriores.get('cargo_id')
                asignacion = AsigTrabajoModel.objects.filter(pk=cargo_id).first()
                if asignacion is not None:
                    if asignacion.employee_id:
                        RepoCargosORM().desasignar_cargo(
                            asignacion.pk, usuario_id=actor_id,
                        )
                    asignacion.delete()
                if fila.anteriores.get('antecedente_creado') and fila.anteriores.get('antecedente_id'):
                    AntecedenteServicioModel.objects.filter(
                        pk=fila.anteriores['antecedente_id'],
                    ).delete()
            fila.aplicada = False
            fila.save(update_fields=['aplicada', 'movimiento'])
        carga.estado = CargaMasivaModel.Estado.REVERTIDA
        carga.revertida_en = timezone.now()
        carga.save(update_fields=['estado', 'revertida_en'])
    return carga
