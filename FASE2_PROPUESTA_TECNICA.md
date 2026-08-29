# GATH — Fase 2

## Onboarding digital, Autogestión, Carnetización de dos caras y Sincronización con SIGEP

**Documento técnico** · CONATEL · rama `dev` · verificado sobre código el 21-08-2026
Referencia base: `propuesta-gath.jpg` y `PLAN_RECONSTRUCCION_ONION.md`

---

## 0. Resumen ejecutivo

La Fase 2 convierte un sistema que hoy **registra personal ya contratado** en un sistema que
**conduce el proceso de contratación de punta a punta** y luego **mantiene el expediente vivo** con
participación del propio trabajador.

Son cinco capacidades nuevas, en orden de dependencia:

| # | Capacidad | Depende de |
|---|---|---|
| 1 | **Notificaciones + Autorización real en backend** | — (habilitador transversal) |
| 2 | **Expediente de Postulación** (postulante → captación → presupuesto → dirección general → contratación) | 1 |
| 3 | **Documentos digitales** (Punto de Cuenta, Oferta de Servicios, HCM, Caja de Ahorro…) | 2 |
| 4 | **Autogestión con ciclo de aprobación** | 1 |
| 5 | **Carnet de dos caras con diseñador** y **ETL → SIGEP** | 2, 4 |

**El documento del diagrama que no recordabas es el «Punto de Cuenta»** — aparece literalmente en
`propuesta-gath.jpg`, en el nodo *«Abrir Expediente y Generar Punto de Cuenta»*. Es el instrumento
correcto: es el documento que sube a la Dirección General para firma y aprobación.

### Convenciones de identificadores

Este documento usa cuatro series de referencias cruzadas, más las del plan de reconstrucción:

| Serie | Significado | Dónde se define |
|---|---|---|
| `H-1`…`H-3` | **Hallazgos** que condicionan el diseño entero | §0 |
| `O-1`…`O-9` | **Observaciones** al diagrama `propuesta-gath.jpg` | §2 |
| `DEC-1`…`DEC-12` | **Decisiones pendientes** que necesito de tu parte | §9 |
| `E-0`…`E-10` | **Etapas** de entrega | §10 |
| `CRIT-nn` `ALTA-nn` `MED-nn` `D-0n` `B0.n` | hallazgos y decisiones **del `PLAN_RECONSTRUCCION_ONION.md`**, no de este documento | ese plan |

### Los tres hallazgos que condicionan todo el diseño

**H-1 · Un postulante no puede tener cuenta en el sistema actual.**
`cuenta.cedula` es un `OneToOneField` a `RAC.Employee` con `to_field='cedulaidentidad'`
(`BACKEND/USER/models/user_models.py:52`). No existe cuenta sin empleado. Crear el `Employee` por
adelantado para darle acceso al candidato contamina la tabla maestra de personal con gente que quizá
nunca sea contratada, y el nodo *«Eliminar Datos y Cierre de Proceso»* del diagrama sería
**imposible de ejecutar**: media docena de FKs apuntan a `Employee` con `on_delete=PROTECT`.
→ El postulante debe vivir en su propio agregado (`Postulante`) con credencial firmada y expirable,
y **promoverse** a `Employee` sólo cuando la Dirección General aprueba. §5.1

**H-2 · La autogestión no puede escribir directamente sobre `Employee`.**
El flujo que describes exige que Bienestar Social *evalúe lo cargado y decida si aprueba o rechaza*.
Si el usuario escribe directo en `Employee`, «rechazar» no tiene semántica: el dato original ya se
perdió. → Toda actualización se materializa como **cambios propuestos** (`campo`,
`valor_anterior`, `valor_nuevo`) y sólo se aplica al aprobarse. §5.3

**H-3 · La autorización hoy vive en el frontend.**
Son 35 referencias a `nombre_rol` en 24 archivos del frontend, contra prácticamente ninguna
verificación en backend (MED-18 y CRIT-08 del plan de reconstrucción). Los `roleAccept` de
`app-sidebar.tsx:79` esconden el menú, no protegen el endpoint. Una aprobación de **Presupuesto** o
una firma de **Dirección General** con consecuencia presupuestaria y legal no puede depender de que
un botón esté oculto. → La autorización en backend es **prerrequisito bloqueante** de la Fase 2, no
una mejora paralela. §7

---

## 1. Estado actual verificado

### 1.1 Módulos existentes

| App | Líneas | Qué hace hoy | Rol en Fase 2 |
|---|---|---|---|
| `RAC` | 12.225 | Todo el dominio: personal activo/pasivo, cargos, familiares, ubicaciones, movimientos, PDFs | Se le **quita** el onboarding; recibe al empleado ya promovido |
| `USER` | 1.423 | `cuenta` (JWT), `Rol`, `departaments` | Debe soportar credenciales de invitado y permisos reales |
| `AUTOGESTION` | 1.220 | **Sólo una encuesta** (censo de vivienda) | Se **reescribe** como portal del trabajador |
| `CARNETIZACION` | 1.009 | Carnet de **una cara**, plantilla = una imagen de fondo | Se **extiende** a dos caras + diseñador |
| `SIGEP` (config) | 277 | Settings/urls | Aloja el router del alias externo |
| — | — | *No existe* módulo de notificaciones | **Nuevo** |
| — | — | *No existe* módulo de postulación | **Nuevo** |
| — | — | *No existe* ETL | **Nuevo** |

### 1.2 Modelo de datos que la Fase 2 va a tocar

```
Employee                        RAC/models/personal_models.py:476
├─ cedulaidentidad  TEXT UNIQUE   ← clave natural de todo el sistema
├─ nombres, apellidos, fecha_nacimiento
├─ profile          TEXT          ← hoy sin uso claro; candidato a ruta de foto
├─ correo           EMAIL UNIQUE NULL  ← ¡único! colisiona si un ex-empleado repostula
├─ sexoid           FK PROTECT NOT NULL
└─ total_anos_apn   editable=False

AsigTrabajo                     RAC/models/personal_models.py:499
├─ employee         FK NULL      ← puesto sin titular
├─ codigo           CHAR(20)     unique_together con tiponominaid
├─ denominacioncargoid / …especificoid
├─ Dependencia / DireccionGeneral / DireccionLinea / Coordinacion  ← la «oficina»
└─ estatusid        FK           ← 'VACANTE' marca el puesto disponible

cuenta                          USER/models/user_models.py:45
├─ cedula      O2O → Employee.cedulaidentidad   ← ver H-1
├─ rol         FK Rol NULL
└─ departamento FK departaments NULL

EmployeeMovementHistory         RAC/models/historial_personal_models.py:20
└─ escrito SIEMPRE por registrar_historial_movimiento()
                                RAC/services/constants_historial.py:2
```

### 1.3 Lo que **ya existe** y hay que reutilizar, no reinventar

Esto es lo que abarata la Fase 2:

1. **La vacante ya es un dato consultable.** Un puesto disponible es una fila de `AsigTrabajo` con
   `estatusid.estatus == 'VACANTE'` (`RAC/utils/constants.py:2`), y ya hay endpoint:
   `GET /api/cargos/vacantes/` (`RAC/urls.py:117`). La decisión *«¿hay vacante para ese cargo en esa
   oficina?»* del diagrama es **una consulta, no un desarrollo**. §4.4
2. **Presupuesto ya puede crear cargos.** El menú «Gestión De Códigos → Crear Nuevo Código» está
   restringido a `roleAccept: ["PRESUPUESTO"]` (`app-sidebar.tsx`), y
   `RAC/services/generacion_codigo.py` genera el código de 8 dígitos. Coincide exactamente con lo
   que describes: *presupuesto tiene el poder de crear nuevos cargos*.
3. **El circuito de la foto ya existe, pero su esquema de claves no sirve.**
   `CARNETIZACION/views.py:29-41` lee y escribe en NestJS bajo `profile/{cedula}`. El mecanismo
   —captación guarda, carnetización lee— es el correcto y se conserva. Lo que **no** se conserva es
   la ruta: `profile/{cedula}` es una clave **adivinable**, y es precisamente la forma de CRIT-06 y
   CRIT-07. En Fase 2 la clave pasa a ser un UUID opaco y la correspondencia cédula → objeto vive en
   la base (`Employee.foto_objeto`); carnetización resuelve por consulta, no construyendo la ruta.
   El almacenamiento pasa a **SeaweedFS por su puerta S3** detrás del puerto `AlmacenDeArchivos`
   (§12.2, §12.4).

   ⚠️ **Además, hoy esto está roto en Docker.** `BACKEND/.env` define
   `NESTJS_URL= http://localhost:5000/`, pero desde dentro del contenedor `django-App`
   `localhost:5000` es Django mismo, no NestJS; y en `compose.yml` el servicio `django` **no está
   en la red `file_manager`**, así que no alcanza al contenedor `NestFS` de ninguna forma. El valor
   arrastra también un espacio inicial tras el `=`. Es un argumento más para migrar en vez de
   remendar (§12.8).
4. **Existe un único punto de escritura del historial de movimientos.**
   `registrar_historial_movimiento()` es el embudo por el que pasan ingresos, traslados, egresos y
   cambios de estatus. Es **el gancho natural del ETL**: un solo lugar donde emitir el evento. §4.7
5. **Los roles del flujo ya están creados**: `ADMINISTRADOR`, `ANALISTA`, `PRESUPUESTO`,
   `BIENSTAR SOCIAL`, `RECEPCIONISTA`, `AUTOGESTION`.
   ⚠️ `BIENSTAR SOCIAL` está **mal escrito en el código** (falta la «E» de *BIENESTAR*). Cualquier
   comparación nueva debe usar el literal tal cual está en base de datos, o corregirse con migración
   de datos. No lo «arregles» sólo en el código nuevo: dejarías dos nombres en circulación.
6. **Generadores de PDF con estilos institucionales** en `RAC/services/pdf/` (`base_generator.py`,
   `templates/styles.py`, `components.py`). El Punto de Cuenta y las planillas se construyen sobre
   esa base.

### 1.4 Lo que **no existe** y hay que construir

| Falta | Impacto en Fase 2 |
|---|---|
| **Notificaciones** — cero referencias en todo el backend | Bloquea los 4 avisos del flujo de autogestión y los 3 del onboarding |
| **Máquina de estados / workflow** | Hoy no hay concepto de «expediente en trámite» |
| **Permisos por rol en backend** | Bloqueante (H-3) |
| **Cola de tareas** — `celery==5.3.4` en `requirements.txt` **sin broker ni app declarada** | Bloquea el ETL asíncrono. **Ya decidido: RabbitMQ** (§12.6) |
| **Almacenamiento de objetos** — dos sistemas de ficheros sueltos, uno inalcanzable | **Ya decidido: SeaweedFS por gateway S3** (§12.2) |
| **`boto3`** ausente en `requirements.txt` | Sin cliente S3 no hay acceso a SeaweedFS (§12.9) |
| **Migraciones versionadas** — 0 archivos, `**/migrations/` está en `.gitignore` | **Bloqueante absoluto**: la Fase 2 agrega ~15 tablas. Sin línea base de migraciones no se puede tocar el esquema. Es la tarea B0.0 del plan de reconstrucción y precede a todo lo demás |
| **Campo de foto en `Employee`** | La foto vive fuera de la base, sin metadatos ni versión |
| **Tests** — 4 funciones en todo el backend | Una máquina de estados sin tests es una fuente de expedientes trabados |

---

## 2. Análisis del diagrama propuesto — 9 observaciones

El diagrama de `propuesta-gath.jpg` es correcto en su secuencia macro. Estas son las brechas entre
lo dibujado, lo que describes en el enunciado, y lo que el sistema puede sostener.

### O-1 · Falta la segunda ventana de acceso del postulante
El diagrama pone *«Generar Documentación Adicional: HCM, Oferta, Notif. Itenera, Caja de Ahorro»*
como una tarea del **analista**. Pero tu enunciado dice otra cosa: *«el entrevistado cargaría su carga
familiar y demás datos requeridos, al igual que el llenado de ciertos documentos»*.

Son dos cosas distintas y la diferencia es de diseño, no de matiz: significa que **la credencial
temporal del postulante tiene dos ventanas de vigencia**, no una:

- **Ventana 1** (antes de Captación): datos básicos + test psicofísico.
- **Ventana 2** (después de que aprueba Dirección General): carga familiar, documentos, foto.

Entre ambas la credencial está **suspendida**, no revocada. El diagrama debe reflejarlo, porque de
otro modo el postulante no tiene por dónde entrar la segunda vez. → Recogido en §4.1 y §4.3.

### O-2 · «Eliminar Datos y Cierre de Proceso» no es ejecutable ni deseable
Dos razones:
- **Técnica**: si el postulante se creó como `Employee`, el borrado falla por `PROTECT`.
- **Institucional**: en un organismo público, borrar el rastro de un candidato rechazado elimina la
  evidencia de que el proceso fue conducido correctamente. Si mañana alguien impugna la no
  contratación, no hay nada que mostrar.

→ Sustituir por **`RECHAZADO_CAPTACION` + política de retención**: el expediente se conserva con su
motivo y su auditoría, la credencial se revoca, y un trabajo programado **purga los datos sensibles**
(resultados del test, documentos cargados) al cumplirse el plazo de retención que defina Consultoría
Jurídica, conservando el asiento mínimo (cédula, fecha, motivo, quién decidió).

### O-3 · Los dos rechazos vuelven al mismo nodo, sin distinguir corrección de desistimiento
Ambas flechas *«Regresa a RRHH con Motivo de Rechazo»* apuntan a *«Abrir Expediente y Generar Punto
de Cuenta»*. Eso produce un ciclo sin límite ni salida: un expediente puede rebotar indefinidamente
entre Captación y Presupuesto sin que nadie lo cierre.

→ El rechazo de Presupuesto y el de Dirección General **no son el mismo evento** y no deben
devolver al mismo estado:

| Rechazo | Causa típica | Estado destino | Qué corrige Captación |
|---|---|---|---|
| Presupuesto — sin vacante | no hay `AsigTrabajo` VACANTE en esa oficina | `EN_CORRECCION_CARGO` | cambia cargo/oficina, o pide a Presupuesto crear el código |
| Presupuesto — sin disponibilidad presupuestaria | gestión externa | `DIFERIDO_PRESUPUESTO` | **nada que corregir**: queda en espera, no en corrección |
| Dirección General — no aprueba | criterio de la máxima autoridad | `RECHAZADO_DIRECCION` | normalmente **terminal** |

La distinción importa: `DIFERIDO_PRESUPUESTO` es una cola de espera, no un error de Captación.
Mandarlo a «corregir» hace que Captación toque un expediente que está correcto.

### O-4 · El «Punto de Cuenta» se genera demasiado pronto
El diagrama lo genera al abrir el expediente, **antes** de que Presupuesto valide. Un Punto de Cuenta
es el documento que sube a firma de la máxima autoridad; emitirlo antes de saber si hay vacante y
disponibilidad presupuestaria produce documentos numerados que nacen inválidos.

→ Separar en dos artefactos:
- **`SolicitudDePersonal`** (interna, Captación → Presupuesto): datos del postulante + cargo + oficina.
- **`PuntoDeCuenta`** (formal, → Dirección General): se genera **después** del visto bueno de
  Presupuesto, ya con el código de cargo asignado y la constancia de disponibilidad. Lleva número
  correlativo y es el que se firma.

### O-5 · La disponibilidad presupuestaria es un dato de entrada, no una decisión del sistema
Lo dices explícitamente: *«la disponibilidad presupuestaria ya es una gestión aparte que evalúan
ellos»*. Correcto — y el sistema **no debe pretender calcularla**. Lo que sí debe hacer es
**registrar el resultado**: quién lo declaró, cuándo, con qué referencia (número de oficio o
constancia) y opcionalmente el adjunto. Esa es la evidencia que respalda el Punto de Cuenta.

La **vacante**, en cambio, sí la resuelve el sistema (§4.4). Son dos verificaciones independientes en
un mismo paso, y el expediente sólo avanza si ambas dan verde.

### O-6 · Falta el nodo de asignación de cargo
Tu enunciado menciona *«posterior sería la asignación del cargo»*, pero el diagrama salta de
*«Generar Documentación Adicional»* a *«Inicio de Actividades y Registro definitivo en Nómina»*.

