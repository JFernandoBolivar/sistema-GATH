# Auditoría: IP y dispositivo vacíos en la bitácora (12/11/2026)

**Rama:** `feature/fe-de-vida-pasivos` · **Sin commit.**
**pytest no ejecutado** (lo corre el coordinador). No se tocaron filas viejas.

---

## 1. Contexto de petición (backend)

| Archivo | Cambio |
| ------- | ------ |
| `core/infrastructure/auditoria_contexto.py` (**nuevo**) | `ContextVar` con el origen de la petición/tarea: `fijar_origen`, `limpiar_origen`, `obtener_origen`, `origen_para_tarea` y el decorador `con_origen_de_tarea`. Sin Django. |
| `core/presentation/auditoria_middleware.py` (**nuevo**) | `OrigenAuditoriaMiddleware`: al entrar guarda `origen_de_peticion(request)` y en `finally` limpia el contexto (aunque la vista falle). |
| `GATH/settings.py` | Registra el middleware justo después de `TraceIDMiddleware`. |
| `core/presentation/audit.py` | `registrar_auditoria` completa `ip_origen`, `user_agent` y `dispositivo` desde el contexto **solo si vienen vacíos**; los valores explícitos del llamador nunca se sobrescriben. |

Con esto, una vista o un caso de uso que audite sin `origen_de_peticion(request)`
(o sin `**origen_de_peticion(request)`) guarda la IP y el dispositivo reales. El
dominio no importa Django: el `ContextVar` vive en `core/infrastructure` y lo
consume la capa de presentación.

## 2. Celery

| Archivo | Cambio |
| ------- | ------ |
| `core/infrastructure/auditoria_contexto.py` | `con_origen_de_tarea`: acepta el kwarg `origen`, lo fija durante la tarea y limpia al terminar. |
| `apps/exportaciones/infrastructure/tasks/exportaciones_tasks.py` | `generar_exportacion` decorada; así `exportacion_lista` del worker conserva IP/UA/dispositivo. |
| `apps/configuracion/infrastructure/tasks/correo_acceso_tasks.py` | `aplicar_correo_acceso_lote` decorada (el lote asíncrono auditaba sin origen). |
| `apps/identidad/infrastructure/tasks/restablecer_acceso_bloque_tasks.py` | `restablecer_acceso_en_bloque_tarea` (alcance TODOS) decorada. |
| `apps/exportaciones/application/use_cases/gestionar_exportaciones.py` | `solicitar_exportacion` acepta `origen` y lo pasa a `cola.encolar(...)` solo si viene informado (no cambia el contrato de las pruebas existentes). |
| `apps/exportaciones/presentation/solicitud.py` | Al pedir la exportación encola con `origen=origen_para_tarea()`. |
| `apps/configuracion/presentation/views/correo_acceso_config_views.py` | El lote asíncrono se encola con `origen=origen_para_tarea()`. |
| `apps/identidad/presentation/views/restablecer_acceso_bloque_views.py` | La ejecución `TODOS` se encola con `origen=origen_para_tarea()`. |

Las tareas que ya recibían el origen por `metadata` (recuperación de contraseña)
se dejaron igual: ya pasaban IP/UA/dispositivo al auditor.

## 3. Frontend: reenviar el User-Agent

| Archivo | Cambio |
| ------- | ------ |
| `src/shared/infrastructure/http/user-agent.ts` (**nuevo**) | `userAgentDelCliente()`: lee `headers().get("user-agent")`, recorta a 255 y devuelve `null` fuera de una petición (try/catch). |
| `src/shared/infrastructure/http/fetcher-api.ts` | `buildHeaders` añade `User-Agent` (si no venía uno explícito) en todas las llamadas a Django. |
| `src/lib/api-client.ts` | `getAuthHeaders` añade `User-Agent` junto a `X-Forwarded-For`. |

Fuera de una petición no se envía la cabecera (build, scripts, jobs locales).

## 4. Pruebas

- **Backend:** `tests/integration/core/test_auditoria_origen_contexto.py`
  - un registro sin metadata guarda IP, UA y dispositivo del contexto;
  - los valores explícitos no se pisan;
  - sin contexto queda vacío;
  - el middleware fija y limpia el contexto (incluida la IP y el dispositivo);
  - el decorador de tareas fija y limpia el origen, con y sin `origen`.
- **Backend:** `tests/integration/exportaciones/test_exportaciones.py`
  → `test_solicitar_pasa_el_origen_a_la_tarea` (el kwarg `origen` llega a la cola).
- **Frontend:** `src/shared/infrastructure/http/user-agent.test.ts` (valor,
  recorte a 255, fuera de petición, sin cabecera) y
  `fetcher-api.test.ts` → `reenvía el User-Agent de la petición a Django`.

## Verificaciones

| Comprobación | Resultado |
|---|---|
| `lint-imports` | **103 contratos, 0 rotos** |
| `npx tsc --noEmit` | sin errores |
| `npx eslint src --quiet` | sin errores |
| `npx vitest run src/shared/infrastructure/http` | **3 archivos, 19 pruebas passed** |
| `python manage.py check` | **0 issues** |
| `python -m compileall apps core tests` | OK |
| `ruff F401/F841/F821/F811` sobre los archivos tocados | All checks passed |
| pytest | **no ejecutado** (lo corre el coordinador) |

## Notas

- No se modificaron filas históricas de `auditoria_log`.
- El middleware limpia el contexto en `finally`: una petición no filtra su
  origen a la siguiente ni al worker.
- Los valores que el llamador pase explícitamente siguen teniendo prioridad.
