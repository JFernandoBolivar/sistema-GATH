# Correcciones de la revisión del commit e481320 — G1–G4 (reportes)

Fecha: 2026-10-30 · Rama: `feature/fe-de-vida-pasivos` · Sin commit ni push.
Alcance: hallazgos A1, M1–M8 y B1–B6 de la revisión de código del commit `e481320`, más la **segunda
ronda** (ALTA 1: M7 fallaba abierto; MEDIA 2-3; B4, B5 y B7).

## Resumen por hallazgo

| ID | Qué se corrigió | Archivos |
|---|---|---|
| **A1** | Valores extremos del formulario dan **400** (antes 500/`ValueError`): edad 0–150, enteros solo dígitos y `0 < n < 2³¹`, decimales finitos y acotados; `ArithmeticError`/`OverflowError` → `ValidationError`. Límites como constantes de dominio | `apps/reportes/domain/services/filtros_reporte_personal.py` |
| **M1** | El mensaje real del backend en un 400/403/5xx ya llega a la UI (antes «Error 400 al descargar el recurso»): `requestBlobConRespuesta` usa `extractErrorMessage` y el proxy lo propaga en `{ error }` | `shared/infrastructure/http/fetcher-api.ts`, `app/api/reports/pdf/route.ts` |
| **M2** | El conteo agrupa empleados, no filas: `Count('pk', distinct=True)` | `apps/reportes/infrastructure/repositories/repo_reportes_orm.py` |
| **M3** | Agrupar por cargo / cargo específico / grado devuelve el **texto del catálogo**, no el id de la FK | `core/infrastructure/report_field_registry.py` |
| **M4** | Hook `usePdfBlobUrl`: revoca el `blob:` al reemplazar, al limpiar y al desmontar; usado en los 4 formularios | `ui/hooks/use-pdf-blob-url.ts` (+ test), 4 componentes |
| **M5** | Asignaciones y antecedentes se piden **solo para la página materializada**, en lotes (`TAMANO_DE_LOTE`): la subconsulta con `LIMIT` sin `ORDER BY` traía datos de otros empleados en reportes truncados. Orden con desempate por cédula. Tope propio del PDF `REPORTES_MAX_FILAS_PDF` (nunca «sin tope»); una sola fuente del límite | `repo_reportes_orm.py`, `infrastructure/limites_reporte.py` (nuevo), `GATH/settings.py`, vistas |
| **M7** | Filtrar por estructura organizativa exige `organizacion.ver` **en el servidor**: 403 «No tiene permiso para filtrar por estructura organizativa». La vista resuelve el permiso con el motor IAM real (`usuario_tiene_permiso`: deny prioritario y comodines) y entrega un booleano; la regla vive en el dominio. Se eliminó `permisos_de_usuario`, que evaluaba solo `allow` (fallo abierto) | `filtros_reporte_personal.py`, `core/presentation/permissions.py`, `domain/value_objects/permisos_reportes.py`, caso de uso y vistas |
| **M8** | «Fecha APN desde/hasta» oculto en el formulario; el mapeo del backend se conserva y «Años APN» no se toca | `ui/components/report-employees.tsx` |
| **B1** | `SessionExpiredError` → 401 (antes 500) | `app/api/reports/pdf/route.ts` |
| **B2** | Categoría desconocida → 400 (antes devolvía el reporte de personal) | `app/api/reports/pdf/route.ts` |
| **B3** | `puedeGenerarReportePdf` (botón desactivado + aviso) también en report-family y report-leaving | `report-family.tsx`, `report-leaving.tsx` |
| **B4** | Sentencias separadas en `report-leaving.tsx` y Prettier aplicado a los archivos tocados | 4 componentes, `route.ts`, `fetcher-api.ts`, spec E2E |
| **B5** | `estructuraOrganizativa` dentro de `PERMISO_REPORTES`; sin literales `"reportes.*"` sueltos | `domain/value-objects/permisos-reportes.ts`, `application/use-cases/permisos-reporte.ts` |
| **B6** | Un solo mensaje de «Tipo de reporte no válido», en la entidad | `domain/services/filtros_reporte_personal.py` |

