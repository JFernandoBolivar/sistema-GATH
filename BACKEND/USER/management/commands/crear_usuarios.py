import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from RAC.models.personal_models import Employee
from USER.models.user_models import cuenta, Rol, departaments

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Crea cuentas de usuario (cuenta) con rol y departamento AUTOGESTION para el personal que no posea roles o departamentos administrativos.'

    def handle(self, *args, **options):
        self.stdout.write("Iniciando creación de cuentas de usuario de autogestión...")

        # Obtener o validar rol y departamento de AUTOGESTION
        try:
            rol_autogestion = Rol.objects.get(nombre_rol='AUTOGESTION')
            dept_autogestion = departaments.objects.get(nombre_departamento='AUTOGESTION')
        except (Rol.DoesNotExist, departaments.DoesNotExist) as e:
            self.stderr.write(f"Error: Faltan el rol o departamento 'AUTOGESTION' en la base de datos: {e}")
            return

        # 1. Obtener roles y departamentos diferentes de AUTOGESTION
        roles_no_autogestion = Rol.objects.exclude(nombre_rol='AUTOGESTION')
        depts_no_autogestion = departaments.objects.exclude(nombre_departamento='AUTOGESTION')

        # 2. Identificar cédulas a excluir (empleados con cuentas en roles o depts administrativos)
        excluded_cedulas = list(cuenta.objects.filter(
            Q(rol__in=roles_no_autogestion) | Q(departamento__in=depts_no_autogestion)
        ).values_list('cedula__cedulaidentidad', flat=True))

        # 3. Filtrar empleados a procesar (excluyendo los administrativos anteriores)
        employees_to_process = Employee.objects.exclude(cedulaidentidad__in=excluded_cedulas)
        total_to_process = employees_to_process.count()
        self.stdout.write(f"Total empleados a evaluar para autogestión: {total_to_process}")

        created_count = 0
        already_exists = 0
        skipped_no_email = 0
        errors = 0

        for emp in employees_to_process:
            cedula_str = str(emp.cedulaidentidad).strip()
            
            # Verificar si el usuario ya tiene cuenta (de autogestión)
            if cuenta.objects.filter(cedula=emp).exists():
                already_exists += 1
                continue

            # El login se hará con el correo electrónico, por lo que es requerido
            if not emp.correo:
                self.stderr.write(f"Advertencia: El empleado con Cédula {cedula_str} ({emp.nombres} {emp.apellidos}) no tiene correo electrónico asignado. Se omite.")
                skipped_no_email += 1
                continue

            try:
                with transaction.atomic():
                    # Crear cuenta de usuario con rol y departamento AUTOGESTION
                    user = cuenta(
                        cedula=emp,
                        rol=rol_autogestion,
                        departamento=dept_autogestion,
                        is_active=True
                    )
                    # La primera vez que inicie sesión, su contraseña será su cédula
                    user.set_password(cedula_str)
                    user.save()
                    created_count += 1
            except Exception as e:
                errors += 1
                self.stderr.write(f"Error al crear usuario para Cédula {cedula_str}: {e}")

        # Mostrar resumen en consola
        self.stdout.write(self.style.SUCCESS("\n--- RESUMEN DE PROCESAMIENTO ---"))
        self.stdout.write(f"Cuentas de AUTOGESTION creadas: {created_count}")
        self.stdout.write(f"Cuentas de AUTOGESTION que ya existían: {already_exists}")
        self.stdout.write(f"Empleados omitidos por falta de correo electrónico: {skipped_no_email}")
        self.stdout.write(f"Errores encontrados: {errors}")
        self.stdout.write(self.style.SUCCESS("Proceso finalizado correctamente."))
