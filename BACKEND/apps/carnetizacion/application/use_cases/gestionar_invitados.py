"""
Casos de Uso para Gestión e Importación de Invitados a Eventos (Regla B4, O45-B).
"""
import hashlib
import secrets
import uuid
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
from apps.carnetizacion.domain.ports.repo_eventos import RepoEventosPort


def _generar_hash_invitado(evento_id: str, nombre: str) -> str:
    seed = f"{evento_id}:{nombre}:{secrets.token_hex(16)}:{datetime.now().isoformat()}"
    return hashlib.sha256(seed.encode('utf-8')).hexdigest()


def _formatear_invitado_dto(inv: EventoInvitado, repo: RepoEventosPort) -> EventoInvitadoDTO:
    cat = repo.obtener_categoria(inv.categoria_id)
    zona = repo.obtener_zona(inv.zona_id)
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
        invitados_existentes = self.repo.listar_invitados(dto.evento_id)
        correlativo = len(invitados_existentes) + 1
        codigo = f"INV-{correlativo:04d}"
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
        invitados_a_crear: list[EventoInvitado] = []
        
        invitados_previos = self.repo.listar_invitados(evento_id)
        contador = len(invitados_previos)

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
                contador += 1
                cod = f"INV-{contador:04d}"
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
