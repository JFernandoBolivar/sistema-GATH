# AUD3 PASO 1 — Arquitectura del backend, app por app

**Skills usadas:** `arquitectura-onion-feature-scream`, `uso-librerias-backend`.
**Método:** recorrido de las 18 apps con la checklist de la skill (capas y
nombres, puerto/repositorio por agregado, entidades vs. modelos devueltos,
casos de uso sin dependencias concretas, composición en las vistas, señales,
tareas Celery y management commands), `lint-imports`, `grep` dirigido y lectura
de los archivos señalados. Sin escrituras en la base.

## Resumen

- Las 18 apps tienen las cuatro capas y los **103 contratos de import-linter**
  pasan (0 rotos). `domain` no importa Django salvo la excepción declarada de
  `cargos/domain/events.py` (A2-06).
- **Ningún** módulo de `application` importa `infrastructure` ni toca `.objects.`
  (verificado por grep en las 18 apps).
- Los repositorios devuelven **entidades de dominio**; las excepciones son
  adaptadores de lectura para la pantalla de edición (`LectorFichaORM`,
  `LectorValidacionFamiliarORM`, `obtener_instancia` de familiares), que
  devuelven el modelo a propósito y están documentados en su docstring.
- Todas las señales viven en `infrastructure` (0 receptores fuera).
- Las tareas Celery están en `infrastructure/tasks` y orquestan casos de uso;
  la excepción es la retención centralizada de `configuracion`, que barre
  modelos de otras apps (ver 01-05).
- 11 management commands tocan el ORM directamente; son semillas/bootstrap o
  consultas de mantenimiento (ver 01-06).

## Tabla por app

| App | Capas | Puertos / repositorios | Devuelve entidades | Casos de uso con concretos | `atomic` en vistas | Señales fuera de infra | Tareas / comandos | Estado |
| --- | ----- | ---------------------- | ------------------ | -------------------------- | ------------------ | ---------------------- | ----------------- | ------ |
| `auditoria` | ✔ | 1 / 1 | sí (`repo_auditoria_orm`) | no | 0 | 0 | 0 / 0 | OK |
| `autogestion` | ✔ | 7 / 10 | sí; `LectorFichaORM` devuelve modelos (lectura de edición, documentado) | no | 11 | 0 | 2 / 0 | OK con deuda A2-07; 3 casos de uso sin cablear (01-03) |
| `carga_masiva` | ✔ | 5 Protocol en `domain/ports/carga_masiva.py` / adaptadores en `infrastructure/{analisis,aplicacion,consultas_carga,exportacion_resultados}.py` | sí | no | 0 | 0 | 0 / 0 | OK; los adaptadores no están en `repositories/` (01-04) |
| `cargos` | ✔ | 1 / 2 | sí | no | 0 | 0 | 1 / 0 | `domain/events.py` usa `django.dispatch` (A2-06) |
| `carnetizacion` | ✔ | 3 / 3 | sí | no | 1 | 0 | 0 / 0 | OK |
| `catalogos` | ✔ | 1 / 2 | sí | no | 0 | 0 | 0 / 0 | OK |
| `configuracion` | ✔ | 5 / 5 | sí | **corregido** (tipaba con el ORM, 01-01) | 19 | 0 | 2 / 0 | OK con deuda A2-07; retención transversal (01-05) |
| `exportaciones` | ✔ | 2 / 1 | sí | no | 0 | 0 | 1 / 0 | OK |
| `familiares` | ✔ | 2 / 1 | sí; `obtener_instancia` devuelve el modelo (contrato del serializer, documentado) | no | 0 | 0 | 0 / 1 | OK |
| `fe_de_vida` | ✔ | 15 Protocol en `domain/ports/repos.py` / 10 | sí | no | 21 | 0 | 2 / 2 | OK con deuda A2-07 |
| `identidad` | ✔ | 12 / 13 | sí, salvo el objeto autenticable (documentado) | **simplejwt** en 3 casos de uso (A2-05) | 4 | 0 | 3 / 8 | Deuda A2-05 (decisión) |
| `movimientos` | ✔ | 1 / 1 | sí | no | 0 | 0 | 0 / 0 | OK |
| `notificaciones` | ✔ | 3 / 2 | sí | no | 0 | 0 | 1 / 0 | OK |
| `organizacion` | ✔ | 1 / 1 | sí | no | 0 | 0 | 0 / 0 | OK |
| `pasivos` | ✔ | 2 / 2 | sí | no | 4 | 0 | 0 / 0 | OK |
| `personal` | ✔ | 3 / 5 | sí | no | 0 | 0 | 0 / 2 | OK |
| `puntocuenta` | ✔ | 2 / 2 | **corregido**: el puerto de configuración devolvía el modelo (01-02) | no | 0 | 0 | 0 / 0 | OK |
| `reportes` | ✔ | 1 / 2 | sí (filas/DTO de reporte) | no | 0 | 0 | 0 / 0 | OK; tope de filas en la capa de aplicación |

## Hallazgos y correcciones

