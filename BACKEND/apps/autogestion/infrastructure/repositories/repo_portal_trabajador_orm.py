"""
Adaptador ORM del portal del trabajador (Mi expediente / Mi carnet).

Es la capa `infrastructure` de autogestión: la única autorizada a leer los
repositorios de personal, familiares y carnetización (B16, ver .importlinter).
"""
import logging

from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CarnetEmitidoModel,
    MotivosEmisionModel,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.familiares.application.use_cases.listar_familiares import _familiar_a_dto
from apps.familiares.infrastructure.repositories.repo_familiares_orm import RepoFamiliaresORM
from apps.personal.application.use_cases.listar_personal import _empleado_a_dto
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM

logger = logging.getLogger('gath.autogestion')


class RepoPortalTrabajadorORM:
    def obtener_empleado(self, cedula: str):
        entidad = RepoPersonalORM().obtener_por_cedula(cedula)
        return _empleado_a_dto(entidad) if entidad else None

    def listar_familiares(self, cedula: str) -> list:
        return [_familiar_a_dto(f) for f in RepoFamiliaresORM().listar_por_empleado(cedula)]

    def listar_carnets(self, cedula: str) -> list:
        return RepoCarnetizacionORM().listar_carnets(empleado_cedula=cedula)

    def listar_motivos_carnet(self) -> list[dict]:
        return [
            {'id': m.pk, 'nombre': m.nombre, 'descripcion': getattr(m, 'descripcion', m.nombre)}
            for m in MotivosEmisionModel.objects.all().order_by('id')
        ]

    def tiene_carnet_previo(self, cedula: str) -> bool:
        return CarnetEmitidoModel.objects.filter(employee__cedulaidentidad=cedula).exists()

    def emitir_carnet(self, cedula: str, motivo_id: int, observaciones: str):
        return RepoCarnetizacionORM().emitir_carnet(
            empleado_cedula=cedula, motivo_id=motivo_id, observaciones=observaciones,
        )

    def generar_pdf_carnet_activo(self, cedula: str) -> bytes | None:
        carnet = (
            CarnetEmitidoModel.objects.filter(employee__cedulaidentidad=cedula, activo=True)
            .order_by('-fecha_emision')
            .first()
        )
        if carnet is None:
            return None
        return RepoCarnetizacionORM().generar_pdf(carnet.pk)
