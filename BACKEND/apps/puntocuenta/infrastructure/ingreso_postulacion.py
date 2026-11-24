"""
Punto de Cuenta del proceso `ingreso_postulacion` (E-5): lo emite Presupuesto al enviar un expediente de postulación
a Dirección General. Reutiliza el correlativo, el registro, el motor de PDF y la plantilla de siempre.

Diferencias con los demás procesos, que nacen del cambio de un empleado:
  * El postulante todavía NO es `Employee`: la fila guarda su cédula (`empleado_cedula`) y el nombre solo viaja al PDF
    (el repositorio resuelve nombres con un join a `Employee`, que aquí no existe).
  * No hay origen: el «destino» es la unidad del puesto reservado (`cargo_id` = id del puesto, `AsigTrabajo`).
  * Se genera siempre: no depende del interruptor `puntocuenta.generar` ni de los procesos habilitados.
  * Un fallo del correlativo o del PDF NO se traga (los otros procesos generan igual sin ellos): sube para que la
    transición del expediente se revierta completa.
"""
from dataclasses import dataclass, replace
from datetime import datetime

from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from apps.puntocuenta.application.use_cases.configurar_punto_cuenta import obtener_configuracion_activa
from apps.puntocuenta.application.use_cases.correlativo_punto_cuenta import obtener_siguiente_correlativo
from apps.puntocuenta.application.use_cases.generar_punto_cuenta import (
    adjuntar_documento_punto_cuenta,
    generar_punto_cuenta,
)
from apps.puntocuenta.domain.value_objects.plantilla_punto_cuenta import PROCESO_INGRESO_POSTULACION
from apps.puntocuenta.infrastructure.pdf_punto_cuenta import construir_pdf_punto_cuenta
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import (
    RepoConfiguracionPuntoCuentaORM,
    RepoSecuenciaPuntoCuentaORM,
)
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_orm import RepoPuntoCuentaORM


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


def clave_pdf(punto_cuenta_id) -> str:
    return f'puntocuenta/{punto_cuenta_id}.pdf'


def generar_punto_cuenta_ingreso(datos: DatosIngreso, almacen) -> PuntoCuentaDTO:
    """Crea el registro con su correlativo, genera el PDF y lo sube al almacén. Devuelve el DTO con la clave del PDF."""
    configuracion = obtener_configuracion_activa(RepoConfiguracionPuntoCuentaORM())
    anio = datos.ahora.year
    secuencia, numero = obtener_siguiente_correlativo(RepoSecuenciaPuntoCuentaORM(), anio)
    repo = RepoPuntoCuentaORM()
    dto = generar_punto_cuenta(
        repo, cargo_id=datos.puesto_id, cedula=datos.cedula, dependencia_origen_id=None,
        dependencia_destino_id=datos.dependencia_id, motivo_id=None, usuario_id=datos.usuario_id,
        oficina_destino_id=datos.direccion_general_id, division_destino_id=datos.direccion_linea_id,
        numero=numero, anio=anio, secuencia=secuencia, configuracion_version=configuracion.get('version'),
        snapshot_formato=configuracion,
    )
    # Datos que el repositorio no puede resolver (el postulante no es Employee) o que son propios del ingreso.
    dto_pdf = replace(
        dto, empleado_nombre=datos.nombre, cargo_destino=dto.cargo_nombre,
        referencia_constancia=datos.referencia_constancia, emitido_por=datos.emitido_por,
    )
    pdf = construir_pdf_punto_cuenta(dto_pdf, configuracion=configuracion, proceso=PROCESO_INGRESO_POSTULACION)
    clave = clave_pdf(dto.id)
    almacen.subir(clave, pdf, 'application/pdf')
    try:
        return adjuntar_documento_punto_cuenta(repo, dto.id, clave)
    except Exception:
        almacen.eliminar(clave)  # el registro se revierte con la transacción: no dejar el PDF huérfano
        raise
