# INFORME DE EVALUACIÓN Y AUDITORÍA ARQUITECTÓNICA DEL FRONTEND (Next.js)

**Proyecto:** GATH (Sistema Automatizado de Gestión de Personal)  
**Fecha de Evaluación:** 24 de Agosto de 2026  
**Documento de Referencia:** `PLAN_RECONSTRUCCION_ONION.md` (§II.4, §II.7, Reglas R1–R16)  
**Estado de Verificación:** 25/25 Tests Pasados en Vitest (100% Éxito)

---

## 1. Resumen Ejecutivo

Este documento detalla el diagnóstico del código en `NextJS/` frente a la arquitectura objetivo basada en **Onion Architecture / Feature-Scream de 4 capas** (`domain/`, `application/`, `infrastructure/`, `ui/`), tipado estricto con DTOs, permisos PBAC estilo AWS con el evaluador `puede()`, y eliminación de deuda técnica histórica.

### Balance de Cumplimiento General:
* **Núcleo Compartido (`src/shared/`) e Identidad (`src/modules/identidad/`, `src/modules/auth/`):** **100% en cumplimiento arquitectónico**.
* **Dashboard y Vistas de Negocio Legadas (`src/app/(protected)/dashboard/`):** **Pendiente de migración a `src/modules/` (Fase 5)**. Se concentran **33 archivos mayores a 400 líneas** (los mayores superan las 1.600 líneas) y **35 comprobaciones de roles hardcodeadas**.

---

## 2. Matriz de Cumplimiento de Reglas Arquitectónicas (R1 – R16)

| Regla | Descripción de la Regla | Estado | Diagnóstico Técnico y Evidencia |
|---|---|:---:|---|
| **R1** | `domain/` no importa de capas externas ni librerías de I/O | ✅ **CUMPLE** | Verificado en `src/modules/auth/domain/` y `src/modules/identidad/domain/`. Entidades puras sin dependencias de React ni Next.js. |
| **R2** | `application/` depende solo de `domain/` | ✅ **CUMPLE** | Casos de uso desacoplados de frameworks, interactúan con repositorios mediante puertos (`interface`). |
| **R3** | `ui/` no importa de `infrastructure/`: datos por props (DTOs) o server actions | 🟡 **PARCIAL** | Cumple en los módulos migrados (`auth`, `identidad`). En `dashboard/`, los componentes de UI importan fetchers directamente. |
| **R4** | Casos de uso reciben repositorios por parámetro (DI) | ✅ **CUMPLE** | Implementado con inyección de dependencias limpia en casos de uso. |
| **R5** | La UI recibe exclusivamente **DTOs** (no entidades de dominio) | 🟡 **PARCIAL** | Cumple en módulos nuevos. El legado usa interfaces mezcladas provenientes de `src/app/types/types.ts`. |
| **R6** | Sin imports relativos de > 2 niveles (usar `@/`) | ✅ **CUMPLE** | Alias `@/*` → `./src/*` respetado en todo el código nuevo. |
| **R7** | Toda server action captura error y llama `handleSessionExpired` | ✅ **CUMPLE** | Implementado en `src/shared/infrastructure/http/errors.ts` y en `auth-actions.ts`. |
| **R8** | Operaciones asíncronas en UI usan `useTransition` + `startTransition` | 🟡 **PARCIAL** | Aplicado en login y módulos nuevos; pendiente en formularios masivos del dashboard. |
| **R9** | Archivos y carpetas en **kebab-case** | 🟡 **PARCIAL** | Cumple en `src/modules/`. En el legado conviven `reportEmployeePDF.tsx`, `tableFamilys`, `getInfoRac.ts`. |
| **R10** | Páginas de `app/` son **thin wrappers** que delegan a `modules/*/ui/` | 🟡 **PARCIAL** | Login es thin wrapper. Las rutas de `app/(protected)/dashboard/**` contienen cientos de líneas de estado y lógica. |
| **R11** | Tests unitarios `.test.ts(x)` obligatorios junto al archivo | ✅ **CUMPLE** | 5 suites de tests unitarios (**25/25 tests pasando en Vitest** al 100%). |
| **R12** | Stories obligatorias para componentes con variantes visuales | ⚪ **PENDIENTE** | Previsto para los wrappers atómicos de `src/shared/ui/components/`. |
| **R13** | Rutas nuevas llevan caso de accesibilidad en E2E (Playwright) | ⚪ **PENDIENTE** | Previsto al cerrar cada módulo de frontend en E2E. |
| **R14** | `eslint-config-prettier` es el último elemento del array | ✅ **CUMPLE** | Verificado en `NextJS/eslint.config.mjs` (antes de sección `ignores`). |
| **R15** | Sin `NEXT_PUBLIC_` en endpoints internos; centralizar en `api.ts` | 🟡 **PARCIAL** | `src/shared/commons/api.ts` centraliza la URL, pero 12 archivos legados aún leen `process.env.NEXT_PUBLIC_...`. |
| **R16** | Cero decisiones por nombre de rol; usar helper `puede()` PBAC | 🟡 **PARCIAL** | Evaluador PBAC / IAM operativo en `src/shared/lib/evaluador-iam.ts` (`puede()`), pero persisten 35 `nombre_rol === "ADMINISTRADOR"`. |

