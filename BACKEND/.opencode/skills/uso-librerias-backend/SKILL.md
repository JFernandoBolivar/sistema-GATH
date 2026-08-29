---
name: uso-librerias-backend
description: Cómo se configuran y usan en GATH las librerías no triviales del backend — Celery con broker RabbitMQ, caché y throttling con DatabaseCache sobre PostgreSQL (fallo cerrado), drf-spectacular, django-filter, Argon2 y corsheaders. La autenticación JWT/simplejwt tiene su propia skill.
---

# Uso de librerías (Backend)

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado en `BACKEND/requirements.txt`: Django **5.2.7**, DRF **3.16.1**, `simplejwt` **5.5.1**, `drf-spectacular` **0.28.0**, `django-filter` **25.1**, `django-cors-headers` **4.9.0**, `celery` **5.3.4** (instalado, **sin app ni broker**), PostgreSQL **externo en servidor dedicado** (**D-03**, no está en `compose.yml`).
Decisiones que gobiernan esta skill: **D-02** (Celery con broker **RabbitMQ** `amqp://` y resultados en PostgreSQL vía `django-celery-results`), **D-11** (`DatabaseCache` en PostgreSQL para los contadores de throttling, con **fallo cerrado**), **D-04** (auditoría dual DB + TXT), **D-12** (`pytest` + `pytest-django`), **D-06** (`/api/v1/`).
Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de la adaptación está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.1** (fila `uso-librerias-backend`: *"El broker es RabbitMQ (no Redis) y el backend de throttling es DatabaseCache sobre PostgreSQL con fallo cerrado (D-11)"*).

> **Nada de Redis, en ninguna forma.** D-02 y D-11 evitaron deliberadamente añadir un cuarto almacén: broker RabbitMQ, resultados en PostgreSQL y caché en PostgreSQL.

---

Skill de referencia rápida para saber cómo se configura e integra cada librería de `BACKEND/requirements.txt` con comportamiento no trivial. Para JWT/simplejwt ver [[autenticacion-permisos-jwt]]. Para el router de la BD externa RECAUDACION ver [[integracion-bd-recaudacion]] (es arquitectura de datos, no una "librería" per se). Para dónde vive cada archivo, ver [[arquitectura-onion-feature-scream]].

> **Estado de partida — verifícalo antes de afirmar nada.** Hoy en `BACKEND/SIGEP/settings.py` **no existe** ningún bloque `CACHES`, ningún `DEFAULT_THROTTLE_CLASSES`/`DEFAULT_THROTTLE_RATES`, ningún `PASSWORD_HASHERS`, ningún `SPECTACULAR_SETTINGS` ni ningún `DEFAULT_FILTER_BACKENDS`; no hay `SIGEP/celery.py` y `grep -rn 'shared_task\|\.delay('` sobre `BACKEND/` da **cero** resultados. Todo lo que sigue se **construye**; no lo describas como algo que ya está y sólo hay que "activar".

---

## Celery

### Configuración objetivo (`SIGEP/celery.py`) — D-02

No existe todavía. Se crea en la fase **B1.8** del plan (fijar la serie de `celery` validada contra Django 5.2, añadir `django-celery-results` y `django-celery-beat`). El bosquejo autoritativo es `infra-fase2/celery-app.sketch.py` (**no lo modifiques**), reflejado en `FASE2_PROPUESTA_TECNICA.md` §12.6 y §12.9:

```python
# BACKEND/SIGEP/celery.py
app = Celery('gath')
app.conf.update(
    broker_url=config('CELERY_BROKER_URL'),      # amqp://... — sin default: si falta, falla al arrancar
    result_backend='django-db',                   # django-celery-results en PostgreSQL; no hace falta Redis
    task_acks_late=True,                          # ack DESPUÉS de ejecutar (B23)
    task_reject_on_worker_lost=True,              # si el worker muere, el mensaje se reencola
    worker_prefetch_multiplier=1,                 # nadie acapara mensajes
    broker_transport_options={'confirm_publish': True},
    broker_connection_retry_on_startup=True,
    task_time_limit=300, task_soft_time_limit=270,
    task_serializer='json', accept_content=['json'],
)
```

