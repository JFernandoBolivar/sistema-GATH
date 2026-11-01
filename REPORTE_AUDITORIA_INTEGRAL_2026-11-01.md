# Reporte de auditoría integral — GATH

- **Fecha:** 2026-11-01
- **Rama:** `feature/fe-de-vida-pasivos` (sin commit)
- **Entorno:** Docker Compose local (`django-App`, `nextjs-App`, `gath_celery_worker`, `gath_celery_beat`, `gath_rabbitmq`, `gath_redis`, SeaweedFS)
- **URLs:** Next.js `http://localhost:3001`, Django `http://localhost:8001`
- **Base de datos:** PostgreSQL local dentro de Docker
- **Alcance:** inventario, pruebas automáticas, rendimiento, carga y matriz de acceso por rol. Los flujos de escritura y los E2E multi-navegador quedaron bloqueados (ver §8).

> Este reporte se escribió **después** de que el usuario pidiera correcciones de interfaz sobre la marcha. El código tocado después de la auditoría se lista en §10; la auditoría en sí se ejecutó en modo solo lectura.

---

## 1. Resumen ejecutivo

1. El backend está sano: **1167 pruebas pasan, 1 omitida**, `lint-imports` 82/0, migraciones sin cambios y el frontend compila con 0 errores de `tsc`/`eslint`.
2. La lentitud no viene de la base de datos: viene de **cuánto y cuántas veces se serializa por petición**. `/personal` devuelve **670 KB para 10 filas** y tarda **p50 976 ms**; `/me` resuelve permisos en **14 consultas** y tarda **p50 735 ms**.
3. Con **50 usuarios concurrentes** sobre pasivos, el p50 sube a **9.5 s** y el p99 a **19 s** (≈5 rps, 0 errores). El sistema atiende, pero no a velocidad usable.
4. Django corre con `runserver` y `CONN_MAX_AGE = 0`: **una conexión nueva por petición**, sin reutilización.
5. `check --deploy` reporta **320 avisos**, incluidos W004 (HSTS), W008 (SSL redirect), W012 (cookies sin `Secure`) y W016, más **173 errores de esquema** de drf-spectacular.
6. La matriz de acceso por rol se comporta como se espera: trabajador y pasivo reciben **403** en todo lo administrativo; Bienestar solo entra a lo suyo.
7. El E2E de escritura (alta, edición, egreso) está **bloqueado** porque `E2E_ADMIN_PASSWORD` sigue en `COMPLETAR`; Playwright solo tiene configurado **Chromium**.
8. Hay un **bug de contrato** en familiares: `getPorEmpleado` no desenvuelve el sobre `{status,message,data}` y hace `.map` sobre un objeto.
9. La app no está endurecida para producción: `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` y `SECURE_SSL_REDIRECT` en `False`, HSTS en `0`.
10. **Hallazgos:** 1 crítico, 4 altos, 4 medios y 4 bajos. Ninguno es una regresión de datos: no se creó ni borró un solo registro.

---

## 2. Tabla de hallazgos

