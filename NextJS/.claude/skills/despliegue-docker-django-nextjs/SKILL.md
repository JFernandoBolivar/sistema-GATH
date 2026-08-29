---
name: despliegue-docker-django-nextjs
description: Dockerfiles multi-stage y Compose del proyecto GATH (Next.js + Django + Celery + RabbitMQ + SeaweedFS). Stage `tester` para CI, `output: standalone`, usuario no root, y la regla de que ni el almacén de archivos ni el broker publican puertos al host.
---

# Skill de Despliegue Docker

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Infraestructura de contenedores del repo: `compose.yml` en la raíz, `BACKEND/django.dockerfile`, `NextJS/nextjs.dockerfile` y `NestJS-Files/nestjs.dockerfile` (este último en retirada por **D-01**).
Stack verificado: Next.js **16.1.3** + React **19.2.3** + TypeScript **5.8.3** (`NextJS/package.json`); Django **5.2.7**, DRF **3.16.1**, gunicorn **23.0.0**, Celery **5.3.4** (`BACKEND/requirements.txt`, imagen base `python:3.11-slim`).
Decisiones que gobiernan esta skill: **D-01** (SeaweedFS con gateway S3 sustituye a NestJS-Files), **D-02** (Celery con broker **RabbitMQ**, resultados en `django-db`), **D-03** (**PostgreSQL en servidor dedicado externo, fuera del `compose`**), **D-11** (`DatabaseCache` en PostgreSQL: **no se introduce Redis**). Tareas de infraestructura: **T1.7** (Dockerfile backend multi-stage con `tester`), **T1.11** (compose base con `rabbitmq` y `seaweedfs`), **T7.1** (compose endurecido), **T7.4** (secretos en runtime), **T7.6** (runbook de respaldos). CI del frontend: **F1.6**.
Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de adaptaciones está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.2** (topología objetivo en §III.1–§III.3, tareas de infraestructura en §III.5). La especificación de la infraestructura de Fase 2 es **§12 de `FASE2_PROPUESTA_TECNICA.md`**, materializada en `infra-fase2/`.

### La regla que ordena todo el despliegue

**Ningún servicio de almacenamiento ni el broker publica puertos al host.**

El volume server de SeaweedFS entrega contenido por `fid` **sin autenticación** y el filer expone CRUD completo **sin autenticación**. Publicar `8080` u `8888` permite leer cualquier documento de personal **saltándose Django por completo**: es **CRIT-06/CRIT-07 reproducido en la capa de infraestructura**. Lo mismo con la consola de RabbitMQ en `15672`, que trae credenciales por defecto. Sólo `nginx` queda expuesto; el navegador **nunca** habla con SeaweedFS (§12.5). Redes `storage` y `broker` con `internal: true`. **Etiqueta de imagen fija, nunca `:latest`.**

---

## 0. Topología real hoy vs. objetivo

Verifícalo antes de escribir cualquier cosa: `compose.yml` publica hoy **3000** (`nextjs`), **5000** (`nestjs`), **8000** (`django`) y **9443** (`portainer`), sobre las redes `backend` y `file_manager`.

| Pieza | Hoy en el repo | Objetivo |
|---|---|---|
| PostgreSQL | **No hay servicio `db`.** `django` lo alcanza por `extra_hosts: host.docker.internal:host-gateway` | Servidor dedicado externo con `sslmode=require` y credenciales por entorno sin defaults (**D-03**) |
| Archivos | `nestjs` (NestJS-Files) con bind mount `/var/www/backup/uploadsNestFS` | SeaweedFS + gateway S3, sin puertos al host (**D-01**, §12.8) |
| Cola | Sin broker; no existe `BACKEND/SIGEP/celery.py` | RabbitMQ con vhost `gath`, resultados en `django-db` (**D-02**) |
| Caché / throttling | Sin `CACHES` declarado (**ALTA-17**) | `DatabaseCache` en PostgreSQL, `createcachetable` (**D-11**, B0.10) |
| Dockerfiles | Una sola etapa, usuario **root**, `manage.py runserver` en producción, `npm i` + `next start` | Multi-stage con `tester`, usuario no root, gunicorn, `output: standalone` |
| Etiquetas | `portainer/portainer-ce:latest`, `FROM node` **sin etiqueta** | Etiqueta fija en toda imagen |

