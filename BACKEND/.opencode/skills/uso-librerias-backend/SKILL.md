---
name: uso-librerias-backend
description: Cómo se configuran y usan en GATH las librerías no triviales del backend — Celery 5.6.3 con broker RabbitMQ y resultados en Redis db 1, caché y throttling con Redis (fallback a DatabaseCache en PostgreSQL con fallo cerrado), drf-spectacular, django-filter, Argon2 y corsheaders. La autenticación JWT/simplejwt tiene su propia skill.
---

# Uso de librerías (Backend)

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado en `BACKEND/requirements.txt`: Django **5.2.8**, DRF **3.16.1**, `simplejwt` **5.5.1**, `drf-spectacular` **0.28.0**, `django-filter` **25.1**, `django-cors-headers` **4.9.0**, `celery` **5.6.3** (serie con soporte oficial de Python 3.14), `redis` **5.2.1**, imagen base `python:3.14.10` y PostgreSQL **externo en servidor dedicado** (**D-03**, no está en `compose.yml`).
Decisiones que gobiernan esta skill: **D-02** (Celery 5.6.3 con broker **RabbitMQ** `amqp://` vhost `gath` y resultados en Redis db 1 vía `CELERY_RESULT_BACKEND`), **D-11** (Caché y contadores de throttling en **Redis** vía `REDIS_URL`, con fallback a `DatabaseCache` sobre PostgreSQL con `MAX_ENTRIES=100000`, siempre con **fallo cerrado**), **D-04** (auditoría dual DB + TXT), **D-12** (`pytest` + `pytest-django`), **D-06** (`/api/v1/`).

> **Redis en infraestructura (`compose.yml`):** Se declara el servicio `redis:7.4-alpine` en red interna (sin puertos al host y sin persistencia) para caché y throttling (`REDIS_URL`, db 0) y resultados de tareas de Celery (`CELERY_RESULT_BACKEND`, db 1). El broker de mensajería sigue siendo exclusivamente RabbitMQ (vhost `gath`).

---

Skill de referencia rápida para saber cómo se configura e integra cada librería de `BACKEND/requirements.txt` con comportamiento no trivial. Para JWT/simplejwt ver [[autenticacion-permisos-jwt]]. Para el router de la BD externa RECAUDACION ver [[integracion-bd-recaudacion]] (es arquitectura de datos, no una "librería" per se). Para dónde vive cada archivo, ver [[arquitectura-onion-feature-scream]].

> **Paquete de configuración:** El paquete de configuración del backend se llama **`GATH/`** (`GATH/settings.py`, `GATH/celery.py`, `GATH/urls.py`, `GATH/wsgi.py`).

---

## Celery

### Configuración (`GATH/celery.py` y `GATH/settings.py`) — D-02

Celery 5.6.3 opera con broker RabbitMQ (vhost `gath`) y persistencia efímera de resultados en Redis (db 1):

```python
# BACKEND/GATH/settings.py
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='') or None
CELERY_RESULT_EXPIRES = 3600
CELERY_TASK_DEFAULT_QUEUE = 'gath'
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_TIME_LIMIT = 300
CELERY_TASK_SOFT_TIME_LIMIT = 270
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TIMEZONE = TIME_ZONE
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BROKER_TRANSPORT_OPTIONS = {'confirm_publish': True, 'socket_timeout': 5}
CELERY_BROKER_CONNECTION_TIMEOUT = 5
CELERY_TASK_PUBLISH_RETRY_POLICY = {'max_retries': 1, 'interval_start': 0, 'interval_step': 0.2, 'interval_max': 0.5}
CELERY_BROKER_CONNECTION_MAX_RETRIES = 1
```

- **Broker: RabbitMQ** con vhost `gath` (`amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@rabbitmq:5672/gath`), credenciales por entorno sin defaults, sin publicar puertos al host en `compose.yml`.
- **Resultados: Redis db 1** (`redis://:${REDIS_PASS}@redis:6379/1`), sin tablas nuevas ni migraciones en PostgreSQL; almacena estados con expiración corta (3600 s).
- **Servicios `celery_worker` y `celery_beat`:** Ambos corren sobre la misma imagen del backend (`gath-backend:latest` construida desde `BACKEND/django.dockerfile`) y comparten variables de entorno `x-backend-env`.
  - Worker: `celery -A GATH worker -Q gath -l info --concurrency=2`
  - Beat: `celery -A GATH beat -l info -s /tmp/celerybeat-schedule --pidfile=/tmp/celerybeat.pid`
