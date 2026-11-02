"""
Carga masiva de empleados vía Excel (gap #4 de la migración funcional de
personal/activo).

Réplica funcional de `RAC/views/personal_activo_views.py::ImportEmployeesView`
(caso simple: solo datos básicos de `Employee`). Vive en `infrastructure/`
(no en `presentation/`) porque es I/O concreto (lectura de archivo, ORM
directo por volumen — B7 exceptúa las operaciones de carga masiva de la
regla "la vista no toca el ORM": aquí es el importador, no la vista, quien
lo hace).

Se mantiene **síncrono** (igual que el legado), no `202 Accepted` + Celery
(**C-4**, `uso-librerias-backend/SKILL.md`) — decisión documentada: activar
el patrón de tarea asíncrona exige el puerto `TaskQueue` + endpoint
`GET /api/v1/tareas/{id}/`, infraestructura que no existe todavía en el
proyecto y que se considera fuera de alcance de esta migración funcional
puntual (riesgo de regresión de contrato HTTP si se introduce a medias).
"""
from datetime import datetime

import pandas as pd

from apps.catalogos.infrastructure.models.catalogo_models import EstadoCivilModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel

# Mapeo de sexo -> id, idéntico al legado (IDs de seed asumidos: 1=Femenino, 2=Masculino).
_MAPEO_SEXO = {
    'femenino': 1, 'Femenino': 1, 'FEMENINO': 1,
    'masculino': 2, 'Masculino': 2, 'MASCULINO': 2,
    'F': 1, 'f': 1, 'm': 2, 'M': 2,
}


def _parsear_fecha(valor):
    if pd.isna(valor):
        return None
    if isinstance(valor, (pd.Timestamp, datetime)):
        try:
            return pd.to_datetime(valor).date()
        except Exception:
            return None
    texto = str(valor).strip()
    for caracter in ['“', '”', '‘', '’', '"', "'"]:
        texto = texto.replace(caracter, '')
    texto = texto.strip()
    ts = pd.to_datetime(texto, dayfirst=True, errors='coerce')
    return None if pd.isna(ts) else ts.date()


def importar_empleados_basico(archivo) -> dict:
    """
    Lee un Excel con columnas `CEDULA DE IDENTIDAD`, `NOMBRES`, `APELLIDOS`,
    `sexo`, `fecha_nacimiento` y crea filas `EmployeeModel` con
    `bulk_create(ignore_conflicts=True)` (igual que el legado: no falla si
    la cédula ya existe, simplemente la ignora).
    """
    df = pd.read_excel(archivo)

    estado_civil_default = (
        EstadoCivilModel.objects.filter(estadoCivil__iexact='SOLTERO').first()
        or EstadoCivilModel.objects.filter(pk=1).first()
        or EstadoCivilModel.objects.first()
    )

    empleados_a_crear = []
    errores = []

    for indice, fila in df.iterrows():
        try:
            sexo_raw = fila.get('sexo', '')
            sexo_id = _MAPEO_SEXO.get(sexo_raw)
            if not sexo_id:
                errores.append(f"Fila {indice}: Sexo '{sexo_raw}' no válido.")
                continue

            fecha_nac = _parsear_fecha(fila.get('fecha_nacimiento'))
            if fila.get('fecha_nacimiento') and fecha_nac is None:
                errores.append(f"Fila {indice}: fecha_nacimiento '{fila.get('fecha_nacimiento')}' no válido.")

            empleados_a_crear.append(EmployeeModel(
                cedulaidentidad=fila.get('CEDULA DE IDENTIDAD'),
                nombres=fila.get('NOMBRES'),
                apellidos=fila.get('APELLIDOS'),
                fecha_nacimiento=fecha_nac,
                sexoid_id=sexo_id,
                estadoCivil_id=estado_civil_default.pk if estado_civil_default else None,
            ))
        except Exception as exc:  # noqa: BLE001 — réplica del try/except por fila del legado
            errores.append(f"Fila {indice}: {exc}")

    if empleados_a_crear:
        EmployeeModel.objects.bulk_create(empleados_a_crear, ignore_conflicts=True)

    return {'procesados': len(empleados_a_crear), 'errores': errores}
