"""
Casos de Uso para Gestión e Importación de Invitados a Eventos (Regla B4, O45-B).
"""
import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from apps.carnetizacion.application.dtos.evento_dtos import (
    EventoInvitadoDTO,
    InvitadoCrearDTO,
    InvitadoImportarFilaDTO,
    ResumenImportacionDTO,
)
from apps.carnetizacion.domain.entities.evento import (
    EstadoInvitado,
    EventoInvitado,
)
from apps.carnetizacion.domain.entities.persona_origen import (
    POBLACIONES,
    TOPE_AGREGAR_EN_BLOQUE,
    PersonaOrigen,
)
from apps.carnetizacion.domain.ports.repo_eventos import RepoEventosPort
from apps.carnetizacion.domain.ports.repo_origen_invitados import RepoOrigenInvitadosPort
from core.domain.exceptions import NotFoundError, ValidationError


def _generar_hash_invitado(evento_id: str, nombre: str) -> str:
    seed = f"{evento_id}:{nombre}:{secrets.token_hex(16)}:{datetime.now().isoformat()}"
    return hashlib.sha256(seed.encode('utf-8')).hexdigest()


def _formatear_invitado_dto(
    inv: EventoInvitado,
    repo: RepoEventosPort,
    categorias: dict | None = None,
    zonas: dict | None = None,
) -> EventoInvitadoDTO:
    """`categorias`/`zonas` (id -> entidad) evitan una consulta por invitado en listados."""
    cat = categorias.get(str(inv.categoria_id)) if categorias is not None else repo.obtener_categoria(inv.categoria_id)
    zona = zonas.get(str(inv.zona_id)) if zonas is not None else repo.obtener_zona(inv.zona_id)
    hora_txt = ""
    if inv.fecha_ingreso:
        hora_txt = inv.fecha_ingreso.strftime("%I:%M %p").lstrip("0")
    
    return EventoInvitadoDTO(
        id=inv.id,
        evento_id=inv.evento_id,
        nombre_completo=inv.nombre_completo,
        categoria_id=inv.categoria_id,
        zona_id=inv.zona_id,
        categoria_nombre=cat.nombre if cat else "",
        zona_nombre=zona.nombre if zona else "",
        documento_identidad=inv.documento_identidad,
        organizacion=inv.organizacion,
        correo=inv.correo,
        telefono=inv.telefono,
        mesa=inv.mesa,
        codigo_credencial=inv.codigo_credencial,
        security_hash=inv.security_hash,
        es_acompanante=inv.es_acompanante,
        trabajador_titular_id=inv.trabajador_titular_id,
        estado=inv.estado.value if hasattr(inv.estado, 'value') else str(inv.estado),
        fecha_emision=inv.fecha_emision.isoformat() if inv.fecha_emision else None,
        fecha_ingreso=inv.fecha_ingreso.isoformat() if inv.fecha_ingreso else None,
        hora_ingreso_formateada=hora_txt,
        observaciones=inv.observaciones,
        created_at=inv.created_at.isoformat() if inv.created_at else None,
    )


class CrearInvitadoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, dto: InvitadoCrearDTO) -> EventoInvitadoDTO:
        # Único global (la columna es unique): no un correlativo por evento.
        codigo = self.repo.siguiente_codigo_credencial()
        sec_hash = _generar_hash_invitado(dto.evento_id, dto.nombre_completo)

        nuevo = EventoInvitado(
            id=str(uuid.uuid4()),
            evento_id=dto.evento_id,
            nombre_completo=dto.nombre_completo.strip(),
            categoria_id=dto.categoria_id,
            zona_id=dto.zona_id,
            documento_identidad=dto.documento_identidad.strip(),
            organizacion=dto.organizacion.strip(),
            correo=dto.correo.strip().lower(),
            telefono=dto.telefono.strip(),
            mesa=dto.mesa.strip(),
            codigo_credencial=codigo,
            security_hash=sec_hash,
            es_acompanante=dto.es_acompanante,
            trabajador_titular_id=dto.trabajador_titular_id,
            estado=EstadoInvitado.REGISTRADO,
            observaciones=dto.observaciones.strip(),
        )
        guardado = self.repo.crear_invitado(nuevo)
        return _formatear_invitado_dto(guardado, self.repo)


class ListarInvitadosUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self,
        evento_id: str,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> list[EventoInvitadoDTO]:
        invitados = self.repo.listar_invitados(evento_id, categoria_id, zona_id, estado, busqueda)
        return [_formatear_invitado_dto(i, self.repo) for i in invitados]


class ListarInvitadosPaginadoUseCase:
    """Página de invitados de un evento, con el filtro aplicado en el servidor."""

    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self,
        evento_id: str,
        offset: int,
        limite: int,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[EventoInvitadoDTO], int]:
        invitados, total = self.repo.listar_invitados_paginado(
            evento_id, offset, limite, categoria_id, zona_id, estado, busqueda
        )
        categorias = {str(c.id): c for c in self.repo.listar_categorias(evento_id)}
        zonas = {str(z.id): z for z in self.repo.listar_zonas(evento_id)}
        return [_formatear_invitado_dto(i, self.repo, categorias, zonas) for i in invitados], total


class ListarIdsInvitadosUseCase:
    """Ids de todos los invitados que cumplen el filtro (seleccionar todo el filtro)."""

    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self,
        evento_id: str,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> list[str]:
        return self.repo.listar_ids_invitados(evento_id, categoria_id, zona_id, estado, busqueda)


class ActualizarInvitadoUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(self, invitado_id: str, datos: dict[str, Any]) -> EventoInvitadoDTO | None:
        inv = self.repo.obtener_invitado(invitado_id)
        if not inv:
            return None

        if "nombre_completo" in datos:
            inv.nombre_completo = datos["nombre_completo"].strip()
        if "categoria_id" in datos:
            inv.categoria_id = datos["categoria_id"]
        if "zona_id" in datos:
            inv.zona_id = datos["zona_id"]
        if "documento_identidad" in datos:
            inv.documento_identidad = datos["documento_identidad"].strip()
        if "organizacion" in datos:
            inv.organizacion = datos["organizacion"].strip()
        if "correo" in datos:
            inv.correo = datos["correo"].strip().lower()
        if "telefono" in datos:
            inv.telefono = datos["telefono"].strip()
        if "mesa" in datos:
            inv.mesa = datos["mesa"].strip()
        if "es_acompanante" in datos:
            inv.es_acompanante = bool(datos["es_acompanante"])
        if "trabajador_titular_id" in datos:
            inv.trabajador_titular_id = datos["trabajador_titular_id"]
        if "estado" in datos:
            inv.estado = EstadoInvitado(datos["estado"])
        if "observaciones" in datos:
            inv.observaciones = datos["observaciones"].strip()

        guardado = self.repo.actualizar_invitado(inv)
        return _formatear_invitado_dto(guardado, self.repo)


