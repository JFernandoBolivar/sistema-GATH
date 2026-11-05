"""
Aplicación de los cambios APROBADOS a los datos reales (puerto `AplicadorCambios`, B3/B6).

Las tablas del trabajador son legadas (managed=False) y no se alteran: se escribe a través de
los repositorios ya existentes de `personal` y `familiares` (y de los modelos espejo de
formación y contacto de emergencia, que no tienen operación unitaria en un repositorio).
Debe invocarse dentro de la transacción de la decisión: toma el lock de la fila del trabajador.
"""
from collections import defaultdict
from datetime import date
from pathlib import PurePosixPath

from django.db.models import ProtectedError

from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

from apps.autogestion.domain.entities.solicitud_actualizacion import CambioPropuesto, SoporteDocumental
from apps.autogestion.domain.value_objects.secciones import Accion
from apps.autogestion.infrastructure.cache.mi_expediente_cache import invalidar_mi_expediente
from apps.autogestion.infrastructure.repositories.lector_ficha_orm import LectorFichaORM
from apps.autogestion.infrastructure.repositories.repo_secciones_complementarios_orm import RepoDatosComplementariosORM
from apps.familiares.application.use_cases.validaciones_familiar import resolver_cedula_familiar
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.familiares.infrastructure.repositories.repo_familiares_orm import RepoFamiliaresORM
from apps.personal.infrastructure.models.expediente_models import (
    ContactoEmergenciaModel,
    FormacionAcademicaModel,
    FormacionComplementariaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError

_MODELOS_LEGADOS = {
    'formacion_academica': FormacionAcademicaModel,
    'formacion_complementaria': FormacionComplementariaModel,
    'contacto_emergencia': ContactoEmergenciaModel,
}
# El modelo legado de formación complementaria usa otros nombres de atributo.
_CAMPOS_COMPLEMENTARIA = {
    'fecha_inicio': 'fechaInicio', 'fecha_fin': 'fechaFin', 'capacitacion_id': 'capacitacion_id',
    'institucion_id': 'institucion_id', 'procedencia_id': 'procedencia_id', 'grupo_id': 'grupo_id',
}
_DOCUMENTO_FAMILIAR = {'CEDULA': 'cedula', 'ACTA_NACIMIENTO': 'partida_nacimiento'}


class AplicadorCambiosORM:
    def __init__(self, almacen=None):
        self._lector = LectorFichaORM()
        self._almacen = almacen or SeaweedFSStorage()

    def aplicar(self, cedula: str, cambios: list[CambioPropuesto], soportes: list[SoporteDocumental], actor_cedula: str) -> None:
        empleado = EmployeeModel.objects.select_for_update().filter(cedulaidentidad=cedula).first()
        if empleado is None:
            raise NotFoundError("El trabajador ya no existe en la ficha.")
        por_soporte = {s.id: s for s in soportes}

        datos_empleado: dict = {}
        vivienda: dict = {}
        complementarios: dict = {}
        foto: str | None = None
        ediciones: dict[tuple, dict] = defaultdict(dict)  # (entidad, id) -> campos
        eliminaciones: list[CambioPropuesto] = []
        ids_creados: dict[tuple[str, str], int] = {}
        for c in cambios:
            if c.accion == Accion.CREAR.value:
                nuevo_id = self._crear(cedula, c)
                if c.referencia and nuevo_id:
                    ids_creados[(c.entidad_destino, c.referencia)] = nuevo_id
            elif c.accion == Accion.ELIMINAR.value:
                eliminaciones.append(c)
            elif c.entidad_destino == 'employee' and c.campo == 'profile':
                soporte = por_soporte.get((c.valor_propuesto or {}).get('soporte_id'))
                if soporte is None:
                    raise ConflictError("La foto aprobada ya no tiene su soporte asociado.")
                foto = soporte.clave_s3
            elif c.entidad_destino == 'employee':
                datos_empleado[c.campo] = c.valor_propuesto
            elif c.entidad_destino == 'datos_vivienda':
                vivienda[c.campo] = c.valor_propuesto
            elif c.entidad_destino == 'datos_complementarios':
                complementarios[c.campo] = c.valor_propuesto
            else:
                ediciones[(c.entidad_destino, c.entidad_id)][c.campo] = c.valor_propuesto

        if vivienda:
            datos_empleado['datos_vivienda'] = vivienda
        if datos_empleado:
            RepoPersonalORM().actualizar_empleado(cedula, datos_empleado)
        if foto:
            RepoPersonalORM().guardar_foto(cedula, foto)
        if complementarios:
            RepoDatosComplementariosORM().guardar(cedula, complementarios, actor_cedula)
        for (entidad, entidad_id), campos in ediciones.items():
            self._editar(cedula, entidad, entidad_id, campos)
        for c in eliminaciones:
            self._eliminar(cedula, c.entidad_destino, c.entidad_id)
        self._copiar_documentos_familiar(cedula, cambios, soportes, ids_creados)

    # ── Registros nuevos ──
    def _crear(self, cedula: str, c: CambioPropuesto) -> int | None:
        valores = dict(c.valor_propuesto)
        if c.entidad_destino == 'datos_vivienda':
            RepoPersonalORM().actualizar_empleado(cedula, {'datos_vivienda': valores})
            return None
        if c.entidad_destino == 'familiar':
            return self._crear_familiar(cedula, valores)
        if c.entidad_destino == 'formacion_complementaria':
            valores = {_CAMPOS_COMPLEMENTARIA.get(k, k): v for k, v in valores.items()}
            valores.setdefault('procedencia_id', self._procedencia_por_defecto())
        if c.entidad_destino in _MODELOS_LEGADOS:
            obj = _MODELOS_LEGADOS[c.entidad_destino].objects.create(
                empleado_id=self._empleado_pk(cedula), **self._fechas(c.entidad_destino, valores),
            )
            return obj.pk
        raise ConflictError(f"No se puede crear '{c.entidad_destino}'.")

    @staticmethod
    def _procedencia_por_defecto() -> int:
        from apps.catalogos.infrastructure.models.catalogo_models import TipoProcedenciaModel
        pk = TipoProcedenciaModel.objects.values_list('pk', flat=True).first()
        if pk is None:
            raise ConflictError(
                "No hay tipos de procedencia configurados: no se puede registrar la formación complementaria."
            )
        return pk

    @staticmethod
    def _fechas(entidad: str, valores: dict) -> dict:
        if entidad != 'formacion_complementaria':
            return valores
        datos = dict(valores)
        for campo in ('fechaInicio', 'fechaFin'):
            valor = datos.get(campo)
            if isinstance(valor, str) and valor:
                datos[campo] = date.fromisoformat(valor)
            elif valor == '':
                datos[campo] = None
        return datos

    @staticmethod
    def _empleado_pk(cedula: str) -> int:
        return EmployeeModel.objects.values_list('pk', flat=True).get(cedulaidentidad=cedula)

    def _crear_familiar(self, cedula: str, v: dict) -> int:
        fecha = date.fromisoformat(v['fecha_nacimiento'])
        existentes = EmployeefamilyModel.objects.filter(employeecedula_id=cedula)
        try:
            cedula_familiar = resolver_cedula_familiar(
                cedula_familiar=v.get('cedula_familiar'), cedula_empleado=cedula,
                es_hijo=self._es_hijo(v['parentesco_id']), fecha_nacimiento=fecha,
                siguiente_orden_hijo=existentes.count() + 1,
            )
        except ValueError as exc:
            raise ConflictError(f"No se pudo agregar al familiar: {exc} Rechace el campo o pida corregirlo.") from None
        if existentes.filter(cedulaFamiliar=cedula_familiar).exists():
            raise ConflictError("Este familiar ya se encuentra registrado para el trabajador.")
        familiar = RepoFamiliaresORM().crear_familiar({
            'empleado_cedula': cedula, 'cedula_familiar': cedula_familiar, 'fecha_nacimiento': fecha,
            **{k: v.get(k) for k in (
                'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido',
                'parentesco_id', 'sexo_id', 'observaciones',
            )},
        })
        return familiar.id

    @staticmethod
    def _es_hijo(parentesco_id: int) -> bool:
        from apps.catalogos.infrastructure.models.catalogo_models import ParentescoModel
        nombre = ParentescoModel.objects.filter(pk=parentesco_id).values_list('descripcion_parentesco', flat=True).first() or ''
        return nombre.upper().startswith('HIJO')

    # ── Ediciones de registros existentes ──
    def _editar(self, cedula: str, entidad: str, entidad_id: str, campos: dict) -> None:
        if not self._lector.pertenece_al_trabajador(cedula, entidad, entidad_id):
            raise ConflictError(f"El registro {entidad_id} de '{entidad}' ya no pertenece a la ficha.")
        if entidad == 'familiar':
            datos = dict(campos)
            if 'fecha_nacimiento' in datos:
                datos['fecha_nacimiento'] = date.fromisoformat(datos['fecha_nacimiento'])
            RepoFamiliaresORM().actualizar_familiar(int(entidad_id), datos)
        elif entidad == 'formacion_complementaria':
            datos = {_CAMPOS_COMPLEMENTARIA.get(k, k): v for k, v in campos.items()}
            _MODELOS_LEGADOS[entidad].objects.filter(pk=int(entidad_id)).update(
                **self._fechas(entidad, datos),
            )
            invalidar_mi_expediente(cedula)
        elif entidad in _MODELOS_LEGADOS:
            _MODELOS_LEGADOS[entidad].objects.filter(pk=int(entidad_id)).update(**campos)
            # queryset.update() no dispara post_save: se invalida «Mi ficha» a mano.
            invalidar_mi_expediente(cedula)
        else:
            raise ValidationError(f"Entidad no editable: '{entidad}'.")

    # ── Eliminación de registros ──
    def _eliminar(self, cedula: str, entidad: str, entidad_id: str | None) -> None:
        if entidad_id is None or not self._lector.pertenece_al_trabajador(cedula, entidad, entidad_id):
            raise ConflictError(f"El registro {entidad_id} de '{entidad}' ya no pertenece a la ficha.")
        try:
            if entidad == 'familiar':
                RepoFamiliaresORM().eliminar_familiar(int(entidad_id))
            elif entidad in _MODELOS_LEGADOS:
                _MODELOS_LEGADOS[entidad].objects.filter(pk=int(entidad_id)).delete()
                invalidar_mi_expediente(cedula)
            else:
                raise ValidationError(f"Entidad no eliminable: '{entidad}'.")
        except ProtectedError:
            raise ConflictError(
                f"No se puede quitar el registro {entidad_id} de '{entidad}': tiene datos asociados en el expediente."
            ) from None

    # ── Documentos al expediente ──
    def _copiar_documentos_familiar(
        self, cedula: str, cambios: list[CambioPropuesto], soportes: list[SoporteDocumental],
        ids_creados: dict[tuple[str, str], int],
    ) -> None:
        """Copia al expediente del familiar los documentos que respaldaron su alta o corrección."""
        repo = RepoFamiliaresORM()
        for c in cambios:
            if c.entidad_destino != 'familiar' or c.accion == Accion.ELIMINAR.value:
                continue
            familiar_id = int(c.entidad_id) if c.entidad_id else ids_creados.get(
                ('familiar', c.referencia or ''),
            )
            if not familiar_id:
                continue
            propios = [
                s for s in soportes
                if s.seccion == c.seccion and (
                    (c.entidad_id and s.entidad_id == c.entidad_id)
                    or (c.referencia and s.referencia == c.referencia)
                )
            ]
            for s in propios:
                tipo_documento = _DOCUMENTO_FAMILIAR.get(s.tipo)
                if tipo_documento:
                    # La tabla legada guarda nombres de hasta 100 caracteres: se copia el objeto
                    # a una clave corta y estable antes de registrarlo en el expediente.
                    extension = PurePosixPath(s.clave_s3).suffix or '.bin'
                    clave = f'fam/{familiar_id}/{s.sha256[:24]}{extension}'
                    self._almacen.subir(clave, self._almacen.descargar(s.clave_s3), s.mime_real)
                    repo.crear_documento(familiar_id, tipo_documento, clave)
