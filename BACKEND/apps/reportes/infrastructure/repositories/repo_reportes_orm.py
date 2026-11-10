"""
Repositorio ORM de Reportes (Reglas B4, B7).

Todos los reportes aplican las mismas reglas (G11), centralizadas en
`consultas_reporte`: página materializada una sola vez con `limite` y
metadatos de truncado, orden total y determinista (con desempate por PK),
asignación vigente por empleado (ACTIVA o la más reciente) y fecha de ingreso =
reingreso más reciente. Los datos relacionados se traen en lotes (sin N+1).
"""
from core.domain.exceptions import ValidationError
from django.db.models import Exists, OuterRef

from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContratoModel,
)
from apps.personal.infrastructure.repositories.consultas_apn import anotar_apn_oficial
from apps.reportes.domain.entities.consulta_reporte import ConsultaReportePersonal
from apps.reportes.domain.entities.resultado_reporte import ResultadoReporte
from apps.reportes.domain.value_objects.condicion_trabajador import (
    CONDICION_ACTIVO,
    CONDICION_PASIVO,
    normalizar_condicion,
)
from apps.reportes.infrastructure.repositories.consultas_reporte import (
    filtro_por_condicion,
    elegir_asignaciones,
    en_lotes,
    fechas_de_ingreso,
    ingreso_previo_a,
    ingresos_por_empleado,
    pagina_con_metadatos,
)

# G9: la columna y los filtros siguen llamándose `total_anos_apn` en el
# registro de campos, pero el repositorio los resuelve contra la anotación
# oficial (`apn_oficial`), nunca contra la columna legada.
_LOOKUPS_APN = {
    'total_anos_apn__gte': 'apn_oficial__gte',
    'total_anos_apn__lte': 'apn_oficial__lte',
}
_CAMPO_APN = 'apn_oficial'


def _anotar_ingreso_apn(queryset):
    """Marca si el trabajador tiene alguna fecha de ingreso (antecedente o contrato)."""
    return queryset.annotate(
        _tiene_ingreso_apn=Exists(
            AntecedenteServicioModel.objects.filter(
                empleado=OuterRef('pk'), fecha_ingreso__isnull=False,
            )
        ),
        _tiene_contrato_apn=Exists(
            ContratoModel.objects.filter(
                antecedente__empleado=OuterRef('pk'),
                antecedente__fecha_ingreso__isnull=False,
            )
        ),
    )


def _lookups_oficiales(lookups: dict) -> dict:
    return {_LOOKUPS_APN.get(clave, clave): valor for clave, valor in lookups.items()}


def _requiere_distinct(lookups: dict) -> bool:
    """Solo las relaciones multivaluadas pueden duplicar filas.

    Los filtros escalares (sexo, edad, fechas, APN) no necesitan `DISTINCT`;
    quitarlo evita el sort/unique que el EXPLAIN mostraba en esos casos.
    """
    prefijos = (
        'assignments__',
        'formacion_academica__',
        'formacion_complementaria__',
        'perfil_salud__',
        'contacto_emergencia__',
        'carga_familiar__',
    )
    return any(str(clave).startswith(prefijos) for clave in lookups)


def _ruta_de_familiar(ruta: str) -> str:
    """Ruta del registro (desde Employee) -> ruta sobre `EmployeefamilyModel`."""
    prefijo = 'carga_familiar__'
    if ruta.startswith(prefijo):
        return ruta[len(prefijo):]
    return f'employeecedula__{ruta}'


def _ruta_agrupacion(consulta: ConsultaReportePersonal) -> str | None:
    if consulta.agrupar_por_ruta == 'total_anos_apn':
        return _CAMPO_APN
    return consulta.agrupar_por_ruta


def _etiqueta_de_grupo(valor) -> str:
    """Etiqueta legible de un grupo (el registro usa rutas de texto; un FK da su id)."""
    if valor is None or str(valor).strip() == '':
        return 'Sin especificar'
    return str(valor)