| ID | Sev. | Área | Hallazgo | Evidencia | Impacto | Corrección propuesta |
|---|---|---|---|---|---|---|
| A-01 | **Crítico** | Personal / API | El listado `GET /api/v1/personal/?limit=10` devuelve el **expediente anidado completo** de cada fila: 670 955 bytes para 10 empleados (≈67 KB/fila) y p50 976 ms | `auditoria_2026-11-01/detalle_queries.txt`; `tiempos_api.txt` | Cada consulta de personal mueve ~0.65 MB; el navegador y el SSR pagan serialización y transferencia | En el listado devolver solo columnas de tabla (cédula, nombre, nómina, cargo, dependencia, estatus) y dejar el expediente para `GET /personal/<cedula>/`; ya existe el patrón (`_construir_expediente` solo en detalle) |
| A-02 | **Alto** | Identidad / Auth | `GET /identidad/auth/me/` ejecuta **14 consultas** y tarda p50 735 ms / p95 983 ms | `consultas_por_endpoint.txt`, `detalle_queries.txt` | Es la primera llamada de cada pantalla; se repite en cada navegación | Cachear por sesión la resolución de permisos (rol + overrides + `permisos_version`) y leerla en una sola consulta; invalidar por `permisos_version` |
| A-03 | **Alto** | Rendimiento global | Con 50 usuarios concurrentes el p50 es **9 510 ms** y el p99 **19 030 ms** (4.9 rps) | `carga_api.txt` | La operación diaria se vuelve inusable en horas pico | Atacar A-01/A-02 primero; después medir de nuevo antes de optimizar infraestructura |
| A-04 | **Alto** | Infraestructura | `CONN_MAX_AGE = 0` y el contenedor corre `python manage.py runserver 0.0.0.0:8000` | `docker inspect django-App`; `settings.py` | Sin reutilización de conexiones ni concurrencia real; el pool se agota antes de lo necesario | `CONN_MAX_AGE=60`, `CONN_HEALTH_CHECKS=True` y servidor de aplicación (gunicorn/uvicorn) con workers e hilos dimensionados |
| A-05 | **Alto** | Seguridad / despliegue | `SESSION_COOKIE_SECURE=False`, `CSRF_COOKIE_SECURE=False`, `SECURE_SSL_REDIRECT=False`, `SECURE_HSTS_SECONDS=0`; `check --deploy` con 320 avisos (W004, W008, W012, W016) | Salida de `manage.py check --deploy`; `settings.py` | Cookies de sesión y CSRF pueden viajar sin TLS; sin HSTS ni redirección | Activar los cuatro flags en producción (por variable de entorno), añadir `SECURE_PROXY_SSL_HEADER` y validar `check --deploy` en CI |
| A-06 | **Medio** | Contrato API | 173 errores `drf_spectacular.W002` en `check --deploy`: vistas `APIView` sin `serializer_class` (carnetización y otras) | Salida de `check --deploy` | El OpenAPI queda incompleto (295 operaciones documentadas con huecos) y el cliente se desalinea | Añadir `@extend_schema` o `serializer_class` a las vistas afectadas |
| A-07 | **Medio** | Familiares / frontend | `familiaresApi.getPorEmpleado` tipa `FamiliarApiItem[]` pero el backend responde el sobre `{status,message,data}`; `repoFamiliaresApi.listarPorEmpleado` hace `raw.map(...)` sobre un objeto | `familiares-api.ts:106`, `repo-familiares-api.ts:37`, `core/presentation/envelope.py:12` | `TypeError: raw.map is not a function` al listar familiares de un empleado desde el frontend | Tipar `ApiResponse<FamiliarApiItem[]>` y usar `raw.data`, como ya hace `personal-api.ts` |
| A-08 | **Medio** | Pruebas E2E | `E2E_ADMIN_PASSWORD` vale `COMPLETAR` | `NextJS/.env.test.local` | No se pueden probar altas, ediciones, egresos ni aprobaciones de extremo a extremo | Completar la credencial en el entorno de pruebas |
| A-09 | **Medio** | Pruebas E2E | `playwright.config.ts` solo define el proyecto Chromium | Configuración de Playwright | No hay verificación en Firefox ni WebKit, aunque `testing-e2e-playwright` los exige | Añadir los proyectos `firefox` y `webkit` |
| A-10 | **Medio** | Cobertura de auditoría | No se ejecutaron los flujos de escritura de la fase C (alta activo, alta pasivo, egreso, movimientos, fe de vida, autogestión, administración, reportes filtro por filtro) | §5 y §8 | La auditoría cubre lectura, contrato, rendimiento y acceso; la lógica de escritura queda sin validar en vivo | Desbloquear A-08 y ejecutar la matriz de flujos |
| A-11 | **Bajo** | Inventario API | `/api/v1/personal/fe-de-vida/` y `/api/v1/usuarios/` responden 404: las rutas reales son `/api/v1/fe-de-vida/...` e `/api/v1/identidad/usuarios/` | `matriz_acceso.txt` | No es defecto; era una sonda con ruta equivocada | Documentar las rutas reales en el inventario |
| A-12 | **Bajo** | Catálogos | El catálogo de tipos de nómina de **activos** no filtra `es_activo=True`; solo pasivos usa `solo_pasivos=true` | `FEEDBACK_GATH.md` punto 2 | En pantallas de activos aparecen nóminas de pasivos (JUBILADO, PENSIONADO, …) | Añadir `solo_activos=true` al endpoint y usarlo en altas, cargos, filtros y censo |
| A-13 | **Bajo** | UI / semántica | El grupo del menú «Bienestar Social» describe una unidad, no lo que gestiona (solicitudes de actualización de datos) | Sidebar de activos | Confunde al operador sobre el alcance del módulo | Renombrado a «Actualización de Datos» (ver §10) |
| A-14 | **Bajo** | Alcance funcional | El carnet digital y el censo de vivienda se mostraban en Autogestión antes de estar en producción | `/autogestion` | Funcionalidad visible sin respaldo operativo | Carnet oculto tras bandera; censo gobernado por `autogestion.censo_ver_propio` |

