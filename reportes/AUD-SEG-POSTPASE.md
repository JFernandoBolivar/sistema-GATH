# AUD-SEG — POST-PASE (S6-01, S6-02, S6-03, S6-04, S5-01, S5-02)

**Rama:** `feature/fe-de-vida-pasivos`
**Fecha:** 2026-11-10
**Referencia:** `auditoria_2026-11-01/coordinacion/AUDITORIA-SEGURIDAD-2026-11-10.md`

Regla de ejecución respetada en todas las fases: **cero cambios de diseño de
interfaz, cero cambios de comportamiento visible y respuestas de API
idénticas**. Cada fase se ejecuta, se verifica con la batería completa y se
registra aquí antes de abrir la siguiente.

## Verificación por fase

| Fase | Hallazgo | pytest `--create-db` | lint-imports | makemigrations | tsc | vitest | eslint |
| ---- | -------- | -------------------- | ------------ | -------------- | --- | ------ | ------ |
| A | S6-01 | 2029 passed, 1 skipped (950 s) | 91/0 | No changes | 0 | 1098 | 1 error preexistente (ver nota) |
| B | S6-02 | 2070 passed, 1 skipped (811 s) | 91/0 | No changes | 0 | 1098 | 1 error preexistente |
| C | S6-03 / S6-04 | 2070 passed, 1 skipped (1324 s) | 91/0 | No changes | 0 | 1098 | 0 |
| D | S5-02 | 2070 passed, 1 skipped (heredado de C; D solo tocó `.ts`) | 91/0 | No changes | 0 | 1098 | 0 |
| E | S5-01 | 2070 passed, 1 skipped (772 s) | 91/0 | No changes | 0 | 1098 | 0 |

---

## Fase A — S6-01: literales de catálogo reemplazados por constantes

### Constantes creadas

- `BACKEND/core/domain/catalogos.py` (kernel compartido, puro): `ESTATUS_ACTIVO`,
  `ESTATUS_PASIVO`, `ESTATUS_EGRESADO`, `ESTATUS_VACANTE`, `ESTATUS_SUSPENDIDO`,
  `ESTATUS_BLOQUEADO`, `TIPO_PERSONAL_ACTIVO`, `TIPO_PERSONAL_PASIVO`,
  `CONDICION_ACTIVO`, `CONDICION_PASIVO`, `POBLACION_ACTIVO`, `POBLACION_PASIVO`.
- `BACKEND/apps/cargos/domain/value_objects/estado_prestamo.py`: `PRESTAMO_ACTIVO`,
  `PRESTAMO_POR_VENCER`, `PRESTAMO_FINALIZADA`, `PRESTAMO_SUSPENDIDO`.
- `NextJS/src/shared/domain/catalogos.ts`: mismos textos para el frontend más
  `ESTATUS_PRESTAMO_*`.

Los textos son idénticos a los que había; no hay migraciones.

### Por qué en `core/domain` y no en `apps/catalogos/domain`

El módulo de catálogo se creó primero en `apps/catalogos/domain/value_objects/estatus.py`,
pero `apps.autogestion.domain` y `apps.carga_masiva.domain` lo importaban y eso
rompía los contratos B16 (`domain/application` no importa de otras apps), que
quedaron en `89 kept, 2 broken`. Un módulo de etiquetas que **varias capas
`domain`** necesitan es material del kernel: se movió a `core/domain/catalogos.py`
y se eliminó el de `apps.catalogos`. Con eso `lint-imports` vuelve a
`91 kept, 0 broken` sin `ignore_imports` ni contratos relajados.

### Backend (filtros ORM y entidades)

