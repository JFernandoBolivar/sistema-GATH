---
name: integracion-bd-recaudacion
description: Plantilla de integración de SOLO LECTURA con fuentes de datos legadas y bases ajenas en GATH — puerto de dominio, router por módulo espejo, modelos `managed=False`, `allow_migrate=False`, rol SQL restringido y degradación explícita a 503. El nombre de la skill es histórico: en GATH no existe ninguna base "RECAUDACION".
---

# Integración con fuentes legadas y bases ajenas (plantilla de solo lectura)

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado: Django **5.2.7**, DRF **3.16.1**, PostgreSQL **externo en servidor dedicado** (**D-03**, no está en `compose.yml`), Celery **5.5.x** con broker **RabbitMQ** (**D-02**, no Redis), caché/throttling con `DatabaseCache` sobre Postgres (**D-11**), tests con **pytest + pytest-django** (**D-12**). La librería de entorno instalada hoy es `python-decouple==3.8` (`BACKEND/requirements.txt:23`); **no** hay `django-environ` ni `dj-database-url`.
Decisiones que gobiernan esta skill: **D-09** (patrón Repository vinculante: una fuente ajena se consume por un puerto), **D-03**, **CRIT-03** (ningún secreto en git, ningún valor por defecto para credenciales), **CRIT-10 / B0.12** (los volcados SQL legados deben salir del repositorio y del historial).
Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de adaptaciones está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.1**, y el texto autoritativo del alcance nuevo en `PLAN_RECONSTRUCCION_ONION.md` **§I.4.6** ("Fuentes de datos legadas y bases ajenas").

> **El `name:` del frontmatter es histórico y no se cambia.** `integracion-bd-recaudacion` es el identificador con el que otras skills ya enlazan — aparece como `[[integracion-bd-recaudacion]]` en [[arquitectura-onion-feature-scream]] (tabla de convención de nombres y regla **R7**). **En GATH no existe ninguna base de datos "RECAUDACION"**: el alcance real de esta skill son las **fuentes legadas** de §I.4.6 y, en Fase 2, el sistema externo **SIGEP-Nómina**. Cuando leas "RECAUDACION" en documentación vieja o en `.opencode/skills/`, es material del proyecto de origen, no de GATH.

---

## Inventario verificado de fuentes legadas (comprobado en el repo, 21-08-2026)

| Fuente | Qué es de verdad | ¿Aplica el router? |
|---|---|---|
| `BACKEND/SAGP_CONATEL.sql` | **Volcado** PostgreSQL del sistema de personal previo de CONATEL. Está en `git ls-files` pero **ausente del árbol de trabajo**: borrarlo no lo saca del índice ni del historial (**CRIT-10**, tarea **B0.12** abierta). | Solo si se **restaura** en una instancia Postgres alcanzable. Un `.sql` en disco no es una conexión. |
| `BACKEND/SIGEP_MINISTERIO.sql` | **Volcado** PostgreSQL del sistema del ministerio. Mismo estado: en el índice de git, fuera del árbol (**CRIT-10 / B0.12**). | Igual que el anterior. |
| `migrar/*.xlsx` — `MIGRACION_TRABAJADORES`, `MIGRACION_FAMILIARES`, `FAMILIARES_UNIFICADO_3`, `ANALISIS_CODIGOS_ASIGTRABAJO_2`, `REPORTE_MIGRACION`, `REPORTE_FINAL_MIGRACION_GATH`, `NO_CARGADOS_JUSTIFICACION` | **Planillas Excel** (`Microsoft Excel 2007+`), no bases de datos. En la raíz hay dos más: `TRABAJADORES_UNIFICADO_ACTIVOS_PASIVOS.xlsx` y `PERSONAL QUE NO TIENEN TIPO DE NOMINA.xlsx`. | **No.** Ver "Cuándo NO usar esta plantilla". |
| `migrar/respaldos/NUEVABD-GATH_pre-migracion_20260818_154845.{sql,dump}` | Respaldo **de la propia base de GATH** antes de la migración (el `.dump` es formato custom de `pg_dump`, v1.16-0). No es una fuente ajena: es GATH. | **No.** Es material de recuperación, no de integración. |
| `SAGP - Sistema Automatizado de Gestión de Personal.md` (raíz) y `NextJS/ANALISIS_COMPLETO_SAGP.md` | **Documentación**, no datos. Ojo: el primero describe **el GATH actual** (Next.js 16.1.3 + Django 5.2.7 + Postgres 18), no un sistema legado distinto. | **No.** |
| **SIGEP-Nómina** (Fase 2) | Sistema de nóminas **externo y vivo** del organismo. Único consumidor futuro real de esta plantilla. | **Sí**, y solo en el escenario descartado (ver "Segundo consumidor"). |

