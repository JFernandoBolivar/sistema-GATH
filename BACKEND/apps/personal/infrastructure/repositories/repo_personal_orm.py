"""
Repositorio ORM de Personal (Reglas B4, B7, D-09).
"""
from datetime import date

from django.db import transaction
from django.db.models import Q

from core.domain.exceptions import NotFoundError
from apps.personal.domain.entities.empleado import Empleado
from apps.personal.infrastructure.mappers.mapper_personal import (
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


class RepoPersonalORM:
    # ------------------------------------------------------------------
    # Lectura
    # ------------------------------------------------------------------
    def listar_empleados(
        self,
        busqueda: str | None = None,
        codigo: str | None = None,
        tipo_nomina: str | int | None = None,
    ) -> list[Empleado]:
        qs = EmployeeModel.objects.select_related('sexoid', 'estadoCivil').all().order_by('-fecha_actualizacion')
        if busqueda:
            qs = qs.filter(
                Q(cedulaidentidad__icontains=busqueda)
                | Q(nombres__icontains=busqueda)
                | Q(apellidos__icontains=busqueda)
            )
        if codigo:
            from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
            emp_cedulas = AsigTrabajoModel.objects.filter(codigo__icontains=codigo).values_list('employee_id', flat=True)
            qs = qs.filter(cedulaidentidad__in=emp_cedulas)
        if tipo_nomina:
            from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
            emp_cedulas = AsigTrabajoModel.objects.filter(tiponominaid_id=tipo_nomina).values_list('employee_id', flat=True)
            qs = qs.filter(cedulaidentidad__in=emp_cedulas)
        empleados = list(qs)
        antecedentes_por_empleado = self._antecedentes_cerrados_bulk(
            [e.pk for e in empleados]
        )
        from apps.personal.infrastructure.mappers.mapper_personal import contrato_a_dict
        contratos_qs = ContratoModel.objects.filter(
            antecedente__empleado_id__in=[e.pk for e in empleados]
        ).select_related('estatus', 'politica', 'antecedente').order_by('-pk')
        contrato_por_empleado = {}
        for c in contratos_qs:
            emp_id = c.antecedente.empleado_id
            if emp_id not in contrato_por_empleado:
                contrato_por_empleado[emp_id] = contrato_a_dict(c)

        return [
            empleado_a_entidad(
                e,
                antecedentes_por_empleado.get(e.pk, []),
                expediente={'contrato_actual': contrato_por_empleado.get(e.pk)},
            )
            for e in empleados
        ]

    def obtener_por_cedula(self, cedula: str) -> Empleado | None:
        fila = (
            EmployeeModel.objects.select_related('sexoid', 'estadoCivil')
            .filter(cedulaidentidad=cedula)
            .first()
        )
        if not fila:
            return None
        # Expediente anidado (Fase 2.2 del plan de reparación): solo se arma
        # en el detalle, no en el listado, para no pagar N+1 consultas por fila.
        return empleado_a_entidad(
            fila,
            _antecedentes_cerrados(fila.pk),
            expediente=construir_expediente(fila),
        )

    def _antecedentes_cerrados_bulk(self, empleado_ids: list) -> dict:
        agrupado: dict = {}
        qs = AntecedenteServicioModel.objects.filter(
            empleado_id__in=empleado_ids, fecha_egreso__isnull=False,
        )
        for ant in qs:
            agrupado.setdefault(ant.empleado_id, []).append(ant)
        return agrupado

    # ------------------------------------------------------------------
    # Escritura — datos básicos
    # ------------------------------------------------------------------
    def crear_empleado(self, datos: dict) -> Empleado:
        nested = self._pop_nested(datos)
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
            )
            self._guardar_datos_anidados(obj, nested)
        return self.obtener_por_cedula(obj.cedulaidentidad)

    def guardar_foto(self, cedula: str, clave: str) -> None:
        EmployeeModel.objects.filter(cedulaidentidad=cedula).update(profile=clave)

    def actualizar_empleado(self, cedula: str, datos: dict) -> Empleado:
        nested = self._pop_nested(datos)
        with transaction.atomic():
            obj = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
            if not obj:
                raise NotFoundError(f"Empleado con cédula {cedula} no encontrado")
            for k, v in datos.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)
            obj.save()
            self._guardar_datos_anidados(obj, nested)
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
        DatosViviendaModel.objects.update_or_create(empleado=empleado, defaults=data)

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
        if isinstance(data, list):
            FormacionComplementariaModel.objects.filter(empleado=empleado).delete()
            for item in data:
                FormacionComplementariaModel.objects.create(empleado=empleado, **item)
        else:
            FormacionComplementariaModel.objects.update_or_create(empleado=empleado, defaults=data)

    def _upsert_academico(self, empleado: EmployeeModel, data) -> None:
        if not data:
            return
        if isinstance(data, list):
            FormacionAcademicaModel.objects.filter(empleado=empleado).delete()
            for item in data:
                FormacionAcademicaModel.objects.create(empleado=empleado, **item)
        else:
            FormacionAcademicaModel.objects.update_or_create(empleado=empleado, defaults=data)

    def _replace_contacto_emergencia(self, empleado: EmployeeModel, data_list) -> None:
        if data_list is None:
            return
        ContactoEmergenciaModel.objects.filter(empleado=empleado).delete()
        for item in data_list:
            ContactoEmergenciaModel.objects.create(empleado=empleado, **item)

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
            coincidencia = existentes.filter(
                organismo=item.get('organismo'),
                fecha_ingreso=item.get('fecha_ingreso'),
                fecha_egreso=item.get('fecha_egreso'),
            ).first()
            if coincidencia:
                conservados.add(coincidencia.id)
                continue
            AntecedenteServicioModel.objects.create(empleado=empleado, **item)
        eliminables = ids_existentes - conservados - protegidos
        if eliminables:
            AntecedenteServicioModel.objects.filter(id__in=eliminables).delete()

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
