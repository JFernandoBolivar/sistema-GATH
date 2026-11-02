"""Crea los cuatro usuarios de prueba de QA para la fe de vida.

Solo se ejecuta a mano. No corre en build ni en el arranque.

- ADMIN_BIENESTAR: cédula real 10823304 (su correo actual se mueve a un alias).
- ANALISTA_BIENESTAR: empleado de QA nuevo.
- Dos PASIVOS de QA con los correos reales que recibirán la constancia:
  salfonzo@conatel.gob.ve y ansanchez@conatel.gob.ve.

Si los correos ya pertenecen a otro empleado, se liberan (se les deja sin
correo) y se guarda un respaldo JSON antes de tocar nada.

Uso:
    python manage.py crear_usuarios_qa --dry-run
    python manage.py crear_usuarios_qa --aplicar
"""
import json
from datetime import date, datetime, timedelta
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.identidad.infrastructure.models.password_inicial_model import (
    PasswordInicialModel,
)
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    DependenciaModel,
    DireccionGeneralModel,
)
from apps.pasivos.application.dtos.pasivos_dtos import RegistrarPasivoDirectoDTO
from apps.pasivos.application.use_cases.registrar_pasivo_directo import (
    registrar_pasivo_directo,
)
from apps.pasivos.infrastructure.codigo_pasivo import generar_codigo_pasivo
from apps.pasivos.infrastructure.repositories.repo_pasivos_orm import RepoPasivosORM
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.repositories.repo_personal_orm import RepoPersonalORM

ADMIN_CEDULA = '10823304'
ADMIN_CORREO = 'salfonzo.qa@conatel.gob.ve'
ADMIN_ROL = 14

ANALISTA_CEDULA = '99000901'
ANALISTA_CORREO = 'analista.bienestar.qa@conatel.gob.ve'
ANALISTA_ROL = 13

PASIVO1_CEDULA = '99000902'
PASIVO1_CORREO = 'salfonzo@conatel.gob.ve'

PASIVO2_CEDULA = '99000903'
PASIVO2_CORREO = 'ansanchez@conatel.gob.ve'

DIAS_PASSWORD_INICIAL = 7


