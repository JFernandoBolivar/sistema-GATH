# Reporte D3, D4, D7 y D8 — Usuarios, roles y ciclo de vida de cuentas

Fecha: 2026-10-31. Rama `feature/fe-de-vida-pasivos`. Sin commit ni push.

Alcance: filas **D3**, **D4**, **D7** y **D8** de
`PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md`.

---

## D3 — `departamento` deprecado en identidad

**Qué se hizo**

- Se retiró `departamento_id` de los serializers de lectura y escritura de
  cuentas, de los DTO de alta/edición, de la entidad de dominio `Cuenta`, del
  puerto `RepoCuentas`, del repositorio ORM (listado, alta y guardado), de los
  filtros del listado y de las vistas de identidad.
- La columna legada `USER_cuenta.departamento_id` y `DepartamentoModel`
  (`managed=False`, tabla `USER_departaments`) **no se migran ni se borran**.
  El catálogo `GET /api/v1/identidad/departamentos/` se conserva como dato
  administrativo para otros módulos, pero ya no participa en la autorización:
  esta depende solo del rol y de los permisos efectivos (`HasPermission` +
  motor IAM).
- El frontend dejó de leer/escribir el departamento en usuarios (listado,
  alta, detalle y sidebar).

**Test de contrato**

- `test_listado_incluye_ultimo_acceso_y_password_inicial_pendiente_sin_departamento`
  y `test_detalle_calcula_el_permiso_efectivo_en_servidor_y_el_deny_gana`
  comprueban que la respuesta no incluye `departamento_id`.

---

## D4 — Usuarios y roles

### Listado

- Paginación en el servidor: 10 por defecto, tope 50 (`PaginacionUsuarios`).
- Filtros: cédula, nombre, correo, rol, estado activo/inactivo y condición
  ACTIVO/PASIVO (derivada de la asignación laboral).
- Columnas: cédula, nombre, correo de acceso, rol, estado, último acceso y
  contraseña inicial pendiente.
- Endpoint: `GET /api/v1/identidad/usuarios/` → `{resultados, total, pagina,
  tamano, total_paginas}`.

### Detalle

- Endpoint: `GET /api/v1/identidad/usuarios/{id}/detalle/`.
- Cambiar rol con motivo (`PATCH /usuarios/{id}/`).
- Activar/desactivar con motivo obligatorio (`PATCH /usuarios/{id}/estado/`).
- «Restablecer acceso» (D8) y «Cambiar correo de acceso» (D8).
- Overrides individuales allow/deny con motivo
  (`PUT /usuarios/{id}/permisos-individuales/`).
- **Permiso efectivo calculado en el servidor**: el detalle devuelve
  `permisos.del_rol`, `allow`, `deny` y `efectivos`; `efectivos` se obtiene
  evaluando cada código del catálogo con `UsuarioPermisos.tiene_permiso`
  (motor IAM, `evaluar_permiso`), por lo que un `deny` siempre gana.

### Matriz de permisos por rol

- `GET /api/v1/identidad/roles/matriz/`: filas = permisos con código, nombre y
  módulo; columnas = roles con sus códigos.
- `PUT /api/v1/identidad/roles/{id}/permisos/`: reemplaza la fila del rol;
  exige `confirmar: true` y motivo de al menos 10 caracteres.
- Solo `identidad.asignar_permisos` (ADMINISTRADOR) edita; `AUDITOR` y cualquier
  rol con `identidad.ver_roles` solo consultan.
- Cada cambio guarda antes/después y motivo en `AuditoriaLog`, e incrementa
  `permisos_version` de todas las cuentas del rol (invalida sus sesiones).

### Permisos del seed (idempotente)

Se agregaron al catálogo y a la matriz:

- `identidad.listar_permisos` (catálogo completo).
- `identidad.consultar_permisos` (permiso efectivo de una cuenta).
- `identidad.gestionar_permisos_individuales` (overrides).

`identidad.asignar_permisos` ya existía y es el permiso de la matriz.
ADMINISTRADOR recibe todos; AUDITOR recibe solo lectura de usuarios/roles/
catálogo/permiso efectivo; el resto no recibe edición.

---

## D7 — Estructura de roles confirmada

- `JEFE_RRHH` se crea de forma idempotente en `seed_permisos` (consulta
  personal, pasivos, movimientos, reportes y cobertura de fe de vida; no
  administra usuarios ni la matriz).
- `AUDITOR` se amplió a lectura de usuarios, roles, catálogo y permiso efectivo,
  sin edición.
