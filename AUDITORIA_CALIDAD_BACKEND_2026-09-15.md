# Auditoría de Calidad y Arquitectura — Backend GATH (2026-09-15)

> **Alcance:** `BACKEND/` completo (11 apps de dominio + `core/`), branch `feature/arquitectura-onion`.
> **Naturaleza:** auditoría de **solo lectura/diagnóstico** — ningún archivo de código fue modificado.
> **Estándar de referencia:** los 6 skills propios del proyecto en `BACKEND/.claude/skills/`
> (`arquitectura-onion-feature-scream`, `patrones-drf-implementacion`, `uso-librerias-backend`,
> `autenticacion-permisos-jwt`, `testing-backend-django`, `integracion-bd-recaudacion`) — no un
> estándar genérico externo. Todos los hallazgos se verificaron leyendo el código real, no
> asumiendo el estado que describen los skills (las cosas cambiaron mucho en tareas recientes de
> esta sesión: el paquete de settings ya se renombró de `SIGEP/` a `GATH/`, `CACHES`/`THROTTLE`/
> `SPECTACULAR_SETTINGS`/`PASSWORD_HASHERS` ya existen, `pytest`/`ruff`/`mypy`/`import-linter` ya
> están instalados y en uso — varios "pendientes" que los skills describen ya se resolvieron).
> **Método:** lectura directa de código, `grep` dirigido, `ruff check --select F401,F811,F841`,
> `lint-imports`, `manage.py check`, y 3 sub-auditorías paralelas (una por grupo de apps) cuyos
> hallazgos se verificaron y consolidaron aquí.

---

## 1. Resumen ejecutivo

| Severidad | Cantidad |
|---|---|
| 🔴 Crítico | 2 |
| 🟠 Alto | 8 |
| 🟡 Medio | 11 |
| ⚪ Bajo | 10 |

**Contratos arquitectónicos automatizados: en verde.** `python manage.py check` → 0 issues.
`lint-imports` → **70/70 contratos KEPT, 0 broken** (267 archivos, 374 dependencias analizadas).
Esto confirma que la separación de capas Onion (domain puro, application sin framework,
independencia entre módulos) se sostiene mecánicamente en los 11 módulos + `core/`.

**Pero los contratos automatizados no detectan todo.** Los hallazgos más graves de esta auditoría
son precisamente el tipo de defecto que `lint-imports`/`manage.py check` no pueden ver: dos fallos
silenciosos de infraestructura que reportan éxito sin hacer el trabajo real (subida de archivos y
cola de tareas), un endpoint completamente inalcanzable por un código de permiso que no existe en
el catálogo, y un patrón repetido (7 ubicaciones, 4 archivos, 3 apps) donde la vista llama al
repositorio directamente, saltándose el caso de uso que el propio patrón Repository (D-09) exige
para que la regla de negocio sea testeable sin base de datos.

---

## 2. Hallazgos críticos 🔴

### C1 — Subida de foto de perfil pierde el archivo en silencio y reporta éxito
**Archivos:** `core/infrastructure/storage/seaweedfs_storage.py:35-52,54-70,84-98` +
`apps/personal/presentation/views/personal_views.py:99-106`

`SeaweedFSStorage._get_client()` captura `ImportError` de `boto3` y deja `_s3_client = None`.
**`boto3` no está en `BACKEND/requirements.txt`** (confirmado con `grep -i boto3 requirements.txt`
→ vacío, y `python -c "import boto3"` en el venv del proyecto → `ModuleNotFoundError`). Con el
cliente en `None`:
- `subir()` (línea 69-70) devuelve la `clave` **como si el archivo se hubiera guardado**, sin
  persistir los bytes en ningún lado ("Simulación en memoria" que en realidad no guarda nada).
- `descargar()` (línea 82) devuelve `b""` silenciosamente.
- `url_firmada()` (línea 98) devuelve una **URL falsa** (`?signature=mock&expires=...`) que nunca
  va a resolver un archivo real.

`EmpleadoFotoView.post` (`personal_views.py:90-110`) usa exactamente este flujo para la foto de
perfil de un empleado: sube el archivo, genera la "URL firmada" y responde `200 OK` con
`{'url': ..., 'mensaje': 'Foto de perfil actualizada exitosamente'}` — **el usuario ve un mensaje
de éxito y una URL, pero la foto nunca se guardó**. Confirmado con
`grep -rln SeaweedFSStorage` que este adaptador se usa también desde
`apps/carnetizacion/infrastructure/repositories/repo_carnetizacion_orm.py` (fotos de carnet):
mismo riesgo ahí.

