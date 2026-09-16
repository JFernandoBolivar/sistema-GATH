# Auditoría de Calidad y Arquitectura — Frontend Next.js GATH (2026-09-15)

> **Alcance:** `NextJS/` completo (12 módulos en `src/modules/`, `src/shared/`, `src/app/`, middleware y configuración), branch `feature/arquitectura-onion`.
> **Naturaleza:** auditoría de **solo lectura / diagnóstico** — ningún archivo de código del sistema fue modificado (únicamente este reporte).
> **Estándar de referencia:**
> 1. Los 8 skills propios de frontend en `NextJS/.claude/skills/`:
>    - `arquitecto-scream-feature-onion` (Reglas R1–R16, 4 capas Onion, contratos C-1 a C-6, zero-trust, DTOs).
>    - `patrones-implementacion-frontend` (react-hook-form + Zod, wrappers de campo, PBAC `tienePermiso`, useTransition, revalidación).
>    - `validacion-input-protegido` (zero-trust obligatorio en Server Actions, regex centralizadas, sanitización, prevención de XSS).
>    - `testing-unit-vitest` (R11: pruebas co-localizadas, contratos de respuesta C-1/C-2/C-6, cobertura de casos de uso).
>    - `testing-a11y-axe` (WCAG 2.1 AA, labels accesibles, contraste, navegación por teclado).
>    - `design-taste-frontend` (diseño intencional, anti-slop, jerarquía tipográfica, densidad de información).
>    - `mobile-first-design` (tablas `overflow-x-auto`, touch targets >= 44px, layouts fluidos, sin `h-screen`).
>    - `formato-prettier` (R14: consistencia de formato de código, integración ESLint + Prettier).
> 2. Los skills transversales en `BACKEND/.claude/skills/`:
>    - `ponytail-audit` (auditoría repo-wide de sobre-ingeniería, código muerto, dependencias innecesarias, abstracciones especulativas, reinvención de stdlib/plataforma con tags `delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`).
>    - `api-security-testing` & `application-security-testing` (auditoría de vectores AppSec, OWASP Top 10 y OWASP API Security 2023: BOLA/IDOR, BFLA, asignación masiva, inyección XSS, cookies y transporte).
>
> **Método:** inspección estática profunda de código fuente en los 12 módulos, análisis de dependencias de `package.json`, trazabilidad de datos desde Server Actions a la UI, búsqueda de patrones de riesgo (XSS, `dangerouslySetInnerHTML`, imports pesados, omisión de permisos), y ejecución de herramientas automatizadas (`npx tsc --noEmit`, `npx vitest run`, `npx eslint src/modules/`, `npx prettier --check`).

---

## 1. Resumen Ejecutivo

| Severidad | Cantidad | Descripción sintética |
|---|:---:|---|
| 🔴 **Crítico** | **0 activos** (2 resueltos) | ✅ **C1 RESUELTO** (Commit `993fe63`): DOM-XSS mitigado con `CarnetVistaPrevia` React nativo y `escapeHtml`.<br>✅ **C2 RESUELTO** (Commit `d380c15`): Zero-Trust implementado en `subirPlantillaCarnetAction` con Zod (límite 5MB, rechazo SVG). |
| 🟠 **Alto** | **5** | Violación de capa Onion (UI importa Domain en `reportes`); Type mismatch en `proxy.ts` bloquea compilación; Import estático pesado de `@react-pdf/renderer` impacta bundle de `/personal`; 8 de 11 módulos omiten PBAC en UI; Componentes `shared/ui` acoplados al legado. |
| 🟡 **Medio** | **7** | Tablas truncadas en móviles (`overflow-hidden` vs `overflow-x-auto`); Botones con solo icono sin nombre accesible y < 44px; Duplicación de código en Sheets de detalle; `form.watch()` degrada render en formularios; `setState` sincrónico en `useEffect`; Schemas Zod sin regex de formato; Uso de `any` en repositorios. |
| ⚪ **Bajo** | **6** | Inconsistencias de nomenclatura de archivos/esquemas; Interfaces vacías en DTOs; Imports y variables no utilizadas; 111 archivos con diferencias de formato Prettier; 28 errores de TypeScript en legado/e2e/proxy; Doble ubicación de regex compartidas. |

### Estado de Contratos y Herramientas Automatizadas

- **TypeScript (`npx tsc --noEmit`):**
  - **Nueva Arquitectura (`src/modules/*` y `src/shared/*`): 0 ERRORES.** La tipificación interna y los contratos entre capas compilan limpiamente.
  - **Proyecto Global: 28 errores** en 4 archivos fuera de los módulos (`e2e/smoke.spec.ts` [2], legado `dashboard/gestion-pasivos/` [15], `src/lib/regex.ts` [7], y `src/proxy.ts` [4]).
- **Vitest (`npx vitest run`):**
  - **180/180 tests pasados (100% éxito)** en 42 archivos de prueba (incluye 18 nuevos tests de PBAC y seguridad para C1, C2 y A4).
- **ESLint (`npx eslint src/modules/`):**
  - **49 observaciones:** 24 errores (principalmente deshabilitación de reglas de React Compiler por `form.watch`, `setState` en efectos, interfaces vacías y `@typescript-eslint/no-explicit-any`) y 25 advertencias (variables e imports sin uso).
- **Prettier (`npx prettier --check "src/modules/**/*.{ts,tsx}"`):**
  - **111 archivos** presentan discrepancias de estilo/formato respecto a la regla R14 debido a la ausencia de un hook de formateo automatizado en CI/pre-commit.

---

## 2. Matriz de Cumplimiento por Módulo (12 Módulos)

| Módulo | Capas Onion (R1-R5) | Zero-Trust Actions (R7) | PBAC en UI (R16) | A11y / Labels | Mobile-First Tables | Tests Unitarios | Estado General |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. auth** | ✅ Cumple | ✅ `safeParse` | N/A (Público) | ✅ Completo | N/A | ✅ 4 tests (1 archivo) | 🟢 Robusto |
| **2. autogestion** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` (`27574bc`) | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 9 tests (4 archivos) | 🟢 **Aceptable (PBAC Resuelto)** |
| **3. cargos** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` (`c7bd8b2`) | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 11 tests (3 archivos) | 🟢 **Aceptable (PBAC Resuelto)** |
| **4. carnetizacion** | ✅ Cumple | ✅ `safeParse` (`d380c15`) | ✅ `tienePermiso` (`d6e6904`) | ⚠️ Botones icono | N/A | ✅ 30 tests (5 archivos) | 🟢 **Aceptable (C1, C2 y PBAC Resueltos)** |
| **5. catalogos** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` (`b24bdbc`) | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 23 tests (4 archivos) | 🟢 **Aceptable (PBAC Resuelto)** |
| **6. familiares** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 8 tests (2 archivos) | 🟢 Aceptable |
| **7. identidad** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` (`0fecdca`) | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 8 tests (2 archivos) | 🟢 **Aceptable (PBAC Resuelto)** |
| **8. movimientos** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` (`faa8b9d`) | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 14 tests (3 archivos) | 🟢 **Aceptable (PBAC Resuelto)** |
| **9. organizacion** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` (`6827fac`) | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 8 tests (2 archivos) | 🟢 **Aceptable (PBAC Resuelto)** |
| **10. pasivos** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 15 tests (3 archivos) | 🟢 Aceptable |
| **11. personal** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 28 tests (6 archivos) | 🟠 **Alto (Bundle PDF)** |
| **12. reportes** | 🔴 Violación (A1) | ✅ `safeParse` | ✅ `tienePermiso` (`0dfb1f4`) | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 13 tests (4 archivos) | 🟠 **Alto (Onion Layer)** |