- **Broker: RabbitMQ** con colas durables `quorum` (`x-queue-type: quorum`), vhost propio, usuario sin permisos de administración y **sin publicar `5672` ni `15672`** al host (compose endurecido en `infra-fase2/compose.fase2.yml`).
- **Resultados: `django-db`** (`django-celery-results`), no el broker.
- **Credenciales del broker por entorno, sin valor por defecto** (**CRIT-03**, D-03): `CELERY_BROKER_URL` se lee del entorno y si falta la app **no arranca**. Hoy `BACKEND/.env.example` sólo declara las variables de PostgreSQL y `NESTJS_URL`: añadir la del broker es parte de B1.8.
- **Periódicas: `django-celery-beat`** con `CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'`. El calendario vive en la base y se ajusta sin desplegar; el `beat_schedule` del bosquejo es **semilla, no fuente de verdad**. Todavía **no hay ninguna tarea periódica en producción**.
- **Topología de colas:** el plan (**B5.14**, §III.3) fija `default`, `reportes`, `cargas`, `archivos`. `FASE2_PROPUESTA_TECNICA.md` §12.6 propone otro juego de nombres (`sync`, `docs`, `mail`, `maint`) para el alcance de Fase 2. **Antes de crear una cola nueva, confirma qué nomenclatura rige** — son dos documentos y no coinciden (ver "Pendientes" al final).

> El paquete de configuración se llama hoy `SIGEP/`. El plan lo referencia como `config/`; mientras no se ejecute el renombrado, lee `config/` como "el paquete de settings del proyecto".

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

y el frontend sondea `GET /api/v1/tareas/{id}/`, cuyo estado es uno de `pendiente | en_proceso | completada | fallida` (respaldado por `django-celery-results`). No hagas que una vista espere el resultado de la tarea.

---

## Caché y throttling — `DatabaseCache` sobre PostgreSQL (D-11)

**No existe hoy.** La ausencia de `CACHES` en `SIGEP/settings.py` **es el hallazgo ALTA-17**: sin backend declarado DRF usa `LocMemCache`, los contadores viven en la memoria de cada worker de gunicorn y un límite de "5 por minuto" con 4 workers es en realidad 20 por minuto, además de reiniciarse en cada despliegue. Se construye en la fase **B0.10**, junto con el throttling que lo necesita (**ALTA-04**):

```python
# SIGEP/settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'gath_cache',          # tabla creada con: python manage.py createcachetable
        'OPTIONS': {
            'IGNORE_EXCEPTIONS': False,    # FALLO CERRADO (D-11): si la caché no responde, se deniega
        },
    },
}
```

```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.ScopedRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {
        # un comentario por scope justificando el número, siempre
        'login': '5/min',            # ALTA-04: contención de fuerza bruta en autenticación
        'cambiar-password': '5/min', # misma superficie, misma tasa
    },
}
```

**Fallo cerrado, no abierto.** Es la diferencia de criterio con la versión heredada de esta skill (ver la sección de regla anulada). Un contador de seguridad que no puede contar debe **notarse y denegar**: un endpoint de autenticación sin límite es una puerta abierta, no una degradación aceptable. Concretamente: `IGNORE_EXCEPTIONS` en `False` para este uso, y la excepción se propaga.

- El bloqueo progresivo de cuentas tras 5 intentos fallidos (**B3.12**) se apoya en esta misma caché y registra el incidente en `logs/backend/security_backend.txt` y en DB.
- **No hay ninguna caché de negocio** (catálogos geográficos, servicios, etc.): cero `cache.get`/`cache.set`/`@cache_page` en el backend. No asumas que hay algo que invalidar al modificar un catálogo.
- Si algún día se introduce la **primera caché de negocio**, ahí sí cabe discutir tolerar la caída del almacén — pero es una decisión distinta de D-11, que gobierna sólo los contadores de seguridad. Documéntala aparte; no la deduzcas de este bloque.
- La tabla `gath_cache` vive en el PostgreSQL externo (**D-03**): el `createcachetable` es un paso de despliegue, no algo que ocurra solo.

