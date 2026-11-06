"""
Repositorio ORM de Personal (Reglas B4, B7, D-09).
"""
from datetime import date

from django.db import transaction
from django.db.models import Model, Q

from core.domain.exceptions import NotFoundError, ValidationError
from apps.personal.domain.entities.empleado import Empleado
from apps.personal.infrastructure.mappers.mapper_personal import (
    apn_oficial,
    construir_expediente,
    empleado_a_entidad,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
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
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CarreraModel,
    CodigoPostalModel,
    CondicionViviendaModel,
    DiscapacidadModel,
    GrupoCapacitacionModel,
    GrupoSanguineoModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
    PoliticaModel,
    RegionTallaModel,
    TallaModel,
    TipoPrendaModel,
    CapacitacionModel,
)
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.catalogos.infrastructure.models.catalogo_models import EstatusModel


def _antecedentes_cerrados(cedula_o_id) -> list:
    return list(
        AntecedenteServicioModel.objects.filter(
            empleado_id=cedula_o_id, fecha_egreso__isnull=False,
        )
    )


def _antecedentes_empleado(empleado_id) -> list:
    """Antecedentes con su organismo en una sola consulta (detalle)."""
    return list(
        AntecedenteServicioModel.objects.filter(empleado_id=empleado_id)
        .select_related('organismo')
        .order_by('fecha_ingreso')
    )


