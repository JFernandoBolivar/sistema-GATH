from ..models.personal_models import AsigTrabajo

STOP_WORDS = {'DE', 'LA', 'EL', 'Y', 'LOS', 'LAS', 'EN', 'PARA'}


def generar_prefijo_nomina(tipo_nomina):
    nombre = tipo_nomina.nomina.upper()
    palabras = [w for w in nombre.split() if w not in STOP_WORDS]
    if not palabras:
        raise ValueError("No se pudo generar un prefijo desde el nombre de la nómina.")
    return "".join([w[0] for w in palabras]) + "_"


def generador_codigos(prefix):
    prefijo = len(prefix)

    ultima_asignacion = AsigTrabajo.objects.filter(
        codigo__startswith=prefix
    ).order_by('-codigo').first()

    if not ultima_asignacion:
        siguiente_numero = 1
    else:
        ultimo_codigo = ultima_asignacion.codigo
        try:
            ultimo_numero_base = int(ultimo_codigo[prefijo:])
            siguiente_numero = ultimo_numero_base + 1
        except (ValueError, IndexError):
            siguiente_numero = 1

    numero_formateado = str(siguiente_numero).zfill(4)

    return f"{prefix}{numero_formateado}"


# ---------------------------------------------------------------------------
# Autogeneración de código de AsigTrabajo (8 dígitos)
# Formato: [6 dígitos ubicación][2 dígitos tipo de cargo / correlativo]
# ---------------------------------------------------------------------------

# Reglas de sufijo según palabras clave en el nombre del cargo (UPPERCASE).
# El orden importa: se evalúa de arriba hacia abajo, primera coincidencia gana.
# Cargos no clasificados reciben sufijo base 04 (y se incrementa si hay colisión).
_CARGO_KEYWORDS = [
    # (sufijo_base, frozenset de palabras clave — TODAS deben estar presentes)
    (1,  frozenset(['DIRECTOR', 'GENERAL'])),   # DIRECTOR GENERAL
    (1,  frozenset(['DIRECTOR'])),               # cualquier DIRECTOR (sin "LINEA")
    (1,  frozenset(['AUDITOR'])),
    (1,  frozenset(['JEFE'])),                   # JEFE (genérico, incluyendo jefes no de división)
    (2,  frozenset(['JEFE', 'DIVISION'])),       # JEFE DE DIVISIÓN — más específico, se evalúa después
    (3,  frozenset(['COORDINADOR'])),
]

# Regla más específica primero: reordenar de mayor a menor especificidad
# (cuantas más palabras clave, más específica la regla)
_CARGO_KEYWORDS_SORTED = sorted(_CARGO_KEYWORDS, key=lambda r: len(r[1]), reverse=True)


def _sufijo_base_por_cargo(nombre_cargo: str) -> int:
    """
    Determina el sufijo base (entero) para los 2 últimos dígitos del código
    a partir del nombre del cargo, usando palabras clave.

    Orden de precedencia (más específico primero):
      - Contiene JEFE + DIVISION  → 02
      - Contiene DIRECTOR GENERAL → 01
      - Contiene DIRECTOR         → 01
      - Contiene AUDITOR          → 01
      - Contiene JEFE             → 01
      - Contiene COORDINADOR      → 03
      - Cualquier otro            → 04
    """
    nombre_upper = nombre_cargo.upper()
    palabras_cargo = set(nombre_upper.split())

    for sufijo, keywords in _CARGO_KEYWORDS_SORTED:
        if keywords.issubset(palabras_cargo):
            return sufijo

    return 4  # demás cargos


def _resolver_prefijo_ubicacion(direccion_general, direccion_linea, coordinacion, dependencia):
    """
    Retorna el código de 6 dígitos de la unidad organizacional más específica
    disponible, siguiendo la jerarquía:
        Coordinacion > DireccionLinea > DireccionGeneral > Dependencia
    """
    if coordinacion and getattr(coordinacion, 'Codigo', None):
        return coordinacion.Codigo[:6].zfill(6)
    if direccion_linea and getattr(direccion_linea, 'Codigo', None):
        return direccion_linea.Codigo[:6].zfill(6)
    if direccion_general and getattr(direccion_general, 'Codigo', None):
        return direccion_general.Codigo[:6].zfill(6)
    if dependencia and getattr(dependencia, 'Codigo', None):
        return dependencia.Codigo[:6].zfill(6)
    raise ValueError(
        "No se puede determinar la ubicación del trabajador para generar el código. "
        "Asegúrese de asignar al menos una Dirección General."
    )


def generar_codigo_asig_trabajo(
    direccion_general,
    direccion_linea,
    coordinacion,
    dependencia,
    denominacion_cargo,
):
    """
    Genera un código de 8 dígitos para un registro de AsigTrabajo:

    - Posiciones 1-6: código de la unidad organizacional más específica
      (Coordinacion > DireccionLinea > DireccionGeneral > Dependencia)
    - Posiciones 7-8: tipo de cargo determinado por palabras clave en el nombre
      del cargo, con correlativo si el sufijo ya está ocupado en esa ubicación.

    Tabla de sufijos:
        01 → DIRECTOR GENERAL / DIRECTOR / JEFE / AUDITOR
        02 → JEFE DE DIVISIÓN
        03 → COORDINADOR
        04+ → Demás cargos (correlativo desde 04)

    Ejemplos:
        Coordinacion 040102, Coordinador  → 04010203
        Coordinacion 040102, Analista
          (si 04010204 ya existe)         → 04010205
    """
    # 1. Prefijo de 6 dígitos (ubicación)
    prefijo_6 = _resolver_prefijo_ubicacion(
        direccion_general, direccion_linea, coordinacion, dependencia
    )

    # 2. Sufijo base determinado por el nombre del cargo
    nombre_cargo = getattr(denominacion_cargo, 'cargo', '') or ''
    sufijo_base = _sufijo_base_por_cargo(nombre_cargo)

    # 3. Sufijos ya ocupados en esa ubicación
    codigos_existentes = (
        AsigTrabajo.objects
        .filter(codigo__startswith=prefijo_6)
        .values_list('codigo', flat=True)
    )

    sufijos_usados = set()
    for cod in codigos_existentes:
        if len(cod) >= 8:
            try:
                sufijos_usados.add(int(cod[6:8]))
            except ValueError:
                pass

    # 4. Primer sufijo libre a partir del sufijo_base
    sufijo = sufijo_base
    while sufijo in sufijos_usados:
        sufijo += 1

    if sufijo > 99:
        raise ValueError(
            f"No quedan sufijos disponibles en la ubicación {prefijo_6} "
            f"para el cargo '{nombre_cargo}'."
        )

    return f"{prefijo_6}{str(sufijo).zfill(2)}"