# P1 del reporte de RRHH: las listas se agrupan por la estructura orgánica.
# `agrupar_por` es la clave del registro; el número indica hasta qué nivel se
# muestra (nivel/dependencia -> DG -> dirección de línea -> coordinación).
_NIVELES_AGRUPACION = {
    'nivel': 1,
    'dependencia': 1,
    'direccion_general': 2,
    'direccion_linea': 3,
    'coordinacion': 4,
}

# Sentinela para que los registros sin unidad queden al final del reporte.
_CODIGO_SIN_UNIDAD = '999999'


def _niveles_de(consulta: ConsultaReportePersonal) -> int:
    """Profundidad de agrupación de la lista (0 = tabla plana)."""
    if consulta.tipo_reporte != 'lista':
        return 0
    return _NIVELES_AGRUPACION.get((consulta.agrupar_por or '').strip(), 0)


def _niveles_organizativos(asig) -> list[tuple[str, str | None, str]]:
    """Etiqueta, valor y código de cada nivel orgánico de una asignación."""
    dep = getattr(asig, 'Dependencia', None) if asig else None
    dg = getattr(asig, 'DireccionGeneral', None) if asig else None
    dl = getattr(asig, 'DireccionLinea', None) if asig else None
    co = getattr(asig, 'Coordinacion', None) if asig else None
    return [
        (
            'NIVEL',
            (dep.dependencia if dep else 'Sin especificar'),
            (dep.Codigo if dep else _CODIGO_SIN_UNIDAD),
        ),
        (
            '> DG / GEREN / OFIC',
            dg.direccion_general if dg else None,
            (dg.Codigo if dg else _CODIGO_SIN_UNIDAD),
        ),
        (
            '- DIV / COORD',
            dl.direccion_linea if dl else None,
            (dl.Codigo if dl else _CODIGO_SIN_UNIDAD),
        ),
        (
            '- COORD',
            co.coordinacion if co else None,
            (co.Codigo if co else _CODIGO_SIN_UNIDAD),
        ),
    ]


def _construir_grupos(filas: list[dict], metas: list[list], niveles: int) -> list[dict] | None:
    """Ordena `filas` por estructura y devuelve los grupos para el PDF.

    El orden dentro de cada grupo conserva el de la consulta (apellidos y
    nombres), porque `sorted` es estable. `#` se reinicia en cada subgrupo,
    igual que el reporte de RRHH.
    """
    if not niveles or not filas:
        return None

    orden = sorted(
        range(len(filas)),
        key=lambda i: tuple(codigo for _, _, codigo in metas[i][:niveles]),
    )
    filas[:] = [filas[i] for i in orden]
    metas = [metas[i] for i in orden]

    grupos: list[dict] = []
    clave_anterior = None
    for indice, meta in enumerate(metas):
        clave = tuple(codigo for _, _, codigo in meta[:niveles])
        if clave != clave_anterior:
            grupos.append({
                'etiquetas': [
                    (etiqueta, valor) for etiqueta, valor, _ in meta[:niveles] if valor
                ],
                'desde': indice,
                'hasta': indice + 1,
            })
            clave_anterior = clave
        else:
            grupos[-1]['hasta'] = indice + 1

    for grupo in grupos:
        for numero, fila in enumerate(filas[grupo['desde']:grupo['hasta']], start=1):
            fila['#'] = str(numero)

    return grupos


