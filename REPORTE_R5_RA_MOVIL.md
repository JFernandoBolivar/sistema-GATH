# Reporte R-5 / R-A — PWA y móvil

Fecha: 2026-11-01  
Rama: `feature/fe-de-vida-pasivos`  
Alcance: responsive 360–768 px, PWA instalable y accesibilidad AA, sin rediseño de escritorio.

---

## 1. Rutas revisadas

### Con sesión de Bienestar
- `/personal`
- `/personal/consultar`
- `/personal/bienestar/solicitudes`
- `/personal/fe-de-vida`
- `/personal/fe-de-vida/procesos`
- `/personal/fe-de-vida/cobertura`
- `/autogestion/solicitudes`
- `/autogestion/consultar`

### Con sesión de trabajador ACTIVO
- `/autogestion`
- `/autogestion/ficha`
- `/autogestion/solicitudes/nueva`
- `/autogestion/censo`

### Con sesión de pasivo
- `/autogestion/fe-de-vida`

### Públicas
- `/login`
- `/recuperar-password`
- `/offline` (fallback estático)

No se probaron en vivo Administración del sistema ni Carnetización porque `E2E_ADMIN_PASSWORD` sigue con el marcador local `COMPLETAR`. Se aplicaron las correcciones genéricas de tablas, formularios, cabecera y diálogos.

---

## 2. Problemas encontrados y corregidos

| Problema | Dónde | Corrección |
|---|---|---|
| Cabecera más ancha que la pantalla por título + acciones | Todos los módulos a 360 px | Cabecera en dos filas en móvil, título con wrap, acciones a ancho completo; dropdown de personal oculto hasta `lg` |
| Sidebar fijo a 768 px comía el ancho del contenido | Tablet 768 px | `useIsMobile` pasa a 1024: en tablet se usa drawer; escritorio ≥1024 queda igual |
| Bienvenida de Gestión con `text-8xl`/`text-6xl` y texto cortado | `/personal` | Tamaños móviles `text-4xl`/`text-2xl`, `break-words`, mismo tamaño desde `sm` |
| Filtros de personal en dos columnas apretadas | `/personal/consultar` | Una columna en móvil; inputs 16 px |
| Tabla de personal desbordaba la página | `/personal/consultar` | Contenedor de tabla con `role="region"`, `tabIndex=0`, `aria-label`, ancho máximo y scroll interno |
| Tablas nativas sin región accesible | Bienestar, fe de vida, cobertura, carnets | `role="region"`, `tabIndex=0` y etiqueta en cada contenedor |
| Formulario de consulta de censo con botones fuera | `/autogestion/consultar` | Formulario en columna, botones a ancho completo y filtros apilados |
| Ficha con botones/tabs/email cortados | `/autogestion` y `/autogestion/ficha` | Acciones en columna, email con `break-all`, tarjeta `min-w-0`, tabs en región desplazable, foto con fallback |
| Primera pantalla de Autogestión duplicaba el menú | `/autogestion` | La ruta muestra directamente Mi ficha; se retiró la tarjeta de inicio y su ítem «Mi inicio» |
| Textos/emails largos se cortaban | Tablas y ficha | `overflow-wrap: anywhere` en celdas móviles y `break-all` en correos |
| Diálogos/drawers podían exceder el alto | Todos | `max-height` y scroll interno en móvil/tablet |
| Zoom automático de iOS en inputs | Formularios | `font-size: 16px` y altura 44 px en ≤1023 px |
| Falta de `100dvh`, notch y tap highlight | Shell global | `h-dvh`, `viewport-fit=cover`, safe-area, `-webkit-tap-highlight-color` y `touch-action: manipulation` |
| Autogestión con landing repetida | `/autogestion` | Ahora abre Mi ficha; «Inicio» del sidebar va a `/dashboard` o `/autogestion` según permisos |

### PWA