---

## 3. Hallazgos Críticos 🔴

### C1 — [RESUELTO — Commit 993fe63] Vulnerabilidad DOM-XSS en Diseñador de Carnetización vía `dangerouslySetInnerHTML`
- **Estado:** ✅ **RESUELTO** (Commit `993fe63` - `fix(carnetizacion): mitigar DOM-XSS reemplazando dangerouslySetInnerHTML con CarnetVistaPrevia nativo y escapeHtml`).
- **Archivos y Líneas Modificados:**
  - `NextJS/src/modules/carnetizacion/ui/components/carnet-vista-previa.tsx` (Nuevo componente React nativo)
  - `NextJS/src/modules/carnetizacion/ui/components/disenador-carnet.tsx:507` (Reemplazo de `dangerouslySetInnerHTML`)
  - `NextJS/src/modules/carnetizacion/application/use-cases/disenar-carnet.ts:35-130` (Añadidas utilidades `escapeHtml` y `sanitizeUrl`)
  - `NextJS/src/modules/carnetizacion/application/use-cases/disenar-carnet.test.ts` (5 tests de seguridad y sanitización)
  - `NextJS/src/modules/carnetizacion/ui/components/carnet-vista-previa.test.tsx` (4 tests de renderizado seguro y bloqueo de `javascript:`)
- **Regla Violada:** `validacion-input-protegido` §6 (Sanitización y Prevención de Inyección/XSS) / OWASP Top 10 A03:2021-Injection / `web-app-penetration-testing`.
- **Detalle del Defecto Original:**
  El caso de uso `generarHtmlVistaPrevia` tomaba como entrada el DTO `DisenoCarnetDTO` y realizaba concatenación directa en una plantilla HTML cruda (`string`):
  ```typescript
  // disenar-carnet.ts:100-112
  <div style="font-size: 16px; font-weight: bold; color: ${colorTexto};">${datos.nombreCompleto}</div>
  <div style="font-size: 13px; color: ${colorSecundario};">${datos.cargo}</div>
  ```
  Luego, el componente cliente `disenador-carnet.tsx` inyectaba este HTML directamente en el DOM mediante `dangerouslySetInnerHTML={{ __html: htmlPreview }}` sin sanitización.
- **Remediación Aplicada:**
  1. Se creó el componente declarativo `<CarnetVistaPrevia />` utilizando JSX nativo con posicionamiento absoluto sobre la plantilla, beneficiándose del auto-escape automático de React contra XSS.
  2. Se implementó `sanitizeUrl` para bloquear esquemas maliciosos como `javascript:` o `vbscript:` en `fotoUrl` y `plantillaUrl`.
  3. En `disenar-carnet.ts`, se incorporó `escapeHtml()` para codificar entidades HTML en `generarHtmlVistaPrevia` y `sanitizeUrl()` en las imágenes.
  4. Se eliminó completamente `dangerouslySetInnerHTML` de `disenador-carnet.tsx`.

---

### C2 — [RESUELTO — Commit d380c15] Bypass de Validación Zero-Trust en Server Action `subirPlantillaCarnetAction`
- **Estado:** ✅ **RESUELTO** (Commit `d380c15` - `fix(carnetizacion): implementar validacion zero-trust con Zod en subirPlantillaCarnetAction (limite 5MB, rechazo SVG)`).
- **Archivos y Líneas Modificados:**
  - `NextJS/src/modules/carnetizacion/ui/schema/schema-carnet.ts` (Nuevo esquema Zod `subirPlantillaCarnetSchema`)
  - `NextJS/src/modules/carnetizacion/infrastructure/actions/carnetizacion-actions.ts:119-140` (Validación con `safeParse`)
  - `NextJS/src/modules/carnetizacion/ui/schema/schema-carnet.test.ts` (6 tests unitarios de validación de archivo y tipos MIME)
- **Regla Violada:** `validacion-input-protegido` §3 ("Toda Server Action DEBE validar su entrada con safeParse de Zod") y `arquitecto-scream-feature-onion` R1, R7.
- **Detalle del Defecto Original:**
  Mientras que las demás Server Actions implementaban validación estricta con `safeParse(rawData)` antes de procesar cualquier llamada, `subirPlantillaCarnetAction` recibía parámetros posicionales no estructurados (`nombre: string, imagen: File, activar = false`) y delegaba directamente al repositorio sin validar tamaño ni tipo de archivo.
- **Remediación Aplicada:**
  1. Se definió `subirPlantillaCarnetSchema` en `schema-carnet.ts` validando:
     - Nombre: `REGEX.NO_HTML`, longitud 2-100 caracteres.
     - Imagen: instancia de `File`, tamaño > 0 y <= 5MB (`5 * 1024 * 1024`), tipos MIME estrictos (`image/png`, `image/jpeg`, `image/jpg`), y rechazo explícito de `image/svg+xml`.
     - Activar: booleano opcional.
  2. En `subirPlantillaCarnetAction`, se incorporó `subirPlantillaCarnetSchema.safeParse({ nombre, imagen, activar })` al inicio de la acción, retornando mensaje de error estructurado ante fallos de validación.

---

## 4. Hallazgos Altos 🟠

### A1 — Violación Directa de Capas Onion: Capa UI Importa Directamente desde Capa Domain
- **Archivo y Línea:** `NextJS/src/modules/reportes/ui/reportes-page.tsx:44`
- **Regla Violada:** `arquitecto-scream-feature-onion` R3 ("UI NUNCA importa directamente de Domain") y R5 ("Las capas exteriores no se comunican con interiores saltándose la intermedia").
- **Detalle del Defecto:**
  En `reportes-page.tsx:44`:
  ```typescript
  import type { TipoReportePersonal } from "../domain/value-objects/tipo-reporte-vo";
  ```
  La capa `ui/` tiene prohibido por arquitectura acceder a `domain/`. La comunicación debe fluir siempre a través de la capa `application/` mediante DTOs, o mediante esquemas locales en `ui/schema/`.
