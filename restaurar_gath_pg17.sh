#!/usr/bin/env bash
# Restaura un dump de GATH en un PostgreSQL 17 SIN tocar la base actual hasta
# haber verificado que la copia nueva tiene datos.
#
# Pensado para el caso: dump generado con pg_dump 18 (formato custom, versión de
# archivo 1.16) y servidor PostgreSQL 17, que no puede leerlo con su pg_restore.
# El script convierte el dump a SQL plano con un contenedor `postgres:18` (o con
# un pg_restore 18 local si existe) y lo carga con psql 17.
#
# Uso:
#   ./restaurar_gath_pg17.sh /ruta/gath-actualizada-08-11-2026.sql
#
# Variables opcionales:
#   DB=gath              base que usa la aplicación (se renombra al final)
#   DB_USER=postgres     usuario/owner
#   DB_HOST=             vacío = socket local con `sudo -u postgres`
#                        con IP/host = conexión TCP (requiere PGPASSWORD)
#   DB_PORT=5432
#   RUN_AS=postgres      usuario del sistema para psql local ("" = directo)
#   PGPASSWORD=...       solo si DB_HOST está definido
#   SKIP_STOP=1          no detener contenedores (pruebas en otro servidor)
#
# Qué hace, en orden:
#   1. Convierte el dump a SQL plano si hace falta.
#   2. Crea una base NUEVA (gath_restore_<fecha>) y restaura ahí.
#   3. Verifica conteos de las tablas críticas (personal, familiares, catálogos).
#   4. Solo entonces renombra: gath -> gath_old_<fecha>, gath_restore -> gath.
#   5. Si algo falla antes del intercambio, borra la base nueva y no toca gath.
set -Eeuo pipefail

DUMP="${1:-${DUMP:-}}"
DB="${DB:-gath}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-5432}"
RUN_AS="${RUN_AS-postgres}"
SKIP_STOP="${SKIP_STOP:-0}"

STAMP="$(date +%Y%m%d_%H%M%S)"
NUEVA="${DB}_restore_${STAMP}"
VIEJA="${DB}_old_${STAMP}"
LOG="${HOME}/restore_gath_${STAMP}.log"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/gath_restore.XXXXXX")"
SWAPPED=0
CREADA=0

limpiar() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$SWAPPED" -eq 0 ] && [ "$CREADA" -eq 1 ]; then
    echo "Restauración fallida: se elimina la base nueva $NUEVA (la actual no se tocó)." >&2
    psql_run -d postgres -v ON_ERROR_STOP=1 \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$NUEVA' AND pid <> pg_backend_pid();" \
      -c "DROP DATABASE IF EXISTS \"$NUEVA\";" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP"
  exit "$rc"
}
trap limpiar EXIT

die() { echo "ERROR: $*" >&2; exit 1; }

