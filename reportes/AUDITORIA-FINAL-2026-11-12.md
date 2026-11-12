# Auditoría final — 12/11/2026

**Rama:** `feature/fe-de-vida-pasivos` · **Alcance:** `git diff e1062e8e..HEAD`
(589 archivos; 427 de código) · **Sin commit.**
**pytest no ejecutado** (lo corre el coordinador), según las reglas.

Skills aplicadas: `arquitectura-onion-feature-scream`, `patrones-drf-implementacion`,
`testing-backend-django`, `ponytail-audit`, `arquitecto-scream-feature-onion`,
`patrones-implementacion-frontend`, `validacion-input-protegido`.

---

## Hallazgos

| severidad | archivo:línea | problema | acción |
|---|---|---|---|
| alta | `BACKEND/apps/identidad/presentation/permissions/identidad_permissions.py:52` | `EsSuperadministrador` comparaba contra `getattr(settings, 'SUPERADMIN_CEDULA', '30799436')`: si faltaba la variable de entorno, una cédula fija quedaba como superadministrador. | **Corregido**: sin `SUPERADMIN_CEDULA` no hay superadministrador (fallo cerrado). |
| media | `BACKEND/apps/carnetizacion/presentation/views/evento_views.py:405,415` | La vista devolvía al cliente `str(e)` de la lectura de Excel/CSV (fuga de detalle interno, S6) y no registraba el error. | **Corregido**: se registra con `logger.exception` y se responde un mensaje genérico en español. |
| media | `NextJS/src/modules/{autogestion,carnetizacion,familiares,fe-de-vida,personal}/infrastructure/actions/*.ts` | 7 archivos de Server Actions capturaban errores sin `unstable_rethrow`: un `redirect()`/`notFound()` lanzado dentro del `try` se habría tragado y convertido en mensaje de error. | **Corregido**: import y primera línea de los 100 bloques `catch` (ver archivos tocados). |
| baja | 30 archivos backend del alcance | 58 imports sin usar y 3 variables locales asignadas y nunca usadas (código muerto; `ruff F401/F841`). | **Corregido** con `ruff --fix` + 3 ajustes manuales (`control_entrada_service.py`, `carnet_pdf.py`, `carnet_pdf_lote.py`). |
| baja | `BACKEND/apps/puntocuenta/domain/services/variables_plantilla.py:32` | `except Exception: continue` al probar formatos de fecha; ocultaba cualquier fallo. | **Corregido**: `except ValueError`. |
| baja | `NextJS/*.tmp.mjs` (18 archivos: `loc1..loc10`, `qa3..qa8`, `_iconos`) | Archivos temporales en el repo. | **Corregido**: borrados. |
| baja | `BACKEND/tests/unit/carnetizacion/test_qr_legible.py` (nuevo) y `BACKEND/tests/unit/identidad/test_permissions_superadmin.py` (nuevo) | `qr_legible.py` (regla de publicación SILOG) y el permiso `EsSuperadministrador` no tenían prueba. | **Corregido**: 6 pruebas del QR (sin BD) y 5 del permiso (cédula exacta, sin configuración y anónimo). |
| media | `BACKEND/apps/identidad/presentation/views/auth_views.py:233` | La vista escribe `last_login` con `type(cuenta).objects.filter(...).update(...)`: ORM directo en `presentation` (B7). | **Pendiente de decisión**: moverlo a un caso de uso/repositorio de identidad. No se tocó para no alterar el flujo de login sin poder correr pytest. |
| media | `BACKEND/apps/carnetizacion/presentation/views/evento_views.py:388-420` | La lectura y el parseo de XLSX/CSV de invitados vive en la vista (lógica de negocio en `presentation`, B7). | **Pendiente de decisión**: mover a un caso de uso de importación. Solo se corrigió la fuga de mensaje. |
| baja | `BACKEND/apps/identidad/presentation/views/restablecer_acceso_bloque_views.py` (logger inline) | `logging.getLogger(...)` dentro del `except` en vez de un logger de módulo. | **Pendiente**: cosmético. |
| baja | `BACKEND/apps/identidad/.../restablecer_acceso_bloque_tasks.py:55`, `presentation/views/corregir_cedula_views.py:50` | `DIAS_POR_DEFECTO = 7` duplicado en dos módulos (y el default también vive en `apps.configuracion.domain.parametros`). Igual con `MOTIVO_MIN/MAX` y `CANDADO_SEGUNDOS`/`PREVIEW_TTL`. | **Pendiente**: centralizar en `core/domain/configuracion.py`/`limites_texto`. Es deuda menor, sin impacto funcional. |
| baja | `BACKEND/apps/carnetizacion/infrastructure/repositories/repo_eventos_orm.py:500-510` | N+1 en `resumen_panel_evento`: un `count()` por categoría y por zona. | **Pendiente**: agregar con `values('categoria_id').annotate(Count)`; preexistente a este rango, no se tocó para no arriesgar el panel sin pruebas. |
| baja | `BACKEND/apps/autogestion/infrastructure/services/excel_service.py:71` | N+1 al exportar el censo: consultas de respuestas/asignación/vivienda por empleado. | **Pendiente**: precargar con `in_bulk`/`prefetch`; preexistente. |
| baja | `NextJS/src/modules/carnetizacion/ui/views/credenciales-externas-view.tsx:33`, `NextJS/src/modules/movimientos/ui/cambiar-pasivo-page.tsx:42` | La UI importa **tipos** desde `infrastructure/http` (y uno cruza de módulo). | **Pendiente**: mover los tipos a `domain/`/`application/`. Solo tipos, sin acoplamiento de ejecución. |
| baja | `BACKEND/apps/carnetizacion/infrastructure/repositories/repo_carnetizacion_orm.py` (1502 líneas), `carga_masiva/infrastructure/aplicacion.py` (889), `configuracion/.../reglas_catalogos_views.py` (816) | Superan el techo de 400 líneas (B13). | **Pendiente**: dividir por entidad/caso de uso; es deuda estructural preexistente. |
| baja | `BACKEND/apps/identidad/management/commands/preparar_produccion.py:45`, `BACKEND/core/management/commands/verificar_esquema.py:27` | Siguen usando `30799436` como respaldo de `SUPERADMIN_CEDULA`. | **Pendiente de decisión**: son comandos operativos; se dejaron para no cambiar el seed de producción. |

