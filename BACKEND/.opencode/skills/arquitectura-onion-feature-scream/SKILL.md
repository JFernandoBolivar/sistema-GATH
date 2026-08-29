---
name: arquitectura-onion-feature-scream
description: Arquitectura Onion + Feature-Based + Scream del backend Django de GATH (apps/{domain,application,infrastructure,presentation}). Explica capas, reglas de dependencia, convención de nombres, patrón Repository obligatorio y dónde crear cada tipo de código nuevo.
---

# Arquitecto Onion-Feature-Scream (Backend)

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado: Django **5.2.7**, DRF **3.16.1**, `simplejwt` **5.5.1**, PostgreSQL **externo en servidor dedicado** (D-03, no está en `compose.yml`), Celery **5.5.x** con broker RabbitMQ (D-02).
Decisiones que gobiernan esta skill: **D-09** (patrón Repository vinculante), **D-06** (`/api/v1/` con coexistencia), **D-04** (auditoría dual DB + TXT), **D-11** (`DatabaseCache` en Postgres).
Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de adaptaciones está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.1** (arquitectura objetivo en §I.4.1, reglas B1–B26 en Apéndice A).

---

Skill para trabajar con la arquitectura del backend Django de GATH, basada en Scream + Feature-Based + Onion — la misma familia de patrones que usa el frontend (`NextJS/.opencode/skills/arquitecto-scream-feature-onion`), adaptada a Django.

---

## Visión general

`apps/` grita el dominio del negocio, no la tecnología: `identidad`, `organizacion`, `catalogos`, `personal`, `cargos`, `familiares`, `movimientos`, `reportes`, `carnetizacion`, `autogestion`. No hay carpetas `models/`, `views/`, `serializers/` a nivel raíz — cada dominio de negocio es un módulo de primer nivel con sus cuatro capas completas.

Dentro de cada módulo, las capas van de adentro hacia afuera (Onion):

```
domain → application → infrastructure → presentation
```

**Estado de partida — no lo ignores al crear código nuevo:** el backend legado (`RAC/`, `USER/`, `CARNETIZACION/`, `AUTOGESTION/`) **no tiene** esta arquitectura: son ~101 archivos `.py` con vistas de hasta 3.174 líneas (`RAC/views/personal_activo_views.py`) y 135 `@api_view` sueltos. La arquitectura de esta skill se **construye**, módulo por módulo, por estrangulamiento (fases B2–B4 del plan), manteniendo vivas las rutas legadas hasta el cierre de cada sub-fase. No asumas que ya existe la estructura que aquí se describe: verifícalo antes de importar de ella.

Lo transversal vive en `core/` (kernel compartido), **nunca** en un módulo de dominio. Antes de añadir un caso de uso nuevo en `apps/[modulo]/application/`, pregúntate si en realidad pertenece a `core/` porque lo van a necesitar otros módulos (regla **B16**: un módulo nunca importa directamente de otro módulo hermano).

**El patrón Repository es obligatorio** (decisión **D-09**): todo acceso a datos desde un caso de uso pasa por un puerto declarado en `domain/ports/` e implementado en `infrastructure/repositories/`. Ver la sección "Patrón Repository" más abajo.

---

## Estructura canónica por módulo (`apps/[modulo]/`)

```
apps/[modulo]/
├── domain/                               ← Núcleo puro (sin Django ni DRF)
│   ├── entities/
│   │   └── [entidad].py                  (dataclass inmutable)
│   ├── value_objects/
│   │   └── [vo].py                       (validación en construcción)
│   └── ports/
│       ├── repo_[entidad].py             (Protocol / ABC del repositorio)
│       └── [servicio_externo].py         (Protocol de I/O)
│
├── application/                          ← Orquestación y reglas de negocio
│   ├── dtos/
│   │   └── [accion]_dto.py               (dataclasses de entrada/salida)
│   └── use_cases/
│       └── [accion]_[entidad].py         (función o clase pura que recibe el repo)
│
├── infrastructure/                       ← Adaptadores tecnológicos
│   ├── models/
│   │   └── [entidad]_model.py            (modelos ORM Django)
│   ├── mappers/
│   │   └── mapper_[entidad].py           (convierte ORM ↔ Entity)
│   ├── repositories/
│   │   └── repo_[entidad]_orm.py         (implementa el puerto de domain)
│   ├── serializers/
│   │   ├── [entidad]_lectura_serializers.py
│   │   └── [entidad]_escritura_serializers.py
│   └── tasks/
│       └── [accion]_tasks.py             (Celery shared_tasks que reciben solo IDs)
│
├── presentation/                         ← Capa de entrega DRF
│   ├── views/
│   │   └── [entidad]_views.py            (APIView / generics delgadas)
│   ├── filters/
│   │   └── [entidad]_filters.py          (SearchFilter / DjangoFilter)
│   ├── permissions/
│   │   └── [modulo]_permissions.py       (bindings de HasPermission)
│   └── urls.py                           (urlpatterns con prefijo /api/v1/)
│
├── models.py                             ← Re-exporta infrastructure/models/
└── apps.py                               ← AppConfig con registro de receivers
```

