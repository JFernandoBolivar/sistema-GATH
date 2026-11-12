"""Aplicación de cargos, otras secciones y cambios de condición de una carga masiva."""
from datetime import datetime, time

import logging

from django.utils import timezone

from core.domain.catalogos import TIPO_PERSONAL_PASIVO
from apps.carga_masiva.domain.condicion import puede_confirmarse
from apps.carga_masiva.infrastructure.cargo_resolucion import resolver_datos_cargo
from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel
from apps.cargos.application.dtos.cargos_dtos import CrearCargoDTO
from apps.cargos.application.use_cases.crear_cargo import crear_cargo
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.pasivos.infrastructure.models.pasivo_models import (
    CargoEgresadoModel,
    EmployeeEgresadoModel,
)
from apps.pasivos.infrastructure.repositories.repo_pasivos_orm import RepoPasivosORM
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.exceptions import ValidationError



from .aplicacion_comun import (
    _cedula_de,
    _es_origen_movimiento,
    _fecha,
)



def _aplicar_cargo(fila: CargaMasivaFilaModel, usuario_id: int | None):
    datos = fila.datos
    empleado = EmployeeModel.objects.filter(cedulaidentidad=datos.get('cedula', '')).first()
    if empleado is None:
        raise ValidationError('El trabajador no existe.', campo='cedula')

    datos_cargo = (fila.anteriores or {}).get('cargo_datos') or resolver_datos_cargo(datos)
    motivo_id = datos_cargo.get('motivo_id') or (fila.movimiento or {}).get('motivo_id')
    repo = RepoCargosORM()
    # FIX-CARGA4: se reutiliza el MISMO caso de uso de crear cargo y la
    # asignación por Movimientos, sin duplicar la generación del código.
    nuevo = crear_cargo(repo, CrearCargoDTO(
        denominacion_id=datos_cargo['denominacion_id'],
        especifica_id=datos_cargo['especifica_id'],
        tipo_nomina_id=datos_cargo['tipo_nomina_id'],
        dependencia_id=datos_cargo.get('dependencia_id'),
        direccion_general_id=datos_cargo.get('direccion_general_id'),
        direccion_linea_id=datos_cargo.get('direccion_linea_id'),
        coordinacion_id=datos_cargo.get('coordinacion_id'),
        organismo_id=datos_cargo.get('organismo_id'),
        grado_id=datos_cargo.get('grado_id'),
        observaciones=datos_cargo.get('observaciones') or '',
    ))
    repo.asignar_cargo_a_empleado(
        nuevo.id, empleado.cedulaidentidad,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )
    fecha_ingreso = datos.get('fecha_ingreso')
    antecedente = None
    antecedente_creado = False
    if fecha_ingreso:
        antecedente, antecedente_creado = AntecedenteServicioModel.objects.get_or_create(
            empleado_id=empleado.pk,
            fecha_ingreso=fecha_ingreso,
            defaults={'fecha_egreso': None},
        )
    return {
        'cargo_id': nuevo.id,
        'cargo_codigo': nuevo.codigo,
        'cargo_creado': True,
        'antecedente_id': antecedente.pk if antecedente else None,
        'antecedente_creado': antecedente_creado,
    }

