---
name: patrones-drf-implementacion
description: Patrones de implementación con Django REST Framework en el backend de GATH — serializers de lectura/escritura, vistas explícitas en presentation/ (ViewSets solo para catálogos de solo lectura, D-10), permisos por código, filtros, paginación, sobre de respuesta, drf-spectacular y throttling.
---

# Patrones de implementación DRF (Backend)

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado en `BACKEND/requirements.txt`: Django **5.2.7**, DRF **3.16.1**, `drf-spectacular` **0.28.0**, `django-filter` **25.1**, `djangorestframework_simplejwt` **5.5.1**.
Decisiones y contratos que gobiernan esta skill: **D-10** (`DefaultRouter` + `ReadOnlyModelViewSet` **solo** para los ~35 catálogos mecánicos de solo lectura; vistas explícitas para todo lo demás), **D-06** / **C-6** (rutas nuevas bajo `/api/v1/`), **D-11** (throttling sobre `DatabaseCache` en PostgreSQL con fallo cerrado — **nunca Redis**), **C-1** (sobre de respuesta único emitido por `core/presentation/envelope.py`), **C-3** (autorización por códigos `[modulo].[accion]`).
Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de adaptaciones está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.1** (contratos compartidos en §0.7, reglas B1–B26 en §I.7 y Apéndice A).

---

Skill para implementar endpoints nuevos en GATH. Complementa [[arquitectura-onion-feature-scream]] (dónde vive cada capa) con el "cómo" concreto de la capa **`presentation/`** — nunca `api/`.

Dónde va cada archivo (estructura canónica del módulo):

| Pieza | Ruta |
|---|---|
| Serializers de lectura / escritura | `apps/[modulo]/infrastructure/serializers/[entidad]_lectura_serializers.py` / `[entidad]_escritura_serializers.py` |
| Vistas | `apps/[modulo]/presentation/views/[entidad]_views.py` |
| Filtros | `apps/[modulo]/presentation/filters/[entidad]_filters.py` |
| Permisos del módulo | `apps/[modulo]/presentation/permissions/[modulo]_permissions.py` |
| URLs | `apps/[modulo]/presentation/urls.py` |

**Estado de partida:** el backend legado (`RAC/`, `USER/`, `CARNETIZACION/`, `AUTOGESTION/`) tiene 139 `@api_view` sueltos, no tiene `core/presentation/`, no tiene throttling configurado y usa `PAGE_SIZE = 10`. Casi todo lo que esta skill describe se **construye** durante las fases B0–B4: verifica que la pieza exista antes de importarla.

---

## Regla de oro: vistas explícitas, con una excepción acotada

**Por defecto: `generics.*View` + `views.APIView`.** Cada endpoint es una clase explícita registrada a mano en `presentation/urls.py`. No introduzcas `ModelViewSet` para acciones de negocio aunque parezca "más DRY".

**Excepción única (D-10):** `DefaultRouter` + `ReadOnlyModelViewSet` se permite **solo para los ~35 catálogos mecánicos de solo lectura** de `apps/catalogos/` (profesiones, estados, parentescos, etc.) y para las tablas maestras de `apps/organizacion/` (B4.1, B4.2). Nada que escriba, nada con reglas de negocio, nada con permisos por acción va por router.

```python
# apps/catalogos/presentation/urls.py — el caso permitido por D-10
router = DefaultRouter()
router.register('profesiones', ProfesionViewSet, basename='profesion')  # ReadOnlyModelViewSet
urlpatterns = [path('', include(router.urls))]
```

Clases usadas según el caso:

| Necesitas | Clase base | Ejemplo GATH |
|---|---|---|
| Catálogo mecánico de solo lectura (**D-10**) | `viewsets.ReadOnlyModelViewSet` + `DefaultRouter` | `ProfesionViewSet`, `ParentescoViewSet` |
| Listar | `generics.ListAPIView` | `EmpleadoListView` |
| Listar + crear | `generics.ListCreateAPIView` | `FamiliarListCreateView` |
| Ver uno | `generics.RetrieveAPIView` | `EmpleadoDetailView` |
| Ver + actualizar uno | `generics.RetrieveUpdateAPIView` | `CargoRetrieveUpdateView` |
| Crear solo | `generics.CreateAPIView` | `MovimientoCreateView` |
| Acción que no mapea a CRUD (egresar, aprobar, emitir carnet) | `views.APIView` con `get`/`post`/`put` | `EgresarEmpleadoView`, `EmitirCarnetView` |