- **Sugerencia de Solución:**
  Exportar el tipo necesario dentro de `NextJS/src/modules/reportes/application/dtos/reporte-dto.ts` o tiparlo dentro del esquema `NextJS/src/modules/reportes/ui/schema/schema-reporte.ts`, y reemplazar la importación en `reportes-page.tsx`.

---

### A2 — Incompatibilidad de Tipos en Middleware Bloquea Compilación (`proxy.ts`)
- **Archivo y Líneas:** `NextJS/src/proxy.ts:18, 22`
- **Regla Violada:** Contrato de tipos de `shared/lib/evaluador-iam.ts` y compilación estricta TypeScript (`tsc`).
- **Detalle del Defecto:**
  En `proxy.ts`, el middleware invoca:
  ```typescript
  // proxy.ts:18
  if (!puede(permisos, "personal.listar")) ...
  // proxy.ts:22
  if (!puede(permisos, "identidad.listar")) ...
  ```
  Donde `permisos` es un arreglo plano de strings (`string[] | undefined`).
  Sin embargo, la firma de `puede` en `evaluador-iam.ts` es:
  `puede(politica: PoliticaAccesoDTO | undefined, accion: AccionIAM): boolean`, esperando un objeto estructurado `{ allow: ReglaPermisoDTO[], deny?: ReglaPermisoDTO[] }`.
  La función diseñada específicamente para evaluar arreglos de permisos como strings es `tienePermiso(permisos: string[] | PermisoCodigoDTO[] | undefined, codigo: string)`. Esto genera 4 errores de compilador en `tsc --noEmit`.
- **Sugerencia de Solución:**
  Cambiar la importación y llamada en `proxy.ts` de `puede` a `tienePermiso(permisos, "personal.listar")`.

---

### A3 — Impacto Severo en Bundle Size / Performance por Import Estático de `@react-pdf/renderer`
- **Archivo y Línea:** `NextJS/src/modules/personal/ui/personal-page.tsx:36`
- **Regla Violada:** `mobile-first-design` §Performance ("Evitar dependencias pesadas en el bundle inicial") y `patrones-implementacion-frontend` §Carga de PDFs.
- **Detalle del Defecto:**
  En `personal-page.tsx:36`:
  ```typescript
  import { EmpleadoDetallePdf } from "./empleado-detalle-pdf";
  ```
  A pesar de que la función `onExportarPdf` (línea 131) realiza una importación dinámica de `{ pdf } from "@react-pdf/renderer"`, la importación estática de `EmpleadoDetallePdf` en la cabecera del archivo cliente arrastra todo el motor `@react-pdf/renderer` (un paquete de más de 3.5 MB sin comprimir que incluye polyfills de Yoga layout, PDF fonts y canvas) dentro del bundle JavaScript principal de la página `/personal`.
  En contraste, el módulo `pasivos` (`pasivos/ui/detalle-pasivo.tsx:55`) resuelve esto correctamente mediante `next/dynamic`.
- **Sugerencia de Solución:**
  Cargar dinámicamente el componente PDF solo en el momento de generar el documento:
  ```typescript
  const { EmpleadoDetallePdf } = await import("./empleado-detalle-pdf");
  ```
  o mediante `dynamic(() => import("./empleado-detalle-pdf"), { ssr: false })`.

---

### A4 — [RESUELTO — Commits c7bd8b2..0dfb1f4] Control de Acceso PBAC en UI Implementado en los 8 Módulos
- **Estado:** ✅ **RESUELTO** (Commits atómicos por módulo: `c7bd8b2`, `6827fac`, `b24bdbc`, `d6e6904`, `0fecdca`, `faa8b9d`, `27574bc`, `0dfb1f4`).
- **Archivos Modificados y Commits:**
  1. `cargos` (`c7bd8b2`): `cargos-page.tsx`, `cargo-crear-page.tsx`, `cargos-columns.tsx`, `cargos-columns.test.ts` (gating de `cargos.crear`, `cargos.ver`, `cargos.editar`, etc.).
  2. `organizacion` (`6827fac`): `organizacion-page.tsx`, `organismo-admin.tsx`, `dependencia-admin.tsx`, `direccion-general-admin.tsx`, `direccion-linea-admin.tsx`, `coordinacion-admin.tsx`, `organizacion-pbac.test.ts` (gating de `organizacion.crear`, `organizacion.editar`, `organizacion.eliminar`).
  3. `catalogos` (`b24bdbc`): `catalogos-page.tsx`, `catalogos-columns.tsx`, `catalogos-columns.test.ts` (gating de `catalogos.crear`, `catalogos.editar`, `catalogos.eliminar`).
  4. `carnetizacion` (`d6e6904`): `carnetizacion-page.tsx`, `carnetizacion-columnas.tsx`, `carnetizacion-columnas.test.ts` (gating de `carnetizacion.disenar`, `carnetizacion.emitir`, `carnetizacion.revocar`, `carnetizacion.reimprimir`).
  5. `identidad` (`0fecdca`): `usuarios-page.tsx`, `usuarios-columns.tsx`, `usuario-registrar-page.tsx`, `identidad-pbac.test.ts` (gating de `identidad.crear_usuarios`, `identidad.editar_usuarios`, `identidad.desactivar_usuarios`, `identidad.ver_roles`, `identidad.crear_roles`, `identidad.editar_roles`, `identidad.eliminar_roles`, `identidad.asignar_permisos`).
  6. `movimientos` (`faa8b9d`): `movimientos-page.tsx`, `movimientos-columns.tsx`, `movimientos-pbac.test.ts` (gating de `movimientos.ver`).
  7. `autogestion` (`27574bc`): `autogestion-page.tsx`, `autogestion-pbac.test.ts` (gating de `autogestion.censo_ver_todos`, `autogestion.censo_exportar`, `autogestion.censo_actualizar_propio`).
  8. `reportes` (`0dfb1f4`): `reportes-page.tsx`, `reportes-pbac.test.ts` (gating de `reportes.ver`, `reportes.generar_pdf`, `reportes.generar_excel`, `reportes.estadisticas`).
- **Regla Cumplida:** `patrones-implementacion-frontend` §PBAC, `arquitecto-scream-feature-onion` R16 ("Permisos siempre por código `[modulo].[accion]`"), y OWASP API5:2023 (Broken Function Level Authorization). Defend-in-depth con UI limpia para roles sin privilegios administrativos.

---

