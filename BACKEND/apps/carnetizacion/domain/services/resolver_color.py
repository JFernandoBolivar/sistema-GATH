"""
Servicio de Dominio: Resolución de reglas de color para credenciales (O44 - E7).
Permite configurar el criterio de color: nómina, cargo, oficina, nivel, otro catálogo o único.
Garantiza un valor de respaldo institucional (#1f3a5f azul marino inicial para Funcionario).
"""
import unicodedata
from typing import Any

# Respaldo canónico: Funcionario azul marino institucional (#1f3a5f)
RESPALDO_DEFECTO: dict[str, str] = {
    'primario': '#1f3a5f',
    'acento': '#1273bd',
    'texto': '#ffffff',
}


def normalizar_clave(texto: str) -> str:
    """Normaliza una cadena para comparación agnóstica de acentos y caracteres."""
    if not texto:
        return ''
    cadena = unicodedata.normalize('NFKD', str(texto)).encode('ASCII', 'ignore').decode('utf-8')
    return cadena.strip().upper().replace(' ', '_').replace('-', '_')


def resolver_color_carnet(definicion: dict[str, Any], persona: dict[str, Any] | None = None) -> dict[str, str]:
    """
    Resuelve los colores dinámicos (primario, acento, texto) para una persona y plantilla.
    Si el criterio es 'unico' o no coincide con los valores tabulados, retorna el valor de respaldo.
    """
    persona = persona or {}
    reglas = definicion.get('reglas', {}) if isinstance(definicion, dict) else {}

    respaldo = reglas.get('respaldo')
    if not isinstance(respaldo, dict) or not respaldo.get('primario'):
        respaldo = {
            'primario': reglas.get('primario') or RESPALDO_DEFECTO['primario'],
            'acento': reglas.get('acento') or RESPALDO_DEFECTO['acento'],
            'texto': reglas.get('texto') or RESPALDO_DEFECTO['texto'],
        }

    criterio = str(reglas.get('criterio', 'unico')).lower().strip()
    if criterio in ('unico', 'ninguno', 'todos', ''):
        return {
            'primario': respaldo.get('primario', RESPALDO_DEFECTO['primario']),
            'acento': respaldo.get('acento', RESPALDO_DEFECTO['acento']),
            'texto': respaldo.get('texto', RESPALDO_DEFECTO['texto']),
        }

    # Credencial externa sin trabajador vinculado (visitante, contratista...): ni cargo ni
    # oficina ni nómina aplican, así que el código del tipo de credencial hace de valor.
    if persona.get('externo') and persona.get('tipo_credencial'):
        persona = {
            **persona,
            'nomina': str(persona['tipo_credencial']).upper(),
            'cargo': str(persona['tipo_credencial']).upper(),
            'oficina': str(persona['tipo_credencial']).upper(),
            'departamento': str(persona['tipo_credencial']).upper(),
        }

    # Extraer valor de la persona según el criterio
    valor_persona: str | None = None
    if criterio in ('nomina', 'tipo_personal', 'tipo_nomina'):
        valor_persona = persona.get('nomina') or persona.get('tipo_personal') or persona.get('tipo_trabajador')
    elif criterio in ('cargo', 'puesto'):
        valor_persona = persona.get('cargo')
    elif criterio in ('oficina', 'departamento', 'unidad'):
        valor_persona = persona.get('oficina') or persona.get('departamento')
    elif criterio == 'nivel':
        valor_persona = persona.get('nivel')
    elif criterio == 'otro':
        campo_extra = reglas.get('campo_criterio', 'otro')
        valor_persona = persona.get(campo_extra) or persona.get('otro')

    if not valor_persona:
        return {
            'primario': respaldo.get('primario', RESPALDO_DEFECTO['primario']),
            'acento': respaldo.get('acento', RESPALDO_DEFECTO['acento']),
            'texto': respaldo.get('texto', RESPALDO_DEFECTO['texto']),
        }

    valores = reglas.get('valores', {})
    if not isinstance(valores, dict):
        return {
            'primario': respaldo.get('primario', RESPALDO_DEFECTO['primario']),
            'acento': respaldo.get('acento', RESPALDO_DEFECTO['acento']),
            'texto': respaldo.get('texto', RESPALDO_DEFECTO['texto']),
        }

    # Búsqueda directa o normalizada
    clave_norm = normalizar_clave(valor_persona)
    mapa_normalizado = {normalizar_clave(k): v for k, v in valores.items() if isinstance(v, dict)}

    regla_encontrada = mapa_normalizado.get(clave_norm)
    if regla_encontrada:
        return {
            'primario': regla_encontrada.get('primario') or respaldo.get('primario', RESPALDO_DEFECTO['primario']),
            'acento': regla_encontrada.get('acento') or respaldo.get('acento', RESPALDO_DEFECTO['acento']),
            'texto': regla_encontrada.get('texto') or respaldo.get('texto', RESPALDO_DEFECTO['texto']),
        }

    return {
        'primario': respaldo.get('primario', RESPALDO_DEFECTO['primario']),
        'acento': respaldo.get('acento', RESPALDO_DEFECTO['acento']),
        'texto': respaldo.get('texto', RESPALDO_DEFECTO['texto']),
    }