### ⚠️ Regla anulada respecto a la versión heredada

La versión original decía, tajante: *"no hay ViewSets ni routers. No se usa `ModelViewSet`, `ViewSet`, ni `DefaultRouter`… no introduzcas ViewSets aunque parezcan más DRY, rompería la consistencia del proyecto."*

**Esa prohibición absoluta queda anulada en GATH.** La decisión **D-10** (*Uso Mixto y Acotado de Routers y ViewSets*) autoriza expresamente `DefaultRouter` + `ReadOnlyModelViewSet` para los ~35 catálogos mecánicos de solo lectura, y reserva las vistas explícitas para las acciones de negocio. El motivo es de volumen: escribir 35 pares de vista+URL para tablas que solo hacen `list`/`retrieve` produce cientos de líneas idénticas sin ninguna decisión de diseño detrás. Fuera de ese perímetro la regla heredada sigue vigente y es la norma.

---

## Serializers

Solo `serializers.ModelSerializer` y `serializers.Serializer` plano. Sin librerías de nested-writable serializers. **Un par de archivos por entidad** (`[entidad]_lectura_serializers.py` / `[entidad]_escritura_serializers.py`), no un `serializers.py` por app: es lo que hace sostenible el techo de 400 líneas por archivo (**B13**).

Los serializers **solo validan y transforman**; no contienen reglas de negocio (**B8**) — esas viven en `application/use_cases/`.

### Separar lectura de escritura

Patrón dominante: dos serializers para el mismo recurso.

```python
# infrastructure/serializers/empleado_lectura_serializers.py
class EmpleadoSerializer(serializers.ModelSerializer):
    """Lectura — anidado, expone relaciones completas."""
    cargo = CargoSerializer(read_only=True)

    class Meta:
        model = EmpleadoModel
        fields = '__all__'


# infrastructure/serializers/empleado_escritura_serializers.py
class EmpleadoCrearSerializer(serializers.ModelSerializer):
    """Escritura — PrimaryKeyRelatedField, sin anidar."""
    familiares = serializers.PrimaryKeyRelatedField(
        queryset=FamiliarModel.objects.all(), many=True, write_only=True,
    )

    class Meta:
        model = EmpleadoModel
        fields = [...]
        read_only_fields = ['id']
```

### Campos calculados con OpenAPI anotado

```python
class EmpleadoSerializer(serializers.ModelSerializer):
    @extend_schema_field(CargoResumenSerializer)
    def get_cargo(self, obj):
        return CargoResumenSerializer(obj.cargo).data

    cargo = serializers.SerializerMethodField()
```

`@extend_schema_field` es **obligatorio** en todo `SerializerMethodField` (**B25**) — sin él, drf-spectacular no puede tipar el campo en el schema OpenAPI y el contrato con el frontend queda ciego.

### Validación contextual

```python
class MovimientoSerializer(serializers.ModelSerializer):
    def validate_empleado_destino(self, value):
        usuario = self.context['request'].user
        if value.cuenta_id == usuario.id:
            raise serializers.ValidationError('No puedes registrarte un movimiento a ti mismo.')
        return value
```

Usa siempre `self.context['request'].user` para reglas que dependen de quién hace la petición — no confíes en datos del body para eso. Y para **autorizar**, nunca compares nombres de rol: eso va en `permission_classes` con `HasPermission("modulo.accion")` (**C-3**).

### ⚠️ No uses `StringRelatedField` en serializers alcanzables sin autenticación

`StringRelatedField` delega en `__str__` del modelo relacionado, que puede filtrar datos sensibles (la cédula o el correo de un empleado) en un endpoint público. Usa `SerializerMethodField` explícito para controlar exactamente qué se expone. Es la regla de seguridad **S18** del plan: *prohibido `StringRelatedField` en serializers alcanzables sin autenticación*.

### Serializar un resultado que no es un modelo ORM

Cuando el caso de uso devuelve una entidad o un DTO `@dataclass(frozen=True)` (ver [[arquitectura-onion-feature-scream]]), el serializer es `serializers.Serializer` plano, no `ModelSerializer`:

```python
class TiempoServicioSerializer(serializers.Serializer):
    cedula = serializers.CharField(help_text='Cédula en formato presentable')
    total_apn_meses = serializers.IntegerField(help_text='Total APN calculado por el dominio (D-05)')
```

