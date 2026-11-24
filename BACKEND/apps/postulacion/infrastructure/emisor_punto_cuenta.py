"""Adaptador del puerto `EmisorPuntoCuenta`: genera el Punto de Cuenta de ingreso en `apps.puntocuenta` (E-5)."""
import logging

from apps.postulacion.domain.entities.punto_cuenta_ingreso import PuntoCuentaEmitido, SolicitudPuntoCuentaIngreso
from apps.puntocuenta.infrastructure.ingreso_postulacion import DatosIngreso, generar_punto_cuenta_ingreso

logger = logging.getLogger('gath.postulacion')


class EmisorPuntoCuentaORM:
    def __init__(self, almacen=None):
        if almacen is None:
            from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
            almacen = SeaweedFSStorage()
        self._almacen = almacen

    def emitir_ingreso(self, s: SolicitudPuntoCuentaIngreso) -> PuntoCuentaEmitido:
        dto = generar_punto_cuenta_ingreso(
            DatosIngreso(
                puesto_id=s.puesto_id, cedula=s.postulante_cedula, nombre=s.postulante_nombre,
                referencia_constancia=s.referencia_constancia, emitido_por=s.emitido_por_nombre,
                usuario_id=s.emitido_por_usuario_id, dependencia_id=s.dependencia_id,
                direccion_general_id=s.direccion_general_id, direccion_linea_id=s.direccion_linea_id, ahora=s.ahora,
            ),
            self._almacen,
        )
        return PuntoCuentaEmitido(punto_cuenta_id=str(dto.id), numero=dto.numero or '', pdf_clave=dto.documento_pdf_clave or '')

    def descartar(self, punto_cuenta_id: str, pdf_clave: str) -> None:
        try:
            self._almacen.eliminar(pdf_clave)
        except Exception:  # noqa: BLE001 - un objeto huérfano no debe tumbar la operación; queda en el log
            logger.exception('No se pudo borrar el PDF %s del Punto de Cuenta %s', pdf_clave, punto_cuenta_id)
