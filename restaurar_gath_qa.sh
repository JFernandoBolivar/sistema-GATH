#!/usr/bin/env bash
# Restaura un dump custom de pg_dump en la base "gath" del servidor de QA,
# conservando el nombre y el dueño actuales (DJANGO_DB_NAME / DJANGO_DB_USER).
#
# Uso (en el servidor de QA):
#   ./restaurar_gath_qa.sh /home/ansanchez/gath-actualizada-08-11-2026.sql
#
# Variables opcionales:
#   DB=gath            nombre exacto de la base destino (por defecto: gath)
#   DB_OWNER=postgres  dueño de la base (por defecto: postgres)
#   RUN_AS=postgres    usuario del sistema para psql/pg_restore (vacío = directo)
#   SKIP_STOP=1        no detener los contenedores de la app
#   PG_RESTORE_BIN     binario pg_restore a usar (si el dump es de otra versión)
#   PG_DUMP_BIN        binario pg_dump para el respaldo previo
#   DUMP_FORMAT        auto (por defecto), custom o plain
#
# Ejemplo para un dump de PostgreSQL 18 sobre un servidor PostgreSQL 17:
#   PG_RESTORE_BIN=/usr/lib/postgresql/18/bin/pg_restore \
#   PG_DUMP_BIN=/usr/lib/postgresql/17/bin/pg_dump \
#   ./restaurar_gath_qa.sh ~/dump.sql
#
# El script:
#   1. Verifica el dump y la versión del cliente.
#   2. Detiene django/celery para liberar conexiones.
#   3. Respalda la base actual en ~/gath_backup_<fecha>.dump.
#   4. Renombra la base actual a gath_old_<fecha> (no la borra).
#   5. Crea una base gath vacía con la misma locale y restaura el dump.
#   6. Verifica conteos y deja instrucciones de rollback.
set -Eeuo pipefail

DUMP="${1:-${DUMP:-$HOME/gath-actualizada-08-11-2026.sql}}"
DB="${DB:-gath}"
DB_OWNER="${DB_OWNER:-postgres}"
RUN_AS="${RUN_AS-postgres}"
SKIP_STOP="${SKIP_STOP:-0}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
DUMP_FORMAT="${DUMP_FORMAT:-auto}"

STAMP="$(date +%Y%m%d_%H%M%S)"
OLD_DB="${DB}_old_${STAMP}"
FAILED_DB="${DB}_failed_${STAMP}"
BACKUP="$HOME/gath_backup_${STAMP}.dump"
LOG="$HOME/restore_gath_${STAMP}.log"

run_pg() {
  if [ -n "$RUN_AS" ]; then
    sudo -u "$RUN_AS" "$@"
  else
    "$@"
  fi
}

die() { echo "ERROR: $*" >&2; exit 1; }