- `ADMIN_CAPTACION`/`ANALISTA_CAPTACION` siguen como futuro y no se crean.
- Test: `test_d7_estructura_de_roles_jefe_rrhh_y_auditor_solo_lectura`.

---

## D8 — Correo de acceso

La pantalla pendiente quedó integrada en el detalle de usuario (D4): RRHH elige
correo institucional, alternativo del trabajador u otro; el backend avisa al
correo elegido y crea la cuenta si el pasivo/sobreviviente no la tenía
(`POST /api/v1/identidad/cuentas/{cedula}/correo-acceso/`).
«Restablecer acceso» sigue usando los días configurados en el parámetro
`plazos.password_inicial_dias`.

---

## Reglas de seguridad a)–g): dónde viven y con qué test

| Regla | Implementación | Test |
|---|---|---|
| a) Nadie se quita su acceso ni desactiva su cuenta | `validar_cambio_estado` (dominio) + vista de estado | `test_a_no_puede_desactivar_su_propia_cuenta`, `test_a_nadie_desactiva_su_propia_cuenta` |
| b) Al menos una cuenta activa con la matriz (409) | `exigir_al_menos_un_editor_matriz` (dominio) + conteo con motor IAM antes/después | `test_b_rechaza_el_cambio_que_deja_cero_editores`, `test_b_no_se_puede_quedar_sin_editores_de_la_matriz`, `test_b_tampoco_se_puede_degradar_al_ultimo_editor`, `test_la_matriz_no_puede_dejar_el_sistema_sin_editores` |
| c) Nadie se otorga overrides ni se cambia su rol | `validar_cambio_rol` y `validar_override_propio` (dominio) | `test_c_nadie_se_cambia_su_propio_rol`, `test_c_nadie_se_otorga_permisos_individuales`, tests unitarios de las funciones |
| d) Un deny siempre gana | motor IAM existente (`evaluar_permiso`), reutilizado por el detalle y por `resolver_permisos`/`obtener_permisos_de_cuenta`: los códigos denegados se filtran también de la sesión del frontend; no se reimplementa | `test_detalle_calcula_el_permiso_efectivo_en_servidor_y_el_deny_gana`, `test_un_deny_explicito_no_aparece_en_los_permisos_efectivos`, E2E de override deny |
| e) Todo cambio va a AuditoriaLog (append-only) con actor, motivo, antes/después, IP y dispositivo | `registrar_auditoria` en las vistas de rol, estado, overrides y matriz | `test_los_overrides_se_guardan_auditan_y_suben_la_version`, `test_la_matriz_se_lee_y_se_edita_con_auditoria_y_version` |
| f) Nunca se devuelven hashes ni tokens | serializers solo exponen campos de la entidad; el detalle no incluye contraseña/tokens | `test_las_respuestas_no_devuelven_hash_ni_tokens` |
| g) Reglas a)–c) en el dominio, no en la vista ni el frontend | `apps/identidad/domain/services/reglas_administracion.py` | `tests/unit/identidad/test_reglas_administracion.py` |

Además, cada cambio de rol/estado/override/matriz se ejecuta dentro de
`transaction.atomic()`: si la auditoría o la regla b) fallan, no queda el
cambio a medias.

---

## Pruebas y números

| Verificación | Resultado |
|---|---|
| Backend completo | **1127 passed** (base 1103; +24) |
| Backend focalizado (reglas, D4, A1/A2/M2/M3/M4, concurrencia, seed) | **52 passed** |
| Vitest | **97 archivos / 571 pruebas** (base 570; +1) |
| `tsc --noEmit` | sin errores |
| `eslint .` | **0 errores** (79 avisos preexistentes) |
| `next build` | compila y genera `/usuarios`, `/usuarios/[id]`, `/usuarios/matriz` |
| `lint-imports` | **82 kept, 0 broken** |
| `makemigrations --check` | **No changes detected** |

Tests nuevos de backend:

- `tests/unit/identidad/test_reglas_administracion.py` (18).
- `tests/unit/identidad/test_seed_roles_bienestar.py` → un test D7 más.
- `tests/unit/identidad/test_resolver_permisos.py` → un test de deny explícito.
- `tests/integration/identidad/test_administracion_usuarios_api.py` (18):
  paginación/tope, filtros, condición, columnas, detalle, deny, sin hashes,
  reglas a/b/c, overrides, auditoría, `permisos_version`, matriz y permisos.
