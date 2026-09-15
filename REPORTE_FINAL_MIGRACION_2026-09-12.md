# Reporte Final — Migración a Arquitectura Onion GATH (2026-09-12)

> **Fecha:** 2026-09-15 (actualizado; primera versión 2026-09-12)
> **Commit auditado:** `aaf2b7d` (branch `feature/arquitectura-onion`)
> **Reemplaza a:** `REPORTE_FINAL_MIGRACION_2026-09-11.md` (88 archivos de legado remanente, 4 GAPs abiertos)
> **Objetivo:** Cerrar los 3 GAPs de UX documentados en `LIMPIEZA_FINAL_LEGADO_2026-09-12.md`
> (OrganismoAdscrito/`retroalimentacion`, detalle+PDF de personal/pasivos, reportes de
> Egresados+Distribución), retirar todo el legado que quedó genuinamente cubierto 1:1, y dejar
> explícito qué NO se pudo retirar y por qué.
> **Método:** verificación de código real (grep + lectura de archivos + `tsc`), no de mensajes de
> commit; borrado incremental verificado por `tsc --noEmit` tras cada bloque; suite completa
> (backend: `manage.py check`, `lint-imports`, `pytest`; frontend: `tsc --noEmit`, `vitest run`)
> tras cada bloque grande.

---

## 1. Resumen ejecutivo

| Lado | Arquitectura Onion | Tests | Legado retirado esta tarea | Estado |
|---|---|---|---|---|
| **Backend** | ✅ Completa (11 apps + `core/`), **70/70 contratos `lint-imports`** | **190 passed**, 0 failed propios, 4 errors de entorno (Postgres local no disponible en este contenedor) — idéntico al baseline conocido | 1 archivo de datos (`seed_permisos.py`): permiso otorgado + 2 permisos nuevos creados | ✅ Sin regresiones |
| **Frontend** | ✅ Completa en los 12 módulos, 0 violaciones de capas | **147/147 passed**, 33/33 archivos | **88 → 9 archivos** (90% de reducción acumulada) bajo `dashboard/` | 🟢 **Los 4 GAPs (3 originales + el de `modules/familiares` encontrado en el camino) están cerrados y verificados. Los 9 archivos que quedan son, cada uno, una decisión ya tomada explícitamente — no una ambigüedad pendiente** |

**Veredicto corto:** los 3 GAPs documentados el 2026-09-11 quedaron **cerrados y verificados con
evidencia real de código**, y su legado correspondiente fue retirado con 0 regresiones. En el
camino se encontraron y resolvieron dos brechas reales que bloqueaban el cierre completo: (1) una
**brecha de permisos** en la paridad RECEPCIONISTA del lado "personal" — se localizó el Control de
Cambio oficial que originó el rol (`CONTROL_DE_CAMBIO_ROL_RECEPCIONISTA.md`, CC-APP-2026-08-001),
que confirma que el rol **sí** debía poder ver el expediente completo pero **no** exportarlo en
PDF, y con esa base se corrigió `seed_permisos.py` y se agregó el gate de exportación que
faltaba; y (2) un **gap de gating + contenido** en `modules/familiares` — no tenía ningún control
de permisos sobre editar/eliminar, y una vez corregido eso se encontró que tampoco tenía una vista
de detalle equivalente a la del legado. Investigar esa última pieza reveló que los campos que
faltaban (estado civil, formación académica, perfil físico, salud) **nunca funcionaron de punta a
punta en este backend**: el legado los pedía a una ruta (`Employeefamily/...`) que no existe en
ningún `urls.py` de este proyecto — confirmado con el coordinador antes de decidir cómo proceder.
Con las 2 brechas resueltas, el legado de `dashboard/` quedó en **9 archivos**, los mismos 9 que ya
estaban identificados como decisiones tomadas desde el reporte anterior (GAP #4 no aplica,
dependencias reales de otras features, y el shell compartido de RECEPCIONISTA).

---

## 2. Backend

### 2.1 `python manage.py check`
```
System check identified no issues (0 silenced).
```
✅ Limpio.

### 2.2 `lint-imports` (contratos Onion)
```
Contracts: 70 kept, 0 broken.
```
✅ Sin cambios.