El kernel `core/` replica la misma división: `core/domain/` (entidad base, Value Objects transversales `Cedula`/`Email`/`Telefono`, jerarquía `DomainError`, `core/domain/ports.py` con `Repository`, `UnitOfWork`, `FileStorage`, `TaskQueue`, `AuditLogger`, `ReportGenerator`), `core/infrastructure/` (adaptadores: almacenamiento, logging, modelos `Archivo` y `AuditoriaLog`) y `core/presentation/` (`envelope.py`, `exception_handler.py`, `permissions.py`, `cookies.py`, `audit.py`).

### `models.py` en la raíz de cada módulo

`apps/[modulo]/models.py` re-exporta lo que hay en `infrastructure/models/`. Es un truco necesario: Django descubre modelos por convención en `<app>.models`, y así los modelos ORM se mantienen dentro de la capa que les corresponde (sin acoplarse a que Django los busque en un path específico) sin romper esa convención. **Toda app nueva replica este patrón** (regla **B26**), junto con su `AppConfig`.

---

## Capas y dependencias (Onion) — reglas vinculantes

La flecha significa "depende de" → **siempre apunta hacia adentro**.

| Capa | Puede importar de | Regla que lo verifica |
|---|---|---|
| `domain/` | Solo otros módulos de `domain/` (propio o `core.domain`). Sin Django, sin DRF, sin ORM, sin Celery, sin librerías de I/O | **B1** (`import-linter`, contrato `dominio-puro`) |
| `application/` | `domain/` (propio o de `core`) y otros servicios de aplicación. **Nunca** `models` ni Celery | **B2**, **B4**, **B20** |
| `infrastructure/` | `application/` y `domain/`. **No** importa de `presentation/` | **B3** |
| `presentation/` | `application/use_cases/*`, DTOs y serializers. **Prohibido tocar el ORM**: las vistas no ejecutan `.objects.`, solo invocan casos de uso | **B7** (grep `objects.` en `presentation/`) |
| entre módulos | **Prohibido.** Un módulo nunca importa de un módulo hermano; lo transversal reside en `core/` | **B16** (`import-linter`, contrato `independencia-modulos`) |

Reglas complementarias que se verifican en el mismo barrido: **B9** (toda respuesta HTTP sale por `core/presentation/envelope.py`), **B10** (las excepciones de dominio se traducen a HTTP en `core/presentation/exception_handler.py`, nunca en la vista), **B13** (techo estricto de 400 líneas por archivo), **B17** (prohibidas carpetas genéricas `utils/` o `services/` desestructuradas).

### Patrón Repository (D-09) — obligatorio

Todo caso de uso recibe sus repositorios **por inyección** y depende únicamente del puerto:

```python
# domain/ports/repo_empleado.py — sin Django
from typing import Protocol
from ..entities.empleado import Empleado

class RepoEmpleado(Protocol):
    def obtener_por_cedula(self, cedula: str) -> Empleado | None: ...
    def guardar(self, empleado: Empleado) -> Empleado: ...

# application/use_cases/actualizar_datos_empleado.py — sin Django
def actualizar_datos_empleado(repo: RepoEmpleado, dto: ActualizarEmpleadoDTO) -> Empleado:
    empleado = repo.obtener_por_cedula(dto.cedula)
    if empleado is None:
        raise NotFoundError('Empleado no encontrado.')
    return repo.guardar(empleado.con_datos(dto))

# infrastructure/repositories/repo_empleado_orm.py — aquí sí vive Django
class RepoEmpleadoORM:
    def obtener_por_cedula(self, cedula: str) -> Empleado | None:
        fila = EmpleadoModel.objects.filter(cedulaidentidad=cedula).first()
        return mapper_empleado.a_entidad(fila) if fila else None
```

