# Auditoría integral de GATH: verificar todo, NO corregir nada

Rama `feature/fe-de-vida-pasivos`. Este mensaje es **solo de auditoría**. Tu único entregable es `REPORTE_AUDITORIA_INTEGRAL_2026-11-01.md`. El usuario y Claude deciden después qué se corrige y te lo piden en otro mensaje.

---

## 0. Reglas que no se negocian

1. **Prohibido modificar código, configuración, migraciones, `.env`, `compose.yml`, el plan o los reportes que ya existen.** Si encuentras un bug, aunque se arregle con una línea, NO lo arregles: anótalo en el reporte con evidencia y con la corrección que propones.
2. Solo puedes **crear** archivos dentro de `auditoria_2026-11-01/` (scripts de carga, specs E2E nuevas, scripts de medición, capturas, logs) y el reporte final. Si una spec E2E tiene que vivir dentro de `NextJS/e2e/` para correr, créala en `NextJS/e2e/auditoria/` y anótala en el reporte para borrarla después.
3. No instales dependencias en `requirements*.txt` ni en `package.json`. Si necesitas una herramienta (locust, k6, autocannon), instálala aparte: venv propio en `auditoria_2026-11-01/.venv`, `npx --yes` o binario suelto.
4. **No edites archivos con PowerShell** (`Set-Content`/`Out-File` rompen el UTF-8). Usa tu herramienta de edición.
5. No hagas commit ni push, no hagas `git checkout`/`restore`/`stash` sobre archivos del usuario, y no borres nada que no hayas creado tú.
6. Antes de empezar: `git status --short > auditoria_2026-11-01/estado_inicial.txt` y `git diff > auditoria_2026-11-01/respaldo_inicial.patch`. Al terminar, `git status --short` tiene que mostrar lo mismo más tus archivos nuevos. Si no coincide, explica en el reporte qué cambió y por qué.
7. Base de datos: **solo la BD local de Docker**. Antes de cualquier prueba que escriba, saca un respaldo (`pg_dump` del contenedor de Postgres, en `auditoria_2026-11-01/respaldo_bd_antes.sql`). Lleva una lista de cada registro que crees (cédula, id, tabla) para deshacerlo. Usa cédulas de prueba que no existan, en el rango 99000000–99000999, y nombres con el prefijo `AUDITORIA`. Al final, **no borres nada**: deja en el reporte la lista y el SQL para deshacerlo. Lo ejecuta el usuario si lo aprueba.
8. No toques las cuentas E2E que ya existen (3333333, 437999434, 10079123, 10187736, cuentas 1062/1063/1065), y no cambies contraseñas ni correos de personas reales.
9. Los contenedores tienen el código horneado en la imagen. Antes de probar, `docker compose build django nextjs && docker compose up -d`, y confirma con un `grep` dentro del contenedor que la imagen trae el código actual. Las pruebas de rendimiento se miden **dos veces**: con el stack tal como está y con `next build` + `next start` (producción). Anota si DEBUG está activo.
10. Si una prueba no se puede ejecutar (por ejemplo, falta `E2E_ADMIN_PASSWORD`), márcala **BLOQUEADA** con el motivo y sigue con lo demás. Nada de "Pendiente" sin causa.

## 1. Skills que debes leer y seguir

Están en `C:\Users\josef\.claude-trabajo\skills\<nombre>\SKILL.md`. Léelas antes de cada fase y aplica sus reglas y checklists:

| Fase | Skills |
|---|---|
| Backend y N+1 | `testing-backend-django`, `patrones-drf-implementacion`, `supervision-modelos-bd`, `integracion-bd-externa`, `uso-librerias-backend` |
| Frontend unitario | `testing-unit-vitest` |
| E2E y accesibilidad | `testing-e2e-playwright`, `playwright-cli`, `testing-a11y-axe` |
| Seguridad (solo lectura y pruebas, sin explotar fuera de localhost) | `owasp-top-10-testing`, `api-security-testing`, `validacion-input-protegido` |

## 2. Fase A: inventario (antes de probar)

