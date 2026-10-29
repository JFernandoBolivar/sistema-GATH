# Plan de rediseño institucional de Autogestión + PWA con cámara

Fecha: 2026-10-29 · Alcance: `NextJS/` (Next.js 16.1.3, React 19, Tailwind v4, shadcn/ui, pnpm) e infraestructura de despliegue (`compose.yml`).
Estado: SOLO PLAN. No se modificó código.
Documento hermano (lógica de negocio de fe de vida, otro agente): `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md`. Este documento define la capa visual, de navegación, PWA y la interfaz de la cámara; la lógica de negocio, backend, estados, permisos y la infraestructura C0 (nginx+TLS) son del plan funcional (etapas A-E y C0). Reconciliación en la sección 6.3.

Skills aplicadas: `design-taste-frontend` (lectura de contexto: sector público, audiencia mayor, restricciones de accesibilidad que ANULAN preferencias estéticas; sin gradientes "IA", sin efectos de agencia), `mobile-first-design`, `patrones-implementacion-frontend`, `arquitecto-scream-feature-onion`, `testing-a11y-axe`, `mobile-native`, `web-design-guidelines` (requiere descargar su guía en línea; no se ejecutó aquí, queda como paso de revisión de la etapa 5), `ui-ux-pro-max` (no consultada en detalle: el plan se apoya en los principios ya citados).

Design Read: "Portal de servicios de talento humano para funcionarios y jubilados de un ente del Estado venezolano, con lenguaje institucional sobrio y de alta legibilidad, apoyado en Tailwind + shadcn con tokens propios CONATEL, sin motion decorativo."

---

## 1. Diagnóstico visual y de UX actual

Capturas (Playwright, sesión de la cuenta de prueba E2E, sin modificar datos), en `C:\Users\josef\AppData\Local\Temp\claude\C--Users-josef-OneDrive-Documentos-trabajo-GATH\3c3058f7-5a0e-4080-8ed7-9400e8639210\scratchpad\`:
- `rd_login_desk.png` (login, escritorio)
- `rd_ficha_desk.png`, `rd_ficha_mov.png` (/autogestion escritorio 1366 y móvil 390)
- `rd_censo_desk.png`, `rd_censo_mov.png` (/autogestion/censo)
- `rd_selector_desk.png`, `rd_selector_mov.png` (selector de módulos post-login)
Nota: en las capturas de /autogestion y /censo la cuenta E2E (rol ADMINISTRADOR, sin departamento) solo mostró esqueletos de carga; el diagnóstico de contenido se apoya en el código, el de marco visual en las capturas.

### 1.1 Hallazgos (con evidencia)

| # | Problema | Evidencia |
|---|---|---|
| D1 | Fondo de toda la app es una fotografía oscura/azul eléctrico (`bg.jpg`) con `backdrop-blur`, `overflow-hidden` en `body`. Las tarjetas flotan sobre un degradado azul-negro: sensación de "pantalla de juego", no de portal institucional; el contraste de texto depende de lo que haya detrás. | `src/app/layout.tsx:21-23`; capturas `rd_ficha_desk.png`, `rd_censo_desk.png` |
| D2 | Mezcla incoherente de superficies: sidebar blanco, cabecera azul sólido `bg-blue-900`, contenido azul oscuro con tarjetas translúcidas grises, botón de salir rojo saturado. No hay jerarquía ni sistema. | `src/components/layout/header.tsx:44`; `rd_ficha_desk.png` |
| D3 | Tokens de tema genéricos de shadcn (grises neutros; `--primary: oklch(0.55 0.2 250)`), sin paleta CONATEL. Modo oscuro invierte a primario casi blanco (`oklch(0.922 0 0)`), sin identidad. El `.dark` no se activa: `next-themes` solo se usa en `sonner.tsx`, no hay `ThemeProvider` en el layout raíz (el tema oscuro es código muerto para el usuario). | `src/app/globals.css:56-117`; grep `ThemeProvider` solo en `src/components/ui/sonner.tsx`; `src/app/layout.tsx` |
| D4 | Tipografía no cargada: `--font-sans: var(--font-geist-sans)` pero el layout no importa ninguna fuente con `next/font`; el navegador cae a la fuente del sistema. Hay una `Georgia.ttf` en `public/fonts` sin uso verificado. | `src/app/globals.css:11-12`; `src/app/layout.tsx` (sin `next/font`); `public/fonts/Georgia.ttf` |
| D5 | `<html lang="en">` en una app 100 % en español: lectores de pantalla pronuncian en inglés. Título "Gestion Administativa" con erratas (falta tilde, "Administativa"). `MarqueeTitle` anima `document.title` cada 200 ms: molesto, accesibilidad deficiente (WCAG 2.2.2) y ruido para lectores de pantalla. | `src/app/layout.tsx:12-13,21,25`; `src/components/marquee-title.tsx:7-20` |
| D6 | Sin `viewport` ni `themeColor` ni manifest declarados en `metadata`; no hay íconos de aplicación (solo `favicon.ico`/`favicon2.ico`). | `src/app/layout.tsx:9-11`; `src/app/` |
| D7 | Navegación de autogestión: sidebar con submenú desplegable de un único grupo; etiquetas administrativas ("Mi Expediente", "Censo de Vivienda", "Respuestas Encuesta", "Métricas") mezclan la vista del funcionario con la de administración (RAC). Enlace "Inicio" apunta a `/dashboard` (ruta legada, no a `/inicio`). Tamaño `text-sm` en todo. | `src/modules/autogestion/ui/components/app-sidebar-autogestion.tsx:55-130` |
| D8 | Tarjeta de identidad del sidebar usa `text-gray-400 font-bold` sobre blanco: contraste 2,54:1 (falla AA 4,5:1). Datos personales (nombre, cédula, rol, "Departamento: Sin Departamento") ocupan el espacio más valioso del menú. | `app-sidebar-autogestion.tsx:136-160`; cálculo de contraste en 2.2 |
| D9 | Login: panel de formulario translúcido gris-violeta; placeholder `#A9B0CF` sobre `#525B87` = 3,06:1 (falla AA); título con capitalización "Inicia Sesión Con Tus Credenciales". Logo CONATEL 3D cromado como imagen de relleno, no cintillo oficial. | `rd_login_desk.png`; `src/app/(auth)/login/page.tsx` |
| D10 | Menú global `AppNav` (12 secciones) existe pero NO se usa en el layout de autogestión (usa `SidebarProvider` propio). Dos sistemas de navegación coexisten. Header: `SidebarTrigger` con `scale-110`, sin etiqueta accesible visible. | `src/app/(app)/app-nav.tsx`; `src/app/(app)/autogestion/layout.tsx:16-27` |
| D11 | Vista "Mi expediente": 1 309 líneas en un solo componente; 7 pestañas horizontales (Personal, Laboral, Formación, Carnet, Salud, Familiares, Legal) con scroll horizontal en móvil; 23 usos de `text-xs`/`text-[10-11px]`; tarjetas con `border-t-4 amber`, sombras `shadow-2xl`, degradados y esquinas muy redondeadas (`rounded-2xl`) y colores tailwind sueltos (`from-[#001737]`, `amber-500`, `emerald-500`, `red-500`). | `src/modules/autogestion/ui/mi-expediente-view.tsx:242-247,343-365`; Grep `text-xs` |
| D12 | Estados solo por color o con tonos oscuros sobre fondos oscuros (`bg-red-950/20 text-white`), toasts de colores planos `!bg-lime-600`, `!bg-yellow-600` con texto blanco (contraste insuficiente para el amarillo/lima). | `src/modules/autogestion/ui/mi-expediente-view.tsx:117-123`; `src/app/(app)/layout.tsx:38-45` |
| D13 | No hay jerarquía por perfil: el funcionario activo, el personal pasivo y la administración ven la misma estructura. El proxy redirige a `/autogestion` si el rol es autogestión (`src/proxy.ts:67-74`) sin distinguir pasivo. | `src/proxy.ts:21,58-74` |
| D14 | Selector de módulos post-login ("Sistema de Información Integral / Seleccione un módulo") se muestra en la ruta `/login` y exige un clic extra para llegar a Autogestión; para un jubilado es un paso confuso. | Observado en la sesión de capturas (texto de página tras login) |
| D15 | Cámara: no existe ningún uso de `getUserMedia` ni `capture=` en `src/`. Hoy no hay captura de selfie. | Grep en `src/` (sin resultados) |
| D16 | Librerías de a11y: `@axe-core/playwright` **no está** en `package.json` pese a lo que dice la skill; hay specs E2E (`e2e/autogestion*.spec.ts`) pero ninguno de accesibilidad. | `NextJS/package.json`; `NextJS/e2e/` |

