---
name: testing-backend-django
description: Convenciones de testing del backend de GATH — pytest + pytest-django (D-12), tests de casos de uso puros con repositorio en memoria (D-09), factories que pasan por el caso de uso real, aislamiento de la caché de throttling y mocking en el punto de entrada del servicio.
---

# Testing Backend Django

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado: Django **5.2.7**, DRF **3.16.1**, `simplejwt` **5.5.1**, PostgreSQL **externo en servidor dedicado** (D-03), Celery (**5.3.4** declarado en `requirements.txt`, objetivo **5.5.x** por **B1.8**) con broker **RabbitMQ** (D-02) — no hay Redis en la arquitectura objetivo.
Decisiones que gobiernan esta skill: **D-12** (`pytest` + `pytest-django` como herramienta de test del backend), **D-09** (patrón Repository vinculante, que es lo que hace posible el test sin base de datos), **D-11** (`DatabaseCache` sobre PostgreSQL con fallo cerrado para throttling), **D-10** (ViewSets solo en catálogos de solo lectura), **D-06**/**C-6** (rutas bajo `/api/v1/`).
Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de adaptaciones está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.1** (estrategia de pruebas en §I.9, checklist por módulo en §I.8, contratos C-1…C-6 en §0.7).

---

## Estado de partida — verificado, no lo asumas resuelto

- **Hay 128 líneas de test en todo el backend**: `BACKEND/AUTOGESTION/tests.py` (125 líneas) y `BACKEND/CARNETIZACION/tests.py` (3 líneas). No hay nada con lo que "ser consistente": la suite se escribe desde cero (**MED-13**).
- **`pytest` y `pytest-django` NO están declarados** en `BACKEND/requirements.txt`, y no existe `pytest.ini`, `pyproject.toml` ni `conftest.py`. Instalarlos y configurarlos es la tarea **B1.4** (junto con `ruff`, `mypy` e `import-linter`). Hasta que B1.4 se ejecute, los comandos `pytest` de esta skill **no corren todavía**: es un pendiente de tooling, no una capacidad existente.
- Tampoco existe aún la estructura `apps/[modulo]/{domain,application,infrastructure,presentation}/` que estos tests ejercitan: se construye por estrangulamiento en B2–B4 (ver [[arquitectura-onion-feature-scream]]). Verifica qué existe antes de importar de ella.

---

## Ubicación y estructura

Los tests viven en un árbol `tests/` a nivel de backend, separados por nivel de la pirámide (no un `tests.py` por app):

```
tests/
├── conftest.py            fixtures compartidas: repos en memoria, cuentas por permiso, cliente API
├── unit/                  dominio y casos de uso — sin base de datos, corren en segundos
│   └── [modulo]/test_[caso_de_uso].py
├── integration/           repositorios y endpoints — con @pytest.mark.django_db
│   └── [modulo]/test_[recurso]_api.py
└── seguridad/             una prueba por hallazgo CRIT-*/ALTA-* (B6.1)
```

La separación no es cosmética: es lo que permite correr `pytest tests/unit` en cada guardado sin PostgreSQL ni Django inicializado. Los `tests.py` legados de `AUTOGESTION/` y `CARNETIZACION/` se mantienen mientras vivan las rutas legadas y se retiran con ellas (**C-6**).

---

## Framework: `pytest` + `pytest-django` (D-12)

- Los tests **unitarios** son funciones `def test_...()` puras: sin `TestCase`, sin base de datos, sin marca.
- Los tests **de integración** llevan `@pytest.mark.django_db` y usan `APIClient` de DRF. Las clases estilo `APITestCase`/`BaseAPITestCase` siguen siendo válidas aquí y `pytest` las ejecuta sin traducción: úsalas cuando necesites el aislamiento transaccional y los helpers de DRF (§I.9 las nombra explícitamente para este nivel).
- Comandos:

```bash
pytest tests/unit                      # rápido, sin base de datos — el que corre en cada guardado
pytest -m "not django_db"              # equivalente por marca
pytest tests/integration               # requiere PostgreSQL de prueba
pytest --cov=apps --cov=core           # cobertura para el umbral de B6.1 (≥ 80%)
```

- No hay `settings_test.py` separado: se usa la configuración del paquete de settings del proyecto (hoy `SIGEP/`, referenciado en el plan como `config/`) con overrides puntuales vía `@override_settings` o la fixture `settings` de `pytest-django` (ver caché, abajo).

### La pirámide (§I.9)

| Nivel | Qué prueba | Base de datos | Exigido por |
|---|---|---|---|
| **1 · Unitario** | Entidades, Value Objects y casos de uso, con puertos en memoria (`RepoEmpleadoMemoria`, `AuditLoggerMemoria`) | **No** | §I.8 paso 10, **B6.1** (≥ 80%) |
| **2 · Integración de API** | Repositorios ORM, vistas, permisos, transacciones, sobre **C-1** y escritura en `auditoria_log` | Sí (`django_db`) | §I.8 paso 11, **B3.14** |
| **3 · Regresión de seguridad** | Un test por hallazgo `CRIT-*` / `ALTA-*` de la auditoría | Según el caso | **B6.1** |

---

## Nivel 1 — casos de uso con repositorio en memoria (D-09)

Éste es el beneficio que justifica el patrón Repository: la regla de negocio se prueba **sin ORM, sin PostgreSQL y sin inicializar Django**, porque el caso de uso recibe el puerto por inyección.

```python
# tests/unit/personal/test_egresar_empleado.py
import pytest

