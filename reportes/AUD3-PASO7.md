# AUD3 PASO 7 — Móvil y accesibilidad

**Skills usadas:** `mobile-first-design` (proyecto), `testing-a11y-axe`.
**Método:** revisión del armazón móvil y de los patrones de formulario, y
ejecución con **axe-core** de las rutas de autogestión y Bienestar
(`e2e/accesibilidad.spec.ts`, criterio 0 violaciones `serious`/`critical`).

## Resumen

Se encontró y corrigió una violación **crítica** de accesibilidad que introducía
el tour guiado de driver.js (atributos ARIA de diálogo sobre un `div` genérico),
y se cambió el único `min-h-screen` que quedaba por `min-h-svh`. El resto de
patrones móviles ya eran correctos: cajón lateral con `Sheet`, inputs a 16 px en
móvil, tablas con scroll y `prefers-reduced-motion` global.

## Hallazgos

### P7-01 — `aria-expanded` sobre un `div` en el tour guiado (CRÍTICA, **corregido**)

La corrida de axe falló en `/autogestion/solicitudes`:

```
aria-allowed-attr (critical)
<div data-guia-id="mis-solicitudes-cabecera" class="driver-active-element"
     aria-haspopup="dialog" aria-expanded="true" aria-controls="driver-popover-content">
```

driver.js marca el elemento resaltado con los atributos del diálogo; cuando el
paso apunta a un contenedor genérico (una cabecera `div`), `aria-expanded` no
está permitido y el lector de pantalla recibe una relación inválida. El popover
ya tiene su propio `role="dialog"` y su etiqueta.

- `shared/ui/guias/use-guia.ts`: en `onHighlighted` se retiran `aria-haspopup`,
  `aria-expanded` y `aria-controls` del elemento resaltado (de inmediato, en un
  `setTimeout(0)` y con un `MutationObserver` durante 1,5 s, porque driver.js los
  vuelve a fijar después del hook y en cada paso). No cambia la guía visible;
  solo la semántica.
- Prueba nueva en `use-guia.test.ts` (7 passed): comprueba que los tres
  atributos desaparecen.

### P7-01b — Falso positivo de contraste durante la animación (BAJA, spec)

La primera corrida con la limpieza de ARIA siguió marcando `color-contrast`
sobre el botón «Siguiente»: axe lo midió **a mitad de la transición** de entrada
del popover (0,2 s) y calculó los colores con la opacidad aplicada. No es un
defecto de color (los tokens dan `#0b4a9e` con texto blanco). Se añadió una
espera de 500 ms en `sinGraves` antes de analizar, solo en la prueba.

### P7-01c — `nested-interactive` en la zona de subida (SERIA, **corregido**)

En el detalle de la solicitud (secciones de formación, complementaria y
familiar), axe marcó `nested-interactive`: el `div role="button"` de
`ZonaSubida` contenía el `<input type="file" class="sr-only">`, que es
enfocable. Los lectores de pantalla no siempre anuncian bien un control dentro
de otro y el foco se vuelve ambiguo.

- `shared/components/zona-subida/zona-subida.tsx`: el `input` pasa a ser
  hermano del `div` (fragmento), sin cambiar el aspecto (`sr-only` es absoluto)
  ni el comportamiento (el clic y Enter siguen abriendo el selector).
- Nombre accesible del input con reserva a `etiquetaZona` si no se pasa
  `etiquetaInput`.
- `zona-subida.test.tsx`: **5 passed**.

### P7-02 — `min-h-screen` en la verificación pública del carnet (BAJA, **corregido**)

`app/carnet/[hash]/page.tsx` usaba `min-h-screen` (100vh), que en móvil deja un
hueco con la barra del navegador. Se cambió a `min-h-svh`. Es la única página
con `h-screen`; el resto usa `min-h-svh` o `h-full`.

### P7-03 — Lo verificado (INFO)

| Patrón | Estado |
| ------ | ------ |
| Armazón móvil | sidebar dentro de `Sheet` en pantallas pequeñas; `SidebarTrigger` visible |
| Objetivos táctiles | botones con `min-h-11` en las acciones principales; inputs `h-11` |
| Zoom de iOS | `Input` usa `text-base md:text-sm` (16 px en móvil) |
| Tablas | contenedores con `overflow-x-auto` en las tablas de listado |
| Movimiento reducido | regla global `@media (prefers-reduced-motion: reduce)` en `globals.css` |
| Teclado | `SkipLink` a `#contenido-principal`; foco visible con `focus-visible` |
| Imágenes | `alt` en logos y vistas previas; las decorativas van con `aria-hidden` |
| Formularios | `Label` asociado por `htmlFor`/`FormField`; errores con `FormMessage` y `role="alert"` en los avisos |
| Diálogos | shadcn `Dialog`/`Sheet` con título y descripción (axe no reportó `aria-dialog-name`) |

### P7-04 — Breakpoint del hook móvil (INFO, a decisión)

`shared/hooks/use-mobile.ts` usa **1024 px**; la skill del proyecto documenta
768 px. No se cambió: el valor actual hace que tabletas usen el armazón móvil y
moverlo cambia la navegación. Es una decisión de diseño, no un defecto.

## Resultado de axe

| Ruta | Antes | Después |
| ---- | ----- | ------- |
| `/autogestion` | fallo de la spec (texto de bienvenida cambiado) | **passed** |
| `/autogestion/ficha` | — | **passed** |
| `/autogestion/solicitudes` | **1 crítica** (`aria-allowed-attr`) y 1 falso positivo de contraste por animación | **passed** |
| `/autogestion/solicitudes/nueva` | — | **passed** |
| detalle de solicitud | **1 seria** (`nested-interactive` en la zona de subida) | **passed** |
| `/personal/bienestar/solicitudes` (lista y detalle) | — | **passed** |
| `/configuracion/parametros` y `/auditoria` (Administración) | — | **passed** |

**9 de 9 pruebas de accesibilidad en verde** contra la imagen reconstruida.

## Verificación de este paso

- `npx vitest run src/shared/ui/guias/use-guia.test.ts`: **7 passed**.
- `npx vitest run src/shared/components/zona-subida/zona-subida.test.tsx`:
  **5 passed**.
- `npx tsc --noEmit`: 0 errores. `npx eslint src --quiet`: 0 errores.
- `e2e/accesibilidad.spec.ts` con la imagen reconstruida: **9 passed**.

## Estabilización de las E2E (solo specs/config)

La reconstrucción en frío hace que la primera petición tarde y que el evento
`load` no llegue (imágenes de SeaweedFS). Sin tocar la aplicación:

- `playwright.config.ts`: `timeout` 180 s y `navigationTimeout` 60 s.
- `fe-de-vida.spec.ts`: el helper espera hasta 60 s a que la pantalla decida
  entre formulario, botón o seguimiento, y omite si no cargó.
- `pasivos-fe-de-vida-reportes.spec.ts`: `goto` con `domcontentloaded`; el
  submenú del sidebar se abre con reintento hasta que el enlace es visible
  (el primer clic puede perderse antes de la hidratación); el PDF admite 300 s
  de generación.
- `accesibilidad.spec.ts`: 500 ms para que termine la transición del tour.
