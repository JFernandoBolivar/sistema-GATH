# Auditoría de Estado — Reconstrucción Onion GATH (2026-08-29)

> **Fecha:** 2026-08-29
> **Objetivo:** Documentar lo ejecutado en la sesión (auditoría previa + correcciones) y dejar explícito el **estado actual** y **qué queda pendiente** de la migración legado → Onion (SCREAM + Feature-Based + Onion).
> **Método:** verificación contra código real (no contra `.md`), con `lint-imports`, `manage.py check`, tests, `tsc --noEmit` y `vitest`.

---

## 1. Resumen ejecutivo

| Lado | Arquitectura Onion | Endpoints/Actions | Tests | Estado de migración |
|---|---|---|---|---|
| **Backend** | ✅ Completa (11/11 apps + `core/`) | 87 endpoints (89 declarados en `.md`; +9 catálogos nuevos) | **176 passed** (4 preexistentes) | Estructura lista; **paridad funcional parcial** |
| **Frontend** | 🟡 Módulos `modules/` cumplen Onion | ~61 server actions (todas con safeParse) | **84 passed** (22 files) | **Migración inconclusa** (legado sin retirar, 7 módulos sin UI) |

**El backend onion está sólido; el cuello de botella es todo el frontend** (sin UI real en 7 módulos, legado sin retirar, paridad funcional de datos abierta).

---

## 2. Correcciones ejecutadas en esta sesión

### 2.1 Backend — cierre de B16/B4 + contratos import-linter

| Cambio | Archivos | Impacto |
|---|---|---|
| Ampliado `.importlinter` de **37 → 70 contratos** | `BACKEND/.importlinter` | Enforcement real de B4 (application puro) y B16 entre módulos (`domain/application/presentation` no cruzan) |
| Serializers de expediente movidos a `core/` (R-02/B16) | `core/presentation/serializers/expediente_lectura.py` (nuevo), `persona/presentation/serializers/personal_serializers.py`, `pasivos/.../pasivos_serializers.py` | Elimina el acoplamiento `presentation→personal` |
| Use case `cambiar_password` 100% puro (B4) | `apps/identidad/application/use_cases/cambiar_password.py`, `apps/identidad/infrastructure/providers/validadores_password.py` (nuevo), `apps/identidad/presentation/views/cuenta_views.py` | El validador Django pasó a `infrastructure/`, inyectado desde la vista |

**Regla documentada:** solo la capa `infrastructure` puede cruzar módulos (implementa puertos). `domain/application/presentation` quedan bloqueados por contrato.

### 2.2 Backend — paridad funcional (catálogos existentes)

Se exportaron **9 catálogos** que tenían modelo pero sin endpoint, con Onion limpio (use-case + repo método + vista + url):

| Endpoint | Módulo | Ruta |
|---|---|---|
| Estados civiles | `apps/catalogos` | `GET /api/v1/catalogos/estados-civiles/` |
| Políticas | `apps/personal` | `GET /api/v1/personal/catalogos/politicas/` |
| Condiciones de vivienda | `apps/personal` | `GET /api/v1/personal/catalogos/condiciones-vivienda/` |
| Códigos postales | `apps/personal` | `GET /api/v1/personal/catalogos/codigos-postales/` |
| Grupos sanguíneos | `apps/personal` | `GET /api/v1/personal/catalogos/grupos-sanguineos/` |
| Niveles académicos | `apps/personal` | `GET /api/v1/personal/catalogos/niveles-academicos/` |
| Carreras | `apps/personal` | `GET /api/v1/personal/catalogos/carreras/` |
| Menciones | `apps/personal` | `GET /api/v1/personal/catalogos/menciones/?carrera_id=` |
| Instituciones | `apps/personal` | `GET /api/v1/personal/catalogos/instituciones/` |

### 2.3 Frontend — safeParse (zero-trust)