### A5 — Componentes Base de UI Compartidos (`shared/ui/components`) son Proxies Acoplados al Legado
- **Archivos:** Los 43 archivos dentro de `NextJS/src/shared/ui/components/*.tsx` (ej. `button.tsx`, `dialog.tsx`, `table.tsx`, `card.tsx`, `sheet.tsx`).
- **Regla Violada:** `arquitecto-scream-feature-onion` R10 ("`shared/ui` debe contener componentes autónomos desacoplados del legado").
- **Detalle del Defecto:**
  Cada uno de los 43 componentes en `shared/ui/components/` consiste exclusivamente en una línea de re-exportación:
  ```typescript
  // shared/ui/components/button.tsx
  export * from "@/components/ui/button";
  ```
  Esto crea una dependencia directa y frágil entre el núcleo de la nueva arquitectura (`src/shared/`) y la carpeta de componentes del diseño legado (`src/components/ui/`). Si en el futuro se elimina la carpeta de dashboard legado para limpiar deuda técnica, todos los módulos de la nueva arquitectura colapsarían al instante.
- **Sugerencia de Solución:**
  Copiar/migrar el código fuente real de los componentes primitives de `@radix-ui` y Tailwind directamente a `src/shared/ui/components/`, convirtiéndolos en componentes autónomos sin dependencias hacia `@/components/ui/`.

---

## 5. Hallazgos Medios 🟡

### M1 — Defecto Sistémico de Diseño Mobile-First en Tablas de Datos (`overflow-hidden` vs `overflow-x-auto`)
- **Archivos y Líneas:**
  - `personal-page.tsx:599`
  - `reportes-page.tsx:263, 302, 337, 370`
  - `cargos-page.tsx:523, 624, 700`
  - `pasivos-page.tsx:314`
  - `organizacion-page.tsx:179, 268, 358`
  - `autogestion-page.tsx:201, 273`
  - `usuarios-page.tsx:534`
- **Regla Violada:** `mobile-first-design` §Tablas Responsive ("Toda tabla DEBE estar dentro de un contenedor con `overflow-x-auto`").
- **Detalle:**
  En casi todos los módulos, el contenedor exterior de `<Table>` tiene la clase `overflow-hidden rounded-lg border`. En pantallas móviles (viewport < 768px), las tablas que tienen entre 6 y 10 columnas se desbordan de la pantalla; `overflow-hidden` recorta los datos y esconde las columnas de acciones a la derecha sin permitir desplazamiento horizontal ni ofrecer vista colapsable tipo tarjetas.
- **Sugerencia:**
  Cambiar `<div className="overflow-hidden rounded-lg border">` por `<div className="w-full overflow-x-auto rounded-lg border">` en todas las tablas de datos.

---

### M2 — Botones con Solo Ícono Carecen de Nombre Accesible y Violan Área Táctil Mínima
- **Archivos y Líneas:**
  - `personal-page.tsx:486, 509, 528, 546, 565, 627, 631, 632`
  - `cargos-page.tsx:722`
  - `familiares-page.tsx:274, 277`
  - `organizacion-page.tsx:194, 195, 284, 285`
  - `usuarios-page.tsx:451, 516, 517`
- **Regla Violada:** `testing-a11y-axe` (WCAG 2.1 criterio 4.1.2 Name, Role, Value) y `mobile-first-design` §Touch Targets (mínimo 44×44px).
- **Detalle:**
  Se utilizan botones de acción tipo `<Button variant="ghost" size="sm"><Pencil className="h-4 w-4" /></Button>`. No poseen atributo `aria-label`, ni `title`, ni un elemento hijo `<span className="sr-only">`. Un lector de pantalla anuncia simplemente "botón", sin indicar qué hace ni sobre qué registro opera. Además, `size="sm"` genera un target de 32×32px, por debajo del umbral mínimo de 44px para interacción táctil en dispositivos móviles.
- **Sugerencia:**
  Agregar `aria-label` descriptivo (ej. `aria-label={`Editar ${item.nombre}`}`) o `<span className="sr-only">Editar</span>`, y aplicar clases responsivas para el target táctil (`min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0`).

---

### M3 — Duplicación Innecesaria de Código en Paneles de Detalle (Sheets de Personal, Pasivos y Familiares)
- **Archivos:**
  - `personal/ui/empleado-detalle-sheet.tsx`
  - `pasivos/ui/detalle-pasivo.tsx`
  - `familiares/ui/detalle-familiar.tsx`
- **Regla Violada:** Principio DRY, `arquitecto-scream-feature-onion` §Componentes Compartidos y `ponytail-audit`.
- **Detalle:**
  Existe código duplicado casi idéntico entre estos tres paneles:
  1. Componente auxiliar `FilaInfo({ etiqueta, valor })`: redefinido en `empleado-detalle-sheet.tsx:51-58`, e implementado con repetición manual de divs `<div className="text-muted-foreground">...</div><div>...</div>` más de 70 veces en `detalle-pasivo.tsx` y `detalle-familiar.tsx`.
  2. Función de formateo de fecha: repetida con 3 mecanismos distintos en los 3 módulos (`formatInTimeZone`, `toLocaleDateString`, `Intl.DateTimeFormat`).
  3. Sección de metadatos de auditoría y encabezados de expediente repetidos idénticamente.
- **Sugerencia:**
  Extraer `FilaInfo` a `NextJS/src/shared/ui/components/info-row.tsx` y centralizar los formateadores de fecha en `NextJS/src/shared/lib/formatters.ts`.

---

### M4 — Llamadas a `form.watch()` en el Cuerpo del Render Degradan Optimización y Provocan Renders Globales
- **Archivos y Líneas:**
  - `organizacion-page.tsx:657`
  - `pasivos-page.tsx:227`
  - `cargos-page.tsx:398`
  - `catalogos-page.tsx:224`
  - `usuarios-page.tsx:322`
- **Regla Violada:** `patrones-implementacion-frontend` §Formularios y directrices de React 19 / React Compiler.
- **Detalle:**
  En estos componentes se invoca `const valor = form.watch("campo")` en el nivel superior del componente de página principal. Cada tipeo o interacción en ese campo invalida el árbol completo de la página, forzando re-renders innecesarios de tablas y filtros. ESLint reporta advertencias directas de React Compiler recomendando mover la suscripción al hook especializado `useWatch`.
- **Sugerencia:**
  Reemplazar por `const valor = useWatch({ control: form.control, name: "campo" })` encapsulado dentro de los subcomponentes del formulario.

---

### M5 — Invocación Sincrónica de `setState` dentro de `useEffect` en `detalle-pasivo.tsx`
- **Archivo y Línea:** `NextJS/src/modules/pasivos/ui/detalle-pasivo.tsx:84`
- **Regla Violada:** Reglas de ciclo de vida de React / ESLint `react-hooks/set-state-in-effect`.
- **Detalle:**
  En `detalle-pasivo.tsx`:
  ```typescript
  useEffect(() => {
    if (abierto && pasivoId) {
      setCargando(true); // Actualización de estado síncrona en el ciclo de montaje del efecto
      cargarDetalle(pasivoId);
    }
  }, [abierto, pasivoId]);
  ```
  Esto dispara un re-render en cascada inmediatamente tras el montaje inicial del componente.
