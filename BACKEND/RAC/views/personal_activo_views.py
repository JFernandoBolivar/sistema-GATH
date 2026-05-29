import pandas as pd
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework import status
from rest_framework.response import Response
from datetime import datetime
from rest_framework.views import APIView
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from drf_spectacular.utils import extend_schema
from RAC.serializers.personal_activo_serializers import *
from django.db.models import Prefetch
from ..models.personal_models import *
from ..models.ubicacion_models import *

from RAC.filters.filters_personal import EmployeeFilter, AsigTrabajoFilter
from ..utils.constants import *
from ..utils.data_formatters import extract_first_error
from ..services.profile_services import upsert_contrato
from ..models.historial_personal_models import PrestamoCargo, categoria_movimiento, Tipo_movimiento
from ..serializers.historial_personal_serializers import (
    PrestamoCargoSerializer, PrestamoCargoCreateSerializer, PrestamoCargoUpdateSerializer, TipoMovimientoSerializer
)
from ..services.prestamo_cargo_services import verificar_estatus_prestamo, validar_encargaduria_unica, validar_encargado_unico

from USER.models.user_models import cuenta as User  

class ImportarCargosESPECIALESView(APIView):
    parser_classes = [MultiPartParser]
    serializer_class = CargosUploadSerializer

    def post(self, request):
        errores = []
        creados = 0
        
        serializer = CargosUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        archivo = request.FILES['archivo']
        
        try:
            df = pd.read_excel(archivo) if not archivo.name.endswith('.csv') else pd.read_csv(archivo)
            df.columns = df.columns.str.strip().str.lower()
            
            def normalizar(texto):
                if not texto or pd.isna(texto): return ""
                return " ".join(str(texto).split()).upper()

            # CACHÉ EXTENDIDA
            cache = {
                'cargos': {normalizar(obj.cargo): obj for obj in Denominacioncargo.objects.all()},
                'especificos': {normalizar(obj.cargo): obj for obj in Denominacioncargoespecifico.objects.all()},
                'nominas': {normalizar(obj.nomina): obj for obj in Tiponomina.objects.all()},
                'organismos': {normalizar(obj.Organismoadscrito): obj for obj in OrganismoAdscrito.objects.all() if obj.Organismoadscrito},
                'direcciones': {normalizar(obj.direccion_general): obj for obj in DireccionGeneral.objects.all() if obj.direccion_general},
                'estatus': {normalizar(obj.estatus): obj for obj in Estatus.objects.all()},
                'grados': {normalizar(obj.grado): obj for obj in Grado.objects.all()},
                'tipos_p': {normalizar(obj.tipo_personal): obj for obj in Tipo_personal.objects.all()},
                'dependencias': {normalizar(obj.dependencia): obj for obj in Dependencias.objects.all()},
                'lineas': {normalizar(obj.direccion_linea): obj for obj in DireccionLinea.objects.all()},
                'coordinaciones': {normalizar(obj.coordinacion): obj for obj in Coordinaciones.objects.all()},
            }

            tp_default = Tipo_personal.objects.filter(id=2).first()
            dep_default = Dependencias.objects.filter(id=1).first() 
            usuario_historial = User.objects.filter(id=10).first()

            if not usuario_historial:
                raise Exception("Error crítico: No existe el usuario con ID 10.")
            
            try:
                motivo_asignacion = Tipo_movimiento.objects.get(movimiento__iexact="ASIGNACION DE CARGO")
            except Tipo_movimiento.DoesNotExist:
                raise Exception("Error crítico: El motivo 'ASIGNACION DE CARGO' no existe en la base de datos.") 
            
            def generar_codigo_especial(prefijo):
                ultimo_registro = AsigTrabajo.objects.filter(codigo__startswith=prefijo).order_by('-codigo').first()
                if ultimo_registro and ultimo_registro.codigo:
                    try:
                        numero_actual = int(ultimo_registro.codigo.split('_')[1])
                        nuevo_numero = numero_actual + 1
                    except (IndexError, ValueError):
                        nuevo_numero = 1
                else:
                    nuevo_numero = 1
                return f"{prefijo}_{nuevo_numero:04d}"

            with transaction.atomic():
                for index, row in df.iterrows():
                    try:
                        def buscar(cat, col_name):
                            val = row.get(col_name)
                            if pd.isna(val) or str(val).strip() == "":
                                return None
                            return cache[cat].get(normalizar(val))

                        # --- LÓGICA DE CÉDULA Y ESTATUS (MODIFICADA) ---
                        estatus_val = normalizar(row.get('estatus'))
                        cedula_raw = row.get('cedula')
                        empleado = None
                        
                        if estatus_val == "VACANTE":
                            # Si es VACANTE, la cédula debe estar vacía
                            if not pd.isna(cedula_raw) and str(cedula_raw).strip() != "":
                                raise ValueError(f"El estatus es VACANTE, pero la cédula contiene datos: {cedula_raw}. Debe estar vacía.")
                            empleado = None
                        else:
                            # Si NO es VACANTE, la cédula es obligatoria
                            if not pd.isna(cedula_raw) and str(cedula_raw).strip() != "":
                                cedula_clean = str(cedula_raw).split('.')[0].strip()
                                empleado = Employee.objects.filter(cedulaidentidad=cedula_clean).first()
                                
                                if not empleado:
                                    raise ValueError(f"La cédula '{cedula_clean}' no existe en la base de datos de empleados.")
                            else:
                                raise ValueError(f"Para el estatus '{estatus_val}' la cédula es obligatoria.")
                        # -----------------------------------------------

                        # Lógica de Nómina y Código
                        nomina_obj = buscar('nominas', 'nomina')
                        nombre_nomina = normalizar(row.get('nomina'))
                        codigo_final = row.get('codigo')
                        
                        if nombre_nomina == "COMISION DE SERVICIO":
                            codigo_final = generar_codigo_especial("CS")
                        elif nombre_nomina == "HONORARIOS PROFESIONALES":
                            codigo_final = generar_codigo_especial("HP")
                        
                        # Validar si el código ya existe
                        if AsigTrabajo.objects.filter(codigo=codigo_final, tiponominaid=nomina_obj).exists():
                            if any(x in str(codigo_final) for x in ["CS_", "HP_"]):
                                codigo_final = generar_codigo_especial(str(codigo_final).split('_')[0])
                            else:
                                raise ValueError(f"El código '{codigo_final}' ya existe para la nómina '{nombre_nomina}'.")

                        cargo_obj = buscar('cargos', 'cargo')
                        especifico_obj = buscar('especificos', 'cargo_especifico')
                        estatus_obj = buscar('estatus', 'estatus')

                        if not all([cargo_obj, especifico_obj, nomina_obj, estatus_obj]):
                            f = []
                            if not cargo_obj: f.append(f"Cargo: '{row.get('cargo')}'")
                            if not especifico_obj: f.append(f"Específico: '{row.get('cargo_especifico')}'")
                            if not nomina_obj: f.append(f"Nómina: '{row.get('nomina')}'")
                            if not estatus_obj: f.append(f"Estatus: '{row.get('estatus')}'")
                            raise ValueError(f"Faltan datos críticos: {', '.join(f)}")

                        # CREACIÓN
                        asignacion = AsigTrabajo(
                            codigo=codigo_final,
                            employee=empleado,
                            denominacioncargoid=cargo_obj,
                            denominacioncargoespecificoid=especifico_obj,
                            tiponominaid=nomina_obj,
                            estatusid=estatus_obj,
                            OrganismoAdscritoid=buscar('organismos', 'organismo'),
                            DireccionGeneral=buscar('direcciones', 'direccion_general'),
                            Dependencia=buscar('dependencias', 'dependencia') or dep_default,
                            DireccionLinea=buscar('lineas', 'direccion_linea'),
                            Coordinacion=buscar('coordinaciones', 'coordinacion'),
                            gradoid=buscar('grados', 'grado'),
                            Tipo_personal=buscar('tipos_p', 'tipo_personal') or tp_default,
                            observaciones=str(row.get('observaciones', ''))[:255] if not pd.isna(row.get('observaciones')) else ''
                        )
                        
                        asignacion.save()
                        registrar_historial_movimiento(
                            empleado=asignacion.employee, 
                            puesto=asignacion,
                            tipo_movimiento='INGRESO',
                            motivo=motivo_asignacion,
                            usuario=usuario_historial
                        )
                        creados += 1

                    except Exception as e:
                        errores.append(f"Fila {index + 2}: {str(e)}")

                if errores:
                    raise Exception("Errores en el procesamiento del archivo.")

            return Response({"mensaje": f"Se crearon {creados} registros con éxito."}, status=201)

        except Exception as e:
            return Response({
                "error": "Operación cancelada", 
                "detalles": errores if errores else [str(e)]
            }, status=400)

# carga masiva de cargos 


