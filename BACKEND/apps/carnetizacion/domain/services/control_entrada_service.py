"""
Servicio de Dominio para Validación y Control de Entrada con QR a Eventos (Regla B1, O45-B).
Procesa credenciales escaneadas o códigos de invitado y emite una de las tres respuestas canónicas:
1. Acceso permitido (registra fecha y hora)
2. Ya ingresó (con hora formateada)
3. No válida (anulada, vencida, otro evento o zona no autorizada)
"""
from datetime import datetime
from typing import Any

from apps.carnetizacion.domain.entities.evento import (
    EstadoEvento,
    EstadoInvitado,
    Evento,
    EventoInvitado,
    RegistroAccesoEvento,
    ResolucionCarnetInstitucional,
    ResultadoCheckIn,
    ResultadoControlEntrada,
)
from apps.carnetizacion.domain.ports.repo_eventos import RepoEventosPort


def validar_y_registrar_entrada_evento(
    hash_o_codigo: str,
    evento_id: str | None,
    zona_id: str | None,
    registrado_por_id: int | None,
    repo: RepoEventosPort,
    ahora: datetime | None = None,
) -> ResultadoCheckIn:
    limpio = (hash_o_codigo or "").strip()

    if not limpio:
        return ResultadoCheckIn(
            resultado=ResultadoControlEntrada.NO_VALIDA,
            mensaje="Código o QR de credencial no proporcionado.",
        )

    # 1. Buscar invitado
    invitado, evento = repo.buscar_invitado_por_hash_o_codigo(limpio)
    if not invitado or not evento:
        # Los trabajadores entran con su carnet institucional si están invitados al evento.
        resolucion, invitado, evento = repo.resolver_carnet_institucional(limpio, evento_id)
        if resolucion == ResolucionCarnetInstitucional.NO_INVITADO:
            return ResultadoCheckIn(
                resultado=ResultadoControlEntrada.NO_VALIDA,
                mensaje="No está en la lista de invitados.",
            )
        if resolucion in (ResolucionCarnetInstitucional.ANULADO, ResolucionCarnetInstitucional.VENCIDO):
            estado = "anulado" if resolucion == ResolucionCarnetInstitucional.ANULADO else "vencido"
            return ResultadoCheckIn(
                resultado=ResultadoControlEntrada.NO_VALIDA,
                mensaje=f"No válida: Este carnet institucional está {estado}.",
            )
        if resolucion != ResolucionCarnetInstitucional.INVITADO or not invitado or not evento:
            return ResultadoCheckIn(
                resultado=ResultadoControlEntrada.NO_VALIDA,
                mensaje="Credencial no encontrada o inexistente.",
            )

    tz = evento.fecha_fin.tzinfo if evento.fecha_fin else None
    if ahora is None:
        momento = datetime.now(tz) if tz else datetime.now()
    else:
        momento = ahora
        if tz and momento.tzinfo is None:
            momento = momento.replace(tzinfo=tz)

    # 2. Validar que la credencial pertenezca al evento actual si se especificó evento_id
    if evento_id and str(evento.id) != str(evento_id):
        repo.registrar_bitacora_acceso(
            RegistroAccesoEvento(
                id="",
                evento_id=evento.id,
                invitado_id=invitado.id,
                zona_id=zona_id,
                registrado_por_id=registrado_por_id,
                fecha_ingreso=momento,
                resultado=ResultadoControlEntrada.NO_VALIDA,
                observaciones=f"Credencial pertenece a otro evento ({evento.nombre})",
            )
        )
        return ResultadoCheckIn(
            resultado=ResultadoControlEntrada.NO_VALIDA,
            mensaje=f"No válida: La credencial pertenece a otro evento ('{evento.nombre}').",
            invitado_id=invitado.id,
            nombre_completo=invitado.nombre_completo,
            codigo_credencial=invitado.codigo_credencial,
        )

    # 3. Validar estado de la credencial / invitado
    if invitado.estado == EstadoInvitado.ANULADO:
        repo.registrar_bitacora_acceso(
            RegistroAccesoEvento(
                id="",
                evento_id=evento.id,
                invitado_id=invitado.id,
                zona_id=zona_id,
                registrado_por_id=registrado_por_id,
                fecha_ingreso=momento,
                resultado=ResultadoControlEntrada.NO_VALIDA,
                observaciones="Credencial anulada",
            )
        )
        return ResultadoCheckIn(
            resultado=ResultadoControlEntrada.NO_VALIDA,
            mensaje="No válida: Esta credencial ha sido anulada.",
            invitado_id=invitado.id,
            nombre_completo=invitado.nombre_completo,
            codigo_credencial=invitado.codigo_credencial,
        )

    # 4. Validar vigencia del evento
    if not evento.esta_vigente(momento):
        repo.registrar_bitacora_acceso(
            RegistroAccesoEvento(
                id="",
                evento_id=evento.id,
                invitado_id=invitado.id,
                zona_id=zona_id,
                registrado_por_id=registrado_por_id,
                fecha_ingreso=momento,
                resultado=ResultadoControlEntrada.NO_VALIDA,
                observaciones="Evento finalizado o credencial vencida",
            )
        )
        return ResultadoCheckIn(
            resultado=ResultadoControlEntrada.NO_VALIDA,
            mensaje="No válida: El evento ya ha finalizado o la credencial está vencida.",
            invitado_id=invitado.id,
            nombre_completo=invitado.nombre_completo,
            codigo_credencial=invitado.codigo_credencial,
        )

    # 5. Validar zona de acceso si el punto de control exige zona específica
    if zona_id and str(invitado.zona_id) != str(zona_id):
        # Verificar si la zona del invitado es de acceso global (ej. "Todas las áreas")
        zona_invitado = repo.obtener_zona(invitado.zona_id)
        es_global = zona_invitado and "todas" in zona_invitado.nombre.lower()
        if not es_global:
            repo.registrar_bitacora_acceso(
                RegistroAccesoEvento(
                    id="",
                    evento_id=evento.id,
                    invitado_id=invitado.id,
                    zona_id=zona_id,
                    registrado_por_id=registrado_por_id,
                    fecha_ingreso=momento,
                    resultado=ResultadoControlEntrada.NO_VALIDA,
                    observaciones=f"Zona no autorizada (Asignada: {zona_invitado.nombre if zona_invitado else 'Desconocida'})",
                )
            )
            return ResultadoCheckIn(
                resultado=ResultadoControlEntrada.NO_VALIDA,
                mensaje=f"No válida: Zona no autorizada. Esta credencial tiene acceso a '{zona_invitado.nombre if zona_invitado else 'otra zona'}'.",
                invitado_id=invitado.id,
                nombre_completo=invitado.nombre_completo,
                codigo_credencial=invitado.codigo_credencial,
            )

    # Resolver nombres legibles para la respuesta
    categoria = repo.obtener_categoria(invitado.categoria_id)
    zona = repo.obtener_zona(invitado.zona_id)
    cat_nombre = categoria.nombre if categoria else ""
    zona_nombre = zona.nombre if zona else ""

    # 6. Validar si ya ingresó
    if invitado.ya_ingreso():
        hora_txt = ""
        if invitado.fecha_ingreso:
            hora_txt = invitado.fecha_ingreso.strftime("%I:%M %p").lstrip("0")
        
        repo.registrar_bitacora_acceso(
            RegistroAccesoEvento(
                id="",
                evento_id=evento.id,
                invitado_id=invitado.id,
                zona_id=zona_id,
                registrado_por_id=registrado_por_id,
                fecha_ingreso=momento,
                resultado=ResultadoControlEntrada.YA_INGRESO,
                observaciones=f"Reintento de ingreso. Ingreso previo a las {hora_txt}",
            )
        )
        return ResultadoCheckIn(
            resultado=ResultadoControlEntrada.YA_INGRESO,
            mensaje=f"Ya ingresó a las {hora_txt}" if hora_txt else "Ya ingresó anteriormente.",
            invitado_id=invitado.id,
            nombre_completo=invitado.nombre_completo,
            documento_identidad=invitado.documento_identidad,
            organizacion=invitado.organizacion,
            categoria_nombre=cat_nombre,
            zona_nombre=zona_nombre,
            mesa=invitado.mesa,
            codigo_credencial=invitado.codigo_credencial,
            fecha_ingreso=invitado.fecha_ingreso,
            hora_ingreso_formateada=hora_txt,
        )

    # 7. Acceso permitido: Registrar ingreso
    invitado_actualizado = repo.registrar_ingreso(invitado.id, registrado_por_id, zona_id)
    hora_txt = momento.strftime("%I:%M %p").lstrip("0")

    repo.registrar_bitacora_acceso(
        RegistroAccesoEvento(
            id="",
            evento_id=evento.id,
            invitado_id=invitado.id,
            zona_id=zona_id,
            registrado_por_id=registrado_por_id,
            fecha_ingreso=momento,
            resultado=ResultadoControlEntrada.ACCESO_PERMITIDO,
            observaciones="Primer ingreso exitoso",
        )
    )

    return ResultadoCheckIn(
        resultado=ResultadoControlEntrada.ACCESO_PERMITIDO,
        mensaje="Acceso permitido",
        invitado_id=invitado.id,
        nombre_completo=invitado.nombre_completo,
        documento_identidad=invitado.documento_identidad,
        organizacion=invitado.organizacion,
        categoria_nombre=cat_nombre,
        zona_nombre=zona_nombre,
        mesa=invitado.mesa,
        codigo_credencial=invitado.codigo_credencial,
        fecha_ingreso=momento,
        hora_ingreso_formateada=hora_txt,
    )