## Decisiones y notas técnicas

- **A1, rango de enteros:** los identificadores exigen `0 < n < 2³¹` (límite de `int4`); la edad usa además
  su propio rango `0..150`. `"1_0"`, `10.0`, `0x10`, `-5` y `0` se rechazan; una cadena de miles de dígitos
  también (Python limita `int()` a ~4300 dígitos y antes reventaba con `ValueError`).
- **M3:** `DenominacionCargoModel.cargo`, `DenominacionCargoEspecificoModel.cargo` y `GradoModel.grado` son
  los campos de texto reales de las tablas legadas, así que las rutas del registro pasan a
  `assignments__denominacioncargoid__cargo`, `...especifico...__cargo` y `assignments__gradoid__grado`.
- **M5, subconsulta:** `AsigTrabajo.employee` apunta a la **cédula** (`to_field`), pero
  `AntecedenteServicio.empleado` apunta a la **PK** de `Employee`. Por eso se usan dos subconsultas
  (`values('cedulaidentidad')` y `values('pk')`), sin ordenar y con el mismo `LIMIT` de la página.
  De paso quedó corregido que `fecha_ingreso` no se encontraba (el diccionario de antecedentes estaba
  indexado por una PK y se consultaba por cédula): el reporte mostraba «N/A» en esa columna.
- **M5, tope del PDF:** `REPORTES_MAX_FILAS_PDF` se define en `settings` con `max(valor, 1)`, de modo que
  aunque el operador configure `0` el PDF nunca se genera sin tope. El JSON/Excel mantiene
  `REPORTES_MAX_FILAS` (`0` = sin tope). La UI ya avisaba del truncado con `X-Reporte-*` y sigue igual.
- **M7:** el caso de uso recibe `permisos` (los códigos efectivos del actor, resueltos en
  `core/presentation/permissions.permisos_de_usuario`) y el dominio decide. La vista no contiene la regla.
- **M8:** el filtro se oculta, no se elimina del contrato: el mapeo `fecha_apn_*` se conserva para cuando
  RRHH defina qué significa. «Años APN» (`total_anos_apn`) no se tocó.
- **B6:** la entidad `ConsultaReportePersonal` ya validaba `tipo_reporte`; el servicio dejó de duplicarlo.

## Pruebas

Backend (código montado):

```
docker compose run --rm --no-deps -v "C:/.../BACKEND:/app/Django" \
  --entrypoint python django -m pytest -q -p no:cacheprovider
=> 964 passed  (línea base 928; +36 propios)
```

De esos 964, **75** son del módulo de reportes (antes 39).

- `tests/unit/reportes/test_filtros_reporte_personal.py`: 30 filtros, edad/APN/fechas, **A1** (edad 3000 /
  151 / -1 / 0 y 150 válidos, `_restar_anios` imposible, `NaN`/`sNaN`/`±Infinity`, `1e999`, `"1_0"`,
  2³¹, cadena de 5000 dígitos), **M7** (403 con y sin permiso, otros filtros pasan sin él), **B6** y **M3**
  (rutas de agrupación).
- `tests/unit/reportes/test_reportes.py`: el caso de uso propaga `limite` y permisos (403 sin tocar el repo).
- `tests/unit/reportes/test_reporte_personal_view.py`: parámetros escalares, permisos al caso de uso y
  tope distinto para PDF/JSON.
- `tests/integration/reportes/test_reporte_personal_orm.py`: filtros reales, **M2** (dos asignaciones → un
  empleado), **M3** (conteo con texto del catálogo), **M5** (tope configurable) y **M7**.

Frontend:

```
npx vitest run   => 529 passed / 89 archivos (línea base 520; +4 propios del hook)
npx eslint .     => 0 errors (104 warnings preexistentes)
npx tsc --noEmit => sin errores
```

- `ui/hooks/use-pdf-blob-url.test.tsx` (4): crea, revoca al reemplazar, revoca al limpiar, revoca al desmontar.

