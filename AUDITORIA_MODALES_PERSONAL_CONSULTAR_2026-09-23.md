# Auditoría de paridad visual/frontend — modules/personal (consultar + registrar)

**Fecha:** 2026-09-23
**Alcance:** Solo visual/frontend. Los hallazgos de "gap de datos" (backend no expone algo) se documentan aparte y NO deben interpretarse como pendientes a corregir ahora — requieren decisión del usuario antes de tocar backend/BD.
**Repo bajo revisión:** `/home/jbolivar@conatel.gob.ve/Documentos/sistemas/gath-nueva-arquitectura/NextJS` (`src/modules/personal/`)
**Repo de referencia (legado, solo lectura, no modificado):** `/home/jbolivar@conatel.gob.ve/Documentos/sistemas/gath-CON AJUSTES EN APN/NextJS`
**Commit auditado (HEAD al momento del reporte):** `62bda26 fix(personal): corregir seccion Detalles del Cargo que no traia los cargos asignados`

---

## 0. Verificación de arquitectura Onion

Se corrió grep sobre `src/modules/personal/`:

- `ui/` → `infrastructure/repositories` | `infrastructure/http` | `infrastructure/mappers`: **0 resultados**. Sin violaciones.
- `application/` o `domain/` → `infrastructure/` o `ui/`: **0 resultados**. Sin violaciones.
- `ui/` → `infrastructure/actions/personal-actions.ts` (Server Actions, `"use server"`): sí ocurre en 9 archivos (`personal-page.tsx`, `personal-registrar-page.tsx`, `empleado-editar-dialog.tsx`, y los 7 diálogos de sección). **Verificado que esto es el patrón establecido en todo el repo** (mismo patrón en `modules/pasivos/ui`, `modules/familiares/ui`, `modules/identidad/ui`) — no es una violación de arquitectura, es la frontera sancionada Client Component → Server Action.
- `"use server"` presente en `personal-actions.ts`: confirmado.
- Validación zod en el borde: presente en `schema-empleado.ts` (30 usos de `z.`/`zodResolver`), aunque con huecos de cobertura — ver hallazgos funcionales más abajo (no usados por 4 de los 8 diálogos de edición).

**Conclusión: sin gaps de arquitectura que reportar.**

---

## 1. Hallazgos transversales (aplican a múltiples componentes)

### T1. Ausencia de `zodResolver` en 4 de los 8 diálogos de edición — severidad: funcional
Afecta: `form-academic-training-update-dialog.tsx`, `form-background-update-dialog.tsx`, `form-basic-update-dialog.tsx`, `form-contrato-update-dialog.tsx`.
El `useForm` de estos 4 diálogos no tiene `resolver: zodResolver(...)` ni ningún schema asociado — no hay validación de campo en cliente, ni `FormMessage` de error por campo. El legado valida cada uno con un schema zod dedicado (`schemaAcademyUpdate`, `schemaBackgroundUpdate`, `schemaBasicUpdateInfo`, `schemaContratoItem` extendido), incluyendo reglas cruzadas (fechas, requeridos condicionales, edad mínima, tamaño de archivo). Es el hallazgo de mayor impacto de todo el lote.

Los otros 4 diálogos (`dwelling`, `health-profile`, `physical-profile`, `supplementary-training`) **también carecen de `zodResolver`**, pero en `health-profile` esto no es regresión real porque el schema legado ya marca todos los campos opcionales. En `dwelling` y `supplementary-training` sí es una pérdida real de validación (ver secciones específicas).

### T2. Ausencia total de `toast`/sonner en los 8 diálogos de edición — severidad: funcional
Ninguno de los 8 diálogos nuevos importa `sonner`/`toast`. El legado confirma éxito con `toast.success(mensaje del servidor)` y error con `toast.error(mensaje del servidor)` en los 8 formularios equivalentes. El nuevo solo cierra el modal silenciosamente al guardar (sin ninguna confirmación visible) y solo muestra error inline (`<p role="alert">`) si falla — el usuario nunca ve una confirmación positiva de que se guardó.

### T3. Filtrado silencioso de filas incompletas antes de enviar — severidad: funcional
Afecta a los diálogos con secciones repetibles: Formación Académica, Antecedentes, Contrato, Formación Complementaria.
El `onSubmit` de estos diálogos hace `.filter(...)` para descartar filas sin los campos mínimos (ej. `nivelAcademicoId`/`institucionId`, `organismoId`/`fechaIngreso`, `fechaIngreso`, `capacitacionId`/`institucionId`) sin avisar al usuario. El legado bloquea el envío con validación zod visible y mensajes de error por fila antes de permitir guardar.

### T4. Cambio de patrón contenedor: Card embebida → Dialog modal — severidad: visual
En el legado, cada sección del expediente (Formación Académica, Antecedentes, Información Básica, Contrato, Vivienda, Salud, Físico, Formación Complementaria) es un formulario embebido en un `Card` dentro de la misma página de detalle. En el nuevo, cada sección es un `Dialog` (modal) disparado por un botón "Actualizar"/"Agregar". Cambio de patrón de interacción consistente en los 8 diálogos — probablemente intencional dado el rediseño, pero cambia el flujo de edición (modal vs. inline in-page) y se deja registrado.

