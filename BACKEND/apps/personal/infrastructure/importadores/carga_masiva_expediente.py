"""
Carga masiva de expediente completo de empleado vía Excel (gap #4, réplica
funcional de `RAC/views/personal_activo_views.py::ImportFullEmployeeDataView`).

Corrige, de forma deliberada (no una reproducción mecánica de errores):

- **ALTA-16** (verificado como NO corregido en el legado, línea 392 de
  `personal_activo_views.py`: `'profile': str(row.get('perfil_profesional', ''))
  if not pd.isna(row.get('perfil_profesional')) else None` — si la columna
  `perfil_profesional` no existe en el Excel, `row.get(..., '')` devuelve
  `''`, que NO es `NaN`, así que la condición toma la rama `str('')` = `''`
  y **sobrescribe la foto de perfil existente con una cadena vacía en cada
  fila**, incluso cuando el Excel nunca pretendió tocar la foto). Aquí:
  el campo `profile` solo se incluye en los `defaults` de `update_or_create`
  si la columna existe en el Excel Y el valor no es nulo/vacío.
- **Bug adicional encontrado (no documentado antes)**: el legado intenta
  `formacion_academica.objects.update_or_create(..., defaults={'institucion':
  ..., 'capacitacion': ...})`, pero el modelo `formacion_academica` real
  (`RAC/models/personal_models.py:395-408`) NO tiene esos campos — tiene
  `institucion_id` (FK a `Instituciones`) y ningún campo `capacitacion`.
  En creación (`update_or_create` sin fila previa) esto revienta con
  `TypeError` en cada fila con `institucion_academica`, capturado por el
  `except Exception` de la fila (la fila queda en `errores`, pero el
  `Employee` ya creado en el paso 1 sobrevive). Aquí se corrige resolviendo
  `institucion_academica` contra el catálogo real (`institucion` FK).

Alcance NO cubierto (documentado, ver `expediente_models.py`): perfil físico
(tallas) y las M2M de salud (alergias/patologías/discapacidades).
"""
import pandas as pd
from django.db import transaction

from core.domain.exceptions import ValidationError
from apps.catalogos.infrastructure.models.catalogo_models import EstadoCivilModel, ParentescoModel, SexoModel, TipoProcedenciaModel
from apps.catalogos.infrastructure.models.geografia_models import EstadoModel, MunicipioModel, ParroquiaModel
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.personal.application.use_cases.upsert_contrato import upsert_contrato
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CarreraModel,
    CodigoPostalModel,
    CondicionViviendaModel,
    GrupoSanguineoModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
    PoliticaModel,
    CapacitacionModel,
    GrupoCapacitacionModel,
    TallaModel,
    TipoPrendaModel,
    RegionTallaModel,
    PatologiaCronicaModel,
    DiscapacidadModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContactoEmergenciaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM


def _normalizar(texto) -> str:
    if pd.isna(texto) or not str(texto).strip():
        return ''
    return ' '.join(str(texto).split()).upper()


def _separar(texto) -> list[str]:
    """Separa un campo con varios valores por ';' o '|' y los normaliza."""
    if pd.isna(texto) or not str(texto).strip():
        return []
    return [n for n in (_normalizar(v) for v in str(texto).replace('|', ';').split(';')) if n]


def _parsear_fecha(valor):
    if pd.isna(valor) or valor == '':
        return None
    try:
        return pd.to_datetime(valor).date()
    except Exception:
        return None