- **Sugerencia:**
  Iniciar el estado `cargando` en `true` condicionalmente o activar `setCargando(true)` en el controlador de eventos que abre el Sheet.

---

### M6 — Esquemas Zod de Formularios Carecen de Validación de Formato con Expresiones Regulares
- **Archivos y Líneas:**
  - `NextJS/src/modules/catalogos/ui/schema/schema-catalogos.ts:62, 70, 79, 88`
  - `NextJS/src/modules/organizacion/ui/schema/schema-organizacion.ts:16, 22`
- **Regla Violada:** `validacion-input-protegido` §0 y §2 ("Todo string DEBE estar restringido por una regex predefinida").
- **Detalle:**
  Varios campos de texto (ej. nombres de patologías, alergias, sedes, ubicaciones) solo aplican restricciones de longitud: `z.string().min(2).max(100)`. Carecen de `.regex(REGEX.SAFE_TEXT)` o `.regex(REGEX.NAME)`. Esto permite el ingreso de caracteres de control ASCII, tags no sanitizados o secuencias maliciosas que viajan directamente al backend.
- **Sugerencia:**
  Aplicar de forma sistemática `.regex(REGEX.SAFE_TEXT, SAFE_TEXT_MSG)` importado de `@/shared/domain/validation`.

---

### M7 — Uso de `any` Explícito en Repositorios y Casos de Uso
- **Archivos y Líneas:**
  - `NextJS/src/modules/catalogos/infrastructure/repositories/repo-catalogos-api.ts:249, 254, 259`
  - `NextJS/src/modules/familiares/application/use-cases/gestionar-familiar.ts:50`
- **Regla Violada:** Estándar TypeScript estricto y regla ESLint `@typescript-eslint/no-explicit-any`.
- **Detalle:**
  En `repo-catalogos-api.ts`, se fuerza el casteo `(item as any).campo` para adaptar respuestas heterogéneas de catálogos de backend. En `gestionar-familiar.ts`, se captura el error como `(error as any).message`. Esto apaga el verificador de tipos en tiempo de compilación.
- **Sugerencia:**
  Definir un tipo discriminated union para los ítems de catálogos y tipar los errores con `isAxiosError` o `instanceof Error`.

---

## 6. Hallazgos Bajos ⚪

### B1 — Inconsistencias Menores de Nomenclatura entre Módulos
- **Archivos:**
  - `auth/domain/entities/sesion-entity.ts` e `identidad/domain/entities/usuario-entity.ts` usan el sufijo `-entity.ts`, mientras que los otros 10 módulos utilizan la convención canónica sin sufijo (`empleado.ts`, `cargo.ts`, `pasivo.ts`, `familiar.ts`).
  - `identidad/infrastructure/actions/usuario-actions.ts` usa singular (`usuario`), en contraste con la norma plural adoptada en el resto (`personal-actions.ts`, `cargos-actions.ts`, `familiares-actions.ts`, `pasivos-actions.ts`).
  - `movimientos/ui/schema/schema-historial.ts` no coincide con el nombre del módulo (`movimientos`).
- **Regla Violada:** `arquitecto-scream-feature-onion` R9 (`kebab-case` semántico y homogéneo).
- **Sugerencia:** Unificar sufijos en una futura pasada de limpieza cosmética.

---

### B2 — Interfaces Vacías en DTOs
- **Archivos y Líneas:**
  - `pasivos/application/dtos/pasivos-dto.ts:23-32`
  - `personal/application/dtos/empleado-dto.ts:22-29`
- **Regla Violada:** ESLint `@typescript-eslint/no-empty-object-type`.
- **Detalle:** Se declaran interfaces vacías `export interface RequisitoEgresoDTO {}` como marcadores de posición sin propiedades definidas.
- **Sugerencia:** Declarar `type RequisitoEgresoDTO = Record<string, unknown>;` o documentar sus campos reales.

---

### B3 — Imports y Variables No Utilizadas
- **Archivos:** `schema-organizacion.ts:4`, `schema-empleado.ts:16`, `personal-page.tsx:29`, `familiares-page.tsx:28`, `organizacion-page.tsx:18`.
- **Regla Violada:** ESLint `@typescript-eslint/no-unused-vars`.
- **Detalle:** Imports de iconos Lucide y tipos auxiliares que no son referenciados en el código.
- **Sugerencia:** Ejecutar linter con flag `--fix` para sanear imports huérfanos.

---

### B4 — Discrepancias de Formato de Código (111 Archivos Detectados por Prettier)
- **Archivos:** 111 archivos en `NextJS/src/modules/`.
- **Regla Violada:** `formato-prettier` R14.
- **Detalle:** Pequeñas diferencias en indentación, comillas y wrapping de líneas debido a que Prettier no está integrado como hook pre-commit (Husky/lint-staged) ni en el pipeline de CI.
- **Sugerencia:** Agregar en `package.json` el script `"format": "prettier --write \"src/**/*.{ts,tsx}\""` y ejecutarlo.

---

### B5 — Errores Residuales de TypeScript en Código Fuera de la Nueva Arquitectura (28 Errores)
- **Archivos:**
  - `NextJS/e2e/smoke.spec.ts` (2 errores de tipado en tests e2e).
  - `NextJS/src/app/(protected)/dashboard/gestion-pasivos/` (15 errores en vistas y hooks legados).
  - `NextJS/src/lib/regex.ts` (7 errores en librería legada).
  - `NextJS/src/proxy.ts` (4 errores por la incompatibilidad de `puede()`).
- **Regla Violada:** Higiene de compilación global `tsc --noEmit`.
- **Detalle:** La nueva arquitectura (`src/modules/*` y `src/shared/*`) tiene **0 errores de compilación**. Sin embargo, la presencia de estos errores en el código legado y e2e impide incorporar `tsc --noEmit` como check bloqueante obligatorio en CI.
- **Sugerencia:** Corregir `proxy.ts`, actualizar `smoke.spec.ts` y aislar el chequeo de tipos de la nueva arquitectura mediante un `tsconfig.modules.json`.

---

### B6 — Coexistencia de Dos Rutas de Expresiones Regulares en `shared/`
- **Archivos:** `NextJS/src/shared/domain/validation/regex.ts` y `NextJS/src/shared/validation/regex.ts`.
- **Regla Violada:** `validacion-input-protegido` §0 (Principio de única fuente de la verdad).
- **Detalle:** Algunos módulos importan validaciones desde `@/shared/domain/validation` y otros desde `@/shared/validation/regex`.
- **Sugerencia:** Consolidar todas las expresiones regulares en `shared/domain/validation/regex.ts` y re-exportarlas con advertencia de deprecación en la otra ruta.

---

## 7. Análisis Específico de Rendimiento, Seguridad y Duplicación

