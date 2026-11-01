# Plan de correcciones tras la auditoría integral (2026-11-01)

Origen: `REPORTE_AUDITORIA_INTEGRAL_2026-11-01.md`. Se envía **un mensaje por vez**. Hasta que Claude revise el resumen y haga el commit, no se manda el siguiente.

| Orden | Mensaje | Hallazgos | Tipo |
|---|---|---|---|
| 1 | Rendimiento del backend | A-01, A-02, A-04 (+ nueva medición de A-03) | Corrección |
| 2 | Primer ingreso y cambio obligatorio de contraseña | Nuevo (P-01) | Verificación + corrección |
| 3 | Bugs puntuales | A-07, A-12 | Corrección |
| 4 | Endurecimiento y contrato | A-05, A-06, A-09 | Corrección |
| 5 | Auditoría de lo que quedó bloqueado | A-08, A-10 y lo pendiente de §7/§8 | Solo auditoría |

A-11, A-13 y A-14 no necesitan corrección.

---

## Estado de ejecución (actualizado 2026-11-01 19:05)

Leyenda: ✅ completado · 🟡 en proceso · ⬜ pendiente · 🚫 bloqueado.

| Mensaje | Ítem | Estado | Evidencia / qué falta |
|---|---|---|---|
| 1 | Respaldo previo (`respaldo_antes_mensaje2.patch`) | ✅ | 1.4 MB en el Escritorio |
| 1 | **A-01** listado de personal liviano | ✅ | `EmpleadoListadoSerializer`, `.only()` y 3 tests (payload <30 KB, consultas constantes 10/50, detalle intacto) |
| 1 | **A-02** `/auth/me` con caché por `permisos_version` | ✅ | 4 consultas en frío y 1-2 en caliente; tests de rol, overrides y cuenta desactivada |
| 1 | **A-04** gunicorn + `CONN_MAX_AGE=60` | ✅ | gunicorn `gthread` (9 workers, 2 hilos, timeout 60), `CONN_MAX_AGE=60` + health checks; estáticos/admin sin ruta (404 antes y después), PDF y SeaweedFS verificados |
| 1 | Medición A-03 (1/10/25/50 usuarios + `docker stats`) | ✅ | p50 380/1 306/1 702/3 966 ms (antes 380/1 712/4 198/9 511); p99 50 usuarios 14 981 ms (antes 19 031); CPU pico 536.75 % |
| 1 | Checks finales | ✅ | vitest 583, pytest identidad/personal/core, `lint-imports` 82/0, migraciones sin cambios, `tsc` 0, `eslint` 0 errores, `next build` OK |
| 1 | Sección «Mensaje 1» en `REPORTE_CORRECCIONES_2026-11-01.md` | ✅ | Reporte creado con resumen, tabla antes→después y archivos |
| 2 | **P-01** primer ingreso y cambio obligatorio de contraseña | ⬜ | No iniciado |
| 3 | **A-07** contrato de `familiaresApi.getPorEmpleado` | ⬜ | Diagnosticado en la auditoría; sin corregir |
| 3 | **A-12** `solo_activos` en nóminas de activos | ✅ | Backend, catálogo y consumidores; test `test_listar_tipos_nomina_solo_activos` |
| 4 | **A-05** flags de seguridad por entorno | ⬜ | No iniciado |
| 4 | **A-06** 0 avisos `drf_spectacular.W002` | ⬜ | No iniciado |
| 4 | **A-09** proyectos Firefox y WebKit | ⬜ | No iniciado |
| 5 | Auditoría de lo bloqueado | ⬜ | No iniciado |

---

## Reglas comunes (van al inicio de CADA mensaje)

```
REGLAS (obligatorias):
- Alcance estricto: corrige SOLO lo que pide este mensaje. No toques nada fuera de él.
- NO cambies el diseño, los estilos, los textos visibles, las columnas, el orden de los menús ni la estructura de las pantallas, salvo que el mensaje lo pida de forma explícita.
- No cambies contratos que use el frontend sin actualizar también el consumidor, y verifica que la pantalla se vea igual que antes.
- No edites archivos con PowerShell (rompe el UTF-8); usa tu herramienta de edición.
- Sin commit ni push. Antes de empezar: git diff > respaldo_antes_mensajeN.patch
- Toda corrección lleva su test (pytest/vitest). Al final corre: pytest de los módulos tocados, lint-imports, makemigrations --check, vitest, tsc --noEmit, eslint y next build. Reconstruye las imágenes de Docker antes de cualquier prueba en vivo (el código va horneado en la imagen).
- Al terminar, agrega al final de REPORTE_CORRECCIONES_2026-11-01.md la sección «Mensaje N» con: un resumen de 5 líneas como máximo; una tabla | ID | Estado (Corregido/Parcial/No aplica) | Archivos | Test | Medición antes→después |; y la lista de archivos modificados.
- Si algo no se puede hacer sin salirte del alcance, NO lo hagas: anótalo como «Requiere decisión».
```

---

## Mensaje 1: Rendimiento del backend (A-01, A-02, A-04)

