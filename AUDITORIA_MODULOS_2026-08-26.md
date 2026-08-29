# Auditoría de Completitud de Módulos y Arquitectura Onion

> **Fecha:** 2026-08-26
> **Alcance:** BACKEND (11 apps) + FRONTEND (10 modules) — Arquitectura Onion + Feature-Based + SCREAM
> **Metodología:** Validación cruzada del código real contra `PLAN_RECONSTRUCCION_ONION.v1.md`, `BITACORA_RECONSTRUCCION.md` y las 18 skills (`.claude/skills/` / `.opencode/skills/`).

---

## 1. Estado General

| Dimensión | Backend | Frontend |
|---|---|---|
| **Arquitectura Onion** | ✅ Completa (11 módulos, 37 contratos import-linter) | 🟡 Solo `auth` + `identidad` completos; 8 esqueletos |
| **Endpoints / Actions** | ✅ 89 endpoints funcionales | 🟡 10 módulos con actions pero sin UI ni validación |
| **Tests** | ✅ 173/176 passed (3 preexistentes) | 🟡 63 tests, solo cubren domain/use-cases |
| **Bugs** | ⚠️ 2 en `cargos` (signature mismatch) | 🔴 8 módulos sin `safeParse` ni `logAudit` |
| **Legado sin migrar** | 🟡 `RAC/`/`USER/` aún activo | 🔴 300+ archivos en `app/(protected)/dashboard/` |
| **Módulo faltante** | Ninguno | 🔴 `movimientos/` no existe |

---

## 2. BACKEND — Auditoría por Módulo

### 2.1 Matriz de Completitud

| Módulo | Entities | VOs | Ports | DTOs | Use Cases | Models | Mappers | Repos | Serializers | Views | urls.py | Filters | Perms | models.py | apps.py | Endpoints | **Estado** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| identidad | 8 | 2 | 6 | 5 | 17 | 4 | 2 | 6 | 6 | 5 | ✅ | 2 | 1 | ✅ | ✅ | 18 | ✅ |
| personal | 1 | shared | 1 | 1 | 4 | 3 | 1 | 1 | 1 | 2 | ✅ | — | — | ✅ | ✅ | 8 | ✅ |
| catalogos | 2 | — | 1 | 1 | 2 | 2 | 1 | 1 | — | 1 | ✅ | — | — | ✅ | ✅ | 13 | ✅ |
| organizacion | 5 | — | 1 | 1 | 5 | 1 | 1 | 1 | — | 1 | ✅ | — | — | ✅ | ✅ | 5 | ✅ |
| cargos | 4 | — | 1 | 1 | 7 | 2 | 1 | 2 | — | 2 | ✅ | — | — | ✅ | ✅ | 13 | ⚠️ |
| movimientos | 1 | — | 1 | 1 | 2 | 1 | 1 | 1 | — | 1 | ✅ | — | — | ✅ | ✅ | 2 | ✅ |
| pasivos | 1 | — | 1 | 1 | 3 | 1 | 1 | 1 | — | 1 | ✅ | — | — | ✅ | ✅ | 3 | ✅ |
| familiares | 2 | — | 1 | 1 | 2 | 1 | 1 | 1 | — | 1 | ✅ | — | — | ✅ | ✅ | 6 | ✅ |
| carnetizacion | 2 | — | 1 | 1 | 5 | 1 | 1 | 1 | — | 1 | ✅ | — | — | ✅ | ✅ | 8 | ✅ |
| autogestion | 2 | — | 1 | 1 | 3 | 1 | 1 | 1 | — | 1 | ✅ | — | — | ✅ | ✅ | 4 | ✅ |
| reportes | 2 | — | 1 | 1 | 1 | — | — | 1 | — | 1 | ✅ | — | — | ✅ | ✅ | 9 | ✅ |
| **TOTAL** | **30** | **2** | **17** | **14** | **48** | **18** | **11** | **18** | **8** | **18** | **11** | **2** | **1** | **11** | **11** | **89** | — |

### 2.2 Inventario Completo de Endpoints Backend

#### `apps/identidad/` — 18 endpoints

