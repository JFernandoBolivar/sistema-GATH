# NOCHE — Resumen final

**Fecha:** 2026-11-11. **Sin commit propio:** el coordinador decide qué se
commitea; los reportes por paso están en `reportes/` y las decisiones abiertas en
`NOCHE-DECISIONES.md`.

## FASE 1 — Siete tareas

| Tarea | Alcance | Pruebas | Reporte |
| ----- | ------- | ------- | ------- |
| T1 | L2-01 clave de reenvío diaria y L2-02 recuperación de constancias | 258 | `NOCHE-T1.md` |
| T2 | F2-04 verificación QR con sesión vencida y F2-05 IP real (`NUM_PROXIES`) | 261 | `NOCHE-T2.md` |
| T3 | L2-04 conflicto al aplicar acta, L2-12/13/16 presencial, duplicados y vivienda | 565 | `NOCHE-T3.md` |
| T4 | F2-06/08/09/10/11/13/15/16/17 formulario y rutas de carga masiva | vitest 198+4 | `NOCHE-T4.md` |
| T5 | L2-14/15/17/18/20 y A2-12..16/19/20/22 (robustez y errores) | 1097 | `NOCHE-T5.md` |
| T6 | A2-01..04 puertos/adaptadores de `puntocuenta` y `configuracion` | 192 | `NOCHE-T6.md` |
| T7 | Tres specs E2E alineadas a la interfaz actual | tsc/eslint | `NOCHE-T7.md` |

## FASE 2 — Verificación y reconstrucción

`NOCHE-VERIFICACION.md` recoge los comandos y resultados. Resumen:

- Backend: **2190 passed, 1 skipped** en la corrida completa; la única falla
  (`test_arranque_frio`) es sensible a la carga y pasa aislada (5/5).
- `lint-imports`: **103 contratos, 0 rotos**. `makemigrations --check`: sin
  cambios.
- Frontend: `tsc` y `eslint` 0; **210 archivos / 1118 pruebas** de Vitest;
  `next build` correcto.
- Reconstrucción local con `construir.cmd` + `up --force-recreate` y E2E de
  login, fe de vida (en línea y presencial), verificación de constancia, carnet,
  reportes de pasivos y accesibilidad. Resultado conjunto: **26 passed, 3
  skipped, 3 flaky (pasaron al reintento) y 1 timeout de navegación bajo carga**
  que pasa en aislamiento; detalle y estabilización en `AUD3-PASO7.md`.

## FASE 3 — Ocho pasos

| Paso | Reporte | Hallazgos principales | Correcciones aplicadas |
| ---- | ------- | --------------------- | ---------------------- |
| 1. Arquitectura backend | `AUD3-PASO1.md` | 103 contratos; `puntocuenta` devolvía el modelo ORM; `configuracion` tipaba con el ORM; 3 casos de uso sin cablear | Entidad `ConfiguracionPuntoCuenta`; Protocol en `gestionar_politica_correo_acceso` |
| 2. Arquitectura frontend | `AUD3-PASO2.md` | La frontera Onion **no** está en ESLint; dos árboles de componentes; `application` con `apiClient`; `app/` con tipos de `http`; `"use server"` en un layout | Cliente de eventos a `infrastructure/http`; tipos de censo al dominio; directiva retirada |
| 3. API y validación | `AUD3-PASO3.md` | 327 `APIView`, permisos y throttle correctos; import de invitados sin límite; 4 serializers sin `@extend_schema_field`; paginación no aplica a `APIView` | Límite 10 MB y `.xlsx/.csv` con pruebas; anotaciones OpenAPI |
| 4. Seguridad | `AUD3-PASO4.md` | **67 CVE en el frontend (7 críticas, Next/next-auth)**; contraseña inicial del superadmin = cédula; auditoría/login con IP del proxy; `MEDIA_ROOT` y docs con solo sesión | `ip_del_cliente` con `NUM_PROXIES` en auditoría y login + 5 pruebas |
| 5. Modelo de datos | `AUD3-PASO5.md` | Integridad correcta (PROTECT/CASCADE/SET_NULL), índices en las tablas grandes; 3 tablas sin índice; retención de la bitácora QR pendiente | Ninguna (sin cambios de esquema) |
| 6. Pruebas | `AUD3-PASO6.md` | Cobertura fuerte; faltaba el rollback de emisión de carnet | Prueba nueva del rollback L2-18 (1 passed) |
| 7. Móvil y a11y | `AUD3-PASO7.md` | axe: `aria-allowed-attr` del tour (crítica) y `nested-interactive` en la zona de subida (seria); `min-h-screen` | Tour limpia sus atributos ARIA; input fuera del `role="button"`; `min-h-svh`; **9/9 a11y** |
| 8. Simplicidad y despliegue | `AUD3-PASO8.md` | 41 archivos frontend sin referencias y 3 casos de uso backend muertos; contenedor Django como root; etiquetas flotantes | Ninguna (confirmar antes de borrar; Docker solo se reporta) |

## Decisiones que quedan abiertas

En `NOCHE-DECISIONES.md`, por prioridad:

1. **Upgrade de Next y next-auth** (7 CVE críticas, incluida RCE): bloqueante
   antes de producción; rama dedicada con E2E completa.
2. **Contraseña inicial del superadministrador** (env aleatoria + cambio).
3. **Frontera de importación del frontend** (plugin + zonas de los 19 módulos).
4. **Unificación de `src/components` con `src/shared/ui`** y de `lib` con
   `shared/lib`; `app/types` fuera de `app/`.
5. **Paginación de los listados** (censos y exportaciones) y **cobertura del
   esquema OpenAPI** (71 vistas sin `responses=`).
6. **Endurecimiento de contenedores** (usuario, límites, solo el proxy
   publicado, digest fijo) y **pip-audit** en CI.
7. `pip`/`requirements` fijados, Prettier (1192 archivos), `MEDIA_ROOT` y docs
   OpenAPI con permiso administrativo.
8. Limpieza: código muerto confirmado, 3 casos de uso sin cablear, adaptadores
   de `carga-masiva`, retención de la bitácora QR.

## Estado del árbol

Los pasos 1–6 están commiteados (`e5e75d0e`, `94ed8cb6`, `37e8165e`,
`26004778`). Sin commit: los cambios y reportes de los pasos 7 y 8, más
`NOCHE-VERIFICACION.md`, `NOCHE-DECISIONES.md` y este resumen. Los
`NextJS/*.tmp.mjs` y el `.docx` de la raíz son de otros agentes y no se tocaron.