### 1.2 Service worker "Sin conexión a internet" en localhost:3000
- Búsqueda en `NextJS/src`, `next.config.ts`, `package.json` y `public/`: **no existe** código de service worker, manifest, next-pwa, serwist ni workbox. La única coincidencia es la extensión `webmanifest` en la exclusión del matcher de `src/proxy.ts:95` (preparación, no funcionalidad).
- Conclusión: el SW visto en `localhost:3000` NO pertenece a GATH. Es un residuo de otra aplicación servida antes en el mismo origen (`http://localhost:3000`) cuyo SW sigue registrado y responde su página offline cuando el servidor está caído.
- Acción: (a) en Chrome DevTools > Application > Service Workers > "Unregister" y "Clear site data" para `localhost:3000`; (b) durante desarrollo usar puertos distintos por proyecto o perfiles de navegador; (c) cuando GATH tenga su propio SW (etapa 4) usar `scope` explícito y versión de caché para evitar este problema; (d) nunca desplegar GATH en un origen que comparta host:puerto con otra PWA.

---

## 2. Dirección de diseño institucional CONATEL

### 2.1 Principios
1. Formal, sobrio y claro: fondo claro por defecto, tarjetas blancas con borde fino, sombra mínima. Cero fotografías de fondo en pantallas de trabajo (la foto/arte institucional queda solo para el login y la cabecera).
2. El color transmite significado, nunca decoración: azul institucional = acción/identidad; dorado y rojo del isotipo = acentos puntuales (línea superior, insignia); verde/ámbar/rojo = estados, siempre con ícono y texto.
3. Una sola superficie de navegación por perfil, con etiquetas en lenguaje del usuario ("Mi ficha", "Fe de vida", "Mis solicitudes"), no del sistema ("expediente", "censo de vivienda" para quien no lo necesita).
4. Tamaños pensados para usuarios mayores: base 18 px en perfil pasivo (ver sección 4).

### 2.2 Paleta (provisional hasta recibir el manual de identidad; ver preguntas P1-P2)
Valores en hex con relación de contraste calculada (WCAG 2.x, fórmula de luminancia relativa; script ejecutado en esta auditoría). AA exige 4,5:1 texto normal, 3:1 texto grande y componentes de UI.

Tema claro (por defecto)

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--background` | `#F6F8FB` | fondo de página | texto `#101A33` sobre él: 16,21:1 |
| `--card` | `#FFFFFF` | tarjetas | texto `#101A33`: 17,25:1 |
| `--foreground` | `#101A33` | texto principal | ver arriba |
| `--muted-foreground` | `#475467` | texto secundario | 7,69:1 sobre blanco; 7,23:1 sobre fondo |
| `--primary` | `#0B4A9E` | botones, enlaces, foco | 8,44:1 sobre blanco; blanco sobre él: 8,44:1 |
| `--brand-deep` | `#0A2A5E` | cabecera institucional | blanco sobre él: 13,95:1 |
| `--brand-gold` | `#F2B705` | filete/acento (NO texto sobre blanco) | sobre `#0A2A5E`: 7,67:1 |
| `--brand-red` | `#B3122B` | acento puntual / peligro | 6,91:1 sobre blanco |
| `--success` / fondo | `#17703A` / `#E8F5EC` | aprobado | 5,48:1 |
| `--warning` / fondo | `#7A4B00` / `#FFF3D1` | pendiente/observado | 6,70:1 |
| `--danger` / fondo | `#A8201A` / `#FDECEA` | rechazado/error | 6,36:1 |
| `--info` / fondo | `#0B4A9E` / `#E8F0FC` | en revisión | 7,36:1 |
| `--border-control` | `#6B7A90` | borde de inputs (UI 3:1) | 4,36:1 sobre blanco |

Tema oscuro (opcional; se activa con `ThemeProvider` y `color-scheme`, respetando `prefers-color-scheme`)

| Token | Valor | Contraste |
|---|---|---|
| `--background` / `--card` | `#0B1220` / `#131D31` | texto `#E8EDF7`: 15,95:1 / 14,34:1 |
| `--muted-foreground` | `#A9B4C8` | 8,05:1 sobre card |
| `--primary` | `#8DB8FF` (texto del botón `#0B1220`) | 8,36:1 / 9,30:1 |
| success / warning / danger | `#6FD08C` / `#F5C451` / `#FF8A80` | 8,88 / 10,34 / 7,37:1 sobre card |

Referencia de lo actual que falla: gris-400 `#9CA3AF` sobre blanco 2,54:1 (sidebar); placeholder del login 3,06:1. La implementación debe volver a medir con el script y con axe antes de cerrar cada etapa; los hex de marca se reemplazan por los del manual oficial manteniendo estas relaciones mínimas.

Implementación: redefinir `:root`/`.dark` en `src/app/globals.css` con estos tokens (manteniendo los nombres shadcn para no romper componentes) y añadir tokens semánticos (`--success`, `--warning`, `--info`, `--brand-*`) expuestos en `@theme inline`. Mantener oklch solo si se convierte exacto; se recomienda hex en tokens de marca para trazabilidad con el manual.

### 2.3 Tipografía
- Fuente de interfaz: una sola sans legible y libre, cargada con `next/font` (autoalojada, sin petición a Google en runtime). Recomendada `Source Sans 3` o `Noto Sans` (cobertura completa de tildes/ñ, buena legibilidad para lectores mayores); la fuente oficial del manual de identidad, si existe y está licenciada, la reemplaza (P3).
- Escala (base móvil, pasivo +2 px mediante clase `text-scale-lg` en `<html>`): cuerpo 16/18 px, etiqueta 14/16 px mínimo (se elimina `text-xs` y `text-[10px]` en contenido útil), subtítulo 20 px, título de página 28 px, interlineado 1,5, ancho de línea ≤ 70 caracteres.
- Corregir `<html lang="es-VE">`, título y descripción en `metadata` con ortografía correcta; eliminar `MarqueeTitle` (D5).