---

## 3. Inventario de Archivos Críticos ("God Files" > 400 líneas)

Se detectaron **33 archivos que superan el límite de 400 líneas** y que deben ser refactorizados en la Fase 5:

| # | Archivo | Líneas | Módulo Destino | Plan de Descomposición |
|---|---|:---:|---|---|
| 1 | `src/app/(protected)/dashboard/gestion-pasivos/.../crear-familiar.tsx` | **1.676** | `modules/familiares/ui/` | Dividir en 4 subcomponentes atómicos: datos personales, parentesco, documentos, auditoría. |
| 2 | `src/app/(protected)/dashboard/gestion-trabajadores/.../crear-familiar.tsx` | **1.648** | `modules/familiares/ui/` | Eliminar duplicación; unificar con el formulario modular de familiares. |
| 3 | `src/app/(protected)/dashboard/gestion-trabajadores/.../report-employees.tsx` | **1.456** | `modules/reportes/ui/` | Extraer filtros, preview de tabla y exportación a componentes independientes. |
| 4 | `src/shared/forms/employees/register/form-family.tsx` | **1.259** | `modules/familiares/ui/` | Migrar a esquemas Zod atómicos y campos desacoplados. |
| 5 | `src/app/(protected)/dashboard/gestion-pasivos/.../report-pasivo.tsx` | **1.157** | `modules/reportes/ui/` | Unificar con el generador de reportes de `modules/reportes/`. |
| 6 | `src/app/(protected)/dashboard/gestion-trabajadores/.../report-family.tsx` | **958** | `modules/reportes/ui/` | Modularizar sección de reportes de carga familiar. |
| 7 | `src/app/(protected)/dashboard/gestion-trabajadores/.../detail-info.tsx` | **917** | `modules/personal/ui/` | Separar en pestañas (tabs) atómicas de expediente digital. |
| 8 | `src/app/(protected)/dashboard/gestion-trabajadores/retroalimentacion/page.tsx` | **635** | `modules/autogestion/ui/` | Descomponer en formulario y vista de historial. |
| 9 | `src/app/(protected)/dashboard/gestion-trabajadores/.../asignar-codigo-especial-form.tsx` | **624** | `modules/cargos/ui/` | Convertir en modal atómico conectado a `/api/v1/cargos/`. |
| 10 | `src/app/(protected)/dashboard/autogestion/consultar/page.tsx` | **618** | `modules/autogestion/ui/` | Separar tabla de censo y filtros de dependencia. |
| 11 | `src/shared/forms/employees/update/form-supplementary_training.tsx` | **608** | `modules/personal/ui/` | Subformulario de formación complementaria. |
| 12 | `src/app/(protected)/dashboard/gestion-pasivos/.../detail-info.tsx` | **600** | `modules/pasivos/ui/` | Pestañas de detalle de trabajador pasivo / jubilado. |
| 13 | `src/app/(protected)/dashboard/gestion-trabajadores/.../report-leaving.tsx` | **575** | `modules/reportes/ui/` | Reporte de egresos. |
| 14 | `src/app/(protected)/dashboard/autogestion/page.tsx` | **571** | `modules/autogestion/ui/` | Vista del censo del trabajador. |
| 15 | `src/app/(protected)/dashboard/gestion-trabajadores/.../reportEmployeePDF.tsx` | **561** | `modules/reportes/infrastructure/` | Generador PDF de personal. |
| 16 | `src/app/(protected)/dashboard/gestion-trabajadores/.../report-code.tsx` | **559** | `modules/reportes/ui/` | Reporte de asignaciones y vacantes de puestos. |
| 17 | `src/shared/forms/employees/register/form-supplementary_training.tsx` | **552** | `modules/personal/ui/` | Formulario de registro de cursos/talleres. |
| 18 | `src/app/(protected)/dashboard/gestion-trabajadores/.../codigo-catalog-form.tsx` | **542** | `modules/cargos/ui/` | Catálogo de cargos y puestos. |
| 19 | `src/app/types/types.ts` | **542** | `modules/*/domain/` & `shared/types/` | Descomponer en DTOs y entidades por módulo. |
| 20 | `src/shared/forms/employees/update/form-academic_training.tsx` | **537** | `modules/personal/ui/` | Formulario de actualización académica. |
| 21 | `src/app/(protected)/dashboard/gestion-pasivos/.../reportPasivoPDF.tsx` | **514** | `modules/reportes/infrastructure/` | Generador PDF de jubilados. |
| 22 | `src/app/(protected)/dashboard/gestion-trabajadores/.../app-sidebar.tsx` | **509** | `shared/ui/layout/` | Sidebar unificado con menú dinámico por `puede()`. |
| 23 | `src/shared/forms/employees/register/form-academic_training.tsx` | **507** | `modules/personal/ui/` | Formulario de registro académico. |
| 24 | `src/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac.ts` | **502** | `modules/*/infrastructure/http/` | Disolver ~60 fetchers en APIs tipadas por módulo. |
| 25 | `src/app/(protected)/dashboard/gestion-trabajadores/.../detail-info.tsx` (cargos) | **486** | `modules/cargos/ui/` | Detalle de asignación de puesto. |
| 26 | `src/app/(protected)/dashboard/gestion-trabajadores/.../create-direction-dependency.tsx` | **464** | `modules/organizacion/ui/` | Formulario de estructura organizativa. |
| 27 | `src/app/(protected)/dashboard/gestion-trabajadores/.../columns.tsx` (reportes) | **457** | `modules/reportes/ui/` | Definición de columnas de reporte de personal. |
| 28 | `src/app/(protected)/dashboard/gestion-trabajadores/.../prestamo-cargo-form.tsx` | **455** | `modules/cargos/ui/` | Movimiento de comisión de servicio / préstamo. |
| 29 | `src/app/(protected)/dashboard/gestion-pasivos/.../columns.tsx` (reportes pasivos) | **453** | `modules/reportes/ui/` | Columnas de reporte de pasivos. |
| 30 | `src/app/(protected)/dashboard/gestion-trabajadores/.../employee-edit-modal.tsx` | **427** | `modules/personal/ui/` | Modal de edición rápida de datos básicos. |
| 31 | `src/app/(protected)/dashboard/gestion-trabajadores/.../detail-info.tsx` (familiares) | **406** | `modules/familiares/ui/` | Modal de detalle de familiar. |
| 32 | `src/app/(protected)/dashboard/gestion-trabajadores/.../cambiar-codigo-form.tsx` | **402** | `modules/cargos/ui/` | Movimiento de cambio de puesto. |
| 33 | `src/components/ui/sidebar.tsx` | **671** | `shared/ui/components/` | Componente base de Shadcn UI. |

