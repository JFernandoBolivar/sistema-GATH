"""
Promoción del postulante a trabajador (G-4): implementa el puerto `PromotorEmpleado`.

Correo: `Employee.correo` es el INSTITUCIONAL (login de un activo). El del postulante casi siempre es personal: queda como
correo ALTERNATIVO y la cuenta se crea cuando RRHH le asigne el institucional (flujo existente); si ya es del dominio de la
casa, se usa como `Employee.correo` y la cuenta se crea en la promoción.

Orquesta, SIN duplicar su lógica, lo que ya existe en las demás apps:
  * `personal`: `RepoPersonalORM.crear_empleado` / `actualizar_empleado` (Employee y sus datos anidados: vivienda,
    salud, tallas y contacto de emergencia) y `registrar_procedencia_ingreso` (foto y origen);
  * `familiares`: `RepoFamiliaresORM.crear_familiar` con la cédula resuelta por las mismas reglas de siempre;
  * `cargos`: `RepoCargosORM.asignar_cargo_a_empleado`, que ocupa el puesto y emite el evento que `movimientos` registra
    como INGRESO (`usuario_id` es obligatorio aquí: sin él el movimiento no se registraría);
  * `identidad`: `reactivar_cuenta_por_reingreso` y `aprovisionar_cuenta_trabajador` (por `aprovisionar_por_cedula`).

NO abre transacción: corre dentro de la del caso de uso, de modo que cualquier fallo revierte TODO. Orden de los pasos:
  2. Employee (nuevo, o el existente en un reingreso, C-1) con datos de V1 y V2, foto y origen;
  3. familiares (más vivienda, salud y tallas, que viajan con el Employee en el mismo paso);
  4. puesto + movimiento INGRESO;
  5. cuenta de acceso.
`personal` y las demás apps NO conocen `postulacion`: el origen viaja como id opaco.
"""
import logging
from datetime import date

from django.conf import settings

from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
)
from apps.familiares.application.use_cases.validaciones_familiar import resolver_cedula_familiar
from apps.familiares.infrastructure.lector_validacion_familiar_orm import LectorValidacionFamiliarORM
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.familiares.infrastructure.repositories.repo_familiares_orm import RepoFamiliaresORM
from apps.identidad.application.use_cases.reactivar_cuenta_por_reingreso import reactivar_cuenta_por_reingreso
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.receivers import aprovisionar_por_cedula
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import RepoCondicionTrabajadorORM
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_desactivacion_egreso_orm import RepoDesactivacionEgresoORM
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM
from apps.postulacion.domain.entities.promocion import (
    CUENTA_NO_APLICA,
    CUENTA_SIN_CORREO,
    CUENTA_SIN_CORREO_INSTITUCIONAL,
    CUENTA_YA_EXISTIA,
    CuentaPromocion,
    ResultadoPromocion,
    SolicitudPromocion,
)
from apps.postulacion.domain.errores import ConflictoConCodigo, ValidacionConCodigo
from core.domain.configuracion import CLAVE_PASSWORD_INICIAL_DIAS
from core.domain.exceptions import DomainError
from core.infrastructure.providers import obtener_lector_configuracion

logger = logging.getLogger('gath.postulacion')


def _correo_libre(correo: str, cedula: str) -> bool:
    """El correo del Employee es único: solo se usa el del postulante si nadie más lo tiene."""
    return not EmployeeModel.objects.filter(correo__iexact=correo).exclude(cedulaidentidad=cedula).exists()


def _es_institucional(correo: str) -> bool:
    """`Employee.correo` es el correo INSTITUCIONAL (el de acceso de un trabajador activo): solo el del dominio de la casa."""
    dominio = '@' + str(getattr(settings, 'DOMINIO_CORREO_INSTITUCIONAL', '@conatel.gob.ve')).lstrip('@').lower()
    return correo.strip().lower().endswith(dominio)


