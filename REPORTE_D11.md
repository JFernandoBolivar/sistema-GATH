# Reporte D11 — Seguimiento de la revisión de D9/D10

Fecha: 2026-10-31. Rama `feature/fe-de-vida-pasivos`. Sin commit ni push.

Alcance: fila **D11** de `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md` (revisión de D9/D10). Todos los puntos tienen su test.

---

## M1 — Secretos dentro de listas en las diferencias (MEDIO)

**Antes:** `_aplanar` solo descendía por diccionarios; `diferencias({'a':[{'password':'x1'}]}, …)` devolvía el valor en claro.

**Corrección:** `_aplanar` ahora desciende también por listas/tuplas con el índice en la ruta (`a.0.password`). La comparación sigue siendo sobre valores reales, pero `_sensible_por_ruta` reconoce cualquier segmento sensible y devuelve `***` en ambos lados. El diálogo muestra rutas legibles (`items.0.meta.refreshToken`) sin JSON crudo.

**Tests** (`tests/unit/auditoria/test_saneamiento.py`):
- Lista de diccionarios (`a.0.password`).
- Listas anidadas y diccionarios dentro de listas dentro de diccionarios (`items.1.1.apiKey`).
- Variantes de nombres sensibles (incluye `apiKey`, `refreshToken`, `claveTemporal`).

---

## B1 — Mensaje de «Restablecer acceso»

`cuenta_views.py` usa los días reales del parámetro `plazos.password_inicial_dias` (leído por el puerto) y responde `… vence en N días.` (singular/plural). El docstring dejó de fijar «7 días».

**Test:** `test_restablecer_acceso_usa_los_dias_configurados_en_el_parametro` ahora comprueba también `"vence en 3 días"` en el mensaje, con el parámetro en 3.

---

## B2 — Normalización y `clave`

`core/domain/auditoria.py`:
- Convierte **camelCase → snake_case** antes de comparar (`apiKey` → `api_key`, `refreshToken` → `refresh_token`, `claveTemporal` → `clave_temporal`, `APIKey` → `api_key`).
- Añade a la lista nombrada `clave`, `clave_acceso`, `clave_temporal`, `clave_secreta` y `clave_privada`.
- No enmascara `clave_postal` (no es un secreto), verificado en test.

**Tests:** cada variante en `test_los_nombres_de_campo_sensibles_se_reconocen_por_variantes`.

---

## B3 — El GET de parámetros ya no escribe

- Migración de datos idempotente `configuracion/0003_sembrar_parametros_sistema.py`: crea las 6 filas con sus valores por defecto (`get_or_create`; respeta un valor ya cambiado). Reversible: elimina solo esas claves.
- `RepoParametrosORM.listar` es **solo lectura**: mapea las filas existentes y, si falta una, devuelve el valor por defecto de la definición **sin escribir**. Se retiró la sincronización de metadatos en el GET.

**Tests** (`tests/integration/configuracion/test_parametros_api.py`):
- `test_el_get_no_crea_filas_y_usa_el_defecto_si_falta_una`: borra una fila, dos GET y el conteo no cambia; el parámetro ausente se sirve con su defecto.
- `test_dos_lecturas_concurrentes_no_fallan`: dos hilos con conexiones propias leen el listado (6 parámetros) sin errores.

---

## B4 — Guardado y auditoría en una transacción

`ParametroView.put` envuelve `actualizar_parametro` + `registrar_auditoria` en `transaction.atomic()`.

**Test:** `test_si_la_auditoria_falla_el_parametro_no_queda_cambiado` parchea `registrar_auditoria` para lanzar: la API responde 500 y el valor del parámetro sigue siendo el anterior.

---

## B5 — Respaldo de días sugeridos en fe de vida

- `src/modules/fe-de-vida/domain/services/reglas.ts`: nueva constante nombrada `DIAS_RECORDATORIO_RESPALDO = [30, 15, 7, 3, 1]`.
- `selector-dias-recordatorio.tsx`: SWR usa `fallbackData` con ese respaldo y `shouldRetryOnError: false`; mientras carga o si la llamada falla, se muestran los 5 chips.