**Ningún script del backend lee hoy `migrar/`** (verificado: los únicos management commands son `USER/management/commands/{importar_correos,crear_usuarios}.py` y `RAC/management/commands/{verificar_contratos,seed_estatus_contratos,cargar_codigos_postales}.py`). Es decir: **hoy no existe ninguna conexión legada configurada**. Esta skill es la plantilla para cuando exista, no la descripción de algo que ya corre.

`migrar/` es **de solo lectura**: no se modifica ni se versiona nada nuevo dentro de ella. Y `*.sql` nunca vuelve a git (**CRIT-10**).

---

## Regla número uno: la fuente es ajena y opcional

Todo el diseño gira en torno a una premisa: **si la variable de entorno de la fuente legada no está configurada, el resto del sistema sigue funcionando con normalidad**, y solo las funciones que dependen de ella degradan a **503**. No rompas esta garantía al tocar este código.

La señal de "no disponible" es la **ausencia del alias en `DATABASES`**, no un `try/except` de conexión fallida en el arranque.

---

## Cuándo NO usar esta plantilla

Un router de base de datos no aplica a un archivo. Para las planillas `.xlsx` del inventario:

- **No** hay alias, **no** hay router, **no** hay modelos espejo.
- Entran por el puerto `FileStorage` de `core/domain/ports.py` y se procesan en un caso de uso de carga masiva (`cargar_personal_masivo`), encolado por el puerto `TaskQueue` (**B20**) dentro de `transaction.on_commit()` (**B22**), con la tarea recibiendo **solo IDs primitivos** y nunca el Excel completo (**B23**).
- La escritura pasa **por el mismo caso de uso** que usa la vista sincrónica: no hay una ruta de escritura paralela para la migración.

Para un volcado `.sql` que se restaura **una sola vez** y nunca más se consulta, tampoco: eso es un script de migración puntual, no una integración. La plantilla es para leer una fuente ajena **desde la aplicación, de forma recurrente**.

---

## Configuración de la conexión (`config/settings.py`)

> El paquete de settings hoy se llama `SIGEP/` (`BACKEND/SIGEP/settings.py`). El plan lo referencia como `config/`; lee `config/` como "el paquete de settings del proyecto" mientras no se ejecute el renombrado.

```python
from decouple import config

LEGADO_SAGP_ALIAS = 'legado_sagp'
_legado_sagp_host = config('LEGADO_SAGP_DB_HOST', default='')   # vacío = fuente no configurada

if _legado_sagp_host:
    DATABASES[LEGADO_SAGP_ALIAS] = {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('LEGADO_SAGP_DB_NAME'),          # sin default (CRIT-03)
        'USER': config('LEGADO_SAGP_DB_USER'),          # el rol de solo lectura: gath_ro
        'PASSWORD': config('LEGADO_SAGP_DB_PASSWORD'),  # sin default, jamás en git (CRIT-03)
        'HOST': _legado_sagp_host,
        'PORT': config('LEGADO_SAGP_DB_PORT', default='5432'),
        'CONN_MAX_AGE': 0,                              # base ajena: sin conexiones persistentes
        'OPTIONS': {
            'connect_timeout': 5,
            'sslmode': config('LEGADO_SAGP_DB_SSLMODE', default='require'),
        },
    }

DATABASE_ROUTERS = ['config.routers.LegadoRouter']
```

