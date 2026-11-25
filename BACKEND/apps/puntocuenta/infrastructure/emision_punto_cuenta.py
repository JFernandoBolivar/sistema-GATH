"""Orquestación transaccional de la emisión del Punto de Cuenta.

La transacción abarca correlativo, registro y DocumentoGenerado. El PDF se sube
al almacenamiento externo; si una operación posterior falla se intenta eliminar
ese objeto para no dejar un archivo huérfano.
"""
import logging
from datetime import datetime
from typing import Any

from django.db import transaction

from apps.puntocuenta.application.dtos.punto_cuenta_dto import PuntoCuentaDTO
from apps.puntocuenta.application.use_cases.correlativo_punto_cuenta import (
    obtener_siguiente_correlativo,
)
from apps.puntocuenta.application.use_cases.generar_punto_cuenta import (
    adjuntar_documento_punto_cuenta,
    generar_documento_punto_cuenta,
    generar_punto_cuenta,
)
from apps.puntocuenta.domain.ports.generador_punto_cuenta import GeneradorPuntoCuenta
from apps.puntocuenta.domain.ports.repo_punto_cuenta import RepoPuntoCuenta
from apps.puntocuenta.domain.ports.repo_punto_cuenta_config import (
    RepoSecuenciaPuntoCuenta,
)
from apps.puntocuenta.infrastructure.contexto import guardar_ultimo_punto_cuenta
from apps.puntocuenta.infrastructure.generador_punto_cuenta import (
    obtener_generador_punto_cuenta,
)
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_config_orm import (
    RepoSecuenciaPuntoCuentaORM,
)
from apps.puntocuenta.infrastructure.repositories.repo_punto_cuenta_orm import (
    RepoPuntoCuentaORM,
)

logger = logging.getLogger('gath.puntocuenta')


class ServicioEmisionPuntoCuenta:
    def __init__(
        self,
        *,
        repo: RepoPuntoCuenta | None = None,
        repo_secuencia: RepoSecuenciaPuntoCuenta | None = None,
        generador: GeneradorPuntoCuenta | None = None,
        almacen=None,
    ):
        self.repo = repo or RepoPuntoCuentaORM()
        self.repo_secuencia = repo_secuencia or RepoSecuenciaPuntoCuentaORM()
        self.generador = generador or obtener_generador_punto_cuenta(almacen)
        self.almacen = almacen

    def _eliminar_pdf(self, clave: str) -> None:
        if not clave:
            return
        try:
            if self.almacen is None:
                from core.infrastructure.storage.seaweedfs_storage import (
                    SeaweedFSStorage,
                )
                self.almacen = SeaweedFSStorage()
            self.almacen.eliminar(clave)
        except Exception:
            logger.warning('No se pudo eliminar el PDF huérfano %s del Punto de Cuenta.', clave, exc_info=True)

    def emitir(
        self,
        *,
        proceso: str,
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
        configuracion: dict | None = None,
        datos_adicionales: dict[str, Any] | None = None,
        ahora: datetime | None = None,
    ) -> PuntoCuentaDTO:
        ahora = ahora or datetime.now()
        with transaction.atomic():
            # Se valida antes de reservar correlativo o crear el registro.
            self.generador.validar(proceso)
            try:
                secuencia, numero = obtener_siguiente_correlativo(self.repo_secuencia, ahora.year)
            except Exception:
                logger.warning('No se pudo reservar el correlativo del punto de cuenta.', exc_info=True)
                secuencia, numero = None, None

            dto = generar_punto_cuenta(
                self.repo,
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
                proceso=proceso,
                anio=ahora.year,
                secuencia=secuencia,
                configuracion_version=(configuracion or {}).get('version'),
                snapshot_formato={
                    'proceso': proceso,
                    'configuracion': configuracion or {},
                    'generador': 'documentos',
                },
            )
            documento = None
            try:
                documento = generar_documento_punto_cuenta(
                    self.generador, dto, proceso=proceso, datos_adicionales=datos_adicionales,
                )
                dto = adjuntar_documento_punto_cuenta(
                    self.repo, dto.id, documento.pdf_clave, documento.id,
                )
            except Exception:
                if documento is not None:
                    self._eliminar_pdf(documento.pdf_clave)
                raise
        guardar_ultimo_punto_cuenta(dto)
        return dto


def obtener_servicio_emision_punto_cuenta() -> ServicioEmisionPuntoCuenta:
    return ServicioEmisionPuntoCuenta()
