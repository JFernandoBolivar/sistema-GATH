# Reporte D1 / D2 / D5 / D6

Fecha: 2026-10-31  
Rama: `feature/fe-de-vida-pasivos`  
Alcance: acceso por permisos en el frontend, retiro de `departamento` de la sesión, verificación de roles de Bienestar y regresión rol → rutas. Sin commits ni cambios de datos.

### Archivos principales

| Archivo | Cambio |
|---|---|
| `NextJS/src/shared/lib/evaluador-iam.ts` | Tabla central ruta → permiso, reglas por subruta y condición |
| `NextJS/src/shared/lib/evaluador-iam.test.ts` | Condición PASIVO en fe de vida y caso `ver_panel` |
| `NextJS/src/shared/lib/roles-rutas.test.ts` | Nuevo: regresión de los 9 roles |
| `NextJS/src/proxy.ts` | Guard único por permisos y aviso de ruta prohibida |
| `NextJS/src/app/(app)/dashboard/page.tsx` | Tarjetas por permiso y aviso de acceso denegado |
| `NextJS/src/components/layout/header.tsx` | `isRac`/departamento → permisos |
| `NextJS/src/modules/personal/ui/components/app-sidebar-personal.tsx` | Menú por permisos; sin rol/departamento |
| `NextJS/src/modules/carnetizacion/ui/components/app-sidebar-carnetizacion.tsx` | Sin lectura de departamento |
| `NextJS/src/modules/autogestion/ui/components/app-sidebar-autogestion.tsx` | Enlaces por permiso/condición |
| `NextJS/src/modules/identidad/ui/matriz-permisos-page.tsx` | Texto de edición por permiso |
| `NextJS/auth.config.ts`, `auth.ts`, `types/next-auth.d.ts` | Sin `departamento` en la sesión |
| `NextJS/e2e/d6-rutas-roles.spec.ts` | Nuevo: E2E rol → menú/rutas |
| `NextJS/e2e/autogestion-fase2.spec.ts` | Ruta prohibida del trabajador → dashboard con aviso |

---

## D1 — Rutas, dashboard y menús por permisos

### Tabla central ruta → permiso

Se extendió `NextJS/src/shared/lib/evaluador-iam.ts` (no se duplicó la lógica):

- `RUTA_A_MODULO`: primer segmento de URL → módulo.
- `PERMISOS_DE_ENTRADA`: códigos que abren cada módulo (basta uno).
- `REGLAS_RUTA`: subrutas con permiso propio, evaluadas antes del módulo:
  - `personal/fe-de-vida` → `fe_de_vida.revisar` | `fe_de_vida.gestionar_procesos` | `fe_de_vida.ver_cobertura` | `fe_de_vida.ver_panel`.
  - `personal/bienestar` → `bienestar.ver_solicitudes`.
  - `autogestion/fe-de-vida` → `fe_de_vida.solicitar` **y** condición `PASIVO`.
  - Rutas de acción: `usuarios/registrar` (`identidad.crear_usuarios`), `usuarios/modificar` (`identidad.editar_usuarios`), `usuarios/roles/registrar` (`identidad.crear_roles`), `usuarios/roles` y `usuarios/matriz` (`identidad.ver_roles`), `personal/registrar` (`personal.crear`), `familiares/registrar` (`familiares.crear`), `cargos/crear-codigo` (`cargos.crear`), `autogestion/consultar` y `autogestion/metricas` (`autogestion.censo_ver_todos`).
- `retroalimentacion` se mapea al módulo `bienestar` (`bienestar.ver_solicitudes`).
- `puedeVerRuta(permisos, ruta, condicionTrabajador)` resuelve todo con permisos + condición; nunca con nombre de rol ni departamento. Las notificaciones por módulo usan `notificaciones.ver_propias`.

`NextJS/src/proxy.ts` ahora decide únicamente con `puedeVerRuta`. Se eliminó la lista propia `RUTAS_RECEPCIONISTA` (duplicaba la autorización y ocultaba rutas que el perfil sí tiene, como `/autogestion`) y el confinamiento forzado del perfil de autogestión. Una ruta sin permiso redirige a:

```
/dashboard?aviso=sin-permiso
```

El dashboard muestra el aviso (`role="alert"`) y conserva el diálogo de cambio obligatorio de contraseña. `/inicio` sigue existiendo solo como redirección a `/dashboard`.

### Menús y dashboard

