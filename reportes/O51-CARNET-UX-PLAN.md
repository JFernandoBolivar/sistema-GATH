# Plan de Rediseño Integral de Experiencia de Usuario (UX) — Módulo de Carnetización CONATEL (O51)

**Fecha**: 2026-11-09  
**Referencia**: PRUEBAS-USUARIO §21c, §21d, §21e, §21f  
**Prototipo Navegable**: `reportes/O51-prototipo.html`  
**Estado**: Propuesta formal estructurada para revisión y aprobación del usuario antes de codificación.

---

## 1. Diagnóstico de la Situación Actual

La auditoría de usabilidad y los reportes directos del usuario evidenciaron que el módulo de Carnetización actual adolece de fragmentación excesiva, navegación confusa y falta de jerarquía visual institucional:

1. **Dispersión de pantallas y procesos duplicados**:
   - «Buscar» y «Generar» existen como pantallas separadas (`/carnetizacion/buscar` y `/carnetizacion/generar`). Quien opera debe primero buscar a la persona en una pantalla, copiar la cédula y navegar a otra para emitir, o toparse con formularios llenos de inputs grises deshabilitados.
   - Existen rutas aisladas para «Visitantes», «Temporal», «Lote» y «Eventos», cada una con patrones visuales dispares.
2. **Eventos desestructurados**:
   - `/carnetizacion/eventos` carece de padding adecuado (contenido pegado al sidebar), presenta espacios vacíos desaprovechados y usa tarjetas que actúan como meros hipervínculos hacia otras pantallas aisladas, obligando a dar saltos constantes.
3. **Control de acceso y escaneo manual**:
   - No existía un escáner continuo directo con cámara trasera para smartphones ni integración nativa con lectores USB/Bluetooth en garita o recepción.
4. **Herramientas de diseño y biblioteca desconectadas**:
   - «Plantillas», «Diseñador Konva» y «Biblioteca de Medios» operan como islas sin una vista unificada de previsualización en vivo ni gobierno de versiones.

---

## 2. Nueva Arquitectura de Navegación y Procesos Centralizados

Se propone reestructurar todo el módulo en **4 pilares funcionales** claramente delimitados:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MÓDULO DE CARNETIZACIÓN                         │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│   1. OPERACIÓN  │  2. EXTERNOS Y   │   3. EVENTOS Y  │   4. ESTUDIO DE │
│    CENTRAL      │   TEMPORALES     │     ACCESO      │     DISEÑO      │
├─────────────────┼──────────────────┼─────────────────┼─────────────────┤
│ • Consola de    │ • Visitantes y   │ • Gestión de    │ • Plantillas y  │
│   Emisión       │   Contratistas   │   Eventos       │   Diseñador     │
│   (Buscar +     │ • Credenciales   │ • Escáner QR    │ • Biblioteca    │
│   Generar)      │   Provisionales  │   de Entrada    │   de Medios     │
│ • Bandeja de    │                  │   (Cámara/USB)  │ • Métricas y    │
│   Solicitudes   │                  │                 │   Auditoría     │
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

### 2.1. Consola de Emisión Unificada («Buscar + Generar»)
- **Búsqueda viva**: Entrada universal por Cédula, Nombres, Apellidos o Código de Cargo.
- **Resultados en tarjeta de identidad**: Fotografía institucional, nombres, cédula, cargo, gerencia/oficina, tipo de nómina y chip de estado del carnet actual (*Activo*, *Sin carnet*, *Vencido*, *Anulado*).
- **Emisión en 2 clics**: Al seleccionar al trabajador, la columna derecha carga instantáneamente la **vista previa fotográfica anverso/reverso** de la plantilla oficial según su nómina. El operador solo elige el motivo y pulsa «Emitir y Descargar PDF».
- **Cero inputs deshabilitados**: Se reemplazan los antiguos campos grises de solo lectura por una tarjeta resumen de datos laborales con jerarquía tipográfica limpia.

### 2.2. Bandeja Centralizada de Solicitudes de Autogestión
- Lista paginada (10 por defecto) con `BarraFiltros` de todas las solicitudes enviadas por trabajadores o pasivos desde `/autogestion/mi-carnet`.
- Modal de dictamen rápido: muestra justificación del solicitante, carnet anterior y botones de acción primaria («Aprobar y Emitir») o secundaria («Rechazar con motivo documentado»).