```
[pega aquí las REGLAS]

Objetivo: bajar los tiempos de /personal y /me, y dar concurrencia real a Django. La interfaz tiene que verse y comportarse EXACTAMENTE igual.

A-01. GET /api/v1/personal/ (listado) devuelve el expediente anidado completo (~67 KB por fila).
  1. Revisa qué campos usa de verdad el frontend del listado de activos (columnas, filtros, acciones de fila, exportaciones que reutilicen este endpoint) y cualquier otro consumidor del endpoint (grep en NextJS/src).
  2. Crea un serializer de listado liviano con SOLO esos campos, más select_related/only para que el número de consultas no crezca con las filas. El detalle GET /personal/<cedula>/ se queda igual.
  3. Si algún consumidor necesita el expediente desde el listado, NO lo rompas: anótalo como «Requiere decisión».
  4. Test: el número de consultas es constante con N=10 y N=50 (CaptureQueriesContext) y el payload de 10 filas pesa menos de 30 KB.

A-02. GET /identidad/auth/me/ hace 14 consultas (p50 735 ms).
  1. Reduce las consultas con select_related/prefetch_related en la resolución de rol, permisos y overrides.
  2. Cachea los permisos resueltos por cuenta en la caché configurada (Redis), con una clave que incluya permisos_version para que un cambio de permisos los invalide en el acto. No cambies la forma de la respuesta.
  3. Test: como máximo 4 consultas con la caché fría y 1-2 con la caché caliente; si cambia un permiso o el rol, la siguiente /me lo refleja; una cuenta desactivada o revocada sigue recibiendo 401/403.

A-04. Django con runserver y CONN_MAX_AGE=0.
  1. CONN_MAX_AGE=60 y CONN_HEALTH_CHECKS=True, leídos por variable de entorno con esos valores por defecto.
  2. En el contenedor de Django, reemplaza runserver por gunicorn (workers e hilos por variable de entorno; por defecto 2*CPU+1 workers y 2 hilos, timeout 60). Cambia solo el comando del servicio django en compose/Dockerfile; no toques los demás servicios. Si gunicorn no está en los requirements, agrégalo con la versión fija.
  3. Comprueba que los estáticos, el admin, las subidas a SeaweedFS y la descarga de PDF siguen funcionando.

Medición (A-03): repite auditoria_2026-11-01/medir_api.py, medir_queries.py y carga_api.py (1/10/25/50 usuarios, ahora con docker stats) y pon una tabla antes→después en el reporte.
```

---

## Mensaje 2: Primer ingreso y cambio obligatorio de contraseña (P-01)

Contexto revisado por Claude: el usuario es la **cédula** (`USERNAME_FIELD='cedula'`). La cuenta nace con **contraseña = cédula** (`aprovisionar_cuenta_trabajador`) y `cambiar_password` rechaza una contraseña nueva igual a la actual. El diálogo obligatorio, que no se puede cerrar, **solo está montado en `/dashboard/page.tsx`**. Los trabajadores y los pasivos que entran a `/autogestion`, o cualquier usuario que vaya directo a otra ruta, probablemente nunca lo ven, y el backend no les bloquea nada.

```
[pega aquí las REGLAS]

Objetivo: que el primer ingreso de CUALQUIER usuario (activo, pasivo, Bienestar, admin, cualquier rol) sea con usuario = cédula y contraseña = cédula, y que nada más entrar quede obligado a cambiarla por una distinta antes de poder usar el sistema.

1. VERIFICA primero y anota en el reporte lo que encuentres:
   a. Que todos los caminos de creación de cuentas (aprovisionar_cuenta_trabajador, registrar_usuario, el alta de pasivo, el alta directa, restablecer_acceso) dejan la contraseña = cédula y el indicador de cambio pendiente activo.
   b. Que login con cédula + cédula funciona y que /me devuelve debe_cambiar_password=true.
   c. En qué rutas aparece el diálogo obligatorio. Hoy solo está en /dashboard: comprueba con Playwright qué pasa al entrar con una cuenta nueva AUTOGESTION (trabajador y pasivo) y con una ruta directa (/autogestion, /pasivos, /personal).
   d. Que cambiar_password rechaza: la nueva igual a la actual, la nueva igual a la cédula, y la que no cumple la política de contraseñas vigente.
   e. Que la API bloquea mientras haya cambio pendiente: ¿puede un usuario con cambio pendiente llamar a otros endpoints?

2. CORRIGE solo lo que falle de esto:
   - Backend: mientras debe_cambiar_password sea true, todo endpoint autenticado responde 403 con un código claro (p. ej. «PASSWORD_CAMBIO_REQUERIDO»), salvo /me, cambiar-password y logout. Hazlo con un permiso o un middleware de DRF, no endpoint por endpoint.
   - Rechazo explícito de la nueva contraseña cuando sea igual a la cédula o a la actual, con un mensaje en español.
   - Frontend: el diálogo obligatorio que ya existe (cambiar-password-dialog.tsx, modo obligatorio) tiene que montarse en el layout común de (app), de modo que salga en CUALQUIER ruta y para cualquier rol, en lugar de solo en /dashboard. Reutiliza ese componente sin cambiar su diseño. Quítalo de dashboard/page.tsx para que no se monte dos veces.
   - Al cambiar la contraseña con éxito: el indicador se apaga, la sesión sigue activa (o se pide un nuevo login, según lo que haga hoy; no cambies esa decisión) y el usuario sigue donde estaba.
   - No cambies la política de contraseñas.

3. Tests: pytest del bloqueo 403 y de los rechazos; vitest del montaje en el layout; E2E Playwright con una cuenta nueva de prueba (cédula 99000001, prefijo AUDITORIA; anota en el reporte cómo deshacerla) que entra por /autogestion y por /dashboard y queda obligada a cambiar la contraseña. No uses las cuentas E2E existentes ni cuentas reales.
```

