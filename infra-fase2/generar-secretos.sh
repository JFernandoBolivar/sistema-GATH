#!/usr/bin/env bash
# GATH Fase 2 · genera identities.json y las variables de entorno con secretos
# aleatorios. Idempotente sólo si borras los archivos generados primero.
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f seaweedfs/identities.json ]]; then
  echo "seaweedfs/identities.json ya existe. Bórralo si quieres regenerarlo." >&2
  exit 1
fi

gen() { openssl rand -base64 30 | tr -d '/+=' | head -c 40; }

APP_KEY="gath-app-$(gen | head -c 12)";      APP_SECRET="$(gen)"
LEC_KEY="gath-lector-$(gen | head -c 12)";   LEC_SECRET="$(gen)"
RES_KEY="gath-respaldo-$(gen | head -c 12)"; RES_SECRET="$(gen)"
RMQ_PASS="$(gen)"

sed -e "s|__GATH_APP_KEY__|$APP_KEY|"           -e "s|__GATH_APP_SECRET__|$APP_SECRET|" \
    -e "s|__GATH_LECTOR_KEY__|$LEC_KEY|"        -e "s|__GATH_LECTOR_SECRET__|$LEC_SECRET|" \
    -e "s|__GATH_RESPALDO_KEY__|$RES_KEY|"      -e "s|__GATH_RESPALDO_SECRET__|$RES_SECRET|" \
    seaweedfs/identities.example.json > seaweedfs/identities.json
chmod 600 seaweedfs/identities.json

cat > .env.fase2.generado <<VARS
# Generado $(date +%F). Fusiona estas líneas en BACKEND/.env y borra este archivo.
S3_ENDPOINT=http://sw_s3:8333
S3_ACCESS_KEY=$APP_KEY
S3_SECRET_KEY=$APP_SECRET
RABBITMQ_USER=gath
RABBITMQ_PASS=$RMQ_PASS
CELERY_BROKER_URL=amqp://gath:$RMQ_PASS@rabbitmq:5672/gath
VARS
chmod 600 .env.fase2.generado

echo "✓ seaweedfs/identities.json      (modo 600, ignorado por git)"
echo "✓ .env.fase2.generado            (modo 600, ignorado por git)"
echo
echo "Siguiente paso: fusiona .env.fase2.generado en BACKEND/.env y bórralo."
echo "Las credenciales de gath-lector y gath-respaldo quedan sólo en identities.json."
