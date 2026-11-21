"""Consulta del expediente con su postulante e historial (D-1). Sin Django."""
from dataclasses import dataclass

from apps.postulacion.application.use_cases._comun import obtener_expediente
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.entities.postulante import Postulante, TransicionRegistrada
from apps.postulacion.domain.ports.repos import RepoPostulacion
from core.domain.exceptions import NotFoundError


@dataclass(frozen=True)
class ExpedienteConHistorial:
    expediente: ExpedientePostulacion
    postulante: Postulante
    transiciones: list[TransicionRegistrada]


def consultar_expediente(repo: RepoPostulacion, expediente_id: str) -> ExpedienteConHistorial:
    exp = obtener_expediente(repo, expediente_id)
    postulante = repo.obtener_postulante(exp.postulante_id)
    if postulante is None:
        raise NotFoundError("El postulante del expediente no existe.")
    return ExpedienteConHistorial(exp, postulante, repo.listar_transiciones(exp.id))
