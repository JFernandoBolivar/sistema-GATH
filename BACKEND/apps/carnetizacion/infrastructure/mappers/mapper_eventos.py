"""
Mapeador entre modelos ORM y entidades de dominio de Eventos (Regla B2/B3, O45-B).
"""
from apps.carnetizacion.domain.entities.evento import (
    EstadoEvento,
    EstadoInvitado,
    Evento,
    EventoCategoria,
    EventoInvitado,
    EventoZona,
    RegistroAccesoEvento,
    ResultadoControlEntrada,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    EventoCategoriaModel,
    EventoInvitadoModel,
    EventoModel,
    EventoRegistroAccesoModel,
    EventoZonaModel,
)


def a_entidad_evento(m: EventoModel) -> Evento:
    return Evento(
        id=str(m.id),
        nombre=m.nombre,
        descripcion=m.descripcion,
        lugar=m.lugar,
        fecha_inicio=m.fecha_inicio,
        fecha_fin=m.fecha_fin,
        estado=EstadoEvento(m.estado) if m.estado in [e.value for e in EstadoEvento] else EstadoEvento.ACTIVO,
        plantilla_id=str(m.plantilla_id) if m.plantilla_id else None,
        creado_por_id=m.creado_por_id,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def a_entidad_categoria(m: EventoCategoriaModel) -> EventoCategoria:
    return EventoCategoria(
        id=str(m.id),
        evento_id=str(m.evento_id),
        nombre=m.nombre,
        color_primario=m.color_primario,
        color_acento=m.color_acento,
        orden=m.orden,
        plantilla_id=str(m.plantilla_id) if m.plantilla_id else None,
    )


def a_entidad_zona(m: EventoZonaModel) -> EventoZona:
    return EventoZona(
        id=str(m.id),
        evento_id=str(m.evento_id),
        nombre=m.nombre,
        codigo=m.codigo,
        orden=m.orden,
    )


def a_entidad_invitado(m: EventoInvitadoModel) -> EventoInvitado:
    return EventoInvitado(
        id=str(m.id),
        evento_id=str(m.evento_id),
        nombre_completo=m.nombre_completo,
        categoria_id=str(m.categoria_id),
        zona_id=str(m.zona_id),
        documento_identidad=m.documento_identidad,
        organizacion=m.organizacion,
        correo=m.correo,
        telefono=m.telefono,
        mesa=m.mesa,
        codigo_credencial=m.codigo_credencial,
        security_hash=m.security_hash,
        es_acompanante=m.es_acompanante,
        trabajador_titular_id=m.trabajador_titular_id,
        estado=EstadoInvitado(m.estado) if m.estado in [e.value for e in EstadoInvitado] else EstadoInvitado.REGISTRADO,
        fecha_emision=m.fecha_emision,
        fecha_ingreso=m.fecha_ingreso,
        ingreso_registrado_por_id=m.ingreso_registrado_por_id,
        observaciones=m.observaciones,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def a_entidad_registro_acceso(m: EventoRegistroAccesoModel) -> RegistroAccesoEvento:
    return RegistroAccesoEvento(
        id=str(m.id),
        evento_id=str(m.evento_id),
        invitado_id=str(m.invitado_id) if m.invitado_id else None,
        zona_id=str(m.zona_id) if m.zona_id else None,
        registrado_por_id=m.registrado_por_id,
        fecha_ingreso=m.created_at,
        resultado=ResultadoControlEntrada(m.resultado) if m.resultado in [r.value for r in ResultadoControlEntrada] else ResultadoControlEntrada.NO_VALIDA,
        observaciones=m.observaciones,
    )