Las server actions de `modules/*/infrastructure/actions/*-actions.ts` ahora validan su entrada con schema Zod antes de invocar el caso de uso. **Todos los archivos de acciones validan**; solo las que no reciben input (GET sin params) no lo hacen (correcto). Antes el `.md` afirmaba "42 actions completadas" — era falso; hoy la cobertura es completa.

### 2.4 Frontend — VOs de dominio (R1/R2)

- **Violación R1 corregida:** 11 VOs en `domain/value-objects/` importaban `@/shared/validation` (incluye I/O `sanitize`). Se creó el kernel puro `src/shared/domain/validation` (análogo a `core.domain` del backend) y los VOs importan de ahí. `src/shared/validation/{regex,messages}` ahora re-exportan desde el kernel (sin duplicación, sin drift).
- **R2 resuelto:** cero regex inline en VOs (se usan las constantes del kernel).
- **Dead-code removido:** `src/shared/forms/employees/register/form-family.tsx` (1.259 líneas, 0 consumidores).

### 2.5 Frontend — módulo `pasivos` + conexión a rutas (R10)

- **Módulo `pasivos/` creado completo** (Onion 4 capas: entity, VO `motivo-egreso`, puerto + `procesar-egreso`, DTO, 3 use-cases, http, mapper, repo, 3 server actions, schema, UI `pasivos-page`, test).
- **Rutas R10:** se creó la sección `app/(protected)/dashboard/migracion/` con thin wrappers que montan las páginas de módulo antes huérfanas: `identidad`, `pasivos`, `movimientos`, `catalogos` (+ navegación entre ellas e índice).

---

## 3. Verificación de estado (resultado de comandos)

| Comando | Resultado |
|---|---|
| `lint-imports` (BACKEND) | **70 kept / 0 broken** |
| `python manage.py check` | System check identified no issues |
| `pytest` (BACKEND) | **176 passed / 4 failed** |
| `tsc --noEmit` (NextJS) | **0 errores** en `src/modules` y `src/shared` (67 preexistentes en legado `dashboard/`) |
| `vitest run` (NextJS) | **84 passed / 22 files** |

**Los 4 fallos de backend son preexistentes y NO relacionados con los cambios:**
1-3. `ModuleNotFoundError: No module named 'RAC'` (el backend legado `RAC/` fue borrado del working tree sin commit — los tests de compatibilidad apuntan a él).
4. `tests/integration/test_bloqueo_cuentas.py::test_quinto_intento_bloquea...` — dependiente del contador de throttling persistido en la DB de caché (falla antes y después de los cambios).

---

## 4. Estado de git (riesgo alto)

| Elemento | Estado |
|---|---|
| `BACKEND/apps/` | **348 archivos sin versionar** (untracked) |
| `BACKEND/core/` | **42 archivos sin versionar** |
| `NextJS/src/modules/` | **155 archivos sin versionar** |
| Backend legado eliminado (`RAC`, `USER`, `CARNETIZACION`, `AUTOGESTION`, `SIGEP`, `SAGP_*.sql`) | **145 archivos `D`** (eliminados en working tree, **sin commit**) |
| Archivos modificados | **60 `M`** |

> ⚠️ **Riesgo crítico:** toda la arquitectura Onion nueva (`apps/`, `core/`, `GATH/`, `tests/`, `modules/`, `shared/`) está **sin versionar**, y el legado backend está **borrado sin commit**. Es un estado intermedio volátil: cualquier `git checkout` / `reset` perdería la reconstrucción o restauraría el legado. **Se recomienda fuertemente commitear.** Este es EL pendiente número uno.

---

## 5. Qué queda pendiente (evaluación priorizada)

