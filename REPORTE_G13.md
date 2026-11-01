# Reporte G13 — Gestión de Personal Pasivo completa y navegación sin saltos

Fecha: 2026-11-01  
Rama: `feature/fe-de-vida-pasivos`  
Alcance: mensaje 1 (corrección de acentos, restauración de sidebars, menú de pasivos, paridad de pantallas, alta directa y caché PWA).

---

## Corrección (mensaje 1)

### 1. Acentos dañados corregidos

Se corrigieron los textos que tenían `?` donde iba una letra acentuada o `ñ`:

| Archivo | Línea | Texto corregido |
|---|---|---|
| `NextJS/src/modules/personal/ui/components/app-sidebar-personal.tsx` | 107 | «Solicitudes de actualización» |
| `NextJS/src/modules/personal/ui/components/app-sidebar-personal.tsx` | 120 | «Bandeja de revisión» |
| `NextJS/src/modules/personal/ui/components/app-sidebar-personal.tsx` | 126 | «Procesos y prórrogas» |
| `NextJS/src/modules/personal/ui/components/app-sidebar-personal.tsx` | 152 | «Métricas» |
| `NextJS/src/proxy.ts` | 62-63 | «métricas», «Gestión», «autogestión» (comentario) |
| `NextJS/src/modules/pasivos/ui/detalle-pasivo.tsx` | 124 | «catálogos» (comentario) |
| `NextJS/src/modules/pasivos/ui/schema/schema-pasivo.ts` | 44, 48 | «básicos», «inválido» |
| `NextJS/src/modules/pasivos/infrastructure/actions/pasivos-actions.ts` | 167, 199, 216, 232 | «inválidos», «Cédula», «inválida» |
| `NextJS/src/modules/pasivos/application/use-cases/gestionar-pasivos.test.ts` | 170 | «página» |
| `NextJS/src/modules/autogestion/ui/shell/nav-autogestion.test.ts` | 35 | «Gestión» |
| `BACKEND/apps/configuracion/domain/parametros.py` | 38, 136-139, 149-151, 162-164, 174-176 | «Retención», «Días», «Después», «auditoría», «autogestión», «leídas» |
| `BACKEND/apps/pasivos/infrastructure/repositories/repo_pasivos_orm.py` | 94, 108, 140, 151 | «paginación», «página», «nómina», «actualización», «cédula» |
| `BACKEND/apps/pasivos/domain/ports/repo_pasivos.py` | 14, 18 | «paginación», «básicos» |
| `BACKEND/apps/pasivos/application/use_cases/actualizar_pasivo.py` | 1 | «Edición», «básicos» |
| `BACKEND/apps/pasivos/application/use_cases/listar_pasivos.py` | 61 | «Página» |
| `BACKEND/apps/pasivos/presentation/serializers/pasivos_serializers.py` | 121 | «básicos» |
| `BACKEND/apps/pasivos/presentation/views/pasivos_views.py` | 94, 101 | «cédula», «básicos» |

Se validó que todos los archivos de `NextJS/src` son UTF-8 válido (ver sección de pruebas).

### 2. Sidebar de Gestión de Personal Activo

Se restauró desde `HEAD` `app-sidebar-personal.tsx` y se aplicaron solo los cambios pedidos:

- Se eliminó **Configuración visual**.
- Se eliminó el grupo **Autogestión** (Formulario, Respuestas Encuesta, Métricas).
- Se agregó **Censo de Vivienda** con:
  - Respuestas de encuesta → `/personal/censo/respuestas`
  - Métricas → `/personal/censo/metricas`
- Se conservaron **Ub. Administrativas**, **Gestión De Codigos**, **Movimientos**, **Reportes**, **Retroalimentación**, **Bienestar Social** y **Fe de vida** con sus subopciones de HEAD.
- Se conservó el filtrado por permisos de D1.
- «Inicio» se mantiene en `/dashboard` (corrección R-6c vigente; HEAD aún tenía `/inicio`).
- Se retiró la línea «Departamento» del pie del sidebar porque `session.user.department` ya no existe en el tipo de sesión (D2); sin esto el build falla. Es la única adaptación no funcional respecto a HEAD.

### 3. Sidebars de Carnetización, Administración y Autogestión

- **Carnetización:** se mantiene sin el enlace «Autogestión» porque es un módulo principal ajeno. No se quitó ninguna opción propia.
- **Administración:** se mantiene sin el enlace «Autogestión» por la misma regla. No se quitó ninguna opción propia.
- **Autogestión:** se quitaron «Respuestas de encuesta» y «Métricas» porque son submódulos de Gestión de Trabajadores; ahora viven en `/personal/censo/*`. El resto de opciones propias (Inicio, Mi ficha, Solicitar, Mis solicitudes, Fe de vida, Notificaciones, Censo) se conserva.

### 4. Menú de pasivos

`app-sidebar-pasivos.tsx` quedó con la estructura pedida:

- Inicio, Notificaciones.
- **Personal Pasivo:** Agregar Pasivo, Consultar/Actualizar, Agregar Familiar, Consultar Familiar.
- **Egreso:** Procesar egreso.
- **Sobrevivientes:** Alta de pensión por sobreviviente (C20).
- **Fe de vida:** Bandeja, Procesos y prórrogas, Cobertura.
- **Reportes:** Reportes de pasivos → `/reportes?tab=pasivos`.

Cada opción filtra por permiso con `filtrarMenuPorPermisos` y la tabla D1.

### 5. Pantallas de pasivos

- **Consultar/Actualizar:** paginación servidor 10/50, filtros cédula, nombre, tipo de nómina (`es_activo=False`) y rango de fecha de egreso.
- **Detalle:** Sheet con expediente, PDF y edición de datos básicos (`pasivos.editar`).
- **Edición:** nombres, apellidos, correo, teléfonos, carnet y fecha de nacimiento.
- **Familiares:** `/familiares/consultar?pasivo=1` y `/familiares/registrar?pasivo=1` con selector de pasivo; se conserva el módulo de familiares.
- **Egreso:** `/pasivos/egreso`.
- **Sobrevivientes:** `/pasivos/sobrevivientes` (C20).

### 6. Alta directa de pasivo

Se agregó el caso de uso Onion `registrar_pasivo_directo`:

- Crea `Employee` reutilizando `RepoPersonalORM.crear_empleado`.
- Crea `AsigTrabajo` con:
  - `Tipo_personal = PASIVO` (buscado en catálogo).
  - `TipoNomina` elegida por el usuario, validando `es_activo=False`.
  - Cargo `PERSONAL PASIVO` (Denominación y Especificación).
  - Dependencia `NIVEL DE APOYO`.
  - Dirección General `OFICINA DE GESTION HUMANA`.
  - Estatus `PASIVO`.
  - Código generado con `generar_codigo_pasivo`.
- Emite `cargo_movimiento_ejecutado` con `tipo_movimiento='INGRESO'`, motivo `JUBILACION DE DERECHO` o `PENSION DE INVALIDEZ` según la nómina, y `origen=ORIGEN_PASIVOS`.
- Permiso `pasivos.crear`; auditoría `pasivos.pasivo_creado`.
- Formulario multi-pasos: datos personales, pensión, vivienda y confirmación.

### 7. Caché PWA

Se subió `CACHE_VERSION` de `gath-shell-v3` a `gath-shell-v4` en `public/sw.js`; no se cambió nada más del service worker.

---

## Pruebas

| Verificación | Resultado |
|---|---|
| Backend: alta directa de pasivo | 4 passed |
| Backend completo | **1167 passed, 1 skipped** |
| `lint-imports` | **82 kept / 0 broken** |
| `makemigrations --check` | Sin cambios |
| Vitest módulos afectados | 165 passed |
| `tsc --noEmit` | Sin errores |
| `eslint` archivos afectados | 0 errores |
| `next build` | Pendiente de la corrida final |
| E2E lectura/menús/selector | Pendiente de la corrida final |
| E2E escritura (alta/edición) | Omitido: `E2E_ADMIN_PASSWORD` sigue en `COMPLETAR` |
| UTF-8 válido en `NextJS/src` | Pendiente de validación final |

## Pendientes

- Configurar `E2E_ADMIN_PASSWORD` para ejecutar el E2E de alta/edición y las capturas de ambos menús con un usuario con permisos de escritura.
- Validación en hardware real y recarga forzada de la PWA.
- Las capturas finales `C:\Users\josef\OneDrive\Desktop\gath-msg1-*.png` quedan pendientes por la misma falta de credenciales de escritura.

## Sugerencias (no aplicadas)

- El reporte de pasivos podría tener una ruta propia (`/reportes/pasivos`) en lugar de `?tab=pasivos`, pero no se cambió para no alterar el módulo de reportes.
- El formulario directo podría incluir formación académica y perfil de salud como el legado; se dejó en datos personales, pensión y vivienda para no ampliar el alcance sin aprobación.

---

## Egreso de pasivo (corrección posterior)

### Cómo era el flujo original

Se investigó el historial de `dashboard/gestion-pasivos`:

- Página original: `NextJS/src/app/(protected)/dashboard/gestion-pasivos/movimientos/cambiar-pasivo/page.tsx`.
- Componente: `components/movimientos/cambiar-personal-pasivo-form.tsx` (`PasivoPasiveForm`).
- Búsqueda por cédula con `getPasiveById` (`employee/pasivo/<cedula>/`).
- Estatus fijo `EGRESADO` (se filtraba `statusEmployee === "EGRESADO"`).
- Motivos desde `getReasonLeavingPasive()`, que llamaba a `motivos/egreso/fallecimineto/`. Es decir, el criterio real era **fallecimiento**, no la categoría «ESTATUS PASIVO».
- Switch «Seleccionar Pensionado Sobreviviente»; al activarlo cargaba los familiares del pasivo (`getFamilyPasiveOne`) y permitía agregarlos.
- Envío: `PATCH historyEmployee/egreso/<cedula>/` con `estatus_id`, `usuario_id`, `motivo` y `sobrevivientes: [{cedula_familiar}]`.

