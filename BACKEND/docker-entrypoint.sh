#!/bin/sh
# Arranque del contenedor django: espera a PostgreSQL, aplica migraciones y
# luego ejecuta el CMD. Las migraciones van aquí y no en el Dockerfile porque
# durante el build no hay base de datos alcanzable.
set -e

python3 wait-for-postgres.py
python3 manage.py migrate --noinput

exec "$@"
