# Propuesta Visual Refinada — Bandeja de Notificaciones (`/autogestion/notificaciones`)

**Fecha**: 2026-11-09  
**Módulo**: Autogestión / Notificaciones Institucionales GATH  
**Estado**: **PROPUESTA APROBADA EN VARIANTE A (Refinada con feedback del usuario)**  
**Prototipo interactivo en navegador**: [`reportes/PROPUESTA-NOTIFICACIONES.html`](file:///C:/Users/josef/OneDrive/Documentos/trabajo/GATH/reportes/PROPUESTA-NOTIFICACIONES.html)  

---

## 1. Decisiones de Diseño Incorporadas

A partir del feedback del usuario sobre la propuesta inicial, se refinó la **Variante A (Bandeja Enfocada)** con los siguientes ajustes específicos:

1. **Exclusividad en Modo Claro Institucional**:
   - Se removió la alternancia de modo oscuro. El sistema actualmente opera en el tema claro estándar de CONATEL (`--background: #f6f8fb`, `--card: #ffffff`, `--primary: #0b4a9e`, etc.), garantizando contraste óptimo y cumplimiento estricto de WCAG AA.
2. **Conservación del Select con Buscador (`ComboboxTipoNotificacion`)**:
   - Se mantiene el combobox con buscador interno reactivo, permitiendo al usuario escribir para localizar rápidamente cualquiera de los 17 tipos de avisos agrupados por módulo (*Fe de vida*, *Autogestión*, *Cuentas y Seguridad*, *Carnetización*, *Movimientos*).
3. **Filtro por Fechas Específicas (`Desde` y `Hasta`)**:
   - Se preservan los campos de fecha exacta (`Desde` y `Hasta`) con inputs estructurados, perfectamente compatibles con la API y los parámetros `desde` y `hasta` del backend y las Server Actions existentes.
4. **Chips Activos Removibles**:
   - Cada filtro aplicado (texto, estado, tipo, fecha desde, fecha hasta) genera un chip individual con botón `×` para desmarcarlo en 1 clic.

---

## 2. Anatomía de la Variante A Refinada

El prototipo interactivo en [`reportes/PROPUESTA-NOTIFICACIONES.html`](file:///C:/Users/josef/OneDrive/Documentos/trabajo/GATH/reportes/PROPUESTA-NOTIFICACIONES.html) materializa la siguiente distribución:

### 2.1 Cabecera Institucional (`data-guia-id="notificaciones-cabecera"`)
- **Título**: «Notificaciones» con un chip contador reactivo al lado (`4 nuevas` en azul primario o `Al día` en verde cuando no hay pendientes).
- **Descripción**: Texto claro y formal sobre los módulos y trámites notificados.
- **Acción masiva**: Botón primario «Marcar todas como leídas» con icono `CheckCheck` (deshabilitado cuando el total de no leídas es 0, con altura táctil accesible de 44 px).

### 2.2 Barra de Filtros Refinada (`data-guia-id="notificaciones-filtros"`)
Se estructura en dos niveles limpios integrados dentro de `BarraFiltros`:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Buscar por título, asunto o mensaje...           ]   [ Todas (12) | No leídas (4) | Leídas (8) ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [🏷️ Todos los tipos / Buscar tipo...  ▼]   Desde: [2026-11-01 📅]   Hasta: [2026-11-09 📅]   [Limpiar] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Chips activos: [Tipo: "Fe de vida validada" ×] [Desde: 2026-11-01 ×] [Estado: No leídas ×]     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Fila 1 (Búsqueda Universal + Segmented Control de Estado)**:
   - **Búsqueda**: Input amplio con icono de lupa y retardo de 400 ms para no saturar el servidor mientras el usuario escribe.
   - **Chips segmentados**: Alternador directo de tres estados (*Todas*, *No leídas*, *Leídas*) con el conteo numérico en vivo. Sustituye al antiguo desplegable gris por botones táctiles inmediatos.
2. **Fila 2 (Parámetros Específicos)**:
   - **ComboboxTipoNotificacion**: Desplegable popover que al abrirse despliega una caja de búsqueda interna rápida y el catálogo clasificado por módulo.
   - **Fechas Específicas**: Selectores `Desde` y `Hasta` con validación de fechas (evitando fechas invertidas).
   - **Botón Limpiar**: Aparece automáticamente cuando existe al menos un filtro activo.
3. **Fila 3 (Chips Activos)**:
   - Muestra visualmente las restricciones aplicadas con opción de eliminarlas una a una.

### 2.3 Lista Agrupada Cronológicamente (`data-guia-id="notificaciones-lista"`)
La lista de notificaciones se divide automáticamente en cuatro bloques con separadores sutiles:
- **`Hoy`**: Notificaciones generadas durante la jornada en curso.
- **`Ayer`**: Notificaciones del día anterior.
- **`Esta semana`**: Notificaciones de los últimos 7 días.
- **`Anteriores`**: Notificaciones históricas más antiguas.

#### Tarjeta de Notificación Individual
- **Notificación No Leída**:
  - Borde lateral izquierdo de acento grueso (`border-left: 4px solid var(--primary)`).
  - Fondo sutil con tinte institucional (`info-soft/45`).
  - Título en negrita (`font-bold`).
  - Chip distintivo `Nueva` en color primario.
  - Botón contextual rápido «Marcar leída» (un solo clic).
- **Notificación Leída**:
  - Fondo blanco liso (`var(--card)`).
  - Título en peso semibold y cuerpo en gris legible (`var(--muted-foreground)`).
  - Chip discreto `Leída`.
  - Sin barra de acento lateral.
- **Icono Temático del Módulo**:
  - Cada notificación cuenta con un icono SVG Lucide vectorial dentro de un recuadro redondeado con tono suave representativo:
    - **Fe de Vida**: Corazón / Supervivencia (`var(--success-soft)` verde).
    - **Autogestión**: Formulario / Expediente (`var(--secondary)` azul marino).
    - **Cuentas y Seguridad**: Escudo / Candado (`var(--warning-soft)` ámbar).
    - **Carnetización**: Credencial / Tarjeta (`var(--info-soft)` celeste).
    - **Movimientos de Personal**: Flechas de traslado / ascenso (`var(--secondary)` azul).
- **Acciones Directas**:
  - Botón principal de enlace profundo: «Ver detalle», «Ir a Fe de Vida», «Ver mi expediente», «Descargar constancia», etc.

### 2.4 Paginación Estandarizada (`data-guia-id="notificaciones-paginacion"`)
- Contador informativo a la izquierda («Mostrando 1 a 10 de 12 notificaciones»).
- Controles de navegación Anterior / Siguiente con botones de páginas directas (altura de 36 px a 44 px).

---

## 3. Compatibilidad con el Sistema y la Suite de Pruebas

La propuesta respeta de forma estricta los contratos existentes en `NextJS/src/modules/notificaciones`:

1. **Atributos de Guía (`data-guia-id`)**:
   - `notificaciones-cabecera`
   - `notificaciones-filtros`
   - `notificaciones-lista`
   - `notificaciones-paginacion`
   Las pruebas de invariantes (`guias-invariantes.test.tsx` y `notificaciones-ui.test.tsx`) seguirán pasando sin requerir modificaciones.
2. **Componentes Reutilizados**:
   - `PageHeader` (`src/shared/ui/components/page-header.tsx`)
   - `BarraFiltros` (`src/shared/ui/components/barra-filtros.tsx`)
   - `ComboboxTipoNotificacion` (`src/modules/notificaciones/ui/combobox-tipo-notificacion.tsx`)
   - `Card` y `Button` (`src/shared/ui/components/**`)
   - `VistaVacia`, `VistaCargando` y `VistaError` (`src/shared/ui/components/vista-estados.tsx`)
3. **Contrato de Servidor y SWR**:
   - Mantiene la clave `claveBandeja(filtros)` con `FiltrosNotificaciones`:
     - `q?: string`
     - `tipo?: string`
     - `leida?: boolean`
     - `desde?: string`
     - `hasta?: string`
     - `limite: 10`
     - `desplazamiento: pagina * 10`

---

## 4. Instrucciones para Visualizar el Prototipo

El archivo [`reportes/PROPUESTA-NOTIFICACIONES.html`](file:///C:/Users/josef/OneDrive/Documentos/trabajo/GATH/reportes/PROPUESTA-NOTIFICACIONES.html) es 100% autocontenido y puede abrirse con doble clic en cualquier navegador:

1. **Probar el Combobox con Buscador**: Haga clic en «Todos los tipos» y escriba para filtrar los tipos de avisos en tiempo real.
2. **Probar el Rango de Fechas**: Seleccione fechas en los campos `Desde` y `Hasta` para verificar cómo se filtran los avisos cronológicamente y cómo se generan los chips activos.
3. **Probar los Chips Segmentados**: Alterne entre *Todas (12)*, *No leídas (4)* y *Leídas (8)*.
4. **Probar el Modo Móvil**: Pulse el botón «Móvil (390px)» en la barra superior para evaluar cómo se adapta la interfaz a smartphones.
5. **Probar «Marcar leída»**: Al pulsar «Marcar leída» en cualquier aviso, este pasa en vivo al estado de leída y el contador se actualiza instantáneamente.