- `public/manifest.webmanifest`: nombre, `short_name`, `start_url=/dashboard`, `display=standalone`, `theme_color=#0a2a5e`, iconos 192/512, maskable y apple-touch desde el logo institucional.
- `public/sw.js`: cache-first **solo** para `/_next/static`, iconos, fuentes e imágenes; `/api/` nunca se cachea; navegaciones network-first con fallback a `/offline.html`; sin cachear páginas con datos personales.
- `public/offline.html` + `offline.css`: página estática con «Reintentar».
- `src/components/pwa-register.tsx`: registro solo en producción.
- `src/components/pwa-install-prompt.tsx`: aviso discreto Android/Chrome e instrucciones iOS; oculto en escritorio.
- `src/app/layout.tsx`: manifest, iconos, `appleWebApp`, `viewport-fit=cover`, `interactive-widget=resizes-content`.
- `/offline` añadida a rutas públicas del proxy para poder precachearla sin sesión.

---

## 3. Capturas

En `C:\Users\josef\OneDrive\Desktop\`:

- Antes: `gath-movil-antes-personal-390.png`, `gath-movil-antes-autogestion-390.png`, `gath-movil-antes-fe-pasivo-390.png`.
- Después:
  - `gath-movil-personal-360.png`
  - `gath-movil-consultar-360.png`
  - `gath-movil-bienestar-solicitudes-390.png`
  - `gath-movil-fe-bienestar-390.png`
  - `gath-movil-autogestion-360.png`
  - `gath-movil-autogestion-consultar-360.png`
  - `gath-movil-autogestion-censo-360.png`
  - `gath-movil-fe-pasivo-390.png`

Las capturas de escritorio anteriores (`gath-r6c-correccion-*.png`) se conservan; los cambios nuevos están limitados por `@media (max-width: 1023px)`, `sm:` y `lg:`, salvo el panel del logo del login solicitado por el usuario.

---

## 4. Pruebas

| Verificación | Resultado |
|---|---|
| E2E responsive + axe + 200 % (`r5-ra-responsive.spec.ts`) | **5/5** |
| E2E PWA (`r5-pwa.spec.ts`) | **2/2** |
| Vitest completo | **579 passed (98 archivos)** |
| `tsc --noEmit` | Sin errores |
| `eslint .` | **0 errores** |
| `next build` | Correcto (76 rutas, incluida `/offline`) |
| Lighthouse 11 — PWA (login) | **100** |
| Lighthouse 11 — Accesibilidad (login) | **100** |
| Axe (rutas de módulos) | 0 violaciones serious/critical |
| Scroll horizontal de página 360/390/768 | Sin desbordes |
| Texto al 200 % | Sin scroll horizontal en `/personal` y `/personal/consultar` |

---

## 5. Cómo probar la PWA en local

1. `docker compose build nextjs`
2. `docker compose up -d nextjs`
3. Abrir `http://localhost:3001/login` en Chrome/Edge.
4. DevTools → Application → Manifest: comprobar nombre, iconos y `start_url`.
5. Application → Service Workers: `sw.js` activo.
6. Application → Cache Storage: solo `gath-shell-v*` con estáticos; no debe haber `/api/`.
7. Activar modo offline y navegar: debe aparecer la página «Sin conexión».
8. En móvil, usar «Instalar» o Safari → Compartir → Añadir a pantalla de inicio.
9. La cámara de fe de vida funciona en standalone porque `localhost` es contexto seguro; en producción el HTTPS lo gestiona Infraestructura (C0).

---

## 6. Pendientes

- Ejecutar las mismas capturas y axe en Administración del sistema y Carnetización cuando `E2E_ADMIN_PASSWORD` esté configurada.
- Validar en hardware real (iOS/Android) los puntos que la emulación no reproduce: teclado, safe-area, tap highlight y standalone.
- Lighthouse PWA ya no existe como categoría en Lighthouse 13; se usó Lighthouse 11.7.1 para la puntuación PWA y Lighthouse 13 para accesibilidad.
- No se hizo commit ni se tocaron cuentas.