Defecto a corregir en `compose.yml` cuando se abra T7.1 (no es tarea de esta skill): el servicio `django` monta **dos** orígenes distintos en el mismo destino `/app/Django/staticfiles` — el volumen con nombre `staticfiles` y el bind `/opt/gath/BACKEND/staticfiles`.

`compose.example.yml` conserva un servicio `postgres` con `pg_isready` y un `pgadmin4` publicando el 8080: es la topología **anterior** a D-03 y **no es el modelo a seguir**.

---

## 1. Dockerfile del frontend — `NextJS/nextjs.dockerfile`

Multi-stage con 5 etapas: `base` → `deps` → `tester` → `builder` → `runner`.

**Prerrequisito que no está hecho:** `NextJS/next.config.ts` **no** declara `output: "standalone"` hoy. Sin eso, la etapa `runner` de abajo no funciona y hay que arrastrar `node_modules` completo a la imagen final. Añadirlo es un cambio en `next.config.ts`, fuera del alcance de esta skill.

```dockerfile
# ────────────────────────────────────────
# STAGE 1: base
# PENDIENTE: fijar la línea LTS disponible en el registro del organismo.
# Hoy nextjs.dockerfile usa `FROM node` SIN etiqueta: la imagen cambia sin aviso.
# ────────────────────────────────────────
FROM node:24-alpine AS base

RUN npm install -g pnpm@10.3.0
WORKDIR /app/NextJS

# ────────────────────────────────────────
# STAGE 2: deps
# Solo instala dependencias (caché máximo)
# ────────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm i --frozen-lockfile

# ────────────────────────────────────────
# STAGE 3: tester
# El pipeline de F1.6: format:check → eslint → tsc --noEmit → test:unit
# ────────────────────────────────────────
FROM deps AS tester

COPY . .
RUN pnpm lint                     # `lint` existe hoy en package.json
# RUN pnpm format:check           # descomentar al instalar Prettier — [[formato-prettier]]
RUN npx tsc --noEmit
# RUN pnpm test:unit              # descomentar al instalar Vitest — [[testing-unit-vitest]]
# RUN pnpm test:e2e               # Playwright corre fuera de la imagen — [[testing-e2e-playwright]]

# ────────────────────────────────────────
# STAGE 4: builder
# Compila la app Next.js (requiere output: "standalone")
# ────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app/NextJS/node_modules ./node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json next.config.ts \
     postcss.config.mjs eslint.config.mjs components.json \
     auth.config.ts auth.ts env.d.ts ./

COPY src/ src/
COPY types/ types/
COPY public/ public/

RUN pnpm build

# ────────────────────────────────────────
# STAGE 5: runner
# Imagen final de producción — usuario NO root
# ────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app/NextJS

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# `standalone` trae su propio server.js y sólo las dependencias que usa
COPY --from=builder --chown=nextjs:nodejs /app/NextJS/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/NextJS/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/NextJS/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "server.js"]
```

> La estructura de código vive en `src/` (`src/app`, `src/components`, `src/lib`, `src/shared`, `src/schemas`, `src/hooks`, `src/constants`, `src/proxy.ts`) más `types/` en la raíz. Cuando el estrangulamiento cree `src/modules/`, entra solo: ya está dentro de `COPY src/`. Ver [[arquitecto-scream-feature-onion]].

### Build targets

| Flag      | Comando                                                    | Uso                                            |
| --------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `tester`  | `docker build --target tester -f nextjs.dockerfile .`       | CI/CD — ejecuta lint y typecheck, no produce imagen final |
| `builder` | `docker build --target builder -f nextjs.dockerfile .`      | Debug — verifica que el build compila          |
| `runner`  | `docker build --target runner -f nextjs.dockerfile .`       | Producción — imagen final optimizada           |

