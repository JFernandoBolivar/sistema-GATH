# OC — el rol en la bitácora de auditoría

**Fecha:** 11/11/2026 · **Rama:** `feature/fe-de-vida-pasivos` · **Sin commit** (lo hace el coordinador).
**Alcance:** solo `BACKEND/` (kernel y módulo de auditoría). No se tocó
`NextJS/src/modules/configuracion`, `NextJS/src/modules/auditoria` ni
`BACKEND/apps/identidad/*restablec*`.

---

## Problema

`/auditoria` mostraba «—» en la columna «Rol» porque
`core/presentation/audit.py::registrar_auditoria` recibe `actor_rol=''` por
defecto y casi ningún llamador lo pasa. Además, las filas históricas tampoco lo
tienen y no se pueden reescribir (la cadena de hash incluye `actor_rol`).

## Solución

### 1. Al registrar: el rol se resuelve antes del hash

`actor_rol` está en `CAMPOS_HASH` (`core/domain/auditoria.py`), así que se
resuelve **antes** de crear la fila; después ya no se puede completar sin romper
la cadena.

- **Puerto (kernel, sin Django):** `core/domain/ports.py::ResolutorRolActor`
  con `rol_visible_de(actor_id, actor_cedula) -> str`.
- **Proveedor:** `core/infrastructure/providers.py` gana
  `registrar_resolutor_rol_actor()` / `obtener_resolutor_rol_actor()` y su
  limpieza en `reiniciar_proveedores()`. Es el mismo patrón de B3.2 que ya usan
  permisos, condición del trabajador y configuración (regla B16: `core` **no**
  importa de `apps`).
- **Adaptador (infraestructura):**
  `apps/identidad/infrastructure/providers/resolutor_rol_actor.py::ResolutorRolActorORM`
  lee `USER_cuenta` con `select_related('rol')`, por `pk` y, si no, por cédula,
  y devuelve `nombre_visible` o, si está vacío, `nombre_rol`. Cualquier error se
  registra en `audit_backend.txt` y devuelve `''`: la acción auditada nunca se
  tumba por el rol.
- **Registro:** `apps/identidad/infrastructure/providers/resolutor_core.py`
  (`registrar_resolutor_en_kernel()`, invocado desde `IdentidadConfig.ready()`).
- **Consumo:** `core/presentation/audit.py` pide el lector al kernel y trunca a
  los 50 caracteres del campo `AuditoriaLog.actor_rol`. Si no hay lector
  registrado, registra sin rol (comportamiento anterior).

### 2. Filas viejas: se completan al leer, sin tocarlas

En `apps/auditoria/infrastructure/repositories/repo_auditoria_orm.py`:

- `_roles_actuales(cedulas)` resuelve **en una sola consulta** el rol actual de
  todas las cédulas del página (`CuentaModel` + `rol__nombre_visible` /
  `rol__nombre_rol`), sin N+1.
- En `listar()` solo se piden las cédulas de filas con `actor_rol` vacío; el
  resultado se devuelve en `actor_rol_visible` (el mismo texto visible de
  siempre) y se marca `actor_rol_actual: true` para distinguirlo del rol
  guardado. `actor_rol` se mantiene tal cual (vacío en las viejas).
- `obtener()` (detalle) hace lo mismo para una fila.
- El listado sigue usando las consultas de nombres y de códigos de rol que ya
  existían; la prueba fija un máximo de 6 consultas para una página.

### 3. Propagación del campo nuevo

`actor_rol_actual: bool = False` en la entidad (`domain/entities/registro.py`),
el DTO (`application/dtos/auditoria_dtos.py`), el caso de uso
(`application/use_cases/consultar_auditoria.py`) y el serializer
(`infrastructure/serializers/auditoria_serializers.py`). El frontend no se tocó:
sigue leyendo `actor_rol_visible`.

---

## Archivos

| Capa | Archivo | Cambio |
| ---- | ------- | ------ |
| Kernel · dominio | `core/domain/ports.py` | Puerto `ResolutorRolActor` |
| Kernel · infraestructura | `core/infrastructure/providers.py` | Registro/obtención del lector de rol |
| Kernel · presentación | `core/presentation/audit.py` | Resuelve `actor_rol` antes de crear |
| Identidad · infraestructura | `apps/identidad/infrastructure/providers/resolutor_rol_actor.py` | **Nuevo**: adaptador ORM del puerto |
| Identidad · infraestructura | `apps/identidad/infrastructure/providers/resolutor_core.py` | Registra el adaptador en `ready()` |
| Auditoría · dominio | `apps/auditoria/domain/entities/registro.py` | `actor_rol_actual` |
| Auditoría · aplicación | `apps/auditoria/application/dtos/auditoria_dtos.py` | `actor_rol_actual` |
| Auditoría · aplicación | `apps/auditoria/application/use_cases/consultar_auditoria.py` | Pasa `actor_rol_actual` |
| Auditoría · infraestructura | `apps/auditoria/infrastructure/repositories/repo_auditoria_orm.py` | `_roles_actuales`, relleno en listado y detalle |
| Auditoría · infraestructura | `apps/auditoria/infrastructure/serializers/auditoria_serializers.py` | Campo `actor_rol_actual` |
| Pruebas | `tests/integration/core/test_auditoria_rol.py` | **Nuevo**: 4 pruebas OC |

## Pruebas

`tests/integration/core/test_auditoria_rol.py` (todas en verde):

1. `test_registro_nuevo_sin_rol_toma_el_nombre_visible` — un `registrar_auditoria`
   con `actor_rol=''` guarda el `nombre_visible` del rol.
2. `test_registro_sin_etiqueta_visible_usa_el_codigo_del_rol` — si no hay
   `nombre_visible`, guarda `nombre_rol`.
3. `test_la_cadena_verifica_con_el_rol_resuelto` — con dos registros resueltos,
   `call_command('verificar_cadena_auditoria')` no falla.
4. `test_listado_completa_el_rol_de_filas_viejas_sin_n_mas_uno` — dos filas
   históricas sin `actor_rol` salen del listado con `actor_rol_visible` y
   `actor_rol_actual=True`; la fila nueva conserva su rol y
   `actor_rol_actual=False`; el detalle también se completa; todo dentro de
   `django_assert_max_num_queries(6)`.

La prueba repone el lector real en un `fixture` autouse porque otro test unitario
del proyecto llama a `reiniciar_proveedores()` y limpia el registro del kernel.

## Resultados

| Comprobación | Resultado |
| ------------ | --------- |
| `tests/integration/core/test_auditoria_rol.py` + `test_auditoria_cadena.py` + `tests/unit/core/test_auditoria_hash.py` + `test_auditoria_user_agent.py` + `tests/integration/auditoria` + `tests/unit/auditoria` | **27 passed, 1 skipped** (el skip es previo, de `test_auditoria_cadena.py`) |
| `lint-imports` | **103 contratos, 0 rotos** (antes fallaba B16 con el lector dentro de `core`; el adaptador se movió a `apps.identidad` y ahora pasa) |
| `--create-db` | No se usó |

## Notas para el coordinador

- Las filas históricas siguen con `actor_rol=''` en la base: no se reescriben.
  El listado y el detalle muestran el rol **actual** de la cuenta y lo marcan con
  `actor_rol_actual: true`.
- El rol guardado al registrar es el **nombre visible** (truncado a 50), no el
  código. Si más adelante se quiere filtrar por rol en la bitácora, conviene
  tenerlo en cuenta.
- Sin cambios de esquema ni migraciones.
