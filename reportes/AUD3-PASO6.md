# AUD3 PASO 6 — Pruebas y huecos de cobertura

**Skills usadas:** `testing-backend-django`, `testing-unit-vitest`,
`testing-e2e-playwright`.
**Método:** inventario de pruebas por módulo, lectura de los flujos críticos y
ejecución de las suites. Se añadieron las pruebas de los huecos que se podían
cerrar sin cambiar contratos.

## Inventario

| Módulo backend | `def test_` | Módulo backend | `def test_` |
| -------------- | ----------- | -------------- | ----------- |
| `fe_de_vida` | 222 | `identidad` | 276 |
| `carnetizacion` | 129 | `personal` | 152 |
| `carga_masiva` | 57 | `pasivos` | 48 |
| `autogestion` | 145 | `configuracion` | 114 |
| `core` | 171 | `reportes` | 112 |
| `cargos` | 46 | `familiares` | 40 |
| `movimientos` | 35 | `catalogos` | 26 |
| `puntocuenta` | 25 | `notificaciones` | 24 |
| `exportaciones` | 16 | `auditoria` | 15 |
| `organizacion` | 6 | integración transversal | 78 |

**Total: 1737 funciones de prueba** (2190 casos por parametrización). En el
frontend, **210 archivos / 1118 pruebas** de Vitest. En E2E, 7 especificaciones
más `accesibilidad.spec.ts`.

## Cobertura de los flujos críticos

| Flujo | Qué está cubierto |
| ----- | ----------------- |
| Fe de vida | proceso/prórrogas, borrador y validaciones (duplicados, vivienda, geografía), evidencia y tamaño, envío, checks con conflicto (L2-04), constancia, reenvío diario (L2-01), regeneración y `constancias_faltantes` (L2-02), presencial (L2-12), verificación pública (404 genérico y éxito), estadísticas, cobertura y exportación |
| Carnet | emisión y PDF binario, motivos, plantillas versionadas, vigencias por tipo, credenciales externas, QR público e integración, privacidad, bitácora, eventos e invitados (import, check-in), lotes |
| Identidad | login (incluye tiempo constante y bloqueo), refresh con `is_active`/`permisos_version`, logout, recuperación, cuentas y roles, permisos por código y versiones, semillas |
| Carga masiva | análisis por plantilla, errores por fila, aplicar/revertir, idempotencia (L2-05), filas protegidas (L2-10), confirmación de cambio de condición, permisos por población, plantilla y resultados |
| Pasivos | registro directo y anidado, egreso por fallecimiento, sobrevivientes (idempotencia, cédula correlativa L2-14), pase a pasivo con guarda (L2-15), listado y filtros |

## Huecos encontrados y pruebas añadidas

### P6-01 — Emisión de carnet sin prueba de rollback (MEDIA, **corregido**)

La corrección L2-18 (emisión + PDF en una sola transacción) no tenía prueba: un
fallo del PDF podía dejar el carnet anterior desactivado sin uno nuevo. Se
añadió `test_emision_con_pdf_fallido_no_deja_carnet_ni_desactiva_el_anterior`
(`tests/integration/carnetizacion/test_api_o45.py`): simula el carnet creado y
el anterior desactivado, fuerza el fallo del PDF, comprueba el 500 y verifica
que el carnet previo sigue activo y no se creó otro. **1 passed.**

### P6-02 — IP real del cliente sin prueba (MEDIA, **corregido en PASO 4**)

`core/presentation/ip_cliente.py` se añadió con 5 pruebas unitarias (sin
cabecera, 1 y 2 proxies, 0 proxies, más proxies que saltos). **5 passed.**

### P6-03 — Módulos con cobertura fina (BAJA, documentado)

| Módulo | Pruebas | Observación |
| ------ | ------- | ----------- |
| `organizacion` | 6 para 21 métodos | CRUD de dependencias/direcciones/coordinaciones casi sin casos de error |
| `auditoria` | 15 | filtros y exportación cubiertos; falta paginación con muchos registros |
| `exportaciones` | 16 | máquina de estados del trabajo (ERROR/EXPIRADO/atasco) parcialmente cubierta |
| `notificaciones` | 24 | outbox y reintentos cubiertos; falta el límite de intentos agotado |

No se añadieron pruebas aquí: son módulos de soporte, no flujos con efecto
legal, y escribir casos nuevos sin ejecutar la batería completa esta noche
añadiría riesgo sin evidencia.

### P6-04 — Frontend con poca prueba unitaria (BAJA, documentado)

`carga-masiva`, `puntocuenta` y `retroalimentacion` tienen **1 archivo de
prueba** cada uno (frente a 34 de `fe-de-vida` o 27 de `autogestion`). Los
flujos de carga masiva sí tienen 3 especificaciones E2E.

### P6-05 — E2E sin flujo de egreso de pasivo (BAJA, documentado)

No hay especificación E2E de egreso/sobrevivientes (sí de fe de vida, carnet,
reportes y login). El backend lo cubre con 48 pruebas de integración; un E2E
exigiría un pasivo de prueba con familiar heredero.

## Verificación de este paso

- `pytest tests/integration/carnetizacion/test_api_o45.py -k pdf_fallido
  --create-db`: **1 passed**.
- `pytest tests/unit/core/test_ip_cliente.py ...`: **5 passed** (en la corrida
  de PASO 4, 28 passed en total).
- La batería completa se repite al cerrar la FASE 3.
