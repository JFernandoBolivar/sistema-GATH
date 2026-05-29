from django.db.models import Count, Q
from reportlab.platypus import Spacer, Paragraph, KeepTogether,CondPageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from django.apps import apps

from ..base_generator import BasePDFGenerator
from ..templates.styles import get_paragraph_styles
from ..templates.components import (
    create_section_title, 
    create_data_table,
    create_stats_box,
    create_header
)

class AssignmentPDFGenerator(BasePDFGenerator):
    def __init__(self, assignments, title="Reporte de Cargos", filters=None):
        super().__init__(
            data=assignments,
            title=title,
            orientation='landscape',
            metadata={'filters': filters or {}}
        )
        self.assignments = assignments 
        self.filters = filters or {}
        self.styles = get_paragraph_styles()

    def _get_footer_text(self):
        total = self.assignments.count()
        return f"Total de Cargos: {total} | Generado: {self.generated_at.strftime('%d/%m/%Y %H:%M')}"

    def _build_content(self):
        """
        CONSTRUCCIÓN ÚNICA: Une estadísticas y tablas en un solo flujo.
        """
        story = []
        # 1. Sección de estadísticas
        story.extend(self._build_header_section())
        # 2. Cuerpo del reporte
        story.extend(self._build_assignments_table())
        return story

    def _build_header_section(self):
        """Construye las estadísticas optimizando el espacio vertical."""
        elements = []
        elements.append(Spacer(1, 2*mm)) # Reducido de 10mm

        stats_data = self.assignments.aggregate(
            total=Count('id'),
            ocupados=Count('id', filter=Q(estatusid__estatus__iexact='ACTIVO')),
            vacantes=Count('id', filter=Q(estatusid__estatus__iexact='VACANTE'))
        )

        stats = {
            'Total Cargos': stats_data['total'],
            'Ocupados': stats_data['ocupados'],
            'Vacantes': stats_data['vacantes'],
        }

        width = self._get_available_width()
        elements.append(create_stats_box(stats, width))
        elements.append(Spacer(1, 4*mm)) # Reducido de 15mm para ganar espacio
        return elements

    def _build_assignments_table(self):
        elements = []
        
        
        
        if not self.assignments:
            elements.append(Spacer(1, 15 * mm))
            
            # Buscamos un estilo válido de forma segura, si no existe ninguno, 
            # usamos el 'Normal' nativo de ReportLab.
            estilos_nativos = getSampleStyleSheet()
            estilo_mensaje = self.styles.get('Body') or self.styles.get('Normal') or estilos_nativos['Normal']
            
            elements.append(Paragraph(
                "No se encontraron cargos con los filtros aplicados.",
                estilo_mensaje
            ))
            return elements
        agrupacion = {}
    
        # 1. Agrupación Jerárquica (Aplicando tu lógica del Reporte de Empleados)
        for asig in self.assignments.iterator():
            dep = getattr(asig, 'Dependencia', None)
            if not dep:
                dg_obj = getattr(asig, 'DireccionGeneral', None)
                # Mantenemos esta protección extra por si la Asignación no tiene Dependencia directa
                dep = getattr(dg_obj, 'dependenciaId', None) or "DEPENDENCIA DESCONOCIDA"
            
            # Forzamos los strings desde el inicio, tal como en Empleados
            dg = getattr(asig, 'DireccionGeneral', None) or "ASIGNACIÓN DIRECTA"
            dl = getattr(asig, 'DireccionLinea', None) or "ASIGNACIÓN DIRECTA"
            coord = getattr(asig, 'Coordinacion', None) or "ASIGNACIÓN DIRECTA"
            
            if dep not in agrupacion: agrupacion[dep] = {}
            if dg not in agrupacion[dep]: agrupacion[dep][dg] = {}
            if dl not in agrupacion[dep][dg]: agrupacion[dep][dg][dl] = {}
            if coord not in agrupacion[dep][dg][dl]: agrupacion[dep][dg][dl][coord] = []
            agrupacion[dep][dg][dl][coord].append(asig)
    
        # 2. Control de Renderizado
        impreso_dep, impreso_dg, impreso_dl = None, None, None
        
        ignorar_titulos = {
            "ASIGNACIÓN DIRECTA", "ASIGNACIÓN DIRECTA A LA DEPENDENCIA", 
            "ASIGNACIÓN DIRECTA A LA DIRECCION GENERAL", "ASIGNACIÓN DIRECTA A LA DIRECCION LINEA",
            "NONE", "N/A", "SIN DIRECCIÓN ASIGNADA", "S/D"
        }


        sorted_deps = sorted(agrupacion.keys(), key=lambda d: getattr(d, 'Codigo', '') if not isinstance(d, str) else '')
    
        for dep in sorted_deps:
            # Al igual que en Empleados, getattr extrae el nombre o usa el string por defecto
            dep_nom = getattr(dep, 'dependencia', str(dep))
            dgs = agrupacion[dep]
            sorted_dgs = sorted(dgs.keys(), key=lambda g: getattr(g, 'Codigo', '') if not isinstance(g, str) else '')
    
            for dg in sorted_dgs:
                dg_nom = getattr(dg, 'direccion_general', str(dg))
                dls = dgs[dg]
                sorted_dls = sorted(dls.keys(), key=lambda l: getattr(l, 'Codigo', '') if not isinstance(l, str) else '')
    
                for dl in sorted_dls:
                    dl_nom = getattr(dl, 'direccion_linea', str(dl))
                    coords_dict = dls[dl]
                    sorted_coords = sorted(coords_dict.keys(), key=lambda c: getattr(c, 'Codigo', '') if not isinstance(c, str) else '')
    
                    for coord in sorted_coords:
                        coord_nom = getattr(coord, 'coordinacion', str(coord))
                        records = coords_dict[coord]
                        if not records: continue

                        # BLOQUE DE TÍTULOS
                        titulos_bloque = []
                        if dep_nom != impreso_dep:
                            titulos_bloque.extend(create_section_title(f"NIVEL: {dep_nom.upper()}"))
                            impreso_dep = dep_nom
                            impreso_dg, impreso_dl = None, None

                        if dg_nom != impreso_dg and dg_nom.upper().strip() not in ignorar_titulos:
                            titulos_bloque.extend(create_section_title(f"  > DG / GEREN / OFIC: {dg_nom.upper()}"))
                            impreso_dg = dg_nom
                            impreso_dl = None

                        if dl_nom != impreso_dl and dl_nom.upper().strip() not in ignorar_titulos:
                            titulos_bloque.extend(create_section_title(f"    - DIV / COORD: {dl_nom.upper()}"))
                            impreso_dl = dl_nom
                        
                        if coord_nom.upper().strip() not in ignorar_titulos:
                            titulos_bloque.extend(create_section_title(f"      * COORD: {coord_nom.upper()}"))

                        # PREPARACIÓN DE DATOS (Ordenados por cargo y cédula)
                        def sort_key(a):
                            obj = getattr(a, 'denominacioncargoid', None)
                            weight = getattr(obj, 'orden_by_cargo', 999)
                            organismo = self._get_organisoAdscrito(a) or ""
                            organismo = organismo.strip().lower()
                            cedula = self._get_cedula_empleado(a)
                            try: c_val = int(cedula)
                            except: c_val = 0
                            return (weight, c_val)
                        


                        assignments_sorted = sorted(records, key=sort_key)
                        rows = [[str(idx), self._get_codigo(a), self._get_cedula_empleado(a), 
                                 self._get_nombre_empleado(a), self._get_cargo(a), 
                                 self._get_cargo_especifico(a), self._get_grado(a), 
                                 self._get_tipo_nomina(a), self._get_organisoAdscrito(a),self._get_estatus(a)] 
                                for idx, a in enumerate(assignments_sorted, start=1)]

                        headers = ['#', 'Código', 'Cédula', 'Empleado', 'Cargo', 'Cargo Esp.', 'Grado', 'Nómina', 'Organismo Adscrito','Estatus']
                        col_widths = [10*mm, 15*mm, 22*mm, 40*mm, 33*mm, 35*mm, 13*mm, 25*mm, 36*mm, 25*mm]
                        
                        # CREACIÓN DE LA TABLA COMPLETA
                        tabla_completa = create_data_table(headers, rows, col_widths, with_alternating_rows=True)
                        
                        # DIBUJO E INSERCIÓN SEGURA (Evita títulos huérfanos o divisiones bruscas)
                        if titulos_bloque or rows:
                            espacio_requerido = (len(titulos_bloque) * 6 * mm) + 25 * mm
                            elements.append(CondPageBreak(espacio_requerido))
                            
                            if titulos_bloque:
                                for p in titulos_bloque:
                                    if hasattr(p, 'keepWithNext'): p.keepWithNext = True
                                elements.extend(titulos_bloque)
                                elements.append(Spacer(1, 1*mm))
                            
                            elements.append(tabla_completa)
                            elements.append(Spacer(1, 5 * mm))
    
        return elements
    
    def _draw_header(self, canvas, doc):
        """Dibuja el header reduciendo el espacio consumido."""
        canvas.saveState()
        if not hasattr(self, '_cached_header_elements'):
            institucion = "Comisión Nacional de Telecomunicaciones "
            institucion2 = "(CONATEL) "
            filtros = self.metadata.get('filters', {})
            filtro_id = filtros.get('nomina_id', None)
            nombre_filtro = self._get_nomina_nombre(filtro_id) if filtro_id else None
            titulo = f"LISTADO DE {nombre_filtro.upper()}" if nombre_filtro else "REPORTE DE CARGOS"

            titulo_reporte = f"<font size='12'><b>{institucion} <br/> {institucion2}</b></font><br/><font size='14'><b><br/>{titulo}</b></font>"
            self._cached_header_elements = create_header(titulo_reporte, width=doc.width)
         
            
        y_offset = doc.pagesize[1] - self.page_config['topMargin'] + 5*mm
        for el in self._cached_header_elements:
            w, h = el.wrap(doc.width, doc.topMargin)
            el.drawOn(canvas, doc.leftMargin, y_offset)
            y_offset -= h
        canvas.restoreState()

    def _get_nomina_nombre(self, nomina_id):
        try:
            Nomina = apps.get_model('RAC', 'Tiponomina')
            return Nomina.objects.get(id=nomina_id).nomina
        except: return "N/A"

    def _get_codigo(self, assignment): return str(getattr(assignment, 'codigo', 'N/A'))
    
    def _get_cedula_empleado(self, assignment):
        emp = getattr(assignment, 'employee', None)
        return str(getattr(emp, 'cedulaidentidad', 'Vacante')) if emp else 'Vacante'
    
    def _get_nombre_empleado(self, assignment):
        emp = getattr(assignment, 'employee', None)
        if emp: return f"{getattr(emp, 'nombres', '')} {getattr(emp, 'apellidos', '')}".strip()
        return 'Vacante'
    
    def _get_cargo(self, assignment):
        obj = getattr(assignment, 'denominacioncargoid', None)
        return getattr(obj, 'cargo', 'N/A') if obj else 'N/A'

    def _get_cargo_especifico(self, assignment):
        obj = getattr(assignment, 'denominacioncargoespecificoid', None)
        return getattr(obj, 'cargo', 'N/A') if obj else 'N/A'
    
    def _get_organisoAdscrito(self, assignment):
        obj = getattr(assignment, 'OrganismoAdscritoid', None)
        return getattr(obj, 'Organismoadscrito', 'MPPRIJP') if obj else 'MPPRIJP'
    
    def _get_grado(self, assignment):
        obj = getattr(assignment, 'gradoid', None)
        return getattr(obj, 'grado', 'N/A') if obj else 'N/A'
    
    def _get_tipo_nomina(self, assignment):
        obj = getattr(assignment, 'tiponominaid', None)
        return getattr(obj, 'nomina', 'N/A') if obj else 'N/A'
    
    def _get_estatus(self, assignment):
        obj = getattr(assignment, 'estatusid', None)
        return getattr(obj, 'estatus', 'N/A') if obj else 'N/A'
    
    
    
    def _get_orden_cargo(self, assignment):
        cargo_obj = getattr(assignment, 'denominacioncargoid', None)
        
        # Si el objeto existe, obtenemos su 'orden_by_cargo', si no, retornamos 999
        return getattr(cargo_obj, 'orden_by_cargo', 999) if cargo_obj else 999
    
   
   