1. Lista de roles y permisos reales, sacada de `seed_permisos` y de la BD: rol → permisos → menús y rutas que debería ver. Esa matriz es el **oráculo** de las pruebas por rol.
2. Inventario de endpoints (drf-spectacular o `show_urls`) con el permiso que exige cada uno.
3. Inventario de pantallas y filtros: cada listado con sus filtros, su paginación (por defecto 10, tope 50) y su ordenamiento.

## 3. Fase B: pruebas automáticas existentes

Corre la suite completa y anota conteos reales (passed / failed / skipped / tiempo). Si algo falla, pega el traceback resumido:

- `pytest` completo del backend (dentro del contenedor), con `--durations=25`.
- `lint-imports`, `makemigrations --check --dry-run`, `python manage.py check --deploy`.
- `vitest run` completo, `tsc --noEmit`, `eslint`, `next build`.
- Suite E2E existente de Playwright en Chromium, Firefox y WebKit.
- Validación UTF-8 de `NextJS/src` y `BACKEND/apps`, y búsqueda de textos con `?` donde iba un acento o una `ñ`.

## 4. Fase C: flujos funcionales con Playwright, por rol

Para **cada rol** de la matriz: entrar, comprobar que ve exactamente los menús y las rutas que le tocan, y que por URL directa recibe 403 o redirección en lo que no le toca. Comprobar también contra la API (Zero-IDOR: pedir el recurso de otra cédula o de otro id). Haz capturas en `auditoria_2026-11-01/capturas/`.

Flujos que hay que recorrer de punta a punta, comprobando en la BD el resultado de cada paso:

1. **Registro de trabajador activo** desde Gestión de Personal Activo: alta completa, validaciones de cada campo (vacíos, formatos, cédula duplicada, correo duplicado), edición, consulta y PDF.
2. **Registro de pasivo** desde Gestión de Personal Pasivo (alta directa de jubilado y pensionado): catálogos, nómina `es_activo=False`, movimiento INGRESO, familiares y sobrevivientes.
3. **Egreso de trabajador** (de activo a pasivo y egreso definitivo): estado final en la BD, movimiento generado, que ya no aparezca en los listados de activos y que sí aparezca donde corresponde.
4. **Movimientos**: cada tipo y motivo, documentos generados, historial, avisos y permisos de exportación.
5. **Fe de vida completa**: proceso abierto y cerrado, prórroga individual y general, envío por el pasivo (cámara falsa y subida de archivo), archivo inválido rechazado, doble check en los dos órdenes, aprobación directa de la Administradora (con justificación, y 403 para la Analista), rechazo y repetición con motivo, cambios aplicados solo al llegar a `VALIDADA`, constancia PDF, correo en el outbox, `EXPIRADA` al cierre, notificaciones y auditoría.
6. **Autogestión**: solicitudes de actualización, decisión y aplicación de los cambios.
7. **Administración** (D9/D10): parámetros y bitácora.
8. **Reportes**: **cada filtro de cada reporte, uno por uno y combinados**. Compara el resultado con una consulta SQL directa equivalente: el conteo tiene que coincidir. Exportación a Excel/PDF, límites, filtros vacíos, rangos de fechas invertidos y caracteres especiales.
9. **Todos los listados**: paginación (página 1, la última, más allá de la última, `page_size=1000` limitado a 50), cada filtro, búsqueda con acentos, mayúsculas y espacios, orden.

Para cada flujo anota: resultado (OK / FALLA / BLOQUEADO), evidencia (captura o respuesta), y en caso de falla, pasos para reproducirla.

## 5. Fase D: rendimiento (el sistema está lento)

Mide **antes de opinar**. Hay que encontrar la causa real, no hacer una lista de sospechas.

