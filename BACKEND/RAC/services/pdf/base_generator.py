"""
Clase base abstracta para generadores de PDF.
Define la estructura común y métodos que deben implementar los generadores específicos.
"""
from abc import ABC, abstractmethod
from io import BytesIO
from datetime import datetime

from django.http import FileResponse
from reportlab.platypus import SimpleDocTemplate, PageBreak
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from .templates.styles import PAGE_CONFIG, COLORS, FONTS
from .templates.components import create_header, create_footer


class BasePDFGenerator(ABC):
    """
    Clase base para todos los generadores de PDF.
    
    Proporciona funcionalidad común como:
    - Configuración de página
    - Headers y footers automáticos
    - Generación de respuesta HTTP
    """
    
    def __init__(self, data, title="Reporte", orientation='portrait', metadata=None):
        """
        Inicializa el generador de PDF.
        
        Args:
            data: Datos para generar el PDF (queryset o lista)
            title: Título del reporte
            orientation: 'portrait' o 'landscape'
            metadata: Diccionario con metadatos adicionales
        """
        self.data = data
        self.title = title
        self.orientation = orientation
        self.metadata = metadata or {}
        
        # Configuración de página
        self.page_config = PAGE_CONFIG.get(orientation, PAGE_CONFIG['portrait'])
        
        # Buffer para el PDF
        self.buffer = BytesIO()
        
        # Story (contenido del PDF)
        self.story = []
        
        # Contadores
        self.total_pages = 0
        self.current_page = 1
        
        # Fecha de generación
        self.generated_at = datetime.now()
    
    def _create_document(self):
        """Crea el documento PDF con la configuración de página."""
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=self.page_config['pagesize'],
            leftMargin=self.page_config['leftMargin'],
            rightMargin=self.page_config['rightMargin'],
            topMargin=self.page_config['topMargin'],
            bottomMargin=self.page_config['bottomMargin'],
            title=self.title,
            author='Sistema RAC',
            subject=f'Reporte generado el {self.generated_at.strftime("%d/%m/%Y %H:%M")}',
        )
        return doc
    
    def _get_available_width(self):
        """Calcula el ancho disponible para el contenido."""
        pagesize = self.page_config['pagesize']
        left_margin = self.page_config['leftMargin']
        right_margin = self.page_config['rightMargin']
        return pagesize[0] - left_margin - right_margin
    
    def _get_available_height(self):
        """Calcula el alto disponible para el contenido."""
        pagesize = self.page_config['pagesize']
        top_margin = self.page_config['topMargin']
        bottom_margin = self.page_config['bottomMargin']
        return pagesize[1] - top_margin - bottom_margin
    
    def _on_first_page(self, canvas, doc):
        """Callback para la primera página."""
        self._draw_header(canvas, doc)
        self._draw_footer(canvas, doc, 1)
    
    def _on_later_pages(self, canvas, doc):
        """Callback para páginas posteriores."""
        self._draw_header(canvas, doc)
        self._draw_footer(canvas, doc, doc.page)
    
    def _draw_header(self, canvas, doc):
        """Dibuja el header en el canvas."""
        canvas.saveState()
        
        header_elements = create_header(self.title, width=doc.width)
    
    # 2. Posicionamiento vertical
    # Calculamos la posición Y para que quede dentro del topMargin
        y_offset = doc.pagesize[1] - self.page_config['topMargin'] + 10 * mm
    
        for el in header_elements:
        # wrap calcula el espacio necesario para el elemento
            w, h = el.wrap(doc.width, doc.topMargin)
        # drawOn "estampa" el elemento (tabla o spacer) en las coordenadas X, Y
            el.drawOn(canvas, doc.leftMargin, y_offset)
            y_offset -= h
        
        canvas.restoreState()
    
    def _draw_footer(self, canvas, doc, page_number):
        """Dibuja el footer en el canvas."""
        create_footer(doc, canvas, page_number, self.total_pages, self._get_footer_text())
    
    def _get_footer_text(self):
        """Retorna el texto para el footer. Puede ser sobrescrito."""
        return f"Generado: {self.generated_at.strftime('%d/%m/%Y %H:%M')}"
    
    def _generate_filename(self):
        """Genera el nombre del archivo PDF."""
        safe_title = self.title.lower().replace(' ', '_')[:30]
        date_str = self.generated_at.strftime('%Y%m%d_%H%M')
        return f"{safe_title}_{date_str}.pdf"
    
    @abstractmethod
    def _build_content(self):
        """
        Construye el contenido del PDF.
        Debe ser implementado por las clases hijas.
        
        Returns:
            Lista de elementos Platypus para agregar al story.
        """
        pass
    
    def generate(self):
        """
        Genera el PDF completo.
        
        Returns:
            BytesIO buffer con el PDF generado.
        """
        # Crear documento
        doc = self._create_document()
        
        # Construir contenido
        self.story = self._build_content()
        
        # Construir PDF
        doc.build(
            self.story,
            onFirstPage=self._on_first_page,
            onLaterPages=self._on_later_pages
        )
        
        # Rebobinar buffer
        self.buffer.seek(0)
        
        return self.buffer
    
    def get_response(self, as_attachment=True):
        """
        Genera y retorna una respuesta HTTP con el PDF.
        
        Args:
            as_attachment: Si True, fuerza descarga. Si False, muestra en navegador.
        
        Returns:
            FileResponse con el PDF.
        """
        # Generar PDF
        self.generate()
        
        # Crear respuesta
        response = FileResponse(
            self.buffer,
            content_type='application/pdf'
        )
        
        filename = self._generate_filename()
        
        if as_attachment:
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
        else:
            response['Content-Disposition'] = f'inline; filename="{filename}"'
        
        return response