La asignación es el momento **más delicado de todo el flujo**: es donde el `Employee` se crea de
verdad y donde el `AsigTrabajo` VACANTE pasa a tener titular. Debe ser una transacción atómica única,
con bloqueo del puesto, porque dos expedientes aprobados para el mismo código son una condición de
carrera perfectamente posible. §4.4 y §5.5.

### O-7 · El test psicofísico no tiene estructura en el diagrama
*«¿Aprueba Test y Corrobora Datos?»* es un solo rombo con dos responsabilidades distintas: el
resultado del test (que puede ser un instrumento con preguntas, puntaje y baremo) y la verificación
documental de los datos. Conviene separarlos, porque los aprueba gente distinta y en momentos
distintos.

La infraestructura de instrumentos **ya existe** y es reutilizable: `TipoPregunta`,
`PreguntasEncuestas`, `OpcionesPregunta` en `AUTOGESTION/models/models_encuestas.py` son un motor de
cuestionarios genérico. Lo que falta es el puntaje y el baremo. Nota: `RespuestasEncuesta.empleado`
es FK a `Employee` — para el postulante hace falta un modelo paralelo o generalizar el sujeto.

### O-8 · No aparece la sincronización con SIGEP
Es un requisito central de tu enunciado — *«cada registro y actualización y movimiento de cargo,
suspensión y etc debe de hacerse un ETL»* — y no está en el diagrama. Se incorpora como §4.7.

⚠️ **Ambigüedad de nombres que hay que resolver antes de escribir código**: la base de datos local de
GATH **ya se llama `SIGEP`** (`DJANGO_DB_NAME`, default `SIGEP`, en `BACKEND/SIGEP/settings.py:115`),
y el módulo de configuración de Django también. El sistema de nóminas externo también se llama SIGEP.
Son dos cosas distintas con el mismo nombre. En este documento: **`SIGEP-Nómina`** = sistema externo
de nóminas; **`gath_db`** = base local. Recomiendo renombrar la base local.

### O-9 · Colisión de cédula al registrarse
`Employee.cedulaidentidad` es `unique=True`, y `correo` también. La cédula es la que importa: un
ex-empleado que repostula rompe el alta en el último paso, después de que la persona llenó todo.
→ Validar **al generar la credencial**, no al promover. El correo deja de ser un problema en el alta
porque el postulante ya no se identifica con él (§4.3): es un dato de contacto opcional, y sólo hay
que resolver la colisión si trae uno y coincide con el de otro empleado.

Queda por decidir qué pasa con el reingreso de un egresado: ¿nuevo expediente sobre el `Employee`
existente, o expediente nuevo? (§9, DEC-4).

---

## 3. Arquitectura de la Fase 2

Cuatro apps nuevas, siguiendo la nomenclatura SCREAM del `PLAN_RECONSTRUCCION_ONION.md` (§0.3): la
carpeta nombra el dominio, no la tecnología.

```
BACKEND/
├─ apps/
│  ├─ postulacion/      ← NUEVO · expediente, postulante, test, decisiones
│  ├─ documentos/       ← NUEVO · plantillas, generación, firma, Punto de Cuenta
│  ├─ notificaciones/   ← NUEVO · bandeja, canales, preferencias
│  ├─ sincronizacion/   ← NUEVO · outbox, mapeo, despacho a SIGEP-Nómina
│  ├─ autogestion/      ← REESCRITA · ficha, solicitudes, cambios propuestos
│  ├─ carnetizacion/    ← EXTENDIDA · dos caras, campos posicionables
│  └─ personal/         ← RAC desmembrada (fase B4 del plan de reconstrucción)
└─ core/                ← permisos, envelope, auditoría, puertos de archivos
```

Regla de dependencia (Onion, §0.3 del plan): `postulacion` puede depender de `personal` para
**promover**, pero `personal` **no conoce** `postulacion`. La promoción se hace desde
`postulacion.application.use_cases.promover_postulante`, invocando un puerto que `personal`
implementa. Así el día que se retire el módulo de postulación, `personal` no se entera.

---

## 4. Diagramas de flujo

### 4.1 Flujo macro del onboarding, por carril

```mermaid
flowchart TD
    START([Inicio: Captación pre-registra al postulante]) --> INV

    subgraph CAP1["🟦 CAPTACIÓN · emisión de credencial"]
        INV["Valida que la cédula no exista<br/>Genera contraseña temporal<br/>Ventana 1 · vence en N días"]
    end

    INV -->|"credencial entregada en persona"| P1

    subgraph POST1["🟩 POSTULANTE · Ventana 1"]
        P1["Accede con cédula + contraseña<br/>cambio de clave obligatorio"]
        P2["Registra datos básicos<br/>identidad · contacto · académico"]
        P3["Realiza test psicofísico"]
        P4["Envía expediente<br/>estado: ENVIADO_CAPTACION"]
        P1 --> P2 --> P3 --> P4
    end

    P4 --> V1

    subgraph CAP2["🟦 CAPTACIÓN · verificación"]
        V1{"¿Datos corroborados<br/>y test aprobado?"}
        VR["RECHAZADO_CAPTACION<br/>revoca credencial<br/>conserva auditoría<br/>purga diferida"]
        VOK["Abre Expediente<br/>propone CARGO + OFICINA<br/>genera SOLICITUD DE PERSONAL"]
        V1 -->|No| VR
        V1 -->|Sí| VOK
    end

    VR --> FINR([Fin: no contratado])
    VOK --> PR1

    subgraph PRE["🟨 PRESUPUESTO"]
        PR1{"¿Existe AsigTrabajo VACANTE<br/>para ese cargo en esa oficina?<br/>— lo resuelve el sistema —"}
        PRNEW["Crear código de cargo<br/>generacion_codigo.py"]
        PR2{"¿Hay disponibilidad<br/>presupuestaria?<br/>— gestión externa, se registra —"}
        PRDIF["DIFERIDO_PRESUPUESTO<br/>cola de espera"]
        PRERR["EN_CORRECCION_CARGO<br/>Captación revisa cargo/oficina"]
        PROK["Reserva el puesto<br/>registra constancia<br/>emite PUNTO DE CUENTA"]
        PR1 -->|No hay| PRNEW
        PRNEW --> PR2
        PR1 -->|Sí| PR2
        PRNEW -.->|"no procede crear"| PRERR
        PR2 -->|No| PRDIF
        PR2 -->|Sí| PROK
    end

    PRERR --> VOK
    PRDIF -->|se libera partida| PR2
    PROK --> DG1

    subgraph DIR["🟥 DIRECCIÓN GENERAL"]
        DG1{"¿Firma y aprueba<br/>el Punto de Cuenta?"}
        DGNO["RECHAZADO_DIRECCION<br/>libera la reserva del puesto<br/>terminal salvo instrucción"]
        DGOK["APROBADO<br/>Punto de Cuenta firmado"]
        DG1 -->|No| DGNO
        DG1 -->|Sí| DGOK
    end

    DGNO --> FINR
    DGOK --> RE

    subgraph CAP3["🟦 CAPTACIÓN · reapertura"]
        RE["Nueva contraseña temporal · Ventana 2<br/>Captación contacta al postulante"]
    end

    RE --> P5

    subgraph POST2["🟩 POSTULANTE · Ventana 2"]
        P5["Carga grupo familiar"]
        P6["Completa datos de contratación<br/>vivienda · salud · tallas · emergencia"]
        P7["Llena planillas digitales<br/>prellenadas con lo ya cargado"]
        P8["Sube FOTO de carnet"]
        P9["Envía · CONSOLIDANDO"]
        P5 --> P6 --> P7 --> P8 --> P9
    end

    P9 --> C1

    subgraph CAP4["🟦 CAPTACIÓN · consolidación y asignación"]
        C1{"¿Expediente completo<br/>y planillas conformes?"}
        C1 -->|No| P5
        C2["Genera CONTRATO<br/>indeterminado / determinado"]
        C3["<b>ASIGNACIÓN DE CARGO</b><br/>transacción atómica:<br/>1 crea Employee<br/>2 bloquea AsigTrabajo VACANTE<br/>3 asigna titular · estatus ACTIVO<br/>4 registra movimiento INGRESO<br/>5 crea cuenta rol AUTOGESTION<br/>6 emite eventos de sincronización"]
        C1 -->|Sí| C2 --> C3
    end

    C3 --> CARN["🟪 CARNETIZACIÓN<br/>la foto ya está en profile/cedula<br/>emite carnet de 2 caras"]
    C3 --> ETL["⚙️ SINCRONIZACIÓN<br/>outbox → SIGEP-Nómina"]
    C3 --> AG["🟫 AUTOGESTIÓN<br/>ficha disponible para el trabajador"]

    CARN --> FIN([Fin: personal activo])
    ETL --> FIN
    AG --> FIN

    style START fill:#e8f5e9,stroke:#2e7d32
    style FIN fill:#e8f5e9,stroke:#2e7d32
    style FINR fill:#ffebee,stroke:#c62828
    style C3 fill:#fff9c4,stroke:#f9a825,stroke-width:3px
    style VR fill:#ffebee
    style DGNO fill:#ffebee
    style PRDIF fill:#fff3e0
    style PRERR fill:#fff3e0
```

**Lo que este diagrama corrige respecto de `propuesta-gath.jpg`:** las dos ventanas del postulante
(O-1), el cierre con retención en vez de borrado (O-2), rechazos diferenciados con destinos distintos
(O-3), el Punto de Cuenta emitido después de Presupuesto (O-4), la vacante como consulta automática
frente a la disponibilidad como dato registrado (O-5), y la asignación de cargo como transacción
explícita (O-6).

### 4.2 Máquina de estados del Expediente de Postulación

Es el corazón de la Fase 2. Cada transición es un caso de uso, con un rol autorizado y un asiento de
auditoría. Nada cambia de estado sin las tres cosas.

```mermaid
stateDiagram-v2
    [*] --> PRE_REGISTRADO : Captación emite credencial

    PRE_REGISTRADO --> EN_CAPTURA : postulante entra · Ventana 1
    PRE_REGISTRADO --> EXPIRADO : vence sin uso

    EN_CAPTURA --> EN_CAPTURA : guarda borrador
    EN_CAPTURA --> ENVIADO_CAPTACION : envía datos + test
    EN_CAPTURA --> EXPIRADO : vence la ventana

    ENVIADO_CAPTACION --> EN_CORRECCION_DATOS : Captación devuelve observaciones
    EN_CORRECCION_DATOS --> ENVIADO_CAPTACION : postulante corrige
    ENVIADO_CAPTACION --> RECHAZADO_CAPTACION : test no aprobado o datos falsos
    ENVIADO_CAPTACION --> EN_PRESUPUESTO : abre expediente + Solicitud de Personal

    EN_PRESUPUESTO --> EN_CORRECCION_CARGO : sin vacante y no procede crear código
    EN_CORRECCION_CARGO --> EN_PRESUPUESTO : Captación cambia cargo u oficina
    EN_PRESUPUESTO --> DIFERIDO_PRESUPUESTO : sin disponibilidad presupuestaria
    DIFERIDO_PRESUPUESTO --> EN_PRESUPUESTO : se libera partida
    DIFERIDO_PRESUPUESTO --> DESISTIDO : caduca la espera
    EN_PRESUPUESTO --> EN_DIRECCION_GENERAL : puesto reservado + Punto de Cuenta

    EN_DIRECCION_GENERAL --> RECHAZADO_DIRECCION : no aprueba · libera reserva
    EN_DIRECCION_GENERAL --> APROBADO : firma el Punto de Cuenta

    APROBADO --> CONSOLIDANDO : Ventana 2 reabierta
    CONSOLIDANDO --> CONSOLIDANDO : carga familiares · planillas · foto
    CONSOLIDANDO --> EN_REVISION_FINAL : postulante envía
    EN_REVISION_FINAL --> CONSOLIDANDO : Captación observa faltantes
    EN_REVISION_FINAL --> LISTO_PARA_ASIGNAR : expediente conforme

    LISTO_PARA_ASIGNAR --> CONTRATADO : asignación atómica de cargo
    LISTO_PARA_ASIGNAR --> EN_PRESUPUESTO : el puesto se perdió · re-reserva

    CONTRATADO --> [*]
    RECHAZADO_CAPTACION --> [*]
    RECHAZADO_DIRECCION --> [*]
    EXPIRADO --> [*]
    DESISTIDO --> [*]

    note right of LISTO_PARA_ASIGNAR
        La reserva del puesto tiene vencimiento.
        Si expira entre la aprobación y la
        asignación, el expediente vuelve a
        Presupuesto en vez de fallar al final.
    end note

    note right of RECHAZADO_CAPTACION
        NO se borra: se conserva el asiento
        y se purgan los datos sensibles al
        cumplirse la retención. Ver O-2.
    end note
```

**Estados terminales**: `CONTRATADO`, `RECHAZADO_CAPTACION`, `RECHAZADO_DIRECCION`, `EXPIRADO`,
`DESISTIDO`. Un expediente terminal es inmutable; corregir exige uno nuevo con referencia al anterior.

### 4.3 Secuencia: la credencial del postulante y sus dos ventanas

**El postulante entra con cédula y contraseña.** No con correo: todavía no tiene correo
institucional, y no se puede hacer depender el acceso de una dirección personal que puede no existir,
estar mal transcrita o no ser consultada. La contraseña temporal la genera el sistema y **la entrega
Captación en persona**, en el mismo acto en que recibe al postulante.

Esto resuelve H-1 sin tocar `Employee` ni `cuenta`.

```mermaid
sequenceDiagram
    autonumber
    actor CAP as Analista Captación
    participant API as GATH API
    participant DB as gath_db
    actor POS as Postulante

    rect rgb(232,244,253)
    note over CAP,POS: VENTANA 1 — datos básicos y test
    CAP->>API: POST /postulacion/postulantes<br/>cedula, nombres, cargo tentativo
    API->>DB: valida que la cédula no exista<br/>en Employee ni en Postulante activo
    DB-->>API: libre
    API->>DB: crea Postulante + CredencialPostulante<br/>contraseña temporal · ventana=1 · vence_el
    API-->>CAP: contraseña temporal · se muestra UNA sola vez
    CAP-->>POS: entrega en persona:<br/>cédula + contraseña temporal
    POS->>API: POST /postulacion/acceso<br/>{cedula, password}
    API->>API: verifica hash, vigencia,<br/>ventana activa y bloqueo por intentos
    API-->>POS: sesión de invitado · scope expediente:{id}<br/>debe_cambiar_password = true
    POS->>API: POST /postulacion/cambiar-clave<br/>obligatorio antes de continuar
    POS->>API: PATCH datos básicos (borradores sucesivos)
    POS->>API: POST respuestas del test psicofísico
    POS->>API: POST /enviar → ENVIADO_CAPTACION
    API->>API: revoca la sesión
    API->>DB: Notificacion → rol CAPTACION
    end

    rect rgb(255,243,224)
    note over CAP,POS: — Captación · Presupuesto · Dirección General —<br/>la credencial queda SUSPENDIDA, no revocada
    end

    rect rgb(232,245,233)
    note over CAP,POS: VENTANA 2 — consolidación para contratar
    CAP->>API: POST /expedientes/{id}/reabrir-ventana
    API->>DB: nueva contraseña temporal<br/>ventana=2 · vence_el = hoy+5d
    API-->>CAP: contraseña temporal + aviso:<br/>"contactar al postulante"
    CAP-->>POS: lo contacta por teléfono<br/>y entrega la nueva credencial
    POS->>API: accede · cambio de clave obligatorio
    POS->>API: POST familiares · vivienda · salud · tallas
    POS->>API: GET /documentos/{plantilla}/prellenado
    API-->>POS: planilla con nombre, cédula, fecha nac.<br/>ya resueltos desde el expediente
    POS->>API: POST planilla firmada + POST foto de carnet
    POS->>API: POST /enviar → EN_REVISION_FINAL
    API->>API: revoca la credencial definitivamente
    API->>DB: Notificacion → rol CAPTACION
    end
```

