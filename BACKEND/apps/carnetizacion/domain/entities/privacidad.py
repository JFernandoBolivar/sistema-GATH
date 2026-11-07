"""
Entidades y Reglas de Dominio para la Privacidad de la Ficha QR (O44 - E9).
Control de visibilidad por dato en Autogestión:
- Público (sin iniciar sesión)
- Con sesión (usuario interno con login en GATH)
- Solo Personal (administradores y analistas de RRHH con bitácora)

Regla crítica: La dirección de vivienda NUNCA puede ser pública.
"""
from dataclasses import dataclass
from typing import Any
from core.domain.exceptions import ValidationError

NIVELES_PRIVACIDAD_PERMITIDOS = {'PUBLICO', 'CON_SESION', 'SOLO_PERSONAL'}


@dataclass(frozen=True)
class FichaQr:
    """Entidad de dominio que representa la información resuelta del QR de un carnet."""
    es_valido: bool
    estado: str  # 'VIGENTE', 'ANULADO', 'VENCIDO', 'NO_REGISTRADO'
    mensaje: str
    security_hash: str | None = None
    nivel_acceso: str = 'PUBLICO'  # 'PUBLICO', 'CON_SESION', 'ADMINISTRADOR'
    datos: dict[str, Any] | None = None
    salud_disponible: bool = False
    fecha_emision: str | None = None
    fecha_vencimiento: str | None = None

PRIVACIDAD_POR_DEFECTO: dict[str, str] = {
    'foto': 'PUBLICO',
    'nombre': 'PUBLICO',
    'cargo': 'PUBLICO',
    'ubicacion': 'PUBLICO',
    'contactos_emergencia': 'PUBLICO',
    'salud': 'PUBLICO',          # Disponible tras confirmación de emergencia y con bitácora
    'cedula': 'CON_SESION',      # Requiere usuario con sesión iniciada
    'fecha_nacimiento': 'CON_SESION',
    'direccion_vivienda': 'SOLO_PERSONAL',  # NUNCA pública
}


def validar_preferencias_privacidad(preferencias: dict[str, Any]) -> dict[str, str]:
    """
    Valida y normaliza las preferencias de privacidad del titular.
    Invariante: la dirección de vivienda jamás puede configurarse como pública.
    """
    resultado = dict(PRIVACIDAD_POR_DEFECTO)
    for clave, valor in preferencias.items():
        if clave not in PRIVACIDAD_POR_DEFECTO:
            continue
        val_upper = str(valor).upper().strip()
        if val_upper not in NIVELES_PRIVACIDAD_PERMITIDOS:
            raise ValidationError(
                f"Nivel de privacidad inválido '{valor}' para el dato '{clave}'. "
                f"Permitidos: {sorted(NIVELES_PRIVACIDAD_PERMITIDOS)}"
            )
        # Regla inviolable: la dirección de vivienda nunca es pública
        if clave == 'direccion_vivienda' and val_upper == 'PUBLICO':
            raise ValidationError(
                "La dirección de vivienda es información personal reservada y no puede ser configurada como pública."
            )
        resultado[clave] = val_upper

    return resultado