**Tests:**
- Vitest: `muestra los 5 chips de respaldo aunque la llamada al servidor falle` (acción mockeada que rechaza).
- E2E en vivo (`e2e/d11-seguimiento.spec.ts`): se aborta el POST de la Server Action y el diálogo «Nuevo proceso» muestra los 5 chips.

Única modificación permitida en `src/modules/fe-de-vida`: ese selector, su archivo de reglas y sus tests.

---

## B7 — `RecordatoriosFeDeVidaView` sin ORM en presentation

La vista ahora lee `CLAVE_FE_DE_VIDA_RECORDATORIOS` por el puerto `LectorConfiguracion` (`obtener_lector_configuracion`), sin `ParametroSistemaModel.objects` ni import del modelo. Si no hubiera proveedor, usa el defecto de la definición.

**Test:** `test_recordatorios_usa_el_puerto_y_no_el_orm` inyecta un lector falso que devuelve `9,2` y verifica la respuesta.

---

## B6 — Tope de prórrogas

Confirmado por el usuario: el tope queda en **5 por defecto** (0 = sin límite). No se cambió código; queda documentado en el plan y en este reporte.

---

## Suites

| Verificación | Resultado |
|---|---|
| Backend focalizado (auditoría, configuración, ciclo de vida) | **45 passed** |
| Backend completo | **1073 passed** (base 1067; +6) |
| Vitest | **96 archivos / 570 pruebas** (base 569; +1) |
| `tsc --noEmit` | sin errores |
| `eslint .` | **0 errores** (81 avisos preexistentes) |
| `next build` | compila y genera todas las rutas |
| `lint-imports` | **82 kept, 0 broken** |
| `makemigrations --check` | **No changes detected** |

### E2E en vivo
- **M1:** se insertó un registro de auditoría de prueba con `items=[{'password':'x1'}]` → `x2` y `meta.clave`; el diálogo mostró `items.0.password`, `meta.clave` y `***`, sin `x1`/`x2`. El registro se eliminó después.
- **B5:** con el POST de la Server Action abortado, el formulario de procesos mostró los chips 30, 15, 7, 3 y 1.
- **D9/D10 (regresión):** 4/4 (renombre, editar parámetro y efecto sin reiniciar, bitácora con filtros/detalle/exportación y perfil sin auditoría). Los valores de los parámetros se restauraron.
- Tras las lecturas, la tabla sigue con **6 filas** (el GET no crea): `password_inicial_dias=7`, `autogestion_max_prorrogas=5`, `autogestion_aviso_dias=1`, notificaciones en `false` y `fe_de_vida.dias_recordatorio=30,15,7,3,1`.

---

## Migraciones y datos
- `configuracion.0003_sembrar_parametros_sistema` aplicada en la BD local (idempotente; las 6 filas ya existían y conservaron su valor).
- Seed re-ejecutado: sin asignaciones nuevas; el rol AUDITOR se mantiene.
- Registro de auditoría de prueba de M1: creado y **eliminado**.
- Entradas de auditoría de los cambios de parámetro de la prueba D9: se conservan (la bitácora es append-only).

## Pendientes
- Ninguno de D11. G5 sigue como espacio reservado y E1 (hash encadenado) fuera de este alcance.

## Archivos
**Backend:** `core/domain/auditoria.py`, `apps/identidad/presentation/views/cuenta_views.py`, `apps/configuracion/infrastructure/repositories/repo_parametros_orm.py`, `apps/configuracion/presentation/views/parametros_views.py`, `apps/configuracion/migrations/0003_sembrar_parametros_sistema.py`, tests de auditoría/configuración/ciclo de vida.
**Frontend:** `modules/fe-de-vida/domain/services/reglas.ts`, `modules/fe-de-vida/ui/procesos/selector-dias-recordatorio.tsx` y su test, `e2e/d11-seguimiento.spec.ts`.
