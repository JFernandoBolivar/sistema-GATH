# `infra-fase2/` — SeaweedFS + RabbitMQ

Configuración de infraestructura de la Fase 2. La especificación completa y el
razonamiento están en **§12 de `../FASE2_PROPUESTA_TECNICA.md`**.

| Archivo | Qué es |
|---|---|
| `compose.fase2.yml` | Fragmento de Compose endurecido, para fusionar con `../compose.yml` |
| `seaweedfs/identities.example.json` | Plantilla de identidades S3 acotadas por bucket |
| `.env.fase2.example` | Variables nuevas, con los secretos como `__GENERAR__` |
| `generar-secretos.sh` | Genera `identities.json` y las credenciales aleatorias |
| `celery-app.sketch.py` | Bosquejo de `BACKEND/SIGEP/celery.py` y del calendario de `beat` |

## La regla que ordena todo

**Ningún servicio de almacenamiento ni el broker publica puertos al host.**

El volume server de SeaweedFS entrega contenido por `fid` **sin autenticación**, y
el filer expone CRUD completo **sin autenticación**. Publicar `8080` o `8888`
permitiría leer cualquier documento de personal saltándose Django por completo —
es CRIT-06/CRIT-07 reproducido en la capa de infraestructura. Igual con la consola
de RabbitMQ en `15672`.

Sólo `nginx` queda expuesto. El navegador **nunca** habla con SeaweedFS: pide el
archivo a Django, que autoriza primero y hace streaming después (§12.5).

## Puesta en marcha

```bash
# 1 · Secretos. Debe correr ANTES del primer `up`: el servicio sw_s3 monta
#     seaweedfs/identities.json y Docker crearía un directorio si no existe.
./infra-fase2/generar-secretos.sh

# 2 · Fusiona .env.fase2.generado en BACKEND/.env y borra el generado
#     (deja las claves de gath-lector y gath-respaldo sólo en identities.json)

# 3 · Dependencias nuevas en BACKEND/requirements.txt — ver §12.9
#     boto3, celery 5.4, django-celery-results, django-celery-beat, python-magic

# 4 · Levantar. sw_init crea los cuatro buckets y termina.
docker compose -f compose.yml -f infra-fase2/compose.fase2.yml up -d

# 5 · Verificar que nada del almacén ni del broker quedó publicado
docker compose -f compose.yml -f infra-fase2/compose.fase2.yml ps
#     Sólo deben aparecer puertos de host en: nextjs, django, portainer
```

## Antes de producción

- [ ] `ALMACEN_BACKEND=nestjs` hasta completar la verificación de `sha256` de la
      migración (§12.8, paso 4). Sólo entonces conmutar a `seaweed`.
- [ ] Retirar `static(settings.MEDIA_URL, ...)` de `BACKEND/SIGEP/urls.py`
      (CRIT-07). Mientras esa línea exista, `/media/` se descarga sin
      autenticarse y el control de acceso de §12.5 es decorativo.
- [ ] Respaldo de las **tres** piezas —PostgreSQL, `seaweed_data` y
      `seaweed_metadata`— y **una restauración de prueba verificada** (§12.10).
      Con claves UUID, un respaldo del almacén sin el de la base es un montón de
      objetos sin nombre.
- [ ] Definir `RETENCION_EXPEDIENTE_RECHAZADO_DIAS` (DEC-3). Vacío, la purga no
      borra nada — que es el comportamiento seguro, pero deja el dato acumulándose.
- [ ] Etiqueta de imagen fija (`3.80`), nunca `:latest`, para que un `pull` no
      cambie el almacén de expedientes firmados sin aviso.

## Advertencias de topología

- **Un solo volume server, sin replicación** (`-defaultReplication=000`). Un
  fallo de disco es pérdida definitiva. Es aceptable **sólo** con respaldo diario
  verificado; si no, un segundo volume server con `001`.
- **`-volumeSizeLimitMB=1024` y `-max=64`** acotan el crecimiento a ~64 GB por
  volume server. Ajustar al disco real antes de desplegar.
- **`internal: true`** en las redes `storage` y `broker`: sin salida a internet.
  Si algún servicio necesitara alcanzar el exterior, quitarlo de forma explícita
  y dejar constancia del motivo.
