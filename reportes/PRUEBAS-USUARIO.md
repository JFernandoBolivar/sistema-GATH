# Reporte Acumulado de Pruebas de Usuario (PRUEBAS-USUARIO)

**Fecha de Corte**: 2026-11-09  
**Entorno de Ejecución**: Sistema preparándose para pase a producción.  
**Restricciones Cumplidas**:
- **Cero reinicio o reconstrucción de contenedores** en ejecución.
- **Sin modificación a contenedores en vivo**.
- Cumplimiento estricto de arquitectura Onion / Scream / Feature-based y tokens de diseño GATH.
- **Sin git commit**.

---

## 🚨 PRIORIDAD URGENTE PRODUCCIÓN: FE DE VIDA (Puntos 12, 11, 10 y 4)

### Punto 12: Vivienda en Fe de Vida Presencial (BLOQUEANTE RESUELTO)

#### 1. Diagnóstico y Causa Raíz
1. **Regla de País Extranjero vs Venezuela**:
   - En `BACKEND/apps/fe_de_vida/infrastructure/adaptadores_autogestion.py`, `ValidadorCambiosActaORM.validar` llamaba a `validar_registro_nuevo(cambio.seccion, cambio.entidad_destino, cambio.valor_propuesto)` sin suministrar el argumento `es_venezuela`.
   - Por defecto, `validar_registro_nuevo` asumía `es_venezuela = True`. Cuando un pasivo sin vivienda previa seleccionaba un país extranjero (ej. Alemania) con `ciudad_region`, el validador forzaba la obligatoriedad de la ubicación venezolana (`CAMPOS_LOCALIZACION_VENEZUELA = estado_id, municipio_id, parroquia_id, codigo_postal_id`) y arrojaba error de validación.
   - En el flujo de edición del borrador (`edicion_trabajador.py:_validar_vivienda_del_borrador`), cuando la acción era `MODIFICAR`, se evaluaban únicamente diccionarios `valor_propuesto`, omitiendo cambios campo a campo donde `valor_propuesto` es un valor simple.
2. **Nombres técnicos interpolados en el mensaje al usuario**:
   - `validar_vivienda_condicional` interpolaba los nombres crudos de los campos en el `ValidationError`: `codigo_postal_id, estado_id, municipio_id, parroquia_id`.
3. **Propuesta que no se actualizaba en la interfaz al editar**:
   - En `NextJS/src/modules/autogestion/ui/solicitudes/formulario-registro.tsx`, si el usuario cambiaba a Venezuela pero omitía algún campo requerido de ubicación (como Código Postal), la función `enviar` abortaba con `if (invalido) return;` silenciosamente sin mostrar un toast informativo ni hacer foco en el campo faltante, dejando la propuesta previa (Alemania) visible en pantalla.
4. **Filtro de cascada en municipios y parroquias**:
   - Verificado en base de datos: el municipio `CASANARE` (ID 13, parroquia `EL CHAPARRO` ID 47) pertenece en la división político-territorial RAC al estado **ANZOÁTEGUI** (ID 2). La cascada filtra de forma estricta por `estado_id` (`/api/v1/catalogos/municipios/?estado_id=...`).

#### 2. Correcciones Implementadas
- **Backend**:
  - En `BACKEND/apps/fe_de_vida/infrastructure/adaptadores_autogestion.py`:
    ```python
    if accion is Accion.CREAR:
        pais_id = None
        if cambio.entidad_destino == 'datos_vivienda' and isinstance(cambio.valor_propuesto, dict):
            pais_id = cambio.valor_propuesto.get('pais_id')
        es_venezuela = getattr(self._lector, 'es_pais_venezuela', lambda _pais: True)(pais_id)
        valor = validar_registro_nuevo(
            cambio.seccion, cambio.entidad_destino, cambio.valor_propuesto, es_venezuela=es_venezuela
        )
    ```
  - En `BACKEND/apps/autogestion/infrastructure/repositories/lector_ficha_orm.py`: `es_pais_venezuela` ahora procesa con seguridad tipos `str` o `int` (`pid = int(pais_id)`).
  - En `BACKEND/apps/autogestion/domain/services/validacion_cambios.py`: mapeo de etiquetas de usuario `ETIQUETAS_CAMPOS` para suprimir identificadores técnicos:
    `"Faltan campos obligatorios de la vivienda: " + ', '.join([ETIQUETAS_CAMPOS.get(c, c) for c in faltan]) + '.'`
