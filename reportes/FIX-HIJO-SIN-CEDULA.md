# FIX-HIJO-SIN-CEDULA — El borrador con un hijo menor sin cédula quedaba trabado

**Fecha:** 2026-11-10
**Rama:** `feature/fe-de-vida-pasivos`
**Reportado en:** QA y entorno local (reproducido)

## Problema

En la autogestión (y en el acta de fe de vida), al agregar un hijo(a) menor de
edad **sin cédula** el borrador se guardaba bien la primera vez, pero al
reabrirlo el guardado fallaba con:

```
Campos no autogestionables en 'familiar': cedula_generada.
```

El trabajador quedaba encerrado en el paso 1 sin poder avanzar.

## Causa

`LectorFichaORM.validar_familiar_alta()` validaba la cédula sintética
(`<cédula del titular>-<orden>`) y **la escribía dentro del mismo dict que se
guarda como `valor_propuesto`**:

```python
if not (valores.get('cedula_familiar') or '').strip():
    valores['cedula_generada'] = resuelta
```

Ese dict es exactamente lo que el frontend recibe y reenvía al reabrir el
borrador. Al reenviarlo, `validar_registro_nuevo()` lo comparaba con la lista
blanca de campos autogestionables —donde `cedula_generada` no está— y lo
rechazaba.

## Corrección

Tres cambios, sin tocar la interfaz:

1. **No mutar el valor propuesto**
   (`apps/autogestion/infrastructure/repositories/lector_ficha_orm.py`):
   `validar_familiar_alta()` ahora **devuelve** la cédula que se generará
   (`str | None`) y no modifica `valores`. Mismo cambio en el puerto
   `apps/autogestion/domain/ports/ficha_trabajador.py`.
2. **Descartar el campo en borradores ya guardados**
   (`apps/autogestion/domain/services/validacion_cambios.py`): antes de aplicar
   la lista blanca, `validar_registro_nuevo()` elimina `cedula_generada` del
   valor recibido (constante `CAMPO_CEDULA_GENERADA`). Ya no se rechaza: se
   ignora, así que los borradores que quedaron con el campo guardado en QA y en
   producción se pueden volver a guardar.
3. **Mostrarla solo donde la revisión la necesita**
   (`core/presentation/valores_propuestos.py`, nuevo):
   `con_cedula_generada(valor, cedula_titular)` devuelve una **copia** del valor
   con `cedula_generada` calculada (o el valor intacto si el familiar trae
   cédula propia). Se aplica al serializar la revisión y el detalle:
   - `apps/autogestion/presentation/serializers/actualizacion_serializers.py`
     (`a_dict_cambio`, usado por `serializar_detalle`).
   - `apps/fe_de_vida/presentation/serializers/fe_de_vida_serializers.py`
     (`a_dict_cambio`, usado por `a_dict_detalle` y `a_dict_revision`).

   Así el texto «… (se generará al aprobar)» del visor de Bienestar y la fila
   del comparativo de autogestión siguen mostrándose igual, pero el campo no se
   persiste y no vuelve por el borrador.

### Lo que no cambia

- **La aprobación sigue generando la cédula** `titular-orden`: el aplicador
  (`aplicador_cambios_orm._crear_familiar`) y `RepoFamiliaresORM` la resuelven
  con `resolver_cedula_familiar` desde `orden_hijo`, sin depender del valor
  guardado.
- La revisión de Bienestar sigue viendo la cédula que se generará.
- No hay migraciones ni cambios de contrato HTTP: los mismos campos, con el
  mismo contenido que antes.

## Pruebas

Nuevas:

- `tests/integration/test_actualizacion_datos_api.py`
  - `test_borrador_de_hijo_sin_cedula_se_reguarda_con_el_valor_que_devuelve_la_revision`:
    alta de hijo menor sin cédula → guardar → reconstruir el borrador con el
    `valor_propuesto` que devuelve la API (incluye `cedula_generada`) → guardar
    otra vez = 200, y el borrador persiste sin el campo. **Es la regresión
    pedida.**
  - `test_borrador_legado_con_cedula_generada_guardada_se_puede_guardar`:
    simula un borrador ya guardado con el campo (QA/producción) y comprueba que
    se descarta en vez de rechazarse.
- `tests/unit/fe_de_vida/test_cedula_generada_en_revision.py`: la revisión
  muestra la cédula calculada; un familiar con cédula propia o una modificación
  no la muestran; un borrador legado con el campo se respeta; valores no
  válidos no se tocan.

Actualizadas (afirmaban el comportamiento anterior):

- `tests/integration/test_actualizacion_datos_api.py`: el detalle del borrador
  ya no persiste `cedula_generada`, pero la API la sigue devolviendo.
- `tests/integration/fe_de_vida/test_fe_de_vida_api.py` y
  `tests/integration/familiares/test_orden_hijo.py`: el validador devuelve la
  cédula y no escribe `cedula_generada` en el valor propuesto.

## Verificación

- `pytest` de autogestión, fe de vida y familiares (unit + integración) más el
  flujo de actualización: **486 passed**.
  Incluye `test_actualizacion_datos_api.py::test_flujo_completo...`, que tras
  aprobar comprueba `cedulaFamiliar == '<cédula titular>-1'` (aprobación OK).
- `lint-imports`: **91 contratos, 0 rotos**.
- `makemigrations --check --dry-run`: **No changes detected**.

Sin commit: los cambios quedan en el árbol de trabajo.