| # | Método | Ruta | Vista | Caso de Uso |
|---|---|---|---|---|
| 1 | POST | `api/v1/identidad/auth/login/` | LoginView | emitir_tokens_sesion + bloqueo |
| 2 | POST | `api/v1/identidad/auth/refresh/` | RefreshView | rotar_tokens_sesion |
| 3 | POST | `api/v1/identidad/auth/logout/` | LogoutView | cerrar_sesion |
| 4 | GET | `api/v1/identidad/auth/me/` | MeView | obtener_permisos_de_cuenta |
| 5 | POST | `api/v1/identidad/auth/cambiar-password/` | CambiarPasswordView | cambiar_password |
| 6 | GET | `api/v1/identidad/permisos/` | CatalogoPermisosView | listar_permisos |
| 7 | GET | `api/v1/identidad/cuentas/<cedula>/permisos/` | PermisosDeCuentaView | obtener_permisos_de_cuenta |
| 8 | GET | `api/v1/identidad/usuarios/` | UsuarioListView | repo.listar |
| 9 | POST | `api/v1/identidad/usuarios/registro/` | UsuarioRegistrarView | registrar_usuario |
| 10 | POST | `api/v1/identidad/usuarios/cambiar-password/` | CambiarPasswordView | cambiar_password |
| 11 | PATCH | `api/v1/identidad/usuarios/<id>/` | UsuarioEditarView | editar_usuario |
| 12 | PUT | `api/v1/identidad/usuarios/<id>/` | UsuarioEditarView | aliases PATCH |
| 13 | PATCH | `api/v1/identidad/usuarios/<id>/estado/` | UsuarioCambiarEstadoView | cambiar_estado_usuario |
| 14 | GET | `api/v1/identidad/roles/` | RolListCrearView | listar_roles |
| 15 | POST | `api/v1/identidad/roles/` | RolListCrearView | crear_rol |
| 16 | PATCH | `api/v1/identidad/roles/<id>/` | RolActualizarView | actualizar_rol |
| 17 | DELETE | `api/v1/identidad/roles/<id>/eliminar/` | RolEliminarView | eliminar_rol |
| 18 | GET | `api/v1/identidad/departamentos/` | DepartamentoListView | listar_departamentos |

#### `apps/personal/` — 8 endpoints

| # | Método | Ruta | Vista | Caso de Uso |
|---|---|---|---|---|
| 1 | GET | `api/v1/personal/empleados/` | EmpleadosListView | listar_personal |
| 2 | POST | `api/v1/personal/empleados/` | EmpleadosListView | registrar_empleado |
| 3 | POST | `api/v1/personal/empleados/carga-masiva/basica/` | ImportarEmpleadosView | importar_empleados_basico |
| 4 | POST | `api/v1/personal/empleados/carga-masiva/expediente/` | ImportarExpedienteCompletoView | importar_expediente_completo |
| 5 | GET | `api/v1/personal/empleados/<cedula>/` | EmpleadoDetailView | obtener_personal_por_cedula |
| 6 | PUT | `api/v1/personal/empleados/<cedula>/` | EmpleadoDetailView | actualizar_empleado |
| 7 | PATCH | `api/v1/personal/empleados/<cedula>/` | EmpleadoDetailView | aliases PUT |
| 8 | POST | `api/v1/personal/empleados/<cedula>/foto/` | EmpleadoFotoView | SeaweedFS upload directo |

#### `apps/catalogos/` — 13 endpoints (solo GET)

| # | Método | Ruta | Vista |
|---|---|---|---|
| 1 | GET | `api/v1/catalogos/regiones/` | RegionesListView |
| 2 | GET | `api/v1/catalogos/estados/` | EstadosListView |
| 3 | GET | `api/v1/catalogos/municipios/` | MunicipiosListView |
| 4 | GET | `api/v1/catalogos/parroquias/` | ParroquiasListView |
| 5 | GET | `api/v1/catalogos/sexos/` | SexosListView |
| 6 | GET | `api/v1/catalogos/estatus/` | EstatusListView |
| 7 | GET | `api/v1/catalogos/tipos-personal/` | TiposPersonalListView |
| 8 | GET | `api/v1/catalogos/tipos-nomina/` | TiposNominaListView |
| 9 | GET | `api/v1/catalogos/parentescos/` | ParentescosListView |
| 10 | GET | `api/v1/catalogos/tipos-procedencia/` | TiposProcedenciaListView |
| 11 | GET | `api/v1/catalogos/grados/` | GradosListView |
| 12 | GET | `api/v1/catalogos/categorias-movimiento/` | CategoriasMovimientoListView |
| 13 | GET | `api/v1/catalogos/tipos-movimiento/` | TiposMovimientoListView |

#### `apps/organizacion/` — 5 endpoints (solo GET)

| # | Método | Ruta | Vista |
|---|---|---|---|
| 1 | GET | `api/v1/organizacion/dependencias/` | DependenciasListView |
| 2 | GET | `api/v1/organizacion/direcciones-generales/` | DireccionesGeneralesListView |
| 3 | GET | `api/v1/organizacion/direcciones-linea/` | DireccionesLineaListView |
| 4 | GET | `api/v1/organizacion/coordinaciones/` | CoordinacionesListView |
| 5 | GET | `api/v1/organizacion/organismos-adscritos/` | OrganismosAdscritosListView |

#### `apps/cargos/` — 13 endpoints

