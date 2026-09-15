# Auditoría de Calidad y Arquitectura — Frontend Next.js GATH (2026-09-15)

> **Alcance:** `NextJS/` completo (12 módulos en `src/modules/`, `src/shared/`, `src/app/`, middleware y configuración), branch `feature/arquitectura-onion`.
> **Naturaleza:** auditoría de **solo lectura / diagnóstico** — ningún archivo de código del sistema fue modificado (únicamente este reporte).
> **Estándar de referencia:** los 8 skills del proyecto en `NextJS/.claude/skills/`:
> 1. `arquitecto-scream-feature-onion` (Reglas R1–R16, 4 capas Onion, contratos C-1 a C-6, zero-trust, DTOs).
> 2. `patrones-implementacion-frontend` (react-hook-form + Zod, wrappers de campo, PBAC `tienePermiso`, useTransition, revalidación).
> 3. `validacion-input-protegido` (zero-trust obligatorio en Server Actions, regex centralizadas, sanitización, prevención de XSS).
> 4. `testing-unit-vitest` (R11: pruebas co-localizadas, contratos de respuesta C-1/C-2/C-6, cobertura de casos de uso).
> 5. `testing-a11y-axe` (WCAG 2.1 AA, labels accesibles, contraste, navegación por teclado).
> 6. `design-taste-frontend` (diseño intencional, anti-slop, jerarquía tipográfica, densidad de información).
> 7. `mobile-first-design` (tablas `overflow-x-auto`, touch targets >= 44px, layouts fluidos, sin `h-screen`).
> 8. `formato-prettier` (R14: consistencia de formato de código, integración ESLint + Prettier).
>
> **Método:** inspección estática profunda de código fuente en los 12 módulos, análisis de contratos de dependencias entre capas, búsqueda de patrones de riesgo (XSS, `dangerouslySetInnerHTML`, imports pesados, omisión de permisos), y ejecución de herramientas automatizadas (`npx tsc --noEmit`, `npx vitest run`, `npx eslint src/modules/`, `npx prettier --check`).

---

## 1. Resumen Ejecutivo

| Severidad | Cantidad | Descripción sintética |
|---|:---:|---|
| 🔴 **Crítico** | **2** | Vulnerabilidad DOM-XSS en carnetización (`dangerouslySetInnerHTML` sin sanitización); Bypass Zero-Trust en Server Action de subida de plantilla. |
| 🟠 **Alto** | **5** | Violación de capa Onion (UI importa Domain en `reportes`); Type mismatch en `proxy.ts` bloquea compilación; Import estático pesado de `@react-pdf/renderer` impacta bundle de `/personal`; 8 de 11 módulos omiten PBAC en UI; Componentes `shared/ui` acoplados al legado. |
| 🟡 **Medio** | **7** | Tablas truncadas en móviles (`overflow-hidden` vs `overflow-x-auto`); Botones con solo icono sin nombre accesible y < 44px; Duplicación de código en Sheets de detalle; `form.watch()` degrada render en formularios; `setState` sincrónico en `useEffect`; Schemas Zod sin regex de formato; Uso de `any` en repositorios. |
| ⚪ **Bajo** | **6** | Inconsistencias de nomenclatura de archivos/esquemas; Interfaces vacías en DTOs; Imports y variables no utilizadas; 111 archivos con diferencias de formato Prettier; 28 errores de TypeScript en legado/e2e/proxy; Doble ubicación de regex compartidas. |

### Estado de Contratos y Herramientas Automatizadas

- **TypeScript (`npx tsc --noEmit`):**
  - **Nueva Arquitectura (`src/modules/*` y `src/shared/*`): 0 ERRORES.** La tipificación interna y los contratos entre capas compilan limpiamente.
  - **Proyecto Global: 28 errores** en 4 archivos fuera de los módulos (`e2e/smoke.spec.ts` [2], legado `dashboard/gestion-pasivos/` [15], `src/lib/regex.ts` [7], y `src/proxy.ts` [4]).
- **Vitest (`npx vitest run`):**
  - **147/147 tests pasados (100% éxito)** en 33 archivos de prueba co-localizados en `application/use-cases/`. Contratos C-1 y C-6 rigurosamente testeados con mocks de puertos.
- **ESLint (`npx eslint src/modules/`):**
  - **49 observaciones:** 24 errores (principalmente deshabilitación de reglas de React Compiler por `form.watch`, `setState` en efectos, interfaces vacías y `@typescript-eslint/no-explicit-any`) y 25 advertencias (variables e imports sin uso).