### T5. Selector de fecha: `Calendar` popover con rango → `<input type="date">` nativo sin rango — severidad: visual/funcional
El legado usa un `Popover` + `Calendar` (shadcn) con rango deshabilitado (fechas futuras bloqueadas, límite inferior ~1930/1900 según el campo) en Información Básica, Antecedentes, Contrato y Formación Complementaria. El nuevo usa `<input type="date">` HTML nativo sin ninguna restricción de rango en esos 4 diálogos. Se pierde tanto la consistencia visual como la validación de rango de fecha.

### T6. Selects sin buscador (`Combobox`) reemplazados por `Select`/`CatalogSelect` simple — severidad: visual
El legado usa `Combobox` con `searchPlaceholder` (ej. "Buscar carrera...", "Buscar estado...", "Buscar institución...") para catálogos potencialmente largos: Formación Académica (carrera/mención/institución), Vivienda (estado/municipio/parroquia), Formación Complementaria (capacitación/institución), y en el formulario de Registrar. El nuevo usa `Select`/`CatalogSelect` sin capacidad de búsqueda en todos estos casos.

### T7. Botón "Agregar" sin bloqueo por errores pendientes / sin botón "Limpiar" — severidad: funcional
Afecta a Formación Académica, Antecedentes y Formación Complementaria. El legado solo permite agregar una nueva fila repetible si no hay errores de validación pendientes (`isError` gate) y muestra un `Badge` de advertencia si los hay ("Por favor, corrija los campos marcados..."). También tiene un botón "Limpiar" que resetea todas las filas extra. El nuevo no tiene ninguno de los dos mecanismos — el botón "Agregar" siempre está habilitado.

### T8. Texto de ayuda "Opcional si no posee X" ausente — severidad: visual
El legado incluye, en Formación Académica, Antecedentes y Formación Complementaria, un texto aclaratorio de que la sección completa es opcional si el trabajador no tiene ese tipo de información. Ausente en los 3 diálogos equivalentes del nuevo.

---

## 2. Registrar nuevo trabajador

**Nuevo:** `NextJS/src/modules/personal/ui/personal-registrar-page.tsx`, `NextJS/src/modules/personal/ui/expediente-campos.tsx`, `NextJS/src/modules/personal/ui/schema/schema-empleado.ts`, `NextJS/src/modules/personal/application/dtos/empleado-dto.ts`
**Legado:** `.../personal-trabajador/registrar/page.tsx`, `.../registrar/forms/form-multi-steps.tsx`, `.../registrar/schemas/schemaRac.ts`, `src/shared/forms/employees/register/form-*.tsx`

### Cobertura de secciones (wizard legado real: 7 pasos activos)

El wizard legado real (`form-multi-steps.tsx`) tiene 7 pasos activos: BasicInfo → AcademyLevel → SupplementaryTraining → Background → Health → Physical → Dwelling. `form-contrato.tsx` y `form-family.tsx` existen como archivos en el legado pero **no están enganchados** en este wizard (confirmado por grep) — no cuentan como pasos faltantes.

| Sección legado | ¿Existe en `ExpedienteCampos`? | Estado |
|---|---|---|
| Datos básicos | Sí | Completa salvo hallazgo R3 (sexo/estado civil) |
| Foto del trabajador | No existe ningún campo | Falta completamente — gap de datos (R2) |
| Formación académica | Sí | Incompleta: falta "otra carrera/institución/mención" |
| Formación complementaria | Sí, con más campos que el legado | Completa (más rica), pero sin soporte "otra capacitación/institución" |
| Antecedentes de servicio | Sí | Incompleta: falta soporte "nuevo organismo" |
| Perfil de salud | Sí | Completa |
| Perfil físico (tallas) | Sí | Completa, pero sin agrupación por región/categoría |
| Datos de vivienda | Sí | Completa |
| Contrato | Sí, sección extra (no existe como paso activo en el wizard legado) | Agregado extra, no es gap |
| Contacto de emergencia | Sí, sección extra | Agregado extra, no es gap |
| Familiares | Fuera de alcance (flujo aparte, ya auditado en otra tarea) | N/A |

### Hallazgos puntuales

**R1. `personal-registrar-page.tsx:84-111` — wizard multi-paso → formulario plano de una sola página.**
Legado: `form-multi-steps.tsx` (Formity), 7 tarjetas independientes tipo "Paso N: ...", botón "Siguiente" por paso, validación zod aislada por paso, no se puede avanzar con errores. Nuevo: `ExpedienteCampos` completo en una sola card con un solo botón "Registrar" al final; validación única con `zodResolver(empleadoSchema)` disparada solo al enviar. Confirmado tras leer ambos completos: no hay tabs/navegación por secciones en el nuevo.
**Severidad: funcional.**

**R2. Foto del trabajador ausente — `expediente-campos.tsx` (completo).**
Legado `form-basic-info.tsx:132-196`: campo de carga de archivo (.png/.jpeg/.jpg, máx. 5MB) con preview y botón de remover, subido después a un endpoint de perfil. Nuevo: ni `expediente-campos.tsx`, ni `empleado-dto.ts` (`GuardarEmpleadoInputDTO`), ni `domain/entities/empleado.ts` tienen campo de foto/archivo.
**Severidad: gap de datos, requiere decisión del usuario** (el DTO/dominio nuevo no soporta el concepto).