---

## 3. Pruebas automáticas

| Prueba | Comando | Resultado | Observaciones |
|---|---|---|---|
| Backend completo | `pytest -q --durations=25` (contenedor) | **1167 passed, 1 skipped** | 662 s. Más lentas: `test_listado_pagina_en_servidor_con_tope` 40.6 s; `test_seaweedfs_storage_falla_cerrado…` 34.5 s; seeds de roles 14–15 s |
| Fronteras de importación | `lint-imports` | **82 kept, 0 broken** | Arquitectura Onion respetada |
| Migraciones | `makemigrations --check --dry-run` | **Sin cambios** | Modelos y migraciones alineados |
| Despliegue | `manage.py check --deploy` | **320 avisos** | W004/W008/W012/W016 + 173 W002 de drf-spectacular |
| Frontend unitario | `vitest run` | **581 passed** | |
| Tipado | `tsc --noEmit` | **0 errores** | |
| Lint | `eslint` | **0 errores** | |
| Build | `next build` | **Correcto** | `output: standalone` |
| UTF-8 | validación de `NextJS/src` y `BACKEND/apps` | **888 archivos válidos** | Sin BOM y sin `?` donde iba acento |
| E2E G13 | Playwright (Chromium, cuenta Bienestar) | **7 passed, 2 skipped** | Solo lectura; escritura omitida por A-08 |

---

## 4. Matriz de roles: esperado frente a observado

Roles reales en base de datos (10): ADMINISTRADOR (110 permisos), ANALISTA (60), AUTOGESTION (11), PRESUPUESTO (12), BIENESTAR SOCIAL (20), RECEPCIONISTA (6), ANALISTA_BIENESTAR (30), ADMIN_BIENESTAR (35), AUDITOR (8), JEFE_RRHH (19). Catálogo total: **111 permisos**.

| Rol probado | Endpoint | Esperado | Observado | Veredicto |
|---|---|---|---|---|
| BIENESTAR | `/identidad/auth/me/` | 200 | 200 | ✅ |
| BIENESTAR | `/pasivos/?limit=10` | 200 (`pasivos.ver`) | 200 | ✅ |
| BIENESTAR | `/personal/?limit=10` | 200 (`personal.ver`) | 200 | ✅ |
| BIENESTAR | `/reportes/pasivos/` | 200 (`reportes.ver`) | 200 | ✅ |
| BIENESTAR | `/auditoria/` | 403 (sin `auditoria.ver_logs`) | 403 | ✅ |
| TRABAJADOR | `/pasivos/`, `/personal/`, `/reportes/pasivos/`, `/auditoria/` | 403 | 403 en los cuatro | ✅ |
| TRABAJADOR | `/identidad/auth/me/` | 200 | 200 | ✅ |
| PASIVO | `/pasivos/`, `/personal/`, `/reportes/pasivos/`, `/auditoria/` | 403 | 403 en los cuatro | ✅ |
| PASIVO | `/identidad/auth/me/` | 200 | 200 | ✅ |