class ImportarInvitadosUseCase:
    def __init__(self, repo: RepoEventosPort):
        self.repo = repo

    def ejecutar(
        self,
        evento_id: str,
        filas_crudas: list[dict[str, Any]],
        aplicar: bool = False,
    ) -> ResumenImportacionDTO:
        categorias = {c.nombre.lower().strip(): c.id for c in self.repo.listar_categorias(evento_id)}
        zonas = {z.nombre.lower().strip(): z.id for z in self.repo.listar_zonas(evento_id)}
        
        # Categoría y zona fallback por si no coinciden
        primera_cat_id = next(iter(categorias.values())) if categorias else ""
        primera_zona_id = next(iter(zonas.values())) if zonas else ""

        filas_procesadas: list[InvitadoImportarFilaDTO] = []

        for idx, item in enumerate(filas_crudas, start=1):
            nombre = str(item.get("nombre") or item.get("nombre_completo") or "").strip()
            cat_nom = str(item.get("categoria") or "").strip()
            zona_nom = str(item.get("zona") or "").strip()
            doc = str(item.get("documento") or item.get("cedula") or "").strip()
            org = str(item.get("organizacion") or item.get("empresa") or "").strip()
            correo = str(item.get("correo") or item.get("email") or "").strip().lower()
            tlf = str(item.get("telefono") or "").strip()
            mesa = str(item.get("mesa") or "").strip()

            valida = True
            error = ""

            if not nombre:
                valida = False
                error = "El nombre completo es obligatorio."
            elif len(nombre) < 3:
                valida = False
                error = "El nombre es demasiado corto."

            cat_id = categorias.get(cat_nom.lower(), primera_cat_id)
            zona_id = zonas.get(zona_nom.lower(), primera_zona_id)

            if not cat_id:
                valida = False
                error = "El evento no tiene categorías configuradas."
            if not zona_id:
                valida = False
                error = "El evento no tiene zonas configuradas."

            fila_dto = InvitadoImportarFilaDTO(
                fila=idx,
                nombre_completo=nombre,
                categoria_nombre=cat_nom or "Por defecto",
                zona_nombre=zona_nom or "Por defecto",
                documento_identidad=doc,
                organizacion=org,
                correo=correo,
                telefono=tlf,
                mesa=mesa,
                valida=valida,
                error=error,
            )
            filas_procesadas.append(fila_dto)

            if valida and aplicar:
                cod = self.repo.siguiente_codigo_credencial()
                shash = _generar_hash_invitado(evento_id, nombre)
                nuevo = EventoInvitado(
                    id=str(uuid.uuid4()),
                    evento_id=evento_id,
                    nombre_completo=nombre,
                    categoria_id=cat_id,
                    zona_id=zona_id,
                    documento_identidad=doc,
                    organizacion=org,
                    correo=correo,
                    telefono=tlf,
                    mesa=mesa,
                    codigo_credencial=cod,
                    security_hash=shash,
                    estado=EstadoInvitado.REGISTRADO,
                )
                self.repo.crear_invitado(nuevo)

        total_validas = sum(1 for f in filas_procesadas if f.valida)
        total_invalidas = len(filas_procesadas) - total_validas

        return ResumenImportacionDTO(
            total_filas=len(filas_procesadas),
            filas_validas=total_validas,
            filas_invalidas=total_invalidas,
            filas=filas_procesadas,
        )


# ─── Agregar invitados desde personas registradas (trabajadores y externos) ───

def _normalizar_poblacion(poblacion: str | None) -> str:
    valor = (poblacion or "TODOS").strip().upper()
    if valor not in POBLACIONES:
        raise ValidationError("La población debe ser TODOS, ACTIVOS o PASIVOS.", campo="poblacion")
    return valor


def _clave_doc(documento: str) -> str:
    return "".join(ch for ch in (documento or "").upper() if ch.isalnum())


class BuscarPersonalInvitableUseCase:
    """Página de trabajadores del filtro, marcando a quienes ya están invitados."""

    def __init__(self, repo_eventos: RepoEventosPort, repo_origen: RepoOrigenInvitadosPort):
        self.repo_eventos = repo_eventos
        self.repo_origen = repo_origen

    def ejecutar(
        self,
        evento_id: str,
        poblacion: str | None,
        dependencia_id: int | None,
        busqueda: str,
        offset: int,
        limite: int,
    ) -> tuple[list[PersonaOrigen], int]:
        busqueda = (busqueda or "").strip()
        if busqueda and len(busqueda) < 2:
            return [], 0
        personas, total = self.repo_origen.buscar_personal(
            _normalizar_poblacion(poblacion), dependencia_id, busqueda, offset, limite
        )
        ya = self.repo_eventos.documentos_invitados(evento_id)
        for p in personas:
            p.ya_invitado = _clave_doc(p.documento) in ya
        return personas, total


class BuscarExternosInvitablesUseCase:
    def __init__(self, repo_eventos: RepoEventosPort, repo_origen: RepoOrigenInvitadosPort):
        self.repo_eventos = repo_eventos
        self.repo_origen = repo_origen

    def ejecutar(
        self, evento_id: str, busqueda: str, offset: int, limite: int
    ) -> tuple[list[PersonaOrigen], int]:
        busqueda = (busqueda or "").strip()
        if busqueda and len(busqueda) < 2:
            return [], 0
        personas, total = self.repo_origen.buscar_externos(busqueda, offset, limite)
        ya = self.repo_eventos.documentos_invitados(evento_id)
        for p in personas:
            p.ya_invitado = _clave_doc(p.documento) in ya
        return personas, total