- **Prettier (`npx prettier --check "src/modules/**/*.{ts,tsx}"`):**
  - **111 archivos** presentan discrepancias de estilo/formato respecto a la regla R14 debido a la ausencia de un hook de formateo automatizado en CI/pre-commit.

---

## 2. Matriz de Cumplimiento por Módulo (12 Módulos)

| Módulo | Capas Onion (R1-R5) | Zero-Trust Actions (R7) | PBAC en UI (R16) | A11y / Labels | Mobile-First Tables | Tests Unitarios | Estado General |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. auth** | ✅ Cumple | ✅ `safeParse` | N/A (Público) | ✅ Completo | N/A | ✅ 4 tests (1 archivo) | 🟢 Robusto |
| **2. autogestion** | ✅ Cumple | ✅ `safeParse` | ⚠️ Sin verificar | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 8 tests (2 archivos) | 🟡 Requiere A11y & Mobile |
| **3. cargos** | ✅ Cumple | ✅ `safeParse` | ❌ Sin PBAC en UI | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 8 tests (2 archivos) | 🟡 Requiere PBAC & Mobile |
| **4. carnetizacion** | ✅ Cumple | 🔴 Bypass en upload | ❌ Sin PBAC en UI | ⚠️ Botones icono | N/A | ✅ 12 tests (3 archivos) | 🔴 **Crítico (XSS + Action)** |
| **5. catalogos** | ✅ Cumple | ✅ `safeParse` | ❌ Sin PBAC en UI | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 16 tests (4 archivos) | 🟡 Requiere PBAC & Regex |
| **6. familiares** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 8 tests (2 archivos) | 🟢 Aceptable |
| **7. identidad** | ✅ Cumple | ✅ `safeParse` | ❌ Sin PBAC en UI | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 12 tests (3 archivos) | 🟡 Requiere PBAC en Tabs |
| **8. movimientos** | ✅ Cumple | ✅ `safeParse` | ❌ Sin PBAC en UI | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 8 tests (2 archivos) | 🟡 Requiere PBAC & Mobile |
| **9. organizacion** | ✅ Cumple | ✅ `safeParse` | ❌ Sin PBAC en UI | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 12 tests (3 archivos) | 🟡 Requiere PBAC & Mobile |
| **10. pasivos** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 15 tests (3 archivos) | 🟢 Aceptable |
| **11. personal** | ✅ Cumple | ✅ `safeParse` | ✅ `tienePermiso` | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 28 tests (6 archivos) | 🟠 **Alto (Bundle PDF)** |
| **12. reportes** | 🔴 Violación (A1) | ✅ `safeParse` | ❌ Sin PBAC en UI | ⚠️ Botones icono | ⚠️ `overflow-hidden` | ✅ 16 tests (4 archivos) | 🟠 **Alto (Onion Layer)** |

---

## 3. Hallazgos Críticos 🔴

### C1 — Vulnerabilidad DOM-XSS en Diseñador de Carnetización vía `dangerouslySetInnerHTML`
- **Archivos y Líneas:**
  - `NextJS/src/modules/carnetizacion/ui/components/disenador-carnet.tsx:507`
  - `NextJS/src/modules/carnetizacion/application/use-cases/disenar-carnet.ts:35-130`
- **Regla Violada:** `validacion-input-protegido` §6 (Sanitización y Prevención de Inyección/XSS) / OWASP A03:2021-Injection.
- **Detalle del Defecto:**
  El caso de uso `generarHtmlVistaPrevia` toma como entrada el DTO `DisenoCarnetDTO` (que contiene campos ingresados por el usuario como `nombreCompleto`, `cargo`, `departamento`, `codigo`, `fotoUrl`, `plantillaUrl`) y realiza concatenación directa en una plantilla HTML cruda (`string`):
  ```typescript
  // disenar-carnet.ts:100-112
  <div style="font-size: 16px; font-weight: bold; color: ${colorTexto};">${datos.nombreCompleto}</div>
  <div style="font-size: 13px; color: ${colorSecundario};">${datos.cargo}</div>
  ```
  Luego, el componente cliente `disenador-carnet.tsx` inyecta este HTML directamente en el DOM mediante:
  ```tsx
  // disenador-carnet.tsx:507
  <div
    className="relative mx-auto rounded-lg border shadow-sm"
    style={{ width: `${ANCHO_PX}px`, height: `${ALTO_PX}px` }}
    dangerouslySetInnerHTML={{ __html: htmlPreview }}
  />
  ```
  No se utiliza ninguna función de sanitización (como `DOMPurify` o escape de entidades HTML) ni antes ni durante la inyección. Si un atacante o usuario malicioso introduce un payload como `"><img src=x onerror=alert(document.cookie)>` en el nombre, cargo o en la URL de la imagen, el script se ejecuta directamente en el contexto del navegador del usuario que visualice o apruebe el carnet.