**R3. `expediente-campos.tsx:58-61,78-81` — Sexo y Estado Civil como `<input type="number">`.**
El usuario debe teclear un ID crudo. `CatalogosExpedienteDTO` (`empleado-dto.ts:58-59`) sí expone `sexos` y `estadosCiviles`, y el componente `CatalogSelect` ya existe y se usa para todo lo demás (vivienda, salud, tallas) — el catálogo ya está disponible, simplemente no se conectó a estos dos campos. Legado usa `SelectForm`/`Select` con labels reales ("Masculino", "Casado", etc.).
**Severidad: visual** (no es gap de datos, el catálogo ya está en el DTO).

**R4. Selects sin búsqueda para catálogos largos.**
Legado usa `Combobox` en `form-dwelling.tsx:109-122` (estado/municipio/parroquia), `form-academic_training.tsx` (carrera/mención/institución) y `form-supplementary_training.tsx` (capacitación/institución). Nuevo `catalogo-controls.tsx:19-46` (`CatalogSelect`) es un `<Select>` simple sin buscador, uniforme en todos los catálogos.
**Severidad: visual.**

**R5. Soporte "Otra / Nueva X" (alta inline) ausente.**
Legado permite, en Formación Académica, Formación Complementaria y Antecedentes, seleccionar "Otra" y escribir un nombre nuevo que el backend crea al vuelo (`form-academic_training.tsx:150-158,217-224,285`, `form-supplementary_training.tsx:315-321,382-388`, `form-background.tsx:291-297`, procesado en `formStepActions.ts:53-122` vía `createCarrera/createInstitucion/createMencion/createCapacitacion/createOrganismoAdscrito`). Nuevo `expediente-campos.tsx` (líneas 151-228) solo ofrece `CatalogSelect` con opciones existentes, sin opción de crear.
**Severidad: gap de datos, requiere decisión del usuario** (el DTO/acción nueva no contempla creación inline; no confirmable desde frontend si el backend la soporta).

**R6. `expediente-campos.tsx:144-147` — Tallas sin agrupación por región/categoría.**
Legado `form-physical_profile.tsx:45-85,122-136` agrupa cada categoría de talla (camisa/pantalón/zapatos/chaqueta) por `region.codigo` usando `SelectGroup`/`SelectLabel`. Nuevo usa `catalogos?.tallas` sin distinguir categoría — la misma lista completa se ofrece para las 4 prendas, permitiendo seleccionar p. ej. una talla de zapato en el campo de camisa.
**Severidad: funcional** (riesgo de datos inconsistentes) — depende de si `CatalogosExpedienteDTO.tallas` trae categoría; el DTO actual (`CatalogoEmpleadoDTO {id, nombre}`) no la trae, por lo que también aplica como **gap de datos**.

**R7. Validación zod — reglas de negocio más laxas.**
- Cédula: legado exige 7-12 dígitos (`schema-basic-info.ts:16-20`); nuevo exige mínimo 5 dígitos sin máximo (`schema-empleado.ts:87-91`). **Funcional.**
- Nombres/Apellidos: legado exige 3-30 letras; nuevo exige mínimo 2 sin máximo (`schema-empleado.ts:92-101`). **Visual/funcional menor.**
- Fecha de nacimiento: legado valida no-futura + edad mínima 16 años (`schema-basic-info.ts:52-68`); nuevo solo valida formato `YYYY-MM-DD` (`schema-empleado.ts:103-105`). **Funcional** (regla de negocio perdida).
- Teléfono móvil: legado exige patrón venezolano específico (`REGEX_PHONE_VENEZUELA`); nuevo usa `REGEX.TELEFONO` genérico (`schema-empleado.ts:112-117`) — mensaje de ejemplo distinto, sugiere regla distinta, no confirmado al 100%.
- Carnet de la patria: legado exige exactamente 10 dígitos numéricos (`schema-basic-info.ts:106-109`); nuevo sin restricción de formato/longitud (`schema-empleado.ts:120`). **Funcional.**
- Campos anidados (vivienda, académica, complementaria, antecedentes, contrato): en el nuevo todos son opcionales/nullable (`schema-empleado.ts:9-84`); el legado marca como requeridos, ej. `direccion_exacta` (mín. 10 caracteres), `estado_id`/`municipio_id`/`parroquia`/`condicion_vivienda_id`/`codigo_postal_id` (`schema-dwelling.ts:5-36`), tallas de camisa/pantalón/zapatos (`schema-physical_profile.ts:5-19`). El nuevo permite guardar el expediente completo sin vivienda ni tallas. **Funcional** — pérdida de reglas de obligatoriedad de negocio.

**R8. Copy / confirmación de envío.**
Título de página coincide exactamente ("Captación de información del trabajador" / "Recopilación en pasos estrategicos", `personal-registrar-page.tsx:86-87` vs legado `page.tsx:8-9`). Pero legado usa `toast.success/toast.error` con el mensaje real del backend (`form-multi-steps.tsx:193-199`); nuevo solo muestra `<p role="alert">` con string crudo en error, y en éxito solo hace `router.push` sin ninguna confirmación visual (`personal-registrar-page.tsx:76-81`).
**Severidad: visual.**