El único valor con `default` admisible es el **gate** (`LEGADO_SAGP_DB_HOST`, default `''`) y los no sensibles (`PORT`, `SSLMODE`). Credenciales sin `default`: si falta, `config()` revienta al arrancar, que es exactamente lo que se quiere (**CRIT-03**). Nada de `default='admin'` como el que hoy arrastra `DATABASES['default']` en `BACKEND/SIGEP/settings.py:112-120`.

`connect_timeout`, `sslmode=require` y la prohibición de valores por defecto son, además, lo que **§I.4.6 ya manda aplicar a la conexión propia de D-03**.

**Nombres:** el rol Postgres de solo lectura de GATH es **`gath_ro`** (o `gath_ro_sagp` si hay varias fuentes con permisos distintos), con **`CONNECT` + `USAGE` + `SELECT` sobre las tablas concretas y nada más**. Documenta el rol requerido en `.env.example` **sin credenciales reales**. Nunca pidas más permisos que esos: el diseño depende de que la restricción de solo lectura la imponga **la base**, no el código Django.

---

## Router — `config/routers.py` (completo)

```python
from django.conf import settings


class LegadoRouter:
    """Enruta los modelos espejo de cada fuente legada a su alias de solo lectura.

    Un modelo pertenece a una fuente por su MÓDULO DE ORIGEN, no por `app_label`
    ni por `Meta.managed`. Los valores del mapa son NOMBRES de settings, no los
    alias: así el router no lee settings en tiempo de importación.
    """

    MODULOS_ESPEJO = {
        'apps.personal.infrastructure.legado.sagp_models': 'LEGADO_SAGP_ALIAS',
        # una entrada por fuente: módulo espejo → nombre del setting con su alias
    }

    def _alias_de(self, model) -> str | None:
        setting = self.MODULOS_ESPEJO.get(getattr(model, '__module__', ''))
        return getattr(settings, setting) if setting else None

    def _aliases_legados(self) -> set[str]:
        return {getattr(settings, s) for s in self.MODULOS_ESPEJO.values()}

    def db_for_read(self, model, **hints):
        return self._alias_de(model)

    def db_for_write(self, model, **hints):
        # Devuelve el mismo alias a propósito: es el rol `gath_ro` de Postgres quien
        # rechaza la escritura, no el router. La restricción la impone la base.
        return self._alias_de(model)

    def allow_relation(self, obj1, obj2, **hints):
        uno, dos = self._alias_de(type(obj1)), self._alias_de(type(obj2))
        if uno or dos:
            return uno is not None and uno == dos   # solo entre espejos de la MISMA fuente
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if db in self._aliases_legados():
            return False
        model = hints.get('model')
        if model is not None and self._alias_de(model) is not None:
            return False
        return None
```

`allow_migrate` devuelve **siempre `False`** para estas conexiones y para estos modelos: **nunca correrás `migrate` contra una fuente legada**, ni intencionalmente ni por accidente. Esto es la mitad de la regla **R7** de [[arquitectura-onion-feature-scream]] (*"todo modelo espejo debe declarar `managed = False` y quedar excluido de `allow_migrate` en su router"*); la otra mitad está en la sección siguiente.

**Una fuente nueva = un módulo espejo nuevo + una entrada nueva en `MODULOS_ESPEJO`.** Si el módulo no está en el mapa, el router lo ignora y sus consultas irán a `default` — que es la falla silenciosa más peligrosa de este patrón. Los modelos de una misma fuente van todos **en su único módulo**: no los reparta.

---

## Modelos espejo — `apps/[modulo]/infrastructure/legado/[fuente]_models.py`

Ruta canónica según la tabla de nombres de [[arquitectura-onion-feature-scream]]. Todos con `managed = False` y **espejo mínimo**: solo las columnas que el adaptador realmente usa. No repliques el esquema completo de la tabla real "por si acaso".