- `tests/integration/identidad/test_seguridad_cuentas_api.py` (11): A1/A2 con
  HasPermission real (analista 403 sobre admin, 200 sobre cuenta básica), M2,
  M3 (incluido rol inexistente 400) y M4, con sus filas `DENIED`.
- `tests/integration/identidad/test_concurrencia_editores.py` (1): dos
  desactivaciones concurrentes con advisory lock dejan un editor.
- `tests/unit/identidad/test_seed_roles_bienestar.py`: tres tests M6 (permiso
  retirado que no vuelve, permiso nuevo auditado, seed idempotente).

Frontend:

- `listar-usuarios.test.ts` (5) y `gestionar-usuario.test.ts` (2).
- `identidad-pbac.test.ts` (2).
- E2E `e2e/usuarios-roles-d4.spec.ts`: listado/filtros, detalle, override deny
  visible y restaurado, matriz con confirmación, perfil sin permiso y axe.

Corrección adicional en el camino: `resolver_permisos` y
`obtener_permisos_de_cuenta` devolvían el `allow` compilado sin descontar el
`deny`; ahora filtran con `evaluar_permiso`, de modo que un deny tampoco viaja
en la sesión de NextAuth. Es lo que permite que el E2E de «perfil sin permiso»
vea el aviso en lugar de recibir un 403 al llamar al listado.

---

## Verificación en vivo

Se reconstruyeron las imágenes (`docker compose build django nextjs`), se
levantaron `django`, `celery_worker`, `celery_beat` y `nextjs`, se aplicaron
las migraciones (ninguna nueva) y se ejecutó `seed_permisos`:

- 26 asignaciones nuevas; `JEFE_RRHH` creado con ID 18 (19 permisos);
  `AUDITOR` con 8 permisos (lectura); 8 cuentas de roles con matriz modificada
  recibieron `permisos_version` nuevo (sesiones invalidadas).

Con Playwright (Chromium, `http://localhost:3001`):

- **Listado:** filtros de cédula, nombre, correo, rol, estado y condición;
  columnas nuevas; paginación «Página 1 de N»; filtro por la cédula de prueba
  devuelve la fila correcta. Sin violaciones graves de axe.
- **Detalle:** rol, estado, correo de acceso, último acceso, contraseña inicial
  y permiso efectivo calculado en servidor. Sin violaciones graves de axe.
- **Override deny:** se denegó `identidad.ver_usuarios` a la cuenta de prueba;
  el contador del permiso efectivo bajó en 1 y el permiso desapareció de la
  lista; al retirar el deny volvió al valor original. Sin violaciones graves.
- **Matriz:** se abrió, se verificaron las filas por módulo y las columnas por
  rol, y el diálogo de confirmación con motivo; se canceló sin guardar cambios.
- **Perfil sin permiso:** se denegaron temporalmente `identidad.ver_usuarios` y
  `identidad.ver_roles` a la cuenta de prueba; al entrar con ella, `/usuarios`
  y `/usuarios/matriz` mostraron el aviso de permiso y ninguna tabla/checkbox.
  Después se restauró la cuenta.
- Regresión D9/D10 no se volvió a ejecutar en esta ronda; los cambios no tocan
  esas pantallas.

- **A1/A2 (revisión de seguridad):** con una cuenta ANALISTA real, el detalle de
  una cuenta ADMINISTRADORA devolvió 403 al intentar «Restablecer acceso» y
  «Cambiar correo de acceso»; con el administrador, las mismas acciones sobre
  una cuenta AUTOGESTION respondieron 200. Se verificaron las filas `DENIED` en
  `AuditoriaLog`.
- **Seed M6:** se ejecutó dos veces; la matriz quedó en 311 filas antes y
  después y el comando reportó «Total nuevas asignaciones: 0».
Resultado E2E: **5/5** en D4 y **2/2** en A1/A2 (en vivo).

## Datos de prueba y limpieza

- Se eliminaron, con el mecanismo del sistema y tras verificar que no tenían
  movimientos, solicitudes ni otras dependencias (solo cuenta, overrides,
  versiones y, en un caso, contraseña inicial):
  - cuenta temporal **88888888** (id 1066), su override en
    `identidad_usuario_permiso`, su `permisos_version` y el `Employee` PK 11945;
  - cuenta de prueba **1068** (99999901), su `permisos_version` y el `Employee`
    PK 11947;
  - cuentas temporales de la verificación A1/A2 **1070** (99999902, rol
    ADMINISTRADOR) y **1071** (99999903, rol AUTOGESTION), con sus
    `permisos_version`/`password_inicial` y `Employee` PK 11948/11949.