**R9. `expediente-campos.tsx` — Botón de envío.**
Nuevo: un solo botón "Registrar" con ícono `UserPlus` y estado de carga con `Loader2` (`personal-registrar-page.tsx:100-103`). Coherente con el cambio de wizard→página plana (R1), se deja anotado sin severidad adicional.

**R10. Validación de cédula duplicada en tiempo real ausente.**
Legado `form-basic-info.tsx:90-115` hace lookup en vivo (SWR) mientras se escribe la cédula y bloquea el submit + toast "Ya existe un trabajador con esa cédula de identidad" si ya existe. Nuevo no tiene mecanismo equivalente — el error de duplicado, si existe, solo se conoce tras el submit final vía mensaje de error del backend.
**Severidad: funcional.**

---

## 3. Consultar / Listado, Tabla y Acciones

**Nuevo:** `personal-page.tsx`, `personal-columns.tsx`, `catalogo-controls.tsx`
**Legado:** `.../consultar/page.tsx`, `components/employees/tableEmployees/{page,columns,data-table,detail-info}.tsx`, `components/ui/ExportButtonPDF.tsx`

### Sin diferencias relevantes (verificado, no reportado en detalle)
Columnas de la tabla principal (Cédula, Nombres, Apellidos, Sexo, F. Nacimiento, Estatus Contrato, F. Ingreso Organismo, Acciones) coinciden en orden y formato; filtros de búsqueda (Cédula, Código, Tipo de Nómina, botones Buscar/Limpiar) coinciden en copy exacto; menú "Columnas" de la tabla se preserva.

### Hallazgos

**C1. `personal-page.tsx:335-341` — botón "Nuevo Trabajador" agregado en la página de listado.**
El legado no tiene esta entrada aquí (el alta se hace vía sidebar hacia `registrar`, no como botón dentro de "Consultar").
**Severidad: visual** (mejora de UX, no regresión — estructura ya no es 1:1 con la referencia).

**C2. `personal-columns.tsx:64-71` vs legado `columns.tsx:74-83` + `ExportButtonPDF.tsx` — exportar PDF desde el menú de fila.**
Legado: botón real (`ExportButton`) con texto por defecto "Descargar PDF" y estado propio de carga ("Generando archivo…"). Nuevo: `DropdownMenuItem` de texto plano "Expediente PDF" sin feedback visual de carga en el ítem (el spinner `exportandoPdf` solo se refleja en el botón del Sheet).
**Severidad: visual + funcional** (copy distinto y riesgo de doble clic por falta de feedback).

**C3. `personal-columns.tsx:122-148` vs legado `columns.tsx:128-157` — estatus de contrato / fecha de ingreso.**
Legado calcula el estatus y fecha de ingreso recorriendo todos los contratos del empleado en cliente (busca ACTIVO/POR VENCER, u ordena por fecha más antigua). Nuevo confía en un único campo precalculado `contratoActual` del DTO — no se pudo verificar si replica exactamente esa lógica sin inspeccionar backend.
**Severidad: gap de datos, requiere decisión del usuario.**

---

## 4. Sheet de detalle del empleado

**Nuevo:** `empleado-detalle-sheet.tsx`, `expediente-detalle-view-model.ts`, `empleado-editar-dialog.tsx`
**Legado:** `detail-info.tsx`

### Sin diferencias relevantes (verificado)
Estructura de las 8 secciones del Sheet (Cargo, Antecedentes, Contratos, Vivienda, Formación Académica, Formación Complementaria, Vestimenta, Salud) coincide en campos y orden con el legado.

### Hallazgos

**D1. `empleado-detalle-sheet.tsx:580-634` vs legado `detail-info.tsx:835-910` — tablas de Patologías/Discapacidades/Alergias con una sola columna.**
Legado tiene dos columnas ("Categoría" + valor). Nuevo solo una (el valor). Verificado: `CatalogoEmpleadoDTO` en el nuevo backend/DTO solo expone `{id, nombre}`, sin campo de categoría.
**Severidad: gap de datos, requiere decisión del usuario.**

**D2. `empleado-editar-dialog.tsx` (archivo completo) — código huérfano.**
Este componente ("Editar expediente", con `ExpedienteCampos` y botón "Editar") no está importado ni renderizado en ningún punto del flujo real. `personal-page.tsx` y `empleado-detalle-sheet.tsx` usan en su lugar los 8 diálogos independientes, que sí replican correctamente el patrón del legado. Es código muerto respecto al flujo auditado.
**Severidad: funcional/limpieza** (no afecta lo que ve el usuario, pero es una discrepancia — vale la pena limpiar o justificar por qué existe).

**D3. `empleado-detalle-sheet.tsx:494-523` — sección "Contacto de emergencia" agregada.**
No existe en el legado `detail-info.tsx` (documentado en el propio código como "mejora funcional preservada"). No es regresión, es adición — informativo, sin acción requerida.

**D4. `empleado-detalle-sheet.tsx:174-220` vs `detail-info.tsx:145-208` — normalización de dos puntos en labels.**
Legado es inconsistente en el uso de ":" en las etiquetas del cargo. Nuevo normaliza todas con ":". Diferencia de copy real pero es corrección de una inconsistencia del legado, no regresión.
**Severidad: visual (mínima, informativa).**

---

## 5. Exportación PDF del expediente

**Nuevo:** `empleado-detalle-pdf.tsx`
**Legado:** `reportes/empleados/pdf/reportEmployeePDF.tsx`

