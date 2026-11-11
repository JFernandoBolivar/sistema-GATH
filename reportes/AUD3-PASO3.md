# AUD3 PASO 3 — API y validación de entradas

**Skills usadas:** `patrones-drf-implementacion` (versión del proyecto),
`validacion-input-protegido`.
**Método:** inventario de las 327 vistas y de los serializers, `grep` de
permisos, throttling, paginación, subidas y `request.data`, y lectura de los
archivos señalados. Sin escrituras en la base.

## Resumen

- Las **327 vistas** son `APIView` explícitas; no hay `ViewSet` ni
  `generics.*`, coherente con **D-10** (solo catálogos mecánicos podrían usar
  router y aquí no se usó).
- **Ninguna** vista queda sin `permission_classes` o `get_permissions`; las 8
  públicas (`AllowAny`) son las previstas: login/refresh/reset, ficha pública
  del carnet (+salud y credencial externa) y verificación de constancia.
- El sobre **C-1** y los errores **RFC 9457** se emiten en
  `core/presentation/`; los errores por campo llegan en `data.errores` (T3/T4).
- Throttling por defecto en todas las vistas (`anon` 60/min, `user` 300/min,
  `ScopedRateThrottle`) con ámbitos propios para login (30/min), reset (10/min),
  verificación pública (30/min) y la integración del carnet (600/min por clave).
- Se corrigieron dos huecos reales: el import de invitados aceptaba cualquier
  archivo y sin tope de tamaño (03-03), y 4 serializers no anotaban sus
  `SerializerMethodField` para OpenAPI (03-04).

## Hallazgos y correcciones

### 03-01 — Vistas explícitas (INFO, verificado)

327 `APIView`, 0 `generics.*` y 0 `ViewSet`. La excepción de D-10 no se usó, lo
que es válido: la regla permite routers para catálogos, no los exige.

### 03-02 — Permisos por acción (INFO, verificado)

0 vistas sin `permission_classes`/`get_permissions`. Las públicas son:

| Vista | Ámbito |
| ----- | ------ |
| `auth_views` login/refresh/reset (4) | `login`, `refresh`, `password_reset` |
| `carnetizacion_views` ficha QR y salud (2) | `AnonRateThrottle` + `UserRateThrottle` |
| `credenciales_externas_views` consulta pública | `AnonRateThrottle` + `UserRateThrottle` |
| `verificacion_publica_views` constancia | `fe_de_vida_verificacion_publica` |

### 03-03 — Import de invitados sin límite ni extensión (MEDIA, **corregido**)

`EventoInvitadosImportarView` leía cualquier `archivo` entero en memoria
(`archivo.read()`), aceptaba cualquier extensión (todo lo que no fuera `.xlsx`
se decodificaba como CSV) y no tenía tope de tamaño: un archivo grande podía
agotar la memoria del worker.

- Se añadió el tope `MAX_BYTES_DOCUMENTO` (10 MB) y la lista `.xlsx`/`.csv`,
  con 400 y mensaje claro.
- Prueba nueva
  `test_importar_invitados_rechaza_extensiones_y_tamanos_no_admitidos` en
  `tests/integration/carnetizacion/test_api_o45.py` (extensión no admitida y
  archivo de más de 10 MB).

### 03-04 — `SerializerMethodField` sin tipar en OpenAPI (MEDIA, **corregido**)

La regla **B25** exige `@extend_schema_field` en todo campo calculado. Faltaba
en cuatro archivos:

| Archivo | Campos |
| ------- | ------ |
| `configuracion/infrastructure/serializers/parametros_serializers.py` | `depende_de` → `DictField(allow_null=True)` |
| `personal/presentation/serializers/catalogos_soporte_serializers.py` | `categoria`, `tipo_prenda`, `region` → `DictField(allow_null=True)` |
| `personal/presentation/serializers/reportes_error_serializers.py` | `dato`, `dato_etiqueta`, `estado` → `CharField` |
| `exportaciones/presentation/serializers/exportaciones_serializers.py` | `estado` (char), `total_encontrados`/`limite` (int null), `truncado` (bool) |

No cambia la respuesta JSON; solo el esquema OpenAPI (`make esquema`).

### 03-05 — La paginación global no aplica a las vistas (MEDIA, a decisión)

`GATH/settings.py` configura `PageNumberPagination` con `PAGE_SIZE=10`, pero
**solo actúa sobre vistas genéricas**. Al ser todas `APIView`, cada listado
decide: auditoría y configuración paginan a mano; otros devuelven la lista
completa. El caso más pesado es `CensoConsultarView` sin cédula
(`consultar_todos_censos`), que carga todos los censados con sus respuestas.

Paginar esos endpoints cambia el contrato que consume el frontend
(`ok(lista)` → `ok({results, count, ...})`), así que va a decisión. Propuesta:
un helper `paginar(queryset, request)` en `core/presentation/` y migrar por
módulos, empezando por censos y los listados de exportación.

### 03-06 — Regla de negocio en un serializer (BAJA, documentado)

`familiares_serializers.validate()` consulta el titular con
`LectorValidacionFamiliarORM` para validar parentesco/cédulas. **B8** pide que
las reglas vivan en `application/`; aquí es validación cruzada con BD y
moverla cambia el flujo de alta/edición de familiares (que tiene sus propias
pruebas). Queda anotado para el paso de familiares.

### 03-07 — Throttling (INFO, verificado)

`DEFAULT_THROTTLE_CLASSES` incluye anónimo, usuario, por ámbito y los throttles
de subida y exportación. Los ámbitos están en `DEFAULT_THROTTLE_RATES` y son
configurables por entorno. No hay endpoint público sin throttle.

### 03-08 — Errores y validación por campo (INFO, verificado)

`core/presentation/exception_handler.py` conserva `data.errores`
(`{campo: [mensajes]}`) para que el formulario marque el campo; el frontend lo
consume con `aplicarErroresServidor` (T4). Las validaciones de cédula, teléfono,
nombre, correo y carnet usan los validadores de `core/domain` en los
serializers de escritura.

### 03-09 — Subidas de archivo (INFO, verificado)

Fotos y soportes pasan por `validar_archivo` (tamaño, extensión y **magic
bytes**, sin confiar en el `Content-Type`) y se guardan con `clave_segura`
(UUID, sin el nombre original). El único upload que no lo hacía era el import de
invitados (03-03).

### 03-10 — `request.data` en escrituras (INFO, verificado)

Las escrituras con formulario usan serializer; las que leen `request.data`
directamente son acciones con payload simple (ids, `confirmar`, colores de un
evento) o `FormData` de importación, y no asignan campos arbitrarios a un
modelo (sin mass assignment).

### 03-11 — Validación en el frontend (INFO, verificado)

Los formularios usan `react-hook-form` + `zodResolver`; las constantes de
`shared/validation` (regex de cédula/teléfono, límites de texto, sanitize) se
repiten a propósito para dar feedback, y la validación que protege es la del
servidor (revalidación en la Server Action). Ver PASO 2.

## Verificación de este paso

- `python -m compileall` de los archivos tocados: OK.
- `npx tsc --noEmit` y `npx eslint src --quiet` del frontend: 0 errores (PASO 2).
- `pytest tests/integration/carnetizacion/test_api_o45.py tests/unit/configuracion
  tests/unit/personal tests/integration/personal/test_reportes_error_views.py
  tests/integration/exportaciones --create-db`: **267 passed** (incluye las dos
  pruebas nuevas del import de invitados).
- `npx next build`: exit 0 tras las correcciones del PASO 2.
