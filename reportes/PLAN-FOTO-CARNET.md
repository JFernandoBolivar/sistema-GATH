# Plan — Foto obligatoria, cita y entrega del carnet

**Fecha:** 2026-11-10
**Estado:** evaluación y plan. No se modificó código.
**Relacionado:** `reportes/EVALUACION-SOLICITUD-CARNET.md`

## 1. Problema actual

- El carnet se puede emitir **sin foto**: el generador PDF dibuja un
  marcador «FOTO» (`_dibujar_placeholder_foto`) y el carnet sale igual.
- En Mi carnet se ve el marcador «FOTO» y aun así el botón «Solicitar mi carnet»
  está habilitado.
- No existe una validación de foto (nitidez, frontal, reciente) ni un flujo de
  cita para tomarla en Carnetización.
- La foto sí se puede cargar desde Autogestión (sección «Foto» de la solicitud
  de actualización, con cámara o archivo) y Carnetización puede subirla con
  `CarnetSubirFotoView`, pero **ninguno de esos caminos bloquea la emisión**.

## 2. Regla de negocio propuesta

> **No se emite ni se aprueba un carnet sin una fotografía validada.**
> Para la primera emisión la foto es obligatoria. En renovaciones se reutiliza
> la foto vigente si tiene menos de `carnetizacion.foto_vigencia_meses`; si no,
> se exige una nueva.

La foto puede provenir de:

1. **Autogestión:** el trabajador la sube con la cámara o un archivo
   (reutiliza `FotoSeccion`, `CapturaFoto`).
2. **Carnetización:** se la toman o la suben en la oficina
   (`CarnetSubirFotoView`).
3. **Cita presencial:** el trabajador va el día agendado y Carnetización la
   captura y valida.

En los tres casos queda un estado de **validación** antes de aprobar la emisión.

## 3. Estados propuestos

La solicitud de carnet suma estados:

| Estado | Significado | Quién actúa |
|---|---|---|
| `REQUIERE_FOTO` | No hay foto válida | Trabajador / Carnetización |
| `CITA_AGENDADA` | Tiene cita para foto y entrega | Trabajador asiste |
| `FOTO_EN_REVISION` | Foto cargada, pendiente de validar | Carnetización |
| `PENDIENTE` | Foto validada, lista para dictamen | Carnetización |
| `APROBADA` | Carnet emitido | Entrega |
| `RECHAZADA` | Rechazada (foto o solicitud) con motivo | Trabajador |
| `CANCELADA` | El trabajador desiste o no asiste | Carnetización |

## 4. Flujo completo

```
Trabajador entra a Mi carnet
  └─ ¿Tiene foto válida?
       ├─ NO → Tarjeta «Necesita una foto para su carnet»
       │        ├─ [Cargar foto] (cámara/archivo) → FOTO_EN_REVISION
       │        └─ [Solicitar cita en Carnetización] → CITA_AGENDADA
       │
       └─ SÍ → Solicitud normal → PENDIENTE → APROBADA → carnet

Carnetización (bandeja)
  ├─ Solicitudes con foto faltante o en revisión
  ├─ Agendar cita: fecha, hora, sede, cupo
  ├─ Subir/tomar foto y validarla → PENDIENTE
  ├─ Rechazar foto (motivo) → REQUIERE_FOTO
  ├─ Aprobar y emitir → APROBADA + carnet
  └─ Registrar entrega (retiro en sede o digital)
```

### Cita

Para la primera versión, Carnetización agenda **fecha y hora** manualmente y el
trabajador recibe:

- Fecha y hora.
- Sede y oficina.
- Qué llevar (cédula, requisitos de la foto).
- Si el carnet se entrega en la misma cita o se descarga después.

En una segunda fase se puede pasar a una **agenda de cupos** (turnos) con
reprogramación.

### Foto

Requisitos mínimos (reutilizando `validar_archivo`):

- Frontal, reciente, sin filtros, fondo claro.
- JPG/PNG, tamaño máximo actual.
- Resolución mínima (p. ej. 600×800).
- Una sola foto vigente por trabajador.
- Validación manual por Carnetización (no se inventa detección facial en la
  primera fase).

## 5. Modelo de datos

### En `SolicitudCarnet`

| Campo | Tipo | Uso |
|---|---|---|
| `estado` | enum | Incluye los estados de foto |
| `foto_validada` | bool | Gate de emisión |
| `foto_validada_por` | FK usuario | Auditoría |
| `foto_validada_en` | datetime | Auditoría |
| `foto_origen` | enum | AUTOGESTION / CARNETIZACION / CITA |
| `cita` | FK `CitaFoto` | Cita asociada |
| `entrega_metodo` | enum | RETIRO_SEDE / DIGITAL |
| `entrega_en` | datetime | Fecha de retiro o descarga |
| `motivo_rechazo` | texto | Foto o solicitud |

### `CitaFotoModel`

| Campo | Tipo |
|---|---|
| `id` | UUID |
| `empleado` | FK |
| `solicitud` | FK |
| `sede` | texto / catálogo |
| `fecha_hora` | datetime |
| `duracion_min` | int |
| `estado` | AGENDADA / CUMPLIDA / NO_ASISTIO / CANCELADA |
| `reprogramada_de` | FK self, opcional |
| `creada_por` | FK usuario |

