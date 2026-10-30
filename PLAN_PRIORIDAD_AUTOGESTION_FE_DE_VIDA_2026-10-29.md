# Plan de re-priorización de la Fase 2: Autogestión, Notificaciones, Fe de Vida de pasivos y Acceso por permisos

Fecha: 2026-10-29 · Rama: `feature/fe-de-vida-pasivos` · Alcance: solo planificación (no se modificó código).
Documento hermano (no duplicado aquí): `PLAN_REDISENO_AUTOGESTION_PWA_2026-10-29.md` (rediseño visual y PWA).

Convenciones aplicables (skills del proyecto): backend Onion `apps/<modulo>/{domain,application,infrastructure,presentation}`, vistas explícitas, `HasPermission("modulo.accion")`, tablas nuevas `managed=True`, legadas `managed=False`; frontend `src/modules/<modulo>/{domain,application,infrastructure,ui}`, formularios react-hook-form + Zod, permisos por código.

---

## 0. Resumen ejecutivo

El usuario declara un cambio de prioridad dentro de la Fase 2 (ya descrita en `FASE2_PROPUESTA_TECNICA.md`, `PROPUESTA_FASE2_GATH.md` y `Propuesta_Fase2_GATH.html`) y un requerimiento nuevo (fe de vida de pasivos). No se agrega alcance fuera de la Fase 2: se **adelanta** el bloque "Portal de Autogestión con aprobación con diferencias" (diagrama de secuencia, tabla de secciones autogestionables, tablas `SolicitudActualizacion` y `RegistroCambioPropuesto`, rol Analista de Bienestar Social, bandeja de notificaciones) y se agrega la **Fe de vida** como un segundo tipo de solicitud que reutiliza la misma infraestructura (notificaciones, soportes, revisión, PDF, correo).

Orden de prioridad declarado:

1. Culminar Autogestión del activo (el trabajador solicita; Bienestar Social habilita una ventana con plazo prorrogable; soportes obligatorios; visor comparativo campo por campo; aprobación de una sola persona).
2. Notificaciones en sistema (campana/bandeja) y correo, para Autogestión y para Gestión de Trabajadores (Bienestar Social).
3. Acceso de pasivos a Autogestión con menú "Solicitud o renovación de acta de comparecencia / fe de vida" dentro de **procesos/períodos** que abre y cierra Bienestar Social (formulario + foto con la cédula en mano, por cámara en vivo o subiendo una foto ya tomada).
4. Regla de aprobación. **Fe de vida (pasivos)**: flujo normal con **doble aprobación** (Analista de Bienestar Social y Administradora/Jefa, en orden indistinto, como en la HU); excepción: la Administradora puede aprobar sola por **aprobación directa** (justificada y auditada); la Analista nunca valida sola. **Autogestión del activo**: basta **una sola aprobación** de la Analista **o** de la Administradora (sin doble aprobación; decisión 0.1-A).
5. Gestión de usuarios por **roles y permisos**, ya no por roles y departamentos.

**Se pospone** (siguen en Fase 2, solo cambian de orden): postulación digital y onboarding con credenciales temporales, carnet de dos caras y diseñador visual, sincronización GATH→SIGESP (bandeja de eventos de nómina), asignación atómica de cargo por Presupuesto y puntos de cuenta. Excepción: el hook "Actualización de datos aprobada" hacia nómina (E5 del diagrama de SIGESP) queda como evento registrado en outbox pero sin transmisión hasta que se retome SIGESP.

**Hallazgos críticos de la auditoría** (detalle en la sección 1):

- La app `autogestion` hoy es solo **censo de vivienda + "mi expediente" de solo lectura + carnet**. No existe solicitud de actualización, ventana, borrador, soporte ni visor comparativo.
- No existe **ninguna** infraestructura de notificaciones, ni Celery operativo (`GATH.celery` no existe; `CeleryTaskQueue.encolar` devuelve un id simulado), ni worker/beat en `compose.yml`. El correo hoy solo existe para recuperación de contraseña, de forma síncrona.
- La tabla `Employee` (donde se aplicarían los cambios) es `managed=False` con `correo` **unique**; formación académica y familiares también son legadas sin columna de archivo de soporte (los documentos de familiares sí tienen `FamilyDocumentModel`).
- Un pasivo **sigue siendo un `Employee`** (el pase solo crea otra `AsigTrabajo` con tipo de personal PASIVO). El login **no** consulta tipo de personal, solo `is_active`; por tanto, si el pasivo conserva su `Cuenta`, puede entrar. Hay que verificar en BD cuántos pasivos tienen cuenta y correo.
- Autorización: el backend ya es por permisos (`HasPermission`), con casi **cero** `nombre_rol` en duro. La deuda de roles/departamento está en el **frontend**: ~39 usos de `nombre_rol`, ~14 de `nombre_departamento`/`department` y el `proxy.ts`.
- Los permisos de Autogestión existentes no cubren el flujo nuevo, y el rol 5 "BIENSTAR SOCIAL" (nombre mal escrito, 1 cuenta; se renombra a "BIENESTAR SOCIAL" en la tarea `B14`) no distingue Analista de Administradora.
- La Fe de Vida admite **dos vías equivalentes** para la foto (cámara en vivo con `getUserMedia`, o subida de una foto ya tomada). `getUserMedia` solo opera en contexto seguro: `http://localhost:3001` lo es, así que todo el desarrollo y las pruebas se hacen en local sin certificado. El HTTPS/nginx de **producción** es un requisito de despliegue a cargo de Infraestructura (ver tarea `C0`): no es tarea del desarrollo ni bloquea ninguna fase, y la falta de cámara nunca bloquea el flujo porque siempre existe la vía de subida de archivo.

### 0.1 Decisiones del usuario (2026-10-29, segunda ronda)

Estas decisiones prevalecen sobre cualquier texto anterior de este documento y del plan hermano. El detalle técnico está en 2.1 a 2.4, 2.9 y 2.10; las preguntas resueltas se marcan en 4.3.

**A. Actualización de datos del empleado activo (Fase 2).** La inicia el **trabajador**: solicita la actualización (secciones y motivo) → Bienestar Social le **habilita** una ventana con un plazo que Bienestar configura y puede **prorrogar** → el trabajador carga los cambios y los soportes y envía → aprueba **una sola persona** (Analista de Bienestar **o** Administradora de Bienestar; no hay doble aprobación), campo por campo (total, parcial o rechazo con motivo) → lo aprobado se aplica a sus datos reales. El parámetro `requiere_doble_aprobacion` por sección **se elimina** para autogestión. Secciones autogestionables por defecto (según la propuesta): contacto, vivienda, formación (soporte obligatorio), familiares (soporte obligatorio) y foto; identidad, cargo y estatus no.

**B. Fe de vida del personal pasivo (Fase 4), por procesos/períodos.** Bienestar Social crea, abre y cierra **procesos** (p. ej. "Fe de vida 2026-2027") con fecha de apertura y cierre configurables. Al cerrarse, nadie puede enviar salvo **prórroga individual** (a una persona) o **general** (a todos). Habrá múltiples procesos en el tiempo; en cada proceso nuevo el pasivo vuelve a llenar todo y a tomar o subir la foto; lo anterior queda como historial por proceso. La periodicidad **no se programa fija**: RRHH la decide al abrir cada proceso; quien no cumpla, el proceso se cierra y queda a criterio de RRHH (sin sanción automática). Primera vez y renovación son el mismo trámite. Doble aprobación (Analista + Administradora, orden indistinto) con aprobación directa excepcional de la Administradora. Recordatorios previos al cierre: configurables por proceso (Fases 3 y 4).

**C. Datos del acta de fe de vida.** La fe de vida también **actualiza los datos reales** al aprobarse, sin duplicar tablas de familiares, contactos ni vivienda: las respuestas son **cambios propuestos** que se aplican tras la doble aprobación, con el mismo mecanismo que la autogestión (ver 2.9). Se agregan dos datos propios del trabajador (correo alternativo y "¿tiene hijos?") en una tabla complementaria (2.10, tarea `B13`).

**D. Otras respuestas.** Renombrar el rol "BIENSTAR SOCIAL" a "BIENESTAR SOCIAL" (`B14`). Los usuarios de Bienestar (varias analistas y varias administradoras) los crea y asigna el usuario manualmente: **no hay tarea de asignación automática**. Remitente de correo `gath@conatel.gob.ve` vía `mail.conatel.gob.ve` (ya en `.env`). Los pasivos sin correo los carga RRHH (el login es por correo): reporte de pasivos sin correo o sin cuenta (`C16`). La constancia lleva el nombre de quien aprobó, **sin firma digitalizada ni sello**; el QR de verificación interna se mantiene como propuesta. La selfie **se conserva**. Infraestructura dará acceso externo al sistema. No hay manual de identidad visual (el rediseño usa la paleta provisional). MFA (HU-0011) queda para una fase posterior, fuera de este ciclo.

**E. Pensionados por sobrevivencia, auditor y roles.** Los pensionados por sobrevivencia **sí existen y deben hacer fe de vida**: el sistema debe dar de alta al familiar beneficiario como **personal pasivo** (tarea `C20`, 4.3.12 RESUELTA). El **AUDITOR** queda confirmado como **solo lectura** de todos los módulos y de la bitácora. La estructura de roles (`JEFE_RRHH`, `ADMIN_BIENESTAR`, `ANALISTA_BIENESTAR`, `ADMIN_CAPTACION`/`ANALISTA_CAPTACION`) quedó **confirmada** (4.3.14, matriz 2.4, tarea `D7`). El formato de constancia y correo (2.11) quedó **confirmado** el 2026-10-29.

**F. Ciclo de vida de las cuentas (2026-10-29, tercera ronda).** Cuenta automática con rol AUTOGESTION: el activo, en cuanto su ficha tiene correo institucional; el pasivo y el sobreviviente (C20), cuando RRHH les carga el correo (sin autorregistro). Contraseña inicial = **la cédula** (decisión del usuario con el riesgo aceptado: la cédula no es secreta), con cambio obligatorio en el primer ingreso, vencimiento a los 7 días si no se usa (después: "¿Olvidó su contraseña?" o "Restablecer acceso" de RRHH, que repone la cédula con otros 7 días) y aviso por correo al cambiarse la contraseña. Pase a pasivo: RRHH elige el correo de acceso (institucional o alternativo) y el sistema avisa a ese correo. Egreso sin pase a pasivo (renuncia, destitución, fin de contrato, fallecimiento): cuenta desactivada y sesiones revocadas al instante, para todos los roles. Login solo por correo (hecho, commit `6f734f6`). Tarea `D8`.

**G. Autogestión campo por campo (2026-10-29, cuarta ronda).** El trabajador elige campos concretos dentro de cada sección, no la sección entera, y la ventana se habilita solo para esos campos. El correo institucional (de acceso) no lo edita el trabajador: lo cambia RRHH con D8; el alternativo sí. Un solo motivo por solicitud, de mínimo 5 palabras y 20 caracteres, en un cuadro de texto que no se puede redimensionar. Nuevo estado DEVUELTA: Bienestar devuelve con motivo, el trabajador corrige dentro del plazo y reenvía. Notificación en el sistema y por correo (correo de acceso) en cada transición: al trabajador cuando la solicitud se habilita, el plazo está por vencer, se aprueba, se aprueba en parte, se devuelve, se rechaza o vence; a Bienestar cuando hay solicitud nueva, actualización enviada o corrección reenviada, SOLO en el sistema: el correo a Bienestar está por confirmar y queda detrás del ajuste `NOTIFICAR_BIENESTAR_POR_CORREO` (apagado por defecto). Tarea `B16`.

**H. Revisión de la fe de vida (2026-10-30).** Bienestar puede **rechazar** el acta (definitivo) o **devolverla para corrección**, ambas con justificación obligatoria. El estado REPETICION_SOLICITADA pasa a ser «Devuelta para corrección» y permite corregir datos y foto, no solo la foto. Crear, abrir y cerrar procesos y conceder prórrogas le corresponde **solo a la Administradora de Bienestar**: se retiran `fe_de_vida.gestionar_procesos` y `fe_de_vida.prorrogar` a la Analista. **Alcance configurable al abrir el proceso** (corrección del usuario 2026-10-30): la Administradora elige si aplica a todos los pasivos o solo a uno o varios **tipos de pensión** (catálogo `TipoNomina` vía `AsigTrabajo.tipoNominaId`, solo las nóminas de pasivos: `TipoNomina.es_activo = False`; jubilados, pensionados, sobrevivientes…), por ejemplo cuando un organismo pide la fe de vida de un grupo en otra fecha. Solo los pasivos dentro del alcance ven el proceso y pueden enviar; la cobertura (C16) y los recordatorios (C8) respetan el alcance. Los rezagados se atienden con prórrogas individuales o generales.

---

## Hoja de ruta y seguimiento

Esta sección ordena el plan por **fases según la prioridad del usuario y las dependencias técnicas reales**. Las etapas A–E de la sección 3 (y las etapas 0–6 del plan hermano `PLAN_REDISENO_AUTOGESTION_PWA_2026-10-29.md`, citadas aquí como **R-0 … R-6**) siguen siendo el detalle técnico; las fases solo reagrupan sus tareas. No se duplica el detalle del plan de rediseño.

### Por dónde comenzar

1. **Día 1, en paralelo (Fase 0)**: las preguntas bloqueantes de arranque (4.3.2, 4.3.5, 4.3.6) quedaron **RESUELTAS** el 2026-10-29 (0.1); 4.3.14 también quedó resuelta, nada bloquea las Fases 1 a 3. Todo el desarrollo y las pruebas se hacen en `http://localhost:3001` (contexto seguro: cámara y PWA funcionan sin certificado). *Nota de despliegue (no es acción del día 1 ni del desarrollo)*: el TLS/dominio/nginx de producción lo gestiona Infraestructura cuando se despliegue (ver `C0`). Confirmar el nombre real del rol "BIENSTAR SOCIAL" en `USER_rol` (R6) y ejecutar el conteo de pasivos con cuenta y correo (R7) y la verificación de `permisos_version` (R5) (tarea `V-1`).
2. **Primera fase de construcción: Fase 1 (Cimientos)**, con las tareas `A4` (roles y permisos nuevos), `A5` (validación y almacenamiento seguro de archivos), `A1` (Celery real y `encolar` que falla cerrado), `A6` y `A8`. Sin `A4` y `A5` no se puede construir la autogestión (B1 y B3 los usan) ni la fe de vida.
3. **Inmediatamente después, Fase 2 (Autogestión del activo)**: `B1 → B2 → B3 → B4/B5/B6`, `B8`, `B13` (datos complementarios), `B14` (renombre del rol) y en frontend `B9 → B10/B11` junto con `R-1`, `R-2` y `R-6a` (FieldCompare), que son una sola entrega con B10/B11 (el diseño no se hace dos veces). `R-1` puede empezar ya, durante la Fase 1, porque no depende del backend.
4. **Fase 3 (Notificaciones y correo)** se inicia en cuanto `B3` exista (para engancharse a las transiciones) y puede solaparse con el final de la Fase 2: `A2 → A3 → A7 → B7`.
5. **Fase 4 (Fe de vida)** arranca con `C20` (alta de pensionados por sobrevivencia como pasivos) y `C1`/`C2`/`C3` en backend apenas A4 y A5 estén listos y la ADR de aprobación directa (R9) esté confirmada; `C13` (captura con dos vías) se desarrolla y prueba en `localhost`; no espera a `C0`. Opcional: para probar en un teléfono durante el desarrollo, tenga en cuenta que el teléfono accediendo por IP/HTTP **no** es contexto seguro, por lo que allí aplica la vía de subida de archivo.
6. Correspondencia con las prioridades del usuario: P1 → Fase 2, P2 → Fase 3, P3 → Fase 4, P4 (usuarios por roles y permisos) → Fase 5, P5 (rediseño y PWA) → Fases 2, 4 y 6. Las Fases 0 y 1 no son prioridades nuevas: son prerrequisitos técnicos de las anteriores.

### Leyenda de estados

