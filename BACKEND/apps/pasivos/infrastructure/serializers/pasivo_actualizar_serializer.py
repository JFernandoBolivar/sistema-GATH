"""Serializers de escritura de pasivos que reutilizan el contrato de Personal.

Los datos personales de un pasivo viven en `Employee` y sus tablas anidadas:
el cargo/asignación es lo único que lo distingue de un activo. Por eso el
`PATCH /pasivos/<cedula>/` acepta el mismo payload anidado que el alta/edición
de personal (`datos_vivienda`, `perfil_fisico`, `formacion_academica`,
`contacto_emergencia`, `antecedentes`), sin duplicar validaciones.
"""
from apps.personal.infrastructure.serializers.empleado_escritura_serializers import (
    EmpleadoActualizarSerializer,
)


class PasivoActualizarInputSerializer(EmpleadoActualizarSerializer):
    """Mismo contrato de actualización que Personal, con permiso `pasivos.editar`."""