- La matriz no se modificó en vivo (solo se abrió el diálogo y se canceló); el
  seed se ejecutó dos veces y el conteo quedó igual (311 filas de matriz).
- Auditoría: los registros de las pruebas (incluidos los `DENIED` de A1/A2 y
  los cambios del seed) se conservan; la bitácora es append-only. No se borró
  ningún `AuditoriaLog`.

## Correcciones de seguridad (revisión 2026-11-01)

### A1 — «Restablecer acceso» de cuentas administrativas

- **Archivos:** `domain/services/reglas_administracion.py`
  (`PERMISOS_ADMINISTRACION`, `es_cuenta_administrativa`, `es_administrador`,
  `validar_operacion_sobre_cuenta_administrativa`),
  `application/use_cases/restablecer_acceso.py` y
  `presentation/views/cuenta_views.py`.
- **Regla:** si el objetivo tiene algún permiso de administración (rol +
  overrides), el actor debe tener **todos** los `PERMISOS_ADMINISTRACION`
  (matriz, overrides, crear usuarios, restablecer, cambiar correo, configuración).
  Un ANALISTA con `identidad.restablecer_acceso` ya no puede restablecer a un
  ADMINISTRADOR; las cuentas de trabajadores/pasivos comunes siguen siendo
  atendidas por RRHH.
- **Auditoría:** actor, motivo, IP y dispositivo; nunca la contraseña.
- **Tests:** `test_seguridad_cuentas_api.py` (A1 con HasPermission real:
  analista 403 sobre admin, 200 sobre cuenta básica; DENIED en AuditoriaLog);
  unitarios de la regla; E2E en vivo.

### A2 — «Cambiar correo de acceso»

- **Archivos:** mismos de dominio, `application/use_cases/cambiar_correo_acceso.py`
  y `CorreoAccesoView`.
- **Regla:** la misma de A1. **Auditoría:** correo anterior, correo nuevo,
  motivo, actor, IP y dispositivo.
- **Tests:** A2 con HasPermission real (analista 403 sobre admin, 200 sobre
  cuenta básica; DENIED), unitarios y E2E.

### M1 — Condición de carrera de editores de la matriz

- **Archivos:** `infrastructure/repositories/repo_cuentas_orm.py`
  (`CLAVE_BLOQUEO_ADMINISTRACION`, `pg_advisory_xact_lock`), vistas de estado,
  rol, overrides y matriz.
- **Cambio:** el conteo y la mutación ocurren dentro de `transaction.atomic()`
  con el mismo advisory lock en los cuatro caminos.
- **Test:** `test_concurrencia_editores.py` con dos hilos/transacciones
  (`transaction=True`): una desactivación gana, la otra recibe 409 y queda un
  editor.

### M2 — Contraseñas fuera del PATCH de usuarios

- **Archivos:** serializers/DTO/use case de edición, `RepoCuentasORM.establecer_password`.
- **Cambio:** `PATCH/PUT /usuarios/{id}/` rechaza `password` (400); la contraseña
  solo se cambia por «Restablecer acceso» o por el cambio propio.
  `establecer_password` incrementa `permisos_version` para revocar sesiones.
- **Tests:** `test_m2_el_patch_de_usuario_rechaza_password`,
  `test_m2_establecer_password_invalida_las_sesiones`, unitario de edición.

### M3 — Asignación de roles administrativos

- **Archivos:** `reglas_administracion.py` (`validar_asignacion_rol`), alta y
  PATCH de usuarios.
- **Cambio:** no se asigna un rol con permisos de administración si al actor le
  falta alguno de los que ese rol concede (evaluado con su política efectiva).
  `rol_id` inexistente devuelve 400 (B3).
- **Tests:** M3 con HasPermission real (analista 403 al asignar ADMINISTRADOR,
  administrador 200), DENIED en bitácora y test de rol inexistente.

### M4 — Matriz del propio rol

- **Archivos:** `validar_matriz_propia` y `MatrizRolView`.
- **Cambio:** el actor no puede modificar la fila de su propio rol (403), para
  evitar escalada indirecta y auto-bloqueo.
- **Tests:** M4 con HasPermission real (admin 403 sobre su rol, 200 sobre otro),
  DENIED y unitarios.

### M5 — Conteo eficiente de editores

- **Archivos:** `RepoPermisosORM.contar_cuentas_activas_con_permiso`.
- **Cambio:** 3 consultas en bloque (cédula/rol de activas, matriz de esos roles
  y overrides), sin cargar entidades ni paginar todas las cuentas.
