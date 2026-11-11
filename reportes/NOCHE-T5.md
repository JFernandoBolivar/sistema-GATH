# NOCHE T5 — Robustez del backend (L2-14/15/17/18/20, A2-12/13/14/15/16/19/20/22)

**Fecha:** 2026-11-11 · **Sin commit**

## Lógica de negocio

| ID | Corrección | Prueba |
| -- | ---------- | ------ |
| **L2-14** | `repo_sobrevivientes_orm`: rechaza (409) una cédula correlativa `titular-N` como `cedulaidentidad` del nuevo pasivo, con mensaje para registrar la cédula propia | `test_sobrevivientes_orm.py::test_cedula_correlativa_del_menor_se_rechaza` |
| **L2-15** | `procesar_egreso_a_pasivo`: `select_for_update` del empleado + `ConflictError` si ya es pasivo (evita doble asignación/egreso). `generar_codigo_pasivo` convierte el `ValueError` de un nombre de nómina vacío en `ConflictError` | `test_egreso_pasivo.py::test_pase_a_pasivo_rechaza_a_quien_ya_es_pasivo` |
| **L2-17** | Guardar un parámetro `carnetizacion.mi_carnet*` ya **no** ejecuta `cache.clear()`: la política se lee en cada petición y se conservan los contadores de throttling | `test_cache_mi_expediente.py::test_guardar_parametro_de_mi_carnet_no_vacia_toda_la_cache` |
| **L2-18** | `CarnetGenerarView`: `motivo_id` no numérico → 400; emisión + PDF en una sola transacción. `emitir_carnet`: `select_for_update` del empleado y motivo inexistente → 400 con `campo` | cubierto por la batería de carnetización existente |
| **L2-20** | La verificación pública **no** audita las consultas fallidas (cada escritura tomaba un bloqueo asesor global); el 404 sigue siendo idéntico | `test_fe_de_vida_api.py::test_verificacion_publica_404_generico...` actualizado |

## Errores que se tragaban o engañaban

| ID | Corrección |
| -- | ---------- |
| **A2-12** | Login: un `except Exception` convertía cualquier fallo (BD/caché/bug) en 401 «Error procesando…» **sumando un intento fallido**. Ahora se registra y se relanza (500) sin sumar intento |
| **A2-13** | `repo_reglas_catalogos_orm`: los 5 borrados capturan `ProtectedError`/`IntegrityError` en vez de `Exception` (no se convierte un fallo de BD en «hay viviendas registradas») |
| **A2-14** | Punto de cuenta: un fallo del generador/almacén ya no responde 404; se registra y sube al handler |
| **A2-15** | `reportar_error_laboral`: el `except: pass` del notificador ahora registra `logger.warning(..., exc_info=True)` |
| **A2-16** | Añadido log a la credencial externa sin foto y al envío de invitación fallido. Los `except` de color/rect de `carnet_pdf` son respaldos visuales y se dejan (documentado) |

## Datos fijos

| ID | Corrección |
| -- | ---------- |
| **A2-19** | `SUPERADMIN_CEDULA` (nueva variable, con la cédula histórica como respaldo) la usan `preparar_produccion` y `verificar_esquema`; el rol se busca por nombre `ADMINISTRADOR` con respaldo `pk=1` |
| **A2-20** | `crear_usuarios_qa` se niega a escribir con `DEBUG=False` salvo `--forzar` (sus cédulas/correos son reales) |
| **A2-22** | Importador de cargos especiales: `TipoPersonal` por nombre `ACTIVO` (verificado en BD: pk=2 es ACTIVO) con respaldo al pk |

## Verificación

- `pytest` de identidad, fe de vida, configuración, personal, carnetización, punto de cuenta, pasivos y autogestión (unit + integración): **1097 passed**.
- `lint-imports`: 91 contratos, 0 rotos.
- `makemigrations --check`: sin cambios.

## Notas

- La restricción `UNIQUE` de `AsigTrabajo.codigo` (parte de L2-15) **no** se puede añadir: la tabla es legada `managed=False`. Se mitiga con el bloqueo y el chequeo `exists()`; se anota para la fase de esquema.
- `A2-21` (dominio de correo con y sin arroba) no entraba en esta tarea; sigue pendiente.