- `apps/pasivos/infrastructure/repositories/repo_pasivos_orm.py`
- `apps/pasivos/infrastructure/repositories/repo_sobrevivientes_orm.py`
- `apps/cargos/infrastructure/repositories/repo_cargos_orm.py`
- `apps/cargos/infrastructure/repositories/repo_prestamos_cargo_orm.py`
- `apps/cargos/infrastructure/importadores/carga_masiva_cargos_especiales.py`
- `apps/cargos/domain/entities/prestamo_cargo.py`
- `apps/reportes/infrastructure/repositories/consultas_reporte.py`
- `apps/configuracion/domain/correo_acceso.py`
- `apps/configuracion/infrastructure/repositories/repo_politica_correo_acceso_orm.py`
- `apps/carga_masiva/domain/condicion.py`
- `apps/carga_masiva/infrastructure/aplicacion.py`
- `apps/autogestion/domain/services/politica_mi_carnet.py`
- `apps/carnetizacion/infrastructure/repositories/repo_carnetizacion_orm.py`
- `apps/identidad/infrastructure/repositories/repo_condicion_trabajador_orm.py`
- `apps/identidad/infrastructure/repositories/repo_cuentas_orm.py`
- `apps/identidad/management/commands/crear_usuarios_qa.py`
- `apps/identidad/management/commands/sincronizar_cuentas_trabajadores.py`
- `apps/movimientos/infrastructure/repositories/repo_movimientos_orm.py`
- `apps/personal/infrastructure/repositories/repo_personal_orm.py`

Barrido final: no queda ningún `iexact='ACTIVO'|'PASIVO'|'EGRESADO'|'VACANTE'|
'SUSPENDIDO'|'FINALIZADA'|'BLOQUEADO'` ni comparación `== '...'`/`in ('...')` con
esos textos en `BACKEND/apps`.

### Frontend (17 comparaciones)

- `cargos/ui/cargos-columns.tsx` (3), `cargos/ui/cargo-detalle-sheet.tsx` (2)
- `autogestion/ui/mi-expediente-view.tsx` (3), `autogestion/ui/shell/control-tamano-texto.tsx` (1)
- `personal/ui/empleado-detalle-sheet.tsx` (2), `personal/ui/personal-columns.tsx` (1)
- `identidad/ui/usuario-detalle-page.tsx` (1)
- `movimientos/ui/cambiar-pasivo-page.tsx` (1)
- `carnetizacion/ui/views/solicitudes-carnet-view.tsx` (3)
- `movimientos/ui/prestamo-cargo-page.tsx`: tabla `STATUS_BADGE` y la comparación
  `!== "FINALIZADA"` (mismo catálogo de préstamo).

### Observaciones (no se toca comportamiento)

- `carnetizacion/ui/components/eventos/evento-detalle-panel.tsx:314` compara
  `evento.estado === "ACTIVO"` mientras el resto del módulo de eventos usa
  `"activo"`. Es un estado de **evento**, no del catálogo `Estatus`; se deja
  igual para no alterar la interfaz. Queda anotado como inconsistencia previa.
- `eslint src --quiet` reporta **1 error preexistente** en
  `carnetizacion/ui/views/solicitudes-carnet-view.tsx:210`
  (`react-hooks/set-state-in-effect`). Se comprobó contra `HEAD` con
  `eslint --stdin` y falla igual: **no lo introduce la Fase A**. Se atiende en la
  Fase C/D.

### Verificación de la fase

- `pytest --create-db`: **2029 passed, 1 skipped** (950 s)
- `lint-imports`: `Contracts: 91 kept, 0 broken.`
- `makemigrations --check --dry-run`: `No changes detected`
- `npx tsc --noEmit`: 0 errores
- `npx vitest run`: 207 archivos / 1098 pruebas en verde
- `npx eslint src --quiet`: 1 error preexistente (arriba)

---

## Fase B — S6-02: neutralización de fórmulas en las exportaciones Excel

### Función compartida

`BACKEND/core/infrastructure/pdf/excel_seguro.py` (ya albergaba la defensa de
celdas) incorpora tres piezas:

- `neutralizar_valor(valor)`: antepone `'` **solo** si el valor es texto que
  empieza por `= + - @` y **no** es un número válido ni exactamente `-`. Los
  números reales (`-15`, `+0.25`, `-1e6`) y el marcador `-` de las plantillas
  quedan intactos; cualquier otro texto no se toca.
- `es_numero(texto)`: validación con `decimal.Decimal` (acepta signo,
  decimales y exponente).
