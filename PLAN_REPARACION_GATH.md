# Plan de reparación — Reconstrucción Onion GATH

> Este documento es el plan de remediación derivado de la auditoría de paridad funcional (ver reporte: https://claude.ai/code/artifact/dcf0a334-62f9-4ae8-a018-b925f7a0e9c7). Ningún cambio de código ha sido aplicado todavía salvo los 4 fixes mecánicos ya cerrados en la sesión anterior — ver Fase -1. Este archivo es la referencia para ejecutar las fases en sesiones futuras.

## Contexto

La auditoría de paridad funcional (9 agentes comparando `git show HEAD` del legado borrado contra `BACKEND/apps/*` y `NextJS/src/modules/*`, más verificación manual de las reglas B1-B26/R1-R10) encontró que la arquitectura Onion/SCREAM está bien ejecutada como *esqueleto*, pero la migración funcional quedó muy por detrás de lo que documenta `BITACORA_RECONSTRUCCION.md`.

Este plan cubre la reparación completa, ordenada por impacto real: primero lo que rompe producción o es un hueco de seguridad, después lo que falta para que un módulo sea funcionalmente completo, al final limpieza y documentación.

Cada fase es ejecutable de forma independiente y verificable por separado — no hace falta completarlas todas en una sola sesión. Al terminar cada una, correr `pytest` (backend, `BACKEND/`) y `pnpm test:unit` + `pnpm tsc --noEmit` (frontend, `NextJS/`) antes de pasar a la siguiente.

---

## Fase -1 — Ya corregido (sesión anterior)

4 bugs mecánicos, de bajo riesgo, ya aplicados:
- `core/infrastructure/tasks/celery_queue.py:23` — import `SIGEP.celery` → `GATH.celery`.
- `GATH/settings.py` — `STATICFILES_DIRS` ya no apunta a `CARNETIZACION/static` (directorio borrado).
- `requirements.txt` — `django-simple-history` eliminada (huérfana, sin consumidores reales).
- `NextJS/package.json` — `d3`/`@types/d3` restaurados (rompían la ruta real `dashboard/autogestion/metricas`). **Pendiente:** correr `pnpm install` manualmente para regenerar `pnpm-lock.yaml`.

---

## Fase 0 — Seguridad crítica (bloqueante, primero) ✅ COMPLETADA

**Objetivo:** cerrar la única vulnerabilidad activa detectada: ALTA-07 (IDOR de censo) sigue explotable pese a que la bitácora la da por cerrada.

**Estado:** corregida y verificada — ver `BITACORA_RECONSTRUCCION.md`, Entrada #037. `core/presentation/permissions.py` gana `EsPropiaCedulaOTienePermiso`; `CensoEmpleadoView` usa `get_permissions()` por método (GET con bypass RRHH, POST sin bypass). 6 tests nuevos en `tests/unit/core/test_permissions_propia_cedula.py`, suite completa 137 passed / 4 failed preexistentes no relacionados, `lint-imports` 34 kept / 0 broken.

- `BACKEND/apps/autogestion/presentation/views/autogestion_views.py` — `CensoEmpleadoView` usa hoy `HasPermission('autogestion.ver')`, un código que **no existe** en el catálogo sembrado, y no valida en absoluto que la cédula del path pertenezca al usuario autenticado.
- **Importante (verificado al intentar implementarlo):** `IsOwnerOrHasPermission` (`core/presentation/permissions.py:73-95`) **no aplica directamente aquí** — su mecanismo compara `obj.<campo_propietario>` contra `request.user.id`, y depende de que la vista llame `check_object_permissions()` sobre un objeto ORM real (patrón de `generics`/`ViewSet`). `CensoEmpleadoView` es un `APIView` plano que opera sobre un string `cedula` de la URL, sin objeto que consultar — nunca se dispara `has_object_permission`. Hace falta un permiso nuevo que compare la cédula del path contra la cédula propia del usuario (mismo cálculo que ya usa `_usuario_tiene_permiso` en ese archivo: `getattr(getattr(user, 'cedula', None), 'cedulaidentidad', None)`).
- Códigos reales sembrados a usar: `autogestion.censo_ver_propio` (GET, propio), `autogestion.censo_ver_todos` (GET, bypass RRHH), `autogestion.censo_actualizar_propio` (POST, propio — **sin bypass**: ningún rol sembrado tiene permiso de editar el censo ajeno, así que el POST debe negar siempre que la cédula no sea la propia).
- Diseño sugerido: agregar un permiso `EsPropiaCedulaOTienePermiso(codigo_propio, codigo_bypass=None, kwarg='cedula')` en `core/presentation/permissions.py` (junto a `HasPermission`/`IsOwnerOrHasPermission`, reutilizando su mismo patrón de fábrica) que resuelva `view.kwargs[kwarg]` contra la cédula del usuario en `has_permission`. Cablearlo en `CensoEmpleadoView.get_permissions()` con semántica distinta por método (GET con bypass, POST sin bypass). Es reutilizable para el mismo problema en Familiares (Fase 4, descarga de documentos).
- Test de regresión: dos cuentas con cédulas distintas, censo cruzado debe dar 403 en GET y POST; RRHH (`censo_ver_todos`) debe poder GET pero no POST el censo ajeno.
- Actualizar `BITACORA_RECONSTRUCCION.md` (B3.4) para reflejar el estado real hasta este fix.

---

## Fase 1 — Contratos frontend↔backend rotos ✅ COMPLETADA (con una pieza remanente documentada, no un fix de contrato)

**Objetivo:** que cada `infrastructure/http/*-api.ts` nuevo llame exactamente las URLs/campos que expone el backend real, verificado contra `presentation/urls.py` y el serializer de cada vista — no contra lo que "debería" ser.

**Hecho:**
- `personal`, `carnetizacion`, `autogestion`: realineados por completo (dominio/DTO/mapper/api/repo/casos de uso/schema/tests) contra los serializers reales. Los tres módulos habían sido escritos sin verificar nunca contra el backend — campos y hasta el modelo de datos completo (autogestión) eran inventados.
- `familiares`: ya estaba casi bien; se corrigió `crear` (apuntaba a `/api/v1/familiares/` en vez de `/api/v1/familiares/empleado/<cedula>/`) y se agregó el método `GET` que faltaba en `FamiliarDetailView` (backend) en vez de recortar el frontend.
- **Bug de kernel compartido descubierto y corregido**: `shared/infrastructure/http/fetcher-api.ts` — `RequestOptions` nunca declaró `params`, así que **todo módulo que filtra listas por query string lo hacía contra el vacío** (cargos, catálogos, organización, reportes, autogestión, personal). Corregido con `construirRuta()` + 2 tests de regresión.
- 3 archivos de `src/app/(protected)/dashboard/gestion-trabajadores` y `gestion-pasivos` tenían corrupción real preexistente (contenido duplicado a mitad de función, `import` colado dentro de una llamada) que bloqueaba `tsc` para todo el proyecto — reconstruidos comparando contra `git show HEAD`.
- Verificación: backend 137 passed (4 fallos preexistentes no relacionados), `lint-imports` 34/34; frontend 63/63 tests, `tsc --noEmit` bajó de bloqueado-por-sintaxis a 51 errores preexistentes no relacionados (props `permisos` faltante en el tipo de sesión, `@formity/react` sin instalar, exports rotos de `src/lib/regex.ts` — ninguno tocado por esta fase).

**`gestionar-usuarios`/`gestionar-roles` — hecho:**
- `@/app/types/types.ts`: `UserSystem` realineado a `CuentaLecturaSerializer` real (`departamento_id`/`rol_id` planos, sin los objetos anidados de organización que el backend aún no expone); `Depart.nombre_departamento` → `nombre` (`DepartamentoLecturaSerializer` real).
- Todas las URLs corregidas a `v1/identidad/...`: registro de usuario (`POST /usuarios/`, con mapeo `departamento`/`rol` del form → `departamento_id`/`rol_id`), edición (`PATCH /usuarios/<id>/`, ahora omite campos no tocados en vez de enviar `0`), **bug real corregido** en `blockUserAction` (llamaba `usuarios/estado/<id>/`, el orden real es `usuarios/<id>/estado/`), catálogo de roles (crear/editar/eliminar — la URL de eliminar apuntaba a `.../delete/`, la real es `.../eliminar/`), catálogo de departamentos, búsqueda de usuarios (el filtro real es `?cedula=`, el formulario mandaba `?cedulaidentidad=`, nunca filtraba nada).
- `columns.tsx` de la tabla de usuarios: como el backend ya no anida `rol`/`departamento`, se convirtió a `getColumns(roles, departamentos)` que resuelve nombre por id contra los catálogos que la página ya carga.
- Verificado: `tsc --noEmit` no agrega errores nuevos (mismos 51 preexistentes), 63/63 tests.

**`autogestion` (censo) legado — solo URLs corregidas; el resto es una regresión real a recuperar, no una alineación de contrato (reclasificado a Fase 2.6):**
- Esta sección (`page.tsx`, `consultar/`, `metricas/`) espera formas de datos que **no existen en `apps.autogestion`** — un resumen enriquecido por empleado (cargo, vivienda, tiempo APN), un reporte `{pie_chart, bar_chart}`, y exportación a Excel. **Verificado contra `git show HEAD:BACKEND/AUTOGESTION/` que esto NO es funcionalidad inventada por el frontend**: existía y funcionaba en el backend legado, y se perdió al construir el reemplazo Onion —
  - `AUTOGESTION/urls.py` tenía exactamente `censo-vivienda/consultar/<cedula>/`, `censo-vivienda/exportar-excel/`, `censo-vivienda/reporte-dependencias/`, `censo-vivienda/<cedula>/`.
  - `AUTOGESTION/services/censo_report_service.py::construir_grafico_torta`/`construir_grafico_barras` generaban exactamente el `{pie_chart, bar_chart}` que `metricas/page.tsx` sigue esperando.
  - `AUTOGESTION/services/excel_service.py::generar_excel_censo` generaba el Excel real.
  - `AUTOGESTION/serializers/serializers_encuestas.py::CensoViviendaSubmitSerializer` sí persistía `datos_vivienda` + `carnet_patria` + respuestas en una sola operación.
  - Mismo patrón que el hallazgo de `reportes` (Fase 2.4): la migración reconstruyó el módulo mucho más delgado que el original, sin portar estas piezas.
- Corregidas las URLs (`v1/autogestion/...`) y documentado en el código (comentarios `ADVERTENCIA`) qué sigue sin backend detrás — no se inventó ninguna transformación de datos para simular que funciona. Portar el subsistema real es la Fase 2.6 del plan (ver abajo), con la misma prioridad que 2.3/2.4.

Patrón a repetir por módulo (revisar `presentation/urls.py` + el serializer de lectura del backend, y ajustar el cliente HTTP del frontend a esos nombres reales; NO tocar el backend salvo que le falte un campo obviamente necesario):

| Módulo | Archivo frontend a corregir | Backend real (fuente de verdad) |
|---|---|---|
| personal | `NextJS/src/modules/personal/infrastructure/http/personal-api.ts` | `BACKEND/apps/personal/presentation/urls.py` + `personal_serializers.py::EmpleadoSerializer` (rutas por `cedula`, no `id`; sin `cambiar-condicion`) |
| carnetizacion | `NextJS/src/modules/carnetizacion/infrastructure/http/carnetizacion-api.ts` | `BACKEND/apps/carnetizacion/presentation/urls.py` + `carnetizacion_serializers.py` |
| familiares | `NextJS/src/modules/familiares/infrastructure/http/familiares-api.ts` | `FamiliarDetailView` solo define `put`/`delete` — agregar `get` al backend (más simple, y es lo que el frontend espera) en vez de recortar el frontend |
| autogestion | `NextJS/src/modules/autogestion/infrastructure/http/autogestion-api.ts` | `BACKEND/apps/autogestion/presentation/urls.py` (`/censo/<cedula>/`, `/preguntas/`, no `/censos/mi-censo/`) |

**Rutas legadas activas que llaman endpoints ya borrados** (afectan producción hoy, prioridad alta dentro de esta fase):
- `NextJS/src/app/(protected)/dashboard/seguridad/gestionar-usuarios/**` y `gestionar-roles/**` — migrar sus llamadas de `apiFetch('accounts/...')` (`src/lib/api-client.ts`) a los endpoints reales de `apps/identidad` (`/api/v1/identidad/usuarios/...`, `/api/v1/identidad/roles/...`), cableando idealmente estas pantallas contra `NextJS/src/modules/identidad/infrastructure/repositories/repo-usuarios-api.ts` (ya existe, solo falta que las páginas lo usen en vez del cliente legado).
- `NextJS/src/app/(protected)/dashboard/autogestion/**` — mismo patrón, contra `apps/autogestion` real.

---

## Fase 2 — Funcionalidad de negocio central faltante

Huecos que representan pérdida real de capacidad operativa respecto al sistema legado, no solo deuda de arquitectura.

### 2.1 Flujo de egreso (activo → pasivo) ✅ COMPLETADA (núcleo) — expediente ampliado queda pendiente

**Hecho:**
- `apps/pasivos/application/use_cases/procesar_egreso.py` (nuevo) + `RepoPasivosORM.procesar_egreso_a_pasivo` (`repo_pasivos_orm.py`): réplica de `procesar_egreso_total`/`procesar_pasivo` del legado (`git show HEAD:BACKEND/RAC/services/egreso_services.py`) — cierra antecedente/contrato activo cuando `liberar_activos=True`, libera los cargos actuales, genera el código de nómina pasiva (reutilizando `apps.cargos.domain.services.generacion_codigo`, sin duplicar el algoritmo) y crea la nueva asignación `AsigTrabajo` con `Tipo_personal=PASIVO`. Endpoint nuevo: `POST /api/v1/pasivos/<cedula>/procesar-egreso/` (permiso `pasivos.cambiar_condicion`, ya sembrado).
- `RepoPasivosORM.listar_pasivos`/`obtener_por_cedula` corregidos: ahora combinan `AsigTrabajoModel` con `Tipo_personal=PASIVO` (criterio real del legado, nómina activa) con `EmployeeEgresadoModel` (egreso definitivo) — antes solo veían la segunda fuente, así que la mayoría de pasivos reales quedaban invisibles.
- Gap documentado en el propio código (no silencioso): sin `ejecutar_creacion_sobrevivientes` (alta de un familiar como nuevo empleado pensionado — feature separada y más grande, deliberadamente fuera de este alcance).
- Verificado: 5/5 tests nuevos en `tests/unit/pasivos/test_pasivos.py`, suite completa 142 passed (mismos 4 fallos preexistentes no relacionados), `lint-imports` 34/34, `manage.py check` limpio.

**Cierre del pendiente:** `PasivoSerializer` ya expone el expediente completo (vivienda/salud/formación/contacto/antecedentes/contrato actual), reutilizando literalmente los mismos serializers de lectura de `apps.personal` (ver 2.2) — un pasivo también es un `Employee`, así que `RepoPasivosORM.obtener_por_cedula` llama a `construir_expediente()` del mapper de personal en vez de duplicar la consulta.

**Cierre del segundo pendiente (Fase 2.5):** `RepoPasivosORM.procesar_egreso_a_pasivo` ahora sí registra el historial de movimiento — emite el mismo evento `apps.cargos.domain.events.cargo_movimiento_ejecutado` que usa `apps.cargos`, con `tipo_movimiento='EGRESO'`, y `apps.movimientos` lo persiste sin que `apps.pasivos` lo importe directamente.

### 2.2 Lectura de expediente de personal activo ✅ COMPLETADA

**Hecho:**
- `EmpleadoSerializer` (`personal_serializers.py`) ahora anida `datos_vivienda`, `perfil_salud`, `formacion_academica`, `contacto_emergencia`, `antecedentes` y `contrato_actual` — con serializers de lectura propios (`*LecturaSerializer`), poblados solo en el detalle (`GET /api/v1/personal/<cedula>/`) vía `mapper_personal.construir_expediente()`; el listado (`GET /api/v1/personal/`) los deja vacíos a propósito para no pagar N+1 consultas por fila.
- `construir_expediente()` vive en el mapper (no en el repo) precisamente para que `apps.pasivos` lo reutilice también (ver cierre de 2.1) sin duplicar la consulta.
- **Bug de regresión corregido** en `upsert_contrato.py`: `politica_nombre` nunca se poblaba (ningún llamador lo enviaba), así que la inicial del número de contrato siempre caía al default `'C'`. Ahora se deriva de `politica_id`, que ya llega resuelto a una instancia de `PoliticaModel` tanto desde `ContratoEscrituraSerializer` como desde `carga_masiva_expediente.py` — sin pedirle un campo nuevo a ningún llamador.
- Alcance NO cubierto (documentado, mismo límite ya conocido de `expediente_models.py`): `perfil_fisico` (tallas) y `formacion_complementaria` siguen sin mirror; los IDs de FK no se resuelven a nombre en la respuesta (mismo criterio que usa la escritura — el frontend ya resuelve nombres contra los catálogos que usa para los formularios).
- Verificado: 5 tests nuevos (`test_upsert_contrato.py` + expediente en `test_personal.py`), suite completa 147 passed (mismos 4 fallos preexistentes no relacionados), `lint-imports` 34/34, `manage.py check` limpio.

**Pendiente (menor, sin urgencia):** el frontend (`NextJS/src/modules/personal/`) no tiene todavía ningún consumidor real de este expediente ampliado (confirmado en la Fase 1: el módulo no tiene UI construida) — alinear sus tipos cuando se construya esa pantalla.

### 2.3 Generación real del carnet (PDF + QR + foto) ✅ COMPLETADA

**Hecho:**
- `apps/carnetizacion/infrastructure/pdf/carnet_pdf.py` (nuevo, módulo puro sin Django): réplica funcional de `CARNETIZACION/services/designer.py` (QR con `qrcode`, foto con `Pillow`, render con `reportlab`) — con una diferencia deliberada frente al legado: el QR codifica `security_hash` en vez del ID secuencial del carnet, para no reintroducir el vector de ALTA-05 ni siquiera en el documento impreso. No se portó `generar_vista_previa`/HTML (requiere el binario `poppler` vía `pdf2image`, no instalado) — el PDF ya sirve como descarga/vista previa.
- `RepoCarnetizacionORM.generar_pdf()`: arma los datos cruzando `apps.cargos` (cargo/departamento actual del empleado) y `SeaweedFSStorage` (foto), con fallback a placeholder si no hay foto o plantilla activa. Endpoint: `GET /api/v1/carnetizacion/<id>/pdf/`.
- Endpoint de revocación: `POST /api/v1/carnetizacion/<id>/revocar/` (permiso `carnetizacion.revocar`, ya estaba sembrado sin código detrás).
- Diseño de plantillas (`CARNETIZACION/services/designer.py::CarnetDesigner` completo, editor visual) queda diferido — hoy solo se puede activar una plantilla ya subida (`ActivarPlantillaView`), no crear/editar una nueva; no es prioridad inmediata.
- Frontend (`carnetizacion-api.ts`/repo/actions) actualizado con `descargarPdf()`.
- Verificado: 11/11 tests en `tests/unit/carnetizacion/` (incluye generación real de PDF con reportlab/qrcode/PIL, sin mocks), suite completa backend 155 passed (mismos 4 fallos preexistentes), `lint-imports` 34/34, `manage.py check` limpio; frontend `tsc`/tests sin regresión.

### 2.4 Motor de reportes PDF/Excel ✅ COMPLETADA (núcleo) — filtros avanzados quedan documentados como gap real, no conectados

**Hecho:**
- `core/infrastructure/pdf/` (nuevo): `pdf_styles.py` + `pdf_components.py` (header con logos institucionales, footer con cintillo, tabla de datos — réplica de `RAC/services/pdf/templates/`) + `report_pdf.py` (motor genérico: cualquier `ResultadoReporte` de `apps.reportes` se renderiza sin plantilla nueva, en vez de un generador por tipo de entidad como tenía el legado).
- `core/infrastructure/pdf/report_excel.py` (nuevo, con `openpyxl`): mismo patrón genérico para Excel — `reportes.generar_excel` ya estaba sembrado en el catálogo de permisos, igual que `reportes.generar_pdf`.
- Conectados a los 3 reportes reales de `apps.reportes` (personal-activo, pasivos, cargos-vacantes): `GET .../pdf/` y `GET .../excel/` en cada uno.
- Assets institucionales recuperados de `git show HEAD:BACKEND/RAC/services/pdf/templates/img/*.png` → `core/infrastructure/pdf/assets/`.
- Verificado: 7 tests nuevos (motor PDF + motor Excel, ambos con librerías reales sin mocks), suite completa backend 162 passed (mismos 4 fallos preexistentes), `lint-imports` 34/34, `manage.py check` limpio.

**Hallazgo real al intentar conectar `ReportFieldRegistry` (no es un simple "está sin usar" — está roto contra el esquema nuevo):** `MAPA_REPORTES` (`core/infrastructure/report_field_registry.py`) fue portado literalmente del legado, con rutas de campo como `assignments__Dependencia__dependencia` que dependen de que `Employee` tenga un `related_name='assignments'` hacia sus asignaciones de cargo. En el esquema nuevo, `AsigTrabajoModel.employee` (`apps/cargos/infrastructure/models/cargo_models.py:42`) declara `related_name='+'` — **sin acceso inverso**. Cualquier filtro de la registry usado tal cual contra `apps.personal.EmployeeModel` lanzaría `FieldError` en producción. Conectarlo de verdad requiere reescribir las ~150 líneas de rutas de campo contra el esquema actual (o cambiar el `related_name`, con el riesgo de romper otro código que ya depende de que esté ausente) — es un rediseño, no una conexión; se deja documentado y sin tocar en vez de conectarlo a ciegas.

**No portado (alcance de otro dominio, no de "reportes" tabulares):** las "constancias" individuales del legado (`employee_active_pdf.py`, `employee_passive_pdf.py`, `family_pdf.py`, `assignment_pdf.py`, `graduate_pdf.py`) eran documentos de **un solo registro con formato de certificado**, distintos de los reportes tabulares multi-registro que expone `apps.reportes` hoy. `apps.reportes` no tiene todavía un caso de uso de "constancia individual" al que conectar ese formato — construirlo (si se necesita) es una extensión futura, no una regresión de esta fase.

### 2.6 Recuperar el subsistema de censo (autogestión): consulta enriquecida, reporte por dependencias y exportación a Excel
Regresión de la migración, no funcionalidad nueva — verificado contra el legado real (`git show HEAD:BACKEND/AUTOGESTION/`), ver detalle en Fase 1.
- Puerto/caso de uso para la consulta enriquecida por cédula (cargo, `datos_vivienda`, `total_apn`) — portar `AUTOGESTION/serializers/serializers_encuestas.py::CensoEmpleadoSerializer` y el query que arma `AUTOGESTION/views/encuesta_views.py::consultar_censo_empleado`/`consultar_todos_censos`.
- Persistir `datos_vivienda` + `carnet_patria` en `registrar_respuestas_censo` (hoy `RegistrarCensoInputSerializer` solo acepta `respuestas`; el legado lo hacía en una sola operación vía `CensoViviendaSubmitSerializer`).
- Agregación `{pie_chart, bar_chart}` del reporte por dependencias — portar `AUTOGESTION/services/censo_report_service.py::construir_grafico_torta`/`construir_grafico_barras`, incluyendo el filtro jerárquico completo (dependencia → dirección general → línea → coordinación) que el `reporte_censo_por_dependencias` legado sí soportaba.
- Endpoint de exportación a Excel — portar `AUTOGESTION/services/excel_service.py::generar_excel_censo` (el permiso `autogestion.censo_exportar` ya está sembrado, solo falta el código).

### 2.5 Historial de movimientos de cargo (`apps.movimientos`) — ✅ COMPLETADA (parcial, ver pendiente)

**Hecho:**
- Nuevo módulo `apps/movimientos/` con la estructura canónica completa (domain/application/infrastructure/presentation), portando `EmployeeMovementHistory` de `RAC/models/historial_personal_models.py` (`git show HEAD:...`) como `EmployeeMovementHistoryModel` (`managed=False`, nombres de campo idénticos al legado porque ninguno declaraba `db_column` explícito — Django deriva el nombre físico de columna del nombre del campo).
- Patrón evento→signal→receiver (B16) implementado por primera vez en el proyecto: `apps/cargos/domain/events.py` declara `cargo_movimiento_ejecutado = django.dispatch.Signal()`; `apps/cargos/infrastructure/repositories/repo_cargos_orm.py` lo emite (dentro de `@transaction.atomic`, para que un fallo en el registro de historial revierta también el cambio de cargo — igual que el legado, que envolvía ambas cosas en una sola transacción) al final de `asignar_cargo_a_empleado`, `desasignar_cargo` y `crear_cargo_especial_y_asignar`; `apps/movimientos/infrastructure/receivers.py` se suscribe y persiste, sin que `apps.cargos` importe ni conozca `apps.movimientos` en ningún momento. Excepción puntual documentada en `.importlinter` (`apps-cargos-domain-puro`, `ignore_imports`) porque `domain/events.py` importa `django.dispatch` — un despachador de eventos sin ORM/HTTP/I-O, no el acoplamiento que B1 busca prevenir.
- Dentro de `apps/cargos`: `cambiar_cargo` (traslado con validación de vacante, réplica de `MovimintoCargoSerializer`) y `gestionar_estatus_puesto` (bloqueo/suspensión/reactivación, réplica de `GestionStatusSerializer`, con la misma lista `ESTATUS_PERMITIDOS = ['SUSPENDIDO', 'BLOQUEADO', 'ACTIVO']` del legado) — ambos emiten el evento y quedan expuestos como `POST /api/v1/cargos/<id>/cambiar/` y `POST /api/v1/cargos/<id>/estatus/`.
- Subsistema de préstamo/encargaduría completo dentro de `apps/cargos` (`RepoPrestamosCargoORM`, mixin separado por el techo de 400 líneas por archivo — B13), réplica de `RAC/services/prestamo_cargo_services.py`: unicidad de encargaduría activa por cargo y por empleado, cálculo de estatus (`ACTIVO`/`POR VENCER`/`FINALIZADA`) por fecha, y sincronización de estatus de los cargos involucrados (suspende el cargo original del encargado y el cargo prestado; los reactiva al finalizar). Expuesto en `GET/POST /api/v1/cargos/prestamos/` y `POST /api/v1/cargos/prestamos/<id>/finalizar/`, reutilizando el permiso ya sembrado `cargos.revertir_prestamo`.
- Catálogo `Tipo_movimiento`/`categoria_movimiento` corregido y completado en `apps.catalogos` — endpoints `GET /api/v1/catalogos/tipos-movimiento/?categoria=` y `GET /api/v1/catalogos/categorias-movimiento/`. El endpoint único filtrable por `categoria` sustituye a los 5 endpoints de listado por categoría del legado (fallecimiento, egreso, internos/traslado, suspendido, suspendido_pasivo) con un único endpoint funcionalmente equivalente.
- **Bug real encontrado y corregido de paso:** `TipoMovimientoModel` (`apps/catalogos/infrastructure/models/catalogo_models.py`) ya existía desde la Fase 2.1 (para `procesar_egreso`), pero declaraba un campo `tipo_movimiento`/`db_column='tipo_movimiento'` que no corresponde a la tabla física real (columnas reales: `movimiento` y `categoriaId`, verificado vía `git show HEAD:BACKEND/RAC/models/historial_personal_models.py`). Como es `managed=False`, Django nunca validó el esquema, y el bug nunca se manifestó porque los tests de `apps.pasivos` usan un repositorio en memoria, no la tabla real. Corregido el modelo y el único punto que lo consumía (`repo_pasivos_orm.py:164`).
- Verificado: 176 tests pasan (162 previos + 14 nuevos: `cambiar_cargo`/`gestionar_estatus_puesto`, préstamo/encargaduría, historial de movimientos, catálogo de tipos/categorías de movimiento — todos puros, con repositorio en memoria), mismos 4 fallos preexistentes sin relación. `lint-imports` 37/37 contratos (3 nuevos para `apps.movimientos`). `manage.py check` limpio. `manage.py spectacular` genera el esquema sin errores nuevos.

**Pendiente (documentado, no incluido en este alcance):** alta/edición manual de cargo con código no autogenerado (mencionado en el plan original junto al resto de esta fase, pero es una operación de mantenimiento de catálogo de puestos, no de historial de movimientos — se deja para la Fase 4 junto con el resto de reglas de negocio menores). No se agregó un test de integración a nivel de Django `TestCase` que dispare el signal real contra una base de datos: como el resto de repos ORM del proyecto (`repo_pasivos_orm`, `repo_carnetizacion_orm`, etc.), estas tablas son espejos `managed=False` de un esquema físico externo que no existe en el entorno de desarrollo/test — la cobertura se limita, igual que en fases anteriores, a los casos de uso puros contra repositorios en memoria.

---

## Fase 3 — Organización: reactivar escritura

`apps/organizacion` quedó de solo lectura. Agregar, para cada uno de los 5 niveles (Organismo, Dependencia, Dirección General, Dirección de Línea, Coordinación), un caso de uso `crear_[nivel]`/`actualizar_[nivel]` + vista + ruta, siguiendo el patrón ya usado por los `listar_*` existentes en `apps/organizacion/application/use_cases/`. Restaurar la exclusión de `Organismoadscrito='POLICIAL'` del listado principal (perdida en la migración) y la normalización a mayúsculas al crear/editar.

---

## Fase 4 — Reglas de negocio y validaciones perdidas

- **Familiares**: validar cédula de familiar ≠ cédula del empleado, cédula única por empleado, autogeneración de cédula para hijos menores de 9 años, un solo heredero por empleado (portar de `RAC/services/family_services.py`) en el caso de uso `gestionar_familiar.py`. Reconstruir subida/descarga de documentos familiares con validación de propiedad desde el diseño (reusar `EsPropiaCedulaOTienePermiso` de la Fase 0 si aplica al patrón de la ruta; no repetir el IDOR de CRIT-06). Decidir reemplazo de la trazabilidad de `HistoricalRecords` perdida (tabla propia vs. `AuditoriaLog` de `core`).
- **Personal activo**: validaciones de contrato en carga masiva (bloquear FIJO duplicado, ≥3 contratos, contrato activo repetido) en `carga_masiva_expediente.py`. Filtros de listado por dependencia/dirección/coordinación/tipo de nómina (falta `presentation/filters/`, hoy solo `q` de texto libre).
- **Autogestión**: validar pregunta activa/opción válida antes de guardar respuesta (el resto de huecos de autogestión —Excel, vivienda/carnet_patria, reporte jerárquico— se elevó a Fase 2.6 por ser regresión real, no deuda menor).
- **Catálogos**: agregar `categoria_movimiento`, `Capacitaciones`, `GruposCapacitacion` (sin justificación de exclusión documentada, a diferencia de los de perfil físico/salud).
- **Onion B7**: mover `LoginView` (`apps/identidad/presentation/views/auth_views.py:87-126`) y `EmpleadoFotoView` (`apps/personal/presentation/views/personal_views.py:89-110`) de `.objects.` directo a casos de uso con repositorio inyectado — login requiere cuidado especial por ser ruta de autenticación crítica; hacerlo con cobertura de test antes/después.

---

## Fase 5 — Limpieza y documentación

- Comandos operativos `crear_usuarios`/`importar_correos` bajo `apps/identidad/management/commands/` (solo si siguen usándose operativamente — confirmar antes de invertir tiempo aquí).
- Exponer `direccion_general`/`direccion_linea`/`coordinacion`/`dependencia` en `CuentaLecturaSerializer`, ahora que `apps.organizacion`/`apps.cargos` existen.
- Decidir la postura formal sobre el acoplamiento de `infrastructure/` entre módulos hermanos vía FKs de Django (documentarlo como excepción consciente en `.importlinter`, o introducir desacople) — decisión de arquitectura, no fix mecánico; resolver como conversación aparte.
- Actualizar `BITACORA_RECONSTRUCCION.md` al cierre de cada fase anterior para que refleje el estado real.

---

## Verificación end-to-end

- Backend: `cd BACKEND && pytest` (suite completa) + `lint-imports` (contratos Onion) tras cada fase que toque `apps/`.
- Frontend: `cd NextJS && pnpm test:unit && pnpm tsc --noEmit` tras cada fase que toque `src/modules/` o `src/app/`.
- Fase 0: test manual — dos cuentas con cédulas distintas, confirmar 403 cruzado en `/api/v1/autogestion/censo/<cedula-ajena>/` (GET y POST).
- Fase 1: para cada endpoint corregido, comparar contra `/api/docs/` (drf-spectacular) que el contrato documentado coincide con lo que el frontend ahora llama.
- Fase 2: smoke test manual del flujo completo por dominio (crear egreso → aparece en listado de pasivos; emitir carnet → se puede descargar el PDF; generar un reporte → se descarga el PDF con datos reales).