El beneficio que justifica la decisión: el 100% de las reglas de negocio se prueba con un repositorio en memoria (`RepoEmpleadoMemoria`), **sin tocar PostgreSQL ni inicializar Django** — es lo que hace alcanzable la meta de cobertura ≥ 80% (ver [[testing-backend-django]]).

### Patrón domain → infrastructure: eventos + signals + Celery

No se llama `.delay()` directo desde las vistas. El flujo estándar es:

```
application/use_cases/xxx.py
  → events.evento_x.send(sender=CasoDeUso, **kwargs)     Django Signal (domain/events.py)
    ↓
infrastructure/receivers.py
  → @receiver(events.evento_x)
    def despachar_algo(sender, **kwargs):
        Notificacion.objects.create(...)                    # side-effect in-app síncrono
        transaction.on_commit(lambda: tasks.algo.delay(...)) # Celery solo tras commit
```

`transaction.on_commit()` es obligatorio (regla **B22**) para que el worker de Celery nunca vea datos sin confirmar. Las tareas reciben solo IDs primitivos y toleran `DoesNotExist` (**B23**).

Los receivers se conectan en `AppConfig.ready()`:

```python
class PersonalConfig(AppConfig):
    def ready(self):
        import apps.personal.infrastructure.receivers  # noqa: F401
```

Ver [[uso-librerias-backend]] para el detalle de Celery/RabbitMQ y de las tasks.

---

## Nombre de la capa de infraestructura: `infrastructure`, sin excepción

`infrastructure` es la **única** grafía válida, en los 10 módulos de dominio y en `core/`. La variante con "e" extra que aparecía en el proyecto de origen era un typo histórico y **no se replica en GATH**: el nombre de esta carpeta se crea desde cero en cada módulo, así que no hay nada heredado que respetar. Si encuentras la grafía errónea en código o en documentación, es un defecto a corregir, no una convención a seguir.

---

## Convención de nombres (con ejemplos del dominio GATH)

| Elemento | Archivo | Clase/función | Ejemplo |
|---|---|---|---|
| Entidad de dominio | `domain/entities/[entidad].py` | `@dataclass(frozen=True) class Nombre` | `Empleado`, `Cargo`, `Familiar` |
| Value Object | `domain/value_objects/[vo].py` | `@dataclass(frozen=True) class Xxx` con validación en `__post_init__` | `Cedula`, `Email`, `Telefono` |
| Modelo ORM | `infrastructure/models/[entidad]_model.py` | `class Nombre(BaseModel)` | `EmpleadoModel`, `CargoModel` |
| Modelo base abstracto | `core/infrastructure/models/base.py` | `class BaseModel(models.Model)` | UUID v7 + `created_at`/`updated_at`, `abstract = True` |
| Choices internos | dentro del modelo | `class Estatus(models.TextChoices)` | `EmpleadoModel.Estatus`, `Movimiento.Tipo` |
| Lógica pura de dominio (sin ORM) | `domain/services/[tema].py` | funciones sueltas, snake_case | `tiempo_servicio.py::calcular_total_apn()` |
| Eventos | `domain/events.py` | `nombre_evento = django.dispatch.Signal()` | `empleado_egresado`, `carnet_emitido` |
| Puerto de repositorio | `domain/ports/repo_[entidad].py` | `class RepoXxx(Protocol)` | `RepoEmpleado`, `RepoCargo` |
| DTO | `application/dtos/[accion]_dto.py` | `@dataclass(frozen=True) class XxxDTO` | `ActualizarEmpleadoDTO` |
| Caso de uso | `application/use_cases/[accion]_[entidad].py` | función o clase pura que **recibe** el repo | `actualizar_datos_empleado`, `egresar_empleado` |
| Excepciones de dominio | `core/domain/exceptions.py` (transversales) o `domain/exceptions.py` (propias) | `class XxxError(DomainError)` | `NotFoundError`, `ConflictError`, `FuenteLegadaNoDisponible` |
| Mapper ORM ↔ entidad | `infrastructure/mappers/mapper_[entidad].py` | funciones `a_entidad()` / `a_modelo()` | `mapper_empleado` |
| Repositorio ORM | `infrastructure/repositories/repo_[entidad]_orm.py` | `class RepoXxxORM` (implementa el puerto) | `RepoEmpleadoORM` |
| Tarea async | `infrastructure/tasks/[accion]_tasks.py` | `@shared_task` función snake_case | `generar_reporte_pdf`, `cargar_personal_masivo` |
| Receiver | `infrastructure/receivers.py` | `@receiver(events.x)` función `despachar_xxx` | `despachar_auditoria_egreso` |
| Modelo espejo solo-lectura (fuente legada) | `infrastructure/legado/[fuente]_models.py` | `class Xxx(models.Model)` con `managed = False` | ver [[integracion-bd-recaudacion]] |
| Serializer | `infrastructure/serializers/[entidad]_{lectura,escritura}_serializers.py` | `class XxxSerializer(ModelSerializer\|Serializer)` | Ver [[patrones-drf-implementacion]] |
| Vista | `presentation/views/[entidad]_views.py` | `class XxxView(views.APIView)` o `class XxxListView(generics.ListAPIView)` | Ver [[patrones-drf-implementacion]] |
| Filtros | `presentation/filters/[entidad]_filters.py` | `class XxxFilter(FilterSet)` | — |
| Permisos del módulo | `presentation/permissions/[modulo]_permissions.py` | bindings de `HasPermission("modulo.accion")` | Ver [[autenticacion-permisos-jwt]] |
| URLs de módulo | `presentation/urls.py` | `app_name = '<modulo>'`, lista `urlpatterns` | `app_name = 'personal'` |
| AppConfig | `apps.py` | `class XxxConfig(AppConfig)` | `PersonalConfig` (con `ready()` si tiene signals) |

