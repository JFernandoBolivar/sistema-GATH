"""
Carga masiva de cargos especiales vía Excel (gap #4, réplica funcional de
`RAC/views/personal_activo_views.py::ImportarCargosESPECIALESView`).

Reutiliza la MISMA gestión de código (gap #5,
`apps.cargos.domain.services.generacion_codigo`) que
`AsignarCargoEspecialView` — se verificó que el algoritmo inline del legado
(`generar_codigo_especial(prefijo)`, con `prefijo` SIN guion bajo final,
p.ej. `"CS"`) y `generador_codigos`/`generar_prefijo_nomina` (con el guion
bajo incluido en el prefijo, p.ej. `"CS_"`) producen exactamente el mismo
código final (`"CS_0001"`) para las dos nóminas especiales legadas
(COMISION DE SERVICIO / HONORARIOS PROFESIONALES) — no es una fusión
arriesgada, es el mismo algoritmo con la posición del guion bajo movida.

⚠️ Igual que en `AsignarCargoEspecialView`: NO registra historial de
movimiento (gap documentado, `apps.movimientos` no existe todavía).

Síncrono, no `202 Accepted` + Celery — misma decisión documentada que
`carga_masiva_expediente.py`.
"""
import pandas as pd
from django.db import transaction

from core.domain.exceptions import ValidationError
from apps.cargos.domain.services.generacion_codigo import generar_prefijo_nomina, siguiente_codigo_especial
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    GradoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
    OrganismoAdscritoModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel


def _normalizar(texto) -> str:
    if pd.isna(texto) or not str(texto).strip():
        return ''
    return ' '.join(str(texto).split()).upper()


def _construir_cache() -> dict:
    return {
        'cargos': {_normalizar(o.cargo): o for o in DenominacionCargoModel.objects.all()},
        'especificos': {_normalizar(o.cargo): o for o in DenominacionCargoEspecificoModel.objects.all()},
        'nominas': {_normalizar(o.nomina): o for o in TipoNominaModel.objects.all()},
        'organismos': {_normalizar(o.Organismoadscrito): o for o in OrganismoAdscritoModel.objects.all()},
        'direcciones': {_normalizar(o.direccion_general): o for o in DireccionGeneralModel.objects.all()},
        'lineas': {_normalizar(o.direccion_linea): o for o in DireccionLineaModel.objects.all()},
        'coordinaciones': {_normalizar(o.coordinacion): o for o in CoordinacionModel.objects.all()},
        'estatus': {_normalizar(o.estatus): o for o in EstatusModel.objects.all()},
        'grados': {_normalizar(o.grado): o for o in GradoModel.objects.all()},
        'tipos_p': {_normalizar(o.tipo_personal): o for o in TipoPersonalModel.objects.all()},
        'dependencias': {_normalizar(o.dependencia): o for o in DependenciaModel.objects.all()},
    }


_NOMINAS_ESPECIALES = {'COMISION DE SERVICIO', 'HONORARIOS PROFESIONALES'}


def importar_cargos_especiales(archivo, nombre_archivo: str) -> dict:
    df = pd.read_excel(archivo) if not nombre_archivo.endswith('.csv') else pd.read_csv(archivo)
    df.columns = df.columns.str.strip().str.lower()
    cache = _construir_cache()

    tipo_personal_default = TipoPersonalModel.objects.filter(pk=2).first()
    dependencia_default = DependenciaModel.objects.filter(pk=1).first()

    errores: list[str] = []
    creados = 0

    with transaction.atomic():
        for indice, fila in df.iterrows():
            try:
                def obtener(cat, col):
                    valor = _normalizar(fila.get(col))
                    return cache[cat].get(valor) if valor else None

                estatus_val = _normalizar(fila.get('estatus'))
                cedula_raw = fila.get('cedula')
                empleado = None

                if estatus_val == 'VACANTE':
                    if not pd.isna(cedula_raw) and str(cedula_raw).strip():
                        raise ValueError(f"El estatus es VACANTE, pero la cédula contiene datos: {cedula_raw}.")
                else:
                    cedula_limpia = str(cedula_raw).split('.')[0].strip() if not pd.isna(cedula_raw) else ''
                    if not cedula_limpia:
                        raise ValueError(f"Para el estatus '{estatus_val}' la cédula es obligatoria.")
                    empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula_limpia).first()
                    if not empleado:
                        raise ValueError(f"La cédula '{cedula_limpia}' no existe en la base de datos de empleados.")

                nomina_obj = obtener('nominas', 'nomina')
                nombre_nomina = _normalizar(fila.get('nomina'))
                codigo_final = fila.get('codigo')

                if nombre_nomina in _NOMINAS_ESPECIALES and nomina_obj is not None:
                    prefijo = generar_prefijo_nomina(nomina_obj.nomina)
                    ultimo = (
                        AsigTrabajoModel.objects.filter(codigo__startswith=prefijo)
                        .order_by('-codigo').values_list('codigo', flat=True).first()
                    )
                    codigo_final = siguiente_codigo_especial(prefijo, ultimo)

                if codigo_final and AsigTrabajoModel.objects.filter(codigo=codigo_final, tiponominaid=nomina_obj).exists():
                    raise ValueError(f"El código '{codigo_final}' ya existe para la nómina '{nombre_nomina}'.")

                cargo_obj = obtener('cargos', 'cargo')
                especifico_obj = obtener('especificos', 'cargo_especifico')
                estatus_obj = obtener('estatus', 'estatus')

                if not all([cargo_obj, especifico_obj, nomina_obj, estatus_obj]):
                    faltantes = [
                        nombre for nombre, val in [
                            (f"Cargo: '{fila.get('cargo')}'", cargo_obj),
                            (f"Específico: '{fila.get('cargo_especifico')}'", especifico_obj),
                            (f"Nómina: '{fila.get('nomina')}'", nomina_obj),
                            (f"Estatus: '{fila.get('estatus')}'", estatus_obj),
                        ] if not val
                    ]
                    raise ValueError(f"Faltan datos críticos: {', '.join(faltantes)}")

                AsigTrabajoModel.objects.create(
                    codigo=codigo_final,
                    employee=empleado,
                    denominacioncargoid=cargo_obj,
                    denominacioncargoespecificoid=especifico_obj,
                    tiponominaid=nomina_obj,
                    estatusid=estatus_obj,
                    OrganismoAdscritoid=obtener('organismos', 'organismo'),
                    DireccionGeneral=obtener('direcciones', 'direccion_general'),
                    DireccionLinea=obtener('lineas', 'direccion_linea'),
                    Coordinacion=obtener('coordinaciones', 'coordinacion'),
                    Dependencia=obtener('dependencias', 'dependencia') or dependencia_default,
                    gradoid=obtener('grados', 'grado'),
                    Tipo_personal=obtener('tipos_p', 'tipo_personal') or tipo_personal_default,
                    observaciones=str(fila.get('observaciones', ''))[:255] if not pd.isna(fila.get('observaciones')) else '',
                )
                creados += 1

            except Exception as exc:  # noqa: BLE001 — réplica del try/except por fila del legado
                errores.append(f"Fila {indice + 2}: {exc}")

        if errores:
            excepcion = ValidationError('Errores en el procesamiento del archivo.')
            excepcion.detalles = errores
            raise excepcion

    return {'creados': creados, 'errores': errores}
