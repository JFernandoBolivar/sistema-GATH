# Reporte G12 — Seguimiento de la revisión G6–G8

Fecha: 2026-10-30. Rama `feature/fe-de-vida-pasivos`. Sin commit ni push.

Alcance: fila **G12** de `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md`. El punto 8 (archivo de depuración) ya estaba resuelto en `d70f8bb`; no se repitió.

---

## 1. Aviso del trabajador con clave propia (MEDIO)

**Problema:** RRHH y el trabajador compartían `tipo`, `ref_id` y `clave`; la unicidad de la campana es `(destinatario_cedula, clave_unica)` y no incluye el módulo. Si el trabajador también recibía avisos de RRHH (p. ej. un ANALISTA), su aviso de `autogestion` se descartaba.

**Corrección:** `apps/movimientos/domain/services/notificaciones_movimiento.py`:
- RRHH: `clave = {id_movimiento}`.
- Trabajador: `clave = {id_movimiento}:trabajador` (`SUFIJO_CLAVE_TRABAJADOR`).
- `ref_tipo`/`ref_id` se mantienen iguales para ambos; la restricción de la tabla no se tocó.

**Tests:**
- Unitario: `test_el_aviso_del_trabajador_tiene_clave_propia` (claves `1` y `1:trabajador`).
- Integración: `test_el_trabajador_que_tambien_recibe_avisos_de_rrhh_recibe_los_dos` — la cuenta del trabajador pasa a tener el rol con el permiso; recibe **dos** avisos (`personal` + `autogestion`), con `clave_unica` distintas, y al reprocesar el movimiento no se duplican.

---

## 2. `NOTIFICAR_MOVIMIENTOS_POR_CORREO` en `.env.example`

Añadido a `BACKEND/.env.example`, junto a `NOTIFICAR_BIENESTAR_POR_CORREO`, con `False` por defecto y su comentario.

---

## 3. Botones PDF/Excel según permiso (BAJO)

**Implementación:**
- `NextJS/src/modules/movimientos/domain/value-objects/permisos-movimientos.ts`: constantes `PERMISO_MOVIMIENTOS.ver/exportarPdf/exportarExcel` (códigos del seed; sin literales sueltos).
- `NextJS/src/modules/movimientos/application/use-cases/permisos-movimiento.ts`: `puedeVerMovimientos`, `puedeExportarMovimientosPdf`, `puedeExportarMovimientosExcel` con el motor IAM (`tienePermiso`: exacto, `modulo.*`, `*`, fail-closed).
- `movimientos-page.tsx`: `puedeVer`, `puedeExportarPdf` y `puedeExportarExcel` salen de esos predicados; cada botón se renderiza **solo** con su permiso y `descargar()` vuelve a comprobarlo.
- Test Vitest: `permisos-movimiento.test.ts` (3 casos: consulta, permiso cruzado y sesión sin permisos / código de otro módulo).

**Verificación en vivo:**
- Con el rol ADMINISTRADOR (que conserva ambos permisos) los dos botones están visibles.
- Con una cuenta/rol temporal que solo tenía `movimientos.ver`, **ningún** botón aparece; cuenta y rol se eliminaron después.

---

## 4. Comentario de login

`NextJS/src/modules/auth/ui/login-form.tsx`: el comentario decía que se re-ejecuta el RootLayout «en /dashboard»; ahora dice «en /inicio».

---

## 5. `origen` en el evento de movimiento (PLAUSIBLE)

**Antes:** `receivers.py` comparaba `sender.__name__ == 'RepoSobrevivientesORM'`.

**Ahora:**
- `apps/cargos/domain/events.py`: constantes de dominio `ORIGEN_CARGOS`, `ORIGEN_PASIVOS`, `ORIGEN_SOBREVIVIENTES` y payload documentado con `origen`.
- Emisores actualizados: `repo_cargos_orm.py` (5 eventos), `repo_prestamos_cargo_orm.py`, `repo_pasivos_orm.py` (`ORIGEN_PASIVOS`) y `repo_sobrevivientes_orm.py` (`ORIGEN_SOBREVIVIENTES`).
- `apps/movimientos/infrastructure/receivers.py`: `_tipo_de_evento(origen, tipo_movimiento)`; el alta de sobreviviente se reconoce por `origen == ORIGEN_SOBREVIVIENTES`, no por el nombre de la clase. El parámetro tiene `ORIGEN_CARGOS` por defecto para emisores antiguos.
- Test de integración actualizado: envía `origen=ORIGEN_SOBREVIVIENTES` (ya no usa una clase falsa llamada `RepoSobrevivientesORM`).

---

## 6. Test de número de consultas (PLAUSIBLE)

