"""
Mapper ORM -> Entidad de Punto de Cuenta, resolviendo los nombres de
empleado/dependencias/motivo (joins de lectura contra tablas de otros
módulos -- mismo patrón ya usado en `apps.cargos.infrastructure.repositories
.repo_cargos_orm` para `apps.organizacion`/`apps.catalogos`).
"""
from apps.catalogos.infrastructure.models.catalogo_models import TipoMovimientoModel
from apps.organizacion.infrastructure.models.organizacion_models import DependenciaModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.puntocuenta.domain.entities.punto_cuenta import PuntoCuenta


def _nombre_dependencia(dependencia_id: int | None) -> str | None:
    if not dependencia_id:
        return None
    fila = DependenciaModel.objects.filter(pk=dependencia_id).first()
    return fila.dependencia if fila else None


def _nombre_empleado(cedula: str) -> str | None:
    fila = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
    return f"{fila.nombres} {fila.apellidos}" if fila else None


def _nombre_motivo(motivo_id: int | None) -> str | None:
    if not motivo_id:
        return None
    fila = TipoMovimientoModel.objects.filter(pk=motivo_id).first()
    return fila.movimiento if fila else None


def a_entidad(modelo) -> PuntoCuenta:
    return PuntoCuenta(
        id=modelo.pk,
        cargo_id=modelo.cargo_id,
        empleado_cedula=modelo.empleado_cedula,
        empleado_nombre=_nombre_empleado(modelo.empleado_cedula),
        dependencia_origen_id=modelo.dependencia_origen_id,
        dependencia_origen_nombre=_nombre_dependencia(modelo.dependencia_origen_id),
        dependencia_destino_id=modelo.dependencia_destino_id,
        dependencia_destino_nombre=_nombre_dependencia(modelo.dependencia_destino_id),
        motivo_id=modelo.motivo_id,
        motivo_nombre=_nombre_motivo(modelo.motivo_id),
        usuario_id=modelo.usuario_id,
        fecha=modelo.fecha.isoformat(),
        documento_pdf_clave=modelo.documento_pdf_clave,
    )