Este es el caso normal en GATH, no la excepción: las vistas serializan lo que devuelve el caso de uso, no lo que devuelve el ORM.

---

## Views

Una vista de `presentation/` valida la entrada, invoca un caso de uso y serializa la salida. **No toca el ORM** (**B7**), **no arma `Response` a mano** (**B9**), **no traduce excepciones** (**B10**).

### `get_queryset()`: sí, pero solo donde el ORM está admitido en la entrega

`get_queryset()` sigue siendo el patrón de DRF para listados, y es válido en las vistas donde el plan admite ORM en la capa de entrega: los `ReadOnlyModelViewSet` de catálogos (**D-10**) y las vistas de listado mecánico. Para cualquier listado con reglas de negocio, la vista invoca un caso de uso que obtiene los datos por el puerto de repositorio (**B21**, **D-09**) y no declara `get_queryset()` en absoluto.

```python
class ProfesionViewSet(viewsets.ReadOnlyModelViewSet):        # catálogo, D-10
    serializer_class = ProfesionSerializer
    queryset = ProfesionModel.objects.all().order_by('nombre')
```

### Guard obligatorio para drf-spectacular en `get_queryset()`

Toda vista con `get_queryset()` dependiente de `self.request` necesita este guard, o la introspección de schema de drf-spectacular falla:

```python
def get_queryset(self):
    if getattr(self, 'swagger_fake_view', False):
        return Modelo.objects.none()
    return Modelo.objects.filter(cuenta=self.request.user)
```

### Validar recurso padre en rutas anidadas

En URLs tipo `personal/empleados/<cedula>/familiares/`, el padre inexistente debe dar un 404 explícito, no una lista vacía silenciosa. En GATH la comprobación pertenece al caso de uso, que consulta por el repositorio y lanza `NotFoundError` (`core/domain/exceptions.py`); `core/presentation/exception_handler.py` la traduce a 404 con el sobre C-1 (**B10**). El helper heredado sigue siendo válido en las vistas mecánicas que sí declaran queryset:

```python
class _CatalogoAnidadoListView(generics.ListAPIView):
    pagination_class = None  # ver sección Paginación

    def _padre_o_404(self, modelo, kwarg):
        try:
            return modelo.objects.get(pk=self.kwargs[kwarg])
        except modelo.DoesNotExist:
            raise Http404
```

### `APIView` para acciones de negocio

```python
class EgresarEmpleadoView(views.APIView):
    permission_classes = [IsAuthenticated, HasPermission('personal.egresar')]

    @extend_schema(request=EgresarEmpleadoSerializer,
                   responses={200: EmpleadoSerializer, 403: MensajeRespuestaSerializer})
    def post(self, request, cedula):
        serializer = EgresarEmpleadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        empleado = egresar_empleado(
            RepoEmpleadoORM(), CeleryTaskQueue(),
            EgresarEmpleadoDTO(cedula=cedula, **serializer.validated_data),
        )
        return ok(EmpleadoSerializer(empleado).data, 'Empleado egresado.')
```

#### ⚠️ Regla anulada respecto a la versión heredada

El ejemplo original de esta sección se titulaba *"`APIView` para lógica de negocio inline"* y autorizaba, dentro del método de la vista, (a) comparar el perfil del usuario (`if request.user.perfil.tipo_perfil != Perfil.TipoPerfil.GOBIERNO`) y (b) devolver `Response({'error': ...}, status=403)`.

**Las dos cosas quedan anuladas en GATH.** La comparación de perfil la anula **C-3**: la autorización se declara con `HasPermission("modulo.accion")` y quedan prohibidas las comparaciones de nombre de rol en código de negocio. El `Response` crudo lo anulan **B9** (toda respuesta sale por `envelope.py`) y **B10** (las excepciones de dominio se traducen en `core/presentation/exception_handler.py`, nunca en la vista). "Lógica de negocio inline en la vista" es además una violación directa de **B7**: si hay una regla, va a un caso de uso.

---

## Permisos

La clase `HasPermission` es transversal y vive en `core/presentation/permissions.py`; los *bindings* concretos del módulo van en `apps/[modulo]/presentation/permissions/[modulo]_permissions.py`. **No pongas permisos en `utils/` ni en carpetas genéricas** (**B17**), y no dupliques en un módulo lo que ya existe en `core/` (**B16**).