### 7.1 Rendimiento y Bundling
- **Librerías Pesadas:**
  - `@react-pdf/renderer`: Se detectó un import estático en `personal-page.tsx:36` que engorda el bundle inicial de `/personal`. En cambio, en `pasivos/ui/detalle-pasivo.tsx:55` se implementó correctamente carga diferida.
  - `recharts`: Se utiliza en `autogestion/ui/autogestion-page.tsx` para las métricas de solicitudes. Está adecuadamente contenido en una pestaña secundaria, pero se beneficiaría de `next/dynamic` si la pestaña inicial no requiere gráficos inmediatos.
- **Ciclos de Renderizado:**
  - 5 módulos utilizan `form.watch()` en el cuerpo del componente principal, lo que causa re-render de páginas completas en cada cambio de input.

### 7.2 Seguridad
- **Vectores XSS:**
  - Se identificó un vector de riesgo crítico en `carnetizacion/ui/components/disenador-carnet.tsx:507` debido al uso de `dangerouslySetInnerHTML` con interpolación de cadenas no sanitizadas. **Mitigado en Commit `993fe63`** mediante renderizado declarativo React nativo con `<CarnetVistaPrevia />` y sanitización en `disenar-carnet.ts`.
  - En los otros 11 módulos no se encontraron instancias de `dangerouslySetInnerHTML` ni inyecciones de código.
- **Zero-Trust en Server Actions:**
  - 24 de las 24 Server Actions implementan estrictamente `safeParse` al inicio con manejo de errores estandarizado (`handleSessionExpired`, `ResultadoAccion`). La excepción original (`subirPlantillaCarnetAction`, Hallazgo C2) **fue remediada en Commit `d380c15`** con validación Zod completa (límite 5MB, rechazo SVG).

### 7.3 Manejo de Estado y Consistencia Arquitectónica
- **Zustand vs State Local:**
  - Ningún módulo de la nueva arquitectura (`src/modules/*`) usa Zustand; se utilizan exclusivamente primitivas de React (`useState`, `useTransition`, `useActionState`, `react-hook-form`). Zustand solo persiste en hooks legados de `src/hooks/`.
- **Estructura de Carpetas:**
  - 100% homogénea: los 12 módulos siguen de forma impecable la estructura Onion de 4 capas:
    `application/dtos/`, `application/use-cases/`, `domain/entities/`, `domain/ports/`, `domain/value-objects/`, `infrastructure/actions/`, `infrastructure/http/`, `infrastructure/mappers/`, `infrastructure/repositories/`, `ui/`, `ui/schema/`.

---

## 8. Auditoría de Sobre-Ingeniería y Bloat (Skill: `ponytail-audit`)

> ### ✅ ESTADO: APLICADA (2026-09-15/16)
> Se ejecutó la limpieza propuesta en esta sección en una tarea de seguimiento dedicada.
> Cada punto de §8.2 se reverificó con `grep` real contra el estado actual del código antes de
> tocar nada (varios cambiaron desde que se escribió este reporte, por trabajo concurrente de
> otros workers en la misma sesión) — el detalle de qué se aplicó, qué se corrigió respecto al
> hallazgo original, y qué se dejó documentado sin tocar está detallado punto por punto en §8.2.
> Commits:
> `159d324` (dependencias muertas), `5c9cb45` (InfoRow + formato de fecha + catálogo compartidos).
> `npx tsc --noEmit`: 28 errores (mismo baseline de siempre, 0 nuevos). `npx vitest run`: 182/182.

Siguiendo la metodología de `ponytail-audit`, se inspeccionó todo el frontend buscando dependencias innecesarias en `package.json`, abstracciones con un único consumidor, reinvención de utilidades de la plataforma/stdlib y duplicación en componentes de detalle.

### 8.1 Estudio de Caso: Duplicación en los 3 Sheets de Detalle (`personal`, `pasivos`, `familiares`)
Los componentes `empleado-detalle-sheet.tsx` (310 líneas), `detalle-pasivo.tsx` (364 líneas) y `detalle-familiar.tsx` (174 líneas) fueron creados para dar paridad con el legado. El análisis reveló:
1. **Reinvención del Grid de Datos (Key-Value):**
   - `empleado-detalle-sheet.tsx:51` define localmente `FilaInfo({ etiqueta, valor })`.
   - `detalle-pasivo.tsx:148-250` y `detalle-familiar.tsx:102-130` repiten inline bloques `<div className="text-muted-foreground">...</div><div>...</div>` más de 70 veces.
2. **Triplicación de Formateo de Fecha:**
   - En `personal`: importa `formatInTimeZone` de `date-fns-tz` en `expediente-detalle-view-model.ts:10`.
   - En `pasivos`: implementa `fechaLegible` con `new Date(fecha).toLocaleDateString("es-VE", ...)` en `detalle-pasivo.tsx:65`.
   - En `familiares`: implementa `fechaLegible` con `new Intl.DateTimeFormat("es-VE", ...)` en `detalle-familiar-view-model.ts:8`.
3. **Búsqueda Manual en Catálogos:**
   - `detalle-pasivo.tsx:60` crea `function nombreCatalogo(lista, id) { return lista.find(c => c.id === id)?.nombre ?? "N/A"; }`, idéntica a `nombrePorId` en `expediente-detalle-view-model.ts:21`.

**✅ Resuelto (commit `5c9cb45`):** los 3 puntos se cerraron juntos porque las 3 duplicaciones vivían
en los mismos 3 archivos. Ver `shared/ui/components/info-row.tsx`, `shared/lib/formato-fecha.ts`
(con test propio) y `shared/lib/catalogos.ts`. El punto 2 (`toLocaleDateString` sin zona horaria
explícita en pasivos) no era solo duplicación: era el único de los 3 con riesgo real de
desplazamiento de día según la zona horaria del proceso — ya corregido al consolidar en
`Intl.DateTimeFormat` con `timeZone: "UTC"` fijo.

### 8.2 Hallazgos Repo-Wide con Formato de Tags Ponytail
Rankeados por mayor volumen de corte/simplificación posible. Estado tras la tarea de aplicación
(2026-09-15/16), con la corrección respecto al hallazgo original cuando aplica:

1. ⏸️ `delete:` 43 archivos proxy puente en `src/shared/ui/components/*.tsx`. **No aplicado en esta
   tarea** (fuera de su alcance; es el hallazgo A5 de este mismo reporte, de mayor tamaño).
2. ✅ `delete:` Dependencia muerta `pdfjs-dist`. Desinstalada (`159d324`).
3. ✅ `delete:` Dependencias muertas `d3` y `@types/d3`. Desinstaladas (`159d324`).
4. ✅ `delete:` Dependencia muerta `@uidotdev/usehooks`. Desinstalada (`159d324`).
5. ✅ `delete:` Dependencia muerta `html-to-image`. Desinstalada (`159d324`).
6. ✅ `native:` `nanoid` — no tenía ningún call-site en `src/` (confirmado con grep antes de tocar
   nada), así que no hubo código que migrar a `crypto.randomUUID()`: se desinstaló directamente
   (`159d324`).