1. Tiempos de punta a punta (p50/p95 de 10 repeticiones) de: login completo (incluido 2FA si aplica), carga del dashboard, consulta de trabajadores, detalle de trabajador, registrar un movimiento, abrir un reporte y la bandeja de fe de vida. Separa el tiempo del backend (API directa con `curl -w`) del tiempo de Next (SSR, proxy y server actions).
2. Número de consultas SQL por endpoint, con `CaptureQueriesContext` o el log de consultas. Todo endpoint de listado o detalle cuyas consultas crezcan con el número de filas es **N+1**: repórtalo con el endpoint, el conteo con N=10 y con N=50, y el `select_related`/`prefetch_related`/anotación que propones.
3. `EXPLAIN ANALYZE` de las 10 consultas más lentas (usa `pg_stat_statements` si está disponible, o el log). Señala los Seq Scan sobre tablas grandes y los índices que faltan. En tablas legadas `managed=False` solo se propone, no se crea nada.
4. Revisa en concreto estas causas posibles y confírmalas o descártalas con datos:
   - Hasher de contraseñas e iteraciones (login lento).
   - Resolución de permisos o `permisos_version` en cada request (cuántas consultas cuesta).
   - Middleware nuevo: `trace_id`, logs JSON, auditoría con **hash encadenado** (E1). ¿Bloquea o serializa las escrituras? ¿Cuánto añade por request?
   - Throttling y caché: ¿qué backend de caché se usa? Si es la BD o memoria local, ¿qué cuesta?
   - `proxy.ts` y layouts de Next que llaman al backend en cada navegación (llamadas repetidas o en cascada, falta de caché o de `Promise.all`).
   - Server Components o server actions que piden datos de más.
   - Docker en Windows con la carpeta en OneDrive, modo dev contra build, DEBUG activo, sesiones en la BD, tareas de Celery que en realidad corren de forma síncrona.
   - Tamaño de los bundles de `next build` y peso de las páginas.
5. Entrega una tabla de causas ordenada por impacto medido (ms o consultas que ahorraría cada corrección).

## 6. Fase E: concurrencia y carga

Escribe los scripts en `auditoria_2026-11-01/carga/` (locust o k6) contra localhost:

1. Escalones de 1, 10, 25 y 50 usuarios simultáneos con una mezcla realista: login, consultar trabajadores con filtros, ver el detalle, abrir reportes, la bandeja de fe de vida. Mide p50, p95, p99, errores (%), RPS, y CPU y memoria de cada contenedor (`docker stats`). Señala dónde se degrada.
2. Pool de conexiones a Postgres: ¿se agota? (`max_connections`, `CONN_MAX_AGE`, workers y hilos de gunicorn/uvicorn).
3. Carreras de concurrencia (con requests simultáneos de verdad, no en serie):
   - Doble envío de la misma fe de vida o de la misma solicitud (idempotencia).
   - Dos checks simultáneos de Analista y Administradora sobre la misma acta.
   - Dos altas simultáneas con la misma cédula o el mismo correo.
   - Escrituras simultáneas en la bitácora: ¿se rompe o se bifurca la cadena de hash?
   - Mismo usuario con sesiones en paralelo, y logout o revocación mientras otra pestaña trabaja.
4. Los throttles no deben bloquear a usuarios legítimos en un uso normal concurrente (por ejemplo, varios usuarios detrás de la misma IP).

## 7. Formato del reporte (`REPORTE_AUDITORIA_INTEGRAL_2026-11-01.md`)

Va en este orden y **en español**:

1. **Resumen ejecutivo** de 10 líneas como máximo: estado general, las 3 causas principales de la lentitud con su medición, y cuántos hallazgos hay por severidad.
2. **Tabla de hallazgos** (lo primero que lee Claude, así que tiene que bastar por sí sola):
   `| ID | Severidad (Crítica/Alta/Media/Baja) | Área | Archivo:línea | Qué falla | Evidencia (1 línea) | Corrección propuesta (1 línea) | Esfuerzo (S/M/L) |`
3. Resultados de las pruebas automáticas (tabla con conteos).
4. Matriz de roles: esperado frente a observado.
5. Resultados de cada flujo (fase C).
6. Rendimiento: tiempos, N+1, EXPLAIN y causas por impacto.
7. Carga y concurrencia: tabla por escalón y resultado de cada carrera.
8. Pruebas BLOQUEADAS y su motivo.
9. Datos creados en la BD y SQL para deshacerlos.
10. Lista de archivos que creaste. Confirma que no modificaste ninguno de los que ya existían (`git status` final frente al inicial).

No inventes resultados: si no se midió o no se corrió, dilo. Cada hallazgo tiene que poder reproducirse con lo que pongas en el reporte.