```python
permission_classes = [IsAuthenticated, HasPermission('personal.crear')]
```

Se combinan con operadores lógicos DRF (`|` = OR, `,` en la lista = AND). Los códigos son `[modulo].[accion]` y son el mismo string que el frontend evalúa con `puede("personal.crear")` (**C-3**). Ver [[autenticacion-permisos-jwt]] para el modelo de cuenta, el claim `permisos_version` y la tabla Permiso→Rol→Endpoints.

> **Nota de estado:** el backend legado tiene un único `USER/permissions.py` y endpoints de CRUD de roles protegidos solo con `IsAuthenticated` (**CRIT-12**, se cierra en B0.15). No copies ese patrón.

---

## Filtros

- `DjangoFilterBackend` + `SearchFilter` + `OrderingFilter` deben quedar declarados en `DEFAULT_FILTER_BACKENDS`; **hoy `REST_FRAMEWORK` en `SIGEP/settings.py` no declara `DEFAULT_FILTER_BACKENDS`** — es configuración pendiente, no algo que puedas asumir presente.
- GATH **sí usa `FilterSet` custom**: `RAC/filters/filters_personal.py` define `CuentaFilter`, `EmployeeFilter`, `AsigTrabajoFilter` y `EmployeeFamilyFilter`. No son un territorio inexplorado: son código existente que se migra a `presentation/filters/[entidad]_filters.py` del módulo dueño de la entidad (**R-01**: `CuentaFilter` filtra un modelo de `USER` desde `RAC`, y se reubica en `apps/identidad/presentation/filters/cuenta_filters.py`).
- `search_fields` de `SearchFilter` por vista sigue siendo el atajo válido para búsqueda simple:

```python
class CargoListCreateView(generics.ListCreateAPIView):
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombre', 'codigo']
```

Para filtros complejos (rangos de fecha, combinaciones de campos), el camino preferente es el `FilterSet` en `presentation/filters/`, no un `get_queryset()` artesanal.

### ⚠️ Regla anulada respecto a la versión heredada

La versión original afirmaba que *"no hay ni un solo `FilterSet` custom en el proyecto"*, que el filtrado real era *"manual, override de `get_queryset()`"*, y que introducir un `FilterSet` sería *"el primer caso"* y habría que documentarlo. **Eso era cierto del proyecto de origen, no de GATH**: aquí hay cuatro `FilterSet` en producción y `django-filter 25.1` en `requirements.txt`. El `get_queryset()` artesanal deja además de ser "el patrón dominante" porque choca con **B7** (la vista no toca el ORM).

---

## Paginación

- La paginación es **única y transversal**: vive en `core/presentation/pagination.py` (**B2.6**) y ningún módulo define la suya (**B11**).
- Configuración actual verificada: `PageNumberPagination` con `PAGE_SIZE = 10` en `SIGEP/settings.py` (la versión heredada decía 20; en GATH son 10).
- Se desactiva por vista (`pagination_class = None`) en catálogos cerrados y acotados — justificado con docstring: paginar una lista de ~25 estados rompería los selectores en cascada del frontend.

```python
class EstadosPorRegionView(_CatalogoAnidadoListView):
    pagination_class = None
```

---

## Manejo de errores

Tres piezas, todas en `core/presentation/`, ninguna en el módulo:

1. **Errores de validación de input** → `serializer.is_valid(raise_exception=True)`.
2. **Reglas de negocio (403/404/409/503)** → el caso de uso lanza una excepción de dominio (`NotFoundError`, `ConflictError`, `FuenteLegadaNoDisponible`) y `core/presentation/exception_handler.py` la traduce (**B10**, **B2.4**).
3. **Toda respuesta**, de éxito o de error, sale por `core/presentation/envelope.py` con `ok()` / `fail()` y el sobre **C-1** `{status, message, data}` (**B9**, **B2.3**).

```python
# En la vista: nada de try/except. El caso de uso lanza, el handler traduce.
resultado = consultar_tiempo_servicio(RepoEmpleadoORM(), cedula)
return ok(TiempoServicioSerializer(resultado).data, 'Tiempo de servicio calculado.')
```

Para documentar las respuestas de error en drf-spectacular, reusa el serializer compartido `MensajeRespuestaSerializer` de `core/presentation/schema.py` (**B1.15**) en vez de crear uno por vista. Declararlo es obligatorio en toda vista (**B24**):