### 2.4 Iconografía
`lucide-react` (ya instalada, única librería permitida por la skill). Trazo 1,75-2 px, tamaño 20-24 px en acciones, siempre acompañado de texto en la navegación principal. Íconos decorativos con `aria-hidden`.

### 2.5 Logo y cintillo
- Cabecera institucional: cintillo oficial (la app ya tiene el módulo "Configuración visual / Cintillo editable", HU 0009: `src/modules/configuracion/ui/configuracion-visual-page.tsx`). Reutilizar ese cintillo configurable en el encabezado de Autogestión en lugar de imágenes fijas; fallback: `public/cintillo.jpg`/`cintillo2.png` (verificar cuál es el vigente).
- Isotipo para íconos PWA y favicon: extraer de `public/logoNuevo.png` o `logoNuevos.png` (revisar calidad/resolución; se necesita fuente vectorial o 1024×1024, P2).
- Login: lado izquierdo formulario sobre fondo blanco/azul profundo plano; lado derecho arte institucional estático (hoy se ve el logo cromado 3D); en móvil solo el cintillo y el formulario.
- Eliminar `bg.jpg` del `body`; deja de ser `overflow-hidden` salvo shells explícitos.

### 2.6 Componentes base (en `src/shared/ui/`, patrón R9 kebab-case, tipados, con Storybook si aplica)
1. `PageHeader` (título, descripción corta, migas, acción primaria).
2. `FichaCard` (tarjeta de dato: etiqueta arriba, valor abajo en tamaño de lectura, ícono opcional; lista de definición `<dl>`).
3. `StatusBadge` (estado = color + ícono + texto; mapa único: Pendiente, En revisión, Observada, Aprobada, Rechazada, Vencida) para reutilizar en solicitudes y fe de vida.
4. `SolicitudTimeline` (línea de tiempo vertical con `<ol>`, cada hito con fecha, actor, estado y nota; `aria-current="step"` en el vigente).
5. `StepForm` (formulario por pasos: indicador "Paso 2 de 4", un campo/grupo por pantalla, botón "Atrás/Continuar", resumen final; basado en react-hook-form + Zod ya existentes; no se usan `@formity/react` para no ampliar dependencia salvo que ya se emplee en el módulo).
6. `EmptyState`, `InlineAlert` (reutiliza `alert.tsx`), `ConfirmDialog` (reutiliza `alert-dialog.tsx`).
7. `CameraCapture` (sección 3.3) y `DocumentGuideOverlay`.
8. `FieldCompare` (visor comparativo, sección 3.4).
9. `SkipLink` y `LiveRegion` (anuncios para lector de pantalla).

Se reutilizan los primitivos shadcn existentes (`src/components/ui/*`); ajustar `button.tsx`, `input.tsx`, `tabs.tsx` para altura mínima 44/48 px y foco visible.

---

## 3. Arquitectura de información y pantallas clave

### 3.1 Navegación por perfil
Sustituir el sidebar de submenú por una navegación adaptable: barra lateral fija con etiquetas en escritorio (≥ lg) y **barra inferior de 4-5 destinos** en móvil (más cómoda para pulgares y para usuarios mayores) con el menú "Más". Los destinos dependen del perfil derivado de los permisos del usuario (permisos por código, regla R16 de la skill; no por nombre de rol).

Empleado activo
```
Inicio · Mi ficha integral · Solicitar actualización · Mis solicitudes · Notificaciones
(Más: Mi carnet · Censo de vivienda · Ayuda · Cerrar sesión)
```
Personal pasivo (jubilado/pensionado)
```
Inicio · Mi ficha · Fe de vida · Mis solicitudes · Notificaciones
(Más: Ayuda · Cerrar sesión)
```
Administración/RAC (ya existente; ocultar del flujo del funcionario y moverlo bajo "Administración")
```
Respuestas de encuesta · Métricas · Bandeja de fe de vida (Bienestar Social)
```
Estructura de archivos propuesta (aprovechando la arquitectura SCREAM+Onion; las pantallas son capa `ui/`, las rutas delgadas en `src/app/(app)/autogestion/**`):
```
src/app/(app)/autogestion/
  layout.tsx                  -> AutogestionShell (cabecera institucional + nav por perfil)
  page.tsx                    -> inicio por perfil (resumen y accesos)
  ficha/page.tsx              -> mi ficha (hoy mi-expediente-view)
  solicitudes/page.tsx        -> mis solicitudes + línea de tiempo
  solicitudes/nueva/page.tsx  -> solicitar actualización (StepForm)
  fe-de-vida/page.tsx         -> flujo fe de vida (cámara)
  notificaciones/page.tsx
  carnet/page.tsx · censo/ · consultar/ · metricas/
src/modules/autogestion/ui/
  shell/ (autogestion-shell.tsx, nav-por-perfil.tsx, header-institucional.tsx)
  ficha/ (ficha-integral.tsx dividida por secciones; reemplaza el monolito de 1 309 líneas)
  solicitudes/ · fe-de-vida/ (camera-capture.tsx, guia-encuadre.tsx, vista-previa.tsx)
  comparativo/ (field-compare.tsx)
```
La partición de `mi-expediente-view.tsx` se hace por pestaña existente, sin cambiar la lógica ni las acciones del servidor (las rutas viejas redirigen a las nuevas para no romper marcadores ni los specs E2E existentes).

### 3.2 Wireframes (ASCII)

Inicio, móvil, perfil pasivo
```
+--------------------------------+
| [cintillo CONATEL]    [Salir]  |
+--------------------------------+
| Buenos días, MARÍA PÉREZ       |
| Cédula V-1.234.567             |
|--------------------------------|
| [!] Su fe de vida vence en     |
|     12 días                    |
|  [ Realizar fe de vida ]  48px |
|--------------------------------|
| Mi ficha            Mis        |
| [ícono]             solicitudes|
| Ver mis datos       (2) en     |
|                     revisión   |
|--------------------------------|
| Notificaciones (1 nueva)    >  |
+--------------------------------+
| Inicio|Ficha|Fe vida|Solic.|Avisos|
+--------------------------------+
```

Mi ficha (escritorio)
```
+-------------------------------------------------------------+
| [cintillo]  Autogestión de Personal           [Usuario v]   |
+---------+---------------------------------------------------+
| Inicio  | Mi ficha integral                                 |
| Mi ficha| [Foto] MARÍA PÉREZ   Cédula V-1.234.567           |
| Solicit.| Condición: Jubilada · Dirección: ...    [Imprimir]|
| Avisos  |---------------------------------------------------|
| Carnet  | [Datos personales][Laboral][Formación][Salud]...  |
|         | +-----------------+  +-------------------------+  |
|         | | Nombre completo |  | Estado civil            |  |
|         | | MARÍA PÉREZ     |  | Casada                  |  |
|         | +-----------------+  +-------------------------+  |
|         | [ Solicitar actualización de estos datos ]        |
+---------+---------------------------------------------------+
```
Las 7 pestañas pasan a secciones con índice lateral en escritorio y acordeón en móvil (sin scroll horizontal).

Mis solicitudes con línea de tiempo
```
Solicitud #0123 · Actualización de dirección        [En revisión]
 o--- 28/10 Enviada por usted
 o--- 29/10 Recibida en Bienestar Social
 (o)- En revisión (paso actual)
 .--- Resolución pendiente
[ Ver detalle ]   [ Cancelar solicitud ]
```

