# Plan de re-priorización de la Fase 2: Autogestión, Notificaciones, Fe de Vida de pasivos y Acceso por permisos

Fecha: 2026-10-29 · Rama: `feature/fe-de-vida-pasivos` · Alcance: solo planificación (no se modificó código).
Documento hermano (no duplicado aquí): `PLAN_REDISENO_AUTOGESTION_PWA_2026-10-29.md` (rediseño visual y PWA).

Convenciones aplicables (skills del proyecto): backend Onion `apps/<modulo>/{domain,application,infrastructure,presentation}`, vistas explícitas, `HasPermission("modulo.accion")`, tablas nuevas `managed=True`, legadas `managed=False`; frontend `src/modules/<modulo>/{domain,application,infrastructure,ui}`, formularios react-hook-form + Zod, permisos por código.

---

## 0. Resumen ejecutivo

El usuario declara un cambio de prioridad dentro de la Fase 2 (ya descrita en `FASE2_PROPUESTA_TECNICA.md`, `PROPUESTA_FASE2_GATH.md` y `Propuesta_Fase2_GATH.html`) y un requerimiento nuevo (fe de vida de pasivos). No se agrega alcance fuera de la Fase 2: se **adelanta** el bloque "Portal de Autogestión con aprobación con diferencias" (diagrama de secuencia, tabla de secciones autogestionables, tablas `SolicitudActualizacion` y `RegistroCambioPropuesto`, rol Analista de Bienestar Social, bandeja de notificaciones) y se agrega la **Fe de vida** como un segundo tipo de solicitud que reutiliza la misma infraestructura (notificaciones, soportes, revisión, PDF, correo).

Orden de prioridad declarado:

1. Culminar Autogestión del activo (ficha integral, ventanas habilitadas por Bienestar Social, soportes obligatorios, visor comparativo campo por campo).
2. Notificaciones en sistema (campana/bandeja) y correo, para Autogestión y para Gestión de Trabajadores (Bienestar Social).
3. Acceso de pasivos a Autogestión con menú "Solicitud o renovación de acta de comparecencia / fe de vida" (formulario + foto con la cédula en mano, por cámara en vivo o subiendo una foto ya tomada).
4. Regla de aprobación: flujo normal con **doble aprobación** (Analista de Bienestar Social y Administradora/Jefa, en orden indistinto, como en la HU); excepción: la Administradora puede aprobar sola por **aprobación directa** (justificada y auditada). La Analista nunca valida sola.
5. Gestión de usuarios por **roles y permisos**, ya no por roles y departamentos.

**Se pospone** (siguen en Fase 2, solo cambian de orden): postulación digital y onboarding con credenciales temporales, carnet de dos caras y diseñador visual, sincronización GATH→SIGESP (bandeja de eventos de nómina), asignación atómica de cargo por Presupuesto y puntos de cuenta. Excepción: el hook "Actualización de datos aprobada" hacia nómina (E5 del diagrama de SIGESP) queda como evento registrado en outbox pero sin transmisión hasta que se retome SIGESP.

**Hallazgos críticos de la auditoría** (detalle en la sección 1):

- La app `autogestion` hoy es solo **censo de vivienda + "mi expediente" de solo lectura + carnet**. No existe solicitud de actualización, ventana, borrador, soporte ni visor comparativo.
- No existe **ninguna** infraestructura de notificaciones, ni Celery operativo (`GATH.celery` no existe; `CeleryTaskQueue.encolar` devuelve un id simulado), ni worker/beat en `compose.yml`. El correo hoy solo existe para recuperación de contraseña, de forma síncrona.
- La tabla `Employee` (donde se aplicarían los cambios) es `managed=False` con `correo` **unique**; formación académica y familiares también son legadas sin columna de archivo de soporte (los documentos de familiares sí tienen `FamilyDocumentModel`).
- Un pasivo **sigue siendo un `Employee`** (el pase solo crea otra `AsigTrabajo` con tipo de personal PASIVO). El login **no** consulta tipo de personal, solo `is_active`; por tanto, si el pasivo conserva su `Cuenta`, puede entrar. Hay que verificar en BD cuántos pasivos tienen cuenta y correo.
- Autorización: el backend ya es por permisos (`HasPermission`), con casi **cero** `nombre_rol` en duro. La deuda de roles/departamento está en el **frontend**: ~39 usos de `nombre_rol`, ~14 de `nombre_departamento`/`department` y el `proxy.ts`.
- Los permisos de Autogestión existentes no cubren el flujo nuevo, y el rol 5 "BIENSTAR SOCIAL" (nombre mal escrito, 1 cuenta) no distingue Analista de Administradora.
- La Fe de Vida admite **dos vías equivalentes** para la foto (cámara en vivo con `getUserMedia`, o subida de una foto ya tomada). `getUserMedia` solo opera en contexto seguro: `http://localhost:3001` lo es, así que todo el desarrollo y las pruebas se hacen en local sin certificado. El HTTPS/nginx de **producción** es un requisito de despliegue a cargo de Infraestructura (ver tarea `C0`): no es tarea del desarrollo ni bloquea ninguna fase, y la falta de cámara nunca bloquea el flujo porque siempre existe la vía de subida de archivo.

---

## Hoja de ruta y seguimiento

Esta sección ordena el plan por **fases según la prioridad del usuario y las dependencias técnicas reales**. Las etapas A–E de la sección 3 (y las etapas 0–6 del plan hermano `PLAN_REDISENO_AUTOGESTION_PWA_2026-10-29.md`, citadas aquí como **R-0 … R-6**) siguen siendo el detalle técnico; las fases solo reagrupan sus tareas. No se duplica el detalle del plan de rediseño.

### Por dónde comenzar

1. **Día 1, en paralelo (Fase 0)**: enviar al usuario las preguntas bloqueantes de arranque (4.3.5 actores de Bienestar, 4.3.2 plazo de ventanas, 4.3.6 regla de aprobación en autogestión). Todo el desarrollo y las pruebas se hacen en `http://localhost:3001` (contexto seguro: cámara y PWA funcionan sin certificado). *Nota de despliegue (no es acción del día 1 ni del desarrollo)*: el TLS/dominio/nginx de producción lo gestiona Infraestructura cuando se despliegue (ver `C0`). Confirmar el nombre real del rol "BIENSTAR SOCIAL" en `USER_rol` (R6) y ejecutar el conteo de pasivos con cuenta y correo (R7) y la verificación de `permisos_version` (R5) (tarea `V-1`).
2. **Primera fase de construcción: Fase 1 (Cimientos)**, con las tareas `A4` (roles y permisos nuevos), `A5` (validación y almacenamiento seguro de archivos), `A1` (Celery real y `encolar` que falla cerrado), `A6` y `A8`. Sin `A4` y `A5` no se puede construir la autogestión (B1 y B3 los usan) ni la fe de vida.
3. **Inmediatamente después, Fase 2 (Autogestión del activo)**: `B1 → B2 → B3 → B4/B5/B6`, `B8`, y en frontend `B9 → B10/B11` junto con `R-1`, `R-2` y `R-6a` (FieldCompare), que son una sola entrega con B10/B11 (el diseño no se hace dos veces). `R-1` puede empezar ya, durante la Fase 1, porque no depende del backend.
4. **Fase 3 (Notificaciones y correo)** se inicia en cuanto `B3` exista (para engancharse a las transiciones) y puede solaparse con el final de la Fase 2: `A2 → A3 → A7 → B7`.
5. **Fase 4 (Fe de vida)** arranca con `C1`/`C2`/`C3` en backend apenas A4 y A5 estén listos y la ADR de aprobación directa (R9) esté confirmada; `C13` (captura con dos vías) se desarrolla y prueba en `localhost`; no espera a `C0`. Opcional: para probar en un teléfono durante el desarrollo, tenga en cuenta que el teléfono accediendo por IP/HTTP **no** es contexto seguro, por lo que allí aplica la vía de subida de archivo.
6. Correspondencia con las prioridades del usuario: P1 → Fase 2, P2 → Fase 3, P3 → Fase 4, P4 (usuarios por roles y permisos) → Fase 5, P5 (rediseño y PWA) → Fases 2, 4 y 6. Las Fases 0 y 1 no son prioridades nuevas: son prerrequisitos técnicos de las anteriores.

### Leyenda de estados

⏳ Pendiente · 🔄 En proceso · ✅ Culminado · ⛔ Bloqueado (indicar el motivo en Notas)

### Tabla de fases

| Fase | Objetivo | Etapas/tareas del plan (IDs) | Depende de | Esfuerzo | Estado | Inicio | Fin | Notas |
|---|---|---|---|---|---|---|---|---|
| **Fase 0** — Arranque y bloqueantes (continua, desde el día 1) | Iniciar lo que depende de terceros: respuestas del usuario y verificaciones en BD | `R-0`, `V-1` (riesgos R5, R6, R7 de 4.1) | — | S (seguimiento continuo) | ⏳ Pendiente | — | — | Sin camino crítico de infraestructura: el HTTPS de producción (`C0`) es de Infraestructura y no bloquea ninguna fase |
| **Fase 1** — Cimientos | Permisos y roles nuevos, almacenamiento seguro, Celery real, base de sesión por permisos | `A1`, `A4`, `A5`, `A6`, `A8`, `A-T` | V-1 (nombre real del rol, para A4) | M | ⏳ Pendiente | — | — | Prioridad técnica, no funcional. A2/A3/A7 pasan a la Fase 3 |
| **Fase 2** — Autogestión del empleado activo (P1) | Solicitud de actualización, ventanas, borrador, soportes obligatorios, visor comparativo campo por campo, aplicación de cambios aprobados | `B1`–`B6`, `B8`–`B12`, `B-T`, `R-1`, `R-2`, `R-6a` | Fase 1 (A4, A5) | L | ⏳ Pendiente | — | — | Sin notificaciones aún (B7 va en Fase 3). Diseño visual con R-1/R-2 |
| **Fase 3** — Notificaciones en sistema y correo (P2) | Campana/bandeja, outbox, correo asíncrono; conexión con las transiciones de Autogestión y Gestión de Trabajadores | `A2`, `A3`, `A7`, `B7`, `A-T2` | Fase 1 (A1, A4), `B3` | M | ⏳ Pendiente | — | — | Requiere credenciales SMTP institucionales (R11). Puede solaparse con el final de la Fase 2 |
| **Fase 4** — Fe de vida de pasivos (P3) | Formulario + selfie con cédula (cámara en vivo o subida de archivo), revisión de Bienestar, doble check + aprobación directa de la Administradora, constancia PDF por correo, acceso del pasivo | `C1`–`C15`, `C-T`, `R-3` (= C13); `C0` queda como requisito de despliegue de Infraestructura (fuera del camino crítico) | Fases 1 y 3; ADR de aprobación directa (R9) | L | ⏳ Pendiente | — | — | Backend, UI y pruebas (incluida la cámara) avanzan en `localhost`; la vía de subida de archivo cubre cualquier equipo sin cámara o sin contexto seguro. Incluye la conversión de cuentas de pasivos (parte de D5) |
| **Fase 5** — Usuarios por roles y permisos (P4) | Retirar el acceso por departamento y `nombre_rol` en frontend; alta de usuarios por rol + permisos; invalidación por `permisos_version` | `D1`–`D6` | Fase 1 (A4, A8); idealmente tras Fases 2 y 4 | M | ⏳ Pendiente | — | — | Puede avanzar en paralelo desde A4, pero se despliega después de que los flujos usen los permisos nuevos |
| **Fase 6** — Rediseño institucional y PWA (P5) | Cierre del sistema visual en el resto de pantallas, PWA instalable y offline | `R-5`, `R-6b`, `R-A` | Fases 2 y 4 (la PWA se prueba en `localhost`; el HTTPS de producción es de Infraestructura, ver `C0`) | M | ⏳ Pendiente | — | — | R-1 a R-3 ya se entregan dentro de las Fases 2 y 4; no se repiten |
| **Fase 7** — Endurecimiento y auditoría | Auditoría encadenada, rate limiting, observabilidad, pruebas de seguridad, cierre documental | `E1`–`E6` | Fases 2 a 6 | M | ⏳ Pendiente | — | — | Los specs de axe se agregan por etapa; aquí solo el cierre |

### Tabla de tareas

Capas: Back, Front, Infra, Test, Doc. Los IDs `A*`, `B*`, `C*`, `D*`, `E*` son los de la sección 3; `R-n` corresponde a la etapa n del plan de rediseño/PWA (sin duplicar su detalle). `V-1`, `A-T`, `A-T2`, `B-T`, `C-T`, `R-6a`, `R-6b` y `R-A` son identificadores de seguimiento creados aquí para tareas que el plan describe de forma agrupada (verificaciones, bloques de "Tests" de cada etapa y partes de la etapa 6).