```python
# apps/personal/infrastructure/legado/sagp_models.py
class ExpedienteSAGP(models.Model):
    # PK y columnas reales de la fuente; los nombres se toman del volcado, no se inventan
    id_expediente = models.IntegerField(primary_key=True, db_column='...')
    cedula = models.TextField(db_column='...')

    class Meta:
        managed = False            # ← R7, no negociable
        db_table = '...'           # nombre exacto de la tabla en la fuente legada
```

Reglas de convivencia con las migraciones:

- Se re-exportan desde `apps/[modulo]/models.py` como el resto de los modelos (**B26**), para que Django resuelva el `app_label` por convención.
- Un modelo `managed = False` genera una migración **de estado**: verifica con `python manage.py sqlmigrate <app> <n>` que **no emite SQL** (vacío o solo comentarios), con la misma disciplina de §I.4.7. Si emite `CREATE TABLE`, algo está mal declarado y no se aplica.
- **Pendiente de comprobar en el módulo piloto**: el inventario de tablas y columnas de `SAGP_CONATEL.sql` / `SIGEP_MINISTERIO.sql` **no es auditable desde el repo hoy** (los volcados están fuera del árbol de trabajo). No inventes `db_table` ni nombres de columna: pídelos, o léelos del volcado restaurado.

**No uses el ORM para un JOIN entre bases distintas** — es imposible en Django/SQL. Un JOIN que cruza el alias legado y `default` se hace con dos consultas o con SQL crudo vía `connections[alias].cursor()` **dentro del adaptador**.

---

## El puerto y su adaptador (D-09) — dónde vive cada cosa

El caso de uso **no sabe** que hay una base ajena detrás. Eso es lo que exige **D-09**, y es la diferencia estructural más grande respecto a la versión heredada de esta skill.

```python
# apps/personal/domain/ports/fuente_sagp.py — sin Django, sin SQL
class FuenteSAGP(Protocol):
    def disponible(self) -> bool: ...
    def buscar_expediente(self, cedula: Cedula) -> ExpedienteLegado | None: ...


# apps/personal/application/use_cases/consultar_expediente_legado.py — sin Django, sin SQL
def consultar_expediente_legado(fuente: FuenteSAGP, cedula: Cedula) -> ExpedienteLegado:
    if not fuente.disponible():
        raise FuenteLegadaNoDisponible('La fuente legada SAGP no está configurada.')
    expediente = fuente.buscar_expediente(cedula)
    if expediente is None:
        raise NotFoundError('No hay expediente legado para esa cédula.')
    return expediente


# apps/personal/infrastructure/legado/fuente_sagp_sql.py — aquí sí viven Django y el SQL crudo
class FuenteSAGPSQL:
    def disponible(self) -> bool:
        return settings.LEGADO_SAGP_ALIAS in settings.DATABASES   # la ausencia del alias ES la señal

    def buscar_expediente(self, cedula: Cedula) -> ExpedienteLegado | None:
        try:
            with connections[settings.LEGADO_SAGP_ALIAS].cursor() as cursor:
                cursor.execute(_SQL_POR_CEDULA, [cedula.valor])
                fila = cursor.fetchone()
        except DatabaseError as exc:
            raise FuenteLegadaNoDisponible(f'No se pudo consultar SAGP: {exc}') from exc
        return mapper_expediente.a_entidad(fila) if fila else None
```

El adaptador es el **único** lugar que conoce el SQL, el alias y el formato de los datos viejos. Sustituirlo por un doble en memoria no cambia una línea del caso de uso.

**Copiar lo mínimo.** Una consulta on-demand a la fuente legada es preferible a duplicar sus datos en la base de GATH: copiar todo genera desincronización sin necesidad. Persiste en la base propia solo lo que el negocio necesita conservar (por ejemplo un estado resumido y un `consultado_at`), no el registro completo.