---

## 2. Dockerfile del backend — `BACKEND/django.dockerfile`

Multi-stage: `base` → `deps` → `tester` → `runner` (**T1.7**).

```dockerfile
# ────────────────────────────────────────
# STAGE 1: base
# ────────────────────────────────────────
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app/Django

# libpq para psycopg2 y poppler para pdf2image (carnetización)
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev pkg-config poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# ────────────────────────────────────────
# STAGE 2: deps
# ────────────────────────────────────────
FROM base AS deps

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ────────────────────────────────────────
# STAGE 3: tester
# ruff + mypy + pytest (D-12, B1.4) e import-linter para los contratos Onion
# ────────────────────────────────────────
FROM deps AS tester

COPY . .
RUN pip install --no-cache-dir ruff mypy pytest pytest-django import-linter
RUN ruff check .
RUN mypy .
RUN lint-imports                  # contratos `dominio-puro` e `independencia-modulos` (B1, B16)
RUN pytest -q
# `manage.py check --deploy` exige settings de producción: se corre en el
# pipeline con las variables reales, no dentro del build.

# ────────────────────────────────────────
# STAGE 4: runner — usuario NO root, gunicorn
# ────────────────────────────────────────
FROM deps AS runner

RUN groupadd -r -g 1001 gath && useradd -r -u 1001 -g gath gath

COPY --chown=gath:gath . .
RUN python manage.py collectstatic --noinput

USER gath
EXPOSE 8000

# PENDIENTE: no existe `manage.py health_check` ni un endpoint público de salud
# (`/api/schema/` quedó tras autenticación por B0.11). Mientras no exista, el
# healthcheck sólo comprueba que el socket acepta conexiones.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import socket,sys; s=socket.create_connection(('127.0.0.1',8000),3); s.close()" || exit 1

CMD ["gunicorn", "SIGEP.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
```

> El paquete de settings se llama **`SIGEP`** (`BACKEND/SIGEP/{settings,urls,wsgi,asgi}.py`); el plan lo referencia como `config/` para después del renombrado. El módulo de gunicorn y el `-A` de Celery cambian el día que se ejecute ese renombrado.

**Ojo con el usuario no root y los bind mounts:** `compose.yml` monta `/opt/gath/BACKEND/media` y `/opt/gath/BACKEND/staticfiles`. Al dejar de correr como root, el UID **1001** tiene que ser dueño de esos directorios en el host, o las subidas fallan con `Permission denied`.

---

## 3. Workers de Celery

No hace falta un Dockerfile aparte: es **la misma imagen** del backend con otro `command`, que es exactamente lo que hace `infra-fase2/compose.fase2.yml` (`build: ./BACKEND` + `image: gath-backend:fase2`). Una imagen sola evita que el worker corra un código distinto del que sirve la API.

```dockerfile
# En la práctica, reutiliza el `runner` del backend:
#   docker build -f django.dockerfile --target runner -t gath-backend:<tag> ./BACKEND
# y cambia el comando en el compose:
#   celery -A SIGEP worker -Q docs -c 4 -l INFO
```

El broker es **RabbitMQ** (`amqp://gath:***@rabbitmq:5672/gath`) y el backend de resultados es `django-db` sobre PostgreSQL: **no hay Redis en GATH** (**D-02**, **D-11**, §12.6). Ver [[uso-librerias-backend]].

**PENDIENTE — decisión del usuario:** los nombres de las colas divergen entre documentos. §III.3 del plan lista `cargas` / `reportes` / `archivos` / `default`; §12.6 de la propuesta de Fase 2 y `infra-fase2/compose.fase2.yml` usan `sync` / `docs` / `mail` / `maint`. Los ejemplos de esta skill siguen a `infra-fase2/` porque es el artefacto concreto ya revisado. Hay que unificar antes de T1.11.

---

## 4. `compose.yml` — servicios base, **sin base de datos**

