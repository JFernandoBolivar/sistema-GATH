# O51 — Pulido visual de las pantallas de carnetización

**Fecha:** 2026-11-09
**Rama:** `feature/fe-de-vida-pasivos`

## Alcance

Se revisaron y corrigieron las pantallas señaladas en las pruebas de usuario:

1. **Control de entrada QR** (`/carnetizacion/control-eventos`)
2. **Filtros de notificaciones** (`/autogestion/notificaciones`) y **solicitudes**
   (`/carnetizacion/solicitudes`)
3. **Consola de emisión** (`/carnetizacion/emision`)
4. **Credenciales de visita** (`/carnetizacion/visitantes`)
5. **Plantillas** (`/carnetizacion/plantillas`) y **diseñador** (`/carnetizacion/disenador`)

## Cambios

### Control de entrada QR
- Se reemplazaron los colores fijos (`slate`, `emerald`, `amber`, `white`,
  gradientes, glows y sombras) por los tokens del sistema: `bg-card`,
  `bg-muted`, `border-border`, `bg-success-soft`, `text-success`,
  `bg-warning-soft`, `bg-danger-soft`, etc.
- Nueva organización: barra de configuración, tarjeta del lector con estado
  «En vivo / En espera», dictamen con jerarquía clara, historial de la sesión y
  modo de prueba discreto.
- **Corrección del visor vacío:** el contenedor de `html5-qrcode` estaba
  `hidden` cuando se iniciaba la cámara, por lo que la librería medía 0×0 y el
  video no se veía. Ahora el contenedor siempre tiene tamaño estable y la capa
  de espera es un overlay.
- Controles de 44 px, etiquetas legibles y estados de error con tokens.

### Filtros
- Se eliminó la grilla interna que dejaba los cuatro filtros en 1/4 de columna.
  Ahora ocupan las 4 columnas de escritorio (2 en tablet, 1 en teléfono).
- Etiquetas `text-sm`, controles `h-11` y calendario de fecha más grande.

### Consola de emisión
- Resultado de búsqueda rediseñado: avatar, nombre, cédula/cargo, chip de
  carnet y acción «Seleccionar» con icono.
- La «Plantilla Institucional» era un desplegable muerto (sus opciones no
  existían en el backend). Ahora lista las plantillas reales y el
  `plantilla_id` viaja al PDF; la opción por defecto es la plantilla activa.

### Credenciales de visita
- Formulario reorganizado en secciones (Credencial, Datos del visitante,
  Detalle de la visita, Notificación) con etiquetas asociadas, ayudas y
  controles de 44 px.

### Plantillas y diseñador
- Cada plantilla del motor muestra una **miniatura SVG real** del anverso
  (renderizada desde su definición) y un botón visible «Abrir diseñador».
- El selector «Insertar campo del expediente» ahora es un buscador (Popover +
  Command) con búsqueda por nombre, código o grupo.
- Se añadieron las formas que faltaban: **Triángulo** y **Franja diagonal**,
  con su render en Konva y en el PDF.

## Verificación

- `vitest` de carnetización + notificaciones: **102 passed**.
- `tsc --noEmit`: 0 errores · `eslint`: 0.

## Ajustes posteriores (híbrido HTML + sistema)

Se comparó el prototipo HTML con el sistema y se adoptó la propuesta híbrida:

- **Plantillas:** tarjeta con **anverso y reverso** renderizados, estado y acciones
  **Editar** y **Duplicar** (esta última crea un borrador con la misma definición).
- **Eventos:** la pestaña Resumen ahora tiene una **banda de cifras grandes**
  (invitados, emitidas, entraron, faltan), acciones directas (importar, agregar,
  imprimir lote, enviar), una **vista rápida de la nómina** y el panel
  «Al escanear en la entrada». Las pestañas conservan la operación completa y
  pierden la numeración.
- **Parámetros:** los valores booleanos se muestran como **Activado/Desactivado**
  en la tarjeta, el diálogo de confirmación y el historial (nunca `true`/`false`).
- **QR del carnet:** el contenido ahora es `FRONTEND_URL/carnet/<hash>` para que
  la cámara del teléfono abra la ficha pública de verificación.