**Fase 0 — Arranque y bloqueantes**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| R-0 | Manual de identidad, `lang="es-VE"`, título, retirar `MarqueeTitle`, SW ajeno en `localhost:3000` | Front | — | ⏳ Pendiente | — | Etapa 0 del plan de rediseño |
| V-1 | Verificaciones en BD: nombre real del rol, pasivos con cuenta y correo, `permisos_version` (R5, R6, R7) | Back | — | ⏳ Pendiente | — | Insumo de A4 y D5 |

**Fase 1 — Cimientos**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| A1 | Celery real (`GATH/celery.py`, worker/beat en compose, `encolar` falla cerrado) | Back/Infra | — | ⏳ Pendiente | — | |
| A4 | Roles y permisos nuevos (seed, `RolEspejo`) y `permisos_version` operativo | Back | V-1 | ⏳ Pendiente | — | Crea ANALISTA_BIENESTAR, ADMIN_BIENESTAR, PASIVO |
| A5 | Validación de archivos (firma real, tamaño, claves uuid) | Back | — | ⏳ Pendiente | — | Incluye corrección aparte de `familiares_views.py` y `carnetizacion_views.py` |
| A6 | Auditoría: `user_agent` o registro en `estado_nuevo` | Back | — | ⏳ Pendiente | — | |
| A8 | Helper `puedeVerRuta` y mapa permiso→módulo en `evaluador-iam.ts` | Front | A4 | ⏳ Pendiente | — | Insumo de D1 |
| A-T | Tests de Fase 1 (contrato de `encolar`, seed idempotente, validación de archivos) | Test | A1, A4, A5 | ⏳ Pendiente | — | Parte de los tests de la etapa A |

**Fase 2 — Autogestión del empleado activo**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| B1 | Modelos, migraciones y semilla de secciones | Back | A4 | ⏳ Pendiente | — | |
| B2 | Dominio: entidades, estados, puertos | Back | B1 | ⏳ Pendiente | — | |
| B3 | Casos de uso (solicitar, habilitar, borrador, soporte, enviar, comparativo, decidir, aplicar, expirar, rechazar) | Back | B2, A5 | ⏳ Pendiente | — | `decidir` usa la regla de 2.2 |
| B4 | Vistas y URLs (trabajador y Bienestar) | Back | B3 | ⏳ Pendiente | — | |
| B5 | Serializers con lista blanca por sección | Back | B3 | ⏳ Pendiente | — | |
| B6 | Valor anterior desde la ficha y detección de conflicto | Back | B3 | ⏳ Pendiente | — | |
| B8 | `MiExpedienteView` con `autogestion.ver_propio` | Back | A4 | ⏳ Pendiente | — | |
| B9 | Dominio/aplicación/infraestructura frontend y schemas Zod | Front | B4 | ⏳ Pendiente | — | Puede empezar con datos simulados |
| R-1 | Tokens, tipografía y shell institucional | Front | R-0 | ⏳ Pendiente | — | Etapa 1 del plan de rediseño; puede empezar durante la Fase 1 |
| R-2 | Pantallas del funcionario: ficha, solicitudes, avisos | Front | R-1 | ⏳ Pendiente | — | Una sola entrega con B10 |
| B10 | UI trabajador: mis solicitudes, formularios por sección, soportes | Front | B9, R-2 | ⏳ Pendiente | — | |
| R-6a | `FieldCompare` (componente visual del comparativo) | Front | R-1 | ⏳ Pendiente | — | Parte de la etapa 6 del plan de rediseño |
| B11 | UI Bienestar: bandeja, habilitar ventana, visor comparativo | Front | B9, R-6a | ⏳ Pendiente | — | |
| B12 | Estados vacíos, carga, errores y accesibilidad | Front | B10, B11 | ⏳ Pendiente | — | |
| B-T | Tests de Fase 2 (transiciones, Zero-IDOR, ficha intacta hasta aprobar, E2E) | Test | B4, B11 | ⏳ Pendiente | — | Usar BD de pruebas, nunca la real |

**Fase 3 — Notificaciones en sistema y correo**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| A2 | App `notificaciones` (modelos, casos de uso, API) | Back | A4 | ⏳ Pendiente | — | |
| A3 | Correo asíncrono con outbox, reintentos y plantillas | Back | A1, A2 | ⏳ Pendiente | — | Requiere SMTP (R11) |
| A7 | Módulo frontend de notificaciones y campana | Front | A2 | ⏳ Pendiente | — | |
| B7 | Notificaciones en cada transición de Autogestión y evento outbox | Back | A2, A3, B3 | ⏳ Pendiente | — | Incluye alerta de reemisión de carnet |
| A-T2 | Tests de notificaciones, outbox y polling | Test | A2, A3, A7 | ⏳ Pendiente | — | |

**Fase 4 — Fe de vida de pasivos**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| C0 | Requisito de despliegue a cargo de Infraestructura: HTTPS en producción (nginx + TLS, un solo origen, cookies Secure, Permissions-Policy) | Infra (despliegue) | — | ⏳ Pendiente (a cargo de Infraestructura) | Infraestructura | Fuera del camino crítico; no bloquea ninguna fase. Es también R-4. Ver checklist de despliegue en la Etapa C |
| C1 | Modelos, migraciones, catálogo y plantilla v1 | Back | A4 | ⏳ Pendiente | — | |
| C2 | Dominio y reglas de doble check / aprobación directa | Back | C1 | ⏳ Pendiente | — | Requiere ADR confirmada (R9) |
| C3 | Casos de uso (comparecencia, decisión, constancia, verificación, panel) | Back | C2, A5 | ⏳ Pendiente | — | |
| C4 | PDF de constancia con número, hash y QR | Back | C3 | ⏳ Pendiente | — | |
| C5 | Vistas y URLs (pasivo y Bienestar) | Back | C3 | ⏳ Pendiente | — | |
| C6 | Notificaciones y correo con PDF | Back | A2, A3, C5 | ⏳ Pendiente | — | |
| C7 | Acceso del pasivo: rol PASIVO, hook activo→pasivo, `proxy.ts`; incluye la conversión de cuentas de pasivos (parte de D5) | Back/Front | A4, V-1 | ⏳ Pendiente | — | |
| C8 | Recordatorios con beat | Back | A1, C3 | ⏳ Pendiente | — | Solo si se define periodicidad (4.3.1) |
| C9 | Eventos de auditoría de la HU | Back | C3, A6 | ⏳ Pendiente | — | |
| C10 | Módulo `fe-de-vida` frontend | Front | C5 | ⏳ Pendiente | — | |
| C11 | Menú del pasivo en Autogestión | Front | C7, R-2 | ⏳ Pendiente | — | |
| C12 | Formulario según planilla física | Front | C10 | ⏳ Pendiente | — | |
| C13 | Componente de captura con dos vías: cámara en vivo o subida de foto (antes `CapturaCedulaEnVivo`; incluye R-3) | Front | C10 | ⏳ Pendiente | — | Se prueba en `localhost`; sin cámara/contexto seguro ofrece siempre "Subir una foto" |
| C14 | Seguimiento: estado, repetición, descarga de constancia | Front | C12 | ⏳ Pendiente | — | |
| C15 | Vista Bienestar: bandeja, detalle con selfie, botones por permiso | Front | C5, R-6a | ⏳ Pendiente | — | |
| C-T | Tests de Fase 4 (transiciones, imagen, atomicidad, E2E con cámara falsa y E2E con subida de archivo sin cámara, rechazo de archivo inválido) | Test | C5, C13 | ⏳ Pendiente | — | |

**Fase 5 — Usuarios por roles y permisos**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| D1 | `proxy.ts`, dashboard y sidebars por permisos | Front | A8 | ⏳ Pendiente | — | |
| D2 | Retirar departamento de `auth.config.ts`/`auth.ts`; re-sincronizar por `permisos_version` | Front | A4 | ⏳ Pendiente | — | |
| D3 | `departamento` opcional/deprecado en backend de identidad | Back | — | ⏳ Pendiente | — | |
| D4 | UI de usuarios (cédula + rol + permisos) y matriz de permisos | Front | D3, A4 | ⏳ Pendiente | — | |
| D5 | Datos: renombrar rol, crear roles, asignar usuarios, convertir cuentas de pasivos | Back | A4, V-1 | ⏳ Pendiente | — | La conversión de pasivos se adelanta a la Fase 4 (C7) |
| D6 | Tests de regresión rol→rutas (Vitest y Playwright) | Test | D1, D5 | ⏳ Pendiente | — | |

**Fase 6 — Rediseño institucional y PWA**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| R-5 | PWA: manifest, service worker, offline, instalación | Front | — | ⏳ Pendiente | — | Se prueba en `localhost`; el SW no cachea `/api/` ni evidencias |
| R-6b | Sistema visual en consultar, métricas, censo, login y selector de módulos | Front | R-1 | ⏳ Pendiente | — | Resto de la etapa 6 |
| R-A | Revisión final de accesibilidad con usuarios mayores (axe 0 violaciones) | Test | R-5, R-6b | ⏳ Pendiente | — | |

**Fase 7 — Endurecimiento y auditoría**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| E1 | Auditoría con hash encadenado, user-agent, dispositivo, trace_id | Back | A6 | ⏳ Pendiente | — | |
| E2 | Rate limiting, antivirus opcional, límites de tamaño | Back/Infra | — | ⏳ Pendiente | — | |
| E3 | Observabilidad del worker y alertas por FALLIDA | Back | A3 | ⏳ Pendiente | — | |
| E4 | Pruebas de seguridad, cabeceras y CSP | Test | Fases 2–4 | ⏳ Pendiente | — | |
| E5 | Verificación interna, panel completo, plantillas, política de retención | Back/Front | C3, C15 | ⏳ Pendiente | — | |
| E6 | Actualizar `ESTADO_SISTEMA` y bitácora | Doc | E1–E5 | ⏳ Pendiente | — | |

### Cómo actualizar

- Al empezar una tarea, cambiar su Estado a 🔄 En proceso y anotar el Responsable; al terminarla, a ✅ Culminado. Si se detiene por un tercero, usar ⛔ Bloqueado y escribir el motivo en Notas.
- En la tabla de fases, completar Inicio al pasar a 🔄 (fecha `AAAA-MM-DD`) y Fin al pasar a ✅.
- Una fase pasa a ✅ Culminado solo cuando **todas** sus tareas están en ✅ y se cumple el **criterio de salida** de la(s) etapa(s) que la componen (sección 3; para las tareas R-n, el criterio de la etapa correspondiente del plan de rediseño). Una fase pasa a 🔄 cuando su primera tarea está en proceso.
- Si cambia el alcance o una dependencia, ajustar también la columna "Depende de" y dejar constancia en Notas.

### Preguntas abiertas que bloquean el inicio de cada fase

Las preguntas completas están en la sección 4.3 y los riesgos en la 4.1.

| Fase | Preguntas/decisiones que la bloquean |
|---|---|
| Fase 0 | Ninguna de infraestructura (4.3.10 dominio/certificado es asunto de despliegue de Infraestructura, no bloquea) |
| Fase 1 | Nombre real del rol "BIENSTAR SOCIAL" (R6); 4.3.5 (cédulas y cantidad de Analistas y Administradoras) para la asignación de roles |
| Fase 2 | 4.3.2 (plazo de ventanas y prórrogas); 4.3.6 (regla de aprobación por sección) |
| Fase 3 | Credenciales y relay SMTP institucional (R11); 4.3.3 (cobertura de correo y alternativa para pasivos sin correo) |
| Fase 4 | ADR de aprobación directa (R9); 4.3.1 (periodicidad, solo para C8); 4.3.3; 4.3.4 (texto oficial y firmante); 4.3.7 (resuelta: dos vías, ver 2.6); 4.3.8 (campos editables de la planilla); 4.3.11 (retención de la selfie); 4.3.12 (sobrevivientes); 4.3.13 (primera vez vs renovación) |
| Fase 5 | 4.3.5; confirmación de la lista de usuarios a reasignar |
| Fase 6 | Preguntas P1–P4 de la sección 7 del plan de rediseño (manual de identidad, colores, fuente, dominio) |
| Fase 7 | 4.3.9 (MFA); 4.3.11 (política de retención) |

---

## 1. Auditoría: estado actual vs requerido