**Esta plantilla no decide nada.** Un adaptador de fuente legada **informa** lo que ve; no aprueba, no rechaza, no concilia por su cuenta. Las decisiones administrativas las toma un funcionario por un endpoint explícito. No conviertas una consulta en una acción automática sin que el usuario lo pida.

---

## Degradación a 503 — por el exception handler, no por la vista

```python
# core/domain/exceptions.py
class FuenteLegadaNoDisponible(DomainError):
    """La fuente legada no está configurada o no responde."""
```

`FuenteLegadaNoDisponible` se lanza en dos puntos: cuando `disponible()` es `False`, o cuando `connections[alias]` lanza `DatabaseError` (conexión caída, `connect_timeout` de 5 s agotado, credenciales revocadas).

La traducción a HTTP ocurre **una sola vez**, en `core/presentation/exception_handler.py` (**B10**, tarea **B2.4**), que además vuelca el error en `errors_backend.txt` con su `trace_id` y responde con el sobre único **C-1** (`{status, message, data}`). La vista **no** trae `try/except` ni `Response(` crudo (**B9**):

```python
class ExpedienteLegadoView(views.APIView):
    permission_classes = [IsAuthenticated, HasPermission('personal.consultar_legado')]

    def get(self, request, cedula):
        expediente = consultar_expediente_legado(FuenteSAGPSQL(), Cedula(cedula))
        return ok(ExpedienteLegadoSerializer(expediente).data, 'Expediente legado.')
```

Añadir una excepción de dominio nueva significa **una entrada en el mapa del handler**, no un `except` en cada vista. El resto de la aplicación (auth, personal, cargos, reportes) no depende de esta conexión y sigue operando con normalidad si la fuente legada cae.

---

## Cédula: normalizar en la frontera

En GATH el identificador de las personas es la **cédula**, y ya existe el Value Object `Cedula` en `core/domain/value_objects/` (ver [[arquitectura-onion-feature-scream]]), que valida su invariante en el constructor.

Discrepancia **verificada** entre el formato canónico y el almacenado: el VO `Cedula` exige la forma `[VE]-\d{6,9}` (p. ej. `V-12345678`), mientras que la columna del backend legado es `cedulaidentidad = models.TextField(db_column='cedulaIdentidad', unique=True)` (`BACKEND/RAC/models/personal_models.py:477`) — **texto libre, sin ningún formato impuesto por la base**, y referenciada además por FK con `to_field='cedulaidentidad'`.

Consecuencia práctica: **la conversión al VO se hace en el mapper del adaptador**, nunca en el caso de uso, y el `WHERE` contra la fuente legada se construye con el formato **de la fuente**, no con el canónico de GATH.

> **Pendiente de verificación**: qué formas concretas de cédula almacenan `SAGP_CONATEL.sql` y `SIGEP_MINISTERIO.sql` (con o sin prefijo, con o sin guion, con puntos de millar) no se puede auditar desde el repo hoy. Audítalo sobre el volcado restaurado **antes** de escribir la consulta: un formato distinto es la causa más probable de un falso "no encontrado".

*(La versión heredada de esta skill traía en este lugar una regla de normalización de **RIF** entre dos sistemas del proyecto de origen, con funciones `rif_canonico()` / `rif_presentable()`. **No aplica a GATH**: aquí no se integra ningún registro de contribuyentes y el identificador es la cédula. Esa regla queda eliminada, no traducida.)*

---

## Segundo consumidor: SIGEP-Nómina (Fase 2)

`FASE2_PROPUESTA_TECNICA.md` **§4.7** añade el módulo `apps/sincronizacion` con patrón **outbox**: el evento se inserta en `OutboxSincronizacion` **en el mismo `COMMIT`** que el cambio de negocio, y un worker Celery en la cola `sync` (`acks_late`, `prefetch=1`, idempotencia por `clave_evento`, **§12.6**) lo despacha con reintento exponencial. El outbox no depende del broker para no perder eventos.

Cuatro puntos que esta skill tiene que dejar claros:

1. **El canal de entrega está pendiente de decisión (DEC-1 / DEC-2).** Opciones: **A)** API de SIGEP-Nómina idempotente *(recomendada)*; **B)** esquema de staging propiedad de GATH dentro de la base de SIGEP; **C)** archivo de intercambio firmado con acuse; **D)** `INSERT`/`UPDATE` directo en las tablas de SIGEP-Nómina. **DEC-2** (¿existe API o documentación del esquema? ¿quién es el contacto?) es prerrequisito del mapeo de catálogos.
2. **La opción D está descartada** salvo que el organismo la exija **y la responsabilidad quede asumida por escrito**: significa asumir un esquema ajeno sin contrato, saltarse sus validaciones y romper la nómina el día que cambien una columna. Solo en ese escenario aplica **esta plantilla completa** — alias propio, `CONN_MAX_AGE = 0`, `connect_timeout = 5`, espejos `managed = False` con solo las columnas usadas, router por módulo y usuario SQL acotado a esas tablas.
3. **Colisión de nombres (O-8).** La base local de GATH **se llama hoy `SIGEP`** (`DJANGO_DB_NAME`, default `SIGEP`, `BACKEND/SIGEP/settings.py:112-120`) y el paquete de settings también. El sistema de nóminas externo **también** se llama SIGEP. **DEC-12** propone renombrar la base local a **`gath_db`**, *"sí, antes de que existan dos conexiones"*. Si vas a describir o configurar el caso de dos conexiones, esa decisión va primero: dos aliases indistinguibles por nombre son un incidente esperando ocurrir.
4. Convención al declararla: alias `sigep_nomina`, gate `SIGEP_NOMINA_DB_HOST`, rol `gath_ro_sigep`, módulo espejo `apps/sincronizacion/infrastructure/legado/sigep_nomina_models.py`, más su entrada en `MODULOS_ESPEJO`.

---

## Tests (D-12)

Los tests **nunca tocan la fuente real ni abren la conexión legada**. Con el puerto de **D-09** no hace falta mockear nada por parche: se **inyecta** un doble.

- Caso de uso: se prueba con un `FuenteSAGPMemoria` que implementa el puerto — sin Django, sin PostgreSQL. Es lo que hace alcanzable la cobertura ≥ 80 %.
- Doble que devuelve `disponible() → False` (o que lanza `FuenteLegadaNoDisponible`): verifica que el caso de uso propaga la excepción y que la vista responde **503** con el sobre **C-1**. Es el equivalente en GATH del viejo `test_fuente_caida_devuelve_503`, y es un test **obligatorio** por cada endpoint que dependa de una fuente legada.
- Un test de que, sin la variable de entorno configurada, el resto de la API sigue respondiendo 200.

Ver [[testing-backend-django]] para las convenciones; recuerda que en GATH la herramienta es **pytest + pytest-django** (**D-12**).

---

### ⚠️ Reglas anuladas respecto a la versión heredada

**1. La vista ya no traduce el error a 503.** La versión original repetía en cada vista:

```python
try:
    resultado = HabilitacionService.consultar(rif)
except RecaudacionNoDisponible as exc:
    return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
```

**Anulado en GATH.** Viola **B9** (toda respuesta sale por `core/presentation/envelope.py`), **B10** (las excepciones de dominio se traducen en `core/presentation/exception_handler.py`, nunca en la vista) y el sobre único **C-1**. La excepción es `FuenteLegadaNoDisponible`, y el 503 lo emite el handler.

**2. El servicio con `staticmethod`s en `application/` que ejecuta SQL queda anulado.** La versión heredada ponía la consulta cruda dentro de un `HabilitacionService` en la capa de aplicación. Eso choca de frente con **D-09** y con la regla **R5** de [[arquitectura-onion-feature-scream]]: un caso de uso no ejecuta `connections[...].cursor()` ni conoce un alias de base. El contrato va en `domain/ports/`, la implementación en `infrastructure/legado/`, y el caso de uso recibe el puerto **por inyección**.