---

## 4. Auditoría de Hardcodeo de Roles (Regla R16 vs PBAC)

Se identificaron **35 comprobaciones de rol por nombre** (`nombre_rol === "ADMINISTRADOR"` / `"RECEPCIONISTA"`) distribuidas en 13 archivos que deben ser sustituidas por el evaluador PBAC:

```typescript
// ❌ ANTES (Hardcodeo frágil):
const soloLectura = session?.user?.role?.nombre_rol === "RECEPCIONISTA";
if (session?.user?.role?.nombre_rol === "ADMINISTRADOR") { ... }

// ✅ OBJETIVO (PBAC Dinámico estilo AWS):
import { puede } from "@/shared/lib/evaluador-iam";
const puedeEditar = puede(session?.user?.permisos, "personal.editar");
const puedeVerReportes = puede(session?.user?.permisos, "reportes.ver");
```

### Ubicaciones Identificadas:
1. `src/app/(protected)/dashboard/autogestion/layout.tsx` (L33, L34, L129)
2. `src/app/(protected)/dashboard/carnetizacion/components/app-sidebar.tsx` (L113, L245)
3. `src/app/(protected)/dashboard/gestion-pasivos/components/layout/app-sidebar.tsx` (L208, L340)
4. `src/app/(protected)/dashboard/gestion-pasivos/components/pasive/tableFamilys/detail-info.tsx` (L54)
5. `src/app/(protected)/dashboard/gestion-pasivos/components/pasive/tablePasive/columns.tsx` (L39)
6. `src/app/(protected)/dashboard/gestion-pasivos/components/pasive/tablePasive/detail-info.tsx` (L51)
7. `src/app/(protected)/dashboard/gestion-trabajadores/components/employees/tableEmployees/columns.tsx` (L42)
8. `src/app/(protected)/dashboard/gestion-trabajadores/components/employees/tableEmployees/detail-info.tsx` (L54)
9. `src/app/(protected)/dashboard/gestion-trabajadores/components/employees/tableFamilys/detail-info.tsx` (L60)
10. `src/app/(protected)/dashboard/gestion-trabajadores/components/layout/app-sidebar.tsx` (L377, L509)
11. `src/app/(protected)/dashboard/gestion-trabajadores/components/reports/` (`report-code.tsx:161`, `report-employees.tsx:262`, `report-family.tsx:434`, `report-leaving.tsx:160`)
12. `src/app/(protected)/dashboard/seguridad/components/app-sidebar.tsx` (L141, L273)
13. `src/proxy.ts` (L14, L17)

