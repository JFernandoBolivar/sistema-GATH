"""
Casos de Uso para Emisión en Lote y Envío de Credenciales de Eventos (Regla B4, O45-B).
"""
import logging
from datetime import datetime, timezone
from typing import Any

from apps.carnetizacion.domain.entities.evento import (
    EstadoInvitado,
    EventoInvitado,
)
from apps.carnetizacion.domain.ports.repo_eventos import RepoEventosPort

logger = logging.getLogger('gath.carnetizacion.eventos')


class EmitirCredencialesEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self,
        evento_id: str,
        invitados_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        ahora = datetime.now(timezone.utc)
        invitados = self.repo.listar_invitados(evento_id)
        
        if invitados_ids:
            seleccionados_set = set(invitados_ids)
            invitados = [i for i in invitados if str(i.id) in seleccionados_set]

        emitidos_count = 0
        for inv in invitados:
            if inv.estado in (EstadoInvitado.REGISTRADO, EstadoInvitado.EMITIDO):
                inv.estado = EstadoInvitado.EMITIDO
                inv.fecha_emision = ahora
                self.repo.actualizar_invitado(inv)
                emitidos_count += 1

        return {
            "evento_id": evento_id,
            "total_procesados": len(invitados),
            "total_emitidos": emitidos_count,
            "fecha_emision": ahora.isoformat(),
        }


class EnviarCredencialesCorreoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self,
        evento_id: str,
        invitados_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        evento = self.repo.obtener_evento(evento_id)
        if not evento:
            return {"error": "Evento no encontrado", "enviados": 0}

        invitados = self.repo.listar_invitados(evento_id)
        if invitados_ids:
            seleccionados_set = set(invitados_ids)
            invitados = [i for i in invitados if str(i.id) in seleccionados_set]

        con_correo = [i for i in invitados if i.correo and "@" in i.correo]
        enviados = 0
        fallidos = 0

        for inv in con_correo:
            ok_envio = self.repo.enviar_correo_invitado(inv, evento)
            if ok_envio:
                enviados += 1
            else:
                fallidos += 1

        return {
            "evento_id": evento_id,
            "total_destinatarios": len(con_correo),
            "enviados": enviados,
            "fallidos": fallidos,
            "sin_correo": len(invitados) - len(con_correo),
        }