# ── Conexión ─────────────────────────────────────────────────────────────────
if [ -n "$DB_HOST" ]; then
  [ -n "${PGPASSWORD:-}" ] || die "Con DB_HOST definido hay que exportar PGPASSWORD."
  export PGPASSWORD
  psql_run() { psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"; }
else
  if [ -n "$RUN_AS" ]; then
    psql_run() { sudo -u "$RUN_AS" psql "$@"; }
  else
    psql_run() { psql "$@"; }
  fi
fi

# ── 0. Validaciones ──────────────────────────────────────────────────────────
[ -n "$DUMP" ] || die "Uso: $0 <dump.sql|dump.dump>"
[ -f "$DUMP" ] || die "No existe el archivo: $DUMP"
[[ "$DB" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "Nombre de base inválido: $DB"
command -v psql >/dev/null 2>&1 || die "psql no está instalado."

psql_run -d postgres -At -c "SELECT 1;" >/dev/null \
  || die "No se pudo conectar a PostgreSQL${DB_HOST:+ en $DB_HOST:$DB_PORT}."

[ "$(psql_run -d postgres -At -c "SELECT current_setting('server_version_num')::int / 10000;")" -eq 17 ] \
  || echo "AVISO: el servidor no reporta PostgreSQL 17; se continúa igual."

# ── 1. Convertir el dump a SQL plano si es custom ────────────────────────────
PLANO="$DUMP"
if head -c 5 "$DUMP" | grep -q PGDMP; then
  echo "== Dump en formato custom: convirtiéndolo a SQL plano =="
  if pg_restore -l "$DUMP" >/dev/null 2>&1; then
    pg_restore -f "$TMP/plano.sql" --no-owner --no-privileges "$DUMP"
  else
    command -v docker >/dev/null 2>&1 \
      || die "El pg_restore local no puede leer este dump. Instala postgresql-client-18 o Docker + imagen postgres:18."
    echo "   pg_restore local no soporta la versión del archivo; usando Docker postgres:18..."
    docker run --rm -i postgres:18 pg_restore -f - --no-owner --no-privileges \
      < "$DUMP" > "$TMP/plano.sql" \
      || die "El contenedor postgres:18 no pudo leer el dump."
  fi
  PLANO="$TMP/plano.sql"
fi

[ -s "$PLANO" ] || die "El SQL plano quedó vacío."
if head -c 5 "$PLANO" | grep -q PGDMP; then
  die "El archivo sigue siendo custom, no SQL plano."
fi

# pg_dump 18 puede emitir \restrict / \unrestrict, que psql 17 no entiende.
if grep -q '^\\\(un\)\?restrict' "$PLANO"; then
  echo "== Quitando \\restrict/\\unrestrict (no soportados por psql 17) =="
  sed -E '/^\\(un)?restrict([[:space:]].*)?$/d' "$PLANO" > "$TMP/plano-sin-restrict.sql"
  PLANO="$TMP/plano-sin-restrict.sql"
fi

grep -q "PostgreSQL database dump complete" "$PLANO" \
  || echo "AVISO: el SQL plano no termina con el marcador de dump completo; revisa que no esté truncado."

echo "Dump:        $DUMP"
echo "SQL plano:   $PLANO ($(du -h "$PLANO" | cut -f1))"
echo "Base nueva:  $NUEVA"
echo "Log:         $LOG"
echo

# ── 2. Locale de la base actual (si existe) ─────────────────────────────────
INFO="$(psql_run -d postgres -At -F'|' -c \
  "SELECT datcollate, datctype FROM pg_database WHERE datname = '$DB';")" || INFO=""
if [ -n "$INFO" ]; then
  IFS='|' read -r COLL CTYPE <<< "$INFO"
else
  COLL="C.UTF-8"
  CTYPE="C.UTF-8"
fi

echo "== Creando base vacía $NUEVA (locale $COLL) =="
if ! psql_run -d postgres -v ON_ERROR_STOP=1 -c \
      "CREATE DATABASE \"$NUEVA\" OWNER \"$DB_USER\" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE '$COLL' LC_CTYPE '$CTYPE';" \
      >"$TMP/createdb.log" 2>&1; then
  echo "No se pudo crear con locale '$COLL'; se intenta con C.UTF-8..."
  psql_run -d postgres -v ON_ERROR_STOP=1 -c \
    "CREATE DATABASE \"$NUEVA\" OWNER \"$DB_USER\" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8';" \
    || die "No se pudo crear la base $NUEVA."
fi
CREADA=1

# ── 3. Restaurar ─────────────────────────────────────────────────────────────
echo "== Restaurando en $NUEVA (log: $LOG) =="
if psql_run -d "$NUEVA" -v ON_ERROR_STOP=1 --single-transaction \
     < "$PLANO" >"$LOG" 2>&1; then
  echo "   restore OK"
else
  echo "El restore falló. Últimas líneas del log:" >&2
  tail -40 "$LOG" >&2
  exit 1
fi

# ── 4. Verificar datos críticos ──────────────────────────────────────────────
echo "== Verificando conteos =="
CONTEOS="$(psql_run -d "$NUEVA" -At -F'|' -c "
  SELECT 'Employee', count(*) FROM \"Employee\"
  UNION ALL SELECT 'USER_cuenta', count(*) FROM \"USER_cuenta\"
  UNION ALL SELECT 'RAC_employeefamily', count(*) FROM \"RAC_employeefamily\"
  UNION ALL SELECT 'RAC_parentesco', count(*) FROM \"RAC_parentesco\"
  UNION ALL SELECT 'RAC_estado', count(*) FROM \"RAC_estado\"
  UNION ALL SELECT 'RAC_municipio', count(*) FROM \"RAC_municipio\"
  UNION ALL SELECT 'RAC_parroquia', count(*) FROM \"RAC_parroquia\"
  UNION ALL SELECT 'Nacionalidad', count(*) FROM \"Nacionalidad\"
  UNION ALL SELECT 'Pais', count(*) FROM \"Pais\"
  UNION ALL SELECT 'django_migrations', count(*) FROM django_migrations;
")"

printf '%s\n' "$CONTEOS" | while IFS='|' read -r tabla total; do
  printf '   %-22s %s\n' "$tabla" "$total"
done

FALTAN=0
while IFS='|' read -r tabla total; do
  if [ "${total:-0}" -eq 0 ]; then
    echo "   !! $tabla está vacía" >&2
    FALTAN=1
  fi
done <<< "$CONTEOS"
[ "$FALTAN" -eq 0 ] || die "La base nueva no tiene todas las tablas críticas con datos; no se intercambia nada."

# ── 5. Intercambiar bases (solo con la copia ya verificada) ─────────────────
if [ "$SKIP_STOP" != "1" ] && command -v docker >/dev/null 2>&1; then
  for c in django-App gath_celery_worker gath_celery_beat gath_bootstrap; do
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$c"; then
      echo "Deteniendo contenedor $c..."
      docker stop "$c" >/dev/null || true
    fi
  done
fi

echo "== Intercambiando bases =="
psql_run -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname IN ('$DB', '$NUEVA') AND pid <> pg_backend_pid();" >/dev/null

EXISTE_DB="$(psql_run -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname = '$DB';")"
if [ "$EXISTE_DB" = "1" ]; then
  psql_run -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$DB\" RENAME TO \"$VIEJA\";"
  echo "   $DB -> $VIEJA"
fi
psql_run -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$NUEVA\" RENAME TO \"$DB\";"
echo "   $NUEVA -> $DB"
SWAPPED=1

cat <<EOF

Restore completado y verificado.
  Base activa:      $DB
  Base anterior:    ${EXISTE_DB:+$VIEJA}
  Log:              $LOG

Siguientes pasos:
  1) Levantar la aplicación para que apliquen las migraciones pendientes:
       cd <directorio-del-proyecto> && docker compose up -d
  2) Verificar salud (ajusta el puerto a PUERTO_DJANGO, en QA es 8000):
       curl -fsS http://127.0.0.1:\${PUERTO_DJANGO:-8001}/api/v1/health/
  3) Revisar en la app: personal, familiares, estados/municipios/parroquias.

Rollback (si algo saliera mal después):
  sudo -u postgres psql -d postgres -c 'ALTER DATABASE "$DB" RENAME TO "${DB}_descartada_$STAMP";'
  sudo -u postgres psql -d postgres -c 'ALTER DATABASE "$VIEJA" RENAME TO "$DB";'

Cuando todo esté validado, borra la base anterior:
  sudo -u postgres dropdb "$VIEJA"
EOF