- **Migraciones y arranque (`docker-entrypoint.sh`):**
  - `docker-entrypoint.sh` espera a PostgreSQL (`wait-for-postgres.py`) y corre `manage.py migrate --noinput` salvo si `SKIP_MIGRATE=1`.
  - `celery_worker` y `celery_beat` configuran `SKIP_MIGRATE: "1"` para no ejecutar migraciones al arrancar.
  - *Advertencia de concurrencia:* Si se escalan varias réplicas del contenedor `django`, correr `migrate` en el entrypoint genera race conditions y debe extraerse a un paso deliberado de despliegue.
- **Tareas periódicas (beat):** `CELERY_BEAT_SCHEDULE` estático en `settings.py` (expiración de ventanas de autogestión, avisos de expiración y reprocesamiento de outbox de correo).

### Firma canónica de una tarea

Las tareas viven en `apps/[modulo]/infrastructure/tasks/[accion]_tasks.py` — un archivo por acción, nunca un `tasks.py` único por app (techo de 400 líneas, **B13**):

```python
# apps/reportes/infrastructure/tasks/generar_reporte_tasks.py
@shared_task(bind=True, acks_late=True,
             autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def generar_reporte_pdf(self, reporte_id: str, trace_id: str):
    try:
        reporte = ReporteModel.objects.get(pk=reporte_id)
    except ReporteModel.DoesNotExist:
        logger.warning('Reporte %s ya no existe, se omite la generación [trace=%s]',
                       reporte_id, trace_id)
        return
    ...
```

Reglas vinculantes de la tarea:

- **Recibe solo IDs primitivos**, nunca instancias de modelo (**B23**) — deben ser serializables a JSON.
- **`acks_late=True`** y reintentos con backoff (**B23**, D-02): si el worker cae, el mensaje se reencola en vez de perderse.
- **Tolera `DoesNotExist`** con `logger.warning` en vez de fallar: la fila pudo borrarse entre el despacho y la ejecución.
- **Lleva el `trace_id` en el payload** (**C-5**, D-04): la tarea escribe en `auditoria_log` y en `logs/backend/audit_backend.txt` con el mismo `X-Trace-Id` que originó la petición.
- **Idempotencia**: con `acks_late` una tarea puede ejecutarse dos veces. Si escribe, hazla idempotente por clave.

### Cómo se disparan — nunca `.delay()` desde una vista ni desde un caso de uso

**Un caso de uso no importa Celery** (**B20**): encola por el puerto `TaskQueue` declarado en `core/domain/ports.py`, o emite un evento de dominio que un receiver traduce:

```
application/use_cases/xxx.py
  → events.evento_x.send(...)                       Signal (domain/events.py)
    ↓
infrastructure/receivers.py
  → transaction.on_commit(lambda: tasks.algo.delay(id, trace_id))   # B22
```

`transaction.on_commit()` es **obligatorio** (**B22**) para que el worker nunca vea datos sin confirmar. Ver el detalle del patrón en [[arquitectura-onion-feature-scream]] (sección "Patrón domain → infrastructure: eventos + signals + Celery").

### El contrato HTTP de una tarea (C-4)

Toda operación que pueda pasar de **3 s** (cargas masivas de Excel, PDFs, reportes) responde **`202 Accepted`** con el sobre único (**C-1**, `core/presentation/envelope.py`, **B9**):

```json
{"data": {"tarea_id": "<UUID>"}}
```

y el frontend sondea `GET /api/v1/tareas/{id}/`, cuyo estado es uno de `pendiente | en_proceso | completada | fallida` (respaldado por Celery result backend). No hagas que una vista espere el resultado de la tarea.

---

## Caché y throttling — Redis con fallback a `DatabaseCache` (D-11)

Configuración oficial en `BACKEND/GATH/settings.py` (revisado 2026-10-28):