from apps.personal.application.use_cases.egresar_empleado import egresar_empleado
from core.domain.exceptions import NotFoundError


class RepoEmpleadoMemoria:
    """Implementa el puerto domain/ports/repo_empleado.py. Sin Django en toda la prueba (B21, D-09)."""

    def __init__(self, existentes=()):
        self.existentes = list(existentes)
        self.guardados = []

    def obtener_por_cedula(self, cedula):
        return next((e for e in self.existentes if e.cedula == cedula), None)

    def guardar(self, empleado):
        self.guardados.append(empleado)
        return empleado


def test_egresar_empleado_marca_el_egreso(empleado_activo, dto_egreso):
    repo = RepoEmpleadoMemoria([empleado_activo])
    resultado = egresar_empleado(repo, ColaMemoria(), dto_egreso)
    assert resultado.estatus == 'EGRESADO'
    assert repo.guardados == [resultado]


def test_egresar_empleado_inexistente_falla(dto_egreso):
    with pytest.raises(NotFoundError):
        egresar_empleado(RepoEmpleadoMemoria(), ColaMemoria(), dto_egreso)
```

Reglas de este nivel:

- El doble en memoria implementa **el puerto declarado en `domain/ports/`**, no el repositorio ORM. Si necesitas importar `models` para escribir el test, el caso de uso está violando **B21**/**R5**: arregla el caso de uso, no el test.
- Los puertos de I/O (`TaskQueue`, `AuditLogger`, `FileStorage`, `ReportGenerator`) también se doblan en memoria. Un caso de uso no importa Celery (**B20**), así que el test tampoco necesita `CELERY_TASK_ALWAYS_EAGER`.
- Los dobles compartidos viven en `tests/conftest.py`, no duplicados en cada archivo.

---

## Factories — funciones que pasan por el camino real

Las factories son **funciones simples** (`crear_usuario`, `crear_empleado`, `crear_cargo`), no clases `factory_boy` ni fixtures JSON. Usan `get_or_create` o, cuando el objeto necesita pasar por las validaciones y efectos reales, invocan el **caso de uso real** en vez de crear con el ORM directo:

```python
def crear_usuario(**overrides):
    defaults = {...}
    defaults.update(overrides)
    return registrar_usuario(RepoUsuarioORM(), RegistrarUsuarioDTO(**defaults))  # mismo camino que producción