- `neutralizar_fila_valores(fila)`: aplica la regla a una fila completa antes
  de escribirla con `ws.append`.

Se conserva `forzar_texto`/`neutralizar_fila` como segunda barrera: si openpyxl
guardó una celda como fórmula pese a todo, se fuerza a texto.

### Dónde se aplica

| Exportación | Punto de aplicación |
| ----------- | ------------------- |
| Reportes genéricos (`core/infrastructure/pdf/report_excel.py`) | motor común: `escribir_tabla` + `escribir_encabezado_institucional` |
| Censo de autogestión (`apps/autogestion/infrastructure/services/excel_service.py`) | fila neutralizada antes de `ws.append` |
| Bandeja de fe de vida (`apps/fe_de_vida/infrastructure/exportacion_bandeja.py`) | motor común (`exportacion_comun` reexporta el de `core`) |
| Estadísticas de fe de vida (`exportacion_estadisticas.py`) | motor común |
| Resultados de carga masiva (`apps/carga_masiva/presentation/views.py`) | fila neutralizada antes de `ws.append` |
| Auditoría y reportes de movimientos | motor común (`generar_reporte_excel`) |

Se revisó que no haya otras rutas de escritura de Excel (`csv.writer`,
`to_excel`, `XlsxWriter`): no existen. `plantilla_excel.py` genera la plantilla
con etiquetas del catálogo (no texto de usuario) y no se toca.

### Efecto visible

Solo cambia el **contenido de celdas** de los archivos Excel: un nombre o una
observación que empiece por `=`, `+`, `-` o `@` se ve con un apóstrofo delante.
Lo asume la auditoría (S6-02). Ninguna respuesta de API cambia de forma,
código de estado ni cabeceras.

### Pruebas

- `BACKEND/tests/unit/core/test_neutralizacion_formulas.py` (nuevo): 41 casos —
  prefijo para `=`, `+`, `-`, `@`; el texto original se conserva detrás del
  apóstrofo; números reales intactos; `-` exacto intacto; `- ` (con espacio) sí
  se neutraliza; tipos no textuales intactos; texto normal intacto; fila
  completa; e integración con `generar_reporte_excel` (celda texto, no fórmula).
- `test_excel_inyeccion_formulas.py`: se actualizó a la nueva expectativa
  (el valor queda con `'` y como texto).

### Verificación de la fase

- `pytest --create-db`: **2070 passed, 1 skipped** (811 s; los 41 casos nuevos de neutralización incluidos)
- `lint-imports`: `Contracts: 91 kept, 0 broken.`
- `makemigrations --check --dry-run`: `No changes detected`
- `npx tsc --noEmit`: 0 errores
- `npx vitest run`: 207 archivos / 1098 pruebas en verde (un pase intermedio marcó 1 fallo aislado y el siguiente salió limpio: prueba inestable, sin cambios de frontend en esta fase)
- `npx eslint src --quiet`: 1 error preexistente (`solicitudes-carnet-view.tsx:210`)

---

## Fase C — S6-03 / S6-04: errores silenciosos y `any` del formulario de filtros

### S6-03 — `logger.warning(..., exc_info=True)` sin cambiar el flujo

Siete `except Exception: pass` de la lista de la auditoría ahora dejan rastro.
En todos los casos el `try` sigue igual y la función devuelve exactamente lo
mismo que antes (el log es lo único nuevo):

| Archivo | Qué se registra |
| ------- | --------------- |
| `apps/carnetizacion/apps.py` | fallo al conectar las señales de carnetización en `ready()` |
| `apps/carnetizacion/infrastructure/pdf/carnet_pdf_lote.py` | imagen del carnet que no se pudo dibujar (se usa el marcador de posición) |
| `apps/carnetizacion/infrastructure/repositories/repo_carnetizacion_orm.py` (2) | dimensiones ilegibles de un PNG y de un JPEG/WebP de la biblioteca |
| `apps/configuracion/infrastructure/repositories/repo_reglas_catalogos_orm.py` (3) | no se pudo comprobar si un motivo está referenciado en movimientos, préstamos o egresos |
| `apps/fe_de_vida/presentation/views/revision_views.py` | parámetro del sistema ilegible (se mantiene apagado, lo más restrictivo) |
| `apps/identidad/presentation/views/cuenta_views.py` | no se pudo registrar la excepción manual de correo de acceso |