### 🔴 Prioridad 1 — Deuda crítica / riesgo
| # | Ítem | Lado | Nota |
|---|---|---|---|
| ~~1~~ | ~~Commitear el estado actual~~ | Ambos | ✅ **RESUELTO** — 7 commits atómicos en `feature/arquitectura-onion` (ver §7) |
| 2 | **Validar esquema Postgres real** de las tablas legado espejo | Backend | ✅ **RESUELTO** — validado contra BD (PostgreSQL 18.4). Se corrigieron ~14 `db_table`/`db_column` erróneos (catálogos `RAC_*`, `TipoPersonal`, `Coordinaciones`). Quedó como requisito informativo: los datos de `perfil_fisico`/`formacion_complementaria` están en 0 (no migrados), los catálogos sí. |

### 🟠 Prioridad 2 — Paridad funcional (datos que el frontend legado usa y el backend nuevo no persiste)
| # | Bloque | Uso frontend legado | Estado |
|---|---|---|---|
| 3 | `perfil_fisico` (tallas camisa/pantalón/zapato/chaqueta) | ~19–35× | ✅ **Modelo + catálogos listos** (`PerfilFisicoModel`, `TallaModel`/`TipoPrendaModel`/`RegionTallaModel`). Pendiente: escritura desde carga masiva |
| 4 | `formacion_complementaria` (capacitaciones/cursos) | ~54× (`capacitacion` 121×) | ✅ **Modelo + catálogos listos** (`FormacionComplementariaModel`, `CapacitacionModel`/`GrupoCapacitacionModel`) |
| 5 | Salud M2M (alergias / patología crónica / discapacidad) | ~60–104× | ✅ **Modelo + M2M + catálogos listos** (`PerfilSaludModel` ampliado, `AlergiaModel`/`PatologiaCronicaModel`/`DiscapacidadModel`) |
| 6 | `CargoEgresado` (cargos al pasivar) | — | ✅ **Modelo + escritura en `procesar_egreso` + serializer** (`CargoEgresadoModel`, `cargos_historial` en el detalle) |
| 7 | CRUD organización | — | ✅ **RESUELTO** — POST/PUT/DELETE para dependencias, direcciones generales, direcciones de línea, coordinaciones y organismos adscritos (permisos `organizacion.crear/editar/eliminar`) |
| 8 | CRUD códigos de cargo (denominaciones) | — | ✅ **RESUELTO** — POST/PUT/DELETE para denominaciones y denominaciones específicas (permisos `cargos.crear/editar`) |
| 9 | Catálogos sin API | — | ✅ **Exportados** (~20 nuevos: estados-civiles, políticas, vivienda, códigos postales, sanguíneos, niveles, carreras, menciones, instituciones, tallas, prendas, regiones-talla, capacitaciones, grupos, alergias, patologías, discapacidades) |


> Todos los de prioridad 2 requieren **validar BD + decisión de negocio** (asalariados vs nómina, qué campos son editables, etc.).

### 🟡 Prioridad 3 — Frontend funcional
| # | Ítem | Nota |
|---|---|---|
| ~~10~~ | ~~Construir UI (`*-page.tsx`) de los 7 módulos~~ | ✅ **RESUELTO** — UI creada para `autogestion`, `cargos`, `carnetizacion`, `familiares`, `organizacion`, `personal`, `reportes`. Los 11 módulos conectados a rutas (`migracion/`) |
| 11 | Retirar el legado del dashboard (`app/(protected)/dashboard/`, 263 archivos) y el legado de `shared/{forms,schemas,components}` | Fase 8; 116 imports del legado de `shared/` apuntan al dashboard |
| 12 | `eslint-plugin-boundaries` para enforcement automático de R1-R3 en frontend | F1.5 pendiente |
| 13 | Storybook/Chromatic, Dockerfiles multi-stage | F6/F7/T1.7 pendientes |

