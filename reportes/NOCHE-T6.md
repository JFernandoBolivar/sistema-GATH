# NOCHE T6 — Arquitectura de `puntocuenta` y `configuracion` (A2-01..A2-04, A2-03)

**Fecha:** 2026-11-11 · **Sin commit**

## A2-01 — `puntocuenta`: el dominio usaba el ORM

- **Puerto** `apps/puntocuenta/domain/ports/repo_punto_cuenta_config.py`:
  `RepoSecuenciaPuntoCuenta.siguiente(anio)` y `RepoConfiguracionPuntoCuenta`.
- **Adaptador** `infrastructure/repositories/repo_punto_cuenta_config_orm.py`:
  la transacción y el `select_for_update` de la secuencia viven aquí; la
  configuración se lee/crea/versiona aquí; `guardar_generar` es el único punto
  que toca el módulo `configuracion` (infrastructure, patrón B16).
- **Caso de uso** `application/use_cases/correlativo_punto_cuenta.py`:
  `obtener_siguiente_correlativo(repo, anio)` calcula el formato `XXXX-YYYY`.
- Se eliminó `domain/services/correlativo_punto_cuenta.py` (importaba
  `django.db.transaction` y el modelo).

## A2-02 — `puntocuenta`: el caso de uso usaba el ORM y cruzaba apps

- `application/use_cases/configurar_punto_cuenta.py`: sin `django.db`, sin
  modelos, sin `apps.configuracion`. Recibe `RepoConfiguracionPuntoCuenta` y
  solo calcula los valores. Los dos `except Exception` que devolvían la
  configuración por defecto se eliminaron: un fallo de BD ahora sube (500) en
  vez de simular «todo por defecto». El único `except` que queda
  (`_generacion_activa`) registra con `logger.warning(..., exc_info=True)`.
- Los valores por defecto (`PROCESOS_POR_DEFECTO`, textos, firmas) se movieron a
  `domain/value_objects/plantilla_punto_cuenta.py`; el modelo los reexporta.
- Callers actualizados: vista de configuración, `pdf_punto_cuenta` y
  `receivers` (pasan el adaptador).

## A2-03 — Contratos de import-linter

Añadidos a `.importlinter` para ambas apps: `domain-puro`, `application-puro`,
`capas`, `no-cruzado`, `presentacion-no-cruzado` e `independiente`.
Resultado: **103 contratos, 0 rotos**.

## A2-04 — `configuracion`: cruce de apps en domain y tipo concreto

- El catálogo `Seccion` + `CODIGOS_SECCIONES` se movió a
  `core/domain/secciones.py`; `apps/autogestion/domain/value_objects/secciones.py`
  lo reexporta y `configuracion/domain/parametros.py` importa del kernel.
- Nuevo puerto `domain/ports/repo_politica_correo_acceso.py`; el caso de uso
  `gestionar_politica_correo_acceso.py` tipa con el Protocol y ya no importa
  `RepoPoliticaCorreoAccesoORM`.

## Verificación

- `pytest tests/unit/puntocuenta tests/integration/puntocuenta tests/unit/configuracion tests/integration/configuracion`: **192 passed**.
- `lint-imports`: **103 contratos, 0 rotos**.
- `makemigrations --check`: sin cambios.

## Actualización posterior (AUD3 PASO 1)

El puerto `RepoConfiguracionPuntoCuenta` devolvía el modelo ORM. En la revisión
app por app se añadió la entidad `ConfiguracionPuntoCuenta`
(`apps/puntocuenta/domain/entities/`) y el adaptador la construye; `application`
ya no lee atributos del modelo. Ver `AUD3-PASO1.md` (01-02).

## Pendiente anotado (decisión)

- **A2-05**: los casos de uso de identidad importan `rest_framework_simplejwt`.
  Requiere puerto `EmisorTokens` + adaptador y añadir el paquete a los
  prohibidos; se deja para una tarea dedicada (riesgo en login/refresh).
- **A2-06**: la señal de `cargos` en `domain/events.py` usa `django.dispatch`
  (excepción declarada en el contrato). Moverla a infrastructure cambia la API
  interna de eventos de cargos; se anota.
- `transaction.atomic()` en presentación (A2-07) es deuda transversal; no se
  toca en esta noche.