### Sin hallazgos (revisado)

- **`fail()`/`ok()` con argumentos invertidos:** barrido AST de todas las llamadas en
  `apps/` y `core/`; todas respetan `fail(message, status, data)` / `ok(data, message, status)`.
- **Endpoints sin permiso:** todas las `APIView` de las vistas cambiadas declaran
  `permission_classes` o `get_permissions`; no se añadieron `@api_view` ni `AllowAny`.
- **Textos en inglés al usuario:** no se añadieron mensajes en inglés (los `FAILED` son
  estados internos de auditoría).
- **`print`/`console.log`:** no se añadió ninguno en el diff (los `console.error` existentes
  son de diagnóstico previo).
- **URLs/correos/cédulas fijas nuevas:** no se añadieron en código de producción (las
  apariciones están en pruebas); el único id fijo sensible era el de superadministrador,
  corregido arriba.
- **IDOR en endpoints nuevos:** `mi-carnet/vista-previa` usa solo `request.user.cedula_id`;
  los documentos de familiares validan `familiar_id`+`documento_id`; U2/corrección de cédula
  exigen superadministrador.

---

## Archivos tocados por esta auditoría

**Backend**
- `apps/identidad/presentation/permissions/identidad_permissions.py` (fallo cerrado).
- `apps/carnetizacion/presentation/views/evento_views.py` (logger + mensajes).
- `apps/puntocuenta/domain/services/variables_plantilla.py` (`except ValueError`).
- `apps/carnetizacion/domain/services/control_entrada_service.py`,
  `apps/carnetizacion/infrastructure/pdf/carnet_pdf.py`,
  `apps/carnetizacion/infrastructure/pdf/carnet_pdf_lote.py` (variables muertas).
- 30 archivos más con imports sin usar eliminados por `ruff --fix` (autogestion, carga
  masiva, cargos, carnetización, configuración, familiares, fe de vida, pasivos, personal,
  puntocuenta).
- `tests/unit/carnetizacion/test_qr_legible.py` (**nuevo**, 6 pruebas).
- `tests/unit/identidad/test_permissions_superadmin.py` (**nuevo**, 5 pruebas).

**Frontend**
- `src/modules/autogestion/infrastructure/actions/autogestion-actions.ts`
- `src/modules/carnetizacion/infrastructure/actions/carnetizacion-actions.ts`
- `src/modules/carnetizacion/infrastructure/actions/credenciales-externas-actions.ts`
- `src/modules/carnetizacion/infrastructure/actions/eventos-actions.ts`
- `src/modules/familiares/infrastructure/actions/familiares-actions.ts`
- `src/modules/fe-de-vida/infrastructure/actions/fe-de-vida-actions.ts`
- `src/modules/personal/infrastructure/actions/personal-actions.ts`

**Borrados**
- `NextJS/loc1..loc10.tmp.mjs`, `NextJS/qa3..qa8.tmp.mjs`, `NextJS/_iconos.tmp.mjs`
  (18 archivos).

---

## Verificaciones

| Comprobación | Resultado |
|---|---|
| `lint-imports` | **103 contratos, 0 rotos** |
| `npx tsc --noEmit` | sin errores |
| `npx eslint src --quiet` | sin errores |
| `npx vitest run` | **236 archivos, 1260 pruebas passed** |
| `python manage.py check` | **0 issues** |
| `python -m compileall apps core tests` | OK |
| `ruff check --select F401,F841` sobre los archivos del alcance | **All checks passed** |
| pytest | **no ejecutado** (lo corre el coordinador) |
