"""
Verificación de solo lectura del esquema y del estado de la base (preflight).

No modifica nada. Sirve para que el control de cambio sepa, antes de levantar
los contenedores, si el despliegue va a poder arrancar.

Uso:
    python manage.py verificar_esquema
    python manage.py verificar_esquema --json
    python manage.py verificar_esquema --estricto   # también falla por avisos

Códigos de salida:
    0  sin bloqueantes
    1  hay bloqueantes (o avisos con --estricto)
    2  no se pudo conectar
"""
import json
import sys

from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.exceptions import InconsistentMigrationHistory
from django.db.migrations.loader import MigrationLoader

SUPERADMIN = "30799436"

ROLES_ESPERADOS = (
    "ADMINISTRADOR",
    "ANALISTA",
    "AUTOGESTION",
    "PRESUPUESTO",
    "BIENESTAR SOCIAL",
    "RECEPCIONISTA",
    "ANALISTA_BIENESTAR",
    "ADMIN_BIENESTAR",
    "AUDITOR",
    "JEFE_RRHH",
)

OK = "OK"
AVISO = "AVISO"
BLOQUEA = "BLOQUEA"


def _normalizar_rol(nombre: str) -> str:
    return " ".join(str(nombre or "").strip().upper().replace("BIENSTAR", "BIENESTAR").split())