def _construir_cache() -> dict:
    return {
        'sexo': {_normalizar(o.sexo): o for o in SexoModel.objects.all()},
        'estado_civil': {_normalizar(o.estadoCivil): o for o in EstadoCivilModel.objects.all()},
        'sangre': {_normalizar(o.GrupoSanguineo): o for o in GrupoSanguineoModel.objects.all()},
        'niveles': {_normalizar(o.nivelacademico): o for o in NivelAcademicoModel.objects.all()},
        'carreras': {_normalizar(o.nombre_carrera): o for o in CarreraModel.objects.all()},
        'menciones': {_normalizar(o.nombre_mencion): o for o in MencionModel.objects.all()},
        'instituciones': {_normalizar(o.nombre_institucion): o for o in InstitucionModel.objects.all()},
        'vivienda_cond': {_normalizar(o.condicion): o for o in CondicionViviendaModel.objects.all()},
        'estados': {_normalizar(o.estado): o for o in EstadoModel.objects.all()},
        'municipios': {_normalizar(o.municipio): o for o in MunicipioModel.objects.all()},
        'parroquias': {_normalizar(o.parroquia): o for o in ParroquiaModel.objects.all()},
        'codigos_postales': {_normalizar(o.codigo): o for o in CodigoPostalModel.objects.all()},
        'parentescos': {_normalizar(o.parentesco): o for o in ParentescoModel.objects.all()},
        'organismos': {_normalizar(o.Organismoadscrito): o for o in OrganismoAdscritoModel.objects.all()},
        'politicas': {_normalizar(o.tipo_politica): o for o in PoliticaModel.objects.all()},
        'alergias': {_normalizar(o.alergia): o for o in AlergiaModel.objects.all()},
        'patologias': {_normalizar(o.patologia): o for o in PatologiaCronicaModel.objects.all()},
        'discapacidades': {_normalizar(o.discapacidad): o for o in DiscapacidadModel.objects.all()},
        'capacitaciones': {_normalizar(o.nombre_capacitacion): o for o in CapacitacionModel.objects.all()},
        'grupos_capacitacion': {_normalizar(o.nombre_grupo): o for o in GrupoCapacitacionModel.objects.all()},
        'tallas': {_normalizar(o.valor): o for o in TallaModel.objects.all()},
        'tipos_prenda': {_normalizar(o.categoria): o for o in TipoPrendaModel.objects.all()},
        'regiones_talla': {_normalizar(o.descripcion or o.codigo): o for o in RegionTallaModel.objects.all()},
        'tipos_procedencia': {_normalizar(o.tipo_procedencia): o for o in TipoProcedenciaModel.objects.all()},
    }


def importar_expediente_completo(archivo, nombre_archivo: str) -> dict:
    """
    Réplica de la semántica transaccional del legado: TODO el archivo se
    procesa dentro de una única transacción; si CUALQUIER fila produce un
    error de validación, se revierte el archivo completo (ninguna fila se
    persiste) y se propaga `ValidationError` con el detalle línea por línea.
    """
    df = pd.read_excel(archivo) if nombre_archivo.endswith(('.xlsx', '.xls')) else pd.read_csv(archivo)
    df.columns = df.columns.str.strip().str.lower()
    columnas = set(df.columns)

    cache = _construir_cache()
    repo = RepoPersonalORM()
    errores: list[str] = []
    contadores = {'creados': 0, 'actualizados': 0}

    with transaction.atomic():
        _procesar_filas(df, columnas, cache, repo, errores, contadores)
        if errores:
            excepcion = ValidationError(
                'Se detectaron errores de validación. Operación cancelada (rollback).'
            )
            excepcion.detalles = errores
            raise excepcion

    return {'creados': contadores['creados'], 'actualizados': contadores['actualizados'], 'errores': errores}