Evidencia: `auditoria_2026-11-01/matriz_acceso.txt` y `matriz_roles.txt`. La matriz completa rol → permisos → menú está en `matriz_roles.txt`.

---

## 5. Resultados de los flujos (fase C)

| Flujo | Estado | Detalle |
|---|---|---|
| Consulta de pasivos (listado, filtros, paginación) | ✅ Ejecutado | 139 pasivos, 14 páginas de 10; filtros por cédula, nombre y nómina |
| Detalle de pasivo | ✅ Ejecutado | Datos, asignación y acciones según permiso |
| Familiares de pasivo | ✅ Ejecutado (lectura) | Rutas propias `/pasivos/familiares/*` |
| Menús y selector activo/pasivo | ✅ Ejecutado | Sidebar de pasivos con estructura de activos; selector refleja la ruta |
| Alta de activo con validaciones | ⛔ Bloqueado | `E2E_ADMIN_PASSWORD=COMPLETAR` |
| Alta directa de pasivo (wizard + foto) | ⛔ Bloqueado | Misma causa |
| Egreso activo → pasivo / egreso de pasivo | ⛔ Bloqueado | Misma causa |
| Movimientos (cada tipo y motivo) | ⛔ Bloqueado | Misma causa |
| Fe de vida completa | ⛔ Bloqueado | Misma causa (requiere dos roles y cámara) |
| Autogestión (solicitud, decisión, aplicación) | ⛔ Bloqueado | Misma causa |
| Administración (parámetros y bitácora) | ⛔ Bloqueado | Misma causa |
| Reportes filtro por filtro contra SQL | ⛔ Bloqueado | Misma causa |

**No se inventan resultados:** los flujos marcados no se ejecutaron.

---

## 6. Rendimiento

### 6.1 Tiempos de API (10 repeticiones, Django directo)

| Endpoint | p50 (ms) | p95 (ms) | Errores | Consultas SQL |
|---|---:|---:|---:|---:|
| Login completo | 1022.6 | — | 0/10 | — |
| `/identidad/auth/me/` | 734.8 | 982.9 | 0/10 | **14** |
| `/personal/?limit=10` | 976.1 | 1134.4 | 0/10 | 10 |
| `/pasivos/?limit=10` | 283.4 | 350.7 | 0/10 | 9 |
| `/pasivos/?limit=50` | 311.5 | 370.5 | 0/10 | 9 |
| `/reportes/pasivos/` | 363.7 | 484.0 | 0/10 | 9 |
| `/auditoria/` | 253.0 | 323.4 | 10/10 (403 esperado) | — |

Evidencia: `tiempos_api.txt`, `consultas_por_endpoint.txt`.

### 6.2 Peso de las respuestas

| Endpoint | Filas | Bytes |
|---|---:|---:|
| `/personal/` | 10 | **670 955** |
| `/pasivos/` | 10 | 6 994 |

El listado de personal pesa **96 veces más** que el de pasivos para el mismo número de filas: está serializando el expediente completo (vivienda, salud, formación, contactos, antecedentes, contratos, asignaciones, encargadurías) en cada fila.

### 6.3 N+1 y consultas

