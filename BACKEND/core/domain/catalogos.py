"""
Etiquetas de catálogo compartidas por todos los módulos (kernel).

Los valores son los textos oficiales de las tablas `Estatus`, `TipoPersonal` y
de la condición laboral de `AsigTrabajo`. Viven en el kernel porque varias
capas `domain` de módulos distintos necesitan compararlos y la regla B16 solo
permite el acoplamiento entre módulos desde `infrastructure`; un módulo de
catálogo dentro de `apps.catalogos` obligaría a un import cruzado en `domain`.

Puro: sin Django ni DRF (regla B1).
"""

# --- `Estatus.estatus`: estado de una asignación de trabajo / código de cargo.
ESTATUS_ACTIVO = 'ACTIVO'
ESTATUS_PASIVO = 'PASIVO'
ESTATUS_EGRESADO = 'EGRESADO'
ESTATUS_VACANTE = 'VACANTE'
ESTATUS_SUSPENDIDO = 'SUSPENDIDO'
ESTATUS_BLOQUEADO = 'BLOQUEADO'

# --- `TipoPersonal.tipo_personal`: nómina activa o pasiva.
TIPO_PERSONAL_ACTIVO = 'ACTIVO'
TIPO_PERSONAL_PASIVO = 'PASIVO'

# --- Condición laboral derivada (activo / pasivo).
CONDICION_ACTIVO = 'ACTIVO'
CONDICION_PASIVO = 'PASIVO'

# --- Población objetivo de una carga masiva o solicitud de carnet.
POBLACION_ACTIVO = 'ACTIVO'
POBLACION_PASIVO = 'PASIVO'