`tests/integration/movimientos/test_historial_orm.py::test_el_listado_no_hace_una_consulta_por_fila`:
- 5 movimientos → `django_assert_num_queries(2)` (conteo + página).
- Comprueba además que el mapeo de la primera fila trae la denominación y el ejecutor (si se quita `select_related`, el conteo crece y el test falla).

---

## 7. Página vieja del censo eliminada

**Búsqueda previa (src y e2e):**
- `(auth)/censo-vivienda/page.tsx` era la única página de esa ruta; solo la referenciaba `e2e/rutas-legado.spec.ts`.
- `@/schemas/censo-vivienda` solo lo usaba esa página.
- `useBusquedaEmpleado` solo lo usaba esa página.
- `InputForm`, `RadioGroupForm`, `CheckboxForm` y `EmployeeInfoBanner` siguen usándose en `/autogestion/censo` y otros módulos: **no** se borraron.

**Borrado:**
- `NextJS/src/app/(auth)/censo-vivienda/page.tsx`
- `NextJS/src/schemas/censo-vivienda.ts` (y la carpeta `schemas/` al quedar vacía)
- `NextJS/src/modules/personal/ui/hooks/use-busqueda-empleado.ts` (y la carpeta `hooks/` al quedar vacía)

**Redirección:** `src/proxy.ts` conserva `/censo-vivienda` como redirección a `/autogestion/censo`, igual que `/dashboard` → `/inicio`. `e2e/rutas-legado.spec.ts` comprueba la redirección y que el censo vigente abre.

---

## 9. Avisos de movimientos solo para RRHH y Bienestar (decisión del usuario)

**Seed (`apps/identidad/management/commands/seed_permisos.py`):**
- `PERMISOS_EXCLUIDOS_ADMINISTRADOR = {"personal.recibir_avisos_movimientos"}`; el rol 1 se construye con el catálogo **menos** esa exclusión (107 de 108 permisos).
- `ASIGNACIONES_RETIRADAS["ADMINISTRADOR"] = ("personal.recibir_avisos_movimientos",)`: al volver a correr el seed se **elimina** la asignación heredada, de forma idempotente y sin tocar el resto de permisos del rol. La invalidación de sesiones solo ocurre si la matriz cambió (`roles_modificados`).
- `ANALISTA`, `BIENESTAR SOCIAL`, `ANALISTA_BIENESTAR` y `ADMIN_BIENESTAR` conservan el permiso.

**Tests:**
- `test_los_avisos_de_movimientos_son_solo_de_rrhh_y_bienestar` (rol 1 no; los otros cuatro sí).
- `test_el_seed_retira_los_avisos_de_movimientos_al_administrador` (asignación heredada → «Asignaciones retiradas de ADMINISTRADOR: 1»; segunda corrida sin cambios).
- Integración: `test_un_movimiento_no_notifica_al_rol_administrador` (tras el seed, una cuenta rol 1 no recibe; el ANALISTA sí).

**En vivo (BD local):**
- Seed ejecutado: «Asignaciones retiradas de ADMINISTRADOR: 1», «Sesiones invalidadas…: 8 cuentas».
- Destinatarios del permiso tras el seed: **9** (roles 2, 5, 13 y 14); el ADMINISTRADOR ya no está en la lista.
- Movimiento sobre el cargo 109050 / empleado 3333333: con una concesión temporal del permiso al propio trabajador, se generaron **11 avisos** para **10 destinatarios** (los 9 de RRHH/Bienestar + el trabajador, que recibe uno en `personal` y otro en `autogestion`); **0** para el ADMINISTRADOR.

---

## Verificación en vivo

1. Imágenes reconstruidas: `docker compose build django nextjs` + `docker compose up -d django celery_worker celery_beat nextjs`.
2. Seed ejecutado en la BD local (resultado arriba).
3. Movimiento de prueba **solo** sobre el cargo 109050 (código `16000008`) y el empleado E2E 3333333:
   - SUSPENDIDO → se comprobó en BD: aviso de RRHH en `personal` y aviso del trabajador en `autogestion` para 3333333; ADMINISTRADOR sin avisos.
   - Restaurado a ACTIVO.
4. E2E:
   - `e2e/rutas-legado.spec.ts` + `e2e/movimientos-reporte.spec.ts`: **9/9** (incluye `/censo-vivienda` → `/autogestion/censo`, `/dashboard` → `/inicio`, censo vigente y regresión G6).
   - Botones PDF/Excel: **2/2** comprobaciones (visible con permiso, oculto sin él).

---

## Datos de prueba creados y restaurados

