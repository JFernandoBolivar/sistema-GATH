"""Repositorio ORM de la constancia de fe de vida y su plantilla versionada."""
from datetime import datetime

from django.db import IntegrityError, transaction
from django.db.models import Max

from apps.fe_de_vida.domain.entities.constancia import Certificador, ConstanciaFeDeVida, PlantillaConstancia
from apps.fe_de_vida.domain.services.constancia import (
    correlativo_de,
    formatear_numero,
    generar_codigo_verificacion,
    prefijo_anual,
)
from apps.fe_de_vida.infrastructure.models.solicitud_models import ConstanciaFeDeVidaModel, PlantillaConstanciaModel
from core.domain.exceptions import ConflictError, NotFoundError

INTENTOS_NUMERACION = 5  # reintentos si dos validaciones simultáneas piden el mismo correlativo


def _a_entidad(m: ConstanciaFeDeVidaModel) -> ConstanciaFeDeVida:
    return ConstanciaFeDeVida(
        id=str(m.pk), solicitud_id=str(m.solicitud_id), numero=m.numero, codigo_verificacion=m.codigo_verificacion,
        certificada_por=tuple(Certificador(c['nombre'], c['cedula'], c['rol']) for c in m.certificada_por),
        plantilla_version=m.plantilla_version, clave_pdf=m.clave_pdf, emitida_en=m.emitida_en,
    )


class RepoConstanciasORM:
    def plantilla_activa(self) -> PlantillaConstancia | None:
        m = PlantillaConstanciaModel.objects.filter(activa=True).order_by('-version').first()
        return PlantillaConstancia(m.version, m.titulo, m.texto) if m else None

    def obtener_de_solicitud(self, solicitud_id: str) -> ConstanciaFeDeVida | None:
        m = ConstanciaFeDeVidaModel.objects.filter(solicitud_id=solicitud_id).first()
        return _a_entidad(m) if m else None

    def obtener_por_codigo(self, codigo: str) -> ConstanciaFeDeVida | None:
        m = ConstanciaFeDeVidaModel.objects.filter(codigo_verificacion=codigo).first()
        return _a_entidad(m) if m else None

    def reservar(
        self, solicitud_id: str, cedula: str, anio: int, certificadores: tuple[Certificador, ...],
        plantilla_version: int, ahora: datetime,
    ) -> ConstanciaFeDeVida:
        prefijo = prefijo_anual(anio)
        for _ in range(INTENTOS_NUMERACION):
            ultimo = ConstanciaFeDeVidaModel.objects.filter(numero__startswith=prefijo).aggregate(m=Max('numero'))['m']
            numero = formatear_numero(anio, correlativo_de(ultimo or '') + 1)
            try:
                with transaction.atomic():
                    m = ConstanciaFeDeVidaModel.objects.create(
                        solicitud_id=solicitud_id, numero=numero,
                        codigo_verificacion=generar_codigo_verificacion(numero, solicitud_id, cedula),
                        certificada_por=[{'nombre': c.nombre, 'cedula': c.cedula, 'rol': c.rol} for c in certificadores],
                        plantilla_version=plantilla_version, emitida_en=ahora,
                    )
                return _a_entidad(m)
            except IntegrityError:
                continue
        raise ConflictError("No se pudo numerar la constancia: intente de nuevo.")

    def registrar_pdf(self, constancia_id: str, clave_pdf: str) -> ConstanciaFeDeVida:
        actualizadas = ConstanciaFeDeVidaModel.objects.filter(pk=constancia_id).update(clave_pdf=clave_pdf)
        if not actualizadas:
            raise NotFoundError("La constancia no existe.")
        return _a_entidad(ConstanciaFeDeVidaModel.objects.get(pk=constancia_id))