> **Nota:** a diferencia del proyecto de origen, aquí **no** hay un `models.py`/`serializers.py`/`views.py` único por app: es **un archivo por entidad**, precisamente para respetar el techo de 400 líneas por archivo (**B13**). El `models.py` de la raíz existe solo como re-exportador.

---

## INSTALLED_APPS y enrutamiento raíz

```python
INSTALLED_APPS = [
    # django.contrib.*: auth, contenttypes, sessions, messages, staticfiles
    # Third-party: rest_framework, rest_framework_simplejwt,
    #   rest_framework_simplejwt.token_blacklist, corsheaders,
    #   django_filters, drf_spectacular, django_celery_results, django_celery_beat
    'core',
    # Módulos de dominio — identidad PRIMERO porque es dueña del modelo de cuenta:
    'apps.identidad', 'apps.organizacion', 'apps.catalogos',
    'apps.personal', 'apps.cargos', 'apps.familiares',
    'apps.movimientos', 'apps.reportes', 'apps.carnetizacion', 'apps.autogestion',
]
```

```python
# config/urls.py — un path por módulo, todo bajo /api/v1/ (D-06)
urlpatterns = [
    path('api/v1/identidad/',    include('apps.identidad.presentation.urls')),
    path('api/v1/organizacion/', include('apps.organizacion.presentation.urls')),
    path('api/v1/catalogos/',    include('apps.catalogos.presentation.urls')),
    path('api/v1/personal/',     include('apps.personal.presentation.urls')),
    # ... un include por módulo migrado
]
# + swagger/redoc solo si settings.EXPOSE_API_DOCS (default: solo DEBUG),
#   y restringido por red y autenticación (ALTA-14).
```

Las rutas legadas siguen respondiendo con cabecera `Deprecation: true` hasta que la fase B8 verifique cero consumidores (**C-6**). Regla **B12**: toda ruta nueva vive bajo `/api/v1/`, en minúsculas con guiones y barra final.

> El paquete de configuración del proyecto hoy se llama `SIGEP/`. El plan lo referencia como `config/`; mientras no se ejecute el renombrado, lee `config/` como "el paquete de settings del proyecto".

---

## Plantillas de archivos base

### Value Object — `domain/value_objects/cedula.py`