- **Test:** `test_m5_contar_editores_no_carga_todas_las_cuentas` con 25 cuentas
  y `django_assert_num_queries(3)`.

### M6 — El seed no re-agrega lo retirado desde la matriz

- **Archivos:** `management/commands/seed_permisos.py`.
- **Cambio:** solo crea permisos nuevos; a roles existentes solo les agrega los
  códigos creados en esa corrida y una sola vez; los roles nuevos reciben su
  conjunto inicial. Cada cambio de matriz queda en `AuditoriaLog` como
  `actor_cedula = "sistema (seed)"`. Las exclusiones G12 siguen vigentes.
- **Tests:** permiso retirado que no vuelve; permiso nuevo agregado y auditado;
  rol nuevo con conjunto inicial; dos corridas sin cambios ni auditoría nueva.

### B1 — Intentos rechazados auditados como DENIED

- **Archivos:** vistas de identidad (`cuenta_views.py`, `permiso_views.py`).
- **Cambio:** los 403/409 de las reglas a), b), c), A1, A2, M3 y M4 se registran
  fuera de la transacción revertida, con resultado `DENIED` y el motivo.
- **Tests:** aserciones de `AuditoriaLog(..., resultado='DENIED')` en las
  pruebas de A1/A2, reglas a/b/c, M3 y M4.

### B3 — Rol inexistente

- **Cambio:** `PATCH /usuarios/{id}/` valida el rol antes de mutar y responde
  400; test `test_m3_un_rol_inexistente_da_400`.

### B2 (opcional) — Comodines en la sesión

- `obtener_permisos_de_cuenta` expande los comodines de la política a los
  códigos concretos del catálogo y descarta los denegados, de modo que la sesión
  de NextAuth no viaje con patrones que no puedan cruzarse contra un deny.

## Pendientes

- Nada de D3/D4/D7/D8 ni de las correcciones A1/A2/M1–M6/B1/B3.
- D5/D6 siguen fuera de este alcance.
- `ADMIN_CAPTACION`/`ANALISTA_CAPTACION` quedan para la fase futura confirmada en
  la matriz 2.4.
## Correcciones de seguridad — ronda 2

### 1. ALTO — Escalada lateral por matriz y overrides

Se añadió la regla de dominio `validar_concesion_administracion` en
`domain/services/reglas_administracion.py`: nadie puede **agregar** en la matriz
de cualquier rol ni como `allow` individual un código de
`PERMISOS_ADMINISTRACION` que su propia política efectiva no conceda
(`evaluar_permiso`).

- `guardar_matriz_rol` calcula `códigos nuevos - códigos actuales` y aplica la
  regla antes de reemplazar la fila.
- `guardar_permisos_individuales` compara el nuevo `allow` con el anterior y
  aplica la regla antes de guardar.
- Los 403 se registran como `DENIED` en `AuditoriaLog`.

Tests con HasPermission real en
`tests/integration/identidad/test_seguridad_cuentas_api.py`:
- actor con `identidad.asignar_permisos` pero sin `configuracion.editar` intenta
  agregar `configuracion.editar` a otro rol → 403 + `DENIED`;
- el mismo intento como `allow` individual → 403 + `DENIED`;
- un administrador completo sí puede en ambos caminos.
Unitarios: `validar_concesion_administracion` en
`tests/unit/identidad/test_reglas_administracion.py`.

### 2. MEDIO — Cuentas administrativas

- `identidad.editar_usuarios` se agregó a `PERMISOS_ADMINISTRACION`.
- `validar_operacion_sobre_cuenta_administrativa` se aplica ahora también a:
  cambio de rol, activación/desactivación y overrides individuales. Solo un
  administrador completo puede degradar, desactivar o poner `deny` a otra
  cuenta administrativa.
- Tests con HasPermission real: un actor no administrador recibe 403 al cambiar
  el rol, desactivar o poner `deny` a un administrador; cada intento queda
  `DENIED`. Un administrador completo puede conceder el `allow`/configuración.

### 3. MEDIO — Regla fallando abierta

`restablecer_acceso` y `cambiar_correo_acceso` exigen ahora
`repo_permisos` y `actor` obligatorios (sin `None` por defecto ni condición que
omita la validación). Los llamadores de las vistas y los tests unitarios se
actualizaron; las nuevas funciones de matriz/overrides también reciben `actor`
obligatorio.

Suites: backend completo **1141 passed**; focalizado de la ronda **73 passed**; `lint-imports` **82 kept, 0 broken**; `makemigrations --check` **No changes detected**.
