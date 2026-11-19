"""Instantánea de la ficha aprobada en un proceso de fe de vida.

La planilla se genera desde esta instantánea, no desde el expediente actual: así muestra exactamente
los datos aprobados en ese proceso aunque el expediente se modifique después. En constancias anteriores
a esta función la instantánea se construye en la primera descarga (mejor esfuerzo: ficha actual + acta).
"""
from datetime import datetime

from django.utils import timezone

from apps.fe_de_vida.infrastructure.adaptadores_autogestion import RepoCambiosActaORM
from apps.fe_de_vida.infrastructure.models.solicitud_models import (
    ConstanciaFeDeVidaModel,
    SolicitudFeDeVidaModel,
)
from apps.fe_de_vida.infrastructure.repositories.lector_ficha_pasivo_orm import LectorFichaPasivoORM
from core.domain.exceptions import ConflictError, NotFoundError


def _texto(valor) -> str:
    if valor is None:
        return ''
    return str(valor).strip()


def _fecha(valor) -> str:
    if valor in (None, ''):
        return ''
    if isinstance(valor, datetime):
        return valor.isoformat()
    return str(valor)


def _cambios_por_campo(cambios) -> dict[tuple[str, str], object]:
    """Solo los cambios de campos únicos; las altas de familiares/contactos ya están en la ficha."""
    return {
        (c.entidad_destino, c.campo): c.valor_propuesto
        for c in cambios
        if c.accion != 'CREAR' and c.entidad_destino != 'familiar'
    }


def _empleado(ficha: dict, cambios: dict[tuple[str, str], object]) -> dict:
    empleado = dict(ficha.get('empleado') or {})
    for campo in (
        'nombres', 'apellidos', 'fecha_nacimiento', 'correo', 'telefono_movil', 'telefono_habitacion',
    ):
        if ('employee', campo) in cambios:
            empleado[campo] = cambios[('employee', campo)]
    return empleado


def _vivienda(ficha: dict, cambios: dict[tuple[str, str], object]) -> dict:
    vivienda = dict((ficha.get('empleado') or {}).get('datos_vivienda') or {})
    for campo in (
        'pais_id', 'ciudad_region', 'estado_id', 'municipio_id', 'parroquia_id',
        'codigo_postal_id', 'direccion_exacta', 'condicion_vivienda_id',
    ):
        if ('datos_vivienda', campo) in cambios:
            vivienda[campo] = cambios[('datos_vivienda', campo)]
    return vivienda


def _familiares(ficha: dict) -> list[dict]:
    return [
        {
            'nombres': ' '.join(
                parte for parte in (
                    _texto(f.get('primer_nombre')), _texto(f.get('segundo_nombre')),
                    _texto(f.get('primer_apellido')), _texto(f.get('segundo_apellido')),
                ) if parte
            ),
            'cedula': _texto(f.get('cedula_familiar')),
            'parentesco': _texto(f.get('parentesco_nombre')),
            'fecha_nacimiento': _fecha(f.get('fecha_nacimiento')),
            'sexo': _texto(f.get('sexo_nombre')),
        }
        for f in ficha.get('familiares') or []
    ]


def _contactos(ficha: dict) -> list[dict]:
    return [
        {
            'nombres': ' '.join(
                parte for parte in (_texto(c.get('nombres')), _texto(c.get('apellidos'))) if parte
            ),
            'parentesco': _texto(c.get('relacion_nombre')),
            'telefono': _texto(c.get('telefono')),
        }
        for c in (ficha.get('empleado') or {}).get('contacto_emergencia') or []
    ]