Contratos: `lint-imports` → **82 contratos, 0 rotos**.

## Verificación en vivo (Playwright)

Imágenes reconstruidas con `docker compose build django nextjs; if ($?) { docker compose up -d ... }` y
`e2e/reportes-trabajador.spec.ts` ampliado:

- **A1:** `edad_min=3000`, `apn_min=NaN`, `apn_min=Infinity`, `sexo_id=1_0`, `sexo_id=2147483648` → 400 con
  mensaje; `edad_min=150` → 200.
- **M1:** el proxy devuelve el mensaje del backend en un 400 (contiene `campo_inventado`, no «Error 400 al
  descargar el recurso») y la UI muestra ese texto en el toast sin perder los filtros.
- **M7:** con `organizacion.ver` los filtros funcionan; sin el permiso (Bienestar) el backend responde 403
  «No tiene permiso para filtrar por estructura organizativa», y sin esos filtros el mismo perfil obtiene 200.
- **M8:** «Fecha De APN Desde/Hasta» no aparece en el formulario; «Años Mínimos/Máximos En La APN» siguen.

Comprobaciones directas contra el backend en vivo (misma sesión): `conteo&agrupar_por=cargo` devuelve
`ANALISTA` (297) y no un id; `agrupar_por=grado` devuelve el texto del catálogo (`99`, cuyos ids reales son
3, 4, 5…); `sexo_id=1_0` → 400 «debe ser un número entero»; `apn_min=NaN` → 400 «debe ser un número
finito»; `personal-activo/pdf/?edad_min=70` → 200 con `X-Reporte-Limite: 5000`.

Resultado: **14/14** pruebas E2E en verde sobre las imágenes reconstruidas
(`docker compose build django nextjs; if ($?) { docker compose up -d django celery_worker celery_beat nextjs }`;
`next build` compiló y pasó TypeScript).

## Pendientes

- G9 (antigüedad APN oficial 30/360) y G10 (definición de «Fecha APN» por RRHH) siguen abiertos en el plan;
  M8 es la medida provisional de G10.
- Los reportes de pasivos, códigos, familiares y vacantes conservan su tope fijo de 500 en el repositorio
  (fuera del alcance de esta revisión).
- `/auth/me/` sigue entregando los códigos del **rol** (`obtener_permisos_de_cuenta` no aplica deny ni
  excepciones individuales), así que la UI puede mostrar acciones que el servidor rechaza con 403. El
  servidor es ahora la única fuente de verdad (M7); unificar `/me/` con el motor IAM queda como deuda
  aparte.

## Segunda ronda (revisión independiente de estas correcciones)

### ALTA 1 — M7 fallaba abierto

- **Causa:** `permisos_de_usuario` devolvía `politica.allow` y el dominio comprobaba
  `PERMISO in permisos`: un deny individual no se veía (fail-open) y un `*` o `organizacion.*` tampoco
  (fail-closed indebido). `HasPermission` sí usaba `evaluar_permiso`.
- **Corrección:** se elimina `permisos_de_usuario`; la vista resuelve
  `usuario_tiene_permiso(request.user, PERMISO_ESTRUCTURA_ORGANIZATIVA)` (mismo camino que
  `HasPermission`, incluido el `user.tiene_permiso` legado) y pasa `puede_filtrar_estructura: bool` al
  caso de uso. El dominio decide con ese booleano y sigue siendo el único que aplica la regla.
- **Tests** (`tests/unit/reportes/test_permiso_estructura_iam.py`, con `resolver_politica_actor` +
  `evaluar_permiso` reales, no frozensets fabricados): allow directo, allow `*`, allow `organizacion.*`,
  deny individual sobre allow de rol, deny sobre `*`, deny por módulo, sin permiso, y el caso sin filtros
  de estructura (pasa aunque falte el permiso).
