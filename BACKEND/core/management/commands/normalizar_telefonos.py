"""
Normaliza a E.164 los teléfonos guardados de personas (D-13).

Uso:
    python manage.py normalizar_telefonos            # simula (dry-run), no cambia nada
    python manage.py normalizar_telefonos --aplicar  # convierte, en una transacción

Con `--aplicar`: los válidos pasan a E.164 (el móvil se acepta como «cualquiera» para no
perder datos legados), la basura («nan», texto vacío con espacios) pasa a NULL y los
inválidos se dejan intactos (solo se reportan). Es idempotente.
"""
from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import transaction

from core.domain.validacion_personas import validar_telefono

# (app_label.Modelo, columna)
COLUMNAS = (
    ('personal.EmployeeModel', 'telefono_movil'),
    ('personal.EmployeeModel', 'telefono_habitacion'),
    ('personal.ContactoEmergenciaModel', 'telefono'),
)
_BASURA = {'nan', 'none', 'null', 'nat', 'undefined'}
MAX_EJEMPLOS = 10


def clasificar(valor):
    """Devuelve (categoria, nuevo): ya_e164 | convertir | basura | invalido | vacio."""
    if valor is None:
        return 'vacio', None
    texto = str(valor).strip()
    if not texto:
        return 'basura', None
    if texto.lower() in _BASURA:
        return 'basura', None
    try:
        e164 = validar_telefono(texto)
    except ValueError:
        return 'invalido', None
    if e164 == valor:
        return 'ya_e164', e164
    return 'convertir', e164


class Command(BaseCommand):
    help = 'Normaliza los teléfonos de personas a E.164 (por defecto solo simula).'

    def add_arguments(self, parser):
        parser.add_argument('--aplicar', action='store_true', help='Escribe los cambios (por defecto solo simula).')

    def handle(self, *args, **opciones):
        aplicar = opciones['aplicar']
        self.stdout.write(self.style.WARNING('MODO APLICAR' if aplicar else 'SIMULACIÓN (dry-run): no se cambia nada'))
        with transaction.atomic():
            for etiqueta, columna in COLUMNAS:
                self._procesar(apps.get_model(etiqueta), columna, aplicar)

    def _procesar(self, modelo, columna, aplicar):
        conteo = {'ya_e164': 0, 'convertir': 0, 'basura': 0, 'invalido': 0, 'vacio': 0}
        ejemplos_invalidos: list[str] = []
        cambios: list[tuple[int, str | None]] = []
        filas = modelo.objects.exclude(**{f'{columna}__isnull': True}).values_list('pk', columna)
        for pk, valor in filas.iterator(chunk_size=2000):
            categoria, nuevo = clasificar(valor)
            conteo[categoria] += 1
            if categoria == 'invalido' and len(ejemplos_invalidos) < MAX_EJEMPLOS:
                ejemplos_invalidos.append(repr(valor))
            elif categoria in ('convertir', 'basura'):
                cambios.append((pk, nuevo))
        if aplicar:
            for pk, nuevo in cambios:
                modelo.objects.filter(pk=pk).update(**{columna: nuevo})
        self.stdout.write(
            f"{modelo.__name__}.{columna}: ya E.164={conteo['ya_e164']}, a convertir={conteo['convertir']}, "
            f"basura (a NULL)={conteo['basura']}, inválidos={conteo['invalido']}"
            + (f" (aplicado: {len(cambios)})" if aplicar else '')
        )
        if ejemplos_invalidos:
            self.stdout.write(f"    ejemplos inválidos: {', '.join(ejemplos_invalidos)}")
