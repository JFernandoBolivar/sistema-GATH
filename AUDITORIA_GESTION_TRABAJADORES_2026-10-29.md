# Auditoría Gestión de Trabajadores (solo lectura) - 2026-10-29

Método: análisis estático + git. Backend (8001) responde 401 sin login; frontend (3000) no estaba levantado. pytest no está instalado en el Python del entorno, así que no se corrieron tests.

## 1. HU 0009 Cintillo editable
Estado: Parcial (backend OK, pantalla huérfana en el menú).
Evidencia:
- Backend completo: `BACKEND/apps/configuracion/` (modelo, casos de uso, subida de logos, `infrastructure/pdf_config.py::construir_config_pdf`). Permiso `configuracion.editar` (seed_permisos.py:127).
- Los PDF sí lo usan: `core/infrastructure/pdf/pdf_components.py:89-171` (GENERICO sin logos; FIJO con logo principal/secundario/cintillo de pie, con caída al asset fijo `logo01.png`/`logo02.png`/`cintillo2.png` si no hay imagen). Importan `construir_config_pdf`: pdf_empleado, pdf_pasivo, pdf_movimientos, pdf_punto_cuenta y reportes_views.
- Pantalla: `NextJS/src/app/(app)/configuracion/visual/page.tsx` + `modules/configuracion/ui/configuracion-visual-page.tsx`.
- NO hay entrada de menú hacia `/configuracion/visual`: `grep "configuracion/visual"` fuera del módulo solo da el test del proxy. En `app-sidebar-personal.tsx:251` el permiso `configuracion.editar` se usa para el ítem "Retroalimentación" (`/retroalimentacion`), no para la config. Es un error de enlace: el usuario no encuentra el apartado.
- Falta confirmar si carnetizacion y fe_de_vida usan el cintillo: `grep` no encontró `construir_config_pdf` en `apps/carnetizacion` ni `apps/fe_de_vida`. Sus PDF (carnet, constancias) usan imágenes fijas.
Causa: la pantalla se creó sin registrarla en el sidebar; el permiso se asignó por error a Retroalimentación.
Corrección: añadir ítem "Configuración visual (cintillo y logos)" -> `/configuracion/visual` con permiso `configuracion.editar`; dejar Retroalimentación con su propio permiso. Pasar `construir_config_pdf()` a los PDF de carnet y fe de vida. Añadir vista previa del PDF en la pantalla.
Esfuerzo: S (menú) / M (carnet y fe de vida).

## 2. HU 0006 Punto de cuenta
Estado: Parcial (backend sí, el usuario no tiene pantalla ni descarga).
Evidencia:
- Modelo/caso de uso: `apps/puntocuenta` (`generar_punto_cuenta.py`, `punto_cuenta_model.py`, `pdf_punto_cuenta.py`). Registra cargo, cédula, nombre, dependencia origen/destino, motivo, usuario y fecha. Endpoints: `puntocuenta/` (lista), `<id>/documento/`, `<id>/documento/archivo/`.
- Disparo (`receivers.py`): solo en (a) `cargo_dependencia_cambiada` (`repo_cargos_orm.py:387`, al editar un cargo cuya Dependencia cambió) y (b) `cargo_movimiento_ejecutado` con tipo TRASLADO y dependencia distinta (`repo_cargos_orm.py:442`).
- NO se dispara en: cambio de cargo (CAMBIO DE ESTATUS / INGRESO / asignar), ni en pase a pasivo (EGRESO, `repo_pasivos_orm.py:205` y `repo_sobrevivientes_orm.py:166`, sin dependencias en el evento). El receiver ignora todo lo que no sea TRASLADO.
- La RN-006-01 dice Gerencia u Oficina; el código compara solo `Dependencia_id` (nivel). No compara DireccionGeneral/Linea/Coordinación.
- Frontend: no existe `src/modules/puntocuenta` ni ruta en `(app)`. Solo se menciona el proxy `puntocuenta/<id>/documento/archivo/` en `app/api/v1/[...path]/route.ts:19`. Ninguna pantalla lista ni descarga el PDF, ni notifica el éxito.
- El PDF y la subida a SeaweedFS son lenientes: si falla, queda `documento_pdf_clave=None` sin aviso al usuario.
- Plantilla: el PDF se arma en código con el cintillo configurable; no hay plantilla propia del formato (cuerpo, firmas, número de correlativo). Los datos del trabajador salen del snapshot nombre/cédula del modelo.
Causa: el backend se hizo y la UI de la HU nunca se construyó; el alcance del disparo es estrecho.
Corrección:
1. Cambiar el criterio a "cambia Gerencia (DireccionGeneral) u Oficina (DireccionLinea/Coordinación)", no solo Dependencia.
2. Emitir dependencias/estructura en EGRESO y en cambio de cargo, para generar punto de cuenta al pasar a pasivo y al cambiar cargo con cambio de estructura.
3. Crear módulo frontend `puntocuenta` (lista + botón descargar PDF + regenerar) y enlace en el menú.
4. Que el resultado del movimiento devuelva `punto_cuenta_id` y la UI muestre el toast "Punto de cuenta generado" con descarga directa.
5. Aprobar el formato oficial (texto, firmas, correlativo, origen/destino a nivel de estructura completa).
Esfuerzo: L.