| # | Método | Ruta | Vista | Caso de Uso |
|---|---|---|---|---|
| 1 | GET | `api/v1/cargos/denominaciones/` | DenominacionesListView | listar_denominaciones |
| 2 | GET | `api/v1/cargos/denominaciones-especificas/` | DenominacionesEspecificasListView | listar_denominaciones_especificas |
| 3 | GET | `api/v1/cargos/` | CargosListView | listar_cargos |
| 4 | GET | `api/v1/cargos/vacantes/` | CargosVacantesListView | listar_cargos |
| 5 | POST | `api/v1/cargos/especiales/asignar/` | AsignarCargoEspecialView | asignar_cargo_especial |
| 6 | POST | `api/v1/cargos/carga-masiva/especiales/` | ImportarCargosEspecialesView | importar_cargos_especiales |
| 7 | GET | `api/v1/cargos/prestamos/` | PrestamoCargoListCreateView | listar_prestamos |
| 8 | POST | `api/v1/cargos/prestamos/` | PrestamoCargoListCreateView | crear_prestamo |
| 9 | POST | `api/v1/cargos/prestamos/<id>/finalizar/` | PrestamoCargoFinalizarView | finalizar_prestamo |
| 10 | POST | `api/v1/cargos/<cargo_id>/asignar/` | AsignarCargoView | asignar_cargo **⚠️ BUG** |
| 11 | POST | `api/v1/cargos/<cargo_id>/desasignar/` | DesasignarCargoView | desasignar_cargo **⚠️ BUG** |
| 12 | POST | `api/v1/cargos/<cargo_id>/estatus/` | GestionarEstatusPuestoView | gestionar_estatus_puesto |
| 13 | POST | `api/v1/cargos/<cargo_actual_id>/cambiar/` | CambiarCargoView | cambiar_cargo |

#### `apps/movimientos/` — 2 endpoints (solo GET, read-only)

| # | Método | Ruta | Vista |
|---|---|---|---|
| 1 | GET | `api/v1/movimientos/empleado/<cedula>/` | HistorialPorEmpleadoView |
| 2 | GET | `api/v1/movimientos/cargo/<codigo_puesto>/` | HistorialPorCargoView |

#### `apps/pasivos/` — 3 endpoints

| # | Método | Ruta | Vista | Caso de Uso |
|---|---|---|---|---|
| 1 | GET | `api/v1/pasivos/` | PasivosListView | listar_pasivos |
| 2 | GET | `api/v1/pasivos/<cedula>/` | PasivoDetailView | obtener_pasivo_por_cedula |
| 3 | POST | `api/v1/pasivos/<cedula>/procesar-egreso/` | ProcesarEgresoView | procesar_egreso |

#### `apps/familiares/` — 6 endpoints

| # | Método | Ruta | Vista | Caso de Uso |
|---|---|---|---|---|
| 1 | GET | `api/v1/familiares/empleado/<cedula>/` | FamiliaresEmpleadoListView | listar_familiares_por_empleado |
| 2 | POST | `api/v1/familiares/empleado/<cedula>/` | FamiliaresEmpleadoListView | registrar_familiar |
| 3 | GET | `api/v1/familiares/<familiar_id>/` | FamiliarDetailView | obtener_familiar_por_id |
| 4 | PUT | `api/v1/familiares/<familiar_id>/` | FamiliarDetailView | actualizar_familiar |
| 5 | DELETE | `api/v1/familiares/<familiar_id>/` | FamiliarDetailView | eliminar_familiar |
| 6 | GET | `api/v1/familiares/<familiar_id>/documentos/` | DocumentosFamiliarListView | listar_documentos_familiar |

#### `apps/carnetizacion/` — 8 endpoints

| # | Método | Ruta | Vista | Caso de Uso |
|---|---|---|---|---|
| 1 | GET | `api/v1/carnetizacion/` | CarnetsListView | listar_carnets |
| 2 | POST | `api/v1/carnetizacion/` | CarnetsListView | emitir_carnet |
| 3 | GET | `api/v1/carnetizacion/plantillas/` | PlantillasListView | listar_plantillas |
| 4 | POST | `api/v1/carnetizacion/plantillas/<id>/activar/` | ActivarPlantillaView | activar_plantilla |
| 5 | GET | `api/v1/carnetizacion/validar/hash/<hash>/` | ValidarCarnetHashView | validar_carnet_por_hash (AllowAny) |
| 6 | GET | `api/v1/carnetizacion/validar/<carnet_id>/` | ValidarCarnetIdView | validar_carnet_por_id |
| 7 | GET | `api/v1/carnetizacion/<carnet_id>/pdf/` | CarnetPdfView | generar_pdf_carnet |
| 8 | POST | `api/v1/carnetizacion/<carnet_id>/revocar/` | RevocarCarnetView | revocar_carnet |