class Command(BaseCommand):
    help = "Verifica (solo lectura) el esquema legado y el estado de la base antes de desplegar."

    def add_arguments(self, parser):
        parser.add_argument(
            "--json",
            action="store_true",
            help="Emite el informe como JSON (para adjuntarlo al control de cambio).",
        )
        parser.add_argument(
            "--estricto",
            action="store_true",
            help="Trata los avisos como bloqueantes (usar después del despliegue).",
        )

    def handle(self, *args, **options):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception as exc:  # noqa: BLE001 - se reporta tal cual
            self.stderr.write(f"No se pudo conectar a la base: {exc}")
            sys.exit(2)

        resultados = []
        for comprobacion in (
            self._tablas_legadas,
            self._nacionalidad,
            self._columna_nacionalidad,
            self._columna_serial_carnet,
            self._columna_parentesco_aplica_familiar,
            self._password_larga,
            self._historial_migraciones,
            self._roles,
            self._nombres_visibles_roles,
            self._cuentas_sin_rol,
            self._superadmin,
            self._bootstrap,
            self._catalogos,
        ):
            try:
                resultados.extend(comprobacion())
            except Exception as exc:  # noqa: BLE001 - una comprobación no debe tumbar el informe
                resultados.append(
                    {
                        "estado": AVISO,
                        "nombre": comprobacion.__name__.lstrip("_").replace("_", " "),
                        "detalle": f"no se pudo comprobar: {exc}",
                    }
                )

        bloqueantes = [r for r in resultados if r["estado"] == BLOQUEA]
        avisos = [r for r in resultados if r["estado"] == AVISO]

        if options["json"]:
            self.stdout.write(
                json.dumps(
                    {
                        "base": connection.settings_dict.get("NAME"),
                        "host": connection.settings_dict.get("HOST"),
                        "resultados": resultados,
                        "bloqueantes": len(bloqueantes),
                        "avisos": len(avisos),
                        "apto": not bloqueantes and (not options["estricto"] or not avisos),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
        else:
            self._imprimir(resultados, bloqueantes, avisos, options["estricto"])

        if bloqueantes or (options["estricto"] and avisos):
            sys.exit(1)

    # ------------------------------------------------------------------
    # Comprobaciones
    # ------------------------------------------------------------------
    def _tablas_legadas(self):
        faltan = [
            tabla
            for tabla in ("Employee", "USER_cuenta")
            if self._regclass(tabla) is None
        ]
        if faltan:
            return [
                {
                    "estado": BLOQUEA,
                    "nombre": "Tablas legadas",
                    "detalle": f"no existen: {', '.join(faltan)} (la base no es la esperada)",
                }
            ]
        return [{"estado": OK, "nombre": "Tablas legadas", "detalle": "Employee y USER_cuenta existen"}]

    def _nacionalidad(self):
        existe = self._regclass("Nacionalidad") is not None
        return [
            {
                "estado": OK if existe else AVISO,
                "nombre": 'Tabla "Nacionalidad"',
                "detalle": "existe" if existe else "no existe (core.0008 la crea al arrancar)",
            }
        ]

    def _columna_nacionalidad(self):
        existe = self._existe_columna("Employee", "nacionalidadId")
        return [
            {
                "estado": OK if existe else AVISO,
                "nombre": "Employee.nacionalidadId",
                "detalle": "existe" if existe else "no existe (core.0008 la agrega al arrancar)",
            }
        ]

    def _columna_serial_carnet(self):
        existe = self._existe_columna("Employee", "carnet_patria_serial")
        return [
            {
                "estado": OK if existe else AVISO,
                "nombre": "Employee.carnet_patria_serial",
                "detalle": "existe" if existe else "no existe (core.0009 la agrega al migrar)",
            }
        ]

    def _columna_parentesco_aplica_familiar(self):
        existe = self._existe_columna("RAC_parentesco", "aplica_familiar")
        return [
            {
                "estado": OK if existe else AVISO,
                "nombre": "RAC_parentesco.aplica_familiar",
                "detalle": "existe" if existe else "no existe (core.0013 la agrega al migrar)",
            }
        ]

    def _password_larga(self):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT character_maximum_length
                  FROM information_schema.columns
                 WHERE table_name = 'USER_cuenta' AND column_name = 'password'
                """
            )
            fila = cursor.fetchone()
        largo = fila[0] if fila else None
        if largo is None:
            return [
                {
                    "estado": AVISO,
                    "nombre": "USER_cuenta.password",
                    "detalle": "no se encontró la columna (core.0008 la ajusta al arrancar)",
                }
            ]
        suficiente = largo >= 255
        return [
            {
                "estado": OK if suficiente else AVISO,
                "nombre": "USER_cuenta.password",
                "detalle": (
                    f"varchar({largo})"
                    if suficiente
                    else f"varchar({largo}); requiere 255 (core.0008 lo amplía al arrancar)"
                ),
            }
        ]

    def _historial_migraciones(self):
        try:
            loader = MigrationLoader(connection, ignore_no_migrations=True)
            loader.check_consistent_history(connection)
        except InconsistentMigrationHistory as exc:
            return [
                {
                    "estado": BLOQUEA,
                    "nombre": "Historial de migraciones",
                    "detalle": str(exc),
                }
            ]
        return [{"estado": OK, "nombre": "Historial de migraciones", "detalle": "consistente"}]

    def _roles(self):
        with connection.cursor() as cursor:
            cursor.execute('SELECT id, nombre_rol FROM "USER_rol"')
            filas = cursor.fetchall()
        existentes = {_normalizar_rol(nombre): rid for rid, nombre in filas}
        faltantes = [r for r in ROLES_ESPERADOS if r not in existentes]
        if faltantes:
            return [
                {
                    "estado": AVISO,
                    "nombre": "Roles esperados",
                    "detalle": f"faltan por nombre: {', '.join(faltantes)} (el seed los crea)",
                }
            ]
        return [{"estado": OK, "nombre": "Roles esperados", "detalle": f"{len(ROLES_ESPERADOS)} presentes"}]

    def _nombres_visibles_roles(self):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'USER_rol' AND column_name = 'nombre_visible'
                """
            )
            if cursor.fetchone() is None:
                return [
                    {
                        "estado": AVISO,
                        "nombre": "USER_rol.nombre_visible",
                        "detalle": "no existe (identidad.0011 la agrega al migrar)",
                    }
                ]
            cursor.execute(
                """SELECT count(*) FROM "USER_rol"
                    WHERE nombre_visible IS NULL OR btrim(nombre_visible) = ''"""
            )
            vacios = cursor.fetchone()[0]
        return [
            {
                "estado": OK if not vacios else AVISO,
                "nombre": "USER_rol.nombre_visible",
                "detalle": (
                    "todos los roles tienen nombre visible"
                    if not vacios
                    else f"{vacios} rol(es) sin nombre visible (se muestra el código hasta editarlos)"
                ),
            }
        ]

    def _cuentas_sin_rol(self):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT count(*)
                  FROM "USER_cuenta" c
                 WHERE c.rol_id IS NULL
                    OR NOT EXISTS (SELECT 1 FROM "USER_rol" r WHERE r.id = c.rol_id)
                """
            )
            total = cursor.fetchone()[0]
        if total:
            return [
                {
                    "estado": AVISO,
                    "nombre": "Cuentas con rol inválido",
                    "detalle": f"{total} cuentas requieren revisión (migrar_roles_legados las reporta)",
                }
            ]
        return [{"estado": OK, "nombre": "Cuentas con rol inválido", "detalle": "ninguna"}]

    def _superadmin(self):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.id, c.is_active, r.nombre_rol
                  FROM "USER_cuenta" c
                  JOIN "Employee" e ON e."cedulaIdentidad" = c.cedula
                  LEFT JOIN "USER_rol" r ON r.id = c.rol_id
                 WHERE e."cedulaIdentidad" = %s
                """,
                [SUPERADMIN],
            )
            fila = cursor.fetchone()
        if fila is None:
            return [
                {
                    "estado": AVISO,
                    "nombre": f"Superadmin {SUPERADMIN}",
                    "detalle": "no existe todavía (el bootstrap lo crea)",
                }
            ]
        activo = bool(fila[1])
        return [
            {
                "estado": OK if activo else BLOQUEA,
                "nombre": f"Superadmin {SUPERADMIN}",
                "detalle": f"rol {fila[2]}, {'activo' if activo else 'inactivo'}",
            }
        ]

    def _bootstrap(self):
        if self._regclass("core_bootstrap_state") is None:
            return [
                {
                    "estado": AVISO,
                    "nombre": "core_bootstrap_state",
                    "detalle": "no existe (primer despliegue)",
                }
            ]
        with connection.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM core_bootstrap_state WHERE clave = 'produccion'")
            total = cursor.fetchone()[0]
        return [
            {
                "estado": OK if total else AVISO,
                "nombre": "core_bootstrap_state",
                "detalle": "bootstrap aplicado" if total else "pendiente (lo aplica el arranque)",
            }
        ]

    def _catalogos(self):
        avisos = []
        with connection.cursor() as cursor:
            cursor.execute('SELECT count(*) FROM "Sexo"')
            if cursor.fetchone()[0] == 0:
                avisos.append("Sexo vacío")
            cursor.execute('SELECT count(*) FROM "TipoNomina" WHERE es_activo = true')
            if cursor.fetchone()[0] == 0:
                avisos.append("TipoNomina sin nóminas activas")
            cursor.execute('SELECT count(*) FROM "TipoNomina" WHERE es_activo = false')
            if cursor.fetchone()[0] == 0:
                avisos.append("TipoNomina sin nóminas pasivas")
        if avisos:
            return [
                {
                    "estado": AVISO,
                    "nombre": "Catálogos mínimos",
                    "detalle": "; ".join(avisos),
                }
            ]
        return [{"estado": OK, "nombre": "Catálogos mínimos", "detalle": "completos"}]

    # ------------------------------------------------------------------
    # Utilidades
    # ------------------------------------------------------------------
    def _regclass(self, tabla: str):
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass(%s)", [f'"{tabla}"'])
            return cursor.fetchone()[0]

    def _existe_columna(self, tabla: str, columna: str) -> bool:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                  FROM information_schema.columns
                 WHERE table_name = %s AND column_name = %s
                """,
                [tabla, columna],
            )
            return cursor.fetchone() is not None

    def _imprimir(self, resultados, bloqueantes, avisos, estricto):
        self.stdout.write("VERIFICACIÓN DE ESQUEMA (solo lectura)")
        self.stdout.write("-" * 64)
        for r in resultados:
            self.stdout.write(f"[{r['estado']:<8}] {r['nombre']:<28} {r['detalle']}")
        self.stdout.write("-" * 64)
        if bloqueantes:
            self.stdout.write(
                self.style.ERROR(f"{len(bloqueantes)} bloqueante(s). Despliegue NO apto todavía.")
            )
        elif estricto and avisos:
            self.stdout.write(
                self.style.WARNING(f"{len(avisos)} aviso(s) en modo estricto. Revisar antes de cerrar.")
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Sin bloqueantes. {len(avisos)} aviso(s) que el arranque corrige."
                )
            )