**Consecuencia operativa de no tener correo institucional.** El sistema **no puede avisarle al
postulante**: no hay canal propio hasta que sea empleado. Por eso los avisos que en otro diseño irían
por correo se convierten en **tareas para Captación** (§5.6): «contactar al postulante para la
segunda etapa», «avisar que su expediente tiene observaciones». Si el postulante dejó un correo
personal o un móvil, se usa como cortesía —nunca como canal único—. La reapertura de la Ventana 2 es
el punto crítico: el postulante no tiene motivo para volver a entrar por su cuenta, así que si nadie
lo contacta, el expediente se queda quieto. La bandeja de Captación tiene que hacer visible esa
pendiente.

**Decisiones de seguridad de este mecanismo:**
- La credencial **no es una fila en `cuenta`**: es un registro propio con su hash, su ventana, su
  vencimiento y su alcance (`scope = expediente:{id}`). No hereda ningún permiso del sistema.
- **La cédula es un dato público, así que la contraseña es el único secreto.** Eso obliga a lo demás:
  cambio forzoso en el primer ingreso, exigencia mínima de complejidad al cambiarla, **bloqueo
  temporal por intentos fallidos** y vencimiento corto de la ventana.
- **Cambio de contraseña obligatorio** al primer ingreso de cada ventana. Reutiliza
  `debe_cambiar_password`, que ya funciona de punta a punta en el sistema —del serializer de `USER` al
  diálogo forzado del panel—, así que no hay mecanismo nuevo que auditar.
- **Un solo expediente por credencial.** El postulante no puede enumerar ni leer otros expedientes.
- **No hay recuperación automática.** Sin correo no hay «olvidé mi contraseña»: la reposición la hace
  Captación regenerando la contraseña temporal, lo cual queda asentado con responsable y fecha.
- **Revocación al enviar**, no al vencer: reduce la ventana de exposición.
- Sin la corrección de CRIT-08 (permisos en backend), este esquema es la única barrera real. Otra
  razón por la que §7 es prerrequisito.

### 4.4 Decisión de vacante y asignación atómica del cargo

Lo que el sistema resuelve solo, y lo que registra de la gestión externa.

```mermaid
flowchart TD
    A["Expediente en EN_PRESUPUESTO<br/>cargo propuesto + oficina propuesta"] --> B

    subgraph SIS["Lo resuelve el sistema — consulta, no desarrollo"]
        B["SELECT * FROM AsigTrabajo<br/>WHERE estatusid.estatus = 'VACANTE'<br/>AND denominacioncargoid = :cargo<br/>AND DireccionGeneral = :dg<br/>AND DireccionLinea = :dl<br/>AND Coordinacion = :coord<br/>FOR UPDATE SKIP LOCKED"]
        C{"¿filas > 0?"}
        B --> C
    end

    C -->|Sí| D["Reserva el puesto<br/>ReservaPuesto · vence en 15 días<br/>el código queda invisible<br/>para otros expedientes"]
    C -->|No| E{"¿Presupuesto autoriza<br/>crear código nuevo?"}

    E -->|Sí| F["generar código 8 dígitos<br/>RAC/services/generacion_codigo.py<br/>crea AsigTrabajo VACANTE"]
    E -->|No| G["EN_CORRECCION_CARGO<br/>vuelve a Captación con motivo"]
    F --> D

    D --> H

    subgraph EXT["Gestión externa — el sistema sólo registra el resultado"]
        H{"¿Disponibilidad<br/>presupuestaria?"}
        I["Registra ConstanciaPresupuestaria:<br/>declarado_por · fecha · referencia<br/>adjunto opcional"]
        J["DIFERIDO_PRESUPUESTO<br/>libera la reserva<br/>queda en cola de espera"]
        H -->|Sí| I
        H -->|No| J
    end

    I --> K["Emite PUNTO DE CUENTA<br/>correlativo + cargo + constancia<br/>→ EN_DIRECCION_GENERAL"]

    K --> L["… firma de Dirección General …"] --> M

    subgraph ASIG["ASIGNACIÓN — una sola transacción"]
        M["BEGIN"]
        M1["1 · SELECT AsigTrabajo FOR UPDATE<br/>revalida que sigue VACANTE"]
        M2["2 · crea Employee desde Postulante<br/>+ perfiles + familiares + vivienda"]
        M3["3 · AsigTrabajo.employee = nuevo<br/>estatusid = ACTIVO"]
        M4["4 · registrar_historial_movimiento<br/>tipo INGRESO"]
        M5["5 · crea cuenta · rol AUTOGESTION"]
        M6["6 · encola eventos en OutboxSincronizacion"]
        M7["7 · Expediente → CONTRATADO"]
        M8["COMMIT"]
        M --> M1 --> M2 --> M3 --> M4 --> M5 --> M6 --> M7 --> M8
    end

    M8 --> N([Personal activo])
    M1 -.->|"ya no está vacante"| O["ROLLBACK<br/>→ EN_PRESUPUESTO<br/>re-reservar puesto"]

    style ASIG fill:#fff9c4,stroke:#f9a825,stroke-width:3px
    style SIS fill:#e3f2fd
    style EXT fill:#fce4ec
    style O fill:#ffebee
```

**Por qué `FOR UPDATE SKIP LOCKED` y por qué revalidar en el paso 1:** entre la reserva y la
asignación pasan días. Dos expedientes aprobados para el mismo código, o un traslado interno que
ocupó el puesto mientras tanto, son escenarios reales. Sin el bloqueo y la revalidación, el resultado
es un `AsigTrabajo` con dos titulares o un `unique_together('codigo','tiponominaid')` que estalla al
final del proceso, cuando la persona ya firmó.

### 4.5 Autogestión: ficha, solicitud, cambios propuestos y aprobación

Implementa H-2: el trabajador **propone**, Bienestar Social **aplica**.

```mermaid
sequenceDiagram
    autonumber
    actor T as Trabajador · rol AUTOGESTION
    participant AG as Módulo Autogestión
    participant DB as gath_db
    participant NOT as Notificaciones
    actor BS as Bienestar Social

    rect rgb(237,247,237)
    note over T,DB: CONSULTA — siempre disponible, sin permiso
    T->>AG: GET /autogestion/mi-ficha
    AG->>DB: Employee + AsigTrabajo + perfiles<br/>+ familiares + formación (solo lectura)
    DB-->>AG: ficha consolidada
    AG-->>T: ficha completa · botón "Solicitar actualización"
    end

    rect rgb(255,248,225)
    note over T,BS: HABILITACIÓN
    T->>AG: POST /solicitudes-actualizacion<br/>secciones + motivo
    AG->>DB: SolicitudActualizacion · SOLICITADA
    AG->>NOT: notifica rol BIENESTAR SOCIAL
    NOT-->>BS: 🔔 "Solicitud de habilitación · C.I. …"
    BS->>AG: POST /solicitudes/{id}/habilitar<br/>secciones concedidas + vence_el
    AG->>DB: → HABILITADA · ventana con vencimiento
    AG->>NOT: notifica al trabajador
    NOT-->>T: 🔔 "Ya puede actualizar · vence dd/mm"
    Note over BS: puede también DENEGAR con motivo
    end

    rect rgb(227,242,253)
    note over T,DB: CARGA — nada toca Employee todavía
    T->>AG: PATCH /solicitudes/{id}/cambios
    AG->>DB: CambioPropuesto por cada campo:<br/>campo · valor_anterior · valor_nuevo
    Note over AG,DB: Employee permanece INTACTO.<br/>Esto es lo que hace posible RECHAZAR.
    T->>AG: POST /solicitudes/{id}/enviar
    AG->>DB: → ENVIADA · cierra la ventana
    AG->>NOT: notifica rol BIENESTAR SOCIAL
    NOT-->>BS: 🔔 "Actualización por revisar · N cambios"
    end

    rect rgb(252,228,236)
    note over BS,T: REVISIÓN campo por campo
    BS->>AG: GET /solicitudes/{id}/diff
    AG-->>BS: tabla antes → después, con soportes adjuntos
    alt Aprueba todo o en parte
        BS->>AG: POST /solicitudes/{id}/aprobar<br/>ids de cambios aceptados
        AG->>DB: BEGIN<br/>aplica sólo los aprobados a Employee<br/>audita quién y cuándo<br/>encola OutboxSincronizacion<br/>COMMIT
        AG->>DB: → APROBADA (o APROBADA_PARCIAL)
        AG->>NOT: notifica al trabajador
        NOT-->>T: 🔔 "Su actualización fue aprobada"
    else Rechaza
        BS->>AG: POST /solicitudes/{id}/rechazar + motivo
        AG->>DB: → RECHAZADA · Employee sin cambios
        AG->>NOT: notifica al trabajador
        NOT-->>T: 🔔 "Rechazada: {motivo}"
    end
    end
```

**Estados de la solicitud**: `SOLICITADA → HABILITADA → EN_CARGA → ENVIADA →
APROBADA | APROBADA_PARCIAL | RECHAZADA`, más `DENEGADA` (Bienestar Social no habilita) y `EXPIRADA`
(la ventana venció sin envío).

**Aprobación parcial:** es la razón práctica de guardar cambio por cambio en lugar de un JSON
completo. Si el trabajador actualiza teléfono, dirección y nivel académico, y sólo el nivel académico
carece de soporte documental, Bienestar Social aprueba dos y rechaza uno. Con un blob no se puede.

**Qué es autogestionable y qué no** — esto define el alcance real del módulo:

| Sección | ¿Puede solicitarlo? | Nota |
|---|---|---|
| Contacto: teléfonos, correo | Sí | `correo` es `unique`: validar colisión al proponer |
| Estado civil | Sí | con soporte |
| Vivienda y dirección | Sí | |
| Perfil de salud, tallas | Sí | tallas sin soporte; salud con constancia |
| Formación académica | Sí | **exige soporte obligatorio** |
| Grupo familiar | Sí | alta/baja con acta o partida |
| Contacto de emergencia | Sí | |
| Foto de carnet | Sí | dispara reemisión de carnet |
| **Cédula, nombres, fecha de nacimiento** | **No** | sólo Captación con soporte legal |
| **Cargo, oficina, nómina, estatus** | **No** | es un movimiento, no una actualización |

### 4.6 Carnetización de dos caras con formato editable

```mermaid
flowchart LR
    subgraph HOY["ESTADO ACTUAL"]
        H1["CarnetTemplate<br/>UNA imagen de fondo<br/>activo = singleton"]
        H2["CarnetDesigner<br/>designer.py:23<br/>5.5 × 8.56 cm vertical<br/><b>coordenadas en el código</b>"]
        H3["PDF de UNA cara"]
        H1 --> H2 --> H3
    end

    subgraph PROP["FASE 2"]
        P1["CarnetPlantilla<br/>versionada · anverso + reverso<br/>historial de versiones"]
        P2["CarnetPlantillaCampo<br/>cara · origen_dato · x · y<br/>ancho · alto · fuente · color<br/><b>coordenadas en la base</b>"]
        P3["Diseñador visual web<br/>arrastrar y soltar<br/>vista previa en vivo"]
        P4["CarnetDesigner data-driven<br/>itera campos, no if/else"]
        P5["PDF de DOS caras<br/>+ marcas de corte y sangrado"]
        P1 --> P2 --> P3
        P2 --> P4 --> P5
    end

    HOY -.->|"migración: la maqueta actual<br/>se siembra como<br/>plantilla v1 LEGACY"| PROP

    subgraph DATOS["Origen de cada campo"]
        D1["FOTO · profile/{cedula}<br/>la misma que cargó en Ventana 2"]
        D2["Employee · nombres, apellidos, cédula"]
        D3["AsigTrabajo · cargo, oficina, nómina"]
        D4["QR · security_hash<br/>models.py:_compute_security_hash"]
        D5["TEXTO_FIJO · normativa del reverso"]
        D6["IMAGEN · firma, logo, sello"]
    end

    DATOS --> P4

    style PROP fill:#e8f5e9
    style HOY fill:#fafafa
    style DATOS fill:#e3f2fd
```

**Modo dual, tal como lo pides** — *«que permita crear o editar su formato desde el mismo sistema y
diseñarlo o cargarlo ya listo»*:

- **Modo diseño**: fondo + campos posicionados en el diseñador web. Editable, versionable.
- **Modo carga directa**: se sube un PDF o imagen ya maquetado por cara; sólo se posicionan los
  campos variables encima (foto, nombre, cédula, QR). Útil cuando el diseño lo entrega Imagen
  Institucional en un archivo cerrado.

**Cuidados de la migración:** el layout actual está **codificado en `designer.py`**, no en datos.
Antes de volver `CarnetDesigner` data-driven hay que sembrar la maqueta vigente como
`CarnetPlantilla v1 · LEGACY` con sus campos y coordenadas medidas del código, y comparar píxel a
píxel un carnet generado por cada vía. Sin ese paso, el primer carnet nuevo sale distinto al que la
gente ya tiene en la mano.

Además: `CarnetTemplate.activo` es un singleton global (`models.py:72`, el `save()` desactiva las
demás). Con plantillas versionadas conviene **activo por tipo de carnet** (empleado / contratado /
pasante / autoridad), no uno solo para todo el organismo.

### 4.7 Sincronización con SIGEP-Nómina — patrón outbox

*«Cada registro y actualización y movimiento de cargo, suspensión y etc.»*

```mermaid
flowchart TD
    subgraph ORIG["Origen de eventos — dentro de la transacción de negocio"]
        E1["Asignación de cargo · INGRESO"]
        E2["Traslado administrativo"]
        E3["Cambio de estatus · suspensión, reposo"]
        E4["Egreso / jubilación"]
        E5["Actualización aprobada en Autogestión"]
        E6["Alta o baja de familiar"]
    end

    ORIG --> HOOK["registrar_historial_movimiento<br/>RAC/services/constants_historial.py<br/><b>embudo único que ya existe</b>"]
    E5 --> HOOK2["aplicar_cambios_aprobados"]
    E6 --> HOOK2

    HOOK --> OB
    HOOK2 --> OB

    subgraph OUT["Outbox transaccional"]
        OB["INSERT INTO OutboxSincronizacion<br/>tipo · payload · cedula · PENDIENTE<br/><b>mismo COMMIT que el cambio</b>"]
    end

    OB --> W["Worker Celery + RabbitMQ<br/>lee PENDIENTE en orden<br/>reintento exponencial"]

    W --> MAP["Mapeo GATH → SIGEP-Nómina<br/>tabla de correspondencia de catálogos<br/>cargos · nóminas · estatus"]

    MAP --> DEC{"¿Canal de entrega?"}
    DEC -->|"A · recomendado"| API["API de SIGEP-Nómina<br/>idempotente por clave de evento"]
    DEC -->|"B · aceptable"| STG["Esquema de staging propiedad de GATH<br/>dentro de la base de SIGEP;<br/>SIGEP consume cuando quiere"]
    DEC -->|"C · último recurso"| FILE["Archivo de intercambio<br/>firmado, con acuse"]
    DEC -->|"D · NO"| DIR["❌ INSERT/UPDATE directo<br/>en tablas de SIGEP-Nómina"]

    API --> OK
    STG --> OK
    FILE --> OK
    OK["ENVIADO<br/>+ acuse guardado"]

    W -.->|"agota reintentos"| ERR["FALLIDO<br/>🔔 alerta al administrador<br/>bandeja de reproceso manual"]

    OK --> CONC["Conciliación diaria<br/>compara GATH vs SIGEP<br/>reporta divergencias"]

    style DIR fill:#ffcdd2,stroke:#c62828,stroke-width:3px
    style OUT fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    style API fill:#c8e6c9
    style ERR fill:#ffebee
```

**Por qué outbox y no una llamada directa:** si el despacho a SIGEP-Nómina ocurre dentro del ciclo de
la petición, una contratación falla porque el sistema de nóminas está caído. Con outbox, el cambio se
confirma en GATH y la entrega se reintenta. El evento **nunca se pierde** porque se inserta en el
mismo `COMMIT` que el dato que lo originó — que es precisamente la garantía que un `POST` posterior no
da.