class PromotorEmpleadoORM:
    def promover(self, s: SolicitudPromocion) -> ResultadoPromocion:
        previo = EmployeeModel.objects.select_for_update().filter(cedulaidentidad=s.cedula).first()
        condicion_previa = RepoCondicionTrabajadorORM().condicion_por_cedula(s.cedula) if previo else None
        if condicion_previa is CondicionTrabajador.ACTIVO:
            raise ConflictoConCodigo(
                "La persona ya es un trabajador ACTIVO de CONATEL: no se puede contratar de nuevo.",
                codigo='EMPLEADO_ACTIVO',
            )
        tenia_cuenta = RepoCuentasORM().existe_cuenta_para_cedula(s.cedula)
        reingreso = previo is not None

        # 2 (y 3 para vivienda, salud y tallas): Employee con sus datos.
        repo_personal = RepoPersonalORM()
        datos = self._datos_empleado(s, previo, repo_personal)
        try:
            if reingreso:
                repo_personal.actualizar_empleado(s.cedula, datos)
            else:
                repo_personal.crear_empleado(datos)
        except DomainError as e:   # p. ej. correo repetido: se aísla con su código para que el cliente lo muestre
            raise ValidacionConCodigo(str(e), campo=getattr(e, 'campo', None), codigo='EMPLEADO_INVALIDO') from e
        repo_personal.registrar_procedencia_ingreso(
            s.cedula, origen_expediente=s.expediente_id, foto_clave=s.foto_clave or None, ahora=s.ahora,
        )
        empleado = EmployeeModel.objects.get(cedulaidentidad=s.cedula)

        # 3: familiares.
        copiados = self._copiar_familiares(s, empleado)

        # 4: puesto + INGRESO (la señal que emite `cargos` la registra `movimientos`).
        if s.usuario_id is None:
            raise ValidacionConCodigo(
                "No se pudo identificar la cuenta de quien asigna el cargo: el movimiento de ingreso no se registraría.",
                codigo='USUARIO_SIN_CUENTA',
            )
        puesto = RepoCargosORM().asignar_cargo_a_empleado(
            cargo_id=s.puesto_id, cedula=s.cedula, motivo_id=None, usuario_id=s.usuario_id,
        )

        # 5: cuenta.
        cuenta = self._cuenta(s, empleado, reingreso, tenia_cuenta, condicion_previa, repo_personal)
        return ResultadoPromocion(
            employee_id=empleado.pk, cedula=s.cedula, es_reingreso=reingreso, puesto_codigo=puesto.codigo,
            familiares_copiados=copiados, cuenta=cuenta,
        )

    # ------------------------------------------------------------------------------------------------ Employee
    def _datos_empleado(self, s: SolicitudPromocion, previo: EmployeeModel | None, repo_personal: RepoPersonalORM) -> dict:
        v1, v2 = s.datos_ventana1 or {}, s.datos_ventana2 or {}
        datos: dict = {'cedula': s.cedula, 'nombres': s.nombres, 'apellidos': s.apellidos}
        sexo = v1.get('sexo')
        sexo_id = SexoModel.objects.filter(sexo__istartswith=sexo).values_list('pk', flat=True).first() if sexo else None
        if sexo_id is None and previo is None:
            raise ValidacionConCodigo(
                "Falta el sexo del postulante en la Ventana 1: no se puede crear la ficha del trabajador.",
                campo='datos_ventana1.sexo', codigo='DATOS_INSUFICIENTES',
            )
        if sexo_id is not None:
            datos['sexo_id'] = sexo_id
        if v1.get('fecha_nacimiento'):
            datos['fecha_nacimiento'] = date.fromisoformat(v1['fecha_nacimiento'])
        if v1.get('nacionalidad'):
            nacionalidad = NacionalidadModel.objects.filter(codigo=v1['nacionalidad']).values_list('pk', flat=True).first()
            if nacionalidad:
                datos['nacionalidad_id'] = nacionalidad
        if v1.get('estado_civil'):
            civil = EstadoCivilModel.objects.filter(estadoCivil__iexact=v1['estado_civil']).values_list('pk', flat=True).first()
            if civil:
                datos['estado_civil_id'] = civil
        if s.telefono_movil:
            datos['telefono_movil'] = s.telefono_movil
        if v1.get('telefono_alterno'):
            datos['telefono_habitacion'] = v1['telefono_alterno']
        # El correo del postulante suele ser PERSONAL: no es el institucional (login de un activo), así que queda como correo
        # ALTERNATIVO. Solo si ya es del dominio de la casa se usa como `Employee.correo` (y entonces se crea la cuenta).
        correo = (s.correo or '').strip()
        if correo and _es_institucional(correo):
            if (previo is None or not (previo.correo or '').strip()) and _correo_libre(correo, s.cedula):
                datos['correo'] = correo
        elif correo and (previo is None or not repo_personal.correo_alternativo_de(s.cedula)):
            try:
                repo_personal.validar_correo_alternativo_libre(correo, s.cedula)
                datos['correo_alternativo'] = correo
            except DomainError:
                pass   # ya lo usa otra persona: no es motivo para frenar la contratación
        # Datos anidados con los nombres de campo de `personal` (el repo los upserta por empleado).
        v = v2.get('vivienda') or {}
        if v:
            datos['datos_vivienda'] = {k: v[k] for k in (
                'condicion_vivienda_id', 'estado_id', 'municipio_id', 'parroquia_id', 'direccion_exacta', 'ciudad_region',
            ) if v.get(k)}
        salud = v2.get('salud') or {}
        if salud:
            datos['perfil_salud'] = {
                'grupo_sanguineo_id': salud.get('grupo_sanguineo_id'), 'alergias': salud.get('alergias') or [],
                'patologias_cronicas': salud.get('patologias_cronicas') or [],
                'discapacidades': salud.get('discapacidades') or [],
            }
        tallas = v2.get('tallas') or {}
        if tallas:
            datos['perfil_fisico'] = {k: tallas.get(k) for k in (
                'talla_camisa_id', 'talla_pantalon_id', 'talla_zapatos_id', 'talla_chaqueta_id',
            )}
        contacto = v1.get('contacto_emergencia') or {}
        tiene_contactos = previo is not None and previo.contacto_emergencia.exists()
        if contacto.get('nombre') and not tiene_contactos:
            partes = contacto['nombre'].split()
            relacion = (
                ParentescoModel.objects.filter(descripcion_parentesco__iexact=contacto['parentesco']).values_list('pk', flat=True).first()
                if contacto.get('parentesco') else None
            )
            datos['contacto_emergencia'] = [{
                'nombres': ' '.join(partes[:-1] if len(partes) > 1 else partes)[:100],
                'apellidos': (partes[-1] if len(partes) > 1 else '')[:100],
                'telefono': contacto.get('telefono'), 'relacion_id': relacion,
            }]
        if previo is not None:
            # Reingreso (C-1): es la MISMA persona. La identidad (nombres, apellidos, sexo) solo la corrige RRHH; del
            # expediente se completan los datos que faltan o cambian de verdad (contacto, estado civil, vivienda...).
            for clave in ('nombres', 'apellidos', 'sexo_id'):
                datos.pop(clave, None)
            if previo.fecha_nacimiento:
                datos.pop('fecha_nacimiento', None)
            if 'estado_civil_id' in datos:
                datos['estadoCivil_id'] = datos.pop('estado_civil_id')   # `actualizar_empleado` usa el nombre del atributo
        return datos

    # ------------------------------------------------------------------------------------------------ familiares
    def _copiar_familiares(self, s: SolicitudPromocion, empleado: EmployeeModel) -> int:
        familiares = (s.datos_ventana2 or {}).get('familiares') or []
        if not familiares:
            return 0
        lector = LectorValidacionFamiliarORM()
        existentes = list(EmployeefamilyModel.objects.filter(employeecedula_id=s.cedula))
        cedulas = {str(f.cedulaFamiliar) for f in existentes if f.cedulaFamiliar}
        huellas = {(f.primer_nombre.lower(), f.primer_apellido.lower(), str(f.fechanacimiento)) for f in existentes}
        repo = RepoFamiliaresORM()
        copiados = 0
        for item in familiares:
            huella = (item['primer_nombre'].lower(), item['primer_apellido'].lower(), item['fecha_nacimiento'])
            if huella in huellas or (item.get('cedula') and item['cedula'] in cedulas):
                continue   # reingreso: ya estaba registrado
            parentesco = lector.parentesco(item['parentesco_id'])
            regla = lector.regla_de_parentesco(parentesco) if parentesco else None
            try:
                cedula = resolver_cedula_familiar(
                    cedula_familiar=item.get('cedula'), cedula_empleado=s.cedula,
                    fecha_nacimiento=date.fromisoformat(item['fecha_nacimiento']), orden_hijo=item.get('orden_hijo'),
                    cedulas_existentes=frozenset(cedulas), regla=regla,
                )
            except ValueError as e:
                raise ConflictoConCodigo(
                    f"Familiar {item['primer_nombre']} {item['primer_apellido']}: {e}", codigo='FAMILIAR_INVALIDO',
                ) from e
            try:
                repo.crear_familiar({
                    'empleado_cedula': s.cedula, 'primer_nombre': item['primer_nombre'],
                    'segundo_nombre': item.get('segundo_nombre'), 'primer_apellido': item['primer_apellido'],
                    'segundo_apellido': item.get('segundo_apellido'), 'cedula_familiar': cedula,
                    'orden_hijo': item.get('orden_hijo'), 'parentesco_id': item['parentesco_id'],
                    'fecha_nacimiento': item['fecha_nacimiento'], 'sexo_id': item['sexo_id'],
                    # La Ventana 2 pregunta si depende económicamente; la tabla no tiene columna para eso.
                    'observaciones': 'Depende económicamente del titular.' if item.get('depende_economicamente') else None,
                })
            except DomainError as e:
                raise ConflictoConCodigo(
                    f"Familiar {item['primer_nombre']} {item['primer_apellido']}: {e}", codigo='FAMILIAR_INVALIDO',
                ) from e
            cedulas.add(cedula)
            huellas.add(huella)
            copiados += 1
        return copiados

    # ------------------------------------------------------------------------------------------------ cuenta
    def _cuenta(self, s, empleado, reingreso: bool, tenia_cuenta: bool, condicion_previa, repo_personal) -> CuentaPromocion:
        reactivada = False
        if reingreso and tenia_cuenta:
            reactivada = reactivar_cuenta_por_reingreso(
                RepoCuentasORM(), RepoCondicionTrabajadorORM(), RepoDesactivacionEgresoORM(), s.cedula,
            ) is not None
        correo = (empleado.correo or '').strip()
        alternativo = repo_personal.correo_alternativo_de(s.cedula) or ''
        lector = obtener_lector_configuracion()
        dias = lector.obtener_entero(CLAVE_PASSWORD_INICIAL_DIAS) if lector is not None else None
        if tenia_cuenta:
            return CuentaPromocion(reactivada=reactivada, motivo=CUENTA_YA_EXISTIA, correo=correo, correo_alternativo=alternativo)
        if not correo:
            motivo = CUENTA_SIN_CORREO_INSTITUCIONAL if alternativo else CUENTA_SIN_CORREO
            return CuentaPromocion(motivo=motivo, correo_alternativo=alternativo)
        aprovisionar_por_cedula(s.cedula, permitir_pasivo=condicion_previa is CondicionTrabajador.PASIVO)
        if not RepoCuentasORM().existe_cuenta_para_cedula(s.cedula):
            return CuentaPromocion(motivo=CUENTA_NO_APLICA, correo=correo, correo_alternativo=alternativo)
        return CuentaPromocion(creada=True, correo=correo, correo_alternativo=alternativo, dias_vigencia_clave_inicial=dias)
