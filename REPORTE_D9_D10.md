# Reporte D9 y D10 — 2026-10-31

Alcance: filas **D9** («Administración del sistema» y parámetros configurables) y **D10** (bitácora de auditoría) de `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md`. G5 («Documentos por movimiento») queda solo como espacio reservado, sin pantalla. Sin commit ni push.

---

## D9 — Administración del sistema

### Renombre y navegación
- «Seguridad» pasa a **«Administración del sistema»** en el menú lateral, el selector de módulos (`app-nav.tsx`), la portada (`inicio/page.tsx`), los títulos de `usuarios` y `configuracion`, y el breadcrumb del `HeaderLayout`.
- Las rutas actuales (`/usuarios`, `/usuarios/roles`, `/usuarios/notificaciones`) **no cambian**. Los nombres viven en `src/shared/lib/administracion-sistema.ts`.
- Dos apartados: **Usuarios y roles** (con Consultar/Registrar/Modificar y roles) y **Configuración** (Parámetros e Identidad visual).
- La portada de Configuración incluye la tarjeta reservada **«Documentos por movimiento»** con la etiqueta «Espacio reservado»; no tiene ruta ni lógica.

### Parámetros del sistema (backend)
- Tabla propia `configuracion_parametro_sistema` (`managed=True`), migración `configuracion.0002_parametrosistemamodel`. Campos: `clave` única, `etiqueta`, `descripcion`, `grupo`, `tipo` (booleano/entero/texto), `valor`, `valor_min`, `valor_max`, `actualizado_por_id`, timestamps del `BaseModel`.
- Definiciones en `apps/configuracion/domain/parametros.py` (tipo, grupo, rango y **valor por defecto**); la tabla guarda el valor vigente y el repositorio sincroniza los metadatos la primera vez que se lista.
- Validación en el dominio (`validar_valor`): booleanos normalizados, enteros con rango y lista de días de recordatorio (1–365, máximo 10, sin repetidos y ordenada).
- **Puerto** `LectorConfiguracion` en `core/domain/ports.py`, registrado por `apps.configuracion` en `core.infrastructure.providers`. La implementación lee la fila y, si aún no existe, devuelve el defecto de la definición.
- API (permiso `configuracion.editar`):
  - `GET /api/v1/configuracion/parametros/`
  - `PUT /api/v1/configuracion/parametros/<clave>/`
  - `GET /api/v1/configuracion/parametros/<clave>/historial/?pagina=&page_size=` (10/50)
  - `GET /api/v1/configuracion/parametros/recordatorios-fe-de-vida/` (autenticado; solo lectura).
- Cada cambio registra en `AuditoriaLog` (módulo `configuracion`, recurso `parametro`, `estado_previo={'valor': …}` y `estado_nuevo={'valor': …}`), con actor, IP y dispositivo.

### Parámetros iniciales

| Clave | Tipo | Defecto | Rango |
|---|---|---|---|
| `notificaciones.bienestar_por_correo` | booleano | `false` | — |
| `notificaciones.movimientos_por_correo` | booleano | `false` | — |
| `plazos.password_inicial_dias` | entero | 7 | 1–365 |
| `plazos.autogestion_max_prorrogas` | entero | 5 | 0–50 |
| `plazos.autogestion_aviso_dias` | entero | 1 | 1–30 |
| `fe_de_vida.dias_recordatorio` | texto | `30,15,7,3,1` | 1–365, máximo 10 |

### Usos de `settings`/constantes migrados al puerto