Leyenda: Existe / Parcial / No existe. Rutas relativas a `BACKEND/` o `NextJS/`.

### 1.1 Prioridad 1 — Autogestión del activo

| Requerido | Estado | Evidencia |
|---|---|---|
| Ficha integral del trabajador (datos, vivienda, salud, educación, familiares) en solo lectura | Existe | `apps/autogestion/presentation/views/autogestion_views.py:215-262` (`MiExpedienteView`, Zero-IDOR con `request.user.cedula_id`); caso de uso `application/use_cases/obtener_mi_expediente.py:22-41`. UI: `src/modules/autogestion/ui/mi-expediente-view.tsx` |
| `MiExpediente` protegido por permiso | Parcial | Solo `IsAuthenticated` (`autogestion_views.py:222`); existe el código `autogestion.ver_propio` en el seed pero no se usa en la vista |
| Botón "Solicitar actualización" y estado de solicitudes | No existe | `apps/autogestion/presentation/urls.py:1-46` solo expone mi-expediente, carnet, censo; sin rutas de solicitudes |
| Ventanas habilitadas por Bienestar Social (secciones + plazo) | No existe | Sin modelo ni vista. Solo hay "credenciales temporales" propuestos en Fase 2, no implementados |
| Borrador de cambios propuestos (valor anterior / nuevo) | No existe | `apps/autogestion/infrastructure/models/autogestion_models.py:1-99`: solo `TipoPregunta`, `PreguntasEncuestas`, `OpcionesPregunta`, `RespuestasEncuesta`, todas `managed=False` |
| Carga obligatoria de soportes (títulos, actas, constancias) | Parcial | Patrón de subida existe (`apps/familiares/presentation/views/familiares_views.py:95-122`, `FamilyDocumentModel.file`, `familiares/infrastructure/models/familiar_models.py:52-64`) pero NO valida tipo ni tamaño (solo `archivo.content_type` del cliente) y requiere `familiares.editar`. Formación académica no tiene columna de archivo (`personal/infrastructure/models/expediente_models.py:270-303`) |
| Visor comparativo campo por campo y aprobación parcial | No existe | Sin código backend ni frontend |
| Aplicar cambios aprobados a la ficha | No existe; destino identificado | `EmployeeModel` (`apps/personal/infrastructure/models/personal_models.py:7-48`, `managed=False`, tabla `Employee`; `correo` unique l.40, teléfonos l.41-42, `profile` l.13); `DatosViviendaModel` (`expediente_models.py:77-105`); `FormacionAcademicaModel` (l.270-303, FK a catálogos); `EmployeefamilyModel` (`familiares_models.py:7-43`, tabla `RAC_employeefamily`); todos `managed=False`. Las escrituras deben pasar por los puertos/repos existentes (`RepoPersonal.actualizar_empleado`, `RepoFamiliares`) para respetar Onion |
| Contraste con la tabla de secciones autogestionables | Definido | Autogestionable: contacto, vivienda/dirección, formación (soporte obligatorio), grupo familiar (soporte obligatorio), foto de carnet (alerta de reemisión). NO autogestionable: identidad, cargo/oficina/estatus. Ver `propuesta.txt` (sección 04, diagrama de autogestión) |
| Frontend módulo autogestión | Parcial | `src/modules/autogestion/` tiene dtos de censo/expediente, `repo-autogestion-api.ts`, `autogestion-page.tsx`, `mi-expediente-view.tsx`, sidebar `app-sidebar-autogestion.tsx`; sin dominio de solicitudes ni páginas de solicitud/ventana/revisión |

### 1.2 Prioridad 2 — Notificaciones y correo

| Requerido | Estado | Evidencia |
|---|---|---|
| Modelo de notificaciones, bandeja, campana | No existe | `grep -i notificacion` en `src/` sin resultados; sin app backend |
| Correo transaccional | Parcial | Solo recuperación de contraseña: `apps/identidad/infrastructure/emails/recuperacion_email.py:6,101` (`EmailMultiAlternatives`, síncrono). SMTP configurado en `GATH/settings.py:199-208` (`mail.conatel.gob.ve:587`, TLS, `EMAIL_HOST_PASSWORD` vacío por defecto) |
| Celery real | No existe | `GATH/celery.py` no existe (`ls GATH`: asgi, settings, urls, wsgi). `core/infrastructure/tasks/celery_queue.py:21-43` hace `import GATH.celery`, cae en `ImportError` y devuelve `simulated-task-...` sin ejecutar nada (**simula éxito**: riesgo de falsa confianza, mismo patrón corregido en `SeaweedFSStorage` por CRIT-01). `celery==5.3.4` está en `requirements.txt`; no hay `shared_task` en el repo; `compose.yml` no tiene worker ni beat |
| Broker | Existe | RabbitMQ 3.13 vhost `gath` en `compose.yml:117-130`; Redis 7.4 en `compose.yml:133-148`; `REDIS_URL` usado como caché en `settings.py:211-231` |
| Auditoría | Existe (reutilizable) | `core/infrastructure/models/auditoria.py` (`AuditoriaLog`, append-only) + `core/presentation/audit.py:registrar_auditoria`. No incluye hash de encadenamiento, user-agent ni datos de dispositivo que pide la HU (RN-10) |

### 1.3 Prioridad 3 — Pasivos en Autogestión

| Requerido | Estado | Evidencia |
|---|---|---|
| Modelo de pasivo | Existe | `apps/pasivos/infrastructure/models/pasivo_models.py:7-93`: `EmployeeEgresado` y `CargoEgresado` (`managed=False`). El pase (`procesar_egreso_a_pasivo`, `repo_pasivos_orm.py:108-220`) mantiene el `Employee`, cierra antecedente/contrato, libera los cargos activos a VACANTE si `liberar_activos`, y crea una nueva `AsigTrabajo` con `Tipo_personal = PASIVO` en la Oficina de Gestión Humana |
| Distinguir jubilado/pensionado, sobreviviente/invalidez, especial/ordinaria (campos del acta física) | Parcial | Solo existe `motivo_egreso` (`TipoMovimientoModel`); el motivo es texto libre de catálogo. `procesar_egreso.py:1-32` documenta que `ejecutar_creacion_sobrevivientes` está fuera de alcance. Falta un catálogo claro de tipo de pensión/jubilación (ver 2.2) |
| Pasivo conserva cuenta y puede iniciar sesión | Parcial / por verificar en BD | `CuentaModel` es 1:1 a `Employee` por cédula (`identidad/infrastructure/models/cuenta_models.py:61-67`); el pase a pasivo no toca la cuenta; el login (`auth_views.py:109`) solo revisa `cuenta.is_active`. Si el pasivo tiene cuenta con rol AUTOGESTION, entra. `proxy.ts:17-21` lo envía a `/autogestion`. **Verificar** con SQL: pasivos con cuenta, con correo y con `is_active` |
| Rol/permisos para el pasivo | No existe | El rol 3 AUTOGESTION (`seed_permisos.py:188-194`) solo da `ver_propio`, `actualizar_propio`, censo; no hay código de fe de vida. Además un pasivo no debe ver "Mi carnet" activo ni el censo laboral |
| Datos de contacto del pasivo | Parcial | `Employee.correo` (unique) y teléfonos existen; cobertura real de correo en pasivos desconocida (pregunta abierta 4.3) |
| Foto del pasivo | Parcial | `Employee.profile` (clave S3); se usa para el carnet; la selfie con cédula debe ser un artefacto distinto y de acceso restringido (ver 2.6) |
| Captura de foto en el navegador (cámara o subida) | No existe | Sin `getUserMedia`, sin `capture=`, sin input de subida de la foto, sin `manifest`/`serviceWorker` en `src/` ni `public/` (solo `src/proxy.ts` coincide por "manifest" en el matcher) |
| Contexto seguro (HTTPS) | No existe | `compose.yml:11` `FRONTEND_URL=http://localhost:3001`, `:42` `NEXTAUTH_URL=http://localhost:3001`, `:25` `8001:8000`, `:44` `3001:3000`. No hay servicio nginx en `compose.yml`. En `localhost` el navegador permite cámara, por lo que el desarrollo y las pruebas locales no necesitan certificado. Desde la red institucional (IP o dominio por HTTP) la cámara no está disponible: ahí aplica la vía de subida de archivo. El HTTPS de producción es requisito de despliegue de Infraestructura, no bloqueante del desarrollo |
| PDF de constancia | Parcial | Motor ReportLab reutilizable: `core/infrastructure/pdf/{report_pdf,pdf_components,pdf_styles}.py`; cintillo configurable (HU 0009, `apps/configuracion`); ejemplo de PDF por entidad: `apps/pasivos/infrastructure/pdf_pasivo.py`. Falta plantilla de constancia con número, hash y QR (RN-11); `qrcode` ya está en `requirements.txt` |
| Almacenamiento | Existe (con brechas) | `core/infrastructure/storage/seaweedfs_storage.py:subir/descargar/url_firmada` (boto3, falla cerrado a 503, URL prefirmada 300 s). Brechas: sin validación de MIME real, tamaño máximo, extensión ni antivirus; claves construidas con `archivo.name` del cliente (`familiares_views.py:120`, `carnetizacion_views.py:221`): riesgo de colisión y de nombres hostiles. El prefijo `familiares/` está denegado en `media_views.py:36` |

### 1.4 Prioridad 4 — Regla de aprobación

| Requerido | Estado | Evidencia |
|---|---|---|
| Distinguir Analista y Administradora de Bienestar Social | No existe | El rol 5 "BIENSTAR SOCIAL" (1 cuenta) agrupa todo (`seed_permisos.py:210-228`); no hay jerarquía. Roles en BD: ADMINISTRADOR (7), ANALISTA (6), AUTOGESTION (867), PRESUPUESTO (1), "BIENSTAR SOCIAL" (1), RECEPCIONISTA |
| Doble check de la HU | No existe | La HU (RN-03, RN-07, RN-22) exige estados `PENDIENTE_CHECK → PENDIENTE_SEGUNDO_CHECK → VALIDADA`; nada implementado |

### 1.5 Prioridad 5 — Usuarios por roles y permisos (no por departamento)

| Hallazgo | Evidencia |
|---|---|
| Backend: el modelo de cuenta aún lleva `departamento` | `identidad/infrastructure/models/cuenta_models.py:68-74` (FK a `USER_departaments`, `managed=False`); 83 apariciones de "departamento" en `apps/identidad` y `apps/carnetizacion` (registro/edición de usuario, serializers, mapper, entidad `Cuenta`, `listar_departamentos`, vistas y rutas `identidad/departamentos/`). Carnetización usa "departamento" con otro significado (organizativo), no confundir |
| Backend: autorización ya es por permisos | `core/presentation/permissions.py:122-171` (`HasPermission` → resolutor IAM). El único uso de `nombre_rol` fuera del catálogo es como claim/auditoría: `auth_views.py:137`, `emitir_tokens_sesion.py:34` (`refresh['rol']`), `repo_cuenta_auth_orm.py:26`. Es decir: **~0 decisiones de acceso por `nombre_rol` en backend**; la matriz está en `identidad_rol_permiso` (`permiso_model.py:28-56`, `rol_id` entero) y `identidad_usuario_permiso` (excepciones allow/deny + `version`, `usuario_permiso_model.py:11-36`) |
| Backend: `permisos_version` incompleto | Solo aparece en `restablecer_password.py:52-53` (`cuenta.permisos_version`) y sus tests; **`CuentaModel` no tiene ese campo** (`cuenta_models.py:55-96`) y no hay claim `permisos_version` en el JWT (`grep` solo da esas 3 líneas): la invalidación de sesión por cambio de permisos descrita en la skill de JWT **no está operativa**. Verificar si `restablecer_password` falla en real (AttributeError) o solo pasa con mocks (`tests/unit/identidad/test_recuperar_password.py:115-134`) |
| Frontend: decisiones por `nombre_rol` | 39 apariciones en `src/` (sin tests). Sidebars con `roleAccept: [...]` por rol: `modules/personal/ui/components/app-sidebar-personal.tsx` (~25 entradas, ej. l.81, l.270), `modules/identidad/ui/components/app-sidebar-security.tsx` (l.61-137), `modules/carnetizacion/ui/components/app-sidebar-carnetizacion.tsx` (l.59-113), `modules/autogestion/ui/components/app-sidebar-autogestion.tsx:37-38`; literales sueltos en `modules/familiares/ui/familiares-page.tsx:42` (RECEPCIONISTA), `modules/movimientos/ui/movimientos-page.tsx:145` (ADMINISTRADOR), `lib/zod.ts:39` (enum ANALISTA/ADMINISTRADOR), `(protected)/dashboard/page.tsx:130` |
| Frontend: departamento decide acceso | `(protected)/dashboard/page.tsx:127-158` filtra tarjetas con `d.id === session.user.department.nombre_departamento` y muestra "Tienes acceso a este departamento."; `proxy.ts:17-21` usa `role.nombre_rol === "AUTOGESTION"` **o** `department.nombre_departamento === "AUTOGESTION"`; `auth.ts:18,42` y `auth.config.ts:34,50,60,120-131` resuelven el departamento con una llamada extra a `identidad/departamentos/` al iniciar sesión. 41 archivos de `src/` mencionan departamento/department (muchos de organigrama o carnet, no de acceso); 14 usos de `nombre_departamento`/`.department` |
| Frontend: `proxy.ts` usa `tienePermiso(permisos, "autogestion.censo")` | `proxy.ts:19`: código que **no existe** en el catálogo (el real es `autogestion.censo_ver_propio` etc.). Funciona solo por el comodín/prefijo del evaluador o cae al rol; hay que revisarlo en la migración |
| Roles con nombre inconsistente | "BIENSTAR SOCIAL" (id 5 en el seed; nombre mal escrito en BD según el usuario, p. ej. "BIENSTAR"): el frontend lo referencia con el texto correcto (`app-sidebar-personal.tsx:81,111,204,270`), por lo que el rol realmente cargado en BD podría **no coincidir** con ese literal y quedar sin acceso. Confirmar el valor exacto en `USER_rol` |

