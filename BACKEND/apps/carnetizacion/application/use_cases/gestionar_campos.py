"""
Casos de uso para el Registro de Campos autorizados y personalizados (O44 - E5).
"""
import re

from apps.carnetizacion.domain.entities.campo_credencial import (
    CAMPOS_AUTORIZADOS_EXPEDIENTE,
    ORIGENES_CAMPO_PERSONALIZADO,
    CampoCredencial,
)
from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from core.domain.exceptions import ValidationError


def validar_origen_campo(origen: str) -> str:
    """El origen debe ser uno de la lista cerrada de datos del expediente."""
    limpio = (origen or "").strip()
    if limpio not in ORIGENES_CAMPO_PERSONALIZADO:
        raise ValidationError(
            "Elija el origen del dato de la lista: " + ", ".join(ORIGENES_CAMPO_PERSONALIZADO.values()) + ".",
            campo="origen",
        )
    return limpio


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
    origen: str = "",
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

    origen_valido = validar_origen_campo(origen)

    return repo.crear_campo_personalizado(
        codigo=slug,
        etiqueta=etiqueta.strip(),
        grupo=grupo.strip() or "personalizado",
        tipo_credencial=tipo_credencial.strip() or "todos",
        sensible=sensible,
        descripcion=descripcion.strip(),
        valor_ejemplo=valor_ejemplo.strip(),
        origen=origen_valido,
    )


def actualizar_campo_personalizado_uc(
    repo: RepoCarnetizacion,
    codigo: str,
    etiqueta: str,
    origen: str,
    descripcion: str = "",
    valor_ejemplo: str = "",
    sensible: bool = False,
) -> CampoCredencial:
    """Edita un campo personalizado (etiqueta, origen del dato, ejemplo). El código no cambia."""
    slug = codigo.strip().lower()
    codigos_expediente = {c.codigo for c in CAMPOS_AUTORIZADOS_EXPEDIENTE}
    if slug in codigos_expediente:
        raise ValidationError("No se puede editar un campo reservado del expediente.")
    if not etiqueta.strip():
        raise ValidationError("La etiqueta del campo es obligatoria.", campo="etiqueta")
    return repo.actualizar_campo_personalizado(
        codigo=slug,
        etiqueta=etiqueta.strip(),
        origen=validar_origen_campo(origen),
        descripcion=descripcion.strip(),
        valor_ejemplo=valor_ejemplo.strip(),
        sensible=sensible,
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