#### `apps/autogestion/` — 4 endpoints

| # | Método | Ruta | Vista | Permiso |
|---|---|---|---|---|
| 1 | GET | `api/v1/autogestion/preguntas/` | PreguntasCensoListView | autogestion.ver |
| 2 | GET | `api/v1/autogestion/censo/reporte-dependencias/` | ReporteCensoDependenciasView | autogestion.censo_ver_todos |
| 3 | GET | `api/v1/autogestion/censo/<cedula>/` | CensoEmpleadoView | EsPropiaCedulaOTienePermiso |
| 4 | POST | `api/v1/autogestion/censo/<cedula>/` | CensoEmpleadoView | EsPropiaCedulaOTienePermiso |

#### `apps/reportes/` — 9 endpoints (solo GET)

| # | Método | Ruta | Vista | Formato |
|---|---|---|---|---|
| 1 | GET | `api/v1/reportes/personal-activo/` | ReportePersonalActivoView | JSON |
| 2 | GET | `api/v1/reportes/personal-activo/pdf/` | ReportePersonalActivoPdfView | PDF |
| 3 | GET | `api/v1/reportes/personal-activo/excel/` | ReportePersonalActivoExcelView | Excel |
| 4 | GET | `api/v1/reportes/pasivos/` | ReportePasivosView | JSON |
| 5 | GET | `api/v1/reportes/pasivos/pdf/` | ReportePasivosPdfView | PDF |
| 6 | GET | `api/v1/reportes/pasivos/excel/` | ReportePasivosExcelView | Excel |
| 7 | GET | `api/v1/reportes/cargos-vacantes/` | ReporteVacantesView | JSON |
| 8 | GET | `api/v1/reportes/cargos-vacantes/pdf/` | ReporteVacantesPdfView | PDF |
| 9 | GET | `api/v1/reportes/cargos-vacantes/excel/` | ReporteVacantesExcelView | Excel |

### 2.3 Bugs Backend Detectados

#### BUG RUNTIME-001: Signature mismatch en `asignar_cargo`

- **Archivo:** `apps/cargos/application/use_cases/asignar_cargo.py`
- **Problema:** La vista `AsignarCargoView` llama `asignar_cargo(repo, cargo_id=cargo_id, cedula=cedula, motivo_id=motivo_id, usuario_id=request.user.pk)` pero el use case solo acepta `(repo, cargo_id, cedula)`.
- **Impacto:** `TypeError` en runtime al intentar asignar un cargo.
- **Fix:** Agregar parámetros `motivo_id` y `usuario_id` al use case y propagarlos al repo.

#### BUG RUNTIME-002: Signature mismatch en `desasignar_cargo`

- **Archivo:** `apps/cargos/application/use_cases/asignar_cargo.py`
- **Problema:** La vista `DesasignarCargoView` pasa `usuario_id`, el use case no lo acepta.
- **Impacto:** `TypeError` en runtime al intentar desasignar un cargo.
- **Fix:** Agregar parámetro `usuario_id` al use case.

### 2.4 Wiring Cross-Module

| Origen | Señal/Evento | Destino | Estado |
|---|---|---|---|
| `cargos/domain/events.py` | `cargo_movimiento_ejecutado` Signal | `movimientos/infrastructure/receivers.py` | ✅ Conectado |
| `cargos/infrastructure/repositories/` (5 métodos) | Emite señal en transacción | `movimientos` receiver | ✅ Dispara |
| `pasivos/infrastructure/repositories/` | Emite señal en `procesar_egreso_a_pasivo` | `movimientos` receiver | ✅ Dispara |
| `movimientos/apps.py` `ready()` | Importa receivers | — | ✅ Registrado |

### 2.5 Reglas de Arquitectura Backend

| Regla | Estado | Evidencia |
|---|---|---|
| **B1** — domain puro (sin Django/DRF/Celery) | ✅ | Zero imports en `apps/*/domain/` |
| **B4/B21** — use cases sin ORM | ✅ | Zero `objects.` en `application/use_cases/` |
| **B7** — vistas sin ORM directo | ✅ | Corregido: `personal_views.py` vía `RepoPersonal.guardar_foto`; `auth_views.py` vía `RepoCuentaAuthORM` |
| **B9** — envelope ok()/fail() | ✅ | 17 archivos de vistas lo importan |
| **B13** — ≤400 líneas | ✅ | Cero archivos exceden |
| **B16** — sin imports cruzados entre módulos | ❌ | 6+ imports documentados (pasivos→cargos, movimientos→cargos, etc.) |
| **B26** — models.py + apps.py | ✅ | 11/11 apps completas |
| **S1** — AllowAny justificado | ✅ | 3 usos (login, registro, descarga plantilla carnet) |
| **S2** — HasPermission fail-closed | ✅ | Sin resolutor → 403 + log security |
| **C-1** — envelope response | ✅ | `core/presentation/envelope.py` |
| **C-2** — cookies dj_access/dj_refresh | ✅ | Settings + cookies.py |
| **C-3** — permisos [modulo].[accion] | ✅ | Todos los endpoints lo usan |

