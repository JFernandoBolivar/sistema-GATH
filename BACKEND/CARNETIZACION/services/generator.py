import os
from datetime import datetime
from django.conf import settings

from .designer import CarnetDesigner


class CarnetGenerator:

    def __init__(self):
        self.designer = CarnetDesigner()

    def generar_carnet_individual(self, personal, carnet_id, security_hash, motivo="Nueva emisión", foto_buffer=None):
        try:
            solicitud_numero = getattr(personal, "total_solicitudes", 1)
            pdf_path, _ = self.designer.generar_carnet(
                personal=personal,
                solicitud_numero=solicitud_numero,
                carnet_id=carnet_id,
                security_hash=security_hash,
                foto_buffer=foto_buffer,
            )
            return {
                "exito": True,
                "cedula": personal.cedula,
                "nombre": personal.nombre_completo,
                "pdf_path": pdf_path,
                "solicitud_numero": solicitud_numero,
            }
        except Exception as e:
            return {
                "exito": False,
                "cedula": personal.cedula,
                "nombre": personal.nombre_completo,
                "error": str(e),
            }

    def obtener_estadisticas(self):
        carnets_dir = os.path.join(settings.MEDIA_ROOT, 'carnet_pdfs')
        if not os.path.exists(carnets_dir):
            return {"total": 0, "ultimos": [], "tamano_total": "0 MB"}

        carnets = []
        total_size = 0

        for filename in os.listdir(carnets_dir):
            if filename.endswith(".pdf"):
                filepath = os.path.join(carnets_dir, filename)
                stats = os.stat(filepath)
                total_size += stats.st_size
                carnets.append({
                    "nombre": filename,
                    "fecha": datetime.fromtimestamp(stats.st_ctime).strftime("%d/%m/%Y %H:%M"),
                    "tamano": f"{stats.st_size / 1024:.1f} KB",
                })

        carnets.sort(key=lambda x: x["fecha"], reverse=True)

        return {
            "total": len(carnets),
            "tamano_total": f"{total_size / (1024*1024):.2f} MB",
            "ultimos": carnets[:10],
        }


generator = CarnetGenerator()
