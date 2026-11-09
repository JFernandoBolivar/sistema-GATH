"""
Servicio de Dominio `evaluador_permisos` (Algoritmo AWS IAM).

Reglas de Evaluación:
1. Denegación Explícita (Explicit Deny): Si el código solicitado coincide con
   algún patrón en `deny` ('*', 'modulo.*' o 'modulo.accion'), el resultado es FALSO.
2. Concesión Explícita (Explicit Allow): Si el código coincide con algún patrón
   en `allow`, el resultado es VERDADERO.
3. Denegación Implícita (Implicit Deny / Fail-Closed S2): Si no hay coincidencia,
   el resultado es FALSO.
"""
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso


def patrones_candidatos(codigo_requerido: str) -> frozenset[str]:
    """
    Calcula los 3 patrones posibles que pueden autorizar o denegar una acción:
    Para 'personal.crear' -> {'*', 'personal.*', 'personal.crear'}
    """
    normalizado = codigo_requerido.strip().lower()
    candidatos = {"*", normalizado}
    if "." in normalizado:
        modulo = normalizado.split(".", 1)[0]
        candidatos.add(f"{modulo}.*")
    return frozenset(candidatos)


def evaluar_permiso(politica: PoliticaAcceso, codigo_requerido: str) -> bool:
    """
    Evalúa si una política de acceso autoriza la ejecución de un código de permiso.
    Operación pura en memoria O(1).
    """
    if not codigo_requerido or not codigo_requerido.strip():
        return False

    candidatos = patrones_candidatos(codigo_requerido)

    # 1. Regla AWS: Deny explícito siempre tiene prioridad absoluta
    if not politica.deny.isdisjoint(candidatos):
        return False

    # 2. Concesión explícita
    if not politica.allow.isdisjoint(candidatos):
        return True

    # 3. Denegación implícita por defecto
    return False