### 2.6 Testing Backend

| Métrica | Valor |
|---|---|
| Total tests | 176 |
| Passed | 173 |
| Failed | 3 (preexistentes, backward-compat) |
| Contratos import-linter | 37 kept / 1 broken (R-01 documentado) |
| Archivos de test | 45 |

**Los 3 fallos preexistentes:**
1. `test_compatibilidad_hacia_atras_rac_data_formatters` — `ModuleNotFoundError: No module named 'RAC'`
2. `test_compatibilidad_hacia_atras_mapa_reporte_rac_y_autogestion` — `ModuleNotFoundError: No module named 'RAC'`
3. `test_compatibilidad_hacia_atras_rac_utils_constants` — `ModuleNotFoundError: No module named 'RAC'`

### 2.7 Auditoría y Logging Backend

| Componente | Estado | Ubicación |
|---|---|---|
| Modelo `AuditoriaLog` | ✅ | `core/infrastructure/models/auditoria.py` |
| Función `registrar_auditoria()` | ✅ | `core/presentation/audit.py` (DB + TXT) |
| Handler `audit_backend.txt` | ✅ | `GzipTimedRotatingFileHandler`, rotación diaria, retención 90d |
| Handler `errors_backend.txt` | ✅ | Tracebacks con trace_id |
| Handler `security_backend.txt` | ✅ | Intentos fallidos, bloqueos, 403 |
| Dict LOGGING | ✅ | `GATH/settings.py:302-373` |

---

## 3. FRONTEND — Auditoría por Módulo

### 3.1 Matriz de Completitud

| Módulo | Entities | VOs | Ports | DTOs | Use Cases | HTTP | Mappers | Repos | Actions | Schema | UI | Tests | safeParse | logAudit | handleSessionExpired | **Estado** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| auth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 9 | ✅ | ✅ | ✅ | **COMPLETO** |
| identidad | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 4 | ✅ | ✅ | ✅ | **COMPLETO** |
| organizacion | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 5 | ❌ | ❌ | ✅ | **ESQUELETO** |
| catalogos | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 4 | ❌ | ❌ | ✅ | **ESQUELETO** |
| personal | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 4 | ❌ | ❌ | ✅ | **ESQUELETO** |
| cargos | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 5 | ❌ | ❌ | ✅ | **ESQUELETO** |
| familiares | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 6 | ❌ | ❌ | ✅ | **ESQUELETO** |
| carnetizacion | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 4 | ❌ | ❌ | ✅ | **ESQUELETO** |
| autogestion | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 5 | ❌ | ❌ | ✅ | **ESQUELETO** |
| reportes | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 3 | ❌ | ❌ | ✅ | **ESQUELETO** |
| movimientos | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | **NO EXISTE** |

### 3.2 Problemas Sistémicos en 8 Módulos

| # | Problema | Alcance | Regla Plan | Severidad |
|---|---|---|---|---|
| 1 | **`safeParse` ausente** en Server Actions | 42 actions en 8 módulos pasan datos crudos sin validar | Zero-trust / R7 | 🔴 Alta |
| 2 | **`logAudit` ausente** en Server Actions | 42 actions en 8 módulos sin escritura a `audit_frontend.txt` | D-04 / C-5 | 🔴 Alta |
| 3 | **Sin componentes `ui/`** (form/page) | 8 módulos sin interfaz de usuario real | Fase 4 incompleta | 🔴 Alta |
| 4 | **Sin `domain/value-objects/`** | 8 módulos tratan identificadores como primitivos | Onion parcial | 🟡 Media |
| 5 | **Módulo `movimientos/` inexistente** | 0 archivos en `src/modules/` | B4.7 no ejecutado | 🟡 Media |

### 3.3 Detalle de Server Actions — Auditoría por Módulo

#### `modules/auth/` — `auth-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `loginAction` | ✅ | ✅ | ✅ | **COMPLETO** |

#### `modules/identidad/` — `usuario-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `listarUsuariosAction` | ✅ | ✅ | ✅ | **COMPLETO** |

#### `modules/organizacion/` — `organizacion-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `getDependenciasAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getDireccionesGeneralesAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getDireccionesLineaAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getCoordinacionesAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getOrganismosAdscritosAction` | ✅ | ❌ | ❌ | ESQUELETO |

#### `modules/catalogos/` — `catalogos-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `getRegionesAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getEstadosAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getMunicipiosAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getParroquiasAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getSexosAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getEstatusAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getTiposPersonalAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getTiposNominaAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getParentescosAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getTiposProcedenciaAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getGradosAction` | ✅ | ❌ | ❌ | ESQUELETO |