---

## 2. Decisiones de diseño

### 2.1 Máquina de estados: Solicitud de actualización (autogestión del activo)

```
SOLICITADA ──(Bienestar habilita ventana: secciones + plazo)──> HABILITADA
SOLICITADA ──(Bienestar rechaza con motivo)──────────────────> RECHAZADA
HABILITADA ──(trabajador guarda borrador, repetible)─────────> HABILITADA
HABILITADA ──(trabajador envía; valida soportes)─────────────> ENVIADA
HABILITADA ──(vence plazo; tarea programada)─────────────────> EXPIRADA
ENVIADA    ──(revisión campo por campo)─────────────────────> APROBADA | APROBADA_PARCIAL | RECHAZADA
EXPIRADA   ──(trabajador solicita de nuevo)──────────────────> nueva SOLICITADA
```

Reglas: una solicitud abierta por trabajador y sección (restricción única parcial); la ficha activa **solo se modifica en la transición a APROBADA/APROBADA_PARCIAL**, dentro de `transaction.atomic`, escribiendo únicamente los campos aprobados mediante los puertos de `personal`/`familiares`; cada decisión por campo lleva `motivo` obligatorio si se rechaza; rechazo total exige motivo; el trabajador no puede editar fuera de las secciones habilitadas (validación en servidor); `bloqueo optimista` por `version`. Campos no autogestionables (identidad, cargo, oficina, estatus) se rechazan en el serializer. Cambio de correo: validar formato y unicidad contra `Employee.correo` (unique). Foto de carnet aprobada dispara notificación/alerta de reemisión a Carnetización.

### 2.2 Máquina de estados: Fe de vida, adaptada a la regla del usuario

Estados: `BORRADOR → PENDIENTE_REVISION → PENDIENTE_SEGUNDO_CHECK → VALIDADA`; `RECHAZADA`; `REPETICION_SOLICITADA`; `ARCHIVADA`; `EXPIRADA` (no atendida / vencida, opcional).

```
BORRADOR ──envío──> PENDIENTE_REVISION
# Flujo normal: doble check, orden indistinto (RN-03, RN-22)
PENDIENTE_REVISION ──primer check (Analista o Administradora, quien llegue primero)──> PENDIENTE_SEGUNDO_CHECK
PENDIENTE_SEGUNDO_CHECK ──segundo check (el otro rol; el mismo actor no cuenta dos veces)──> VALIDADA
# Excepción: aprobación directa de la Administradora (justificación obligatoria)
PENDIENTE_REVISION | PENDIENTE_SEGUNDO_CHECK ──Administradora: aprobación directa (fe_de_vida.aprobar_directo)──> VALIDADA
# Rechazo / repetición: cualquiera de las dos, con motivo obligatorio
PENDIENTE_REVISION | PENDIENTE_SEGUNDO_CHECK ──Analista o Administradora: rechaza (motivo)──> RECHAZADA
PENDIENTE_REVISION | PENDIENTE_SEGUNDO_CHECK ──Analista o Administradora: solicita repetición (motivo)──> REPETICION_SOLICITADA
REPETICION_SOLICITADA ──pasivo reenvía nueva toma──> PENDIENTE_REVISION  (nueva versión; los checks previos quedan en historial y no se reutilizan)
VALIDADA ──(genera PDF, notifica y envía correo)──> VALIDADA con constancia emitida; luego ARCHIVADA por política
```

Regla de decisión (aclarada por el usuario):
1. **Flujo normal**: se requieren **ambas** aprobaciones, la de la Analista de Bienestar Social (`fe_de_vida.check_analista`) y la de la Administradora (Jefa) de Bienestar Social (`fe_de_vida.check_administradora`), en cualquier orden. El primer check lleva el acta a `PENDIENTE_SEGUNDO_CHECK`; el segundo, a `VALIDADA`, lo que dispara notificación y correo con el PDF.
2. **Excepción, aprobación directa**: cuando sea necesario, la Administradora puede aprobar sola, sin la revisión de la Analista. Exige permiso `fe_de_vida.aprobar_directo` (solo rol `ADMIN_BIENESTAR`), **justificación obligatoria**, evento de auditoría propio `APROBACION_DIRECTA_ADMINISTRADORA` (con motivo) y que el acta y el historial muestren "Aprobada por vía directa de la Administradora".
3. La Analista **nunca** valida sola: su check deja el acta en `PENDIENTE_SEGUNDO_CHECK`. Rechazar o solicitar repetición lo puede hacer cualquiera de las dos, siempre con justificación.

**Divergencia con la HU (a confirmar en la ADR):** la regla coincide con la HU (doble check, orden indistinto, RN-03, RN-22, `PENDIENTE_CHECK → PENDIENTE_SEGUNDO_CHECK → VALIDADA`, RN-07). La **única divergencia de fondo** es la excepción de aprobación directa de la Administradora; además hay ajustes menores:

| Aspecto | HU (HU-0001/0002/0009) | Plan |
|---|---|---|
| Doble check | Obligatorio, ambos, orden indistinto (RN-03, RN-22, RN-07) | Igual: flujo normal con ambos checks en orden indistinto |
| **Aprobación directa** | No existe | **Divergencia**: la Administradora puede aprobar sola con justificación, permiso propio y auditoría `APROBACION_DIRECTA_ADMINISTRADORA` |
| Escalamiento | La analista puede escalar al Jefe de División (RN-15) | Se expresa como su check (queda en `PENDIENTE_SEGUNDO_CHECK`) o pedir decisión a la Administradora; la aprobación directa cubre el caso urgente |
| Tercera salida | No hay "solicitar repetición" (solo APROBADA/RECHAZADA, RN-07) | Se agrega `REPETICION_SOLICITADA` con motivo (ampliación) |
| Título del aprobador final | "Jefe de División de Bienestar Social" | "Administradora (Jefa) de Bienestar Social" |

Propuesta: documentar en una ADR corta (`DECISIONES_FE_DE_VIDA.md`, a crear en la etapa C) que RN-03/RN-22/RN-07 se **mantienen** y se **complementan** con la excepción de aprobación directa (permiso, justificación, auditoría y marca visible en el acta); conservar de la HU lo demás (RN-01 comparación manual, RN-02 calidad mínima, RN-15 justificación obligatoria, RN-05 atomicidad, RN-06 idempotencia, RN-10/RN-12 auditoría, RN-11 trazabilidad documental, RN-13 envío automático, RN-19/20 plantillas versionadas y campos del formato físico, RN-21 retención sin plazo fijo, RN-23 verificación interna).

**¿Aplica también a las solicitudes de autogestión?** Propuesta: **sí, el mismo esquema** para mantener un solo modelo mental de Bienestar Social. Flujo normal: **doble aprobación** por campo/solicitud (Analista y Administradora, orden indistinto; el primer check deja la solicitud en `PENDIENTE_SEGUNDO_CHECK` y el segundo la aprueba y aplica los cambios). Excepción: la Administradora puede aprobar directamente, con justificación obligatoria, permiso `bienestar.aprobar_directo`, evento de auditoría `APROBACION_DIRECTA_ADMINISTRADORA` y marca visible en el historial. La Analista nunca aprueba sola. Rechazar o pedir corrección: cualquiera de las dos, con motivo. Se implementa con un parámetro por sección (`requiere_doble_aprobacion: bool`, por defecto `true`) en el catálogo de secciones; solo si el usuario decide relajarlo en secciones de bajo riesgo (contacto, vivienda; ~867 cuentas AUTOGESTION) se pone en `false`, sin cambiar código. Pendiente de confirmar (pregunta 4.1.6).

### 2.3 Modelo de datos nuevo (tablas `managed=True`; no se tocan legadas salvo al aplicar cambios aprobados)

Apps nuevas en `apps/`: `notificaciones` (transversal), `fe_de_vida`; `autogestion` se extiende con modelos nuevos (los 4 legados de censo no se tocan). Todos extienden `BaseModel` (uuid7, auditoría de fechas) de `core/infrastructure/models/base.py`.

Autogestión (en `apps/autogestion/infrastructure/models/`):

- `SolicitudActualizacionModel`: `id`, `cedula` (CharField, no FK dura a legada, indexado, coherente con el patrón `rol_id` entero de `RolPermisoModel`), `estado`, `secciones_solicitadas` (JSON), `motivo`, `ventana_inicio`, `ventana_fin`, `habilitada_por`, `decidida_por`, `motivo_decision`, `version`, `fecha_envio`, `fecha_decision`.
- `CambioPropuestoModel`: `solicitud` FK, `seccion` (contacto|vivienda|formacion|familiar|foto), `entidad_destino`, `entidad_id`, `campo`, `valor_anterior` (JSON), `valor_propuesto` (JSON), `decision` (PENDIENTE|APROBADO|RECHAZADO), `motivo_decision`, `decidido_por`, `fecha_decision`.
- `SoporteDocumentalModel`: `solicitud`/`cambio` FK, `tipo` (TITULO|ACTA_NACIMIENTO|CONSTANCIA|OTRO), `clave_s3`, `mime_real`, `tamano_bytes`, `sha256`, `nombre_original`. Una sección con soporte obligatorio no se puede enviar sin al menos un soporte.
- `SeccionAutogestionableModel` (catálogo configurable): `codigo`, `nombre`, `requiere_soporte`, `requiere_doble_aprobacion`, `activa`. Semilla con la tabla de la propuesta.

Fe de vida (en `apps/fe_de_vida/infrastructure/models/`):

- `TipoPensionJubilacionModel` (catálogo): `categoria` (PENSION_SOBREVIVIENTE, PENSION_INVALIDEZ, JUBILACION_ESPECIAL, JUBILACION_ORDINARIA), según los dos bloques de la planilla física. Resolver desde `motivo_egreso` cuando sea posible; si no, el pasivo lo declara y Bienestar lo corrige.
- `ActaFeDeVidaModel`: `id`, `numero` correlativo único (`FV-AAAA-NNNNNN`), `cedula`, `tipo_pension`, `tipo_jubilacion`, `datos_beneficiario` (JSON snapshot de la planilla: apellidos y nombres, cédula, fecha de nacimiento, teléfono de habitación, celular, correo, persona de contacto + celular, dirección, área de adscripción, cargo), `tiene_hijos`, `estado`, `idempotency_key` único, `version`, `evidencia_hash`, `origen_dato` (SISTEMA|CONFIRMADO_MANUAL, RN-14), `plantilla_version`, `fecha_solicitud`, `fecha_validacion`, `vence_el` (si se define periodicidad).
- `HijoActaModel`: `acta` FK, nombres, cédula, teléfonos, correo (tabla de la planilla).
- `EvidenciaFeDeVidaModel`: `acta` FK, `clave_s3` (objeto privado), `mime`, `sha256`, `ancho`, `alto`, `origen_evidencia` (`CAMARA` | `ARCHIVO`, visible para Bienestar al revisar y registrado en auditoría), `metadatos_captura` (JSON: user-agent, método `getUserMedia|capture|file`, resolución, resultados de validación de calidad), `intento` (n).
- `DecisionActaModel`: `acta` FK, `actor_id`, `actor_cedula`, `rol`, `tipo` (CHECK_ANALISTA|CHECK_ADMINISTRADORA|APROBACION_DIRECTA|RECHAZA|SOLICITA_REPETICION), `motivo` (obligatorio en rechazo, repetición y aprobación directa; opcional en los checks normales), `fecha`; inmutable.
- `ConstanciaFeDeVidaModel`: `acta` 1:1, `numero`, `codigo_verificacion`, `sha256_pdf`, `clave_s3_pdf`, `plantilla_version`, `fecha_emision`, `enviada_a`, `estado_envio`.
- `PlantillaActaModel`: versionada (RN-19) con texto oficial de la constancia y campos de la planilla (RN-20). Semilla inicial con el texto observado en `constancia de fe de vida.jpeg`: "Se hace constar que el día [fecha] compareció el/la ciudadano(a) [nombre], titular de la C.I. [cédula], ante la Oficina de Gestión Humana de CONATEL para dejar constancia de su fe de vida", con nombre, cédula y firma del funcionario que certifica. **Texto oficial exacto a confirmar** (pregunta 4.3).

