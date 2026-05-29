from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import portrait
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from pdf2image import convert_from_bytes
from types import SimpleNamespace
from PIL import Image
import os
import qrcode
import qrcode.constants
from io import BytesIO
import base64
from django.conf import settings
from django.template import engines
from CARNETIZACION.models import CarnetTemplate


django_engine = engines["django"]


class CarnetDesigner:

    CARNET_WIDTH = 6.0 * cm
    CARNET_HEIGHT = 8.56 * cm

    CARNET_WIDTH_PT = CARNET_WIDTH
    CARNET_HEIGHT_PT = CARNET_HEIGHT

    TEXTO_MAX_ANCHO = 2.5 * cm
    TEXTO_MIN_FUENTE = 5
    TEXTO_MAX_FUENTE = 8

    def __init__(self):
        self.output_dir = os.path.join(settings.MEDIA_ROOT, 'carnet_pdfs')
        os.makedirs(self.output_dir, exist_ok=True)

    def _get_template_path(self):
        try:
            template = CarnetTemplate.objects.filter(activo=True).first()
            if template and template.imagen:
                path = template.imagen.path
                if os.path.exists(path):
                    return path
        except Exception:
            pass
        return None

    def _calcular_tamano_fuente(self, texto, fuente="Helvetica", max_ancho=None, tamano_inicial=8):
        if max_ancho is None:
            max_ancho = self.TEXTO_MAX_ANCHO

        tamano = tamano_inicial
        texto_ancho = stringWidth(texto, fuente, tamano)

        while texto_ancho > max_ancho and tamano > self.TEXTO_MIN_FUENTE:
            tamano -= 0.5
            texto_ancho = stringWidth(texto, fuente, tamano)

        if tamano < self.TEXTO_MIN_FUENTE:
            tamano = self.TEXTO_MIN_FUENTE

        return round(tamano, 1)

    def _dividir_texto_en_lineas(self, texto, fuente, tamano, max_ancho):
        palabras = texto.split()
        lineas = []
        linea_actual = ""

        for palabra in palabras:
            prueba = linea_actual + (" " if linea_actual else "") + palabra
            if stringWidth(prueba, fuente, tamano) <= max_ancho:
                linea_actual = prueba
            else:
                if linea_actual:
                    lineas.append(linea_actual)
                linea_actual = palabra
                if stringWidth(palabra, fuente, tamano) > max_ancho:
                    linea_actual = ""
                    for char in palabra:
                        prueba_char = linea_actual + char
                        if stringWidth(prueba_char, fuente, tamano) <= max_ancho:
                            linea_actual = prueba_char
                        else:
                            if linea_actual:
                                lineas.append(linea_actual)
                            linea_actual = char
                    if linea_actual:
                        lineas.append(linea_actual)
                        linea_actual = ""
                else:
                    linea_actual = palabra

        if linea_actual:
            lineas.append(linea_actual)

        return lineas

    def _colocar_texto_ajustado(self, c, texto, x, y, bold=False, max_ancho=None, tamano_inicial=8):
        fuente = "Helvetica-Bold" if bold else "Helvetica"

        palabra_mas_larga = max(texto.split(), key=len) if texto.split() else texto
        tamano = self._calcular_tamano_fuente(palabra_mas_larga, fuente, max_ancho, tamano_inicial)

        if max_ancho:
            lineas = self._dividir_texto_en_lineas(texto, fuente, tamano, max_ancho)
        else:
            lineas = [texto]

        line_height = tamano * 1.2

        c.setFont(fuente, tamano)
        c.setFillColorRGB(0, 0, 0)

        for i, linea in enumerate(lineas):
            y_linea = y - i * line_height
            c.drawCentredString(x, y_linea, linea)

        return tamano

    def _dibujar_placeholder_foto(self, c, x, y, ancho, alto):
        c.setFillColorRGB(0.96, 0.96, 0.96)
        c.rect(x, y, ancho, alto, fill=1)
        c.setFillColorRGB(0.6, 0.6, 0.6)
        c.setFont("Helvetica", 6)
        c.drawCentredString(x + ancho / 2, y + alto / 2 - 0.2 * cm, "FOTO")

    def _dibujar_fondo_emergencia(self, c):
        c.setFillColorRGB(1, 1, 1)
        c.rect(0, 0, self.CARNET_WIDTH, self.CARNET_HEIGHT, fill=1)
        c.setStrokeColorRGB(0, 0.2, 0.4)
        c.setLineWidth(0.5)
        c.rect(0.1 * cm, 0.1 * cm, self.CARNET_WIDTH - 0.2 * cm, self.CARNET_HEIGHT - 0.2 * cm, fill=0)
        c.setFont("Helvetica", 6)
        c.setFillColorRGB(0, 0, 0)
        c.drawCentredString(self.CARNET_WIDTH / 2, self.CARNET_HEIGHT / 2, "USANDO PLANTILLA OFICIAL")

    def _dibujar_qr(self, c, carnet_id, security_hash, personal, x, y, tamaño=1.5 * cm):
        qr_content = f"VALIDO|{carnet_id}|{security_hash}"

        qr = qrcode.QRCode(
            version=4,
            box_size=2,
            border=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
        )
        qr.add_data(qr_content)
        qr.make(fit=True)

        qr_image = qr.make_image(fill_color="black", back_color="white")
        qr_buffer = BytesIO()
        qr_image.save(qr_buffer, format="PNG")
        qr_buffer.seek(0)

        qr_reader = ImageReader(qr_buffer)
        c.drawImage(qr_reader, x, y, tamaño, tamaño)

        c.setFont("Helvetica", 2.5)
        c.setFillColorRGB(0.6, 0.6, 0.6)
        c.drawString(x, y - 0.15 * cm, f"ID: {carnet_id}")

    def _dibujar_foto(self, c, foto_buffer, x, y, ancho, alto):
        if foto_buffer:
            try:
                foto_buffer.seek(0)
                pil_image = Image.open(foto_buffer)
                target_ratio = ancho / alto
                img_width, img_height = pil_image.size
                img_ratio = img_width / img_height
                if img_ratio > target_ratio:
                    new_width = int(img_height * target_ratio)
                    offset = (img_width - new_width) // 2
                    pil_image = pil_image.crop((offset, 0, offset + new_width, img_height))
                elif img_ratio < target_ratio:
                    new_height = int(img_width / target_ratio)
                    offset = (img_height - new_height) // 2
                    pil_image = pil_image.crop((0, offset, img_width, offset + new_height))
                cropped_buffer = BytesIO()
                pil_image.save(cropped_buffer, format="PNG")
                cropped_buffer.seek(0)
                img = ImageReader(cropped_buffer)
                c.drawImage(img, x, y, ancho, alto,
                            preserveAspectRatio=True, anchor="c")
                return
            except Exception:
                pass
        self._dibujar_placeholder_foto(c, x, y, ancho, alto)

    def generar_carnet(self, personal, solicitud_numero, carnet_id, security_hash, foto_buffer=None):
        buffer = BytesIO()

        c = canvas.Canvas(buffer, pagesize=(self.CARNET_WIDTH, self.CARNET_HEIGHT))

        c.setAuthor("CONATEL - Sistema de Carnetización")
        c.setTitle(f"Carnet {personal.nombre_completo}")
        c.setSubject("Carnet Institucional")
        c.setKeywords("CONATEL, carnet, identificación")
        c.setPageSize((self.CARNET_WIDTH, self.CARNET_HEIGHT))

        template_path = self._get_template_path()
        if template_path:
            try:
                template_img = ImageReader(template_path)
                c.drawImage(template_img, 0, 0, self.CARNET_WIDTH, self.CARNET_HEIGHT,
                            preserveAspectRatio=True, anchor="c")
            except Exception:
                self._dibujar_fondo_emergencia(c)
        else:
            self._dibujar_fondo_emergencia(c)

        qr_tamaño = 1.2 * cm
        x_qr = 0.4 * cm
        y_qr = 1.1 * cm

        c.setFillColorRGB(1, 1, 1)
        c.rect(x_qr - 0.1 * cm, y_qr - 0.1 * cm,
               qr_tamaño + 0.2 * cm, qr_tamaño + 0.2 * cm, fill=1, stroke=0)
        self._dibujar_qr(c, carnet_id, security_hash, personal, x_qr, y_qr, tamaño=qr_tamaño)

        photo_width = 2.0 * cm
        photo_height = 2.4 * cm
        x_foto = (self.CARNET_WIDTH - photo_width) / 2
        y_foto = 4.6 * cm

        c.setStrokeColor(HexColor("#003366"))
        c.setLineWidth(0.8)
        c.rect(x_foto, y_foto, photo_width, photo_height, fill=0)

        self._dibujar_foto(c, foto_buffer, x_foto, y_foto, photo_width, photo_height)

        center_x = self.CARNET_WIDTH / 2
        max_text_width = self.CARNET_WIDTH - 0.80 * cm

        text_start_y = y_foto - 0.3 * cm
        line_spacing = 0.45 * cm

        self._colocar_texto_ajustado(c, personal.nombre_completo.upper(), center_x,
                                     text_start_y, bold=True, max_ancho=max_text_width, tamano_inicial=7)

        self._colocar_texto_ajustado(c, f"C.I: {personal.cedula}", center_x,
                                     text_start_y - 1 * line_spacing, bold=False,
                                     max_ancho=max_text_width, tamano_inicial=7)

        codigo_text = f"Código: {personal.codigo}" if getattr(personal, 'codigo', None) else ""
        if codigo_text:
            self._colocar_texto_ajustado(c, codigo_text, center_x,
                                         text_start_y - 2 * line_spacing, bold=False,
                                         max_ancho=max_text_width, tamano_inicial=6)

        self._colocar_texto_ajustado(c, personal.cargo_ref.nombre.upper(), center_x,
                                     text_start_y - 3 * line_spacing, bold=True,
                                     max_ancho=max_text_width, tamano_inicial=7)

        self._colocar_texto_ajustado(c, personal.departamento_ref.nombre.upper(), center_x,
                                     text_start_y - 4  * line_spacing, bold=True,
                                     max_ancho=max_text_width, tamano_inicial=7)

        c.save()
        pdf_buffer = buffer.getvalue()

        pdf_filename = f"carnet_{personal.cedula}_{solicitud_numero}.pdf"
        pdf_path = os.path.join(self.output_dir, pdf_filename)

        with open(pdf_path, "wb") as f:
            f.write(pdf_buffer)

        return pdf_path, pdf_buffer

    def generar_vista_previa(self, personal, foto_buffer=None, datos_editados=None):
       

        base_nombre = getattr(personal, "nombre_completo", "")
        base_cedula = getattr(personal, "cedula", "")
        base_codigo = getattr(personal, "codigo", "")

        cargo_nombre_base = ""
        if hasattr(personal, "cargo_ref") and getattr(personal.cargo_ref, "nombre", None):
            cargo_nombre_base = personal.cargo_ref.nombre
        elif hasattr(personal, "cargo") and getattr(personal.cargo, "nombre", None):
            cargo_nombre_base = personal.cargo.cargo

        depto_nombre_base = ""
        if hasattr(personal, "departamento_ref") and getattr(personal.departamento_ref, "nombre", None):
            depto_nombre_base = personal.departamento_ref.nombre
        elif hasattr(personal, "departamento") and getattr(personal.departamento, "nombre", None):
            depto_nombre_base = personal.departamento.nombre

        personal_virtual = SimpleNamespace()
        nombre_editado = datos_editados.get("nombre") if datos_editados else None
        personal_virtual.nombre_completo = nombre_editado if nombre_editado else base_nombre
        cedula_editada = datos_editados.get("cedula") if datos_editados else None
        personal_virtual.cedula = cedula_editada if cedula_editada else base_cedula
        personal_virtual.codigo = base_codigo

        personal_virtual.cargo_ref = SimpleNamespace()
        personal_virtual.cargo_ref.nombre = cargo_nombre_base

        personal_virtual.departamento_ref = SimpleNamespace()
        personal_virtual.departamento_ref.nombre = depto_nombre_base

        _, pdf_buffer = self.generar_carnet(personal_virtual, 0, 0, "preview", foto_buffer)

        try:
            kwargs = {"dpi": 150, "fmt": "png"}
            poppler_path = getattr(settings, "POPPLER_PATH", None)
            if poppler_path and os.path.exists(poppler_path):
                kwargs["poppler_path"] = poppler_path
            images = convert_from_bytes(pdf_buffer, **kwargs)
            if images:
                img_buffer = BytesIO()
                images[0].save(img_buffer, format="PNG")
                img_buffer.seek(0)
                return base64.b64encode(img_buffer.getvalue()).decode("utf-8")
        except Exception as e:
            print(f"Error convirtiendo PDF a imagen: {e}")
        return None

    def generar_vista_previa_html(self, personal, foto_buffer=None, datos_editados=None):
        imagen_base64 = self.generar_vista_previa(personal, foto_buffer, datos_editados)

        if not imagen_base64:
            return "<div class='alert alert-danger'>Error generando vista previa</div>"

        template = django_engine.from_string("""
        <div style="text-align: center; padding: 10px;">
            <img src="data:image/png;base64,{{ imagen_base64 }}"
                 style="width: 100%; max-width: 290px; border: 2px solid #003366; border-radius: 5px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);"
                 alt="Vista previa del carnet">
        </div>
        """)
        html = template.render({"imagen_base64": imagen_base64})
        return html


designer = CarnetDesigner()
