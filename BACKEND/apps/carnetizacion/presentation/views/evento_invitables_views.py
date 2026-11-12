"""Vistas para agregar invitados a un evento eligiendo personas registradas, y zonas/categorías."""
import uuid

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.domain.paginacion import Paginacion
from core.domain.exceptions import ValidationError
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.carnetizacion.application.use_cases.gestionar_eventos import (
    ActualizarCategoriaEventoUseCase,
    ActualizarZonaEventoUseCase,
    EliminarCategoriaEventoUseCase,
    EliminarZonaEventoUseCase,
)
from apps.carnetizacion.application.use_cases.gestionar_invitados import (
    AgregarInvitadosEnBloqueUseCase,
    BuscarExternosInvitablesUseCase,
    BuscarPersonalInvitableUseCase,
    IdsPersonasInvitablesUseCase,
)
from apps.carnetizacion.domain.entities.persona_origen import TOPE_AGREGAR_EN_BLOQUE
from apps.carnetizacion.infrastructure.repositories.repo_eventos_orm import RepoEventosORM
from apps.carnetizacion.infrastructure.repositories.repo_origen_invitados_orm import (
    RepoOrigenInvitadosORM,
)
from apps.carnetizacion.presentation.serializers.evento_serializers import (
    EventoCategoriaSerializer,
    EventoZonaSerializer,
)

MODULO_AUDITORIA = "carnetizacion"
PERMISO = HasPermission("carnetizacion.eventos")


def _persona_dict(p) -> dict:
    return {
        "tipo": p.tipo,
        "clave": p.clave,
        "nombre": p.nombre,
        "documento": p.documento,
        "cargo": p.cargo,
        "dependencia": p.dependencia,
        "condicion": p.condicion,
        "foto_url": f"/api/v1/personal/{p.foto_cedula}/foto/" if p.foto_cedula else "",
        "ya_invitado": p.ya_invitado,
    }


def _dependencia_id(request) -> int | None:
    bruto = request.query_params.get("dependencia_id")
    if not bruto:
        return None
    try:
        return int(bruto)
    except ValueError:
        raise ValidationError("La dependencia no es válida.", campo="dependencia_id")


def _casos_uso(clase):
    return clase(RepoEventosORM(), RepoOrigenInvitadosORM())


class EventoPersonalInvitableView(APIView):
    permission_classes = [IsAuthenticated, PERMISO]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Buscar trabajadores para invitar (paginado, filtrado en el servidor)",
        parameters=[
            OpenApiParameter("poblacion", str, required=False),
            OpenApiParameter("dependencia_id", int, required=False),
            OpenApiParameter("busqueda", str, required=False),
            OpenApiParameter("pagina", int, required=False),
            OpenApiParameter("page_size", int, required=False),
        ],
    )
    def get(self, request, evento_id: str):
        paginacion = Paginacion.desde_parametros(request.query_params.dict())
        personas, total = _casos_uso(BuscarPersonalInvitableUseCase).ejecutar(
            str(evento_id),
            request.query_params.get("poblacion"),
            _dependencia_id(request),
            request.query_params.get("busqueda", ""),
            paginacion.offset,
            paginacion.tamano,
        )
        return ok(paginacion.envolver([_persona_dict(p) for p in personas], total))


class EventoPersonalInvitableIdsView(APIView):
    permission_classes = [IsAuthenticated, PERMISO]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Cédulas de todo el filtro que aún no están invitadas",
    )
    def get(self, request, evento_id: str):
        ids = _casos_uso(IdsPersonasInvitablesUseCase).personal(
            str(evento_id),
            request.query_params.get("poblacion"),
            _dependencia_id(request),
            request.query_params.get("busqueda", ""),
        )
        return ok({"ids": ids, "total": len(ids), "tope": TOPE_AGREGAR_EN_BLOQUE})


class EventoExternosInvitablesView(APIView):
    permission_classes = [IsAuthenticated, PERMISO]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Buscar credenciales externas registradas para invitar",
    )
    def get(self, request, evento_id: str):
        paginacion = Paginacion.desde_parametros(request.query_params.dict())
        personas, total = _casos_uso(BuscarExternosInvitablesUseCase).ejecutar(
            str(evento_id),
            request.query_params.get("busqueda", ""),
            paginacion.offset,
            paginacion.tamano,
        )
        return ok(paginacion.envolver([_persona_dict(p) for p in personas], total))