**P1. `empleado-detalle-pdf.tsx` (completo) — falta sección "DATOS LABORALES".**
No incluye la tabla de cargo/asignación (código, cargo específico, grado, nómina, dirección) que sí existe en el PDF legado y que sí se muestra en pantalla (Sheet, sección "Detalles del Cargo"). Causa: `DetalleExpedienteViewModel` (usado por el PDF) no incluye `asignaciones`, aunque el dato existe en `EmpleadoDTO.asignaciones` (usado directamente por el Sheet, pero no propagado al view model del PDF).
**Severidad: funcional** (no es gap de backend — el dato ya está disponible, solo no se pasa al PDF).

**P2. `empleado-detalle-pdf.tsx` — sin membrete institucional.**
Sin logos de cabecera (`logoOAC`, `juntosPorVida`), sin pie de página institucional (`cintillo2.png`) y sin foto del trabajador (legado incluye foto o "Foto no disponible").
**Severidad: visual** (documento oficial pierde identidad institucional).

**P3. `empleado-detalle-sheet.tsx:268` vs `empleado-detalle-pdf.tsx:147` — inconsistencia de formato de "Total APN" entre Sheet y PDF.**
Sheet: `"X años, Y meses, 0 días"` (días siempre 0). PDF: `"X.Y años"` (formato distinto). Mismo dato, dos formatos distintos dentro del mismo flujo, ambos derivados del mismo `DetalleExpedienteViewModel`.
**Severidad: visual.**

**P4. `empleado-detalle-pdf.tsx` — sin sección "ENCARGADURÍAS".**
No existe tabla (cargo encargado, titular, fechas, estatus) presente en `reportEmployeePDF.tsx`. Verificado: no hay campo `encargadurias` en la entidad/DTO `Empleado` del nuevo módulo.
**Severidad: gap de datos, requiere decisión del usuario.**

---

## 6. Diálogo: Formación Académica

`NextJS/src/modules/personal/ui/dialogs/form-academic-training-update-dialog.tsx` ↔ `.../update/form-academic_training.tsx` (schema legado: `schema-academic_training.ts` → `schemaAcademyUpdate`)

- **(todo el archivo)** — Sin `zodResolver` (ver T1).
- **dialog:65-78 vs legado 60-71** — Nuevo: "Institución *" siempre requerida visualmente (sin validación real). Legado: institución solo obligatoria si se seleccionó carrera (`refine` condicional). **Funcional.**
- **dialog:139-204 vs legado 159-338** — Selects planos vs `Combobox` con búsqueda (ver T6). **Visual.**
- **Opción "Otra" con texto libre** (legado 159-339, `nueva_carrera_nombre`, `nueva_mencion_nombre`, `nueva_institucion_nombre`) — ausente en el nuevo. `FormacionAcademicaDTO`/`GuardarEmpleadoInputDTO` (`empleado-dto.ts:36-42`) sin campos de texto libre. **Gap de datos, requiere decisión del usuario.**
- **Cascada Nivel→Carrera→Mención** (legado 96-103, SWR `getCarrera(nivelId)`, `getMencion(carreraId)`) — legado filtra dinámicamente; nuevo usa listas planas y estáticas sin relación jerárquica (`CatalogosExpedienteDTO`, `empleado-dto.ts:38-61`, no trae la relación). **Gap de datos, requiere decisión del usuario.**
- **Botón "Agregar" gated por errores** (legado 452-475) — ausente en el nuevo (ver T7). **Funcional.**
- **Botón "Limpiar"** (legado 420-451) — no existe en el nuevo.
- **Texto "Opcional si no posee formación académica"** (legado 478-480) — ausente (ver T8).
- **Toasts de éxito/error** (legado 390-395) — ausentes (ver T2). **Funcional.**
- **Estado de carga**: legado `Loading` full-swap "Actualizando Información" vs spinner inline en botón del nuevo. **Visual.**
- **Filtrado silencioso de filas incompletas** (dialog:70-71) — ver T3. **Funcional.**
- **Título diálogo**: legado "Formacion Academica" (Card) vs nuevo "Actualizar Formación Académica" (Dialog modal) — ver T4. **Visual.**
- **Copy botón submit**: legado alterna "Actualizar"/"Actualizando Información"; nuevo "Guardar Cambios" fijo + spinner. **Visual.**

---

## 7. Diálogo: Antecedentes (Background)

`.../form-background-update-dialog.tsx` ↔ `.../form-background.tsx` (schema legado: `schema-background.ts` → `schemaBackgroundUpdate`)