class IdsPersonasInvitablesUseCase:
    """Claves (cédulas o ids) de todo el filtro, sin quienes ya están invitados."""

    def __init__(self, repo_eventos: RepoEventosPort, repo_origen: RepoOrigenInvitadosPort):
        self.repo_eventos = repo_eventos
        self.repo_origen = repo_origen

    def personal(
        self, evento_id: str, poblacion: str | None, dependencia_id: int | None, busqueda: str
    ) -> list[str]:
        busqueda = (busqueda or "").strip()
        if busqueda and len(busqueda) < 2:
            return []
        cedulas = self.repo_origen.cedulas_personal(
            _normalizar_poblacion(poblacion), dependencia_id, busqueda, TOPE_AGREGAR_EN_BLOQUE
        )
        ya = self.repo_eventos.documentos_invitados(evento_id)
        return [c for c in cedulas if _clave_doc(c) not in ya]

    def externos(self, evento_id: str, busqueda: str) -> list[str]:
        busqueda = (busqueda or "").strip()
        if busqueda and len(busqueda) < 2:
            return []
        return self.repo_origen.ids_externos(busqueda, TOPE_AGREGAR_EN_BLOQUE)


@dataclass
class ResultadoAgregarBloque:
    agregados: int
    duplicados: int
    solicitados: int


class AgregarInvitadosEnBloqueUseCase:
    """Agrega invitados desde trabajadores (cédulas o filtro de población) o credenciales externas."""

    def __init__(self, repo_eventos: RepoEventosPort, repo_origen: RepoOrigenInvitadosPort):
        self.repo_eventos = repo_eventos
        self.repo_origen = repo_origen

    def ejecutar(
        self,
        evento_id: str,
        categoria_id: str,
        zona_id: str,
        *,
        cedulas: list[str] | None = None,
        poblacion: str | None = None,
        dependencia_id: int | None = None,
        externos_ids: list[str] | None = None,
    ) -> ResultadoAgregarBloque:
        if not self.repo_eventos.obtener_evento(evento_id):
            raise NotFoundError("Evento no encontrado.")
        cat = self.repo_eventos.obtener_categoria(categoria_id)
        zona = self.repo_eventos.obtener_zona(zona_id)
        if not cat or str(cat.evento_id) != str(evento_id):
            raise ValidationError("La categoría no pertenece al evento.", campo="categoria_id")
        if not zona or str(zona.evento_id) != str(evento_id):
            raise ValidationError("La zona no pertenece al evento.", campo="zona_id")

        cedulas = [c for c in (cedulas or []) if c]
        externos_ids = [i for i in (externos_ids or []) if i]
        if not cedulas and not externos_ids and poblacion is None:
            raise ValidationError("Seleccione al menos una persona o un filtro de población.")
        if len(cedulas) + len(externos_ids) > TOPE_AGREGAR_EN_BLOQUE:
            raise ValidationError(
                f"No se pueden agregar más de {TOPE_AGREGAR_EN_BLOQUE} invitados a la vez; "
                "acote la selección."
            )

        personas: list[PersonaOrigen] = []
        if cedulas or (poblacion is not None and not externos_ids):
            personas += self.repo_origen.resolver_personal(
                cedulas or None,
                _normalizar_poblacion(poblacion),
                dependencia_id,
                TOPE_AGREGAR_EN_BLOQUE + 1,
            )
        if externos_ids:
            personas += self.repo_origen.resolver_externos(externos_ids, TOPE_AGREGAR_EN_BLOQUE)
        if len(personas) > TOPE_AGREGAR_EN_BLOQUE:
            raise ValidationError(
                f"El filtro supera el tope de {TOPE_AGREGAR_EN_BLOQUE} invitados por operación; "
                "acótelo (por dependencia o búsqueda)."
            )
        if not personas:
            return ResultadoAgregarBloque(0, 0, 0)

        agregados, duplicados = self.repo_eventos.agregar_invitados_en_bloque(
            evento_id, categoria_id, zona_id, personas
        )
        return ResultadoAgregarBloque(agregados, duplicados, len(personas))