## 3. HU 0008 Reporte de movimientos
Estado: Parcial.
Evidencia:
- Filtros que existen y llegan al backend: tipo (`tipo_movimiento`), `fecha_inicio`, `fecha_fin`, `gerencia`, más categoría/estatus/cédula/código (`movimientos_views.py:40-100`, `repo_movimientos_orm.py:100-135`; frontend `movimientos-page.tsx`).
- RN-008-01 (inicio <= fin): solo en el frontend (`movimientos-page.tsx:223`). El backend no la valida (una petición directa devuelve vacío en vez de 400).
- PDF con filtros (criterio adicional): SÍ respeta los filtros. `HistorialMovimientosPdfView` aplica los mismos 8 filtros que el listado y el frontend los reenvía (`repo-movimientos-api` `descargarPdf` -> `getPdf`). Limitaciones: (a) el PDF no imprime los filtros aplicados en el encabezado; (b) límite silencioso de 300 filas (`limit=300`) en listado y PDF; (c) `gerencia` filtra solo por `DireccionGeneral` con `icontains` sobre el texto, no por Oficina/Coordinación ni por ID; (d) permiso `movimientos.exportar_pdf`.
- Excel: NO existe. Ninguna vista ni acción de exportación Excel en `apps/movimientos` ni en `modules/movimientos`. (Los reportes de `apps/reportes` sí tienen `/excel/`, pero no el de movimientos.)
Corrección: añadir `/movimientos/excel/` (reusar `report_excel.py`) + botón; validar inicio<=fin en el backend (400); quitar o paginar el tope de 300 y avisarlo en el PDF; imprimir en el PDF los filtros aplicados; filtrar por ID de estructura.
Esfuerzo: M.

## 4. Reporte de trabajador (filtros perdidos, PDF no sale)
Estado: Roto (regresión).
Evidencia - filtros perdidos:
- `NextJS/src/modules/reportes/ui/components/report-employees.tsx:244` define `const esAdmin = tienePermiso(session?.user?.permisos, "*")` y el fieldset "Dirección Administrativa" (Nivel/dependencia, Dirección General, Dirección de Línea, Coordinación) está dentro de `{esAdmin && (...)}` (línea ~255). Igual en `report-code.tsx:143/156`.
- Antes (commit d827ee2) era `role.nombre_rol === "ADMINISTRADOR" || role.id === 1`. El commit `09eaaa1` (2026-10-29, "acceso por permisos...") lo cambió a `"*"`.
- El rol ADMINISTRADOR NO tiene el comodín `*`: el seed le asigna la lista enumerada (`seed_permisos.py:170`, `1: [p[0] for p in PERMISOS_CATALOGO]`) y `/auth/me/` entrega códigos planos. `tienePermiso(permisos,"*")` solo es verdadero si `"*"` está literalmente en la lista, así que `esAdmin` es falso para todos y esos filtros de estructura se ocultan siempre.
Evidencia - PDF no se genera:
- Ruta real: `postReport` (`modules/reportes/ui/services/reportes-catalogos.ts:381`) -> POST `/api/reports/pdf/` (`app/api/reports/pdf/route.ts`) -> GET `/api/v1/reportes/personal-activo/pdf/` con query params.
- El backend (`repo_reportes_orm.py:8-36`) solo entiende: sexo_id, estado_civil_id, dependencia_id, direccion_general_id, direccion_linea_id, coordinacion_id, nomina_id, grado_id, cargo_id, cargo_especifico_id, OrganismoAdscrito_id. Los demás filtros del formulario (edad_min/max, apn_min/max, fechas de ingreso/APN, discapacidad, patología, grupo sanguíneo, nivel académico, carrera, mención, capacitación, procedencia, grupo, región, estado, municipio, parroquia, condición de vivienda) se ignoran en silencio. Además `agrupar_por` y `tipo_reporte` se descartan en `route.ts`. El reporte sale con datos no filtrados o con menos filtros de los pedidos. Tope silencioso de 500 filas (`qs[:500]`).
- El error se traga: en `onSubmit` (`report-employees.tsx:~233`) el `catch` solo hace `console.error`; el usuario no ve toast. Los fallos posibles quedan mudos: 403 si el rol no tiene `reportes.generar_pdf` (`requestBlob` lanza "No tienes permiso"), 401/refresh, 500 del backend. Tras éxito hace `form.reset()` y borra los filtros elegidos.
- No pude reproducir en vivo (sin login ni frontend arriba); la causa concreta del "no genera" en el entorno del usuario es una de: permiso `reportes.generar_pdf` ausente en su rol, o error 4xx/5xx tragado. Probar con la consola del navegador (Network `/api/reports/pdf/`).
Corrección:
1. `esAdmin` -> no usar `"*"`; mostrar el bloque de estructura con `tienePermiso(permisos, "reportes.ver")` (o quitar la condición), y alinear con el esquema real de permisos.
2. Mostrar toast con el error en `onSubmit`; no resetear el formulario tras generar.
3. Backend: implementar los filtros faltantes (o quitarlos de la UI) y devolver 400 con mensaje para filtros desconocidos; pasar `agrupar_por`.
4. Test de contrato UI-backend de filtros.
Esfuerzo: S (visibilidad + toast) / L (filtros restantes en backend).