### 3.3 Flujo de captura de cámara (fe de vida: selfie con la cédula)
Pantalla `Fe de vida` por pasos (`StepForm`), 4 pasos: 1 Instrucciones · 2 Foto con cédula · 3 Revisar · 4 Enviar y recibo. La lógica de negocio (qué se guarda, validez, vencimiento) pertenece al plan funcional; aquí solo la interfaz.

Detección y orden de preferencia
1. Contexto seguro: `window.isSecureContext && navigator.mediaDevices?.getUserMedia`. Si falta, ir a estado "Sin TLS" (abajo).
2. Cámara en vivo con `getUserMedia({ video: { facingMode: "user", width:{ideal:1280}, height:{ideal:720} }, audio:false })`; botón "Cambiar cámara" si `enumerateDevices()` expone varias.
3. Respaldo: `<input type="file" accept="image/*" capture="user">` (en móvil abre la cámara nativa; en escritorio abre el selector de archivos). El respaldo se ofrece siempre como segundo botón: "Usar la cámara de mi teléfono / elegir foto".
4. Captura a `<canvas>` → `canvas.toBlob("image/jpeg", 0.85)`, lado largo máx. 1600 px, sin metadatos EXIF de ubicación; revocar `URL.createObjectURL` y detener `stream.getTracks().forEach(t=>t.stop())` al salir, al cambiar de paso o con `visibilitychange`.

Pantallas (móvil)
```
Paso 1 de 4 · Instrucciones                 Paso 2 de 4 · Foto
+--------------------------------+      +--------------------------------+
| Necesitamos una foto suya      |      | [ vista en vivo de cámara ]    |
| sosteniendo su cédula.         |      |   +----------------------+     |
| 1. Busque buena luz.           |      |   |   (  rostro  )       |     |
| 2. Sostenga la cédula junto    |      |   |      ____________    |     |
|    a su cara, sin tapar.       |      |   |     |  cédula    |   |     |
| 3. Mire a la cámara.           |      |   |     |____________|   |     |
| [ Activar cámara ]        48px |      |   +----------------------+     |
| [ Usar foto ya tomada ]        |      | "Coloque su cara y la cédula   |
|                                |      |  dentro de los marcos"         |
|                                |      | [  ( ) Tomar foto  ]  72px     |
+--------------------------------+      +--------------------------------+

Paso 3 de 4 · Revisar                    Paso 4 de 4 · Enviado
+--------------------------------+      +--------------------------------+
| [ foto tomada, ampliable ]     |      | [check] Fe de vida enviada     |
| ¿Se ve su cara y el número     |      | Recibo N.º FV-2026-0456        |
|  de su cédula con claridad?    |      | Fecha 29/10/2026 10:42         |
| [ Sí, enviar ]  [ Repetir ]    |      | [ Ver mis solicitudes ]        |
+--------------------------------+      +--------------------------------+
```
Guía de encuadre: superposición SVG con dos marcos (óvalo para rostro, rectángulo con proporción de cédula 85,6×54 mm) y texto en vivo ("Acerque la cédula", "Más luz") sin análisis de imagen en el cliente en la primera versión (no hay detección facial; evaluar aparte si el plan funcional lo exige). Aviso de privacidad breve antes de activar la cámara (qué se guarda y quién lo ve).

Estados de error (mensajes en lenguaje claro, con acción)
| Caso | Detección | Mensaje y acción |
|---|---|---|
| Sin cámara | `NotFoundError`/`OverconstrainedError` o `enumerateDevices` sin `videoinput` | "No encontramos una cámara en este dispositivo." Botón "Elegir una foto desde mi equipo" (input). |
| Permiso denegado | `NotAllowedError` | "El navegador no tiene permiso para usar la cámara." Instrucciones por navegador (candado de la barra de direcciones > Permisos > Cámara > Permitir) y botón "Intentar de nuevo" + respaldo input. |
| Cámara ocupada | `NotReadableError`/`AbortError` | "Otra aplicación está usando la cámara. Ciérrela e intente de nuevo." |
| Sin contexto seguro (HTTP) | `!window.isSecureContext` o `mediaDevices` indefinido | "Esta conexión no es segura, la cámara está bloqueada. Abra GATH desde la dirección oficial https://..." + respaldo `capture` (en HTTP el input de archivo sigue funcionando en la mayoría de móviles, aunque la PWA no). Registrar el evento para soporte. |
| Foto muy oscura/borrosa | (opcional) luminancia media del canvas < umbral | Aviso no bloqueante "La foto parece oscura, ¿repetir?" |
| Fallo de red al enviar | rechazo de la acción | Mantener la foto en memoria, "No pudimos enviar. Reintentar" (sin guardar en IndexedDB: es dato personal, ver 5.3). |
Todos los mensajes en una región `role="alert"`/`aria-live`; el foco se mueve al mensaje.

### 3.4 Visor comparativo campo por campo (Bienestar Social)
Usado por quien revisa la solicitud de fe de vida o de actualización; muestra lo declarado frente a lo registrado.
```
Solicitud #0456 · Fe de vida · MARÍA PÉREZ · V-1.234.567     [En revisión]
+---------------------------+--------------------------------------+
| IMAGEN RECIBIDA           | CAMPO A CAMPO                        |
| [selfie con cédula]       | Campo        Registrado   Declarado  |
|  zoom + y -  rotar        | Nombres      MARÍA PÉREZ  = coincide |
|                           | Cédula       1.234.567    = coincide |
| [foto del expediente]     | Apellidos    PÉREZ L.     ≠ difiere  |
|  (comparar lado a lado)   | Fec. nacim.  03/04/1950   = coincide |
+---------------------------+--------------------------------------+
| Nota del revisor [______________________________]                |
| [ Aprobar ]   [ Observar ]   [ Rechazar ] (motivo obligatorio)     |
+------------------------------------------------------------------+
```
Cada fila: ícono + texto ("coincide", "difiere", "no declarado"), nunca solo color. En móvil las filas se apilan (etiqueta, registrado, declarado). Atajos de teclado para zoom; imagen con `alt` descriptivo; el visor solo se muestra a usuarios con el permiso de revisión (permiso por código a definir en el plan funcional).

---

## 4. Accesibilidad para usuarios mayores