**Regla violada:** ninguna regla numerada de los skills lo nombra directamente, pero contradice el
espíritu de D-11 (fallo cerrado): una pieza de infraestructura que no está disponible debe **fallar
visiblemente**, no fingir éxito.

**Sugerencia:** en `_get_client()`, si `boto3` no está instalable o el cliente no se puede
construir, `subir()`/`descargar()`/`url_firmada()` deben lanzar una excepción de dominio (p. ej.
`FuenteLegadaNoDisponible` o una nueva `AlmacenamientoNoDisponible(DomainError)`) que el
`exception_handler` traduzca a 503 — nunca devolver un resultado que aparente éxito. Además,
agregar `boto3` a `requirements.txt` si SeaweedFS está realmente en uso, o documentar explícitamente
que esta funcionalidad está deshabilitada hasta que se instale.

### C2 — `EmpleadoFotoView` usa el sobre de éxito (`ok()`) para responder un error 400
**Archivo:** `apps/personal/presentation/views/personal_views.py:97`

```python
if not archivo:
    return ok({'error': 'No se proporcionó ningún archivo'}, status=400)
```

`ok()` (`core/presentation/envelope.py:12-14`) **hardcodea** `'status': 'success'` en el cuerpo de
la respuesta sin importar el código HTTP que se le pase. El cliente recibe un HTTP 400 cuyo body
dice `{"status": "success", ...}` — cualquier frontend que branch-ee sobre `response.data.status`
(el patrón establecido en todo el resto del sistema, ver `NextJS/src/lib/api-client.ts`) interpreta
esto como éxito.

**Regla violada:** Contrato C-1 / regla B9 (`core/presentation/envelope.py`): la vista debe usar
`fail()` para cualquier respuesta de error, nunca `ok()` con un `status=` distinto de 2xx.

**Sugerencia:** `from core.presentation.envelope import fail` y
`return fail('No se proporcionó ningún archivo', status=400)`.

---

## 3. Hallazgos altos 🟠

### A1 — Patrón repetido: la vista llama al repositorio directamente, sin pasar por un caso de uso
**Archivos y líneas exactas (7 ubicaciones, 4 archivos, 3 apps):**
- `apps/identidad/presentation/views/cuenta_views.py:73,80` (`UsuarioListView.get`) — el propio
  docstring del archivo dice "Ningún acceso al ORM aquí", pero esta vista sí lo hace.
- `apps/identidad/presentation/views/auth_views.py:131-134` (`LoginView.post`, construcción de la
  respuesta) y `:203-204,207` (`MeView`) — instancian `RepoCuentasORM()`/`RepoPermisosORM()` y
  llaman métodos del repo directo en la vista.
- `apps/autogestion/presentation/views/autogestion_views.py:94` (`MetricasCensoView.get`) y `:106`
  (`CensoExcelView.get`) — `repo.obtener_metricas_censo()` / `repo.obtener_todas_respuestas()`.
- `apps/carnetizacion/presentation/views/carnetizacion_views.py:144` (`repo.obtener_estadisticas_carnets()`)
  y `:163` (`repo.crear_plantilla(...)`).

Las demás vistas de esos mismos archivos (y la totalidad de `apps/personal`, `apps/cargos`,
`apps/movimientos`, `apps/pasivos`, `apps/familiares`, `apps/catalogos`, `apps/organizacion`,
`apps/reportes` — verificado con `grep -rn "repo\.\|\.objects\." apps/*/presentation/views/*.py`)
sí delegan correctamente en `application/use_cases/`, así que este no es el patrón dominante, es
una excepción puntual pero repetida en los mismos 3 módulos.

**Regla violada:** B7 (la vista invoca un caso de uso, nada más) + B21/D-09 (patrón Repository
obligatorio, inyectado en un caso de uso — no instanciado ni llamado desde `presentation/`).

**Sugerencia:** crear el caso de uso que falta en cada caso (`listar_usuarios`,
`obtener_metricas_censo`, `exportar_censo_excel`, `obtener_estadisticas_carnets`,
`crear_plantilla_carnet`) recibiendo el repo por inyección, y mover la llamada ahí. Es también lo
que bloquea escribir un test de nivel 1 (repo en memoria) para esa lógica hoy.

### A2 — `LoginView` concentra toda la lógica de autenticación en la vista
**Archivo:** `apps/identidad/presentation/views/auth_views.py:73-140`

`LoginView.post()` hace inline: verificación de credenciales, consulta y aplicación del bloqueo
progresivo, emisión de tokens y armado de la respuesta — sin un único caso de uso que orqueste
todo eso.

**Regla violada:** B7 (arquitectura-onion-feature-scream).

