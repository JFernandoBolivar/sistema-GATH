"""
«Última actualización» del trabajador (QA 2026-11-03).

Los listados de personal activo y de pasivos se ordenan por
`Employee.fecha_actualizacion` (lo más reciente primero). Ese campo solo
cambiaba al guardar la fila de `Employee`; editar el expediente (contratos,
antecedentes, vivienda, salud, formación, contactos), los familiares o el cargo
no lo movía. Aquí, cualquier alta, cambio o baja en esas tablas marca al
trabajador como actualizado ahora, con un `UPDATE` directo (sin señales
encadenadas ni recargar el modelo).
"""
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from apps.personal.infrastructure.models.personal_models import EmployeeModel


def _marcar(**filtro) -> None:
    if any(v in (None, '') for v in filtro.values()):
        return
    EmployeeModel.objects.filter(**filtro).update(fecha_actualizacion=timezone.now())


def _campo_empleado(modelo):
    """El FK del modelo hacia `EmployeeModel` (por id o por cédula)."""
    for campo in modelo._meta.fields:
        if getattr(campo, 'related_model', None) is EmployeeModel:
            return campo
    return None


def _receptor_por_fk(modelo):
    campo = _campo_empleado(modelo)
    if campo is None:
        return None
    destino = campo.target_field.attname  # 'id' o 'cedulaidentidad'

    def receptor(sender, instance, **kwargs):
        _marcar(**{destino: getattr(instance, campo.attname, None)})

    return receptor


def _receptor_contrato(sender, instance, **kwargs):
    # El contrato cuelga del antecedente de CONATEL, no directamente del empleado.
    antecedente = getattr(instance, 'antecedente', None) if instance.antecedente_id else None
    if antecedente is not None:
        _marcar(id=antecedente.empleado_id)


_RECEPTORES = []  # referencias fuertes: las señales usan weakref por defecto


def conectar_marca_de_actualizacion() -> None:
    from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
    from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
    from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
    from apps.personal.infrastructure.models.expediente_models import (
        AntecedenteServicioModel,
        ContactoEmergenciaModel,
        ContratoModel,
        DatosViviendaModel,
        FormacionAcademicaModel,
        FormacionComplementariaModel,
        PerfilFisicoModel,
        PerfilSaludModel,
    )

    modelos = (
        AntecedenteServicioModel, DatosViviendaModel, PerfilSaludModel, PerfilFisicoModel,
        FormacionComplementariaModel, FormacionAcademicaModel, ContactoEmergenciaModel,
        EmployeefamilyModel, AsigTrabajoModel, EmployeeEgresadoModel,
    )
    for modelo in modelos:
        receptor = _receptor_por_fk(modelo)
        if receptor is None:
            continue
        _RECEPTORES.append(receptor)
        post_save.connect(receptor, sender=modelo, dispatch_uid=f'marca_actualizacion_{modelo.__name__}')
        post_delete.connect(receptor, sender=modelo, dispatch_uid=f'marca_actualizacion_del_{modelo.__name__}')
    post_save.connect(_receptor_contrato, sender=ContratoModel, dispatch_uid='marca_actualizacion_ContratoModel')
