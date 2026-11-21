#!/bin/sh
# GATH · H-1: arranque de sw_s3 con identidades generadas al vuelo.
#
# Construye identities.json en cada arranque a partir de SEAWEEDFS_S3_ACCESS_KEY,
# SEAWEEDFS_S3_SECRET_KEY y SEAWEEDFS_S3_BUCKET (las mismas variables de BACKEND/.env
# que usa Django), así las claves del gateway y las de la app no pueden desalinearse.
# El archivo se escribe dentro del contenedor (no queda en el host ni en git).
# Si faltan las claves, el servicio NO arranca (fallo cerrado: nunca S3 anónimo).
set -eu

plantilla=/etc/seaweedfs/identities.app.example.json
salida=/tmp/identities.json
ak="${SEAWEEDFS_S3_ACCESS_KEY:-}"
sk="${SEAWEEDFS_S3_SECRET_KEY:-}"
bucket="${SEAWEEDFS_S3_BUCKET:-gath-storage}"

if [ -z "$ak" ] || [ -z "$sk" ] || [ "$ak" = "__GENERAR__" ] || [ "$sk" = "__GENERAR__" ]; then
  echo "sw_s3: faltan SEAWEEDFS_S3_ACCESS_KEY / SEAWEEDFS_S3_SECRET_KEY en BACKEND/.env; no se arranca sin autenticación." >&2
  exit 1
fi
case "$ak$sk$bucket" in
  *'|'*|*'\'*|*'"'*|*'&'*)
    echo "sw_s3: las claves y el bucket no pueden contener | \\ \" ni &." >&2
    exit 1 ;;
esac

umask 077
sed -e "s|__SEAWEEDFS_S3_ACCESS_KEY__|$ak|" -e "s|__SEAWEEDFS_S3_SECRET_KEY__|$sk|" \
    -e "s|__SEAWEEDFS_S3_BUCKET__|$bucket|g" "$plantilla" > "$salida"

# Entorno limpio: env_file entrega todo BACKEND/.env y weed no necesita nada de eso.
exec env -i PATH="$PATH" HOME="${HOME:-/root}" /entrypoint.sh "$@" -config="$salida"