Transversal (en `apps/notificaciones/`):

- `NotificacionModel`: `id`, `destinatario_cedula` o `destinatario_rol_permiso` (para difusión por permiso: p. ej. todos con `bienestar.revisar_actualizacion`), `tipo`, `titulo`, `cuerpo`, `entidad_tipo`, `entidad_id`, `url_destino`, `leida_en`, `creada_en`. Índices `(destinatario, leida_en)`.
- `EventoOutboxModel`: `id`, `tipo`, `canal` (EMAIL), `destinatario`, `payload` (JSON, con referencia al PDF por clave S3 y no el binario), `idempotency_key` único, `estado` (PENDIENTE|ENVIADO|FALLIDO), `intentos`, `proximo_intento`, `ultimo_error`. Se escribe **dentro de la misma transacción** que la decisión (patrón outbox de HU-0005/HU-0012).
- `PreferenciaNotificacionModel` (opcional, etapa E): canales por usuario.

Auditoría: reutilizar `AuditoriaLog`. Extenderla (migración) con `user_agent`, `dispositivo` y `hash_encadenado` solo en la etapa E para cumplir RN-10/RN-09; hasta entonces registrar los eventos de la HU (`COMPARECENCIA_INICIADA`, `EVIDENCIA_CAPTURADA`, `EVIDENCIA_RECHAZADA_POR_CALIDAD`, etc.) como `accion` con `estado_nuevo` JSON.

### 2.4 Roles y matriz de permisos nueva

Principio: el acceso se decide **solo por permisos** (`HasPermission` en backend; `tienePermiso` en frontend/proxy). El rol es un conjunto nombrado de permisos, no una puerta.

Roles (tabla `USER_rol`, `managed=False`; se insertan filas con migración de datos/SQL controlado o con el comando de seed existente `RolEspejo`):

| Rol | Acción | Notas |
|---|---|---|
| `BIENESTAR_SOCIAL` (id 5, renombrar desde "BIENSTAR SOCIAL") | Corregir nombre | Pasa a ser el rol base de personal de Bienestar (lectura, censo, reportes) |
| `ANALISTA_BIENESTAR` | Crear | Hereda lo del rol 5 + `bienestar.*` de revisión, `fe_de_vida.revisar`, `fe_de_vida.check_analista`, `bienestar.check_analista` (nunca aprobación directa) |
| `ADMIN_BIENESTAR` | Crear | Todo lo anterior + `fe_de_vida.check_administradora`, `fe_de_vida.aprobar_directo`, `bienestar.check_administradora`, `bienestar.aprobar_directo`, `bienestar.habilitar_ventana`, parametrización |
| `PASIVO` | Crear (recomendado) | Mejor que reutilizar `AUTOGESTION`: permisos distintos (sin carnet, sin censo laboral), invalidación/menú independientes y métricas separables |
| `AUTOGESTION` | Mantener | Activos; sumar `autogestion.solicitar_actualizacion`, etc. |

Alternativa mínima: reutilizar `AUTOGESTION` y conceder permisos por usuario (`identidad_usuario_permiso`). Se desaconseja: 867 cuentas y pasivos mezclados dificultan el control. El paso de activo a pasivo debe **cambiar automáticamente** el rol de AUTOGESTION a PASIVO (hook del evento `cargo_movimiento_ejecutado` con `tipo_movimiento='EGRESO'`, ya emitido en `repo_pasivos_orm.py:110-118`, consumido por un suscriptor en `identidad`) y subir la versión de permisos.

Nuevos códigos (se agregan a `PERMISOS_CATALOGO` de `seed_permisos.py`, convención `modulo.accion`):

| Código | Rol(es) |
|---|---|
| `autogestion.ver_propio`, `autogestion.actualizar_propio` (existentes; se usan por fin en `MiExpedienteView`) | AUTOGESTION |
| `autogestion.solicitar_actualizacion` | AUTOGESTION |
| `autogestion.editar_borrador` | AUTOGESTION (solo con ventana HABILITADA) |
| `autogestion.subir_soporte` | AUTOGESTION, PASIVO (soportes propios) |
| `bienestar.ver_solicitudes` | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `bienestar.habilitar_ventana` | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `bienestar.revisar_actualizacion` | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `bienestar.check_analista` (check como Analista; aplica a secciones con `requiere_doble_aprobacion`) | ANALISTA_BIENESTAR |
| `bienestar.check_administradora` (check como Administradora) | ADMIN_BIENESTAR |
| `bienestar.aprobar_directo` (aprobación directa, justificación obligatoria y auditoría) | ADMIN_BIENESTAR |
| `bienestar.configurar_secciones` | ADMIN_BIENESTAR, ADMINISTRADOR |
| `fe_de_vida.solicitar` | PASIVO |
| `fe_de_vida.ver_propia` | PASIVO |
| `fe_de_vida.revisar` (ver evidencia, rechazar, pedir repetición; no aprueba por sí solo) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `fe_de_vida.check_analista` (check de la Analista; deja el acta en `PENDIENTE_SEGUNDO_CHECK`, o la valida si ya existe el check de la Administradora) | ANALISTA_BIENESTAR |
| `fe_de_vida.check_administradora` (check de la Administradora, orden indistinto) | ADMIN_BIENESTAR |
| `fe_de_vida.aprobar_directo` (excepción: la Administradora valida sola; justificación obligatoria, auditoría `APROBACION_DIRECTA_ADMINISTRADORA`) | ADMIN_BIENESTAR |
| `fe_de_vida.ver_evidencia` (URL prefirmada corta de la selfie) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR, auditor |
| `fe_de_vida.verificar_constancia` (RN-23, interna) | Bienestar, RRHH |
| `fe_de_vida.ver_panel` (HU-0010) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `fe_de_vida.configurar_plantilla` (HU-0013) | ADMIN_BIENESTAR, ADMINISTRADOR |
| `notificaciones.ver_propias` | todos los autenticados |
| `notificaciones.administrar` (reintentos, fallidas) | ADMINISTRADOR |
| `auditoria.ver_logs` (existente) | ya cubre HU-0003; se agrega `auditoria.exportar` |

ADMINISTRADOR conserva todo (el seed ya le asigna el catálogo completo, `seed_permisos.py:128-129`).

### 2.5 Notificaciones y correo

- **Bandeja/campana**: endpoints `GET /api/v1/notificaciones/` (paginado, `?no_leidas=1`), `GET /conteo/`, `POST /{id}/leer/`, `POST /leer-todas/`. Frontend: campana en el header con contador y panel; **polling cada 30–60 s** (`GET /conteo/` ligero, con `visibilitychange` para pausar en pestaña oculta). Se descarta SSE/WebSocket en esta fase (requiere ASGI/canal y afinar nginx; ~870+ usuarios hacen polling barato con Redis). Revisar en etapa E si hace falta SSE.
- **Difusión a Bienestar**: al crearse una solicitud se crea una fila por usuario con el permiso `bienestar.revisar_actualizacion` / `fe_de_vida.revisar` (consulta resuelta por `identidad`), no por nombre de rol.
- **Correo**: outbox + Celery. Task `notificaciones.enviar_correo_outbox` con `acks_late`, reintentos con backoff exponencial, `max_retries=5`, estado FALLIDO y alerta al administrador (HU-0005). Plantillas HTML institucionales. Fe de vida validada: correo al pasivo con el PDF adjunto (se lee de S3 en el worker; **no** se serializa el PDF en el mensaje de cola). Si el pasivo no tiene correo: notificación interna + marca "sin correo" en el panel de Bienestar (pregunta 4.3).
- **Idempotencia**: `idempotency_key = f"{tipo}:{entidad_id}:{destinatario}:{canal}"`.
- No se envían datos sensibles ni imágenes por correo; la selfie jamás se adjunta.

### 2.6 Fe de vida: foto con dos vías equivalentes (decisión del usuario, 2026-10-29)

La foto (selfie sosteniendo la cédula) tiene **dos vías equivalentes**: (a) **tomarla con la cámara en vivo** (`getUserMedia`, con `<input capture="user">` como alternativa en móviles) o (b) **subir una foto ya tomada** (input file, JPG/PNG, con las mismas validaciones de tipo, tamaño y calidad mínima en servidor). La falta de cámara, el permiso denegado, el contexto no seguro o cualquier error de cámara **nunca bloquea el flujo**: la UI siempre ofrece "Subir una foto" y la propone automáticamente si la cámara no está disponible. Se registra el origen de la evidencia (`CAMARA` | `ARCHIVO`) en el modelo y en la auditoría para que Bienestar lo vea al revisar. Diseño:

1. **Detección y permiso**: `navigator.mediaDevices?.getUserMedia` disponible y `window.isSecureContext === true`. Si falta cualquiera, mostrar el motivo (sin HTTPS, sin cámara, permiso denegado) y proponer automáticamente la **vía de subida** ("Subir una foto", `<input type="file" accept="image/jpeg,image/png">`), que además está siempre visible como alternativa. `<input capture="user">` sirve como alternativa en móviles para abrir la cámara nativa. Ambas vías son válidas para aprobar; el backend registra `origen_evidencia` (`CAMARA` | `ARCHIVO`) y el método en `metadatos_captura` para que Bienestar lo vea. (Pregunta 4.3.7 resuelta por el usuario: se permite la subida de archivo.)
2. **Flujo UI**: pantalla "Cámara" con `<video playsinline muted autoplay>`, `facingMode: 'user'` (ideal 1280x720, con `enumerateDevices` y selector si hay varias cámaras), guía superpuesta (óvalo para rostro y rectángulo para el anverso de la cédula), botón "Tomar foto" que dibuja el frame en `<canvas>` y exporta JPEG (calidad 0.85, máx. 1600 px de lado), **vista previa**, "Repetir toma" (reabre el stream) y "Usar esta foto". Detener todos los tracks al salir (`track.stop()`) y al cambiar de pestaña.
3. **Validación básica en cliente antes de enviar** (sin OCR, sin biometría, RN-02): resolución mínima, brillo medio y varianza por canvas (poco iluminada/borrosa), `FaceDetector` experimental solo si existe (se trata como ayuda, no como bloqueo), y confirmación explícita del usuario "se ve mi rostro y el frente de mi cédula legible". Informar con mensajes claros; nunca bloquear sin explicación.
4. **Validación en servidor (autoridad, idéntica para ambas vías)**: tamaño máximo (p. ej. 5 MB), MIME **real** por firma de bytes con Pillow (JPEG/PNG), re-codificación con Pillow para descartar polyglots y borrar EXIF/GPS, dimensiones mínimas (calidad mínima), hash SHA-256, `idempotency_key` por intento; si el almacenamiento falla se revierte toda la transacción (RN-05, `AlmacenamientoNoDisponible` ya da 503). Rechazos por calidad generan `EVIDENCIA_RECHAZADA_POR_CALIDAD` en auditoría.
5. **Almacenamiento y privacidad**: bucket/prefijo privado `fe_de_vida/<acta>/<intento>.jpg`; acceso solo con URL prefirmada de 60–120 s emitida a quien tenga `fe_de_vida.ver_evidencia` y con evento de auditoría de acceso (RN-12); nunca por `media_views`; sin imagen en logs (RN-04, solo hash y clave). Retención como documento de RRHH sin purga automática (RN-21).
6. **Subida**: `multipart/form-data` (o base64 solo si fuese inevitable) a `POST /api/v1/fe-de-vida/solicitudes/`; formulario y foto en una sola transacción.