**Por qué el escritor directo (D) está tachado.** Escribir con `INSERT`/`UPDATE` en las tablas de un
sistema de nóminas ajeno significa: asumir su esquema sin contrato, saltarse sus validaciones,
duplicar sus reglas de negocio, y quedar sin auditoría de quién produjo cada fila. Cuando SIGEP
cambie una columna, la nómina se rompe y nadie sabrá por qué. Si el organismo **exige** esa vía, hay
que aislarla como en §I.4.6 del plan de reconstrucción: alias propio, `CONN_MAX_AGE = 0`,
`connect_timeout = 5`, espejos `managed = False` con **sólo** las columnas usadas, router por módulo,
y usuario SQL con permisos acotados a esas tablas. Y dejar por escrito quién asume el riesgo.

**Prerrequisito de infraestructura — ya resuelto en la decisión, no en el código:** el broker será
**RabbitMQ** y el worker corre en la cola `sync`, con `acks_late` y reintento exponencial. La
especificación completa —colas, garantías de entrega, tareas programadas y el `compose`— está en
**§12.6**. Sigue pendiente levantarlo: `celery==5.3.4` está en `requirements.txt` sin broker ni app
declarada.

---

## 5. Modelo de datos propuesto

Sólo lo esencial de cada tabla. Convención del proyecto: `db_table` explícito, `managed = True`,
`db_column` en las FKs.

### 5.1 `apps/postulacion`

```python
class Postulante(models.Model):
    """Agregado independiente. NO es Employee. Ver H-1."""
    cedula            = models.CharField(max_length=15, unique=True)
    nombres           = models.CharField(max_length=150)
    apellidos         = models.CharField(max_length=150)
    correo            = models.EmailField(blank=True)   # personal y OPCIONAL: no es el acceso
    telefono_movil    = models.CharField(max_length=20, blank=True)   # canal real de contacto
    fecha_nacimiento  = models.DateField(null=True, blank=True)
    sexo              = models.ForeignKey('RAC.Sexo', models.PROTECT, null=True)
    estado_civil      = models.ForeignKey('RAC.estado_civil', models.PROTECT, null=True)
    datos_extra       = models.JSONField(default=dict)   # borrador libre de Ventana 1
    # Trazabilidad de la promoción
    employee          = models.OneToOneField('RAC.Employee', models.SET_NULL,
                                             null=True, blank=True, db_column='employeeId')
    creado_por        = models.ForeignKey('USER.cuenta', models.PROTECT)
    fecha_creacion    = models.DateTimeField(auto_now_add=True)


class ExpedientePostulacion(models.Model):
    ESTADOS = [...]   # los 16 estados de §4.2
    numero            = models.CharField(max_length=20, unique=True)  # EXP-2026-00001
    postulante        = models.OneToOneField(Postulante, models.CASCADE)
    estado            = models.CharField(max_length=30, choices=ESTADOS, db_index=True)
    # Propuesta de Captación
    cargo_propuesto           = models.ForeignKey('RAC.Denominacioncargo', models.PROTECT, null=True)
    cargo_esp_propuesto       = models.ForeignKey('RAC.Denominacioncargoespecifico', models.PROTECT, null=True)
    tipo_nomina_propuesto     = models.ForeignKey('RAC.Tiponomina', models.PROTECT, null=True)
    direccion_general         = models.ForeignKey('RAC.DireccionGeneral', models.PROTECT, null=True)
    direccion_linea           = models.ForeignKey('RAC.DireccionLinea', models.PROTECT, null=True)
    coordinacion              = models.ForeignKey('RAC.Coordinaciones', models.PROTECT, null=True)
    dependencia               = models.ForeignKey('RAC.Dependencias', models.PROTECT, null=True)
    # Resultado
    puesto_asignado   = models.ForeignKey('RAC.AsigTrabajo', models.SET_NULL, null=True, blank=True)
    fecha_apertura    = models.DateTimeField(auto_now_add=True)
    fecha_cierre      = models.DateTimeField(null=True, blank=True)
    # Retención (O-2)
    purgado           = models.BooleanField(default=False)
    fecha_purga       = models.DateField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['estado', 'fecha_apertura'])]


class TransicionExpediente(models.Model):
    """Auditoría inmutable. Una fila por cambio de estado. Nunca se actualiza."""
    expediente     = models.ForeignKey(ExpedientePostulacion, models.PROTECT,
                                       related_name='transiciones')
    estado_origen  = models.CharField(max_length=30)
    estado_destino = models.CharField(max_length=30)
    ejecutado_por  = models.ForeignKey('USER.cuenta', models.PROTECT, null=True)  # null = postulante
    motivo         = models.TextField(blank=True)
    observaciones  = models.TextField(blank=True)
    fecha          = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['fecha']


class CredencialPostulante(models.Model):
    """Acceso por cédula + contraseña. NO crea fila en USER.cuenta (H-1).
    El postulante no tiene correo institucional: la contraseña temporal la
    entrega Captación en persona. Ver §4.3."""
    postulante        = models.ForeignKey(Postulante, models.CASCADE, related_name='credenciales')
    password_hash     = models.CharField(max_length=128)    # hashers de Django, nunca en claro
    debe_cambiar      = models.BooleanField(default=True)   # reusa debe_cambiar_password
    ventana           = models.PositiveSmallIntegerField()  # 1 o 2 · ver O-1
    vence_el          = models.DateTimeField(db_index=True)
    intentos_fallidos = models.PositiveSmallIntegerField(default=0)
    bloqueado_hasta   = models.DateTimeField(null=True, blank=True)   # bloqueo a los 5
    ultimo_acceso     = models.DateTimeField(null=True, blank=True)
    revocada_el       = models.DateTimeField(null=True, blank=True)
    entregada_por     = models.ForeignKey('USER.cuenta', models.PROTECT)  # quién la entregó


class ReservaPuesto(models.Model):
    """Impide que dos expedientes tomen el mismo AsigTrabajo. Ver §4.4."""
    puesto      = models.ForeignKey('RAC.AsigTrabajo', models.PROTECT, related_name='reservas')
    expediente  = models.ForeignKey(ExpedientePostulacion, models.CASCADE)
    vence_el    = models.DateTimeField(db_index=True)
    liberada_el = models.DateTimeField(null=True, blank=True)
    creada_por  = models.ForeignKey('USER.cuenta', models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['puesto'], condition=Q(liberada_el__isnull=True),
                                    name='un_solo_puesto_reservado_activo'),
        ]


class ConstanciaPresupuestaria(models.Model):
    """Registra el resultado de la gestión externa. El sistema NO la calcula. Ver O-5."""
    expediente     = models.OneToOneField(ExpedientePostulacion, models.CASCADE)
    disponible     = models.BooleanField()
    referencia     = models.CharField(max_length=100, blank=True)   # nº de oficio/constancia
    observaciones  = models.TextField(blank=True)
    adjunto_clave  = models.CharField(max_length=120, blank=True)   # objeto en gath-soportes (§12.2)
    declarado_por  = models.ForeignKey('USER.cuenta', models.PROTECT)
    fecha          = models.DateTimeField(auto_now_add=True)


class InstrumentoEvaluacion(models.Model):
    """Test psicofísico. Reutiliza el motor de AUTOGESTION. Ver O-7."""
    nombre         = models.CharField(max_length=150)
    version        = models.PositiveSmallIntegerField(default=1)
    puntaje_minimo = models.DecimalField(max_digits=5, decimal_places=2)
    activo         = models.BooleanField(default=True)


class ResultadoEvaluacion(models.Model):
    expediente    = models.ForeignKey(ExpedientePostulacion, models.CASCADE)
    instrumento   = models.ForeignKey(InstrumentoEvaluacion, models.PROTECT)
    puntaje       = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    aprobado      = models.BooleanField(null=True)   # null = pendiente de evaluar
    respuestas    = models.JSONField(default=dict)
    evaluado_por  = models.ForeignKey('USER.cuenta', models.PROTECT, null=True)
    fecha         = models.DateTimeField(auto_now_add=True)
```

### 5.2 `apps/documentos`

```python
class PlantillaDocumento(models.Model):
    """Los formatos que hoy se llenan en físico. Ver §8."""
    codigo      = models.CharField(max_length=30, unique=True)   # OFERTA_SERVICIOS, HCM_MIRANDA…
    nombre      = models.CharField(max_length=200)
    version     = models.PositiveSmallIntegerField(default=1)
    motor       = models.CharField(max_length=20)   # 'reportlab' | 'html' | 'pdf_overlay'
    definicion  = models.JSONField()                # campos, orígenes de datos, posiciones
    requiere_firma_postulante = models.BooleanField(default=True)
    activo      = models.BooleanField(default=True)

    class Meta:
        unique_together = ('codigo', 'version')


class DocumentoGenerado(models.Model):
    plantilla    = models.ForeignKey(PlantillaDocumento, models.PROTECT)
    expediente   = models.ForeignKey('postulacion.ExpedientePostulacion', models.CASCADE, null=True)
    employee     = models.ForeignKey('RAC.Employee', models.CASCADE, null=True)
    correlativo  = models.CharField(max_length=30, unique=True, null=True)  # Punto de Cuenta
    datos        = models.JSONField()          # snapshot: lo que se imprimió, para siempre
    bucket       = models.CharField(max_length=40)    # gath-documentos
    objeto_clave = models.CharField(max_length=120)   # UUID opaco, NO derivado de la cédula (§12.2)
    hash_sha256  = models.CharField(max_length=64)    # integridad
    generado_por = models.ForeignKey('USER.cuenta', models.PROTECT, null=True)
    fecha        = models.DateTimeField(auto_now_add=True)


class FirmaDocumento(models.Model):
    documento   = models.ForeignKey(DocumentoGenerado, models.CASCADE, related_name='firmas')
    firmante    = models.ForeignKey('USER.cuenta', models.PROTECT, null=True)
    rol_firmante = models.CharField(max_length=50)   # POSTULANTE, ANALISTA, DIRECTOR_GENERAL
    tipo        = models.CharField(max_length=20)    # 'clic_conforme' | 'imagen' | 'certificado'
    evidencia   = models.JSONField(default=dict)     # IP, user-agent, sello de tiempo
    fecha       = models.DateTimeField(auto_now_add=True)
```

**El `snapshot` de `datos` no es opcional.** Un documento firmado tiene que poder reimprimirse
idéntico dentro de cinco años, aunque el trabajador haya cambiado de dirección, de apellido o de
cargo. Si el PDF se regenera leyendo `Employee` en vivo, el reimpreso no coincide con el firmado.

### 5.3 `apps/autogestion` (reescritura)

```python
class SolicitudActualizacion(models.Model):
    ESTADOS = ['SOLICITADA','HABILITADA','EN_CARGA','ENVIADA',
               'APROBADA','APROBADA_PARCIAL','RECHAZADA','DENEGADA','EXPIRADA']
    employee          = models.ForeignKey('RAC.Employee', models.CASCADE,
                                          to_field='cedulaidentidad',
                                          db_column='employeeCedula')
    estado            = models.CharField(max_length=20, choices=..., db_index=True)
    secciones_pedidas   = models.JSONField(default=list)   # ['contacto','vivienda']
    secciones_concedidas= models.JSONField(default=list)   # puede ser un subconjunto
    motivo_solicitud  = models.TextField(blank=True)
    habilitado_por    = models.ForeignKey('USER.cuenta', models.PROTECT, null=True,
                                          related_name='habilitaciones')
    ventana_vence_el  = models.DateTimeField(null=True, db_index=True)
    revisado_por      = models.ForeignKey('USER.cuenta', models.PROTECT, null=True,
                                          related_name='revisiones')
    motivo_decision   = models.TextField(blank=True)
    fecha_solicitud   = models.DateTimeField(auto_now_add=True)
    fecha_decision    = models.DateTimeField(null=True)

    class Meta:
        constraints = [
            # un empleado no puede tener dos solicitudes abiertas a la vez
            models.UniqueConstraint(
                fields=['employee'],
                condition=Q(estado__in=['SOLICITADA','HABILITADA','EN_CARGA','ENVIADA']),
                name='una_solicitud_abierta_por_empleado'),
        ]


class CambioPropuesto(models.Model):
    """El núcleo de H-2: el cambio vive AQUÍ hasta que se aprueba."""
    solicitud       = models.ForeignKey(SolicitudActualizacion, models.CASCADE,
                                       related_name='cambios')
    seccion         = models.CharField(max_length=40)     # 'contacto', 'familiar', 'formacion'
    modelo_destino  = models.CharField(max_length=60)     # 'RAC.Employee', 'RAC.Employeefamily'
    objeto_id       = models.CharField(max_length=40, blank=True)  # vacío = alta nueva
    campo           = models.CharField(max_length=60)
    valor_anterior  = models.TextField(blank=True, null=True)
    valor_nuevo     = models.TextField(blank=True, null=True)
    operacion       = models.CharField(max_length=10)     # 'UPDATE' | 'CREATE' | 'DELETE'
    soporte_clave   = models.CharField(max_length=120, blank=True)   # objeto en gath-soportes
    aprobado        = models.BooleanField(null=True)      # null = sin decidir
    motivo_rechazo  = models.TextField(blank=True)
    aplicado_el     = models.DateTimeField(null=True, blank=True)
```

### 5.4 `apps/notificaciones` y `apps/sincronizacion`

```python
class Notificacion(models.Model):
    # Destinatario: a una cuenta concreta O a todo un rol (bandeja compartida)
    destinatario      = models.ForeignKey('USER.cuenta', models.CASCADE, null=True, db_index=True)
    rol_destinatario  = models.ForeignKey('USER.Rol', models.CASCADE, null=True, db_index=True)
    tipo              = models.CharField(max_length=50)   # SOLICITUD_HABILITACION, EXPEDIENTE_APROBADO…
    titulo            = models.CharField(max_length=200)
    cuerpo            = models.TextField(blank=True)
    url_destino       = models.CharField(max_length=255, blank=True)   # a dónde lleva el clic
    # Referencia genérica al objeto, sin acoplar apps
    ref_tipo          = models.CharField(max_length=60, blank=True)
    ref_id            = models.CharField(max_length=40, blank=True)
    leida_el          = models.DateTimeField(null=True, blank=True)
    fecha             = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['destinatario', 'leida_el', '-fecha']),
                   models.Index(fields=['rol_destinatario', 'leida_el', '-fecha'])]


class OutboxSincronizacion(models.Model):
    """Se inserta en el MISMO COMMIT que el cambio de negocio. Ver §4.7."""
    ESTADOS = ['PENDIENTE','ENVIANDO','ENVIADO','FALLIDO','DESCARTADO']
    clave_evento  = models.CharField(max_length=100, unique=True)   # idempotencia
    tipo          = models.CharField(max_length=40)   # INGRESO, TRASLADO, SUSPENSION, EGRESO, ACTUALIZACION
    cedula        = models.CharField(max_length=15, db_index=True)
    payload       = models.JSONField()
    estado        = models.CharField(max_length=12, default='PENDIENTE', db_index=True)
    intentos      = models.PositiveSmallIntegerField(default=0)
    ultimo_error  = models.TextField(blank=True)
    acuse         = models.JSONField(default=dict)     # respuesta de SIGEP-Nómina
    fecha_creacion= models.DateTimeField(auto_now_add=True)
    fecha_envio   = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['estado', 'fecha_creacion'])]


class MapeoCatalogo(models.Model):
    """Correspondencia GATH ↔ SIGEP-Nómina de cargos, nóminas y estatus."""
    catalogo    = models.CharField(max_length=40)   # 'cargo', 'nomina', 'estatus'
    valor_gath  = models.CharField(max_length=100)
    valor_sigep = models.CharField(max_length=100)

    class Meta:
        unique_together = ('catalogo', 'valor_gath')
```

### 5.5 Cambios en modelos existentes