⏳ Pendiente · 🔄 En proceso · ✅ Culminado · ⛔ Bloqueado (indicar el motivo en Notas)

### Tabla de fases

| Fase | Objetivo | Etapas/tareas del plan (IDs) | Depende de | Esfuerzo | Estado | Inicio | Fin | Notas |
|---|---|---|---|---|---|---|---|---|
| **Fase 0** — Arranque y bloqueantes (continua, desde el día 1) | Iniciar lo que depende de terceros: respuestas del usuario y verificaciones en BD | `R-0`, `V-1` (riesgos R5, R6, R7 de 4.1) | — | S (seguimiento continuo) | ⏳ Pendiente | — | — | Sin camino crítico de infraestructura: el HTTPS de producción (`C0`) es de Infraestructura y no bloquea ninguna fase |
| **Fase 1** — Cimientos | Permisos y roles nuevos, almacenamiento seguro, Celery real, base de sesión por permisos | `A1`, `A4`, `A5`, `A6`, `A8`, `A-T` | V-1 (nombre real del rol, para A4) | M | ✅ Culminado | 2026-10-29 | 2026-10-29 | Prioridad técnica, no funcional. A2/A3/A7 pasan a la Fase 3 |
| **Fase 2** — Autogestión del empleado activo (P1) | Solicitud iniciada por el trabajador, ventana habilitada por Bienestar con plazo y prórroga, borrador, soportes obligatorios, visor comparativo campo por campo, aprobación de una sola persona, aplicación de cambios aprobados; datos complementarios (correo alternativo, tiene hijos) y renombre del rol | `B1`–`B6`, `B8`–`B14`, `B-T`, `R-1`, `R-2`, `R-6a` | Fase 1 (A4, A5) | L | ✅ Culminado | 2026-10-29 | 2026-10-29 | Sin notificaciones aún (B7 va en Fase 3). Diseño visual con R-1/R-2. Incluye `B13` (tabla complementaria, la usa también la fe de vida) y `B14` (renombre del rol a BIENESTAR SOCIAL) |
| **Fase 3** — Notificaciones en sistema y correo (P2) | Campana/bandeja, outbox, correo asíncrono; conexión con las transiciones de Autogestión y Gestión de Trabajadores | `A2`, `A3`, `A7`, `B7`, `A-T2` | Fase 1 (A1, A4), `B3` | M | ✅ Culminado | 2026-10-29 | 2026-10-29 | Remitente `gath@conatel.gob.ve` vía `mail.conatel.gob.ve` (ya en `.env`); falta probar el relay y los adjuntos (R11). Puede solaparse con el final de la Fase 2 |
| **Fase 4** — Fe de vida de pasivos (P3) | Procesos/períodos que gestiona Bienestar (apertura, cierre, prórrogas), formulario + selfie con cédula (cámara en vivo o subida de archivo), revisión de Bienestar, doble check + aprobación directa de la Administradora, aplicación de lo aprobado a los datos reales, constancia PDF por correo, acceso del pasivo, reporte de pasivos sin correo | `C1`–`C21`, `C-T`, `R-3` (= C13); `C0` queda como requisito de despliegue de Infraestructura (fuera del camino crítico) | Fases 1, 2 (`B3`, `B13`) y 3; ADR de aprobación directa (R9) | L | ✅ Culminado | 2026-10-29 | 2026-10-30 | Backend, UI y pruebas (incluida la cámara) avanzan en `localhost`; la vía de subida de archivo cubre cualquier equipo sin cámara o sin contexto seguro. Incluye `C20` (alta de pensionados por sobrevivencia como pasivos, antes de los flujos de fe de vida), el alta de cuentas AUTOGESTION faltantes de pasivos y el reporte de pasivos sin correo para RRHH (`C7`, `C16`) |
| **Fase 5** — Usuarios por roles y permisos (P4) | Retirar el acceso por departamento y `nombre_rol` en frontend; alta de usuarios por rol + permisos; invalidación por `permisos_version`; estructura de roles confirmada | `D1`–`D7` | Fase 1 (A4, A8); idealmente tras Fases 2 y 4 | M | ⏳ Pendiente | — | — | Puede avanzar en paralelo desde A4, pero se despliega después de que los flujos usen los permisos nuevos. `D7` desbloqueada (estructura de roles confirmada 2026-10-29) |
| **Fase 6** — Rediseño institucional y PWA (P5) | Cierre del sistema visual en el resto de pantallas, PWA instalable y offline | `R-5`, `R-6b`, `R-6c`, `R-A` | Fases 2 y 4 (la PWA se prueba en `localhost`; el HTTPS de producción es de Infraestructura, ver `C0`) | M | ⏳ Pendiente | — | — | R-1 a R-3 ya se entregan dentro de las Fases 2 y 4; no se repiten |
| **Fase 7** — Endurecimiento y auditoría | Auditoría encadenada, rate limiting, observabilidad, pruebas de seguridad, cierre documental | `E1`–`E6` | Fases 2 a 6 | M | ⏳ Pendiente | — | — | Los specs de axe se agregan por etapa; aquí solo el cierre. MFA (HU-0011) queda para una fase posterior, fuera de este ciclo |

### Tabla de tareas

Capas: Back, Front, Infra, Test, Doc. Los IDs `A*`, `B*`, `C*`, `D*`, `E*` son los de la sección 3; `R-n` corresponde a la etapa n del plan de rediseño/PWA (sin duplicar su detalle). `V-1`, `A-T`, `A-T2`, `B-T`, `C-T`, `R-6a`, `R-6b` y `R-A` son identificadores de seguimiento creados aquí para tareas que el plan describe de forma agrupada (verificaciones, bloques de "Tests" de cada etapa y partes de la etapa 6).

**Fase 0 — Arranque y bloqueantes**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| R-0 | Paleta provisional (no hay manual de identidad), `lang="es-VE"`, título, retirar `MarqueeTitle`, SW ajeno en `localhost:3000` | Front | — | ✅ Culminado | — | 2026-10-29: lang es-VE, título, MarqueeTitle retirado. Desregistrar el SW ajeno de localhost:3000 es un paso manual en cada equipo |
| V-1 | Verificaciones en BD: nombre real del rol, pasivos con cuenta y correo, `permisos_version` (R5, R6, R7) | Back | — | ⏳ Pendiente | — | Insumo de A4, B14 y C16. Ya verificado (2026-10-29, solo lectura): `Employee` no tiene campo de correo alternativo ni de hijos (ver 2.10) |

**Fase 1 — Cimientos**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| A1 | Celery real (`GATH/celery.py`, worker/beat en compose, `encolar` falla cerrado) | Back/Infra | — | ✅ Culminado | — | |
| A4 | Roles y permisos nuevos (seed, `RolEspejo`) y `permisos_version` operativo | Back | V-1 | ✅ Culminado | — | Crea ANALISTA_BIENESTAR, ADMIN_BIENESTAR (el rol PASIVO se creó y se eliminó el 2026-10-29: ver A9) |
| A5 | Validación de archivos (firma real, tamaño, claves uuid) | Back | — | ✅ Culminado | — | Incluye corrección aparte de `familiares_views.py` y `carnetizacion_views.py` |
| A6 | Auditoría: `user_agent` o registro en `estado_nuevo` | Back | — | ✅ Culminado | — | |
| A8 | Helper `puedeVerRuta` y mapa permiso→módulo en `evaluador-iam.ts` | Front | A4 | ✅ Culminado | — | Insumo de D1. Helper listo (evaluador-iam.ts); su uso en proxy.ts queda para D1 |
| A9 | Condición del trabajador (ACTIVO/PASIVO) en /me/ y guard de servidor; rol PASIVO eliminado | Back/Front | A4 | ✅ Culminado | — | Decisión del usuario 2026-10-29 |
| A-T | Tests de Fase 1 (contrato de `encolar`, seed idempotente, validación de archivos) | Test | A1, A4, A5 | ✅ Culminado | — | Parte de los tests de la etapa A |

