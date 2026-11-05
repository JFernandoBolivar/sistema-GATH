#!/bin/sh
# Arranque del contenedor django: espera a PostgreSQL, aplica migraciones y
# luego ejecuta el CMD. Las migraciones van aquí y no en el Dockerfile porque
# durante el build no hay base de datos alcanzable.
set -e

python3 wait-for-postgres.py
# Worker y beat comparten imagen pero no migran (SKIP_MIGRATE=1): solo django lo hace.
if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  python3 manage.py migrate --noinput
  # Catálogo de permisos y matriz de roles: idempotente. Se puede desactivar con
  # SEED_PERMISOS=0 (p. ej. si la matriz se gestiona solo desde la pantalla).
  if [ "${SEED_PERMISOS:-1}" != "0" ]; then
    python3 manage.py seed_permisos
  fi
fi

exec "$@"