---

## Mensaje 3: Bugs puntuales (A-07, A-12)

```
[pega aquí las REGLAS]

A-07. familiaresApi.getPorEmpleado (NextJS/src/.../familiares-api.ts:106) tipa FamiliarApiItem[] pero el backend devuelve el sobre {status,message,data}; repo-familiares-api.ts:37 hace raw.map sobre un objeto. Tipa ApiResponse<FamiliarApiItem[]> y usa raw.data, como hace personal-api.ts. Revisa (solo revisa) si otras funciones de familiares-api.ts tienen el mismo defecto y corrige solo las que lo tengan. Agrega un test vitest con el sobre real.

A-12. El catálogo de tipos de nómina de activos muestra nóminas de pasivos. Agrega al endpoint el filtro solo_activos=true (es_activo=True), simétrico a solo_pasivos, sin cambiar el comportamiento por defecto. Úsalo SOLO en las pantallas de activos que listan nóminas para elegir o filtrar (alta, cargos, filtros, censo). Antes, lista en el reporte cuáles vas a tocar. Tests pytest del filtro y vitest de los consumidores.
```

---

## Mensaje 4: Endurecimiento y contrato (A-05, A-06, A-09)

```
[pega aquí las REGLAS]

A-05. SESSION_COOKIE_SECURE, CSRF_COOKIE_SECURE, SECURE_SSL_REDIRECT, SECURE_HSTS_SECONDS (+ INCLUDE_SUBDOMAINS), SECURE_PROXY_SSL_HEADER: léelos por variable de entorno. Por defecto quedan seguros si DEBUG=False y sin cambios en el entorno local actual (para no romper el desarrollo por http://localhost). Documenta las variables en el .env.example. Test: con DEBUG=False y sin variables, check --deploy no muestra W004/W008/W012/W016.

A-06. 173 avisos drf_spectacular.W002: agrega @extend_schema o serializer_class a las APIView afectadas. SOLO documentación del esquema: no cambies la lógica, las respuestas ni las rutas. Meta: 0 W002. Test: el esquema se genera sin avisos (spectacular --validate --fail-on-warn).

A-09. playwright.config.ts: agrega los proyectos firefox y webkit con la misma configuración que chromium. No cambies las specs. Corre la suite de lectura en los 3 y reporta los resultados (si alguna falla solo en un navegador, repórtala; no la arregles).
```

---

## Mensaje 5: Auditoría de lo bloqueado (solo auditoría, NO corregir)

Requisito previo: el usuario rellena `E2E_ADMIN_PASSWORD` en `NextJS/.env.test.local`.

```
Lee de nuevo y aplica las reglas de MENSAJE_OPENCODE_AUDITORIA_INTEGRAL.md (solo auditoría, no corregir nada, respaldo de la BD, cédulas 99000xxx con prefijo AUDITORIA, no borrar datos y dejar el SQL para deshacerlos).

Ejecuta SOLO lo que quedó sin hacer en REPORTE_AUDITORIA_INTEGRAL_2026-11-01.md:
1. Fase C completa de escritura con Playwright en chromium, firefox y webkit: alta de activo, alta de pasivo, egreso, movimientos, fe de vida completa (doble check en los dos órdenes, aprobación directa, rechazo y repetición, archivo inválido, VALIDADA y aplicación de cambios, constancia, outbox), autogestión, administración y reportes con CADA filtro, comparando los conteos contra SQL.
2. Matriz de roles completa: crea una cuenta de prueba por cada uno de los 10 roles (cédulas 99000100+, prefijo AUDITORIA) y verifica menús, rutas y API por rol frente a matriz_roles.txt.
3. Carreras de concurrencia con peticiones simultáneas reales (doble envío de fe de vida, dos checks simultáneos, dos altas con la misma cédula o el mismo correo, bitácora con escrituras concurrentes y cadena de hash, sesiones paralelas y revocación) y throttles con varios usuarios desde la misma IP.
4. pg_stat_statements + EXPLAIN ANALYZE de las 10 consultas más lentas, y docker stats durante la carga.

Entregable: REPORTE_AUDITORIA_FASE2_2026-11-01.md con el mismo formato (resumen de 10 líneas + tabla de hallazgos primero).
```
