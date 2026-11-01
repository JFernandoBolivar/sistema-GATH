# Reporte R-6c — Un solo sistema de interfaz

## Corrección de alcance (vigente, 2026-10-31)

La primera entrega se pasó del alcance: rediseñó Administración del sistema, Gestión de Trabajadores, Carnetización y el login. Esta corrección deja el estado final así:

### Revertido

- Administración del sistema, Gestión de Trabajadores (personal, cargos, familiares, movimientos, organización, reportes, retroalimentación) y Carnetización vuelven a sus layouts, headers, sidebars, `PageLayout`, tabla y formularios **anteriores a R-6c**.
- Login, recuperación y restablecimiento vuelven al marco y formularios anteriores; solo se conserva `object-contain` en `logoLogin.png`.
- Se retiraron los cambios de tokens/tipografía/paginación globales de R-6c (`globals.css`, `button`, `badge`, `table`, `data-table`, `tema-provider`, `(app)/layout`).
- Se eliminó el shell nuevo `src/shared/ui/layout` y los shells por módulo que solo existían para R-6c.
- Se restauró el contenido de Autogestión (expediente, censo, consultar, métricas) que se había recoloreado.

### Conservado

- D1/D2/D5/D6: filtrado por permisos/condición en los sidebars, sin `departamento` en la sesión, proxy y evaluador intactos.
- Enlaces «Inicio» de todos los sidebars a `/dashboard`.
- Restauración de `/dashboard`.
- D3/D4/D7/D8 y G9.
- R-6b: logo sin recorte y eliminación de «Ver Detalle» del menú de `/cargos`.

### Autogestión

- Usa el **mismo shell anterior** de los demás módulos: `SidebarProvider` + `Sidebar` de shadcn + `HeaderLayout` + `main` con el mismo tratamiento.
- Conserva saludo, tarjetas de inicio, fe de vida y formularios; el sidebar mantiene ítems de 44 px y texto base 16 px.
- «Inicio» del sidebar va a `/dashboard`. Si el perfil solo tiene Autogestión (`esPerfilAutogestion`, derivado de permisos), va a `/autogestion`.
- «Mi inicio» (`/autogestion`) sigue como opción del menú.

### Capturas de la corrección

`C:\Users\josef\OneDrive\Desktop\gath-r6c-correccion-*.png`: login y recuperación (1366/390), Gestión de Trabajadores (1366/390), Autogestión (1366/390) y fe de vida del pasivo (1366/390). Administración del sistema y Carnetización no se capturaron en vivo porque `E2E_ADMIN_PASSWORD` sigue con el marcador local `COMPLETAR`; su código vuelve a los layouts/sidebars de HEAD.

### Pruebas de la corrección

- Vitest: **579 passed (98 archivos)**.
- `tsc --noEmit`: sin errores.
- `eslint .`: **0 errores** (78 avisos preexistentes).
- `next build`: correcto.
- Docker `nextjs` reconstruido y levantado antes de las pruebas.
- E2E de navegación en vivo: **3/3 pasan**, 1 omitido (ADMINISTRADOR). Comprueba el mismo shell, «Inicio» a `/dashboard`, la cuenta solo AUTOGESTION a `/autogestion` y ausencia de scroll horizontal de página a 390 px.
- No se reintrodujo axe en esta corrección: la apariencia restaurada es la previa y el toggle de tema quedó fuera por decisión del usuario.

---

Fecha: 2026-10-31  
Rama: `feature/fe-de-vida-pasivos`  
Alcance: shell compartido, tokens, navegación y componentes comunes en Administración del sistema, Gestión de Trabajadores, Carnetización y Autogestión. Sin cambios de lógica, permisos ni rutas.

> Decisión del usuario durante la tarea: **se omite el modo oscuro**. El tema queda claro por defecto, como antes; no se añadió selector de tema.

---

## 1. Auditoría antes / después

