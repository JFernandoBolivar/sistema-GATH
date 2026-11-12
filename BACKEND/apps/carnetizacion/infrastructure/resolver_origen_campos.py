"""Valor real de cada campo personalizado del carnet según su origen (lista cerrada del dominio).

Cada origen lee un dato del expediente del trabajador; si el dato no existe devuelve ''.
Los campos sin origen (los anteriores a esta función) no se resuelven: se imprimen vacíos.
"""
from datetime import date
from typing import Any, Callable

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.carnetizacion.domain.entities.campo_credencial import ORIGENES_CAMPO_PERSONALIZADO
from apps.carnetizacion.infrastructure.models.carnetizacion_models import CampoPersonalizadoModel
from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel, PerfilSaludModel


def _fecha(valor: date | None) -> str:
    return valor.strftime('%d/%m/%Y') if valor else ''


def _tipo_sangre(empleado: Any, asignacion: Any) -> str:
    perfil = (
        PerfilSaludModel.objects.select_related('grupo_sanguineo')
        .filter(empleado=empleado, grupo_sanguineo__isnull=False)
        .first()
    )
    return perfil.grupo_sanguineo.GrupoSanguineo if perfil else ''


def _correo_alternativo(empleado: Any, asignacion: Any) -> str:
    fila = DatosComplementariosTrabajadorModel.objects.filter(cedula=empleado.cedulaidentidad).first()
    return (fila.correo_alternativo or '') if fila else ''


def _fecha_ingreso(empleado: Any, asignacion: Any) -> str:
    primero = AntecedenteServicioModel.objects.filter(empleado=empleado).order_by('fecha_ingreso').first()
    return _fecha(primero.fecha_ingreso) if primero else ''


def _nivel(empleado: Any, asignacion: Any) -> str:
    return asignacion.Dependencia.dependencia if asignacion and asignacion.Dependencia else ''


def _tipo_nomina(empleado: Any, asignacion: Any) -> str:
    return asignacion.tiponominaid.nomina if asignacion and asignacion.tiponominaid else ''


_RESOLVEDORES: dict[str, Callable[[Any, Any], str]] = {
    'tipo_sangre': _tipo_sangre,
    'telefono_movil': lambda e, a: e.telefono_movil or '',
    'correo_acceso': lambda e, a: e.correo or '',
    'correo_alternativo': _correo_alternativo,
    'fecha_ingreso': _fecha_ingreso,
    'nivel': _nivel,
    'tipo_nomina': _tipo_nomina,
    'sexo': lambda e, a: e.sexoid.sexo if e.sexoid_id else '',
    'fecha_nacimiento': lambda e, a: _fecha(e.fecha_nacimiento),
    'nacionalidad': lambda e, a: e.nacionalidad.nombre if e.nacionalidad_id else '',
}

assert set(_RESOLVEDORES) == set(ORIGENES_CAMPO_PERSONALIZADO)


def valores_campos_personalizados(empleado: Any, asignacion: Any = None) -> dict[str, str]:
    """`{codigo_del_campo: valor}` para los campos personalizados que tienen origen."""
    campos = list(CampoPersonalizadoModel.objects.exclude(origen='').values_list('codigo', 'origen'))
    if not campos or empleado is None:
        return {}
    cache: dict[str, str] = {}
    valores: dict[str, str] = {}
    for codigo, origen in campos:
        resolvedor = _RESOLVEDORES.get(origen)
        if resolvedor is None:
            continue
        if origen not in cache:
            try:
                cache[origen] = str(resolvedor(empleado, asignacion) or '')
            except Exception:
                cache[origen] = ''
        valores[codigo] = cache[origen]
    return valores