```python
# BACKEND/GATH/settings.py
_REDIS_URL = config('REDIS_URL', default='')
if _REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': _REDIS_URL,
            'KEY_PREFIX': 'gath',
            # Si Redis cae, la petición falla en 2 s en vez de quedar colgada.
            'OPTIONS': {'socket_connect_timeout': 2, 'socket_timeout': 2},
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
            'LOCATION': 'django_cache_table',
            # El default de Django (300) se supera con ~100 usuarios activos:
            # al purgar se borran contadores de throttling y el límite se pierde.
            'OPTIONS': {'MAX_ENTRIES': 100_000},
        }
    }
```

```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '300/minute',
        'login': config('LOGIN_THROTTLE_RATE', default='30/minute'),
        'password_reset': config('PASSWORD_RESET_THROTTLE_RATE', default='10/minute'),
    },
}
```

**Fallo cerrado, no abierto:**  
Ambos backends fallan cerrado: si la caché no responde, el throttling responde 500 en lugar de dejar el login sin límite. Un contador de seguridad que no puede verificar la tasa debe **denegar**: un endpoint de autenticación sin límite es una vulnerabilidad grave.

- **Redis en despliegue:** `compose.yml` declara el servicio `redis:7.4-alpine` y pasa `REDIS_URL: redis://:${REDIS_PASS}@redis:6379/0` a los contenedores.
- **Fallback en desarrollo:** Si `REDIS_URL` no está definida (ej. ejecución de Django fuera de Docker), se usa `DatabaseCache` con tabla `django_cache_table` creada mediante `python manage.py createcachetable`. `MAX_ENTRIES=100000` evita que Django purgue contadores tempranamente al superar 300 entradas.
- **Caché de negocio:** Cero `cache.get`/`cache.set`/`@cache_page` en el backend sin previo diseño formal.
- En los tests, la caché de throttling se **aísla** (`override_settings(CACHES=...)` con `LocMemCache`) para no consumir cupos reales ni dejar residuos entre ejecuciones ([[testing-backend-django]]).

---

## drf-spectacular

`drf_spectacular` está configurado en `INSTALLED_APPS` y `REST_FRAMEWORK['DEFAULT_SCHEMA_CLASS'] = 'drf_spectacular.openapi.AutoSchema'`.

```python
SPECTACULAR_SETTINGS = {
    'TITLE': 'GATH API - Gestión y Administración de Talento Humano',
    'DESCRIPTION': 'API RESTful del Sistema GATH (CONATEL)',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'ENUM_NAME_OVERRIDES': {},
}
```

**Regla al añadir un `TextChoices` que se reutilice en más de un modelo/serializer** (**B25**): agrégalo a `ENUM_NAME_OVERRIDES` con un nombre explícito, o drf-spectacular generará nombres colisionantes o genéricos (`Enum1`, `Enum2`) en el esquema OpenAPI. La validación del esquema OpenAPI 3.0 corre en CI (**B6.9**).

---

## django-filter

Configuración en `REST_FRAMEWORK`:

```python
REST_FRAMEWORK = {
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}
```

Los `FilterSet` de GATH viven en `apps/[modulo]/presentation/filters/[entidad]_filters.py`, uno por entidad. Ver detalle y alternativas en [[patrones-drf-implementacion]]. Recuerda **D-10**: los `ViewSet` (con `DefaultRouter`) se usan **sólo** para los catálogos de solo lectura; las acciones de negocio son `APIView`/`generics` explícitas.

---

## argon2 / password hashers

Configuración en `GATH/settings.py` con `argon2-cffi` en `requirements.txt`:

```python
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',        # activo: hashea las nuevas
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',        # fallback de lectura de los hashes existentes
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    'django.contrib.auth.hashers.ScryptPasswordHasher',
]
```

Argon2 es el hasher activo (primero de la lista); los demás sólo permiten **leer y re-hashear** contraseñas antiguas. Las cuentas existentes migradas están hasheadas con PBKDF2, por lo que **PBKDF2 no puede salir de la lista**.

---

## corsheaders

Configuración en `GATH/settings.py`:

```python
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', cast=Csv(), default='')
if DEBUG and not CORS_ALLOWED_ORIGINS:
    CORS_ALLOW_ALL_ORIGINS = True   # sólo en desarrollo y sólo si la lista está vacía
CORS_ALLOW_CREDENTIALS = True       # necesario porque el access token viaja en cookie HttpOnly
```