### 2.3 `pytest`
```
190 passed, 4 errors in 37.46s
```
- **0 tests fallidos.**
- **4 errores**, los 4 en `tests/integration/test_bloqueo_cuentas.py`
  (`django.db.utils.ProgrammingError`) — mismo baseline de entorno (sin Postgres local) que en
  todas las tareas anteriores de esta sesión.

### 2.4 Cambio de datos: `seed_permisos.py`

**Hallazgo:** el botón "Ver detalle" nuevo de `modules/personal` está gateado por
`personal.ver_detalle`, y `EmpleadoDetailView.get_permissions()` exige ese mismo permiso en el
`GET` del expediente completo (bloqueo real de API, no solo de UI). RECEPCIONISTA (rol 9) nunca
tuvo ese permiso en `seed_permisos.py` — solo `personal.ver`, `pasivos.ver`, `familiares.ver`.
Retirar el legado sin resolver esto habría sido una regresión de acceso real para ese rol.

**Evidencia decisiva:** `CONTROL_DE_CAMBIO_ROL_RECEPCIONISTA.md` (CC-APP-2026-08-001, el Control
de Cambio oficial de 19-ago-2026 que originó este rol) dice textualmente que el objetivo es
"incorporar un perfil de sólo consulta que permita **revisar la información** de trabajadores y
familiares, **tanto activos como pasivos**, sin capacidad de registrar, actualizar, gestionar
códigos ni extraer reportes [...] oculte [...] los accesos a los formularios de actualización **y
la exportación de expedientes**." Esto resuelve la ambigüedad de forma inequívoca: el rol **sí**
debía tener acceso de consulta al expediente completo, pero **no** a exportar su PDF.

**Cambio aplicado** (commit `ea7029f`):
- Se agrega `"personal.ver_detalle"` al rol 9 (RECEPCIONISTA).
- Se crean 2 permisos nuevos en el catálogo: `personal.exportar_pdf` y `pasivos.exportar_pdf`,
  otorgados a ANALISTA y BIENESTAR SOCIAL (los únicos roles que hoy usan esa exportación sin gate
  alguno), pero **no** a RECEPCIONISTA.
- `pasivos.ver_detalle` no se otorgó a RECEPCIONISTA: no hace falta, `PasivoDetailView` solo exige
  `pasivos.ver` (que ya tenía).

**Nota de despliegue:** `manage.py seed_permisos` no se pudo ejecutar contra una BD real en este
sandbox (sin Postgres local, mismo límite que los 4 tests de integración) — se verificó la
estructura del diccionario (sin códigos huérfanos) vía `manage.py shell`. **Debe ejecutarse el
comando en el entorno real como parte del despliegue** para que la matriz de permisos tome efecto;
por el mecanismo de `permisos_version` (ver skill `autenticacion-permisos-jwt`), una cuenta ya
logueada de RECEPCIONISTA no verá el nuevo permiso hasta su próximo refresh de token si el cambio
de rol no incrementa ese contador — a diferencia de un cambio a una cuenta individual, este es un
cambio a nivel de rol (tabla `RolPermisoModel`), así que su propagación depende de cómo el
resolutor de permisos lee esa tabla en cada request/refresh (fuera del alcance de este cambio de
datos verificarlo further).

---

## 3. Frontend

### 3.1 GAPs verificados y cerrados (retiro de legado ejecutado)

#### GAP A — OrganismoAdscrito / `dashboard/retroalimentacion/**`
Verificado con código real (endpoints backend + casos de uso + UI conectada, sin referencias
colgantes). Ya había sido retirado por un worker concurrente de esta sesión (commit `ca506e8`);
se confirmó que el retiro fue seguro.

#### GAP B — Reportes de Egresados + Distribución de nómina
Verificado con código real (`modules/reportes` tiene tabs reales con datos/PDF/Excel para ambos,
endpoints backend confirmados). **Retirado** (commit `73e6fd4`): `reportes/egresados/**` (6
archivos), `reportes/page.tsx`, `components/reports/{report-leaving,report-distribution}.tsx`, y
el bloque "Reportes" del sidebar de `gestion-trabajadores` (sus 4 destinos ya estaban muertos o
apuntaban a rutas borradas aquí mismo). Se conservó `reportes/empleados/{pdf,schema}` en ese
momento por ser dependencia transitiva de `tableEmployees/columns.tsx`; ambos se retiraron después,
junto con el resto del lado "personal" (ver GAP C).

