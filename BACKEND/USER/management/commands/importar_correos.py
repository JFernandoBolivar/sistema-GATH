import os
import zipfile
import xml.etree.ElementTree as ET
from django.core.management.base import BaseCommand
from django.db import transaction
from RAC.models.personal_models import Employee

class Command(BaseCommand):
    help = 'Importa y asocia correos desde el archivo Listado_usuarios_activos_comision.ods'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='/home/conatel/Documentos/proyectos/rac/RAC /gath/Listado_usuarios_activos_comision.ods',
            help='Ruta absoluta al archivo .ods'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra los cambios que se realizarían sin modificar la base de datos'
        )

    def clean_cedula(self, val):
        if not val:
            return ""
        return "".join(c for c in str(val) if c.isdigit())

    def read_ods_rows(self, file_path):
        rows_data = []
        if not os.path.exists(file_path):
            self.stderr.write(f"Error: El archivo no existe en la ruta {file_path}")
            return rows_data

        try:
            with zipfile.ZipFile(file_path) as z:
                content_xml = z.read('content.xml')
                root = ET.fromstring(content_xml)
                
                ns = {
                    'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
                    'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
                }
                
                tables = root.findall('.//table:table', ns)
                if not tables:
                    self.stderr.write("Error: No se encontraron tablas/hojas en el ODS.")
                    return rows_data
                
                table = tables[0]  # Primera hoja
                rows = table.findall('.//table:table-row', ns)
                
                for row in rows:
                    cells = []
                    for cell in row.findall('.//table:table-cell', ns):
                        repeated = cell.get('{urn:oasis:names:tc:opendocument:xmlns:table:1.0}number-columns-repeated')
                        repeat_count = int(repeated) if repeated else 1
                        
                        text_p = cell.find('.//text:p', ns)
                        val = "".join(text_p.itertext()) if text_p is not None else ""
                        cells.extend([val] * repeat_count)
                    
                    while cells and cells[-1] == "":
                        cells.pop()
                    if cells:
                        rows_data.append(cells)
        except Exception as e:
            self.stderr.write(f"Error al leer el archivo ODS: {e}")
        return rows_data

    def handle(self, *args, **options):
        file_path = options['file']
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING("--- MODO SIMULACIÓN (DRY RUN) --- No se guardarán cambios."))

        rows = self.read_ods_rows(file_path)
        if not rows or len(rows) <= 1:
            self.stderr.write("No se encontraron registros para procesar.")
            return

        header = rows[0]
        try:
            name_idx = header.index('Nombre y apellido')
            cedula_idx = header.index('cédula')
            email_idx = header.index('Correo')
        except ValueError:
            name_idx = 0
            cedula_idx = 1
            email_idx = 2

        data_rows = rows[1:]
        
        seen_cedulas = {}
        for row in data_rows:
            if len(row) <= max(name_idx, cedula_idx, email_idx):
                continue
            
            name_val = row[name_idx]
            name = name_val.strip() if (name_val is not None and isinstance(name_val, str)) else ""
            
            cedula_raw = row[cedula_idx]
            
            email_val = row[email_idx] if len(row) > email_idx else ""
            email_raw = email_val.strip().lower() if (email_val is not None and isinstance(email_val, str)) else ""
            
            cedula_clean = self.clean_cedula(cedula_raw)
            if not cedula_clean:
                continue
            
            seen_cedulas[cedula_clean] = (name, email_raw)

        total_processed = 0
        total_updated = 0
        total_already_had_email = 0
        total_no_email_in_ods = 0
        total_conflicts = 0
        total_not_found = 0

        with transaction.atomic():
            for cedula, (name, email) in seen_cedulas.items():
                total_processed += 1
                try:
                    emp = Employee.objects.get(cedulaidentidad=cedula)
                except Employee.DoesNotExist:
                    total_not_found += 1
                    self.stdout.write(f"Empleado no encontrado en DB - Cédula: {cedula} ({name})")
                    continue

                if emp.correo:
                    total_already_had_email += 1
                    continue

                if not email:
                    total_no_email_in_ods += 1
                    continue

                # Validar conflicto de correo único
                other_emp = Employee.objects.filter(correo__iexact=email).exclude(cedulaidentidad=cedula).first()
                if other_emp:
                    total_conflicts += 1
                    self.stderr.write(
                        self.style.ERROR(
                            f"Conflicto de unicidad: Correo '{email}' ya está asignado al empleado cédula {other_emp.cedulaidentidad}. "
                            f"No se puede asociar a {emp.nombres} {emp.apellidos} (Cédula: {cedula})"
                        )
                    )
                    continue

                # Si todo está bien, actualizar
                total_updated += 1
                self.stdout.write(f"Asociando correo: Cédula: {cedula} | {emp.nombres} {emp.apellidos} -> {email}")
                if not dry_run:
                    emp.correo = email
                    emp.save(update_fields=['correo'])

            if dry_run:
                self.stdout.write(self.style.WARNING("\nSimulación finalizada. No se aplicaron cambios."))
            else:
                self.stdout.write(self.style.SUCCESS("\nCambios guardados con éxito en la base de datos."))

        # Mostrar resumen
        self.stdout.write(self.style.SUCCESS("\n--- RESUMEN DE PROCESAMIENTO ---"))
        self.stdout.write(f"Total registros procesados: {total_processed}")
        self.stdout.write(f"Correos nuevos asociados/actualizados: {total_updated}")
        self.stdout.write(f"Registros que ya tenían correo en DB: {total_already_had_email}")
        self.stdout.write(f"Registros sin correo en ODS: {total_no_email_in_ods}")
        self.stdout.write(f"Conflictos de correo duplicado: {total_conflicts}")
        self.stdout.write(f"Empleados de ODS no encontrados en DB: {total_not_found}")