```python
@dataclass(frozen=True)
class Cedula:
    valor: str

    def __post_init__(self):
        if not re.fullmatch(r'[VE]-\d{6,9}', self.valor):
            raise ValidationError('Cédula con formato inválido.')
```

Un Value Object valida su invariante en el constructor y es inmutable (regla **B5**).

### Entidad de dominio — `domain/entities/empleado.py`

```python
@dataclass(frozen=True)
class Empleado:
    cedula: Cedula
    nombres: str
    apellidos: str
    cargo_id: int | None
    estatus: str

    def con_cargo(self, cargo_id: int) -> 'Empleado':
        return replace(self, cargo_id=cargo_id)
```

Las entidades no conocen el ORM ni los serializers (regla **B6**).

### Modelo ORM — `infrastructure/models/empleado_model.py`

```python
class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
```

### Caso de uso — `application/use_cases/[accion]_[entidad].py`

```python
def egresar_empleado(repo: RepoEmpleado, cola: TaskQueue, dto: EgresarEmpleadoDTO) -> Empleado:
    empleado = repo.obtener_por_cedula(dto.cedula)
    if empleado is None:
        raise NotFoundError('Empleado no encontrado.')
    egresado = repo.guardar(empleado.egresar(dto.fecha, dto.motivo))
    events.empleado_egresado.send(sender=egresar_empleado, cedula=dto.cedula)
    return egresado
```

El caso de uso **no** importa Celery: encola por el puerto `TaskQueue` (**B20**) o emite un evento que el receiver traduce a `transaction.on_commit()`.

### Vista delgada — `presentation/views/empleado_views.py`

```python
class EgresarEmpleadoView(views.APIView):
    permission_classes = [IsAuthenticated, HasPermission('personal.egresar')]

    @extend_schema(request=EgresarEmpleadoSerializer,
                   responses={200: EmpleadoSerializer, 403: MensajeRespuestaSerializer})
    def post(self, request, cedula):
        serializer = EgresarEmpleadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        empleado = egresar_empleado(RepoEmpleadoORM(), CeleryTaskQueue(),
                                   EgresarEmpleadoDTO(cedula=cedula, **serializer.validated_data))
        return ok(EmpleadoSerializer(empleado).data, 'Empleado egresado.')
```

Sin `.objects.` (**B7**), sin `Response(` crudo (**B9**), sin traducir excepciones a mano (**B10**).

### `apps.py`

```python
class PersonalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.personal'

    def ready(self):
        import apps.personal.infrastructure.receivers  # noqa: F401
```

### `presentation/urls.py`

```python
app_name = 'personal'
urlpatterns = [
    path('empleados/<str:cedula>/egresar/', EgresarEmpleadoView.as_view(), name='egresar_empleado'),
]
```

Para plantillas de serializers y vistas, ver [[patrones-drf-implementacion]].

---

## Reglas de validación Onion

| Regla | Violación | Mensaje |
|---|---|---|
| **R1** | `domain/` importa de `application/`, `infrastructure/`, `presentation/`, o de Django/DRF | ❌ **R1** (=B1): Domain es puro. Solo dataclasses, Value Objects, puertos, funciones puras y Signals. |
| **R2** | `application/` importa de `infrastructure/` o `presentation/` | ❌ **R2** (=B2): Application solo importa de `domain/` (propio o de `core`) y de otros casos de uso. |
| **R3** | Una vista de `presentation/` toca el ORM o contiene reglas de negocio | ❌ **R3** (=B7): La vista valida entrada, invoca un caso de uso y serializa la salida. Nada más. |
| **R4** | Un caso de uso o receiver dispara Celery con `.delay()` fuera de `transaction.on_commit()` | ❌ **R4** (=B22): Todo despacho asíncrono originado por un cambio de estado se envuelve en `transaction.on_commit()`, para que el worker no vea datos sin commitear. |
| **R5** | Un caso de uso accede a datos sin pasar por un repositorio (`.objects.`, `connection.cursor()`, import de `models`) | ❌ **R5** (=B21, **D-09**): **El patrón Repository es obligatorio en GATH.** Declara el puerto en `domain/ports/repo_[entidad].py` e impleméntalo en `infrastructure/repositories/repo_[entidad]_orm.py`. Inyéctalo en el caso de uso. |
| **R6** | Se agrega lógica nueva en `apps/[modulo]/` cuando en realidad es transversal | ⚠️ **R6** (=B16): Si más de un módulo la va a necesitar, va en `core/`. Un módulo **nunca** importa de un módulo hermano. |
| **R7** | Un modelo de una fuente de datos legada/ajena no tiene `managed = False` | ❌ **R7**: Todo modelo espejo debe declarar `managed = False` y quedar excluido de `allow_migrate` en su router. Ver [[integracion-bd-recaudacion]]. |
| **R8** | Se escribe el nombre de la capa de infraestructura con "e" extra (`infraestructure`) | ❌ **R8**: La grafía correcta y única en GATH es `infrastructure`. Corrígelo, no lo replique. |
| **R9** | Un archivo no sigue snake_case, o una clase no sigue PascalCase con sufijo (`View`, `Serializer`, `DTO`, `ORM`) | ❌ **R9**: Sigue la tabla de convención de nombres de esta skill. |
| **R10** | Un archivo de código supera las 400 líneas | ❌ **R10** (=B13): Divide por entidad o por caso de uso. Verificado en CI (`check_file_length.py`). |