- **Frontend**:
  - En `NextJS/src/modules/autogestion/ui/solicitudes/formulario-registro.tsx`: ante campos faltantes de ubicación venezolana o ciudad/región exterior, se lanza inmediatamente `toast.error("Revise los campos marcados en rojo.")` y se traslada el foco al primer campo inválido.

#### 3. Verificación
- **Prueba de integración Backend**: `test_borrador_presencial_registro_nuevo_vivienda_pais_extranjero` y `test_borrador_presencial_vivienda_venezuela_exige_ubicacion_con_nombres_legibles` en `BACKEND/tests/integration/fe_de_vida/test_presencial_api.py`.
- **Prueba unitaria Backend**: `test_error_vivienda_condicional_usa_etiquetas_legibles_sin_id` en `test_vivienda_pais_o40.py`.
- **Suite Vitest Frontend**: `src/modules/autogestion/ui/solicitudes/formulario-registro-vivienda.test.tsx` (3 pruebas pasando al 100%).

---

### Punto 11: Normalización de «Ciudad o Región» y Longitud Única

#### 1. Diagnóstico y Causa Raíz
- Ciudad o región se mantenía como texto libre para pasivos en el exterior. Existía discrepancia de longitudes (frontend `maxlength=250` vs backend `120`) y falta de normalización automática de espacios y mayúsculas.

#### 2. Correcciones Implementadas
- **Función única en Dominio**: `core.domain.validacion_personas.normalizar_ciudad_region(valor)`:
  - Elimina espacios exteriores y colapsa secuencias de espacios múltiples a uno solo.
  - Convierte a **MAYÚSCULAS**.
  - Trunca estrictamente al límite `MAX_LONGITUD_CIUDAD_REGION = 120`.
- **Reutilización canónica en todas las entradas**:
  - `apps.autogestion.domain.services.validacion_cambios` (`validar_valor`).
  - `apps.autogestion.infrastructure.repositories.repo_autogestion_orm`.
  - `apps.personal.infrastructure.serializers.empleado_escritura_serializers`.
  - `apps.carga_masiva.infrastructure.analisis` y `aplicacion`.
- **Alineación Frontend**:
  - `NextJS/src/modules/autogestion/ui/solicitudes/formulario-registro.tsx` con `maxLength={120}`.
  - `NextJS/src/modules/personal/ui/registrar/paso-dwelling.tsx` con `maxLength={120}`.
  - `schema-solicitud.ts` con `textoOpcional(120)`.
- **Migración de datos**: `BACKEND/apps/personal/migrations/0003_normalizar_ciudad_region.py` que pasa a mayúsculas y acota a 120 los registros existentes en base de datos.

#### 3. Verificación
- `test_ciudad_region_se_recorta_y_limita` en `test_vivienda_pais_o40.py` aprobada.
- `formulario-registro-vivienda.test.tsx` comprueba que `"  berlin  mitte  "` se transforma en `"BERLIN MITTE"`.

---

### Punto 10: Panel de Notificaciones de la Campana en Teléfono

#### 1. Diagnóstico y Causa Raíz
- En viewports móviles (360x740), la lista de notificaciones desbordaba el contenedor del popover y la última tarjeta quedaba cubierta por el botón «Ver todas», el cual carecía de fondo sólido y borde aislante.

#### 2. Correcciones Implementadas
- En `NextJS/src/modules/notificaciones/ui/campana-notificaciones.tsx`:
  - Contenedor con altura máxima estricta: `max-h-[min(70dvh,560px)]` y ancho responsive `w-[min(24rem,calc(100vw-1.5rem))]`.
  - Contenedor de lista con scroll interno desacoplado: `min-h-0 flex-1 overflow-y-auto overscroll-contain`.
  - Pie fijo con botón «Ver todas»: `shrink-0 border-t border-border bg-card` con fondo completamente sólido para evitar transparencias o solapamientos.