7. 🟡 `stdlib:` **Corregido respecto al hallazgo original.** `date-fns-tz` se consolidó en
   `Intl.DateTimeFormat` en los 2 archivos de nueva arquitectura que lo usaban
   (`personal/ui/expediente-detalle-view-model.ts`, `familiares/ui/detalle-familiar-view-model.ts`
   → `shared/lib/formato-fecha.ts`, commit `5c9cb45`), pero **la dependencia `date-fns-tz` no se
   desinstaló**: sigue en uso real en 11 archivos legado/`shared/forms/**` fuera del alcance de
   esta tarea. Además, **`date-fns` (no `date-fns-tz`) resultó NO ser una dependencia muerta**: el
   grep original de este reporte solo buscaba `from "date-fns"` exacto y no detectó el import de
   subpath `import { es } from "date-fns/locale"` en `src/components/ui/calendar.tsx` (legado, en
   uso real por `shared/forms/employees/**`). Se reinstaló tras confirmar con `tsc --noEmit` que
   su ausencia rompía la compilación de ese archivo. Ver commit `159d324`.
8. 📝 `delete:` Estado global `zustand`. **Documentado con precisión, no borrado** (instrucción
   explícita de la tarea de aplicación): `src/hooks/use-reporte-store.ts` tiene **cero
   consumidores** en todo el repo (verificado con grep, ni siquiera legado lo usa — candidato real
   a borrado inmediato en una futura tarea). `src/hooks/use-search-params.ts` sí tiene 8
   consumidores reales, todos en `shared/forms/employees/update/*.tsx` (legado activo, no Onion) —
   borrarlo hoy rompería esos formularios.
9. ✅ `shrink:` `InfoRow` compartido (commit `5c9cb45`). La reducción real fue más modesta que la
   estimación original (848→~450): los 3 archivos suman hoy 832 líneas combinadas, porque
   `empleado-detalle-sheet.tsx` y `detalle-pasivo.tsx` crecieron en tareas posteriores de esta
   sesión (edición vía diálogo embebido, gating de permisos) antes de que se aplicara esta
   limpieza — la deduplicación en sí se aplicó igual, sobre una base de código más grande de la
   que este reporte medió originalmente.
10. 🟡 `delete:` Interfaces vacías `RequisitoEgresoDTO`/`RequisitoIngresoDTO`. **No se encontraron
    en el código** bajo ese nombre exacto ni en `pasivos-dto.ts`/`empleado-dto.ts` ni en ningún
    otro archivo (grep repo-wide, 0 resultados) — probablemente ya renombradas en una tarea previa
    de esta sesión. Las interfaces `extends X {}` que sí existen hoy en esos archivos (p. ej.
    `DatosViviendaDTO extends DatosVivienda {}`) **no son placeholders vacíos**: son el patrón
    deliberado de la regla R5 (`ui/` solo opera con tipos DTO, nunca con tipos de `domain/`
    directamente) — heredan todos los campos del tipo de dominio bajo un nombre nominalmente
    distinto. Convertirlas a `Record<string, unknown>` rompería esa separación de capas. No se
    tocaron.
11. ⏸️ `yagni:` Simplificación de `expediente-detalle-view-model.ts` con un `resolveCatalogo`
    genérico. **No aplicado en esta tarea** (no estaba en su alcance explícito; el punto 5 de esa
    misma tarea sí se cerró — ver `nombrePorId`/`nombresPorIds` en `shared/lib/catalogos.ts`, que
    es la mitad reutilizable de esta simplificación).
12. ⏸️ `delete:` Imports no utilizados de 5 archivos. **No aplicado en esta tarea** (fuera de su
    alcance explícito; ver hallazgo B3 de este mismo reporte).

> **Balance Ponytail Audit — actualizado:**
> Aplicado: 6 de 7 dependencias muertas confirmadas y desinstaladas (`pdfjs-dist`, `d3`,
> `@types/d3`, `@uidotdev/usehooks`, `html-to-image`, `nanoid`); `date-fns` se mantiene porque
> el hallazgo original tenía un falso positivo (uso real vía subpath no detectado por el grep
> original). `date-fns-tz` se redujo a solo los consumidores legado que quedan, con los 2
> consumidores de nueva arquitectura migrados a `Intl.DateTimeFormat` nativo. `InfoRow` compartido
> aplicado en los 3 Sheets. `zustand`: un hook (`use-reporte-store.ts`) confirmado sin ningún
> consumidor (candidato a borrado inmediato), el otro (`use-search-params.ts`) con 8 consumidores
> legado reales — ninguno borrado en esta tarea, ambos documentados con precisión.

---

## 9. Evaluación de Seguridad Avanzada (Skills: `api-security-testing` & `application-security-testing`)

Evaluación de la superficie de ataque del frontend contra los vectores del **OWASP Top 10 (2025)** y **OWASP API Security Top 10 (2023)**:

### 9.1 API1:2023 / BOLA (Broken Object Level Authorization / IDOR)
- **Vulnerabilidad Potencial:**
  - En `detalle-pasivo.tsx:86`, la acción `getPasivoPorCedulaAction(cedula)` envía la cédula recibida como prop directamente al backend.
  - En `detalle-familiar.tsx:53`, la acción `getDocumentosFamiliarAction(familiar.id)` consulta documentos por identificador numérico directo.
- **Análisis de Impacto:**
  - Aunque el frontend no puede reemplazar la autorización del servidor, en flujos de autoservicio (`autogestion`), el cliente no debe permitir que un usuario altere la cédula o ID consultado para inspeccionar expedientes ajenos.
  - **Recomendación:** Garantizar que en las Server Actions de autoservicio el identificador provenga exclusivamente de la sesión verificada en la cookie JWT (`session.user.cedula`), impidiendo que el cliente suministre cédulas de terceros.

### 9.2 API3:2023 / Broken Object Property Level Authorization (Mass Assignment & Upload Sin Validar)
- **Estado:** ✅ **RESUELTO** (Commit `d380c15`).
- **Vulnerabilidad Previa:**
  - En `carnetizacion-actions.ts:119` (`subirPlantillaCarnetAction`), se aceptaba un objeto `File` crudo y cadenas arbitrarias sin validar:
    1. No había restricción de tamaño (`maxFileSize`). Un archivo de 500 MB podía saturar la memoria del proceso Next.js y del backend (Denegación de Servicio - DoS / API4:2023).
    2. No había verificación de magic bytes ni tipo MIME (`image/png`, `image/jpeg`). Un archivo SVG con código JavaScript incrustado (`<svg onload="alert(1)">`) o un ejecutable podría haber sido almacenado y servido posteriormente.