- `/personal` mantiene **10 consultas** con N=10 y N=50: **no hay N+1** por número de filas. El problema es el volumen del payload (A-01).
- `/me` ejecuta 14 consultas, de las cuales **8 son de identidad/permisos** (cuenta, versión de permisos, rol, permisos del rol, overrides, catálogo completo de permisos, etc.) en **cada petición** (A-02).
- Ninguna consulta individual supera 0.07 s; el costo está en la cantidad y en la serialización, no en el plan de ejecución.

### 6.4 EXPLAIN ANALYZE

**No ejecutado.** No se levantó `pg_stat_statements` ni se corrió `EXPLAIN ANALYZE` de las 10 consultas más lentas. Queda pendiente para la siguiente pasada; las mediciones actuales no permiten afirmar nada sobre índices o `Seq Scan`.

### 6.5 Causas ordenadas por impacto

| # | Causa | Ahorro estimado | Evidencia |
|---|---|---|---|
| 1 | Expediente anidado en el listado de personal | ~600 KB y ~500 ms por consulta de 10 filas | 670 955 bytes / 976 ms |
| 2 | Resolución de permisos en cada `/me` | ~8 consultas y ~400 ms por navegación | 14 consultas / 735 ms |
| 3 | `runserver` + `CONN_MAX_AGE=0` | Latencia de conexión en cada petición y techo de concurrencia | Configuración |
| 4 | Serialización por fila (DRF anidado) | CPU del worker | 67 KB/fila |

---

## 7. Carga y concurrencia

Mezcla: login, consulta de pasivos con filtros y detalle.

| Usuarios | p50 (ms) | p95 (ms) | p99 (ms) | Errores | RPS |
|---:|---:|---:|---:|---:|---:|
| 1 | 380.1 | 513.2 | 513.2 | 0/10 | 2.5 |
| 10 | 1 711.7 | 2 145.0 | 2 237.2 | 0/100 | 5.8 |
| 25 | 4 197.6 | 5 846.5 | 6 976.0 | 0/250 | 5.7 |
| 50 | **9 510.6** | 13 816.8 | **19 030.0** | 0/500 | 4.9 |

Evidencia: `carga_api.txt`, script `carga_api.py`.

- **No se agotó el pool** ni hubo errores 5xx en ningún escalón, pero el throughput se aplana en ~5 rps: el sistema encola.
- **No se midió** `max_connections` de PostgreSQL, CPU ni memoria por contenedor (`docker stats`) durante la carga: queda pendiente.
- **Carreras de concurrencia** (por ejemplo, dos aprobaciones simultáneas de fe de vida o dos egresos del mismo empleado) **no se probaron** con peticiones simultáneas reales.
- **Throttles:** no se verificó que varios usuarios tras la misma IP no se bloqueen entre sí.

---

## 8. Pruebas bloqueadas y su motivo

| Prueba | Motivo | Qué falta |
|---|---|---|
| E2E de escritura (alta, edición, egreso, movimientos, fe de vida, autogestión) | `E2E_ADMIN_PASSWORD` = `COMPLETAR` | Credencial de administrador en `.env.test.local` |
| E2E en Firefox y WebKit | Playwright solo define Chromium | Añadir proyectos al `playwright.config.ts` |
| EXPLAIN ANALYZE e índices | No se levantó `pg_stat_statements` | Extensión y permisos en Postgres local |
| `docker stats` durante carga | No se capturó | Repetir la carga con muestreo de CPU/memoria |
| Matriz de roles completa (10 roles) | Solo hay credenciales E2E de 3 perfiles | Cuentas de prueba por rol |
| Flujos de administración y reportes | Dependen de A-08 | Credencial de administrador |

---

## 9. Datos creados en la BD

**Ninguno.** La auditoría fue de solo lectura: no se crearon empleados, familiares, movimientos, carnets ni procesos. No hay SQL de reversión que ejecutar.

- Respaldo previo: `auditoria_2026-11-01/respaldo_bd_antes.sql` (4.1 MB, `pg_dump`).
- Respaldo del árbol de trabajo: `auditoria_2026-11-01/respaldo_inicial.patch` y `auditoria_2026-11-01/estado_inicial.txt`.
- Las cuentas E2E existentes (3333333, 437999434, 10079123, 10187736 y las cuentas 1062/1063/1065) no se modificaron.

