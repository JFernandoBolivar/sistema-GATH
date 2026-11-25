"""Punto de Cuenta del proceso ``ingreso_postulacion`` (E-5).

Presupuesto lo emite al enviar un expediente a Dirección General. Usa el mismo
correlativo, registro y diseñador de documentos que los demás procesos. El
postulante aún no es Employee: su nombre y cédula viajan en los datos del PDF.
"""
from dataclasses import dataclass
from datetime import datetime

from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from apps.puntocuenta.application.use_cases.configurar_punto_cuenta import obtener_configuracion_activa
from apps.puntocuenta.domain.value_objects.plantilla_punto_cuenta import PROCESO_INGRESO_POSTULACION
from apps.puntocuenta.infrastructure.emision_punto_cuenta import ServicioEmisionPuntoCuenta
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import RepoConfiguracionPuntoCuentaORM


@dataclass(frozen=True)
class DatosIngreso:
    puesto_id: int
    cedula: str
    nombre: str
    referencia_constancia: str
    emitido_por: str
    usuario_id: int | None
    dependencia_id: int | None
    direccion_general_id: int | None
    direccion_linea_id: int | None
    ahora: datetime


def generar_punto_cuenta_ingreso(datos: DatosIngreso, almacen) -> PuntoCuentaDTO:
    """Emite registro y documento publicado; cualquier fallo revierte la operación."""
    configuracion = obtener_configuracion_activa(RepoConfiguracionPuntoCuentaORM())
    return ServicioEmisionPuntoCuenta(almacen=almacen).emitir(
        proceso=PROCESO_INGRESO_POSTULACION,
        cargo_id=datos.puesto_id,
        cedula=datos.cedula,
        dependencia_origen_id=None,
        dependencia_destino_id=datos.dependencia_id,
        motivo_id=None,
        usuario_id=datos.usuario_id,
        oficina_destino_id=datos.direccion_general_id,
        division_destino_id=datos.direccion_linea_id,
        configuracion=configuracion,
        datos_adicionales={
            'empleado_nombre': datos.nombre,
            'referencia_constancia': datos.referencia_constancia,
            'emitido_por': datos.emitido_por,
        },
        ahora=datos.ahora,
    )