# ── 0. Verificaciones previas ────────────────────────────────────────────────
[ -f "$DUMP" ] || die "No existe el archivo: $DUMP"
[[ "$DB" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "Nombre de base inválido: $DB"
command -v "$PG_RESTORE_BIN" >/dev/null 2>&1 || die "No se encontró pg_restore: $PG_RESTORE_BIN"
command -v psql >/dev/null 2>&1 || die "psql no está instalado"
command -v "$PG_DUMP_BIN" >/dev/null 2>&1 || die "No se encontró pg_dump: $PG_DUMP_BIN"

if [ "$DUMP_FORMAT" = "auto" ]; then
  if head -c 5 "$DUMP" | grep -q PGDMP; then
    DUMP_FORMAT=custom
  else
    DUMP_FORMAT=plain
  fi
fi
[ "$DUMP_FORMAT" = "custom" ] || [ "$DUMP_FORMAT" = "plain" ] \
  || die "DUMP_FORMAT inválido: $DUMP_FORMAT (usa auto, custom o plain)"

if [ "$DUMP_FORMAT" = "custom" ]; then
  if ! TOC="$("$PG_RESTORE_BIN" -l "$DUMP" 2>&1)"; then
    echo "$TOC" >&2
    die "No se pudo leer el dump (¿formato custom de una versión más nueva de PostgreSQL?)"
  fi
  DUMP_VER="$(printf '%s\n' "$TOC" | sed -n 's/.*Dumped from database version: //p' | head -1)"
  DUMP_MAJOR="${DUMP_VER%%.*}"
  CLIENT_MAJOR="$("$PG_RESTORE_BIN" --version | grep -oE '[0-9]+' | head -1)"
  if [ -n "$DUMP_MAJOR" ] && [ "$CLIENT_MAJOR" -lt "$DUMP_MAJOR" ]; then
    die "El dump es de PostgreSQL $DUMP_VER y pg_restore es $CLIENT_MAJOR.x. Usa un dump en SQL plano o instala postgresql-client-$DUMP_MAJOR."
  fi
else
  DUMP_VER="$(sed -n 's/^-- Dumped from database version: //p' "$DUMP" | head -1)"
fi

INFO="$(run_pg psql -d postgres -At -F'|' -c \
  "SELECT pg_encoding_to_char(encoding), datcollate, datctype FROM pg_database WHERE datname = '$DB';")"
[ -n "$INFO" ] || die "La base '$DB' no existe en el servidor."
IFS='|' read -r OLD_ENC OLD_COLL OLD_CTYPE <<< "$INFO"
echo "Dump:        $DUMP"
echo "Formato:     $DUMP_FORMAT${DUMP_VER:+ (PostgreSQL $DUMP_VER)}"
echo "Base destino: $DB (encoding=$OLD_ENC, collate=$OLD_COLL, ctype=$OLD_CTYPE)"
echo

# ── 1. Liberar conexiones de la aplicación ───────────────────────────────────
if [ "$SKIP_STOP" != "1" ] && command -v docker >/dev/null 2>&1; then
  for c in django-App gath_celery_worker gath_celery_beat gath_bootstrap; do
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$c"; then
      echo "Deteniendo contenedor $c..."
      docker stop "$c" >/dev/null || true
    fi
  done
fi

# ── 2. Respaldo de la base actual ────────────────────────────────────────────
echo "== Respaldando la base actual en $BACKUP =="
run_pg "$PG_DUMP_BIN" -Fc -d "$DB" > "$BACKUP"
# Se verifica como el usuario actual: postgres puede no tener permiso sobre $HOME.
"$PG_RESTORE_BIN" -l "$BACKUP" >/dev/null || die "El respaldo generado no es válido: $BACKUP"
ls -lh "$BACKUP"

# ── 3. Renombrar la base actual (rollback disponible) ────────────────────────
echo "== Renombrando $DB -> $OLD_DB =="
run_pg psql -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB' AND pid <> pg_backend_pid();" >/dev/null
run_pg psql -d postgres -c "ALTER DATABASE \"$DB\" RENAME TO \"$OLD_DB\";"

# ── 4. Crear la base vacía con el mismo nombre ───────────────────────────────
echo "== Creando base vacía $DB =="
if ! run_pg createdb -O "$DB_OWNER" -E UTF8 -T template0 \
      --lc-collate="$OLD_COLL" --lc-ctype="$OLD_CTYPE" "$DB" 2>"$HOME/createdb_${STAMP}.err"; then
  echo "No se pudo crear con locale '$OLD_COLL'; se intenta con C.UTF-8..."
  run_pg createdb -O "$DB_OWNER" -E UTF8 -T template0 --locale=C.UTF-8 "$DB" \
    || die "No se pudo crear la base $DB. Revisa $HOME/createdb_${STAMP}.err"
fi

# ── 5. Restaurar ─────────────────────────────────────────────────────────────
echo "== Restaurando $DUMP (log: $LOG) =="
# El dump se pasa por stdin: lo abre ansanchez, no postgres (que puede no
# tener permiso de lectura sobre /home/ansanchez).
if [ "$DUMP_FORMAT" = "plain" ]; then
  if run_pg psql -v ON_ERROR_STOP=1 --single-transaction -d "$DB" < "$DUMP" >"$LOG" 2>&1; then
    RESTORE_RC=0
  else
    RESTORE_RC=1
  fi
else
  if run_pg "$PG_RESTORE_BIN" -d "$DB" --no-owner --no-privileges \
      --single-transaction --exit-on-error -v < "$DUMP" >"$LOG" 2>&1; then
    RESTORE_RC=0
  else
    RESTORE_RC=1
  fi
fi
if [ "$RESTORE_RC" -ne 0 ]; then
  echo "El restore falló. Últimas líneas del log:" >&2
  tail -30 "$LOG" >&2
  echo "Restaurando la base anterior..." >&2
  run_pg psql -d postgres -c "ALTER DATABASE \"$DB\" RENAME TO \"$FAILED_DB\";" >/dev/null 2>&1 || true
  run_pg psql -d postgres -c "ALTER DATABASE \"$OLD_DB\" RENAME TO \"$DB\";" >/dev/null 2>&1 || true
  die "No se restauró. La base anterior quedó de nuevo como '$DB' (respaldo: $BACKUP)."
fi

# ── 6. Verificación ──────────────────────────────────────────────────────────
echo "== Verificando =="
run_pg psql -d "$DB" -c "ANALYZE;" >/dev/null
echo "Conteos en la base nueva ($DB):"
run_pg psql -d "$DB" -At -F'|' -c \
  "SELECT 'Employee', count(*) FROM \"Employee\"
   UNION ALL SELECT 'USER_cuenta', count(*) FROM \"USER_cuenta\"
   UNION ALL SELECT 'django_migrations', count(*) FROM django_migrations;"
echo "Conteos en la base anterior ($OLD_DB):"
run_pg psql -d "$OLD_DB" -At -F'|' -c \
  "SELECT 'Employee', count(*) FROM \"Employee\"
   UNION ALL SELECT 'USER_cuenta', count(*) FROM \"USER_cuenta\"
   UNION ALL SELECT 'django_migrations', count(*) FROM django_migrations;" \
  2>/dev/null || echo "(no se pudieron leer los conteos de la base anterior)"

cat <<EOF

Restore completado.
  Respaldo previo: $BACKUP
  Base anterior:   $OLD_DB
  Log:             $LOG

Siguientes pasos:
  1) Levanta la aplicación para que el entrypoint aplique las migraciones pendientes:
       cd <directorio-del-proyecto> && docker compose up -d
     (el bootstrap/django corre "manage.py migrate": faltan core 0019, 0020 y 0021)
  2) Verifica salud:  curl -fsS http://127.0.0.1:8001/api/v1/health/
  3) Cuando todo esté OK, elimina la base anterior:
       sudo -u postgres dropdb "$OLD_DB"

Rollback manual:
  sudo -u postgres psql -d postgres -c 'ALTER DATABASE "$DB" RENAME TO "${DB}_descartada";'
  sudo -u postgres psql -d postgres -c 'ALTER DATABASE "$OLD_DB" RENAME TO "$DB";'

Si necesitas volver al respaldo .dump (se pasa por stdin por permisos):
  sudo -u postgres dropdb "$DB"
  sudo -u postgres createdb -O "$DB_OWNER" -T template0 "$DB"
  sudo -u postgres pg_restore -d "$DB" --no-owner --no-privileges < "$BACKUP"
EOF
