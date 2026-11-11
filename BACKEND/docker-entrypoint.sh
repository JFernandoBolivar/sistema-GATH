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
  # S2-02: las cuentas antiguas con la cédula como contraseña caducan solas.
  # Solo encola (una vez por despliegue, con marca persistente y candado): el
  # barrido de hashes tarda minutos y corre en el worker, no aquí.
  # VENCER_CLAVES_INICIALES=0 lo desactiva (entornos donde se conserva el login con cédula).
  if [ "${VENCER_CLAVES_INICIALES:-1}" != "0" ]; then
    python3 manage.py vencer_claves_iniciales_antiguas --encolar || true
  fi
fi

exec "$@"
