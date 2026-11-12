# Pendientes de la auditoría final — ejecución (12/11/2026)

**Rama:** `feature/fe-de-vida-pasivos` · **Sin commit.**
**pytest no ejecutado** (lo corre el coordinador). Refactor sin cambios de
comportamiento visible ni de respuestas de la API.

---

## 1. `last_login` fuera de la vista

- **Puerto:** `apps/identidad/domain/ports/repo_cuentas.py` →
  `registrar_ultimo_acceso(id, momento)`.
- **Adaptador:** `apps/identidad/infrastructure/repositories/repo_cuentas_orm.py`
  → `UPDATE` puntual sobre `CuentaModel` (`last_login`).
- **Caso de uso:** `apps/identidad/application/use_cases/registrar_ultimo_acceso.py`.
- **Vista:** `apps/identidad/presentation/views/auth_views.py` ya no toca el ORM:
  llama al caso de uso dentro del mismo `try/except` (un fallo al registrar el
  acceso sigue sin impedir el login y se registra en el log).
- **Prueba:** `tests/unit/identidad/test_registrar_ultimo_acceso.py`.

## 2. Importar invitados: lector + caso de uso

- **Lector (infraestructura):**
  `apps/carnetizacion/infrastructure/lectores/lector_invitados.py`.
  Lee XLSX (openpyxl) y CSV, valida tamaño (`MAX_BYTES_DOCUMENTO`) y extensión,
  y conserva **exactamente** los mensajes y códigos anteriores
  («El archivo debe ser .xlsx o .csv.», «El archivo Excel está vacío», los dos
  mensajes de archivo ilegible y el límite en MB). Los fallos se registran con
  un logger de módulo.
- **Caso de uso:** `apps/carnetizacion/application/use_cases/importar_invitados.py`
  (orquesta `ImportarInvitadosUseCase` y devuelve el mismo `ResumenImportacionDTO`).
- **Vista:** `apps/carnetizacion/presentation/views/evento_views.py` solo
  valida la entrada (archivo vs. `filas`, `confirmar`) y responde; ya no importa
  `openpyxl`/`csv` ni parsea nada.
- **Prueba:** `tests/unit/carnetizacion/test_lector_invitados.py` (CSV, XLSX,
  Excel vacío, extensión, tamaño y archivo ilegible).

## 3. N+1

### 3.1 Panel de evento
`apps/carnetizacion/infrastructure/repositories/repo_eventos_orm.py`
(`obtener_resumen_panel`): el conteo por categoría y por zona pasa de un
`count()` por fila a **dos consultas agregadas**
(`values('categoria_id'/'zona_id').annotate(Count('pk'))`), cruzadas en memoria
con las categorías/zonas ya leídas.

Prueba: `tests/integration/carnetizacion/test_api_o45.py`
`test_resumen_panel_evento_agrega_por_grupo_y_no_por_fila`
(`django_assert_max_num_queries(8)` con 3 categorías y 2 zonas).

### 3.2 Export del censo
`apps/autogestion/infrastructure/services/excel_service.py`: respuestas,
asignación y vivienda se **precargan en bloque** (`filter(...__in=...)` +
diccionarios por empleado) y el bucle solo lee. Se conserva la asignación
vigente (`-fecha_actualizacion`, la misma que elegía `.first()`) y la vivienda
por PK.

Prueba: `tests/integration/autogestion/test_excel_censo_consultas.py`
`django_assert_max_num_queries(12)` con **10 empleados** (antes ~2 consultas por
empleado).

## 4. Constantes duplicadas

`DIAS_POR_DEFECTO` ya no es un `7` suelto: en
`apps/identidad/infrastructure/tasks/restablecer_acceso_bloque_tasks.py` y
`apps/identidad/presentation/views/corregir_cedula_views.py` se toma de la
definición única:

```python
DIAS_POR_DEFECTO = int(definicion_de(CLAVE_PASSWORD_INICIAL_DIAS).defecto)
```