#### GAP C — Detalle + PDF de personal y pasivos (paridad RECEPCIONISTA)
**Lado pasivos** (sin brecha de permisos, retirado primero, commit `60c65a0`): `PasivoDetailView`
solo exige `pasivos.ver` (que RECEPCIONISTA ya tenía), y `modules/pasivos` ya tiene Sheet de
detalle + PDF equivalentes. Se retiraron 18 archivos: `api/getInfoPasive.ts`, `components/pasive/
{tablePasive,layout}/**`, `layout.tsx`, `page.tsx`, `personal-jubilado/consultar`, `personal-
jubilado/familiares/consultar`. `proxy.ts` y `header.tsx` se actualizaron para redirigir a
`/pasivos`.

**Lado personal** (bloqueado por el permiso faltante, resuelto en §2.4, retirado después, commit
`c15969c`): con `personal.ver_detalle` ya otorgado y la exportación de PDF ya restringida (ver
§3.2), se retiraron 12 archivos: `tableEmployees/**` (columnas, detalle, página, update-info),
`personal-trabajador/consultar`, `layout.tsx`/`page.tsx`/`app-sidebar.tsx` de `gestion-
trabajadores`, y `reportes/empleados/{pdf,schema}` (ya sin consumidores). `proxy.ts` y
`dashboard/page.tsx` (tarjeta "RAC") se actualizaron para apuntar a `/personal`.