Reglas de producto (se verifican en revisión de PR y con axe):
1. Texto: cuerpo 18 px en perfil pasivo (16 px mínimo en activos), nada por debajo de 14 px; control de tamaño de texto A+/A- visible en la cabecera (guardado en `localStorage`, solo conveniencia). Respeta el zoom del navegador hasta 200 % sin pérdida de contenido (no bloquear `user-scalable`).
2. Objetivos táctiles ≥ 44×44 px (meta 48 px; la skill mobile-first usa 48) con separación ≥ 8 px; botones de acción principal de ancho completo en móvil, 56 px en el paso de cámara. Eliminar `Button size="xs"` y `sm` en acciones del funcionario.
3. Una acción principal por pantalla, etiquetas con verbo ("Realizar fe de vida", no "Continuar"), lenguaje sin tecnicismos ("expediente" → "ficha"), confirmaciones antes de enviar, mensajes de error que dicen qué hacer.
4. Foco visible: anillo 3 px `--primary` con offset, nunca `outline: none` sin sustituto (hoy `globals.css` solo aplica ring a input/textarea: ampliar a `:focus-visible` global). Orden de tabulación lógico, `SkipLink` "Saltar al contenido", `<main id>` único.
5. Lector de pantalla: `lang="es-VE"`, un `<h1>` por pantalla, landmarks (`header`, `nav aria-label`, `main`), `aria-current="page"`, `aria-live="polite"` para estados de solicitud y resultado de cámara, etiquetas `<label>` visibles (no solo placeholder), `aria-describedby` para errores, texto alternativo del estado (no solo color). Línea de tiempo como `<ol>`.
6. Movimiento: respetar `prefers-reduced-motion` (sin animaciones decorativas; las transiciones de 150-200 ms solo para foco/estado). Quitar el título animado (D5).
7. Tiempo: la sesión caduca a las 8 h (`session.maxAge` por D-08); el componente `AuthController`/`auth-timer` debe avisar con diálogo accesible y permitir extender (revisar que el aviso sea anunciado y operable por teclado).
8. Formularios: un tema por paso, validación al salir del campo y al enviar, resumen de errores enfocado, `autocomplete` correcto, `inputmode="numeric"` en cédula.
9. Color: cumplir tabla 2.2; estados con ícono+texto; no usar rojo/verde como única diferencia.

Pruebas (skill `testing-a11y-axe`)
- Instalar `@axe-core/playwright` (hoy NO está instalado): `pnpm add -D @axe-core/playwright` en `NextJS/`.
- Crear `e2e/specs/accesibilidad.spec.ts` con alias `base`/`authTest` como indica la skill, un caso por ruta nueva: `/login`, `/autogestion`, `/autogestion/ficha`, `/autogestion/solicitudes`, `/autogestion/solicitudes/nueva`, `/autogestion/fe-de-vida`, `/autogestion/notificaciones`, `/autogestion/carnet`, y el visor comparativo. Cada ruta nueva necesita su Page Object en `e2e/pages/` (convención de la skill de E2E).
- Criterio: 0 violaciones `serious`/`critical` desde la etapa 2; 0 totales al cierre de la etapa 5. Ejecutar en Chromium, Firefox y WebKit y en viewport 390×844 y 1366×800.
- Casos manuales: lector de pantalla (NVDA en Windows, TalkBack en Android, VoiceOver en iOS) sobre el flujo de fe de vida; solo teclado; zoom 200 %; modo de alto contraste de Windows; revisión con 2-3 usuarios mayores reales (P7).
- Pruebas unitarias (Vitest) de los mapas de estado (`StatusBadge`) y del módulo de detección de cámara (mock de `navigator.mediaDevices` para cada error).

---

## 5. PWA

### 5.1 Qué es (y qué no) para GATH
Objetivo: instalable en pantalla de inicio (Android/iOS), pantalla completa sin barra del navegador, íconos institucionales, y la **cámara**. Importante: la cámara NO depende de ser PWA; depende de contexto seguro (HTTPS) y del permiso del usuario. La PWA aporta instalación y experiencia. No se busca modo offline de datos: son datos personales de un sistema de talento humano.

### 5.2 Manifest (nativo de Next 16, sin librería)
Crear `NextJS/src/app/manifest.ts` (convención `MetadataRoute.Manifest`, servida en `/manifest.webmanifest`, que ya está excluida del matcher del proxy en `src/proxy.ts:95`):
```
name: "GATH - Gestión Administrativa de Talento Humano"
short_name: "GATH"
description: "Portal de autogestión de personal de CONATEL"
lang: "es-VE"; dir: "ltr"
start_url: "/autogestion?source=pwa"  (se evalúa que redirija a login si no hay sesión)
scope: "/"
display: "standalone"
orientation: "portrait-primary"
background_color: "#F6F8FB"
theme_color: "#0A2A5E"
icons: 192, 512 (purpose any) + 512 maskable + apple-touch-icon 180
shortcuts: "Fe de vida", "Mis solicitudes"
```
Íconos: generar desde el isotipo institucional (P2) en `public/icons/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` 180×180) y favicon; zona segura del 80 % para maskable.
En `src/app/layout.tsx` exportar `viewport` (`themeColor`, `width=device-width`, `initialScale=1`, `viewportFit: "cover"`) y `metadata` con `manifest`, `appleWebApp` (`capable`, `title`, `statusBarStyle`) e `icons`. Usar `env(safe-area-inset-*)`, `100dvh` y `-webkit-tap-highlight-color`/`touch-action: manipulation` según la skill `mobile-native` para sentido "app" en móvil; inputs ≥ 16 px para evitar zoom en iOS.

### 5.3 Service worker
Decisión: **service worker propio mínimo en `public/sw.js`, registrado desde un componente cliente, sin librería** (justificación: el único caso de uso es instalabilidad + página offline; Serwist/next-pwa añaden precaching con Webpack, configuración de build y riesgo de cachear respuestas autenticadas; además el proyecto usa Turbopack en `next dev`, con soporte incierto de esos plugins. La opción nativa evita dependencias nuevas y es auditable en ~60 líneas). Alternativa a revisar solo si el equipo exige precaching automático: `@serwist/next` (sucesor mantenido de next-pwa) detrás de `--webpack` en `next build`; no recomendada en esta fase.

Estrategia de caché (segura por defecto)
- `install`: precachear SOLO `/offline` (página estática sin datos), ícono y fuente propia, con nombre de caché versionado `gath-static-vN`.
- `fetch`:
  - Navegaciones (`request.mode === "navigate"`): red primero; si falla la red, responder `/offline`. **Nunca** guardar la respuesta de una navegación en caché (son HTML autenticado).
  - Activos inmutables `/_next/static/**`, `/icons/**`, fuentes: `stale-while-revalidate` o cache-first (son públicos y con hash).
  - **Excluir siempre del SW** (pasar directo a red, sin `respondWith`): `/api/**` (incluye `/api/auth/**`), peticiones con cabecera `Authorization`/cookies de sesión, acciones de servidor (método `POST`), `/autogestion/**` como datos, descargas (PDF/carnets) y cualquier URL del backend (`/api/v1`). Solo manejar `GET` del mismo origen.
  - Respuestas con `Cache-Control: no-store` o `Set-Cookie` no se almacenan.
- `activate`: borrar cachés con prefijo `gath-` distinto al vigente; `clients.claim()` solo tras aviso.
- Al cerrar sesión: enviar mensaje al SW para vaciar cualquier caché dinámico (defensa en profundidad; en este diseño no hay cachés de datos).
- Página `/offline`: `src/app/offline/page.tsx` estática, con cintillo, texto "No hay conexión a internet. GATH necesita conexión para mostrar sus datos. Revise su red e inténtelo de nuevo." y botón "Reintentar" (`location.reload()`); fuera del grupo protegido y permitida en el proxy (agregarla a las rutas públicas de `src/proxy.ts`). Esto corrige el problema observado del SW ajeno con "Sin conexión a internet" (1.2).
- Cabeceras HTTP: servir `/sw.js` con `Cache-Control: no-cache, no-store, must-revalidate` y `Service-Worker-Allowed: /` vía `headers()` en `next.config.ts`; CSP que permita `worker-src 'self'` y `media-src 'self' blob:` (la vista previa de la foto usa `blob:`), y `Permissions-Policy: camera=(self)` (por defecto Next no la fija; definirla explícitamente para que la cámara quede permitida solo al propio origen).
- Registro: `src/shared/pwa/registrar-sw.tsx` (Client Component montado en el layout raíz), solo si `process.env.NODE_ENV === "production"` y `isSecureContext`; en desarrollo deshabilitado para evitar el problema de SW residual en localhost.