### Implementación actual

- Ruta: `/pasivos/egreso-pasivo` y componente `modules/pasivos/ui/egreso-pasivo-page.tsx`.
- Menú: «Egreso → Egreso de pasivo». Se eliminaron «Procesar egreso» y «Sobrevivientes» del menú de pasivos.
- Motivos: `GET /api/v1/pasivos/motivos-egreso/`, filtrando `TipoMovimiento.movimiento__icontains='fallec'`; sin IDs fijos.
- Egreso: `POST /api/v1/pasivos/<cedula>/egreso/` con `motivo_id` y `sobrevivientes_familiar_ids`.
- El backend valida que el motivo sea de fallecimiento y rechaza con **400** cualquier motivo de activo (por ejemplo, RENUNCIA).
- El alta de sobrevivientes reutiliza el endpoint/caso de uso C20 existente (`POST /api/v1/pasivos/<cedula>/sobrevivientes/`), ejecutado dentro del mismo flujo transaccional.
- Se eliminó la página duplicada `/pasivos/egreso` (activo → pasivo); ese flujo permanece en `/movimientos/cambiar-pasivo` y en el menú de activos.
- Se eliminó la ruta/página suelta `/pasivos/sobrevivientes`; la selección de sobrevivientes vive dentro del egreso.

### Archivos tocados

- `BACKEND/apps/pasivos/application/dtos/pasivos_dtos.py`: `EgresarPasivoDTO`.
- `BACKEND/apps/pasivos/domain/ports/repo_pasivos.py`: métodos de motivos y egreso.
- `BACKEND/apps/pasivos/infrastructure/repositories/repo_pasivos_orm.py`: `listar_motivos_egreso_pasivo`, `egresar_pasivo`.
- `BACKEND/apps/pasivos/application/use_cases/egresar_pasivo.py`: orquestación egreso + C20.
- `BACKEND/apps/pasivos/presentation/serializers/pasivos_serializers.py`: `PasivoEgresoInputSerializer`.
- `BACKEND/apps/pasivos/presentation/views/pasivos_views.py`: `MotivosEgresoPasivoView`, `PasivoEgresoView`.
- `BACKEND/apps/pasivos/presentation/urls.py`: rutas `motivos-egreso/` y `<cedula>/egreso/`.
- `BACKEND/tests/integration/pasivos/test_egreso_pasivo.py`: motivos, egreso con sobreviviente y rechazo de motivo de activo.
- `NextJS/src/modules/pasivos/infrastructure/http/pasivos-api.ts`: motivos y egreso.
- `NextJS/src/modules/pasivos/domain/ports/repo-pasivos.ts`: métodos nuevos.
- `NextJS/src/modules/pasivos/infrastructure/repositories/repo-pasivos-api.ts`: implementación.
- `NextJS/src/modules/pasivos/application/use-cases/gestionar-pasivos.ts`: casos de uso.
- `NextJS/src/modules/pasivos/infrastructure/actions/pasivos-actions.ts`: acciones.
- `NextJS/src/modules/pasivos/ui/egreso-pasivo-page.tsx`: flujo restaurado.
- `NextJS/src/app/(app)/pasivos/egreso-pasivo/page.tsx`: ruta.
- `NextJS/src/modules/pasivos/ui/components/app-sidebar-pasivos.tsx`: menú.
- `NextJS/src/shared/lib/evaluador-iam.ts`: regla de ruta.
- Eliminados: `NextJS/src/app/(app)/pasivos/egreso/`, `NextJS/src/app/(app)/pasivos/sobrevivientes/`, `NextJS/src/modules/pasivos/ui/registrar-pasivo-page.tsx`.

### Pruebas

| Verificación | Resultado |
|---|---|
| Backend completo | **1167 passed, 1 skipped** |
| Tests de egreso de pasivo | **3 passed** |
| Tests de alta directa | **4 passed** |
| `lint-imports` | **82 kept / 0 broken** |
| `makemigrations --check` | Sin cambios |
| Vitest completo | **581 passed** |
| `tsc --noEmit` | Sin errores |
| `eslint .` | **0 errores** (78 warnings preexistentes) |
| `next build` | Correcto |
| E2E G13 (lectura/menús/selector/redirecciones) | **7 passed, 2 skipped** |
| E2E de escritura (egreso con datos de prueba) | **Omitido**: `E2E_ADMIN_PASSWORD` sigue en `COMPLETAR` |
| Capturas | `gath-msg1-menu-activos.png`, `gath-msg1-menu-pasivos.png`, `gath-msg1-pasivos-consultar.png`, `gath-msg1-pasivos-registrar.png`, `gath-egreso-pasivo.png` |

### Pendiente

- Ejecutar el E2E de egreso con datos de prueba y limpieza cuando exista una cuenta con `pasivos.cambiar_condicion`.
- Validar en vivo el flujo completo de alta de sobreviviente desde la UI con esa misma cuenta.