### 🟢 Prioridad 4 — Diferido / menor
| # | Ítem | Ref. |
|---|---|---|
| 14 | D-05/A-02: trigger PL/pgSQL `calcular_total_apn()` vs Python | Requiere decisión RRHH |
| 15 | R-03: `extract_first_error` no absorbido (~28 call-sites) | ✅ **RESUELTO** — el legado `RAC`/`AUTOGESTION` que lo usaba fue retirado; las vistas nuevas usan `raise_exception=True` (absorbido por el handler). Comentarios obsoletos actualizados |
| 16 | R15 residual: `NEXT_PUBLIC_DJANGO` en 4 archivos cliente-legado | Proxy F4 |
| 17 | R16 residual: `nombre_rol` hardcodeado en `proxy.ts` (RECEPCIONISTA/AUTOGESTION) y sidebars | Sustituir en F9 |
| 18 | Bug latente `repo_reportes_orm.py:66` — campos inexistentes en `AsigTrabajoModel` | ✅ **RESUELTO** — `denominacion_cargo.denominacion`→`denominacioncargoid.cargo`, `codigo_nomina`→`codigo`; verificado contra la BD |
| 19 | Escritura de `perfil_fisico`/`formacion_complementaria`/M2M salud desde carga masiva | ✅ **RESUELTO** — los 3 bloques se persisten vía `_upsert_perfil_fisico`/`_upsert_formacion_complementaria` y M2M de salud con `through` explícito; conectado al alta/edición individual (serializer) y a la carga masiva de expediente |

---

## 7. Seguimiento de la sesión (paridad funcional backend)

Tras commitear el estado base, se ejecutó la **paridad funcional** validando contra la BD real:

| Sub-tarea | Resultado |
|---|---|
| Validación del esquema Postgres (PostgreSQL 18.4) | ✅ Tablas físicas listadas y columnas verificadas |
| Corrección de `db_table`/`db_column` erróneos (~14) | ✅ Catálogos `RAC_*` (parentesco, carreras, menciones, instituciones, cond. vivienda, grupos sanguínceos, región/estado/municipio/parroquia, categoría-movimiento), `TipoPersonal` (columna `tipoPersonal`), `Coordinaciones` (FK sobrante) |
| Modelos nuevos: `PerfilFisicoModel`, `FormacionComplementariaModel`, M2M salud en `PerfilSaludModel` | ✅ Creados sobre tablas físicas, verificados consultando |
| Catálogos nuevos exportados como endpoints | ✅ ~17 endpoints nuevos en `apps/personal/catalogos/*` |
| `CargoEgresadoModel` + escritura en `procesar_egreso_a_pasivo` + serializer `cargos_historial` | ✅ Crea `EmployeeEgresado` + snapshot del cargo al pasivar |
| Endpoints de catálogos wireados en frontend (`catalogos-api`/`actions`/`catalogos-page`) | ✅ |
| Verificación final | **70/70 contratos import-linter** · `manage.py check` OK · **176 passed** (4 preexistentes RAC) · frontend **84 tests** · **0 errores tsc** en `modules`/`shared` |

### UI de los 7 módulos (R10)
Se construyó la interfaz de los 7 módulos que solo tenían schema zod y se conectaron a rutas (opcionalmente a un selector de catálogos ya compartido):
| Módulo | Página | Acciones que consume |
|---|---|---|
| `organizacion` | `organizacion-page.tsx` | 5 GET en cascada |
| `reportes` | `reportes-page.tsx` | 3 GET (personal/pasivos/vacantes) + filtro dependencia |
| `cargos` | `cargos-page.tsx` | getCargos + asignar/desasignar + filtros |
| `familiares` | `familiares-page.tsx` | CRUD + documentos |
| `carnetizacion` | `carnetizacion-page.tsx` | emitir/listar/validar/plantillas/descargar |
| `personal` | `personal-page.tsx` | listar/registrar/editar/foto |
| `autogestion` | `autogestion-page.tsx` | cuestionario + mi censo + reporte |

**Los 11 módulos tienen ahora thin wrapper en `app/(protected)/dashboard/migracion/`** y están enlazados en la navegación e índice de esa sección.