Capturas en `C:\Users\josef\OneDrive\Desktop\`:

- Antes: `gath-r6c-before-login-{1366,390}.png`, `gath-r6c-before-recuperar-{1366,390}.png`, `gath-r6c-before-autogestion-{1366,390}.png`, `gath-r6c-before-personal-1366.png`.
- Después: `gath-r6c-after-login-{1366,390}.png`, `gath-r6c-after-recuperar-{1366,390}.png`, `gath-r6c-after-autogestion-{1366,390}.png`, `gath-r6c-after-personal-1366.png`, `gath-r6c-after-consultar-{1366,390}.png`, `gath-r6c-after-fe-de-vida-{1366,390}.png`.

| Aspecto | Antes | Después |
|---|---|---|
| Shell | Autogestión con cabecera propia azul, nav lateral propio y barra inferior solo allí; el resto con shadcn + header azul distinto | Un `AppShell` en `src/shared/ui/layout` para los cuatro módulos |
| Cabecera | Título/subtítulo grandes, sin logo en el área de contenido, sin enlace «Todos los módulos» | Logo, módulo, breadcrumb, campana con últimas 4 no leídas, «Todos los módulos», cambio de contraseña y salir |
| Sidebar | Tres implementaciones con estados y footers distintos; Autogestión no usaba shadcn | Un `ModuleSidebar` colapsable, 48 px por ítem, filtrado por permisos/condición, footer con usuario y A+/A- |
| Móvil | Autogestión con barra inferior; el resto solo sidebar | Drawer shadcn + barra inferior común de 4 destinos + «Más» en todos los módulos |
| Tipografía | Source Sans 3 cargada, pero con `text-8xl`/`text-6xl`, `text-xs` y jerarquías dispares | Escala común: título 28 px, cuerpo/controles 16 px, mínimo 14 px en metadatos; A+/A- conserva 18/20 px |
| Colores | `bg-blue-900`, `bg-white`, verdes/ámbar/rojos sueltos y gradientes en bienvenida y expediente | Tokens CONATEL (`primary`, `brand-deep`, `success`, `warning`, `danger`, `info`, `muted`, superficies) |
| Espaciado | `PageLayout` era una tarjeta con `h-full`, `overflow-auto` y padding propio → scroll y márgenes anidados | `PageLayout` simple: `PageHeader` + contenido; el shell aporta ancho máximo y padding |
| Botones | Mezcla de `h-8`, `h-9`, `h-10`, `h-11` y colores sueltos | Botón base `h-11` (44 px) y texto 16 px; `sm` se reserva para tablas densas |
| Tablas | Paginación solo anterior/siguiente, texto 14 px | 16 px, filas por página 10/20/50, indicador de página y total, contenedor con scroll interno en móvil |
| Formularios | Inputs de 36/40 px y campos que se cortaban a 390 px | Inputs 44 px, 16 px en móvil; filtros apilados en una columna |
| Estados | Cargadores y errores propios por página | `VistaCargando`, `VistaError`, `VistaVacia` compartidos (p. ej. listado de personal) |
| Badges | Colores fijos por módulo (`bg-yellow-500`, `bg-[#ffc523]`, etc.) | `StatusBadge` con tono + texto (cargos, estatus de contrato) |
| Diálogos / toasts | Toaster con clases `!bg-lime-600`, `!bg-yellow-600` | Toaster por tokens de Sonner, sin colores duros |
| Login / recuperación | Formularios con texto blanco sobre tarjeta blanca y logo recortado | `AuthShell` común, formulario legible y logo con `object-contain` |

Hallazgos de R-6b incluidos:

1. `logoLogin.png` ya no se recorta: panel derecho con `object-contain`, sin `object-cover` ni posición absoluta.
2. En `/cargos` se quitó la opción «Ver Detalle» del menú «Acciones». El detalle se abre desde el propio código del cargo (enlace con foco visible), sin perder la función.

---

## 2. Decisiones de diseño (primera entrega; el shell nuevo fue revertido)

> El estado vigente es el de «Corrección de alcance». Lo que sigue documenta la primera entrega y ya no describe el código actual.

- **Un solo marco.** `AppShell` compone `ModuleSidebar`, `ModuleHeader`, contenedor de página y `MobileBottomNav`. Cada módulo aporta únicamente su lista de destinos y su contenido.
- **Navegación por permisos, no por rol.** Los menús siguen pasando por `filtrarMenuPorPermisos`; la condición ACTIVO/PASIVO se conserva para Autogestión. No se tocaron `evaluador-iam.ts` ni `permiso-menu.ts`.
- **Barra inferior común.** Se conserva la ventaja de Autogestión para pulgares y usuarios mayores y se aplica a todos los módulos: hasta 4 destinos principales visibles + «Más», que abre el mismo drawer del menú.
- **Tamaño de texto global.** El A+/A- de Autogestión se movió al footer del sidebar común; el perfil PASIVO arranca ampliado si no hay preferencia guardada.
- **Un solo `PageLayout`.** Se eliminó la tarjeta contenedora con scroll propio: el shell controla el ancho máximo (1440 px), el padding y el scroll de página.
- **Tokens.** Los nuevos componentes usan exclusivamente variables (`bg-card`, `text-muted-foreground`, `bg-primary`, `border-border`, etc.). Se limpiaron los colores duros de las pantallas de los cuatro módulos y de los componentes compartidos tocados.
- **Modo oscuro fuera de alcance.** `TemaProvider` vuelve a `defaultTheme="light"` y no hay selector de tema.
- **Login.** `AuthShell` unifica login, recuperación y restablecimiento; el logo se muestra completo.

---

## 3. Archivos principales

### Shell y layout

- `src/shared/ui/layout/app-shell.tsx` — marco único.
- `src/shared/ui/layout/app-sidebar-modulo.tsx` — sidebar compartido.
- `src/shared/ui/layout/module-header.tsx` — cabecera compartida.
- `src/shared/ui/layout/mobile-bottom-nav.tsx` — barra inferior móvil.
- `src/shared/ui/layout/nav-modulo.ts` — contrato de navegación, normalización, filtro y ruta activa.
- `src/shared/ui/layout/text-size-toggle.tsx` — A+/A- compartido.
- `src/shared/ui/layout/logout-button.tsx` — cierre de sesión con texto.
- `src/shared/ui/layout/auth-shell.tsx` — marco de pantallas públicas.
- `src/shared/ui/layout/app-shell.test.tsx` — Vitest del shell y la navegación.

### Módulos

- `src/modules/personal/ui/shell/personal-shell.tsx`
- `src/modules/carnetizacion/ui/shell/carnetizacion-shell.tsx`
- `src/modules/identidad/ui/shell/administracion-shell.tsx`
- `src/modules/autogestion/ui/shell/autogestion-shell.tsx`
- `src/modules/*/ui/components/app-sidebar-*.tsx` — ahora solo datos de navegación.

### Rutas y páginas

- Layouts de `personal`, `reportes`, `cargos`, `familiares`, `movimientos`, `organizacion`, `retroalimentacion`, `carnetizacion`, `usuarios`, `configuracion`, `auditoria` y `autogestion`.
- `src/app/(app)/personal/page.tsx` — bienvenida responsive con tokens.
- `src/app/(auth)/login/page.tsx`, `recuperar-password/page.tsx`, `restablecer-password/page.tsx` — `AuthShell`.
- `src/components/layout/page-layout.tsx` — contenedor simple.
- `src/app/(app)/layout.tsx` — toasts por tokens.

### Componentes y tokens

- `src/shared/ui/components/data-table.tsx` — paginación y filas por página.
- `src/shared/ui/components/status-badge.tsx` — usado en cargos y personal.
- `src/components/ui/table.tsx`, `button.tsx`, `badge.tsx`, `input.tsx` — escala legible.
- `src/app/globals.css` — tokens de sombra/espacio y tokens institucionales.
- `src/shared/ui/components/tema-provider.tsx` — tema claro por defecto.

### E2E

- `NextJS/e2e/r6c-navegacion.spec.ts` — navegación, 1366/390, sin scroll horizontal de página y axe.
- `NextJS/e2e/autogestion-fase2.spec.ts` — se mantiene el flujo existente.

---

## 4. Pruebas

| Verificación | Resultado |
|---|---|
| Vitest completo | **583 passed (99 archivos)** |
| Vitest del shell | **4/4** (`app-shell.test.tsx`) |
| `tsc --noEmit` | Sin errores |
| `eslint .` | **0 errores**; avisos preexistentes |
| `next build` | Correcto (75 rutas, incluida `/autogestion`, `/personal`, `/carnetizacion`, `/usuarios`) |
| E2E R-6c en vivo (3001) | **3/3 pasan**, 1 omitido (ADMINISTRADOR) |
| Axe en módulos (R-6c) | Sin violaciones `serious`/`critical` |
| Scroll horizontal de página a 390 px | Sin desborde en Autogestión y Gestión de Trabajadores |
| Docker | `nextjs` reconstruido y levantado antes de las pruebas |

El E2E del administrador se omite porque `E2E_ADMIN_PASSWORD` sigue con el marcador local `COMPLETAR`; no se modificó la cuenta. Con esa credencial configurada, el mismo spec cubre `/usuarios`, `/personal`, `/carnetizacion` y `/autogestion` a 1366 y 390 px.

---

## 5. Pendientes y límites

1. Configurar `E2E_ADMIN_PASSWORD` para ejecutar las capturas y el axe de Administración del sistema y Carnetización en vivo.
2. Las tablas conservan scroll horizontal **interno** en 390 px (patrón indicado por la skill mobile-first); la página no desborda.
3. El modo oscuro se omitió por decisión del usuario; los tokens `.dark` existentes no se probaron en esta entrega.
4. No se hizo commit ni push. No se tocaron cuentas, permisos, rutas ni la lógica de negocio.
