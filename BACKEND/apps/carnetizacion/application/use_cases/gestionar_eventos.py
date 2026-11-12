"""
Casos de Uso para Gestión de Eventos, Categorías y Zonas (Regla B4, O45-B).
"""
import uuid

from apps.carnetizacion.application.dtos.evento_dtos import (
    EventoCategoriaDTO,
    EventoCrearDTO,
    EventoDTO,
    EventoZonaDTO,
)
from apps.carnetizacion.domain.entities.evento import (
    EstadoEvento,
    Evento,
    EventoCategoria,
    EventoZona,
)
from core.domain.paginacion import Paginacion
from apps.carnetizacion.domain.ports.repo_eventos import RepoEventosPort
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError


class CrearEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, dto: EventoCrearDTO, creado_por_id: int | None = None) -> EventoDTO:
        evento_id = str(uuid.uuid4())
        nuevo_evento = Evento(
            id=evento_id,
            nombre=dto.nombre.strip(),
            descripcion=dto.descripcion.strip(),
            lugar=dto.lugar.strip(),
            fecha_inicio=dto.fecha_inicio,
            fecha_fin=dto.fecha_fin,
            estado=EstadoEvento.ACTIVO,
            plantilla_id=dto.plantilla_id,
            creado_por_id=creado_por_id,
        )
        guardado = self.repo.crear_evento(nuevo_evento)

        # Categorías iniciales si vienen en el DTO o generar por defecto
        cats_data = dto.categorias or [
            {"nombre": "Invitado especial", "color_primario": "#0B4A9E", "color_acento": "#F59E0B", "orden": 1},
            {"nombre": "Autoridad", "color_primario": "#1E3A8A", "color_acento": "#D97706", "orden": 2},
            {"nombre": "Prensa", "color_primario": "#047857", "color_acento": "#10B981", "orden": 3},
            {"nombre": "Staff", "color_primario": "#374151", "color_acento": "#6B7280", "orden": 4},
        ]
        categorias_dtos = []
        for cat in cats_data:
            c = self.repo.crear_categoria(
                EventoCategoria(
                    id=str(uuid.uuid4()),
                    evento_id=guardado.id,
                    nombre=cat["nombre"],
                    color_primario=cat.get("color_primario", "#0B4A9E"),
                    color_acento=cat.get("color_acento", "#F59E0B"),
                    orden=cat.get("orden", 1),
                )
            )
            categorias_dtos.append(
                EventoCategoriaDTO(
                    id=c.id,
                    evento_id=c.evento_id,
                    nombre=c.nombre,
                    color_primario=c.color_primario,
                    color_acento=c.color_acento,
                    orden=c.orden,
                )
            )

        # Zonas iniciales
        zonas_data = dto.zonas or [
            {"nombre": "Salón principal", "codigo": "SP", "orden": 1},
            {"nombre": "Área de prensa", "codigo": "PRENSA", "orden": 2},
            {"nombre": "Todas las áreas", "codigo": "TODAS", "orden": 3},
        ]
        zonas_dtos = []
        for z in zonas_data:
            zona = self.repo.crear_zona(
                EventoZona(
                    id=str(uuid.uuid4()),
                    evento_id=guardado.id,
                    nombre=z["nombre"],
                    codigo=z.get("codigo", ""),
                    orden=z.get("orden", 1),
                )
            )
            zonas_dtos.append(
                EventoZonaDTO(
                    id=zona.id,
                    evento_id=zona.evento_id,
                    nombre=zona.nombre,
                    codigo=zona.codigo,
                    orden=zona.orden,
                )
            )

        return EventoDTO(
            id=guardado.id,
            nombre=guardado.nombre,
            lugar=guardado.lugar,
            fecha_inicio=guardado.fecha_inicio.isoformat() if guardado.fecha_inicio else "",
            fecha_fin=guardado.fecha_fin.isoformat() if guardado.fecha_fin else "",
            descripcion=guardado.descripcion,
            estado=guardado.estado.value if hasattr(guardado.estado, 'value') else str(guardado.estado),
            plantilla_id=guardado.plantilla_id,
            creado_por_id=guardado.creado_por_id,
            created_at=guardado.created_at.isoformat() if guardado.created_at else None,
            categorias=categorias_dtos,
            zonas=zonas_dtos,
        )


class ListarEventosUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self, estado: str | None = None, busqueda: str | None = None
    ) -> list[EventoDTO]:
        eventos = self.repo.listar_eventos(estado, busqueda=busqueda)
        return [self._a_dto(ev) for ev in eventos]

    def ejecutar_paginado(
        self,
        paginacion: Paginacion,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[EventoDTO], int, dict[str, int]]:
        """Devuelve (página de eventos, total del filtro, resumen global real)."""
        eventos, total = self.repo.listar_eventos_paginado(
            paginacion.offset, paginacion.tamano, estado=estado, busqueda=busqueda
        )
        return (
            [self._a_dto(ev) for ev in eventos],
            total,
            self.repo.resumen_global_eventos(),
        )

    def _a_dto(self, ev: Evento) -> EventoDTO:
        cats = [
            EventoCategoriaDTO(
                id=c.id,
                evento_id=c.evento_id,
                nombre=c.nombre,
                color_primario=c.color_primario,
                color_acento=c.color_acento,
                orden=c.orden,
            )
            for c in self.repo.listar_categorias(ev.id)
        ]
        zonas = [
            EventoZonaDTO(
                id=z.id,
                evento_id=z.evento_id,
                nombre=z.nombre,
                codigo=z.codigo,
                orden=z.orden,
            )
            for z in self.repo.listar_zonas(ev.id)
        ]
        resumen = self.repo.obtener_resumen_panel(ev.id)
        return EventoDTO(
            id=ev.id,
            nombre=ev.nombre,
            lugar=ev.lugar,
            fecha_inicio=ev.fecha_inicio.isoformat() if ev.fecha_inicio else "",
            fecha_fin=ev.fecha_fin.isoformat() if ev.fecha_fin else "",
            descripcion=ev.descripcion,
            estado=ev.estado.value if hasattr(ev.estado, 'value') else str(ev.estado),
            plantilla_id=ev.plantilla_id,
            creado_por_id=ev.creado_por_id,
            created_at=ev.created_at.isoformat() if ev.created_at else None,
            categorias=cats,
            zonas=zonas,
            total_invitados=resumen.total_invitados,
            total_entraron=resumen.entraron,
        )


class ObtenerEventoDetalleUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, evento_id: str) -> EventoDTO | None:
        ev = self.repo.obtener_evento(evento_id)
        if not ev:
            return None
        cats = [
            EventoCategoriaDTO(
                id=c.id,
                evento_id=c.evento_id,
                nombre=c.nombre,
                color_primario=c.color_primario,
                color_acento=c.color_acento,
                orden=c.orden,
            )
            for c in self.repo.listar_categorias(ev.id)
        ]
        zonas = [
            EventoZonaDTO(
                id=z.id,
                evento_id=z.evento_id,
                nombre=z.nombre,
                codigo=z.codigo,
                orden=z.orden,
            )
            for z in self.repo.listar_zonas(ev.id)
        ]
        resumen = self.repo.obtener_resumen_panel(ev.id)
        return EventoDTO(
            id=ev.id,
            nombre=ev.nombre,
            lugar=ev.lugar,
            fecha_inicio=ev.fecha_inicio.isoformat() if ev.fecha_inicio else "",
            fecha_fin=ev.fecha_fin.isoformat() if ev.fecha_fin else "",
            descripcion=ev.descripcion,
            estado=ev.estado.value if hasattr(ev.estado, 'value') else str(ev.estado),
            plantilla_id=ev.plantilla_id,
            creado_por_id=ev.creado_por_id,
            created_at=ev.created_at.isoformat() if ev.created_at else None,
            categorias=cats,
            zonas=zonas,
            total_invitados=resumen.total_invitados,
            total_entraron=resumen.entraron,
        )


class ActualizarEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, evento_id: str, datos: dict) -> EventoDTO | None:
        ev = self.repo.obtener_evento(evento_id)
        if not ev:
            return None
        if "nombre" in datos:
            ev.nombre = datos["nombre"].strip()
        if "lugar" in datos:
            ev.lugar = datos["lugar"].strip()
        if "descripcion" in datos:
            ev.descripcion = datos["descripcion"].strip()
        if "estado" in datos:
            ev.estado = EstadoEvento(datos["estado"])
        if "fecha_inicio" in datos and datos["fecha_inicio"]:
            ev.fecha_inicio = datos["fecha_inicio"]
        if "fecha_fin" in datos and datos["fecha_fin"]:
            ev.fecha_fin = datos["fecha_fin"]
        if "plantilla_id" in datos:
            ev.plantilla_id = datos["plantilla_id"]

        guardado = self.repo.actualizar_evento(ev)
        detalle_uc = ObtenerEventoDetalleUseCase(self.repo)
        return detalle_uc.ejecutar(guardado.id)


class CrearCategoriaEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self,
        evento_id: str,
        nombre: str,
        color_primario: str = "#0B4A9E",
        color_acento: str = "#F59E0B",
        orden: int = 1,
        plantilla_id: str | None = None,
    ) -> EventoCategoriaDTO:
        cat = self.repo.crear_categoria(
            EventoCategoria(
                id=str(uuid.uuid4()),
                evento_id=evento_id,
                nombre=nombre.strip(),
                color_primario=color_primario,
                color_acento=color_acento,
                orden=orden,
                plantilla_id=plantilla_id,
            )
        )
        return EventoCategoriaDTO(
            id=cat.id,
            evento_id=cat.evento_id,
            nombre=cat.nombre,
            color_primario=cat.color_primario,
            color_acento=cat.color_acento,
            orden=cat.orden,
            plantilla_id=cat.plantilla_id,
        )


class CrearZonaEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self,
        evento_id: str,
        nombre: str,
        codigo: str = "",
        orden: int = 1,
    ) -> EventoZonaDTO:
        zona = self.repo.crear_zona(
            EventoZona(
                id=str(uuid.uuid4()),
                evento_id=evento_id,
                nombre=nombre.strip(),
                codigo=codigo.strip(),
                orden=orden,
            )
        )
        return EventoZonaDTO(
            id=zona.id,
            evento_id=zona.evento_id,
            nombre=zona.nombre,
            codigo=zona.codigo,
            orden=zona.orden,
        )



def _plural(n: int) -> str:
    return "invitado asignado" if n == 1 else "invitados asignados"


class ActualizarCategoriaEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, categoria_id: str, datos: dict) -> EventoCategoria:
        cat = self.repo.obtener_categoria(categoria_id)
        if not cat:
            raise NotFoundError("Categoría no encontrada.")
        if "nombre" in datos:
            nombre = str(datos["nombre"]).strip()
            if not nombre:
                raise ValidationError("El nombre de categoría es obligatorio.", campo="nombre")
            cat.nombre = nombre
        if datos.get("color_primario"):
            cat.color_primario = str(datos["color_primario"])
        if datos.get("color_acento"):
            cat.color_acento = str(datos["color_acento"])
        if "orden" in datos:
            cat.orden = int(datos["orden"])
        return self.repo.actualizar_categoria(cat)


class EliminarCategoriaEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, categoria_id: str) -> None:
        if not self.repo.obtener_categoria(categoria_id):
            raise NotFoundError("Categoría no encontrada.")
        n = self.repo.contar_invitados_categoria(categoria_id)
        if n:
            raise ConflictError(f"No se puede eliminar la categoría: tiene {n} {_plural(n)}.")
        self.repo.eliminar_categoria(categoria_id)


class ActualizarZonaEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, zona_id: str, datos: dict) -> EventoZona:
        zona = self.repo.obtener_zona(zona_id)
        if not zona:
            raise NotFoundError("Zona no encontrada.")
        if "nombre" in datos:
            nombre = str(datos["nombre"]).strip()
            if not nombre:
                raise ValidationError("El nombre de zona es obligatorio.", campo="nombre")
            zona.nombre = nombre
        if "codigo" in datos:
            zona.codigo = str(datos["codigo"]).strip()
        if "orden" in datos:
            zona.orden = int(datos["orden"])
        return self.repo.actualizar_zona(zona)


class EliminarZonaEventoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, zona_id: str) -> None:
        if not self.repo.obtener_zona(zona_id):
            raise NotFoundError("Zona no encontrada.")
        n = self.repo.contar_invitados_zona(zona_id)
        if n:
            raise ConflictError(f"No se puede eliminar la zona: tiene {n} {_plural(n)}.")
        self.repo.eliminar_zona(zona_id)