`definicion_de` vive en `apps.configuracion.domain.parametros` (la fuente de
los Parámetros). `lint-imports` sigue en verde.

## 5. Logger de `restablecer_acceso_bloque_views.py`

No aplica en la versión actual: la vista es delgada y **no tiene ningún logger
inline** (ni `import logging`). Se revisó y no se añadió código muerto.

## 6. Tipos fuera de infraestructura (UI)

- `NextJS/src/modules/carnetizacion/domain/entities/credencial-externa.ts`
  (**nuevo**): `CredencialExterna`, `CrearCredencialExternaInput`,
  `GrupoCredencial`. La API mantiene alias (`CredencialExternaApiItem`,
  `CrearCredencialExternaApiInput`) para no romper actions/mappers.
  `credenciales-externas-view.tsx` y `lote-credenciales-view.tsx` importan del
  dominio.
- `NextJS/src/modules/pasivos/domain/entities/catalogo-pasivo.ts` (**nuevo**):
  `CatalogoPasivo`. `pasivos-api.ts` lo re-exporta como `CatalogoPasivoApiItem`
  y `cambiar-pasivo-page.tsx` importa del dominio.

## 7. Archivos de más de 400 líneas

Se dividieron por responsabilidad y **el módulo original re-exporta** lo movido,
así que ningún import existente cambia.

### 7.1 Repositorio de carnetización (1502 → módulos)

| Archivo | Líneas | Contenido |
|---|---|---|
| `repo_carnetizacion_orm.py` | 35 | Clase compuesta + `__init__` |
| `repo_carnetizacion_tipos.py` | 58 | Tipos de credencial |
| `repo_carnetizacion_tipos_plantillas.py` | 393 | Plantillas y fondos |
| `repo_carnetizacion_carnets.py` | 255 | Carnets emitidos, emisión y búsqueda |
| `repo_carnetizacion_pdf.py` | 324 | PDF, vista previa, estadísticas y foto |
| `repo_carnetizacion_biblioteca.py` | 125 | Biblioteca de medios |
| `repo_carnetizacion_campos.py` | 89 | Campos de credencial |
| `repo_carnetizacion_qr.py` | 326 | Ficha QR |
| `repo_carnetizacion_privacidad.py` | 167 | Privacidad, integración y anulación |
| `repo_carnetizacion_comun.py` | 80 | Helpers de vigencia y logger |

`RepoCarnetizacionORM` hereda todos los mixins. Se mantienen re-exportados
`vencimiento_segun_parametros` y `vencimiento_de_carnet` (los usan
`repo_credenciales_externas_orm` y `repo_eventos_orm`).

### 7.2 Aplicación de carga masiva (967 → módulos)

| Archivo | Líneas | Contenido |
|---|---|---|
| `aplicacion.py` | 249 | Entradas públicas y re-exportaciones |
| `aplicacion_comun.py` | 49 | Helpers (`_fecha`, `_id`, condición, etc.) |
| `aplicacion_personales.py` | 205 | Datos personales, familiar y salud |
| `aplicacion_laborales.py` | 199 | Cargo y cambio de condición |
| `aplicacion_otras.py` | 257 | Demás secciones |
| `aplicacion_reversion.py` | 115 | Reversión |

`aplicar_carga`, `confirmar_filas`, `revertir_carga` y `_notificar_aprobacion`
siguen importándose desde `aplicacion.py` (igual que en las pruebas).

### 7.3 Vistas de reglas de catálogos (816 → módulos)

| Archivo | Líneas | Contenido |
|---|---|---|
| `reglas_catalogos_views.py` | 226 | Listado, parentesco y re-exportaciones |
| `reglas_catalogos_comun.py` | 210 | Imports, constantes, permisos y helpers |
| `reglas_catalogos_pais_views.py` | 138 | País |
| `reglas_catalogos_motivo_views.py` | 173 | Motivos |
| `reglas_catalogos_nomina_views.py` | 126 | Nómina |
| `reglas_catalogos_soporte_views.py` | 221 | Tipos de soporte y checklist |