### ⚠️ Regla anulada respecto a la versión heredada

La versión original de esta skill traía una regla **R5 de signo contrario**: *"este proyecto no usa el patrón repository; el acceso a datos es ORM directo desde `application/` y la capa de entrega. No la inventes."*

**Esa regla queda anulada en GATH.** La decisión **D-09** (*Patrón Repositorio en Backend: Adopción Vinculante*) la rechaza de forma expresa, y la R5 de la tabla anterior dice ahora exactamente lo contrario. El motivo es concreto y medible: con ORM directo en los casos de uso no se puede probar una regla de negocio sin levantar Django y PostgreSQL, y la meta de cobertura ≥ 80% sobre casos de uso puros (B6.1) se vuelve inalcanzable. Si encuentras código o documentación que invoque la vieja R5, está desactualizado.

---

## Comandos

### 1. Crear un módulo o caso de uso nuevo

```
@skill crea el caso de uso [nombre] para el módulo [modulo]
```

**Flujo:**
1. Preguntar: *"¿Esta lógica es exclusiva de `[modulo]` o la van a necesitar otros módulos?"* — si es transversal, va en `core/`, no en el módulo (**B16**).
2. Definir/extender la entidad y los Value Objects en `domain/` (inmutables, con invariantes en el constructor).
3. Declarar el puerto de repositorio en `domain/ports/repo_[entidad].py` (**D-09**) y el DTO en `application/dtos/`.
4. Escribir el caso de uso en `application/use_cases/` recibiendo el repo por parámetro. Sin Django, sin Celery.
5. Implementar el mapper y el repositorio ORM en `infrastructure/`; registrar el modelo en `infrastructure/models/` y re-exportarlo en `models.py` (**B26**).
6. Si dispara efectos secundarios (correo, PDF, carga masiva), emitir un evento en `domain/events.py` y crear su receiver en `infrastructure/receivers.py`, despachando dentro de `transaction.on_commit()` (**B22**).
7. Exponerlo en `presentation/` (view + serializers + urls bajo `/api/v1/`) siguiendo [[patrones-drf-implementacion]], con `HasPermission("modulo.accion")` y auditoría dual (DB + TXT).
8. Escribir el test unitario del caso de uso con repositorio en memoria, en el mismo commit ([[testing-backend-django]]).

### 2. Validar un módulo existente

```
@skill valida [modulo]
```

Aplica las reglas R1–R10 de esta skill (equivalentes a B1–B26 del plan) y reporta violaciones con archivo y línea exacta.

### 3. Decidir dónde vive código nuevo

Árbol de decisión:
```
¿Es una regla de negocio pura, una entidad, un Value Object o un contrato (puerto), sin I/O?
├── Sí → domain/ (de core/ si es transversal, del módulo si es exclusiva)
└── No, ¿orquesta entidades + repositorios + transacciones y puede emitir eventos?
    ├── Sí → application/use_cases/  (recibiendo los puertos por inyección)
    └── No, ¿es I/O concreto (ORM, Celery, S3/SeaweedFS, fuente legada, signals, logging)?
        ├── Sí → infrastructure/
        └── No → presentation/ (view, serializer de entrega, filtro, permiso, urls)
```
