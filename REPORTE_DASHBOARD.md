# Reporte — Restauración del dashboard original (corrección de G7)

Fecha: 2026-11-01. Rama `feature/fe-de-vida-pasivos`. Sin commit ni push.

Alcance: restaurar `/dashboard` como pantalla principal del sistema y retirar
`/inicio`, conservando sus tarjetas con imágenes y el diálogo obligatorio de
cambio de contraseña. No se modificaron ni revirtieron los cambios pendientes de
otras tareas.

## Archivos restaurados y cambiados

**Restaurados desde `2bff215^`**
- `NextJS/src/app/(protected)/dashboard/page.tsx` → adaptado a
  `NextJS/src/app/(app)/dashboard/page.tsx`.
- `NextJS/src/app/(protected)/dashboard/layout.tsx` → adaptado a
  `NextJS/src/app/(app)/dashboard/layout.tsx`. El `SessionProvider` y el
  `Toaster` del layout original ya viven en `src/app/(app)/layout.tsx`; el
  layout del dashboard conserva el contenedor visual y evita duplicar
  proveedores/toasts.

**Eliminado**
- `NextJS/src/app/(app)/inicio/page.tsx` (y su carpeta). Se verificó con grep
  que no quedaran imports de esa página.

**Rutas y navegación**
- `src/modules/auth/ui/login-form.tsx`: tras el login redirige a `/dashboard`.
- `src/proxy.ts`: `RUTA_INICIO = "/dashboard"`; `/inicio` redirige a
  `/dashboard`; se eliminó la redirección inversa `/dashboard → /inicio`.
  AUTOGESTION sigue yendo a `/autogestion`; RECEPCIONISTA a `/dashboard`.
- `src/app/(app)/app-nav.tsx`, `src/components/layout/header.tsx`,
  `autogestion-shell.tsx`, `app-sidebar-autogestion.tsx`,
  `app-sidebar-carnetizacion.tsx`, `app-sidebar-security.tsx` y
  `app-sidebar-personal.tsx`: enlaces de inicio/todos los módulos a
  `/dashboard`.
- `src/shared/lib/evaluador-iam.test.ts`: la ruta abierta de prueba pasó a
  `/dashboard`.

**E2E**
- `e2e/rutas-legado.spec.ts`: `/inicio` redirige a `/dashboard` y el dashboard
  muestra los módulos.
- `e2e/auth-sesion.spec.ts` y `e2e/autogestion-redesign.spec.ts`: el login cae
  en `/dashboard`.
- `e2e/administracion-sistema.spec.ts`: el módulo se comprueba desde el
  dashboard.
- `e2e/smoke.spec.ts`: se prueba `/dashboard` en lugar de `/inicio`.
- Nuevo `e2e/dashboard-permisos.spec.ts`: tarjetas del administrador, perfil de
  Bienestar sin la tarjeta de Administración y capturas.

## Módulos y permisos

Solo se muestran los **cuatro módulos de primer nivel**. Cargos, Familiares,
Organización, Movimientos, Pasivos, Reportes y Catálogos son apartados internos
del módulo Gestión de Trabajadores y no tarjetas del dashboard.

| Tarjeta | Ruta | Permiso | Imagen |
|---|---|---|---|
| Administración del sistema | `/usuarios` | `identidad.ver_usuarios` | `seguridad.jpg` |
| Gestión de Trabajadores | `/personal` | `personal.ver` | `datos.jpg` |
| Carnetización | `/carnetizacion` | `carnetizacion.ver` | `carnetizacion.png` |
| Autogestión | `/autogestion` | `autogestion.ver_propio` | `datos.jpg` |

Se muestran con `tienePermiso(session.user.permisos, permiso)`. No faltó ninguna
imagen: se reutilizaron las existentes en `public/images/departments/`.
El diálogo de cambio de contraseña obligatorio se conserva mediante
`src/modules/auth/ui/cambiar-password-dialog.tsx` (modo obligatorio, no
descartable), ya usado por la pantalla anterior.

## Pruebas

| Verificación | Resultado |
|---|---|
| Vitest | **97 archivos / 571 pruebas** |
| `tsc --noEmit` | sin errores |
| `eslint .` | 0 errores (79 avisos preexistentes) |
| `next build` | OK; incluye `/dashboard` y ya no genera `/inicio` |
| E2E dashboard | **3/3** (admin, Bienestar, capturas) |
| E2E rutas legadas | **3/3** |
| E2E sesión | **4/4** |
| E2E Administración del sistema | **4/4** |
| E2E smoke | 17 pasadas, 1 omitida |

## Verificación en vivo

Se reconstruyó y levantó `nextjs`, se inició sesión con la cuenta E2E de
administración y se verificó:

- `/dashboard` muestra las cuatro tarjetas de primer nivel del administrador y el diálogo de
  contraseña cuando corresponde.
- `/inicio` redirige a `/dashboard`.
- El perfil de Bienestar ve Gestión de Trabajadores y Autogestión, y **no** ve
  Administración del sistema ni Carnetización.
- Capturas guardadas en el escritorio:
  - `C:\Users\josef\OneDrive\Desktop\gath-dashboard-escritorio.png`
  - `C:\Users\josef\OneDrive\Desktop\gath-dashboard-390.png`

La vista de 390 px conserva una columna y las tarjetas con su imagen.

## Pendientes

- Ninguno de esta corrección.
- El plan G7 queda anotado con «/dashboard restaurado como pantalla principal;
  /inicio eliminado».
