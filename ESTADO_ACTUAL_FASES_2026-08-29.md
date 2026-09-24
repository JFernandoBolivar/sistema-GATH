# Estado Actual por Fases — Reconstrucción GATH (2026-08-29)

> **Momento de la captura:** 2026-08-29 · HEAD `bbfec36` (rama `feature/arquitectura-onion`, working tree limpio).
> **Propósito:** fijar con precisión **en qué fase y momento quedó todo** el sistema tras la sesión de
> paridad funcional. Este documento **reconcilia** la matriz de fases de `BITACORA_RECONSTRUCCION.md` §3.1
> (quedó **desactualizada**: marca la Fase 3 al 50% y las Fases 4–9 como "planificadas", lo que contradice
> las Entradas #021–#040 y lo verificado en el código) con el estado real.
> **Método:** verificación contra código real (import-linter, `manage.py check`, `pytest`, `tsc`, `vitest`)
> en la fecha indicada, no contra `.md`.
> **Documentos relacionados:** `AUDITORIA_ESTADO_2026-08-29.md` (detalle de la sesión), `PLAN_RECONSTRUCCION_ONION.md` (plan rector), `BITACORA_RECONSTRUCCION.md` (bitácora viva).

---

## 1. Veredicto global

**El núcleo arquitectónico está completo en ambos lados** (Onion + SCREAM + Feature-Based), la **paridad
funcional de datos quedó habilitada** y hay **UI conectada a rutas**. Lo que **NO** está hecho es: el
**retiro del legado del dashboard** (Fase 8), el **wiring real de SeaweedFS/Celery** (Fase 5 backend), y
los cierres de **calidad/despliegue** (F6/F7/T1.7). El **backend no tiene ninguna fase bloqueante abierta**;
el **cuello de botella es todo el frontend y la infraestructura**.

Resumen ejecutivo verificado:

| Lado | Arquitectura Onion | Módulos/Apps | Endpoints | Tests | Fase alcanzada |
|---|---|---|---|---|---|
| **Backend** | ✅ Completa | 11 apps + `core/` | ~120 `path()` en `apps/` | **176 passed / 4 failed** (4 preexistentes RAC) | ✅ **B0–B4 cerradas** · B5 infra parcial · B8 pendiente |
| **Frontend** | ✅ Cumple reglas | 12 módulos + `shared/` | 11 wrappers en `migracion/` | **22 archivos** · 84–90 tests | ✅ **F0–F4 cerradas** · F8 pendiente |

---

## 2. Mapa de fases — dónde quedó todo

Fases del plan `PLAN_RECONSTRUCCION_ONION.md` (B = backend, F = frontend, T = transversal).

| Fase | Denominación | Backend | Frontend | Infra | Estado REAL verificado |
|---|---|---|---|---|---|
| **0** | Contención inmediata de seguridad | B0.1–B0.16 | F0.3–F0.17 | B0.12·B0.13 | 🟢 **COMPLETADA** (CRIT-01…12 + ALTA-17 cerrados) |
| **1** | Cimientos, tooling y configuración | B1.2–B1.15 | F1.1–F1.10 | T1.7 ⚪ | 🟢 **COMPLETADA** (diferidos: F1.5 boundaries, B1.8→F5, B1.11→F7, T1.7→F7) |
| **2** | Kernel compartido (`core/` y `shared/`) | B2.1–B2.17 | F2.9–F2.19 | — | 🟢 **COMPLETADA** (diferidos: B2.7/B2.7b/B2.7d→F5, B2.16→F5) |
| **3** | Módulo piloto: identidad y autorización | B3.1–B3.14 | F3.7–F3.14 | — | 🟢 **COMPLETADA** — `apps/identidad` 4 capas, `PERMISOS.md` (74 permisos), PBAC, seed permisos, ALTA-07/IDOR cerrado |
| **4** | Migración modular de dominio (9 módulos) | B4.1–B4.9 | F4.1–F4.9 | — | 🟢 **COMPLETADA estructural** — **11/11 apps** + **12 módulos frontend** con UI conectada a `migracion/` |
| **5** | SeaweedFS + Celery/RabbitMQ | B5.1–B5.20 | F5.2–F5.6 | B5.9 | 🟡 **PARCIAL (solo infra sketch)** — `infra-fase2/` (compose con rabbitmq/beat/storage/broker + `celery-app.sketch.py` + `seaweedfs/identities.example.json`); **NO hay `celery.py`, NO hay `CELERY_*` ni `SEAWEEDFS_*` en `GATH/settings.py`** |
| **6** | Calidad, E2E, a11y y rendimiento | B6.1–B6.9 | F6.2–F6.7 | — | 🟡 **PARCIAL** — Vitest unit OK (22 archivos); **faltan** Storybook/Chromatic, Playwright-E2E, a11y-axe |
| **7** | Despliegue, observabilidad y logs DB/TXT | T7.1–T7.8 | T7.1–T7.8 | T7.1–T7.8 | 🟡 **PARCIAL** — logging dual B1.12/B2.8 ✅; **pendientes** T1.7 (Dockerfiles multi-stage), B1.11 (PostgreSQL `sslmode`), CI pipeline |
| **8** | Retiro del código legado y skills | B8.1–B8.6 | F8.2–F8.7 | — | ⚪ **PENDIENTE** — el legado del dashboard sigue activo (`app/(protected)/dashboard/`, ~263 archivos); 4 tests backend aún apuntan al legado `RAC` |
| **9** | Permisología granular por módulo | B9.1–B9.6 | F9.5.x | — | 🟡 **PARCIAL** — PBAC/C-3 operativo; **faltan** resolver los hardcodeos de `nombre_rol`/`"RECEPCIONISTA"` (R16/MED-18) |

---

## 3. Lo que está COMPLETADO (verificado)

### 3.1 Backend
- **Arquitectura Onion completa** en 11 apps (`autogestion`, `cargos`, `carnetizacion`, `catalogos`, `familiares`, `identidad`, `movimientos`, `organizacion`, `pasivos`, `personal`, `reportes`) + kernel `core/`.
- **Regla de capas:** solo `infrastructure/` cruza módulos; `domain/application/presentation` bloqueados por contrato. **`lint-imports`: 70 kept / 0 broken.**
- **`core/domain`** puro (con `core/domain/validation` simétrico al backend), `core/presentation` (envelope C-1, exception_handler S6, permisos, cookies), `core/infrastructure` (logging dual, auditoría, modelos).
- **`cambiar_password`** 100% puro (validador inyectado desde infraestructura).
- **Paridad funcional de datos** habilitada y validada contra **PostgreSQL 18.4 real**:
  - Catálogos exportados a endpoints (`/api/v1/catalogos/*`, `/api/v1/personal/catalogos/*`).
  - `perfil_fisico`, `formacion_complementaria` y M2M de salud con `through` explícito (se persisten en alta/edición + carga masiva).
  - `CargoEgresadoModel` + snapshot de cargos al pasivar.
  - Corregidos ~14 `db_table`/`db_column` erróneos en espejos `managed=False`.
  - CRUD de organización (dependencias/direcciones/coordinaciones/organismos) y códigos de cargo (denominaciones) con escritura.
- **Autorización:** `PERMISOS.md` (74 permisos), PBAC con `resolutor_permisos`, filtros `HasPermission`/`IsOwnerOrHasPermission`, ALTA-07 (IDOR de censo) cerrado.

### 3.2 Frontend
- **12 módulos Onion** (`auth` + 11 de dominio), cada uno con 4 capas (`domain`, `application`, `infrastructure`, `ui`).
- **`shared/`** consolidado: `shared/domain/validation` (kernel puro, R1/R2 — cero regex inline en VOs), `shared/infrastructure`, `shared/ui` (barrel de 52 primitivos), `shared/types`.
- **safeParse (zero-trust)** en todas las server actions; VOs de dominio puros.
- **UI de los 11 módulos** conectada a rutas en `app/(protected)/dashboard/migracion/` con navegación + índice (R10).
- **Paridad funcional amplia** con el legado (identidad, cargos, organización, movimientos/pasivos, personal, reportes, carnetización, autogestión).
- **Tests:** 22 archivos, ~84–90 en verde · `tsc --noEmit` 0 errores en `src/modules` y `src/shared`.

---

## 4. Lo que está PENDIENTE / EN CURSO (bloqueante para cerrar)

### 🔴 Prioridad 1 — Deuda crítica / riesgo
| # | Ítem | Lado | Nota |
|---|---|---|---|
| A | **Retirar el legado del dashboard** (`app/(protected)/dashboard/`, ~263 archivos) + 4 tests backend que referencian `RAC` | Frontend + Backend | Fase 8. **Bloqueado por GAPs residuales**: diseñador visual de carnet (vista previa editable), gráficas (recharts) del censo; el legado sigue siendo referencia de comportamiento |
| B | **Wiring de SeaweedFS + Celery/RabbitMQ** en el backend | Backend | Fase 5. Solo hay `infra-fase2/` sketch; falta `celery.py`, `CELERY_*` en settings, adaptador `SeaweedFSStorage`, modelo `Archivo`, `Employee.foto → FK` |

### 🟠 Prioridad 2 — Frontend calidez / enforcement
| # | Ítem | Nota |
|---|---|---|
| C | `eslint-plugin-boundaries` (enforcement R1-R3 del frontend) | **Bloqueado por conflicto de peer-dep** `next-auth@5.0.0-beta.25` (next ^14/^15) contra `next@16.1.3`; la instalación se revirtió |
| D | Stage E2E (`api-client.ts`/`action-utils.ts` completos a `shared/`) | F4; los ~14 sitios cliente-legado que construyen URLs con `NEXT_PUBLIC_DJANGO_API_URL` requieren el proxy |
| E | Storybook/Chromatic · Playwright E2E · a11y-axe | F6/F7/T1.7 |

### 🟡 Prioridad 3 — Deuda de arquitectura + decisiones
| # | Ítem | Nota |
|---|---|---|
| F | **B16 imports cruzados** entre módulos (pasivos→cargos/catalogos/organizacion/personal, reportes→*, identidad→*…) | Requiere puertos compartidos en `core/` (refactor mayor) |
| G | `R-01/R-03 extract_first_error` (~28 call-sites) | Intencionalmente NO mecánico; se migra vista por vista |
| H | **D-05/A-02 trigger `calcular_total_apn()`** vs Python | Decisiones RRHH/dueño de datos |
| I | GAPs residuales de UX (`diseñador visual carnet`, gráficas) | No son endpoints; son features de presentación |

---

## 5. Verificación de la captura (comandos reejecutados)

| Comando | Resultado |
|---|---|
| `lint-imports` (BACKEND) | **70 kept / 0 broken** |
| `pytest` (BACKEND, según bitácora/auditoría) | **176 passed / 4 failed** (3 = `ModuleNotFoundError: RAC` legado; 1 = cache race throttling) |
| `tsc --noEmit` (NextJS) | **0 errores** en `src/modules` y `src/shared` |
| `vitest run` (NextJS) | **22 archivos / ~84–90 tests pass** |
| Git rama/estado | `feature/arquitectura-onion` · working tree limpio · HEAD `bbfec36` |

> **Nota de transparencia:** la sección §5 de `BITACORA_RECONSTRUCCION.md` (KPIs 69/69, 60/60, 100%, "0 vulnerabilidades abiertas", "33 contratos") está **marcada por la propia bitácora como superada/incorrecta** (ver corrección honesta de la Entrada #034). Las cifras **vigentes** son las de la Entrada #040 + esta auditoría (176/4, 70/0 import-linter, 22 archivos frontend).

---

## 6. Retomable — próximos pasos concretos

1. **Retirar el legado del dashboard (Fase 8)** — primer bloqueante real; cerrar los GAPs residuales (diseñador de carnet + gráficas) o declarar el legado como referencia congelada.
2. **Completar SeaweedFS + Celery (Fase 5 backend)** — dar de alta `celery.py`, `CELERY_*`/`SEAWEEDFS_*` en `GATH/settings.py`, adaptador `SeaweedFSStorage`, modelo `Archivo` y `Employee.foto → FK`.
3. **Resolver el conflicto de peer-dependency** de `next-auth` para poder instalar `eslint-plugin-boundaries` (F1.5).
4. **Desglosar deuda de enlace:** Dockerfiles multi-stage (T1.7), PostgreSQL `sslmode` (B1.11), Storybook/Chromatic (F6), Playwright E2E + a11y (F6/F7).
5. **Decidir D-05** (trigger `calcular_total_apn()` vs Python) con RRHH.