### CRUDs de organización y códigos de cargo
Se habilitó la **escritura** (POST/PUT/DELETE) que faltaba:

| Entidad | Endpoints | Permiso |
|---|---|---|
| Dependencias | `POST /dependencias/crear/`, `PUT /dependencias/<id>/`, `DELETE /dependencias/<id>/eliminar/` | `organizacion.crear/editar/eliminar` |
| Direcciones generales | idem | `organizacion.*` |
| Direcciones de línea | idem | `organizacion.*` |
| Coordinaciones | idem | `organizacion.*` |
| Organismos adscritos | idem | `organizacion.*` |
| Denominaciones de cargo | `POST /denominaciones/crear/`, `PUT /denominaciones/<id>/`, `DELETE /denominaciones/<id>/eliminar/` | `cargos.crear/editar` |
| Denominaciones específicas | idem | `cargos.crear/editar` |

**Bug latente corregido:** `CoordinacionModel` declaraba un FK `direccionGeneralId` inexistente en la tabla `Coordinaciones` (y la entidad/DTO/mapper/serializer referenciaban `direccion_general_id`). Se eliminó para que el listado de coordinaciones no reviente con `column Coordinaciones.direccionGeneralId does not exist`. Verificado con prueba end-to-end de crear/actualizar/eliminar (transacción con rollback).

### Escritura de perfil_fisico / formacion_complementaria / M2M salud
Se habilitó la persistencia de los 3 bloques que estaban en 0:

| Bloque | Mecanismo |
|---|---|
| `perfil_fisico` | `_upsert_perfil_fisico` (tallas camisa/pantalón/zapatos/chaqueta) |
| `formacion_complementaria` | `_upsert_formacion_complementaria` (capacitaciones, lista o dict) |
| Salud M2M | `_upsert_salud` ampliado con M2M; se definieron modelos `through` explícitos (`PerfilSaludAlergias`, `PerfilSaludPatologia`, `PerfilSaludDiscapacidad`) porque la tabla física no sigue la convención de `ManyToManyField` (usa `alergias_id`, no `alergiamodel_id`) |

Conectado a dos vías:
1. **Alta/edición individual** — `EmpleadoEscrituraSerializer` ampliado (campos `perfil_fisico`, `formacion_complementaria`, M2M en `perfil_salud`) que aplanan a los ids que espera el repo.
2. **Carga masiva de expediente** — `carga_masiva_expediente.py` lee columnas (`tallas`, `alergias`, `patologias_cronicas`, `discapacidades`, `capacitacion`, ...) y persiste.

**Bug de modelo corregido:** las M2M de `PerfilSaludModel` generaban la columna `alergiamodel_id` (convención de Django) que no existe en la tabla física `perfil_salud_alergias`; se resolvió con `through` explícito que mapea `alergias_id`/`perfil_salud_id`. Verificado con escritura real (transacción con rollback). Nota: la tabla `RAC_capacitaciones` está vacía en la BD (datos legado sin migrar), por eso no hay registros de capacitación a insertar; el flujo no falla.

---

## 8. Conclusión

La **arquitectura Onion backend está completa y verificada** (11/11 apps, 70 contratos import-linter, 176 tests, check OK), la **paridad funcional de datos quedó habilitada** (modelos + catálogos + endpoints + `CargoEgresado` validados contra Postgres real), y los **CRUDs** de organización y códigos de cargo ya tienen escritura. El **frontend `modules/` cumple las reglas** (safeParse, VOs puros, kebab-case, `@/`) y **los 11 módulos tienen UI conectada a rutas** (R10).

La migración **aún no está completa** en el frente de producto: falta **retirar el legado del dashboard** (Fase 8, 263 archivos activos) y conectar la **escritura desde carga masiva** de `perfil_fisico`/`formacion_complementaria`/M2M salud (los datos están en 0; modelos/endpoints ya listos). El riesgo de git quedó resuelto con los commits atómicos (§7).