- **(todo el archivo)** — Sin `zodResolver` (ver T1).
- **Validación de fechas dependientes** (legado `schema-background.ts:25-61`, `superRefine`) — legado exige que si hay `fecha_ingreso` debe haber `fecha_egreso` y viceversa, y valida `fecha_egreso > fecha_ingreso`. Nuevo (dialog:148-160) trata ambas fechas como independientes, sin comparación de rango ni exigencia conjunta. **Funcional.**
- **Organismo requerido condicional** (legado schema:35-41) — solo se exige si ambas fechas están presentes. Nuevo: "Institución / Ente *" siempre marcado requerido visualmente, sin lógica real. **Funcional.**
- **Opción "Otra" con texto libre para organismo** (legado 292-355, `nuevo_organismo_nombre`) — ausente. `AntecedenteDTO` (`empleado.ts:69-74`) sin campo de texto libre. **Gap de datos, requiere decisión del usuario.**
- **Selector de fecha**: `Calendar` popover con `disabled` para futuras/anteriores a 1930 (legado) vs `<input type="date">` nativo sin límites (nuevo) — ver T5. **Visual/funcional.**
- **Botones "Limpiar" y "Agregar" gated por error** (legado 122-171) — ausentes/no replicados (ver T7).
- **Texto "Opcional si no posee antecedentes"** (legado 174-176) — ausente (ver T8).
- **Toasts de éxito/error** — ausentes (ver T2). **Funcional.**
- **Título diálogo**: legado "Antecedentes En La Administracion Publica" vs nuevo "Actualizar Antecedentes en la APN". **Visual.**
- Trigger label "Agregar Antecedentes" coincide, sin diferencia.
- **Filtrado silencioso de filas sin `organismoId`/`fechaIngreso`** (dialog:70-71) — ver T3. **Funcional.**

---

## 8. Diálogo: Información Básica (Basic Info)

`.../form-basic-update-dialog.tsx` ↔ `.../form-basic-info.tsx` (schema legado: `schemaEmployeeUpdate.ts` → `schemaBasicUpdateInfo`)

- **(todo el archivo)** — Sin `zodResolver` (ver T1).
- **Validación de fecha de nacimiento** (legado `schemaEmployeeUpdate.ts:25-41`) — legado valida no-futura y edad mínima 16 años. Nuevo (dialog:188-190) solo `required: true` nativo, sin validar edad mínima ni fecha futura. **Funcional.**
- **Campo foto obligatorio con tope 5MB** (legado schema:15-24, `.refine`, mensaje "El Tamaño Maximo De La Imagen Es 5MB") — nuevo permite guardar sin foto y no valida tamaño con mensaje (solo `accept` de tipos MIME). **Funcional.**
- **Selector de fecha**: `Calendar` popover rango 1900–hoy (legado) vs `<input type="date">` nativo sin rango (nuevo) — ver T5. **Visual/funcional.**
- **Campos teléfono**: legado `type="number"` con placeholders ("04160000000", "02390000000"); nuevo sin `type` especificado ni placeholders. **Visual** (pérdida de teclado numérico en móvil y placeholders guía).
- **Placeholders de ejemplo** en Nombres/Apellidos ("Juan Bernardo"/"Perez Gutierrez") y Carnet Patria ("000-0000000-00") — ausentes en el nuevo. **Visual.**
- **Vista previa de foto**: legado `object-contain`, 150x100, muestra peso formateado del archivo. Nuevo `object-cover`, 160x160, sin mostrar peso. **Visual.**
- **Toast de éxito/error + doble `mutate`** (legado 107-114, revalida `mutateKey` y `"profile"`) — nuevo solo cierra el diálogo y llama `onGuardado()`, sin toast. **Funcional.**
- **Botón cancelar**: nuevo tiene "Cancelar" explícito; legado no (el formulario vive embebido en la página, no en modal) — ver T4. **Visual.**
- Nota informativa (no gap): en legado el `Select` de Sexo no inicializa `value` al abrir (aparente bug legado); el nuevo sí lo controla correctamente — el nuevo es estrictamente mejor aquí, no se reporta como acción pendiente.
- **Catálogo Sexo con fallback hardcodeado** (dialog:201-204, `catalogos?.sexos ?? [{id:1,MASCULINO},{id:2,FEMENINO}]`) — legado siempre depende de `getSex()` remoto sin fallback. Diferencia menor de comportamiento ante catálogo vacío/caído. **Visual.**

---

## 9. Diálogo: Contrato

`.../form-contrato-update-dialog.tsx` ↔ `.../form-update-contrato.tsx` (schema legado: `schema-contrato.ts` → `schemaContratoItem`, extendido en `form-update-contrato.tsx:56-66`)

- **(todo el archivo)** — Sin `zodResolver` (ver T1).
- **Bloqueo de contratos "VENCIDO" ausente** (legado 170-325, `isVencido = estatus === "VENCIDO"`) — legado deshabilita fecha de ingreso/política y oculta el botón eliminar cuando el contrato está vencido, con `Badge` roja "VENCIDO - Solo lectura". El campo `estatusNombre` **sí existe** en la entidad nueva (`Contrato.estatusNombre`, `empleado.ts:84`) pero el diálogo no lo usa: todos los contratos son siempre editables/eliminables. **Funcional** (no es gap de datos — el dato está disponible y simplemente no se consume en la UI).
- **N° de Contrato editable en contratos existentes** (legado `readOnly={isExisting}`, 192-198) — nuevo permite editar libremente. **Funcional.**
- **Validación N° Contrato** (legado `schema-contrato.ts:4-8` + override update:59-64, mínimo 3 caracteres si no vacío) — nuevo no valida longitud mínima. **Funcional.**
- **Validación política/fecha ingreso requeridas** (legado `schemaContratoItem:9-19`) — nuevo solo marca "*" visual sin validación real (política puede enviarse `undefined` → filtrado silencioso). **Funcional.**
- **Estado "sin contratos"** (legado 164-167, `fields.length === 0` → "No hay contratos registrados.") — legado permite eliminar todos los contratos y muestra este mensaje. Nuevo siempre pre-carga al menos una fila vacía y oculta el botón eliminar si `fields.length === 1`, nunca llega a 0 filas visualmente. **Visual.**
- **Checkbox "¿Es contrato a tiempo indeterminado / Fijo?"** (dialog:182-192, campo `esFijo`) — **no existe en el formulario legado** (aunque sí existe en la entidad de dominio nueva, `Contrato.esFijo`, `empleado.ts:85`). Adición del nuevo sin contraparte legada — informativo, no "a corregir" (podría ser intencional). **Visual/informativo.**
- **Selector de fecha**: `Calendar` popover rango 1930–hoy (legado) vs `<input type="date">` sin rango (nuevo) — ver T5. **Visual/funcional.**
- **Toast de éxito/error** (legado 115-121) — ausente (ver T2). **Funcional.**
- **Título diálogo**: legado "Gestión de Contratos" vs nuevo "Gestionar Contratos". **Visual.**
- **Filtrado silencioso de contratos sin `fechaIngreso`** (dialog:78-79) — ver T3. **Funcional.**