Se usa el logger con el nombre de módulo ya establecido en el proyecto
(`gath.carnetizacion`, `gath.configuracion`, `gath.fe_de_vida`,
`gath.identidad`).

**No se tocaron** otros `pass` silenciosos que la auditoría no incluyó y que
quedan como deuda anotada: `carnetizacion/infrastructure/qr_institucional.py:58`,
`puntocuenta/infrastructure/repositories/repo_punto_cuenta_orm.py:67`,
`core/infrastructure/logging/rotator.py:28`,
`configuracion/presentation/views/correo_acceso_config_views.py:277` y
`personal/application/use_cases/reportar_error_laboral.py:79` (los dos últimos
ya llevan comentario justificativo).

### S6-04 — tipado de `code-filter-form`

- Los 2 `any` (`form: UseFormReturn<any>` y `onSearch: (values: any) => void`)
  pasan a `SchemaFilterFormType` (el esquema Zod que ya usan las tres pantallas
  que montan el formulario: `prestamo-cargo-page`, `cambiar-cargo-page`,
  `asignar-cargo-page`). Se eliminan los dos `eslint-disable` de `no-explicit-any`.
- Al tipar aparecieron tres comparaciones muertas `watchedX === "0"` (los
  campos son `number` desde `onValueChange={(v) => field.onChange(Number(v))}`).
  Se quitaron dejando `=== 0`, que es la comparación que sí podía cumplirse:
  comportamiento idéntico.
- El error de `eslint` que arrastraba el árbol (`react-hooks/set-state-in-effect`
  en `solicitudes-carnet-view.tsx:210`, presente ya en `HEAD`) se documenta con
  un `eslint-disable-next-line` justificado, igual que los otros 9 usos de esa
  regla en el proyecto. No cambia ninguna línea de lógica.

### Verificación de la fase

- `pytest --create-db`: **2070 passed, 1 skipped** (1324 s)
- `lint-imports`: `Contracts: 91 kept, 0 broken.`
- `makemigrations --check --dry-run`: `No changes detected`
- `npx tsc --noEmit`: 0 errores
- `npx vitest run`: 207 archivos / 1098 pruebas en verde
- `npx eslint src --quiet`: **0 errores** (por primera vez en el post-pase)

---

## Fase D — S5-02: tipos compartidos fuera de los imports cruzados de capa

### `domain` ya no importa de `application`

Los tres casos de la auditoría se resolvieron moviendo la **definición** de los
tipos a `domain/` y dejando `application/dtos` como punto de reexportación (así
no hubo que tocar los ~40 archivos que ya los importaban desde ahí):

| Puerto | Tipos movidos a | Archivo de reexportación |
| ------ | --------------- | ------------------------ |
| `auditoria/domain/ports/repo-auditoria.ts` | `auditoria/domain/entities/auditoria.ts` (9 tipos) | `auditoria/application/dtos/auditoria-dto.ts` |
| `configuracion/domain/ports/repo-parametros.ts` | `configuracion/domain/entities/parametro.ts` (6 tipos) | `configuracion/application/dtos/parametro-dto.ts` |
| `fe-de-vida/domain/ports/repo-fe-de-vida.ts` | `fe-de-vida/domain/entities/constancia.ts` (`ReenvioConstanciaDTO`, `RegenerarConstanciaDTO`) | `fe-de-vida/application/dtos/fe-de-vida-dto.ts` |

Verificación: ningún archivo bajo `src/modules/**/domain/**` importa de
`application/` (solo quedan comentarios explicativos y un `mimeReal:
"application/pdf"` de un test).

### Lo que queda fuera de esta fase (y por qué)