La base de datos **no es un servicio del compose** (**D-03**). No hay `db:`, no hay `pg_isready` dentro del compose, no hay `depends_on` sobre una base local: PostgreSQL vive en un servidor dedicado y Django se conecta por red con `sslmode=require` y credenciales de entorno sin valores por defecto. Si te aparece un servicio `postgres` con healthcheck, es la topología vieja de `compose.example.yml`.

```yaml
services:
  django:
    container_name: django-App
    build:
      context: ./BACKEND
      dockerfile: django.dockerfile
      target: runner
    image: gath-backend:1.0.0          # etiqueta fija, nunca :latest
    env_file: [./BACKEND/.env]
    # PostgreSQL externo (D-03). `host.docker.internal` es el puente de
    # transición mientras la base sigue en el host; el destino es el
    # nombre/IP del servidor dedicado, sin extra_hosts.
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks:
      backend:
        aliases:
          - djangoapp                  # NextJS/.env apunta a http://djangoapp:8000/api/
    ports:
      - "8000:8000"                    # tras nginx en producción
    volumes:
      - "/opt/gath/BACKEND/media:/app/Django/media"
      - "/opt/gath/BACKEND/staticfiles:/app/Django/staticfiles"
      - "/var/log/gath:/app/Django/logs"   # auditoría dual TXT (D-04, T7.5)
    restart: always

  nextjs:
    container_name: nextjs-App
    build:
      context: ./NextJS
      dockerfile: nextjs.dockerfile
      target: runner
    image: gath-frontend:1.0.0
    env_file: [./NextJS/.env]
    networks: [backend]
    ports:
      - "3000:3000"
    depends_on: [django]
    restart: always

networks:
  backend:
    driver: bridge
```

Notas de la topología real que hay que preservar al editar `compose.yml`:

- **El alias `djangoapp` es funcional, no cosmético.** `NextJS/.env` apunta a `http://djangoapp:8000/api/`; si se pierde el alias, el frontend deja de alcanzar al backend dentro de Docker. Compose **reemplaza** la clave `networks` en lugar de fusionarla, así que todo fragmento que redeclare `django.networks` tiene que repetir el alias.
- **`nestjs` y la red `file_manager` desaparecen** al completar la migración a SeaweedFS (**D-01**, §12.8 paso 6), no antes: la bandera `ALMACEN_BACKEND` se conmuta a `seaweed` sólo cuando la verificación de `sha256` esté completa.
- **`portainer`** publica el 9443 y usa `:latest`; si se conserva, va detrás de nginx y con etiqueta fija.

---

## 5. Fase 2 — SeaweedFS y RabbitMQ: usa `infra-fase2/`, no lo reescribas

El fragmento endurecido **ya existe y está revisado**: `infra-fase2/compose.fase2.yml`, con `infra-fase2/README.md`, `infra-fase2/.env.fase2.example` y `infra-fase2/generar-secretos.sh`. La especificación es **§12 de `FASE2_PROPUESTA_TECNICA.md`**. **No dupliques ese YAML en otro archivo:** fusiónalo.

```bash
# 1 · Secretos ANTES del primer `up` (sw_s3 monta identities.json y Docker
#     crearía un directorio si no existe)
./infra-fase2/generar-secretos.sh

# 2 · Fusionar .env.fase2.generado en BACKEND/.env y borrar el generado
# 3 · Dependencias nuevas en BACKEND/requirements.txt (§12.9):
#     boto3, celery 5.4.*, django-celery-results, django-celery-beat, python-magic
# 4 · Levantar (sw_init crea los cuatro buckets y termina)
docker compose -f compose.yml -f infra-fase2/compose.fase2.yml up -d

# 5 · Verificar que nada del almacén ni del broker quedó publicado
docker compose -f compose.yml -f infra-fase2/compose.fase2.yml ps
#     Sólo deben aparecer puertos de host en: nextjs, django, portainer
```

Lo que ese fragmento fija y **no se negocia** (§12.3):