```

**Por qué importa**: si creas la cuenta de prueba con `Usuario.objects.create(...)` directo, te saltas las invariantes de dominio y los efectos secundarios que sí ocurren en producción (perfil asociado, evento emitido, escritura en `auditoria_log`, versión de permisos), y el test puede pasar por razones equivocadas. Usa las factories existentes o, si necesitas una nueva, hazla pasar por el caso de uso — no por el ORM crudo, salvo que estés probando explícitamente un caso de borde del propio modelo/ORM.

En el nivel 1 no hace falta factory: se construyen entidades de dominio a mano (son dataclasses inmutables) y se cargan en el repositorio en memoria.

---

## Aislamiento de la caché de throttling

**Contexto crítico:** en GATH el throttling de DRF guarda sus contadores en **`DatabaseCache` sobre PostgreSQL** (**D-11**, **ALTA-17**), en la tabla que crea `python manage.py createcachetable` (**B0.10**), con política de **fallo cerrado**. Es la misma base que usa la aplicación. Un `cache.clear()` en el `setUp` de un test que corra contra esa configuración borra contadores **reales** y, al revés, deja residuos entre corridas que agotan los cupos de `login` y de restablecimiento de contraseña y hacen fallar tests posteriores sin relación aparente.

La solución es **no dejar que los tests toquen la caché de la aplicación**: se sustituye por `LocMemCache` aislada (§I.9).

Con clase base (estilo `APITestCase`, el que nombra §I.9 para integración):

```python
@override_settings(CACHES={
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'tests-throttling',
    },
})
class BaseAPITestCase(APITestCase):
    def setUp(self):
        cache.clear()
        super().setUp()
```

Con fixture de `pytest-django`, para los tests de función:

```python
@pytest.fixture(autouse=True)
def aislar_cache_throttling(settings):
    settings.CACHES = {'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'tests-throttling',
    }}
    cache.clear()
```

**Toda prueba que ejercite un endpoint con throttling debe pasar por uno de los dos mecanismos.** Un test que use `APITestCase` pelado o `APIClient` sin la fixture corre el riesgo de leer y escribir en la tabla de caché compartida y arrastrar estado de otra corrida.

Django fusiona `@override_settings` de subclases, así que una clase hija puede añadir sus propios overrides sin perder el de caché:

```python
@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class LoginAPITests(BaseAPITestCase):
    ...
```

`CELERY_TASK_ALWAYS_EAGER` solo aplica al nivel 2: recuerda que las tareas reciben solo IDs primitivos, se despachan dentro de `transaction.on_commit()` (**B22**) y toleran `DoesNotExist` (**B23**) — hay un test por cada una de esas tres cosas.

---

## Mocking de integraciones externas

En GATH la integración de **solo lectura con bases de datos ajenas** está reservada a las **fuentes legadas**: la migración histórica desde **SAGP** y el **SIGEP** anterior, cuyo material de trabajo vive en la carpeta `migrar/` (§0.6.1). Ver [[integracion-bd-recaudacion]] para el patrón de router, `managed = False`, `allow_migrate = False`, rol SQL de solo lectura y degradación a 503. **No hay ninguna integración en línea con un sistema de terceros**: si alguien la agrega, cae bajo el mismo criterio de esta sección.

Los tests **nunca tocan la fuente legada real** — mockean en el punto de entrada del servicio o del repositorio. Los nombres del ejemplo son ilustrativos: usa los del repositorio legado que exista en el módulo cuando lo implementes.

```python
from unittest.mock import patch

@pytest.mark.django_db
def test_fuente_legada_caida_devuelve_503(api_client, cuenta_con_permiso):
    api_client.force_authenticate(cuenta_con_permiso)
    with patch.object(RepoLegadoSAGP, 'consultar',
                      side_effect=FuenteLegadaNoDisponible('BD no configurada')):
        response = api_client.get('/api/v1/personal/historico/V12345678/')
    assert response.status_code == 503
    assert response.data['status'] == 'error'