## 5. Tiempo de servicio / antecedentes
Estado: OK (sin regresión de la lógica de cálculo).
Evidencia: `apps/personal/shared/domain/services/tiempo_servicio.py` sin cambios desde su creación (git log: solo `1ea4977`, 2026-08-29); método comercial 30/360 con +1 día. `test_tiempo_servicio.py` sin cambios desde `1ea4977`. El mapper (`mapper_personal.py::_total_anos_apn_calculado`) usa el cálculo Python como fuente autoritativa (D-05); el diff de `131e639` no toca esa parte. Notas: (a) solo suma antecedentes cerrados, mientras que el trigger de BD sumaba además los abiertos (divergencia aceptada en D-05); (b) la conversión a años usa meses/12 y días/365, mezclando 360 y 365, con un pequeño error de redondeo; (c) la acción A-02 (auditar el trigger `trg_actualizar_apn` en producción) sigue pendiente y no se verificó. No se pudieron ejecutar los tests (sin pytest en el intérprete).
Corrección: ejecutar la suite con el venv del proyecto; unificar la fuente (B18) y retirar el trigger cuando Infraestructura lo confirme; usar días/360 al convertir a años.
Esfuerzo: S.

## 6. Recorrido general
Funciones presentes en backend: personal (CRUD, expediente, contrato, antecedentes, foto, PDF), cargos (asignar, traspasos, préstamos, vacantes), movimientos (historial + PDF), pasivos (egreso, sobrevivientes, PDF), reportes (personal, pasivos, vacantes, familiares, códigos, tendencias, distribución; PDF y Excel), configuración visual, punto de cuenta (backend).
Faltan o están rotas:
- Menú a Configuración visual (no existe). [Roto]
- UI de punto de cuenta y descarga (no existe); disparo en cambio de cargo y pase a pasivo (no existe); criterio Gerencia/Oficina (parcial).
- Excel de movimientos (no existe); validación RN-008-01 en backend (no existe); tope de 300 filas.
- Filtros de estructura ocultos en reportes de trabajador y de códigos (regresión 09eaaa1); filtros no implementados en backend; errores mudos.
- Cintillo configurable no aplicado a carnet y fe de vida.
- Existe código legacy duplicado `NextJS/src/app/(protected)/dashboard/...` (getInfoRac.ts) además de `(app)`, con `postReport` propio que apunta a `reports/pdf/` (ruta que no existe en el backend). Riesgo de confusión.
- Revisar un punto no verificado: los documentos ESTADO_SISTEMA, AUDITORIA_*, BITACORA y REPORTE_PRUEBAS no se revisaron línea a línea; la lista se obtuvo del código.

## Tabla resumen priorizada
| # | Hallazgo | Estado | Esfuerzo | Prioridad |
|---|----------|--------|----------|-----------|
| 1 | Filtros de estructura ocultos (`esAdmin` con "*", commit 09eaaa1) en report-employees y report-code | Roto | S | Alta |
| 2 | Reporte trabajador: errores tragados y form.reset; verificar permiso `reportes.generar_pdf` | Roto | S | Alta |
| 3 | Sin enlace de menú a /configuracion/visual (permiso mal asignado a Retroalimentación) | Parcial | S | Alta |
| 4 | Punto de cuenta sin pantalla/descarga ni aviso al usuario | No existe (UI) | L | Alta |
| 5 | Punto de cuenta no se dispara en cambio de cargo ni pase a pasivo; compara solo Dependencia | Parcial | M | Alta |
| 6 | Reporte de personal: ~20 filtros del formulario ignorados por el backend; tope 500 | Parcial | L | Media |
| 7 | Movimientos: sin Excel; RN-008-01 solo en frontend; tope 300; PDF sin filtros impresos (el PDF SÍ aplica los filtros) | Parcial | M | Media |
| 8 | Cintillo configurable no usado en carnet / fe de vida | Parcial | M | Media |
| 9 | Plantilla/formato oficial de punto de cuenta por definir | Pendiente | M | Media |
| 10 | Tiempo de servicio: lógica sin cambios; pendiente A-02 y tests sin ejecutar | OK | S | Baja |
| 11 | Código legacy `(protected)/dashboard` duplicado | Deuda | S | Baja |
