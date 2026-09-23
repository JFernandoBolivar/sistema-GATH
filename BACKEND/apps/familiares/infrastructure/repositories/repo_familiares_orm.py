"""
Repositorio ORM de Familiares (Reglas B4, B7).
"""
from core.domain.exceptions import NotFoundError
from apps.familiares.domain.entities.documento_familiar import DocumentoFamiliar
from apps.familiares.domain.entities.familiar import Familiar
from apps.familiares.infrastructure.mappers.mapper_familiares import (
    documento_familiar_a_entidad,
    familiar_a_entidad,
)
from apps.familiares.infrastructure.models.familiar_models import (
    EmployeefamilyModel,
    FamilyDocumentModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    FormacionAcademicaModel,
    PerfilFisicoModel,
    PerfilSaludModel,
)


class RepoFamiliaresORM:
    def listar_por_empleado(self, empleado_cedula: str) -> list[Familiar]:
        qs = (
            EmployeefamilyModel.objects.select_related('parentesco', 'sexo')
            .filter(employeecedula_id=empleado_cedula)
            .order_by('-updatedat')
        )
        return [familiar_a_entidad(f) for f in qs]

    def obtener_familiar(self, familiar_id: int) -> Familiar | None:
        fila = (
            EmployeefamilyModel.objects.select_related('parentesco', 'sexo')
            .filter(pk=familiar_id)
            .first()
        )
        return familiar_a_entidad(fila) if fila else None

    def crear_familiar(self, familiar_datos: dict) -> Familiar:
        obj = EmployeefamilyModel.objects.create(
            employeecedula_id=familiar_datos['empleado_cedula'],
            primer_nombre=familiar_datos['primer_nombre'],
            segundo_nombre=familiar_datos.get('segundo_nombre'),
            primer_apellido=familiar_datos['primer_apellido'],
            segundo_apellido=familiar_datos.get('segundo_apellido'),
            cedulaFamiliar=familiar_datos.get('cedula_familiar'),
            parentesco_id=familiar_datos['parentesco_id'],
            fechanacimiento=familiar_datos['fecha_nacimiento'],
            sexo_id=familiar_datos['sexo_id'],
            mismo_ente=familiar_datos.get('mismo_ente', False),
            heredero=familiar_datos.get('heredero', False),
            observaciones=familiar_datos.get('observaciones'),
        )
        self._upsert_salud(obj, familiar_datos.get('perfil_salud'))
        self._upsert_perfil_fisico(obj, familiar_datos.get('perfil_fisico'))
        self._upsert_academico(obj, familiar_datos.get('formacion_academica'))
        return self.obtener_familiar(obj.pk)

    # Alias entre nombres de campo del DTO/serializer (snake_case) y los
    # atributos reales del modelo espejo (mismos alias que exige `crear_familiar`
    # -- `cedulaFamiliar`/`fechanacimiento` no siguen snake_case en la tabla física).
    _ALIAS_CAMPOS = {
        'cedula_familiar': 'cedulaFamiliar',
        'fecha_nacimiento': 'fechanacimiento',
    }

    def actualizar_familiar(self, familiar_id: int, datos: dict) -> Familiar:
        obj = EmployeefamilyModel.objects.filter(pk=familiar_id).first()
        if not obj:
            raise NotFoundError(f"Familiar con id {familiar_id} no encontrado")
        perfil_salud = datos.pop('perfil_salud', None)
        perfil_fisico = datos.pop('perfil_fisico', None)
        formacion_academica = datos.pop('formacion_academica', None)
        datos.pop('empleado_cedula', None)
        for k, v in datos.items():
            atributo = self._ALIAS_CAMPOS.get(k, k)
            if hasattr(obj, atributo):
                setattr(obj, atributo, v)
        obj.save()
        self._upsert_salud(obj, perfil_salud)
        self._upsert_perfil_fisico(obj, perfil_fisico)
        self._upsert_academico(obj, formacion_academica)
        return self.obtener_familiar(familiar_id)

    # ------------------------------------------------------------------
    # Nested — salud / físico / académico (réplica funcional de
    # `apps.personal.infrastructure.repositories.repo_personal_orm`, sobre
    # las mismas tablas físicas compartidas empleado/familiar).
    # ------------------------------------------------------------------
    def _upsert_salud(self, familiar: EmployeefamilyModel, data: dict | None) -> None:
        if not data:
            return
        defaults = {}
        if 'grupo_sanguineo_id' in data:
            defaults['grupo_sanguineo_id'] = data['grupo_sanguineo_id']
        obj, _ = PerfilSaludModel.objects.update_or_create(familiar=familiar, defaults=defaults)
        if 'alergias' in data and data['alergias'] is not None:
            obj.alergias.set(data['alergias'])
        if 'patologias_cronicas' in data and data['patologias_cronicas'] is not None:
            obj.patologiaCronica.set(data['patologias_cronicas'])
        if 'discapacidades' in data and data['discapacidades'] is not None:
            obj.discapacidad.set(data['discapacidades'])

    def _upsert_perfil_fisico(self, familiar: EmployeefamilyModel, data: dict | None) -> None:
        if not data:
            return
        PerfilFisicoModel.objects.update_or_create(familiar=familiar, defaults={
            'tallaCamisa_id': data.get('talla_camisa_id'),
            'tallaPantalon_id': data.get('talla_pantalon_id'),
            'tallaZapatos_id': data.get('talla_zapatos_id'),
            'tallaChaqueta_id': data.get('talla_chaqueta_id'),
        })

    def _upsert_academico(self, familiar: EmployeefamilyModel, data: dict | None) -> None:
        if not data:
            return
        FormacionAcademicaModel.objects.update_or_create(familiar=familiar, defaults={
            'nivel_academico_id': data.get('nivel_academico_id'),
            'carrera_id': data.get('carrera_id'),
            'mencion_id': data.get('mencion_id'),
            'institucion_id': data.get('institucion_id'),
        })

    def eliminar_familiar(self, familiar_id: int) -> None:
        obj = EmployeefamilyModel.objects.filter(pk=familiar_id).first()
        if not obj:
            raise NotFoundError(f"Familiar con id {familiar_id} no encontrado")
        obj.delete()

    def listar_documentos(self, familiar_id: int) -> list[DocumentoFamiliar]:
        qs = FamilyDocumentModel.objects.filter(familymember_id=familiar_id).order_by('-uploaded_at')
        return [documento_familiar_a_entidad(d) for d in qs]

    def crear_documento(self, familiar_id: int, tipo_documento: str, clave: str) -> DocumentoFamiliar:
        obj = FamilyDocumentModel.objects.create(
            familymember_id=familiar_id, document_type=tipo_documento, file=clave,
        )
        return documento_familiar_a_entidad(obj)
