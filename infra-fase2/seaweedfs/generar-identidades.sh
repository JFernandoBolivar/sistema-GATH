#!/usr/bin/env bash
# GATH · genera infra-fase2/seaweedfs/identities.json (no versionado) para sw_s3.
#
# Las claves se toman, por orden, de: variables de entorno ya exportadas
# (SEAWEEDFS_S3_ACCESS_KEY / SEAWEEDFS_S3_SECRET_KEY / SEAWEEDFS_S3_BUCKET) o de
# BACKEND/.env. Si no existen en ninguno, genera unas aleatorias y las IMPRIME para
# que las pegues en BACKEND/.env (son las que lee SeaweedFSStorage).
# No sobrescribe un identities.json existente: bórralo para regenerarlo.
# Uso:  ./infra-fase2/seaweedfs/generar-identidades.sh [ruta_salida]
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
raiz="$(cd "$aqui/../.." && pwd)"
salida="${1:-$aqui/identities.json}"
envf="$raiz/BACKEND/.env"

if [[ -e "$salida" ]]; then
  echo "$salida ya existe. Bórralo si quieres regenerarlo." >&2
  exit 1
fi

leer() { # lee VAR del entorno o de BACKEND/.env
  local v="${!1:-}"
  if [[ -z "$v" && -f "$envf" ]]; then
    v="$(grep -E "^$1=" "$envf" | tail -n1 | cut -d= -f2- | tr -d "\"'" || true)"
  fi
  if [[ "$v" == "__GENERAR__" ]]; then v=""; fi
  printf '%s' "$v"
}
gen() { openssl rand -base64 48 | tr -d '/+=\n' | head -c "$1"; }

ak="$(leer SEAWEEDFS_S3_ACCESS_KEY)"
sk="$(leer SEAWEEDFS_S3_SECRET_KEY)"
bucket="$(leer SEAWEEDFS_S3_BUCKET)"
bucket="${bucket:-gath-storage}"
nuevas=0
if [[ -z "$ak" ]]; then ak="gath-app-$(gen 12)"; nuevas=1; fi
if [[ -z "$sk" ]]; then sk="$(gen 40)"; nuevas=1; fi

umask 077
sed -e "s|__SEAWEEDFS_S3_ACCESS_KEY__|$ak|" -e "s|__SEAWEEDFS_S3_SECRET_KEY__|$sk|" \
    -e "s|__SEAWEEDFS_S3_BUCKET__|$bucket|g" \
    "$aqui/identities.app.example.json" > "$salida"
echo "OK  $salida (modo 600, ignorado por git)"
if [[ $nuevas -eq 1 ]]; then
  echo "Claves nuevas: añade estas líneas a BACKEND/.env (deben coincidir con identities.json):"
  echo "SEAWEEDFS_S3_ACCESS_KEY=$ak"
  echo "SEAWEEDFS_S3_SECRET_KEY=$sk"
fi