def _conteo_personal(qs, consulta: ConsultaReportePersonal, metadatos: dict) -> ResultadoReporte:
    """`tipo_reporte='conteo'`: agrupa por el campo elegido y cuenta."""
    from django.core.exceptions import FieldError
    from django.db.models import Count

    try:
        ruta_agrupacion = _ruta_agrupacion(consulta)
        conteos = (
            # `distinct=True`: el queryset base puede traer una fila por
            # asignación/título; el conteo es de empleados, no de filas.
            qs.values(ruta_agrupacion)
            .annotate(total=Count('pk', distinct=True))
            .order_by('-total')
        )
        filas = [
            {
                consulta.agrupar_por: _etiqueta_de_grupo(c.get(ruta_agrupacion)),
                'total': c['total'],
            }
            for c in conteos
        ]
    except (FieldError, TypeError) as exc:
        raise ValidationError(
            f'No se puede agrupar el reporte por «{consulta.agrupar_por}».'
        ) from exc

    metadatos['truncado'] = False
    return ResultadoReporte(
        titulo=f'Conteo de Personal Activo por {consulta.agrupar_por}',
        columnas=[consulta.agrupar_por, 'total'],
        filas=filas,
        total_registros=len(filas),
        metadatos=metadatos,
    )


def _asignaciones_por_cedula(AsigTrabajoModel, cedulas) -> dict:
    """Asignación vigente por cédula, en lotes (`ACTIVA` o la más reciente)."""
    elegidas = {}
    for lote in en_lotes(list(cedulas)):
        elegidas.update(elegir_asignaciones(
            AsigTrabajoModel.objects
            .filter(employee__in=lote)
            .select_related(
                'denominacioncargoid', 'tiponominaid', 'OrganismoAdscritoid', 'estatusid',
                'Dependencia', 'DireccionGeneral', 'DireccionLinea', 'Coordinacion',
            )
        ))
    return elegidas