| Dato | Acción | Estado final |
|---|---|---|
| Cargo 109050 `Tipo_personal` | `NULL` → `2 (ACTIVO)` temporal para poder registrar el movimiento | **NULL** |
| Cargo 109050 estatus | `ACTIVO` → `SUSPENDIDO` → `ACTIVO` | **ACTIVO (id 1)** |
| Movimientos 7425 y 7426 (empleado 11908 / C.I. 3333333) | Creados por la prueba | **Eliminados** (0 movimientos del empleado) |
| Notificaciones de esos movimientos | 22 (11 por movimiento) | **Eliminadas**; caché de conteo invalidada |
| `UsuarioPermisoModel` de 3333333 (allow temporal del permiso) | Creado para probar el doble aviso | **Eliminado** |
| Cuenta/rol/empleado temporal `V99999997` / rol 16 / cuenta 1067 (`movimientos.ver` sin exportar) | Creados para probar los botones | **Eliminados** |
| Override de prueba del ADMINISTRADOR (deny de exportación) | Se usó para intentar la comprobación negativa; `/auth/me` resuelve los códigos del rol y no aplica overrides a la UI | **Eliminado** y `permisos_version` incrementada |
| Override preexistente de 88888888 | No se tocó | Intacto |

Tras la limpieza: **9 destinatarios** con el permiso, 0 movimientos del empleado 3333333, cargo con `estatus=ACTIVO` y `Tipo_personal=NULL`.

---

## Suites

| Verificación | Resultado |
|---|---|
| Backend focalizado (movimientos + seed) | **46 passed** |
| Backend completo (`pytest -q`) | **1033 passed, 1 failed** |
| Vitest | **94 archivos / 562 pruebas** |
| `tsc --noEmit` | sin errores |
| `eslint .` | **0 errores** (81 avisos preexistentes) |
| `next build` | compila; todas las rutas generadas |
| `lint-imports` | **82 kept, 0 broken** |
| E2E en vivo | 9/9 rutas + reporte; 2/2 botones |

### Sobre el único fallo del backend

`tests/integration/fe_de_vida/test_fe_de_vida_api.py::test_bandeja_pagina_y_filtra` falla con `3 == 4` en `?desde=`. No hay ningún archivo de `apps/fe_de_vida` modificado. Es un test sensible al huso horario: calcula `desde = (ahora - 2 días).date()` en UTC y el backend filtra `fecha_envio__date` en `America/Caracas`; con la hora actual (00:53 UTC = 20:53 del día anterior en Caracas) una fila cae fuera del rango esperado. Reproduce el fallo en aislamiento y es ajeno a G12; se deja documentado sin tocar el módulo protegido.

---

## Archivos

**Backend**
- `apps/cargos/domain/events.py`, `apps/cargos/infrastructure/repositories/repo_cargos_orm.py`, `repo_prestamos_cargo_orm.py`
- `apps/pasivos/infrastructure/repositories/repo_pasivos_orm.py`, `repo_sobrevivientes_orm.py`
- `apps/movimientos/domain/services/notificaciones_movimiento.py`, `apps/movimientos/infrastructure/receivers.py`
- `apps/identidad/management/commands/seed_permisos.py`
- `.env.example`
- `tests/unit/movimientos/test_movimientos_reporte.py`, `tests/unit/identidad/test_seed_roles_bienestar.py`, `tests/integration/movimientos/test_historial_orm.py`

**Frontend**
- Nuevos: `src/modules/movimientos/domain/value-objects/permisos-movimientos.ts`, `src/modules/movimientos/application/use-cases/permisos-movimiento.ts` (+ `.test.ts`)
- `src/modules/movimientos/ui/movimientos-page.tsx`
- `src/modules/auth/ui/login-form.tsx`
- `src/proxy.ts`
- Eliminados: `src/app/(auth)/censo-vivienda/page.tsx`, `src/schemas/censo-vivienda.ts`, `src/modules/personal/ui/hooks/use-busqueda-empleado.ts`
- `e2e/rutas-legado.spec.ts`

## Observaciones
- No se tocaron las cuentas E2E protegidas (solo login de `usuario.prueba.e2e` y el movimiento autorizado sobre 3333333, con todos los datos restaurados); tampoco `apps/fe_de_vida` ni `src/modules/fe-de-vida`.
- La UI obtiene los permisos efectivos de `/auth/me`, que hoy devuelve los códigos del **rol** y no aplica los overrides individuales (`allow`/`deny`) del usuario. No se corrigió por estar fuera de G12; la comprobación negativa de los botones se hizo con un rol temporal sin permiso de exportación.
- El seed conserva el resto del catálogo del ADMINISTRADOR (107 permisos); solo se retiró `personal.recibir_avisos_movimientos`.