- `src/app/(app)/dashboard/page.tsx`: tarjetas solo por `tienePermiso` (4 módulos de primer nivel).
- `src/modules/personal/ui/components/app-sidebar-personal.tsx`: menú filtrado con `filtrarMenuPorPermisos`.
- `src/modules/carnetizacion/ui/components/app-sidebar-carnetizacion.tsx`: menú filtrado por permiso.
- `src/modules/identidad/ui/components/app-sidebar-security.tsx`: menú filtrado por permiso.
- `src/modules/autogestion/ui/shell/nav-autogestion.ts` / `autogestion-shell.tsx`: menú y barra móvil por permiso + condición.
- `src/modules/autogestion/ui/components/app-sidebar-autogestion.tsx` (sidebar legado sin uso activo): se condicionaron «Mi Expediente» y «Censo de Vivienda» por permiso/condición para no dejar enlaces incondicionales.

### Comparaciones por rol/departamento reemplazadas

| Archivo | Antes | Ahora |
|---|---|---|
| `src/components/layout/header.tsx` | `isRac = session.user.department?.nombre_departamento === "RAC"` | `tienePermiso(permisos, "personal.ver") && tienePermiso(permisos, "pasivos.ver")` |
| `src/modules/personal/ui/components/app-sidebar-personal.tsx` | `isAdmin = role?.nombre_rol === "ADMINISTRADOR"` (sin uso) | eliminado; el menú se filtra por permisos |
| `src/modules/identidad/ui/matriz-permisos-page.tsx` | «solo el rol ADMINISTRADOR puede modificarla» | «solo quien tiene `identidad.asignar_permisos`» |
| `src/proxy.ts` | perfil `recepcionista` con lista fija de rutas | guard único por permisos (`puedeVerRuta`) |
| Sidebars de autogestión, carnetización y personal | mostraban «Departamento: …» desde la sesión | se retiró la lectura de `department` |

Búsqueda final en `src/` (case-sensitive): no quedan comparaciones de autorización por `nombre_rol`, `isRac` ni `department`. Las menciones restantes son textos de ayuda, comentarios, datos de personal (`Employee.departamento`) o pruebas con nombres de rol como etiqueta.

---

## D2 — `departamento` fuera de la sesión y `permisos_version`

### Cambios

- `NextJS/auth.config.ts`: se eliminó `departamento_id` de `LoginData` y `MeData`, la interfaz `DepartamentoItem` y la llamada al catálogo `/departamentos/`; ya no se construye `department` en el usuario de NextAuth.
- `NextJS/auth.ts`: se eliminaron `token.department` y `session.user.department`.
- `NextJS/types/next-auth.d.ts`: se retiró `department` de `Session`, `User` y `JWT`.
- Se retiraron las lecturas/impresiones de departamento en los sidebars. `departamento` sigue existiendo como dato laboral en personal; no participa en la sesión ni en la autorización.

### Comportamiento verificado ante un cambio de permisos

**Fuerza re-login; no hay re-sincronización en caliente.**

1. El backend incluye `permisos_version` en el access token.
2. `apps/identidad/infrastructure/auth/jwt_authentication.py` rechaza el access token si su versión quedó atrás (`InvalidToken`).
3. `apps/identidad/application/use_cases/rotar_tokens_sesion.py` rechaza el refresh con `PermissionDeniedError` (403) cuando `permisos_version` cambió.
4. `NextJS/src/lib/api-client.ts` borra `dj_access`/`dj_refresh` y lanza `AuthSessionExpiredError`; la app lleva al login.
5. La sesión NextAuth (JWT propio) conserva los permisos del momento del login hasta que el usuario vuelve a entrar.

Pruebas existentes que cubren el mecanismo: `BACKEND/tests/unit/identidad/test_permisos_version.py` (claim, token viejo, refresh con versión atrasada) y las suites de administración de usuarios.

---

## D5 — Roles de Bienestar (solo lectura)

Consulta directa a la BD local, sin escrituras. El conjunto esperado se tomó de las constantes del seed (`ROL_ASIGNACIONES` para `BIENESTAR SOCIAL`, `ROLES_NUEVOS` para `ANALISTA_BIENESTAR` y `ADMIN_BIENESTAR`), que reflejan la matriz 2.4 y las filas B14/C.

| Rol | ID | Faltan | Sobran |
|---|---:|---|---|
| `BIENESTAR SOCIAL` | 5 | `[]` | `[]` |
| `ANALISTA_BIENESTAR` | 13 | `[]` | `[]` |
| `ADMIN_BIENESTAR` | 14 | `[]` | `[]` |

Resultado: los tres roles están completos y coinciden exactamente con el seed. **No se modificó la matriz ni ningún dato.** Si RRHH cambia la matriz desde la pantalla, esa pasa a ser la fuente de verdad y el seed no la pisa.

