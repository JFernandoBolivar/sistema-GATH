"""Siembra, en las pruebas, las plantillas del Punto de Cuenta que en producción crea la migración de datos.

Las pruebas corren con `--nomigrations`, así que la migración 0007 de `puntocuenta` no se ejecuta sola; se
invoca su función de datos contra los modelos reales (sin configuración previa = textos por defecto).
"""
import importlib

from django.apps import apps

MIGRACION = 'apps.puntocuenta.migrations.0007_plantillas_punto_cuenta_datos'


def migracion_plantillas():
    return importlib.import_module(MIGRACION)


def sembrar_plantillas_punto_cuenta() -> None:
    migracion_plantillas().crear_plantillas(apps, None)
