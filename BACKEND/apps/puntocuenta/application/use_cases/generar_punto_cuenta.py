"""
Casos de uso de Punto de Cuenta (Reglas B2, B4).
"""
from typing import Any
from apps.puntocuenta.domain.ports.repo_punto_cuenta import RepoPuntoCuenta
from ..dtos.punto_cuenta_dto import PuntoCuentaDTO


def _a_dto(entidad) -> PuntoCuentaDTO:
    return PuntoCuentaDTO(
        id=str(entidad.id),
        cargo_id=entidad.cargo_id,
        empleado_cedula=entidad.empleado_cedula,
        empleado_nombre=entidad.empleado_nombre,
        dependencia_origen_id=entidad.dependencia_origen_id,
        dependencia_origen_nombre=entidad.dependencia_origen_nombre,
        dependencia_destino_id=entidad.dependencia_destino_id,
        dependencia_destino_nombre=entidad.dependencia_destino_nombre,
        motivo_id=entidad.motivo_id,
        motivo_nombre=entidad.motivo_nombre,
        usuario_id=entidad.usuario_id,
        fecha=entidad.fecha,
        documento_pdf_clave=entidad.documento_pdf_clave,
        documento_generado=entidad.documento_pdf_clave is not None,
        oficina_origen_id=entidad.oficina_origen_id,
        oficina_origen=entidad.oficina_origen_nombre,
        oficina_destino_id=entidad.oficina_destino_id,
        oficina_destino=entidad.oficina_destino_nombre,
        division_origen_id=entidad.division_origen_id,
        division_origen=entidad.division_origen_nombre,
        division_destino_id=entidad.division_destino_id,
        division_destino=entidad.division_destino_nombre,
        numero=entidad.numero,
        anio=entidad.anio,
        secuencia=entidad.secuencia,
        cargo_codigo=entidad.cargo_codigo,
        cargo_nombre=entidad.cargo_nombre,
        configuracion_version=entidad.configuracion_version,
        snapshot_formato=entidad.snapshot_formato,
    )


def generar_punto_cuenta(
    repo: RepoPuntoCuenta,
    *,
    cargo_id: int,
    cedula: str,
    dependencia_origen_id: int | None,
    dependencia_destino_id: int | None,
    motivo_id: int | None,
    usuario_id: int | None,
    oficina_origen_id: int | None = None,
    oficina_destino_id: int | None = None,
    division_origen_id: int | None = None,
    division_destino_id: int | None = None,
    numero: str | None = None,
    anio: int | None = None,
    secuencia: int | None = None,
    configuracion_version: int | None = None,
    snapshot_formato: dict | None = None,
) -> PuntoCuentaDTO:
    entidad = repo.crear(
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_origen_id,
        dependencia_destino_id=dependencia_destino_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
        oficina_origen_id=oficina_origen_id,
        oficina_destino_id=oficina_destino_id,
        division_origen_id=division_origen_id,
        division_destino_id=division_destino_id,
        numero=numero,
        anio=anio,
        secuencia=secuencia,
        configuracion_version=configuracion_version,
        snapshot_formato=snapshot_formato,
    )
    return _a_dto(entidad)


def adjuntar_documento_punto_cuenta(repo: RepoPuntoCuenta, id: Any, clave: str) -> PuntoCuentaDTO:
    return _a_dto(repo.adjuntar_documento(id, clave))


def listar_puntos_cuenta(repo: RepoPuntoCuenta, filtros: dict | None = None) -> list[PuntoCuentaDTO]:
    return [_a_dto(e) for e in repo.listar(filtros)]


def obtener_punto_cuenta(repo: RepoPuntoCuenta, id: Any) -> PuntoCuentaDTO | None:
    entidad = repo.obtener_por_id(id)
    return _a_dto(entidad) if entidad else None