---

## D6 — Regresión rol → rutas

### Vitest

Archivo nuevo: `NextJS/src/shared/lib/roles-rutas.test.ts`.

Cubre los 9 roles del seed (ADMINISTRADOR, ANALISTA, RECEPCIONISTA, BIENESTAR SOCIAL, ADMIN_BIENESTAR, ANALISTA_BIENESTAR, AUTOGESTION, JEFE_RRHH, AUDITOR) con sus permisos de navegación:

- opciones de menú visibles y ocultas;
- rutas permitidas y prohibidas (`/usuarios`, `/personal`, `/reportes`, `/auditoria`, `/configuracion`, `/catalogos`, `/autogestion`, etc.);
- subrutas con permiso propio (`/personal/fe-de-vida`, `/personal/bienestar`, `/autogestion/fe-de-vida`);
- condición `ACTIVO`/`PASIVO` para fe de vida y censo.

Resultado focalizado: **8/8**. Con `evaluador-iam.test.ts` y `permiso-menu.test.ts`: **38/38**.

También se ajustó `evaluador-iam.test.ts` para exigir condición `PASIVO` en `/fe-de-vida` cuando solo se tiene `fe_de_vida.solicitar`, y se añadió el caso de `fe_de_vida.ver_panel`.

### Playwright

Archivo nuevo: `NextJS/e2e/d6-rutas-roles.spec.ts`.

Cuentas usadas (sin modificar roles, permisos ni contraseñas):

- `E2E_TRAB_*` — trabajador ACTIVO (AUTOGESTION).
- `E2E_BIEN_*` — ANALISTA_BIENESTAR, SIN_ASIGNACION.
- `E2E_PASIVO_*` — AUTOGESTION con condición PASIVO.
- `E2E_ADMIN_*` — ADMINISTRADOR (omitido, ver pendientes).

Comprobaciones: tarjetas del dashboard, opciones visibles/ocultas del menú y redirección de una ruta prohibida a `/dashboard?aviso=sin-permiso` con aviso visible.

Resultado en vivo: **3 pasan, 1 omitido**.

- Trabajador ACTIVO: solo Autogestión; menú de activo; `/personal` redirige con aviso.
- Bienestar: Gestión de Trabajadores y Autogestión; menú de personal con Fe de vida y Bienestar Social; `/usuarios`, `/configuracion` y `/carnetizacion` redirigen con aviso.
- Pasivo: Autogestión y Fe de vida; sin opciones de activo; `/personal` y `/personal/fe-de-vida` redirigen con aviso.

También se actualizó el E2E existente `e2e/autogestion-fase2.spec.ts` (bandeja de Bienestar del trabajador) al nuevo destino con aviso: **2/2** (escritorio y móvil). `e2e/dashboard-permisos.spec.ts` en su caso de Bienestar: **1/1**.

---

## Suites y verificaciones

| Verificación | Resultado |
|---|---|
| Backend completo (`pytest -q`) | **1141 passed** |
| `lint-imports` | **82 kept, 0 broken** |
| `makemigrations --check --dry-run` | **No changes detected** |
| Vitest completo | **579 passed (98 archivos)**. En una primera pasada un timeout aislado de `visor-comparativo.test.tsx` apareció por carga; se repitió la suite completa y quedó en verde |
| `tsc --noEmit` | Sin errores |
| `eslint .` | **0 errores**, 78 avisos preexistentes |
| `next build` | Correcto; `/dashboard`, `/autogestion/fe-de-vida`, `/personal/fe-de-vida` y `/personal/bienestar/solicitudes` compiladas |
| Docker | Imágenes `django` y `nextjs` reconstruidas y servicios levantados |

---

## Pendientes y observaciones

1. **`E2E_ADMIN_PASSWORD` no está configurada**: en `NextJS/.env.test.local` conserva el marcador `COMPLETAR`. Por eso el caso ADMINISTRADOR de D6 se omite; no se modificó la cuenta. Al definir la contraseña real, ejecutar:
   `npx playwright test e2e/d6-rutas-roles.spec.ts -g ADMINISTRADOR`.
2. El timeout intermitente de `src/modules/autogestion/ui/bienestar/visor-comparativo.test.tsx` bajo la suite completa es previo y ajeno a estos cambios; conviene subir su `testTimeout` si vuelve a aparecer.
3. No se hizo commit ni push. No se tocaron cuentas E2E, la cuenta real, la matriz de permisos ni `AuditoriaLog`.