| Modelo | Cambio | Motivo |
|---|---|---|
| `RAC.Employee` | agregar `foto_objeto` (CharField 120, clave S3 opaca) y `foto_actualizada` (DateTime) | hoy la foto vive fuera de la base, sin metadatos y bajo una clave adivinable (§12.2). `profile` (TextField) queda para su uso actual |
| `RAC.Employee` | agregar `origen_expediente` (FK nullable a `ExpedientePostulacion`) | trazabilidad de cómo entró cada trabajador |
| `CARNETIZACION.CarnetTemplate` | **se conserva**, se marca obsoleta; nace `CarnetPlantilla` | no romper los carnets ya emitidos |
| `CARNETIZACION.CarnetEmitido` | agregar `plantilla_version`, `anverso_clave` y `reverso_clave` | saber con qué formato se imprimió cada carnet y dónde quedó cada cara |
| `USER.Rol` | agregar `codigo` (slug estable, unique) | dejar de comparar por `nombre_rol`; ver MED-18 y la errata `BIENSTAR SOCIAL` |
| `AUTOGESTION.RespuestasEncuesta` | sujeto generalizable o modelo paralelo para postulantes | `empleado` es FK a `Employee`; un postulante no lo es (O-7) |

### 5.6 Catálogo de notificaciones

Los avisos que el flujo exige, enumerados. `rol_destinatario` significa bandeja compartida: le llega
a todos los que tienen ese rol, y el primero que actúa la resuelve.

| `tipo` | Se emite cuando | Destinatario | Lleva a |
|---|---|---|---|
| `CREDENCIAL_GENERADA` | Captación da de alta al postulante | quien la generó | contraseña temporal, una sola vez |
| `EXPEDIENTE_RECIBIDO` | el postulante envía Ventana 1 | rol `CAPTACION` | expediente |
| `EXPEDIENTE_OBSERVADO` | Captación devuelve con observaciones | rol `CAPTACION` (tarea: contactar) | expediente |
| `EXPEDIENTE_EN_PRESUPUESTO` | Captación abre el expediente | rol `PRESUPUESTO` | solicitud de personal |
| `EXPEDIENTE_DEVUELTO_CARGO` | Presupuesto devuelve por cargo u oficina | rol `CAPTACION` | expediente |
| `EXPEDIENTE_DIFERIDO` | sin disponibilidad presupuestaria | rol `CAPTACION` | expediente |
| `PUNTO_CUENTA_PARA_FIRMA` | Presupuesto emite el Punto de Cuenta | rol `DIRECCION_GENERAL` | documento |
| `EXPEDIENTE_APROBADO_DG` | Dirección General firma | rol `CAPTACION` | expediente |
| `EXPEDIENTE_RECHAZADO_DG` | Dirección General no aprueba | rol `CAPTACION` | expediente |
| `CONTACTAR_POSTULANTE` | se reabre la Ventana 2 | rol `CAPTACION` (**tarea crítica**) | expediente + nueva contraseña |
| `VENTANA_POR_VENCER` | 48 h antes del vencimiento | rol `CAPTACION` (tarea: insistir) | expediente |
| `CONSOLIDACION_RECIBIDA` | el postulante envía Ventana 2 | rol `CAPTACION` | expediente |
| `CONSOLIDACION_INCOMPLETA` | Captación observa faltantes | rol `CAPTACION` (tarea: contactar) | expediente |
| `CONTRATACION_COMPLETADA` | asignación de cargo exitosa | rol `CAPTACION` + rol `ANALISTA` | ficha del nuevo empleado |
| `CARNET_PENDIENTE` | hay foto cargada y aún no hay carnet | rol `ANALISTA` | emisión de carnet |
| `SOLICITUD_HABILITACION` | el trabajador pide actualizar | rol `BIENESTAR_SOCIAL` | solicitud |
| `HABILITACION_CONCEDIDA` | Bienestar Social habilita | cuenta del trabajador | su solicitud |
| `HABILITACION_DENEGADA` | Bienestar Social no habilita | cuenta del trabajador | su solicitud |
| `ACTUALIZACION_POR_REVISAR` | el trabajador envía cambios | rol `BIENESTAR_SOCIAL` | vista de diferencias |
| `ACTUALIZACION_APROBADA` | se aplican los cambios | cuenta del trabajador | su ficha |
| `ACTUALIZACION_RECHAZADA` | se rechazan los cambios | cuenta del trabajador | su solicitud |
| `SINCRONIZACION_FALLIDA` | el outbox agota reintentos | rol `ADMINISTRADOR` | bandeja de reproceso |
| `CONCILIACION_CON_DIVERGENCIAS` | la conciliación diaria encuentra diferencias | rol `ADMINISTRADOR` | reporte |

Son **23 tipos** y **ninguno se dirige al postulante**: no tiene correo institucional ni cuenta en el
sistema (§4.3). Los cinco avisos que le conciernen se convierten en **tareas para Captación**, que es
quien lo contacta. Si dejó correo personal o móvil, se usa como cortesía y en adición a la tarea,
nunca en su lugar.

`CONTACTAR_POSTULANTE` es el más importante del catálogo: **si nadie actúa sobre él, el expediente se
detiene indefinidamente** y la persona nunca sabe que fue aprobada. Debe destacarse en la bandeja con
antigüedad visible y escalar si pasa de 48 horas sin atender.

Dos reglas que evitan el ruido: **una notificación por evento, no por destinatario** —la bandeja de
rol se resuelve al consultar, no duplicando filas—, y **agrupación al leer** cuando varios eventos
del mismo tipo apuntan al mismo expediente.

---

## 6. Contratos de API

Bajo `/api/v1/` según §0.3 del plan de reconstrucción. Todo endpoint con permiso declarado
**en backend**.

### Postulación
```
POST   /postulacion/postulantes/                   CAPTACION   alta + credencial Ventana 1
POST   /postulacion/acceso/                         invitado    cédula + contraseña → sesión de invitado
POST   /postulacion/cambiar-clave/                  invitado    obligatorio en el primer ingreso
POST   /postulacion/expedientes/{id}/reponer-clave/ CAPTACION   regenera la contraseña temporal
GET    /postulacion/mi-expediente/                  invitado    estado y campos pendientes
PATCH  /postulacion/mi-expediente/datos/            invitado    guardado de borrador
POST   /postulacion/mi-expediente/evaluacion/       invitado    respuestas del test
POST   /postulacion/mi-expediente/enviar/           invitado    → ENVIADO_CAPTACION

GET    /postulacion/expedientes/                    CAPTACION|PRESUPUESTO|DIR_GENERAL  bandeja filtrada por rol
GET    /postulacion/expedientes/{id}/               según rol
POST   /postulacion/expedientes/{id}/verificar/     CAPTACION   aprueba o devuelve con observaciones
POST   /postulacion/expedientes/{id}/rechazar/      CAPTACION   → RECHAZADO_CAPTACION
POST   /postulacion/expedientes/{id}/abrir/         CAPTACION   cargo+oficina → EN_PRESUPUESTO
GET    /postulacion/expedientes/{id}/vacantes/      PRESUPUESTO consulta de §4.4
POST   /postulacion/expedientes/{id}/reservar/      PRESUPUESTO reserva del puesto
POST   /postulacion/expedientes/{id}/constancia/    PRESUPUESTO registra disponibilidad
POST   /postulacion/expedientes/{id}/devolver/      PRESUPUESTO → EN_CORRECCION_CARGO | DIFERIDO
POST   /postulacion/expedientes/{id}/aprobar-dg/    DIR_GENERAL firma del Punto de Cuenta
POST   /postulacion/expedientes/{id}/rechazar-dg/   DIR_GENERAL → RECHAZADO_DIRECCION
POST   /postulacion/expedientes/{id}/reabrir/       CAPTACION   Ventana 2
POST   /postulacion/expedientes/{id}/asignar/       CAPTACION   transacción atómica de §4.4
GET    /postulacion/expedientes/{id}/auditoria/     CAPTACION|ADMIN  transiciones
```

### Documentos
```
GET    /documentos/plantillas/                      CAPTACION|ADMIN
GET    /documentos/plantillas/{codigo}/prellenado/  invitado|CAPTACION  campos ya resueltos
POST   /documentos/generar/                         CAPTACION|invitado
POST   /documentos/{id}/firmar/                     según rol_firmante
GET    /documentos/{id}/descargar/                  autenticado + dueño o rol   ← CRIT-06/07
POST   /documentos/punto-de-cuenta/{expediente}/    PRESUPUESTO
```

### Autogestión
```
GET    /autogestion/mi-ficha/                       AUTOGESTION   siempre disponible
GET    /autogestion/mis-solicitudes/                AUTOGESTION
POST   /autogestion/solicitudes/                    AUTOGESTION   pide habilitación
PATCH  /autogestion/solicitudes/{id}/cambios/       AUTOGESTION   sólo si HABILITADA y sin vencer
POST   /autogestion/solicitudes/{id}/enviar/        AUTOGESTION
GET    /autogestion/bandeja/                         BIENESTAR_SOCIAL
POST   /autogestion/solicitudes/{id}/habilitar/     BIENESTAR_SOCIAL
POST   /autogestion/solicitudes/{id}/denegar/       BIENESTAR_SOCIAL
GET    /autogestion/solicitudes/{id}/diff/          BIENESTAR_SOCIAL   antes → después
POST   /autogestion/solicitudes/{id}/aprobar/       BIENESTAR_SOCIAL   ids aceptados
POST   /autogestion/solicitudes/{id}/rechazar/      BIENESTAR_SOCIAL
```

### Notificaciones · Carnet · Sincronización
```
GET    /notificaciones/                              autenticado   propias + de su rol
GET    /notificaciones/no-leidas/count/              autenticado   para el badge
POST   /notificaciones/{id}/marcar-leida/            autenticado
GET    /notificaciones/stream/                       autenticado   SSE

GET    /carnetizacion/plantillas/                    ANALISTA|ADMIN
POST   /carnetizacion/plantillas/                    ADMIN         crear versión
PUT    /carnetizacion/plantillas/{id}/campos/        ADMIN         diseñador: posiciones
POST   /carnetizacion/plantillas/{id}/vista-previa/  ANALISTA|ADMIN  render sin persistir
POST   /carnetizacion/plantillas/{id}/activar/       ADMIN
POST   /carnetizacion/emitir/{cedula}/               ANALISTA      PDF de 2 caras

GET    /sincronizacion/outbox/                       ADMIN         monitoreo
POST   /sincronizacion/outbox/{id}/reintentar/       ADMIN
GET    /sincronizacion/conciliacion/                 ADMIN         divergencias GATH vs SIGEP
```

---

## 7. Roles y permisos — prerrequisito bloqueante

### 7.1 Roles

| Código | Existe hoy | Rol en la Fase 2 |
|---|---|---|
| `ADMINISTRADOR` | ✅ | plantillas, mapeos, outbox, roles |
| `ANALISTA` | ✅ | operación de personal, emisión de carnets |
| `CAPTACION` | ❌ **nuevo** | conduce el expediente de postulación |
| `PRESUPUESTO` | ✅ | vacantes, códigos, constancia, Punto de Cuenta |
| `DIRECCION_GENERAL` | ❌ **nuevo** | firma y aprobación |
| `BIENESTAR_SOCIAL` | ⚠️ existe como `BIENSTAR SOCIAL` | habilita y aprueba actualizaciones |
| `RECEPCIONISTA` | ✅ | consulta |
| `AUTOGESTION` | ✅ | el trabajador sobre su propia ficha |
| *(invitado)* | ❌ **nuevo** | postulante con credencial temporal — **no es un `Rol`** |

Sobre `BIENSTAR SOCIAL`: hay que decidir si se corrige el nombre con migración de datos (y actualizar
las 24 referencias del frontend) o se deja como está. Lo que **no** hay que hacer es escribir el
nombre correcto en el código nuevo y el incorrecto en el viejo: quedarían dos roles conviviendo y las
habilitaciones fallarían en silencio. Por eso §5.5 propone `Rol.codigo`: un slug estable
(`BIENESTAR_SOCIAL`) desacoplado de la etiqueta que se muestra.

### 7.2 Matriz de autorización por transición

Cada fila es una comprobación **en backend**. Hoy ninguna existe.

| Transición | Rol autorizado | Condición adicional |
|---|---|---|
| Emitir credencial | `CAPTACION` | cédula libre (O-9); la contraseña temporal se muestra una sola vez |
| Acceso del postulante | invitado | cédula + contraseña válidas, ventana activa, no vencida, sin bloqueo por intentos |
| Enviar Ventana 1 | invitado | expediente en `EN_CAPTURA` y campos obligatorios completos |
| Verificar / rechazar datos | `CAPTACION` | estado `ENVIADO_CAPTACION` |
| Evaluar el test | `CAPTACION` | resultado registrado |
| Abrir expediente | `CAPTACION` | cargo y oficina definidos |
| Consultar vacantes | `PRESUPUESTO` | estado `EN_PRESUPUESTO` |
| Crear código de cargo | `PRESUPUESTO` | — *(ya restringido, en frontend)* |
| Reservar puesto | `PRESUPUESTO` | puesto `VACANTE` y sin reserva activa |
| Registrar constancia | `PRESUPUESTO` | reserva vigente |
| Emitir Punto de Cuenta | `PRESUPUESTO` | constancia `disponible = True` |
| Firmar / rechazar | `DIRECCION_GENERAL` | estado `EN_DIRECCION_GENERAL` |
| Reabrir Ventana 2 | `CAPTACION` | estado `APROBADO` |
| **Asignar cargo** | `CAPTACION` | `LISTO_PARA_ASIGNAR` + reserva vigente + puesto revalidado |
| Habilitar actualización | `BIENESTAR_SOCIAL` | estado `SOLICITADA` |
| Aprobar actualización | `BIENESTAR_SOCIAL` | estado `ENVIADA` + soportes en secciones que los exigen |
| Editar plantilla de carnet | `ADMINISTRADOR` | — |
| Reintentar outbox | `ADMINISTRADOR` | estado `FALLIDO` |

### 7.3 Hallazgos previos que **bloquean** la Fase 2

Del `PLAN_RECONSTRUCCION_ONION.md`, en orden de bloqueo:

| Hallazgo | Por qué bloquea |
|---|---|
| **B0.0** — 0 migraciones versionadas | La Fase 2 agrega ~15 tablas. Sin línea base, no hay forma de aplicar el esquema |
| **CRIT-08** — la API no impone restricciones | Cualquiera aprobaría el Punto de Cuenta de cualquiera |
| **CRIT-05** — `register_view` deja elegir el rol | Un atacante se hace `DIRECCION_GENERAL` |
| **CRIT-04** — cambio de contraseña sin la actual | Toma de cuentas |
| **CRIT-06 / 07** — documentos personales sin autenticar | Los nuevos documentos son más sensibles que los actuales |
| **CRIT-12** — crear/renombrar/borrar roles sin permiso | La matriz de §7.2 sería decorativa |
| **D-02** — Celery sin broker | Sin cola no hay ETL asíncrono |
| **ALTA-17** — sin backend de caché | El throttling del acceso de invitado lo necesita |

**No hay forma de construir la Fase 2 encima de esto.** La semana 1 de §0.7 del plan de
reconstrucción es la condición de entrada.

---

## 8. Documentos a digitalizar

Los que nombras, más los que el flujo implica:

| # | Documento | Genera | Cuándo | Datos que ya no se transcriben |
|---|---|---|---|---|
| 1 | **Punto de Cuenta** | Presupuesto → DG | tras la constancia (O-4) | nombres, cédula, cargo, oficina, código, sueldo |
| 2 | **Oferta de Servicios** *(«1-»)* | postulante | Ventana 2 | identidad, contacto, dirección, académico |
| 3 | **Afiliación Caja de Ahorro** *(«3-»)* | postulante | Ventana 2 | identidad, cargo, nómina, % de aporte |
| 4 | **Planilla HCM Seguros Mirandaa** *(«7-»)* | postulante | Ventana 2 | identidad + **grupo familiar completo** con parentesco y fechas de nacimiento |
| 5 | **Notificación Itinerante** | Captación | tras asignar | identidad, cargo, oficina, fecha de inicio |
| 6 | **Contrato** determinado / indeterminado | Captación | tras revisión final | identidad, cargo, código, vigencia |
| 7 | Declaración jurada de no incompatibilidad | postulante | Ventana 2 | identidad |
| 8 | Autorización de tratamiento de datos | postulante | **Ventana 1, antes de cargar nada** | identidad |
| 9 | Constancia de recepción de expediente | Captación | al verificar | — |