```python
@extend_schema(responses={200: EmpleadoSerializer, 403: MensajeRespuestaSerializer, 409: MensajeRespuestaSerializer})
```

### ⚠️ Regla anulada respecto a la versión heredada

La versión original decía: *"**No hay `EXCEPTION_HANDLER` custom** — se usa el default de DRF"*, y mostraba el patrón de capturar la excepción en la vista y devolver `Response({'error': str(exc)}, status=503)`.

**Anulado en GATH.** La tarea **B2.4** crea `core/presentation/exception_handler.py` precisamente para eliminar ese patrón, y **ALTA-11** documenta el daño que causa hoy: las vistas legadas capturan `Exception` y devuelven `str(e)` al cliente, filtrando nombres de tablas, columnas y rutas del servidor. El mensaje que llega al usuario es seguro y genérico; el detalle técnico se correlaciona por `trace_id` en `auditoria_log` y en `errors_backend.txt` (**C-5**, **S6**), nunca en el payload HTTP.

---

## drf-spectacular

```python
@extend_schema(
    request=EmpleadoCrearSerializer,
    responses={200: EmpleadoSerializer, 403: MensajeRespuestaSerializer, 409: MensajeRespuestaSerializer},
)
def post(self, request):
    ...
```

Para vistas genéricas (`generics.*View`) que comparten prefijo de URL y colisionarían de `operationId`, anota la **clase**, no el método, con `@extend_schema_view`:

```python
@extend_schema_view(
    get=extend_schema(
        operation_id='catalogos_estados_por_region',
        summary='Lista los estados de una región',
        description='...',
    ),
)
class EstadosPorRegionView(_CatalogoAnidadoListView):
    ...
```

`operation_id` explícito en snake_case descriptivo es obligatorio cuando hay ambigüedad — anotar la clase de una vista genérica sin esto rompe el schema.

Enums repetidos entre modelos (campos `estatus`) necesitan `ENUM_NAME_OVERRIDES` en `SPECTACULAR_SETTINGS` porque drf-spectacular no resuelve `.choices` anidados automáticamente (**B1.14**, **B25**) — ver [[uso-librerias-backend]].

> Swagger/Redoc se exponen solo si `settings.EXPOSE_API_DOCS` (por defecto, solo en `DEBUG`) y restringidos por red y autenticación (**ALTA-14**).

---

## Throttling

El throttling se apoya en **`DatabaseCache` sobre PostgreSQL con política de fallo cerrado** (**D-11**): `python manage.py createcachetable`, `IGNORE_EXCEPTIONS = False` para este uso — un contador de seguridad que falla debe notarse. **Redis no se introduce en GATH en ninguna forma.** Hoy `REST_FRAMEWORK` no declara throttling alguno y la caché no está declarada (**ALTA-04**, **ALTA-17**); lo activa **B0.10** y los scopes definitivos viven en `core/presentation/throttles.py` (**B2.6**).

Para aplicar un scope custom a una vista nueva:

```python
class ReporteMasivoView(views.APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'reportes_masivos'
```

Y registra `'reportes_masivos': '<n>/<periodo>'` en `DEFAULT_THROTTLE_RATES` — **siempre con un comentario que justifique el número**; el plan lo exige explícitamente para cada scope (B0.10). Ver [[autenticacion-permisos-jwt]] (scopes de auth) y [[uso-librerias-backend]] (config global).

---

## Convención de nombres — capa de entrega

| Archivo | Contenido |
|---|---|
| `apps/[modulo]/presentation/urls.py` | `app_name` + `urlpatterns` bajo `/api/v1/[modulo]/` (**B12**) |
| `apps/[modulo]/presentation/views/[entidad]_views.py` | Las vistas de esa entidad (una entidad por archivo, **B13**) |
| `apps/[modulo]/presentation/filters/[entidad]_filters.py` | `FilterSet` de la entidad |
| `apps/[modulo]/presentation/permissions/[modulo]_permissions.py` | Bindings de `HasPermission` del módulo |
| `apps/[modulo]/infrastructure/serializers/[entidad]_{lectura,escritura}_serializers.py` | Serializers de la entidad |
| `core/presentation/envelope.py` / `exception_handler.py` / `schema.py` / `pagination.py` / `throttles.py` / `permissions.py` / `cookies.py` | Piezas transversales — nunca duplicadas por módulo (**B11**, **B16**) |

