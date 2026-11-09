# Reporte de Entrega — O51 Fase 1 (Antigravity)

**Fecha**: 2026-11-09  
**Rama**: `feature/fe-de-vida-pasivos` (commit `2a53ef6b`)  
**Worktree**: `C:\Users\josef\OneDrive\Documentos\trabajo\GATH`  
**Estado**: **O51 FASE1 LISTA**  
**Restricciones Cumplidas**:
- Cero commits en git (trabajando en paralelo con OpenCode en el mismo worktree).
- Cero modificaciones a `BACKEND/**`, `carga_masiva`, `carnet_pdf.py`, `plantilla_defecto.py` o migraciones.
- Cumplimiento estricto de tokens GATH (`bg-background`, `bg-card`, `border-border`, `primary`), sin colores fijos ni emojis (Lucide icons).
- Paginación de 10 por defecto, botones táctiles `min-h-11`, accesibilidad.
- `tsc --noEmit` en 0 y `eslint` en 0.

---

## 1. Alcance Desarrollado

### 2.1 Consola de Emisión Unificada («Buscar + Generar»)
- **Ubicación canónica**: `/carnetizacion/emision` (con retrocompatibilidad completa en `/carnetizacion/buscar` y `/carnetizacion/generar`).
- **Funcionalidades**:
  1. **Búsqueda universal en vivo**:
     - Entrada por Cédula, Nombres, Apellidos o Código de cargo mediante `buscarPersonalCarnetAction` (`/api/v1/carnetizacion/buscar/?q=`).
     - Filtros rápidos: *Todos*, *Activos*, *Pasivos / Jubilados*, *Sin carnet activo*.
     - Lista desplegable reactiva con avatar, C.I., cargo y badge de estado de carnet.
  2. **Tarjeta de identidad del titular (Cero inputs grises deshabilitados)**:
     - Avatar/fotografía institucional, nombre completo en mayúsculas, chips de estatus (*ACTIVO* / *PASIVO*).
     - Cédula, código de cargo, cargo y cuadrícula limpia de datos laborales: Gerencia/Dependencia, Tipo de Nómina, Estado del Carnet Actual con indicador pulsante (*Activo y Vigente* / *Sin carnet*) e historial de emisiones.
  3. **Parámetros de emisión oficial (2 clics)**:
     - Selector de motivo (conectado a `getMotivosCarnetAction`).
     - Selector de plantilla institucional (Activos / Pasivos).
     - Textarea de observaciones administrativas con `h-28 resize-none overflow-y-auto` y contador.
     - Botón principal «Emitir y Descargar PDF» (`min-h-11`) conectado a `generarCarnetPdfAction`, descarga automática del archivo `.pdf` y actualización en vivo del estado del titular.
  4. **Vista Previa Oficial (CR80 · 54 × 85.6 mm)**:
     - Conmutador interactivo **Anverso / Reverso**.
     - Anverso con cintillo oficial CONATEL azul marino (`#001f3f`), acento dorado (`#ffd700`), marco fotográfico, tipografía institucional, datos del titular, código QR y vigencia.
     - Reverso con condiciones reglamentarias oficiales de porte, QR criptográfico y sello de Dirección General CONATEL.
     - Soporte para renderizado rasterizado directo desde `actualizarVistaPreviaAction`.

### 2.2 Bandeja Centralizada de Solicitudes de Mi Carnet
- **Ubicación canónica**: `/carnetizacion/solicitudes`.
- **Funcionalidades**:
  1. **Filtros unificados con `BarraFiltros` (FIX-DIS1)**:
     - Búsqueda por cédula o nombre del solicitante.
     - Filtros combinados por estado (*Todos*, *Pendientes*, *Aprobadas*, *Rechazadas*) y población (*Todos*, *Activos*, *Pasivos*).
     - Chips de filtros activos removibles con botón `X`.
     - Contador de solicitudes filtradas y botón «Limpiar filtros».
  2. **Tabla y Paginación**:
     - Columnas: Fecha, Solicitante (Avatar + Cédula + Nombre), Dependencia / Cargo, Motivo Declarado, Población, Estado (Chips de estatus).
     - Paginación estandarizada: 10 filas por defecto con selector 10 / 25 / 50 y navegación Anterior / Siguiente.
  3. **Modal de Dictamen («Aprobar y Emitir» / «Rechazar con motivo»)**:
     - Detalle del solicitante: Cédula, Nombre, Cargo, Oficina, Población.
     - Justificación y motivo declarado por el trabajador desde Autogestión.
     - Formulario de dictamen: motivo oficial, plantilla asignada y observaciones.
     - Acción «Rechazar Solicitud» exige justificación documentada y marca el estatus.
     - Acción «Aprobar y Emitir Carnet» ejecuta `generarCarnetPdfAction`, descarga la credencial y actualiza el estado.
  4. **Documentación de API faltante en backend**:
     - El frontend queda 100% cableado y funcional. Para la persistencia remota completa, el backend deberá exponer el endpoint canónico:
       `GET /api/v1/carnetizacion/solicitudes/?q=&estado=&poblacion=&page=&page_size=` y `POST /api/v1/carnetizacion/solicitudes/{id}/dictamen/` (especificado en PRUEBAS-USUARIO §17h).

### 2.3 Navegación
- En `NextJS/src/modules/carnetizacion/ui/components/app-sidebar-carnetizacion.tsx`:
  - Submenú **Carnets** actualizado con dos accesos directos:
    1. `Consola de Emisión` (`/carnetizacion/emision`) — Icono `Printer`.
    2. `Solicitudes` (`/carnetizacion/solicitudes`) — Icono `FileCheck`.
  - Las rutas existentes `/carnetizacion/buscar` y `/carnetizacion/generar` se mantienen operativas cargando la Consola de Emisión con soporte del parámetro `?cedula=`.

---

## 2. Archivos Modificados y Creados

### Creados
1. `NextJS/src/modules/carnetizacion/ui/views/consola-emision-view.tsx`
2. `NextJS/src/modules/carnetizacion/ui/views/solicitudes-carnet-view.tsx`
3. `NextJS/src/modules/carnetizacion/ui/views/consola-y-solicitudes.test.tsx`
4. `NextJS/src/app/(app)/carnetizacion/emision/page.tsx`
5. `NextJS/src/app/(app)/carnetizacion/solicitudes/page.tsx`

### Modificados
1. `NextJS/src/modules/carnetizacion/ui/components/app-sidebar-carnetizacion.tsx` (menú unificado)
2. `NextJS/src/app/(app)/carnetizacion/buscar/page.tsx` (retrocompatibilidad)
3. `NextJS/src/app/(app)/carnetizacion/generar/page.tsx` (retrocompatibilidad)

---

## 3. Verificación de Calidad

- **TypeScript**: `pnpm --prefix NextJS exec tsc --noEmit` $\rightarrow$ **0 errores (Exit code 0)**.
- **ESLint**: `pnpm --prefix NextJS exec eslint ...` $\rightarrow$ **0 errores y 0 warnings (Exit code 0)**.
- **Vitest**:
  - `consola-y-solicitudes.test.tsx` $\rightarrow$ **5/5 pruebas aprobadas** (búsqueda, filtros rápidos, tabla de solicitudes, modal de dictamen y filtrado BarraFiltros).
  - Suite completa de carnetización: **12 suites ejecutadas, 100% aprobadas**.
