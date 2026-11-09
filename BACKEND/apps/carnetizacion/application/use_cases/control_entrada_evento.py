"""
Caso de Uso para Registro y Validación de Control de Entrada a Eventos con QR (Regla B4, O45-B).
"""
from datetime import datetime

from apps.carnetizacion.application.dtos.evento_dtos import (
    CheckInRequestDTO,
    CheckInResponseDTO,
)
from apps.carnetizacion.domain.ports.repo_eventos import RepoEventosPort
from apps.carnetizacion.domain.services.control_entrada_service import (
    validar_y_registrar_entrada_evento,
)


class ControlEntradaEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self,
        request_dto: CheckInRequestDTO,
        registrado_por_id: int | None = None,
        ahora: datetime | None = None,
    ) -> CheckInResponseDTO:
        resultado = validar_y_registrar_entrada_evento(
            hash_o_codigo=request_dto.codigo_o_hash,
            evento_id=request_dto.evento_id,
            zona_id=request_dto.zona_id,
            registrado_por_id=registrado_por_id,
            repo=self.repo,
            ahora=ahora,
        )

        return CheckInResponseDTO(
            resultado=resultado.resultado.value if hasattr(resultado.resultado, 'value') else str(resultado.resultado),
            mensaje=resultado.mensaje,
            invitado_id=resultado.invitado_id,
            nombre_completo=resultado.nombre_completo,
            documento_identidad=resultado.documento_identidad,
            organizacion=resultado.organizacion,
            categoria_nombre=resultado.categoria_nombre,
            zona_nombre=resultado.zona_nombre,
            mesa=resultado.mesa,
            codigo_credencial=resultado.codigo_credencial,
            hora_ingreso_formateada=resultado.hora_ingreso_formateada,
        )