### 5.4 Instalación y actualización
- Android/Chrome: capturar `beforeinstallprompt` y mostrar un botón propio "Instalar GATH en mi teléfono" (en Ayuda y en inicio, una sola vez, descartable; nunca modal bloqueante).
- iOS/Safari: no existe `beforeinstallprompt`; mostrar guía ilustrada breve ("Compartir > Añadir a pantalla de inicio") solo en Safari iOS no instalado (`navigator.standalone === false`). Nota: en iOS la cámara en PWA instalada funciona con `getUserMedia` en iOS ≥ 16.4; validar en dispositivo real (P6).
- Actualizaciones: versión de caché en `sw.js`; al detectar `registration.waiting`, mostrar aviso "Hay una versión nueva de GATH. [Actualizar]" y recargar tras `skipWaiting` con confirmación del usuario (no forzar durante el llenado de un formulario/foto).
- Pruebas: Lighthouse (categoría PWA/instalabilidad) en Chrome contra el entorno HTTPS; prueba manual de instalación en Android y iOS; E2E de que `/manifest.webmanifest` responde 200 y que `/api/**` no está en ninguna caché (inspeccionar `caches.keys()`).

### 5.5 REQUISITO BLOQUEANTE: contexto seguro (nginx + TLS)
Hallazgos del repo: `compose.yml` publica `django` y `nextjs` directo al host (puertos 8001 y 3001) y fija `NEXTAUTH_URL=http://localhost:3001` (`compose.yml:42`); no hay servicio nginx (el único `staticfiles` en `compose.yml:171` sirve estáticos). El backend toma `AUTH_COOKIE_SECURE` de `DJANGO_COOKIE_SECURE`, que por defecto es `not DEBUG` (`BACKEND/GATH/settings.py:286`); `ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS` salen de variables de entorno (`settings.py:34-38,86-93`). `getUserMedia` y los service workers solo funcionan en HTTPS o `localhost`: desde un teléfono accediendo por IP `http://172.16.x.x:3001` la cámara y la PWA NO funcionarán.

Tarea: añadir un servicio `nginx` (imagen `nginx:1.27-alpine`) como único punto expuesto (80→redirige a 443; 443 TLS), con red `backend` interna para `nextjs` y `django` (que dejan de publicar puertos al host, según la skill `despliegue-docker-django-nextjs`). Configuración mínima:
- `server_name gath.<dominio-institucional>` (P4) con `ssl_certificate`/`ssl_certificate_key` montados como volumen de solo lectura desde el almacén del servidor (nunca en git), `ssl_protocols TLSv1.2 TLSv1.3`, HSTS, redirección 80→443.
- `location /` → `nextjs:3000` con `X-Forwarded-Proto`, `X-Forwarded-Host`, `Host`, soporte de websocket/HMR no necesario en producción; `client_max_body_size 25m` (coherente con `serverActions.bodySizeLimit: "25mb"` en `next.config.ts`).
- `location /api/v1/` y estáticos/media de Django según se publiquen hoy (verificar cómo consume el frontend el backend: por red interna desde el servidor Next; si es solo servidor a servidor no es necesario exponer Django).
- Cabeceras de seguridad: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy: camera=(self)`.
Variables de entorno al activar HTTPS: `DJANGO_COOKIE_SECURE=True` (el `.env.example` y el compose deben reflejarlo), `NEXTAUTH_URL=https://gath.<dominio>`, `AUTH_TRUST_HOST=true` (Auth.js detrás de proxy) y que las cookies de next-auth pasen a `__Secure-`; `DJANGO_ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS` con el nuevo origen https; `SECURE_PROXY_SSL_HEADER` y `CSRF_TRUSTED_ORIGINS` en Django si procede (añadir a `settings.py` solo lo necesario; coordinar con el responsable del backend). Efecto: las sesiones existentes se invalidan en el cambio (avisar). La cuenta E2E y los tests `playwright.config.ts` deben apuntar a la URL https o conservar `localhost` para desarrollo.
Desarrollo local: `localhost` ya es contexto seguro (cámara y SW funcionan en `http://localhost:3001`); para probar desde el teléfono en red local usar `mkcert` + nginx local o un túnel HTTPS temporal; documentar en README.
Certificado: ver preguntas P4 (CA institucional vs Let's Encrypt; si el servidor no es accesible desde internet, Let's Encrypt por desafío DNS o CA interna con el certificado raíz instalado en los dispositivos, lo que complica el uso desde teléfonos de jubilados; preferible un certificado emitido por una CA pública/estatal reconocida).

---

## 6. Plan por etapas

Esfuerzo: S ≤ 1 día, M 2-4 días, L 1-2 semanas (un desarrollador). Orden pensado para entregar valor visible pronto sin bloquear al plan funcional.

### Etapa 0 — Decisiones y limpieza previa (S)
- Obtener manual de identidad/colores/fuente/íconos (P1-P3); confirmar dominio y certificado (P4).
- Desregistrar el SW ajeno de `localhost:3000` en los equipos de desarrollo (1.2).
- Corregir `lang="es-VE"`, título, retirar `MarqueeTitle` (`src/app/layout.tsx`, `src/components/marquee-title.tsx`).
- Salida: manual recibido o decisión de usar la paleta provisional; navegador sin SW residual.

### Etapa 1 — Tokens, tipografía y shell institucional (M)
- Modificar: `src/app/globals.css` (tokens 2.2, foco global, tipografía), `src/app/layout.tsx` (`next/font`, `ThemeProvider`, quitar fondo `bg.jpg`, `viewport`), `src/components/ui/{button,input,tabs}.tsx` (alturas), `src/app/(app)/layout.tsx` (toasts con colores AA, ver D12).
- Crear: `src/modules/autogestion/ui/shell/*` (header institucional con cintillo configurable, nav por perfil lateral/inferior), `src/shared/ui/{page-header,status-badge,skip-link}.tsx`.
- Reemplazar `app-sidebar-autogestion.tsx` y `src/app/(app)/autogestion/layout.tsx`.
- Salida: Autogestión con nuevo marco, tema claro AA verificado, tema oscuro funcional, sin regresiones en `e2e/autogestion*.spec.ts` (actualizar selectores si cambian etiquetas), axe 0 serious/critical en shell. Captura "después" en móvil y escritorio.

### Etapa 2 — Pantallas del funcionario: ficha, solicitudes, avisos (L)
- Dividir `mi-expediente-view.tsx` en componentes por sección; `FichaCard`, secciones con índice/acordeón; rutas `ficha`, `solicitudes`, `solicitudes/nueva` (StepForm), `notificaciones`, `carnet`; redirecciones desde rutas antiguas. Línea de tiempo `SolicitudTimeline`.
- Menús por perfil (activo/pasivo/administración) con permisos por código (coordinar con `src/proxy.ts` y el plan funcional).
- Salida: ambos perfiles navegan sin scroll horizontal en 390 px; contraste y tamaños según sección 4; `accesibilidad.spec.ts` creado (instalar axe) con las rutas de esta etapa en verde.