| Servicio | Etiqueta fija | Puertos al host | Por qué |
|---|---|---|---|
| `sw_master` (9333) | `chrislusf/seaweedfs:3.80` | **ninguno** | sólo red interna `storage` |
| `sw_volume` (8080) | `chrislusf/seaweedfs:3.80` | **ninguno** | entrega por `fid` **sin autenticación** |
| `sw_filer` (8888) | `chrislusf/seaweedfs:3.80` | **ninguno** | CRUD completo **sin autenticación** |
| `sw_s3` (8333) | `chrislusf/seaweedfs:3.80` | **ninguno** | única puerta de entrada; Django lo alcanza por `storage` |
| `rabbitmq` (5672/15672) | `rabbitmq:3.13-management-alpine` | **ninguno** | la consola trae credenciales por defecto |

Redes `storage` y `broker` con `internal: true` (sin salida a internet). Identidades S3 acotadas por bucket en `seaweedfs/identities.json` — nunca una única llave de administrador, y **ninguna con permiso de borrado sobre `gath-documentos`**: un documento firmado no se elimina desde la aplicación.

### Servido de archivos: el contenedor no es el control de acceso

El navegador **nunca** recibe una URL de SeaweedFS. Todo archivo se pide a Django, que **autoriza primero y hace streaming después**, y asienta el acceso en la bitácora (§12.5). No publiques rutas de archivos por el proxy ni montes `media/` en nginx: eso es **CRIT-06/CRIT-07** otra vez.

En esta rama, `BACKEND/SIGEP/urls.py` **ya retiró** `static(settings.MEDIA_URL, ...)` (B0.7) y sirve el prefijo `MEDIA_URL` con una vista autenticada y confinamiento de ruta (`RAC.views.media_views.servir_archivo_media`). **Verifica que sigue así antes de tocar el despliegue:** si esa línea reaparece, `/media/` se descarga sin autenticarse y cualquier control de acceso es decorativo.

---

## 6. Compose de desarrollo (override)

```yaml
services:
  django:
    build:
      target: deps                     # sin collectstatic ni usuario no root
    volumes:
      - ./BACKEND:/app/Django
    command: python manage.py runserver 0.0.0.0:8000

  nextjs:
    build:
      target: deps
    volumes:
      - ./NextJS:/app/NextJS
      - /app/NextJS/node_modules
    command: pnpm dev
    environment:
      - NODE_ENV=development
```

```bash
docker compose up -d                                   # desarrollo (toma el override)
docker compose -f compose.yml up -d                    # producción (lo ignora)
```

`runserver` es **sólo** de desarrollo. La imagen de producción corre gunicorn como usuario no root.

---

## 7. `.dockerignore`

`NextJS/.dockerignore` excluye hoy `.env` pero **no `.env.*`**, y `NextJS/.env.docker` y `NextJS/.env.example` están **versionados en git** con secretos (**CRIT-03**, tarea **F0.3**): tal como está, esos archivos entran a la imagen. `BACKEND/` **no tiene `.dockerignore`**, así que se copia `media/`, `staticfiles/`, `__pycache__` y `.env` completos.

### `NextJS/.dockerignore`

```
.git
.gitignore
.next
node_modules
.pnpm
dist
coverage
.env
.env.*
!.env.example
*.md
*.tsbuildinfo
.eslintcache
```

### `BACKEND/.dockerignore`

```
.git
.gitignore
__pycache__
*.pyc
db.sqlite3
.env
.env.*
!.env.example
*.md
staticfiles
media
logs
```

**Ningún secreto va a git ni a la imagen (CRIT-03).** Sólo `.env.example` y `.env.fase2.example` con placeholders; los valores reales se inyectan en runtime (**T7.4**). En `settings.py`, un secreto ausente **hace fallar el arranque**: nada de valores por defecto.

---

## 8. `entrypoint` del backend

```bash
#!/bin/sh
set -e

echo "→ Colectando static files..."
python manage.py collectstatic --noinput

echo "→ Iniciando servidor..."
exec "$@"
```