**Fase 2 — Autogestión del empleado activo**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| B1 | Modelos, migraciones y semilla de secciones (sin `requiere_doble_aprobacion`; ventana con plazo y prórrogas; `CambioPropuesto` con origen genérico, reutilizado por la fe de vida) | Back | A4 | ✅ Culminado | — | |
| B2 | Dominio: entidades, estados, puertos | Back | B1 | ✅ Culminado | — | |
| B3 | Casos de uso (solicitar, habilitar con plazo, prorrogar, borrador, soporte, enviar, comparativo, decidir, aplicar, expirar, rechazar) | Back | B2, A5 | ✅ Culminado | — | `decidir`: aprueba una sola persona (Analista o Administradora), regla de 2.1. `aplicar` es reutilizado por la fe de vida (C19) |
| B4 | Vistas y URLs (trabajador y Bienestar) | Back | B3 | ✅ Culminado | — | |
| B5 | Serializers con lista blanca por sección | Back | B3 | ✅ Culminado | — | |
| B6 | Valor anterior desde la ficha y detección de conflicto | Back | B3 | ✅ Culminado | — | |
| B8 | `MiExpedienteView` con `autogestion.ver_propio` | Back | A4 | ✅ Culminado | — | |
| B9 | Dominio/aplicación/infraestructura frontend y schemas Zod | Front | B4 | ✅ Culminado | — | 2026-10-29 |
| R-1 | Tokens, tipografía y shell institucional | Front | R-0 | ✅ Culminado | — | 2026-10-29: shell institucional, tokens, tema y controles de 44px |
| R-2 | Pantallas del funcionario: ficha, solicitudes, avisos | Front | R-1 | ✅ Culminado | — | 2026-10-29: ficha, solicitudes y notificaciones con el sistema visual nuevo |
| B10 | UI trabajador: mis solicitudes, formularios por sección, soportes | Front | B9, R-2 | ✅ Culminado | — | 2026-10-29 |
| R-6a | `FieldCompare` (componente visual del comparativo) | Front | R-1 | ✅ Culminado | — | 2026-10-29: `field-compare.tsx` y visor comparativo |
| B11 | UI Bienestar: bandeja, habilitar ventana con plazo y prórroga, visor comparativo | Front | B9, R-6a | ✅ Culminado | — | 2026-10-29 |
| B12 | Estados vacíos, carga, errores y accesibilidad | Front | B10, B11 | ✅ Culminado | — | 2026-10-29: carga con límite y Reintentar; corregido error de hidratación del saludo (React #418) |
| B13 | Tabla complementaria propia `datos_complementarios_trabajador` (cédula única, `correo_alternativo`, `tiene_hijos`, `actualizado_en/por`; `managed=True`, Onion completo: entidad, puerto, repo, caso de uso, serializer) y exposición en la ficha y en el formulario de contacto de autogestión; gestión de ambos correos (institucional/login y alternativo) para todo el personal | Back/Front | A4 | ✅ Culminado | — | `Employee` es legada (`managed=False`, sin ALTER) y no tiene campo reutilizable (2.10). La usa también la fe de vida (C12, C19) |
| B14 | Renombrar el rol "BIENSTAR SOCIAL" a "BIENESTAR SOCIAL": script con respaldo previo de `USER_rol`, UPDATE idempotente y cambio de los literales del frontend en el mismo despliegue | Back/Front | V-1 | ✅ Culminado | — | Reemplaza el renombre que estaba en D5. Los usuarios de Bienestar los asigna el usuario a mano (sin tarea automática) |
| B15 | Componente compartido `CapturaFoto` (detecta cámara: tomar foto en PC/teléfono o subir archivo; sin cámara o sin permiso nunca bloquea) integrado en autogestión, registro y edición de personal y carnetización; lo reutiliza la fe de vida (C13) | Front/Test | — | ✅ Culminado | — | 2026-10-29: CapturaFoto en autogestión, personal y carnetización |
| B16 | Decisión G: solicitud campo por campo, correo institucional no editable, motivo único (mín. 5 palabras y 20 caracteres, textarea sin redimensionar), estado DEVUELTA, notificaciones en sistema y correo en todas las transiciones | Back/Front | B3, B10, B11, A2 | ✅ Culminado | — | 2026-10-30: campo por campo (migración 0003), estado DEVUELTA, motivo mín. 5 palabras/20 caracteres, avisos al trabajador por sistema y correo y a Bienestar solo por sistema (`NOTIFICAR_BIENESTAR_POR_CORREO`), «Mis solicitudes» paginada con filtros. Backend 831, Vitest 449. Falta aplicar la migración 0003 en la BD local |
| B-T | Tests de Fase 2 (transiciones, prórroga, aprobación de una sola persona, Zero-IDOR, ficha intacta hasta aprobar, datos complementarios, rol renombrado, E2E) | Test | B4, B11, B13, B14 | ✅ Culminado | — | 2026-10-29: E2E Fase 2 22/22 y accesibilidad 5/5 (2 detalles omitidos por falta de solicitudes); backend 635; Vitest 431. Cuentas E2E en BD local (se conservan) |

**Fase 3 — Notificaciones en sistema y correo**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| A2 | App `notificaciones` (modelos, casos de uso, API) | Back | A4 | ✅ Culminado | — | 2026-10-29: app, migración 0001, API; tests en verde |
| A3 | Correo asíncrono con outbox, reintentos y plantillas | Back | A1, A2 | ✅ Culminado | — | 2026-10-29: relay mail.conatel.gob.ve aceptó correo con CC y PDF adjunto vía outbox (R11). Recepción confirmada en Gmail y en jbolivar@conatel.gob.ve. En producción, FRONTEND_URL debe ser el dominio real |
| A7 | Módulo frontend de notificaciones y campana | Front | A2 | ✅ Culminado | — | 2026-10-29: «Notificaciones» en el menú de personal, carnetización, seguridad y autogestión (rutas por módulo); cada notificación tiene `modulo` (migración 0002) y cada usuario ve en cada módulo solo las suyas de ese módulo; campana con máx. 4 no leídas y «Ver todas»; paginación 10 (tope 50) y filtros q/tipo/leída/fechas. Vitest 442, backend 757 |
| B7 | Notificaciones en cada transición de Autogestión y evento outbox | Back | A2, A3, B3 | ✅ Culminado | — | Incluye alerta de reemisión de carnet. 2026-10-29: receivers de autogestión y aviso de ventanas por expirar en beat |
| A-T2 | Tests de notificaciones, outbox y polling | Test | A2, A3, A7 | ✅ Culminado | — | 2026-10-29: e2e/notificaciones.spec.ts 7/7 en vivo (campana por módulo, menú, bandeja con filtros y paginación, axe, cambiar contraseña); backend y Vitest en verde |

**Fase 4 — Fe de vida de pasivos**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| C0 | Requisito de despliegue a cargo de Infraestructura: HTTPS en producción (nginx + TLS, un solo origen, cookies Secure, Permissions-Policy) | Infra (despliegue) | — | ⏳ Pendiente (a cargo de Infraestructura) | Infraestructura | Fuera del camino crítico; no bloquea ninguna fase. Es también R-4. Ver checklist de despliegue en la Etapa C |
| C20 | Alta de pensionados por sobrevivencia como personal pasivo: implementar `ejecutar_creacion_sobrevivientes` (hoy fuera de alcance, `apps/pasivos/application/use_cases/procesar_egreso.py:8`), réplica de `RAC/services/egreso_services.py` del legado: crea un `Employee` nuevo para el familiar beneficiario copiando perfil de salud/físico/formación del familiar, con asignación tipo PASIVO y pensión de sobrevivencia vinculada al titular fallecido; la cuenta AUTOGESTION se crea tras cargarle el correo RRHH (`C16`, `C7`) | Back | A4, A9 | ✅ Culminado | — | 2026-10-29: Employee + AsigTrabajo PASIVO con nómina PENSIONADO SOBREVIVIENTE (tipoNomina, sin tablas nuevas), movimiento INGRESO «PENSION POR SOBREVIVIENTE» y auditoría; endpoint `POST /pasivos/<cedula>/sobrevivientes/` (pasivos.crear); idempotente. Commits ad34b7b y 5ca9d9b |
| C1 | Modelos, migraciones, catálogo y plantilla v1: `ProcesoFeDeVida`, `ProrrogaProceso`, `SolicitudFeDeVida` ligada a un proceso (una por pasivo y proceso), evidencia, decisiones, constancia | Back | A4, B1, C20 | ✅ Culminado | — | 2026-10-29: app `fe_de_vida`, modelos managed=True, migraciones 0001 y 0002 (plantilla v1); no aplicadas aún |
| C2 | Dominio y reglas de doble check / aprobación directa, estados del proceso (BORRADOR/ABIERTO/CERRADO) y regla de prórroga | Back | C1 | ✅ Culminado | — | 2026-10-29: dominio puro; doble check (roles distintos, persona distinta), aprobación directa solo Administradora con justificación |
| C3 | Casos de uso (comparecencia dentro de un proceso abierto o con prórroga, decisión, constancia, verificación, panel) | Back | C2, A5 | ✅ Culminado | — | 2026-10-29: casos de uso de procesos, prórrogas, solicitud, evidencia (SHA-256, URL 90 s) y revisión; 57 tests |
| C4 | PDF de constancia según 2.11 (confirmado) (número, hash y QR; nombre y cédula de quien(es) aprobaron; sin firma digitalizada ni sello) | Back | C3 | ✅ Culminado | — | 2026-10-30: `infrastructure/pdf/constancia_pdf.py`, número, QR (el código de verificación va solo dentro del QR) y certificantes con nombre y cédula, como en la planilla física; se genera al validarse |
| C5 | Vistas y URLs (pasivo y Bienestar) | Back | C3 | ✅ Culminado | — | 2026-10-30: `/api/v1/fe-de-vida/` (pasivo, bandeja y revisión, procesos y prórrogas, cobertura, verificación); permisos por código y condición PASIVO; paginación 10/50 y filtros |
| C6 | Notificaciones y correo con PDF (formato confirmado en 2.11: copia al correo alternativo, enlace de descarga en el sistema) | Back | A2, A3, C5 | ✅ Culminado | — | 2026-10-30: pasivo en el sistema y por correo (validada con el PDF adjunto y copia al alternativo); Bienestar solo en el sistema, con correo según `NOTIFICAR_BIENESTAR_POR_CORREO` |
| C7 | Acceso del pasivo: asegurar que cada pasivo tenga cuenta AUTOGESTION activa y correo; `proxy.ts` y menú por permiso + condición (A9). Sin rol nuevo ni conversión de cuentas | Back/Front | A4, A9, V-1 | ✅ Culminado | — | 2026-10-30: cuenta AUTOGESTION del pasivo con correo de acceso (D8) y menú por condición; verificado en vivo con la cuenta E2E del pasivo |
| C8 | Recordatorios previos al cierre, configurables por proceso, con beat | Back | A1, C3, C17 | ✅ Culminado | — | 2026-10-30: recordatorios por proceso (p. ej. 7/3/1 días) con beat diario a las 8:00. Sin periodicidad fija: cada proceso define si hay recordatorios y cuándo (4.3.1 resuelta) |
| C9 | Eventos de auditoría de la HU | Back | C3, A6 | ✅ Culminado | — | 2026-10-30: auditoría de cada acción y de cada consulta de la evidencia |
| C10 | Módulo `fe-de-vida` frontend | Front | C5 | ✅ Culminado | — | 2026-10-30: módulo `fe-de-vida` (commit b9adff2) |
| C11 | Menú del pasivo en Autogestión | Front | C7, R-2 | ✅ Culminado | — | 2026-10-30 |
| C12 | Formulario según planilla física y 2.9: campos de solo lectura / editables, correo alternativo, "¿tiene hijos?" que muestra u oculta la sección de hijos (precargados + agregar), partida de nacimiento opcional | Front | C10, B13 | ✅ Culminado | — | 2026-10-30. Se vuelve a llenar completo en cada proceso nuevo |
| C13 | Componente de captura con dos vías: cámara en vivo o subida de foto (antes `CapturaCedulaEnVivo`; incluye R-3) | Front | C10 | ✅ Culminado | — | 2026-10-30: cámara en vivo o subida; E2E con subida verificado en vivo. Se prueba en `localhost`; sin cámara/contexto seguro ofrece siempre "Subir una foto" |
| C14 | Seguimiento: estado, repetición, descarga de constancia | Front | C12 | ✅ Culminado | — | 2026-10-30: constancia FV-2026-000001 descargada y revisada |
| C15 | Vista Bienestar: bandeja, detalle con selfie y comparativo de cambios propuestos, botones por permiso | Front | C5, R-6a | ✅ Culminado | — | 2026-10-302026-10-30. Ampliada el 2026-10-30: el detalle muestra la **ficha completa** del pasivo (datos personales, pensión, contacto, vivienda, grupo familiar) con lo que declara en el acta («Nuevo» / «Modificado» + «Antes»), solo con `fe_de_vida.revisar`; la **foto la sirve el backend** (`GET solicitudes/<id>/evidencia/` devuelve los bytes por streaming; ya no hay URL prefirmada porque el host `sw-s3` no es alcanzable desde el navegador) y el front la carga con una Server Action y un object URL |
| C16 | Reporte/listado de pasivos sin correo o sin cuenta para RRHH (RRHH les carga el correo; el login es por correo) | Back/Front | A9, V-1 | ✅ Culminado | — | 2026-10-30: backend `cobertura/pasivos/` y UI `/personal/fe-de-vida/cobertura` |
| C17 | Gestión de procesos y prórrogas: crear/abrir/cerrar proceso (apertura, cierre, alcance), cierre automático por beat, prórroga individual (cédula) o general, historial por proceso | Back | C1, C2, A1 | ✅ Culminado | — | 2026-10-30: backend hecho (procesos, prórrogas, beat de cierre cada 15 min); falta la UI (C18) |
| C18 | UI Bienestar de procesos y prórrogas (lista de procesos, crear/abrir/cerrar, prórroga individual y general, avance del proceso) y UI del pasivo (proceso vigente, estado, historial por proceso) | Front | C17, C10 | ✅ Culminado | — | 2026-10-30 |
| C19 | Aplicar al aprobarse el acta los cambios propuestos a los datos reales (nombres, apellidos, fecha de nacimiento, teléfonos, correo alternativo, contacto de emergencia, vivienda, hijos nuevos y corregidos, tiene_hijos), reutilizando `aplicar_cambios_aprobados` de B3 en una transacción | Back | C3, B3, B13 | ✅ Culminado | — | 2026-10-30: test de integración contra la BD de pruebas |
| C21 | Retirar mi check y acciones por revisor: quien ya dio su check no puede dar otro, devolver ni rechazar (409); la Administradora conserva la aprobación directa; `acciones_disponibles` las calcula el dominio y la interfaz solo las pinta; «Retirar mi check» con justificación (5 palabras / 20 caracteres, sin HTML) devuelve la solicitud a `PENDIENTE_REVISION`, queda como decisión `CHECK_RETIRADO` (migración 0004, solo `choices`), auditoría `CHECK_RETIRADO` y aviso a Bienestar sin correo | Back/Front | C3, C15 | ✅ Culminado | — | 2026-10-30: `POST solicitudes/<id>/retirar-check/`; el mensaje de estado muestra el nombre y el rol legibles de quien dio el primer check |
| C-T | Tests de Fase 4 (transiciones, procesos y prórrogas, aplicación de cambios al aprobar, imagen, atomicidad, E2E con cámara falsa y E2E con subida de archivo sin cámara, rechazo de archivo inválido) | Test | C5, C13, C17, C19 | ✅ Culminado | — | 2026-10-30: backend 869 passed; Vitest 500 passed; E2E fe-de-vida 5/5 en vivo; flujo completo hasta VALIDADA con correo y PDF |

**Regresiones y pendientes de Gestión de Trabajadores (auditoría 2026-10-29, `AUDITORIA_GESTION_TRABAJADORES_2026-10-29.md`)**

Decisión del usuario 2026-10-29: se abordan **después de culminar la Fase 4 (fe de vida)**. Antes de corregir, cada hallazgo se verifica **en vivo con Playwright** (la auditoría fue solo estática) y se cierra también con una prueba en vivo.

Cierre del bloque G1–G4 (2026-10-30): ver `REPORTE_G1_G4.md` en la raíz (archivos, pruebas con números, verificación en vivo y pendientes). G5–G8 siguen pendientes.

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| G1 | Reporte de trabajador: restaurar filtros de estructura organizativa (ocultos desde 09eaaa1 por `tienePermiso(permisos,"*")`; usar un permiso por código) | Front | — | ✅ Culminado | — | 2026-10-30: `organizacion.ver` (el permiso que exigen los catálogos del backend; ningún rol recibe `*`). Constantes en `domain/value-objects/permisos-reportes.ts` y predicados en `application/use-cases/permisos-reporte.ts`; aplicado a empleados, códigos, egresados y familiares. E2E: visible con el permiso y oculto sin él |
| G2 | Reporte de trabajador: el PDF no se genera o el error no se ve (`onSubmit` solo hace console.error y resetea el formulario); mostrar error, confirmar permiso `reportes.generar_pdf` | Front/Back | — | ✅ Culminado | — | 2026-10-30: causa raíz en vivo: `OrganismoAdscritoModel` no tiene `nombre` (`AttributeError` → **500** en JSON/PDF/Excel; también en códigos y en el motivo de egreso de pasivos). Corregido; `onSubmit` muestra el error con `toast.error`, no limpia filtros y el proxy propaga el estado real (403/400/500). El permiso `reportes.generar_pdf` se exige en backend (403 verificado) y en la UI (botón desactivado + aviso). E2E `reportes-trabajador.spec.ts` |
| G3 | Reporte de trabajador: el backend solo aplica ~11 de ~30 filtros del formulario y descarta agrupar_por/tipo_reporte; tope de 500 filas sin aviso | Back | G1 | ✅ Culminado | — | 2026-10-30: los 30 filtros se traducen con `ReportFieldRegistry` (única fuente) en `domain/services/filtros_reporte_personal.py`; filtro desconocido → 400; `agrupar_por`/`tipo_reporte` aplicados (conteo agrupado); tope `REPORTES_MAX_FILAS` (5000, 0 = sin tope) con `truncado` en metadatos, cabeceras `X-Reporte-*` y aviso en la UI. En vivo: 1022 filas (el `qs[:500]` anterior habría cortado el reporte a la mitad) y `edad_min=999` → 0. **Revisión de código 2026-10-30 (A1/M2/M3/M5/M7/B6):** valores extremos ahora dan 400 (edad 0–150, enteros `0 < n < 2³¹`, decimales finitos), `conteo` cuenta empleados distintos y muestra el texto del catálogo (cargo/grado), los filtros de estructura exigen `organizacion.ver` también en el servidor (403) y el PDF usa su propio tope `REPORTES_MAX_FILAS_PDF`. **Pendientes de datos:** (1) `G10` — «Fecha APN» sigue sin definir por RRHH (se ocultó el filtro en la UI; el mapeo del backend no se toca); (2) `G9` — «Años APN» filtra por la columna `Employee.total_anos_apn`, que mantiene el trigger legado `trg_actualizar_apn` (días/365.25 e incluye antecedentes abiertos) y **difiere del cálculo oficial 30/360 de D-05**. **Segunda revisión 2026-10-30 (ALTA 1 / MEDIA 2-3 / B4-B7):** el permiso de estructura se resuelve con el motor IAM real (`usuario_tiene_permiso`, con deny prioritario y comodines) y el dominio recibe un booleano (antes se comparaba contra `allow`, fallo abierto); las asignaciones y antecedentes de la página se piden en lotes sobre la misma lista materializada (la subconsulta con `LIMIT` sin `ORDER BY` traía datos de otros empleados en reportes truncados) y la fecha de ingreso es el **reingreso más reciente** (`Max`, decisión explícita). `limite` obligatorio y solo dígitos ASCII en los enteros |
| G4 | HU 0009: entrada de menú para `/configuracion/visual` con su permiso | Front | — | ✅ Culminado | — | 2026-10-30: «Configuración visual» en el sidebar con `configuracion.editar` y layout propio (`app/(app)/configuracion/layout.tsx`) para conservar el shell. Carnet y fe de vida NO usan el cintillo (decisión del usuario 2026-10-29): sin cambios |
| G5 | HU 0006 ampliada: «Documentos por movimiento» configurables desde el sistema. (1) Reglas: qué proceso genera qué documento (tipo de movimiento, motivo y nivel de estructura que cambia: dependencia, dirección general, de línea, coordinación/oficina; p. ej. traslado entre oficinas → punto de cuenta; pase a pasivo → su documento). (2) Tipos de documento (punto de cuenta, constancia, notificación de movimiento, otros). (3) Plantillas del formato con variables que el sistema rellena (nombre, cédula y cargo del trabajador; cargo/oficina de origen y destino; fecha y motivo; aprobador; número correlativo; cintillo). Genera el PDF, lo deja descargable desde el movimiento y avisa del éxito | Back/Front | D9 | ⏳ Pendiente | — | Parcial, L. Pedido del usuario 2026-10-30 |
| G6 | HU 0008 movimientos: imprimir en el PDF los filtros aplicados, exportar a Excel, validar RN-008-01 también en backend, quitar tope silencioso de 300 filas (paginación) | Front/Back | — | ✅ Culminado | — | 2026-10-30: `FiltrosHistorial` y `Paginacion` en el dominio (RN-008-01 → `ValidationError` 400; 10 por defecto, tope 50); listado paginado en el servidor con orden total `-fecha_movimiento, -pk` y `select_related` en lote; el PDF imprime los filtros aplicados con etiquetas legibles y el aviso de truncado; nuevo `GET /api/v1/movimientos/excel/` con los mismos filtros; tope `REPORTES_MAX_FILAS*` (5000) y cabeceras `X-Reporte-*` con helpers compartidos (`core/infrastructure/reportes.py`, `core/presentation/descargas.py`); UI con total, paginación, PDF y Excel (descarga por `/api/movimientos/{pdf\|excel}`, que propaga las cabeceras) y aviso de tope. Backend 1028 (28 nuevos), Vitest 562, E2E `movimientos-reporte.spec.ts` 6/6 en vivo |
| G7 | Eliminar el código legado duplicado de `src/app/(protected)/dashboard` | Front | D1 | ✅ Culminado | — | 2026-10-30: borrados los 9 archivos de `src/app/(protected)` (shell, selector de módulos y registro legado de jubilados) y lo que solo colgaba de ellos (`src/shared/forms/employees` con 16 formularios, `shared/hooks/useEmployeeSearch`, `api/getInfoRac`); `(auth)/censo-vivienda` migrado a `getEmpleadoPorCedulaAction` (módulo personal) con `useBusquedaEmpleado`; `/dashboard` redirige a `/inicio` (proxy, login y sidebars) y los E2E de sesión apuntan a `/inicio`. E2E nuevos `rutas-legado.spec.ts` 3/3 y `auth-sesion.spec.ts` 4/4 en vivo. `tsc`, `eslint` 0 errores y `next build` OK |
| G8 | Notificar en el sistema (correo por confirmar, mismo ajuste que B16) a Bienestar/RRHH (módulo personal, por permiso) cada movimiento de personal: ingreso, egreso, traslado, cambio de cargo, pase a pasivo, alta de sobreviviente y punto de cuenta generado; y al trabajador afectado (módulo autogestion) cuando corresponda | Back | A2, `cargo_movimiento_ejecutado` | ✅ Culminado | — | 2026-10-30: `solicitudes_de_movimiento` (dominio puro) traduce INGRESO, TRASLADO, CAMBIO DE ESTATUS, EGRESO y ALTA DE SOBREVIVIENTE a avisos por el permiso nuevo `personal.recibir_avisos_movimientos` (bandeja `personal`, roles 1, 2 y 5) y al trabajador (bandeja `autogestion`, nunca en egreso ni en alta de sobreviviente); el alta de sobreviviente se distingue por el emisor `RepoSobrevivientesORM`; idempotencia por `ref_id`/`clave` = id del movimiento; se emite en `transaction.on_commit` desde el receiver de `cargo_movimiento_ejecutado` y un fallo al notificar no revierte el movimiento; correo detrás de `NOTIFICAR_MOVIMIENTOS_POR_CORREO` (False). El punto de cuenta se genera en el mismo traslado y se cubre con el aviso de traslado. En vivo: cargo 109050 / empleado 3333333 → SUSPENDIDO, aviso visible en `/personal/notificaciones`, restaurado a ACTIVO; datos de prueba eliminados (ver `REPORTE_G6_G7_G8.md`) |
| G9 | Antigüedad APN oficial (D-05: 30/360, solo antecedentes cerrados) en filtros y columnas: el filtro «Años mín./máx. en la APN» y la columna «años APN» del reporte, y autogestión (`repo_autogestion_orm.py:230`, `excel_service.py:98`) leen hoy `Employee.total_anos_apn`, que mantiene el trigger legado `trg_actualizar_apn` (días/365.25, incluye antecedentes abiertos). Calcularla en la consulta (anotación SQL 30/360) o guardarla en un campo filtrable propio, sin tocar la columna ni el trigger legados; test de paridad con `calcular_total_apn` y muestra real ≥200 empleados con 0 diferencias | Back | G3 | ⏳ Pendiente | — | Decisión del usuario 2026-10-30: corregir, en tarea aparte (no mezclar con las correcciones de G1–G4) |
| G10 | Filtro «Fecha APN desde/hasta» del reporte de trabajador: hoy filtra por `antecedentes_servicio.fecha_ingreso` (igual que «Fecha de ingreso»). Oculto en la UI hasta que RRHH confirme qué significa (¿inicio en la APN, egreso, otra columna?) | Front/Back | — | 🔄 En proceso | — | 2026-10-30: los dos campos se ocultaron del formulario del reporte de trabajador (M8, revisión del commit e481320); el mapeo del backend se conserva y «Años APN» no se toca. Pregunta abierta para RRHH: ¿«Fecha APN» es inicio en la APN, egreso u otra columna? |
| G11 | Resto de reportes (códigos, familiares, egresos, pasivos, vacantes): quitar el tope fijo `[:500]` sin orden (usar `limite` configurable + aviso de truncado, orden total determinista, página en lotes, sin N+1); egresos usa el reingreso más reciente (`Max`), como G3; en todos los reportes, con varias asignaciones mostrar la activa o la más reciente (hoy «la última gana» sin orden) | Back/Front | G3 | ✅ Culminado | — | 2026-10-30: reglas compartidas en `infrastructure/repositories/consultas_reporte.py` (página + metadatos de truncado, lotes, fecha de ingreso = `Max`, asignación ACTIVA o la más reciente con desempate por PK). Los cuatro reportes usan `limite` obligatorio con `limite_de_reporte` (PDF vs JSON/Excel), orden total determinista (código/PK en códigos y vacantes; apellidos/nombres/cédula en familiares y egresos), `X-Reporte-*` en PDF/Excel y aviso de truncado en las 3 pantallas restantes. Egresos ya no hace 3 consultas por fila. Tests de integración por reporte (truncado, orden estable, reingreso, asignación activa). Hallazgos P1–P3 de la revisión final de G3 |
| G12 | Seguimiento de la revisión de G6–G8: (1) aviso al trabajador que también recibe avisos de RRHH se descarta como duplicado (la clave única no incluye el módulo) → clave propia del aviso del trabajador; (2) `NOTIFICAR_MOVIMIENTOS_POR_CORREO` en `.env.example`; (3) botones PDF/Excel de movimientos según `movimientos.exportar_pdf`/`exportar_excel`; (4) comentario obsoleto `/dashboard` en login-form; (5) alta de sobreviviente identificada por nombre de clase en `movimientos/receivers.py` → campo `origen` en el evento; (6) test de número de consultas del listado; (7) eliminar la página vieja `(auth)/censo-vivienda` (sin enlaces; el censo vigente es /autogestion/censo); (8) borrar el archivo de depuración `src/app/api/movimientos/[formato]/__debug.test.ts`; (9) decidir si ADMINISTRADOR recibe los avisos de movimientos (hoy 8 administradores los reciben) | Back/Front | G6, G7, G8 | ⏳ Pendiente | — | Revisión 2026-10-30: G6–G8 aptos; esto es seguimiento menor |

**Fase 5 — Usuarios por roles y permisos**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| D1 | `proxy.ts`, dashboard y sidebars por permisos | Front | A8 | ⏳ Pendiente | — | |
| D2 | Retirar departamento de `auth.config.ts`/`auth.ts`; re-sincronizar por `permisos_version` | Front | A4 | ⏳ Pendiente | — | |
| D3 | `departamento` opcional/deprecado en backend de identidad | Back | — | ⏳ Pendiente | — | |
| D4 | UI de usuarios (cédula + rol + permisos) y matriz de permisos; los usuarios de Bienestar se crean y asignan manualmente desde aquí | Front | D3, A4 | ⏳ Pendiente | — | |
| D5 | Datos: verificar que los roles de Bienestar creados en A4 estén completos | Back | A4, B14 | ⏳ Pendiente | — | El renombre pasó a B14; no hay asignación automática de usuarios (la hace el usuario manualmente); el acceso de pasivos no requiere conversión de cuentas (C7) |
| D6 | Tests de regresión rol→rutas (Vitest y Playwright) | Test | D1, D5 | ⏳ Pendiente | — | |
| D7 | Estructura de roles (CONFIRMADA 2026-10-29, 4.3.14): ADMINISTRADOR, AUDITOR (solo lectura), JEFE_RRHH, ADMIN_BIENESTAR, ANALISTA_BIENESTAR, ADMIN_CAPTACION/ANALISTA_CAPTACION (futuro); seed, permisos y tests | Back/Test | A4, 4.3.14 | ⏳ Pendiente | — | Bloqueado hasta que el usuario confirme la estructura (matriz 2.4) |
| D8 | Ciclo de vida de cuentas (decisión F de 0.1): alta automática al tener correo (activo) o al cargarlo RRHH (pasivo/sobreviviente); contraseña inicial = cédula con cambio obligatorio, vencimiento a 7 días, "Restablecer acceso" de RRHH y aviso por correo al cambiarla; pase a pasivo con elección del correo de acceso y aviso; egreso desactiva la cuenta y revoca sesiones | Back/Front | A4, A9, C20 | 🔄 En proceso | — | 2026-10-29: backend y «Restablecer acceso» hechos y desplegados en local (migraciones 0008/0009, seed). Egreso solo por categoría EGRESO real (FALLECIMIENTO no existe como categoría en BD: el fallecimiento entra por EGRESO). Pendiente: pantalla de RRHH para elegir el correo de acceso (endpoint listo) |
| D9 | Renombrar el módulo «Seguridad» a «Administración del sistema», con dos apartados: «Usuarios y roles» (lo actual) y «Configuración» (parámetros del sistema en una tabla propia managed=True, auditados, editables con `configuracion.editar`, sin reinicio): cintillo/identidad visual (HU 0009, absorbe G4), notificaciones por correo a Bienestar (hoy el ajuste `NOTIFICAR_BIENESTAR_POR_CORREO` en .env), reglas, tipos y plantillas de «Documentos por movimiento» (G5), plazos (vencimiento de la contraseña inicial; ventanas de autogestión: plazo propuesto por defecto, máximo de prórrogas y anticipación del aviso de vencimiento; recordatorios de fe de vida). `.env` queda solo para lo técnico | Back/Front | D1, A4 | ⏳ Pendiente | — | Pedido del usuario 2026-10-29 |
| D10 | Bitácora de auditoría en «Administración del sistema» (solo lectura): tabla con fecha y hora, usuario (cédula y nombre), rol, acción, módulo y recurso afectado, IP, navegador o dispositivo, resultado y detalle (estado anterior y nuevo, con sus diferencias). Paginación en el servidor (10 por defecto, tope 50) y filtros (usuario, acción, módulo, recurso, IP, rango de fechas, resultado). Exportación a PDF y Excel con los filtros aplicados (`auditoria.exportar`). Pestaña de incidentes de seguridad: bloqueos e intentos fallidos (`auditoria.ver_seguridad`). Consulta con `auditoria.ver_logs`, accesible al rol AUDITOR. Índices por fecha, usuario y acción | Back/Front | A6, D9 | ⏳ Pendiente | — | Pedido del usuario 2026-10-30. Hoy existen la tabla `AuditoriaLog` y los permisos, pero no hay API ni pantalla. Se complementa con E1 (hash encadenado) |

**Fase 6 — Rediseño institucional y PWA**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| R-5 | PWA: manifest, service worker, offline, instalación | Front | — | ⏳ Pendiente | — | Se prueba en `localhost`; el SW no cachea `/api/` ni evidencias |
| R-6b | Sistema visual en consultar, métricas, censo, login y selector de módulos | Front | R-1 | ⏳ Pendiente | — | Resto de la etapa 6 Hallazgo del usuario 2026-10-29: en /recuperar-password y /restablecer-password la imagen `logoLogin.png` (panel derecho, `object-cover` en un panel angosto de 364×660) recorta el logo y el nombre CONATEL; usar `object-contain` o un arte adaptado al panel, y revisar también /login Hallazgo 2026-10-29: en /cargos, el menú «Acciones» de cada fila tiene una opción «Ver Detalle» que sobra; quitarla |
| R-6c | Un solo sistema de interfaz para todos los módulos: hoy Autogestión (shell institucional nuevo de R-1) es completamente distinta al resto (sidebar, cabecera, tipografía, espaciados). Unificar en UN shell y UN sidebar compartidos (mismos componentes, tokens y estructura de navegación; cada módulo solo aporta sus entradas por permiso), sin perder la accesibilidad de Autogestión (tamaños para usuarios mayores). Revisión de maquetación con la skill `impeccable` (posición de textos, alineación, espaciado interno entre texto y bordes de contenedores, ritmo vertical) más `web-design-guidelines` y capturas antes/después en escritorio y 390 px | Front | R-1, R-6b | ⏳ Pendiente | — | Pedido del usuario 2026-10-29. La skill `impeccable` no está instalada hoy: instalarla (find-skills) al iniciar la Fase 6 Skills de diseño obligatorias para toda la Fase 6 (decisión del usuario 2026-10-29): `ui-ux-pro-max`, `impeccable` (instalar), `design-taste-frontend` (taste-skill), `apple-design`, `redesign-existing-projects` (auditoría previa del diseño actual), `web-design-guidelines`, `emil-design-eng` (pulido de detalles), `mobile-first-design` y `mobile-native` (móvil), `building-components` (componentes compartidos accesibles), `break-ui` (datos extremos: nombres largos, listas vacías) y `testing-a11y-axe` |
| R-A | Revisión final de accesibilidad con usuarios mayores (axe 0 violaciones) | Test | R-5, R-6b | ⏳ Pendiente | — | |

**Fase 7 — Endurecimiento y auditoría**

| ID | Tarea (breve) | Capa | Depende de | Estado | Responsable | Notas |
|---|---|---|---|---|---|---|
| E1 | Auditoría con hash encadenado, user-agent, dispositivo, trace_id | Back | A6 | ⏳ Pendiente | — | |
| E2 | Rate limiting, antivirus opcional, límites de tamaño | Back/Infra | — | ⏳ Pendiente | — | |
| E3 | Observabilidad del worker y alertas por FALLIDA | Back | A3 | ⏳ Pendiente | — | |
| E4 | Pruebas de seguridad, cabeceras y CSP | Test | Fases 2–4 | ⏳ Pendiente | — | Hallazgo 2026-10-29: tras cada despliegue, las pestañas abiertas fallan con «Failed to find Server Action» y caen en la pantalla «Error al cargar la aplicación»; detectar ese error y recargar la página sola |
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
| Fase 1 | (Cerrada.) Nombre real del rol "BIENSTAR SOCIAL" (R6) se verifica en `V-1`/`B14` |
| Fase 2 | Ninguna: 4.3.2 (plazo configurable y prorrogable) y 4.3.6 (una sola aprobación) quedaron RESUELTAS el 2026-10-29 |
| Fase 3 | Probar el relay SMTP institucional (R11; remitente `gath@conatel.gob.ve` ya en `.env`); 4.3.3 resuelta (RRHH carga los correos faltantes) |
| Fase 4 | ADR de aprobación directa (R9). Resueltas: formato de constancia y correo (2.11); 4.3.1, 4.3.3, 4.3.4, 4.3.7, 4.3.8, 4.3.11, 4.3.12, 4.3.13 |
| Fase 5 | 4.3.14 (estructura de roles propuesta, abierta; solo bloquea `D7`) |
| Fase 6 | P1 resuelta (no hay manual de identidad, se usa la paleta provisional); P2, P3 y P6–P10 de la sección 7 del plan de rediseño; P4 la resuelve Infraestructura (dará acceso externo) |
| Fase 7 | Ninguna (4.3.9: MFA queda para una fase posterior, fuera de este ciclo); 4.3.11 resuelta (la selfie se conserva) |

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
| Distinguir jubilado/pensionado, sobreviviente/invalidez, especial/ordinaria (campos del acta física) | Parcial | Solo existe `motivo_egreso` (`TipoMovimientoModel`); el motivo es texto libre de catálogo. `procesar_egreso.py:1-32` documenta que `ejecutar_creacion_sobrevivientes` está fuera de alcance (ahora se incluye: tarea `C20`). Falta un catálogo claro de tipo de pensión/jubilación (ver 2.2) |
| Pasivo conserva cuenta y puede iniciar sesión | Parcial / por verificar en BD | `CuentaModel` es 1:1 a `Employee` por cédula (`identidad/infrastructure/models/cuenta_models.py:61-67`); el pase a pasivo no toca la cuenta; el login (`auth_views.py:109`) solo revisa `cuenta.is_active`. Si el pasivo tiene cuenta con rol AUTOGESTION, entra. `proxy.ts:17-21` lo envía a `/autogestion`. **Verificar** con SQL: pasivos con cuenta, con correo y con `is_active` |
| Rol/permisos para el pasivo | Resuelto (A4/A9) | No hay rol propio: el rol 3 AUTOGESTION concede `fe_de_vida.solicitar`/`ver_propia`; que el trabajador sea pasivo se decide por su condición (A9, validada en servidor). Un pasivo no debe ver "Mi carnet" activo ni el censo laboral: esas entradas exigen condición ACTIVO |
| Datos de contacto del pasivo | Parcial | `Employee.correo` (unique) y teléfonos existen; **no existe** correo alternativo (ver 2.10); cobertura real de correo en pasivos desconocida (el conteo se hace en `V-1`; RRHH carga los faltantes, reporte `C16`) |
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

Decisión del usuario (2026-10-29): la solicitud la inicia el **trabajador**; Bienestar Social **habilita** una ventana con plazo que Bienestar configura y puede **prorrogar**; el trabajador carga cambios y soportes y envía; **una sola persona** (Analista **o** Administradora de Bienestar) aprueba campo por campo. No hay doble aprobación en autogestión.

```
SOLICITADA ──(Bienestar habilita ventana: secciones + plazo configurado por Bienestar)──> HABILITADA
SOLICITADA ──(Bienestar rechaza con motivo)──────────────────> RECHAZADA
HABILITADA ──(Bienestar prorroga: nueva fecha límite + motivo)─> HABILITADA  (repetible)
HABILITADA ──(trabajador guarda borrador, repetible)─────────> HABILITADA
HABILITADA ──(trabajador envía; valida soportes)─────────────> ENVIADA
HABILITADA ──(vence plazo sin prórroga; tarea programada)────> EXPIRADA
ENVIADA    ──(UNA persona: Analista o Administradora; revisión campo por campo)──> APROBADA | APROBADA_PARCIAL | RECHAZADA
EXPIRADA   ──(trabajador solicita de nuevo)──────────────────> nueva SOLICITADA
```

Reglas: una solicitud abierta por trabajador y sección (restricción única parcial); la ficha activa **solo se modifica en la transición a APROBADA/APROBADA_PARCIAL**, dentro de `transaction.atomic`, escribiendo únicamente los campos aprobados mediante los puertos de `personal`/`familiares`/datos complementarios; cada decisión por campo lleva `motivo` obligatorio si se rechaza; rechazo total exige motivo; la decisión la toma **una sola persona** con el permiso `bienestar.aprobar` (rol `ANALISTA_BIENESTAR` o `ADMIN_BIENESTAR`), que queda registrada como `decidida_por`; el trabajador no puede editar fuera de las secciones habilitadas (validación en servidor); `bloqueo optimista` por `version`. Campos no autogestionables (identidad, cargo, oficina, estatus) se rechazan en el serializer. Cambio de correo institucional (login): validar formato y unicidad contra `Employee.correo` (unique); el correo alternativo se guarda en la tabla complementaria (2.10). Foto de carnet aprobada dispara notificación/alerta de reemisión a Carnetización.

Secciones autogestionables por defecto (catálogo `SeccionAutogestionable`, según la propuesta): **contacto** (teléfonos, correo alternativo, contacto de emergencia), **vivienda**, **formación** (soporte obligatorio), **familiares** (soporte obligatorio) y **foto**. No autogestionables: identidad, cargo, oficina y estatus. El catálogo ya no lleva el parámetro `requiere_doble_aprobacion`.

### 2.2 Máquina de estados: Fe de vida, adaptada a la regla del usuario

**Procesos/períodos (decisión 2026-10-29).** La fe de vida no se programa con periodicidad fija: funciona por **procesos** que gestiona Bienestar Social (p. ej. "Fe de vida 2026-2027"). Cada proceso tiene tipo `FE_DE_VIDA`, nombre, fecha de apertura, fecha de cierre, estado y alcance (todos los pasivos o un subconjunto). RRHH decide la periodicidad al abrir cada proceso; quien no cumple no recibe sanción automática: el proceso se cierra y el caso queda a criterio de RRHH.

```
Proceso:  BORRADOR ──(Bienestar abre; o por fecha de apertura)──> ABIERTO ──(Bienestar cierra; o por fecha de cierre, beat)──> CERRADO
```

- Con el proceso **ABIERTO** el pasivo puede crear y enviar su solicitud. Con el proceso **CERRADO** nadie puede crear ni enviar, salvo con **prórroga**: **individual** (a una cédula) o **general** (a todos), con nueva fecha límite, motivo y autor. Las solicitudes ya enviadas antes del cierre siguen su revisión normal.
- Habrá múltiples procesos en el tiempo. En cada proceso nuevo el pasivo **vuelve a llenar todo** y a tomar o subir la foto; las solicitudes de procesos anteriores quedan como **historial por proceso** (no se reutilizan ni se pisan). Una sola solicitud por pasivo y proceso (restricción única `(proceso, cedula)`; los reenvíos tras una repetición son versiones de la misma solicitud).
- La primera vez y la renovación son **el mismo trámite** (un proceso nuevo).
- Recordatorios previos al cierre: configurables por proceso (cuántos días antes, si se usan o no), enviados por beat en las Fases 3 y 4.

Estados de la solicitud: `BORRADOR → PENDIENTE_REVISION → PENDIENTE_SEGUNDO_CHECK → VALIDADA`; `RECHAZADA`; `REPETICION_SOLICITADA`; `ARCHIVADA`; `EXPIRADA` (el proceso cerró, y no hubo prórroga, mientras estaba en `BORRADOR` o `REPETICION_SOLICITADA`; no genera sanción automática).

```
BORRADOR ──envío (proceso ABIERTO o con prórroga)──> PENDIENTE_REVISION
# Flujo normal: doble check, orden indistinto (RN-03, RN-22)
PENDIENTE_REVISION ──primer check (Analista o Administradora, quien llegue primero)──> PENDIENTE_SEGUNDO_CHECK
PENDIENTE_SEGUNDO_CHECK ──segundo check (el otro rol; el mismo actor no cuenta dos veces)──> VALIDADA
# Excepción: aprobación directa de la Administradora (justificación obligatoria)
PENDIENTE_REVISION | PENDIENTE_SEGUNDO_CHECK ──Administradora: aprobación directa (fe_de_vida.aprobar_directo)──> VALIDADA
# Rechazo / repetición: cualquiera de las dos, con motivo obligatorio
PENDIENTE_REVISION | PENDIENTE_SEGUNDO_CHECK ──Analista o Administradora: rechaza (motivo)──> RECHAZADA
PENDIENTE_REVISION | PENDIENTE_SEGUNDO_CHECK ──Analista o Administradora: solicita repetición (motivo)──> REPETICION_SOLICITADA
REPETICION_SOLICITADA ──pasivo reenvía nueva toma (proceso ABIERTO o con prórroga)──> PENDIENTE_REVISION  (nueva versión; los checks previos quedan en historial y no se reutilizan)
BORRADOR | REPETICION_SOLICITADA ──proceso CERRADO sin prórroga──> EXPIRADA
VALIDADA ──(aplica los cambios aprobados a los datos reales; genera PDF, notifica y envía correo)──> VALIDADA con constancia emitida; luego ARCHIVADA por política
```

**La fe de vida también actualiza los datos reales.** Las respuestas del acta (nombres, teléfonos, dirección, hijos, etc.) son **cambios propuestos** (`CambioPropuesto`, mismo mecanismo que la autogestión, ver 2.3 y 2.9). Se aplican a las tablas reales **solo al llegar a `VALIDADA`** (tras la doble aprobación o la aprobación directa), en una transacción, con `aplicar_cambios_aprobados` (`C19`). No se duplican las tablas de familiares, contactos ni vivienda.

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

**¿Aplica también a las solicitudes de autogestión?** **No** (decisión del usuario, 2026-10-29; pregunta 4.3.6 RESUELTA). En la autogestión del activo aprueba **una sola persona**, la Analista **o** la Administradora de Bienestar, campo por campo (total, parcial o rechazo con motivo), sin doble aprobación y sin aprobación directa (ver 2.1). Por eso se elimina el parámetro `requiere_doble_aprobacion` del catálogo de secciones y los permisos `bienestar.check_analista`, `bienestar.check_administradora` y `bienestar.aprobar_directo` quedan reemplazados por `bienestar.aprobar`. La doble aprobación y la aprobación directa aplican **solo a la fe de vida**.

### 2.3 Modelo de datos nuevo (tablas `managed=True`; no se tocan legadas salvo al aplicar cambios aprobados)

Apps nuevas en `apps/`: `notificaciones` (transversal), `fe_de_vida`; `autogestion` se extiende con modelos nuevos (los 4 legados de censo no se tocan). Todos extienden `BaseModel` (uuid7, auditoría de fechas) de `core/infrastructure/models/base.py`.

Autogestión (en `apps/autogestion/infrastructure/models/`):

- `SolicitudActualizacionModel`: `id`, `cedula` (CharField, no FK dura a legada, indexado, coherente con el patrón `rol_id` entero de `RolPermisoModel`), `estado`, `secciones_solicitadas` (JSON), `motivo`, `ventana_inicio`, `ventana_fin`, `plazo_dias` (lo configura Bienestar al habilitar), `habilitada_por`, `decidida_por` (una sola persona), `motivo_decision`, `version`, `fecha_envio`, `fecha_decision`.
- `ProrrogaVentanaModel`: `solicitud` FK, `fecha_fin_anterior`, `fecha_fin_nueva`, `motivo`, `prorrogada_por`, `fecha`; inmutable (la ventana vigente es la última prórroga).
- `CambioPropuestoModel` (**compartido con la fe de vida**): `origen_tipo` (ACTUALIZACION|FE_DE_VIDA) y `origen_id` (uuid de la solicitud de actualización o de la solicitud de fe de vida), `seccion` (contacto|vivienda|formacion|familiar|foto|identidad_corregible|complementarios), `accion` (MODIFICAR|CREAR), `entidad_destino`, `entidad_id` (nulo si CREAR), `campo`, `valor_anterior` (JSON), `valor_propuesto` (JSON), `decision` (PENDIENTE|APROBADO|RECHAZADO), `motivo_decision`, `decidido_por`, `fecha_decision`. En autogestión lo decide una persona; en fe de vida se aplica al llegar el acta a `VALIDADA`.
- `SoporteDocumentalModel`: `solicitud`/`cambio` FK, `tipo` (TITULO|ACTA_NACIMIENTO|CONSTANCIA|OTRO; en fe de vida la partida de nacimiento de un hijo es **opcional**), `clave_s3`, `mime_real`, `tamano_bytes`, `sha256`, `nombre_original`. Una sección con soporte obligatorio no se puede enviar sin al menos un soporte.
- `SeccionAutogestionableModel` (catálogo configurable): `codigo`, `nombre`, `requiere_soporte`, `activa`. Semilla con la tabla de la propuesta (contacto, vivienda, formación con soporte, familiares con soporte, foto). Sin `requiere_doble_aprobacion`: la autogestión se aprueba por una sola persona.
- `DatosComplementariosTrabajadorModel` (tabla `datos_complementarios_trabajador`, `managed=True`; detalle y verificación en 2.10): `cedula` única, `correo_alternativo`, `tiene_hijos` (booleano, nulo = sin declarar), `actualizado_en`, `actualizado_por`. Se crea en `B13` y la usan autogestión y fe de vida.

Fe de vida (en `apps/fe_de_vida/infrastructure/models/`):

- `ProcesoFeDeVidaModel` (proceso/período): `id`, `tipo` (`FE_DE_VIDA`; el campo permite otros tipos de proceso a futuro), `nombre` (p. ej. "Fe de vida 2026-2027"), `fecha_apertura`, `fecha_cierre`, `estado` (BORRADOR|ABIERTO|CERRADO), `alcance` (TODOS|LISTA de cédulas/filtro), `recordatorios_dias_antes` (JSON, configurable por proceso; vacío = sin recordatorios), `creado_por`, `cerrado_por`, `fecha_cierre_real`. Un cierre por fecha lo hace el beat; Bienestar también puede abrir y cerrar a mano.
- `ProrrogaProcesoModel`: `proceso` FK, `alcance` (GENERAL|INDIVIDUAL), `cedula` (nula si GENERAL), `nueva_fecha_limite`, `motivo`, `otorgada_por`, `fecha`; inmutable. Un envío fuera de plazo es válido solo si existe una prórroga vigente general o para la cédula.
- `TipoPensionJubilacionModel` (catálogo): `categoria` (PENSION_SOBREVIVIENTE, PENSION_INVALIDEZ, JUBILACION_ESPECIAL, JUBILACION_ORDINARIA), según los dos bloques de la planilla física. **Dato del sistema (egreso), solo lectura para el pasivo**; si falta o está mal, lo corrige RRHH.
- `SolicitudFeDeVidaModel` (antes `ActaFeDeVida`; el acta es el documento de la solicitud): `id`, `proceso` FK, `numero` correlativo único (`FV-AAAA-NNNNNN`), `cedula`, **restricción única `(proceso, cedula)`**, `tipo_pension`, `tipo_jubilacion` (copiados del sistema), `estado`, `idempotency_key` único, `version`, `evidencia_hash`, `origen_dato` (SISTEMA|CONFIRMADO_MANUAL, RN-14), `plantilla_version`, `fecha_solicitud` (automática al enviar), `fecha_validacion` (automática). Ya **no** guarda un snapshot JSON paralelo de la planilla ni `vence_el`: las respuestas editables son filas de `CambioPropuestoModel` con `origen_tipo = FE_DE_VIDA` (valor anterior de los datos reales y valor propuesto), y los datos de solo lectura (cédula, área de adscripción, cargo, correo principal) se leen del sistema al emitir la constancia.
- Los **hijos** no tienen tabla propia en fe de vida: los hijos existentes se corrigen y los nuevos se agregan como `CambioPropuesto` (`seccion = familiar`, `accion` MODIFICAR|CREAR) sobre el módulo `familiares`. La partida de nacimiento es un `SoporteDocumental` **opcional**. "¿Tiene hijos?" es `DatosComplementariosTrabajador.tiene_hijos` (propuesto también como `CambioPropuesto`).
- `EvidenciaFeDeVidaModel`: `solicitud` FK, `clave_s3` (objeto privado), `mime`, `sha256`, `ancho`, `alto`, `origen_evidencia` (`CAMARA` | `ARCHIVO`, visible para Bienestar al revisar y registrado en auditoría), `metadatos_captura` (JSON: user-agent, método `getUserMedia|capture|file`, resolución, resultados de validación de calidad), `intento` (n). Reemplaza la firma y las huellas de la planilla física: no hay firma digitalizada. La selfie **se conserva** (decisión 2026-10-29).
- `DecisionActaModel`: `solicitud` FK, `actor_id`, `actor_cedula`, `rol`, `tipo` (CHECK_ANALISTA|CHECK_ADMINISTRADORA|APROBACION_DIRECTA|RECHAZA|SOLICITA_REPETICION), `motivo` (obligatorio en rechazo, repetición y aprobación directa; opcional en los checks normales), `fecha`; inmutable.
- `ConstanciaFeDeVidaModel`: `solicitud` 1:1, `numero`, `codigo_verificacion`, `sha256_pdf`, `clave_s3_pdf`, `plantilla_version`, `fecha_emision`, `enviada_a`, `estado_envio`, `certificada_por` (nombre y cédula de quien(es) aprobaron, tomados de `DecisionActaModel`; **sin firma digitalizada ni sello**).
- `PlantillaActaModel`: versionada (RN-19) con texto oficial de la constancia y campos de la planilla (RN-20). Semilla inicial con el texto observado en `constancia de fe de vida.jpeg`: "Se hace constar que el día [fecha] compareció el/la ciudadano(a) [nombre], titular de la C.I. [cédula], ante la Oficina de Gestión Humana de CONATEL para dejar constancia de su fe de vida", y los datos del funcionario que certifica: nombre y cédula de quien(es) aprobaron, tomados automáticamente (**sin firma digitalizada ni sello**). El texto de la imagen es la plantilla v1, editable por `ADMIN_BIENESTAR` (HU-0013); QR de verificación interna se mantiene como propuesta.

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
| `BIENESTAR_SOCIAL` (id 5, renombrar desde "BIENSTAR SOCIAL" a "BIENESTAR SOCIAL", tarea `B14`) | Corregir nombre (UPDATE con respaldo + literales del frontend) | Pasa a ser el rol base de personal de Bienestar (lectura, censo, reportes) |
| `ANALISTA_BIENESTAR` | Crear (varias analistas; las asigna el usuario manualmente) | Hereda lo del rol 5 + `bienestar.*` de revisión, `bienestar.aprobar` (autogestión: aprueba sola), `fe_de_vida.revisar`, `fe_de_vida.check_analista` (en fe de vida nunca aprobación directa) |
| `ADMIN_BIENESTAR` | Crear (varias administradoras; las asigna el usuario manualmente) | Todo lo anterior + `fe_de_vida.check_administradora`, `fe_de_vida.aprobar_directo`, `fe_de_vida.gestionar_procesos`, `fe_de_vida.prorrogar`, `bienestar.prorrogar_ventana`, parametrización |
| `PASIVO` | **No existe** (decisión del usuario 2026-10-29) | Ser activo o pasivo es la **condición** del trabajador (dato), no un permiso. Un solo rol `AUTOGESTION` da acceso al portal a ambos; el sistema detecta la condición y muestra la fe de vida solo a pasivos |
| `AUTOGESTION` | Mantener | Activos **y pasivos**; suma `autogestion.solicitar_actualizacion`, `autogestion.editar_borrador`, `autogestion.subir_soporte`, `fe_de_vida.solicitar`, `fe_de_vida.ver_propia` y `notificaciones.ver_propias` |

**Regla de condición (implementada en A9).** La condición ACTIVO / PASIVO / SIN_ASIGNACION es un **dato derivado** de la asignación laboral, no un rol ni un permiso:

- Criterio (`identidad/infrastructure/repositories/repo_condicion_trabajador_orm.py`, igual al de `apps/pasivos`): PASIVO si existe una `AsigTrabajo` con `Tipo_personal = PASIVO` o un registro en `EmployeeEgresado`; ACTIVO si tiene otra asignación; si no, SIN_ASIGNACION.
- Se expone en `GET /api/v1/identidad/auth/me/` como `condicion_trabajador` y viaja en la sesión de NextAuth.
- **Se valida en el servidor**, no solo en el menú: los endpoints de fe de vida del pasivo combinan `HasPermission('fe_de_vida.solicitar')` con `RequiereCondicion('PASIVO')` (`core/presentation/permissions.py`); un activo con el permiso recibe 403. Fallo cerrado si no hay cédula o resolutor.
- **Menú por permiso + condición** (`shared/lib/evaluador-iam.ts`, `permiso-menu.ts`): "Fe de vida" se muestra con `fe_de_vida.solicitar` Y condición PASIVO; las entradas exclusivas de activos (censo, solicitud de carnet) con su permiso Y condición ACTIVO.
- El paso de activo a pasivo **no cambia roles ni invalida sesiones**: la condición se recalcula en cada consulta de `/me/` y en cada petición protegida por el guard, así que el pasivo ve la fe de vida en su próximo inicio de sesión.

Nuevos códigos (se agregan a `PERMISOS_CATALOGO` de `seed_permisos.py`, convención `modulo.accion`):

| Código | Rol(es) |
|---|---|
| `autogestion.ver_propio`, `autogestion.actualizar_propio` (existentes; se usan por fin en `MiExpedienteView`) | AUTOGESTION |
| `autogestion.solicitar_actualizacion` | AUTOGESTION |
| `autogestion.editar_borrador` | AUTOGESTION (solo con ventana HABILITADA) |
| `autogestion.subir_soporte` | AUTOGESTION (soportes propios; activos y pasivos) |
| `bienestar.ver_solicitudes` | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `bienestar.habilitar_ventana` (con plazo configurable) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `bienestar.revisar_actualizacion` | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `bienestar.aprobar` (autogestión: una sola persona aprueba, total o parcial, o rechaza con motivo; reemplaza a los antiguos `bienestar.check_*` y `bienestar.aprobar_directo`) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `bienestar.prorrogar_ventana` (prorrogar el plazo de una ventana de autogestión) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `bienestar.configurar_secciones` | ADMIN_BIENESTAR, ADMINISTRADOR |
| `fe_de_vida.solicitar` | AUTOGESTION (el servidor además exige condición PASIVO) |
| `fe_de_vida.ver_propia` | AUTOGESTION (el servidor además exige condición PASIVO) |
| `fe_de_vida.revisar` (ver evidencia, rechazar, pedir repetición; no aprueba por sí solo) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `fe_de_vida.check_analista` (check de la Analista; deja el acta en `PENDIENTE_SEGUNDO_CHECK`, o la valida si ya existe el check de la Administradora) | ANALISTA_BIENESTAR |
| `fe_de_vida.check_administradora` (check de la Administradora, orden indistinto) | ADMIN_BIENESTAR |
| `fe_de_vida.aprobar_directo` (excepción: la Administradora valida sola; justificación obligatoria, auditoría `APROBACION_DIRECTA_ADMINISTRADORA`) | ADMIN_BIENESTAR |
| `fe_de_vida.ver_evidencia` (URL prefirmada corta de la selfie) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR, auditor |
| `fe_de_vida.verificar_constancia` (RN-23, interna) | Bienestar, RRHH |
| `fe_de_vida.ver_panel` (HU-0010) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR |
| `fe_de_vida.gestionar_procesos` (crear, abrir y cerrar procesos/períodos) | ADMIN_BIENESTAR, ADMINISTRADOR |
| `fe_de_vida.prorrogar` (prórroga individual o general de un proceso) | ADMIN_BIENESTAR, ANALISTA_BIENESTAR, ADMINISTRADOR |
| `fe_de_vida.ver_cobertura` (reporte de pasivos sin correo o sin cuenta, `C16`) | ANALISTA_BIENESTAR, ADMIN_BIENESTAR, JEFE_RRHH (propuesto) |
| `trabajadores.editar_correo_principal` (RRHH carga o corrige el correo institucional/login) | ADMIN_BIENESTAR, ADMINISTRADOR, JEFE_RRHH (propuesto) |
| `fe_de_vida.configurar_plantilla` (HU-0013) | ADMIN_BIENESTAR, ADMINISTRADOR |
| `notificaciones.ver_propias` | todos los autenticados |
| `notificaciones.administrar` (reintentos, fallidas) | ADMINISTRADOR |
| `auditoria.ver_logs` (existente) | ya cubre HU-0003; se agrega `auditoria.exportar` |

ADMINISTRADOR conserva todo (el seed ya le asigna el catálogo completo, `seed_permisos.py:128-129`).

**Estructura de roles propuesta (PROPUESTA PENDIENTE DE CONFIRMACIÓN salvo `AUDITOR`, confirmado como solo lectura; pregunta 4.3.14, tarea `D7`).** Lo pendiente no se implementa hasta que el usuario lo confirme; `ANALISTA_BIENESTAR` y `ADMIN_BIENESTAR` ya están decididos y se crean en `A4`.

| Rol | Alcance propuesto | Estado |
|---|---|---|
| `ADMINISTRADOR` | Superadministrador técnico; existe | Existe |
| `AUDITOR` | **Solo lectura** de todos los módulos y de la bitácora (HU-0003); sin permisos de escritura ni de decisión | **Confirmado** (2026-10-29) |
| `JEFE_RRHH` | Jefa de la oficina de RRHH; administra todo el módulo Gestión de Trabajadores (Bienestar, Captación, etc.) | Confirmado |
| `ADMIN_BIENESTAR` / `ANALISTA_BIENESTAR` | Administradora y analistas de Bienestar Social | Decidido (se crean en `A4`) |
| `ADMIN_CAPTACION` / `ANALISTA_CAPTACION` | Captación de personal | Confirmado (se implementa con el módulo de Captación) |


### 2.5 Notificaciones y correo

- **Bandeja/campana**: endpoints `GET /api/v1/notificaciones/` (paginado, `?no_leidas=1`), `GET /conteo/`, `POST /{id}/leer/`, `POST /leer-todas/`. Frontend: campana en el header con contador y panel; **polling cada 30–60 s** (`GET /conteo/` ligero, con `visibilitychange` para pausar en pestaña oculta). Se descarta SSE/WebSocket en esta fase (requiere ASGI/canal y afinar nginx; ~870+ usuarios hacen polling barato con Redis). Revisar en etapa E si hace falta SSE.
- **Difusión a Bienestar**: al crearse una solicitud se crea una fila por usuario con el permiso `bienestar.revisar_actualizacion` / `fe_de_vida.revisar` (consulta resuelta por `identidad`), no por nombre de rol.
- **Correo**: outbox + Celery. Task `notificaciones.enviar_correo_outbox` con `acks_late`, reintentos con backoff exponencial, `max_retries=5`, estado FALLIDO y alerta al administrador (HU-0005). Plantillas HTML institucionales. Fe de vida validada: correo al pasivo con el PDF adjunto (se lee de S3 en el worker; **no** se serializa el PDF en el mensaje de cola). Si el pasivo no tiene correo: notificación interna + marca "sin correo" en el panel de Bienestar; RRHH debe cargarle el correo (el login es por correo) con ayuda del reporte de pasivos sin correo o sin cuenta (`C16`). Remitente: `gath@conatel.gob.ve` vía `mail.conatel.gob.ve` (ya en `.env`). Recordatorios previos al cierre de un proceso: configurables por proceso (`ProcesoFeDeVida.recordatorios_dias_antes`).
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
7. **Datos**: el renombre de "BIENSTAR SOCIAL" a "BIENESTAR SOCIAL" es la tarea `B14` (Fase 2): UPDATE idempotente con respaldo previo de `USER_rol` y cambio de literales del frontend en el mismo despliegue. El script de roles (A4/D5): (a) verifica ese renombre y actualiza `RolPermisoModel`, (b) crea roles nuevos (Bienestar), (c) **no** reasigna usuarios: las analistas y administradoras de Bienestar las crea y asigna el usuario manualmente desde la UI de usuarios (D4). Los pasivos no se convierten a ningún rol: conservan `AUTOGESTION` y la condición se deduce de sus datos.

### 2.9 Datos del acta de fe de vida: origen, edición y destino

La fe de vida también actualiza los datos reales al aprobarse. Los campos editables generan `CambioPropuesto` (2.3) que se aplican con `aplicar_cambios_aprobados` (`C19`) cuando la solicitud llega a `VALIDADA`; no se crean tablas paralelas.

| # | Campo de la planilla | Origen | Edición | Destino al aprobarse |
|---|---|---|---|---|
| 1 | Tipo de pensión (sobreviviente/invalidez) y de jubilación (especial/ordinaria) | Sistema (egreso) | Solo lectura; si falta, lo corrige RRHH | — |
| 2-4 | Nombres, apellidos, fecha de nacimiento | Precargados desde `Employee` | **Editables** (corrección de errores de carga) | `Employee` (vía `RepoPersonal`) |
| 3 | Cédula | `Employee` | Solo lectura | — |
| 5-6 | Teléfono de habitación y celular | `Employee` | Editables | `Employee` |
| 7 | Correo principal (login) | `Employee.correo` | Solo lectura; lo cambia RRHH | — |
| 7b | Correo **alternativo** (personal/emergencia) | `datos_complementarios_trabajador` (2.10) | **Editable** (nuevo) | Tabla complementaria |
| 8 | Otra persona de contacto + celular | Contacto de emergencia existente (`ContactoEmergenciaModel`) | Editable | `ContactoEmergenciaModel` |
| 9 | Dirección de habitación | Vivienda (`DatosViviendaModel`) | Editable | `DatosViviendaModel` |
| 10 | Área de adscripción y cargo | Sistema (última asignación) | Solo lectura | — |
| 11 | "¿Tiene hijos?" | `datos_complementarios_trabajador.tiene_hijos` (nuevo, declarado por el trabajador aunque no haya entregado papeles) | Editable. UX: si marca SÍ aparece la sección de hijos (precargados desde familiares + agregar); si marca NO, la sección no aparece | Tabla complementaria |
| 12 | Hijos (nombres, cédula, teléfonos, correo) | Familiares existentes (`EmployeefamilyModel`) | Puede **agregar** hijos nuevos y **corregir** nombres, teléfonos y correo; partida de nacimiento **opcional** (personas mayores) | `RepoFamiliares` |
| 13 | Firma y huellas | — | Reemplazadas por la selfie con cédula (cámara o archivo), que se conserva | Evidencia (S3 privado) |
| 14 | Fecha | Automática (envío y validación) | No editable | `fecha_solicitud`, `fecha_validacion` |
| 15 | Funcionario que certifica | Automático: nombre y cédula de quien(es) aprobaron | No editable; **sin firma digitalizada ni sello** | `ConstanciaFeDeVida.certificada_por` |

El correo (institucional/login y alternativo) es un dato que el sistema debe gestionar para **todo el personal**, no solo pasivos (tarea `B13`).

### 2.10 Correo alternativo y "¿tiene hijos?": verificación y tabla complementaria

**Verificación (solo lectura, 2026-10-29).** `Employee` (tabla legada, `managed=False`, sin ALTER) solo tiene `correo` (único, es el correo principal/login), `telefono_habitacion`, `telefono_movil` y `carnet_patria`; su lista completa de columnas es `id, cedulaIdentidad, nombres, apellidos, fechaNacimiento, profile, fecha_actualizacion, estadoCivilId, sexoId, total_anos_apn, correo, telefono_habitacion, telefono_movil, carnet_patria, nacionalidadId`. Una consulta a `information_schema` sobre toda la BD solo devuelve las columnas `Employee.correo` y `auth_user.email` para `%correo%`/`%mail%`, y ninguna para `%hijo%`. **No existe ningún campo reutilizable** para correo alternativo/personal ni para "tiene hijos". (El contacto de emergencia existente, `ContactoEmergenciaModel`, guarda a otra persona, no un correo propio del trabajador.)

**Decisión.** Crear una tabla complementaria propia `managed=True`, ligada a la cédula, en `apps/personal` (o `apps/autogestion` si el equipo prefiere):

- `datos_complementarios_trabajador`: `id` (uuid7), `cedula` (única, indexada, sin FK dura a la legada, coherente con el patrón de las demás tablas nuevas), `correo_alternativo` (nulo, formato de correo, **sin** restricción de unicidad: puede repetirse, p. ej. un correo familiar), `tiene_hijos` (booleano nulo = no declarado), `actualizado_en`, `actualizado_por`.
- Acceso por puerto de dominio `RepoDatosComplementarios` (Onion) con implementación ORM; la lectura se expone en la ficha (`MiExpedienteView`) y en `/me/`; la escritura se hace por el flujo de autogestión (sección contacto, aprobada por una persona), por la fe de vida (al `VALIDADA`) y por RRHH directamente.
- Tarea: **`B13`** (Fase 2).

### 2.11 Constancia y correo (CONFIRMADO por el usuario el 2026-10-29)

Formato propuesto; no se implementa `C4`/`C6` definitivamente hasta que el usuario lo confirme.

**Constancia PDF** (ReportLab, `core/infrastructure/pdf`):
- Encabezado institucional con los logos y el cintillo de la configuración visual (`apps/configuracion`).
- Título: **"CONSTANCIA DE COMPARECENCIA O FE DE VIDA"** y, debajo, el nombre del proceso (p. ej. "Fe de vida 2026-2027").
- Texto: "Se hace constar que el día [fecha de validación] el/la ciudadano(a) [nombres y apellidos], titular de la C.I. N.° [cédula], [condición: jubilado(a) / pensionado(a) por invalidez / pensionado(a) por sobrevivencia], compareció de forma digital ante la Oficina de Gestión Humana de la Comisión Nacional de Telecomunicaciones (CONATEL), para dejar constancia de su fe de vida."
- Funcionario(s) que certifican: nombre y cédula de quien(es) aprobaron (Analista y Administradora en la doble aprobación; solo la Administradora si fue aprobación directa, indicándolo). **Sin firma digitalizada ni sello.**
- N.° de constancia correlativo (`FV-AAAA-NNNNNN`), fecha y hora de emisión, código de verificación y QR de verificación interna (HU-0007). **No incluye la selfie.**

**Correo** (outbox + Celery, `A3`/`C6`):
- Remitente `gath@conatel.gob.ve` (vía `mail.conatel.gob.ve`); destinatario: correo principal del pasivo, **con copia al correo alternativo** si lo tiene (`B13`).
- Asunto: "Constancia de Fe de Vida [proceso] — CONATEL".
- Cuerpo breve: número de verificación de la constancia y aviso de que es un correo automático (no responder). PDF adjunto (leído de S3 en el worker). Nunca se adjunta la selfie.
- Notificación en el sistema con enlace de descarga de la constancia (por si el correo no llega o es filtrado, R11).

---

## 3. Plan por etapas

Tallas: S = ≤2 días, M = 3–6 días, L = 7–12 días (un desarrollador; sin considerar bloqueos externos). Dependencias entre etapas indicadas.

**Correspondencia Etapa → Fase** (ver "Hoja de ruta y seguimiento"; las etapas conservan su ID y contenido, las fases solo reordenan por prioridad y dependencias):

| Etapa / tareas | Fase |
|---|---|
| A1, A4, A5, A6, A8 | Fase 1 |
| B1–B6, B8–B14 | Fase 2 |
| A2, A3, A7, B7 | Fase 3 |
| C1–C20 (C0 es requisito de despliegue de Infraestructura, fuera de las fases) | Fase 4 |
| D1–D4, D6, D7 | Fase 5 |
| D5 | Fase 5 |
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
- B3. Casos de uso: `solicitar_actualizacion`, `habilitar_ventana` (plazo configurable), `guardar_borrador`, `adjuntar_soporte`, `enviar_solicitud` (valida soportes obligatorios y secciones habilitadas), `obtener_comparativo`, `prorrogar_ventana` (Bienestar; nueva fecha límite y motivo), `decidir_cambios` (por campo; **una sola persona**, Analista o Administradora, regla de 2.1), `aplicar_cambios_aprobados` (transacción, lock de fila de `Employee`/familiar, valida unicidad de correo), `expirar_ventanas` (tarea beat), `rechazar_solicitud`.
- B4. Vistas/URLs (todas con `HasPermission` y Zero-IDOR por `request.user.cedula_id`):
  - Trabajador: `GET/POST /autogestion/solicitudes/`, `GET /autogestion/solicitudes/{id}/`, `PUT /{id}/borrador/`, `POST /{id}/soportes/`, `POST /{id}/enviar/`.
  - Bienestar: `GET /autogestion/bienestar/solicitudes/`, `POST /{id}/habilitar/`, `POST /{id}/prorrogar/`, `GET /{id}/comparativo/`, `POST /{id}/decidir/`, `POST /{id}/rechazar/`.
- B5. Serializers de entrada con lista blanca de campos por sección (rechazo de identidad/cargo/estatus), validación de teléfonos/correo, soporte obligatorio por sección.
- B6. Integración con el mapper de `personal`/`familiares` para que "valor anterior" venga de la ficha vigente (snapshot en el momento de la propuesta; recalcular y detectar conflicto si la ficha cambió antes de aprobar).
- B7. Notificaciones (A2) en cada transición; evento `actualizacion_aprobada` (outbox para SIGESP, sin transmitir aún) y alerta de reemisión de carnet si cambió la foto.
- B8. `MiExpedienteView`: pasar a `HasPermission('autogestion.ver_propio')`.
- B13. Tabla complementaria `datos_complementarios_trabajador` (2.10): modelo `managed=True`, migración, entidad de dominio, puerto `RepoDatosComplementarios`, repo ORM, caso de uso de lectura/escritura, serializer; se expone en la ficha y en `/me/`, y la sección de contacto de autogestión la puede proponer como `CambioPropuesto`. Gestión de ambos correos (institucional/login, que cambia RRHH, y alternativo) para todo el personal.
- B14. Renombrar el rol "BIENSTAR SOCIAL" a "BIENESTAR SOCIAL": script con respaldo previo (volcado de `USER_rol`), `UPDATE` idempotente, y cambio de los literales del frontend (`app-sidebar-personal.tsx` y los demás que lo citen) en el mismo despliegue; prueba de que el rol sigue resolviendo sus permisos.

**Frontend (`src/modules/autogestion` + `src/app/(app)/autogestion/...`)**
- B9. Dominio/aplicación/infraestructura: entidades `SolicitudActualizacion`, `CambioPropuesto`, `Soporte`; repo API + server actions; schemas Zod por sección.
- B10. UI trabajador: "Mis solicitudes" (lista con estado y ventana), botón "Solicitar actualización" en `mi-expediente-view.tsx` (selección de secciones y motivo; el trabajador inicia el trámite), formulario por sección con subida de soportes (indicador de obligatorio, tipos y tamaño máximo), correo alternativo en contacto, vista previa del borrador, envío.
- B11. UI Bienestar (nuevo ítem de menú en módulo de personal/gestión de trabajadores): bandeja de solicitudes, diálogo "Habilitar ventana" (secciones + plazo) y "Prorrogar", **visor comparativo** (dos columnas valor actual / propuesto con resaltado de diferencias, soporte en visor lateral con URL prefirmada, checkbox o botones aprobar/rechazar por campo con motivo, "aprobar todo", "rechazar todo", resumen previo a confirmar).
- B12. Estados vacíos, carga, errores y accesibilidad según `patrones-implementacion-frontend`; el diseño visual lo define el plan de rediseño hermano.

**Tests**: unit de transiciones (incluye prórroga de la ventana y expiración) y de la regla de aprobación (aprueba una sola persona: Analista o Administradora; ninguna segunda aprobación es exigida; quien no tiene `bienestar.aprobar` recibe 403); datos complementarios (correo alternativo, `tiene_hijos`); renombre del rol idempotente y sin perder permisos; integración de permisos y Zero-IDOR (no ver ni enviar solicitud ajena); prueba de que la ficha no cambia antes de aprobar y sí cambia solo para campos aprobados; unicidad de correo; soporte obligatorio; expiración; Vitest de schemas y del comparativo; E2E Playwright (trabajador solicita → Bienestar habilita → trabajador envía → Bienestar aprueba parcial → ficha actualizada y notificaciones). **Cuidado**: BD real con datos y tablas `managed=False`: los tests de integración deben ir sobre la BD de pruebas con fixtures, no sobre la real.

**Criterio de salida**: flujo E2E verde (el trabajador solicita → Bienestar habilita con plazo, prorroga una vez → el trabajador envía → una sola persona aprueba parcial → ficha actualizada); la ficha activa no varía hasta la aprobación; cada campo aprobado/rechazado queda con actor y motivo en `CambioPropuesto` y en `AuditoriaLog`; las secciones con soporte obligatorio (formación y familiares) no se envían sin él; el correo alternativo y `tiene_hijos` se leen y escriben por la tabla complementaria; el rol aparece como "BIENESTAR SOCIAL" en BD y en el frontend; notificaciones en campana y correo funcionando para ambos lados (parte de la Fase 3).

### Etapa C — Fe de vida de pasivos (talla L)

Depende de A (notificaciones, outbox, almacenamiento seguro, permisos) y de B (mecanismo `CambioPropuesto` y `aplicar_cambios_aprobados`, `B13`). Se desarrolla y prueba en `http://localhost:3001`; no depende de C0.

**C0. Requisito de despliegue a cargo de Infraestructura: HTTPS en producción (estado propio; fuera del camino crítico; no bloquea ninguna fase)**
- Servicio `nginx` con TLS, certificado y dominio acordados por Infraestructura con TI de CONATEL, un solo origen. Checklist de despliegue: `DJANGO_COOKIE_SECURE`, `AUTH_COOKIE_SECURE`, `NEXTAUTH_URL` con https, hosts/CORS/CSRF, CSP/HSTS, `Permissions-Policy: camera=(self)`, límites de cuerpo. Verificación en producción: `window.isSecureContext === true` desde otro equipo de la red.

**Backend (`apps/pasivos`: C20; `apps/fe_de_vida`: C1–C9, C16, C17, C19)**
- C20. **Alta de pensionados por sobrevivencia** (se construye antes de los flujos de fe de vida): implementar `ejecutar_creacion_sobrevivientes` en `apps/pasivos` (réplica de `RAC/services/egreso_services.py` del legado). Al egresar un titular por fallecimiento con pensión de sobrevivencia, el familiar beneficiario se da de alta como **personal pasivo**: `Employee` propio (copiando perfil de salud, físico y formación del familiar), `AsigTrabajo` de tipo PASIVO, pensión de sobrevivencia vinculada al titular fallecido (`tipo_pension = PENSION_SOBREVIVIENTE`), y cuenta AUTOGESTION una vez que RRHH le cargue el correo. Atómico, idempotente (no duplica un beneficiario ya dado de alta), por puertos/repos existentes, con auditoría; pruebas sobre BD de pruebas. Con esto el beneficiario entra como cualquier pasivo (condición PASIVO, A9).
- C1. Modelos de 2.3 y migraciones: `ProcesoFeDeVida`, `ProrrogaProceso`, `SolicitudFeDeVida` (única por `(proceso, cedula)`), evidencia, decisiones, constancia; catálogo `TipoPensionJubilacion`; `PlantillaActa` v1 (formato de la planilla física y texto de la constancia). Reutiliza `CambioPropuesto` (B1): no hay tablas de hijos, contactos ni vivienda.
- C2. Dominio: entidades, VO de estado y transiciones (2.2), reglas puras (quién puede decidir qué según permisos entregados al caso de uso, no por nombre de rol), estados del proceso (BORRADOR/ABIERTO/CERRADO) y validez de prórrogas. Reglas puras: un envío solo se admite con proceso ABIERTO o prórroga vigente (general o de esa cédula); dos checks de roles distintos llevan a `VALIDADA`; un mismo actor no cuenta dos veces; la aprobación directa exige permiso y motivo.
- C3. Casos de uso: `registrar_comparecencia` (atómico, idempotente: cambios propuestos + evidencia + estado, RN-05/06; exige proceso abierto o prórroga), `validar_calidad_evidencia` (servidor), `decidir_acta` (`CHECK_ANALISTA` | `CHECK_ADMINISTRADORA` | `APROBACION_DIRECTA` | `RECHAZA` | `SOLICITA_REPETICION`), `reenviar_tras_repeticion`, `aplicar_acta_validada` (C19: aplica los `CambioPropuesto` a los datos reales al llegar a `VALIDADA`), `emitir_constancia` (PDF + hash + QR + número, RN-11), `verificar_constancia` (interna, RN-23), `listar_panel`.
- C4. PDF de constancia: nuevo generador en `apps/fe_de_vida/infrastructure/pdf/constancia_pdf.py` reutilizando `core/infrastructure/pdf/{pdf_components,pdf_styles}` y el cintillo de `apps/configuracion`; incluye datos del beneficiario, tipo de pensión/jubilación, fecha, nombre y cédula de quien(es) aprobaron (automático) **sin firma digitalizada ni sello**, número y QR de verificación interna (propuesta que se mantiene); se guarda en S3 y su `sha256` en BD.
- C5. Vistas/URLs:
  - Pasivo: `GET /fe-de-vida/mi-estado/` (proceso vigente, datos precargados desde `Employee`/`EmployeeEgresado`, RN-14, e historial por proceso), `POST /fe-de-vida/solicitudes/`, `GET /fe-de-vida/solicitudes/{id}/`, `POST /{id}/reenviar/`, `GET /fe-de-vida/solicitudes/{id}/constancia/` (descarga propia).
  - Bienestar: `GET/POST /fe-de-vida/bienestar/procesos/`, `POST /procesos/{id}/abrir|cerrar/`, `POST /procesos/{id}/prorrogas/` (general o por cédula), `GET /fe-de-vida/bienestar/cobertura/` (pasivos sin correo o sin cuenta), `GET /fe-de-vida/bienestar/solicitudes/`, `GET /{id}/evidencia/` (URL prefirmada + auditoría), `POST /{id}/decidir/`, `GET /fe-de-vida/bienestar/panel/`, `GET /fe-de-vida/verificar/{codigo}/`.
- C6. Notificaciones y correo: al enviar (a Bienestar), al pedir repetición/rechazar (al pasivo con el motivo) y al `VALIDADA` (al pasivo, notificación + correo con PDF adjunto desde el worker; auditoría del envío, RN-13 y HU-0006; **no** se envía a Bienestar copia de la selfie).
- C7. Acceso del pasivo: verificar que cada pasivo tenga cuenta `AUTOGESTION` activa y correo (consulta de cobertura, alta de las faltantes con rol `AUTOGESTION`; el correo faltante lo carga RRHH, ver C16); ajustar `proxy.ts` y el menú por permiso + condición (A9); verificar que el login admite cuentas de personal pasivo (hoy no lo bloquea). No hay rol ni hook de conversión.
- C8. Recordatorios previos al cierre del proceso (HU-0005) con beat, **configurables por proceso** (`recordatorios_dias_antes`); sin recordatorios si el proceso no los define. No hay periodicidad fija (4.3.1 resuelta).
- C9. Auditoría de los eventos de la HU (`PROCESO_ABIERTO`, `PROCESO_CERRADO`, `PRORROGA_OTORGADA` (general o individual, con motivo), `CAMBIOS_ACTA_APLICADOS`, `COMPARECENCIA_INICIADA`, `EVIDENCIA_CAPTURADA` (con `origen_evidencia` = `CAMARA` | `ARCHIVO`), `EVIDENCIA_RECHAZADA_POR_CALIDAD`, `COMPARECENCIA_ENVIADA_A_REVISION`, `COMPARECENCIA_REINICIADA`, decisiones (incluye `APROBACION_DIRECTA_ADMINISTRADORA` con motivo), acceso a evidencia, emisión y envío de constancia).

**Frontend**
- C10. Módulo `src/modules/fe-de-vida/{domain,application,infrastructure,ui}`.
- C11. Menú del pasivo en Autogestión: "Solicitud o renovación de acta de comparecencia / fe de vida".
- C12. Formulario según la planilla física (`solicitud de fe de vida1.jpeg`) y la tabla 2.9: tipo de pensión/jubilación, cédula, correo principal, área de adscripción y cargo (solo lectura); nombres, apellidos, fecha de nacimiento, teléfonos, correo alternativo, contacto alterno y dirección (precargados y editables); "¿tiene hijos?" que **muestra la sección de hijos si marca SÍ** (precargados desde familiares + agregar nuevos, corregir nombres, teléfonos y correo; partida de nacimiento opcional) y **la oculta si marca NO**; en cada proceso nuevo se vuelve a llenar completo; react-hook-form + Zod.
- C13. **Componente de captura con dos vías** (antes `CapturaCedulaEnVivo`; 2.6): pestaña/paso "Cámara" (detección de cámara y de contexto seguro, `getUserMedia`, selector de cámara, guía superpuesta, toma, vista previa, repetir, validación básica, `capture="user"` en móviles; limpieza de tracks) y pestaña/paso "Subir foto" (input file JPG/PNG con validación de tipo/tamaño en cliente y vista previa). Cualquier error de cámara (`NotAllowedError`, `NotFoundError`, `NotReadableError`, contexto inseguro) muestra su mensaje y ofrece "Subir una foto"; si la cámara no está disponible se propone automáticamente. Envío con `FormData` incluyendo `origen_evidencia` (`CAMARA` | `ARCHIVO`).
- C14. Seguimiento: estado de la solicitud, motivo de rechazo o repetición, botón "Repetir toma", descarga de la constancia PDF; campana de notificaciones.
- C16. Reporte/listado de pasivos sin correo o sin cuenta para RRHH (permiso `fe_de_vida.ver_cobertura`), con exportación; RRHH carga el correo faltante (el login es por correo).
- C17. Casos de uso y vistas de procesos y prórrogas: crear/abrir/cerrar (manual o por fecha con beat), alcance, prórroga general o individual (cédula, nueva fecha límite, motivo, autor), historial por proceso y avance (enviadas, validadas, pendientes, sin enviar).
- C18. UI de procesos y prórrogas para Bienestar, y UI del pasivo con el proceso vigente, su estado y el historial por proceso.
- C19. `aplicar_acta_validada`: aplicar los cambios propuestos del acta a los datos reales al llegar a `VALIDADA`, reutilizando `aplicar_cambios_aprobados` (B3), en una transacción y con detección de conflicto; sin firma ni duplicación de tablas.
- C15. Vista Bienestar en Gestión de Trabajadores: bandeja y panel (HU-0010), detalle con selfie (URL prefirmada en `<img>` sin caché) e indicador del origen de la evidencia (Cámara | Archivo subido), datos del beneficiario y botones según permiso: Analista (**Aprobar (check)** / Rechazar / Solicitar repetición, con motivo) y Administradora (**Aprobar (check)** / **Aprobación directa**, con justificación obligatoria / Rechazar / Solicitar repetición); indicadores "Pendiente del segundo check" (indicando de quién falta) y "Aprobada por vía directa de la Administradora" en el acta, el historial y el registro.

**Tests**: procesos y prórrogas (no se puede enviar con el proceso CERRADO; sí con prórroga individual solo para esa cédula; sí con prórroga general; una sola solicitud por `(proceso, cedula)`; en un proceso nuevo el pasivo vuelve a llenar todo y lo anterior queda como historial; cierre automático por beat; `EXPIRADA` al cerrar sin envío); aplicación de cambios al `VALIDADA` (nombres, teléfonos, hijos nuevos y corregidos, correo alternativo, `tiene_hijos`; nada se aplica antes de `VALIDADA`; campos de solo lectura rechazados en el serializer); sección de hijos oculta con `tiene_hijos = false`; reporte de pasivos sin correo; constancia sin firma con nombre y cédula de quien aprobó; unit de transiciones (incluye: doble check en ambos órdenes, Analista->Administradora y Administradora->Analista, llega a `VALIDADA`; la Analista sola no valida y queda en `PENDIENTE_SEGUNDO_CHECK`; el mismo actor no cuenta dos veces; la aprobación directa exige permiso `fe_de_vida.aprobar_directo` y justificación, y genera el evento `APROBACION_DIRECTA_ADMINISTRADORA`; la Analista recibe 403 al intentar aprobación directa; rechazo y repetición exigen motivo), atomicidad (si falla S3 no queda acta huérfana), idempotencia por `idempotency_key`, validación de imagen (MIME falso, tamaño, EXIF, calidad mínima), registro de `origen_evidencia` (`CAMARA` | `ARCHIVO`), **rechazo de archivo inválido** (tipo no permitido, demasiado grande, resolución insuficiente), permisos y Zero-IDOR, PDF generado con hash y número únicos, correo con adjunto (backend de correo en memoria), auditoría de eventos; Vitest de schemas y del componente de captura con `navigator.mediaDevices` simulado (permiso denegado, sin cámara, contexto inseguro: en cada caso se ofrece "Subir una foto"); E2E Playwright con cámara falsa (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`) sobre `localhost`; **E2E del flujo completo con subida de archivo sin cámara**; **test de rechazo de archivo inválido**.

**Criterio de salida**: Bienestar crea, abre y cierra un proceso y otorga prórrogas individual y general; el pasivo inicia sesión, completa el formulario (que vuelve a llenar por completo en cada proceso), aporta la foto por cualquiera de las dos vías (cámara en vivo o subida de archivo; verificado en `localhost`), la repite si hace falta y la envía, sin que la falta de cámara lo bloquee; Bienestar la ve, con el origen de la evidencia (Cámara | Archivo); el doble check (Analista y Administradora, en cualquier orden) lleva a `VALIDADA`, la Analista sola no valida, y la aprobación directa de la Administradora funciona con justificación, auditoría y marca visible en el acta; al validarse se aplican los cambios aprobados a los datos reales; se genera la constancia PDF con número, QR y nombre y cédula de quien aprobó (sin firma ni sello); el pasivo recibe notificación y correo con PDF; rechazo y repetición con motivo funcionan; toda acción queda en auditoría; no hay imágenes en logs.

### Etapa D — Usuarios por roles y permisos (talla M)

Puede avanzar en paralelo con B/C a partir de A4, pero se **despliega** después de que A4 (roles y permisos) esté en producción y B/C lo usen.

- D1. Frontend: `proxy.ts` por permisos (`autogestion.ver_propio` sin `personal.ver` ⇒ shell autogestión; `personal.ver` sin `personal.crear` ⇒ solo lectura; no comparar `nombre_rol`/`department`), dashboard por permisos sin "departamento", 4 sidebars con `permisoRequerido`, `familiares-page`, `movimientos-page`, `lib/zod.ts`.
- D2. `auth.config.ts`/`auth.ts`: retirar resolución de departamento; mantener `permisos` en sesión; re-sincronizar con `permisos_version`.
- D3. Backend identidad: `departamento` opcional/deprecado en registrar/editar; endpoint de departamentos pasa a solo lectura; sin selector en el alta.
- D4. UI de usuarios: alta/edición por cédula + rol + ajustes de permisos; pantalla de matriz de permisos por rol.
- D5. Datos: verificar los roles `ANALISTA_BIENESTAR`/`ADMIN_BIENESTAR` creados en A4. El renombre de "BIENSTAR SOCIAL" es `B14`; los usuarios de Bienestar (varias analistas y administradoras) los crea y asigna el usuario manualmente: no hay asignación automática.
- D7. Estructura de roles (**confirmada** 2026-10-29, 4.3.14): `ADMINISTRADOR` (existe), `AUDITOR` (**confirmado**: solo lectura de todos los módulos y bitácora), `JEFE_RRHH` (administra todo el módulo Gestión de Trabajadores: Bienestar, Captación, etc.), `ADMIN_BIENESTAR`, `ANALISTA_BIENESTAR`, `ADMIN_CAPTACION`/`ANALISTA_CAPTACION` (futuro). Seed y tests en la Fase 5.
- D6. Test de regresión: tabla de verificación rol→rutas esperadas (ADMINISTRADOR, ANALISTA, AUTOGESTION activo, AUTOGESTION pasivo, PRESUPUESTO, BIENESTAR, RECEPCIONISTA; más AUDITOR y JEFE_RRHH si se confirman), Vitest sobre `puedeVerRuta` y Playwright por rol (`e2e/` existente).

**Criterio de salida**: `grep` de `nombre_rol ===`, `roleAccept` y `department` en lógica de acceso del frontend devuelve 0; el alta de usuario no pide departamento; cada rol ve exactamente los menús de su matriz; un cambio de permisos invalida la sesión en la siguiente petición; las 867 cuentas AUTOGESTION siguen entrando sin regresiones (prueba de humo con cuenta real de prueba); la estructura de roles de D7 solo se implementa si el usuario la confirma.

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
| R6 | Nombre del rol "BIENSTAR SOCIAL" mal escrito y referenciado por literal en el frontend | Confirmar valor real (`V-1`); `B14`: UPDATE con respaldo previo de `USER_rol` y cambio de literales en el mismo despliegue |
| R7 | Pasivos sin cuenta/sin correo: la fe de vida no se podría recibir (el login es por correo) | Consulta SQL de cobertura (`V-1`); reporte `C16`; RRHH carga los correos faltantes; alta de cuentas `AUTOGESTION` |
| R8 | Privacidad de la selfie + cédula (dato personal sensible) | Bucket privado, URLs cortas, auditoría de acceso, sin logs de imagen, retención definida por CONATEL |
| R9 | Única divergencia con la HU: la aprobación directa de la Administradora | ADR y confirmación del usuario antes de implementar C2; permiso, justificación y auditoría propios |
| R10 | Falsificación (foto de foto, tercero): la HU descarta biometría/liveness; el control es la revisión humana | Documentar el alcance; guía y reto visual en pantalla (p. ej. código corto escrito en un papel) como mejora opcional futura |
| R11 | SMTP institucional sin credenciales por defecto (`EMAIL_HOST_PASSWORD=''`) y posible filtrado de adjuntos | Probar el relay con TI; considerar enlace de descarga autenticado además del adjunto |
| R12 | Carga de 867 cuentas con polling | Endpoint de conteo ligero con caché Redis corta; intervalo ≥30 s |
| R13 | Sesión PWA/Service Worker puede cachear datos sensibles | Regla en el plan hermano: no cachear `/api/` ni evidencias |
| R14 | `Employee` es legada y no tiene correo alternativo ni `tiene_hijos`; una tabla complementaria nueva puede quedar desincronizada de la cédula | Tabla `managed=True` con cédula única; acceso solo por puerto/repo; cédula validada contra `Employee` al escribir (`B13`) |
| R15 | Aplicar al aprobar la fe de vida cambios a datos reales (nombres, fecha de nacimiento) puede introducir errores si el pasivo se equivoca | Cambios propuestos con valor anterior, doble aprobación o aprobación directa antes de aplicar, detección de conflicto y transacción (`C19`) |
| R17 | `C20` crea `Employee` y asignaciones en tablas legadas (`managed=False`) y copia datos del familiar; un error duplicaría o dañaría datos reales | Réplica fiel de `egreso_services.py` del legado, idempotencia por cédula del familiar, transacción, ensayo con copia de BD y revisión de RRHH |
| R16 | Procesos de fe de vida mal configurados (cierre inesperado, prórroga general por error) | Permisos propios (`fe_de_vida.gestionar_procesos`, `fe_de_vida.prorrogar`), auditoría con motivo y confirmación explícita en la UI (`C17`, `C18`) |

### 4.2 Qué NO se incluye por ahora

Postulación y onboarding con credenciales temporales; carnet de dos caras; sincronización a SIGESP (solo se registran los eventos en outbox); sincronización de datos del "Sistema de RRHH legado" de HU-0008/HU-0012 (en GATH los datos oficiales ya viven en la misma BD); MFA obligatorio (HU-0011; queda para una fase posterior, fuera de este ciclo); asignación automática de usuarios a los roles de Bienestar (los asigna el usuario a mano); estructura de roles propuesta (`D7`) hasta que se confirme (el alta de pensionados por sobrevivencia sí se incluye: `C20`).

### 4.3 Preguntas para el usuario (estado al 2026-10-29)

1. **Periodicidad de la fe de vida**: **RESUELTA.** No se programa una periodicidad fija. RRHH la decide al abrir cada proceso; los recordatorios previos al cierre son configurables por proceso; si alguien no cumple, el proceso se cierra y queda a criterio de RRHH, sin sanción automática (2.2, `C8`, `C17`).
2. **Plazo de las ventanas de autogestión y prórrogas**: **RESUELTA.** El plazo lo configura Bienestar al habilitar cada ventana y Bienestar puede prorrogarlo (2.1, `B3`).
3. **Cobertura de correo en pasivos**: **RESUELTA.** RRHH debe cargarles el correo a los pasivos que no lo tengan (el login es por correo); se agrega el reporte de pasivos sin correo o sin cuenta (`C16`). El conteo real se obtiene en `V-1`.
4. **Texto de la constancia y firma**: **RESUELTA.** La constancia no lleva firma digitalizada ni sello; se muestra el nombre (y cédula) de quien aprobó; el QR de verificación interna se mantiene como propuesta. El texto de `constancia de fe de vida.jpeg` es la plantilla v1, editable (HU-0013).
5. **Identidad de los actores de Bienestar**: **RESUELTA.** Habrá varias analistas y varias administradoras; el usuario las crea y asigna manualmente; no hay tarea de asignación automática. La figura del auditor (solo lectura) se confirmó; ver pregunta 14.
6. **Regla de aprobación en autogestión**: **RESUELTA.** Aprueba una sola persona (Analista o Administradora de Bienestar), campo por campo; sin doble aprobación; el parámetro `requiere_doble_aprobacion` se elimina (2.1). La doble aprobación aplica solo a la fe de vida.
7. **Respaldo de cámara**: **RESUELTA** (2026-10-29): la foto tiene dos vías equivalentes, cámara en vivo o subida de archivo; la falta de cámara nunca bloquea el flujo.
8. **Datos de la planilla**: **RESUELTA.** Los campos editables, de solo lectura y automáticos están en la tabla 2.9; firma y huellas se sustituyen por la selfie con cédula.
9. **MFA de la HU-0011**: **RESUELTA.** Queda para una fase posterior, fuera de este ciclo.
10. **Dominio y certificado TLS / acceso externo**: **RESUELTA** en lo que concierne al plan: Infraestructura dará acceso externo al sistema (los pasivos podrán usarlo fuera de la red interna). El dominio y el certificado los gestiona Infraestructura al desplegar y no bloquean el desarrollo (`C0`).
11. **Retención y destino de la selfie**: **RESUELTA.** La selfie se conserva (RN-21, sin plazo fijo), en almacenamiento privado, con auditoría de acceso.
12. **Pensión por sobrevivencia**: **RESUELTA** (2026-10-29). Los pensionados por sobrevivencia sí existen y deben hacer fe de vida. El sistema da de alta al familiar beneficiario como **personal pasivo** (`Employee` propio, asignación PASIVO, pensión de sobrevivencia vinculada al titular fallecido, cuenta AUTOGESTION tras cargarle el correo RRHH) implementando `ejecutar_creacion_sobrevivientes` (tarea `C20`, antes de los flujos de fe de vida).
13. **"Solicitud o renovación"**: **RESUELTA.** Primera vez y renovación son el mismo trámite (un proceso nuevo).
14. **Estructura de roles**: **RESUELTA** (2026-10-29). `ADMINISTRADOR` (superadmin técnico, existe); `AUDITOR` (solo lectura de todos los módulos y bitácora); `JEFE_RRHH` (jefa de la oficina de RRHH, administra todo el módulo Gestión de Trabajadores: Bienestar, Captación, etc.); `ADMIN_BIENESTAR` y `ANALISTA_BIENESTAR` (varias personas por rol, las crea y asigna el usuario); `ADMIN_CAPTACION`/`ANALISTA_CAPTACION` con el módulo de Captación. Ver matriz 2.4 y tarea `D7`.
15. **Manual de identidad visual**: **RESUELTA.** No existe; el rediseño usa la paleta provisional (plan hermano, P1).


---

## 5. Trazabilidad: HU de fe de vida → etapa del plan

| HU | Título resumido | Etapa | Nota |
|---|---|---|---|
| HU-0001 | Comparecencia en línea con selfie sosteniendo la cédula | C (C3, C5, C12, C13, C17) | La HU dice "captura de selfie"; por decisión del usuario (2026-10-29) se **amplía a "captura o carga"** (cámara en vivo o subida de archivo, con registro del origen); atomicidad, idempotencia, validación de calidad y auditoría incluidas; 5 eventos de auditoría en C9 |
| HU-0002 | Revisión y doble check en orden indistinto | C (C2, C3, C15) | **Coincide** con la HU (doble check, orden indistinto). Única divergencia: excepción de **aprobación directa** de la Administradora. Requiere ADR |
| HU-0003 | Auditor consulta trazabilidad inalterable | E (E1) | Auditoría básica desde A/C; hash de encadenamiento y consulta de solo lectura en E |
| HU-0004 | Administrador configura roles, permisos, plantillas y reglas | A (A4), D, C1 | Roles y permisos en A/D; plantillas versionadas básicas en C1; interfaz completa en E5 |
| HU-0005 | Recordatorios y notificaciones automáticas con outbox | A (A2, A3), C8 | Notificaciones en sistema y correo en A; recordatorios previos al cierre de cada proceso en C8, configurables por proceso (4.3.1 resuelta) |
| HU-0006 | Envío automático de la constancia PDF por correo | C (C4, C6; formato en 2.11) | Al `VALIDADA` (segundo check o aprobación directa). No se copia a Bienestar con datos sensibles; se notifica en sistema |
| HU-0007 | Verificación interna de constancias por código/QR | C (C3) y E (E5) | Código, hash y QR en C; pantalla pulida en E |
| HU-0008 | Sincronizar datos del Sistema de RRHH | Fuera de alcance por ahora | Los datos oficiales ya están en la BD de GATH (`Employee`, `EmployeeEgresado`); se consultan directamente (RN-14). Si hubiera una fuente externa real, se retoma con `integracion-bd-externa` |
| HU-0009 | Analista revisa y escala al Jefe de División | C (C2, C3, C15) | El "escalamiento" se expresa como el check de la Analista (`PENDIENTE_SEGUNDO_CHECK`) + check de la Administradora, o aprobación directa |
| HU-0010 | Panel de estado de comparecencias | E (E5), esqueleto en C15 | Lista y contadores básicos en C; panel completo en E |
| HU-0011 | Autenticación con credenciales seguras y MFA | Parcial: D y E2; **MFA fuera de alcance por ahora** | Bloqueo por intentos ya existe (`auth_views.py:100-130`, `repo_bloqueos_cache_db.py`); MFA sujeto a pregunta 4.3.9 |
| HU-0012 | Integración con el legacy (outbox, circuit breaker, idempotencia) | Fuera de alcance por ahora | Se aprovecha el outbox de A para notificaciones; la sincronización hacia SIGESP queda en la parte pospuesta de la Fase 2 |
| HU-0013 | Plantillas del acta versionadas (Sobreviviente Especial, Invalidez Ordinaria…) | C1 (v1) y E5 | Una plantilla inicial según la planilla física y la constancia; gestor completo en E |
| HU-0014 | Retención documental sin plazo fijo | E (E5) | Se documenta la política (RN-21); no hay purga automática; la selfie se conserva (4.3.11 resuelta) |

Reglas de negocio de la HU: RN-01, 02, 04, 05, 06, 09–15, 19–23 se conservan; RN-03, RN-07 y RN-22 se **conservan** (doble check) y se complementan con la excepción de aprobación directa de la Administradora; RN-08B y RN-18 (legacy) y RN-16 (MFA) quedan fuera de alcance por ahora.

Trazabilidad de las prioridades del usuario: P1 → Etapa B; P2 → Etapa A (infra) y notificaciones por flujo en B y C; P3 → Etapa C (el HTTPS de producción, C0, es de Infraestructura); P4 → sección 2.2, implementada en B3 y C2/C3/C15; P5 → Etapa D (+A4). La PWA y el rediseño visual: `PLAN_REDISENO_AUTOGESTION_PWA_2026-10-29.md`.