En los tests, la caché de throttling se **aísla** (`override_settings(CACHES=...)` con `LocMemCache`) para no consumir cupos reales ni dejar residuos que hagan fallar tests posteriores sin relación aparente. Ver [[testing-backend-django]]; el framework de tests en GATH es `pytest` + `pytest-django` (**D-12**).

---

## drf-spectacular

`drf_spectacular` está en `INSTALLED_APPS` y `REST_FRAMEWORK['DEFAULT_SCHEMA_CLASS']` ya apunta a su `AutoSchema`, pero **no hay bloque `SPECTACULAR_SETTINGS`**: se crea en **B1.14**.

```python
SPECTACULAR_SETTINGS = {
    ...
    'ENUM_NAME_OVERRIDES': {
        # necesario porque drf-spectacular no resuelve el acceso anidado a .choices
        # de un TextChoices definido dentro de una clase de modelo
        'EstatusEmpleadoEnum': 'apps.personal.infrastructure.models.empleado_model.EmpleadoModel.Estatus',
        # ... (uno por cada TextChoices reutilizado en más de un lugar)
    },
}
```

**Regla al añadir un `TextChoices` que se reutilice en más de un modelo/serializer** (**B25**): agrégalo a `ENUM_NAME_OVERRIDES` con un nombre explícito, o drf-spectacular generará nombres colisionantes o genéricos (`Enum1`, `Enum2`) en el esquema OpenAPI. La validación del esquema OpenAPI 3.0 corre en CI (**B6.9**), así que una colisión rompe el pipeline.

Exposición del esquema — estado real en `SIGEP/urls.py`: `/api/schema/`, `/api/docs/` y `/api/redoc/` ya exigen sesión válida más rol administrativo (`PERMISOS_DOCUMENTACION = [IsAuthenticated, EsAdministrador]`, fase **B0.11** por **ALTA-14**). **Queda pendiente** la restricción por red/IP y mover el prefijo de `/admin/` a variable de entorno; el objetivo del plan es además condicionarlo a `settings.EXPOSE_API_DOCS` (default: sólo `DEBUG`), setting que **todavía no existe**.

---

## django-filter

`django_filters` está en `INSTALLED_APPS`, pero `REST_FRAMEWORK` **no declara `DEFAULT_FILTER_BACKENDS`** — la librería no filtra nada hoy. La configuración objetivo:

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

**No existe hoy `PASSWORD_HASHERS` en `settings.py`** (rige el orden por defecto de Django: PBKDF2 primero) y **`argon2-cffi` no está en `requirements.txt`**: sin ese paquete, `Argon2PasswordHasher` no puede usarse. Ambas cosas se resuelven en **B1.13**:

```python
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',        # activo: hashea las nuevas
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',        # fallback de lectura de los hashes existentes
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    'django.contrib.auth.hashers.ScryptPasswordHasher',
]
```

Argon2 es el hasher activo (primero de la lista = el que Django usa para crear hashes nuevos); los demás sólo permiten **leer y re-hashear** contraseñas antiguas. En GATH esto no es teórico: las cuentas existentes están hasheadas con PBKDF2, así que **PBKDF2 no puede salir de la lista** o esos usuarios no podrán volver a entrar. No reordenes esta lista sin entender que afecta la compatibilidad con los hashes ya almacenados.

---

## corsheaders

Estado real en `SIGEP/settings.py`: `CORS_ALLOWED_ORIGINS` es una **lista de IPs y hostnames escritos a mano en el código** (incluyendo duplicados), y el bloque `CORS_ALLOWED_HEADERS` de 9 cabeceras **se ignora en silencio** porque `django-cors-headers` lee `CORS_ALLOW_HEADERS` (verificado en `settings.py`; catalogado como **MED-19** en `PLAN_RECONSTRUCCION_ONION.md`, hallazgo que no aparece en la lista de la v1). Ambos se corrigen al parametrizar el settings, **B1.3**:

```python
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', cast=Csv(), default='')
if DEBUG and not CORS_ALLOWED_ORIGINS:
    CORS_ALLOW_ALL_ORIGINS = True   # sólo en desarrollo y sólo si la lista está vacía
CORS_ALLOW_HEADERS = [...]          # el nombre correcto del setting, no CORS_ALLOWED_HEADERS
```

En producción `CORS_ALLOWED_ORIGINS` viene **siempre** por variable de entorno: sin IPs en el código, sin `testserver` en `ALLOWED_HOSTS`. El fallback a "permitir todo" sólo aplica con `DEBUG=True` — y ojo: hoy `DEBUG` está **fijado a `True` en el código** (`settings.py`), así que ese fallback no es una red de seguridad de desarrollo mientras B1.3 no lo lleve al entorno. `CORS_ALLOW_CREDENTIALS = True` es necesario porque el access token viaja en cookie `HttpOnly` ([[autenticacion-permisos-jwt]]).

---

### ⚠️ Regla anulada respecto a la versión heredada

**1. El broker y la caché eran Redis, y la caché fallaba abierto.** La versión original de esta skill traía:

```python
CACHES = {'default': {
    'BACKEND': 'django_redis.cache.RedisCache',
    'LOCATION': 'redis://redis:6379/1',
    'OPTIONS': {'IGNORE_EXCEPTIONS': True},   # falla abierto si Redis cae
}}
```

...con Celery apuntando a `redis://.../0` como broker **y** como result backend, y la instrucción explícita de *"seguir ese mismo criterio de fallo abierto para cualquier caché nueva"*.

**Todo eso queda anulado en GATH.** **D-02** pone el broker en **RabbitMQ** (`amqp://`) con resultados en PostgreSQL, y **D-11** pone los contadores en **`DatabaseCache` sobre PostgreSQL con fallo cerrado**. No se instala `django-redis`, no se declara un servicio `redis` en el compose y no se usa `redis://` en ninguna URL. El motivo es doble: no añadir un cuarto almacén que respaldar y monitorear, y no dejar que un endpoint de autenticación quede sin límite porque el almacén de contadores no respondió. Si encuentras código o documentación que hable de Redis en GATH, está desactualizado.

**2. Existía una excepción para llamar `.delay()` desde una vista.** La versión heredada permitía un despacho directo desde la capa de entrega cuando la acción era explícita del usuario y no había escritura de dominio. **En GATH no hay excepción**: **B20** prohíbe que el caso de uso importe Celery (se encola por el puerto `TaskQueue`) y **B22** obliga a que todo despacho originado por un cambio de estado vaya dentro de `transaction.on_commit()`. Una vista no despacha tareas: invoca un caso de uso.

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

1. Verifica que `CACHES` con `DatabaseCache` exista y que la tabla `gath_cache` esté creada (`createcachetable`); si no, ese es el primer paso (**B0.10**, **ALTA-17**, **D-11**).
2. Usa `ScopedRateThrottle` con un `throttle_scope` propio y **un comentario que justifique el número** en `DEFAULT_THROTTLE_RATES`.
3. Mantén `IGNORE_EXCEPTIONS: False`: fallo cerrado.
4. Aísla la caché en los tests para no consumir cupos reales ([[testing-backend-django]]).

---

## Pendientes (requieren decisión, no los resuelvas por tu cuenta)

| Tema | Discrepancia entre fuentes | Qué falta decidir |
|---|---|---|
| Versión de `celery` | `requirements.txt`: `5.3.4` · `PLAN_RECONSTRUCCION_ONION` B1.8: serie **5.5.x** validada contra Django 5.2 · `FASE2_PROPUESTA_TECNICA.md` §12.9: `5.4.*` | Qué serie se fija al ejecutar B1.8 |
| Nombres de las colas | Plan §III.3 / B5.14: `default`, `reportes`, `cargas`, `archivos` · `FASE2_PROPUESTA_TECNICA.md` §12.6: `sync`, `docs`, `mail`, `maint` | Nomenclatura única antes de crear la primera cola |
| Variables de entorno del broker | `BACKEND/.env.example` no declara `CELERY_BROKER_URL` ni credenciales de RabbitMQ | Añadirlas en B1.8, sin valores por defecto (**CRIT-03**) |