```dockerfile
COPY --chown=gath:gath deploy/entrypoint.backend.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "SIGEP.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
```

### ⚠️ `migrate` no va en el entrypoint

La base es **externa y compartida** (**D-03**): con varias réplicas de `django` y varios workers, cada contenedor que arranca lanzaría migraciones contra la misma base a la vez. `migrate` y `createcachetable` (**D-11**, B0.10) son un **paso deliberado del despliegue**, ejecutado una vez y con ventana acordada, no un efecto del arranque:

```bash
docker compose run --rm django python manage.py migrate --noinput
docker compose run --rm django python manage.py createcachetable   # gath_cache (ALTA-17)
```

Tampoco uses `collectstatic --clear` con el bind mount de producción: borra el contenido del volumen compartido.

---

## 9. Comandos útiles

```bash
# Build solo para testing (CI) — sin imagen final
docker build --target tester -t gath-frontend:test -f nextjs.dockerfile ./NextJS
docker build --target tester -t gath-backend:test  -f django.dockerfile ./BACKEND

# Build de producción — etiqueta fija, JAMÁS :latest
docker build --target runner -t gath-frontend:1.0.0 -f nextjs.dockerfile ./NextJS
docker build --target runner -t gath-backend:1.0.0  -f django.dockerfile ./BACKEND

# Levantar (base + Fase 2)
docker compose -f compose.yml -f infra-fase2/compose.fase2.yml up -d

# Logs
docker compose logs -f django nextjs

# Comprobar que el almacén y el broker NO publican puertos
docker compose -f compose.yml -f infra-fase2/compose.fase2.yml ps
```

`docker compose down -v` **borra los volúmenes con nombre**, incluidos `gath_rabbitmq` y `gath_sw_master`. En cualquier entorno con datos reales, `down` sin `-v`.

---

## 10. Pre-flight checks

- [ ] `docker build --target tester` corre lint + `tsc --noEmit` (frontend) y `ruff` + `mypy` + `lint-imports` + `pytest` (backend) sin errores?
- [ ] `next.config.ts` declara `output: "standalone"` y la imagen final **no** arrastra `node_modules`?
- [ ] Las dos imágenes finales corren como **usuario no root**, y el UID 1001 es dueño de `/opt/gath/BACKEND/{media,staticfiles}` en el host?
- [ ] **Toda** imagen tiene etiqueta fija? (`docker compose config | grep ':latest'` debe salir vacío)
- [ ] `docker compose ps` muestra puertos de host **sólo** en `nextjs`, `django` y `portainer`? (`8080`, `8888`, `9333`, `8333`, `5672`, `15672` **sin publicar**)
- [ ] Las redes `storage` y `broker` tienen `internal: true`?
- [ ] `django` conserva el alias `djangoapp` en la red `backend` después de fusionar los fragmentos?
- [ ] No hay servicio de base de datos ni `pg_isready` en el compose, y la conexión externa usa `sslmode=require` (**D-03**)?
- [ ] No hay **ningún** servicio `redis` (**D-02**, **D-11**), y `createcachetable` ya creó `gath_cache`?
- [ ] Celery conecta a **RabbitMQ** con vhost `gath` y `result_backend='django-db'`?
- [ ] `BACKEND/SIGEP/urls.py` sigue **sin** `static(settings.MEDIA_URL, ...)` y `/media/` exige autenticación (**CRIT-07**)?
- [ ] `.dockerignore` de ambos lados excluye `node_modules`, `__pycache__`, `.git`, `media`, `staticfiles` y **`.env*` salvo `.env.example`** (**CRIT-03**)?
- [ ] `infra-fase2/seaweedfs/identities.json` y `.env.fase2.generado` existen con modo 600 y **no** están en git?
- [ ] Frontend responde en `http://localhost:3000` y el backend acepta conexión en el 8000?
- [ ] Respaldo de las **tres** piezas —PostgreSQL, `seaweed_data` y `seaweed_metadata`— **con una restauración de prueba verificada** (§12.10, **T7.6**)? Con claves UUID, un respaldo del almacén sin el de la base es un montón de objetos sin nombre.

