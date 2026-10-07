"""
Mappers de Personal.
"""
from apps.personal.domain.entities.empleado import Empleado
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContactoEmergenciaModel,
    ContratoModel,
    DatosViviendaModel,
    FormacionAcademicaModel,
    FormacionComplementariaModel,
    PerfilFisicoModel,
    PerfilSaludModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.shared.domain.services.tiempo_servicio import calcular_total_apn


def _total_anos_apn_calculado(antecedentes_cerrados) -> float:
    """
    D-05 (Entrada #035/#036): decisión de negocio confirmada — el método
    comercial 30/360 de `calcular_total_apn` (Python) es la fuente
    autoritativa de la antigüedad del empleado, NO la columna
    `Employee.total_anos_apn` que mantiene el trigger PL/pgSQL
    `trg_actualizar_apn`/`calcular_total_apn()` sobre `antecedentes_servicio`
    (días calendario/365.25, incluye antecedentes abiertos — una regla de
    negocio distinta y divergente, confirmada con evidencia real de la BD
    de producción). Este mapper deja de leer esa columna.

    `calcular_total_apn` devuelve {years, months, days}; se expone como un
    único float (años) para no romper el contrato existente del DTO/entidad,
    combinando las tres partes en una fracción de año.
    """
    resultado = calcular_total_apn(antecedentes_cerrados or [])
    return round(
        resultado["years"] + resultado["months"] / 12.0 + resultado["days"] / 365.0,
        4,
    )


def _clean_str(val: str | None) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    if s.lower() in ("nan", "none", "null", "undefined"):
        return None
    return s