class Command(BaseCommand):
    help = 'Crea los usuarios de prueba de QA para la fe de vida (solo manual).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--aplicar',
            action='store_true',
            help='Aplica los cambios. Sin esta bandera solo muestra el plan.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Fuerza el modo simulación aunque se indique --aplicar.',
        )
        parser.add_argument(
            '--respaldo-dir',
            default='logs/qa_usuarios',
            help='Carpeta donde se guarda el respaldo JSON (por defecto logs/qa_usuarios).',
        )

    def handle(self, *args, **opciones):
        if not opciones['aplicar'] or opciones['dry_run']:
            self._mostrar_plan()
            return

        respaldo = self._respaldar(Path(opciones['respaldo_dir']))
        self.stdout.write(f'Respaldo previo: {respaldo}')

        with transaction.atomic():
            self._preparar_admin()
            self._preparar_analista()
            self._preparar_pasivo(
                PASIVO1_CEDULA, 'PASIVO', 'UNO QA', PASIVO1_CORREO
            )
            self._preparar_pasivo(
                PASIVO2_CEDULA, 'PASIVO', 'DOS QA', PASIVO2_CORREO
            )

        self._mostrar_credenciales()

    def _mostrar_plan(self) -> None:
        self.stdout.write(self.style.WARNING('Plan de usuarios QA (sin cambios):'))
        self.stdout.write(
            '  ADMIN_BIENESTAR   10823304  correo nuevo: '
            f'{ADMIN_CORREO}  contraseña: 10823304'
        )
        self.stdout.write(
            f'  ANALISTA_BIENESTAR {ANALISTA_CEDULA}  correo: {ANALISTA_CORREO}  '
            f'contraseña: {ANALISTA_CEDULA}'
        )
        self.stdout.write(
            f'  PASIVO 1           {PASIVO1_CEDULA}  correo: {PASIVO1_CORREO}  '
            f'contraseña: {PASIVO1_CEDULA}'
        )
        self.stdout.write(
            f'  PASIVO 2           {PASIVO2_CEDULA}  correo: {PASIVO2_CORREO}  '
            f'contraseña: {PASIVO2_CEDULA}'
        )
        self.stdout.write(
            'Ejecute con --aplicar para crear/actualizar. Los correos ocupados '
            'se liberan y se respaldan.'
        )

    def _preparar_admin(self) -> None:
        empleado = EmployeeModel.objects.filter(cedulaidentidad=ADMIN_CEDULA).first()
        if empleado is None:
            raise CommandError(
                f'No existe el empleado {ADMIN_CEDULA}. No se puede crear la '
                'administradora de Bienestar de QA.'
            )
        self._mover_correo(ADMIN_CEDULA, ADMIN_CORREO)
        self._asegurar_cuenta(ADMIN_CEDULA, ADMIN_ROL)

    def _preparar_analista(self) -> None:
        empleado = self._asegurar_empleado(
            ANALISTA_CEDULA,
            'ANALISTA',
            'BIENESTAR QA',
            ANALISTA_CORREO,
            date(1990, 1, 1),
        )
        self._mover_correo(empleado.cedulaidentidad, ANALISTA_CORREO)
        self._asegurar_cuenta(ANALISTA_CEDULA, ANALISTA_ROL)

    def _preparar_pasivo(self, cedula: str, nombres: str, apellidos: str, correo: str) -> None:
        self._liberar_correo(correo, excepto_cedula=cedula)
        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if empleado is None:
            tipo_nomina = self._tipo_nomina_pasivo()
            registrar_pasivo_directo(
                RepoPasivosORM(),
                RegistrarPasivoDirectoDTO(
                    datos={
                        'cedula': cedula,
                        'nombres': nombres,
                        'apellidos': apellidos,
                        'sexo_id': self._sexo_id(),
                        'fecha_nacimiento': '1960-01-01',
                        'correo': correo,
                        'nacionalidad_id': self._nacionalidad_id(),
                    },
                    tipo_nomina_id=tipo_nomina.pk,
                    usuario_id=None,
                ),
            )
        else:
            self._mover_correo(cedula, correo)
            self._asegurar_asignacion_pasivo(cedula)

        self._asegurar_cuenta(cedula, 3)

    def _asegurar_empleado(
        self,
        cedula: str,
        nombres: str,
        apellidos: str,
        correo: str,
        fecha_nacimiento: date,
    ) -> EmployeeModel:
        self._liberar_correo(correo, excepto_cedula=cedula)
        empleado = EmployeeModel.objects.filter(cedulaidentidad=cedula).first()
        if empleado is None:
            RepoPersonalORM().crear_empleado(
                {
                    'cedula': cedula,
                    'nombres': nombres,
                    'apellidos': apellidos,
                    'sexo_id': self._sexo_id(),
                    'fecha_nacimiento': fecha_nacimiento.isoformat(),
                    'correo': correo,
                    'nacionalidad_id': self._nacionalidad_id(),
                }
            )
            empleado = EmployeeModel.objects.get(cedulaidentidad=cedula)
        return empleado

    def _mover_correo(self, cedula: str, nuevo_correo: str) -> None:
        self._liberar_correo(nuevo_correo, excepto_cedula=cedula)
        EmployeeModel.objects.filter(cedulaidentidad=cedula).update(correo=nuevo_correo)

    def _liberar_correo(self, correo: str, excepto_cedula: str) -> None:
        ocupados = EmployeeModel.objects.filter(correo__iexact=correo).exclude(
            cedulaidentidad=excepto_cedula
        )
        for empleado in ocupados:
            self.stdout.write(
                self.style.WARNING(
                    f'Liberando {correo} de {empleado.cedulaidentidad} '
                    '(queda sin correo; respaldado en JSON).'
                )
            )
            EmployeeModel.objects.filter(pk=empleado.pk).update(correo=None)

    def _asegurar_cuenta(self, cedula: str, rol_id: int) -> None:
        ahora = timezone.now()
        cuenta = CuentaModel.objects.filter(cedula_id=cedula).first()
        if cuenta is None:
            cuenta = CuentaModel(cedula_id=cedula, rol_id=rol_id, is_active=True)
            cuenta.set_password(cedula)
            cuenta.save()
        else:
            cuenta.rol_id = rol_id
            cuenta.is_active = True
            cuenta.set_password(cedula)
            cuenta.save()
            RepoPermisosVersionORM().incrementar_cuenta(cuenta.pk)
        PasswordInicialModel.objects.update_or_create(
            cuenta_id=cuenta.pk,
            defaults={
                'emitida_en': ahora,
                'vence_en': ahora + timedelta(days=DIAS_PASSWORD_INICIAL),
            },
        )

    def _asegurar_asignacion_pasivo(self, cedula: str) -> None:
        if AsigTrabajoModel.objects.filter(
            employee_id=cedula,
            Tipo_personal__tipo_personal__iexact='PASIVO',
        ).exists():
            return
        try:
            cargo = DenominacionCargoModel.objects.get(cargo__iexact='PERSONAL PASIVO')
            cargo_esp = DenominacionCargoEspecificoModel.objects.get(
                cargo__iexact='PERSONAL PASIVO'
            )
            dependencia = DependenciaModel.objects.get(dependencia__iexact='NIVEL DE APOYO')
            direccion = DireccionGeneralModel.objects.get(
                direccion_general__iexact='OFICINA DE GESTION HUMANA'
            )
            estatus = EstatusModel.objects.get(estatus__iexact='PASIVO')
            tipo_personal = TipoPersonalModel.objects.get(
                tipo_personal__iexact='PASIVO'
            )
        except (
            DenominacionCargoModel.DoesNotExist,
            DenominacionCargoEspecificoModel.DoesNotExist,
            DependenciaModel.DoesNotExist,
            DireccionGeneralModel.DoesNotExist,
            EstatusModel.DoesNotExist,
            TipoPersonalModel.DoesNotExist,
        ) as exc:
            raise CommandError(
                'Faltan catálogos para crear la asignación pasiva de QA: '
                f'{exc}'
            ) from exc

        tipo_nomina = self._tipo_nomina_pasivo()
        AsigTrabajoModel.objects.create(
            employee_id=cedula,
            codigo=generar_codigo_pasivo(tipo_nomina),
            denominacioncargoid=cargo,
            denominacioncargoespecificoid=cargo_esp,
            tiponominaid=tipo_nomina,
            estatusid=estatus,
            Tipo_personal=tipo_personal,
            Dependencia=dependencia,
            DireccionGeneral=direccion,
            observaciones='Usuario de prueba QA para fe de vida.',
        )

    @staticmethod
    def _tipo_nomina_pasivo() -> TipoNominaModel:
        tipo = TipoNominaModel.objects.filter(es_activo=False).order_by('pk').first()
        if tipo is None:
            raise CommandError('No hay tipos de nómina pasivos (es_activo=False).')
        return tipo

    @staticmethod
    def _sexo_id() -> int:
        sexo = SexoModel.objects.order_by('pk').first()
        if sexo is None:
            raise CommandError('No hay registros en el catálogo Sexo.')
        return sexo.pk

    @staticmethod
    def _nacionalidad_id() -> int:
        nacionalidad = NacionalidadModel.objects.order_by('pk').first()
        return nacionalidad.pk if nacionalidad else 1

    def _respaldar(self, carpeta: Path) -> Path:
        carpeta.mkdir(parents=True, exist_ok=True)
        destino = carpeta / f'qa_usuarios_backup_{datetime.now():%Y%m%d_%H%M%S}.json'
        cedulas = [
            ADMIN_CEDULA,
            ANALISTA_CEDULA,
            PASIVO1_CEDULA,
            PASIVO2_CEDULA,
        ]
        correos = [ADMIN_CORREO, ANALISTA_CORREO, PASIVO1_CORREO, PASIVO2_CORREO]
        filas = list(
            EmployeeModel.objects.filter(
                Q(cedulaidentidad__in=cedulas) | Q(correo__in=correos)
            ).values('cedulaidentidad', 'nombres', 'apellidos', 'correo')
        )
        cuentas = list(
            CuentaModel.objects.filter(cedula_id__in=cedulas).values(
                'cedula_id', 'rol_id', 'is_active'
            )
        )
        destino.write_text(
            json.dumps(
                {'empleados': filas, 'cuentas': cuentas},
                ensure_ascii=False,
                indent=2,
            ),
            encoding='utf-8',
        )
        return destino

    def _mostrar_credenciales(self) -> None:
        self.stdout.write(self.style.SUCCESS('Usuarios QA creados/actualizados:'))
        self.stdout.write(
            f'  ADMIN_BIENESTAR     {ADMIN_CEDULA}  {ADMIN_CORREO}  contraseña {ADMIN_CEDULA}'
        )
        self.stdout.write(
            f'  ANALISTA_BIENESTAR  {ANALISTA_CEDULA}  {ANALISTA_CORREO}  contraseña {ANALISTA_CEDULA}'
        )
        self.stdout.write(
            f'  PASIVO 1            {PASIVO1_CEDULA}  {PASIVO1_CORREO}  contraseña {PASIVO1_CEDULA}'
        )
        self.stdout.write(
            f'  PASIVO 2            {PASIVO2_CEDULA}  {PASIVO2_CORREO}  contraseña {PASIVO2_CEDULA}'
        )
        self.stdout.write(
            'El primer ingreso pedirá cambiar la contraseña. El login es por correo.'
        )