```

Criterio general para cualquier I/O externo (otra base ajena, servicio HTTP, SeaweedFS): mockea **en el punto de entrada del servicio o del puerto** (`patch.object(Clase, 'metodo')`), nunca la librería de bajo nivel (`psycopg2`, `requests`, `boto3`), para que el test no dependa de detalles de implementación. En el nivel 1 esto ni se mockea: se inyecta un doble del puerto.

---

## Aserciones contra el sobre C-1 y los permisos C-3

Toda respuesta HTTP de GATH sale por `core/presentation/envelope.py` (**C-1**, **B9**), así que las aserciones van contra ese sobre, no contra el objeto crudo:

```python
assert response.status_code == 200
assert response.data['status'] == 'success'
assert response.data['data']['cedula'] == 'V12345678'
```

La autorización se prueba por **código de permiso** `[modulo].[accion]` (**C-3**) — **cero comparaciones de nombre de rol**. Ésta es la plantilla que cierra CRIT-08 y CRIT-12:

```python
@pytest.mark.django_db
@pytest.mark.parametrize("url,metodo", [
    ("/api/v1/personal/", "post"),
    ("/api/v1/identidad/roles/", "post"),
])
def test_sin_permiso_responde_403(api_client, cuenta_sin_permisos, url, metodo):
    api_client.force_authenticate(cuenta_sin_permisos)
    assert getattr(api_client, metodo)(url, {}).status_code == 403