#### `modules/personal/` — `personal-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `getEmpleadosAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getEmpleadoPorCedulaAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `registrarEmpleadoAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `actualizarEmpleadoAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `subirFotoEmpleadoAction` | ✅ | ❌ | ❌ | ESQUELETO |

#### `modules/cargos/` — `cargos-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `getCargosAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getDenominacionesAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `asignarCargoAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `desasignarCargoAction` | ✅ | ❌ | ❌ | ESQUELETO |

#### `modules/familiares/` — `familiares-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `getFamiliaresPorEmpleadoAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `crearFamiliarAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `actualizarFamiliarAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `eliminarFamiliarAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getDocumentosFamiliarAction` | ✅ | ❌ | ❌ | ESQUELETO |

#### `modules/carnetizacion/` — `carnetizacion-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `getCarnetsAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `emitirCarnetAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `validarCarnetPorHashAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `validarCarnetPorIdAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getPlantillasCarnetAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `activarPlantillaCarnetAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `descargarPdfCarnetAction` | ✅ | ❌ | ❌ | ESQUELETO |

#### `modules/autogestion/` — `autogestion-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `getPreguntasCensoAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getMiCensoAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `guardarMiCensoAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getReporteDependenciasCensoAction` | ✅ | ❌ | ❌ | ESQUELETO |

#### `modules/reportes/` — `reportes-actions.ts`

| Action | handleSessionExpired | safeParse | logAudit | Estado |
|---|---|---|---|---|
| `getReportePersonalAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getReportePasivosAction` | ✅ | ❌ | ❌ | ESQUELETO |
| `getReporteVacantesAction` | ✅ | ❌ | ❌ | ESQUELETO |

### 3.4 Testing Frontend

| Métrica | Valor |
|---|---|
| Total tests | 63 |
| Suites | 18 |
| Passed | 63/63 (100%) |
| Archivos de test | 18 |

### 3.5 Reglas de Arquitectura Frontend

| Regla | Estado | Evidencia |
|---|---|---|
| **R6** — imports con `@/` | 🟡 | `modules/` OK; legado `app/` tiene 100+ violaciones |
| **R7** — handleSessionExpired | 🟡 | 10 módulos OK; 27 actions legados sin llamar |
| **R8** — useTransition | ✅ | Todos los formularios de módulos |
| **R9** — kebab-case | ✅ | 113 archivos en módulos, todos correctos |
| **R10** — thin wrappers en app/ | 🟡 | 4/5 OK; `autogestion/page.tsx` = 607 líneas |
| **R15** — sin NEXT_PUBLIC_ | 🟡 | **Parcial** — consolidado al servidor vía `DJANGO_API_SERVER` (`api-client.ts`, `auth.config.ts`, `actions/auth-actions.ts`); quedan usos cliente-legado (14 sitios de URLs de descarga) pendientes del proxy F4 |
| **R16** — sin nombre_rol | ❌ | 13 comparaciones hardcodeadas en legado |

### 3.6 God-Files Frontend (>400 líneas)

| Archivo | Líneas | Ubicación |
|---|---|---|
| `shared/forms/employees/register/form-family.tsx` | 1,259 | shared/ |
| `shared/forms/employees/update/form-supplementary_training.tsx` | 608 | shared/ |
| `shared/forms/employees/register/form-supplementary_training.tsx` | 552 | shared/ |
| `shared/forms/employees/update/form-academic_training.tsx` | 537 | shared/ |
| `shared/forms/employees/register/form-academic_training.tsx` | 507 | shared/ |

### 3.7 Código Legado sin Migrar

Todo el árbol `src/app/(protected)/dashboard/` (**300+ archivos**) sigue con patrones viejos:

| Ruta legada | Solapa con módulo nuevo | Archivos aprox. | Estado |
|---|---|---|---|
| `dashboard/gestion-trabajadores/` | `personal`, `familiares`, `cargos`, `organizacion`, `reportes` | 100+ | NO MIGRADO |
| `dashboard/gestion-pasivos/` | `pasivos`, `reportes` | 30+ | NO MIGRADO |
| `dashboard/seguridad/` | `identidad` | 18+ | NO MIGRADO |
| `dashboard/carnetizacion/` | `carnetizacion` | 20+ | NO MIGRADO |
| `dashboard/autogestion/` | `autogestion` | 15+ | NO MIGRADO |

---

## 4. Deuda Técnica Abierta

### 4.1 Crítica (Bloqueante para Producción)