# CARGA PERSONAL 
@extend_schema(
    tags=["Gestion de Empleado"],
    summary="Registrar datos personales de empleadoas",
    description="Permite registrar los datos personales del empleado",
    request=CargaMasivaSerializer,
)
class ImportEmployeesView(APIView):
    def post(self, request):
        serializer = CargaMasivaSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES['archivo']
        
        try:
            # Leer el archivo Excel
            df = pd.read_excel(file)

            # Mapeo de Sexo: Convertimos etiquetas a IDs (1: Femenino, 2: Masculino)
            # Asumiendo que en el Excel la columna se llama 'sexo'
            gender_map = {
                'femenino': 1,
                'Femenino': 1,
                'FEMENINO': 1,
                'masculino': 2,
                'Masculino': 2,
                'MASCULINO': 2,
                'F': 1,
                'f': 1,
                'm': 2,
                'M': 2
            }

            employees_to_create = []
            errors = []

            for index, row in df.iterrows():
                try:
                    # Helper to clean and parse dates from various formats
                    def parse_date(val):
                        if pd.isna(val):
                            return None
                        # If it's already a Timestamp or datetime
                        if isinstance(val, (pd.Timestamp, datetime)):
                            try:
                                return pd.to_datetime(val).date()
                            except Exception:
                                return None

                        s = str(val).strip()
                        # Remove smart quotes and extra quote chars
                        for ch in ['\u201c','\u201d','\u2018','\u2019','"',"'"]:
                            s = s.replace(ch, '')
                        s = s.strip()

                        ts = pd.to_datetime(s, dayfirst=True, errors='coerce')
                        if pd.isna(ts):
                            return None
                        return ts.date()

                    # Obtener ID de sexo basado en el mapeo
                    sexo_raw = row.get('sexo', '')
                    sexo_id = gender_map.get(sexo_raw)
                    if not sexo_id:
                        errors.append(f"Fila {index}: Sexo '{sexo_raw}' no válido.")
                        continue

                    # Parsear fechas (acepta dd/mm/yyyy y limpia comillas tipográficas)
                    fecha_nac = parse_date(row.get('fecha_nacimiento'))

                    if row.get('fecha_nacimiento') and fecha_nac is None:
                        errors.append(f"Fila {index}: fecha_nacimiento '{row.get('fecha_nacimiento')}' no válido.")

                    # Crear instancia del modelo (sin guardar en DB aún para optimizar)
                    employee = Employee(
                        cedulaidentidad=row.get('CEDULA DE IDENTIDAD'),
                        nombres=row.get('NOMBRES'),
                        apellidos=row.get('APELLIDOS'),
                        fecha_nacimiento=fecha_nac,
                        sexoid_id=sexo_id, 
                        estadoCivil_id=1
                    )
                    employees_to_create.append(employee)

                except Exception as e:
                    errors.append(f"Fila {index}: {str(e)}")

            # Carga masiva en la base de datos
            if employees_to_create:
                Employee.objects.bulk_create(employees_to_create, ignore_conflicts=True)

            return Response({
                "message": f"Se procesaron {len(employees_to_create)} empleados.",
                "errors": errors
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": f"Error al leer el archivo: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)



class ImportFullEmployeeDataView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        archivo = request.FILES.get('archivo')
        usuario_id = request.data.get('usuario_id', 10)

        if not archivo:
            return Response({"error": "No se envió ningún archivo"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 1. Leer archivo
            df = pd.read_excel(archivo) if archivo.name.endswith(('.xlsx', '.xls')) else pd.read_csv(archivo)
            df.columns = df.columns.str.strip().str.lower()
            
            # 2. Preparar Caché (Pre-carga de tablas maestras)
            def normalize(t):
                if pd.isna(t) or not str(t).strip(): return ""
                return " ".join(str(t).split()).upper()

            cache = {
                # Personales y Físicos
                'sexo': {normalize(obj.sexo): obj for obj in Sexo.objects.all()},
                'estado_civil': {normalize(obj.estadoCivil): obj for obj in estado_civil.objects.all()},
                'sangre': {normalize(obj.GrupoSanguineo): obj for obj in GrupoSanguineo.objects.all()},
                'talla_c': {normalize(obj.valor): obj for obj in Talla.objects.filter(tipo_prenda__categoria__iexact='Camisa').select_related('tipo_prenda', 'region')},
                'talla_p': {normalize(obj.valor): obj for obj in Talla.objects.filter(tipo_prenda__categoria__iexact='Pantalón').select_related('tipo_prenda', 'region')},
                'talla_z': {normalize(obj.valor): obj for obj in Talla.objects.filter(tipo_prenda__categoria__iexact='Zapato').select_related('tipo_prenda', 'region')},
                
                # Académicos
                'niveles': {normalize(obj.nivelacademico): obj for obj in NivelAcademico.objects.all()},
                'carreras': {normalize(obj.nombre_carrera): obj for obj in carreras.objects.all()},
                'menciones': {normalize(obj.nombre_mencion): obj for obj in Menciones.objects.all()},
                
                # Vivienda
                'vivienda_cond': {normalize(obj.condicion): obj for obj in condicion_vivienda.objects.all()},
                'estados': {normalize(obj.estado): obj for obj in direccion_models.Estado.objects.all()}, # Ajusta 'nombre' si tu campo se llama distinto
                'municipios': {normalize(obj.municipio): obj for obj in direccion_models.Municipio.objects.all()},
                'parroquias': {normalize(obj.parroquia): obj for obj in direccion_models.Parroquia.objects.all()},
                
                # Contactos
                'parentescos': {normalize(obj.descripcion_parentesco): obj for obj in Parentesco.objects.all()}, # Ajusta al nombre real de tu campo en Parentesco
                
                # M2M Salud
                'alergias': {normalize(obj.alergia): obj for obj in Alergias.objects.all()},
                'patologias': {normalize(obj.patologia): obj for obj in patologias_Cronicas.objects.all()},
                'discapacidades': {normalize(obj.discapacidad): obj for obj in Discapacidades.objects.all()},

                # Organismos y Políticas
                'organismos': {normalize(obj.Organismoadscrito): obj for obj in OrganismoAdscrito.objects.all()},
                'politicas': {normalize(obj.tipo_politica): obj for obj in politicas.objects.all()},
            }

            errores = []
            creados = 0
            actualizados = 0

            # 3. Procesamiento Atómico
            try:
                with transaction.atomic():
                    for index, row in df.iterrows():
                        linea = index + 2
                        try:
                            cedula = str(row.get('cedula', '')).split('.')[0].strip()
                            if not cedula:
                                errores.append(f"Línea {linea}: Cédula vacía.")
                                continue

                            def get_obj(cat, col):
                                val = normalize(row.get(col))
                                return cache[cat].get(val) if val else None

                            def parse_date(col):
                                val = row.get(col)
                                if pd.isna(val) or val == "": return None
                                try:
                                    return pd.to_datetime(val).date()
                                except: return None

                            # --- 1. INFO BÁSICA (Employee) ---
                            employee_data = {
                                'nombres': normalize(row.get('nombres')),
                                'apellidos': normalize(row.get('apellidos')),
                                'fecha_nacimiento': parse_date('fecha_nacimiento'),
                                'correo': str(row.get('correo', '')).lower() if not pd.isna(row.get('correo')) else None,
                                'telefono_movil': str(row.get('telefono_movil', '')),
                                'telefono_habitacion': str(row.get('telefono_habitacion', '')),
                                'profile': str(row.get('perfil_profesional', '')) if not pd.isna(row.get('perfil_profesional')) else None,
                                'sexoid': get_obj('sexo', 'sexo'),
                                'estadoCivil': get_obj('estado_civil', 'estado_civil'),
                            }

                            n_contrato_excel = str(row.get('n_contrato', '')) if not pd.isna(row.get('n_contrato')) else None
                            fecha_ingreso_org = parse_date('fecha_ingreso_organismo')
                            fecha_culminacion_excel = parse_date('fecha_culminacion') if 'fecha_culminacion' in row else None
                            politica_excel = normalize(row.get('politica')) if 'politica' in row else None

                            emp_instance, created = Employee.objects.update_or_create(
                                cedulaidentidad=cedula,
                                defaults=employee_data
                            )
                            emp_instance.save()

                            if created: creados += 1 
                            else: actualizados += 1

                            # --- 2. DATOS DE VIVIENDA ---
                            if normalize(row.get('direccion_exacta')):
                                datos_vivienda.objects.update_or_create(
                                    empleado_id=emp_instance,
                                    defaults={
                                        'estado_id': get_obj('estados', 'estado'),
                                        'municipio_id': get_obj('municipios', 'municipio'),
                                        'parroquia': get_obj('parroquias', 'parroquia'),
                                        'direccion_exacta': row.get('direccion_exacta'),
                                        'condicion_vivienda_id': get_obj('vivienda_cond', 'condicion_vivienda'),
                                    }
                                )

                            # --- 3. PERFIL FÍSICO ---
                            perfil_fisico.objects.update_or_create(
                                empleado_id=emp_instance,
                                defaults={
                                    'tallaCamisa': get_obj('talla_c', 'talla_camisa'),
                                    'tallaPantalon': get_obj('talla_p', 'talla_pantalon'),
                                    'tallaZapatos': get_obj('talla_z', 'talla_zapatos'),
                                }
                            )

                            # --- 4. FORMACIÓN ACADÉMICA ---
                            if normalize(row.get('institucion_academica')):
                                formacion_academica.objects.update_or_create(
                                    empleado_id=emp_instance,
                                    defaults={
                                        'nivel_Academico_id': get_obj('niveles', 'nivel_academico'),
                                        'carrera_id': get_obj('carreras', 'carrera'),
                                        'mencion_id': get_obj('menciones', 'mencion'),
                                        'institucion': normalize(row.get('institucion_academica')),
                                        'capacitacion': normalize(row.get('capacitacion')),
                                    }
                                )

                            # --- 5. PERFIL DE SALUD ---
                            salud_obj, _ = perfil_salud.objects.update_or_create(
                                empleado_id=emp_instance,
                                defaults={
                                    'grupoSanguineo': get_obj('sangre', 'grupo_sanguineo'),
                                }
                            )
                            
                            def sync_m2m(field_obj, cat, col_name):
                                raw_val = row.get(col_name)
                                if pd.isna(raw_val): return
                                items = [normalize(x.strip()) for x in str(raw_val).split(',')]
                                ids = [cache[cat][i].id for i in items if i in cache[cat]]
                                field_obj.set(ids)

                            sync_m2m(salud_obj.alergias, 'alergias', 'alergias')
                            sync_m2m(salud_obj.patologiaCronica, 'patologias', 'patologias')
                            sync_m2m(salud_obj.discapacidad, 'discapacidades', 'discapacidades')

                            # --- 6. CONTACTO DE EMERGENCIA ---
                            if normalize(row.get('contacto_nombres')) and normalize(row.get('contacto_apellidos')):
                                # Usamos update_or_create usando nombres y apellidos como llaves
                                # para evitar duplicar el mismo contacto si se corre el Excel 2 veces
                                contacto_emergencia.objects.update_or_create(
                                    empleado_id=emp_instance,
                                    nombres=normalize(row.get('contacto_nombres')),
                                    apellidos=normalize(row.get('contacto_apellidos')),
                                    defaults={
                                        'telefono': str(row.get('contacto_telefono', '')),
                                        'RelacionId': get_obj('parentescos', 'contacto_parentesco')
                                    }
                                )

                            # --- 7. ANTECEDENTES DE SERVICIO ---
                            if normalize(row.get('ant_institucion')):
                                organismo_obj = cache['organismos'].get(normalize(row.get('ant_institucion')))
                                antecedentes_servicio.objects.update_or_create(
                                    empleado_id=emp_instance,
                                    organismo_id=organismo_obj,
                                    defaults={
                                        'fecha_ingreso': parse_date('ant_fecha_ingreso'),
                                        'fecha_egreso': parse_date('ant_fecha_egreso')
                                    }
                                )

                            # --- 8. CONTRATO (CONATEL) ---
                            if n_contrato_excel and fecha_ingreso_org:
                                politica_obj = cache['politicas'].get(politica_excel)
                                upsert_contrato(emp_instance, {
                                    'n_contrato': n_contrato_excel,
                                    'fecha_ingreso': fecha_ingreso_org,
                                    'politica_id': politica_obj,
                                    'fecha_culminacion': fecha_culminacion_excel,
                                })

                        except Exception as e:
                            errores.append(f"Línea {linea}: {str(e)}")

                    if errores:
                        raise ValueError("Se detectaron errores de validación. Operación cancelada (Rollback).")

                return Response({
                    "mensaje": "Proceso completado con éxito",
                    "creados": creados,
                    "actualizados": actualizados
                }, status=status.HTTP_201_CREATED)

            except ValueError as ve:
                return Response({
                    "error": str(ve),
                    "detalles": errores
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({"error": f"Error crítico al procesar el archivo: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class ImportFullFamilyDataView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        archivo = request.FILES.get('archivo')
        # usuario_id = request.data.get('usuario_id', 10) # Útil si guardas auditoría externa

        if not archivo:
            return Response({"error": "No se envió ningún archivo"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 1. Leer archivo
            df = pd.read_excel(archivo) if archivo.name.endswith(('.xlsx', '.xls')) else pd.read_csv(archivo)
            df.columns = df.columns.str.strip().str.lower()
            
            # 2. Preparar Caché (Pre-carga de tablas maestras para evitar N+1 queries)
            def normalize(t):
                if pd.isna(t) or not str(t).strip(): return ""
                return " ".join(str(t).split()).upper()

            cache = {
                # Personales y Físicos
                'sexo': {normalize(obj.sexo): obj for obj in Sexo.objects.all()},
                'estado_civil': {normalize(obj.estadoCivil): obj for obj in estado_civil.objects.all()},
                'sangre': {normalize(obj.GrupoSanguineo): obj for obj in GrupoSanguineo.objects.all()},
                'talla_c': {normalize(obj.valor): obj for obj in Talla.objects.filter(tipo_prenda__categoria__iexact='Camisa').select_related('tipo_prenda', 'region')},
                'talla_p': {normalize(obj.valor): obj for obj in Talla.objects.filter(tipo_prenda__categoria__iexact='Pantalón').select_related('tipo_prenda', 'region')},
                'talla_z': {normalize(obj.valor): obj for obj in Talla.objects.filter(tipo_prenda__categoria__iexact='Zapato').select_related('tipo_prenda', 'region')},
                
                # Académicos
                'niveles': {normalize(obj.nivelacademico): obj for obj in NivelAcademico.objects.all()},
                'carreras': {normalize(obj.nombre_carrera): obj for obj in carreras.objects.all()},
                'menciones': {normalize(obj.nombre_mencion): obj for obj in Menciones.objects.all()},
                
                # Vivienda
                'vivienda_cond': {normalize(obj.condicion): obj for obj in condicion_vivienda.objects.all()},
                'estados': {normalize(obj.estado): obj for obj in direccion_models.Estado.objects.all()}, 
                'municipios': {normalize(obj.municipio): obj for obj in direccion_models.Municipio.objects.all()},
                'parroquias': {normalize(obj.parroquia): obj for obj in direccion_models.Parroquia.objects.all()},
                
                # Parentesco
                'parentescos': {normalize(obj.descripcion_parentesco): obj for obj in Parentesco.objects.all()},
                
                # M2M Salud
                'alergias': {normalize(obj.alergia): obj for obj in Alergias.objects.all()},
                'patologias': {normalize(obj.patologia): obj for obj in patologias_Cronicas.objects.all()},
                'discapacidades': {normalize(obj.discapacidad): obj for obj in Discapacidades.objects.all()},
            }

            # Pre-cargar empleados para búsquedas rápidas (por cédula)
            # Optimización para no hacer una consulta de empleado por cada línea
            cedulas_empleados_en_df = df['cedula_empleado'].dropna().astype(str).str.split('.').str[0].str.strip().unique()
            empleados_cache = {
                emp.cedulaidentidad: emp for emp in Employee.objects.filter(cedulaidentidad__in=cedulas_empleados_en_df)
            }

            errores = []
            creados = 0
            actualizados = 0

            # 3. Procesamiento Atómico
            try:
                with transaction.atomic():
                    for index, row in df.iterrows():
                        linea = index + 2
                        try:
                            # Validar Empleado (Titular)
                            cedula_empleado = str(row.get('cedula_empleado', '')).split('.')[0].strip()
                            if not cedula_empleado:
                                errores.append(f"Línea {linea}: Cédula del empleado vacía.")
                                continue
                            
                            empleado_titular = empleados_cache.get(cedula_empleado)
                            if not empleado_titular:
                                errores.append(f"Línea {linea}: No existe el empleado con cédula {cedula_empleado}.")
                                continue

                            # Validar Cédula del Familiar (Puede ser nula en tu BD, pero requerida para unique_together)
                            cedula_familiar = str(row.get('cedula_familiar', '')).split('.')[0].strip()
                            cedula_familiar = cedula_familiar if cedula_familiar and cedula_familiar.lower() != 'nan' else None

                            def get_obj(cat, col):
                                val = normalize(row.get(col))
                                return cache[cat].get(val) if val else None

                            def parse_date(col):
                                val = row.get(col)
                                if pd.isna(val) or val == "": return None
                                try:
                                    return pd.to_datetime(val).date()
                                except: return None
                                
                            def parse_bool(col):
                                val = str(row.get(col, '')).strip().lower()
                                return val in ['si', 'sí', 'true', '1', 'v']

                            # --- 1. INFO BÁSICA (Employeefamily) ---
                            family_data = {
                                'primer_nombre': normalize(row.get('primer_nombre')),
                                'segundo_nombre': normalize(row.get('segundo_nombre')),
                                'primer_apellido': normalize(row.get('primer_apellido')),
                                'segundo_apellido': normalize(row.get('segundo_apellido')),
                                'parentesco': get_obj('parentescos', 'parentesco'),
                                'fechanacimiento': parse_date('fecha_nacimiento'),
                                'mismo_ente': parse_bool('mismo_ente'),
                                'heredero': parse_bool('heredero'),
                                'sexo': get_obj('sexo', 'sexo'),
                                'estadoCivil': get_obj('estado_civil', 'estado_civil'),
                                'observaciones': str(row.get('observaciones', '')) if not pd.isna(row.get('observaciones')) else None,
                            }

                            # Requerimientos mínimos de tu modelo
                            faltantes = []
                            if not family_data['fechanacimiento']: 
                                faltantes.append(f"Fecha Nacimiento (Revisa el formato '{row.get('fecha_nacimiento')}')")
                            if not family_data['parentesco']: 
                                faltantes.append(f"Parentesco (El valor '{row.get('parentesco')}' no existe en la BD)")
                            if not family_data['sexo']: 
                                faltantes.append(f"Sexo (El valor '{row.get('sexo')}' no existe en la BD)")
                            
                            if faltantes:
                                errores.append(f"Línea {linea}: Faltan o no coinciden campos obligatorios -> {', '.join(faltantes)}")
                                continue
                                                         # Validar la restricción 'unique_heredero_per_employee'
                            if family_data['heredero']:
                                existe_heredero = Employeefamily.objects.filter(
                                    employeecedula=empleado_titular, heredero=True
                                ).exclude(cedulaFamiliar=cedula_familiar).exists()
                                if existe_heredero:
                                    errores.append(f"Línea {linea}: El empleado {cedula_empleado} ya tiene un heredero asignado.")
                                    continue

                            fam_instance, created = Employeefamily.objects.update_or_create(
                                employeecedula=empleado_titular,
                                cedulaFamiliar=cedula_familiar,
                                defaults=family_data
                            )

                            if created: creados += 1 
                            else: actualizados += 1

                            # --- 2. DATOS DE VIVIENDA (Asignados al familiar_id) ---
                            if normalize(row.get('direccion_exacta')):
                                datos_vivienda.objects.update_or_create(
                                    familiar_id=fam_instance,
                                    defaults={
                                        'empleado_id': None, # Nos aseguramos de que asigne al familiar
                                        'estado_id': get_obj('estados', 'estado'),
                                        'municipio_id': get_obj('municipios', 'municipio'),
                                        'parroquia': get_obj('parroquias', 'parroquia'),
                                        'direccion_exacta': row.get('direccion_exacta'),
                                        'condicion_vivienda_id': get_obj('vivienda_cond', 'condicion_vivienda'),
                                    }
                                )

                            # --- 3. PERFIL FÍSICO ---
                            if get_obj('talla_c', 'talla_camisa') or get_obj('talla_p', 'talla_pantalon') or get_obj('talla_z', 'talla_zapatos'):
                                perfil_fisico.objects.update_or_create(
                                    familiar_id=fam_instance,
                                    defaults={
                                        'empleado_id': None,
                                        'tallaCamisa': get_obj('talla_c', 'talla_camisa'),
                                        'tallaPantalon': get_obj('talla_p', 'talla_pantalon'),
                                        'tallaZapatos': get_obj('talla_z', 'talla_zapatos'),
                                    }
                                )

                            # --- 4. FORMACIÓN ACADÉMICA ---
                            if normalize(row.get('institucion_academica')):
                                formacion_academica.objects.update_or_create(
                                    familiar_id=fam_instance,
                                    defaults={
                                        'empleado_id': None,
                                        'nivel_Academico_id': get_obj('niveles', 'nivel_academico'),
                                        'carrera_id': get_obj('carreras', 'carrera'),
                                        'mencion_id': get_obj('menciones', 'mencion'),
                                        'institucion': normalize(row.get('institucion_academica')),
                                        'capacitacion': normalize(row.get('capacitacion')),
                                    }
                                )

                            # --- 5. PERFIL DE SALUD ---
                            if get_obj('sangre', 'grupo_sanguineo') or not pd.isna(row.get('alergias')):
                                salud_obj, _ = perfil_salud.objects.update_or_create(
                                    familiar_id=fam_instance,
                                    defaults={
                                        'empleado_id': None,
                                        'grupoSanguineo': get_obj('sangre', 'grupo_sanguineo'),
                                    }
                                )
                                
                                def sync_m2m(field_obj, cat, col_name):
                                    raw_val = row.get(col_name)
                                    if pd.isna(raw_val): return
                                    items = [normalize(x.strip()) for x in str(raw_val).split(',')]
                                    ids = [cache[cat][i].id for i in items if i in cache[cat]]
                                    field_obj.set(ids)

                                sync_m2m(salud_obj.alergias, 'alergias', 'alergias')
                                sync_m2m(salud_obj.patologiaCronica, 'patologias', 'patologias')
                                sync_m2m(salud_obj.discapacidad, 'discapacidades', 'discapacidades')

                        except Exception as e:
                            errores.append(f"Línea {linea}: {str(e)}")

                    if errores:
                        raise ValueError("Se detectaron errores de validación. Operación cancelada (Rollback).")

                return Response({
                    "mensaje": "Proceso completado con éxito",
                    "creados": creados,
                    "actualizados": actualizados
                }, status=status.HTTP_201_CREATED)

            except ValueError as ve:
                return Response({
                    "error": str(ve),
                    "detalles": errores
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({"error": f"Error crítico al procesar el archivo: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# ....................................................................


@extend_schema(
    tags=["Gestion de Empleado"],
    summary="Registrar datos personales de empleadoa",
    description="Permite registrar los datos personales del empleado",
    request=EmployeeCreateUpdateSerializer,
)
@api_view(['POST'])
def create_employee(request):
    serializer = EmployeeCreateUpdateSerializer(data=request.data)
    
    if serializer.is_valid():
        try:
            serializer.save()
            return Response({
                'status': "Created",
                "message": "Datos de empleado registrados correctamente",
                "data": serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'status': "Error",
                'message': str(e),
                'errors': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
    else:
        return Response({
            'status': "Error",
            'message': extract_first_error(serializer.errors),
            'errors': serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)

#  ACTUALIZACION DE DATOS PERSONALES DEL EMPLEADO       
@extend_schema(
    tags=["Gestion de Empleado","Gestion de Personal Pasivo"],
    summary="Editar un empleado",
    description="Actualiza los datos de un empleado existente identificado por su id",
    request=EmployeeCreateUpdateSerializer, 
) 
@api_view(['PATCH'])
def update_employee(request, id):
    empleado = get_object_or_404(Employee, id=id)
    serializer = EmployeeCreateUpdateSerializer(empleado, data=request.data, partial=True)
    
    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'status': "OK",
            'message': "Empleado actualizado correctamente",
            'data': serializer.data            
        }, status=status.HTTP_200_OK)
        
    except ValidationError:
        clean_message = extract_first_error(serializer.errors)
        
        return Response({
            'status': "Error",
            'message': clean_message,
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        return Response({
            'status': "Error",
            'message': "No se pudo actualizar el registro.",
            'debug': str(e),
         
        }, status=status.HTTP_400_BAD_REQUEST)
    
# LISTADO DE EMPLEADOS

@extend_schema(
    tags=["Gestion de Empleado"],
    summary="Buscar empleado por cédula",
    description="Devuelve los datos de un empleado identificado por su cédula",
)

@extend_schema(
    tags=["Gestion de Empleado"],
    summary="Buscar empleado por cédula",
    description="Devuelve los datos de un empleado identificado por su cédula",
    request=EmployeeListSerializer,
)
@api_view(['GET'])
def retrieve_employee(request, cedulaidentidad):
    try:
        empleado = Employee.objects.select_related(
            'sexoid', 'estadoCivil'
        ).prefetch_related(
           'datos_vivienda_set__estado_id',
            'datos_vivienda_set__municipio_id',
            'datos_vivienda_set__parroquia',
            'datos_vivienda_set__condicion_vivienda_id',
            
            'perfil_salud_set__grupoSanguineo',
            'perfil_salud_set__discapacidad',
            'perfil_salud_set__patologiaCronica',
            
            'formacion_academica_set__nivel_Academico_id',
            'formacion_academica_set__carrera_id',
            'formacion_academica_set__mencion_id',
            
            'perfil_fisico_set',
            'antecedentes_servicio_set',
            'assignments__denominacioncargoid',
            'assignments__estatusid'
        ).get(cedulaidentidad=cedulaidentidad)

        serializer = EmployeeListSerializer(empleado)
        
        return Response({
            'status': 'success',
            'message': 'Empleado obtenido correctamente',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Employee.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'No se encontró un empleado con la cédula',
            'data': []
        
        }, status=status.HTTP_404_NOT_FOUND)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error al obtener empleado {cedulaidentidad}: {str(e)}", exc_info=True)
        return Response({
            'status': 'error',
            'message': f'Ocurrió un error inesperado en el servidor: {str(e)}',
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
@extend_schema(
    tags=["Gestion de Cargos"],
    summary="Registrar Cargos",
    description="Permite registrar los datos personales del empleado",
    request=CodigosCreateUpdateSerializer,
)
@api_view(['POST'])
def create_position(request):
    serializer = CodigosCreateUpdateSerializer(data=request.data)
    
    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'status': "success",
            "message": "Cargo registrado correctamente",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except ValidationError:
        clean_message = extract_first_error(serializer.errors)
        return Response({
            'status': "error",
            'message': clean_message, 
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e),
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)
        
@extend_schema(
    tags=["Gestion de Cargos"],
    summary="Editar datos de un cargo",
    description="Actualiza los datos de un cargo existente identificado por su id.",
    request=CodigosCreateUpdateSerializer,
) 
@api_view(['PUT'])
def update_position(request, id):
    codigo = get_object_or_404(AsigTrabajo, id=id)
    serializer = CodigosCreateUpdateSerializer(codigo, data=request.data, partial=True)
    
    
    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'status': "success",
            'message': "Cargo actualizado correctamente",
            'data': serializer.data            
        }, status=status.HTTP_200_OK)

    except ValidationError:
        clean_message = extract_first_error(serializer.errors)

        return Response({
            'status': "error",
            'message': clean_message,
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e),
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
@extend_schema(
    tags=["Asignacion de Cargos"],
    summary="Asigna un cargo al trabajador",
    description="Permite asignarle un cargo a un trabajador",
    request=EmployeeAssignmentSerializer,
)
@api_view(['PATCH'])
def assign_employee(request, id):       
    puesto = get_object_or_404(AsigTrabajo, id=id)
    serializer = EmployeeAssignmentSerializer(puesto, data=request.data, partial=True)
    
    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'status': "success",
            'message': "Cargo asignado correctamente",
            'data': serializer.data            
        }, status=status.HTTP_200_OK)
        
    except ValidationError:
        clean_message = extract_first_error(serializer.errors)

        return Response({
            'status': "error",
            'message': clean_message, 
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e) ,
        }, status=status.HTTP_400_BAD_REQUEST)
        
@extend_schema(
    tags=["Asignacion de Cargos"],
    summary="Asignacion de cargos especiales (codigos autogenerables)",
    description="Permite registrar un cargo con codigo autogenerable y asignarlo a un trabajador",
    request=SpecialPositionAutoCreateSerializer,
)
@api_view(['POST'])
def assign_employee_special(request):
    serializer = SpecialPositionAutoCreateSerializer(data=request.data)
    
    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'status': "success",
            "message": "Empleado asignado y código especial generado correctamente",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except ValidationError:
        clean_message = extract_first_error(serializer.errors)

        return Response({
            'status': "error",
            'message': clean_message,
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'status': "error",
            'message':str(e), 
         
        }, status=status.HTTP_400_BAD_REQUEST)
        

@extend_schema(
    tags=["Recursos Humanos - Organismo Adscrito"],
    summary="Registrar organismos adscritos",
    description="Registra los organismos adscritos",
     request=OrganismoAdscritoSerializer,
)
@api_view(['POST'])
def create_subsidiary_organism(request):
    serializer = OrganismoAdscritoSerializer(data=request.data)
    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'status': "success",
            "message": "Organismo Adscrito registrado correctamente",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except ValidationError:
        clean_message = extract_first_error(serializer.errors)

        return Response({
            'status': "error",
            'message': clean_message, 
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e),

        }, status=status.HTTP_400_BAD_REQUEST)
        
  
@extend_schema(
    tags=["Recursos Humanos - Organismo Adscrito"],
    summary="Actualizacion de organismos adscritos",
    description="Actualizacion de los organismos adscritos",
     request=OrganismoAdscritoSerializer,
)  

@api_view(['PATCH'])
def update_organism(request, id):
    Organismos = get_object_or_404(OrganismoAdscrito, id=id)
    serializer = OrganismoAdscritoSerializer(Organismos, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    
    try:
        serializer.save()
        return Response({
            'status': "success",
            'message': "organismo adscrito actualizado correctamente",
            'data': serializer.data            
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'status': "Error",
            'message': str(e),
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
            
@extend_schema(
    tags=["Recursos Humanos - Dependencia"],
    summary="Creacion de Dependencia",
    description="Permite registrar una dependencia",
    request=DependenciaSerializer,
)
@api_view(['POST'])
def create_dependencia(request):
    serializer = DependenciaSerializer(data=request.data)
    if serializer.is_valid():
        try:
            serializer.save()
            return Response({
                'status': "success",
                "message": "Dependencia registrada correctamente",
                "data": serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'status': "error",
                'message': str(e),
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
    clean_message = extract_first_error(serializer.errors)
    return Response({
        'status': "error",
        'message': clean_message, 
        'data': None
    }, status=status.HTTP_400_BAD_REQUEST)
  
@extend_schema(
    tags=["Recursos Humanos - Dependencia"],
    summary="Actualizacion de Dependencia",
    description="Permite la Actualizacion una dependencia",
    request=DependenciaSerializer,
)
@api_view(['PATCH'])
def update_dependencia(request, id):
    dependencia = get_object_or_404(Dependencias, id=id)
    serializer = DependenciaSerializer(dependencia, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    
    try:
        serializer.save()
        return Response({
            'status': "success",
            'message': "Dependencia actualizada correctamente",
            'data': serializer.data            
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'status': "Error",
            'message': str(e),
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
# direccion general creacion   
@extend_schema(
    tags=["Recursos Humanos - Dependencia"],
    summary="Creacion de Direccion General",
    description="Permite registrar una direccion general",
    request=DireccionGeneralSerializer,
)
@api_view(['POST'])
def create_general_directorate(request):
    serializer = DireccionGeneralSerializer(data=request.data)
    
    if serializer.is_valid():
        try:
            serializer.save()
            return Response({
                'status': "success",
                "message": "Dirección General registrada correctamente",
                "data": serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'status': "error",
                'message': str(e),
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
    
    clean_message = extract_first_error(serializer.errors)
    return Response({
        'status': "error",
        'message': clean_message, 
        'data': None
    }, status=status.HTTP_400_BAD_REQUEST)

    


@extend_schema(
    tags=["Recursos Humanos - Datos Academicos"],
    summary="Creacion de Instituciones",
    description="Permite registrar una Institucion",
    request=institucionSerializer,
)
@api_view(['POST'])
def create_Institucion(request):
    serializer = institucionSerializer(data=request.data)
    
    if serializer.is_valid():
        try:
            serializer.save()
            return Response({
                'status': "success",
                "message": "Institucion registrada correctamente",
                "data": serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'status': "error",
                'message': str(e),
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
    
    clean_message = extract_first_error(serializer.errors)
    return Response({
        'status': "error",
        'message': clean_message, 
        'data': None
    }, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(
    tags=["Recursos Humanos"],
    summary="Crear capacitacion",
    description="Permite crear una nueva capacitacion",
    request=CapacitacionSerializer,
)
@api_view(['POST'])
def create_Capacitacion(request):
    serializer = CapacitacionSerializer(data=request.data)
    
    if serializer.is_valid():
        try:
            serializer.save()
            return Response({
                'status': "success",
                "message": "Capacitación registrada correctamente",
                "data": serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'status': "error",
                'message': str(e),
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
    
    clean_message = extract_first_error(serializer.errors)
    return Response({
        'status': "error",
        'message': clean_message, 
        'data': None
    }, status=status.HTTP_400_BAD_REQUEST)
    
@extend_schema(
    tags=["Recursos Humanos - Dependencia"],
    summary="Actualizacion de Direccion General",
    description="Permite actualizar una direccion general",
    request=DireccionGeneralSerializer,
)
@api_view(['PATCH'])
def update_direccion_general(request, id):
    direccion_general = get_object_or_404(DireccionGeneral, id=id)
    serializer = DireccionGeneralSerializer(direccion_general, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    
    try:
        serializer.save()
        return Response({
            'status': "success",
            'message': "Dirección General actualizada correctamente",
            'data': serializer.data            
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'status': "Error",
            'message': str(e),
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)

    
    
 #  CREACION DE DIRECCION DE LINEA 


@extend_schema(
    tags=["Recursos Humanos - Dependencia"],
    summary="Creacion de Direccion de Linea",
    description="Permite registrar una direccion de linea",
    request=DireccionLineaSerializer,
)     
@api_view(['POST'])
def create_line_directorate(request):
    serializer = DireccionLineaSerializer(data=request.data)
    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'status': "success",
            "message": "Dirección de Línea registrada correctamente",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except ValidationError:
        clean_message = extract_first_error(serializer.errors)

        return Response({
            'status': "error",
            'message': clean_message,
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
        
@extend_schema(
    tags=["Recursos Humanos - Dependencia"],
    summary="Actualizacion de Direccion de Linea",
    description="Permite la Actualizacion una direccion de linea",
    request=DireccionLineaSerializer,
)     
@api_view(['PATCH'])
def update_line_directorate(request, id):
    direccion_linea = get_object_or_404(DireccionLinea, id=id)
    serializer = DireccionLineaSerializer(direccion_linea, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    
    try:
        serializer.save()
        return Response({
            'status': "success",
            'message': "Dirección de Línea actualizada correctamente",
            'data': serializer.data            
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'status': "Error",
            'message': str(e),
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)    
          
@extend_schema(
    tags=["Recursos Humanos - Dependencia"],
    summary="Creacion de Coordinacion",
    description="Permite registrar una Coordinacion",
    request=CoordinacionSerializer,
) 
@api_view(['POST'])
def create_coordination(request):
    serializer = CoordinacionSerializer(data=request.data)
     
    try:
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'status': "success",
            "message": "Coordinación registrada correctamente",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except ValidationError:
        clean_message = extract_first_error(serializer.errors)

        return Response({
            'status': "error",
            'message': clean_message,
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
        
@extend_schema(
    tags=["Recursos Humanos - Dependencia"],
    summary="Creacion de Dependencia",
    description="Permite registrar una dependencia",
    request=CoordinacionSerializer,
) 
@api_view(['PATCH'])
def update_coordinacion(request, id):
    coordinacion = get_object_or_404(Coordinaciones, id=id)
    serializer = CoordinacionSerializer(coordinacion, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    
    try:
        serializer.save()
        return Response({
            'status': "success",
            'message': "Coordinación actualizada correctamente",
            'data': serializer.data            
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'status': "Error",
            'message': str(e),
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)

# LISTAR Employee CON CARGOS 

@extend_schema(
    tags=["Asignacion de Cargos"],
    summary="Listar Empleados con sus cargos",
    description="Devuelve una lista de todos los empleados con sus cargos",
    request=EmployeeDetailSerializer,
)

@api_view(['GET'])
def list_employees_active(request):
    try:
        filtro_asignaciones = AsigTrabajo.objects.select_related('Tipo_personal').filter(
            Tipo_personal__tipo_personal__iexact=PERSONAL_ACTIVO
        )
        
        queryset = Employee.objects.filter(
            assignments__Tipo_personal__tipo_personal__iexact=PERSONAL_ACTIVO
        ).prefetch_related(
            Prefetch('assignments', queryset=filtro_asignaciones)
        ).distinct()

        filterset = EmployeeFilter(request.GET, queryset=queryset)
        
        if not filterset.is_valid():
            return Response({
                'status': "error",
                'message': "Los parámetros de búsqueda son inválidos.",
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

   
        empleados = filterset.qs[:10]

        serializer = EmployeeDetailSerializer(empleados, many=True)

        return Response({
            'status': "success",
            'message': "Empleados activos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': f"Error al recuperar la lista de empleados: {str(e)}",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
  
  
  
        
@extend_schema(
    tags=["Asignacion de Cargos"],
    summary="Buscar empleado por cédula",
    description="Devuelve los datos de un empleado identificado por su cédula.",
     request=EmployeeDetailSerializer,
) 
@api_view(['GET'])
def get_employee_by_id(request, cedulaidentidad):

    try:
        filtro_asignaciones = AsigTrabajo.objects.filter(
            Tipo_personal__tipo_personal__iexact=PERSONAL_ACTIVO
        )

        empleado = Employee.objects.filter(
            cedulaidentidad=cedulaidentidad,
        ).prefetch_related(
            Prefetch('assignments', queryset=filtro_asignaciones)
        ).first()

        if not empleado:
            return Response({
                'status': "error",
                'message': "No se encontró el empleado.",
                'data': []
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = EmployeeDetailSerializer(empleado)
        
        return Response({
            'status': "success",
            'message': "Empleado localizado con éxito",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': f"Ocurrió un error al procesar la búsqueda del empleado. {str(e)}",
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)
        
        

# LISTA DE CARGOS 

#  LISTA TODOS LOS CODIGOS 
@extend_schema(
    tags=["Gestion de Cargos"],
    summary="Listar Cargos Generales (Vacantes y Activos)",
    description="Devuelve una lista de todos los cargos registrados",
     request=ListerCodigosSerializer,
)
@api_view(['GET'])
def list_general_work_codes(request):
    try:
        queryset = AsigTrabajo.objects.filter(
            Tipo_personal__tipo_personal__iexact=PERSONAL_ACTIVO
        )

        filterset = AsigTrabajoFilter(request.GET, queryset=queryset)
        
        if not filterset.is_valid():
            return Response({
                'status': "error",
                'message': "Los parámetros de filtro son inválidos.",
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

        codigos = filterset.qs.distinct()[:10]
        
        serializer = ListerCodigosSerializer(codigos, many=True)
        
        return Response({
            'status': "success",
            'message': "Códigos de trabajo listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': f"No se pudo recuperar la lista de códigos: {str(e)}",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
 
# LISTA DE CARGOS VACANTES  
@extend_schema(
    tags=["Gestion de Cargos"],
    summary="Listar Cargos Generales (Vacantes)",
    description="Devuelve una lista de todos los cargos registrados",
     request=ListerCodigosSerializer,
)
@api_view(['GET'])
def list_general_vacants_codes(request):
    try:
        queryset = AsigTrabajo.objects.filter(
            Tipo_personal__tipo_personal__iexact=PERSONAL_ACTIVO,
            estatusid__estatus__iexact=ESTATUS_VACANTE,
            tiponominaid__requiere_codig=False
            
        )

        filterset = AsigTrabajoFilter(request.GET, queryset=queryset)
        
        if not filterset.is_valid():
            return Response({
                'status': "error",
                'message': "Los parámetros de filtro son inválidos.",
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

        codigos = filterset.qs.distinct()[:10]
        
        serializer = ListerCodigosSerializer(codigos, many=True)
        
        return Response({
            'status': "success",
            'message': "Códigos de trabajo listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': f"No se pudo recuperar la lista de códigos: {str(e)}",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)


# DATOS PERFIL

@extend_schema(
    tags=["Recursos Humanos - Datos Personales"],
    summary="Listar sexos",
    description="Devuelve una lista de todos los sexos disponibles.",
    responses=SexoSerializer
)
@api_view(['GET'])
def list_genders(request):
    try:
        queryset = Sexo.objects.all()
        serializer = SexoSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Sexos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudieron recuperar los datos de sexo.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        

@extend_schema(
    tags=["Recursos Humanos - Datos Personales"],
    summary="Listar politicas",
    description="Devuelve una lista de todos los tipos de politicas disponibles.",
    responses=politicaSerializer
)
@api_view(['GET'])
def list_politicas(request):
    try:
        queryset = politicas.objects.all()
        serializer = politicaSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Politicas listadas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudieron recuperar los datos de politicas.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        

@extend_schema(
    tags=["Recursos Humanos - Datos Personales"],
    summary="Listar Estado civil",
    description="Devuelve una lista de todos los Estado civil disponibles.",
    responses=EstadoCivilSerializer
)
@api_view(['GET'])
def list_marital_statuses(request):
    try:
        queryset = estado_civil.objects.all()
        serializer = EstadoCivilSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Estados civiles listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la información de estados civiles.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)


# DATOS ACADEMICOS 

@extend_schema(
    tags=["Recursos Humanos - Datos Academicos"],
    summary="Listar nivel Academico",
    description="Devuelve una lista de todos los niveles Academicos disponibles.",
    responses=NivelAcademicoSerializer
)
@api_view(['GET'])
def list_academic_levels(request):
    try:
        queryset = NivelAcademico.objects.all()
        serializer = NivelAcademicoSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Niveles académicos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de niveles académicos.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
@extend_schema(
    tags=["Recursos Humanos - Datos Academicos"],
    summary="Listar carreras",
    description="Devuelve una lista de todas las carreras disponibles.",
    responses=CarrerasSerializer
)
@api_view(['GET'])
def list_careers(request, nivel_academico_id=None):
    try:
        if nivel_academico_id:
            queryset = carreras.objects.filter(nivel_academico_id=nivel_academico_id)
        else:
            queryset = carreras.objects.all()
        serializer = CarrerasSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Carreras listadas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de carreras.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
@extend_schema(
    tags=["Recursos Humanos - Datos Academicos"],
    summary="Crear una nueva carrera",
    description="Permite registrar una nueva carrera.",
    request=CarrerasSerializer,
)
@api_view(['POST'])
def create_carrera(request):
    serializer = CarrerasSerializer(data=request.data)
    
    if serializer.is_valid():
        try:
            serializer.save()
            return Response({
                'status': "success",
                "message": "Carrera registrada correctamente",
                "data": serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'status': "error",
                'message': str(e),
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
    
    clean_message = extract_first_error(serializer.errors)
    return Response({
        'status': "error",
        'message': clean_message,
        'data': None
    }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Recursos Humanos - Datos Academicos"],
    summary="Listar instituciones",
    description="Devuelve una lista de todas las instituciones  disponibles.",
    responses=institucionSerializer
)
@api_view(['GET'])
def list_institutions(request):
    try:    
        queryset = Instituciones.objects.all()
        serializer = institucionSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Instituciones listadas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de instituciones.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
    
@extend_schema(
    tags=["Recursos Humanos - Datos Academicos"],
    summary="Listar Menciones por Carrera",
    description="Devuelve una lista de las menciones asociadas a una carrera específica ",
    responses=MencionSerializer
)
@api_view(['GET'])
def list_career_specializations(request, carrera_id):
    try:
        menciones = Menciones.objects.filter(carrera_id=carrera_id)

        if not menciones.exists():
            return Response({
                'status': 'error',
                'message': "No se encontraron menciones para la carrera",
                'data': []
            }, status=status.HTTP_404_NOT_FOUND)
        serializer = MencionSerializer(menciones, many=True)

        return Response({
            'status': 'success',
            'message': 'Menciones obtenidas correctamente',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': 'error',
            'message': 'Ocurrió un error inesperado al recuperar las menciones.',
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        


# UBICACION DEL VIVIENDA

@extend_schema(
    tags=["Recursos Humanos - Datos Vivienda"],
    summary="Listar condicion de vivienda",
    description="Devuelve una lista de todas las condiciones de vivienda disponibles.",
    responses=CondicionViviendaSerializer
)
@api_view(['GET'])
def list_housing_conditions(request):
    try:
        queryset = condicion_vivienda.objects.all()
        serializer = CondicionViviendaSerializer(queryset, many=True)
        return Response({
            'status': "success",
            'message': "Condiciones de vivienda listadas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de condiciones de vivienda.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)

# DATOS DE VESTIMENTA
@extend_schema(
    tags=["Recursos Humanos - Datos Fisicos"],
    summary="Listar Tallas unificadas",
    description="Devuelve una lista de todas las tallas. Acepta ?tipo_prenda_id=X para filtrar.",
    responses=TallaSerializer
)
@api_view(['GET'])
def list_shirt_sizes(request):
    return list_tallas(request)


@extend_schema(
    tags=["Recursos Humanos - Datos Fisicos"],
    summary="Listar Tallas unificadas",
    description="Devuelve una lista de todas las tallas. Acepta ?tipo_prenda_id=X para filtrar.",
    responses=TallaSerializer
)
@api_view(['GET'])
def list_pant_sizes(request):
    return list_tallas(request)


@extend_schema(
    tags=["Recursos Humanos - Datos Fisicos"],
    summary="Listar Tallas unificadas",
    description="Devuelve una lista de todas las tallas. Acepta ?tipo_prenda_id=X para filtrar.",
    responses=TallaSerializer
)
@api_view(['GET'])
def list_shoe_sizes(request):
    return list_tallas(request)


@extend_schema(
    tags=["Recursos Humanos - Datos Fisicos"],
    summary="Listar Tallas unificadas",
    description="Devuelve una lista de todas las tallas. Acepta ?tipo_prenda_id=X para filtrar.",
    responses=TallaSerializer
)
@extend_schema(
    tags=["Recursos Humanos - Datos Fisicos"],
    methods=['POST'],
    summary="Crear talla",
    description="Registra una nueva talla con valor, tipo_prenda y region.",
    request=TallaCreateSerializer,
)
@api_view(['GET', 'POST'])
def list_tallas(request):
    if request.method == 'GET':
        try:
            queryset = Talla.objects.select_related('tipo_prenda', 'region').all()
            tipo_prenda_id = request.GET.get('tipo_prenda_id')
            if tipo_prenda_id:
                queryset = queryset.filter(tipo_prenda_id=tipo_prenda_id)

            serializer = TallaSerializer(queryset, many=True)

            return Response({
                'status': "success",
                'message': "Tallas listadas correctamente",
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'status': "error",
                'message': "No se pudo recuperar la lista de tallas.",
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        serializer = TallaCreateSerializer(data=request.data)

        if serializer.is_valid():
            try:
                serializer.save()
                return Response({
                    'status': "success",
                    "message": "Talla creada correctamente",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'status': "Error",
                    'message': str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            clean_message = extract_first_error(serializer.errors)
            return Response({
                'status': "Error",
                'message': clean_message,
            }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Recursos Humanos - Datos Fisicos"],
    summary="Listar tipos de prenda",
    description="Devuelve todos los tipos de prenda disponibles.",
    responses=TipoPrendaSerializer
)
@api_view(['GET'])
def list_tipo_prenda(request):
    try:
        queryset = TipoPrenda.objects.all()
        serializer = TipoPrendaSerializer(queryset, many=True)
        return Response({
            'status': "success",
            'message': "Tipos de prenda listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e),
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Recursos Humanos - Datos Fisicos"],
    summary="Listar regiones de talla",
    description="Devuelve todas las regiones de talla disponibles.",
    responses=RegionTallaSerializer
)
@extend_schema(
    tags=["Recursos Humanos - Datos Fisicos"],
    methods=['POST'],
    summary="Crear region de talla",
    description="Registra una nueva region de talla con codigo y descripcion opcional.",
    request=RegionTallaSerializer,
)
@api_view(['GET', 'POST'])
def list_region_talla(request):
    if request.method == 'GET':
        try:
            queryset = RegionTalla.objects.all()
            serializer = RegionTallaSerializer(queryset, many=True)
            return Response({
                'status': "success",
                'message': "Regiones de talla listadas correctamente",
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': "error",
                'message': str(e),
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        serializer = RegionTallaSerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save()
                return Response({
                    'status': "success",
                    "message": "Region de talla creada correctamente",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'status': "Error",
                    'message': str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            clean_message = extract_first_error(serializer.errors)
            return Response({
                'status': "Error",
                'message': clean_message,
            }, status=status.HTTP_400_BAD_REQUEST)


# DATOS DE SALUD  

@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    summary="Listar Grupo sanguineo",
    description="Devuelve una lista de todos los Grupos sanguineos disponibles.",
    responses=GrupoSanguineoSerializer
)
@api_view(['GET'])
def list_blood_types(request):
    try:
        queryset = GrupoSanguineo.objects.all()
        serializer = GrupoSanguineoSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Grupos sanguíneos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la información de grupos sanguíneos.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
 
@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['GET'],
    summary="Listar categorías de Patologías Crónicas",
   
)
@extend_schema(
      tags=["Recursos Humanos - Datos de Salud"],
    methods=['POST'],
    summary="Crear categoría de Patología Crónica",
    request=categoriasPatologiasSerializer,
 
)
@api_view(['GET', 'POST'])
def list_pathology_categories(request):
    if request.method == 'GET':
        try:
            queryset = categorias_patologias.objects.all()
            serializer = categoriasPatologiasSerializer(queryset, many=True)
            return Response({
                'status': "OK",
                'message': "Categorías listadas correctamente",
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': "Error",
                'message': str(e),
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)
    if request.method == 'POST':
        serializer = categoriasPatologiasSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                serializer.save()
                return Response({
                    'status': "success",
                    "message": "Categoría creada correctamente",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'status': "Error",
                    'message': str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            clean_message = extract_first_error(serializer.errors)

            return Response({
                'status': "Error",
                'message': clean_message, 
            }, status=status.HTTP_400_BAD_REQUEST)
           

@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['GET'],
    summary="Listar Patologías Crónicas",
)
@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['POST'],
    summary="Crear Patología Crónica",
    request=PatologiasSerializer,
    
)    
@api_view(['GET', 'POST'])
def list_chronic_pathologies(request):
    if request.method == 'GET':
        try:
            queryset = patologias_Cronicas.objects.all()
            serializer = PatologiasSerializer(queryset, many=True)
            return Response({
                'status': "OK",
                'message': "Patologías listadas correctamente",
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': "Error",
                'message': str(e),
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        serializer = PatologiasSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                serializer.save()
                return Response({
                    'status': "success",
                    "message": "Patología crónica creada con éxito",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'status': "Error",
                    'message': str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            clean_message = extract_first_error(serializer.errors)

            return Response({
                'status': "Error",
                'message': clean_message, 
            }, status=status.HTTP_400_BAD_REQUEST)    

@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['GET'],
    summary="Listar categorías de discapacidad",
    description="Obtiene todas las categorías disponibles para clasificar discapacidades.",
 
)
@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['POST'],
    summary="Crear categoría de discapacidad",
    description="Crea una nueva categoría. Ejemplo: 'Física', 'Sensorial', 'Psíquica'.",
    request=categoriasDiscapacidadesSerializer,

)
@api_view(['GET', 'POST'])
def list_disability_categories(request):
    if request.method == 'GET':
        try:
            queryset = categorias_discapacidad.objects.all()
            serializer = categoriasDiscapacidadesSerializer(queryset, many=True)
            return Response({
                'status': "OK",
                'message': "Categorías listadas correctamente",
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': "Error",
                'message': str(e),
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        serializer = categoriasDiscapacidadesSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                serializer.save()
                return Response({
                    'status': "success",
                    "message": "Categoría creada exitosamente",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'status': "Error",
                    'message': str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            clean_message = extract_first_error(serializer.errors)

            return Response({
                'status': "Error",
                'message': clean_message, 
            }, status=status.HTTP_400_BAD_REQUEST)
            
            
@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['GET'],
    summary="Listar discapacidades",
    description="Devuelve una lista de todas las discapacidades disponibles.",

)
@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['POST'],
    summary="Crear discapacidad",
    description="Registra una nueva discapacidad vinculada a una categoría mediante 'categoria_id'.",
    request=DiscapacidadSerializer,
 
)
@api_view(['GET', 'POST'])
def list_disabilities(request):
    if request.method == 'GET':
        try:
            queryset = Discapacidades.objects.all()
            serializer = DiscapacidadSerializer(queryset, many=True)
            return Response({
                'status': "OK",
                'message': "Discapacidades listadas correctamente",
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': "Error",
                'message': str(e),
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        serializer = DiscapacidadSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                serializer.save()
                return Response({
                    'status': "success",
                    "message": "Discapacidad creada correctamente",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'status': "Error",
                    'message': str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            clean_message = extract_first_error(serializer.errors)

            return Response({
                'status': "Error",
                'message': clean_message, 
            }, status=status.HTTP_400_BAD_REQUEST)
            
            
            
@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['GET'],
    summary="Listar categorías de alergias",
    description="Obtiene el listado completo de categorías para clasificar alergias.",
    responses={200: categoriaAlergiaSerializers(many=True)}
)
@extend_schema(
      tags=["Recursos Humanos - Datos de Salud"],
    methods=['POST'],
    summary="Crear categoría de alergia",
    description="Registra una nueva categoría (ej. Alimentaria, Medicamentosa, Ambiental).",
    request=categoriaAlergiaSerializers
)
@api_view(['GET', 'POST'])
def list_allergies_categories(request):
    if request.method == 'GET':
        try:
            queryset = categorias_alergias.objects.all()
            serializer = categoriaAlergiaSerializers(queryset, many=True)
            return Response({
                'status': "OK",
                'message': "Categorías de alergias listadas correctamente",
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': "Error",
                'message': str(e),
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        serializer = categoriaAlergiaSerializers(data=request.data)
        
        if serializer.is_valid():
            try:
                serializer.save()
                return Response({
                    'status': "success",
                    "message": "Categoría de alergia creada exitosamente",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'status': "Error",
                    'message': str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            clean_message = extract_first_error(serializer.errors)

            return Response({
                'status': "Error",
                'message': clean_message, 
            }, status=status.HTTP_400_BAD_REQUEST)
     
@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['GET'],
    summary="Listar Alergias",
    description="Devuelve una lista de todas las Alergias registradas.",
    responses={200: AlergiasSerializer(many=True)}
)
@extend_schema(
    tags=["Recursos Humanos - Datos de Salud"],
    methods=['POST'],
    summary="Crear Alergia",
    description="Registra una nueva alergia. Debes enviar el ID de la categoría en `categoria_id`.",
    request=AlergiasSerializer
)    
@api_view(['GET', 'POST'])
def list_allergies(request):
    if request.method == 'GET':
        try:
            queryset = Alergias.objects.all()
            serializer = AlergiasSerializer(queryset, many=True)
            return Response({
                'status': "OK",
                'message': "Alergias listadas correctamente",
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': "Error", 
                'message': str(e),
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        serializer = AlergiasSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                serializer.save()
                return Response({
                    'status': "success",
                    "message": "Alergia creada correctamente",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'status': "Error",
                    'message': str(e),
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            clean_message = extract_first_error(serializer.errors)

            return Response({
                'status': "Error",
                'message': clean_message, 
            }, status=status.HTTP_400_BAD_REQUEST)


# DEPENDENCIAS

@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar Dependencias",
    description="Devuelve una lista de todas las Dependencias disponibles.",
    responses=DependenciaSerializer
)
@api_view(['GET'])
def list_dependencies(request):
    try:
        queryset = Dependencias.objects.all()
        serializer = DependenciaSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Dependencias listadas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de Dependencias",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
   
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar Direcciones Generales",
    description="Devuelve una lista de todas las Direcciones Generales disponibles.",
    responses=DireccionGeneralSerializer
)     
@api_view(['GET'])
def list_general_directorates_by_dependencia(request, dependencia_id):
    get_object_or_404(Dependencias, pk=dependencia_id)
    
    try:
        queryset = DireccionGeneral.objects.filter(dependenciaId=dependencia_id)
        serializer = DireccionGeneralSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Direcciones Generales filtradas por dependencia obtenidas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "Ocurrio un error al recuperar las Direcciones Generales por dependencia",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar Direcciones Generales",
    description="Devuelve una lista de todas las Direcciones Generales disponibles.",
    responses=DireccionGeneralSerializer
)
@api_view(['GET'])
def list_general_directorates(request):
    try:
        queryset = DireccionGeneral.objects.all()
        serializer = DireccionGeneralSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Direcciones Generales listadas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de Direcciones Generales.",
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar Direcciones de Linea",
    description="Devuelve una lista de todos los tipos de Direcciones de Linea disponibles.",
    responses=DireccionLineaSerializer
)
@api_view(['GET'])
def list_line_directorates_by_general(request, general_id):
 
    get_object_or_404(DireccionGeneral, pk=general_id)
    try:
        direcciones_linea = DireccionLinea.objects.filter(direccionGeneral=general_id)
        serializer = DireccionLineaSerializer(direcciones_linea, many=True)
        
        return Response({
            'status': "success",
            'message': "Direcciones de Línea obtenidas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "Ocurrió un error al recuperar las Direcciones de Línea.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar Coordinaciones",
    description="Devuelve una lista de todos los tipos de Coordinaciones disponibles.",
    responses=CoordinacionSerializer
)
@api_view(['GET'])
def list_coordinations_by_line(request, line_id):
    get_object_or_404(DireccionLinea, pk=line_id)

    try:
        queryset = Coordinaciones.objects.filter(direccionLinea=line_id)
        serializer = CoordinacionSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Coordinaciones obtenidas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "Ocurrió un error al recuperar las coordinaciones.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
 
@extend_schema(
    tags=["Recursos Humanos - Organismo Adscrito"],
    summary="Listar Organismos Adscritos",
    description="Devuelve una lista de todos los organismos adscritos disponibles",
    responses=OrganismoAdscritoSerializer
)       
@api_view(['GET'])
def list_subsidiary_organisms(request):
    try:
        queryset = OrganismoAdscrito.objects.exclude(Organismoadscrito='POLICIAL')
        serializer = OrganismoAdscritoSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Organismos adscritos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de organismos adscritos.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)  
     

@extend_schema(
    tags=["Recursos Humanos - Datos Laborales"],
    summary="Listar Capacitaciones",
    description="Devuelve una lista de capacitaciones disponibles",
    responses=CapacitacionSerializer
)
@api_view(['GET'])
def list_capacitaciones(request):
    try:
        queryset = Capacitaciones.objects.all()
        serializer = CapacitacionSerializer(queryset, many=True)
        return Response({
            'status': "success",
            'message': "Capacitaciones listadas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    except Exception:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de capacitaciones.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Recursos Humanos - Datos Laborales"],
    summary="Listar Grupos de Capacitación",
    description="Devuelve una lista de grupos de capacitación disponibles",
    responses=GrupoCapacitacionSerializer
)
@api_view(['GET'])
def list_grupos_capacitacion(request):
    try:
        queryset = GruposCapacitacion.objects.all()
        serializer = GrupoCapacitacionSerializer(queryset, many=True)
        return Response({
            'status': "success",
            'message': "Grupos de capacitación listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    except Exception:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de grupos de capacitación.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Recursos Humanos - Organismo Adscrito"],
    summary="Listar Organismos Adscritos",
    description="Devuelve una lista de todos los tipos de procedencia disponibles",
    responses=TipoProcedenciaSerializers
)       
@api_view(['GET'])
def list_types_comision(request):
    try:
        queryset = TipoProcedencia.objects.all()
        serializer = TipoProcedenciaSerializers(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "tipos de procedencia listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de tipos de procedencia.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)  
     



@extend_schema(
    tags=["Recursos Humanos - Organismo Adscrito"],
    summary="Listar Organismos Adscritos - para reportes",
    description="Devuelve una lista de todos los organismos adscritos disponibles",
    responses=OrganismoAdscritoSerializer
)       
@api_view(['GET'])
def list_subsidiary_organisms_report(request):
   try:
      
        queryset = OrganismoAdscrito.objects.all().prefetch_related('sub_organismos')
        
        serializer = OrganismoAdscritoSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Organismos adscritos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

   except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de organismos adscritos.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST) 
       
# CARGOS 
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar denominaciones de cargo",
    description="Devuelve una lista de todas las denominaciones de cargo disponibles.",
    responses=denominacionCargoSerializer
)
@api_view(['GET'])
def list_position_denominations(request):
    try:
        # Excluir el cargo de personal pasivo
        queryset = Denominacioncargo.objects.exclude(cargo='PERSONAL PASIVO')
        serializer = denominacionCargoSerializer(queryset, many=True)

        return Response({
            'status': "success",
            'message': "Denominaciones de cargos listadas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de denominaciones de cargos.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar denominaciones de cargo específico",
    description="Devuelve una lista de todas las denominaciones de cargo específico disponibles.",
    responses=denominacionCargoEspecificoSerializer
)
@api_view(['GET'])
def list_specific_position_denominations(request):
    try:
        queryset = Denominacioncargoespecifico.objects.exclude(cargo='PERSONAL PASIVO')
        serializer = denominacionCargoEspecificoSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Denominaciones de cargos específicos listadas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de cargos específicos.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar grados",
    description="Devuelve una lista de todos los grados disponibles.",
    responses=gradoSerializer
)
@api_view(['GET'])
def list_job_grades(request):
    try:
        queryset = Grado.objects.all()
        serializer = gradoSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Grados listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de grados.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)

# NOMINAS
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar tipos de nómina generales",
    description="Devuelve una lista de todos los tipos de nómina disponibles.",
    responses=TipoNominaGeneralSerializer
)
@api_view(['GET'])
def list_payroll_types(request):
    try:
        queryset = Tiponomina.objects.filter(es_activo=True)
        serializer = TipoNominaGeneralSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Tipos de nómina listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:

        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de tipos de nómina.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar tipos de nómina sin las nominas especiales(comision de servicio y hp)",
    description="Devuelve una lista de todos los tipos de nómina disponibles.",
    responses=TipoNominaSerializer
)
@api_view(['GET'])
def list_active_payroll_types(request):

    try:
        queryset = Tiponomina.objects.filter(es_activo=True, requiere_codig=False )
        serializer = TipoNominaSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Tipos de nómina activos obtenidos correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"DEBUG ERROR: {str(e)}")
        return Response({
            'status': "error",
            'message': "Ocurrió un error al consultar los tipos de nómina.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar solo las nominas especiales(comision de servicio y hp)",
    description="Devuelve una lista de todos los tipos de nómina disponibles.",
    responses=TipoNominaSerializer
)
@api_view(['GET'])
def list_special_payroll_types(request):
    try:

        queryset = Tiponomina.objects.filter(requiere_codig=True)
        serializer = TipoNominaSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Tipos de nómina especiales listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception:
        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de nóminas especiales.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)      
 
       
@extend_schema(
    tags=["Recursos Humanos - Datos para Cargo"],
    summary="Listar solo nóminas de Personal Pasivo",
    description="Devuelve una lista exclusiva de Jubilados y Pensionados.",
    responses=TipoNominaSerializer
)
@api_view(['GET'])
def list_retired_payroll_types(request):
    try:
        queryset = Tiponomina.objects.filter(es_activo=False)
        
        serializer = TipoNominaSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Nóminas de personal pasivo obtenidas correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception:
        return Response({
            'status': "error",
            'message': "Error al recuperar las nóminas de personal pasivo.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        

# ESTATUS 

@extend_schema(
    tags=["Recursos Humanos - Gestion de estatus"],
    summary="Listar Estatus para personal pasivo y egresado",
    description="Devuelve una lista de todos los tipos de estatus  disponibles.",
    responses=EstatusSerializer
)
@api_view(['GET'])
def list_exit_statuses(request):
    try:

        queryset = Estatus.objects.filter(
            estatus__in=ESTATUS_PERMITIDOS_EGRESOS
        ).order_by('estatus')
        
        serializer = EstatusSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Estatus de egreso obtenidos correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception:
    
        return Response({
            'status': "error",
            'message': "Error al recuperar los estatus de egreso.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
@extend_schema(
    tags=["Recursos Humanos - Gestion de estatus"],
    summary="Listar Estatus para la gestion de cambio de estatus (SUSPENDIDO, BLOQUEADO, VACANTE)",
    description="Devuelve una lista de todos los tipos de estatus  disponibles.",
    responses=EstatusSerializer
)
@api_view(['GET'])
def list_management_statuses(request):
    try:
        queryset = Estatus.objects.filter(
            estatus__in=ESTATUS_PERMITIDOS
        ).order_by('estatus')
        
        serializer = EstatusSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Estatus de gestión obtenidos correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception:

        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de estatus de gestión.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
        
@extend_schema(
    tags=["Recursos Humanos - Gestion de estatus"],
    summary="Listar Estatus para reportes",
    description="Devuelve una lista de todos los tipos de estatus  disponibles.",
    responses=EstatusSerializer
)
@api_view(['GET'])
def list_status_reports(request):
    try:
        queryset = Estatus.objects.exclude(
            estatus__in=ESTATUS_PERMITIDOS_EGRESOS
        ).order_by('estatus')
        
        serializer = EstatusSerializer(queryset, many=True)
        
        return Response({
            'status': "success",
            'message': "Estatus de gestión obtenidos correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    except Exception:

        return Response({
            'status': "error",
            'message': "No se pudo recuperar la lista de estatus de gestión.",
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)
        
        
        
        
@api_view(['POST'])
def crear_menciones_view(request):
    is_many = isinstance(request.data, list)
    
    # Si no es una lista, convertimos a lista para uniformidad en el conteo
    data_to_process = request.data if is_many else [request.data]
    
    serializer = MencionSerializer(data=data_to_process, many=True)
    
    if serializer.is_valid():
        instancias_creadas = serializer.save()
        total_creadas = len(instancias_creadas)
        
        return Response({
            "status": "success",
            "mensaje": f"Se han creado {total_creadas} menciones correctamente.",
            "conteo": total_creadas,
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
    
    # En caso de error, DRF devuelve un diccionario o una lista de errores
    return Response({
        "status": "error",
        "mensaje": "No se pudieron crear las menciones.",
        "errores": serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# PRESTAMO DE CARGO (ENCARGADURIA)
# ============================================================

@extend_schema(
    tags=["Prestamo de Cargo"],
    summary="Crear prestamo de cargo",
    description="Registra una nueva encargaduria sobre un cargo existente.",
    request=PrestamoCargoCreateSerializer,
)
@api_view(['POST'])
def create_prestamo_cargo(request):
    serializer = PrestamoCargoCreateSerializer(data=request.data)
    if serializer.is_valid():
        try:
            cargo = serializer.validated_data['cargo_encargado']
            empleado = serializer.validated_data['empleado_encargado']
            validar_encargaduria_unica(cargo)
            validar_encargado_unico(empleado)
            serializer.validated_data['estatus'], _ = Estatus.objects.get_or_create(estatus__iexact="ACTIVO", defaults={"estatus": "ACTIVO"})
            prestamo = serializer.save()
            verificar_estatus_prestamo(prestamo)
            return Response({
                'status': "success",
                'message': "Encargaduria registrada correctamente",
                'data': PrestamoCargoSerializer(prestamo).data
            }, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            message = e.detail[0] if isinstance(e.detail, list) else str(e.detail)
            return Response({
                'status': "error",
                'message': message,
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'status': "error",
                'message': str(e),
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
    clean_message = extract_first_error(serializer.errors)
    return Response({
        'status': "error",
        'message': clean_message,
        'data': None
    }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Prestamo de Cargo"],
    summary="Listar prestamos de cargo",
    description="Devuelve una lista de prestamos de cargo con filtros opcionales.",
)
@api_view(['GET'])
def list_prestamo_cargo(request):
    try:
        queryset = PrestamoCargo.objects.select_related(
            'empleado_encargado', 'cargo_encargado', 'motivo', 'estatus', 'ejecutado_por'
        ).all()

        cargo_id = request.query_params.get('cargo_id')
        empleado_cedula = request.query_params.get('empleado')
        activo = request.query_params.get('activo')

        if cargo_id:
            queryset = queryset.filter(cargo_encargado_id=cargo_id)
        if empleado_cedula:
            queryset = queryset.filter(empleado_encargado__cedulaidentidad=empleado_cedula)
        if activo == 'true':
            from datetime import date
            queryset = queryset.filter(fecha_fin__gte=date.today())

        serializer = PrestamoCargoSerializer(queryset, many=True)
        return Response({
            'status': "success",
            'message': "Prestamos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e),
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Prestamo de Cargo"],
    summary="Actualizar prestamo de cargo",
    description="Actualiza la fecha de fin o el motivo de una encargaduria.",
    request=PrestamoCargoUpdateSerializer,
)
@api_view(['PATCH'])
def update_prestamo_cargo(request, id):
    prestamo = get_object_or_404(PrestamoCargo, id=id)
    serializer = PrestamoCargoUpdateSerializer(prestamo, data=request.data, partial=True)
    if serializer.is_valid():
        try:
            prestamo = serializer.save()
            if 'fecha_fin' in request.data:
                prestamo.estatus, _ = Estatus.objects.get_or_create(estatus__iexact="FINALIZADA", defaults={"estatus": "FINALIZADA"})
                prestamo.save()
            else:
                verificar_estatus_prestamo(prestamo)
            return Response({
                'status': "success",
                'message': "Encargaduria actualizada correctamente",
                'data': PrestamoCargoSerializer(prestamo).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': "error",
                'message': str(e),
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
    clean_message = extract_first_error(serializer.errors)
    return Response({
        'status': "error",
        'message': clean_message,
        'data': None
    }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Prestamo de Cargo"],
    summary="Listar motivos de encargaduria",
    description="Devuelve los motivos de la categoria ENCARGADURIA.",
)
@api_view(['GET'])
def list_motivos_encargaduria(request):
    try:
        motivos = Tipo_movimiento.objects.filter(
            categoriaId__categoria='ENCARGADURIA'
        )
        serializer = TipoMovimientoSerializer(motivos, many=True)
        return Response({
            'status': "success",
            'message': "Motivos listados correctamente",
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e),
            'data': []
        }, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["Prestamo de Cargo"],
    summary="Crear motivo de encargaduria",
    description="Crea un nuevo motivo en la categoria ENCARGADURIA.",
)
@api_view(['POST'])
def create_motivo_encargaduria(request):
    nombre = request.data.get('movimiento', '').strip().upper()
    if not nombre:
        return Response({
            'status': "error",
            'message': "El nombre del motivo es requerido",
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)
    try:
        categoria, _ = categoria_movimiento.objects.get_or_create(categoria='ENCARGADURIA')
        if Tipo_movimiento.objects.filter(movimiento=nombre, categoriaId=categoria).exists():
            return Response({
                'status': "error",
                'message': "Este motivo ya existe",
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)
        motivo = Tipo_movimiento.objects.create(movimiento=nombre, categoriaId=categoria)
        return Response({
            'status': "success",
            'message': "Motivo creado correctamente",
            'data': TipoMovimientoSerializer(motivo).data
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({
            'status': "error",
            'message': str(e),
            'data': None
        }, status=status.HTTP_400_BAD_REQUEST)