- **Sugerencia de Solución:**
  Eliminar por completo el uso de HTML como cadena de texto cruda y `dangerouslySetInnerHTML`. La vista previa debe renderizarse como un árbol declarativo de componentes React JSX puros (`<div style={{...}}><span>{datos.nombreCompleto}</span></div>`), donde React aplica auto-escaping estricto contra XSS por defecto. Si se requiere exportar el HTML como texto al backend, sanitizar previamente todos los campos con una utilidad centralizada de escape (`escapeHtml`).

---

### C2 — Bypass de Validación Zero-Trust en Server Action `subirPlantillaCarnetAction`
- **Archivos y Líneas:**
  - `NextJS/src/modules/carnetizacion/infrastructure/actions/carnetizacion-actions.ts:119-140`
  - `NextJS/src/modules/carnetizacion/ui/schema/schema-carnet.ts`
- **Regla Violada:** `validacion-input-protegido` §3 ("Toda Server Action DEBE validar su entrada con safeParse de Zod") y `arquitecto-scream-feature-onion` R1, R7.
- **Detalle del Defecto:**
  Mientras que las demás 23 Server Actions del proyecto implementan validación estricta con `safeParse(rawData)` antes de procesar cualquier llamada, `subirPlantillaCarnetAction` recibe parámetros posicionales no estructurados:
  ```typescript
  // carnetizacion-actions.ts:119
  export async function subirPlantillaCarnetAction(
    nombre: string,
    imagen: File,
    activar = false
  ): Promise<ResultadoAccion<PlantillaCarnetDTO>> {
    try {
      // LLAMA DIRECTAMENTE A LA API SIN NINGÚN safeParse
      const repo = getRepoCarnetizacion();
      const resultado = await repo.subirPlantilla(nombre, imagen, activar);
      ...
  ```
  En `schema-carnet.ts` ni siquiera existe un esquema Zod para la subida de plantillas. No se valida longitud del nombre, caracteres permitidos, tamaño máximo del archivo (ej. máx 5MB) ni tipo MIME permitido (`image/png`, `image/jpeg`).
- **Sugerencia de Solución:**
  1. Definir en `schema-carnet.ts`:
     ```typescript
     export const subirPlantillaSchema = z.object({
       nombre: z.string().trim().min(2).max(100).regex(REGEX.SAFE_TEXT, SAFE_TEXT_MSG),
       activar: z.boolean().default(false),
     });
     ```
  2. En `subirPlantillaCarnetAction`, recibir `formData: FormData`, extraer campos, validar el archivo (`size <= 5 * 1024 * 1024`, `type in ['image/png', 'image/jpeg']`) y ejecutar `subirPlantillaSchema.safeParse(...)`.

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

### A4 — Ausencia Sistémica de Control de Acceso PBAC en UI (8 de 11 Módulos Exponen Acciones a No Autorizados)
- **Archivos:**
  - `NextJS/src/modules/cargos/ui/cargos-page.tsx`
  - `NextJS/src/modules/organizacion/ui/organizacion-page.tsx`
  - `NextJS/src/modules/catalogos/ui/catalogos-page.tsx`
  - `NextJS/src/modules/carnetizacion/ui/carnetizacion-page.tsx`
  - `NextJS/src/modules/identidad/ui/usuarios-page.tsx`
  - `NextJS/src/modules/movimientos/ui/movimientos-page.tsx`
  - `NextJS/src/modules/autogestion/ui/autogestion-page.tsx`
  - `NextJS/src/modules/reportes/ui/reportes-page.tsx`
- **Regla Violada:** `patrones-implementacion-frontend` §PBAC y `arquitecto-scream-feature-onion` R16 ("Permisos siempre por código `[modulo].[accion]`").
- **Detalle del Defecto:**
  Únicamente 3 módulos (`personal`, `pasivos`, `familiares`) consumen `useSession()` y aplican `tienePermiso(...)` para condicionar la visibilidad de los controles interactivos. En los restantes 8 módulos, botones destructivos y de mutación (ej. "Crear Cargo", "Eliminar Departamento", "Nuevo Catálogo", "Subir Plantilla", "Crear Usuario") se muestran a cualquier usuario autenticado sin importar su rol o permisos asignados (por ejemplo, personal de recepción o solo lectura). El usuario puede hacer clic, abrir modales y enviar formularios, enterándose de que no tiene autorización únicamente cuando el backend rechaza la petición con `403 Forbidden`.
