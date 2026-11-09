"""
Casos de uso para el Registro de Campos autorizados y personalizados (O44 - E5).
"""
import re

from apps.carnetizacion.domain.entities.campo_credencial import (
    CAMPOS_AUTORIZADOS_EXPEDIENTE,
    CampoCredencial,
)
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from core.domain.exceptions import ValidationError


def listar_campos_credencial_uc(
    repo: RepoCarnetizacion,
    tipo_credencial: str = "trabajador",
) -> list[CampoCredencial]:
    """
    Retorna la lista completa de campos disponibles para el tipo de credencial especificado.
    Incluye los campos autorizados del expediente y los campos personalizados registrados.
    """
    return repo.listar_campos_credencial(tipo_credencial=tipo_credencial)


def crear_campo_personalizado_uc(
    repo: RepoCarnetizacion,
    codigo: str,
    etiqueta: str,
    grupo: str = "personalizado",
    tipo_credencial: str = "todos",
    sensible: bool = False,
    descripcion: str = "",
    valor_ejemplo: str = "",
) -> CampoCredencial:
    """
    Registra un campo personalizado validando que su slug no colisione con campos existentes.
    """
    slug = codigo.strip().lower()
    if not re.match(r"^[a-z0-9_]{2,40}$", slug):
        raise ValidationError(
            "El código del campo debe contener solo letras minúsculas, números y guiones bajos (2 a 40 caracteres)."
        )

    # Validar que no sobreescriba un campo protegido del expediente
    codigos_expediente = {c.codigo for c in CAMPOS_AUTORIZADOS_EXPEDIENTE}
    if slug in codigos_expediente:
        raise ValidationError(
            f"El código '{slug}' es un campo reservado del expediente institucional."
        )

    if not etiqueta.strip():
        raise ValidationError("La etiqueta del campo es obligatoria.")

    return repo.crear_campo_personalizado(
        codigo=slug,
        etiqueta=etiqueta.strip(),
        grupo=grupo.strip() or "personalizado",
        tipo_credencial=tipo_credencial.strip() or "todos",
        sensible=sensible,
        descripcion=descripcion.strip(),
        valor_ejemplo=valor_ejemplo.strip(),
    )


def eliminar_campo_personalizado_uc(
    repo: RepoCarnetizacion,
    codigo: str,
) -> bool:
    """
    Elimina un campo personalizado. Impide eliminar campos nativos del expediente.
    """
    slug = codigo.strip().lower()
    codigos_expediente = {c.codigo for c in CAMPOS_AUTORIZADOS_EXPEDIENTE}
    if slug in codigos_expediente:
        raise ValidationError("No se puede eliminar un campo reservado del expediente.")

    return repo.eliminar_campo_personalizado(slug)