| Clase | Convención | Ejemplo GATH |
|---|---|---|
| Vista | `<Recurso><Acción>View` | `EmpleadoListView`, `CargoRetrieveUpdateView`, `EgresarEmpleadoView` |
| ViewSet de catálogo (**D-10**) | `<Recurso>ViewSet` | `ProfesionViewSet`, `ParentescoViewSet` |
| Serializer de lectura | `<Recurso>Serializer` | `EmpleadoSerializer`, `CarnetSerializer` |
| Serializer de escritura | `<Recurso>CrearSerializer` | `EmpleadoCrearSerializer`, `MovimientoCrearSerializer` |
| Filtro | `<Recurso>Filter` | `EmpleadoFilter`, `FamiliarFilter` |

> **Cookies de sesión:** los helpers viven en `core/presentation/cookies.py` y los nombres del contrato **C-2** son `dj_access` (15 min) y `dj_refresh` (8 h) — son los que ya usa el frontend (`NextJS/src/lib/api-client.ts`). **Incoherencia abierta:** `SIGEP/settings.py` declara hoy `AUTH_COOKIE: 'access_token'` y `AUTH_COOKIE_REFRESH: 'refresh_token'`; el backend aún no coincide con el contrato. Si escribes código de cookies, usa `dj_access`/`dj_refresh` y deja constancia de la divergencia.

---

## Comandos

### 1. Crear un endpoint nuevo

```
@skill crea el endpoint [descripción] en [modulo]
```

**Flujo:**
1. ¿Es un catálogo mecánico de solo lectura? → `ReadOnlyModelViewSet` + `DefaultRouter` (**D-10**) y termina aquí. ¿Es CRUD estándar? → `generics.*View`. ¿Es una acción de negocio (egresar, aprobar, emitir)? → `views.APIView`.
2. La lógica **no** va en la vista: define o reutiliza un caso de uso en `application/use_cases/` que reciba el repositorio por inyección (**D-09**, **B21**) — ver [[arquitectura-onion-feature-scream]].
3. Define serializer(s) en `infrastructure/serializers/`, separando lectura y escritura si el recurso tiene relaciones anidadas en lectura.
4. Declara `permission_classes = [IsAuthenticated, HasPermission('[modulo].[accion]')]` (**C-3**). Cero comparaciones de rol.
5. Devuelve con `ok()` / `fail()` del envelope (**B9**, **C-1**). Si la operación pesa (> 3 s o lotes), responde `202 Accepted` con `{"tarea_id": ...}` según **C-4**, encolando por el puerto `TaskQueue` dentro de `transaction.on_commit()` (**B20**, **B22**).
6. Si es sensible (auth, acciones destructivas, endpoints públicos costosos), define un `throttle_scope` con su razón documentada (**D-11**).
7. Anota con `@extend_schema`/`@extend_schema_view` incluyendo errores con `MensajeRespuestaSerializer` (**B24**) y `@extend_schema_field` en cada `SerializerMethodField` (**B25**).
8. Regístralo en `presentation/urls.py` con `name=` explícito, bajo `/api/v1/`, en minúsculas con guiones y barra final (**B12**).
9. Escribe el test de la vista con pytest + pytest-django (**D-12**) verificando código HTTP, sobre C-1 y registro en `auditoria_log` — ver [[testing-backend-django]].

### 2. Revisar un endpoint existente

```
@skill revisa el endpoint [nombre] en [modulo]
```

Verifica: ¿la vista toca el ORM o tiene reglas de negocio (**B7**)? ¿arma `Response` crudo en vez de usar el envelope (**B9**)? ¿traduce excepciones a mano (**B10**)? ¿autoriza con `HasPermission("modulo.accion")` o compara nombres de rol (**C-3**)? ¿usa `get_queryset()` con el guard `swagger_fake_view` donde el ORM está admitido? ¿el serializer evita `StringRelatedField` en contexto alcanzable sin autenticación (**S18**)? ¿tiene `@extend_schema` con los códigos de error reales y `MensajeRespuestaSerializer` (**B24**)? ¿es un `ViewSet` fuera del perímetro de catálogos de solo lectura (**D-10**)? ¿el archivo pasa de 400 líneas (**B13**)?
