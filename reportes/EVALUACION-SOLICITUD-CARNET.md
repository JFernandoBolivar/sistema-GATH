# Evaluación — Solicitud de carnet desde Autogestión

**Fecha:** 2026-11-10
**Estado:** diagnóstico y propuesta. No se modificó código.

## 1. Diagnóstico

### Lo que hace hoy el sistema

`POST /api/v1/autogestion/solicitar-carnet/`
(`BACKEND/apps/autogestion/presentation/views/autogestion_views.py:265`) **no crea
una solicitud**: emite el carnet de inmediato con
`solicitar_mi_carnet()` → `RepoCarnetizacionORM().emitir_carnet()`.

Solo hay una validación:

```python
if repo.tiene_carnet_activo(cedula):
    return fail("Ya posee un carnet institucional activo y vigente.", 409)
```

No existe un modelo `SolicitudCarnet`, ni estado «pendiente», ni aprobación de
Carnetización, ni periodo de espera. La bandeja de Solicitudes de O51 usa datos
de ejemplo porque el backend canónico nunca se construyó.

### Por qué permitió solicitarlo dos veces

Influyen tres cosas:

1. **La primera solicitud ya emite el carnet**, aunque la interfaz diga
   «Solicitud enviada. Recursos Humanos la revisará». El mensaje es incorrecto.
2. **No hay bloqueo de solicitud pendiente** porque no hay solicitud: solo se
   comprueba si ya existe un carnet activo.
3. Si la emisión de la primera vez no se reflejó de inmediato en la caché de
   «Mi expediente» o la petición falló después de crear el registro, la UI sigue
   mostrando «Sin Carnet Activo» y el botón habilitado. La segunda emisión
   desactiva la primera y crea otra; por eso «aparece» después.

## 2. Flujo propuesto

```
Trabajador (Autogestión)
  └─ Solicitar carnet (motivo + justificación)
       └─ POST /autogestion/solicitar-carnet/
            ├─ ¿Ya hay una solicitud PENDIENTE? → 409 «Ya tiene una solicitud en revisión»
            ├─ ¿Carnet activo y vigente?         → 409 «Ya posee carnet activo»
            ├─ ¿Dentro del periodo de espera?    → 409 «Puede solicitarlo a partir del …»
            └─ Crea SolicitudCarnet(PENDIENTE)
                 └─ Notifica a Carnetización

Carnetización (Bandeja de Solicitudes)
  ├─ Aprobar y emitir → emite el carnet y marca APROBADA + carnet_id
  └─ Rechazar (motivo obligatorio) → RECHAZADA + motivo

Trabajador
  ├─ PENDIENTE → «Solicitud recibida, en revisión por RRHH» (sin botón)
  ├─ APROBADA → carnet disponible + PDF
  └─ RECHAZADA → motivo + fecha en que puede volver a solicitar
```

### Regla de unicidad

Una sola solicitud **PENDIENTE** por trabajador. Se refuerza con un índice único
parcial en base de datos:

```sql
UNIQUE (empleado_id) WHERE estado = 'PENDIENTE'
```

Así, aunque el usuario pulse dos veces o abra dos pestañas, la segunda recibe
409.

## 3. Modelo de datos propuesto

`SolicitudCarnetModel` (nueva tabla `CarnetSolicitud`):

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `empleado` | FK Employee | Zero-IDOR: se toma de la sesión |
| `motivo` | FK motivo de carnet | primera emisión, renovación, deterioro, pérdida |
| `justificacion` | texto | obligatoria |
| `estado` | enum | PENDIENTE / APROBADA / RECHAZADA / ANULADA |
| `origen` | enum | AUTOGESTION / CARNETIZACION |
| `solicitada_en` | datetime | |
| `revisada_en` | datetime | |
| `revisada_por` | FK usuario | auditoría |
| `motivo_rechazo` | texto | obligatorio al rechazar |
| `carnet` | FK CarnetEmitido | se llena al aprobar |
| `carnet_anterior` | FK CarnetEmitido | para renovaciones |
| `created_at/updated_at` | | BaseModel |