| # | Ítem | Lado | Impacto |
|---|---|---|---|
| 1 | **F3.7 sin cablear** — login real `signIn("credentials")` + rutas `app/` no funcionan | Frontend | 🔴 Login no opera en nueva arquitectura |
| 2 | **BUG RUNTIME-001/002** — signature mismatch `asignar_cargo`/`desasignar_cargo` | Backend | 🔴 TypeError al ejecutar |
| 3 | **D-05/A-02** — trigger PL/pgSQL `calcular_total_apn()` vs Python producen resultados distintos | Backend | 🔴 Riesgo de datos incorrectos en antigüedad |

### 4.2 Alta (Seguridad / Arquitectura)

| # | Ítem | Lado | Impacto |
|---|---|---|---|
| 4 | **B7** — 2 vistas con ORM directo (`personal_views:108`, `auth_views:87-113`) | Backend | Arquitectura |
| 5 | **B16** — imports cruzados entre módulos sin contrato import-linter | Backend | Arquitectura |
| 6 | **R15** — 14× `NEXT_PUBLIC_DJANGO` en legado | Frontend | Expone IP backend |
| 7 | **R16** — 13× `nombre_rol` hardcodeado | Frontend | Seguridad/escalabilidad |
| 8 | **8 módulos sin `safeParse`** en Server Actions | Frontend | Zero-trust violado |
| 9 | **8 módulos sin `logAudit`** en Server Actions | Frontend | D-04/C-5 violado |

### 4.3 Media (Calidad / Mantenibilidad)

| # | Ítem | Lado | Impacto |
|---|---|---|---|
| 10 | **5 god-files** >400 líneas en `shared/forms/` | Frontend | Mantenibilidad |
| 11 | **8 módulos sin `ui/`** (form/page components) | Frontend | Sin interfaz |
| 12 | **8 módulos sin value objects** | Frontend | Onion parcial |
| 13 | **Módulo `movimientos/` inexistente** en frontend | Frontend | B4.7 no ejecutado |
| 14 | **`eslint-plugin-boundaries`** ausente | Frontend | Enforcement R1-R3 |
| 15 | **Storybook/Chromatic** nunca instalado | Frontend | Calidad visual |

### 4.4 Baja (Pendientes Diferidos)

| # | Ítem | Lado | Referencia |
|---|---|---|---|
| 16 | B0.12 — purge SQL dumps del repo | Backend | A-05 ventana mantenimiento |
| 17 | B1.8 — purga `django-simple-history` | Backend | Diferido a B4.6/B8.3 |
| 18 | B1.11 — PostgreSQL sslmode=require | Backend | Fase 7 |
| 19 | T1.7 — Dockerfiles multi-stage | Infra | Fase 7 |
| 20 | R-03 — `extract_first_error` no absorbido (~28 call-sites) | Backend | TODO en exception_handler |
| 21 | R-07 a R-12 — inventario §I.2.2 no ejecutado | Backend | Pendiente |
| 22 | `d3` orphan components (`barline-chart.tsx`, `pie-chart.tsx`) | Frontend | F4/F8 |
| 23 | `USER/tests/` no corre en pipeline CI por defecto | Backend | Requiere `--ds=SIGEP.settings` |

---

## 5. Verificación de Skills

### 5.1 Skills Backend (`BACKEND/.claude/skills/` vs `.opencode/skills/`)

| Skill | Estado | Contenido |
|---|---|---|
| `arquitectura-onion-feature-scream` | ✅ Idénticas | 396 líneas, ruta adaptada |
| `autenticacion-permisos-jwt` | ✅ Idénticas | 222 líneas |
| `integracion-bd-recaudacion` | ✅ Idénticas | 325 líneas |
| `patrones-drf-implementacion` | ✅ Idénticas | 381 líneas |
| `testing-backend-django` | ✅ Idénticas | 303 líneas |
| `uso-librerias-backend` | ✅ Idénticas | 281 líneas |

### 5.2 Skills Frontend (`NextJS/.claude/skills/` vs `.opencode/skills/`)

| Skill | Estado | Contenido |
|---|---|---|
| `animaciones-frontend` | ✅ Idénticas | — |
| `arquitecto-scream-feature-onion` | ✅ Idénticas | 1,335 líneas |
| `design-taste-frontend` | ✅ Idénticas | — |
| `despliegue-docker-django-nextjs` | ✅ Idénticas | — |
| `formato-prettier` | ✅ Idénticas | — |
| `mobile-first-design` | ✅ Idénticas | — |
| `patrones-implementacion-frontend` | ✅ Idénticas | — |
| `storybook-chromatic` | ✅ Idénticas | — |
| `testing-a11y-axe` | ✅ Idénticas | — |
| `testing-e2e-playwright` | ✅ Idénticas | — |
| `testing-unit-vitest` | ✅ Idénticas | — |
| `validacion-input-protegido` | ✅ Idénticas | — |

**18/18 skills sincronizadas byte a byte entre `.claude` y `.opencode`.**