class RepoPersonalORM:
    # ------------------------------------------------------------------
    # Lectura
    # ------------------------------------------------------------------
    def _filtrar_empleados(
        self,
        busqueda: str | None = None,
        codigo: str | None = None,
        tipo_nomina: str | int | None = None,
        dependencia_id: int | None = None,
        direccion_general_id: int | None = None,
        direccion_linea_id: int | None = None,
        coordinacion_id: int | None = None,
    ):
        """QuerySet de activos con los filtros aplicados en el servidor.

        El orden incluye la PK como desempate para que la paginación sea
        estable entre páginas aunque `fecha_actualizacion` se repita.
        """
        from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel

        # Solo listar trabajadores que tienen cargos asignados activos (Regla de negocio Personal Activo)
        asig_qs = AsigTrabajoModel.objects.filter(
            employee__isnull=False,
        ).filter(
            Q(Tipo_personal__tipo_personal__iexact='ACTIVO') | Q(Tipo_personal__isnull=True)
        )
        if codigo:
            asig_qs = asig_qs.filter(codigo__icontains=codigo)
        if tipo_nomina:
            asig_qs = asig_qs.filter(tiponominaid_id=tipo_nomina)
        # Estructura organizativa: un empleado aparece si ALGUNA de sus
        # asignaciones activas cae en la unidad filtrada.
        estructura = {
            'Dependencia_id': dependencia_id,
            'DireccionGeneral_id': direccion_general_id,
            'DireccionLinea_id': direccion_linea_id,
            'Coordinacion_id': coordinacion_id,
        }
        asig_qs = asig_qs.filter(**{campo: v for campo, v in estructura.items() if v is not None})

        emp_cedulas = asig_qs.values_list('employee_id', flat=True).distinct()

        qs = EmployeeModel.objects.filter(
            cedulaidentidad__in=emp_cedulas
        ).select_related('sexoid', 'estadoCivil', 'nacionalidad').only(
            # Solo las columnas que usa `empleado_a_entidad` en el listado: nada
            # del expediente anidado (vivienda, salud, formación, contratos).
            'id', 'cedulaidentidad', 'nombres', 'apellidos', 'fecha_nacimiento',
            'profile', 'sexoid', 'estadoCivil', 'nacionalidad', 'correo',
            'telefono_habitacion', 'telefono_movil', 'carnet_patria',
            'carnet_patria_serial',
            'fecha_actualizacion',
        ).order_by('-fecha_actualizacion', '-id')

        if busqueda:
            qs = qs.filter(
                Q(cedulaidentidad__icontains=busqueda)
                | Q(nombres__icontains=busqueda)
                | Q(apellidos__icontains=busqueda)
            )
        return qs

    def _entidades_de(self, empleados: list) -> list[Empleado]:
        antecedentes_por_empleado = self._antecedentes_cerrados_bulk(
            [e.pk for e in empleados]
        )
        respaldos = self._fecha_ingreso_respaldo_bulk([e.pk for e in empleados])
        from apps.personal.infrastructure.mappers.mapper_personal import contrato_a_dict
        contratos_qs = ContratoModel.objects.filter(
            antecedente__empleado_id__in=[e.pk for e in empleados]
        ).select_related('estatus', 'politica', 'antecedente').order_by('-pk')
        contrato_por_empleado = {}
        for c in contratos_qs:
            emp_id = c.antecedente.empleado_id
            if emp_id not in contrato_por_empleado:
                contrato_por_empleado[emp_id] = contrato_a_dict(c)

        resultado = []
        for e in empleados:
            antecedentes = antecedentes_por_empleado.get(e.pk, [])
            apn = apn_oficial(
                antecedentes, fecha_ingreso_respaldo=respaldos.get(e.pk),
            )
            resultado.append(
                empleado_a_entidad(
                    e,
                    antecedentes,
                    expediente={'contrato_actual': contrato_por_empleado.get(e.pk)},
                    apn=apn,
                )
            )
        return resultado

    def listar_empleados(
        self,
        busqueda: str | None = None,
        codigo: str | None = None,
        tipo_nomina: str | int | None = None,
        dependencia_id: int | None = None,
        direccion_general_id: int | None = None,
        direccion_linea_id: int | None = None,
        coordinacion_id: int | None = None,
    ) -> list[Empleado]:
        qs = self._filtrar_empleados(
            busqueda=busqueda,
            codigo=codigo,
            tipo_nomina=tipo_nomina,
            dependencia_id=dependencia_id,
            direccion_general_id=direccion_general_id,
            direccion_linea_id=direccion_linea_id,
            coordinacion_id=coordinacion_id,
        )
        return self._entidades_de(list(qs))

    def listar_empleados_paginados(
        self,
        *,
        limit: int,
        offset: int,
        busqueda: str | None = None,
        codigo: str | None = None,
        tipo_nomina: str | int | None = None,
        dependencia_id: int | None = None,
        direccion_general_id: int | None = None,
        direccion_linea_id: int | None = None,
        coordinacion_id: int | None = None,
    ) -> tuple[list[Empleado], int]:
        """Página de activos y total de coincidencias, sin traer todas las filas."""
        qs = self._filtrar_empleados(
            busqueda=busqueda,
            codigo=codigo,
            tipo_nomina=tipo_nomina,
            dependencia_id=dependencia_id,
            direccion_general_id=direccion_general_id,
            direccion_linea_id=direccion_linea_id,
            coordinacion_id=coordinacion_id,
        )
        total = qs.count()
        empleados = list(qs[offset:offset + limit])
        return self._entidades_de(empleados), total

    def obtener_por_cedula(self, cedula: str) -> Empleado | None:
        cedula_str = str(cedula).strip() if cedula else ""
        cedula_limpia = "".join(filter(str.isdigit, cedula_str)) if cedula_str else ""
        qs = EmployeeModel.objects.select_related('sexoid', 'estadoCivil', 'nacionalidad')
        fila = (
            qs.filter(cedulaidentidad=cedula_str).first()
            or (qs.filter(cedulaidentidad=cedula_limpia).first() if cedula_limpia else None)
        )
        if not fila:
            return None
        # Expediente anidado (Fase 2.2 del plan de reparación): solo se arma
        # en el detalle, no en el listado, para no pagar N+1 consultas por fila.
        # Los antecedentes se cargan una vez y se reutilizan para el total APN
        # y para el expediente (antes se consultaban dos veces).
        antecedentes = _antecedentes_empleado(fila.pk)
        expediente = construir_expediente(fila, antecedentes=antecedentes)
        # El respaldo del APN en curso sale de los contratos del expediente
        # (ya ordenados por `-pk`): evita repetir la consulta de contratos.
        ingreso_respaldo = next(
            (c['fecha_ingreso'] for c in expediente.get('contratos', []) if c and c.get('fecha_ingreso')),
            None,
        )
        respaldo = date.fromisoformat(ingreso_respaldo) if ingreso_respaldo else None
        apn = apn_oficial(antecedentes, fecha_ingreso_respaldo=respaldo)
        expediente['correo_alternativo'] = self._correo_alternativo_de(fila.cedulaidentidad)
        return empleado_a_entidad(fila, antecedentes, expediente=expediente, apn=apn)

    @staticmethod
    def _validar_correo_libre(correo: str | None, excluir_cedula: str | None = None) -> None:
        """El correo institucional es único: se avisa sobre el campo en vez de fallar con un 500."""
        if not correo:
            return
        c_limpio = correo.strip().lower()
        qs = EmployeeModel.objects.filter(correo__iexact=c_limpio)
        if excluir_cedula:
            qs = qs.exclude(cedulaidentidad=excluir_cedula)
        if qs.exists():
            raise ValidationError('Ya existe un trabajador con ese correo electrónico.', campo='correo')

        from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
        qs_alt = DatosComplementariosTrabajadorModel.objects.filter(correo_alternativo__iexact=c_limpio)
        if excluir_cedula:
            qs_alt = qs_alt.exclude(cedula=str(excluir_cedula).strip())
        if qs_alt.exists():
            raise ValidationError(
                'El correo institucional no puede coincidir con un correo alternativo registrado.',
                campo='correo',
            )

    @staticmethod
    def _validar_correo_alternativo_unico(
        correo_alternativo: str | None,
        cedula: str | None = None,
        correo_institucional: str | None = None,
    ) -> None:
        """El correo alternativo es ÚNICO (FIX-QA11): distinto de cualquier institucional o alternativo ajeno o propio."""
        if not correo_alternativo or not correo_alternativo.strip():
            return
        alt = correo_alternativo.strip().lower()

        # 1. Distinto del propio institucional
        if correo_institucional and correo_institucional.strip().lower() == alt:
            raise ValidationError(
                'El correo alternativo debe ser distinto del correo institucional.',
                campo='correo_alternativo',
            )
        if not correo_institucional and cedula:
            propio = EmployeeModel.objects.filter(
                cedulaidentidad=str(cedula).strip()
            ).values_list('correo', flat=True).first()
            if propio and propio.strip().lower() == alt:
                raise ValidationError(
                    'El correo alternativo debe ser distinto del correo institucional.',
                    campo='correo_alternativo',
                )

        # 2. Distinto de cualquier correo institucional en el sistema
        if EmployeeModel.objects.filter(correo__iexact=alt).exists():
            raise ValidationError(
                'El correo alternativo ya está en uso como correo institucional.',
                campo='correo_alternativo',
            )

        # 3. Distinto de cualquier alternativo de otra persona
        from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
        qs_alt = DatosComplementariosTrabajadorModel.objects.filter(correo_alternativo__iexact=alt)
        if cedula:
            qs_alt = qs_alt.exclude(cedula=str(cedula).strip())
        if qs_alt.exists():
            raise ValidationError(
                'El correo alternativo ya está en uso por otro trabajador.',
                campo='correo_alternativo',
            )

    @staticmethod
    def _correo_alternativo_de(cedula: str) -> str | None:
        """Correo alternativo del trabajador (vive en los datos complementarios de autogestión)."""
        from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel

        valor = (
            DatosComplementariosTrabajadorModel.objects.filter(cedula=str(cedula).strip())
            .values_list('correo_alternativo', flat=True)
            .first()
        )
        return (valor or '').strip() or None

    @staticmethod
    def _guardar_correo_alternativo(cedula: str, correo: str | None) -> None:
        from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel

        fila, _ = DatosComplementariosTrabajadorModel.objects.get_or_create(cedula=str(cedula).strip())
        fila.correo_alternativo = (correo or '').strip() or None
        fila.save(update_fields=['correo_alternativo', 'actualizado_en'])

    @staticmethod
    def _fecha_ingreso_respaldo_bulk(empleado_ids: list) -> dict:
        """Fecha de ingreso del contrato más reciente por empleado (respaldo si no hay antecedente abierto)."""
        agrupado: dict = {}
        qs = (
            ContratoModel.objects.filter(
                antecedente__empleado_id__in=empleado_ids,
                antecedente__fecha_ingreso__isnull=False,
            )
            .select_related('antecedente')
            .order_by('antecedente__empleado_id', '-pk')
        )
        for c in qs:
            emp_id = c.antecedente.empleado_id
            if emp_id not in agrupado:
                agrupado[emp_id] = c.antecedente.fecha_ingreso
        return agrupado

    def _antecedentes_cerrados_bulk(self, empleado_ids: list) -> dict:
        """Todos los antecedentes por empleado (cerrados y abiertos) para el APN oficial."""
        agrupado: dict = {}
        qs = AntecedenteServicioModel.objects.filter(empleado_id__in=empleado_ids)
        for ant in qs:
            agrupado.setdefault(ant.empleado_id, []).append(ant)
        return agrupado

    # ------------------------------------------------------------------
    # Escritura — datos básicos
    # ------------------------------------------------------------------
    def crear_empleado(self, datos: dict) -> Empleado:
        nested = self._pop_nested(datos)
        correo_alternativo = datos.pop('correo_alternativo', None)
        if EmployeeModel.objects.filter(cedulaidentidad=datos['cedula']).exists():
            raise ValidationError('Ya existe un trabajador con esa cédula de identidad.', campo='cedula')
        self._validar_correo_libre(datos.get('correo'))
        self._validar_correo_alternativo_unico(correo_alternativo, cedula=datos['cedula'], correo_institucional=datos.get('correo'))
        with transaction.atomic():
            obj = EmployeeModel.objects.create(
                cedulaidentidad=datos['cedula'],
                nombres=datos['nombres'],
                apellidos=datos['apellidos'],
                sexoid_id=datos['sexo_id'],
                correo=datos.get('correo'),
                telefono_movil=datos.get('telefono_movil'),
                telefono_habitacion=datos.get('telefono_habitacion'),
                fecha_nacimiento=datos.get('fecha_nacimiento'),
                estadoCivil_id=datos.get('estado_civil_id'),
                carnet_patria=datos.get('carnet_patria'),
                carnet_patria_serial=datos.get('carnet_patria_serial'),
                nacionalidad_id=datos.get('nacionalidad_id', 1) or 1,
            )
            self._guardar_datos_anidados(obj, nested)
            if correo_alternativo:
                self._guardar_correo_alternativo(obj.cedulaidentidad, correo_alternativo)
        return self.obtener_por_cedula(obj.cedulaidentidad)

    def guardar_foto(self, cedula: str, clave: str) -> None:
        # save() y no queryset.update(): así se dispara post_save y se invalida la caché de
        # «Mi ficha» (la foto nueva se ve al instante, QA 2026-11-03).
        fila = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if fila is not None:
            fila.profile = clave
            fila.save(update_fields=['profile'])

    def obtener_clave_foto(self, cedula: str) -> str | None:
        valor = EmployeeModel.objects.filter(cedulaidentidad=cedula).values_list('profile', flat=True).first()
        return valor.strip() if valor and isinstance(valor, str) and valor.strip() else None

    def actualizar_empleado(self, cedula: str, datos: dict) -> Empleado:
        nested = self._pop_nested(datos)
        escribe_alternativo = 'correo_alternativo' in datos
        correo_alternativo = datos.pop('correo_alternativo', None)
        with transaction.atomic():
            obj = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
            if not obj:
                raise NotFoundError(f"Empleado con cédula {cedula} no encontrado")
            if datos.get('correo') and datos['correo'].strip().lower() != (obj.correo or '').strip().lower():
                self._validar_correo_libre(datos['correo'], excluir_cedula=obj.cedulaidentidad)
            if escribe_alternativo and (correo_alternativo or '').strip().lower() != (self._correo_alternativo_de(obj.cedulaidentidad) or '').strip().lower():
                self._validar_correo_alternativo_unico(correo_alternativo, cedula=obj.cedulaidentidad, correo_institucional=datos.get('correo') or obj.correo)
            if 'nacionalidad_id' in datos and datos['nacionalidad_id']:
                obj.nacionalidad_id = datos['nacionalidad_id']
            for k, v in datos.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)
            obj.save()
            self._guardar_datos_anidados(obj, nested)
            if escribe_alternativo:
                self._guardar_correo_alternativo(obj.cedulaidentidad, correo_alternativo)
        return self.obtener_por_cedula(cedula)

    @staticmethod
    def _pop_nested(datos: dict) -> dict:
        """
        Extrae del dict plano las claves de datos anidados (mismo contrato
        que `RAC/serializers/personal_activo_serializers.py::_pop_nested_data`).
        No falla si faltan: cada clave por defecto es `None` (no-op aguas
        abajo, igual que el legado).
        """
        return {
            'vivienda': datos.pop('datos_vivienda', None),
            'salud': datos.pop('perfil_salud', None),
            'fisico': datos.pop('perfil_fisico', None),
            'academico': datos.pop('formacion_academica', None),
            'complementaria': datos.pop('formacion_complementaria', None),
            'contacto_emergencia': datos.pop('contacto_emergencia', None),
            'antecedentes': datos.pop('antecedentes', None),
            'contrato': datos.pop('contrato', None),
        }

    def _guardar_datos_anidados(self, empleado: EmployeeModel, nested: dict) -> None:
        self._upsert_vivienda(empleado, nested.get('vivienda'))
        self._upsert_salud(empleado, nested.get('salud'))
        self._upsert_perfil_fisico(empleado, nested.get('fisico'))
        self._upsert_academico(empleado, nested.get('academico'))
        self._upsert_formacion_complementaria(empleado, nested.get('complementaria'))
        self._replace_contacto_emergencia(empleado, nested.get('contacto_emergencia'))
        self._replace_antecedentes(empleado, nested.get('antecedentes'))
        self._upsert_contrato(empleado, nested.get('contrato'))

    # ------------------------------------------------------------------
    # Nested — vivienda / salud / académico / contacto de emergencia
    # (réplica funcional de `RAC/services/profile_services.py`, sobre los
    # modelos espejo propios de `apps.personal` — ver nota de alcance en
    # `expediente_models.py`)
    # ------------------------------------------------------------------
    def _upsert_vivienda(self, empleado: EmployeeModel, data: dict | None) -> None:
        if not data:
            return
        DatosViviendaModel.objects.update_or_create(
            empleado=empleado,
            defaults=self._normalizar_fks(
                data,
                ('estado', 'municipio', 'parroquia', 'condicion_vivienda', 'codigo_postal'),
            ),
        )

    def _upsert_salud(self, empleado: EmployeeModel, data: dict | None) -> None:
        if not data:
            return
        defaults = {}
        if 'grupo_sanguineo_id' in data and data['grupo_sanguineo_id'] is not None:
            defaults['grupo_sanguineo_id'] = data['grupo_sanguineo_id']
        elif 'grupo_sanguineo_id' in data:
            defaults['grupo_sanguineo_id'] = None
        obj, _ = PerfilSaludModel.objects.update_or_create(empleado=empleado, defaults=defaults)
        if 'alergias' in data and data['alergias'] is not None:
            obj.alergias.set(data['alergias'])
        if 'patologias_cronicas' in data and data['patologias_cronicas'] is not None:
            obj.patologiaCronica.set(data['patologias_cronicas'])
        if 'discapacidades' in data and data['discapacidades'] is not None:
            obj.discapacidad.set(data['discapacidades'])

    def _upsert_perfil_fisico(self, empleado: EmployeeModel, data: dict | None) -> None:
        if not data:
            return
        PerfilFisicoModel.objects.update_or_create(empleado=empleado, defaults={
            'tallaCamisa_id': data.get('talla_camisa_id'),
            'tallaPantalon_id': data.get('talla_pantalon_id'),
            'tallaZapatos_id': data.get('talla_zapatos_id'),
            'tallaChaqueta_id': data.get('talla_chaqueta_id'),
        })

    def _upsert_formacion_complementaria(self, empleado: EmployeeModel, data) -> None:
        if not data:
            return
        campos_fk = ('capacitacion', 'institucion', 'procedencia', 'grupo')
        if isinstance(data, list):
            FormacionComplementariaModel.objects.filter(empleado=empleado).delete()
            for item in data:
                FormacionComplementariaModel.objects.create(
                    empleado=empleado, **self._normalizar_fks(item, campos_fk)
                )
        else:
            FormacionComplementariaModel.objects.update_or_create(
                empleado=empleado, defaults=self._normalizar_fks(data, campos_fk)
            )

    def _upsert_academico(self, empleado: EmployeeModel, data) -> None:
        if not data:
            return
        campos_fk = ('nivel_academico', 'carrera', 'mencion', 'institucion')
        if isinstance(data, list):
            FormacionAcademicaModel.objects.filter(empleado=empleado).delete()
            for item in data:
                FormacionAcademicaModel.objects.create(
                    empleado=empleado, **self._normalizar_fks(item, campos_fk)
                )
        else:
            FormacionAcademicaModel.objects.update_or_create(
                empleado=empleado, defaults=self._normalizar_fks(data, campos_fk)
            )

    def _replace_contacto_emergencia(self, empleado: EmployeeModel, data_list) -> None:
        if data_list is None:
            return
        ContactoEmergenciaModel.objects.filter(empleado=empleado).delete()
        for item in data_list:
            ContactoEmergenciaModel.objects.create(
                empleado=empleado, **self._normalizar_fks(item, ('relacion',))
            )

    def _replace_antecedentes(self, empleado: EmployeeModel, data_list) -> None:
        """Réplica exacta de `profile_services.py::replace_antecedentes`."""
        if data_list is None:
            return
        existentes = AntecedenteServicioModel.objects.filter(empleado=empleado)
        ids_existentes = set(existentes.values_list('id', flat=True))
        protegidos = set(
            ContratoModel.objects.filter(
                antecedente_id__in=ids_existentes,
            ).values_list('antecedente_id', flat=True)
        )
        conservados = set()
        for item in data_list:
            if not item.get('fecha_ingreso'):
                continue
            normalizado = self._normalizar_fks(item, ('organismo',))
            coincidencia = existentes.filter(
                organismo=normalizado.get('organismo_id') or normalizado.get('organismo'),
                fecha_ingreso=normalizado.get('fecha_ingreso'),
                fecha_egreso=normalizado.get('fecha_egreso'),
            ).first()
            if coincidencia:
                conservados.add(coincidencia.id)
                continue
            AntecedenteServicioModel.objects.create(empleado=empleado, **normalizado)
        eliminables = ids_existentes - conservados - protegidos
        if eliminables:
            AntecedenteServicioModel.objects.filter(id__in=eliminables).delete()

    @staticmethod
    def _normalizar_fks(datos: dict, campos: tuple[str, ...]) -> dict:
        """Traduce IDs sueltos a `<campo>_id` en las claves foráneas.

        El alta de activos entrega instancias ya validadas por el serializer;
        el alta directa de pasivos entrega IDs. `create`/`update_or_create`
        solo aceptan la instancia o el sufijo `_id`, nunca el número crudo.
        """
        normalizado = {}
        for clave, valor in datos.items():
            if clave in campos and valor is not None and not isinstance(valor, Model):
                normalizado[f'{clave}_id'] = valor
            else:
                normalizado[clave] = valor
        return normalizado

    # ------------------------------------------------------------------
    # Contrato (R-09): implementa el puerto `RepoContratos` del caso de uso
    # `apps/personal/application/use_cases/upsert_contrato.py`.
    # ------------------------------------------------------------------
    def _upsert_contrato(self, empleado: EmployeeModel, contrato_data) -> None:
        from apps.personal.application.use_cases.upsert_contrato import (
            upsert_contrato as _upsert_contrato_uc,
        )
        if not contrato_data:
            return
        _upsert_contrato_uc(self, cedula=empleado.cedulaidentidad, contrato_data=contrato_data)

    def contar_contratos_de_empleado(self, cedula: str) -> int:
        return ContratoModel.objects.filter(
            antecedente__empleado__cedulaidentidad=cedula,
        ).count()

    def buscar_contrato_por_numero(self, cedula: str, n_contrato: str) -> dict | None:
        fila = ContratoModel.objects.filter(
            n_contrato=n_contrato, antecedente__empleado__cedulaidentidad=cedula,
        ).select_related('antecedente').first()
        if not fila:
            return None
        return {'id': fila.pk, 'n_contrato': fila.n_contrato, 'es_fijo': fila.es_fijo}

    def obtener_organismo_conatel(self):
        return OrganismoAdscritoModel.objects.filter(
            Organismoadscrito__iexact='CONATEL',
        ).first()

    def guardar_contrato(self, cedula: str, datos: dict) -> dict:
        empleado = EmployeeModel.objects.get(cedulaidentidad=cedula)
        existente_ref = datos['existente']

        if existente_ref:
            fila = ContratoModel.objects.select_related('antecedente').get(pk=existente_ref['id'])
            if fila.antecedente_id:
                fila.antecedente.fecha_ingreso = datos['fecha_ingreso']
                fila.antecedente.save()
        else:
            antecedente = AntecedenteServicioModel.objects.create(
                empleado=empleado,
                organismo=datos['organismo_conatel'],
                fecha_ingreso=datos['fecha_ingreso'],
            )
            fila = ContratoModel(n_contrato=datos['n_contrato'], antecedente=antecedente)

        politica = datos['politica_id']
        fila.fecha_culminacion = datos['fecha_culminacion']
        fila.politica_id = politica.pk if hasattr(politica, 'pk') else politica
        fila.es_fijo = datos['es_fijo']
        fila.estatus = EstatusModel.objects.get(estatus__iexact=datos['clave_estatus'].value)
        fila.save()

        if datos['clave_estatus'].value == 'vencido' and fila.antecedente_id:
            ant = fila.antecedente
            if not ant.fecha_egreso:
                ant.fecha_egreso = date.today()
                ant.save()

        return {'id': fila.pk, 'n_contrato': fila.n_contrato, 'es_fijo': fila.es_fijo}

    # ------------------------------------------------------------------
    # Catálogos de soporte del expediente (solo lectura, Fase paridad 6.1)
    # ------------------------------------------------------------------
    def listar_politicas(self) -> list:
        return list(PoliticaModel.objects.all().order_by('tipo_politica'))

    def listar_condiciones_vivienda(self) -> list:
        return list(CondicionViviendaModel.objects.all().order_by('condicion'))

    def listar_codigos_postales(self, estado_id: int | None = None) -> list:
        qs = CodigoPostalModel.objects.select_related('estado_id').all().order_by('codigo')
        if estado_id is not None:
            qs = qs.filter(estado_id=estado_id)
        return list(qs)

    def listar_grupos_sanguineos(self) -> list:
        return list(GrupoSanguineoModel.objects.all().order_by('GrupoSanguineo'))

    def listar_niveles_academicos(self) -> list:
        return list(NivelAcademicoModel.objects.all().order_by('nivelacademico'))

    def listar_carreras(self, nivel_academico_id: int | None = None) -> list:
        qs = CarreraModel.objects.all().order_by('nombre_carrera')
        if nivel_academico_id is not None:
            qs = qs.filter(nivel_academico_id=nivel_academico_id)
        return list(qs)

    def listar_menciones(self, carrera_id: int | None = None) -> list:
        qs = MencionModel.objects.select_related('carrera_id').all().order_by('nombre_mencion')
        if carrera_id is not None:
            qs = qs.filter(carrera_id=carrera_id)
        return list(qs)

    def listar_instituciones(self) -> list:
        return list(InstitucionModel.objects.all().order_by('nombre_institucion'))

    def listar_tipos_prenda(self) -> list:
        return list(TipoPrendaModel.objects.all().order_by('categoria'))

    def listar_regiones_talla(self) -> list:
        return list(RegionTallaModel.objects.all().order_by('codigo'))

    def listar_tallas(self, tipo_prenda_id: int | None = None) -> list:
        qs = TallaModel.objects.select_related('tipo_prenda', 'region').all().order_by('valor')
        if tipo_prenda_id is not None:
            qs = qs.filter(tipo_prenda_id=tipo_prenda_id)
        return list(qs)

    def listar_capacitaciones(self) -> list:
        return list(CapacitacionModel.objects.all().order_by('nombre_capacitacion'))

    def listar_grupos_capacitacion(self) -> list:
        return list(GrupoCapacitacionModel.objects.all().order_by('nombre_grupo'))

    def listar_alergias(self) -> list:
        return list(AlergiaModel.objects.select_related('categoria').all().order_by('alergia'))

    def listar_patologias(self) -> list:
        return list(PatologiaCronicaModel.objects.select_related('categoria').all().order_by('patologia'))

    def listar_discapacidades(self) -> list:
        return list(DiscapacidadModel.objects.select_related('categoria').all().order_by('discapacidad'))
