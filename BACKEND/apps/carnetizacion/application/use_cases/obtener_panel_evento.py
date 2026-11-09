"""
Caso de Uso para Obtener Métricas y Resumen del Panel de Control del Evento (Regla B4, O45-B).
"""
from apps.carnetizacion.application.dtos.evento_dtos import PanelEventoDTO
from apps.carnetizacion.domain.ports.repo_eventos import RepoEventosPort


class ObtenerPanelEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, evento_id: str) -> PanelEventoDTO | None:
        evento = self.repo.obtener_evento(evento_id)
        if not evento:
            return None

        resumen = self.repo.obtener_resumen_panel(evento_id)
        pct = 0.0
        if resumen.total_invitados > 0:
            pct = round((resumen.entraron / resumen.total_invitados) * 100.0, 1)

        return PanelEventoDTO(
            evento_id=evento.id,
            nombre_evento=evento.nombre,
            lugar=evento.lugar,
            fecha_inicio=evento.fecha_inicio.isoformat() if evento.fecha_inicio else "",
            fecha_fin=evento.fecha_fin.isoformat() if evento.fecha_fin else "",
            estado=evento.estado.value if hasattr(evento.estado, 'value') else str(evento.estado),
            total_invitados=resumen.total_invitados,
            credenciales_emitidas=resumen.credenciales_emitidas,
            entraron=resumen.entraron,
            faltan=resumen.faltan,
            porcentaje_asistencia=pct,
            por_categoria=resumen.por_categoria,
            por_zona=resumen.por_zona,
        )