`presentation/urls.py` sigue importando todas las clases desde
`reglas_catalogos_views`.

## 8. `SUPERADMIN_CEDULA` en los comandos

- `apps/identidad/management/commands/preparar_produccion.py:45` →
  `CEDULA_SUPERADMIN = settings.SUPERADMIN_CEDULA`.
- `core/management/commands/verificar_esquema.py:27` →
  `SUPERADMIN = settings.SUPERADMIN_CEDULA`.

`settings.py` no se tocó (ya trae el valor por defecto).

---

## Archivos tocados

**Backend**
- `apps/identidad/{domain/ports/repo_cuentas.py, application/use_cases/registrar_ultimo_acceso.py, infrastructure/repositories/repo_cuentas_orm.py, presentation/views/auth_views.py}`
- `apps/identidad/{infrastructure/tasks/restablecer_acceso_bloque_tasks.py, presentation/views/corregir_cedula_views.py, management/commands/preparar_produccion.py}`
- `core/management/commands/verificar_esquema.py`
- `apps/carnetizacion/infrastructure/lectores/{__init__.py, lector_invitados.py}`
- `apps/carnetizacion/application/use_cases/importar_invitados.py`
- `apps/carnetizacion/presentation/views/evento_views.py`
- `apps/carnetizacion/infrastructure/repositories/repo_eventos_orm.py`
- `apps/carnetizacion/infrastructure/repositories/repo_carnetizacion_*.py` (10 archivos)
- `apps/carga_masiva/infrastructure/aplicacion*.py` (6 archivos)
- `apps/configuracion/presentation/views/reglas_catalogos*.py` (6 archivos)
- `apps/autogestion/infrastructure/services/excel_service.py`
- Pruebas: `tests/unit/identidad/test_registrar_ultimo_acceso.py`,
  `tests/unit/carnetizacion/test_lector_invitados.py`,
  `tests/integration/autogestion/test_excel_censo_consultas.py`,
  `tests/integration/carnetizacion/test_api_o45.py`.

**Frontend**
- `src/modules/carnetizacion/domain/entities/credencial-externa.ts` (**nuevo**)
- `src/modules/carnetizacion/infrastructure/http/credenciales-externas-api.ts`
- `src/modules/carnetizacion/ui/views/credenciales-externas-view.tsx`
- `src/modules/carnetizacion/ui/views/lote-credenciales-view.tsx`
- `src/modules/pasivos/domain/entities/catalogo-pasivo.ts` (**nuevo**)
- `src/modules/pasivos/infrastructure/http/pasivos-api.ts`
- `src/modules/movimientos/ui/cambiar-pasivo-page.tsx`

---

## Verificaciones

| Comprobación | Resultado |
|---|---|
| `lint-imports` | **103 contratos, 0 rotos** |
| `npx tsc --noEmit` | sin errores |
| `npx eslint src --quiet` | sin errores |
| `npx vitest run src/modules/carnetizacion src/modules/pasivos src/modules/movimientos` | **41 archivos, 209 pruebas passed** |
| `python manage.py check` | **0 issues** |
| `python -m compileall apps core tests` | OK |
| `ruff F401/F841/F821/F811` sobre los archivos tocados | All checks passed |
| pytest | **no ejecutado** (lo corre el coordinador) |

## Notas

- El refactor no cambia mensajes, códigos HTTP ni datos de salida; los lectores
  y mixins conservan el contrato anterior.
- Los archivos originales re-exportan lo movido, por lo que imports externos y
  pruebas existentes no cambian.
- `reglas_catalogos_comun.py` expone `__all__` para que el `import *` de los
  submódulos incluya también los helpers con guion bajo.