def empleado_a_entidad(modelo: EmployeeModel, antecedentes_cerrados=None, expediente: dict | None = None) -> Empleado:
    profile_val = getattr(modelo, 'profile', None)
    foto_url = None
    if profile_val and isinstance(profile_val, str):
        p_clean = profile_val.strip()
        if p_clean.startswith('data:image/'):
            foto_url = p_clean
        elif any(p_clean.lower().endswith(ext) for ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif')) or '/' in p_clean:
            try:
                from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
                import base64
                foto_bytes = SeaweedFSStorage().descargar(p_clean)
                if foto_bytes:
                    ext = p_clean.lower().split('.')[-1]
                    mime = f"image/{ext}" if ext in ('png', 'webp', 'gif') else "image/jpeg"
                    foto_url = f"data:{mime};base64,{base64.b64encode(foto_bytes).decode('utf-8')}"
            except Exception:
                foto_url = None

    nac_id = getattr(modelo, 'nacionalidad_id', 1) or 1
    nac_obj = getattr(modelo, 'nacionalidad', None)
    nac_codigo = getattr(nac_obj, 'codigo', 'V') if nac_obj else 'V'
    nac_nombre = getattr(nac_obj, 'nombre', 'VENEZOLANA') if nac_obj else 'VENEZOLANA'

    return Empleado(
        id=modelo.pk,
        cedula=modelo.cedulaidentidad,
        nombres=modelo.nombres,
        apellidos=modelo.apellidos,
        sexo_id=modelo.sexoid_id,
        sexo_nombre=modelo.sexoid.sexo if modelo.sexoid else "",
        correo=_clean_str(modelo.correo),
        telefono_movil=_clean_str(modelo.telefono_movil),
        telefono_habitacion=_clean_str(modelo.telefono_habitacion),
        fecha_nacimiento=str(modelo.fecha_nacimiento) if modelo.fecha_nacimiento else None,
        estado_civil_id=modelo.estadoCivil_id,
        estado_civil_nombre=modelo.estadoCivil.estadoCivil if modelo.estadoCivil else None,
        carnet_patria=_clean_str(modelo.carnet_patria),
        nacionalidad_id=nac_id,
        nacionalidad_codigo=nac_codigo,
        nacionalidad_nombre=nac_nombre,
        total_anos_apn=_total_anos_apn_calculado(antecedentes_cerrados),
        profile=profile_val,
        foto_url=foto_url,
        **(expediente or {}),
    )


# ----------------------------------------------------------------------
# Expediente anidado (Fase 2.2 del plan de reparación): réplica del
# `EmployeeDetailSerializer` legado, pero solo con los campos ya soportados
# por la escritura (`empleado_escritura_serializers.py`) — mismo alcance
# NO cubierto documentado en `expediente_models.py` (perfil_fisico,
# formacion_complementaria, M2M de salud).
# ----------------------------------------------------------------------
def vivienda_a_dict(v) -> dict | None:
    if not v:
        return None
    return {
        'estado_id': v.estado_id,
        'estado_nombre': v.estado.estado if getattr(v, 'estado', None) else None,
        'municipio_id': v.municipio_id,
        'municipio_nombre': v.municipio.municipio if getattr(v, 'municipio', None) else None,
        'parroquia_id': v.parroquia_id,
        'parroquia_nombre': v.parroquia.parroquia if getattr(v, 'parroquia', None) else None,
        'direccion_exacta': v.direccion_exacta,
        'condicion_vivienda_id': v.condicion_vivienda_id,
        'condicion_vivienda_nombre': v.condicion_vivienda.condicion if getattr(v, 'condicion_vivienda', None) else None,
        'codigo_postal_id': v.codigo_postal_id,
        'codigo_postal_nombre': v.codigo_postal.codigo if getattr(v, 'codigo_postal', None) else None,
    }


def salud_a_dict(s) -> dict | None:
    if not s:
        return None
    return {
        'grupo_sanguineo_id': s.grupo_sanguineo_id,
        'grupo_sanguineo_nombre': s.grupo_sanguineo.GrupoSanguineo if getattr(s, 'grupo_sanguineo', None) else None,
        'alergias': list(s.alergias.values_list('id', flat=True)) if hasattr(s, 'alergias') else [],
        'alergias_nombres': list(s.alergias.values_list('alergia', flat=True)) if hasattr(s, 'alergias') else [],
        'patologias_cronicas': list(s.patologiaCronica.values_list('id', flat=True)) if hasattr(s, 'patologiaCronica') else [],
        'patologias_cronicas_nombres': list(s.patologiaCronica.values_list('patologia', flat=True)) if hasattr(s, 'patologiaCronica') else [],
        'discapacidades': list(s.discapacidad.values_list('id', flat=True)) if hasattr(s, 'discapacidad') else [],
        'discapacidades_nombres': list(s.discapacidad.values_list('discapacidad', flat=True)) if hasattr(s, 'discapacidad') else [],
    }


def perfil_fisico_a_dict(p) -> dict | None:
    if not p:
        return None
    return {
        'talla_camisa_id': p.tallaCamisa_id,
        'talla_camisa_nombre': p.tallaCamisa.valor if getattr(p, 'tallaCamisa', None) else None,
        'talla_pantalon_id': p.tallaPantalon_id,
        'talla_pantalon_nombre': p.tallaPantalon.valor if getattr(p, 'tallaPantalon', None) else None,
        'talla_zapatos_id': p.tallaZapatos_id,
        'talla_zapatos_nombre': p.tallaZapatos.valor if getattr(p, 'tallaZapatos', None) else None,
        'talla_chaqueta_id': p.tallaChaqueta_id,
        'talla_chaqueta_nombre': p.tallaChaqueta.valor if getattr(p, 'tallaChaqueta', None) else None,
    }


def formacion_complementaria_a_dict(f) -> dict:
    return {
        'id': f.pk,
        'capacitacion_id': f.capacitacion_id,
        'capacitacion_nombre': f.capacitacion.nombre_capacitacion if getattr(f, 'capacitacion', None) else None,
        'institucion_id': f.institucion_id,
        'institucion_nombre': f.institucion.nombre_institucion if getattr(f, 'institucion', None) else None,
        'fecha_inicio': f.fechaInicio.isoformat() if f.fechaInicio else None,
        'fecha_fin': f.fechaFin.isoformat() if f.fechaFin else None,
        'dias_completados': f.dias_completados,
        'horas_completadas': f.horas_completadas,
        'procedencia_id': f.procedencia_id,
        'procedencia_nombre': f.procedencia.tipo_procedencia if getattr(f, 'procedencia', None) else None,
        'grupo_id': f.grupo_id,
        'grupo_nombre': f.grupo.nombre_grupo if getattr(f, 'grupo', None) else None,
    }


def formacion_a_dict(f) -> dict:
    return {
        'id': f.pk,
        'nivel_academico_id': f.nivel_academico_id,
        'nivel_academico_nombre': f.nivel_academico.nivelacademico if getattr(f, 'nivel_academico', None) else None,
        'carrera_id': f.carrera_id,
        'carrera_nombre': f.carrera.nombre_carrera if getattr(f, 'carrera', None) else None,
        'mencion_id': f.mencion_id,
        'mencion_nombre': f.mencion.nombre_mencion if getattr(f, 'mencion', None) else None,
        'institucion_id': f.institucion_id,
        'institucion_nombre': f.institucion.nombre_institucion if getattr(f, 'institucion', None) else None,
    }


def contacto_emergencia_a_dict(c) -> dict:
    return {
        'id': c.pk,
        'nombres': c.nombres,
        'apellidos': c.apellidos,
        'telefono': c.telefono,
        'relacion_id': c.relacion_id,
        'relacion_nombre': c.relacion.descripcion_parentesco if getattr(c, 'relacion', None) else None,
    }


def antecedente_a_dict(a) -> dict:
    return {
        'id': a.pk,
        'organismo_id': a.organismo_id,
        'organismo_nombre': a.organismo.Organismoadscrito if getattr(a, 'organismo', None) else None,
        'fecha_ingreso': str(a.fecha_ingreso) if a.fecha_ingreso else None,
        'fecha_egreso': str(a.fecha_egreso) if a.fecha_egreso else None,
    }


def contrato_a_dict(c) -> dict | None:
    if not c:
        return None
    f_ingreso = None
    if hasattr(c, 'fecha_ingreso') and c.fecha_ingreso:
        f_ingreso = str(c.fecha_ingreso)
    elif getattr(c, 'antecedente', None) and c.antecedente.fecha_ingreso:
        f_ingreso = str(c.antecedente.fecha_ingreso)
    return {
        'id': c.pk,
        'n_contrato': c.n_contrato,
        'fecha_ingreso': f_ingreso,
        'fecha_culminacion': str(c.fecha_culminacion) if c.fecha_culminacion else None,
        'politica_id': c.politica_id,
        'politica_nombre': c.politica.tipo_politica if getattr(c, 'politica', None) else None,
        'estatus_id': c.estatus_id,
        'estatus_nombre': c.estatus.estatus if getattr(c, 'estatus', None) else None,
        'es_fijo': c.es_fijo,
    }


def construir_expediente(empleado: EmployeeModel) -> dict:
    """
    Arma el expediente anidado completo de un `EmployeeModel` (Fase 2.1/2.2
    del plan de reparación). Reutilizado tanto por `RepoPersonalORM` como por
    `RepoPasivosORM` (un pasivo también es un `Employee`) para no duplicar
    esta consulta en dos módulos.
    """
    antecedentes_qs = list(
        AntecedenteServicioModel.objects.filter(empleado=empleado).select_related('organismo').order_by('fecha_ingreso')
    )
    contratos_todos = [
        contrato_a_dict(c)
        for c in ContratoModel.objects.filter(antecedente__empleado=empleado).select_related('estatus', 'politica', 'antecedente').order_by('-pk')
    ]
    contrato_actual = None
    antecedente_abierto = next((a for a in antecedentes_qs if a.fecha_egreso is None), None)
    if antecedente_abierto:
        contrato_actual = contrato_a_dict(
            ContratoModel.objects.filter(antecedente=antecedente_abierto).order_by('-pk').first()
        )
    if not contrato_actual and contratos_todos:
        contrato_actual = contratos_todos[0]

    asignaciones_data = []
    encargadurias_data = []
    try:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        from apps.cargos.infrastructure.models.prestamo_models import PrestamoCargoModel

        asigs = list(
            AsigTrabajoModel.objects.filter(employee=empleado)
            .select_related(
                'denominacioncargoid',
                'denominacioncargoespecificoid',
                'tiponominaid',
                'Dependencia',
                'DireccionGeneral',
                'DireccionLinea',
                'Coordinacion',
                'gradoid',
                'estatusid',
                'OrganismoAdscritoid',
                'tipo_procedencia',
            )
        )
        prestamos_cargos_ids = set(
            PrestamoCargoModel.objects.filter(
                cargo_encargado__in=asigs,
                estatus__estatus__in=['ACTIVO', 'POR VENCER']
            ).values_list('cargo_encargado_id', flat=True)
        )
        for a in asigs:
            asignaciones_data.append({
                'id': a.pk,
                'codigo': a.codigo,
                'denominacion_cargo': a.denominacioncargoid.cargo if a.denominacioncargoid else 'N/A',
                'denominacion_cargo_especifico': a.denominacioncargoespecificoid.cargo if a.denominacioncargoespecificoid else 'N/A',
                'tipo_nomina': a.tiponominaid.nomina if a.tiponominaid else 'N/A',
                'dependencia': a.Dependencia.dependencia if a.Dependencia else 'N/A',
                'direccion_general': a.DireccionGeneral.direccion_general if a.DireccionGeneral else 'N/A',
                'direccion_linea': a.DireccionLinea.direccion_linea if a.DireccionLinea else 'N/A',
                'coordinacion': a.Coordinacion.coordinacion if a.Coordinacion else 'N/A',
                'grado': a.gradoid.grado if a.gradoid else 'N/A',
                'estatus': a.estatusid.estatus if a.estatusid else 'ACTIVO',
                'organismo_adscrito': a.OrganismoAdscritoid.Organismoadscrito if a.OrganismoAdscritoid else 'N/A',
                'tipo_procedencia': a.tipo_procedencia.tipo_procedencia if a.tipo_procedencia else 'N/A',
                'cargo_cubierto_encargaduria': a.pk in prestamos_cargos_ids,
            })

        prestamos_empleado = list(
            PrestamoCargoModel.objects.filter(empleado_encargado=empleado)
            .select_related(
                'cargo_encargado',
                'cargo_encargado__denominacioncargoid',
                'cargo_encargado__denominacioncargoespecificoid',
                'cargo_encargado__employee',
                'estatus',
                'motivo',
            )
            .order_by('-fecha_inicio')
        )
        for p in prestamos_empleado:
            cargo = p.cargo_encargado
            titular = cargo.employee if cargo else None
            cargo_especifico_nom = cargo.denominacioncargoespecificoid.cargo if (cargo and cargo.denominacioncargoespecificoid) else 'N/A'
            cargo_nom = cargo.denominacioncargoid.cargo if (cargo and cargo.denominacioncargoid) else 'N/A'
            titular_nom = f"{titular.nombres} {titular.apellidos}".strip() if titular else 'Vacante'
            titular_ced = titular.cedulaidentidad if titular else 'N/A'
            encargadurias_data.append({
                'id': p.pk,
                'cargo_encargado_id': p.cargo_encargado_id,
                'cargo_encargado_codigo': cargo.codigo if cargo else 'N/A',
                'cargo_encargado': cargo_especifico_nom if cargo_especifico_nom != 'N/A' else cargo_nom,
                'cargo_info': {
                    'codigo': cargo.codigo if cargo else 'N/A',
                    'denominacioncargo': {'cargo': cargo_nom},
                    'denominacioncargoespecifico': {'cargo': cargo_especifico_nom},
                } if cargo else None,
                'titular_cedula': titular_ced,
                'titular_nombre': titular_nom,
                'empleado_cedula': titular_ced,
                'empleado_nombre': titular_nom,
                'motivo_id': p.motivo_id,
                'motivo_nombre': p.motivo.movimiento if p.motivo else 'N/A',
                'estatus_id': p.estatus_id,
                'estatus_nombre': p.estatus.estatus if p.estatus else 'ACTIVO',
                'fecha_inicio': str(p.fecha_inicio) if p.fecha_inicio else None,
                'fecha_fin': str(p.fecha_fin) if p.fecha_fin else None,
            })
    except Exception:
        pass

    return {
        'datos_vivienda': vivienda_a_dict(
            DatosViviendaModel.objects.filter(empleado=empleado)
            .select_related('estado', 'municipio', 'parroquia', 'condicion_vivienda', 'codigo_postal')
            .first()
        ),
        'perfil_salud': salud_a_dict(
            PerfilSaludModel.objects.filter(empleado=empleado)
            .select_related('grupo_sanguineo')
            .prefetch_related('alergias', 'patologiaCronica', 'discapacidad')
            .first()
        ),
        'perfil_fisico': perfil_fisico_a_dict(
            PerfilFisicoModel.objects.filter(empleado=empleado)
            .select_related('tallaCamisa', 'tallaPantalon', 'tallaZapatos', 'tallaChaqueta')
            .first()
        ),
        'formacion_academica': [
            formacion_a_dict(f)
            for f in FormacionAcademicaModel.objects.filter(empleado=empleado)
            .select_related('nivel_academico', 'carrera', 'mencion', 'institucion')
        ],
        'formacion_complementaria': [
            formacion_complementaria_a_dict(f)
            for f in FormacionComplementariaModel.objects.filter(empleado=empleado)
            .select_related('capacitacion', 'institucion', 'procedencia', 'grupo')
        ],
        'contacto_emergencia': [
            contacto_emergencia_a_dict(c)
            for c in ContactoEmergenciaModel.objects.filter(empleado=empleado)
            .select_related('relacion')
        ],
        'antecedentes': [antecedente_a_dict(a) for a in antecedentes_qs],
        'contrato_actual': contrato_actual,
        'contratos': contratos_todos,
        'asignaciones': asignaciones_data,
        'encargadurias': encargadurias_data,
    }
