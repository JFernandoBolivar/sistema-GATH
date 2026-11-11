# AUD3 PASO 5 — Modelo de datos

**Skill usada:** `supervision-modelos-bd` (BACKEND).
**Método:** inventario de los modelos `managed`, revisión de `on_delete`,
índices, claves y migraciones; lectura de la política de retención. Sin cambios
de esquema.

## Resumen

La integridad referencial está bien resuelta: `CASCADE` solo en hijos
dependientes del padre, `PROTECT` en constancias, decisiones, credenciales y
catálogos, y `SET_NULL` en las referencias de auditoría. Las tablas propias
heredan `BaseModel` (UUIDv7) salvo siete satélites de la tabla legada
`USER_cuenta` y la secuencia anual. Las migraciones están al día y las tablas
grandes ya tienen índices compuestos. Lo pendiente es medir y añadir índices en
tres tablas de mucho tráfico y decidir la retención de la bitácora del QR.

## Hallazgos

### S5-01 — Integridad referencial (INFO, verificada)

| Relación | `on_delete` | Criterio |
| -------- | ----------- | -------- |
| `ConstanciaFeDeVidaModel.solicitud` | `PROTECT` | no se borra una solicitud con constancia |
| `DecisionFeDeVidaModel.solicitud` | `PROTECT` | la bitácora de decisión se conserva |
| `CredencialExternaModel.tipo_credencial` / `.empleado` | `PROTECT` | maestros y persona |
| `EventoInvitadoModel.categoria` / `.zona` | `PROTECT` | catálogos del evento |
| `CargaMasivaFilaModel.carga` | `CASCADE` | hijos dependientes del lote |
| `EventoCategoriaModel.evento`, `EventoInvitadoModel.evento` | `CASCADE` | hijos del evento |
| `creado_por` / `ingreso_registrado_por` | `SET_NULL` | referencia de auditoría |
| `EmpleadoModel` (legado) | `DO_NOTHING` / `managed=False` | tabla externa, la FK la gobierna el sistema legado |

No se encontró ninguna `CASCADE` hacia un catálogo o entidad maestra.

### S5-02 — Índices existentes (INFO, verificado)

Las tablas que más se filtran ya tienen `Meta.indexes` compuestos:
`solicitud_fe_de_vida (proceso, estado)`, `notificacion (destinatario, leida,
-created_at)` y `(destinatario, modulo, leida, -created_at)`,
`trabajo_exportacion (solicitante, estado)` y `(estado, expira_en)`,
`evento_outbox (estado, proximo_intento)`, `intento_fallido (cedula,
fecha_hora)`, `solicitud_actualizacion (cedula, estado)` y `(estado,
ventana_fin)`, `cambio_propuesto (origen_tipo, origen_id)`, `credencial_externa
(estado, vigencia_hasta)`, entre otros. Las búsquedas por `numero` y
`codigo_verificacion` de la constancia usan columnas `unique` (ya indexadas).

### S5-03 — Siete modelos con PK entera implícita (BAJA, documentado)

`PasswordInicialModel`, `PermisosVersionModel`, `DesactivacionEgresoModel`,
`EjecucionUnicaModel` y `PrestamoCargoSuspensionModel` son satélites 1:1 de una
cuenta/prestamo legado identificado por entero; `SecuenciaPuntoCuentaModel` usa
`anio` como PK por diseño (contador atómico) y `TipoCredencialModel` usa un
código natural. La convención UUIDv7 (`BaseModel`) aplica a las entidades
propias, no a estos satélites; cambiarlos obligaría a tocar la tabla legada.

### S5-04 — Tres tablas sin índice en campos de filtrado (MEDIA, a decisión)

| Modelo | Campos candidatos | Consulta |
| ------ | ----------------- | -------- |
| `CargaMasivaModel` | `estado` | bandeja de cargas por estado |
| `BitacoraAccesoQrModel` | `security_hash`, `ip` | auditoría de accesos al QR |
| `EventoInvitadoModel` | `documento_identidad` | búsqueda de invitado por documento |

La BD local es pequeña y no hay evidencia de `Seq Scan` en producción; la skill
pide **medir antes de indexar**. Recomendación: `EXPLAIN (ANALYZE, BUFFERS)` en
preproducción y añadir el índice (con `AddIndexConcurrently` si la tabla es
grande) en una migración dedicada.

### S5-05 — Migraciones (INFO, verificado)

`makemigrations --check --dry-run`: **No changes detected**. No hay migraciones
pendientes ni modelos sin migrar.

### S5-06 — Datos personales y retención (MEDIA, a decisión)

- La cédula es el identificador natural y viaja en claro en las tablas propias y
  en las legadas (`EmployeeModel.cedulaidentidad`). Cifrarla impediría las
  búsquedas exactas que sostienen el login y los flujos; la skill pide no
  decidirlo unilateralmente: es una decisión del responsable del dato (modelo de
  amenaza, hash determinista para búsqueda, etc.).
- `purgar_retencion` cubre evidencias de fe de vida, soportes documentales,
  notificaciones y outbox. **No** cubre `BitacoraAccesoQrModel` (IP y
  user-agent de quien escanea un carnet) ni `IntentoFallidoModel` (crece con
  cada intento). La primera es un dato personal de un visitante y conviene un
  plazo explícito; la segunda es seguridad y suele conservarse, pero debe
  decidirse cuánto.

### S5-07 — Borrado de personas (INFO)

`EmployeeModel` es una tabla externa (`managed=False`). Borrar un empleado desde
el sistema legado no arrastra las tablas propias: las constancias y decisiones
quedan `PROTECT`, y las credenciales externas también. No hay `CASCADE` que
pueda vaciar historial por accidente; a cambio, un egreso no limpia datos y la
política de anonimización queda pendiente (S5-06).

## Verificación de este paso

- `makemigrations --check --dry-run`: sin cambios.
- No se creó ninguna migración ni se modificó ningún modelo.
