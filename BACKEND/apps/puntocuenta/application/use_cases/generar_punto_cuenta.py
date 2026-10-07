"""
Caso de uso: generar el registro de Punto de Cuenta (Reglas B2, B4).

ESTRICTO (fallo cerrado): si esto falla, debe fallar toda la operación que
lo disparó (cambio de dependencia de un cargo) -- es el dato contable real.
La generación/subida del PDF (leniente) NO vive aquí: ocurre después, en el
receiver (`infrastructure/receivers.py`), para que un fallo de PDF/storage
nunca revierta este registro ya persistido.
"""
from apps.puntocuenta.domain.ports.repo_punto_cuenta import RepoPuntoCuenta
from ..dtos.punto_cuenta_dto import PuntoCuentaDTO


def _a_dto(entidad) -> PuntoCuentaDTO:
    return PuntoCuentaDTO(
        id=entidad.id,
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
) -> PuntoCuentaDTO:
    entidad = repo.crear(
        cargo_id=cargo_id,
        cedula=cedula,
        dependencia_origen_id=dependencia_origen_id,
        dependencia_destino_id=dependencia_destino_id,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )
    return _a_dto(entidad)


def adjuntar_documento_punto_cuenta(repo: RepoPuntoCuenta, id: int, clave: str) -> PuntoCuentaDTO:
    return _a_dto(repo.adjuntar_documento(id, clave))


def listar_puntos_cuenta(repo: RepoPuntoCuenta) -> list[PuntoCuentaDTO]:
    return [_a_dto(e) for e in repo.listar()]


def obtener_punto_cuenta(repo: RepoPuntoCuenta, id: int) -> PuntoCuentaDTO | None:
    entidad = repo.obtener_por_id(id)
    return _a_dto(entidad) if entidad else None
