#!/usr/bin/env bash
# H-7: aplica TODAS las migraciones desde cero contra una PostgreSQL vacía y desechable.
#
# 1) Levanta un postgres temporal (`docker run --rm`) en una red propia.
# 2) Crea el esquema mínimo de las tablas heredadas (scripts/crear_esquema_heredado.py).
# 3) `manage.py migrate` desde cero, `makemigrations --check` y `migrate <app> zero`
#    hacia atrás de las apps propias de la Fase 2 (si REVERTIR=1, por defecto 1).
# 4) Borra contenedor y red al terminar (también ante error o Ctrl+C).
#
# Uso (desde la raíz del repo):   BACKEND/scripts/verificar_migraciones.sh
# Variables: IMAGEN_BACKEND (gath-backend:latest) · IMAGEN_PG (postgres:16-alpine)
#            REVERTIR (1) · APPS_REVERTIR (lista de apps) · SALTAR_BUILD no aplica.
# NUNCA toca la base de desarrollo ni .env reales: usa credenciales y red propias.
#
# Ejemplo de job de GitLab CI (comentado; requiere runner con docker y la imagen):
#   verificar-migraciones:
#     stage: test
#     image: docker:27
#     services: [docker:27-dind]
#     script:
#       - docker build -t gath-backend:latest -f BACKEND/django.dockerfile BACKEND
#       - sh BACKEND/scripts/verificar_migraciones.sh
#     rules:
#       - changes: ["BACKEND/apps/**/migrations/*", "BACKEND/GATH/settings.py"]
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/../.." && pwd)"
IMAGEN_BACKEND="${IMAGEN_BACKEND:-gath-backend:latest}"
IMAGEN_PG="${IMAGEN_PG:-postgres:16-alpine}"
REVERTIR="${REVERTIR:-1}"
# Apps propias de la Fase 2 cuyas migraciones se revierten hasta `zero`.
APPS_REVERTIR="${APPS_REVERTIR:-fe_de_vida postulacion exportaciones notificaciones}"
SUFIJO="$$"
RED="gath-vermig-red-$SUFIJO"
PG="gath-vermig-pg-$SUFIJO"
CLAVE="vermig_$SUFIJO"

limpiar() {
  docker rm -f "$PG" >/dev/null 2>&1 || true
  docker network rm "$RED" >/dev/null 2>&1 || true
}
trap limpiar EXIT

docker network create "$RED" >/dev/null
docker run -d --rm --name "$PG" --network "$RED" \
  -e POSTGRES_PASSWORD="$CLAVE" -e POSTGRES_DB=gath_vermig -e POSTGRES_USER=gath \
  "$IMAGEN_PG" >/dev/null

echo ">> Esperando a PostgreSQL..."
for _ in $(seq 1 60); do
  docker exec "$PG" pg_isready -U gath -d gath_vermig >/dev/null 2>&1 && break
  sleep 1
done
sleep 2  # el servidor reinicia una vez tras initdb

ejecutar() {
  docker run --rm --network "$RED" --entrypoint sh \
    -e DJANGO_DB_NAME=gath_vermig -e DJANGO_DB_USER=gath -e DJANGO_DB_PASSWORD="$CLAVE" \
    -e DJANGO_DB_HOST="$PG" -e DJANGO_DB_PORT=5432 \
    -e DJANGO_SECRET_KEY=verificacion-migraciones -e DJANGO_DEBUG=False \
    -e DJANGO_ALLOWED_HOSTS=localhost \
    -v "$RAIZ/BACKEND":/app/Django -w /app/Django "$IMAGEN_BACKEND" -c "$1"
}

echo ">> 1/4 Esquema heredado mínimo"
ejecutar "python scripts/crear_esquema_heredado.py"
echo ">> 2/4 migrate desde cero"
ejecutar "python manage.py migrate --noinput"
echo ">> 3/4 makemigrations --check"
ejecutar "python manage.py makemigrations --check --dry-run"
if [ "$REVERTIR" = "1" ]; then
  echo ">> 4/4 Reversa de apps de la Fase 2 (migrate <app> zero) y reaplicación"
  for app in $APPS_REVERTIR; do
    ejecutar "python manage.py migrate $app zero --noinput"
  done
  ejecutar "python manage.py migrate --noinput"
fi
echo ">> OK: migraciones verificadas desde cero"