**El ahorro real está en el punto 4.** La planilla HCM repite el grupo familiar entero: nombres,
cédulas, parentescos y fechas de nacimiento de cada beneficiario. Si el postulante ya lo cargó en
`Employeefamily`, la planilla sale llena. Es la que más tiempo consume hoy y la que más errores de
transcripción acumula.

**Motores de plantilla** (campo `motor` en §5.2):
- `reportlab` — formatos propios, sobre `RAC/services/pdf/`. Punto de Cuenta, contrato, constancias.
- `pdf_overlay` — cuando el formato lo dicta un tercero y **no se puede alterar** (HCM de la
  aseguradora, Caja de Ahorro). Se toma el PDF oficial como fondo y se estampan los valores en
  coordenadas. Es el mismo mecanismo del diseñador de carnets, y conviene compartir el código.
- `html` — documentos de texto largo donde el diseño importa poco.

⚠️ Antes de programar los puntos 2, 3 y 4 hace falta **el PDF oficial vigente de cada planilla**. Las
coordenadas del `pdf_overlay` dependen del archivo exacto; si la aseguradora cambia el formato, el
estampado se desplaza. Hay que versionar el PDF fuente junto con la plantilla.

---

## 9. Decisiones que necesito de tu parte

**Ya resueltas** (21-08-2026), incorporadas en §12:

| Tema | Decisión | Impacto |
|---|---|---|
| Almacenamiento de archivos | **SeaweedFS** por gateway S3 | reemplaza NestJS; §12.2, §12.8 |
| Broker de tareas asíncronas | **RabbitMQ** + Celery | habilita el ETL y los vencimientos; §12.6 |
| Backend de resultados y caché | PostgreSQL (`django-db`) y `DatabaseCache` | **no se agrega Redis**; §12.6 |

Quedan **pendientes** las siguientes. Están ordenadas por cuánto trabajo bloquean; las cuatro
primeras cambian el modelo de datos.

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| **DEC-1** | Canal de entrega a SIGEP-Nómina (§4.7) | A) API · B) esquema de staging · C) archivo · D) escritura directa | **A**, y si no hay API, **B**. **D** sólo con la responsabilidad asumida por escrito |
| **DEC-2** | ¿Existe API o documentación del esquema de SIGEP-Nómina? ¿Quién es el contacto? | — | Necesario antes de diseñar `MapeoCatalogo` |
| **DEC-3** | Retención del expediente rechazado (O-2) | plazo en meses + qué se purga | Consultarlo con Consultoría Jurídica; sin plazo no se puede programar la purga |
| **DEC-4** | Reingreso de un egresado (O-9) | A) expediente nuevo sobre el `Employee` existente · B) `Employee` nuevo · C) bloquear y derivar a manual | **A**, reactivando el registro y conservando `antecedentes_servicio` |
| **DEC-5** | ¿Quién declara la disponibilidad presupuestaria en el sistema? | rol `PRESUPUESTO` genérico o un usuario nominal | Un usuario nominal: la constancia debe tener responsable |
| **DEC-6** | Vigencia de las ventanas del postulante | Ventana 1: ¿7 días? · Ventana 2: ¿5 días? | Configurable, no fijo en código |
| **DEC-7** | Vigencia de la reserva de puesto (§4.4) | ¿15 días? | Debe cubrir el tiempo real de firma de la DG |
| **DEC-8** | Corregir `BIENSTAR SOCIAL` (§7.1) | A) migración de datos + 24 archivos · B) dejarlo y usar `Rol.codigo` | **B**: `codigo` estable y la etiqueta se corrige cuando toque |
| **DEC-9** | Firma del postulante en las planillas | A) clic de conformidad + evidencia · B) imagen de firma dibujada · C) certificado electrónico | **A** para arrancar; el modelo `FirmaDocumento` ya admite las tres |
| **DEC-10** | El **formato del carnet de dos caras** | lo mencionas: *«luego paso el formato»* | **Pendiente tuyo.** Bloquea §4.6: sin el formato no hay campos que posicionar |
| **DEC-11** | ¿El test psicofísico se responde en el sistema o se registra su resultado? | A) instrumento completo con baremo · B) sólo cargar el resultado y el informe | **B** para la primera entrega; **A** exige validar el instrumento con el psicólogo |
| **DEC-12** | Renombrar la base local para no chocar con SIGEP-Nómina (O-8) | `gath_db` | Sí, antes de que existan dos conexiones |

---

## 10. Plan de entrega

Cada etapa es desplegable y deja valor por sí solo. Las estimaciones asumen el equipo actual.

| Etapa | Contenido | Semanas | Bloqueado por |
|---|---|---|---|
| **E-0** | Semana 1 de `PLAN_RECONSTRUCCION_ONION.md` §0.7 + línea base de migraciones + **SeaweedFS y RabbitMQ endurecidos (§12)** + `DatabaseCache` | 2,5 | — |
| **E-1** | `core/` de permisos: `Rol.codigo`, resolutor, decoradores, permisos en los endpoints de escritura existentes. **Frontend: tabla `CAPACIDADES` y reescritura de `proxy.ts`** (§13.4) | 2,5 | E-0 |
| **E-2** | `notificaciones`: modelo, bandeja, SSE, badge en el frontend | 1,5 | E-1 |
| **E-3** | `postulacion` — Ventana 1: postulante, credencial, datos básicos, bandeja de Captación, verificación | 3 | E-2 |
| **E-4** | `postulacion` — Presupuesto y DG: vacantes, reserva, constancia, Punto de Cuenta, firma | 3 | E-3 |
| **E-5** | `documentos`: plantillas, prellenado, `reportlab` + `pdf_overlay`, firma, descarga autenticada | 3 | E-4, DEC-10 |
| **E-6** | `postulacion` — Ventana 2 y **asignación atómica**: familiares, planillas, foto, contrato, transacción de cargo | 3 | E-5 |
| **E-7** | `autogestion` reescrita: ficha, solicitud, cambios propuestos, diff, aprobación parcial | 3 | E-2 |
| **E-8** | `carnetizacion`: plantilla versionada, campos, diseñador visual, PDF de 2 caras, migración `LEGACY` | 3 | DEC-10 |
| **E-9** | `sincronizacion`: outbox, worker, mapeo, despacho, conciliación, monitoreo | 3 | E-6, DEC-1, DEC-2 |
| **E-10** | Endurecimiento: el mínimo de pruebas de **§14**, carga, documentación de usuario, capacitación | 2,5 | todos |

**Total ≈ 30 semanas** de trabajo secuencial. E-7 y E-8 son independientes de E-3…E-6 después de
E-2, así que con dos frentes en paralelo el calendario baja a **≈ 21 semanas**.

Las estimaciones incluyen el frontend de cada etapa (§13). **No incluyen** migrar las pantallas
antiguas a `src/modules/`: eso es trabajo del plan de reconstrucción, no de esta fase (§13.6).

**Orden recomendado si hay que priorizar:** E-0 → E-1 → E-2 → **E-7** (autogestión primero: es el
módulo con más usuarios, el de menor riesgo y el que demuestra el ciclo de notificaciones completo
antes de apostarlo todo al onboarding) → E-3…E-6 → E-8 → E-9.

---

## 11. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Expedientes trabados en un estado sin salida | Alto — bloquea contrataciones reales | Tests exhaustivos de la máquina de estados + rol `ADMINISTRADOR` con transición forzada **auditada** |
| Dos expedientes al mismo puesto | Alto — `unique_together` estalla al final | `ReservaPuesto` + `FOR UPDATE` + revalidación en la asignación (§4.4) |
| Escritura en SIGEP-Nómina rompe la nómina | **Crítico** — afecta pagos | DEC-1: no escribir directo. Conciliación diaria. Ambiente de pruebas antes de producción |
| El postulante abandona a medio proceso | Medio — expedientes zombis | Vencimiento de ventanas + `EXPIRADO` automático + aviso a Captación antes de vencer |
| Coordenadas de `pdf_overlay` desfasadas | Medio — planillas ilegibles | Versionar el PDF fuente con la plantilla + prueba de impresión por versión |
| Cambio de formato del carnet ya emitido | Bajo | `plantilla_version` en `CarnetEmitido`: cada carnet sabe con qué formato salió |
| Datos personales de candidatos no contratados | **Alto — legal** | DEC-3: retención definida y purga programada, no discrecional |
| Frontend sin tests (0 hoy) sobre flujos de aprobación | Medio | El mínimo de §14: `playwright` sobre los recorridos de aprobación |
| Menú y middleware que discrepan | Medio — pantallas visibles que no abren | Una sola tabla `CAPACIDADES` alimenta ambos (§13.4) |
| Proveedor de invitado sobre `next-auth` en beta | Medio | Pruebas de extremo a extremo del acceso por cédula y del vencimiento de sesión (§13.3) |
| **Nadie contacta al postulante tras la aprobación** | **Alto** — el expediente se detiene y la persona nunca se entera | `CONTACTAR_POSTULANTE` destacado en la bandeja con antigüedad y escalamiento a las 48 h (§5.6) |
| Contraseña temporal débil o reutilizada | Alto — la cédula es pública, la clave es el único secreto | Generación aleatoria, cambio forzoso al primer ingreso, bloqueo por intentos, ventana corta (§4.3) |
| Sesión de invitado más larga que su ventana | Alto — acceso después de vencida la credencial | `exp` acotado a 2 h en el `jwt` callback; el backend revalida el `scope` en cada llamada (§13.3) |
| Las cinco áreas nuevas construidas por copia | Medio — duplica el problema de §II.1.4 del plan | `src/modules/` + frontera de importación en `eslint` desde el primer día (§13.1) |
| Migración del layout del carnet | Medio | Siembra `LEGACY` + comparación píxel a píxel antes de activar (§4.6) |
| **Puertos 8080/8888 de SeaweedFS publicados al host** | **Crítico** — lectura de cualquier documento de personal sin autenticarse, saltándose Django | No publicarlos; sólo red interna. Hallazgo 1 de §12.3 |
| Pérdida de `seaweed_metadata` o de PostgreSQL | **Crítico** — con claves UUID, el almacén es ilegible sin el índice | Respaldo de las **tres** piezas y prueba de restauración mensual (§12.10) |
| Un solo volume server sin replicación | Alto — fallo de disco = pérdida de expedientes firmados | Explicitar `000` y asumirlo con respaldo verificado, o segundo volume server (§12.3, hallazgo 8) |
| Migración de `profile/{cedula}` conservando la ruta | Medio — el esquema adivinable se muda al almacén nuevo | Reasignar claves UUID en el paso 3 de §12.8; no habrá segunda ocasión barata |
| RabbitMQ caído durante una contratación | Bajo — el outbox absorbe la caída | Eventos quedan en `PENDIENTE`; `reencolar_outbox_pendiente` los despacha al volver (§12.6) |
| Subida de archivo malicioso por un postulante | Medio | MIME real, tope de tamaño, reencodificado de imágenes con EXIF eliminado (§12.2) |

---

## 12. Infraestructura: SeaweedFS y RabbitMQ

Decidido: **SeaweedFS** por su gateway S3 para archivos, **RabbitMQ** como broker de Celery. Esta
sección especifica cómo se integran y qué hay que corregir del `compose` propuesto antes de
levantarlo.

### 12.1 Topología de servicios

```mermaid
flowchart TB
    BROWSER(["Navegador del usuario"])

    subgraph EXPUESTO["Perímetro expuesto — único punto de entrada"]
        NGX["nginx / proxy inverso · 443<br/>TLS · cabeceras de seguridad"]
    end

    subgraph REDAPP["Red: backend"]
        NEXT["nextjs · 3000"]
        DJ["django · 8000<br/>gunicorn"]
    end

    subgraph REDMQ["Red: broker — sin puertos al host"]
        RMQ[["rabbitmq · 5672<br/>management 15672 NO publicado"]]
    end

    subgraph REDW["Red: backend + broker + storage"]
        WD["worker · cola docs<br/>PDF, carnets, planillas"]
        WS["worker · cola sync<br/>outbox → SIGEP"]
        WM["worker · cola mail<br/>avisos internos"]
        BEAT["beat · cola maint<br/>vencimientos, purga, conciliación"]
    end

    subgraph REDSW["Red: storage — sin puertos al host"]
        S3G["sw_s3 · 8333<br/><b>única puerta de entrada</b>"]
        FIL["sw_filer · 8888<br/>⚠ CRUD sin autenticación"]
        VOL["sw_volume · 8080<br/>⚠ sirve por fid sin autenticación"]
        MAS["sw_master · 9333"]
    end

    PG[("PostgreSQL<br/>host externo · D-03")]

    BROWSER --> NGX
    NGX --> NEXT
    NGX --> DJ
    NEXT --> DJ
    DJ --> PG
    DJ --> RMQ
    DJ --> S3G
    RMQ --> WD
    RMQ --> WS
    RMQ --> WM
    BEAT --> RMQ
    WD --> S3G
    WD --> PG
    WS --> PG
    WS --> SIGEP["SIGEP-Nómina<br/>ver §4.7"]
    WM --> PG
    S3G --> FIL
    FIL --> MAS
    FIL --> VOL
    VOL --> MAS

    style EXPUESTO fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style REDSW fill:#fff3e0,stroke:#ef6c00
    style REDMQ fill:#f3e5f5,stroke:#7b1fa2
    style S3G fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style FIL fill:#ffe0b2
    style VOL fill:#ffe0b2
```

La regla que ordena todo el dibujo: **nada del almacenamiento ni del broker se publica al host.**
Sólo nginx queda expuesto. Django alcanza SeaweedFS por la red interna, y el navegador **nunca**
habla con SeaweedFS.

### 12.2 Buckets y esquema de claves

Cuatro buckets, separados por sensibilidad y ciclo de vida:

| Bucket | Contenido | Clave | Retención |
|---|---|---|---|
| `gath-fotos` | fotos de carnet | `{uuid4}.jpg` | vigente + histórico de reemplazos |
| `gath-documentos` | PDFs generados: Punto de Cuenta, contratos, planillas firmadas | `{aaaa}/{mm}/{uuid4}.pdf` | **permanente, nunca se sobrescribe** |
| `gath-soportes` | adjuntos que suben postulantes y trabajadores | `{aaaa}/{mm}/{uuid4}.{ext}` | según DEC-3 para rechazados |
| `gath-plantillas` | fondos de carnet, PDFs base para `pdf_overlay` | `{codigo}/v{n}.{ext}` | versionado, se conserva |

**Claves opacas, no derivadas de la cédula.** Es la corrección de fondo a `profile/{cedula}` (§1.3).
Una clave adivinable convierte cualquier fuga de red en una fuga masiva: quien conoce el patrón y una
cédula, tiene el archivo. Con UUID, la correspondencia vive en PostgreSQL y **está sujeta al mismo
control de acceso que el resto del expediente**.

Corolario operativo: la base de datos deja de ser opcional para interpretar el almacén. Un respaldo
de `seaweed_data` sin el respaldo de PostgreSQL es un montón de objetos sin nombre (§12.10).

**Al subir, siempre:** validar MIME real (no la extensión), imponer tamaño máximo por bucket,
**reencodificar las imágenes con Pillow para eliminar EXIF** —las fotos de celular traen GPS y modelo
de cámara— y calcular `sha256` para guardarlo junto al registro.

### 12.3 Endurecimiento del `compose` propuesto

Tu configuración funciona y **no choca con los puertos actuales** —`compose.yml` sólo publica 3000,
5000, 8000 y 9443, así que 9333, 8080, 8888 y 8333 están libres—. Estos son los diez cambios que
recomiendo antes de llevarla a producción, ordenados por gravedad:

| # | Hallazgo | Por qué importa | Corrección |
|---|---|---|---|
| **1** | `volume` publica `8080:8080` y `filer` publica `8888:8888` | 🔴 **El más grave.** El volume server entrega contenido por `fid` **sin autenticación** y el filer expone CRUD completo **sin autenticación**. Publicarlos al host reproduce CRIT-06/CRIT-07 en la capa de infraestructura, y peor: **saltándose Django por completo**. Cualquiera que alcance el host lee todo documento de personal | **No publicar** 8080, 8888 ni 9333. Sólo red interna |
| **2** | `AWS_SECRET_ACCESS_KEY=conatel_secret_2026` en el compose | 🔴 Secreto en control de versiones — CRIT-03/CRIT-10. Y es adivinable: nombre de organismo + año | A `.env` no versionado, con valor generado aleatoriamente |
| **3** | Una sola identidad S3, con permisos totales | Django, los workers y cualquier script comparten la llave del administrador. Sin separación de lectura/escritura ni por bucket | `-config=/etc/s3/identities.json` con identidades acotadas (§12.4) |
| **4** | `depends_on` sin `condition` | Django y los workers arrancan antes de que el gateway S3 responda; las primeras subidas fallan | `healthcheck` en cada servicio + `condition: service_healthy` |
| **5** | Sin `networks` declaradas | Caerían en `portainer_network`, donde **Django no está**. No se alcanzarían | Red `storage` dedicada; agregar `django` y los workers a ella |
| **6** | Bind mounts relativos `./seaweed_data` | Dependen del directorio de invocación; en el despliegue actual el resto usa rutas absolutas o volúmenes con nombre | Volúmenes con nombre, o rutas absolutas bajo `/opt/gath/` |
| **7** | Metadatos del filer en leveldb de un solo nodo | Es el índice del namespace. Si se pierde `seaweed_metadata`, los objetos quedan sin nombre aunque `seaweed_data` esté intacto | Respaldar **ambos** volúmenes; evaluar `filer.store` en PostgreSQL |
| **8** | Sin replicación (`000` implícito) y un solo volume server | Un fallo de disco es pérdida definitiva de expedientes firmados | Explicitar `-defaultReplication=000` y asumirlo **con respaldo diario verificado**, o un segundo volume server con `001` |
| **9** | Mezcla `master`/`sw_filer` como destinos | `-mserver=master` usa el nombre de servicio; `-filer=sw_filer` el del contenedor. Ambos resuelven, pero mantener las dos convenciones invita a errores | Un solo criterio: nombres de servicio |
| **10** | Sin límites de recursos ni `logging` | Un volume server sin tope compite con PostgreSQL y Django por memoria | `deploy.resources.limits` y rotación de logs |

El archivo endurecido, listo para revisar, quedó en **`infra-fase2/compose.fase2.yml`**.

### 12.4 El puerto `AlmacenDeArchivos`

Onion manda: el dominio no conoce S3. Se define un puerto y la infraestructura lo implementa, que es
lo que permite que el día de mañana cambie el almacén sin tocar un caso de uso.

```python
# apps/<modulo>/domain/ports/almacen.py — el dominio sólo conoce esto
class AlmacenDeArchivos(Protocol):
    def guardar(self, bucket: str, contenido: bytes, mime: str) -> ObjetoGuardado: ...
    def leer(self, bucket: str, clave: str) -> bytes: ...
    def abrir(self, bucket: str, clave: str) -> IO[bytes]: ...      # streaming
    def eliminar(self, bucket: str, clave: str) -> None: ...
    def url_temporal(self, bucket: str, clave: str, segundos: int) -> str: ...

# ObjetoGuardado = (bucket, clave, sha256, tamano, mime) — la clave la genera el almacén
```

```python
# core/infrastructure/almacen/seaweed_s3.py — la única clase que sabe de boto3
class SeaweedS3(AlmacenDeArchivos):
    def __init__(self, cfg): 
        self._s3 = boto3.client(
            's3',
            endpoint_url=cfg.endpoint,               # http://sw_s3:8333 — red interna
            aws_access_key_id=cfg.key,
            aws_secret_access_key=cfg.secret,
            config=Config(signature_version='s3v4',
                          connect_timeout=3, read_timeout=15,
                          retries={'max_attempts': 3, 'mode': 'standard'}),
        )
```

`connect_timeout` corto y reintentos acotados: un almacén lento no debe convertirse en peticiones
colgadas. Si el almacén no responde, excepción propia → **503**, y el resto del sistema sigue
funcionando —el mismo criterio de degradación explícita de §I.4.6 del plan de reconstrucción—.

**Tres identidades S3**, no una:

| Identidad | Buckets | Acciones | La usa |
|---|---|---|---|
| `gath-app` | los cuatro | `Read`, `Write`, `List` | Django y los workers |
| `gath-lector` | `gath-documentos`, `gath-fotos` | `Read` | reportes, conciliación |
| `gath-respaldo` | los cuatro | `Read`, `List` | el trabajo de respaldo |

Ninguna incluye `Admin` ni borrado sobre `gath-documentos`: un documento firmado no se elimina desde
la aplicación. Config en **`infra-fase2/seaweedfs/identities.json`**.

### 12.5 Servido seguro: cómo se cierra CRIT-06 y CRIT-07

El navegador nunca recibe una URL de SeaweedFS. Todo archivo se pide a Django, que **primero
autoriza y después entrega**:

```
GET /api/v1/archivos/{tipo}/{id}/          ← el id es del registro, no la clave del objeto
  1. autentica (JWT) o valida credencial de invitado con su scope
  2. autoriza: ¿este usuario puede ver ESTE documento?
       · dueño del expediente · rol con competencia · ADMINISTRADOR
  3. resuelve id → (bucket, clave) en PostgreSQL
  4. abre el objeto por el puerto y hace streaming con Content-Disposition
  5. asienta el acceso en la bitácora: quién, qué, cuándo, desde dónde
```

El paso 5 no es adorno: en un expediente de personal, **saber quién consultó qué** es parte del
control. Hoy no existe.

También hay que **retirar `static(settings.MEDIA_URL, ...)` de `SIGEP/urls.py`** —es CRIT-07 y sigue
presente—; mientras esa línea exista, cualquiera descarga de `/media/` sin autenticarse y todo lo
anterior es decorativo.

*Optimización posterior, no para la primera entrega:* `url_temporal()` genera una URL prefirmada de
60 segundos y descarga el streaming de Django. Exige publicar el gateway S3 detrás de nginx, así que
sólo vale la pena si el volumen de descargas lo justifica.

### 12.6 RabbitMQ y Celery: colas y garantías

**Cuatro colas**, para que un ETL lento no retrase la emisión de un carnet:

| Cola | Tareas | Concurrencia | Garantía exigida |
|---|---|---|---|
| `sync` | outbox → SIGEP-Nómina | 1–2 | **al menos una vez, en orden por cédula.** `acks_late`, `prefetch=1`, idempotencia por `clave_evento` |
| `docs` | Punto de Cuenta, contratos, planillas, carnets | 4 | reintento; el resultado es reproducible desde el snapshot (§5.2) |
| `mail` | avisos por correo a cuentas del sistema | 4 | reintento con techo. **No** transporta credenciales de postulantes: se entregan en persona (§4.3) |
| `maint` | vencimientos, purga, conciliación | 1 | idempotente por diseño |

```python
# BACKEND/SIGEP/celery.py
app = Celery('gath')
app.conf.update(
    broker_url=config('CELERY_BROKER_URL'),        # amqp://gath:***@rabbitmq:5672/gath
    result_backend='django-db',                     # PostgreSQL: no hace falta Redis
    task_acks_late=True,                            # ack DESPUÉS de ejecutar
    task_reject_on_worker_lost=True,                # si el worker muere, se reencola
    worker_prefetch_multiplier=1,                   # no acaparar mensajes
    task_default_queue='maint',
    task_routes={
        'sincronizacion.*': {'queue': 'sync'},
        'documentos.*':     {'queue': 'docs'},
        'notificaciones.*': {'queue': 'mail'},
    },
    broker_connection_retry_on_startup=True,
    broker_transport_options={'confirm_publish': True},   # confirmación del broker
    task_time_limit=300, task_soft_time_limit=270,
)
```

**`result_backend='django-db'` es una decisión deliberada:** evita introducir Redis. Con RabbitMQ de
broker, PostgreSQL de resultados y `DatabaseCache` para el caché que pide ALTA-17, la Fase 2 **no
agrega ningún almacén de datos nuevo** más allá de SeaweedFS.

**El outbox no depende del broker para no perder eventos.** El evento se inserta en el mismo `COMMIT`
que el cambio de negocio (§4.7); Celery sólo lo *despacha*. Si RabbitMQ está caído, los eventos se
acumulan en `PENDIENTE` y un barrido de `maint` los reencola al volver. Esa es la razón de ser del
patrón: **la cola es el transporte, no la fuente de verdad.**

Vhost propio (`/gath`), usuario sin permisos de administración, y **`15672` sin publicar**: la
consola de RabbitMQ trae credenciales por defecto y no tiene por qué ser alcanzable desde el host.

### 12.7 Tareas programadas

Con `django-celery-beat`, el calendario vive en la base y se ajusta sin desplegar:

| Tarea | Cadencia | Qué hace | Origen |
|---|---|---|---|
| `expirar_credenciales` | 15 min | ventana vencida → `EXPIRADO`; revoca el token | §4.2, DEC-6 |
| `liberar_reservas_vencidas` | 1 h | reserva vencida → libera el puesto, expediente a `EN_PRESUPUESTO` | §4.4, DEC-7 |
| `expirar_solicitudes_autogestion` | 1 h | ventana de actualización vencida → `EXPIRADA` | §4.5 |
| `recordar_vencimientos` | diaria | avisa al postulante 48 h antes de que venza su ventana | §11 |
| `reencolar_outbox_pendiente` | 10 min | reintenta `PENDIENTE` y `FALLIDO` con techo de intentos | §4.7 |
| `conciliar_sigep` | diaria, madrugada | compara GATH vs SIGEP-Nómina y reporta divergencias | §4.7 |
| `purgar_expedientes_rechazados` | diaria | purga datos sensibles cumplida la retención; conserva el asiento | O-2, **DEC-3** |
| `respaldar_metadatos_filer` | diaria | exporta el índice del filer | §12.10 |

`purgar_expedientes_rechazados` **no se puede programar hasta que DEC-3 defina el plazo.** Se
implementa leyendo el plazo de configuración y, sin valor, no borra nada.

### 12.8 Migración desde NestJS

El plan de reconstrucción ya retira NestJS (D-01). Con SeaweedFS decidido, la secuencia es:

1. **Levantar SeaweedFS** endurecido y crear los cuatro buckets. NestJS sigue sirviendo.
2. **Implementar `AlmacenDeArchivos`** con dos implementaciones y una bandera: `SeaweedS3` y
   `NestJSLegacy`. Todo el código nuevo usa el puerto, nunca `requests`.
3. **Copiar** lo existente: recorrer `/var/www/backup/uploadsNestFS`, subir cada archivo con clave
   UUID nueva y **anotar la correspondencia en PostgreSQL** (`Employee.foto_objeto`). Es el paso que
   convierte claves adivinables en opacas; hay que hacerlo con inventario, no a ojo.
4. **Verificar**: `sha256` de origen y destino, y conteo. Sin coincidencia total, no se avanza.
5. **Conmutar** la bandera a `SeaweedS3`. NestJS queda en modo lectura.
6. **Retirar** el servicio `nestjs`, su red `file_manager` y `NESTJS_URL` de settings —incluida la
   línea rota de §1.3— tras un período de gracia con el volumen antiguo intacto.

El paso 3 es la oportunidad de arreglar `profile/{cedula}` de una vez. Si se migra conservando las
rutas por cédula, el problema se muda al almacén nuevo y ya no habrá una segunda ocasión barata.

### 12.9 Cambios en `requirements.txt` y settings

```diff
+ boto3==1.35.*                  # cliente S3 para SeaweedFS
- celery==5.3.4
+ celery==5.4.*                  # 5.3.4 es anterior a Django 5.2
+ django-celery-results==2.5.*   # backend de resultados en PostgreSQL
+ django-celery-beat==2.7.*      # calendario en la base (§12.7)
+ python-magic==0.4.*            # MIME real, no por extensión (§12.2)
```

```python
# SIGEP/settings.py — sin valores por defecto para los secretos: si falta, falla al arrancar
ALMACEN = {
    'ENDPOINT':  config('S3_ENDPOINT'),          # http://sw_s3:8333
    'KEY':       config('S3_ACCESS_KEY'),
    'SECRET':    config('S3_SECRET_KEY'),
    'BUCKETS':   {'fotos': 'gath-fotos', 'documentos': 'gath-documentos',
                  'soportes': 'gath-soportes', 'plantillas': 'gath-plantillas'},
    'MAX_BYTES': {'fotos': 5*1024**2, 'soportes': 15*1024**2, 'documentos': 25*1024**2},
}
CELERY_BROKER_URL = config('CELERY_BROKER_URL')

CACHES = {'default': {                            # ALTA-17: el throttling lo necesita
    'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
    'LOCATION': 'gath_cache',
}}
```

Y se retira `NESTJS_URL` junto con `static(settings.MEDIA_URL, ...)` de `SIGEP/urls.py` (§12.5).

### 12.10 Respaldo y recuperación

Lo que hace distinto a este almacén: **un objeto sin su fila en PostgreSQL es irrecuperable**, porque
la clave es un UUID sin significado. El respaldo es por tanto un conjunto de tres piezas que deben
ser **consistentes entre sí**:

| Pieza | Contenido | Frecuencia | Sin ella |
|---|---|---|---|
| PostgreSQL | expedientes, registros y **el índice clave → documento** | diaria + WAL | objetos anónimos |
| `seaweed_data` | contenido de los objetos | diaria | registros que apuntan a la nada |
| `seaweed_metadata` | namespace del filer | diaria | el S3 no encuentra los objetos aunque estén |

**La prueba de restauración es parte del entregable, no una buena intención.** Una vez al mes:
restaurar en un ambiente aparte y verificar que un Punto de Cuenta firmado se descarga íntegro y con
`sha256` coincidente. Un respaldo que nunca se restauró no se sabe si sirve.

---

## 13. Frontend (Next.js)

El backend recibe casi toda la atención de este documento, pero **el frontend es el lado grande**:
57.394 líneas contra 16.222, y 404 archivos contra 103. La Fase 2 le agrega cinco áreas nuevas. Si se
construyen con el método actual —copiar la carpeta de al lado y ajustar— el problema estructural que
ya diagnostica el plan de reconstrucción (§II.1.4: duplicación masiva, 34 archivos sobre 400 líneas)
se duplica en vez de contenerse.

### 13.1 Dónde va el código nuevo

Hoy todo el dominio vive colocado por ruta dentro de `src/app/(protected)/dashboard/`, con `api/`,
`actions/`, `components/` y `schema/` repetidos dentro de cada pantalla. Y hay **tres** carpetas
transversales que se solapan: `src/shared/`, `src/components/` y `src/lib/`.

Los módulos de Fase 2 **no** siguen ese patrón. Van a `src/modules/`, en espejo con el backend
(§0.3 del plan: mismos nombres de módulo en ambos lados), y `src/app/` queda como envoltorio delgado:

```
src/
├─ modules/                        ← NUEVO · nada de esto existe hoy
│  ├─ postulacion/
│  │  ├─ domain/         entidades, estados, transiciones permitidas
│  │  ├─ application/    casos de uso (orquestan, no dibujan)
│  │  ├─ infrastructure/ http, mappers, server actions
│  │  └─ ui/             schema (Zod), forms, pantallas
│  ├─ documentos/        · plantillas, prellenado, firma
│  ├─ notificaciones/    · bandeja, badge, stream SSE
│  ├─ autogestion/       · ficha, solicitudes, vista de diferencias
│  └─ carnetizacion/     · diseñador de plantillas, emisión
└─ app/
   ├─ (invitado)/postulacion/…     ← NUEVO grupo de rutas · §13.3
   └─ (protected)/dashboard/…      ← envoltorios que sólo importan de modules/
```

La regla que lo sostiene y que conviene poner en `eslint` desde el primer día: **`app/` puede importar
de `modules/`; `modules/` nunca importa de `app/`**, y un módulo no importa del `ui/` de otro. Sin esa
frontera automatizada, en tres sprints vuelve el patrón actual.

### 13.2 Rutas nuevas

