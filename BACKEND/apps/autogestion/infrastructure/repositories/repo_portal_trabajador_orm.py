"""
Adaptador ORM del portal del trabajador (Mi expediente / Mi carnet).

Es la capa `infrastructure` de autogestión: la única autorizada a leer los
repositorios de personal, familiares y carnetización (B16, ver .importlinter).
"""
import logging

from apps.autogestion.infrastructure.repositories.repo_secciones_complementarios_orm import (
    RepoDatosComplementariosORM,
)
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

    def tiene_carnet_activo(self, cedula: str) -> bool:
        return CarnetEmitidoModel.objects.filter(
            employee__cedulaidentidad=cedula, activo=True,
        ).exists()

    def crear_solicitud_carnet(self, cedula: str, motivo_id: int, observaciones: str) -> dict:
        from django.db import transaction

        from apps.carnetizacion.infrastructure.notificaciones_solicitudes import (
            notificar_solicitud_recibida,
        )

        with transaction.atomic():
            solicitud = RepoCarnetizacionORM().crear_solicitud_carnet(cedula, motivo_id, observaciones)
            empleado = self.obtener_empleado(cedula)
            nombre = ' '.join(
                str(getattr(empleado, campo, '') or '') for campo in ('nombres', 'apellidos')
            ).strip()
            # Aviso a quienes emiten carnets (bandeja de Carnetización), al confirmar.
            notificar_solicitud_recibida(solicitud, nombre)
        return solicitud

    def ultima_solicitud_carnet(self, cedula: str) -> dict | None:
        return RepoCarnetizacionORM().ultima_solicitud_carnet(cedula)

    def cancelar_solicitud_carnet(self, cedula: str, solicitud_id: str) -> dict:
        return RepoCarnetizacionORM().cancelar_solicitud_carnet(cedula, solicitud_id)

    def obtener_datos_complementarios(self, cedula: str):
        return RepoDatosComplementariosORM().obtener(cedula)

    def generar_pdf_carnet_activo(self, cedula: str) -> bytes | None:
        carnet = (
            CarnetEmitidoModel.objects.filter(employee__cedulaidentidad=cedula, activo=True)
            .order_by('-fecha_emision')
            .first()
        )
        if carnet is None:
            return None
        # El mismo PDF que se emitió (B-4); sin copia guardada, se regenera.
        repo = RepoCarnetizacionORM()
        return repo.pdf_emitido_guardado(carnet.pk) or repo.generar_pdf(carnet.pk)

    def generar_vista_previa_carnet_activo(self, cedula: str) -> str | None:
        """PNG (data URL) del carnet vigente; reutiliza la vista previa de carnetización."""
        if not self.tiene_carnet_activo(cedula):
            return None
        return RepoCarnetizacionORM().generar_vista_previa(cedula)

    def puede_ver_carnet(self, cedula: str) -> bool:
        from apps.autogestion.domain.services.politica_mi_carnet import (
            parsear_usuarios_especificos,
            puede_acceder_mi_carnet,
        )
        from apps.autogestion.infrastructure.politica_autogestion import condicion_de
        from core.domain.configuracion import (
            CLAVE_CARNETIZACION_MI_CARNET_ALCANCE,
            CLAVE_CARNETIZACION_MI_CARNET_USUARIOS,
        )
        from core.infrastructure.providers import obtener_lector_configuracion

        lector = obtener_lector_configuracion()
        alcance = lector.obtener_texto(CLAVE_CARNETIZACION_MI_CARNET_ALCANCE) if lector else 'nadie'
        usuarios_raw = lector.obtener_texto(CLAVE_CARNETIZACION_MI_CARNET_USUARIOS) if lector else ''
        usuarios = parsear_usuarios_especificos(usuarios_raw)
        condicion = condicion_de(cedula)
        return puede_acceder_mi_carnet(alcance, condicion, cedula, usuarios)
