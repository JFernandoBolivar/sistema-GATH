# API de fe de vida (`/api/v1/fe-de-vida/`)

Contrato para el frontend. Todas las respuestas JSON usan el sobre `{status, message, data}`; los errores devuelven `status: "error"` con `message` legible (400 validación, 401/403 sin sesión o permiso, 404 inexistente, 409 conflicto de estado). Auth por cookie de sesión. La cédula del pasivo **siempre** sale de la sesión, nunca del cuerpo ni de la URL. Los listados paginan en el servidor: `?limit=` (10 por defecto, máximo 50) y `?offset=`; `data = {count, limit, offset, results[]}`. El esquema interactivo está en OpenAPI (drf-spectacular).

Notación de permisos: los de **pasivo** exigen además la condición PASIVO calculada en el servidor (un trabajador activo recibe 403 aunque tenga el permiso). Los de **Bienestar** aceptan cualquiera de los códigos listados.

## Estados

- Proceso: `BORRADOR -> ABIERTO -> CERRADO`.
- Solicitud: `BORRADOR`, `PENDIENTE_REVISION`, `PENDIENTE_SEGUNDO_CHECK`, `VALIDADA`, `RECHAZADA` (definitiva), `DEVUELTA` (devuelta para corrección; sustituye al antiguo `REPETICION_SOLICITADA`), `EXPIRADA`, `ARCHIVADA`. `BORRADOR` y `DEVUELTA` son editables por el pasivo.
- Tipos de decisión en `decisiones[].tipo`: `CHECK`, `APROBACION_DIRECTA`, `RECHAZO`, `DEVOLUCION`.

## Objetos

**Proceso** (las fechas se llaman siempre `fecha_apertura` y `fecha_cierre`, en request y response)
```json
{"id": "uuid", "nombre": "Fe de vida 2026-2027", "estado": "BORRADOR|ABIERTO|CERRADO",
 "fecha_apertura": "ISO", "fecha_cierre": "ISO", "fecha_cierre_real": "ISO|null",
 "tipos_nomina": [{"id": 3, "nombre": "JUBILADO"}], "dias_recordatorio": [7, 3, 1]}
```
`tipos_nomina` vacío = el proceso aplica a todos los pasivos. `dias_recordatorio` vacío = sin recordatorios (viene ordenado de mayor a menor).

**Solicitud**
```json
{"id": "uuid", "proceso_id": "uuid", "cedula": "5111111", "nombre": "solo en bandeja", "estado": "DEVUELTA",
 "version": 3, "envios": 1, "origen_evidencia": "CAMARA|ARCHIVO|null", "tiene_evidencia": true,
 "via_aprobacion": "DOBLE_CHECK|DIRECTA_ADMINISTRADORA|null", "fecha_envio": "ISO|null", "fecha_validacion": "ISO|null",
 "requiere_nueva_foto": false,
 "decisiones": [{"tipo": "DEVOLUCION", "rol": "ANALISTA|ADMINISTRADORA", "actor_cedula": "...", "envio": 1, "motivo": "...", "fecha": "ISO"}]}
```
`requiere_nueva_foto = true` solo en una solicitud `DEVUELTA` cuyo revisor pidió foto nueva (la foto vigente ya fue retirada: `tiene_evidencia = false`). Con `false`, la foto actual se conserva y el pasivo puede cambiarla si quiere. El motivo de la devolución/rechazo está en la última `decisiones[]`.

**Campos que el pasivo puede proponer en el acta** (`PUT mis-solicitudes/{id}/borrador/`, lista blanca propia de fe de vida; se aplican a los datos reales solo al quedar `VALIDADA`):
- `seccion: "identidad"`, `entidad: "employee"`, `accion: "MODIFICAR"`: `campo` = `nombres`, `apellidos` o `fecha_nacimiento` (`YYYY-MM-DD`, no futura). Son exclusivos de fe de vida: la autogestión del activo no los admite.
- Los de autogestión: `contacto` (`employee.telefono_movil|telefono_habitacion`, `datos_complementarios.correo_alternativo`, `contacto_emergencia.*`), `vivienda` (`datos_vivienda.*`), `familiar` (`familiar.*`, `datos_complementarios.tiene_hijos`) y `formacion`.
- Nunca: cédula, correo principal (login), cargo, oficina, estatus. Cualquier otro campo o una sección equivocada responde 400.

**Cambio del acta**: `{id, seccion, accion: MODIFICAR|CREAR, entidad, entidad_id, campo, valor_anterior, valor_propuesto}`. En la revisión añade `valor_actual` y `conflicto` (la ficha cambió desde la propuesta).

**Prórroga**: `{id, proceso_id, cedula ("" si es general), general, nueva_fecha_limite, motivo, concedida_por}`.

---

## Pasivo

### GET `procesos/vigente/`
Permiso `fe_de_vida.solicitar` + PASIVO. Proceso en el que puedo actuar hoy (abierto y en plazo, o con prórroga vigente) **y cuyo alcance incluya mi tipo de pensión**. Response `data`: `{proceso: Proceso, solicitud: Solicitud|null, puede_enviar: bool}`, o `null` si no hay proceso disponible.