def _mover_a_pasivo(fila: CargaMasivaFilaModel, movimiento: dict, actor_id: int | None) -> None:
    """Activo → pasivo por el flujo existente; guarda el rastro para revertir."""
    cedula = _cedula_de(fila)
    empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
    if empleado is None:
        raise ValidationError('El trabajador no existe.', campo='cedula')
    motivo_id = movimiento.get('motivo_id')
    tipo_nomina_id = movimiento.get('tipo_nomina_id')
    if not motivo_id or not tipo_nomina_id:
        raise ValidationError(
            'El movimiento a pasivo requiere motivo y tipo de nómina de pasivo.',
            campo='movimiento',
        )
    cargos_activos = list(
        AsigTrabajoModel.objects.filter(employee=empleado)
        .exclude(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO)
        .values_list('pk', flat=True)
    )
    egresos_previos = set(
        EmployeeEgresadoModel.objects.filter(employee=empleado).values_list('pk', flat=True)
    )
    fecha = _fecha(movimiento.get('fecha'))
    fecha_egreso = (
        timezone.make_aware(datetime.combine(fecha, time.min)) if fecha else None
    )
    RepoPasivosORM().procesar_egreso_a_pasivo(
        cedula=cedula,
        motivo_movimiento_id=int(motivo_id),
        tipo_nomina_id=int(tipo_nomina_id),
        liberar_activos=True,
        usuario_id=actor_id,
        fecha_egreso=fecha_egreso,
    )
    pasivo = (
        AsigTrabajoModel.objects.filter(
            employee=empleado, Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
        )
        .order_by('-fecha_actualizacion')
        .first()
    )
    egreso = (
        EmployeeEgresadoModel.objects.filter(employee=empleado)
        .exclude(pk__in=egresos_previos)
        .order_by('-pk')
        .first()
    )
    movimiento.update({
        'aplicado': True,
        'pasivo_cargo_id': pasivo.pk if pasivo else None,
        'cargos_activos_liberados': cargos_activos,
        'egreso_id': egreso.pk if egreso else None,
    })
    fila.movimiento = movimiento

def _mover_a_activo(fila: CargaMasivaFilaModel, movimiento: dict, actor_id: int | None) -> None:
    """Pasivo → activo: libera el puesto pasivo y deja que Cargos asigne el activo.

    El cargo activo lo asigna `_aplicar_cargo` con
    `RepoCargosORM.asignar_cargo_a_empleado`, que emite INGRESO. Aquí solo se
    cierra la asignación pasiva con el flujo existente `desasignar_cargo` y se
    retiran los snapshots de egreso que impedían que la condición derivada
    volviera a ACTIVO.
    """
    cedula = _cedula_de(fila)
    pasivo = (
        AsigTrabajoModel.objects.filter(
            employee_id=cedula, Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO,
        )
        .order_by('-fecha_actualizacion')
        .first()
    )
    if pasivo is None:
        raise ValidationError('La cédula no tiene una asignación pasiva vigente.', campo='cedula')
    mov = dict(movimiento)
    mov.update({
        'aplicado': True,
        'pasivo_cargo_id': pasivo.pk,
        'tipo_nomina_pasivo_id': pasivo.tiponominaid_id,
        'cargo_activo_id': mov.get('cargo_id'),
        'egresos_eliminados': list(
            EmployeeEgresadoModel.objects.filter(employee_id=cedula).values_list('pk', flat=True)
        ),
    })
    RepoCargosORM().desasignar_cargo(pasivo.pk, usuario_id=actor_id)
    for egreso in EmployeeEgresadoModel.objects.filter(employee_id=cedula):
        CargoEgresadoModel.objects.filter(egreso=egreso).delete()
        egreso.delete()
    fila.movimiento = mov

def _aplicar_cambio_condicion(
    fila: CargaMasivaFilaModel, movimientos_hechos: set[str], actor_id: int | None,
) -> None:
    movimiento = dict(fila.movimiento or {})
    if not movimiento:
        raise ValidationError('La fila requiere confirmación pero no tiene movimiento.')
    completo, mensaje = puede_confirmarse(fila.estado, movimiento)
    if not completo:
        raise ValidationError(mensaje, campo='movimiento')
    cedula = _cedula_de(fila)
    if _es_origen_movimiento(fila):
        if cedula in movimientos_hechos:
            return
        if movimiento.get('tipo') == 'ACTIVO_A_PASIVO':
            _mover_a_pasivo(fila, movimiento, actor_id)
        elif movimiento.get('tipo') == 'PASIVO_A_ACTIVO':
            _mover_a_activo(fila, movimiento, actor_id)
        else:
            raise ValidationError('El tipo de movimiento de condición no es válido.', campo='movimiento')
        movimientos_hechos.add(cedula)
        return
    if cedula not in movimientos_hechos:
        raise ValidationError(
            'Primero confirme y aplique la fila que registra el cambio de condición de esta cédula.',
            campo='movimiento',
        )


logger = logging.getLogger(__name__)