Para restaurar el respaldo, si hiciera falta:

```bash
docker compose exec -T postgres psql -U <usuario> -d <base> < auditoria_2026-11-01/respaldo_bd_antes.sql
```

---

## 10. Cambios posteriores a la auditoría (feedback del usuario)

La auditoría se encargó en modo «no corregir nada». Después, el usuario pidió correcciones de interfaz. Se aplicaron **sin commit** y quedan documentadas aquí para explicar por qué el `git status` final no coincide con `estado_inicial.txt`:

| Cambio | Dónde | Motivo |
|---|---|---|
| Imagen del login a sangre completa | `/login`, recuperar, restablecer | Feedback visual |
| Menú de pasivos con la estructura del de activos | `app-sidebar-pasivos.tsx` | Consistencia |
| Rutas propias `/pasivos/familiares/*` | `app/(app)/pasivos/familiares/**` | Evitar saltar al módulo de activos |
| Filtros de pasivos sin fechas; nóminas `es_activo=false` | `pasivos-page.tsx` | Feedback |
| Columnas de pasivos: Código, Cédula, Nombre, Tipo de nómina, Egreso | `pasivos-columns.tsx` | Feedback |
| Egreso de pasivo (fallecimiento + sobrevivientes) | `egreso-pasivo-page.tsx` | Flujo propio del pasivo |
| Sidebar de activos restaurado (sin Configuración visual ni Autogestión) | `app-sidebar-personal.tsx` | Feedback |
| «Bienestar Social» → «Actualización de Datos» | Sidebar de activos + E2E | Nombre representativo |
| Oficina en la cabecera de Autogestión (no «NIVEL DE APOYO») | `mi-expediente-view.tsx` | Feedback |
| Antecedentes de servicio visibles en la ficha | `mi-expediente-view.tsx` | Faltaban |
| Carnet digital oculto tras bandera | `mi-expediente-view.tsx` | Aún no va a producción |
| Censo de vivienda fuera de la cabecera de Autogestión | `mi-expediente-view.tsx` | Sigue en el menú, gobernado por `autogestion.censo_ver_propio` |
| Pasada responsive de Autogestión (tabs, tablas, tarjetas, censo) | `mi-expediente-view.tsx`, `autogestion/censo/page.tsx` | Uso desde teléfono |

Verificación tras estos cambios: `tsc`, `eslint` y `next build` se repitieron; el detalle está en `FEEDBACK_GATH.md`.

---

## 11. Artefactos de la auditoría

| Archivo | Contenido |
|---|---|
| `estado_inicial.txt` | `git status --short` al iniciar |
| `respaldo_inicial.patch` | `git diff` al iniciar |
| `respaldo_bd_antes.sql` | `pg_dump` previo (4.1 MB) |
| `matriz_roles.txt` | Rol → permisos reales (10 roles, 111 permisos) |
| `endpoints.txt` / `openapi.json` | 250 rutas, 295 operaciones |
| `medir_api.py` / `tiempos_api.txt` | p50/p95 por endpoint |
| `medir_queries.py` / `consultas_por_endpoint.txt` | Consultas SQL por endpoint |
| `detalle_queries.py` / `detalle_queries.txt` | SQL y tiempos por consulta |
| `carga_api.py` / `carga_api.txt` | Escalones de 1, 10, 25 y 50 usuarios |
| `matriz_acceso.py` / `matriz_acceso.txt` | Matriz observada de acceso por rol |
| `pytest_durations.txt` | Salida de pytest con las 25 pruebas más lentas |

**Reproducir:** los scripts de `auditoria_2026-11-01/` se ejecutan dentro del contenedor `django` y no dependen de paquetes nuevos.