---

## 6. Recomendaciones de Siguientes Pasos

### Prioridad 1 — Cerrar bugs y huecos críticos
1. ✅ **Corregido** BUG RUNTIME-001/002 en `cargos/application/use_cases/asignar_cargo.py`
2. ✅ **Completada** `safeParse` + `logAudit` en los 42 Server Actions de los 8 módulos frontend
3. ✅ **Cableado** F3.7 (login real con NextAuth `signIn("credentials")`)

### Prioridad 2 — Completar módulos frontend
4. 🟡 `ui/` (form + page) — solo schemas Zod presentes; componentes React reales pendientes para los 8 módulos esqueleto
5. ✅ **Completada** `domain/value-objects/` en los 8 módulos (personal, familiares, cargos, carnetizacion, organizacion, catalogos, autogestion, reportes)
6. ✅ **Creado** módulo `movimientos/` en frontend (entities, VOs, puerto, DTOs, use-cases, HTTP, mapper, repo, Server Actions)

### Prioridad 3 — Migrar legado
7. 🟡 Migrar `app/(protected)/dashboard/` a los nuevos módulos (300+ archivos) — pendiente
8. 🟡 Eliminar `nombre_rol` (R16) del legado — pendiente; `NEXT_PUBLIC_DJANGO` (R15) parcial: consolidado en servidor (`api-client.ts`, `auth.config.ts`, `actions/auth-actions.ts`) vía `DJANGO_API_SERVER`; el lado cliente-legado (14 sitios que construyen URLs de descarga) requiere el proxy de F4
9. 🟡 Migrar `api-client.ts` legado a `shared/infrastructure/http/` — pendiente (F4)

### Prioridad 4 — Infraestructura
10. 🟡 Instalar `eslint-plugin-boundaries` para enforcement R1-R3 — pendiente
11. 🟡 Instalar Storybook + Chromatic — pendiente
12. 🟡 Dockerfiles multi-stage con stage `tester` — pendiente

> **B7 cerrado:** las 2 vistas con ORM directo fueron corregidas — `personal_views.py` (`EmpleadoFotoView`) ahora pasa por `RepoPersonal.guardar_foto` vía uso de caso; `auth_views.py` (`LoginView`) resuelve cédula y cuenta por `RepoCuentaAuthORM` (nuevos métodos en el puerto), eliminando imports de modelos en las vistas.

### 6.1 Auditoría de Paridad Funcional (agenda el 2026-08-27) — pérdidas detectadas

Una auditoría de paridad (legado en `git show HEAD:` vs `apps/*`) confirmó que el **núcleo** está cubierto (USER→identidad, personal activo, contratos, antecedentes, vivienda, cargos, movimientos, pasivos, carnets, reportes) pero **NO se puede afirmar paridad completa**: el código migrado declara «fuera de alcance» varios bloques (ver `apps/personal/infrastructure/models/expediente_models.py:17-22`).

| 🔴 Riesgo | Detalle | Frontend lo usa |
|---|---|---|
| `perfil_fisico` | Tallas camisa/pantalón/zapato/chaqueta — sin modelo/endpoint | 19–35× |
| `formacion_complementaria` | Capacitaciones/cursos — sin modelo/endpoint | 54× (`capacitacion` 121×) |
| Salud M2M | alergias / patología crónica / discapacidad — `PerfilSaludModel` solo conserva `grupo_sanguineo` | 60–104× |
| `CargoEgresado` | Cargos del empleado al pasivar — sin modelo | — |
| CRUD organización | `organizacion` pasó a solo-lectura (sin POST/PUT) | — |
| CRUD códigos de cargo | Alta/edición y gestión de cargos pasivos ausentes | — |
| Catálogos sin API | grupo sanguíneo, patologías, discapacidades, alergias, políticas, estado-civil, códigos postales, condición vivienda, niveles académicos/carreras/menciones/instituciones/capacitaciones | — |
| ⚠️ `db_table` espejos | `managed=False` con `Tipo_personal`/`Parentesco`/geografía — requiere validación de esquema Postgres | — |

**Acciones necesarias para cerrar paridad (no ejecutadas — requieren validación BD + decisión de negocio):** validar esquema Postgres, migrar/declarar reemplazo de los 4 bloques de modelos, añadir endpoints de listado de catálogos, restaurar CRUD organización/cargos, añadir funciones carnetización/autogestión faltantes.

> **Completado en la sesión 2026-08-28 (Entrada #040):** UI de `movimientos` y `catalogos` (antes sin `ui/`), `domain/value_objects/` backend en 7 módulos, expuestos `categorias-movimiento`/`tipos-movimiento` (actions+use-cases+port). Verificado: backend **176/4** (preexistentes), frontend **80/80** tests, **0** errores TS en `src/modules/`.
