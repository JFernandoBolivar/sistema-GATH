"""
Generador de PDF para reportes de familiares.
Genera una tabla con información de empleados y sus familiares.
"""
from reportlab.platypus import Spacer, Paragraph, PageBreak, KeepTogether, CondPageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import mm
from django.apps import apps

from ..base_generator import BasePDFGenerator
from ..templates.styles import PAGE_CONFIG, COLORS, get_paragraph_styles
from ..templates.components import (
    create_header, 
    create_section_title, 
    create_data_table,
    create_stats_box,
    format_date
)


class FamilyPDFGenerator(BasePDFGenerator):
    """
    Generador de PDF para reportes de familiares.
    
    Genera un reporte tabular con los datos del empleado y sus familiares:
    
    Datos del empleado:
    - Cédula de identidad
    - Nombres y apellidos
    
    Datos del familiar:
    - Cédula del familiar
    - Nombres y apellidos
    - Parentesco
    - Fecha de nacimiento
    - Sexo
    - Heredero (Sí/No)
    """
    
    def __init__(self, employees, title="Reporte de Familiares", filters=None):
        """
        Inicializa el generador de PDF de familiares.
        
        Args:
            employees: QuerySet o lista de empleados con sus familiares
            title: Título del reporte
            filters: Diccionario con los filtros aplicados
        """
        super().__init__(
            data=employees,
            title=title,
            orientation='landscape',
            metadata={'filters': filters or {}}
        )
        
        self.employees = list(employees) if hasattr(employees, '__iter__') else []
        self.filters = filters or {}
        self.styles = get_paragraph_styles()
    
    def _get_footer_text(self):
        """Retorna el texto para el footer."""
        total_empleados = len(self.employees)
        total_familiares = sum(self._get_familiares_count(e) for e in self.employees)
        return f"Empleados: {total_empleados} | Familiares: {total_familiares} | Generado: {self.generated_at.strftime('%d/%m/%Y %H:%M')}"
    
    def _generate_filename(self):
        """Genera el nombre del archivo."""
        date_str = self.generated_at.strftime('%Y%m%d_%H%M')
        return f"reporte_familiares_{date_str}.pdf"
    
    def _build_content(self):
        """Construye el contenido del PDF."""
        story = []
        
        # Agregar encabezado con estadísticas
        story.extend(self._build_header_section())
        
        # Agregar sección de filtros aplicados (si hay)
        if self.filters:
            story.extend(self._build_filters_section())
        
        # Agregar tabla de familiares
        story.extend(self._build_family_table())
        
        return story
    
    def _build_header_section(self):
        """Construye la sección del encabezado con estadísticas."""
        elements = []
        
        elements.append(Spacer(1, 10))
        
        # Estadísticas generales
        total_empleados = len(self.employees)
        total_familiares = sum(self._get_familiares_count(e) for e in self.employees)
        
        masculino_count = 0
        femenino_count = 0

        for emp in self.employees:
            for fam in self._get_familiares(emp):
                sexo = self._get_sexo(fam)
                if sexo == 'M':
                    masculino_count += 1
                elif sexo == 'F':
                    femenino_count += 1

        stats = {
            'Total Empleados': total_empleados,
            'Total Familiares': total_familiares,
            'Masculino': masculino_count,
            'Femenino': femenino_count,
        }
        
        width = self._get_available_width()
        stats_box = create_stats_box(stats, width)
        elements.append(stats_box)
        elements.append(Spacer(1, 15))
        
        return elements
    
    def _build_filters_section(self):
        """Construye la sección de filtros aplicados."""
        elements = []
        
        filter_text_parts = []
        for key, value in self.filters.items():
            if value:
                filter_text_parts.append(f"{key}: {value}")
        
        return elements
    
    def _build_family_table(self):
        elements = []
        
        # --- VALIDACIÓN INICIAL ---
        if not self.employees:
            estilos_nativos = getSampleStyleSheet()
            estilo_mensaje = self.styles.get('Body') or self.styles.get('Normal') or estilos_nativos['Normal']
            
            elements.append(Spacer(1, 15 * mm))
            elements.append(Paragraph(
                "No se encontraron familiares con los filtros aplicados",
                estilo_mensaje
            ))
            return elements

        # 1. Agrupación Jerárquica (Solo empleados que SÍ tienen familiares)
        agrupacion = {} 
        for employee in self.employees:
            familiares = self._get_familiares(employee)
            if not familiares:
                continue # Si no tiene familiares, lo ignoramos para este reporte
                
            # --- EXTRACCIÓN ROBUSTA DE LA ASIGNACIÓN ---
            assignments = getattr(employee, 'filtered_assignments', None)
            if assignments is None:
                assignments = list(employee.assignments.all()) if hasattr(employee, 'assignments') else []
            
            if not assignments:
                dep, dg, dl, coord = "S/D", "S/D", "S/D", "S/D"
            else:
                asig = assignments[0]
                
                # Búsqueda robusta de dependencia
                dep_obj = getattr(asig, 'Dependencia', None)
                if not dep_obj:
                    dg_obj_rel = getattr(asig, 'DireccionGeneral', None)
                    dep_obj = getattr(dg_obj_rel, 'dependenciaId', None)
                
                dg_obj = getattr(asig, 'DireccionGeneral', None)
                dl_obj = getattr(asig, 'DireccionLinea', None)
                coord_obj = getattr(asig, 'Coordinacion', None)
                
                dep = dep_obj or "DEPENDENCIA DESCONOCIDA"
                dg = dg_obj or "ASIGNACIÓN DIRECTA"
                dl = dl_obj or "ASIGNACIÓN DIRECTA"
                coord = coord_obj or "ASIGNACIÓN DIRECTA"
            
            # Creación del diccionario anidado
            if dep not in agrupacion: agrupacion[dep] = {}
            if dg not in agrupacion[dep]: agrupacion[dep][dg] = {}
            if dl not in agrupacion[dep][dg]: agrupacion[dep][dg][dl] = {}
            if coord not in agrupacion[dep][dg][dl]: agrupacion[dep][dg][dl][coord] = []
            agrupacion[dep][dg][dl][coord].append(employee)

        # 2. Control de Renderizado
        impreso_dep, impreso_dg, impreso_dl = None, None, None
        
        ignorar = {
            "ASIGNACIÓN DIRECTA", "ASIGNACIÓN DIRECTA A LA DEPENDENCIA", 
            "ASIGNACIÓN DIRECTA A LA DIRECCION GENERAL", "ASIGNACIÓN DIRECTA A LA DIRECCION LINEA",
            "NONE", "N/A", "SIN DIRECCIÓN ASIGNADA", "S/D"
        }



        sorted_deps = sorted(agrupacion.keys(), key=lambda d: getattr(d, 'Codigo', '') if not isinstance(d, str) else '')


        for dep in sorted_deps:
            dep_nom = getattr(dep, 'dependencia', str(dep))
            dgs = agrupacion[dep]
            sorted_dgs = sorted(dgs.keys(), key=lambda g: getattr(g, 'Codigo', '') if not isinstance(g, str) else '')

            for dg in sorted_dgs:
                dg_nom = getattr(dg, 'direccion_general', str(dg))
                dls = dgs[dg]
                sorted_dls = sorted(dls.keys(), key=lambda l: getattr(l, 'Codigo', '') if not isinstance(l, str) else '')

                for dl in sorted_dls:
                    dl_nom = getattr(dl, 'direccion_linea', str(dl))
                    coords = dls[dl]
                    sorted_coords = sorted(coords.keys(), key=lambda c: getattr(c, 'Codigo', '') if not isinstance(c, str) else '')

                    for coord in sorted_coords:
                        coord_nom = getattr(coord, 'coordinacion', str(coord))
                        empleados_en_coord = coords[coord]
                        
                        # --- CONSTRUCCIÓN DE LAS FILAS DE FAMILIARES ---
                        headers = ['#', 'Cédula Emp.', 'Nombre Empleado', 'Cédula Fam.', 'Nombre Familiar', 'Parentesco', 'F. Nacimiento', 'Sexo']
                        col_widths = [10*mm, 24*mm, 48*mm, 24*mm, 48*mm, 25*mm, 25*mm, 15*mm]
                        
                        def sort_cedula_desc(e):
                            c = self._get_cedula_empleado(e)
                            try: return -int(c)
                            except: return 0

                        # ORDENAMIENTO POR JERARQUÍA DE CARGO Y CÉDULA
                        empleados_ordenados = sorted(
                            empleados_en_coord, 
                            key=lambda e: (self._get_orden_cargo(e), sort_cedula_desc(e))
                        )
                        
                        rows = []
                        idx = 0
                      
                        for emp in empleados_ordenados:
                            cedula_emp = self._get_cedula_empleado(emp)
                            nombre_emp = self._get_nombre_empleado(emp)
                            familiares_emp = self._get_familiares(emp)
                            
                            for fam in familiares_emp:
                                idx += 1
                                row = [
                                    str(idx),
                                    cedula_emp,
                                    nombre_emp,
                                    self._get_cedula_familiar(fam),
                                    self._get_nombre_familiar(fam),
                                    self._get_parentesco(fam),
                                    self._get_fecha_nacimiento(fam),
                                    self._get_sexo(fam)
                                ]
                                rows.append(row)
                     
                        if rows:
                            # --- TÍTULOS DEL BLOQUE ---
                            titulos_bloque = []
                            if dep_nom != impreso_dep:
                                titulos_bloque.extend(create_section_title(f"ORGANISMO: {dep_nom.upper()}"))
                                impreso_dg, impreso_dl = None, None 
                            if dg_nom != impreso_dg and dg_nom.upper().strip() not in ignorar:
                                titulos_bloque.extend(create_section_title(f"  > DG / GEREN / OFIC: {dg_nom}"))
                                impreso_dl = None 
                            if dl_nom != impreso_dl and dl_nom.upper().strip() not in ignorar:
                                titulos_bloque.extend(create_section_title(f"    - DIV / COORD: {dl_nom}"))
                            if coord_nom.upper().strip() not in ignorar:
                                titulos_bloque.extend(create_section_title(f"      * COORD: {coord_nom}"))

                            tabla_completa = create_data_table(headers, rows, col_widths, with_alternating_rows=True)
                           
                            # --- CONTROL DE SALTO DE PÁGINA ---
                            espacio_requerido = (len(titulos_bloque) * 6 * mm) + 25 * mm
                            elements.append(CondPageBreak(espacio_requerido))
                            
                            if titulos_bloque:
                                for p in titulos_bloque:
                                    if hasattr(p, 'keepWithNext'): p.keepWithNext = True
                                
                                elements.extend(titulos_bloque)
                                elements.append(Spacer(1, 2*mm))
                                
                            elements.append(tabla_completa)
                            elements.append(Spacer(1, 6 * mm))
                            
                            impreso_dep, impreso_dg, impreso_dl = dep_nom, dg_nom, dl_nom

        # Validación final por si la lista de empleados no estaba vacía, 
        # pero NINGUNO tenía familiares.
        if not elements:
            estilos_nativos = getSampleStyleSheet()
            estilo_mensaje = self.styles.get('Body') or self.styles.get('Normal') or estilos_nativos['Normal']
            elements.append(Spacer(1, 15 * mm))
            elements.append(Paragraph("No se encontraron familiares registrados para estos empleados.", estilo_mensaje))

        return elements

    # =========================================================================
    # Métodos auxiliares para extraer datos
    # =========================================================================
    
    def _get_familiares(self, employee):
        """Obtiene la lista de familiares del empleado."""
        if isinstance(employee, dict):
            return employee.get('carga_familiar', []) or employee.get('familiares', [])
        
        # Si es un modelo Django
        if hasattr(employee, 'carga_familiar'):
            return employee.carga_familiar.all()
        return []
    
    def _get_familiares_count(self, employee):
        """Cuenta los familiares del empleado."""
        familiares = self._get_familiares(employee)
        if hasattr(familiares, 'count'):
            return familiares.count()
        return len(familiares) if familiares else 0
    
    def _get_cedula_empleado(self, employee):
        """Extrae la cédula del empleado."""
        if isinstance(employee, dict):
            return str(employee.get('cedulaidentidad', 'N/A'))
        return str(getattr(employee, 'cedulaidentidad', 'N/A'))
    
    def _get_nombre_empleado(self, employee):
        """Extrae el nombre completo del empleado."""
        if isinstance(employee, dict):
            nombres = employee.get('nombres', '')
            apellidos = employee.get('apellidos', '')
        else:
            nombres = getattr(employee, 'nombres', '')
            apellidos = getattr(employee, 'apellidos', '')
        
        return f"{nombres} {apellidos}".strip() or 'N/A'
    
    def _get_cedula_familiar(self, familiar):
        """Extrae la cédula del familiar."""
        if isinstance(familiar, dict):
            return str(familiar.get('cedulaFamiliar', 'N/A') or 'N/A')
        cedula = getattr(familiar, 'cedulaFamiliar', None)
        return str(cedula) if cedula else 'N/A'
    
    def _get_nombre_familiar(self, familiar):
        """Extrae el nombre completo del familiar."""
        if isinstance(familiar, dict):
            p_nombre = familiar.get('primer_nombre', '')
            s_nombre = familiar.get('segundo_nombre', '') or ''
            p_apellido = familiar.get('primer_apellido', '')
            s_apellido = familiar.get('segundo_apellido', '') or ''
        else:
            p_nombre = getattr(familiar, 'primer_nombre', '')
            s_nombre = getattr(familiar, 'segundo_nombre', '') or ''
            p_apellido = getattr(familiar, 'primer_apellido', '')
            s_apellido = getattr(familiar, 'segundo_apellido', '') or ''
        
        nombre = f"{p_nombre} {s_nombre}".strip()
        apellido = f"{p_apellido} {s_apellido}".strip()
        return f"{nombre} {apellido}".strip() or 'N/A'
    
    def _get_parentesco(self, familiar):
        """Extrae el parentesco."""
        if isinstance(familiar, dict):
            parentesco = familiar.get('parentesco', {})
            if isinstance(parentesco, dict):
                return parentesco.get('descripcion_parentesco', 'N/A')
            return str(parentesco) if parentesco else 'N/A'
        
        parentesco_obj = getattr(familiar, 'parentesco', None)
        if parentesco_obj:
            return getattr(parentesco_obj, 'descripcion_parentesco', 'N/A')
        return 'N/A'
    
    def _get_fecha_nacimiento(self, familiar):
        """Extrae y formatea la fecha de nacimiento."""
        if isinstance(familiar, dict):
            fecha = familiar.get('fechanacimiento')
        else:
            fecha = getattr(familiar, 'fechanacimiento', None)
        return format_date(fecha)
    
    def _get_sexo(self, familiar):
        """Extrae el sexo del familiar."""
        if isinstance(familiar, dict):
            sexo = familiar.get('sexo', {})
            if isinstance(sexo, dict):
                sexo_texto = str(sexo.get('sexo', 'N/A')).upper()
            else:
                sexo_texto = str(sexo).upper() if sexo else 'N/A'
        else:
            sexo_obj = getattr(familiar, 'sexo', None)
            sexo_texto = str(getattr(sexo_obj, 'sexo', 'N/A')).upper() if sexo_obj else 'N/A'

        return 'M' if 'MASCULINO' in sexo_texto else 'F' if 'FEMENINO' in sexo_texto else sexo_texto
    
    def _get_estado_civil(self, familiar):
        """Extrae el estado civil del familiar."""
        if isinstance(familiar, dict):
            estado = familiar.get('estadoCivil', {})
            if isinstance(estado, dict):
                return estado.get('estadoCivil', 'N/A')
            return str(estado) if estado else 'N/A'
        
        estado_obj = getattr(familiar, 'estadoCivil', None)
        if estado_obj:
            return getattr(estado_obj, 'estadoCivil', 'N/A')
        return 'N/A'
    
    def _get_heredero(self, familiar):
        """Verifica si es heredero."""
        if isinstance(familiar, dict):
            return familiar.get('heredero', False)
        return getattr(familiar, 'heredero', False)
    
    def _get_mismo_ente(self, familiar):
        """Verifica si trabaja en el mismo ente."""
        if isinstance(familiar, dict):
            return familiar.get('mismo_ente', False)
        return getattr(familiar, 'mismo_ente', False)
    
    def _draw_header(self, canvas, doc):
        """Dibuja el header en el canvas."""
        canvas.saveState()

        if not hasattr(self, '_cached_header_elements'):
            institucion = "Comisión Nacional de Telecomunicaciones "
            institucion2 = "(CONATEL) "

            # Determinar el título principal basado en el filtro
            filtros = self.metadata.get('filters', {})
            filtro_aplicado_id = filtros.get('nomina_id', None)

            # Obtener el nombre del filtro basado en el ID (simulación de consulta o mapeo)
            filtro_aplicado_nombre = self._get_nomina_nombre(filtro_aplicado_id) if filtro_aplicado_id else None

            titulo_principal = f"Listado de {filtro_aplicado_nombre}" if filtro_aplicado_nombre else "REPORTE DE FAMILIARES"

            # Formatear el título con un diseño más limpio y presentable
            titulo_reporte = (
                f"<font size='12'><b>{institucion} <br/> {institucion2}</b></font><br/><font size='14'><b><br/>{titulo_principal}</b></font>"
            )

            self._cached_header_elements = create_header(titulo_reporte, width=doc.width)

        header_elements = self._cached_header_elements

        # Posicionamiento vertical
        y_offset = doc.pagesize[1] - self.page_config['topMargin'] + 10 * mm

        for el in header_elements:
            # wrap calcula el espacio necesario para el elemento
            w, h = el.wrap(doc.width, doc.topMargin)
            # drawOn "estampa" el elemento (tabla o spacer) en las coordenadas X, Y
            el.drawOn(canvas, doc.leftMargin, y_offset)
            y_offset -= h

        canvas.restoreState()

    def _get_nomina_nombre(self, nomina_id):
        """Obtiene el nombre de la nómina basado en el ID."""
        try:
            # Simulación de consulta para obtener el nombre de la nómina
            Nomina = apps.get_model('RAC', 'Tiponomina')
            nomina = Nomina.objects.get(id=nomina_id)
            return nomina.nomina
        except Exception:
            return "N/A"

    def _get_orden_cargo(self, employee):
        """Obtiene el peso jerárquico del cargo del empleado para ordenarlo."""
        assignments = getattr(employee, 'filtered_assignments', None)
        if assignments is None:
            assignments = list(employee.assignments.all()) if hasattr(employee, 'assignments') else []
            
        if assignments:
            asig = assignments[0]
            cargo_obj = getattr(asig, 'denominacioncargoid', None)
            if cargo_obj:
                try:
                    return int(getattr(cargo_obj, 'orden_by_cargo', 999))
                except (ValueError, TypeError):
                    return 999
        return 999

    def _sort_family_members(self):
        """Ordena los miembros de la familia según criterios específicos."""
        # Se mantiene por compatibilidad en caso de usarse de forma externa
        if hasattr(self, 'family_members'):
            self.family_members.sort(
                key=lambda f: (
                    self._get_dependencia(f).lower(),
                    self._get_tipo_nomina(f).lower(),
                    self._get_cargo(f).lower(),
                    int(self._get_cedula_familiar(f)) if self._get_cedula_familiar(f).isdigit() else 0,
                    int(self._get_cedula(f)) if self._get_cedula(f).isdigit() else 0
                )
            )