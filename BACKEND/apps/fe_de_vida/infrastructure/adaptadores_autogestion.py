"""
Adaptadores de fe de vida sobre los mecanismos de autogestión (B1 `CambioPropuesto`, B3 `aplicar_cambios_aprobados`).

La capa `infrastructure` es la única autorizada a tocar otro módulo (B16): aquí se reutilizan, sin
duplicar tablas, el modelo de cambios propuestos (`origen_tipo = FE_DE_VIDA`), la lista blanca de campos,
el lector de la ficha y el aplicador transaccional de cambios aprobados.
"""
from datetime import datetime

from apps.autogestion.application.use_cases.decision_bienestar import aplicar_cambios_aprobados
from apps.autogestion.domain.entities.solicitud_actualizacion import CambioPropuesto
from apps.autogestion.domain.services.validacion_cambios import validar_estructura, validar_registro_nuevo, validar_valor
from apps.autogestion.domain.value_objects.secciones import CAMPO_REGISTRO_NUEVO, Accion, DecisionCambio
from apps.autogestion.infrastructure.repositories.aplicador_cambios_orm import AplicadorCambiosORM
from apps.autogestion.infrastructure.repositories.lector_ficha_orm import LectorFichaORM
from apps.autogestion.infrastructure.repositories.repo_cambios_soportes_orm import RepoCambiosPropuestosORM
from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.value_objects.estados import ORIGEN_FE_DE_VIDA
from core.domain.exceptions import NotFoundError, ValidationError


def _a_cambio_propuesto(solicitud_id: str, c: CambioActa) -> CambioPropuesto:
    return CambioPropuesto(
        id='', origen_tipo=ORIGEN_FE_DE_VIDA, origen_id=solicitud_id, seccion=c.seccion, accion=c.accion,
        entidad_destino=c.entidad_destino, entidad_id=c.entidad_id, campo=c.campo,
        valor_anterior=c.valor_anterior, valor_propuesto=c.valor_propuesto,
    )


def _a_cambio_acta(c: CambioPropuesto) -> CambioActa:
    return CambioActa(
        id=c.id, seccion=c.seccion, accion=c.accion, entidad_destino=c.entidad_destino, campo=c.campo,
        valor_propuesto=c.valor_propuesto, entidad_id=c.entidad_id, valor_anterior=c.valor_anterior,
    )


class RepoCambiosActaORM:
    """Persiste las respuestas del acta como `CambioPropuesto` con origen FE_DE_VIDA."""

    def __init__(self):
        self._repo = RepoCambiosPropuestosORM()

    def reemplazar(self, solicitud_id: str, cambios: list[CambioActa]) -> None:
        self._repo.reemplazar(ORIGEN_FE_DE_VIDA, solicitud_id, [_a_cambio_propuesto(solicitud_id, c) for c in cambios])

    def listar(self, solicitud_id: str) -> list[CambioActa]:
        return [_a_cambio_acta(c) for c in self._repo.listar(ORIGEN_FE_DE_VIDA, solicitud_id)]


class ValidadorCambiosActaORM:
    """Misma lista blanca y validación de valores que la autogestión del activo."""

    def __init__(self):
        self._lector = LectorFichaORM()

    def validar(self, cedula: str, cambio: CambioActa) -> CambioActa | None:
        try:
            accion = Accion(cambio.accion)
        except ValueError:
            raise ValidationError(f"Acción inválida: '{cambio.accion}'.") from None
        entidad_id = str(cambio.entidad_id) if cambio.entidad_id not in (None, '') else None
        validar_estructura(cambio.seccion, cambio.entidad_destino, accion, cambio.campo, entidad_id)
        if accion is Accion.CREAR:
            valor = validar_registro_nuevo(cambio.seccion, cambio.entidad_destino, cambio.valor_propuesto)
            self._lector.validar_referencias(valor)
            return CambioActa(cambio.seccion, accion.value, cambio.entidad_destino, CAMPO_REGISTRO_NUEVO, valor)
        if entidad_id is not None and not self._lector.pertenece_al_trabajador(cedula, cambio.entidad_destino, entidad_id):
            raise NotFoundError(f"El registro {entidad_id} de '{cambio.entidad_destino}' no pertenece al trabajador.")
        valor = validar_valor(cambio.campo, cambio.valor_propuesto)
        self._lector.validar_referencias({cambio.campo: valor})
        anterior = self._lector.valor_actual(cedula, cambio.entidad_destino, entidad_id, cambio.campo)
        if valor == anterior:
            return None
        return CambioActa(
            cambio.seccion, accion.value, cambio.entidad_destino, cambio.campo, valor,
            entidad_id=entidad_id, valor_anterior=anterior,
        )


class AplicadorCambiosActaORM:
    """
    C19: al VALIDARSE el acta, la doble aprobación (o la directa) cubre TODAS las respuestas: se marcan
    APROBADAS y se escriben en los datos reales con `aplicar_cambios_aprobados` (toma el lock del
    trabajador). Debe invocarse dentro de la transacción de la decisión (todo o nada).
    """

    def aplicar(self, solicitud_id: str, cedula: str, actor_cedula: str, ahora: datetime) -> int:
        repo = RepoCambiosPropuestosORM()
        pendientes = [c for c in repo.listar(ORIGEN_FE_DE_VIDA, solicitud_id) if c.decision is DecisionCambio.PENDIENTE]
        repo.guardar_decisiones([c.con_decision(DecisionCambio.APROBADO, '', actor_cedula, ahora) for c in pendientes])
        return aplicar_cambios_aprobados(
            AplicadorCambiosORM(), cedula=cedula, cambios=repo.listar(ORIGEN_FE_DE_VIDA, solicitud_id),
            soportes=[], actor=actor_cedula,
        )
