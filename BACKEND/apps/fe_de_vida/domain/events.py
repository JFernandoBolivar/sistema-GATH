"""
Eventos de dominio de la fe de vida: PUNTOS DE ENGANCHE para notificaciones y correo (C6, aún sin
plantillas). Mismo mecanismo que autogestión: el caso de uso publica por el puerto `PublicadorEventos`;
el adaptador emite una señal dentro de la transacción y otra tras el commit (B22).
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol


class TipoEvento(str, Enum):
    PROCESO_ABIERTO = 'fe_de_vida.proceso_abierto'            # -> avisar a los pasivos
    PROCESO_CERRADO = 'fe_de_vida.proceso_cerrado'
    PRORROGA_CONCEDIDA = 'fe_de_vida.prorroga_concedida'      # -> avisar al pasivo (o a todos)
    SOLICITUD_ENVIADA = 'fe_de_vida.solicitud_enviada'        # -> avisar a Bienestar (fe_de_vida.revisar)
    PRIMER_CHECK = 'fe_de_vida.primer_check'                  # -> avisar al otro rol
    CHECK_RETIRADO = 'fe_de_vida.check_retirado'              # -> avisar a Bienestar (sin correo); auditoría CHECK_RETIRADO
    VALIDADA = 'fe_de_vida.validada'                          # -> constancia + correo (C4/C6)
    APROBACION_DIRECTA = 'fe_de_vida.aprobacion_directa'      # auditoría APROBACION_DIRECTA_ADMINISTRADORA
    RECHAZADA = 'fe_de_vida.rechazada'
    DEVUELTA = 'fe_de_vida.devuelta'                          # -> avisar al pasivo (corregir y reenviar)
    RECORDATORIO_CIERRE = 'fe_de_vida.recordatorio_cierre'    # -> avisar al pasivo sin solicitud enviada (C8)
    EXPIRADA = 'fe_de_vida.expirada'
    EVIDENCIA_CONSULTADA = 'fe_de_vida.evidencia_consultada'  # auditoría de acceso a la foto (RN-12)


@dataclass(frozen=True)
class EventoFeDeVida:
    tipo: TipoEvento
    proceso_id: str
    solicitud_id: str = ''
    cedula: str = ''            # pasivo dueño de la solicitud (vacío en eventos generales de proceso)
    actor_cedula: str = ''      # quien lo provocó (vacío si fue el sistema)
    detalle: dict = field(default_factory=dict)


class PublicadorEventos(Protocol):
    def publicar(self, evento: EventoFeDeVida) -> None: ...


class PublicadorNulo:
    def publicar(self, evento: EventoFeDeVida) -> None:
        return None