- **Remediación Verificada:** Se implementó `subirPlantillaCarnetSchema` con Zod validando límite de 5MB, tipos MIME estrictos (`image/png`, `image/jpeg`), y rechazo explícito de `image/svg+xml`.

### 9.3 API5:2023 / BFLA (Broken Function Level Authorization) en Frontend
- **Estado:** ✅ **RESUELTO** (Commits `c7bd8b2`, `6827fac`, `b24bdbc`, `d6e6904`, `0fecdca`, `faa8b9d`, `27574bc`, `0dfb1f4`).
- **Vulnerabilidad Previa:**
  - En 8 de los 11 módulos con interfaz (`cargos`, `organizacion`, `catalogos`, `carnetizacion`, `identidad`, `movimientos`, `autogestion`, `reportes`), la UI no validaba los códigos de permiso del usuario autenticado (`session.user.permisos`).
  - **Impacto:** Los endpoints administrativos quedaban expuestos en la interfaz para usuarios con roles de menor privilegio (ej. recepcionistas o pasantes). Si bien el backend devuelve 403, el usuario tenía visibilidad de la estructura interna del sistema, formularios, campos y catálogos restringidos (Exceso de exposición de datos / API3:2023).
- **Remediación Verificada:**
  - Se aplicó PBAC sistemático con `useSession()` y `tienePermiso(permisos, "modulo.accion")` en todos los 8 módulos, ocultando y deshabilitando botones de mutación, formularios de alta, opciones de DataTable y pestañas de acceso privilegiado. Se añadieron 18 pruebas unitarias adicionales validando el gating PBAC.

### 9.4 OWASP A03:2021 / Inyección XSS en DOM
- **Estado:** ✅ **RESUELTO** (Commit `993fe63`).
- **Vulnerabilidad Previa (PoC):**
  - **Vector:** `NextJS/src/modules/carnetizacion/ui/components/disenador-carnet.tsx:507`
  - **Flujo de Explotación:**
    1. Un operador introducía en el campo de texto del formulario de diseño un payload:  
       `nombreCompleto: '"><img src=x onerror="alert(document.domain)">'`
    2. El caso de uso `disenar-carnet.ts:100` interpolaba el string sin sanitizar dentro de la plantilla HTML.
    3. `disenador-carnet.tsx:507` renderizaba `dangerouslySetInnerHTML={{ __html: htmlPreview }}`.
    4. El script se ejecutaba de inmediato en el navegador del usuario en el contexto del origen de la aplicación.
  - **Remediación Verificada:** Se erradicó por completo `dangerouslySetInnerHTML` reemplazándolo por el componente nativo React JSX `<CarnetVistaPrevia />` y la función de saniamiento `sanitizeUrl` para bloquear esquemas `javascript:`.

### 9.5 Manejo de Cookies y Sesión (Transporte Seguro C-2)
- **Estado Evaluado:**
  - Las cookies `dj_access` y `dj_refresh` se configuran en `auth-actions.ts:88` y `api-client.ts:21` con directivas `httpOnly: true`, `sameSite: "lax"` y flag `secure: process.env.NODE_ENV === "production"`.
  - Los tokens de backend nunca se exponen al objeto global `window` ni a scripts de cliente. Cumplimiento satisfactorio del contrato **C-2**.

---

## 10. Plan de Remediación Consolidado

### Fase 1: Remediación Crítica Inmediata (Seguridad AppSec) — ✅ COMPLETADA
1. **C1 (XSS):** ✅ Resuelto en Commit `993fe63`. Refactorizado `disenador-carnet.tsx` y `disenar-carnet.ts` a componentes React JSX nativos (`CarnetVistaPrevia`) eliminando `dangerouslySetInnerHTML`.
2. **C2 (Zero-Trust Upload):** ✅ Resuelto en Commit `d380c15`. Creado `subirPlantillaCarnetSchema` en `schema-carnet.ts` y aplicado `safeParse` en `subirPlantillaCarnetAction` con validación de tipo MIME (PNG/JPEG), rechazo de SVG y límite de 5MB.

### Fase 2: Arquitectura y Rendimiento
1. **A1 (Onion Violation):** Mover `TipoReportePersonal` a `reporte-dto.ts` y eliminar la importación de Domain en `reportes-page.tsx`.
2. **A2 (TypeScript / Proxy):** Corregir `proxy.ts:18, 22` invocando `tienePermiso(permisos, ...)` en lugar de `puede()`.
3. **A3 (Bundle PDF):** Convertir `EmpleadoDetallePdf` a import dinámico (`next/dynamic`) en `personal-page.tsx`.
4. **A4 (PBAC / BFLA):** ✅ Resuelto en Commits `c7bd8b2`, `6827fac`, `b24bdbc`, `d6e6904`, `0fecdca`, `faa8b9d`, `27574bc`, `0dfb1f4`. Incorporado `useSession()` y `tienePermiso()` en los 8 módulos de UI con gating estricto y 18 tests unitarios asociados.

### Fase 3: Poda de Sobre-Ingeniería (Ponytail Audit) — ✅ 1–3 COMPLETADAS (commits `159d324`, `5c9cb45`), 4 pendiente
1. ✅ Desinstaladas 6 de 7 dependencias muertas (`pdfjs-dist`, `d3`, `@types/d3`,
   `@uidotdev/usehooks`, `html-to-image`, `nanoid`). `date-fns` se mantuvo (falso positivo del
   hallazgo original, ver §8.2 punto 7) y `date-fns-tz` se mantuvo (uso legado real en 11 archivos
   fuera de alcance).
2. ✅ `date-fns-tz` sustituido por `Intl.DateTimeFormat` nativo (`shared/lib/formato-fecha.ts`) en
   los 2 consumidores de nueva arquitectura. `nanoid` no tenía código que migrar (0 call-sites):
   se desinstaló directamente.
3. ✅ `<InfoRow label="..." value="..." />` extraído a `shared/ui/components/info-row.tsx` y
   adoptado en los 3 Sheets de detalle.
4. ⏸️ Migrar los 43 proxies de `shared/ui/components/` a componentes independientes — **no
   aplicado**, fuera del alcance de la tarea de aplicación de esta sección (sigue siendo el
   hallazgo A5 abierto).

### Fase 4: Accesibilidad, Mobile-First y Calidad de Código
1. **M1:** Reemplazar `overflow-hidden` por `overflow-x-auto` en los contenedores de `<Table>` para soporte en pantallas móviles.
2. **M2:** Añadir `aria-label` / `<span className="sr-only">` y áreas táctiles de 44px a los botones con solo ícono.
3. **M4:** Migrar llamadas a `form.watch()` en cuerpo de render hacia el hook `useWatch`.
4. **B4:** Ejecutar `prettier --write` sobre los 111 archivos y configurar script de formato automatizado.

---
*Reporte generado de acuerdo con los lineamientos de calidad, estándares arquitectónicos Onion, AppSec y Ponytail del proyecto GATH.*