### Etapa 3 — Flujo de cámara en la interfaz (M)
- Crear `src/modules/autogestion/ui/fe-de-vida/{camera-capture,guia-encuadre,vista-previa,paso-instrucciones}.tsx` y `src/shared/hooks/use-camara.ts` (detección, errores, limpieza de pistas). Integrar con la acción de servidor de fe de vida que defina el plan funcional (el cliente solo entrega un `File`/`Blob` JPEG); límite de tamaño y tipo validado con Zod.
- Pruebas: Vitest (mock de `mediaDevices` para los 5 errores), E2E con Chromium `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` y permisos concedidos; prueba del respaldo `input capture`.
- Salida: captura, repetición, envío y errores funcionan en Chrome Android real, Safari iOS real y escritorio; el flujo completo se puede hacer solo con teclado y lector.

### Etapa 4 — Infraestructura segura: nginx + TLS (M) — BLOQUEANTE para producción de cámara y PWA
- Crear: servicio `nginx` en `compose.yml` y `infra/nginx/*.conf` (o carpeta equivalente fuera de `NextJS`); retirar `ports` de `django`/`nextjs`; actualizar `.env.example`/`compose.example.yml` con `DJANGO_COOKIE_SECURE`, `NEXTAUTH_URL`, hosts y orígenes; ajustes en `BACKEND/GATH/settings.py` (proxy SSL, CSRF) solo si hace falta.
- Pruebas: `curl -I https://...`, HSTS, redirección 80→443, login completo en https, cookies `Secure`, cámara disponible desde un teléfono por la URL oficial, sesión estable.
- Salida: acceso de usuarios únicamente por HTTPS con certificado válido; E2E contra la URL https en verde.
- Nota: puede ejecutarse en paralelo a las etapas 1-3 (depende de P4); sin ella, la cámara solo se valida en `localhost`.

### Etapa 5 — PWA (M)
- Crear: `src/app/manifest.ts`, `public/icons/*`, `public/sw.js`, `src/shared/pwa/{registrar-sw,boton-instalar,aviso-actualizacion}.tsx`, `src/app/offline/page.tsx`; modificar `next.config.ts` (cabeceras de `sw.js`, CSP, `Permissions-Policy`), `src/proxy.ts` (permitir `/offline`, `/sw.js`, `/manifest.webmanifest`, `/icons/**`), `src/app/layout.tsx` (metadata PWA).
- Pruebas: Lighthouse instalable; E2E de manifest/offline; verificación de que no se cachean respuestas autenticadas (`caches.keys()` y contenido); instalación real en Android e iOS; prueba de actualización de versión.
- Salida: instalable, offline correcto, 0 datos personales en cachés, auditoría de `web-design-guidelines` sin hallazgos críticos.

### Etapa 6 — Visor comparativo y administración (M)
- Crear `src/modules/autogestion/ui/comparativo/field-compare.tsx` y la bandeja de revisión (coordinada con el plan funcional); aplicar el sistema visual a `consultar`, `metricas`, `censo` y login (`src/app/(auth)/login/page.tsx`, selector de módulos).
- Salida: Bienestar Social compara imagen y datos campo por campo con teclado y lector; axe 0 violaciones en todas las rutas; revisión final con usuarios mayores y capturas antes/después en el cierre.

### 6.3 Coordinación con el plan funcional (`PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md`, ya leído)

Regla general: el plan funcional manda en negocio, backend, permisos, estados e infraestructura; este plan solo entrega la capa visual/PWA y consume sus contratos. Nada de lo siguiente se implementa dos veces.

**a) Estados (fuente: plan funcional 2.1 y 2.2). `StatusBadge` y `SolicitudTimeline` deben mapearlos 1:1 (color + ícono + texto en español claro); sustituye mi lista provisional de la sección 2.6.**
| Tipo | Estados del backend | Texto sugerido en pantalla |
|---|---|---|
| Solicitud de actualización | SOLICITADA, HABILITADA, ENVIADA, APROBADA, APROBADA_PARCIAL, RECHAZADA, EXPIRADA | Solicitada; Habilitada para editar; Enviada; Aprobada; Aprobada en parte; Rechazada; Vencida |
| Fe de vida | BORRADOR, PENDIENTE_REVISION, PENDIENTE_SEGUNDO_CHECK, VALIDADA, RECHAZADA, REPETICION_SOLICITADA, EXPIRADA, ARCHIVADA | Borrador; En revisión; En revisión final; Validada; Rechazada; Debe repetir la foto; Vencida; Archivada |
Cara al pasivo, PENDIENTE_SEGUNDO_CHECK se muestra como "En revisión final" (no expone la jerarquía interna); REPETICION_SOLICITADA lleva el botón "Repetir toma" y el motivo visible (C14). El pasivo nunca ve la palabra "recomendada".

**b) Rutas.** Mantengo `/autogestion/ficha`, `/solicitudes`, `/solicitudes/nueva`, `/notificaciones`, `/carnet`. La fe de vida vive en `/autogestion/fe-de-vida` (menú "Solicitud o renovación de acta de comparecencia / fe de vida", C11) como ruta delgada que monta `src/modules/fe-de-vida/ui/**` (módulo de C10, no dentro de `modules/autogestion`); las piezas visuales genéricas (`StatusBadge`, `PageHeader`, `StepForm`, `FieldCompare`) quedan en `src/shared/ui/` y las importan ambos módulos. Las rutas del revisor (bandeja y visor) las define el plan funcional (B y C15, en Gestión de Trabajadores); mi `FieldCompare` es el componente visual que usan.

**c) Permisos (el menú por perfil se construye con `tienePermiso`, nunca con `nombre_rol`; coherente con la etapa D).**
| Entrada de menú / pantalla | Permiso |
|---|---|
| Mi ficha | `autogestion.ver_propio` |
| Solicitar actualización / Mis solicitudes | `autogestion.solicitar_actualizacion` (+ `autogestion.editar_borrador`, `autogestion.subir_soporte` dentro del formulario) |
| Fe de vida (menú del pasivo) | `fe_de_vida.solicitar` y `fe_de_vida.ver_propia` |
| Notificaciones | `notificaciones.ver_propias` |
| Mi carnet, Censo | los de carnet/censo existentes (se ocultan al rol PASIVO) |
| Visor comparativo / bandeja Bienestar | `bienestar.revisar_actualizacion`, `fe_de_vida.revisar`; selfie solo con `fe_de_vida.ver_evidencia`; botones de check solo con `bienestar.check_analista` / `bienestar.check_administradora` y `fe_de_vida.check_analista` / `fe_de_vida.check_administradora`; "Aprobación directa" solo con `bienestar.aprobar_directo` / `fe_de_vida.aprobar_directo` (justificación obligatoria) |
| Respuestas de encuesta, Métricas (administración) | permisos propios del módulo; reemplazan la condición `isRacAdmin` de `app-sidebar-autogestion.tsx` |
Perfil "activo" vs "pasivo" = presencia del rol `PASIVO` o de sus permisos (el plan funcional crea el rol, 2.4); mientras A4 no esté desplegado, el shell lee permisos con un mapa en `shared/lib/evaluador-iam.ts` (A8) y no hardcodea roles.

