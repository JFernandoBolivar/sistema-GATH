# Reporte Final — Migración a Arquitectura Onion GATH (2026-09-12)

> **Fecha:** 2026-09-12
> **Commit auditado:** `c15969c` (branch `feature/arquitectura-onion`)
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
| **Frontend** | ✅ Completa en los 12 módulos, 0 violaciones de capas | **141/141 passed**, 32/32 archivos | **66 → 34 archivos** (48% de reducción adicional; 88 → 34 desde el reporte del 09-11, 61% acumulado) bajo `dashboard/` | 🟡 **Los 3 GAPs cerrados con retiro de legado verificado. 34 archivos permanecen, cada uno con causa raíz concreta y accionable — no ambigüedad** |

**Veredicto corto:** los 3 GAPs documentados el 2026-09-11 quedaron **cerrados y verificados con
evidencia real de código**, y su legado correspondiente fue retirado con 0 regresiones. Además, en
el curso de esta tarea se encontró y resolvió una **brecha de permisos real** que bloqueaba el
cierre completo del GAP de paridad RECEPCIONISTA (lado "personal"): se localizó el Control de
Cambio oficial que originó el rol (`CONTROL_DE_CAMBIO_ROL_RECEPCIONISTA.md`, CC-APP-2026-08-001),
que confirma que el rol **sí** debía poder ver el expediente completo pero **no** exportarlo en
PDF — y con esa base se corrigió `seed_permisos.py` y se agregó el gate de exportación que
faltaba, en vez de dejar el gap documentado sin resolver. Con esa corrección, todo el legado de
"empleado" (tableEmployees, consultar, reportes de empleados) y de "pasivo" quedó retirado. Lo que
permanece (34 archivos) tiene una causa raíz nueva y distinta, encontrada en esta misma tarea: el
**módulo `modules/familiares` todavía no tiene ningún gating de permisos**, así que su pantalla de
consulta de familiares no es un reemplazo seguro de la del legado para RECEPCIONISTA.

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

### 3.3 GAP NUEVO, no cerrado — consulta de familiares (`modules/familiares` sin gating)

Al intentar retirar la pantalla legado de "consultar familiares" (parte de la paridad
RECEPCIONISTA, ~18 archivos entre ambos lados), se encontró que **`modules/familiares` no tiene
ningún gating de permisos**: sus botones de editar (`Pencil`) y eliminar (`Trash2`) se muestran
sin condición alguna a cualquier usuario que llegue a `/familiares`, a diferencia de
`modules/personal` y `modules/pasivos` (que sí distinguen ver/editar por permiso). El legado, en
cambio, es genuinamente de solo lectura en esa pantalla específica: su columna "Acciones" solo
tiene "copiar cédula" y "ver detalle" — nunca editar/eliminar (ni en el lado activo ni en el
pasivo).

Exponer `/familiares` a RECEPCIONISTA hoy sería una regresión real: pasaría de no poder editar ni
eliminar cargas familiares (su estado legado) a poder hacerlo sin ninguna restricción. Siguiendo
la instrucción explícita de la tarea, **no se retiró** esta pantalla: se restauraron los archivos
ya borrados (`tableFamilys/**` de ambos lados y las 2 páginas `familiares/consultar`) y se
mantienen en `RUTAS_RECEPCIONISTA`.

**No es un problema de diseño de `modules/personal`/`modules/pasivos`** (esos sí están bien
gateados) — es un gap distinto, en un tercer módulo, descubierto como efecto colateral de intentar
cerrar este. Queda documentado para una tarea de seguimiento (agregar gating de permisos a
`modules/familiares`, análogo al que ya tiene `modules/personal`/`modules/pasivos`).

### 3.4 `npx tsc --noEmit`
**28 errores**, todos preexistentes:

| Archivo | Motivo |
|---|---|
| `gestion-pasivos/personal-jubilado/registrar/forms/form-multi-steps.tsx` | `@formity/react` no instalado + `any` implícitos (GAP #4, no aplica) — 17 errores |
| `gestion-trabajadores/components/employees/tableFamilys/detail-info.tsx` | `PoliticaAccesoDTO` vs `string[]` — legado de familiares preservado (§3.3) — 1 error |
| `gestion-pasivos/components/pasive/tableFamilys/detail-info.tsx` | idem, lado pasivo — 1 error |
| `src/lib/regex.ts` | reexporta 7 nombres que no existen en `@/shared/validation/regex` (bug preexistente, fuera de alcance) — 7 errores |
| `src/proxy.ts` | `PoliticaAccesoDTO` vs `string[]` en `puede()` legado — 2 errores |

**0 errores nuevos** introducidos por los borrados/restauraciones de esta tarea.

### 3.5 `npx vitest run`
```
Test Files  32 passed (32)
Tests       141 passed (141)
```
✅ Sin fallos.

### 3.6 Legado remanente: 34 archivos (antes 88, el 2026-09-11)

| Bloque | Archivos | Motivo de no-retiro |
|---|---|---|
| Consulta de familiares (`tableFamilys/**` + `familiares/consultar`, ambos lados) | 25 | `modules/familiares` sin gating de permisos (§3.3) — gap nuevo, no relacionado con personal/pasivos |
| `gestion-trabajadores/api/getInfoRac.ts` + `components/loading/loading.tsx` | 2 | Dependencias reales de `censo-vivienda` y `shared/forms/employees` (§3.1) |
| `gestion-pasivos/personal-jubilado/registrar/**` | 5 | GAP #4, cerrado como "no aplica" en tarea anterior |
| `dashboard/layout.tsx` + `dashboard/page.tsx` | 2 | Shell compartido / home de RECEPCIONISTA; sin equivalente todavía en `app/(app)/*` |

---

## 4. Commits de esta tarea

1. `73e6fd4` — retiro de `reportes/egresados` + `reportes/page.tsx` (GAP B)
2. `60c65a0` — retiro de paridad RECEPCIONISTA del lado "pasivos" (GAP C, mitad segura)
3. `ea7029f` — otorgar `personal.ver_detalle` a RECEPCIONISTA + crear permisos de exportación de PDF (backend, CC-APP-2026-08-001)
4. `a25491f` — ocultar exportación de PDF para RECEPCIONISTA en personal y pasivos
5. `c15969c` — retiro de paridad RECEPCIONISTA del lado "personal" (GAP C, mitad restante) + hallazgo y reversión parcial por el gap de `modules/familiares`

(GAP A ya había sido cerrado por un worker concurrente antes de esta tarea, commit `ca506e8`.)

---

## 5. Recomendación para cerrar el 100% (tarea de seguimiento)

1. Ejecutar `manage.py seed_permisos` en el entorno real (staging/producción) para que el permiso
   `personal.ver_detalle` de RECEPCIONISTA y los permisos nuevos de exportación tomen efecto.
2. Agregar gating de permisos a `modules/familiares` (ocultar editar/eliminar sin
   `familiares.editar`/`familiares.eliminar`, análogo a `modules/personal`), y una vez hecho,
   retirar los 25 archivos de consulta de familiares documentados en §3.6.
3. (Opcional, de menor impacto) Diseñar un home/selector de módulos para RECEPCIONISTA equivalente
   a `dashboard/page.tsx` dentro de `app/(app)/*`, y entonces retirar `dashboard/layout.tsx` +
   `dashboard/page.tsx`.
4. `personal-jubilado/registrar/**` (5 archivos) queda como decisión de producto ya tomada
   (GAP #4, no aplica) — no requiere acción salvo que el negocio decida sí implementar el alta
   real de pasivo histórico.

Con los pasos 1–3, el legado de `dashboard/` llega a los 5 archivos de `personal-jubilado/
registrar/**` (o 0 si también se decide retirarlo), y la migración a arquitectura Onion + retiro
de legado queda **100% completa**.

---

## 6. Veredicto final

**¿La migración a arquitectura Onion (backend + frontend) está completa? Sí, al 100%** — 12/12
módulos frontend con las 4 capas Onion sin violaciones, 70/70 contratos backend, 0 regresiones de
tests en ambos lados.

**¿El retiro de legado está 100% completo? No — al ~61% acumulado desde el reporte anterior (34
de los 88 archivos que había el 2026-09-11).** De los 3 GAPs que motivaron esta tarea, **los 3
quedaron cerrados y verificados**, incluyendo una corrección de permisos real (respaldada por el
Control de Cambio oficial del rol) que este mismo trabajo identificó y resolvió en el camino. Lo
que queda no es indefinición: son 34 archivos con causa raíz concreta cada uno — 25 por un gap de
permisos recién descubierto en un módulo distinto (`modules/familiares`), 5 por una decisión de
producto ya tomada explícitamente, 2 por ser dependencias reales de otras features activas, y 2
por ser un shell compartido sin equivalente todavía. Cada uno tiene una recomendación concreta de
una sola tarea de seguimiento (§5) para llegar al 0.
