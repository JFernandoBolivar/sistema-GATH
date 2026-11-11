"""Casos de uso de credenciales externas y temporales (O45-A)."""
from datetime import datetime
from typing import Any

from apps.carnetizacion.domain.entities.credencial_externa import CredencialExterna
from apps.carnetizacion.domain.ports.repo_credenciales_externas import (
    RepoCredencialesExternas,
)


def listar_credenciales_externas(
    repo: RepoCredencialesExternas,
    *,
    tipo: str | None = None,
    grupo: str | None = None,
    estado: str | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
) -> list[CredencialExterna]:
    return repo.listar(tipo=tipo, grupo=grupo, estado=estado, desde=desde, hasta=hasta)


def crear_credencial_externa(
    repo: RepoCredencialesExternas,
    *,
    tipo_codigo: str,
    grupo_esperado: str | None,
    nombre: str,
    documento: str,
    motivo: str,
    vigencia_desde: datetime,
    vigencia_hasta: datetime | None = None,
    correo: str = '',
    empresa: str = '',
    contrato: str = '',
    persona_visitada: str = '',
    empleado_cedula: str | None = None,
    observaciones: str = '',
    creado_por: Any | None = None,
) -> CredencialExterna:
    return repo.crear(
        tipo_codigo=tipo_codigo,
        grupo_esperado=grupo_esperado,
        nombre=nombre,
        documento=documento,
        motivo=motivo,
        vigencia_desde=vigencia_desde,
        vigencia_hasta=vigencia_hasta,
        correo=correo,
        empresa=empresa,
        contrato=contrato,
        persona_visitada=persona_visitada,
        empleado_cedula=empleado_cedula,
        observaciones=observaciones,
        creado_por=creado_por,
    )


def devolver_credencial_externa(
    repo: RepoCredencialesExternas, credencial_id: str
) -> CredencialExterna:
    return repo.devolver(credencial_id)


def anular_credencial_externa(
    repo: RepoCredencialesExternas, credencial_id: str
) -> CredencialExterna:
    return repo.anular(credencial_id)


def generar_pdf_credencial_externa(
    repo: RepoCredencialesExternas, credencial_id: str
) -> bytes:
    return repo.generar_pdf(credencial_id)


def generar_pdf_lote_credenciales(
    repo: RepoCredencialesExternas, ids: list[str]
) -> bytes:
    return repo.generar_pdf_lote(ids)


def enviar_credencial_externa(
    repo: RepoCredencialesExternas,
    credencial_id: str,
    destinatario: str | None = None,
) -> bool:
    return repo.enviar_correo(credencial_id, destinatario=destinatario)
