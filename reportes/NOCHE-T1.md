# NOCHE T1 — Constancia de fe de vida (L2-01, L2-02)

**Fecha:** 2026-11-11
**Rama:** `feature/fe-de-vida-pasivos` (sin commit)

## L2-01 — El reenvío dejaba de enviar correo desde el segundo día

**Causa.** La clave de deduplicación del outbox era `reenvio-{conteo+1}`, y el
contador se reinicia cada día. La clave única es `tipo:ref_id:clave`, así que al
día siguiente se repetía `reenvio-1`, `crear_muchas` devolvía 0 y el correo no
se encolaba.

**Corrección.** `apps/fe_de_vida/application/use_cases/constancias.py:124`: la
clave pasa a `reenvio-{uuid4().hex}`, única por hecho (no por día). Mismos
textos, mismo contrato y mismo límite diario de 5.

**Pruebas.**
- `tests/unit/fe_de_vida/test_reenviar_regenerar_constancia.py`: el test del
  límite ahora exige 5 claves distintas; nuevo test
  `test_reenvio_en_dias_distintos_vuelve_a_notificar` (lunes y martes generan
  **dos** notificaciones con claves distintas).

## L2-02 — Constancia que no se emite y no tiene recuperación

**Causa.** La emisión corría dentro del mismo `atomic` que el aviso y solo se
capturaba `DomainError`. Un fallo del aviso (o cualquier excepción) revertía la
constancia y dejaba la solicitud VALIDADA sin PDF; además `regenerar_constancia`
exigía que existiera y el comando solo miraba constancias ya con `clave_pdf`.

**Corrección.**
1. `apps/fe_de_vida/infrastructure/receivers.py:53-97`: la emisión y el aviso
   van en **dos transacciones independientes**. Un fallo al avisar ya no
   revierte la constancia emitida; un fallo al emitir se registra con
   `logger.exception` y deja la solicitud recuperable. Se captura `Exception`,
   no solo `DomainError`.
2. `apps/fe_de_vida/application/use_cases/constancias.py:145-190`:
   `regenerar_constancia` ahora **recupera**: si la constancia no existe o no
   tiene PDF, delega en `emitir_constancia` (idempotente, reutiliza el número ya
   reservado). Así la pantalla «Regenerar» deja de responder 409 en ese caso.
3. **Comando nuevo** `apps/fe_de_vida/management/commands/constancias_faltantes.py`:
   detecta las solicitudes VALIDADA sin constancia o con constancia sin
   `clave_pdf`. Dry-run por defecto; `--aplicar` emite; `--proceso` filtra.
   Registra en log y consola cuántas hay, cuántas emitió y cuántos errores.

**Pruebas.**
- Unitarias: `test_regenerar_sin_constancia_la_emite_y_luego_conserva_el_numero`.
- API: `test_regenerar_recupera_la_constancia_de_una_validada_que_quedo_sin_emitir`
  (antes 409; ahora 200 y PDF emitido);
  `test_constancias_faltantes_detecta_y_emite_las_validadas_sin_constancia`
  (dry-run detecta, `--aplicar` emite, el objeto llega al almacén).

## Verificación

- `pytest tests/unit/fe_de_vida tests/integration/fe_de_vida`: **258 passed**.
- `lint-imports`: **91 contratos, 0 rotos**.
- `makemigrations --check`: **No changes detected**.

## Pendiente

- La recuperación automática tras un fallo sigue siendo manual (comando o
  botón): no se añadió un beat que reintente emisiones. Recomendación para una
  próxima tarea: tarea diaria `constancias_faltantes --aplicar` (idempotente).
- `regenerar_constancias` (el de la plantilla) no se tocó: sigue regenerando
  solo PDFs existentes; el nuevo comando cubre el hueco de las que faltan.