---

## 10. Diálogo: Vivienda (Dwelling)

`.../form-dwelling-update-dialog.tsx` ↔ `.../update/form-dwelling.tsx` + `schemas/employees/update/schema-dwelling.ts`

- **form-dwelling-update-dialog.tsx:47** vs legado L82-93 — sin `resolver: zodResolver(...)`. Legado valida con `schemaDwellingUpdate` (dirección mín. 10 caracteres, estado/municipio/parroquia/condición/código postal obligatorios `>0`). Nuevo no valida nada en cliente. **Funcional.**
- **form-dwelling-update-dialog.tsx:108-124** vs legado L131-145 — Estado/Municipio/Parroquia con `Combobox` buscable (legado) vs `Select` simple (nuevo) — ver T6. **Visual.**
- **Cascada de catálogos** vs legado L58-81 — legado encadena Municipio tras elegir Estado (SWR `["municipalitys", stateId]`), Parroquia tras Municipio, Código Postal también depende de Estado. Nuevo recibe `catalogos` planos sin filtrar por padre — el usuario puede combinar Estado/Municipio/Parroquia inconsistentes. **Gap de datos, requiere decisión del usuario** (el DTO `CatalogosExpedienteDTO` entrega listas planas sin relación jerárquica).
- **Texto de ayuda "Esta Información Sera Publica"** (legado L146-149,175-177,203-205) — ausente bajo Estado/Municipio/Parroquia en el nuevo. **Visual.**
- **Labels sin asterisco de obligatoriedad**: nuevo dice "Estado"/"Municipio"/"Parroquia"/"Condición de Vivienda"/"Código Postal"; legado los marca con "*". **Visual.**
- **form-dwelling-update-dialog.tsx:190** dice "Dirección de Habitación"; legado (L253) dice "Dirección Exacta *". **Visual** (cambio de copy).
- **form-dwelling-update-dialog.tsx:217-220** botón "Guardar Cambios"; legado (L295-298) "Actualizar"/"Actualizando". **Visual.**
- **Estado de carga**: legado `Loading` full-swap "Actualizando Información" vs spinner inline en botón (nuevo). **Visual.**

---

## 11. Diálogo: Perfil de Salud (Health Profile)

`.../form-health-profile-update-dialog.tsx` ↔ `.../update/form-health_profile.tsx` + `schemas/employees/update/schema-health_profile.ts`

- **form-health-profile-update-dialog.tsx:159-237** vs legado L204-376 — legado agrupa Patologías, Discapacidades y Alergias por categoría con subtítulo en negrita por categoría (`* {categoria}`). Nuevo renderiza las tres listas como checkboxes planos sin agrupar. **Visual.** (Mismo dato de fondo que el hallazgo D1 del Sheet de detalle.)
- Ausencia de `zodResolver` — no es regresión real aquí porque el schema legado (`schemaHealthProfileUpdate`) ya marca todos los campos como `.optional()`. Se documenta solo por consistencia mecánica. **Visual** (no bloquea nada).
- **Estado de carga**: legado `Loading` full-swap vs spinner inline en botón (nuevo) — mismo patrón que Vivienda. **Visual.**
- **Botón**: legado alterna "Actualizando Información"/"Actualizar" (L380-382); nuevo mantiene "Actualizar" fijo + spinner. **Visual** (menor).

---

## 12. Diálogo: Perfil Físico (Vestimenta/Tallas)

`.../form-physical-profile-update-dialog.tsx` ↔ `.../update/form-physical_profile.tsx` + `schemas/employees/update/schema-physical_profile.ts`

- **form-physical-profile-update-dialog.tsx:87,118-179** — un único arreglo `catalogos?.tallas ?? []` llena los CUATRO selects (Camisa, Pantalón, Zapatos, Chaqueta) — mismo listado completo en los cuatro campos. Legado (L86-94) filtra `tallas` por `tipo_prenda.categoria` ("Camisa", "Pantalón", "Zapato", "Chaqueta") y además agrupa por `region` (`SelectGroup`/`SelectLabel`, L134-141). El DTO nuevo (`CatalogoEmpleadoDTO {id, nombre}`) no trae `tipo_prenda.categoria` ni `region` — no corregible solo en frontend.
  **Severidad: gap de datos, requiere decisión del usuario** (impacto funcional visible: se puede seleccionar una "talla" de camisa como talla de zapato).