En producción `CORS_ALLOWED_ORIGINS` viene **siempre** por variable de entorno: sin IPs en el código. `CORS_ALLOW_CREDENTIALS = True` es obligatorio para que el navegador comparta las cookies HttpOnly (`dj_access`, `dj_refresh`) en las peticiones cross-origin ([[autenticacion-permisos-jwt]]).

---

### ⚠️ Reglas anuladas y aclaraciones de arquitectura

1. **Redis como caché y backend de resultados (D-11, D-02):**  
   Redis (`redis:7.4-alpine`) está presente en `compose.yml` en red interna (servicio `redis`, sin exponer puertos al host y sin persistencia) para caché/throttling (`REDIS_URL`, db 0) y resultados efímeros de Celery (`CELERY_RESULT_BACKEND`, db 1). El broker de mensajería se mantiene exclusivamente en RabbitMQ (`amqp://`, vhost `gath`). El principio de **fallo cerrado** (S1/S2) se mantiene inalterado: si la caché no responde, el throttling deniega la petición (500), jamás dejando los endpoints desprotegidos.

2. **Prohibición estricta de `.delay()` desde vistas o casos de uso:**  
   **B20** prohíbe que el caso de uso importe Celery (se encola por el puerto `TaskQueue`) y **B22** obliga a que todo despacho originado por un cambio de estado vaya dentro de `transaction.on_commit()`. Una vista no despacha tareas directamente: invoca un caso de uso.

---

## Comandos

### 1. Añadir una tarea de Celery nueva

```
@skill crea la task de celery [nombre]
```

1. Colócala en `apps/[modulo]/infrastructure/tasks/[accion]_tasks.py`, en el módulo de dominio dueño de la acción (si es transversal, en `core/`: un módulo nunca importa de un módulo hermano, **B16**).
2. Decora con `@shared_task(bind=True, acks_late=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)` (**B23**).
3. Recibe **IDs primitivos** y el `trace_id`; nunca instancias de modelo.
4. Captura `DoesNotExist` con `logger.warning`; no dejes que la tarea falle por una fila borrada.
5. Declara/usa el puerto `TaskQueue` si el disparo nace de un caso de uso (**B20**), o emite un evento de dominio y despacha desde `infrastructure/receivers.py` dentro de `transaction.on_commit()` (**B22**). **Nunca** `.delay()` desde una vista.
6. Si la operación puede exceder 3 s, la vista responde `202 Accepted` con `{"data": {"tarea_id": "..."}}` por el sobre único (**C-4**, **C-1**).
7. Rutea la tarea a su cola con `task_routes` y escribe su test con `pytest` (**D-12**).

### 2. Añadir un enum/TextChoices que se reutiliza

```
@skill agrega el choices [nombre] a varios modelos
```

Registra la entrada correspondiente en `ENUM_NAME_OVERRIDES` de `SPECTACULAR_SETTINGS` (**B25**) para que el esquema OpenAPI no genere nombres genéricos ni colisione — el CI valida el esquema (**B6.9**).

### 3. Declarar un throttle nuevo

```
@skill agrega throttling a [endpoint]
```

1. Verifica que `CACHES` esté configurado (Redis mediante `REDIS_URL` o tabla `django_cache_table` creada con `createcachetable` para `DatabaseCache`) (**D-11**).
2. Usa `ScopedRateThrottle` con un `throttle_scope` propio y **un comentario que justifique el número** en `DEFAULT_THROTTLE_RATES`.
3. Mantén el principio de **fallo cerrado**.
4. Aísla la caché en los tests para no consumir cupos reales ([[testing-backend-django]]).

---

## Pendientes (requieren decisión, no los resuelvas por tu cuenta)

| Tema | Discrepancia entre fuentes | Qué falta decidir |
|---|---|---|
| Versión de `celery` | Resuelto: fijada serie **5.6.3** en `requirements.txt` por compatibilidad con Python 3.14. | Mantener actualizada según soporte LTS |
| Nombres de las colas | Plan §III.3 / B5.14: `default`, `reportes`, `cargas`, `archivos` · `compose.yml` actual: `gath` | Nomenclatura definitiva de colas adicionales |
| Variables de entorno del broker | Parámetros definidos en `compose.yml` (`CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `REDIS_URL`) | Completar documentación en `.env.example` raíz |