| Uso anterior | Dónde | Ahora |
|---|---|---|
| `NOTIFICAR_BIENESTAR_POR_CORREO` | `autogestion/infrastructure/receivers.py` | `LectorConfiguracion.obtener_booleano(CLAVE_NOTIFICAR_BIENESTAR_POR_CORREO)` |
| `NOTIFICAR_BIENESTAR_POR_CORREO` | `fe_de_vida/infrastructure/receivers.py` | mismo puerto |
| `NOTIFICAR_MOVIMIENTOS_POR_CORREO` | `movimientos/infrastructure/receivers.py` | `CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO` |
| `AUTOGESTION_AVISO_EXPIRACION_HORAS` (24 h) | `autogestion/infrastructure/tasks/avisar_ventanas_tasks.py` | `plazos.autogestion_aviso_dias` × 24 |
| `DIAS_VIGENCIA_PASSWORD_INICIAL` (7) | `aprovisionar_cuenta_trabajador`, `restablecer_acceso` | `plazos.password_inicial_dias` (el caso de uso recibe `dias_vigencia`) |
| Sin tope de prórrogas | `solicitud_ciclo.prorrogar_ventana` | `plazos.autogestion_max_prorrogas` (0 = sin límite; `ConflictError` al superarlo) |
| `DIAS_RECORDATORIO_SUGERIDOS` (front) | `modules/fe-de-vida/ui/procesos/selector-dias-recordatorio.tsx` | `getDiasRecordatorioSugeridosAction` (servidor) |

Se retiraron de `GATH/settings.py` y `BACKEND/.env.example` `NOTIFICAR_BIENESTAR_POR_CORREO`, `NOTIFICAR_MOVIMIENTOS_POR_CORREO` y `AUTOGESTION_AVISO_EXPIRACION_HORAS`; `.env` queda para lo técnico.

### Pantalla
- `/configuracion/parametros`: grupos **Notificaciones**, **Plazos** y **Fe de vida**; switch para booleanos, número con rango para enteros y texto para la lista de días.
- Validación Zod en el cliente y de nuevo en el dominio del servidor; **confirmación** antes de guardar (valor anterior → nuevo) y aviso de que aplica sin reiniciar.
- **Historial** por parámetro en diálogo, paginado 10/50, con fecha, usuario y valores anterior/nuevo.
- `/configuracion`: portada con Parámetros, Identidad visual (la pantalla de G4, sin cambios de lógica) y el espacio reservado de G5.

---

## D10 — Bitácora de auditoría

### Backend
- Nueva app `apps.auditoria` con capas Onion: entidades, filtros/paginación, puerto, casos de uso, repositorio y vistas.
- `GET /api/v1/auditoria/`: 10 por defecto, tope 50, orden `-fecha_hora, -id`. Columnas: fecha/hora, cédula y nombre, rol, acción, módulo, recurso (`tipo#id`), IP, `user_agent`, resultado.
- Filtros: usuario (cédula o nombre), acción, módulo, recurso, IP, `desde`/`hasta` (rango validado) y resultado.
- `GET /api/v1/auditoria/opciones/`: acciones, módulos y resultados **tomados de valores reales** de la tabla.
- `GET /api/v1/auditoria/<uuid>/`: detalle con `estado_previo`, `estado_nuevo` y `diferencias` campo → antes/después.
- `GET /api/v1/auditoria/pdf/` y `/excel/`: filtros aplicados impresos en el documento y cabeceras `X-Reporte-*`. El PDF/Excel genérico de `core` acepta ahora `filtros` (cambio compatible: por defecto `None`).
- `GET /api/v1/auditoria/incidentes/`: bloqueos e intentos fallidos desde `IntentoFallidoModel` (cédula, nombre, IP, fecha, resultado).
- Permisos: `auditoria.ver_logs` (consulta), `auditoria.exportar` (PDF/Excel), `auditoria.ver_seguridad` (incidentes). Ya existían en el catálogo; el seed crea el rol **AUDITOR** (id 17, idempotente) con esos tres más `notificaciones.ver_propias`, y el ADMINISTRADOR los conserva.

### Seguridad del detalle
- `core/domain/auditoria.py` define la **lista nombrada** `CAMPOS_SENSIBLES` (`password`, `contrasena`, `hash`, `token`, `access_token`, `refresh_token`, `authorization`, `secret`, `api_key`, `salt`, `pin`, `cookie`, `session`, `jwt`, con variantes por acentos/guiones) y `sanear_estado`/`diferencias`.
- Los valores sensibles se muestran como `***`; la diferencia se calcula sobre el valor real, pero ambos lados salen enmascarados. Tests unitarios y de integración lo cubren.