#### 3. Verificación
- `src/modules/notificaciones/ui/notificaciones-ui.test.tsx` (22 tests pasando, incluyendo prueba específica de dimensiones y scroll interno para Point 10).

---

### Punto 4: Botón de Cierre (×) de Guías en Teléfono

#### 1. Diagnóstico y Causa Raíz
- En pantallas de 360 px, el botón de cierre de 32x32 px de `driver.js` (`driver-popover-close-btn`) se posicionaba sobre la primera línea del título de la guía.

#### 2. Correcciones Implementadas
- En `NextJS/src/shared/ui/guias/guias.css`:
  - Se agregó reserva de espacio obligatoria en el encabezado tanto para escritorio como para teléfono:
    ```css
    .driver-popover .driver-popover-title,
    .driver-popover.gath-guia-popover .driver-popover-title {
      padding-right: 3rem !important;
    }
    ```
  - En móviles (`@media (max-width: 640px)`), se reafirma `padding-right: 3rem !important;` y se posiciona el botón a `top: 0.75rem`, `right: 0.75rem`, asegurando separación completa respecto al texto.

---

## Tabla Resumen de los 22 Puntos de PRUEBAS-USUARIO

| N° | Pantalla / Módulo | Defecto Reportado | Causa Raíz | Corrección Aplicada | Verificación |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | `/autogestion/solicitudes/nueva` | Aviso de solicitud pendiente duplicado | Repetición de bloques por sección y registro | Deduplicación por `id` de solicitud; aviso contextual junto al registro bloqueado en alcance `registro`. | Vitest + inspección UI |
| **2** | `/autogestion/solicitudes/nueva` | Contenido limitado a `max-w-3xl` en PC dejando pantalla vacía | Limitación de ancho fijo en contenedor | Ancho completo en PC con grilla de 2 columnas desde `lg` y `max-w` interno para textos largos. | Playwright 1366 px y 360 px |
| **3** | `/autogestion/solicitudes/nueva` | Orden de secciones no institucional | Orden no contemplado en base de datos | Migración `0009_seccion_orden_y_antecedentes.py` estableciendo: Identidad (1), Foto (2), Contacto (3)... | Django ORM + UI |
| **4** | Global (driver.js) | Botón de cierre × tapa título en teléfono | Falta de espacio de reserva en popover | `padding-right: 3rem !important;` en títulos de popover para todas las guías globales del sistema. | Visual 360 px |
| **5** | `/autogestion/notificaciones` | Selector «Tipo» ocupa toda la pantalla | Selector nativo sin paginación ni límite | Reemplazado por Combobox con buscador, alto máximo de 8 opciones visibles y scroll interno. | Interacción UI |
| **6** | `/autogestion/notificaciones` | Filtros sin diseño atractivo | Falta de componentes unificados | Incorporación de `BarraFiltros` de FIX-DIS1 con búsqueda ancha, botón «Limpiar» y chips removibles. | Interacción UI |
| **7** | `/autogestion/censo` | Tarjeta con colores fijos fuera de tokens | `bg-white`, `border-gray-200` hardcodeados | Migración a tokens `bg-card`, `border-border`, `text-foreground` y radios táctiles $\ge 44$ px aptos para modo oscuro. | Modo claro/oscuro |
| **8** | `/personal/consultar` | Cédula editable en diálogo de información básica | O49 exigía inmutabilidad | Cédula retirada del formulario; reubicada como dato solo lectura en cabecera junto a Nombres y Apellidos en misma fila. | Inspección de diálogo |
| **9** | `/autogestion/solicitudes/nueva` | Antecedentes de servicio no listaba en nueva solicitud | Filtro y orden en catálogo de secciones | Habilitada sección con opciones Agregar/Corregir/Quitar y soporte para población activa y pasiva. | SWR + API |
| **10** | Cabecera / Campana | Notificaciones popover se desbordan y tapan «Ver todas» en teléfono | Panel sin altura máxima acotada | Panel con `max-height: min(70dvh, 560px)`, scroll interno `overscroll-contain` y pie «Ver todas» fijo con borde superior. | Inspección 360 px |
| **11** | Vivienda pasivos | Ciudad o región sin normalizar y disparidad de longitudes | Input permitía minúsculas y backend validaba 120 vs 250 | Función `normalizar_ciudad_region` en dominio (limpieza de espacios, mayúsculas, máx 120) y migración de datos `0003_normalizar_ciudad_region.py`. | Pytest + Migración |
| **12** | Fe de vida presencial | Toast exigía campos de vivienda de Venezuela para países extranjeros | Cálculo de `es_venezuela` no evaluaba el país propuesto | `adaptadores_autogestion.py` calcula `es_venezuela` evaluando el `pais_id` propuesto en el borrador presencial; etiquetas legibles en errores. | Pytest integración + Vitest |
| **13** | Familiares / Borrador | Realizado por OpenCode | — | — | A cargo de OpenCode |
| **14** | `/configuracion/reglas-catalogos` | Pestaña Países con 249 filas infinitas | Endpoint cargaba todos los registros en memoria | Endpoint paginado con `?q=&page=&page_size=` (10/25/50), búsqueda instantánea y Venezuela fijada arriba. | API + UI |
| **15** | Global | Textareas sobrescribían regla con `resize-y` | `className` se aplicaba después de `resize-none` | `textarea.tsx` aplica `resize-none` estrictamente al final; eliminados selectores `resize-y` y `resize-x` residuales. | Vitest + grep |
| **16** | `/configuracion/autogestion` | No se visualizaba configuración de «Mi carnet» | Faltaba tarjeta en vista de autogestión | Tarjeta «Mi carnet» integrada enlazando al parámetro `carnetizacion.mi_carnet_alcance` y selector de usuarios específicos. | Interacción UI |
| **17** | `/autogestion/mi-carnet` | Rediseño y corrección de flujos del carnet digital | Pestaña incrustada en ficha, colores fijos amber, doble solicitud 201 | Vista propia `MiCarnetView` con tokens institucionales, chips de estado, Sonner toasts, rechazo 409 a solicitudes duplicadas y eliminación de hash SHA-256 expuesto. | Playwright + API |
| **18** | Fe de vida estadísticas | Realizado por OpenCode | — | — | A cargo de OpenCode |
| **19** | Global | IDs numéricos visibles mientras cargan catálogos | Fallback de `formato-solicitud.ts` devolvía `Código X` o `ID Y` | `formato-solicitud.ts` devuelve `«Cargando…»` en lugar de IDs numéricos hasta que los catálogos completen su resolución. | Vitest |
| **20** | `/carnetizacion/plantillas` | «Crear plantilla» fallaba con 400 Bad Request | Serializer exigía `definicion` obligatoria y `creado_por` recibía `"None"` | `CrearPlantillaBorradorInputSerializer` con `definicion` default dict; use case aplica defaults canónicos; `creado_por_id` parseado a int seguro. | Pytest integración (201 Created) |
| **21c** | Módulo Carnetización | Dispersión de pantallas y falta de jerarquía profesional | Múltiples submódulos aislados | **Plan de Rediseño UX Integral O51** (`reportes/O51-CARNET-UX-PLAN.md`) con centralización de emisión, hub de eventos, control QR y prototipo navegable (`reportes/O51-prototipo.html`). | Documento + Prototipo |
| **22** | Plantillas de Carnet | No existían plantillas por defecto en BD | Base de datos limpia sin semillas | Migración de datos idempotente `0008_sembrar_plantillas_por_defecto.py` sembrando plantillas institucionales de Activos (azul marino) y Pasivos (verde) junto con logotipos oficiales en la biblioteca. | Migración + Django Shell |

---

## Verificación de Integridad

- **TypeScript**: `pnpm --prefix NextJS exec tsc --noEmit` $\rightarrow$ **0 errores (Exit code 0)**.
- **Vitest**: `formulario-registro-vivienda.test.tsx`, `notificaciones-ui.test.tsx`, `capturar-grafico.test.ts`, `hitos-solicitud.test.ts`, `textarea.test.tsx`, `form-basic-update-dialog.test.tsx` $\rightarrow$ **100% de pruebas aprobadas**.
- **Pytest**: `test_presencial_api.py`, `test_vivienda_pais_o40.py` con pruebas condicionales y de etiquetas legibles cubiertas.
- **Contenedores**: Cero reinicios y cero modificaciones en caliente sobre contenedores en ejecución.
