"""Catálogo puro de procesos que pueden originar un documento digital.

El proceso se elige al diseñar la plantilla y determina qué variables del
catálogo pueden utilizarse. No depende de Django ni de otras aplicaciones.
"""
from dataclasses import dataclass

from core.domain.exceptions import ValidationError

from apps.documentos.domain.services.variables_documento import (
    G_CONTACTO,
    G_DIR,
    G_DOC,
    G_IDENT,
    G_LAB,
    G_COL,
    G_MOV,
    G_SALUD,
    G_TALLAS,
)

PROCESO_BAJO_DEMANDA = 'bajo_demanda'
GRUPO_INGRESO = 'ingreso'
GRUPO_PUNTO_CUENTA = 'punto_cuenta'
GRUPO_MOVIMIENTO = 'movimiento'
GRUPO_BAJO_DEMANDA = 'bajo_demanda'

_GRUPOS_IDENTIDAD = (G_IDENT, G_CONTACTO, G_DIR, G_LAB, G_DOC, G_SALUD, G_TALLAS, G_COL)
_GRUPOS_LABORAL = (G_IDENT, G_LAB, G_DOC, G_MOV)
_GRUPOS_BAJO_DEMANDA = (G_IDENT, G_CONTACTO, G_DIR, G_LAB, G_DOC, G_COL)


@dataclass(frozen=True)
class ProcesoDocumento:
    codigo: str
    etiqueta: str
    descripcion: str
    grupo: str
    grupos_variables: tuple[str, ...]

    @property
    def etiqueta_corta(self) -> str:
        """«cambio de oficina» a partir de «Punto de Cuenta: cambio de oficina»."""
        return self.etiqueta.split(': ', 1)[-1]

    def a_dict(self) -> dict:
        return {
            'codigo': self.codigo,
            'etiqueta': self.etiqueta,
            'descripcion': self.descripcion,
            'grupo': self.grupo,
            'grupos_variables': list(self.grupos_variables),
        }


CATALOGO_PROCESOS: tuple[ProcesoDocumento, ...] = (
    ProcesoDocumento(
        'ingreso_ventana2', 'Ingreso por Ventana 2',
        'Documentos que completa el postulante durante la Ventana 2.',
        GRUPO_INGRESO, _GRUPOS_IDENTIDAD,
    ),
    ProcesoDocumento(
        'ingreso_contratacion', 'Ingreso por contratación',
        'Documentos que se generan al contratar a un postulante.',
        GRUPO_INGRESO, _GRUPOS_IDENTIDAD,
    ),
    ProcesoDocumento(
        'punto_cuenta:ingreso_postulacion', 'Punto de Cuenta: ingreso por postulación',
        'Punto de Cuenta para el ingreso de un postulante.',
        GRUPO_PUNTO_CUENTA, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'punto_cuenta:cambio_oficina', 'Punto de Cuenta: cambio de oficina',
        'Punto de Cuenta por cambio de oficina o dependencia.',
        GRUPO_PUNTO_CUENTA, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'punto_cuenta:cambio_nivel', 'Punto de Cuenta: cambio de nivel',
        'Punto de Cuenta por cambio de nivel.',
        GRUPO_PUNTO_CUENTA, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'punto_cuenta:cambio_division', 'Punto de Cuenta: cambio de división',
        'Punto de Cuenta por cambio de división.',
        GRUPO_PUNTO_CUENTA, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'punto_cuenta:cambio_cargo_misma_oficina', 'Punto de Cuenta: cambio de cargo en la misma oficina',
        'Punto de Cuenta por cambio de cargo sin cambio de oficina.',
        GRUPO_PUNTO_CUENTA, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'punto_cuenta:egreso_activo', 'Punto de Cuenta: egreso de personal activo',
        'Punto de Cuenta por egreso de personal activo.',
        GRUPO_PUNTO_CUENTA, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'punto_cuenta:pase_a_pasivo', 'Punto de Cuenta: pase a pasivo',
        'Punto de Cuenta por pase de personal activo a pasivo.',
        GRUPO_PUNTO_CUENTA, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'punto_cuenta:encargaduria_prestamo', 'Punto de Cuenta: encargaduría o préstamo de cargo',
        'Punto de Cuenta por encargaduría o préstamo de un cargo.',
        GRUPO_PUNTO_CUENTA, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'punto_cuenta:cambio_estatus', 'Punto de Cuenta: cambio de estatus',
        'Punto de Cuenta por cambio de estatus del trabajador.',
        GRUPO_PUNTO_CUENTA, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'movimiento:ingreso', 'Movimiento: ingreso',
        'Documento de un movimiento de ingreso.',
        GRUPO_MOVIMIENTO, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'movimiento:traslado', 'Movimiento: traslado',
        'Documento de un movimiento de traslado.',
        GRUPO_MOVIMIENTO, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'movimiento:egreso', 'Movimiento: egreso',
        'Documento de un movimiento de egreso.',
        GRUPO_MOVIMIENTO, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        'movimiento:cambio_de_estatus', 'Movimiento: cambio de estatus',
        'Documento de un movimiento de cambio de estatus.',
        GRUPO_MOVIMIENTO, _GRUPOS_LABORAL,
    ),
    ProcesoDocumento(
        PROCESO_BAJO_DEMANDA, 'Bajo demanda',
        'Documento genérico generado a solicitud de un usuario autorizado.',
        GRUPO_BAJO_DEMANDA, _GRUPOS_BAJO_DEMANDA,
    ),
)

PROCESOS_POR_CODIGO = {p.codigo: p for p in CATALOGO_PROCESOS}
CODIGOS_PROCESOS = frozenset(PROCESOS_POR_CODIGO)


def obtener_proceso(codigo: str | None) -> ProcesoDocumento | None:
    return PROCESOS_POR_CODIGO.get(codigo or '')


def validar_proceso(proceso: str | None, *, defecto: str | None = None) -> str:
    codigo = proceso or defecto
    if codigo not in PROCESOS_POR_CODIGO:
        raise ValidationError(
            f'Proceso de documento desconocido: «{codigo or ""}».',
            campo='proceso',
        )
    return codigo


def etiqueta_proceso(codigo: str | None) -> str:
    proceso = obtener_proceso(codigo)
    return proceso.etiqueta if proceso else (codigo or '')


def procesos_para_interfaz() -> list[dict]:
    return [p.a_dict() for p in CATALOGO_PROCESOS]


def procesos_de_grupo(grupo: str | None) -> tuple[ProcesoDocumento, ...]:
    if not grupo:
        return CATALOGO_PROCESOS
    return tuple(p for p in CATALOGO_PROCESOS if p.grupo == grupo)