**d) Mapa de etapas (para no duplicar trabajo).**
| Etapa de este plan | Se apoya en / coincide con (plan funcional) | Qué hago aquí y qué NO |
|---|---|---|
| 0 Decisiones y limpieza | pregunta de certificado/dominio es la misma de C0 | Solo manual de identidad y lang/título. |
| 1 Tokens, tipografía y shell | Independiente; no requiere backend | Puede empezar ya, en paralelo a A. El shell se hace con la matriz de permisos de 2.4 (se alinea con A8/D1). |
| 2 Ficha, solicitudes, avisos | **B (B8-B10)** y **A2** (notificaciones) | La UI de B10 ("Mis solicitudes", "Solicitar actualización", soportes) se construye con el sistema visual de este plan: B10 y la etapa 2 son UNA sola entrega; no hacer B10 con diseño viejo. Campana/bandeja de A: solo estilo. |
| 3 Cámara (interfaz) | **C13** (`CapturaCedulaEnVivo`) y C12 | Mi sección 3.3 es la especificación visual/UX de C13; el componente se llama `CapturaCedulaEnVivo` (renombro `CameraCapture`) y se implementa una vez, dentro de la etapa C. Aquí no hay captura propia. |
| 4 nginx + TLS | **C0** (idéntico) | Esta etapa se elimina como tarea propia: se ejecuta como C0 (M, camino crítico, depende de TI). Solo añado aquí los criterios que PWA exige además (CSP `worker-src`, `media-src blob:`, `Service-Worker-Allowed`, HSTS) para que se incluyan en C0. |
| 5 PWA | **C0** (precondición) y E4 (cabeceras/CSP) | manifest, SW, `/offline`, instalación; no depende del backend, solo del HTTPS para probar instalación real. |
| 6 Visor comparativo y admin | **B (`/comparativo/`, decidir)**, **C15** y E5 | `FieldCompare` y estilo de la bandeja; reglas de aprobación (doble check Analista + Administradora en orden indistinto; excepción de aprobación directa de la Administradora) son de C2/C3. |
| Accesibilidad con axe | **E4** (pruebas de seguridad) y tests por etapa | Los specs de axe se agregan por etapa en `e2e/specs/accesibilidad.spec.ts`; no esperar a E. |

**e) Orden combinado recomendado.** C0 se pide a TI desde el día 1 (certificado y dominio). En paralelo: A (backend/notificaciones/permisos) y mi Etapa 1 (shell visual). Luego B + mi Etapa 2 como una sola entrega; C + mi Etapa 3 (cámara) como una sola entrega, validando la cámara en HTTPS cuando C0 esté; mi Etapa 5 (PWA) tras C0; D reutiliza el shell por permisos; E incluye el cierre de a11y y CSP. Esto adelanta el valor visible (Etapa 1) sin esperar a A.

**f) Dependencias técnicas.** El visor y las pantallas de fe de vida usan datos simulados y feature flag hasta que existan los endpoints (B/C). La captura entrega un `Blob` JPEG por `FormData` (C13); retención, cifrado, URL prefirmada de 60-120 s y auditoría de acceso a la evidencia son del plan funcional (2.6, C9).

---

## 7. Riesgos y preguntas

### Riesgos
| Riesgo | Mitigación |
|---|---|
| Sin TLS válido, cámara y PWA no funcionan en teléfonos; es el mayor bloqueo. | Etapa 4 temprana; respaldo `input capture`; documentación local con `mkcert`. |
| Cambiar a HTTPS invalida sesiones y exige cambio simultáneo de `NEXTAUTH_URL` y cookies. | Ventana de mantenimiento, aviso a usuarios, lista de verificación de variables. |
| Cachear datos personales por error en el SW. | Estrategia "red primero, nunca cachear navegaciones ni `/api`", prueba automatizada de cachés, revisión de seguridad. |
| Rediseño del monolito `mi-expediente-view.tsx` rompe E2E y lógica. | Dividir sin cambiar acciones; redirecciones de rutas; ejecutar `e2e/autogestion*.spec.ts` en cada PR. |
| Safari iOS limita cámara en PWA y notificaciones push. | Prueba en dispositivo real; respaldo `input capture`; no prometer push en esta fase. |
| Foto de rostro y cédula son datos sensibles. | Mínimo en cliente (sin IndexedDB, revocar blobs), aviso de privacidad, transporte TLS; almacenamiento y retención definidos en el plan funcional y la normativa aplicable. |
| Colores/logo/fuentes no oficiales o sin licencia. | Etapa 0; usar solo activos aportados por CONATEL y fuentes libres. |
| Deriva de a11y al faltar axe en el repo. | Instalar `@axe-core/playwright` en etapa 2 y añadir al CI. |
| Usuario con cuenta administrador vs. pasivo: perfil derivado de permisos aún inexistente para "pasivo". | El plan funcional crea el rol `PASIVO` y permisos `fe_de_vida.*` (A4/C7); mi shell consume esos códigos. |
| **Posible bug a verificar:** con la cuenta E2E (rol ADMINISTRADOR, sin departamento) `/autogestion`, `/autogestion/censo` solo mostraron esqueletos de carga a los 6 s (`rd_ficha_desk.png`, `rd_censo_desk.png`). Puede ser que la cuenta no tenga expediente/cédula en `Employee`, una petición que no resuelve o un estado de error sin pantalla. | Incluirlo en el recorrido por roles del plan funcional (D/E): probar con una cuenta AUTOGESTION con expediente real, revisar red/consola y exigir en la etapa 2 estados explícitos (cargando con límite, vacío y error con "Reintentar") en vez de esqueleto infinito. |

### Preguntas para el usuario
- P1. ¿Existe el manual de identidad institucional de CONATEL/MPPCI (colores oficiales en hex/Pantone, uso del cintillo, logo vectorial)? Sin él se usa la paleta provisional de 2.2.
- P2. ¿Pueden entregar el isotipo en vector (SVG/AI) o PNG ≥ 1024×1024 para íconos PWA? Los PNG actuales de `public/` (`logoNuevo.png`, `logoNuevos.png`, `logoOAC.png`) hay que validar su calidad.
- P3. ¿Hay una tipografía oficial licenciada? Si no, se adopta Source Sans 3 / Noto Sans (libres).
- P4. ¿Cuál será el dominio y el certificado TLS (CA institucional/estatal, Let's Encrypt, autofirmado interno)? ¿El servidor es alcanzable desde internet o solo desde la red interna/VPN? ¿Los jubilados acceden desde fuera de la red de CONATEL?
- P5. ¿Quién administra el servidor para desplegar nginx y rotar certificados, y puede aceptarse una ventana de mantenimiento por el cambio de cookies?
- P6. Dispositivos objetivo: ¿versión mínima de Android y iOS, navegadores (Chrome, Safari, Samsung Internet), gama de teléfonos? ¿Hay equipos de prueba reales?
- P7. ¿Se puede probar con 2-3 jubilados reales antes del cierre (tamaño de texto, comprensión del flujo)? ¿Se necesita atención asistida en sede (quiosco con tableta)?
- P8. ¿El menú debe mostrar un solo "Autogestión" para el activo y uno distinto para el pasivo desde el login, eliminando el selector de módulos intermedio (D14)?
- P9. ¿Se requiere modo oscuro para el público final o basta con tema claro? (Reduce esfuerzo de verificación si basta el claro.)
- P10. ¿La captura necesita validar rostro/cédula automáticamente (visión por computadora) o la revisión humana de Bienestar Social es suficiente? (Define costo y privacidad; el plan asume revisión humana.)