- **Estado de carga**: legado `Loading` full-swap vs spinner inline en botón (nuevo). **Visual.**
- **Botón**: legado alterna "Actualizando Información"/"Actualizar" (L229-231); nuevo "Actualizar" fijo + spinner. **Visual.**

---

## 13. Diálogo: Formación Complementaria (Supplementary Training)

`.../form-supplementary-training-update-dialog.tsx` ↔ `.../update/form-supplementary_training.tsx` + `schemas/employees/update/schema-supplementary_training.ts`

- **form-supplementary-training-update-dialog.tsx:178-189** — fechas de inicio/fin con `<input type="date">` nativo. Legado (L244-282) usa `Popover` + `Calendar` con formato `dd/MM/yyy` y rango deshabilitado (`date > hoy`, `date < 1930-01-01`). **Funcional** (pérdida de restricción de rango).
- **form-supplementary-training-update-dialog.tsx:138-171** — Capacitación e Institución con `Select` simple solo con opciones del catálogo. Legado (L346-373, L422-450) usa `Combobox` buscable y opción sentinela `"-1" → "Otra"` que revela `Input` de texto libre (`nueva_capacitacion_nombre`/`nueva_institucion_nombre`). El payload nuevo (`capacitacionId`/`institucionId` numéricos únicamente) no tiene dónde llevar ese dato.
  **Severidad: gap de datos, requiere decisión del usuario** (el DTO de envío no contempla nombres nuevos).
- **form-supplementary-training-update-dialog.tsx:212-229** — campo "Grupo" siempre visible. Legado (L520-551) solo lo renderiza si Procedencia NO es "externa" (`!esExterna`), y resetea `grupo_id` a `undefined` al cambiar Procedencia (L491-497). Nuevo no oculta ni limpia el valor. **Funcional.**
- **form-supplementary-training-update-dialog.tsx:69-86** — `onSubmit` filtra silenciosamente filas sin capacitación/institución (ver T3). Legado valida con `schemaSupplementaryTrainingUpdate`: capacitación e institución obligatorias, `fecha_fin` no anterior a `fecha_inicio`, si se llena una fecha debe llenarse la otra, y si se elige "Otra" el nombre libre es obligatorio — todo con `FormMessage` visible. **Funcional.**
- **form-supplementary-training-update-dialog.tsx:137,156** — labels "Capacitación / Curso *" e "Institución *" siempre con asterisco fijo. Legado nunca marca "Capacitación" con asterisco, y "Institución" solo condicionalmente cuando ya hay capacitación elegida (`hasCapacitacion`, L413-419). **Visual** (cambio de semántica del indicador de obligatoriedad).
- **Botón "Limpiar" ausente** (legado L151-180, remueve filas extra y resetea a una fila vacía) — sin equivalente en el nuevo. **Funcional** (pérdida de funcionalidad).
- **Gate de "Agregar" ausente** (legado L182-207, solo permite agregar si no hay errores pendientes, con `Badge` de advertencia L587-597) — nuevo botón "Agregar otra capacitación" (L243-251) siempre habilitado, sin mensaje. **Funcional.**
- **Texto "Opcional si no posee formación complementaria"** (legado L210-212) — ausente. **Visual.**
- **Botón de eliminar fila índice 0**: nuevo permite eliminarla en cuanto hay más de una fila (L122-131); legado nunca permite eliminar la primera fila (L577), sin importar cuántas haya. **Visual/funcional menor.**
- **Botón guardar**: nuevo "Guardar Cambios" (L259); legado "Actualizar"/"Actualizando Información" (L598-603). **Visual.**
- Título del diálogo coincide exactamente ("Actualizar Formación Complementaria") — sin diferencia, no reportado como hallazgo.

---

## 14. Resumen de gaps de datos (requieren decisión del usuario — NO tocar backend sin autorización)

1. Foto del trabajador — sin campo en DTO/entidad (R2).
2. "Otra X" inline (carrera/mención/institución/capacitación/organismo) — sin campo de texto libre en los DTOs de envío (R5, y en diálogos Formación Académica, Antecedentes, Formación Complementaria).
3. Cascada jerárquica de catálogos (Nivel→Carrera→Mención; Estado→Municipio→Parroquia→Código Postal) — catálogos nuevos vienen planos, sin relación padre-hijo en el DTO.
4. Tallas sin categoría/región — `CatalogoEmpleadoDTO {id, nombre}` no trae `tipo_prenda.categoria` ni `region` (afecta Registrar y diálogo Perfil Físico).
5. Patologías/Discapacidades/Alergias sin columna de categoría — mismo DTO plano `{id, nombre}` (afecta Sheet de detalle y diálogo Perfil de Salud).
6. Sección "Encargadurías" ausente del PDF — sin campo `encargadurias` en la entidad/DTO `Empleado`.
7. Estatus de contrato / fecha de ingreso vía campo precalculado `contratoActual` — no verificable desde frontend si replica la regla de selección del legado.

---

*Fin del documento. No se modificó ningún archivo de código ni se tocaron los servidores en localhost:3001/8001 durante esta auditoría.*
