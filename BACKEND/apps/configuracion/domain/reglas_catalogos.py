"""
Dominio de Reglas de Catálogos (A5).

Gobierna las marcas y reglas del sistema sobre tablas maestras:
1. Parentescos: aplica_familiar (Permitido para familiares).
2. Motivos de movimiento: asignación a categorías (INGRESO, TRASLADO, EGRESO, etc.),
   protegiendo las categorías requeridas del sistema y los motivos reservados.
3. Tipos de nómina: es_activo (Nómina activa) y requiere_codig (Requiere código).

Puro: sin Django ni DRF (regla B1).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from core.domain.categorias_motivo import (
    CategoriaMotivo,
    MOTIVO_SISTEMA_JUBILACION,
    MOTIVO_SISTEMA_PENSION_INVALIDEZ,
    MOTIVO_SISTEMA_PENSION_SOBREVIVIENTE,
    normalizar_nombre_motivo,
)
from core.domain.exceptions import ValidationError

MODULO_AUDITORIA_CONFIGURACION = 'configuracion'
RECURSO_REGLAS_PARENTESCO = 'regla_parentesco'
RECURSO_REGLAS_MOTIVO = 'regla_motivo_movimiento'
RECURSO_REGLAS_NOMINA = 'regla_tipo_nomina'

ACCION_PARENTESCO_ACTUALIZADO = 'PARENTESCO_ACTUALIZADO'
ACCION_PARENTESCO_CREADO = 'PARENTESCO_CREADO'
ACCION_PARENTESCO_ELIMINADO = 'PARENTESCO_ELIMINADO'
ACCION_MOTIVO_CATEGORIA_CAMBIADA = 'MOTIVO_CATEGORIA_CAMBIADA'
ACCION_MOTIVO_CREADO = 'MOTIVO_MOVIMIENTO_CREADO'
ACCION_MOTIVO_ACTUALIZADO = 'MOTIVO_MOVIMIENTO_ACTUALIZADO'
ACCION_MOTIVO_ELIMINADO = 'MOTIVO_MOVIMIENTO_ELIMINADO'
ACCION_NOMINA_ACTUALIZADA = 'TIPO_NOMINA_ACTUALIZADA'
ACCION_NOMINA_CREADA = 'TIPO_NOMINA_CREADA'
ACCION_NOMINA_ELIMINADA = 'TIPO_NOMINA_ELIMINADA'

# Catálogos protegidos (O36): su nombre lo usa el sistema y no se renombra.
PARENTESCO_RESERVADO = 'HIJO (A)'
NOMINAS_SISTEMA_RESERVADAS: frozenset[str] = frozenset({
    'JUBILADO',
    'PENSIONADO',
    'PENSIONADO SOBREVIVIENTE',
})

LARGO_MAXIMO_PARENTESCO = 100
LARGO_MAXIMO_NOMINA = 50
LARGO_MINIMO_NOMBRE = 2

# Motivos del sistema que no se pueden mover ni renombrar
MOTIVOS_SISTEMA_RESERVADOS: frozenset[str] = frozenset({
    MOTIVO_SISTEMA_JUBILACION.upper(),
    MOTIVO_SISTEMA_PENSION_INVALIDEZ.upper(),
    MOTIVO_SISTEMA_PENSION_SOBREVIVIENTE.upper(),
})


@dataclass(frozen=True)
class ReglaParentesco:
    id: int
    descripcion: str
    aplica_familiar: bool


@dataclass(frozen=True)
class CategoriaMotivoItem:
    id: int
    categoria: str


@dataclass(frozen=True)
class ReglaMotivo:
    id: int
    movimiento: str
    categoria_id: int
    categoria_nombre: str
    es_reservado: bool
    activo: bool = True


@dataclass(frozen=True)
class ReglaNomina:
    id: int
    nomina: str
    requiere_codig: bool
    es_activo: bool


def es_motivo_reservado(nombre_movimiento: str, categoria_nombre: str) -> bool:
    """Un motivo es reservado si tiene el nombre exacto de un motivo del sistema en PASE A PASIVO."""
    nom = (nombre_movimiento or '').strip().upper()
    cat = (categoria_nombre or '').strip().upper()
    return cat == CategoriaMotivo.PASE_A_PASIVO.value and nom in MOTIVOS_SISTEMA_RESERVADOS


def validar_cambio_categoria_motivo(
    motivo_actual: ReglaMotivo,
    nueva_categoria: CategoriaMotivoItem,
    conteo_motivos_en_categoria_origen: int,
) -> None:
    """
    Reglas de negocio:
    1. Bloquear mover los motivos que el sistema asigna solo (MOTIVO_SISTEMA_* en PASE A PASIVO).
    2. Bloquear dejar sin motivos una categoría que el sistema necesita.
    """
    if motivo_actual.categoria_id == nueva_categoria.id:
        return

    # 1. Protección de motivos reservados del sistema
    if es_motivo_reservado(motivo_actual.movimiento, motivo_actual.categoria_nombre):
        raise ValidationError(
            f'El motivo «{motivo_actual.movimiento}» es un motivo reservado del sistema '
            'para el pase a condición de pasivo y no puede ser reasignado a otra categoría.',
            campo='categoria_id',
        )

    # 2. Bloquear dejar sin motivos una categoría del sistema
    nombres_categorias_sistema = {c.value for c in CategoriaMotivo}
    if (
        motivo_actual.categoria_nombre.upper() in nombres_categorias_sistema
        and conteo_motivos_en_categoria_origen <= 1
    ):
        raise ValidationError(
            f'No es posible transferir este motivo porque la categoría '
            f'«{motivo_actual.categoria_nombre}» es requerida por el sistema '
            'y quedaría sin ningún motivo disponible.',
            campo='categoria_id',
        )


def preparar_nuevo_motivo(movimiento: str, categoria_id: int) -> tuple[str, int]:
    """Valida y normaliza el texto y la categoría para dar de alta un motivo nuevo."""
    if not categoria_id:
        raise ValidationError('Debe indicar la categoría a la que pertenecerá el motivo.', campo='categoria_id')
    nombre_limpio = normalizar_nombre_motivo(movimiento, campo='movimiento')
    return nombre_limpio, categoria_id


def validar_edicion_motivo(
    motivo_actual: ReglaMotivo,
    nuevo_movimiento: str | None,
    nueva_categoria: CategoriaMotivoItem | None,
    nuevo_activo: bool | None,
    conteo_activos_origen: int,
) -> None:
    """Reglas de validación para edición de nombre, categoría y/o estado de un motivo."""
    # 1. Protección de motivos reservados del sistema
    if motivo_actual.es_reservado:
        if nuevo_movimiento is not None and nuevo_movimiento.strip().upper() != motivo_actual.movimiento.strip().upper():
            raise ValidationError(
                f'El motivo «{motivo_actual.movimiento}» es un motivo reservado del sistema y no puede ser renombrado.',
                campo='movimiento',
            )
        if nueva_categoria is not None and nueva_categoria.id != motivo_actual.categoria_id:
            raise ValidationError(
                f'El motivo «{motivo_actual.movimiento}» es un motivo reservado del sistema para pase a pasivo '
                'y no puede ser reasignado a otra categoría.',
                campo='categoria_id',
            )
        if nuevo_activo is False:
            raise ValidationError(
                f'El motivo «{motivo_actual.movimiento}» es un motivo reservado del sistema y no puede ser desactivado.',
                campo='activo',
            )

    # 2. Si se desactiva, validar que la categoría requerida no quede sin motivos activos
    nombres_categorias_sistema = {c.value for c in CategoriaMotivo}
    if (
        nuevo_activo is False
        and motivo_actual.activo is True
        and motivo_actual.categoria_nombre.upper() in nombres_categorias_sistema
        and conteo_activos_origen <= 1
    ):
        raise ValidationError(
            f'No es posible desactivar este motivo porque la categoría «{motivo_actual.categoria_nombre}» '
            'es requerida por el sistema y quedaría sin ningún motivo activo disponible.',
            campo='activo',
        )

    # 3. Si se cambia de categoría
    if nueva_categoria is not None and nueva_categoria.id != motivo_actual.categoria_id:
        validar_cambio_categoria_motivo(motivo_actual, nueva_categoria, conteo_activos_origen)


def validar_eliminacion_motivo(
    motivo_actual: ReglaMotivo,
    tiene_movimientos_asociados: bool,
) -> None:
    """Reglas de validación para eliminación física de un motivo."""
    if motivo_actual.es_reservado:
        raise ValidationError(
            f'El motivo «{motivo_actual.movimiento}» es un motivo reservado del sistema y no puede ser eliminado.',
            campo='motivo',
        )
    if tiene_movimientos_asociados:
        raise ValidationError(
            'No es posible eliminar el motivo porque tiene movimientos asociados en el historial. '
            'Puede desactivarlo en su lugar.',
            campo='motivo',
        )


def normalizar_nombre_catalogo(valor: str, *, campo: str, maximo: int) -> str:
    """Normaliza espacios y valida largo de parentescos y nóminas (O36)."""
    nombre = ' '.join((valor or '').split())
    if not nombre:
        raise ValidationError('El nombre es obligatorio.', campo=campo)
    if len(nombre) < LARGO_MINIMO_NOMBRE:
        raise ValidationError(
            f'El nombre debe tener al menos {LARGO_MINIMO_NOMBRE} caracteres.', campo=campo,
        )
    if len(nombre) > maximo:
        raise ValidationError(
            f'El nombre no puede superar {maximo} caracteres.', campo=campo,
        )
    return nombre


def _mismo_nombre(a: str, b: str) -> bool:
    return ' '.join((a or '').split()).upper() == ' '.join((b or '').split()).upper()


def preparar_nuevo_parentesco(descripcion: str, aplica_familiar: bool) -> tuple[str, bool]:
    nombre = normalizar_nombre_catalogo(
        descripcion, campo='descripcion', maximo=LARGO_MAXIMO_PARENTESCO,
    )
    return nombre, bool(aplica_familiar)


def validar_edicion_parentesco(actual: ReglaParentesco, nueva_descripcion: str | None) -> None:
    """El parentesco reservado HIJO (A) gobierna la cédula del hijo: no se renombra."""
    if nueva_descripcion is None:
        return
    if _mismo_nombre(actual.descripcion, PARENTESCO_RESERVADO) and not _mismo_nombre(
        actual.descripcion, nueva_descripcion,
    ):
        raise ValidationError(
            f'El parentesco «{actual.descripcion}» es reservado del sistema y no puede renombrarse.',
            campo='descripcion',
        )


def validar_eliminacion_parentesco(actual: ReglaParentesco, tiene_referencias: bool) -> None:
    if _mismo_nombre(actual.descripcion, PARENTESCO_RESERVADO):
        raise ValidationError(
            f'El parentesco «{actual.descripcion}» es reservado del sistema y no puede eliminarse.',
            campo='descripcion',
        )
    if tiene_referencias:
        raise ValidationError(
            'No es posible eliminar el parentesco porque está asignado a familiares registrados.',
            campo='descripcion',
        )


def preparar_nueva_nomina(
    nomina: str, es_activo: bool, requiere_codig: bool,
) -> tuple[str, bool, bool]:
    nombre = normalizar_nombre_catalogo(nomina, campo='nomina', maximo=LARGO_MAXIMO_NOMINA)
    return nombre, bool(es_activo), bool(requiere_codig)


def validar_edicion_nomina(actual: ReglaNomina, nueva_nomina: str | None) -> None:
    """Las nóminas JUBILADO/PENSIONADO/PENSIONADO SOBREVIVIENTE no se renombran."""
    if nueva_nomina is None:
        return
    if actual.nomina.strip().upper() in NOMINAS_SISTEMA_RESERVADAS and not _mismo_nombre(
        actual.nomina, nueva_nomina,
    ):
        raise ValidationError(
            f'La nómina «{actual.nomina}» es reservada del sistema y no puede renombrarse.',
            campo='nomina',
        )


def validar_eliminacion_nomina(actual: ReglaNomina, tiene_referencias: bool) -> None:
    if actual.nomina.strip().upper() in NOMINAS_SISTEMA_RESERVADAS:
        raise ValidationError(
            f'La nómina «{actual.nomina}» es reservada del sistema y no puede eliminarse.',
            campo='nomina',
        )
    if tiene_referencias:
        raise ValidationError(
            'No es posible eliminar la nómina porque está asignada a cargos o procesos.',
            campo='nomina',
        )