**Sugerencia:** extraer un caso de uso `iniciar_sesion(repo_auth, repo_bloqueos, dto)` que reciba
los puertos y devuelva el resultado o lance las excepciones de dominio correspondientes; la vista
queda reducida a validar entrada + invocar el caso de uso + serializar.

### A3 — Cola de tareas Celery: mismo patrón de fallo silencioso que C1 (por ahora sin caso de uso real que lo dispare)
**Archivo:** `core/infrastructure/tasks/celery_queue.py:20-43`

`CeleryTaskQueue._get_app()` captura `ImportError` de `GATH.celery` (que no existe todavía — el
propio skill `uso-librerias-backend` confirma que Celery aún no está configurado como app) y, si
no hay app, `encolar()` devuelve un `simulated-task-{nombre}` **como si la tarea se hubiera
encolado**, sin ejecutar nada. A diferencia de C1, **no se encontró ningún caso de uso real que
llame a `CeleryTaskQueue().encolar(...)` hoy** (`grep -rln CeleryTaskQueue` solo aparece en su
propio `__init__.py` re-exportador) — es código de plantilla para cuando exista una tarea real, no
un bug en producción todavía.

**Regla violada:** mismo espíritu de D-11 (fallo cerrado) que C1.

**Sugerencia:** corregir el mismo patrón que en C1 (lanzar en vez de simular) **antes** de que el
primer caso de uso real empiece a usar este puerto — así no se repite el error de C1 en el primer
consumidor real.

### A4 — Endpoint de autogestión inalcanzable: exige un código de permiso que no existe en el catálogo
**Archivo:** `apps/autogestion/presentation/views/autogestion_views.py:30`

