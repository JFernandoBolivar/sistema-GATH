# NOCHE T3 — Fe de vida (backend): conflicto, duplicados, vivienda y presencial

**Fecha:** 2026-11-11 · **Sin commit**

## L2-04 — Validar el acta pisaba correcciones de RR. HH.

**Corrección.** `apps/fe_de_vida/infrastructure/adaptadores_autogestion.py`
(`AplicadorCambiosActaORM.aplicar`): antes de marcar/aprobar los cambios
pendientes se compara cada MODIFICAR con el valor real de hoy usando el mismo
`mismo_valor` de autogestión. Si la ficha cambió desde el borrador, lanza
`ConflictError` (409): «El dato '<campo>' cambió en la ficha después de la
propuesta: devuelva la solicitud o pida al pasivo una nueva.». La solicitud
sigue en `PENDIENTE_SEGUNDO_CHECK` y no se pierde nada.

**Prueba.** `test_segundo_check_rechaza_si_rrhh_cambio_el_dato_despues_del_borrador`.

## L2-13 — Duplicados y parentescos no permitidos se detectaban al aprobar

**Corrección.** `LectorFichaORM` (`apps/autogestion/infrastructure/repositories/lector_ficha_orm.py`):
- `aplica_a_familiar(parentesco_id)`: parentesco habilitado para familiares.
- `validar_familiares_nuevos(cedula, altas)`: dentro del mismo borrador rechaza
  dos altas con el mismo `orden_hijo` y la misma cédula, y el parentesco no
  permitido. Se llama al guardar el borrador desde:
  - fe de vida: `ValidadorCambiosActaORM.validar_conjunto` (`_validar_familiares_nuevos`);
  - autogestión: `guardar_borrador` (`_validar_familiares_nuevos`).
  Mensajes claros con `campo` (`orden_hijo` / `cedula_familiar` /
  `parentesco_id`), sin llegar al 409 del segundo check.

**Prueba.** `test_borrador_rechaza_dos_hijos_nuevos_con_el_mismo_orden` (400 con
`errores.orden_hijo`).

## L2-16 — Vivienda sin coherencia al modificarla y alta parcial con error 500

**Corrección.**
1. `LectorFichaORM.valores_vivienda(cedula)` (nuevo) lee el estado actual
   completo y `validar_cadena_geografica(estado, municipio, parroquia)` comprueba
   que municipio pertenezca al estado y parroquia al municipio.
2. `ValidadorCambiosActaORM.validar_conjunto` y
   `_validar_vivienda_del_borrador` (autogestión) validan ahora el **estado
   final** de la vivienda también en MODIFICAR: si el país final es Venezuela se
   exige la ubicación completa; si es exterior, `ciudad_region`. Antes solo se
   validaba al CREAR.
3. `apps/personal/infrastructure/repositories/repo_personal_orm.py`
   (`_upsert_vivienda`): si hay más de una ficha lanza `ConflictError` (409) y si
   no hay ficha y faltan `condicion_vivienda_id`/`direccion_exacta` lanza
   `ConflictError` con mensaje claro, en vez de `MultipleObjectsReturned` /
   `IntegrityError` (500) al aplicar el acta.

**Pruebas.** La batería de vivienda existente (`test_vivienda_pais_o40.py`,
`test_o40_*`, autogestión y fe de vida) pasa sin cambios; la validación nueva se
cubre por las pruebas de borrador/validación ya existentes y por la de L2-13.

## L2-12 — Presencial sin comprobar pasivo, canal ni celular

**Corrección.** `apps/fe_de_vida/presentation/views/presencial_views.py`:
1. `IniciarOSolicitudPresencialView`: exige `verificador.es_pasivo(cedula)`
   antes de buscar el proceso (403, mismo mensaje que la vía en línea).
2. `_exigir_canal_presencial(solicitud)`: el borrador, la evidencia y el envío
   presencial solo operan solicitudes con `canal == PRESENCIAL` (403 en caso
   contrario). Impide completar/enviar el borrador en línea de un pasivo.
3. `EnviarPresencialView`: llama a `exigir_celular` como el envío en línea.

**Prueba.** `test_presencial_solo_para_pasivos_y_no_opera_sobre_solicitudes_en_linea`
(403 con un activo y 403 sobre una solicitud en línea en borrador y envío).

## Verificación

- `pytest` (unit+integración de fe de vida, autogestión, familiares y personal +
  flujo de actualización): **565 passed**.
- `lint-imports`: **91 contratos, 0 rotos**.
- `makemigrations --check`: **No changes detected**.

## Pendiente anotado

- La cadena geográfica se valida por consulta en el guardado; no se añadió
  índice porque son tablas legadas de catálogo pequeñas.
- Los mensajes de conflicto de L2-04 no indican ritual de corrección más allá de
  devolver la solicitud; se mantiene la interfaz actual.