def _procesar_filas(df, columnas, cache, repo, errores: list, contadores: dict) -> None:
    for indice, fila in df.iterrows():
        linea = indice + 2
        try:
            cedula = str(fila.get('cedula', '')).split('.')[0].strip()
            if not cedula:
                errores.append(f"Línea {linea}: Cédula vacía.")
                continue

            def obtener(cat, col):
                valor = _normalizar(fila.get(col))
                return cache[cat].get(valor) if valor else None

            datos_empleado = {
                'nombres': _normalizar(fila.get('nombres')),
                'apellidos': _normalizar(fila.get('apellidos')),
                'fecha_nacimiento': _parsear_fecha(fila.get('fecha_nacimiento')),
                'correo': str(fila.get('correo', '')).lower() if not pd.isna(fila.get('correo')) else None,
                'telefono_movil': str(fila.get('telefono_movil', '')),
                'telefono_habitacion': str(fila.get('telefono_habitacion', '')),
                'sexoid': obtener('sexo', 'sexo'),
                'estadoCivil': obtener('estado_civil', 'estado_civil'),
            }
            # Corrección ALTA-16: `profile` solo se toca si la columna existe
            # en el Excel y trae un valor real — nunca se sobrescribe con
            # una cadena vacía por omisión.
            if 'perfil_profesional' in columnas:
                valor_perfil = fila.get('perfil_profesional')
                if not pd.isna(valor_perfil) and str(valor_perfil).strip():
                    datos_empleado['profile'] = str(valor_perfil).strip()

            emp_instance, creado = EmployeeModel.objects.update_or_create(
                cedulaidentidad=cedula, defaults=datos_empleado,
            )
            contadores['creados' if creado else 'actualizados'] += 1

            if _normalizar(fila.get('direccion_exacta')):
                repo._upsert_vivienda(emp_instance, {
                    'estado': obtener('estados', 'estado'),
                    'municipio': obtener('municipios', 'municipio'),
                    'parroquia': obtener('parroquias', 'parroquia'),
                    'direccion_exacta': fila.get('direccion_exacta'),
                    'condicion_vivienda': obtener('vivienda_cond', 'condicion_vivienda'),
                    'codigo_postal': obtener('codigos_postales', 'codigo_postal'),
                })

            if _normalizar(fila.get('institucion_academica')):
                # Corrección del bug de campos inexistentes (ver cabecera):
                # `institucion` es FK real, sin campo `capacitacion`.
                repo._upsert_academico(emp_instance, {
                    'nivel_academico': obtener('niveles', 'nivel_academico'),
                    'carrera': obtener('carreras', 'carrera'),
                    'mencion': obtener('menciones', 'mencion'),
                    'institucion': obtener('instituciones', 'institucion_academica'),
                })

            grupo_sanguineo = obtener('sangre', 'grupo_sanguineo')
            if grupo_sanguineo:
                repo._upsert_salud(emp_instance, {'grupo_sanguineo_id': grupo_sanguineo.pk})

            # M2M de salud (paridad funcional): alergias, patologías y
            # discapacidades se pasan como nombres (separadas por ';' o '|').
            alergias_nombres = _separar(fila.get('alergias'))
            patologias_nombres = _separar(fila.get('patologias_cronicas'))
            discapacidades_nombres = _separar(fila.get('discapacidades'))
            salud_data = {'grupo_sanguineo_id': grupo_sanguineo.pk if grupo_sanguineo else None}
            if alergias_nombres:
                salud_data['alergias'] = [cache['alergias'][n].pk for n in alergias_nombres if n in cache['alergias']]
            if patologias_nombres:
                salud_data['patologias_cronicas'] = [cache['patologias'][n].pk for n in patologias_nombres if n in cache['patologias']]
            if discapacidades_nombres:
                salud_data['discapacidades'] = [cache['discapacidades'][n].pk for n in discapacidades_nombres if n in cache['discapacidades']]
            if grupo_sanguineo or alergias_nombres or patologias_nombres or discapacidades_nombres:
                repo._upsert_salud(emp_instance, salud_data)

            # Perfil físico (paridad funcional): tallas por prenda.
            tallas_nombres = _separar(fila.get('tallas'))
            if tallas_nombres:
                tallas = [cache['tallas'][n].pk for n in tallas_nombres if n in cache['tallas']]
                if len(tallas) >= 1:
                    repo._upsert_perfil_fisico(emp_instance, {
                        'talla_camisa_id': tallas[0],
                        'talla_pantalon_id': tallas[1] if len(tallas) > 1 else None,
                        'talla_zapatos_id': tallas[2] if len(tallas) > 2 else None,
                        'talla_chaqueta_id': tallas[3] if len(tallas) > 3 else None,
                    })

            # Formación complementaria (paridad funcional): capacitaciones.
            capacitacion_nombre = _normalizar(fila.get('capacitacion'))
            if capacitacion_nombre:
                capacitacion_obj = cache['capacitaciones'].get(capacitacion_nombre)
                if not capacitacion_obj:
                    errores.append(f"Línea {linea}: capacitación '{capacitacion_nombre}' no encontrada.")
                else:
                    repo._upsert_formacion_complementaria(emp_instance, {
                        'capacitacion_id': capacitacion_obj.pk,
                        'institucion_id': (cache['instituciones'].get(_normalizar(fila.get('institucion_academica'))).pk
                                           if _normalizar(fila.get('institucion_academica')) in cache['instituciones'] else None),
                        'fechaInicio': _parsear_fecha(fila.get('capacitacion_inicio')),
                        'fechaFin': _parsear_fecha(fila.get('capacitacion_fin')),
                        'dias_completados': str(fila.get('dias_completados', '')) if not pd.isna(fila.get('dias_completados')) else None,
                        'horas_completadas': str(fila.get('horas_completadas', '')) if not pd.isna(fila.get('horas_completadas')) else None,
                        'procedencia_id': cache.get('tipos_procedencia', {}).get(_normalizar(fila.get('procedencia'))) or None,
                        'grupo_id': cache['grupos_capacitacion'].get(_normalizar(fila.get('grupo_capacitacion'))) or None,
                    })

            if _normalizar(fila.get('contacto_nombres')) and _normalizar(fila.get('contacto_apellidos')):
                ContactoEmergenciaModel.objects.update_or_create(
                    empleado=emp_instance,
                    nombres=_normalizar(fila.get('contacto_nombres')),
                    apellidos=_normalizar(fila.get('contacto_apellidos')),
                    defaults={
                        'telefono': str(fila.get('contacto_telefono', '')),
                        'relacion': obtener('parentescos', 'contacto_parentesco'),
                    },
                )

            n_contrato_excel = str(fila.get('n_contrato', '')) if not pd.isna(fila.get('n_contrato')) else None
            fecha_ingreso_org = _parsear_fecha(fila.get('fecha_ingreso_organismo'))
            fecha_culminacion_excel = _parsear_fecha(fila.get('fecha_culminacion')) if 'fecha_culminacion' in columnas else None
            politica_excel = _normalizar(fila.get('politica')) if 'politica' in columnas else ''

            if _normalizar(fila.get('ant_institucion')):
                organismo_obj = cache['organismos'].get(_normalizar(fila.get('ant_institucion')))
                AntecedenteServicioModel.objects.update_or_create(
                    empleado=emp_instance, organismo=organismo_obj,
                    defaults={
                        'fecha_ingreso': _parsear_fecha(fila.get('ant_fecha_ingreso')),
                        'fecha_egreso': _parsear_fecha(fila.get('ant_fecha_egreso')),
                    },
                )

            if n_contrato_excel and fecha_ingreso_org:
                politica_obj = cache['politicas'].get(politica_excel)
                if not politica_obj:
                    errores.append(f"Línea {linea}: política de contrato '{politica_excel}' no encontrada.")
                else:
                    upsert_contrato(repo, cedula=cedula, contrato_data=[{
                        'n_contrato': n_contrato_excel,
                        'fecha_ingreso': fecha_ingreso_org,
                        'politica_id': politica_obj,
                        'fecha_culminacion': fecha_culminacion_excel,
                    }])

        except Exception as exc:  # noqa: BLE001 — réplica del try/except por fila del legado
            errores.append(f"Línea {linea}: {exc}")