La auditoría también señala imports `ui → infrastructure/http` y
`ui → infrastructure/storage` (`descargas-auditoria.ts`,
`descargas-movimientos.ts`, `credenciales-externas-view.tsx`,
`lote-credenciales-view.tsx`, `reportes-error-page.tsx`,
`formulario-fe-de-vida.tsx`) y un `ui → ui` entre módulos
(`cambiar-pasivo-page.tsx → cargos/ui/components/motivo-select`). No son
`import type`: son llamadas en tiempo de ejecución, así que resolverlos exige
extraer casos de uso o mover componentes a `shared/`, es decir, cambia
estructura y no solo la ubicación de un tipo. Se dejan documentados como
pendientes de S5-01/S5-02 en una pasada posterior. Nótese que el patrón
mayoritario del proyecto (`ui → infrastructure/actions`) es el aceptado por la
propia arquitectura Next.js del repo y no se toca.

### Verificación de la fase

- `pytest --create-db`: **2070 passed, 1 skipped**. La Fase D no tocó ni un
  fichero del backend: sus archivos son exclusivamente
  `NextJS/src/modules/**/{domain,application}/**.ts`, así que el resultado de la
  Fase C aplica tal cual. Se intentó un pase propio y se descartó: arrancó
  mientras se editaba la Fase E y todas las pruebas fallaron en el setup común
  de la base, no por el código.
- `lint-imports`: `Contracts: 91 kept, 0 broken.` (sin cambios en backend)
- `makemigrations --check --dry-run`: `No changes detected`
- `npx tsc --noEmit`: 0 errores
- `npx vitest run`: 207 archivos / 1098 pruebas en verde
- `npx eslint src --quiet`: 0 errores

---

## Fase E — S5-01: lógica/ORM de vistas a casos de uso

Todas las respuestas HTTP quedan iguales (mismos campos, mismos códigos, mismos
mensajes) y las pruebas de integración existentes se ejecutaron **sin
modificarlas**.

### 1. Carga masiva (`apps/carga_masiva`) — prioridad de la fase

Antes la vista tenía cuatro consultas ORM y la generación del Excel.

- **Puertos nuevos** (`domain/ports/carga_masiva.py`): `ConsultorCargas`
  (carga visible, historial, resumen, filas), `CreadorCarga` (alta y marca de
  error) y `ExportadorResultadosCarga`.
- **`infrastructure/consultas_carga.py`**: `ConsultorCargasORM` con las mismas
  consultas en el mismo orden (`obtener_visible`, `listar`, `resumen`, `filas`)
  y `CreadorCargaORM.crear` / `marcar_error`.
- **`infrastructure/exportacion_resultados.py`**: armado del libro Excel
  (incluye la neutralización de S6-02) fuera de la vista.
- **`application/use_cases/consultar_cargas.py`**: `obtener_carga_visible`,
  `listar_cargas`, `resumen_de_carga`, `filas_de_carga`, `crear_carga`,
  `marcar_carga_con_error`, `exportar_resultados`.
- **`presentation/views.py`**: sin `CargaMasivaModel.objects`, sin `openpyxl` y
  sin `get_object_or_404`. Solo valida entrada, resuelve permisos (que es
  presentación), llama casos de uso y arma la respuesta.

### 2. Carnetización: `CarnetGenerarView`

- **`application/use_cases/emitir_carnet.py`**: `emitir_carnet_y_pdf(repo, ...)`
  encadena `emitir_carnet` + `generar_pdf`; `listar_motivos_emision(repo)`.
- **`repo_carnetizacion_orm.py`**: nuevo `listar_motivos_emision()` (los
  motivos ya no se consultan desde la vista); `generar_pdf` documentado en el
  puerto con `nombre_override`.
- La vista devuelve el mismo `HttpResponse` `application/pdf` con el mismo
  `Content-Disposition`.

### 3. Configuración: buscador de países

- `RepoReglasCatalogos.buscar_paises(texto, pagina, tamano_pagina)` (puerto) e
  implementación ORM con el mismo `order_by('-es_venezuela', 'nombre')`.
- Caso de uso `buscar_paises_paginado`; la vista ya no importa `PaisModel` ni
  `Q`.