### 2.3. Hub Integral de Eventos (Pestañas en la misma pantalla)
Elimina la fragmentación actual. Al ingresar a un evento, el operador cuenta con **5 pestañas integradas** sin salir de la vista:
1. **Resumen y Métricas**: Capacidad, total invitados, emitidos, confirmados y accesos registrados en tiempo real.
2. **Nómina de Invitados**: Tabla paginada en servidor con búsqueda rápida, categorías y zonas. Botones de importación masiva (.xlsx) y adición individual.
3. **Emisión de Gafetes**: Selección masiva con «Seleccionar todos los resultados del filtro» y generación instantánea del PDF de gafetes (90x130 mm anverso/reverso).
4. **Control de Entrada en Vivo**: Monitor de accesos en tiempo real con estadísticas de aforo.
5. **Configuración del Evento**: Categorías, colores distintivos y zonas autorizadas.

### 2.4. Escáner de Control de Entrada Universal (Cámara y Lector USB)
- **Modo Pantalla Completa**: Interfaz de alta visibilidad para tabletas y smartphones de seguridad en puertas y torniquetes.
- **Cámara trasera continua**: Detección automática instantánea mediante librerías mantenidas (`@zxing/browser` o `html5-qrcode`).
- **Lector de código de barras USB/Bluetooth**: Entrada pasiva transparente (escucha keystrokes alfanuméricos terminados en `Enter`), sin requerir foco manual.
- **Dictamen visual inequívoco y accesible**:
  - 🟢 **ACCESO PERMITIDO**: Tarjeta verde esmeralda institucional grande con nombre del invitado, categoría, zona y fotografía. Sonido de confirmación breve (bip agudo).
  - 🟡 **YA INGRESÓ**: Tarjeta ámbar de advertencia con la hora exacta del primer acceso registrado. Doble tono de aviso.
  - 🔴 **NO VÁLIDA / DENEGADO**: Tarjeta carmesí destacada indicando motivo (*Credencial inexistente*, *Revocada*, *Evento incorrecto* o *Zona no autorizada*).
  - Plegable para ingreso manual de código solo como alternativa de contingencia.

### 2.5. Estudio de Diseño y Marca Institucional
- **Galería de Plantillas**: Tarjetas con renderizado en miniatura de anverso y reverso, indicando tipo de credencial y criterio de asignación de franja (nómina/cargo).
- **Diseñador por Capas**: Interfaz Konva en mm con panel lateral de herramientas, capas reordenables, alineación magnética y selector de variables dinámicas (`{nombre_completo}`, `{cedula}`, `{cargo}`, `{departamento}`, `{qr_seguridad}`).
- **Biblioteca de Medios**: Gestor de logotipos, firmas autorizadas y sellos de seguridad oficiales con soporte de previsualización PNG y SVG.

---

## 3. Especificaciones Visuales y Tokens de Diseño GATH

| Elemento | Especificación / Token GATH | Regla de Diseño |
| :--- | :--- | :--- |
| **Color Primario** | `hsl(var(--primary))` / `#0B4A9E` (Azul CONATEL) | Encabezados, botones principales, chips activos |
| **Color Acento** | `hsl(var(--accent))` / `#F59E0B` (Ámbar institucional) | Detalles de resalte, marcadores de estatus |
| **Fondos** | `bg-background` (página) / `bg-card` (paneles) | Sin fondos `bg-white` fijos; contraste AA en claro y oscuro |
| **Bordes** | `border-border` / `border-border/60` | Divisiones suaves de 1px, sin sombras pesadas |
| **Paginación** | Servidor con selector 10 / 25 / 50 filas | Obligatoria en toda tabla o lista del módulo |
| **Filtros** | Componente unificado `BarraFiltros` | Búsqueda ancha, chips activos removibles, limpiar |
| **Iconografía** | `Lucide React` oficial | **Estrictamente prohibido el uso de emojis** |
| **Textareas** | `resize-none`, `overflow-y-auto`, alto fijo h-28 | Con contador de caracteres discreto integrado |

---

## 4. Prototipo Navegable Entregado

Se ha generado el prototipo interactivo en HTML5/Tailwind standalone:
- **Ubicación**: `reportes/O51-prototipo.html`
- **Capacidades interactivas**:
  1. Conmutador de vistas PC (1366x768) y Móvil (360x740).
  2. Búsqueda viva con previsualización dinámica de credenciales.
  3. Simulador del escáner de control de entrada (Permitido, Ya ingresó, No válida).
  4. Vista por pestañas del evento integral con emisión por lotes.
  5. Modo claro y modo oscuro institucional.