class EventoExternosInvitablesIdsView(APIView):
    permission_classes = [IsAuthenticated, PERMISO]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Ids de todas las credenciales externas del filtro",
    )
    def get(self, request, evento_id: str):
        ids = _casos_uso(IdsPersonasInvitablesUseCase).externos(
            str(evento_id), request.query_params.get("busqueda", "")
        )
        return ok({"ids": ids, "total": len(ids), "tope": TOPE_AGREGAR_EN_BLOQUE})


def _lista_texto(valor) -> list[str]:
    if valor is None:
        return []
    if not isinstance(valor, list):
        raise ValidationError("Se esperaba una lista.")
    return [str(v) for v in valor]


class EventoInvitadosEnBloqueView(APIView):
    """Agrega en una transacción a trabajadores (cédulas o población) y credenciales externas."""

    permission_classes = [IsAuthenticated, PERMISO]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Agregar invitados en bloque desde personas registradas",
    )
    def post(self, request, evento_id: str):
        datos = request.data
        categoria_id = str(datos.get("categoria_id") or "")
        zona_id = str(datos.get("zona_id") or "")
        if not categoria_id or not zona_id:
            raise ValidationError("La categoría y la zona son obligatorias.")
        dependencia = datos.get("dependencia_id")
        try:
            dependencia = int(dependencia) if dependencia not in (None, "") else None
        except (TypeError, ValueError):
            raise ValidationError("La dependencia no es válida.", campo="dependencia_id")

        resultado = _casos_uso(AgregarInvitadosEnBloqueUseCase).ejecutar(
            str(evento_id),
            categoria_id,
            zona_id,
            cedulas=_lista_texto(datos.get("cedulas")),
            poblacion=datos.get("poblacion"),
            dependencia_id=dependencia,
            externos_ids=_lista_texto(datos.get("externos_ids")),
        )
        registrar_auditoria(
            trace_id=getattr(request, "trace_id", None) or uuid.uuid4().hex,
            actor_id=getattr(request.user, "pk", None),
            actor_cedula=str(getattr(request.user, "cedula_id", "") or ""),
            accion="EVENTO_INVITADOS_AGREGADOS_EN_BLOQUE",
            modulo=MODULO_AUDITORIA,
            recurso_tipo="Evento",
            recurso_id=str(evento_id),
            estado_nuevo={
                "agregados": resultado.agregados,
                "duplicados": resultado.duplicados,
                "poblacion": datos.get("poblacion"),
                "dependencia_id": dependencia,
                "categoria_id": categoria_id,
                "zona_id": zona_id,
            },
            **origen_de_peticion(request),
        )
        return ok(
            {
                "agregados": resultado.agregados,
                "duplicados": resultado.duplicados,
                "solicitados": resultado.solicitados,
            },
            status=201 if resultado.agregados else 200,
        )


class EventoCategoriaDetalleView(APIView):
    permission_classes = [IsAuthenticated, PERMISO]

    @extend_schema(tags=["Carnetización - Eventos"], summary="Renombrar o recolorear una categoría")
    def patch(self, request, pk: str):
        cat = ActualizarCategoriaEventoUseCase(RepoEventosORM()).ejecutar(str(pk), request.data)
        return ok(EventoCategoriaSerializer(cat).data)

    @extend_schema(tags=["Carnetización - Eventos"], summary="Eliminar una categoría sin invitados")
    def delete(self, request, pk: str):
        EliminarCategoriaEventoUseCase(RepoEventosORM()).ejecutar(str(pk))
        return ok({"eliminado": True})


class EventoZonaDetalleView(APIView):
    permission_classes = [IsAuthenticated, PERMISO]

    @extend_schema(tags=["Carnetización - Eventos"], summary="Renombrar una zona")
    def patch(self, request, pk: str):
        zona = ActualizarZonaEventoUseCase(RepoEventosORM()).ejecutar(str(pk), request.data)
        return ok(EventoZonaSerializer(zona).data)

    @extend_schema(tags=["Carnetización - Eventos"], summary="Eliminar una zona sin invitados")
    def delete(self, request, pk: str):
        EliminarZonaEventoUseCase(RepoEventosORM()).ejecutar(str(pk))
        return ok({"eliminado": True})