### Índices (decisión)
- `AuditoriaLog` es **`managed=True`** (tabla propia, ya migrada por `core`), no legada: **sí se migró**.
- `core.0005` agrega índice por `actor_cedula` y compuesto `resultado + fecha_hora`; `fecha_hora` y `accion` ya tenían índice y `modulo+accion` ya era compuesto. No se tocó ninguna tabla `managed=False`.

### Pantalla
- `/auditoria`: pestañas **Bitácora** e **Incidentes de seguridad** (esta solo con `auditoria.ver_seguridad`).
- Tabla con los filtros, paginación en servidor, botón «Ver detalle» que abre un diálogo con los metadatos y la tabla **campo → antes/después** (sin JSON crudo); exportación PDF/Excel solo con `auditoria.exportar`.
- Solo lectura: no hay acciones de edición ni borrado.

---

## Pruebas

| Verificación | Resultado |
|---|---|
| Backend focalizado (configuración, auditoría, seed, notificaciones, ciclo de vida, fe de vida) | **207 passed** |
| Backend completo | **1067 passed** (base 1034; +33 nuevas) |
| `lint-imports` | **82 kept, 0 broken** |
| Vitest | **96 archivos / 569 pruebas** (base 562; +7) |
| `tsc --noEmit` | sin errores |
| `eslint .` | **0 errores** (81 avisos preexistentes) |
| `next build` | compila y genera todas las rutas |
| E2E D9/D10 (`administracion-sistema.spec.ts`) | **4/4** |
| E2E de regresión `seguridad.spec.ts` | **5/5** |
| Axe en `/configuracion/parametros` y `/auditoria` | **2/2**, sin violaciones serious/critical |

### E2E en vivo
1. El módulo se llama «Administración del sistema», conserva `/usuarios` y muestra Usuarios y roles, Configuración y Bitácora; la portada de Configuración muestra Parámetros, Identidad visual y el espacio reservado de G5.
2. Se cambió `fe_de_vida.dias_recordatorio` a `12,4` y, **sin reiniciar**, el formulario «Nuevo proceso de fe de vida» ofreció «12 días antes» y «4 días antes»; la API devolvió `[12,4]`. Se restauró a `30,15,7,3,1`.
3. Bitácora: filtro por módulo `configuracion` y acción `configuracion.parametro_actualizado`, detalle antes/después y descarga PDF/Excel.
4. Un perfil de Bienestar (rol ADMIN_BIENESTAR, sin permisos de auditoría) abre `/auditoria` y ve el aviso de permiso, sin botones de exportación.

---

## Datos de prueba creados o restaurados

| Dato | Acción | Estado final |
|---|---|---|
| Migraciones `configuracion.0002` y `core.0005` | Aplicadas en la BD local | Aplicadas |
| Seed | Creado el rol **AUDITOR** (id 17) con 4 permisos | Se conserva (cambio pedido) |
| 6 parámetros | Creados con su valor por defecto al abrir la pantalla | Se conservan (configuración inicial) |
| `fe_de_vida.dias_recordatorio` | `30,15,7,3,1` → `12,4` → restaurado | `30,15,7,3,1` |
| `plazos.password_inicial_dias` | `7` → `8` → restaurado | `7` |
| Bitácora | 8 cambios de parámetro generados por las pruebas (append-only) | Se conservan; no se borra la bitácora |
| Total de registros de auditoría en la BD local | — | 126 |

No se tocaron las cuentas E2E protegidas (solo inicios de sesión de lectura y los cambios de parámetros anteriores) ni `src/modules/fe-de-vida`, salvo el selector de días sugeridos y su constante/test para consumirlos del servidor, y el receiver de fe de vida para leer el mismo puerto de configuración.

---

## Pendientes / observaciones
- **G5** («Documentos por movimiento») queda solo como espacio reservado, tal como se pidió; no hay modelos, API ni pantalla.
- La bitácora es append-only: las entradas generadas por las pruebas en vivo se dejan (no se borran).
- El detalle enmascara los campos de la lista nombrada; si en el futuro se guardan nuevos tipos de secretos, deben añadirse a `CAMPOS_SENSIBLES`.
- `E1` (hash encadenado de la bitácora) sigue fuera de este alcance.