### 01-01 — `configuracion/application` tipaba con el ORM (corregido)

`apps/configuracion/application/use_cases/gestionar_politica_correo_acceso.py`
seguía anotando dos funciones con `RepoPoliticaCorreoAccesoORM` (import de
infrastructure eliminado en T6, pero el nombre quedaba en la firma). Ahora las
cuatro funciones usan el Protocol `RepoPoliticaCorreoAcceso`. No cambia el
contrato HTTP.

### 01-02 — `puntocuenta`: el puerto devolvía el modelo ORM (corregido)

`RepoConfiguracionPuntoCuenta.actual()` y `crear_version()` devolvían
`ConfiguracionPuntoCuentaModel`; el caso de uso leía sus atributos, así que
`application` dependía de la forma del modelo sin importarlo.

- Nueva entidad `apps/puntocuenta/domain/entities/configuracion_punto_cuenta.py`
  (`ConfiguracionPuntoCuenta`, `dataclass` congelado, sin Django).
- El adaptador `repo_punto_cuenta_config_orm.py` mapea la fila a la entidad en
  `actual()` y `crear_version()`.
- El puerto y el caso de uso tipan con la entidad. Mismos valores y mismos
  campos para la vista y el PDF.

### 01-03 — Tres casos de uso de `autogestion` sin cablear (documentado)

`consultar_censo.py`, `listar_preguntas.py` y `reporte_censo.py` no los importa
nadie: las vistas de censo llaman al repositorio directamente
(`listar_preguntas_con_detalle`, `obtener_reporte_dependencias`) porque el JSON
que consume el frontend tiene una forma distinta a la de los DTO de esos
módulos. Cablearlos cambiaría la respuesta de la API, así que se dejan como
deuda de limpieza: o se adaptan los DTO a la forma actual y se usan, o se
eliminan. No afecta al comportamiento.

### 01-04 — `carga_masiva` no usa `infrastructure/repositories/` (documentado)

Sus adaptadores son `analisis.py` (validación de catálogos), `aplicacion.py`
(aplicación por lotes), `consultas_carga.py` y `exportacion_resultados.py`.
Están en `infrastructure` (correcto) pero el nombre no sigue la convención
`repositories/repo_*_orm.py` del resto. Moverlos es cosmético y toca imports
internos; se anota para una limpieza.

### 01-05 — Retención transversal en `configuracion` (documentado)

`configuracion/infrastructure/tasks/retencion_tasks.py` consulta y borra
modelos de `autogestion`, `fe_de_vida`, `notificaciones` y del propio módulo.
Es un trabajo de retención de datos por política y hoy es el único punto que
cruza apps en infraestructura. La alternativa (un puerto de limpieza por app)
es un cambio de diseño con más superficie; queda anotado.

### 01-06 — Management commands con ORM (documentado)

`familiares/reportar_reglas_familiares`, `identidad/{crear_usuarios_qa,
migrar_roles_legados,preparar_produccion,renombrar_rol_bienestar,seed_permisos,
sincronizar_cuentas_trabajadores}`, `personal/{planilla_validacion_apn,
trabajadores_sin_fecha_ingreso}` y los dos de `fe_de_vida` usan el ORM para
leer/escribir en lote. Son semillas, bootstrap o mantenimiento (no endpoints) y
varios ya orquestan casos de uso (`constancias_faltantes` y
`regenerar_constancias` solo consultan el queryset y delegan la emisión). No se
reescriben: envolverlos en casos de uso duplicaría la lógica sin cambiar el
resultado.

### 01-07 — `transaction.atomic()` en vistas (deuda A2-07, sin cambios)

21 en `fe_de_vida`, 19 en `configuracion`, 11 en `autogestion`, 4 en `pasivos`
y 4 en `identidad`. Moverlas a un UnitOfWork por caso de uso es un refactor
transversal de riesgo alto; queda como está (decisión ya registrada).

## Decisiones pendientes (no aplicadas)

- **A2-05**: `identidad/application` importa `rest_framework_simplejwt` en
  `cerrar_sesion`, `emitir_tokens_sesion` y `rotar_tokens_sesion`. Requiere un
  puerto `EmisorTokens` + adaptador y añadir el paquete a los prohibidos del
  contrato. Toca login/refresh: tarea dedicada.
- **A2-06**: `cargos/domain/events.py` usa `django.dispatch.Signal`. Moverlo a
  infrastructure con un puerto de publicación cambia la API interna de eventos.
- **A2-07**: UnitOfWork por caso de uso (56 `atomic` en vistas).
- **Limpieza 01-03/01-04/01-05**: casos de uso sin cablear, carpeta de
  adaptadores de `carga_masiva` y retención transversal.

## Verificación de este paso

- `lint-imports`: **103 contratos, 0 rotos**.
- `pytest tests/unit/puntocuenta tests/integration/puntocuenta
  tests/unit/configuracion`: **151 passed** tras el cambio de entidad.
- `makemigrations --check --dry-run`: sin cambios.
