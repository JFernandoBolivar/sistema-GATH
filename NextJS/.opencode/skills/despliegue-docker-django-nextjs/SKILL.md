---
name: despliegue-docker-django-nextjs
description: Dockerfiles multi-stage y Compose del proyecto GATH (Next.js + Django + Celery + RabbitMQ + Redis + SeaweedFS). Stage `tester` para CI, `output: standalone`, pnpm 12.9.1, python:3.14.10, usuario no root, y la regla de que ni el almacén de archivos, ni el broker ni la caché publican puertos al host.
---

# Skill de Despliegue Docker

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Infraestructura de contenedores del repo: `compose.yml` en la raíz, `BACKEND/django.dockerfile`, `NextJS/nextjs.dockerfile` y `NestJS-Files/nestjs.dockerfile` (este último en retirada por **D-01**).
Stack verificado: Next.js **16.1.3** + React **19.2.3** + TypeScript (`NextJS/package.json`), Node base `node:26.12.1-alpine3.24`, `pnpm` **12.9.1**, con compilación `output: "standalone"`; Django **5.2.8**, DRF **3.16.1**, Celery **5.6.3**, imagen base `python:3.14.10`, paquete de configuración `GATH` (`BACKEND/GATH/settings.py`).
Decisiones que gobiernan esta skill: **D-01** (SeaweedFS con gateway S3 sustituye a NestJS-Files), **D-02** (Celery 5.6.3 con broker **RabbitMQ** vhost `gath` y resultados en Redis db 1), **D-03** (**PostgreSQL en servidor dedicado externo, fuera del `compose`**), **D-11** (Caché y throttling en **Redis** vía `REDIS_URL`, con fallback a `DatabaseCache` sobre PostgreSQL con `MAX_ENTRIES=100000`, siempre con **fallo cerrado**). Tareas de infraestructura: **T1.7** (Dockerfile backend multi-stage con `tester`), **T1.11** (compose base con `rabbitmq`, `redis` y `seaweedfs`), **T7.1** (compose endurecido), **T7.4** (secretos en runtime), **T7.6** (runbook de respaldos). CI del frontend: **F1.6**.

### La regla que ordena todo el despliegue

**Ningún servicio de almacenamiento, broker ni caché publica puertos al host.**

El volume server de SeaweedFS entrega contenido por `fid` **sin autenticación** y el filer expone CRUD completo **sin autenticación**. Publicar `8080` u `8888` permite leer cualquier documento de personal **saltándose Django por completo**: es **CRIT-06/CRIT-07 reproducido en la capa de infraestructura**. Lo mismo ocurre con la consola de RabbitMQ en `15672` o el puerto de Redis `6379`. Sólo la API de Django y el frontend de Next.js quedan expuestos al host (y en producción tras `nginx`); el navegador **nunca** habla directamente con SeaweedFS, RabbitMQ o Redis. Redes `storage`, `broker` y `cache` con aislamiento interno.

---

## 0. Topología de servicios en `compose.yml`

| Pieza | Implementación en GATH | Notas de arquitectura |
|---|---|---|
| PostgreSQL | **No hay servicio `db`.** `django` lo alcanza por `extra_hosts: host.docker.internal:host-gateway` | Servidor dedicado externo con credenciales por entorno sin defaults (**D-03**) |
| Archivos | SeaweedFS 3.80 (`sw_master`, `sw_volume`, `sw_filer`, `sw_s3`), sin puertos al host | Reemplaza a NestJS-Files (**D-01**), gateway S3 en red `storage` |
| Broker de tareas | RabbitMQ 3.13 (`gath_rabbitmq`) con vhost `gath`, sin puertos al host | Broker durable para Celery 5.6.3 (**D-02**) en red `broker` |
| Resultados de tareas | Redis 7.4 (`gath_redis`), db 1 (`CELERY_RESULT_BACKEND`) | Almacenamiento efímero de estados de tareas en red `cache` |
| Caché / throttling | Redis 7.4 (`gath_redis`), db 0 (`REDIS_URL`) | Fallback a `DatabaseCache` (`MAX_ENTRIES=100000`) si falta `REDIS_URL` (**D-11**) |
| Tareas en background | `celery_worker` y `celery_beat` | Misma imagen `gath-backend:latest` del backend, con `SKIP_MIGRATE=1` |
| Backend API | `django` en `python:3.14.10`, expone 8000 (mapeado a 8001 en compose) | Entrypoint corre `wait-for-postgres.py` y `migrate` (**advertencia de réplicas**) |
| Frontend | `nextjs` en `node:26.12.1-alpine3.24` + pnpm 12.9.1, `output: standalone` | Multi-stage con usuario no root `nextjs:nodejs`, puerto 3000 (3001 en host) |