- **Sugerencia de Solución:**
  Implementar de manera uniforme en las páginas UI:
  ```tsx
  const { data: session } = useSession();
  const puedeCrear = tienePermiso(session?.user?.permisos, "cargos.crear");
  // Ocultar o deshabilitar botón si !puedeCrear
  ```

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
- **Regla Violada:** Principio DRY y `arquitecto-scream-feature-onion` §Componentes Compartidos.
- **Detalle:**
  Existe código duplicado casi idéntico entre estos tres paneles:
  1. Componente auxiliar `FilaInfo({ label, valor, mono })`: redefinido exactamente con la misma estructura y estilos CSS en cada archivo.
  2. Función de formateo de fecha legible (`fechaLegible`): repetida en los tres módulos con ligera variación de manejo de nulos.
  3. Sección de metadatos de auditoría ("Creado por", "Fecha creación", "Modificado por"): idéntica disposición de cuadrícula de 2 columnas en tarjetas secundarias.
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
  - Se identificó un vector de riesgo crítico en `carnetizacion/ui/components/disenador-carnet.tsx:507` debido al uso de `dangerouslySetInnerHTML` con interpolación de cadenas no sanitizadas.
  - En los otros 11 módulos no se encontraron instancias de `dangerouslySetInnerHTML` ni inyecciones de código.
- **Zero-Trust en Server Actions:**
  - 23 de las 24 Server Actions implementan estrictamente `safeParse` al inicio con manejo de errores estandarizado (`handleSessionExpired`, `ResultadoAccion`). La única excepción es `subirPlantillaCarnetAction` (Hallazgo C2).

### 7.3 Manejo de Estado y Consistencia Arquitectónica
- **Zustand vs State Local:**
  - Ningún módulo de la nueva arquitectura (`src/modules/*`) usa Zustand; se utilizan exclusivamente primitivas de React (`useState`, `useTransition`, `useActionState`, `react-hook-form`). Zustand solo persiste en hooks legados de `src/hooks/`.
- **Estructura de Carpetas:**
  - 100% homogénea: los 12 módulos siguen de forma impecable la estructura Onion de 4 capas:
    `application/dtos/`, `application/use-cases/`, `domain/entities/`, `domain/ports/`, `domain/value-objects/`, `infrastructure/actions/`, `infrastructure/http/`, `infrastructure/mappers/`, `infrastructure/repositories/`, `ui/`, `ui/schema/`.

---

## 8. Plan de Remediación Recomendado

### Fase 1: Remediación Crítica Inmediata (Seguridad)
1. **C1:** Refactorizar `disenador-carnet.tsx` y `disenar-carnet.ts` para renderizar la vista previa mediante componentes React nativos (JSX) eliminando `dangerouslySetInnerHTML`.
2. **C2:** Crear `subirPlantillaSchema` en `schema-carnet.ts` y aplicar `safeParse` en `subirPlantillaCarnetAction`.

### Fase 2: Arquitectura y Rendimiento
1. **A1:** Mover `TipoReportePersonal` a `reporte-dto.ts` y eliminar la importación de Domain en `reportes-page.tsx`.
2. **A2:** Corregir `proxy.ts` llamando a `tienePermiso()` en vez de `puede()`.
3. **A3:** Convertir `EmpleadoDetallePdf` a import dinámico en `personal-page.tsx`.
4. **A4:** Incorporar `useSession()` y `tienePermiso()` en los 8 módulos de UI que carecen de chequeos PBAC.

### Fase 3: Accesibilidad, Mobile-First y Deuda Técnica
1. **M1:** Reemplazar `overflow-hidden` por `overflow-x-auto` en los contenedores de `<Table>`.
2. **M2:** Añadir `aria-label` / `<span className="sr-only">` y targets táctiles mínimos de 44px a los botones con solo ícono.
3. **M3:** Extraer `FilaInfo` a `shared/ui/components/info-row.tsx`.
4. **M4:** Migrar `form.watch()` a `useWatch` en subcomponentes controlados.
5. **B4:** Ejecutar `prettier --write` sobre los 111 archivos y configurar script de formato.

---
*Reporte generado de acuerdo con los lineamientos de calidad y estándares arquitectónicos del proyecto GATH.*