### Catálogo opcional `TurnoFotoModel`

Para la fase 2: día de la semana, hora inicio/fin, duración, cupo, sede.
Mientras tanto, la cita se agenda a mano.

## 6. Parámetros propuestos

| Clave | Defecto | Uso |
|---|---|---|
| `carnetizacion.foto_obligatoria` | `true` | Gate global |
| `carnetizacion.foto_vigencia_meses` | `24` | Reutilizar foto en renovación |
| `carnetizacion.cita_foto_dias_habiles` | `1,2,3,4,5` | Días disponibles |
| `carnetizacion.cita_foto_hora_inicio` | `08:00` | Agenda |
| `carnetizacion.cita_foto_hora_fin` | `15:00` | Agenda |
| `carnetizacion.cita_foto_duracion_min` | `15` | Duración del turno |
| `carnetizacion.cita_foto_cupo_turno` | `4` | Capacidad |
| `carnetizacion.cita_foto_sede` | `Sede Central` | Sede por defecto |
| `carnetizacion.cita_reprogramar_horas` | `24` | Antelación mínima |
| `carnetizacion.entrega_carnet_dias` | `3` | Días tras aprobar |
| `carnetizacion.foto_reuso_renovacion` | `true` | Politica de reuso |

## 7. Cambios por capa

### Backend

1. **Gate de emisión:** en `RepoCarnetizacionORM.emitir_carnet` (o en el caso de
   uso de aprobación) exigir `empleado.profile` y `foto_validada`; si falta,
   `ValidationError`/409 con un mensaje claro. El placeholder del PDF queda solo
   para vistas previas internas.
2. **Solicitud:** crear el modelo y el endpoint de creación (ver
   `EVALUACION-SOLICITUD-CARNET.md`).
3. **Cita:** endpoints para agendar, reprogramar y cancelar; validar cupo y
   fecha futura.
4. **Foto:** reutilizar `CarnetSubirFotoView` y el soporte de Autogestión;
   marcar `foto_validada` al validar.
5. **Notificaciones:** al agendar cita, al validar/rechazar foto, al aprobar y
   al estar listo para retiro.
6. **Auditoría:** quién validó la foto, quién agendó, quién entregó.

### Frontend

1. **Mi carnet:** tarjeta de estado según la tabla anterior; acciones «Cargar
   foto» y «Solicitar cita»; fecha de cita y requisitos.
2. **Bandeja de Carnetización:** columna de foto (Con foto / Sin foto / En
   revisión), acciones «Agendar cita», «Subir foto», «Validar foto»,
   «Rechazar foto», «Aprobar y emitir», «Registrar entrega».
3. **Calendario de citas:** vista simple por día; en fase 2, cupos.

## 8. Fases

### Fase 1 — Bloqueo y foto desde Autogestión (prioridad)
- Gate de emisión sin foto validada.
- Estado `REQUIERE_FOTO` en Mi carnet.
- Reutilizar la carga de foto existente.
- Carnetización valida/rechaza la foto.
- Pruebas de que no se emite sin foto.

### Fase 2 — Cita y entrega
- `CitaFotoModel` y agenda manual.
- Notificación con día, hora, sede y requisitos.
- Registro de asistencia, no asistencia y entrega.
- Reprogramación.

### Fase 3 — Agenda de cupos
- Turnos con capacidad, feriados y sede.
- Reprogramación automática y lista de espera.
- Recordatorios 24 h antes.

## 9. Criterios de aceptación

- Un trabajador sin foto **no puede** obtener un carnet ni por Autogestión ni
  por aprobación directa (API 409).
- Mi carnet muestra «Necesita una foto» y no permite solicitar dos veces.
- Carnetización puede agendar una cita y el trabajador la ve con fecha, hora y
  sede.
- La foto cargada queda «en revisión» hasta que Carnetización la valide.
- Al aprobar, el carnet se emite y se registra el método de entrega.
- Todas las transiciones quedan auditadas y notificadas.
- Los carnets anteriores con placeholder se identifican y se reemiten.

## 10. Riesgos

- **Datos existentes:** puede haber carnets emitidos con el marcador «FOTO».
  Hay que listarlos y programar su reemplazo.
- **Fotos en SeaweedFS:** la descarga puede fallar (ya se vio en QA); el flujo
  debe mostrar un error claro y no emitir a ciegas.
- **Pasivos y personal remoto:** la cita presencial puede no aplicar; permitir
  carga desde Autogestión con validación remota.
- **Privacidad:** la foto es dato personal; restringir su visualización a
  Carnetización/Bienestar y auditarla.
- **No asistencia:** definir política de reprogramación y cupo.

## 11. Recomendación

Implementar **Fase 1 ya**, porque es la que evita carnets sin foto y se apoya en
la carga de foto que ya existe. La cita y la entrega pueden ir en la misma
tanda si se acepta una agenda manual; la agenda de cupos queda para después.

El orden natural es:

1. Modelo de solicitud con estados (incluye `REQUIERE_FOTO`).
2. Gate de emisión sin foto.
3. Carga/validación de foto.
4. Cita manual + notificación.
5. Entrega y auditoría.
