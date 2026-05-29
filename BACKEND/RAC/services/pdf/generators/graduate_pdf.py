"""
Generador de PDF para reportes de egresados.
Genera una tabla con información de empleados egresados.
"""


from reportlab.platypus import Spacer, Paragraph, PageBreak,KeepTogether
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import mm
from  django.apps import apps

from ..base_generator import BasePDFGenerator
from ..templates.styles import PAGE_CONFIG, COLORS, get_paragraph_styles
from ..templates.components import (
    create_header, 
    create_section_title, 
    create_data_table,
    create_stats_box,
    format_date
)


class GraduatePDFGenerator(BasePDFGenerator):
    """
    Generador de PDF para reportes de egresados.
    
    Genera un reporte tabular con los datos de empleados egresados:
    - Cédula
    - Nombre completo
    - Fecha de ingreso
    - Fecha de egreso
    - Motivo de egreso
    - Último cargo
    - Última dirección
    """
    
    def __init__(self, graduates, title="Reporte de Egresados", filters=None):
        """
        Inicializa el generador de PDF de egresados.
        
        Args:
            graduates: QuerySet o lista de egresados
            title: Título del reporte
            filters: Diccionario con los filtros aplicados
        """
        super().__init__(
            data=graduates,
            title=title,
            orientation='landscape',
            metadata={'filters': filters or {}}
        )
        
        self.graduates = list(graduates) if hasattr(graduates, '__iter__') else []
        self.graduates.sort(
            key=lambda g: (
                self._get_dependencia(g).lower(),
                self._get_tipo_nomina(g).lower(),
                self._get_cargo(g).lower(),
                int(self._get_cedula(g)) if self._get_cedula(g).isdigit() else 0
            )
        )
        self.filters = filters or {}
        self.styles = get_paragraph_styles()
    
    def _get_footer_text(self):
        """Retorna el texto para el footer."""
        total = len(self.graduates)
        return f"Total de egresados: {total} | Generado: {self.generated_at.strftime('%d/%m/%Y %H:%M')}"
    
    def _generate_filename(self):
        """Genera el nombre del archivo."""
        date_str = self.generated_at.strftime('%Y%m%d_%H%M')
        return f"reporte_egresados_{date_str}.pdf"
    
    def _build_content(self):
        """Construye el contenido del PDF."""
        story = []
        
        # Agregar encabezado con estadísticas
        story.extend(self._build_header_section())
        
        # Agregar sección de filtros aplicados (si hay)
        if self.filters:
            story.extend(self._build_filters_section())
        
        # Agregar tabla de egresados
        story.extend(self._build_graduates_table())
        
        return story
    
    def _build_header_section(self):
        """Construye la sección del encabezado con estadísticas."""
        elements = []
        
        elements.append(Spacer(1, 10))
        
        # Estadísticas generales
        total_egresados = len(self.graduates)
        
        # Contar por motivo
        motivos_count = {}
        for g in self.graduates:
            motivo = self._get_motivo(g)
            motivos_count[motivo] = motivos_count.get(motivo, 0) + 1
        
        stats = {'Total Egresados': total_egresados}
        # Agregar top 3 motivos
        for motivo, count in sorted(motivos_count.items(), key=lambda x: -x[1])[:3]:
            if motivo != 'N/A':
                stats[motivo] = count
        
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
    
    def _build_graduates_table(self):
        """
        Construye la tabla de egresados con agrupación anidada evitando títulos huérfanos.
        """
        elements = []

        # 1. Estructura de agrupación anidada
        agrupacion = {}
        for graduate in self.graduates:
            dep = self._get_dependencia(graduate)
            dg = self._get_ultima_direccion(graduate)
            
            if dep not in agrupacion:
                agrupacion[dep] = {}
            if dg not in agrupacion[dep]:
                agrupacion[dep][dg] = []
            agrupacion[dep][dg].append(graduate)

        # 2. Iterar sobre Dependencias
        for dep_nombre in sorted(agrupacion.keys()):
            # --- CAMBIO CLAVE: Agrupar el título de Dep con el primer bloque de Dirección ---
            dep_elements = []
            titulo_dep_parts = create_section_title(f"ORGANISMO: {dep_nombre.upper()}")
            for part in titulo_dep_parts:
                if isinstance(part, Paragraph):
                    part.keepWithNext = True # Indica que no debe haber salto de página después
                dep_elements.append(part)
            
            direcciones = agrupacion[dep_nombre]
            sorted_dg_keys = sorted(direcciones.keys())

            for i, dg_nombre in enumerate(sorted_dg_keys):
                bloque_direccion = []
                
                # Si es la primera dirección de la dependencia, la unimos al título de la dependencia
                if i == 0:
                    bloque_direccion.extend(dep_elements)

                # Título de la Dirección General
                titulo_dg_parts = create_section_title(f"    * {dg_nombre}")
                for part in titulo_dg_parts:
                    if isinstance(part, Paragraph):
                        part.keepWithNext = True
                    bloque_direccion.append(part)

                # Configuración de Tabla y Datos
                headers = ['#', 'Cédula', 'Nombre Completo', 'F. Ingreso', 'F. Egreso', 'Motivo', 'Último Cargo']
                col_widths = [10*mm, 22*mm, 55*mm, 25*mm, 25*mm, 45*mm, 75*mm]

                rows = []
                egresados_ordenados = sorted(direcciones[dg_nombre], key=lambda x: self._get_nombre(x))
                for idx, graduate in enumerate(egresados_ordenados, start=1):
                    rows.append([
                        str(idx),
                        self._get_cedula(graduate),
                        self._get_nombre(graduate),
                        self._get_fecha_ingreso(graduate),
                        self._get_fecha_egreso(graduate),
                        self._get_motivo(graduate),
                        self._get_ultimo_cargo(graduate),
                    ])

                if rows:
                    table = create_data_table(headers, rows, col_widths, with_alternating_rows=True)
                    # IMPORTANTE: Permitir que la tabla se divida entre páginas si es muy larga
                    # pero que el inicio de la tabla esté pegado al título
                    bloque_direccion.append(table)
                    bloque_direccion.append(Spacer(1, 8 * mm))
                    
                    # Usamos KeepTogether pero con lógica: 
                    # Solo mantendrá juntos el título y las primeras filas de la tabla
                    elements.append(KeepTogether(bloque_direccion))
                else:
                    elements.append(Paragraph("No se encontraron registros.", self.styles['Body']))

        return elements
    
    # =========================================================================
    # Métodos auxiliares para extraer datos
    # =========================================================================
    
    def _get_cedula(self, graduate):
        """Extrae la cédula del empleado egresado."""
        if isinstance(graduate, dict):
            employee = graduate.get('employee', {})
            if isinstance(employee, dict):
                return str(employee.get('cedulaidentidad', 'N/A'))
            return 'N/A'
        
        employee = getattr(graduate, 'employee', None)
        if employee:
            return str(getattr(employee, 'cedulaidentidad', 'N/A'))
        return 'N/A'
    
    def _get_nombre(self, graduate):
        """Extrae el nombre completo del empleado egresado."""
        if isinstance(graduate, dict):
            employee = graduate.get('employee', {})
            if isinstance(employee, dict):
                nombres = employee.get('nombres', '')
                apellidos = employee.get('apellidos', '')
                return f"{nombres} {apellidos}".strip() or 'N/A'
            return 'N/A'
        
        employee = getattr(graduate, 'employee', None)
        if employee:
            nombres = getattr(employee, 'nombres', '')
            apellidos = getattr(employee, 'apellidos', '')
            return f"{nombres} {apellidos}".strip() or 'N/A'
        return 'N/A'
    
    def _get_fecha_ingreso(self, graduate):
        """Extrae la fecha de ingreso."""
        if isinstance(graduate, dict):
            fecha = graduate.get('fechaingresoorganismo')
        else:
            fecha = getattr(graduate, 'fechaingresoorganismo', None)
        return format_date(fecha)
    
    def _get_fecha_egreso(self, graduate):
        """Extrae la fecha de egreso."""
        if isinstance(graduate, dict):
            fecha = graduate.get('fecha_egreso')
        else:
            fecha = getattr(graduate, 'fecha_egreso', None)
        return format_date(fecha)
    
    def _get_motivo(self, graduate):
        """Extrae el motivo de egreso."""
        if isinstance(graduate, dict):
            motivo = graduate.get('motivo_egreso', {})
            if isinstance(motivo, dict):
                return motivo.get('movimiento', 'N/A')
            return str(motivo) if motivo else 'N/A'
        
        motivo_obj = getattr(graduate, 'motivo_egreso', None)
        if motivo_obj:
            return getattr(motivo_obj, 'movimiento', 'N/A')
        return 'N/A'
    
    def _get_ultimo_cargo(self, graduate):
        """Extrae el último cargo del egresado."""
        if isinstance(graduate, dict):
            cargos = graduate.get('cargos_historial', [])
            if cargos and len(cargos) > 0:
                cargo = cargos[0]
                if isinstance(cargo, dict):
                    cargo_info = cargo.get('denominacioncargoid', {})
                    if isinstance(cargo_info, dict):
                        return cargo_info.get('cargo', 'N/A')
            return 'N/A'
        
        # Si es un modelo Django
        cargos = getattr(graduate, 'cargos_historial', None)
        if cargos:
            try:
                first_cargo = cargos.first()
                if first_cargo:
                    cargo_obj = getattr(first_cargo, 'denominacioncargoid', None)
                    if cargo_obj:
                        return getattr(cargo_obj, 'cargo', 'N/A')
            except:
                pass
        return 'N/A'
    
    def _get_ultima_direccion(self, graduate):
        """Obtiene la última dirección del egresado."""
        cargos = getattr(graduate, 'cargos_historial', None)
        if cargos:
            try:
                # Ordenar los cargos por fecha de ingreso y obtener el más reciente
                ultimo_cargo = cargos.order_by('-egreso__fecha_egreso').first()
                if ultimo_cargo:
                    direccion_general = getattr(ultimo_cargo, 'DireccionGeneral', None)
                    if direccion_general:
                        return getattr(direccion_general, 'direccion_general', 'N/A')
            except Exception:
                pass
        return 'N/A'

    def _get_dependencia(self, graduate):
        """Obtiene la dependencia asociada a la dirección general del egresado."""
        cargos = getattr(graduate, 'cargos_historial', None)
        if cargos:
            try:
                # Ordenar los cargos por fecha de egreso y obtener el más reciente
                ultimo_cargo = cargos.order_by('-egreso__fecha_egreso').first()
                if ultimo_cargo:
                    direccion_general = getattr(ultimo_cargo, 'DireccionGeneral', None)
                    if direccion_general and direccion_general.dependenciaId:
                        return direccion_general.dependenciaId.dependencia
            except Exception:
                pass
        return "N/A"

    def _get_tipo_nomina(self, cargo):
        """Obtiene el tipo de nómina del cargo."""
        nomina_obj = getattr(cargo, 'tiponominaid', None)
        return getattr(nomina_obj, 'nomina', 'N/A') if nomina_obj else 'N/A'

    def _get_cargo(self, cargo):
        """Obtiene la denominación del cargo."""
        cargo_obj = getattr(cargo, 'denominacioncargoid', None)
        return getattr(cargo_obj, 'cargo', 'N/A') if cargo_obj else 'N/A'

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

            titulo_principal = f"Listado de {filtro_aplicado_nombre}" if filtro_aplicado_nombre else "REPORTE DE EGRESADOS"

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