### POST `procesos/vigente/solicitud/`
Permiso `fe_de_vida.solicitar` + PASIVO. Sin cuerpo. Crea (o devuelve, idempotente) mi solicitud en el proceso vigente. Response: Solicitud. 409 si no hay proceso disponible para mí (incluye estar fuera del alcance).

### GET `mis-solicitudes/`
Permiso `fe_de_vida.ver_propia` + PASIVO. Query: `estado`, `limit`, `offset`. Response: página de Solicitud (historial, una por proceso).

### GET `mis-solicitudes/{id}/`
Permiso `fe_de_vida.ver_propia` + PASIVO. Response: `{solicitud: Solicitud, cambios: [Cambio]}`. 403 si no es mía.

### PUT `mis-solicitudes/{id}/borrador/`
Permiso `fe_de_vida.solicitar` + PASIVO. Reemplaza las respuestas del acta. Solo en `BORRADOR` o `DEVUELTA`. Request:
`{"cambios": [{"seccion": "contacto", "entidad": "employee", "accion": "MODIFICAR|CREAR", "campo": "telefono_movil", "valor": "...", "entidad_id": "opcional"}]}` (máx. 60). Response: `{solicitud, cambios}`.

### POST `mis-solicitudes/{id}/evidencia/`
Permiso `fe_de_vida.solicitar` + PASIVO. `multipart/form-data`: `file` (JPG/PNG), `origen` (`CAMARA|ARCHIVO`), `metadatos` (JSON opcional). Solo en `BORRADOR` o `DEVUELTA`. Response: Solicitud.

### POST `mis-solicitudes/{id}/enviar/`
Permiso `fe_de_vida.solicitar` + PASIVO. Sin cuerpo. `BORRADOR|DEVUELTA -> PENDIENTE_REVISION`; exige foto y proceso en plazo o prórroga. 400 si falta la foto (p. ej. devolución con `requiere_nueva_foto`). Response: Solicitud.

### GET `mis-solicitudes/{id}/constancia/`
Permiso `fe_de_vida.ver_propia` + PASIVO. Descarga el PDF de la constancia (404 si aún no existe).

---

## Revisión de Bienestar

### GET `solicitudes/`
Permiso `fe_de_vida.revisar` o `fe_de_vida.ver_panel`. Query: `texto` (cédula o nombre), `estado`, `proceso_id`, `desde`, `hasta` (fecha de envío, `YYYY-MM-DD`), `limit`, `offset`. Response: página de Solicitud con `nombre`.

### GET `solicitudes/{id}/`
Permiso `fe_de_vida.revisar` o `fe_de_vida.ver_panel`. Response: `{solicitud (con nombre), cambios: [Cambio + valor_actual + conflicto]}`.

### GET `solicitudes/{id}/evidencia/`
Permiso `fe_de_vida.ver_evidencia`. Response: `{url, expira_en_segundos}` (URL prefirmada corta; cada consulta se audita). 404 si no hay foto vigente.

### POST `solicitudes/{id}/check/`
Permiso `fe_de_vida.check_analista` o `fe_de_vida.check_administradora`. Sin cuerpo. Doble check en orden indistinto (otra persona y otro rol); el segundo valida. Response: Solicitud.

### POST `solicitudes/{id}/aprobar-directo/`
Permiso `fe_de_vida.aprobar_directo` (solo Administradora). Request `{"justificacion": "..."}` (obligatoria, máx. 500). Response: Solicitud `VALIDADA`.

### POST `solicitudes/{id}/rechazar/`
Permiso `fe_de_vida.revisar`. Request `{"motivo": "..."}` (obligatorio, máx. 500). Rechazo **definitivo** (`RECHAZADA`). Response: Solicitud.

### POST `solicitudes/{id}/devolver/`
Permiso `fe_de_vida.revisar`. Request `{"motivo": "...", "requiere_nueva_foto": false}` (`motivo` obligatorio, máx. 500; `requiere_nueva_foto` opcional, `false` por defecto). Estado `DEVUELTA`: el pasivo corrige datos del acta y, si se pidió, la foto, y reenvía. Se avisa al pasivo (sistema y correo) con el motivo. Reemplaza a `solicitar-repeticion/` (esa ruta ya no existe). 409 si la solicitud no está pendiente de revisión. Response: Solicitud.

---

## Procesos y prórrogas

### GET `procesos/`
Permiso `fe_de_vida.gestionar_procesos`, `fe_de_vida.prorrogar` o `fe_de_vida.ver_panel`. Query: `estado` (`BORRADOR|ABIERTO|CERRADO`), `limit`, `offset`. Response: página de Proceso.

### POST `procesos/`
Permiso `fe_de_vida.gestionar_procesos` (solo Administradora). Request:
```json
{"nombre": "...", "fecha_apertura": "ISO", "fecha_cierre": "ISO",
 "tipos_nomina": [3, 5], "dias_recordatorio": [7, 3, 1]}
```
`tipos_nomina` y `dias_recordatorio` son opcionales (vacío/omitido = todos los pasivos / sin recordatorios). 400 si un id de `tipos_nomina` no es una nómina de pasivos (las nóminas activas se rechazan) o si los días se repiten, son < 1 o > 365 (máx. 10). 201 con Proceso en `BORRADOR`.

