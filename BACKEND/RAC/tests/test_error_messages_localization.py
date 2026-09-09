"""
QA/diseño reportó (feedback en /dashboard/gestion-trabajadores/personal-trabajador/consultar):
los toasts de error que ve el analista muestran el texto crudo en ingles de
Django REST Framework (ej. "This field may not be null.") en vez de un
mensaje claro en español.

Causa raiz (aun sin corregir, ver `SendFeedback`/informe de analisis):

1. `LANGUAGE_CODE` no esta definido en `SIGEP/settings.py`, por lo que Django
   usa el valor por defecto `"en-us"`. Los mensajes por defecto de los
   `Field` de DRF (`This field may not be null.`, `This field is required.`,
   etc.) se generan en el idioma de `LANGUAGE_CODE`, así que salen en ingles.
2. `extract_first_error()` (`RAC/utils/data_formatters.py:5-10`) toma el
   primer `ErrorDetail` de `serializer.errors` tal cual, sin traducirlo ni
   anteponer el nombre del campo, y ese valor se devuelve en la clave
   `message` de la respuesta (ver por ejemplo
   `RAC/views/personal_activo_views.py:815-819` y `:843-849`).
3. El frontend simplemente hace `toast.error(response.message)` con ese
   valor (ej. `NextJS/src/app/(protected)/dashboard/gestion-trabajadores/
   components/employees/employee-edit-modal.tsx:127`), sin ninguna capa de
   traduccion/mapeo intermedia.

Estos tests documentan el defecto tal como esta HOY (deben fallar antes de
corregir la causa raiz, y pasar una vez que `extract_first_error`/las vistas
devuelvan un mensaje en español y `LANGUAGE_CODE` este correctamente
configurado). No se modifico codigo de produccion junto con este archivo.
"""

from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import ErrorDetail

from RAC.utils.data_formatters import extract_first_error


class ExtractFirstErrorLocalizationTests(SimpleTestCase):
    """Caja blanca sobre RAC/utils/data_formatters.py:5-10."""

    def test_mensaje_de_campo_requerido_no_deberia_ser_el_texto_crudo_de_drf(self):
        errores = {
            "fecha_nacimiento": [
                ErrorDetail(string="This field may not be null.", code="null"),
            ],
        }

        mensaje = extract_first_error(errores)

        self.assertNotIn(
            "This field",
            mensaje,
            "extract_first_error() esta devolviendo el mensaje crudo en "
            "ingles de DRF ('This field may not be null.') sin traducir ni "
            "indicar a que campo pertenece; asi es como llega al toast que "
            "ve el analista en /consultar.",
        )

    def test_mensaje_de_campo_requerido_deberia_mencionar_el_campo(self):
        errores = {
            "fecha_nacimiento": [
                ErrorDetail(string="This field may not be null.", code="null"),
            ],
        }

        mensaje = extract_first_error(errores)

        self.assertIn(
            "fecha_nacimiento",
            mensaje.lower(),
            "El mensaje mostrado al usuario no identifica el campo que "
            "falló ('fecha_nacimiento'); extract_first_error() descarta la "
            "clave del diccionario de errores y solo devuelve el texto del "
            "primer ErrorDetail.",
        )


class LanguageCodeLocalizationTests(TestCase):
    """LANGUAGE_CODE gobierna el idioma de los mensajes por defecto de DRF."""

    def test_language_code_deberia_estar_configurado_en_espanol(self):
        from django.conf import settings

        idioma = getattr(settings, "LANGUAGE_CODE", "en-us")

        self.assertTrue(
            idioma.lower().startswith("es"),
            f"SIGEP/settings.py no define LANGUAGE_CODE en español "
            f"(valor actual: {idioma!r}); por eso los mensajes de "
            f"validacion por defecto de DRF (serializers.Field) se generan "
            f"en ingles y llegan asi hasta los toasts del frontend.",
        )