| Ruta | Rol | Qué es |
|---|---|---|
| `/postulacion/acceso` | invitado | ingreso con cédula + contraseña |
| `/postulacion/cambiar-clave` | invitado | cambio obligatorio en el primer ingreso |
| `/postulacion/expediente` | invitado | formulario por pasos, según ventana |
| `/postulacion/expediente/documentos` | invitado | planillas prellenadas y firma |
| `/dashboard/captacion` | `CAPTACION` | bandeja de expedientes por estado |
| `/dashboard/captacion/nuevo` | `CAPTACION` | alta de postulante y emisión de credencial |
| `/dashboard/captacion/[id]` | `CAPTACION` | expediente, verificación, historial |
| `/dashboard/captacion/[id]/asignar` | `CAPTACION` | asignación de cargo (§4.4) |
| `/dashboard/presupuesto/solicitudes` | `PRESUPUESTO` | bandeja + consulta de vacantes |
| `/dashboard/presupuesto/solicitudes/[id]` | `PRESUPUESTO` | reserva, constancia, Punto de Cuenta |
| `/dashboard/direccion-general/firmas` | `DIRECCION_GENERAL` | pendientes de firma |
| `/dashboard/direccion-general/firmas/[id]` | `DIRECCION_GENERAL` | Punto de Cuenta, firmar o rechazar |
| `/dashboard/autogestion/ficha` | `AUTOGESTION` | consulta, siempre disponible |
| `/dashboard/autogestion/actualizar` | `AUTOGESTION` | carga, sólo si hay ventana vigente |
| `/dashboard/bienestar/solicitudes` | `BIENESTAR_SOCIAL` | bandeja de habilitaciones y revisiones |
| `/dashboard/bienestar/solicitudes/[id]` | `BIENESTAR_SOCIAL` | vista de diferencias, aprobar por campo |
| `/dashboard/carnetizacion/plantillas/[id]/disenar` | `ADMINISTRADOR` | diseñador visual |
| `/dashboard/notificaciones` | autenticado | bandeja completa |
| `/dashboard/admin/sincronizacion` | `ADMINISTRADOR` | outbox, reproceso, conciliación |

### 13.3 La sesión de invitado

Es la pieza que no encaja en lo que hay. `proxy.ts` decide con `isLoggedIn = !!auth?.user`, y un
postulante **no es un usuario de NextAuth**: no tiene fila en `cuenta` (H-1). Tampoco puede entrar por
`publicRoutes`, porque su área no es pública: es privada de *un* expediente.

La salida limpia es un **segundo proveedor de credenciales en NextAuth** que recibe **cédula y
contraseña** —no correo, porque el postulante aún no tiene correo institucional (§4.3)— y devuelve una
sesión con rol sintético `POSTULANTE`. Reutiliza toda la plomería que ya existe —JWT, `AuthTimer`,
refresco, el patrón `djAccess`/`djRefresh` y **`debe_cambiar_password`**— sin abrir un mecanismo de
sesión paralelo.

```mermaid
sequenceDiagram
    autonumber
    actor POS as Postulante
    participant MW as proxy.ts
    participant NA as NextAuth · provider "invitado"
    participant API as Django
    participant DB as gath_db

    POS->>MW: GET /postulacion/acceso
    MW->>MW: ruta del grupo (invitado):<br/>no exige sesión, pero tampoco es pública
    MW-->>POS: formulario de cédula + contraseña

    POS->>NA: signIn("invitado", { cedula, password })
    NA->>API: POST /api/v1/postulacion/acceso
    API->>DB: busca CredencialPostulante por cédula<br/>verifica hash, vigencia, ventana y bloqueo
    alt credencial válida
        DB-->>API: postulante + expediente + ventana
        API-->>NA: djGuest (JWT de alcance acotado)<br/>scope = "expediente:{id}"<br/>debe_cambiar_password
        NA->>NA: jwt callback · rol sintético POSTULANTE<br/>exp = min(vence_el, ahora + 2 h)
        NA-->>POS: sesión de invitado
        opt debe_cambiar_password
            MW-->>POS: fuerza /postulacion/cambiar-clave
        end
        POS->>MW: GET /postulacion/expediente
        MW->>MW: rol POSTULANTE ⇒ sólo /postulacion/**
        MW-->>POS: formulario de la ventana vigente
    else contraseña incorrecta
        API->>DB: intentos_fallidos += 1<br/>bloqueo temporal a los 5
        API-->>NA: 401
        NA-->>POS: error genérico, sin revelar<br/>si la cédula está registrada
    end
```

Cuatro detalles que hay que acertar, porque los cuatro son puertas abiertas si se descuidan:

1. **`session.maxAge` es hoy 10 horas** para todos (`auth.ts`). Para un invitado es demasiado: el `exp`
   del token de invitado se fija en el `jwt` callback al menor valor entre el vencimiento de la
   credencial y 2 horas. Una sesión de invitado no debe sobrevivir a su propia ventana.
2. **`POSTULANTE` no es una fila en `Rol`.** Es un rol sintético que sólo existe en la sesión. Si se
   crea como `Rol`, alguien puede acabar asignándoselo a una `cuenta` real.
3. **El gate del middleware es UX, no seguridad.** La autoridad es el `scope` del `djGuest` que Django
   valida en cada llamada (§4.3). El middleware evita que el invitado *vea* `/dashboard`; lo que evita
   que *lea datos* es el backend.
4. **El error de acceso debe ser genérico.** «Cédula o contraseña incorrecta», nunca «esa cédula no
   está registrada»: la cédula es un dato público y confirmar si alguien postuló al organismo es
   información que no corresponde revelar.
5. **`next-auth@5.0.0-beta.25`** sigue en beta en producción (§0.1 del plan). Agregarle un proveedor
   más aumenta la superficie sobre una dependencia inestable. No es motivo para no hacerlo, sí para
   cubrirlo con pruebas de extremo a extremo.

### 13.4 El gating por rol: de cascada de `if` a tabla declarativa

`src/proxy.ts` es la autorización real del frontend hoy, y ya muestra la forma que toma el problema:
un bloque por rol, con listas de rutas escritas a mano —`RUTAS_RECEPCIONISTA` enumera siete rutas
comparadas de forma exacta, con un comentario explicando que un prefijo dejaría pasar las pantallas de
escritura—. Ese comentario es correcto y es justamente la señal: la lógica ya es delicada con **dos**
roles especiales. La Fase 2 agrega `CAPTACION`, `PRESUPUESTO`, `DIRECCION_GENERAL` y el invitado.
Escrita igual, la cadena se vuelve el archivo que nadie quiere tocar.

La sustitución es una tabla, en un solo lugar, junto al `Rol.codigo` de §5.5:

```ts
// src/shared/auth/capacidades.ts — única fuente de verdad del frontend
export const CAPACIDADES: Record<string, readonly string[]> = {
  ADMINISTRADOR:     ['*'],
  CAPTACION:         ['expediente:leer','expediente:verificar','expediente:abrir',
                      'expediente:asignar','postulante:crear'],
  PRESUPUESTO:       ['expediente:leer','vacante:consultar','puesto:reservar',
                      'constancia:registrar','punto_cuenta:emitir','cargo:crear'],
  DIRECCION_GENERAL: ['expediente:leer','punto_cuenta:firmar'],
  BIENESTAR_SOCIAL:  ['actualizacion:habilitar','actualizacion:revisar','ficha:leer'],
  ANALISTA:          ['ficha:leer','ficha:escribir','carnet:emitir'],
  RECEPCIONISTA:     ['ficha:leer'],
  AUTOGESTION:       ['propio:leer','propio:solicitar'],
  POSTULANTE:        ['postulacion:propio'],
} as const;

// Patrón de ruta → capacidad exigida. El orden importa: gana el primero que calza,
// así que lo específico va antes que lo general.
export const RUTAS: ReadonlyArray<[RegExp, string]> = [
  [/^\/postulacion(\/|$)/,                        'postulacion:propio'],
  [/^\/dashboard\/captacion\/[^/]+\/asignar$/,    'expediente:asignar'],
  [/^\/dashboard\/captacion(\/|$)/,               'expediente:leer'],
  [/^\/dashboard\/presupuesto(\/|$)/,             'vacante:consultar'],
  [/^\/dashboard\/direccion-general(\/|$)/,       'punto_cuenta:firmar'],
  [/^\/dashboard\/bienestar(\/|$)/,               'actualizacion:revisar'],
  [/^\/dashboard\/autogestion\/actualizar$/,      'propio:solicitar'],
  [/^\/dashboard\/autogestion(\/|$)/,             'propio:leer'],
  [/^\/dashboard\/admin(\/|$)/,                   '*'],
];
```

`proxy.ts` se reduce a: resolver el rol → buscar el primer patrón que calza → comprobar la capacidad →
redirigir o continuar. Y **el mismo `CAPACIDADES` alimenta los `roleAccept` de los sidebars**, que hoy
repiten los nombres de rol en 24 archivos (MED-18). Un menú y un middleware que discrepan es una
pantalla que se ve y no se puede abrir; con una sola tabla, no pueden discrepar.

Esto **no sustituye** la matriz de §7.2. El backend sigue siendo la autoridad; esto sólo hace que la
interfaz no ofrezca lo que el backend va a negar.

### 13.5 Las cinco áreas nuevas y con qué se construyen

Buena noticia: casi todo lo necesario ya está instalado. No hace falta engordar `package.json`.

| Área | Piezas principales | Ya disponible |
|---|---|---|
| **Formulario del postulante** | ingreso por cédula, cambio de clave forzoso, pasos con guardado de borrador | `react-hook-form`, `zod`, `@formity/react` |
| **Bandejas** (captación, presupuesto, DG, bienestar) | tabla filtrable por estado, columna de antigüedad, acciones por fila | `@tanstack/react-table`, `date-fns` |
| **Vista de diferencias** (§4.5) | antes → después por campo, casilla de aprobación por fila, soporte adjunto | `@tanstack/react-table`, `radix-ui` |
| **Diseñador de carnet** (§4.6) | lienzo con arrastrar y soltar, panel de propiedades, vista previa de dos caras | `react-resizable-panels`, `pdfjs-dist` para el fondo, `html-to-image` para previsualizar |
| **Notificaciones** | badge con contador, panel desplegable, bandeja completa | `radix-ui` (popover), `sonner` para el aviso emergente |

Dos advertencias de implementación:

- **El diseñador de carnet no debe renderizar el PDF final.** La vista previa en el navegador es
  orientativa; el PDF que se imprime lo genera el backend con `reportlab` desde las mismas
  coordenadas (§4.6). Si el navegador produjera el entregable, el carnet dependería del equipo de
  quien lo emitió. `html2canvas` y `html-to-image` sirven para *ver*, no para *emitir*.
- **La vista de diferencias no debe recalcular el `diff` en el cliente.** Lo entrega
  `GET /autogestion/solicitudes/{id}/diff` desde `CambioPropuesto` (§5.3). Un `diff` calculado en el
  navegador puede discrepar de lo que se va a aplicar, y lo que se aprueba tiene que ser exactamente
  lo que se guarda.

### 13.6 Qué no se toca

Para acotar el riesgo, la Fase 2 **no** reestructura lo existente. `gestion-trabajadores`,
`gestion-pasivos`, `carnetizacion` y `admin` se quedan como están, salvo tres intervenciones
puntuales:

1. `proxy.ts` — sustituir la cascada por la tabla (§13.4).
2. Los `roleAccept` de los sidebars — leer de `CAPACIDADES` en lugar de repetir literales.
3. Agregar el badge de notificaciones al encabezado compartido.

La migración de las pantallas antiguas a `src/modules/` es trabajo de la fase F del plan de
reconstrucción, no de esta. Mezclarlas convertiría una entrega funcional en una refactorización sin
fecha de término.

---

## 14. Pruebas

Hoy hay **4 funciones de prueba en todo el backend** y **cero en el frontend**. La Fase 2 introduce una
máquina de estados de 16 estados y una transacción financiera-administrativa: es el punto donde la
ausencia de pruebas deja de ser deuda y pasa a ser un riesgo operativo. Un expediente trabado no es un
error cosmético — es una contratación detenida y una persona esperando.

**El mínimo no negociable**, por orden de importancia:

| Qué se prueba | Tipo | Por qué es imprescindible |
|---|---|---|
| **Toda transición legal de §4.2** y el rechazo de las ilegales | unitaria, parametrizada | Es el contrato del módulo. Una tabla de `(origen, destino, rol)` esperados y su inverso: lo que no está en la tabla debe fallar |
| **La asignación atómica de §4.4** con puesto tomado en paralelo | integración con transacciones reales | Dos expedientes al mismo `AsigTrabajo`. Si esto no está probado, se descubre en producción con la persona ya contratada |
| **Reserva vencida entre aprobación y asignación** | integración | El camino `LISTO_PARA_ASIGNAR → EN_PRESUPUESTO` sólo se recorre por vencimiento; nadie lo va a encontrar a mano |
| **Aprobación parcial de autogestión** | integración | Que `Employee` reciba **sólo** los cambios aprobados y ninguno más. Es lo que hace real el rechazo (H-2) |
| **Rechazo deja `Employee` intacto** | integración | La garantía central de H-2, en una sola prueba |
| **Credencial de postulante**: vencida, ventana equivocada, bloqueo por intentos, expediente ajeno, clave sin cambiar | unitaria | Es el único punto del sistema donde alguien sin cuenta escribe datos, y la cédula es pública |
| **Matriz de §7.2** endpoint por endpoint, con rol correcto e incorrecto | integración | Sin esto, CRIT-08 vuelve por la puerta de atrás en cada endpoint nuevo |
| **Idempotencia del outbox** con `clave_evento` repetida | unitaria | Un evento entregado dos veces a nómina es un problema de pago |
| **Migración del carnet**: `LEGACY` vs. data-driven | comparación de imagen | §4.6. Un carnet distinto al que la gente tiene en la mano |

Herramientas: `pytest` + `pytest-django` + `factory-boy` en backend (nada de esto está instalado hoy);
`vitest` para la tabla de capacidades de §13.4 y `playwright` para los recorridos completos de
aprobación. La cobertura útil aquí no se mide en porcentaje global sino en **transiciones cubiertas**:
la tabla de §4.2 tiene un número finito de aristas y la meta es todas.

---

## Apéndice · Trazabilidad con `propuesta-gath.jpg`

| Nodo del diagrama original | Dónde quedó | Cambio |
|---|---|---|
| Candidato: Acceso con Usuario/Clave Temporal | §4.3 Ventana 1 | **cédula + contraseña temporal** entregada en persona, sin fila en `cuenta` (H-1) |
| Candidato: Ingreso de Datos y Test Psicofísico | §4.1 POST1 | test separado de la verificación (O-7) |
| ¿Aprueba Test y Corrobora Datos? | §4.1 CAP2 | dos decisiones distintas |
| Eliminar Datos y Cierre de Proceso | §4.2 `RECHAZADO_CAPTACION` | retención en vez de borrado (O-2) |
| Abrir Expediente y Generar Punto de Cuenta | §4.1 VOK + PROK | se parte en Solicitud de Personal y Punto de Cuenta (O-4) |
| ¿Valida Solicitud Presupuestaria? | §4.4 | vacante automática + disponibilidad registrada (O-5) |
| Regresa a RRHH con Motivo de Rechazo (×2) | §4.2 | tres destinos distintos según la causa (O-3) |
| Gestión de Ruta del Documento | §5.2 `DocumentoGenerado` + `FirmaDocumento` | con correlativo y snapshot |
| ¿Director General Firma y Aprueba? | §4.1 DIR | libera la reserva al rechazar |
| Analista genera Documento de Contratación | §4.1 C2 | tras la revisión final |
| Generar Documentación Adicional | §4.1 POST2 | **lo llena el postulante**, prellenado (O-1) |
| *(no estaba)* Asignación de cargo | §4.4 ASIG | transacción atómica (O-6) |
| *(no estaba)* Almacenamiento y tareas asíncronas | §12 | SeaweedFS + RabbitMQ, endurecidos |
| *(no estaba)* Frontend y sesión de invitado | §13 | `src/modules/`, tabla de capacidades, proveedor de invitado |
| *(no estaba)* Pruebas | §14 | mínimo no negociable sobre la máquina de estados |
| Inicio de Actividades y Registro en Nómina | §4.7 | vía outbox, no escritura directa (O-8) |

---

*Documento generado a partir del código de la rama `dev` al 21-08-2026. Las referencias
`archivo:línea` son verificables. Las decisiones de §9 están pendientes y condicionan §5 y §10.*