**3. El router ya no reconoce un único módulo espejo fijo.** La versión heredada identificaba los modelos por igualdad exacta con **un** módulo (`MODULO_ESPEJO`) y advertía "no crees un módulo espejo nuevo, el router no lo reconocería". En GATH hay potencialmente **varias** fuentes en **varios** módulos de dominio, así que el router usa un **mapa** módulo→alias. La advertencia cambia de forma: crear el módulo está bien; **olvidar registrarlo en `MODULOS_ESPEJO`** es lo que rompe (las consultas se irían a `default` en silencio).

**4. Todo lo que nombraba al proyecto de origen desaparece, no se traduce.** No hay base "RECAUDACION", ni rol `fitelven_ro`, ni `RECAUDACION_DATABASE_URL`, ni servicio de habilitación de operadores, ni normalización de RIF, ni los archivos `sql/habilitacion_recaudacion.sql` / `sql/geo_desde_censo.sh`. Nada de eso existe en GATH. Lo que se conserva es **la plantilla técnica**: alias opcional, `CONN_MAX_AGE = 0`, `connect_timeout`, espejo mínimo `managed = False`, router con `allow_migrate = False`, rol SQL de solo lectura y degradación explícita.

---

## Comandos

### 1. Conectar una fuente legada nueva

```
@skill conecta la fuente legada [x] al módulo [modulo]
```

1. **Confirma que es una base**, no un `.xlsx` ni un volcado de un solo uso. Si es un archivo, esta plantilla no aplica (ver "Cuándo NO usar esta plantilla").
2. Declara el alias en `config/settings.py` **gateado por su variable de entorno**, sin defaults para credenciales (**CRIT-03**), con `CONN_MAX_AGE = 0`, `connect_timeout = 5` y `sslmode`.
3. Pide al DBA el rol de solo lectura (`gath_ro...`) con `CONNECT` + `USAGE` + `SELECT` **sobre las tablas concretas**. Documenta el rol en `.env.example`, sin valores reales. No asumas que un rol existente ya tiene `SELECT` sobre una tabla nueva: pídelo explícitamente.
4. Crea el módulo espejo en `apps/[modulo]/infrastructure/legado/[fuente]_models.py` con `managed = False` y solo las columnas que vas a usar; re-expórtalo en `models.py` (**B26**) y regístralo en `MODULOS_ESPEJO` (**R7**).
5. Declara el puerto en `apps/[modulo]/domain/ports/fuente_[x].py` e impleméntalo en `infrastructure/legado/fuente_[x]_sql.py` (**D-09**). Los JOIN entre bases, con SQL crudo dentro del adaptador.
6. Envuelve toda consulta en `try/except DatabaseError → FuenteLegadaNoDisponible`, y registra la excepción en `core/presentation/exception_handler.py` → **503** (**B10**).
7. Verifica con `manage.py sqlmigrate` que la migración de los espejos **no emite SQL**, y con `migrate --plan` que no hay operaciones reales contra el alias legado.
8. Escribe en el mismo commit el test de caso de uso con doble en memoria y el test de 503 con la fuente caída (**D-12**).
9. Techo de **400 líneas** por archivo (**B13**): un módulo espejo que crezca se divide por entidad.

### 2. Diagnosticar un 503 de una fuente legada

```
@skill por qué falla la consulta a la fuente legada
```

Verifica en orden: ¿el gate (`LEGADO_*_DB_HOST`) está seteado en el entorno del proceso? ¿el alias aparece en `settings.DATABASES`? ¿el módulo espejo está registrado en `MODULOS_ESPEJO` — o las consultas están yéndose a `default` en silencio? ¿el rol `gath_ro...` sigue teniendo `SELECT` sobre las tablas que usa la consulta? ¿la cédula se está pasando en el formato **de la fuente** y no en el canónico de GATH? ¿los 5 s de `connect_timeout` alcanzan para la latencia real hacia esa base?