---

## 1. Dockerfile del frontend — `NextJS/nextjs.dockerfile`

Multi-stage estructurado: `base` → `deps` → `builder` → `runner` (con target `tester` para CI).  
Usa **`pnpm@12.9.1`** y Node LTS en Alpine con `libc6-compat`:

```dockerfile
# ── base: Node fijo + pnpm (gestor de paquetes oficial) ──────────────────────
FROM node:26.12.1-alpine3.24 AS base
RUN apk add --no-cache libc6-compat \
    && npm install -g pnpm@12.9.1
WORKDIR /app/NextJS

# ── deps: solo dependencias, para aprovechar la caché de capas ──────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── builder: compila con output "standalone" ────────────────────────────────
FROM base AS builder
COPY --from=deps /app/NextJS/node_modules ./node_modules
COPY . .
RUN pnpm build

# ── runner: imagen final, sin node_modules completo y sin root ──────────────
FROM node:26.12.1-alpine3.24 AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app/NextJS
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/NextJS/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/NextJS/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/NextJS/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### Build targets del frontend

| Flag      | Comando                                                    | Uso                                            |
| --------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `tester`  | `docker build --target tester -f nextjs.dockerfile .`       | CI/CD — ejecuta lint y typecheck sin imagen final |
| `builder` | `docker build --target builder -f nextjs.dockerfile .`      | Debug — verifica compilación standalone        |
| `runner`  | `docker build --target runner -f nextjs.dockerfile .`       | Producción — imagen final optimizada (`node server.js`) |

---

## 2. Dockerfile del backend — `BACKEND/django.dockerfile`

Basado en `python:3.14.10`, instala dependencias nativas del sistema (`libpq-dev`, `poppler-utils` para carnetización) y gestiona el arranque con `docker-entrypoint.sh`:

```dockerfile
FROM python:3.14.10
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    libpq-dev \
    default-libmysqlclient-dev \
    pkg-config \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/Django
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["python3", "manage.py", "runserver", "0.0.0.0:8000"]
```

> **Paquete de configuración:** El paquete de configuración es **`GATH`** (`GATH/settings.py`, `GATH/wsgi.py`). En entornos de producción con gunicorn se ejecuta:
> `gunicorn GATH.wsgi:application --bind 0.0.0.0:8000 --workers 4`

---

## 3. Workers de Celery (`celery_worker` y `celery_beat`)

No requieren un Dockerfile aparte: utilizan **la misma imagen** del backend (`gath-backend:latest`), compartiendo código y dependencias. En `compose.yml` se configuran con comandos específicos y la variable `SKIP_MIGRATE: "1"`:

```yaml
celery_worker:
  container_name: gath_celery_worker
  image: gath-backend:latest
  environment:
    <<: *backend-env
    SKIP_MIGRATE: "1"
  command: ["celery", "-A", "GATH", "worker", "-Q", "gath", "-l", "info", "--concurrency=2"]
  networks: [backend, broker, storage, cache]
  depends_on:
    redis: { condition: service_healthy }
    rabbitmq: { condition: service_started }

celery_beat:
  container_name: gath_celery_beat
  image: gath-backend:latest
  environment:
    <<: *backend-env
    SKIP_MIGRATE: "1"
  command: ["celery", "-A", "GATH", "beat", "-l", "info", "-s", "/tmp/celerybeat-schedule", "--pidfile=/tmp/celerybeat.pid"]
  networks: [backend, broker, cache]
  depends_on:
    - celery_worker
```

- Broker: RabbitMQ con vhost `gath` (`CELERY_BROKER_URL`).
- Resultados: Redis db 1 (`CELERY_RESULT_BACKEND`).
- Cola principal: `gath`.

---

## 4. `docker-entrypoint.sh` y manejo de migraciones

El script de arranque `BACKEND/docker-entrypoint.sh` sincroniza la inicialización con la base de datos:

```bash
#!/bin/sh
set -e

python3 wait-for-postgres.py
# Worker y beat comparten imagen pero no migran (SKIP_MIGRATE=1): solo django lo hace.
if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  python3 manage.py migrate --noinput
fi