```

Prefiere `force_authenticate` a un login real por HTTP, salvo cuando lo que pruebas **es** el login. Si el test necesita las cookies, los nombres del contrato **C-2** son `dj_access` (15 min) y `dj_refresh` (8 h).

> ⚠️ **Incoherencia abierta:** el backend hoy declara `'AUTH_COOKIE': 'access_token'` y `'AUTH_COOKIE_REFRESH': 'refresh_token'` en `BACKEND/SIGEP/settings.py:194-195`, mientras C-2 fija `dj_access`/`dj_refresh`. Mientras no se resuelva, un test de cookies que use los nombres del contrato falla contra el código actual: lee el nombre desde `settings.SIMPLE_JWT['AUTH_COOKIE']` en lugar de escribirlo literal, y no des la discrepancia por cerrada.

---

## Qué debe quedar cubierto

Referencia de destino, no inventario de lo existente (hoy la cobertura real es ~cero):

| Área | Nivel | Exigido por |
|---|---|---|
| Casos de uso de cada módulo con repositorio en memoria | 1 | §I.8 paso 10, **B6.1** |
| Value Objects (`Cedula`, `Email`, `Telefono`) rechazando entradas inválidas | 1 | **B5** |
| Auth: login, refresco con rotación y blacklist, logout | 2 | **B3.6**, **B3.14** |
| Throttling y bloqueo progresivo tras 5 intentos fallidos | 2 | **B3.12**, **B0.10** |
| `HasPermission("modulo.accion")` → 403 por endpoint de escritura | 2 y 3 | **B3.3** (CRIT-08, CRIT-12) |
| Autogestión restringida a la cédula propia | 3 | **B3.4** (ALTA-07) |
| Descarga de documentos y media servida solo autenticada | 3 | **B0.6**, **B0.7** (CRIT-06, CRIT-07) |
| Sobre **C-1** y registro en `auditoria_log` por endpoint | 2 | §I.8 paso 11, **D-04** |
| Tareas Celery: IDs primitivos, `on_commit`, tolerancia a `DoesNotExist` | 2 | **B22**, **B23** |
| Fuente legada caída → 503 con mock en el punto de entrada | 2 | §0.6.1 |
| Un test de regresión por cada hallazgo `CRIT-*` / `ALTA-*` | 3 | **B6.1** |

Escribe **un test de éxito y uno de error por invariante**, no solo el camino feliz: buena parte de los hallazgos de la auditoría existen porque nadie probó el camino denegado.

---

### ⚠️ Regla anulada respecto a la versión heredada

La versión original de esta skill traía una prohibición explícita: *"No introduzcas pytest, factory_boy, ni fixtures JSON — el proyecto usa deliberadamente el framework nativo de Django/DRF"*, con `python manage.py test` como único corredor.

**La prohibición de `pytest` queda anulada en GATH.** La decisión **D-12** (*Framework de Testing Backend: `pytest` + `pytest-django`*) la revierte, y **B1.4** la instala como parte del pipeline de calidad. Los motivos son concretos:

1. Con `manage.py test` **todo** test arranca Django y crea la base de datos de prueba. Los tests de casos de uso puros que **D-09** hace posibles no se pueden expresar así: la ventaja del patrón Repository se pierde si igual hay que levantar Django y PostgreSQL para ejercitar una regla de negocio.
2. La meta de **B6.1** — cobertura **≥ 80% sobre casos de uso puros con repositorios mockeados** — se vuelve inalcanzable en la práctica: una suite que necesita PostgreSQL para cada aserción no se corre en cada guardado, y lo que no se corre no crece.
3. En el proyecto de origen la prohibición protegía la consistencia con 120 tests ya escritos. GATH tiene **128 líneas** de test: no hay inventario que preservar, y el costo de migración es nulo.

Lo que **sí** se conserva de la versión heredada, porque es criterio válido y no herramienta: factories como funciones que pasan por el camino real, aislamiento de la caché de throttling, y mocking en el punto de entrada del servicio. `factory_boy` y las fixtures JSON siguen fuera.

---

## Entorno local

Antes de reportar un test como roto, verifica que el entorno pueda siquiera correr la suite:

1. `pytest` y `pytest-django` no están en `requirements.txt` (pendiente **B1.4**): sin ellos, el corredor no existe.
2. PostgreSQL es **externo** (**D-03**): el usuario de base de datos necesita permiso `CREATEDB` para crear la base de test. Sin él, todo `@pytest.mark.django_db` falla y `pytest tests/unit` sigue pasando — esa asimetría es el síntoma.
3. La tabla de `DatabaseCache` debe existir (`createcachetable`) para los tests que no aíslen la caché; con el aislamiento de esta skill, no hace falta.
4. Nada de credenciales en el repositorio: los datos de conexión de prueba salen del entorno (**CRIT-03**, **CRIT-11**).

---

## Comandos

### 1. Escribir un test nuevo

```
@skill escribe un test para [caso de uso / endpoint]
```

1. **Decide el nivel primero.** ¿Es una regla de negocio? Va en `tests/unit/` con repositorio en memoria y **sin** `django_db`. ¿Es el contrato HTTP (status, sobre C-1, permiso, auditoría)? Va en `tests/integration/`.
2. En nivel 1, inyecta dobles de los puertos (`RepoXxxMemoria`, `ColaMemoria`, `AuditLoggerMemoria`); si necesitas `models`, el caso de uso está mal (**R5**/**B21**).
3. En nivel 2, hereda de `BaseAPITestCase` o usa la fixture `aislar_cache_throttling` si el endpoint tiene throttling. Nunca `APITestCase` pelado sobre un endpoint con cupo.
4. Usa `factories.crear_xxx()`; si falta la que necesitas, créala pasando por el caso de uso real, no por `Model.objects.create()`.
5. Si toca una fuente legada u otro I/O externo, mockea con `patch.object` en el punto de entrada del servicio/puerto.
6. Asevera contra el sobre **C-1** y, en autorización, contra el código de permiso **C-3** — nunca contra nombres de rol.
7. Escribe al menos un test de éxito y uno de error **por invariante**. El test entra en el **mismo commit** que el código (§I.8).

### 2. Diagnosticar un test que falla solo en CI o solo localmente

```
@skill por qué falla [test] en [entorno]
```

1. Descarta el entorno: `pytest`/`pytest-django` instalados, `CREATEDB` en el PostgreSQL externo, variables de conexión presentes.
2. ¿Falla solo la integración y pasa `pytest tests/unit`? Es base de datos o migraciones, no lógica.
3. ¿Falla intermitentemente con 429 o "throttled"? La clase o la función no está aislando la caché: está leyendo la de la aplicación (`DatabaseCache`) y arrastrando contadores de otra corrida.
4. ¿Falla solo cuando corre después de otro test? Busca estado compartido: caché, `on_commit` no ejecutado por `TestCase` transaccional, o un doble en memoria reutilizado entre tests.
5. ¿Un test unitario necesita base de datos para pasar? Es un defecto de arquitectura (el caso de uso toca el ORM), no del test.