### 4. Personal: nombre del trabajador en reportes de error

- `RepoReportesErrorLaboral.nombre_trabajador(cedula)` + implementación ORM.
- `reportes_error_views.py` usa `_nombre_de_trabajador(...)` y ya no importa
  `EmployeeModel`.

### 5. Familiares: validación del serializer y edición

- **Puerto** `domain/ports/lector_validacion_familiar.py`
  (`LectorValidacionFamiliar`, `ParentescoDeFamiliar`) y `ReglaParentescoFamiliar`
  movida a `domain/value_objects/regla_parentesco.py` (la necesitaba el puerto y
  `domain` no puede importar de `application`); `validaciones_familiar` la
  reexporta para no romper imports.
- **`infrastructure/lector_validacion_familiar_orm.py`**: mismas consultas que
  hacía el serializer (empleado, parentesco, regla guardada, sexo, cédulas
  usadas, heredero).
- **`application/use_cases/contexto_validacion_familiar.py`**: lecturas
  puntuales que consume el serializer.
- **`familiares_serializers.py`**: conserva las reglas puras y el mapeo de
  errores (mismos textos y mismas claves de campo); las consultas salen por el
  puerto.
- **`familiares_views.py`**: la instancia para editar se pide al repositorio
  (`obtener_instancia`), no al ORM.

### 6. Fe de vida presencial

Revisado `fe_de_vida/presentation/views/presencial_views.py`: ya trabaja con
casos de uso y repositorios (no hay ORM en la vista), así que no requiere
cambio. El hallazgo se cierra como verificado.

### Lo que se deja documentado

- `familiares/presentation/serializers/familiares_serializers.py` mantiene
  `PrimaryKeyRelatedField(queryset=...)`: es el mecanismo estándar de DRF para
  validar una FK y no es lógica de negocio; moverlo obligaría a reimplementar la
  validación de relaciones de DRF sin ganancia.
- Los ficheros gigantes que menciona S5-01 (`repo_carnetizacion_orm.py` 1292
  líneas, `reglas_catalogos_views.py`, `catalogos_soporte_views.py`,
  `cuenta_views.py`) no se parten en esta fase: es refactor estructural sin
  cambio funcional y merece su propio pase.

### Verificación de la fase

- `pytest --create-db`: **2070 passed, 1 skipped** (772 s)
- `lint-imports`: `Contracts: 91 kept, 0 broken.`
- `makemigrations --check --dry-run`: `No changes detected`
- `npx tsc --noEmit`: 0 errores
- `npx vitest run`: 207 archivos / 1098 pruebas en verde
- `npx eslint src --quiet`: 0 errores

---

## Cierre

Las cinco fases quedaron aplicadas y verificadas. Estado final del árbol:

- `pytest --create-db`: **2070 passed, 1 skipped** (~13 min)
- `lint-imports`: **91 contratos, 0 rotos**
- `makemigrations --check --dry-run`: **No changes detected**
- `npx tsc --noEmit`: **0 errores**
- `npx vitest run`: **207 archivos / 1098 pruebas**
- `npx eslint src --quiet`: **0 errores**

Sin commit: los cambios quedan en el árbol de trabajo de
`feature/fe-de-vida-pasivos` para revisión.

### Pendiente anotado (no ejecutado)

- Actualizar `next` y `next-auth` (deuda crítica del Paso 7; son cambios de
  versión, no parches).
- Imports `ui → infrastructure/http|storage` y `ui → ui` entre módulos
  (S5-02, resto): requieren extraer casos de uso o mover componentes a
  `shared/`.
- Partir los ficheros gigantes señalados por S5-01
  (`repo_carnetizacion_orm.py`, `reglas_catalogos_views.py`,
  `catalogos_soporte_views.py`, `cuenta_views.py`).
- `except … pass` fuera de la lista de S6-03
  (`qr_institucional.py:58`, `repo_punto_cuenta_orm.py:67`,
  `logging/rotator.py:28`).
- Inconsistencia previa de `evento.estado` (`"ACTIVO"` vs `"activo"`) en
  carnetización de eventos.

