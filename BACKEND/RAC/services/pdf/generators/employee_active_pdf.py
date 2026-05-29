from reportlab.platypus import Spacer, Paragraph, KeepTogether,CondPageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from django.apps import apps
from ..templates.styles import get_paragraph_styles
from ..templates.components import (
    create_header, 
    create_section_title, 
    create_data_table,
    create_stats_box,
    format_date
)
from ..base_generator import BasePDFGenerator

class EmployeePDFGenerator(BasePDFGenerator):
    
    def __init__(self, employees, title="Reporte de Empleados", filters=None):
        super().__init__(
            data=employees,
            title=title,
            orientation='landscape',  
            metadata={'filters': filters or {}}
        )
        self.employees = employees
        self.filters = filters or {}
        self.styles = get_paragraph_styles()

    def _get_footer_text(self):
        total = len(self.employees)
        return f"Total de empleados: {total} | Generado: {self.generated_at.strftime('%d/%m/%Y %H:%M')}"

    def _generate_filename(self):
        date_str = self.generated_at.strftime('%Y%m%d_%H%M')
        return f"reporte_empleados_{date_str}.pdf"

    def _build_content(self):
        story = []
        story.extend(self._build_header_section())
        story.extend(self._build_employees_table())
        return story

    def _draw_header(self, canvas, doc):
        canvas.saveState()
        if not hasattr(self, '_cached_header_elements'):
            institucion = "Comisión Nacional de Telecomunicaciones "
            institucion2 = "(CONATEL) "
            filtros = self.metadata.get('filters', {})
            filtro_aplicado_id = filtros.get('nomina_id', None)
            filtro_aplicado_nombre = self._get_nomina_nombre(filtro_aplicado_id) if filtro_aplicado_id else None
            titulo_principal = f"Listado de {filtro_aplicado_nombre}" if filtro_aplicado_nombre else "REPORTE DE TRABAJADORES"
            titulo_reporte = (
                f"<font size='12'><b>{institucion} <br/> {institucion2}</b></font><br/><font size='14'><b><br/>{titulo_principal}</b></font>"
            )
            self._cached_header_elements = create_header(titulo_reporte, width=doc.width)

        header_elements = self._cached_header_elements
        y_offset = doc.pagesize[1] - self.page_config['topMargin'] + 10 * mm
        for el in header_elements:
            w, h = el.wrap(doc.width, doc.topMargin)
            el.drawOn(canvas, doc.leftMargin, y_offset)
            y_offset -= h
        canvas.restoreState()

    def _build_header_section(self):
        elements = []
        elements.append(Spacer(1, 10))
        total_empleados = len(self.employees)
        masculino = sum(1 for e in self.employees if self._get_sexo(e) == 'M')
        femenino = sum(1 for e in self.employees if self._get_sexo(e) == 'F')
        stats = {'Total Empleados': total_empleados, 'Masculino': masculino, 'Femenino': femenino}
        width = self._get_available_width()
        elements.append(create_stats_box(stats, width))
        elements.append(Spacer(1, 15))
        return elements

    def _build_employees_table(self):
        elements = []
        if not self.employees:
            elements.append(Spacer(1, 15 * mm))
            
        
            estilos_nativos = getSampleStyleSheet()
            estilo_mensaje = self.styles.get('Body') or self.styles.get('Normal') or estilos_nativos['Normal']
            
            elements.append(Paragraph(
                "No se encontraron trabajadores con los filtros aplicados.",
                estilo_mensaje
            ))
            return elements
        # 1. Agrupación Jerárquica
        agrupacion = {} 
        for employee in self.employees:
            assignments = getattr(employee, 'filtered_assignments', [])
            if not assignments:
                self._registrar_en_agrupacion(agrupacion, "S/D", "S/D", "S/D", "S/D", employee)
                continue
            asig = assignments[0]
            dep = getattr(asig, 'Dependencia', None) or "DEPENDENCIA DESCONOCIDA"
            dg = getattr(asig, 'DireccionGeneral', None) or "ASIGNACIÓN DIRECTA"
            dl = getattr(asig, 'DireccionLinea', None) or "ASIGNACIÓN DIRECTA"
            coord = getattr(asig, 'Coordinacion', None) or "ASIGNACIÓN DIRECTA"
            self._registrar_en_agrupacion(agrupacion, dep, dg, dl, coord, employee)

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
                        
                        headers = ['#', 'Codigo','Cédula', 'Nombres', 'Apellidos', 'F. Ingreso',  'Sexo', 'Tipo de Nómina', 'Cargo','Organismo Adscrito']
                        col_widths = [10*mm,15*mm, 22*mm, 30*mm, 30*mm, 22*mm, 15*mm, 30*mm, 40*mm, 45*mm]
                        
                        def sort_cedula_desc(e):
                            c = self._get_cedula(e)
                            try: return int(c)
                            except: return 0

                        def sort_organismo(e):
                            return str(self._get__organisoAdscrito(e)).upper()

                        empleados = sorted(coords[coord], key=lambda e: (self._get_orden_cargo(e),sort_organismo(e),sort_cedula_desc(e)))
                        rows = [[str(idx), self._get_codigo(e), self._get_cedula(e), self._get_nombres(e), self._get_apellidos(e), 
                                 self._get_fecha_ingreso(e),  self._get_sexo(e), 
                                 self._get_tipo_nomina(e), self._get__cargo(e), self._get__organisoAdscrito(e)] 
                                for idx, e in enumerate(empleados, start=1)]
                     
                        if rows:
                            # Títulos del bloque
                            titulos_bloque = []
                            if dep_nom != impreso_dep:
                                titulos_bloque.extend(create_section_title(f"NIVEL: {dep_nom.upper()}"))
                                impreso_dg, impreso_dl = None, None 
                            if dg_nom != impreso_dg and dg_nom.upper().strip() not in ignorar:
                                titulos_bloque.extend(create_section_title(f"  > DG / GEREN / OFIC: {dg_nom}"))
                                impreso_dl = None 
                            if dl_nom != impreso_dl and dl_nom.upper().strip() not in ignorar:
                                titulos_bloque.extend(create_section_title(f"    - DIV / COORD: {dl_nom}"))
                            if coord_nom.upper().strip() not in ignorar:
                                titulos_bloque.extend(create_section_title(f"      * COORD: {coord_nom}"))
                            
                            tabla_completa = create_data_table(headers, rows, col_widths, with_alternating_rows=True)
                           
                            espacio_requerido = (len(titulos_bloque) * 6 * mm) + 25 * mm
                            elements.append(CondPageBreak(espacio_requerido))

                            elements.extend(titulos_bloque)
                            elements.append(Spacer(1, 2*mm))
                            elements.append(tabla_completa)

                            elements.append(Spacer(1, 6 * mm))
                            impreso_dep, impreso_dg, impreso_dl = dep_nom, dg_nom, dl_nom
                            
                            

        return elements
    
    # Métodos auxiliares (sin cambios)
    def _get_cedula(self, employee): return str(getattr(employee, 'cedulaidentidad', 'N/A'))
    def _get_nombres(self, employee): return getattr(employee, 'nombres', 'N/A')
    def _get_apellidos(self, employee): return getattr(employee, 'apellidos', 'N/A')
    def _get_fecha_ingreso(self, employee): return format_date(getattr(employee, 'fechaingresoorganismo', None))
    def _get_anos_apn(self, employee):
        anos = getattr(employee, 'total_anos_apn', 'N/A') 
        try: return str(int(anos)) if anos not in [None, 'N/A'] else 'N/A'
        except: return str(anos)
    def _get_sexo(self, employee):
        sexo_obj = getattr(employee, 'sexoid', None)
        sexo_texto = str(getattr(sexo_obj, 'sexo', 'N/A')).upper()
        return 'M' if 'MASCULINO' in sexo_texto else 'F' if 'FEMENINO' in sexo_texto else sexo_texto


    def _get_codigo(self, employee):
        f = getattr(employee, 'filtered_assignments', [])
        return f[0].codigo if f and f[0].codigo else "N/A"
    
    def _get_tipo_nomina(self, employee):
        f = getattr(employee, 'filtered_assignments', [])
        return f[0].tiponominaid.nomina if f and f[0].tiponominaid else "N/A"
    def _get__cargo(self, employee):
        f = getattr(employee, 'filtered_assignments', [])
        return f[0].denominacioncargoid.cargo if f and f[0].denominacioncargoid else "SIN CARGO"
    
    def _get__organisoAdscrito(self, employee):
        f = getattr(employee, 'filtered_assignments', [])
        return f[0].OrganismoAdscritoid.Organismoadscrito if f and f[0].OrganismoAdscritoid else "MPPRIJP"
 
    def _get_nomina_nombre(self, nomina_id):
        try: return apps.get_model('RAC', 'Tiponomina').objects.get(id=nomina_id).nomina
        except: return None
    def _get_orden_cargo(self, employee):
        f = getattr(employee, 'filtered_assignments', [])
        return getattr(f[0].denominacioncargoid, 'orden_by_cargo', 999) if f and f[0].denominacioncargoid else 999
    def _registrar_en_agrupacion(self, dic, dep, dg, dl, coord, emp):
        if dep not in dic: dic[dep] = {}
        if dg not in dic[dep]: dic[dep][dg] = {}
        if dl not in dic[dep][dg]: dic[dep][dg][dl] = {}
        if coord not in dic[dep][dg][dl]: dic[dep][dg][dl][coord] = []
        dic[dep][dg][dl][coord].append(emp)