---

## 5. Plan de Ejecución de la Fase 5 (Refactorización Modular del Frontend)

```
NextJS/src/
├── shared/                         # ✅ Núcleo Compartido
│   ├── commons/api.ts              # URL centralizada
│   ├── infrastructure/http/        # fetcher-api.ts con verificación de response.ok y 403
│   ├── validation/                 # regex.ts, messages.ts, sanitize.ts
│   ├── lib/evaluador-iam.ts        # Helper puede() para PBAC estilo AWS
│   └── ui/components/              # Shadcn + wrappers de formulario
│
├── modules/                        # 🚀 Módulos de Dominio (Objetivo Fase 5)
│   ├── auth/                       # ✅ Autenticación y Login
│   ├── identidad/                  # ✅ Usuarios, Roles y Políticas PBAC
│   ├── organizacion/               # ⚪ Dependencias, Direcciones y Coordinaciones
│   ├── catalogos/                  # ⚪ Tablas maestras y Geografía
│   ├── cargos/                     # ⚪ Denominaciones y Asignaciones de Puestos
│   ├── familiares/                 # ⚪ Cargas familiares y Documentos
│   ├── personal/                   # ⚪ Expediente digital (activo / pasivo / shared)
│   ├── carnetizacion/              # ⚪ Carnets, validación QR y plantillas
│   ├── autogestion/                # ⚪ Censos y encuestas
│   └── reportes/                   # ⚪ Generador de reportes consolidado
│
└── app/                            # 🚀 Thin Wrappers exclusivamente
    ├── (auth)/login/page.tsx       # ✅ Thin wrapper delegado a modules/auth/ui
    └── (protected)/...             # ⚪ Rutas delegando a modules/[modulo]/ui
```

---

## 6. Estado de Verificación Automatizada

* **Suite de Pruebas Unitarias Frontend:**
  * `fetcher-api.test.ts` → **PASADO**
  * `evaluador-iam.test.ts` → **PASADO**
  * `iniciar-sesion.test.ts` → **PASADO**
  * `schema-login.test.ts` → **PASADO**
  * `listar-usuarios.test.ts` → **PASADO**
  * **Total:** `5/5 archivos pasados`, `25/25 tests pasados` (100% éxito).