---

### ⚠️ Reglas anuladas respecto a la versión heredada

Esta skill venía de otro proyecto y describía **su** infraestructura. Lo siguiente queda anulado:

1. **El servicio `redis:` se elimina.** No hay Redis en GATH, en ninguna forma: el broker de Celery es **RabbitMQ** (**D-02**), los resultados van a PostgreSQL con `django-celery-results`, y el caché y el throttling usan `DatabaseCache` sobre PostgreSQL (**D-11**, §12.6). La justificación es explícita en el plan: no introducir un cuarto almacén de datos. Si ves `redis:7-alpine`, `redis-cli ping` o `REDIS_URL` en un compose de GATH, es un artefacto del proyecto de origen.
2. **El servicio `db:` y su `healthcheck` de `pg_isready` se eliminan del compose**, junto con todo `depends_on` sobre una base local. PostgreSQL es **externo, en servidor dedicado** (**D-03**). El `pg_isready -U <usuario>` de la versión heredada apuntaba a un contenedor que en GATH no existe.
3. **Nada de `:latest`.** La versión heredada etiquetaba `…-frontend:latest` y `…-backend:latest`. Un `pull` que cambie el almacén de expedientes firmados sin aviso es inaceptable: etiqueta fija siempre.
4. **`migrate` sale del entrypoint** (ver §8): base externa compartida, migración como paso deliberado.
5. **Rutas y contextos de build:** el proyecto son `BACKEND/` y `NextJS/` — nunca un directorio de frontend de otro proyecto. El código del frontend está bajo `src/`, el paquete de settings es `SIGEP` y el `-A` de Celery es `SIGEP`.
6. **`.env.*` se excluye de la imagen y del repositorio** (**CRIT-03**). La versión heredada sólo ignoraba `.env`, y su proyecto de origen versionaba `.env.example` con valores reales.

---

## 11. Pendientes que requieren decisión

| # | Pendiente | Bloquea |
|---|---|---|
| 1 | **Gestor de paquetes del frontend.** Coexisten `pnpm-lock.yaml` + `pnpm-workspace.yaml` y `package-lock.json`, y `nextjs.dockerfile` usa `npm i`. Sin `packageManager` en `package.json` no hay fuente de verdad; los ejemplos aquí usan pnpm por el `pnpm-workspace.yaml` | Reproducibilidad del build (`--frozen-lockfile`) |
| 2 | **Etiqueta de la imagen base de Node.** Hoy `FROM node` sin etiqueta. Hay que fijar la línea LTS disponible en el registro del organismo | Builds reproducibles |
| 3 | **`output: "standalone"` en `next.config.ts`** — no está declarado; sin él la etapa `runner` no aplica | Imagen final del frontend |
| 4 | **Nombres de las colas de Celery:** §III.3 del plan (`cargas`/`reportes`/`archivos`/`default`) vs. §12.6 y `infra-fase2/` (`sync`/`docs`/`mail`/`maint`) | T1.11 |
| 5 | **Endpoint o comando de salud del backend.** No existe `manage.py health_check` y `/api/schema/` quedó autenticado (B0.11); el healthcheck actual sólo prueba el socket | Healthcheck real |
| 6 | **Scripts de CI ausentes en `package.json`:** `format:check`, `typecheck`, `test:unit`, `test:e2e`. El pipeline de **F1.6** los exige | Etapa `tester` completa |
| 7 | **`nginx`** es el único servicio expuesto en la topología objetivo (§12.1, §III.1) pero **no existe** en `compose.yml`: hay que crearlo con TLS y cabeceras de seguridad | T7.1 |
| 8 | **Datos del servidor PostgreSQL externo** (versión, política de respaldo y restauración) — pendiente **A-04** | Validación de respaldo T7.6 |