### GET `procesos/tipos-pension/`
Permiso `fe_de_vida.gestionar_procesos`, `fe_de_vida.prorrogar` o `fe_de_vida.ver_panel`. Catálogo para elegir el alcance. Response: `[{"id": 3, "nombre": "JUBILADO"}]` (solo nóminas de pasivos, es decir `TipoNomina.es_activo = false`, ordenadas por nombre).

### PATCH `procesos/{id}/`
Permiso `fe_de_vida.gestionar_procesos`. Request: cualquiera de `nombre`, `fecha_apertura`, `fecha_cierre`, `tipos_nomina`, `dias_recordatorio` (solo lo enviado; al menos uno). En `BORRADOR` admite todo; en `ABIERTO` solo `dias_recordatorio` (409 si se envía otro campo); `CERRADO` no se edita (409). Response: Proceso.

### POST `procesos/{id}/abrir/`
Permiso `fe_de_vida.gestionar_procesos`. Sin cuerpo. `BORRADOR -> ABIERTO`. Response: Proceso.

### POST `procesos/{id}/cerrar/`
Permiso `fe_de_vida.gestionar_procesos`. Sin cuerpo. `ABIERTO -> CERRADO`; las solicitudes sin enviar y sin prórroga pasan a `EXPIRADA`. Response: Proceso. (También cierra solo un beat cuando vence `fecha_cierre`.)

### GET `procesos/{id}/prorrogas/`
Permiso `fe_de_vida.prorrogar`, `fe_de_vida.gestionar_procesos` o `fe_de_vida.ver_panel`. Query: `limit`, `offset`. Response: página de Prórroga.

### POST `procesos/{id}/prorrogas/`
Permiso `fe_de_vida.prorrogar` o `fe_de_vida.gestionar_procesos` (en el seed, solo Administradora). Request `{"nueva_fecha_limite": "ISO", "motivo": "...", "cedula": "opcional"}`; con `cedula` es individual, sin ella es general. No amplía el alcance del proceso. Response 201: Prórroga.

---

## Cobertura y verificación

### GET `cobertura/pasivos/`
Permiso `fe_de_vida.ver_cobertura`. Query: `texto`, `tipo_nomina_id`, `sin_correo`, `sin_cuenta`, `limit`, `offset`. Sin `sin_correo`/`sin_cuenta` lista a quienes carecen de cualquiera de los dos. Response: página de `{cedula, nombre_completo, tipo_nomina, correo, sin_correo, tiene_cuenta}`.

### GET `constancias/verificar/{codigo}/`
Verificación **interna**. Permiso `fe_de_vida.verificar_constancia`; audita `CONSTANCIA_VERIFICADA`. Response: `{numero, emitida_en, proceso_nombre, nombre_completo, cedula, estado, solicitud_id, certificada_por: [{nombre, cedula, rol}]}` (`solicitud_id` sirve para enlazar a `/personal/fe-de-vida/{id}`). 404 si el código no existe.

### GET `constancias/publica/{codigo}/`
Verificación **pública** (la que abre el QR del documento): sin autenticación (`AllowAny`, sin cookie de sesión) y con throttle por IP, scope `fe_de_vida_verificacion_publica`, tasa configurable con `FE_DE_VIDA_VERIFICACION_PUBLICA_THROTTLE_RATE` (por defecto `30/minute`; 429 al excederla). Solo responde constancias de solicitudes en estado `VALIDADA`. Response 200: `{numero, emitida_en, proceso_nombre, nombre_completo, cedula_enmascarada, estado: "VALIDA"}`. No devuelve certificantes, cédula completa, ids internos ni foto. Código inexistente, con formato inválido (no son 64 caracteres hex en minúsculas) o de una solicitud no validada: 404 idéntico («No se encontró una constancia válida con ese código.»), sin revelar si el código existe. Audita cada consulta (`CONSTANCIA_VERIFICADA_PUBLICA`, resultado `SUCCESS` o `FAILED`) con la IP de origen.

Enmascarado de la cédula (`domain/services/verificacion.py::enmascarar_cedula`): con 7 o más dígitos conserva 2 al inicio y 2 al final (`10079123` → `10****23`, `5111111` → `51***11`); con 5 o 6 conserva 1 y 1; con 4 o menos oculta todo. La longitud se conserva.

---

## Avisos automáticos

- Devolución, rechazo, recepción y validación: aviso en el sistema (módulo autogestión) y correo al pasivo.
- Recordatorios previos al cierre (beat diario, 8:00): si faltan exactamente N días para `fecha_cierre` y N está en `dias_recordatorio`, se avisa (sistema y correo) a los pasivos del alcance que aún no enviaron su fe de vida (sin solicitud, en `BORRADOR`, `DEVUELTA` o `EXPIRADA`). No se repite el mismo aviso (proceso, N) a la misma persona.