def construir_datos_planilla(solicitud_id: str) -> dict:
    """Instantánea de la ficha aprobada; exige que la solicitud esté VALIDADA."""
    solicitud = (
        SolicitudFeDeVidaModel.objects.select_related('proceso', 'constancia')
        .filter(pk=solicitud_id).first()
    )
    if solicitud is None:
        raise NotFoundError('La solicitud de fe de vida no existe.')
    if solicitud.estado != SolicitudFeDeVidaModel.Estado.VALIDADA:
        raise ConflictError('La planilla solo está disponible para una solicitud validada.')

    ficha = LectorFichaPasivoORM().ficha(solicitud.cedula)
    cambios = _cambios_por_campo(RepoCambiosActaORM().listar(solicitud.id))
    empleado = _empleado(ficha, cambios)
    vivienda = _vivienda(ficha, cambios)
    complementarios = dict(ficha.get('datos_complementarios') or {})
    for campo in ('correo_alternativo', 'tiene_hijos'):
        if ('datos_complementarios', campo) in cambios:
            complementarios[campo] = cambios[('datos_complementarios', campo)]

    asignacion = (empleado.get('asignaciones') or [{}])[0]
    constancia = getattr(solicitud, 'constancia', None)
    pais_es_venezuela = vivienda.get('pais_es_venezuela')
    return {
        'snapshot_en': timezone.now().isoformat(),
        'proceso': {
            'id': str(solicitud.proceso_id),
            'nombre': _texto(solicitud.proceso.nombre),
            'estado': solicitud.proceso.estado,
            'fecha_apertura': _fecha(solicitud.proceso.fecha_apertura),
            'fecha_cierre': _fecha(solicitud.proceso.fecha_cierre),
        },
        'solicitud': {
            'id': str(solicitud.pk),
            'canal': solicitud.canal,
            'envios': solicitud.envios,
            'fecha_envio': _fecha(solicitud.fecha_envio),
            'fecha_validacion': _fecha(solicitud.fecha_validacion),
        },
        'constancia': {
            'numero': _texto(getattr(constancia, 'numero', '')),
            'emitida_en': _fecha(getattr(constancia, 'emitida_en', None)),
        },
        'persona': {
            'cedula': _texto(empleado.get('cedula')) or solicitud.cedula,
            'nombres': _texto(empleado.get('nombres')),
            'apellidos': _texto(empleado.get('apellidos')),
            'sexo': _texto(empleado.get('sexo_nombre')),
            'fecha_nacimiento': _fecha(empleado.get('fecha_nacimiento')),
            'correo': _texto(empleado.get('correo')),
            'telefono_movil': _texto(empleado.get('telefono_movil')),
            'telefono_habitacion': _texto(empleado.get('telefono_habitacion')),
        },
        'tipo_pasivo': _texto(asignacion.get('tipo_nomina')),
        'vivienda': {
            'es_venezuela': bool(pais_es_venezuela) if pais_es_venezuela is not None else True,
            'pais': _texto(vivienda.get('pais_nombre')),
            'ciudad_region': _texto(vivienda.get('ciudad_region')),
            'estado': _texto(vivienda.get('estado_nombre')),
            'municipio': _texto(vivienda.get('municipio_nombre')),
            'parroquia': _texto(vivienda.get('parroquia_nombre')),
            'codigo_postal': _texto(vivienda.get('codigo_postal_nombre')),
            'direccion': _texto(vivienda.get('direccion_exacta')),
            'condicion': _texto(vivienda.get('condicion_vivienda_nombre')),
        },
        'familiares': _familiares(ficha),
        'contactos': _contactos(ficha),
        'complementarios': {
            'correo_alternativo': _texto(complementarios.get('correo_alternativo')),
            'tiene_hijos': complementarios.get('tiene_hijos'),
        },
        'foto': {
            'clave': _texto(solicitud.evidencia_clave),
            'mime': _texto(solicitud.evidencia_mime),
        },
    }


def guardar_datos_planilla(solicitud_id: str) -> dict:
    """Devuelve la instantánea guardada; si falta, la construye y la guarda (constancias anteriores)."""
    estado = (
        SolicitudFeDeVidaModel.objects.filter(pk=solicitud_id)
        .values_list('estado', flat=True).first()
    )
    if estado is None:
        raise NotFoundError('La solicitud de fe de vida no existe.')
    if estado != SolicitudFeDeVidaModel.Estado.VALIDADA:
        raise ConflictError('La planilla solo está disponible para una solicitud validada.')
    constancia = ConstanciaFeDeVidaModel.objects.filter(solicitud_id=solicitud_id).first()
    if constancia is not None and constancia.datos_planilla:
        return constancia.datos_planilla
    datos = construir_datos_planilla(solicitud_id)
    if constancia is not None:
        ConstanciaFeDeVidaModel.objects.filter(pk=constancia.pk).update(datos_planilla=datos)
    return datos