exec "$@"
```

### ⚠️ Consideraciones de concurrencia (Race Conditions)
1. **Comportamiento en desarrollo / instancia única:** El contenedor `django` espera a PostgreSQL y ejecuta `migrate` automáticamente antes de atender peticiones. Los contenedores auxiliares `celery_worker` y `celery_beat` evitan duplicar migraciones gracias a `SKIP_MIGRATE="1"`.
2. **Advertencia con múltiples réplicas:** Si en producción se despliegan varias réplicas del servicio `django` en paralelo, ejecutar `migrate` en el entrypoint genera **condiciones de carrera** sobre las tablas de migración de PostgreSQL. En ese escenario, `migrate` debe desacoplarse del entrypoint y ejecutarse como un paso previo deliberado del pipeline de despliegue (`docker compose run --rm django python manage.py migrate --noinput`).

---

## 5. Caché de Django y Throttling (Redis con fallback a PostgreSQL)

El servicio `redis` (`redis:7.4-alpine`) se define en `compose.yml` sin puertos publicados al host:

```yaml
redis:
  image: redis:7.4-alpine
  container_name: gath_redis
  restart: always
  networks: [cache]
```

- **En contenedores Docker:** `REDIS_URL: redis://:${REDIS_PASS}@redis:6379/0` activa `django.core.cache.backends.redis.RedisCache`.
- **En desarrollo local (fuera de Docker):** Si `REDIS_URL` no está presente, Django activa automáticamente `django.core.cache.backends.db.DatabaseCache` en la tabla `django_cache_table` con `MAX_ENTRIES=100000` (previamente creada con `python manage.py createcachetable`).
- **Fallo cerrado (D-11):** Si el motor de caché no responde, los throttles responden 500 en lugar de permitir tráfico sin límites.

---

## 6. Almacenamiento con SeaweedFS (D-01)

El almacenamiento distribuido de archivos opera con SeaweedFS 3.80 en la red `storage`, completamente aislado del host:
- `sw_master` (puerto interno 9333)
- `sw_volume` (puerto interno 8080)
- `sw_filer` (puerto interno 8888)
- `sw_s3` (puerto interno 8333, alias `sw-s3`)

El navegador **nunca** recibe una URL directa de SeaweedFS. Toda descarga se gestiona a través de endpoints protegidos en Django (`RAC.views.media_views.servir_archivo_media` o repositorios de documentos), asegurando autenticación y control de acceso granular antes de realizar el streaming del archivo.

---

## 7. Pre-flight checks

- [ ] `nextjs.dockerfile` compila con `node:26.12.1-alpine3.24`, `pnpm@12.9.1` y `output: standalone`?
- [ ] `django.dockerfile` compila con `python:3.14.10` y los paquetes nativos requeridos?
- [ ] `celery_worker` y `celery_beat` reutilizan la imagen del backend y definen `SKIP_MIGRATE="1"`?
- [ ] En despliegues con réplicas múltiples de `django`, se desacopla `migrate` del entrypoint para evitar condiciones de carrera?
- [ ] El servicio `redis` está confinado a la red `cache` sin puertos expuestos al host?
- [ ] El broker `rabbitmq` y los servicios de SeaweedFS (`sw_*`) no publican puertos al host?
- [ ] `django` conserva el alias `djangoapp` en la red `backend`?
- [ ] No existe ningún servicio de base de datos dentro de `compose.yml`; la conexión a PostgreSQL apunta al servidor externo (**D-03**)?
- [ ] El paquete de configuración del backend invoca a **`GATH`** (`GATH.wsgi`, `celery -A GATH`)?

---

### ⚠️ Reglas anuladas respecto a versiones heredadas

1. **Redis sí forma parte de la infraestructura de `compose.yml`:** Se utiliza en red interna para caché/throttling (`REDIS_URL`, db 0) y persistencia efímera de resultados de Celery (`CELERY_RESULT_BACKEND`, db 1). El broker de mensajería sigue siendo exclusivamente RabbitMQ (vhost `gath`).
2. **PostgreSQL es externo (D-03):** No hay contenedor `db` ni `pg_isready` en `compose.yml`.
3. **Gestor del frontend unificado:** El proyecto utiliza `pnpm 12.9.1` con `--frozen-lockfile`, no npm.
4. **Manejo de migraciones:** `docker-entrypoint.sh` ejecuta migraciones para el contenedor `django` en entornos simples, pero debe separarse a un paso de despliegue si se escalan múltiples réplicas en paralelo.
5. **Nombres de paquete:** El paquete de settings y WSGI es `GATH`, no `SIGEP`.