`PreguntasCensoListView` exige `HasPermission('autogestion.ver')`. Ese código **no existe** en
`apps/identidad/management/commands/seed_permisos.py` — ni en `PERMISOS_CATALOGO` ni asignado a
ningún rol. El rol AUTOGESTION (el único destinatario real de "listar las preguntas del censo para
responderlo") solo tiene `autogestion.ver_propio`, `autogestion.actualizar_propio`,
`autogestion.censo_ver_propio`, `autogestion.censo_actualizar_propio` — ninguno coincide con
`autogestion.ver`. **El endpoint queda inalcanzable para su propio usuario objetivo**, siempre
devuelve 403.

**Regla violada:** Contrato C-3 (el código de permiso debe existir en el catálogo real que
gobierna la autorización) — esto no lo detecta ningún test ni `lint-imports`, solo cruzar el
código contra el catálogo real.

**Sugerencia:** cambiar a un código ya sembrado (`autogestion.ver_propio` parece el candidato
correcto dado el contexto) o agregar `autogestion.ver` al catálogo y a los roles que corresponda.

### A5 — N+1 confirmado en el listado de pasivos egresados
**Archivos:** `apps/pasivos/infrastructure/repositories/repo_pasivos_orm.py:60-61` +
`apps/pasivos/infrastructure/mappers/mapper_pasivos.py:43-56,71`

`listar_pasivos()` itera `qs_egresados` (línea 60) y llama `pasivo_a_entidad(fila)` por cada fila
(línea 61); `pasivo_a_entidad` (mapper_pasivos.py:71) ejecuta `cargos_historial_de_egreso(modelo.pk)`,
que lanza **una query nueva por cada pasivo egresado** de la lista (`CargoEgresadoModel.objects
.filter(egreso_id=...)`, aunque esa query en sí está bien optimizada con `select_related` de sus 9
catálogos). El propio docstring de `cargo_egresado_a_dict` (mapper_pasivos.py:15-16) dice que ese
resolver es para "la UI de **detalle** de pasivo", pero también se dispara desde el **listado
completo**. Con `N` pasivos egresados, el listado hace `1 + N` queries en vez de `2`.

**Regla violada:** performance (sección 4 de esta auditoría) — no hay una regla numerada del skill
para N+1 específicamente, pero contradice el espíritu de "consulta batcheada" que sí se aplica
correctamente en `apps/reportes/infrastructure/repositories/repo_reportes_orm.py` (verificado:
todos sus reportes usan `select_related`/`annotate` antes de iterar, sin N+1).

**Sugerencia:** en el listado, no resolver `cargos_historial` por fila (dejarlo vacío/omitido en el
DTO usado por el listado) y resolverlo solo en `obtener_por_cedula` (detalle, que sí lo necesita) —
o, si el listado sí lo necesita, precargar en batch con
`CargoEgresadoModel.objects.filter(egreso_id__in=[...]).select_related(...)` agrupado por
`egreso_id` antes del loop, en vez de una query por pasivo.

### A6 — Códigos de permiso `familiares.eliminar`, `cargos.desincorporar` y otros existen en el catálogo pero no protegen ningún endpoint
**Archivos:** `apps/familiares/presentation/views/familiares_views.py` (todo el archivo) +
`apps/identidad/management/commands/seed_permisos.py`

`FamiliarDetailView.get_permissions()` gatea el `DELETE` con `familiares.editar` (rama `else`), no
con `familiares.eliminar`, que existe como código separado y más específico en el catálogo
(`seed_permisos.py`, "Desactivar o eliminar carga familiar"). Hoy es imposible otorgar
editar-sin-eliminar o eliminar-sin-editar a ningún rol, porque el código más granular nunca se
evalúa. Mismo patrón: `familiares.adjuntar_documento`/`familiares.descargar_documento` existen en
el catálogo pero no hay ningún endpoint de subida/descarga de documentos implementado (solo
listado de metadatos, gateado con `familiares.ver`); y `cargos.desincorporar` no tiene ningún
endpoint ni caso de uso detrás en `apps/cargos`.

**Regla violada:** Contrato C-3 (un código de permiso sembrado que no protege nada real es, en la
práctica, la mitad inversa del hallazgo A4 — ahí faltaba el código, aquí sobra sin uso).

**Sugerencia:** para `familiares.eliminar`, cambiar el `DELETE` a exigir ese código en vez de
`familiares.editar`. Para el resto, implementar el endpoint correspondiente o retirar el código
del catálogo hasta que exista, para no dejar la matriz de permisos describiendo capacidades que no
existen.

### A7 — `rest_framework_simplejwt` importado en `application/` sin excepción declarada en `lint-imports`
**Archivo:** `apps/identidad/application/use_cases/rotar_tokens_sesion.py:24-25`,
`cerrar_sesion.py:10-11` (comparar con `emitir_tokens_sesion.py:23`, que sí documenta la excepción)

Los 3 casos de uso importan `rest_framework_simplejwt` directamente en `application/`, lo cual
técnicamente viola B2/B4 (application sin dependencias de framework). `emitir_tokens_sesion.py`
documenta esto como una excepción deliberada (JWT como primitiva transversal), pero
`rotar_tokens_sesion.py` y `cerrar_sesion.py` no la documentan igual, y **`.importlinter` no
incluye `rest_framework_simplejwt` en los `forbidden_modules` de `apps.identidad.application`** —
por eso `lint-imports` reporta "70 kept, 0 broken" sin detectar esto. Es un punto ciego real del
contrato de import-linter, no una regla que se esté cumpliendo.

**Regla violada:** B2/B4, y una inconsistencia en la definición del propio contrato de
`import-linter` (dos de tres call-sites del mismo patrón no están cubiertos por el análisis).

**Sugerencia:** decidir si la excepción se acepta (como ya ocurre implícitamente) y, si es así,
declararla explícitamente como `forbidden_modules` con `ignore_imports` en `.importlinter` (mismo
mecanismo ya usado para `apps.cargos.domain.events -> django`), para que el contrato refleje la
realidad en vez de omitirla por un vacío de configuración.

### A8 — API docs (`/api/schema/`, `/api/docs/`, `/api/redoc/`) accesibles a cualquier usuario autenticado, no solo administradores
**Archivo:** `GATH/urls.py:9` (`PERMISOS_DOCUMENTACION = [IsAuthenticated]`)

El skill `uso-librerias-backend` documenta el estado objetivo (ALTA-14) como
`[IsAuthenticated, EsAdministrador]`. `EsAdministrador` **existe** (`apps/identidad/presentation/
permissions/identidad_permissions.py`) pero **no se usa** en `GATH/urls.py`. Hoy cualquier cuenta
autenticada — incluyendo RECEPCIONISTA o AUTOGESTION, con permisos mínimos — puede ver el esquema
OpenAPI completo (todas las rutas, todos los parámetros, toda la forma de la API) vía Swagger/Redoc.

**Regla violada:** ALTA-14 (documentada explícitamente en el skill como objetivo ya decidido, no
como propuesta).

**Sugerencia:** `PERMISOS_DOCUMENTACION = [IsAuthenticated, EsAdministrador]` en `GATH/urls.py:9`.

---

## 4. Hallazgos medios 🟡

### M1 — Throttle scope `'login': '5/minute'` declarado pero nunca aplicado a ningún endpoint
**Archivos:** `GATH/settings.py:222-226` (`DEFAULT_THROTTLE_RATES`) +
`apps/identidad/presentation/views/auth_views.py:61-76` (`LoginView`)

`grep -rn "throttle_scope\|throttle_classes" apps` no encuentra **ninguna** vista que declare
`throttle_scope = 'login'`. `ScopedRateThrottle` está en `DEFAULT_THROTTLE_CLASSES`, pero sin que
ninguna vista declare su `throttle_scope`, la clase no aplica límite alguno a esa vista (solo
heredan el límite genérico `anon`/`user`, 60 o 300 por minuto — muy laxo para login). El
mecanismo de bloqueo progresivo por cuenta (`tests/integration/test_bloqueo_cuentas.py`) sí existe
y sí protege contra fuerza bruta dirigida a una cuenta puntual, pero la protección de tasa a nivel
de IP/endpoint que el propio `settings.py` declara como "activa" (5/min) es, en la práctica, un
valor de configuración muerto.

**Regla violada:** D-11/ALTA-04 (throttling de login activo y justificado).

**Sugerencia:** `LoginView` (y el endpoint de cambio de contraseña, si existe un scope
`cambiar-password` similar) deben declarar `throttle_classes = [ScopedRateThrottle]` y
`throttle_scope = 'login'`.

### M2 — `CORS_ALLOWED_HEADERS` es el nombre de setting incorrecto — django-cors-headers lo ignora en silencio
**Archivo:** `GATH/settings.py:267-278`

El setting real que lee `django-cors-headers` es `CORS_ALLOW_HEADERS` (sin "ED"). El código
declara `CORS_ALLOWED_HEADERS` (con "ED") — una lista de 12 cabeceras personalizadas que **nunca
se aplica**; la librería usa su lista default en su lugar. `CORS_ALLOW_METHODS`, dos líneas más
abajo, sí tiene el nombre correcto — la inconsistencia es evidencia de que fue un error de
tipeo, no una decisión.

**Regla violada:** ninguna regla numerada, es un bug de configuración ya anticipado por el skill
como MED-19 — sigue sin corregirse.

**Sugerencia:** renombrar a `CORS_ALLOW_HEADERS`.

### M3 — `CORS_ALLOWED_ORIGINS` y `ALLOWED_HOSTS` hardcodeados en el código, con duplicados
**Archivo:** `GATH/settings.py:36,83-98`

15 orígenes CORS y 10 hosts, todos escritos literalmente en el archivo (IPs internas, hostnames de
contenedores) en vez de venir de una variable de entorno — y con **duplicados exactos**:
`"172.21.192.1:3000"` aparece dos veces en `CORS_ALLOWED_ORIGINS` (líneas 93-94), `'172.16.26.48'`
dos veces en `ALLOWED_HOSTS` (línea 36). `ALLOWED_HOSTS` también incluye `'testserver'` — el host
que usa el test client de Django — mezclado con la configuración de producción.

**Regla violada:** patrón objetivo B1.3 (ambos deben venir de `config('...', cast=Csv())`).

**Sugerencia:** mover ambas listas a variables de entorno; quitar `'testserver'` de la lista de
producción (agregarlo solo vía `@override_settings` en los tests que lo necesiten).

### M4 — Testing: la pirámide está construida casi solo en el Nivel 1 (unitario)
**Directorio:** `tests/`

181 funciones de test bajo `tests/unit/` (11 módulos + core, cobertura amplia) contra **4** bajo
`tests/integration/` (todas en el único archivo `test_bloqueo_cuentas.py`) y **0** bajo
`tests/seguridad/` (el directorio ni existe). El skill `testing-backend-django` pide
explícitamente Nivel 2 (contrato HTTP: status, sobre C-1, permiso → 403, escritura en
`auditoria_log`) y Nivel 3 (un test de regresión por hallazgo CRIT-*/ALTA-*) como parte de la
pirámide — hoy prácticamente no existen.

**Regla violada:** B6.1, B3.14 (pirámide de 3 niveles).

**Sugerencia:** priorizar tests de integración para los endpoints de escritura de más riesgo
(login, permisos, cambio de contraseña) verificando código HTTP + sobre C-1 + registro de
auditoría, y agregar `tests/seguridad/` con un test por cada hallazgo de esta misma auditoría que
se decida corregir.

### M5 — `catalogos_soporte_views.py` supera el techo de 400 líneas (B13)
**Archivo:** `apps/personal/presentation/views/catalogos_soporte_views.py` — **562 líneas**, 28
clases de vista en un solo archivo (único archivo de todo el backend que excede el límite,
confirmado con `find apps core -name '*.py' -exec wc -l {} +`).

**Regla violada:** B13 (techo de 400 líneas).

**Sugerencia:** dividir por familia de catálogo (p. ej. `catalogos_vestimenta_views.py`,
`catalogos_salud_views.py`), como ya se hace en otros módulos. Las 10 primeras clases (líneas
88-183: `PoliticasListView`, `CondicionesViviendaListView`, `CodigosPostalesListView`,
`GruposSanguineosListView`, `NivelesAcademicosListView`, `CarrerasListView`, `MencionesListView`,
`InstitucionesListView`, `CapacitacionesListView`, `GruposCapacitacionListView`) son de solo
lectura y candidatas opcionales al patrón `DefaultRouter`+`ReadOnlyModelViewSet` que D-10 permite
para catálogos mecánicos — reduciría el archivo de forma natural.

### M6 — Serializer ad-hoc definido dentro de una vista, en vez de en `infrastructure/serializers/`
**Archivo:** `apps/carnetizacion/presentation/views/carnetizacion_views.py:148-167`
(`PlantillaCreateView.post`)

Define una clase serializer anónima (`_S`) dentro del método, con el `import` de
`rest_framework.serializers` y de `PlantillaCarnetSerializer` también diferidos dentro del cuerpo
de la función.

**Regla violada:** convención de `patrones-drf-implementacion` (serializers viven en
`infrastructure/serializers/[entidad]_escritura_serializers.py`, no ad-hoc en la vista).

**Sugerencia:** extraer `_S` a `PlantillaCrearSerializer` en
`infrastructure/serializers/plantilla_escritura_serializers.py`; mover los imports al top del
archivo.

### M7 — ~250 líneas de vistas de reportes casi idénticas, duplicadas 8 veces
**Archivo:** `apps/reportes/presentation/views/reportes_views.py` (298 líneas, 24 clases)

8 tipos de reporte × 3 vistas (JSON/PDF/Excel) casi idénticas, difiriendo solo en el nombre de la
función `generar_reporte_*` y el nombre de archivo de salida.

**Regla violada:** ninguna regla numerada — es duplicación evitable de calidad general (sección 2
de esta auditoría).

**Sugerencia:** un despachador basado en un dict `{clave: (generar_fn, titulo_archivo)}` con 3
vistas genéricas parametrizadas por esa clave, o una vista base común con hooks para pdf/excel/json.

### M8 — Import diferido dentro de un método, con un import sin usar
**Archivo:** `apps/autogestion/presentation/views/autogestion_views.py:104,108-109`
(`CensoExcelView.get`)

`generar_reporte_excel`, `Response` (nunca se usa, confirmado con `ruff` F401) y `HttpResponse` se
importan dentro del cuerpo del método en vez de al inicio del archivo.

**Regla violada:** ninguna regla numerada — consistencia de estilo.

**Sugerencia:** mover los imports al top del archivo; quitar el import de `Response`.

### M9 — Imports sin usar (confirmado con `ruff check --select F401`)
- `apps/carnetizacion/infrastructure/models/carnetizacion_models.py:4-5` — `import hashlib` y
  `from django.conf import settings`. El cálculo real de `security_hash` ya vive en
  `infrastructure/repositories/repo_carnetizacion_orm.py:58` (`hashlib.sha256(...)`) — estos dos
  imports en el archivo de modelos quedaron vestigiales.
- `apps/identidad/infrastructure/providers/resolutor_core.py:10` — `ResolutorPermisos` importado
  y sin usar (`ResolutorIdentidad` lo implementa por duck typing, sin declararlo como base ni como
  anotación).

**Regla violada:** ninguna regla numerada — limpieza de código.

**Sugerencia:** quitar los imports; en el segundo caso, considerar usarlo como anotación de tipo
explícita (`class ResolutorIdentidad:` → documentar que implementa el protocolo, o anotar el
retorno de las funciones con él) en vez de solo quitarlo.

### M10 — Rama "legado" muerta en el resolutor de permisos
**Archivo:** `core/presentation/permissions.py:37-39`

```python
resolutor_legado = getattr(user, 'tiene_permiso', None)
if callable(resolutor_legado):
    return bool(resolutor_legado(codigo))
```

`CuentaModel` (`apps/identidad/infrastructure/models/cuenta_models.py:55`, `AbstractBaseUser`) no
define ningún método `tiene_permiso` (confirmado con `grep -n "def tiene_permiso"` en todo el
repo — las 4 coincidencias son otras clases, ninguna es el modelo de usuario autenticado). Esta
rama nunca se ejecuta hoy: es código muerto que añade una vía de bypass silenciosa del resolutor
real sin que nada la use.

**Regla violada:** ninguna regla numerada — claridad de código (una vía de autorización alternativa
sin consumidor es un riesgo latente si alguna vez alguien le agrega ese método al modelo sin
revisar esta función).

**Sugerencia:** quitar la rama, o si es intencional como punto de extensión futuro, documentarlo
explícitamente con el caso de uso previsto.

### M11 — Duplicación de resolución de nombres de catálogo entre `apps.cargos` y `apps.pasivos`
**Archivos:** `apps/pasivos/infrastructure/mappers/mapper_pasivos.py` (`cargo_egresado_a_dict`) vs
`apps/cargos/infrastructure/mappers/mapper_cargos.py`

Ambos módulos resuelven `_nombre` de los mismos catálogos (dependencia/dirección general/línea/
coordinación/organismo adscrito) sobre modelos ORM distintos (`CargoEgresadoModel` vs
`AsigTrabajoModel`) con el mismo patrón de código, repetido campo por campo.

**Regla violada:** ninguna regla dura de Onion (B16 no aplica: son módulos distintos con modelos
distintos, cruzarlos violaría B16 más de lo que lo resuelve) — es duplicación evitable de calidad
general.

**Sugerencia:** si el patrón se repite una tercera vez en otro módulo, considerar un helper
genérico en `core/` que reciba el objeto ORM y una lista de pares `(campo_id, campo_relación,
atributo_nombre)` a resolver, en vez de repetir el bloque de 15+ líneas.

---

## 5. Hallazgos bajos ⚪

- **`apps/familiares/domain/value_objects/cedula_familiar.py:22-23`** — `__post_init__` asigna
  `cedula = Cedula(self.valor)` a una variable nunca usada (confirmado con `ruff` F841); la
  intención es validar por efecto secundario. Sugerencia: `Cedula(self.valor)` como statement
  suelto, sin asignar a nada. Nota adicional: la `property cedula` (líneas 25-28) reconstruye
  `Cedula(self.valor)` de nuevo en cada acceso, revalidando el mismo valor ya validado en
  `__post_init__` — ineficiencia trivial, no funcional.
- **`apps/pasivos/infrastructure/repositories/repo_pasivos_orm.py:148-151`** — loop
  `for asig in AsigTrabajoModel.objects.filter(employee=empleado): asig.save(...)` hace un
  `UPDATE` por fila dentro de una transacción de negocio (`procesar_egreso_a_pasivo`). El volumen
  esperado es bajo (asignaciones activas de un solo empleado, no una lista masiva), así que no es
  un N+1 de listado, pero sigue siendo una query evitable por fila. Sugerencia: `.update(
  estatusid=estatus_vacante, employee=None)` en una sola query — verificar antes que no se
  dependa de señales `post_save` para esas filas.
- **`GATH/settings.py:136`** — línea comentada `# 'NAME': 'SIGEP',`, resto muerto del renombrado
  del paquete de settings. Sugerencia: quitarla.
- **`apps/cargos/presentation/views/*`** — el código de permiso `cargos.desincorporar` (sembrado en
  el catálogo) no tiene ningún endpoint ni caso de uso detrás en `apps/cargos` (ver también A6).
- **`apps/identidad/application/use_cases/registrar_intento_fallido.py`,
  `validar_bloqueo.py`** — sin test de nivel 1 (repo en memoria); solo hay cobertura de nivel 2
  (`tests/integration/test_bloqueo_cuentas.py`, que requiere Postgres real y por tanto no corre en
  todos los entornos). Sugerencia: agregar un test unitario rápido con un repo de bloqueos en
  memoria para la regla de negocio del umbral de intentos.
- **`apps/cargos/application/use_cases/gestionar_denominaciones.py`** — las 6 funciones de
  escritura (crear/actualizar/eliminar denominación y denominación específica) no tienen ningún
  test (`tests/unit/cargos/test_cargos.py` solo cubre `listar_denominaciones`). Sugerencia:
  `tests/unit/cargos/test_gestionar_denominaciones.py` con `RepoCargosMemoria`.
- **`apps/personal/presentation/views/catalogos_soporte_views.py`** — ver M5; en sí mismo el
  contenido de cada vista está bien (son `APIView` explícitas correctas para catálogos que
  escriben, ninguna toca el ORM directo), el único problema es el tamaño del archivo.
- **Documentación de los skills desactualizada en 2 puntos puntuales** (no son defectos de código,
  se anotan para que la próxima auditoría no los re-descubra como "hallazgos"): (a) el paquete de
  settings ya se llama `GATH/`, no `SIGEP/`, y `GATH/urls.py` es el `ROOT_URLCONF` real; (b)
  `apps.pasivos` es un onceavo módulo de dominio real y registrado, no mencionado en la lista
  original de 10 módulos de `arquitectura-onion-feature-scream` — sigue las mismas reglas de
  capas que los demás (verificado, 0 violaciones de layering en `apps/pasivos`).
- **Mecanismo `permisos_version`** (descrito en `autenticacion-permisos-jwt` como B9.4.1-B9.4.3) no
  existe en el código (`grep -r "permisos_version"` → 0 resultados). No es una brecha de
  seguridad real: `core/presentation/permissions.py::_usuario_tiene_permiso` resuelve el permiso
  contra la matriz real en **cada** request (nunca confía en un claim del JWT), lo cual es más
  estricto que el propio mecanismo de "expiración en minutos" que describe el skill. Es una nota
  para actualizar la documentación, no un hallazgo de severidad.
- **`ENUM_NAME_OVERRIDES = {}`** en `SPECTACULAR_SETTINGS` (`GATH/settings.py:193`) está vacío,
  pero verificado que es correcto: solo existe un `TextChoices` en todo el backend
  (`IntentoFallidoModel.Resultado`), usado en un solo lugar — B25 exige la entrada solo cuando un
  `TextChoices` se reutiliza en más de un modelo/serializer, lo cual todavía no ocurre. No es un
  hallazgo, se documenta para que no se re-abra sin evidencia.

---

## 6. Lo que sí cumple (para no perder la proporción)

- **Capas Onion**: `domain/`/`application/` puros en los 11 módulos + `core/`, verificado tanto
  por `lint-imports` (70/70) como por lectura directa en las 3 sub-auditorías — sin excepción real
  encontrada más allá de A7 (JWT en 2 casos de uso, ya semi-documentada en un tercero).
  `apps.movimientos` es el módulo más limpio de los 11: `select_related` consistente vía una
  tupla compartida, cero duplicación, cero hallazgos.
- **Envelope C-1**: `ok()`/`fail()` se usa consistentemente en 10 de los 11 módulos; las
  excepciones (`HttpResponse` directa para PDF/Excel binarios) son arquitectónicamente correctas y
  consistentes entre `reportes`, `carnetizacion` y `autogestion` — no una improvisación por vista.
- **Permisos por código (C-3)**: cero comparaciones de `nombre_rol` encontradas en código de
  negocio en ningún módulo — el patrón `HasPermission("modulo.accion")` se respeta en la inmensa
  mayoría de vistas, con las excepciones puntuales ya listadas en A4/A6.
- **`apps/reportes`**: sin N+1 en ningún reporte (todos usan `select_related`/`annotate` antes de
  iterar) — el único módulo con alto riesgo de performance por volumen que sale completamente
  limpio.
- **`apps/personal/infrastructure/importadores/`**: carga masiva sin N+1 (catálogos precargados en
  un diccionario antes del loop por fila, `bulk_create`), y corrige y documenta con evidencia de
  línea exacta dos bugs reales del legado que reemplaza.
- **Seguridad de base**: cero inyección SQL (cero `.raw()`/`cursor()` con formateo de string en
  todo `apps/`+`core/`), cero secretos hardcodeados, cero `StringRelatedField` en serializers,
  `SECRET_KEY`/credenciales de base de datos sin valores por defecto (`config(...)` sin `default`),
  `DEBUG` con default seguro (`False`) controlado por variable de entorno, `PASSWORD_HASHERS` con
  Argon2 activo y PBKDF2 preservado como fallback de lectura (no rompe cuentas existentes).
- **D-10 (ViewSets solo para catálogos)**: ningún módulo fuera de su perímetro usa
  `ViewSet`/`DefaultRouter` — de hecho ni siquiera `catalogos`/`organizacion` lo usan (usan
  `APIView` explícitas también ahí), lo cual es una oportunidad de simplificación no aprovechada,
  no una violación (ver M5 para el caso más notorio).

---

## 7. Recomendación de orden de corrección

1. **C1, C2** (silencioso pérdida de datos + envelope de error mal usado) — impacto directo en
   usuarios reales hoy, corrección acotada a 2 archivos.
2. **A4, A6** (permisos rotos: uno inalcanzable, otro sin efecto) — bugs funcionales confirmados,
   corrección de una línea cada uno.
3. **A1** (7 vistas con acceso directo al repo) — deuda arquitectónica concentrada en 3 módulos,
   bloquea testing de nivel 1 para esa lógica.
4. **A8, M1, M2, M3** — configuración de seguridad perimetral (docs, throttling, CORS) — cada uno
   es un cambio de una o dos líneas en `settings.py`/`urls.py`.
5. **A5** (N+1 de pasivos) — antes de que el volumen de egresados crezca lo suficiente para que se
   note en producción.
6. El resto (M4-M11, bajos) — deuda de calidad y cobertura de test, sin urgencia de seguridad ni
   de funcionalidad rota, pero acumulativa si no se atiende.

---

*Auditoría realizada mediante lectura directa de código, `ruff`, `lint-imports` y `manage.py
check`. No se aplicó ninguna corrección — todas las sugerencias quedan pendientes de una tarea de
implementación separada, priorizada según la sección 7.*