## 4. Endpoints

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/api/v1/autogestion/solicitar-carnet/` | Crea la solicitud PENDIENTE |
| `GET` | `/api/v1/autogestion/mi-carnet/solicitud/` | Estado de la última solicitud del usuario |
| `GET` | `/api/v1/carnetizacion/solicitudes/` | Bandeja paginada (PENDIENTE por defecto) |
| `POST` | `/api/v1/carnetizacion/solicitudes/{id}/dictamen/` | `{aprobada: bool, motivo_rechazo?}` |
| `GET` | `/api/v1/carnetizacion/solicitudes/{id}/` | Detalle y comparativo |

La UI de O51 (`solicitudes-carnet-view.tsx`) ya está cableada para estos campos:
`solicitudSolicitud`, `poblacion`, `motivoSolicitud`, `justificacion`,
`estado`, `motivoRechazo`, `carnetAnteriorEstado`.

## 5. Parámetros propuestos

Configurables en `/configuracion/parametros` (grupo Carnetización):

| Clave | Defecto | Efecto |
|---|---|---|
| `carnetizacion.solicitud_espera_rechazo_dias` | `7` | Días antes de repetir tras un rechazo |
| `carnetizacion.renovacion_carnet_meses` | `12` | Meses de vigencia antes de permitir renovación |
| `carnetizacion.reposicion_extravio_dias` | `30` | Espera entre reposiciones por pérdida |
| `carnetizacion.solicitud_max_anio` | `3` | Tope de solicitudes por año calendario |
| `carnetizacion.solicitud_aprobacion_auto` | `false` | Si se enciende, aprueba sin pasar por bandeja (no recomendado) |

## 6. Política de pérdida o extravío

- Se permite solicitar **aunque el carnet esté activo**, porque el anterior debe
  anularse.
- Exige motivo `PÉRDIDA / EXTRAVÍO` y justificación.
- Sigue pasando por aprobación de Carnetización (para evitar fraudes).
- Aplica un periodo de espera (`reposicion_extravio_dias`) desde la última
  reposición por el mismo motivo, salvo que un administrador la anule.
- La aprobación anula el carnet anterior y emite uno nuevo, dejando el histórico.

## 7. Estados en Mi carnet

| Estado | UI |
|---|---|
| Sin carnet, sin solicitud | Botón «Solicitar mi carnet» |
| Solicitud PENDIENTE | Tarjeta «Solicitud recibida» + fecha + «En revisión por RRHH» (sin botón) |
| APROBADA | Carnet activo + descarga PDF |
| RECHAZADA | Motivo + «Podrá solicitarlo nuevamente el …» (botón deshabilitado con fecha) |
| Carnet activo | Carnet + «Solicitar renovación» solo si está dentro de la ventana |

## 8. Ventajas

- Desaparece la doble solicitud por diseño (una pendiente + índice único).
- El trabajador no recibe un carnet sin revisión.
- Carnetización tiene la bandeja real que hoy es maqueta.
- Los plazos quedan auditados y configurables.
- El histórico de solicitudes explica cada emisión.

## 9. Riesgos y consideraciones

- **Migración:** los carnets activos actuales no tienen solicitud; se pueden
  backfillear como `APROBADA` con origen `CARNETIZACION` o dejar el histórico
  vacío. Recomiendo backfill para que la bandeja no arranque sin contexto.
- **Caché:** al aprobar/emitir hay que invalidar «Mi expediente»; ya existe la
  señal para `CarnetEmitidoModel`, pero la solicitud nueva también debe
  invalidar.
- **Notificaciones:** avisar al trabajador al aprobar/rechazar y a Carnetización
  al recibir una solicitud.
- **Permisos:** la bandeja exige `carnetizacion.ver`; el dictamen,
  `carnetizacion.emitir` o un permiso nuevo `carnetizacion.dictaminar`.
- **Concurrencia:** el índice único parcial y una transacción al aprobar evitan
  dos carnets para una misma solicitud.

## 10. Recomendación

Implementarlo en dos fases:

1. **Fase 1 — Solicitud y bloqueo:** modelo, endpoint de creación, estado en Mi
   carnet, una pendiente por trabajador y parámetros de espera. Aquí se corrige
   el doble solicitud.
2. **Fase 2 — Bandeja real:** endpoints de listado/dictamen, aprobación que
   emite, rechazo con motivo, notificaciones y backfill de carnets activos.

No conviene mantener la emisión directa mientras se construye la bandeja: el
primer paso es dejar de emitir en `POST /autogestion/solicitar-carnet/` y crear
la solicitud pendiente.