class RepoReportesORM:
    def reporte_personal_activo(
        self, consulta: ConsultaReportePersonal, limite: int
    ) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        from apps.personal.infrastructure.models.expediente_models import (
            AntecedenteServicioModel,
        )
        from apps.personal.infrastructure.models.personal_models import EmployeeModel

        # Solo personal activo (mismo criterio que el listado de Personal
        # Activo): los pasivos nunca se mezclan en este reporte.
        qs = _anotar_ingreso_apn(anotar_apn_oficial(
            EmployeeModel.objects.select_related('sexoid', 'estadoCivil', 'nacionalidad')
            .filter(filtro_por_condicion(CONDICION_ACTIVO, 'cedulaidentidad')),
            fecha_corte=consulta.fecha_corte,
        ))
        if consulta.lookups:
            # `distinct()`: los filtros por estructura/salud/formación navegan
            # relaciones multivaluadas (asignaciones, familiares, títulos).
            qs = qs.filter(**_lookups_oficiales(consulta.lookups))
            if _requiere_distinct(consulta.lookups):
                qs = qs.distinct()

        if consulta.tipo_reporte == 'conteo':
            metadatos = {
                'total_encontrados': qs.count(),
                'limite': limite,
                'truncado': False,
                'tipo_reporte': consulta.tipo_reporte,
                'agrupar_por': consulta.agrupar_por,
            }
            return _conteo_personal(qs, consulta, metadatos)

        # Orden total: apellidos, nombres y cédula como desempate. Sin él, dos
        # empleados homónimos podrían entrar o salir del tope entre ejecuciones.
        qs = qs.order_by('apellidos', 'nombres', 'cedulaidentidad')
        pagina, metadatos = pagina_con_metadatos(qs, limite)
        metadatos.update({'tipo_reporte': consulta.tipo_reporte, 'agrupar_por': consulta.agrupar_por})

        cedulas = [e.cedulaidentidad for e in pagina]
        pks = [e.pk for e in pagina]
        asigs = _asignaciones_por_cedula(AsigTrabajoModel, cedulas)
        antecedentes = fechas_de_ingreso(AntecedenteServicioModel, pks)

        filas = []
        metas = []
        for idx, e in enumerate(pagina, start=1):
            asig = asigs.get(e.cedulaidentidad)
            f_ing = antecedentes.get(e.pk)
            filas.append({
                '#': str(idx),
                'codigo': asig.codigo if asig else 'S/D',
                'cedula': str(e.cedulaidentidad),
                'nombres': e.nombres or '',
                'apellidos': e.apellidos or '',
                'fecha_ingreso': f_ing.strftime('%d/%m/%Y') if f_ing else 'N/A',
                'sexo': e.sexoid.sexo if e.sexoid else '',
                'tipo_nomina': asig.tiponominaid.nomina if asig and asig.tiponominaid else 'S/D',
                'cargo': asig.denominacioncargoid.cargo if asig and asig.denominacioncargoid else 'S/D',
                'organismo_adscrito': (
                    asig.OrganismoAdscritoid.Organismoadscrito
                    if asig and asig.OrganismoAdscritoid else 'CONATEL'
                ),
                'total_anos_apn': round(float(e.apn_oficial or 0), 4),
                'apn_aviso': '' if (e._tiene_ingreso_apn or e._tiene_contrato_apn) else 'Fecha de ingreso pendiente',
            })
            metas.append(_niveles_organizativos(asig))

        grupos = _construir_grupos(filas, metas, _niveles_de(consulta))

        return ResultadoReporte(
            titulo="Reporte de Trabajadores",
            columnas=['#', 'codigo', 'cedula', 'nombres', 'apellidos', 'fecha_ingreso', 'sexo', 'tipo_nomina', 'cargo', 'organismo_adscrito', 'total_anos_apn'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
            grupos=grupos,
        )

    def reporte_pasivos(self, consulta: ConsultaReportePersonal, limite: int) -> ResultadoReporte:
        """Reporte de pasivos con los mismos filtros y columnas del personal activo.

        La base son los `Employee` con una asignación `Tipo_personal=PASIVO` o
        un registro de egreso. Así el PDF refleja los filtros del formulario
        (estructura, cargo, nómina, salud, formación, edad, APN, vivienda…)
        sin quedarse solo con los egresados.
        """
        from apps.personal.infrastructure.models.personal_models import EmployeeModel

        qs = _anotar_ingreso_apn(anotar_apn_oficial(
            EmployeeModel.objects.select_related('sexoid', 'estadoCivil', 'nacionalidad')
            .prefetch_related('datos_vivienda__pais')
            .filter(filtro_por_condicion(CONDICION_PASIVO, 'cedulaidentidad')),
            fecha_corte=consulta.fecha_corte,
        ))

        if consulta.lookups:
            qs = qs.filter(**_lookups_oficiales(consulta.lookups))
            if _requiere_distinct(consulta.lookups):
                qs = qs.distinct()

        if consulta.tipo_reporte == 'conteo':
            metadatos = {
                'total_encontrados': qs.count(),
                'limite': limite,
                'truncado': False,
                'tipo_reporte': consulta.tipo_reporte,
                'agrupar_por': consulta.agrupar_por,
            }
            resultado = _conteo_personal(qs, consulta, metadatos)
            return ResultadoReporte(
                titulo=f'Conteo de Personal Pasivo por {consulta.agrupar_por}',
                columnas=resultado.columnas,
                filas=resultado.filas,
                total_registros=resultado.total_registros,
                metadatos=resultado.metadatos,
            )

        qs = qs.order_by('apellidos', 'nombres', 'cedulaidentidad')
        pagina, metadatos = pagina_con_metadatos(qs, limite)
        metadatos.update(
            {'tipo_reporte': consulta.tipo_reporte, 'agrupar_por': consulta.agrupar_por}
        )

        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel

        cedulas = [e.cedulaidentidad for e in pagina]
        asigs = _asignaciones_por_cedula(AsigTrabajoModel, cedulas)

        egresos = {}
        for egr in (
            EmployeeEgresadoModel.objects.filter(employee_id__in=cedulas)
            .select_related('motivo_egreso')
            .order_by('employee_id', '-pk')
        ):
            if egr.employee_id not in egresos:
                egresos[egr.employee_id] = egr

        filas = []
        metas = []
        for idx, e in enumerate(pagina, start=1):
            asig = asigs.get(e.cedulaidentidad)
            egr = egresos.get(e.cedulaidentidad)

            if asig and asig.tiponominaid and asig.tiponominaid.nomina:
                tipo_pasivo = asig.tiponominaid.nomina
            elif egr and egr.motivo_egreso and egr.motivo_egreso.movimiento:
                tipo_pasivo = egr.motivo_egreso.movimiento
            else:
                tipo_pasivo = ''

            if egr and egr.fecha_egreso:
                f_egr = egr.fecha_egreso.strftime('%d/%m/%Y')
            else:
                f_egr = ''

            contactos = []
            if e.telefono_movil:
                contactos.append(e.telefono_movil)
            elif e.telefono_habitacion:
                contactos.append(e.telefono_habitacion)
            if e.correo:
                contactos.append(e.correo)
            contacto = ' / '.join(contactos)

            viviendas = list(e.datos_vivienda.all())
            vivienda = viviendas[0] if viviendas else None
            pais = vivienda.pais.nombre if vivienda is not None and vivienda.pais else ''

            filas.append({
                '#': str(idx),
                'cedula': str(e.cedulaidentidad),
                'nombres': e.nombres or '',
                'apellidos': e.apellidos or '',
                'nombre_completo': f"{e.nombres or ''} {e.apellidos or ''}".strip(),
                'tipo_pasivo': tipo_pasivo,
                'pais': pais,
                'fecha_egreso': f_egr,
                'contacto': contacto,
            })
            metas.append(_niveles_organizativos(asig))

        grupos = _construir_grupos(filas, metas, _niveles_de(consulta))

        return ResultadoReporte(
            titulo='Reporte de Personal Pasivo',
            columnas=[
                '#', 'cedula', 'nombres', 'apellidos', 'tipo_pasivo', 'pais',
                'fecha_egreso', 'contacto',
            ],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
            grupos=grupos,
        )

    def reporte_egresos_pasivos(self, filtros: dict, limite: int) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
        from apps.pasivos.infrastructure.models.pasivo_models import (
            CargoEgresadoModel,
            EmployeeEgresadoModel,
        )
        from apps.personal.infrastructure.models.expediente_models import (
            AntecedenteServicioModel,
        )

        qs = EmployeeEgresadoModel.objects.select_related('employee', 'motivo_egreso').all()

        filtros = filtros or {}
        if filtros.get('motivo_id'):
            qs = qs.filter(motivo_egreso_id=filtros['motivo_id'])
        if filtros.get('fecha_egreso_Desde'):
            qs = qs.filter(fecha_egreso__date__gte=filtros['fecha_egreso_Desde'])
        if filtros.get('fecha_egreso_Hasta'):
            qs = qs.filter(fecha_egreso__date__lte=filtros['fecha_egreso_Hasta'])
        if filtros.get('sexo_id'):
            qs = qs.filter(employee__sexoid_id=filtros['sexo_id'])
        if filtros.get('cargo_id'):
            qs = qs.filter(cargos_historial__denominacioncargoid_id=filtros['cargo_id'])
        if filtros.get('nomina_id'):
            qs = qs.filter(cargos_historial__tipoNominaId_id=filtros['nomina_id'])
        if filtros.get('dependencia_id'):
            qs = qs.filter(cargos_historial__dependenciaId_id=filtros['dependencia_id'])
        if any(k in filtros for k in ('cargo_id', 'nomina_id', 'dependencia_id')):
            qs = qs.distinct()

        # Orden total: apellidos, nombres, cédula y PK del egreso como desempate.
        qs = qs.order_by('employee__apellidos', 'employee__nombres', 'employee_id', 'pk')
        pagina, metadatos = pagina_con_metadatos(qs, limite)

        cedulas = [p.employee_id for p in pagina]
        pks_empleado = [p.employee.pk for p in pagina if p.employee_id]
        # Cada egreso muestra el ingreso anterior a él (decisión del usuario 2026-10-30).
        ingresos = ingresos_por_empleado(AntecedenteServicioModel, pks_empleado)

        # Snapshot del cargo al egreso: una por egreso, la de PK más reciente.
        cargos_snapshot = {}
        for lote in en_lotes([p.pk for p in pagina]):
            for cargo in (
                CargoEgresadoModel.objects
                .filter(egreso_id__in=lote)
                .select_related('denominacioncargoid')
                .order_by('egreso_id', '-pk')
            ):
                cargos_snapshot.setdefault(cargo.egreso_id, cargo)

        # Sin snapshot, el cargo de la asignación vigente del empleado.
        asigs = _asignaciones_por_cedula(AsigTrabajoModel, cedulas)

        filas = []
        for idx, p in enumerate(pagina, start=1):
            emp = p.employee
            f_ing = ingreso_previo_a(ingresos.get(emp.pk, []), p.fecha_egreso) if emp else None
            f_egr = p.fecha_egreso.strftime('%d/%m/%Y') if p.fecha_egreso else 'N/A'

            ultimo_cargo = ''
            cargo_snapshot = cargos_snapshot.get(p.pk)
            if cargo_snapshot and cargo_snapshot.denominacioncargoid_id:
                ultimo_cargo = cargo_snapshot.denominacioncargoid.cargo
            else:
                asig = asigs.get(p.employee_id)
                if asig and asig.denominacioncargoid_id:
                    ultimo_cargo = asig.denominacioncargoid.cargo

            filas.append({
                '#': str(idx),
                'cedula': str(p.employee_id),
                'nombre_completo': f"{emp.nombres} {emp.apellidos}".strip() if emp else '',
                'fecha_ingreso': f_ing.strftime('%d/%m/%Y') if f_ing else 'N/A',
                'fecha_egreso': f_egr,
                'motivo_egreso': str(p.motivo_egreso.movimiento) if p.motivo_egreso else '',
                'ultimo_cargo': ultimo_cargo or 'N/A',
            })

        return ResultadoReporte(
            titulo="Reporte de Egresados",
            columnas=['#', 'cedula', 'nombre_completo', 'fecha_ingreso', 'fecha_egreso', 'motivo_egreso', 'ultimo_cargo'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
        )

    def reporte_cargos_vacantes(
        self, limite: int, dependencias_ids: list[int] | None = None
    ) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel

        qs = AsigTrabajoModel.objects.filter(employee__isnull=True).select_related(
            'Dependencia', 'DireccionGeneral', 'denominacioncargoid'
        )
        if dependencias_ids:
            qs = qs.filter(Dependencia_id__in=dependencias_ids)

        # Código del cargo y PK como desempate: orden total y estable.
        qs = qs.order_by('codigo', 'pk')
        pagina, metadatos = pagina_con_metadatos(qs, limite)

        filas = []
        for idx, c in enumerate(pagina, start=1):
            filas.append({
                '#': str(idx),
                'id': c.pk,
                'denominacion': c.denominacioncargoid.cargo if c.denominacioncargoid else '',
                'dependencia': c.Dependencia.dependencia if c.Dependencia else '',
                'codigo_nomina': c.codigo or '',
            })

        return ResultadoReporte(
            titulo="Reporte de Cargos Vacantes",
            columnas=['#', 'id', 'denominacion', 'dependencia', 'codigo_nomina'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
        )

    def reporte_familiares(
        self,
        consulta: ConsultaReportePersonal,
        limite: int,
        condicion: str = CONDICION_ACTIVO,
        cedula_empleado: str | None = None,
    ) -> ResultadoReporte:
        """Familiares de los trabajadores de una condición (ACTIVO o PASIVO).

        Las filas son familiares. Los lookups del registro (`familiares`) están
        escritos desde `Employee`: los que empiezan con `carga_familiar__` se
        aplican al familiar y el resto al trabajador (`employeecedula__`).
        """
        from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel

        condicion = normalizar_condicion(condicion)
        qs = (
            EmployeefamilyModel.objects.select_related('employeecedula', 'parentesco', 'sexo')
            .filter(filtro_por_condicion(condicion, 'employeecedula_id'))
        )
        if cedula_empleado:
            qs = qs.filter(employeecedula_id=cedula_empleado)
        if consulta.lookups:
            qs = qs.filter(**{
                _ruta_de_familiar(ruta): valor for ruta, valor in consulta.lookups.items()
            })
            # Salud, vivienda y asignaciones son relaciones multivaluadas.
            qs = qs.distinct()

        # Apellidos/nombres del trabajador, luego los del familiar y PK.
        qs = qs.order_by(
            'employeecedula__apellidos', 'employeecedula__nombres', 'employeecedula_id',
            'primer_apellido', 'primer_nombre', 'pk',
        )
        pagina, metadatos = pagina_con_metadatos(qs, limite)
        metadatos['condicion'] = condicion

        filas = []
        for idx, f in enumerate(pagina, start=1):
            emp = f.employeecedula
            f_nac = f.fechanacimiento.strftime('%d/%m/%Y') if f.fechanacimiento else 'N/A'
            filas.append({
                '#': str(idx),
                'cedula_empleado': str(f.employeecedula_id) if f.employeecedula_id else '',
                'nombre_empleado': f"{emp.nombres} {emp.apellidos}".strip() if emp else '',
                'cedula_familiar': f.cedulaFamiliar or 'S/C',
                'nombre_familiar': f"{f.primer_nombre} {f.primer_apellido}".strip(),
                'parentesco': f.parentesco.descripcion_parentesco if f.parentesco_id else '',
                'fecha_nacimiento': f_nac,
                'sexo': f.sexo.sexo if f.sexo_id else '',
            })

        titulo = (
            'Reporte de Familiares de Pasivos'
            if condicion == CONDICION_PASIVO else 'Reporte de Familiares'
        )
        return ResultadoReporte(
            titulo=titulo,
            columnas=['#', 'cedula_empleado', 'nombre_empleado', 'cedula_familiar', 'nombre_familiar', 'parentesco', 'fecha_nacimiento', 'sexo'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
        )

    def reporte_codigos(self, filtros: dict, limite: int) -> ResultadoReporte:
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel

        # Rendimiento (2026-11-03): unir 10 tablas costaba ~170 ms solo en planificar
        # la consulta. Se une el empleado y los catálogos (pequeños) van por
        # prefetch_related; Dependencia y DireccionGeneral no se usan en las filas.
        qs = AsigTrabajoModel.objects.select_related('employee').prefetch_related(
            'denominacioncargoid', 'denominacioncargoespecificoid', 'gradoid',
            'tiponominaid', 'OrganismoAdscritoid', 'estatusid',
        )

        filtros = filtros or {}
        if filtros.get('cargo_id'):
            qs = qs.filter(denominacioncargoid_id=filtros['cargo_id'])
        if filtros.get('cargo_especifico_id'):
            qs = qs.filter(denominacioncargoespecificoid_id=filtros['cargo_especifico_id'])
        if filtros.get('nomina_id'):
            qs = qs.filter(tiponominaid_id=filtros['nomina_id'])
        if filtros.get('dependencia_id'):
            qs = qs.filter(Dependencia_id=filtros['dependencia_id'])
        if filtros.get('general_id'):
            qs = qs.filter(DireccionGeneral_id=filtros['general_id'])
        if filtros.get('estatus_id'):
            qs = qs.filter(estatusid_id=filtros['estatus_id'])

        # Código del cargo y PK como desempate: orden total y estable.
        qs = qs.order_by('codigo', 'pk')
        pagina, metadatos = pagina_con_metadatos(qs, limite)

        filas = []
        for idx, c in enumerate(pagina, start=1):
            emp = c.employee
            filas.append({
                '#': str(idx),
                'codigo': c.codigo or '',
                'cedula': str(c.employee_id) if c.employee_id else 'VACANTE',
                'empleado': f"{emp.nombres} {emp.apellidos}".strip() if emp else 'VACANTE',
                'cargo': c.denominacioncargoid.cargo if c.denominacioncargoid_id else '',
                'cargo_especifico': c.denominacioncargoespecificoid.cargo if c.denominacioncargoespecificoid_id else '',
                'grado': c.gradoid.grado if c.gradoid_id else '',
                'tipo_nomina': c.tiponominaid.nomina if c.tiponominaid_id else '',
                'organismo_adscrito': c.OrganismoAdscritoid.Organismoadscrito if c.OrganismoAdscritoid_id else 'CONATEL',
                'estatus': c.estatusid.estatus if c.estatusid_id else '',
            })

        return ResultadoReporte(
            titulo="Reporte de Cargos",
            columnas=['#', 'codigo', 'cedula', 'empleado', 'cargo', 'cargo_especifico', 'grado', 'tipo_nomina', 'organismo_adscrito', 'estatus'],
            filas=filas,
            total_registros=len(filas),
            metadatos=metadatos,
        )

    def reporte_tendencias_personal(self) -> ResultadoReporte:
        from datetime import datetime, time

        from dateutil.relativedelta import relativedelta
        from django.db.models import Count
        from django.db.models.functions import TruncMonth
        from django.utils import timezone

        from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
        from apps.personal.infrastructure.models.expediente_models import AntecedenteServicioModel

        desde = timezone.localdate().replace(day=1) - relativedelta(months=11)
        desde_dt = timezone.make_aware(datetime.combine(desde, time.min))

        ingresos_por_mes = (
            AntecedenteServicioModel.objects
            .filter(fecha_ingreso__gte=desde)
            .annotate(periodo=TruncMonth('fecha_ingreso'))
            .values('periodo')
            .annotate(total=Count('id'))
        )
        egresos_por_mes = (
            EmployeeEgresadoModel.objects
            .filter(fecha_egreso__gte=desde_dt)
            .annotate(periodo=TruncMonth('fecha_egreso'))
            .values('periodo')
            .annotate(total=Count('id'))
        )

        mapa_ingresos = {i['periodo'].strftime('%Y-%m'): i['total'] for i in ingresos_por_mes if i['periodo']}
        mapa_egresos = {e['periodo'].strftime('%Y-%m'): e['total'] for e in egresos_por_mes if e['periodo']}

        filas = []
        cursor = desde
        for _ in range(12):
            clave = cursor.strftime('%Y-%m')
            filas.append({
                'periodo': clave,
                'ingresos': mapa_ingresos.get(clave, 0),
                'egresos': mapa_egresos.get(clave, 0),
            })
            cursor = cursor + relativedelta(months=1)

        return ResultadoReporte(
            titulo="Tendencia de Movimientos de Personal (últimos 12 meses)",
            columnas=['periodo', 'ingresos', 'egresos'],
            filas=filas,
            total_registros=len(filas),
        )

    def reporte_distribucion_nomina(self) -> ResultadoReporte:
        from django.db.models import Count

        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel

        # Solo personal activo (el reporte lo promete): sin pasivos ni egresados.
        conteos = (
            AsigTrabajoModel.objects
            .filter(employee__isnull=False)
            .filter(filtro_por_condicion(CONDICION_ACTIVO, 'employee_id'))
            .values('tiponominaid__nomina')
            .annotate(total=Count('id'))
            .order_by('-total')
        )

        filas = [
            {
                'tipo_nomina': c['tiponominaid__nomina'] or 'Sin especificar',
                'total': c['total'],
            }
            for c in conteos
        ]

        return ResultadoReporte(
            titulo="Distribución de Personal por Tipo de Nómina",
            columnas=['tipo_nomina', 'total'],
            filas=filas,
            total_registros=len(filas),
        )