**Requisito de despliegue a cargo de Infraestructura (no bloquea el desarrollo)**: `getUserMedia` y la instalación PWA exigen contexto seguro (HTTPS o `localhost`). `http://localhost:3001` es contexto seguro, así que todas las pruebas se hacen en local sin certificado. Para producción, el TLS/dominio/nginx lo gestiona el equipo de Infraestructura cuando se despliegue; si aún no existiera, la cámara no estaría disponible en los equipos de los pasivos pero la vía de subida de archivo seguiría permitiendo completar el trámite. Opcional en desarrollo: un teléfono accediendo por IP/HTTP no es contexto seguro; allí aplica la vía de subida. **Checklist de despliegue** (a cargo de Infraestructura):

- Servicio `nginx` en `compose.yml` con TLS (certificado institucional o emitido por la CA de CONATEL / Let's Encrypt si hay dominio público), puertos 443 (y 80 solo para redirección), proxy a `nextjs:3000` y `django:8000` bajo un mismo origen (`/api/` → Django, resto → Next), cabeceras `Strict-Transport-Security`, `X-Forwarded-Proto`, `client_max_body_size` acorde a los soportes y a la selfie (≥10 MB), timeouts.
- Actualizar `FRONTEND_URL`, `NEXTAUTH_URL`/`AUTH_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, cookies `Secure` y `SECURE_PROXY_SSL_HEADER`; dejar de publicar 3001/8001 al host.
- Variables `DJANGO_COOKIE_SECURE`, `AUTH_COOKIE_SECURE`, `NEXTAUTH_URL` con https, hosts/CORS y CSP/HSTS coherentes con el nuevo origen.
- Cabecera `Permissions-Policy: camera=(self)` (sin esto algunos navegadores restringen la cámara).
- Skill de apoyo: `despliegue-docker-django-nextjs` (nginx, usuario no root, sin puertos al host para broker/almacén).
- La instalación como PWA (manifest, service worker, íconos, estrategia de caché, offline) la define `PLAN_REDISENO_AUTOGESTION_PWA_2026-10-29.md`; este plan solo depende (en producción) de que exista el HTTPS y de que el service worker **no cachee** `/api/` ni las vistas de evidencia.

### 2.7 Celery real con RabbitMQ

- Crear `BACKEND/GATH/celery.py` (app, `autodiscover_tasks`, `app.config_from_object('django.conf:settings', namespace='CELERY')`) e importarla en `GATH/__init__.py`.
- Settings: `CELERY_BROKER_URL` (RabbitMQ, vhost `gath`), `CELERY_RESULT_BACKEND` (Redis, opcional), `CELERY_TASK_ACKS_LATE=True`, `CELERY_TASK_TIME_LIMIT`, `CELERY_TASK_DEFAULT_QUEUE='gath'`, `CELERY_BEAT_SCHEDULE` (vencimiento de ventanas, reintentos de outbox, recordatorios).
- `compose.yml`: servicios `celery_worker` y `celery_beat` (misma imagen de `django.dockerfile`, comandos distintos, healthcheck `celery inspect ping`), con las mismas variables que `django`. `docker-entrypoint.sh` ya existe sin modificar.
- Corregir `CeleryTaskQueue.encolar`: **fallar cerrado** (lanzar `TareaNoDisponible`/503) cuando no hay app Celery y `DEBUG` es falso, en vez de devolver un id simulado; la simulación solo en tests (`CELERY_TASK_ALWAYS_EAGER`). Respeta el puerto `TaskQueue` de `core/domain/ports.py`.
- Tareas iniciales: `enviar_correo_outbox`, `generar_pdf_constancia` (si se hace asíncrono; es rápido, se puede dejar síncrono en la acción de aprobar y solo el correo asíncrono), `expirar_ventanas`, `recordatorios_fe_de_vida`.

### 2.8 Migración de "departamento" a roles y permisos

1. **Congelar el uso**: el dashboard y `proxy.ts` pasan a decidir por permisos. Tarjeta de módulo → permiso requerido (`personal.ver`, `carnetizacion.ver`, `identidad.ver_usuarios`, `autogestion.ver_propio`…); eliminar el texto "Tienes acceso a este departamento" y el filtro por `department`.
2. **Sidebars**: reemplazar `roleAccept: [...]` por `permisoRequerido: "modulo.accion"` evaluado con `tienePermiso`, en los 4 sidebars (y `familiares-page`, `movimientos-page`, `zod.ts`). Resultado: 0 literales de `nombre_rol` en lógica de acceso (solo en etiquetas visuales).
3. **Sesión**: el login deja de pedir `identidad/departamentos/` (`auth.config.ts:129`); `token.department` se retira de `auth.ts` y de los tipos. El rol se mantiene como dato informativo.
4. **Backend**: `CuentaModel.departamento` se mantiene en la tabla legada (`managed=False`, no se borra la columna), pero se marca **deprecado**: deja de ser requerido en `registrar_usuario`/`editar_usuario` (`registrar_usuario.py:27`), los serializers lo aceptan opcional, y se quita el endpoint de departamentos de la UI de alta. Eliminación física de la FK/columna queda para una etapa posterior con respaldo y acuerdo (riesgo de datos legados).
5. **Gestión de usuarios**: formulario de alta/edición = cédula + rol + ajustes de permisos individuales (`identidad_usuario_permiso`, allow/deny); sin selector de departamento. Pantalla de matriz rol → permisos ya existe en backend (`rol_catalogo_views.py`, `permiso_views.py`); exponerla en UI.
6. **Invalidación**: implementar `permisos_version` en `CuentaModel` (si el campo no existe en la tabla física, vía columna nueva con migración controlada o usando `UsuarioPermisoModel.version`), emitirlo como claim del JWT y comprobarlo en `CookieJWTAuthentication`; al cambiar rol/permisos se incrementa y la próxima petición fuerza refresco. Hoy no hay invalidación efectiva (ver 1.5).
7. **Datos**: script idempotente que (a) renombra "BIENSTAR SOCIAL" a `BIENESTAR_SOCIAL` y actualiza `RolPermisoModel`/frontend en el mismo despliegue, (b) crea roles nuevos, (c) reasigna usuarios (analista y administradora de Bienestar identificados por el usuario), (d) convierte las cuentas de pasivos al rol `PASIVO`.

---

## 3. Plan por etapas

Tallas: S = ≤2 días, M = 3–6 días, L = 7–12 días (un desarrollador; sin considerar bloqueos externos). Dependencias entre etapas indicadas.

**Correspondencia Etapa → Fase** (ver "Hoja de ruta y seguimiento"; las etapas conservan su ID y contenido, las fases solo reordenan por prioridad y dependencias):

| Etapa / tareas | Fase |
|---|---|
| A1, A4, A5, A6, A8 | Fase 1 |
| B1–B6, B8–B12 | Fase 2 |
| A2, A3, A7, B7 | Fase 3 |
| C1–C15 (C0 es requisito de despliegue de Infraestructura, fuera de las fases) | Fase 4 |
| D1–D4, D6 | Fase 5 |
| D5 | Fase 5 (la conversión de cuentas de pasivos se adelanta a la Fase 4, tarea C7) |
| E1–E6 | Fase 7 |
| Plan de rediseño: R-0 | Fase 0 |
| Plan de rediseño: R-1, R-2, R-6a (FieldCompare) | Fase 2 |
| Plan de rediseño: R-3 (= C13) | Fase 4 |
| Plan de rediseño: R-4 (= C0, requisito de despliegue de Infraestructura) | Fuera de las fases (no bloquea) |
| Plan de rediseño: R-5, R-6b | Fase 6 |

### Etapa A — Base: permisos, Celery operativo, notificaciones (talla L)

Objetivo: infraestructura común antes de construir flujos.

**Backend**
- A1. `GATH/celery.py`, `GATH/__init__.py`, settings Celery, servicios `celery_worker`/`celery_beat` en `compose.yml`; endurecer `CeleryTaskQueue` (falla cerrada). Tarea de prueba "ping".
- A2. App `apps/notificaciones` (Onion completo): entidad, puerto `RepoNotificaciones`, casos de uso `crear_notificacion`, `notificar_por_permiso`, `listar`, `marcar_leida`, `conteo_no_leidas`; vistas y `urls.py`; modelos `NotificacionModel`, `EventoOutboxModel`; registrar en `INSTALLED_APPS`, `GATH/urls.py`.
- A3. Servicio de correo asíncrono: tarea `enviar_correo_outbox` + plantillas, backoff y estado FALLIDO; reutilizar los ajustes SMTP de `settings.py:199-208`. Variables de `EMAIL_HOST_PASSWORD` en `.env.example` (el repo ya lo trae sin trackear).
- A4. Nuevos permisos y roles: ampliar `PERMISOS_CATALOGO` y `ROL_ASIGNACIONES` en `seed_permisos.py` (sección 2.4); comando de datos para renombrar/crear roles y usar `RolEspejo`; `permisos_version` operativo (2.8-6).
- A5. Endurecer almacenamiento: utilidad `core/infrastructure/storage/validacion_archivo.py` (tipo real por firma, tamaño, extensión permitida, claves generadas con uuid, no `archivo.name`) y su uso en nuevos endpoints. Corregir (aparte, S) `familiares_views.py:120` y `carnetizacion_views.py:221`.
- A6. Extender auditoría con `user_agent` (columna nueva, migración) o registrar en `estado_nuevo` hasta la etapa E.

**Frontend**
- A7. Módulo `src/modules/notificaciones/{domain,application,infrastructure,ui}`: DTOs, repo API, hook de polling (`useNotificaciones` con intervalo y `visibilitychange`), componente `CampanaNotificaciones` en `src/components/layout/header.tsx`, página `/notificaciones`.
- A8. `shared/lib/evaluador-iam.ts`: helper `puedeVerRuta(permisos, ruta)` y mapa permiso→módulo (insumo de la etapa D).

**Tests** (suite existente: `BACKEND/tests/{unit,integration}`; Vitest/Playwright en frontend): unit de casos de uso (marcado leído, difusión por permiso, idempotencia de outbox), integración API con permisos (403/200), tarea Celery con `ALWAYS_EAGER`, contrato de `encolar` sin app (debe lanzar), Vitest del hook de polling.

**Criterio de salida**: worker y beat arriba y `healthy`; una notificación creada por un caso de uso aparece en la campana de otro usuario con el permiso; un correo de prueba sale por SMTP real o por backend de consola en dev, con reintentos probados; el seed crea los roles y permisos nuevos de forma idempotente; ninguna prueba depende de la simulación de `encolar`.

### Etapa B — Autogestión: solicitudes de actualización (talla L)

Depende de A.

**Backend (`apps/autogestion`)**
- B1. Modelos de 2.3 (`SolicitudActualizacion`, `CambioPropuesto`, `SoporteDocumental`, `SeccionAutogestionable`) + migraciones + semilla de secciones.
- B2. Dominio: entidades, VO de estado/transiciones, errores; puertos `RepoSolicitudes`, `RepoSoportes`, `AplicadorCambios` (puerto hacia `personal`/`familiares`, sin importar sus modelos).
- B3. Casos de uso: `solicitar_actualizacion`, `habilitar_ventana`, `guardar_borrador`, `adjuntar_soporte`, `enviar_solicitud` (valida soportes obligatorios y secciones habilitadas), `obtener_comparativo`, `decidir_cambios` (por campo, con la regla de aprobación 2.2: doble aprobación normal o aprobación directa de la Administradora), `aplicar_cambios_aprobados` (transacción, lock de fila de `Employee`/familiar, valida unicidad de correo), `expirar_ventanas` (tarea beat), `rechazar_solicitud`.
- B4. Vistas/URLs (todas con `HasPermission` y Zero-IDOR por `request.user.cedula_id`):
  - Trabajador: `GET/POST /autogestion/solicitudes/`, `GET /autogestion/solicitudes/{id}/`, `PUT /{id}/borrador/`, `POST /{id}/soportes/`, `POST /{id}/enviar/`.
  - Bienestar: `GET /autogestion/bienestar/solicitudes/`, `POST /{id}/habilitar/`, `GET /{id}/comparativo/`, `POST /{id}/decidir/`, `POST /{id}/rechazar/`.
- B5. Serializers de entrada con lista blanca de campos por sección (rechazo de identidad/cargo/estatus), validación de teléfonos/correo, soporte obligatorio por sección.
- B6. Integración con el mapper de `personal`/`familiares` para que "valor anterior" venga de la ficha vigente (snapshot en el momento de la propuesta; recalcular y detectar conflicto si la ficha cambió antes de aprobar).
- B7. Notificaciones (A2) en cada transición; evento `actualizacion_aprobada` (outbox para SIGESP, sin transmitir aún) y alerta de reemisión de carnet si cambió la foto.
- B8. `MiExpedienteView`: pasar a `HasPermission('autogestion.ver_propio')`.

**Frontend (`src/modules/autogestion` + `src/app/(app)/autogestion/...`)**
- B9. Dominio/aplicación/infraestructura: entidades `SolicitudActualizacion`, `CambioPropuesto`, `Soporte`; repo API + server actions; schemas Zod por sección.
- B10. UI trabajador: "Mis solicitudes" (lista con estado y ventana), botón "Solicitar actualización" en `mi-expediente-view.tsx` (selección de secciones y motivo), formulario por sección con subida de soportes (indicador de obligatorio, tipos y tamaño máximo), vista previa del borrador, envío.
- B11. UI Bienestar (nuevo ítem de menú en módulo de personal/gestión de trabajadores): bandeja de solicitudes, diálogo "Habilitar ventana" (secciones + fecha límite), **visor comparativo** (dos columnas valor actual / propuesto con resaltado de diferencias, soporte en visor lateral con URL prefirmada, checkbox o botones aprobar/rechazar por campo con motivo, "aprobar todo", "rechazar todo", resumen previo a confirmar).
- B12. Estados vacíos, carga, errores y accesibilidad según `patrones-implementacion-frontend`; el diseño visual lo define el plan de rediseño hermano.

**Tests**: unit de transiciones y de la regla de aprobación; integración de permisos y Zero-IDOR (no ver ni enviar solicitud ajena); prueba de que la ficha no cambia antes de aprobar y sí cambia solo para campos aprobados; unicidad de correo; soporte obligatorio; expiración; Vitest de schemas y del comparativo; E2E Playwright (trabajador solicita → Bienestar habilita → trabajador envía → Bienestar aprueba parcial → ficha actualizada y notificaciones). **Cuidado**: BD real con datos y tablas `managed=False`: los tests de integración deben ir sobre la BD de pruebas con fixtures, no sobre la real.

**Criterio de salida**: flujo E2E verde; la ficha activa no varía hasta la aprobación; cada campo aprobado/rechazado queda con actor y motivo en `CambioPropuesto` y en `AuditoriaLog`; notificaciones en campana y correo funcionando para ambos lados; solo 3 secciones con soporte obligatorio no se envían sin él.

### Etapa C — Fe de vida de pasivos (talla L)

Depende de A (notificaciones, outbox, almacenamiento seguro, permisos). Se desarrolla y prueba en `http://localhost:3001`; no depende de C0.

**C0. Requisito de despliegue a cargo de Infraestructura: HTTPS en producción (estado propio; fuera del camino crítico; no bloquea ninguna fase)**
- Servicio `nginx` con TLS, certificado y dominio acordados por Infraestructura con TI de CONATEL, un solo origen. Checklist de despliegue: `DJANGO_COOKIE_SECURE`, `AUTH_COOKIE_SECURE`, `NEXTAUTH_URL` con https, hosts/CORS/CSRF, CSP/HSTS, `Permissions-Policy: camera=(self)`, límites de cuerpo. Verificación en producción: `window.isSecureContext === true` desde otro equipo de la red.

**Backend (`apps/fe_de_vida`)**
- C1. Modelos de 2.3 y migraciones; catálogo `TipoPensionJubilacion`; `PlantillaActa` v1 (formato de la planilla física y texto de la constancia).
- C2. Dominio: entidades, VO de estado y transiciones (2.2), reglas puras (quién puede decidir qué según permisos entregados al caso de uso, no por nombre de rol). Reglas puras: dos checks de roles distintos llevan a `VALIDADA`; un mismo actor no cuenta dos veces; la aprobación directa exige permiso y motivo.
- C3. Casos de uso: `registrar_comparecencia` (atómico, idempotente: planilla + evidencia + estado, RN-05/06), `validar_calidad_evidencia` (servidor), `decidir_acta` (`CHECK_ANALISTA` | `CHECK_ADMINISTRADORA` | `APROBACION_DIRECTA` | `RECHAZA` | `SOLICITA_REPETICION`), `reenviar_tras_repeticion`, `emitir_constancia` (PDF + hash + QR + número, RN-11), `verificar_constancia` (interna, RN-23), `listar_panel`.
- C4. PDF de constancia: nuevo generador en `apps/fe_de_vida/infrastructure/pdf/constancia_pdf.py` reutilizando `core/infrastructure/pdf/{pdf_components,pdf_styles}` y el cintillo de `apps/configuracion`; incluye datos del beneficiario, tipo de pensión/jubilación, fecha, nombre/cédula del funcionario que certifica y espacio de firma, número y QR de verificación; se guarda en S3 y su `sha256` en BD.
- C5. Vistas/URLs:
  - Pasivo: `GET /fe-de-vida/mi-estado/` (datos precargados desde `Employee`/`EmployeeEgresado`, RN-14), `POST /fe-de-vida/solicitudes/`, `GET /fe-de-vida/solicitudes/{id}/`, `POST /{id}/reenviar/`, `GET /fe-de-vida/solicitudes/{id}/constancia/` (descarga propia).
  - Bienestar: `GET /fe-de-vida/bienestar/solicitudes/`, `GET /{id}/evidencia/` (URL prefirmada + auditoría), `POST /{id}/decidir/`, `GET /fe-de-vida/bienestar/panel/`, `GET /fe-de-vida/verificar/{codigo}/`.
- C6. Notificaciones y correo: al enviar (a Bienestar), al pedir repetición/rechazar (al pasivo con el motivo) y al `VALIDADA` (al pasivo, notificación + correo con PDF adjunto desde el worker; auditoría del envío, RN-13 y HU-0006; **no** se envía a Bienestar copia de la selfie).
- C7. Acceso del pasivo: rol `PASIVO` y hook de transición activo→pasivo; ajuste de `proxy.ts` para que el pasivo vea solo el módulo Autogestión con el menú de fe de vida; verificar que el login admite cuentas con tipo de personal PASIVO (hoy no lo bloquea).
- C8. Recordatorios programados (HU-0005) con beat: cada N días antes del vencimiento, **solo si** el usuario define la periodicidad (pregunta 4.3.1); si no, queda desactivado.
- C9. Auditoría de los eventos de la HU (`COMPARECENCIA_INICIADA`, `EVIDENCIA_CAPTURADA` (con `origen_evidencia` = `CAMARA` | `ARCHIVO`), `EVIDENCIA_RECHAZADA_POR_CALIDAD`, `COMPARECENCIA_ENVIADA_A_REVISION`, `COMPARECENCIA_REINICIADA`, decisiones (incluye `APROBACION_DIRECTA_ADMINISTRADORA` con motivo), acceso a evidencia, emisión y envío de constancia).

**Frontend**
- C10. Módulo `src/modules/fe-de-vida/{domain,application,infrastructure,ui}`.
- C11. Menú del pasivo en Autogestión: "Solicitud o renovación de acta de comparecencia / fe de vida".
- C12. Formulario según la planilla física (`solicitud de fe de vida1.jpeg`): tipo de pensión/jubilación, datos del beneficiario (precargados y editables donde corresponda), contacto alterno, dirección, área de adscripción y cargo (solo lectura si vienen del sistema), "¿tiene hijos?" + tabla dinámica de hijos (nombres, cédula, teléfonos, correo), react-hook-form + Zod.
- C13. **Componente de captura con dos vías** (antes `CapturaCedulaEnVivo`; 2.6): pestaña/paso "Cámara" (detección de cámara y de contexto seguro, `getUserMedia`, selector de cámara, guía superpuesta, toma, vista previa, repetir, validación básica, `capture="user"` en móviles; limpieza de tracks) y pestaña/paso "Subir foto" (input file JPG/PNG con validación de tipo/tamaño en cliente y vista previa). Cualquier error de cámara (`NotAllowedError`, `NotFoundError`, `NotReadableError`, contexto inseguro) muestra su mensaje y ofrece "Subir una foto"; si la cámara no está disponible se propone automáticamente. Envío con `FormData` incluyendo `origen_evidencia` (`CAMARA` | `ARCHIVO`).
- C14. Seguimiento: estado de la solicitud, motivo de rechazo o repetición, botón "Repetir toma", descarga de la constancia PDF; campana de notificaciones.
- C15. Vista Bienestar en Gestión de Trabajadores: bandeja y panel (HU-0010), detalle con selfie (URL prefirmada en `<img>` sin caché) e indicador del origen de la evidencia (Cámara | Archivo subido), datos del beneficiario y botones según permiso: Analista (**Aprobar (check)** / Rechazar / Solicitar repetición, con motivo) y Administradora (**Aprobar (check)** / **Aprobación directa**, con justificación obligatoria / Rechazar / Solicitar repetición); indicadores "Pendiente del segundo check" (indicando de quién falta) y "Aprobada por vía directa de la Administradora" en el acta, el historial y el registro.

**Tests**: unit de transiciones (incluye: doble check en ambos órdenes, Analista->Administradora y Administradora->Analista, llega a `VALIDADA`; la Analista sola no valida y queda en `PENDIENTE_SEGUNDO_CHECK`; el mismo actor no cuenta dos veces; la aprobación directa exige permiso `fe_de_vida.aprobar_directo` y justificación, y genera el evento `APROBACION_DIRECTA_ADMINISTRADORA`; la Analista recibe 403 al intentar aprobación directa; rechazo y repetición exigen motivo), atomicidad (si falla S3 no queda acta huérfana), idempotencia por `idempotency_key`, validación de imagen (MIME falso, tamaño, EXIF, calidad mínima), registro de `origen_evidencia` (`CAMARA` | `ARCHIVO`), **rechazo de archivo inválido** (tipo no permitido, demasiado grande, resolución insuficiente), permisos y Zero-IDOR, PDF generado con hash y número únicos, correo con adjunto (backend de correo en memoria), auditoría de eventos; Vitest de schemas y del componente de captura con `navigator.mediaDevices` simulado (permiso denegado, sin cámara, contexto inseguro: en cada caso se ofrece "Subir una foto"); E2E Playwright con cámara falsa (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`) sobre `localhost`; **E2E del flujo completo con subida de archivo sin cámara**; **test de rechazo de archivo inválido**.

**Criterio de salida**: el pasivo inicia sesión, completa el formulario, aporta la foto por cualquiera de las dos vías (cámara en vivo o subida de archivo; verificado en `localhost`), la repite si hace falta y la envía, sin que la falta de cámara lo bloquee; Bienestar la ve, con el origen de la evidencia (Cámara | Archivo); el doble check (Analista y Administradora, en cualquier orden) lleva a `VALIDADA`, la Analista sola no valida, y la aprobación directa de la Administradora funciona con justificación, auditoría y marca visible en el acta; se genera la constancia PDF con número y QR; el pasivo recibe notificación y correo con PDF; rechazo y repetición con motivo funcionan; toda acción queda en auditoría; no hay imágenes en logs.

### Etapa D — Usuarios por roles y permisos (talla M)

Puede avanzar en paralelo con B/C a partir de A4, pero se **despliega** después de que A4 (roles y permisos) esté en producción y B/C lo usen.

- D1. Frontend: `proxy.ts` por permisos (`autogestion.ver_propio` sin `personal.ver` ⇒ shell autogestión; `personal.ver` sin `personal.crear` ⇒ solo lectura; no comparar `nombre_rol`/`department`), dashboard por permisos sin "departamento", 4 sidebars con `permisoRequerido`, `familiares-page`, `movimientos-page`, `lib/zod.ts`.
- D2. `auth.config.ts`/`auth.ts`: retirar resolución de departamento; mantener `permisos` en sesión; re-sincronizar con `permisos_version`.
- D3. Backend identidad: `departamento` opcional/deprecado en registrar/editar; endpoint de departamentos pasa a solo lectura; sin selector en el alta.
- D4. UI de usuarios: alta/edición por cédula + rol + ajustes de permisos; pantalla de matriz de permisos por rol.
- D5. Datos: renombrar "BIENSTAR SOCIAL", crear `ANALISTA_BIENESTAR`/`ADMIN_BIENESTAR`/`PASIVO`, asignar usuarios, convertir cuentas de pasivos.
- D6. Test de regresión: tabla de verificación rol→rutas esperadas (ADMINISTRADOR, ANALISTA, AUTOGESTION, PRESUPUESTO, BIENESTAR, RECEPCIONISTA, PASIVO), Vitest sobre `puedeVerRuta` y Playwright por rol (`e2e/` existente).

**Criterio de salida**: `grep` de `nombre_rol ===`, `roleAccept` y `department` en lógica de acceso del frontend devuelve 0; el alta de usuario no pide departamento; cada rol ve exactamente los menús de su matriz; un cambio de permisos invalida la sesión en la siguiente petición; las 867 cuentas AUTOGESTION siguen entrando sin regresiones (prueba de humo con cuenta real de prueba).

### Etapa E — Endurecimiento y auditoría (talla M)

- E1. Auditoría tipo HU: hash de encadenamiento, `user_agent`, `dispositivo`, `trace_id` en cada evento (extender `AuditoriaLog`, migración; consulta de solo lectura con permiso `auditoria.ver_logs` y evento de auditoría del acceso, HU-0003, RN-09/12).
- E2. Rate limiting específico (envío de fe de vida, subida de soportes), antivirus opcional (ClamAV) para soportes, límites de tamaño en nginx y Django.
- E3. Observabilidad del worker (colas, fallidas, panel `notificaciones.administrar`), alertas por `FALLIDA`.
- E4. Pruebas de seguridad (IDOR sobre evidencia y solicitudes, autorización por permiso, subida hostil) con los skills de pentest del proyecto; revisión de cabeceras y CSP (cámara, blob de vista previa).
- E5. Verificación interna de constancias (RN-23) pulida y panel completo (HU-0010); plantillas versionadas editables (HU-0013); política de retención documentada (HU-0014, sin purga automática).
- E6. Actualización de `ESTADO_SISTEMA` y bitácora con las nuevas cifras de pruebas.

**Criterio de salida**: informe de seguridad sin hallazgos críticos abiertos; cobertura de pruebas de las nuevas apps documentada; runbook para reintentar correos fallidos.

### Cronograma relativo y camino crítico

`A (L)` → `B (L)` → `C (L)` → `D (M, desplegable en paralelo desde A4)` → `E (M)`. El camino crítico es la secuencia de desarrollo A → B → C → D → E; el HTTPS de producción (`C0`) lo gestiona Infraestructura al desplegar y **no** forma parte del camino crítico.

---

## 4. Riesgos, bloqueantes y preguntas abiertas

### 4.1 Riesgos y bloqueantes

| # | Riesgo / bloqueante | Mitigación |
|---|---|---|
| R1 | **HTTPS de producción a cargo de Infraestructura** (severidad baja, no bloqueante): sin nginx+TLS la cámara no está disponible desde otros equipos y no se instala la PWA | Todo el desarrollo y las pruebas en `localhost` (contexto seguro); la vía de subida de archivo cubre los equipos sin cámara; checklist de despliegue en `C0` |
| R2 | `CeleryTaskQueue` simula éxito hoy | Falla cerrada (A1); test de contrato |
| R3 | Tablas legadas `managed=False` (`Employee`, vivienda, formación, familiares): escribir mal rompe datos reales | Escritura solo por puertos/repos existentes, en transacción, con `valor_anterior` y detección de conflicto; ensayo con copia de BD |
| R4 | `Employee.correo` es unique: un cambio de correo puede colisionar | Validar unicidad al proponer y al aplicar; mensaje claro |
| R5 | `permisos_version` no operativo y posible `AttributeError` en `restablecer_password` | Verificar en BD; implementar en A4/D |
| R6 | Nombre del rol "BIENSTAR SOCIAL" mal escrito y referenciado por literal en el frontend | Confirmar valor real; renombrar y migrar frontend en el mismo despliegue |
| R7 | Pasivos sin cuenta/sin correo: la fe de vida no se podría recibir | Consulta SQL de cobertura; plan de alta masiva de cuentas PASIVO (requiere correo o canal alterno) |
| R8 | Privacidad de la selfie + cédula (dato personal sensible) | Bucket privado, URLs cortas, auditoría de acceso, sin logs de imagen, retención definida por CONATEL |
| R9 | Única divergencia con la HU: la aprobación directa de la Administradora | ADR y confirmación del usuario antes de implementar C2; permiso, justificación y auditoría propios |
| R10 | Falsificación (foto de foto, tercero): la HU descarta biometría/liveness; el control es la revisión humana | Documentar el alcance; guía y reto visual en pantalla (p. ej. código corto escrito en un papel) como mejora opcional futura |
| R11 | SMTP institucional sin credenciales por defecto (`EMAIL_HOST_PASSWORD=''`) y posible filtrado de adjuntos | Probar el relay con TI; considerar enlace de descarga autenticado además del adjunto |
| R12 | Carga de 867 cuentas con polling | Endpoint de conteo ligero con caché Redis corta; intervalo ≥30 s |
| R13 | Sesión PWA/Service Worker puede cachear datos sensibles | Regla en el plan hermano: no cachear `/api/` ni evidencias |

### 4.2 Qué NO se incluye por ahora

Postulación y onboarding con credenciales temporales; carnet de dos caras; sincronización a SIGESP (solo se registran los eventos en outbox); sincronización de datos del "Sistema de RRHH legado" de HU-0008/HU-0012 (en GATH los datos oficiales ya viven en la misma BD); MFA obligatorio (ver 4.3).

### 4.3 Preguntas abiertas para el usuario

1. **Periodicidad de la fe de vida**: ¿mensual, trimestral, semestral, anual? ¿cuántos días de aviso previo? ¿qué pasa si el pasivo no cumple (suspensión de pago)? Define `vence_el` y los recordatorios.
2. **Plazo por defecto de las ventanas de autogestión** (días) y si Bienestar puede prorrogarlas.
3. **Cobertura de correo en pasivos**: ¿cuántos tienen correo y cuenta? Se propone ejecutar un conteo sobre la BD. ¿Qué hacer con los que no tienen correo (entrega presencial, otro canal)?
4. **Texto oficial exacto de la constancia** y quién firma/certifica (nombre y cargo del funcionario); ¿lleva sello y firma digitalizada? ¿QR de verificación interno es aceptable?
5. **Identidad de los actores**: ¿cuáles son las cédulas de la Analista y de la Administradora de Bienestar Social en BD? ¿cuántas analistas habrá? ¿existe más de una administradora? ¿puede haber auditor (HU-0003) y quién?
6. **Regla de aprobación en autogestión**: ¿se aplica el mismo esquema (doble aprobación normal + aprobación directa de la Administradora) en todas las secciones, o se relaja a una sola aprobación en contacto y vivienda?
7. **Respaldo de cámara** (RESUELTA, decisión del usuario 2026-10-29): la foto tiene dos vías equivalentes, cámara en vivo o subida de archivo; la falta de cámara nunca bloquea el flujo.
8. **Datos de la planilla**: ¿qué campos son editables por el pasivo y cuáles deben venir del sistema (RN-14)? ¿"huellas" y "firma" de la planilla física se sustituyen por la selfie con cédula en la versión digital? (el plan asume que sí)
9. **MFA de la HU-0011** (obligatorio para gestores, administradores y auditores): ¿se incluye ahora? Implicaría TOTP u otro segundo factor para Bienestar y administradores; la skill `autenticacion-permisos-allauth` lo contempla, pero cambia el modelo de sesión actual (simplejwt). Recomendación: **fuera de este ciclo**, marcar como Etapa F si el usuario lo exige.
10. **Dominio y certificado TLS (asunto de despliegue de Infraestructura; no bloquea el desarrollo)**: ¿hay dominio institucional (p. ej. `gath.conatel.gob.ve`) y quién emite el certificado? ¿la aplicación será accesible desde internet (los pasivos están fuera de la red interna) o solo por VPN? Esto último define si los pasivos podrán usarla desde su casa.
11. **Retención y destino de la selfie** tras la validación: ¿se conserva la evidencia (RN-21, sin plazo fijo) o se elimina tras emitir la constancia? Política de CONATEL pendiente (RN-04 pide minimizar).
12. **Pensión por sobrevivencia**: el beneficiario puede ser un familiar que no tiene `Employee` propio (`procesar_egreso.py` deja fuera `ejecutar_creacion_sobrevivientes`). ¿Cómo se identifica y entra al sistema ese beneficiario?
13. **Sobre "Solicitud o renovación"**: ¿la primera vez y las renovaciones son el mismo flujo, con solo la fecha como diferencia? (el plan asume que sí).

---

## 5. Trazabilidad: HU de fe de vida → etapa del plan

| HU | Título resumido | Etapa | Nota |
|---|---|---|---|
| HU-0001 | Comparecencia en línea con selfie sosteniendo la cédula | C (C3, C5, C12, C13) | La HU dice "captura de selfie"; por decisión del usuario (2026-10-29) se **amplía a "captura o carga"** (cámara en vivo o subida de archivo, con registro del origen); atomicidad, idempotencia, validación de calidad y auditoría incluidas; 5 eventos de auditoría en C9 |
| HU-0002 | Revisión y doble check en orden indistinto | C (C2, C3, C15) | **Coincide** con la HU (doble check, orden indistinto). Única divergencia: excepción de **aprobación directa** de la Administradora. Requiere ADR |
| HU-0003 | Auditor consulta trazabilidad inalterable | E (E1) | Auditoría básica desde A/C; hash de encadenamiento y consulta de solo lectura en E |
| HU-0004 | Administrador configura roles, permisos, plantillas y reglas | A (A4), D, C1 | Roles y permisos en A/D; plantillas versionadas básicas en C1; interfaz completa en E5 |
| HU-0005 | Recordatorios y notificaciones automáticas con outbox | A (A2, A3), C8 | Notificaciones en sistema y correo en A; recordatorios de plazos en C8 condicionados a la periodicidad (pregunta 4.3.1) |
| HU-0006 | Envío automático de la constancia PDF por correo | C (C4, C6) | Al `VALIDADA` (segundo check o aprobación directa). No se copia a Bienestar con datos sensibles; se notifica en sistema |
| HU-0007 | Verificación interna de constancias por código/QR | C (C3) y E (E5) | Código, hash y QR en C; pantalla pulida en E |
| HU-0008 | Sincronizar datos del Sistema de RRHH | Fuera de alcance por ahora | Los datos oficiales ya están en la BD de GATH (`Employee`, `EmployeeEgresado`); se consultan directamente (RN-14). Si hubiera una fuente externa real, se retoma con `integracion-bd-externa` |
| HU-0009 | Analista revisa y escala al Jefe de División | C (C2, C3, C15) | El "escalamiento" se expresa como el check de la Analista (`PENDIENTE_SEGUNDO_CHECK`) + check de la Administradora, o aprobación directa |
| HU-0010 | Panel de estado de comparecencias | E (E5), esqueleto en C15 | Lista y contadores básicos en C; panel completo en E |
| HU-0011 | Autenticación con credenciales seguras y MFA | Parcial: D y E2; **MFA fuera de alcance por ahora** | Bloqueo por intentos ya existe (`auth_views.py:100-130`, `repo_bloqueos_cache_db.py`); MFA sujeto a pregunta 4.3.9 |
| HU-0012 | Integración con el legacy (outbox, circuit breaker, idempotencia) | Fuera de alcance por ahora | Se aprovecha el outbox de A para notificaciones; la sincronización hacia SIGESP queda en la parte pospuesta de la Fase 2 |
| HU-0013 | Plantillas del acta versionadas (Sobreviviente Especial, Invalidez Ordinaria…) | C1 (v1) y E5 | Una plantilla inicial según la planilla física y la constancia; gestor completo en E |
| HU-0014 | Retención documental sin plazo fijo | E (E5) | Se documenta la política (RN-21); no hay purga automática; el cumplimiento depende de la respuesta 4.3.11 |

Reglas de negocio de la HU: RN-01, 02, 04, 05, 06, 09–15, 19–23 se conservan; RN-03, RN-07 y RN-22 se **conservan** (doble check) y se complementan con la excepción de aprobación directa de la Administradora; RN-08B y RN-18 (legacy) y RN-16 (MFA) quedan fuera de alcance por ahora.

Trazabilidad de las prioridades del usuario: P1 → Etapa B; P2 → Etapa A (infra) y notificaciones por flujo en B y C; P3 → Etapa C (el HTTPS de producción, C0, es de Infraestructura); P4 → sección 2.2, implementada en B3 y C2/C3/C15; P5 → Etapa D (+A4). La PWA y el rediseño visual: `PLAN_REDISENO_AUTOGESTION_PWA_2026-10-29.md`.