- **En vivo:** cuenta temporal con rol ADMINISTRADOR (allow de rol con `organizacion.ver`) + deny
  individual del mismo código aplicado con `RepoPermisosORM.guardar_override_usuario` (mecanismo del
  sistema). `?dependencia_id=1` → **403**; `?sexo_id=2` → **200**. E2E `reportes-trabajador.spec.ts`
  (test «el deny individual gana al allow del rol»).

**Datos de la verificación para deshacer** (base local):
- `Employee` cédula `88888888` («USUARIO PRUEBA M7 DENY», correo `usuario.prueba.m7@conatel.gob.ve`),
  `USER_cuenta` pk 1066 (rol 1, contraseña inicial = cédula según la política D8).
- `identidad_usuario_permiso` con `cedula = '88888888'` y deny `['organizacion.ver']`.
- Deshacer: `UsuarioPermisoModel.objects.filter(cedula='88888888').delete()`, luego desactivar o borrar la
  cuenta 1066 y el empleado 88888888. No se tocó ninguna cuenta E2E protegida.

### MEDIA 2 — la página truncada perdía sus datos

- **Causa:** la subconsulta `qs.order_by().values(...)[:limite]` aplicaba el `LIMIT` **sin `ORDER BY`**:
  el conjunto podía no coincidir con la página y las filas salían con «S/D» y «N/A».
- **Corrección:** se materializa la página (mismo orden `apellidos, nombres, cedulaidentidad`) y las
  asignaciones/antecedentes se piden con `empleado__in=[...]` sobre **esa** lista, en lotes de
  `TAMANO_DE_LOTE = 500`.
- **Test:** `test_un_reporte_truncado_trae_los_datos_de_su_propia_pagina` (empleado que ordena primero
  pero se inserta al final; con `limite=1` su fila trae código y fecha correctos).

### MEDIA 3 — fecha de ingreso = reingreso más reciente

- Antes dependía del orden en que el ORM devolvía los antecedentes. Ahora es explícito:
  `Max('fecha_ingreso')` por empleado, con el comentario de la decisión.
- **Tests:** dos antecedentes (2015 y 2018) → muestra **01/06/2018**; sin antecedentes → «N/A»; y la
  columna se llena (antes siempre «N/A» por el cruce PK/cédula).
- **En vivo:** los dos empleados de la base local con dos antecedentes muestran su reingreso más reciente
  (`01/09/2026` y `07/09/2024`, iguales al `Max` de la BD) y su código de cargo.

### BAJA

- **B4:** `limite` obligatorio (sin `= 0`) en `generar_reporte_personal` y en el puerto `RepoReportes`.
- **B5:** los enteros exigen dígitos ASCII (`texto.isascii() and texto.isdigit()`); tests con `١٢٣`,
  `１２３` y `³`.
- **B7:** el test del hook afirma que al reemplazar se revoca la URL anterior **y no la nueva**.

### Pruebas de la segunda ronda

```
pytest (backend, código montado)  => 990 passed  (base 964; +14 propios de reportes)
npx vitest run                    => 549 passed / 91 archivos (base 529)
npx eslint .                      => 0 errors
npx tsc --noEmit                  => sin errores
lint-imports                      => 82 contratos, 0 rotos
Playwright (reportes-trabajador)  => 15/15 (incluye el deny individual y los casos A1/M1/M7/M8)
```

Imágenes: `docker compose build django nextjs; if ($?) { docker compose up -d ... }`. `django` se reconstruyó
y reinició; `nextjs` se reconstruyó (`next build` compiló y pasó TypeScript) y el contenedor quedó sirviendo
la imagen nueva. La corrida E2E completa dio 13/15 en un momento de carga alta del equipo (dos tests
fallaron en el `fill` del login, con la app respondiendo lento); los dos se repitieron aislados y pasaron
(1.5 m y 46 s), sin cambios de código.

Nota: durante esta ronda otro agente trabajaba en `fe_de_vida` en el mismo árbol; los totales de las
suites incluyen sus pruebas (backend +12, Vitest +20). `tsc` falló transitoriamente solo por sus archivos y
quedó limpio al terminar su cambio; mis archivos nunca tuvieron errores de tipos ni de lint.