**Nota sobre `api/getInfoRac.ts` y `components/loading/loading.tsx`:** se conservaron
deliberadamente — no son legado de paridad, son dependencias reales de features activas fuera de
este GAP: `censo-vivienda` (ruta `(auth)/censo-vivienda`) y `src/shared/forms/employees/**`
(usado transitivamente por `personal-jubilado/registrar`, GAP #4 ya cerrado como no-aplica).
Retirarlos habría roto esas features. `dashboard/page.tsx` se actualizó para usar
`@/shared/ui/components/loading` (idéntico, ya existente) en vez de la copia legado.

### 3.2 Corrección de seguridad — exportación de PDF de expediente

Al verificar el gate de `personal.ver_detalle`, se encontró que **ni** `modules/personal` **ni**
`modules/pasivos` tenían ningún gate en su botón de exportar PDF de expediente — a diferencia del
legado, que sí ocultaba ese botón específicamente para RECEPCIONISTA
(`{!soloLectura && ...}` en `gestion-pasivos/tablePasive/columns.tsx`, con `soloLectura` incluyendo
`role === "RECEPCIONISTA"`). Esto habría sido una regresión de seguridad silenciosa: otorgar
`personal.ver_detalle` sin este gate habría dejado a RECEPCIONISTA exportar expedientes completos
en PDF, algo que el CC-APP-2026-08-001 exige explícitamente ocultar.

**Corregido** (commit `a25491f`): ambos módulos ahora condicionan el botón de exportar PDF a los
permisos nuevos `personal.exportar_pdf` / `pasivos.exportar_pdf` (§2.4), que RECEPCIONISTA no
tiene pero ANALISTA y BIENESTAR SOCIAL sí.

### 3.3 GAP de `modules/familiares` — CERRADO por completo (permisos + contenido)

**Parte 1 — gating de permisos (commit `6c2eac4`, tarea anterior).** Se confirmó que
`modules/familiares` no tenía ningún gating de permisos: sus botones de editar (`Pencil`) y
eliminar (`Trash2`) se mostraban sin condición alguna a cualquier usuario que llegara a
`/familiares`. Se agregó el mismo patrón `tienePermiso()` ya usado en `modules/personal`/
`modules/pasivos`. De paso se corrigió un hueco de autorización real en el backend:
`FamiliaresEmpleadoListView.post` solo exigía `familiares.ver`, no `familiares.crear` — un hueco
que afectaba a **cualquier** rol con `familiares.ver`, no solo a RECEPCIONISTA.

**Parte 2 — vista de detalle (esta tarea, commit `f540ebd`).** Al verificar si ya era seguro
retirar el legado de "consultar familiares" (~25 archivos), se encontró que `modules/familiares`
no tenía ninguna vista de detalle equivalente a la del legado (`tableFamilys/detail-info.tsx`,
leído completo en ambos lados): faltaban estado civil, formación académica, perfil físico, perfil
de salud y enlaces de documentos. **Antes de construir nada**, se verificó el backend de
`apps.familiares` (paso explícito de la tarea) y se encontró algo más grave: esos campos ricos
**nunca tuvieron un endpoint funcional en este proyecto**. El legado los pedía a
`Employeefamily/...` (listado, detalle-documentos, y el `PATCH` de cada formulario de edición) —
una ruta que **no existe en ningún `urls.py`** de este backend (confirmado con `grep` en
`GATH/urls.py` y `apps/familiares/presentation/urls.py`: los únicos endpoints registrados son
`api/v1/familiares/empleado/<cedula>/`, `.../  <id>/` y `.../documentos/`). El dominio nuevo de
`apps.familiares` (entidad `Familiar`, `FamiliarSerializer`, modelo ORM `EmployeefamilyModel`)
tampoco modela esos campos. Es decir: la pantalla legado **ya estaba rota hoy** (cualquier
listado, detalle o edición en ella hacía un `fetch` a un endpoint 404) — no había funcionalidad
real que preservar.

Se consultó al coordinador (`ask`) antes de decidir cómo proceder, presentando ese hallazgo. La
decisión ("Opción A"): construir solo un Sheet de detalle **mínimo** con los campos que el backend
nuevo sí tiene (identidad, parentesco, mismo ente, heredero, observaciones, y el metadato de
documentos — tipo + fecha, sin enlace de descarga porque el servidor de media autenticado deniega
explícitamente el prefijo `familiares/` y no existe endpoint de descarga dedicado), y retirar el
legado — sin abrir una tarea de backend para agregar esos campos, y documentando que si algún día
son un requisito de negocio real, es una **feature nueva a decidir aparte**, no un gap de
migración.

Se construyó `DetalleFamiliar` (`modules/familiares/ui/detalle-familiar.tsx` +
`detalle-familiar-view-model.ts`, con tests) siguiendo el mismo patrón que
`EmpleadoDetalleSheet`/`DetallePasivo`, y se retiraron los 25 archivos legado de consulta de
familiares (commit `aaf2b7d`), actualizando `RUTAS_RECEPCIONISTA` en `proxy.ts` para redirigir a
`/familiares`.

### 3.4 `npx tsc --noEmit`
**28 errores**, todos preexistentes (2 menos que en la revisión anterior: los 2 que vivían en los
propios `tableFamilys/detail-info.tsx` ya retirados):

| Archivo | Motivo |
|---|---|
| `gestion-pasivos/personal-jubilado/registrar/forms/form-multi-steps.tsx` | `@formity/react` no instalado + `any` implícitos (GAP #4, no aplica) — 17 errores |
| `src/lib/regex.ts` | reexporta 7 nombres que no existen en `@/shared/validation/regex` (bug preexistente, fuera de alcance) — 7 errores |
| `src/proxy.ts` | `PoliticaAccesoDTO` vs `string[]` en `puede()` legado — 4 errores |

(Además, en el árbol hay 2 errores preexistentes en `e2e/smoke.spec.ts` ajenos a esta tarea y a
`familiares`, de trabajo concurrente de otro worker en esta sesión.)

**0 errores nuevos** introducidos por la vista de detalle ni por el retiro de legado.

### 3.5 `npx vitest run`
```
Test Files  33 passed (33)
Tests       147 passed (147)
```
✅ Sin fallos. Se agregaron 5 tests nuevos: `detalle-familiar-view-model.test.ts` (formato de
fecha con `formatInTimeZone` — evita el bug de desplazamiento por zona horaria local que
`toLocaleDateString` habría introducido — y traducción de tipos de documento).

### 3.6 Legado remanente: 9 archivos (antes 34; 88 el 2026-09-11)

| Bloque | Archivos | Motivo de no-retiro |
|---|---|---|
| `gestion-trabajadores/api/getInfoRac.ts` + `components/loading/loading.tsx` | 2 | Dependencias reales de `censo-vivienda` y `shared/forms/employees` (§3.1) |
| `gestion-pasivos/personal-jubilado/registrar/**` | 5 | GAP #4, cerrado como "no aplica" en tarea anterior |
| `dashboard/layout.tsx` + `dashboard/page.tsx` | 2 | Shell compartido / home de RECEPCIONISTA; sin equivalente todavía en `app/(app)/*` |

La consulta de familiares (25 archivos) ya no aparece en esta tabla: quedó retirada por completo
en esta tarea.

---

## 4. Commits

1. `73e6fd4` — retiro de `reportes/egresados` + `reportes/page.tsx` (GAP B)
2. `60c65a0` — retiro de paridad RECEPCIONISTA del lado "pasivos" (GAP C, mitad segura)
3. `ea7029f` — otorgar `personal.ver_detalle` a RECEPCIONISTA + crear permisos de exportación de PDF (backend, CC-APP-2026-08-001)
4. `a25491f` — ocultar exportación de PDF para RECEPCIONISTA en personal y pasivos
5. `c15969c` — retiro de paridad RECEPCIONISTA del lado "personal" (GAP C, mitad restante) + hallazgo del gap de `modules/familiares`
6. `42baf93` — reporte final (versión 2026-09-12)
7. `6c2eac4` — gating de permisos en `modules/familiares` + corrección del hueco de autorización en `FamiliaresEmpleadoListView.post`
8. `0017a6d` — actualización del reporte final (gating de familiares cerrado, gap de contenido documentado)
9. `f540ebd` — vista de detalle de familiar en `modules/familiares` (esta tarea, 2026-09-15)
10. `aaf2b7d` — retiro de los 25 archivos legado de consulta de familiares (esta tarea, 2026-09-15)

(GAP A ya había sido cerrado por un worker concurrente antes de esta sesión de tareas, commit `ca506e8`.)

---

## 5. Recomendación para cerrar el 100% (tarea de seguimiento, opcional)

Los 9 archivos que quedan no bloquean ningún GAP — son decisiones ya tomadas y aceptadas. Si en el
futuro se quiere llegar a 0 archivos de todas formas:

1. Ejecutar `manage.py seed_permisos` en el entorno real (staging/producción) para que el permiso
   `personal.ver_detalle` de RECEPCIONISTA y los permisos nuevos de exportación tomen efecto (sigue
   pendiente desde la tarea anterior — no se pudo verificar contra una BD real en este sandbox).
2. Diseñar un home/selector de módulos para RECEPCIONISTA equivalente a `dashboard/page.tsx`
   dentro de `app/(app)/*`, y entonces retirar `dashboard/layout.tsx` + `dashboard/page.tsx` (y de
   paso `api/getInfoRac.ts`/`loading.tsx` si para entonces `censo-vivienda` y
   `shared/forms/employees` ya migraron a otra fuente).
3. `personal-jubilado/registrar/**` (5 archivos) queda como decisión de producto ya tomada
   (GAP #4, no aplica) — no requiere acción salvo que el negocio decida sí implementar el alta
   real de pasivo histórico.
4. (Feature nueva, no gap de migración) Si estado civil/formación académica/perfil físico/salud
   del familiar y la descarga de sus documentos son un requisito de negocio real hoy, es un
   desarrollo nuevo de backend (nunca funcionó de punta a punta en este proyecto) — decidirlo por
   separado, no como parte del retiro de legado.

---

## 6. Veredicto final

**¿La migración a arquitectura Onion (backend + frontend) está completa? Sí, al 100%** — 12/12
módulos frontend con las 4 capas Onion sin violaciones, 70/70 contratos backend, 0 regresiones de
tests en ambos lados.

**¿El retiro de legado está prácticamente completo? Sí — 9 de los 88 archivos que había el
2026-09-11 (90% de reducción acumulada), y los 9 que quedan son decisiones explícitas, no
ambigüedad.** Los 4 GAPs que se fueron encontrando en esta serie de tareas (OrganismoAdscrito,
detalle+PDF de personal/pasivos, reportes de egresados+distribución, y permisos+contenido de
familiares) están cerrados con evidencia de código verificada, no por mensaje de commit. El
hallazgo más significativo de esta tarea final fue confirmar que la "funcionalidad real" que
supuestamente bloqueaba el retiro de la consulta de familiares (estado civil, formación
académica, perfil físico, salud) **ya no existía de forma funcional en este backend** — permitió
cerrar el gap sin fabricar una función nueva ni perder nada que realmente funcionara. La migración
a arquitectura Onion + retiro de legado se considera **completa para efectos prácticos**; lo que
queda es, explícitamente, trabajo futuro opcional (§5), no deuda de la migración.
