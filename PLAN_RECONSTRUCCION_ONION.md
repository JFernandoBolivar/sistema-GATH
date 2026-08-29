# Plan de Reconstrucción GATH — Arquitectura SCREAM + Feature-Based + Onion

> **Versión 3 — plan operativo dividido por lado del sistema y verificado contra el código.**
> El documento está partido en **PARTE I — BACKEND** (Django/DRF) y **PARTE II — FRONTEND** (Next.js), con
> lo verdaderamente transversal (contratos compartidos, infraestructura, cronograma, decisiones) en partes
> propias. Cada hallazgo, cada tarea y cada regla lleva marcado a qué lado pertenece, de modo que dos
> personas puedan trabajar en paralelo sin leer la mitad del documento que no les toca.
>
> **Alcance:** análisis del sistema actual (backend Django/DRF + frontend Next.js + NestJS-Files) y plan de
> reconstrucción por fases hacia la arquitectura Onion en **ambos lados**, incluyendo el cierre de
> vulnerabilidades y malas prácticas detectadas durante el análisis.
>
> **Guías de referencia — `.claude/skills/`:**
> · Backend: `BACKEND/.claude/skills/` — **6 skills**, 1.380 líneas (§0.4.1).
> · Frontend: `NextJS/.claude/skills/` — **12 skills**, 6.405 líneas (§0.4.2).
> Las carpetas `.opencode/skills/` (2 backend + 8 frontend) quedan como antecedente; el material vigente es
> el de `.claude/skills/`. La §0.4.3 documenta, regla por regla, **qué se adopta, qué se adapta y qué se
> rechaza**, porque las skills fueron escritas para otros proyectos (FITELVEN / FitVen-CONATEL) y hay puntos
> en los que su patrón real **contradice** la arquitectura objetivo de GATH. Ese contraste no es un problema
> del material: es la parte más útil de leerlo.
>
> Fecha de análisis inicial: 2026-08-17 · Adenda de decisiones: 2026-08-18 ·
> Reorganización por lados: 2026-08-20 · **Verificación contra código y consolidación: 2026-08-20** ·
> Rama: `dev`
>
> ---
>
> **Qué cambió en la versión 3**
>
> Esta versión no reorganiza nada: **verifica**. Cada cifra, cada ruta y cada hallazgo de las versiones
> anteriores se comprobó contra el árbol de trabajo en `dev` el 20-08-2026, y el documento anota **con qué
> comando** se comprobó (§0.2 y §0.8). El resultado son seis correcciones de dato, cuatro hallazgos nuevos,
> cuatro decisiones nuevas y una tarea que sube a la Fase 0 porque bloquea todo lo demás.
>
> | # | Cambio | Dónde |
> |---|---|---|
> | 1 | **`B0.0` — la línea base de migraciones sube a la Fase 0.** `**/migrations/` está en `.gitignore` y **hay 0 archivos de migración en el repositorio** con modelos `managed=True`. Sin línea base no se puede desplegar ni un cambio de esquema, así que bloquea B2.7b (tabla `archivo`), B2.7d (`Employee.foto`) y toda la Fase 9. Era MED-01/B1.2; pasa a ser **bloqueante y previo** | §I.3.1, **B0.0**, D-16 |
> | 2 | **Hallazgo nuevo ALTA-18: la recaída de CRIT-10 está a un `git add -A` de distancia.** **No existe `.gitignore` en la raíz** del repositorio, y en el árbol de trabajo hay 4 `.xlsx` con datos de personal, la carpeta `migrar/` con 5 más, y `NextJS/.env.bak_20260819_091833` con los secretos reales — **todos sin versionar y sin ignorar** | §I.3.2, **B0.17**, **F0.2** |
> | 3 | **Hallazgo nuevo MED-19: `CORS_ALLOWED_HEADERS` no existe como setting.** `django-cors-headers` lee `CORS_ALLOW_HEADERS`; el bloque de 9 cabeceras de `settings.py:200` **se ignora en silencio** | §I.3.3, B1.3 |
> | 4 | **Hallazgo nuevo MED-20: no hay `PASSWORD_HASHERS`.** Las contraseñas se guardan con el PBKDF2 por defecto de Django, no con Argon2 como asume la skill `uso-librerias-backend`; y `argon2-cffi` no está en `requirements.txt` | §I.3.3, B1.13 |
> | 5 | **Hallazgo nuevo MED-21: el `Dockerfile` del backend ejecuta `runserver` en producción** y el del frontend hace `npm i` con tres lockfiles presentes, sobre `FROM node` sin fijar versión. Ambos corren como `root` y no tienen multi-stage ni stage de pruebas | §I.3.3, T1.7 |
> | 6 | **Procedimiento obligatorio para mover modelos entre apps** (`SeparateDatabaseAndState`). Sin él, un `makemigrations` ingenuo genera `DeleteModel` + `CreateModel` reales y **borra la tabla con todos los datos** al mover `Employee` de `RAC` a `apps/personal`. Es el riesgo técnico más alto de la Fase B4 y no estaba escrito | **§I.4.7** |
> | 7 | **Decisiones nuevas D-13 a D-16:** el frontend **conserva `src/`** como raíz de código (D-13); la librería de iconos sigue siendo `lucide-react` y **las plantillas de las skills no se copian tal cual** porque importan de `@phosphor-icons/react`, que no está instalado (D-14); Zod se sube a v4 **antes** de escribir el primer schema nuevo (D-15); la línea base de migraciones es requisito de entrada de la Fase 1 (D-16) | Parte V |
> | 8 | **Correcciones de dato verificadas** (las cifras anteriores estaban cerca, no exactas): 138 `@api_view` y **10** clases `APIView` (no 3); **8** archivos de backend > 400 líneas (no 12); 103 archivos `.py` y 16.222 líneas; 404 archivos de frontend y 57.394 líneas; `nombre_rol` aparece en **24** archivos (no 20); **145** rutas declaradas en los cuatro `urls.py` de app | §0.2, §0.8 |
> | 9 | **Confirmaciones que importan**, porque cambian la prioridad: CRIT-03 y CRIT-11 **son reales y siguen en `HEAD`** —`NextJS/.env.docker` y `NextJS/.env.example` versionados con el `AUTH_SECRET`, la clave de cifrado de server actions y una clave de API de Resend; `BACKEND/wait-for-postgres.py` con host y contraseña de `postgres` como valores por defecto—. En cambio **`BACKEND/.env` y `NextJS/.env` nunca estuvieron en el historial**: la exposición viene de los `.example`/`.docker`, no de los `.env` | §I.3.1, §II.3.1 |
> | 10 | **NestJS-Files no tiene una sola línea de autorización** (0 guards, 0 middlewares de auth en sus 17 archivos `.ts`). Refuerza D-01 con evidencia, no con impresión | §I.1.5, D-01 |
> | 11 | **Arranque concreto por lado**: qué hace exactamente cada persona la primera semana, con las tareas en orden y sus criterios de salida | **§0.7** |
> | 12 | **Matriz skill → fase → entregable → regla**, por lado, y su cobertura inversa | **Apéndice D** |
>
> **Lo que NO cambió:** el diagnóstico de fondo, la arquitectura objetivo, el orden de las fases, los 12
> hallazgos críticos, las decisiones D-01…D-12 y los criterios de salida. La versión 2 sigue siendo válida
> como resumen; ésta es la versión operativa.

---

## Cómo leer este documento

| Si eres… | Lee |
|---|---|
| Responsable técnico | Parte 0 completa → Parte IV (cronograma) → Parte V (decisiones) |
| Desarrollador backend | §0.1–§0.5 → **Parte I completa** → Parte III → Apéndice A (B·S) |
| Desarrollador frontend | §0.1–§0.5 → **Parte II completa** → Parte III → Apéndice A (R) |
| Operación / infraestructura | §0.1 → Parte III → Parte V (D-01, D-02, D-03) → Parte VI |
| Seguridad de la información | §0.6 → §I.3 → §II.3 → Apéndice C |

**Convención de identificadores usada en todo el documento:**

| Prefijo | Significado |
|---|---|
| `CRIT-nn` · `ALTA-nn` · `MED-nn` | Hallazgo de auditoría. El mismo número que en la versión anterior; los nuevos continúan la serie |
| `B0.n` … `B9.n` | Tarea de **backend** en la fase `n` |
| `F0.n` … `F9.n` | Tarea de **frontend** en la fase `n` |
| `T1.n` … | Tarea **transversal** (infraestructura, CI, contratos) |
| `B1`–`B26` | Regla de arquitectura de backend |
| `S1`–`S19` | Regla de seguridad (aplica a ambos lados; se indica cuál) |
| `R1`–`R16` | Regla de arquitectura de frontend |
| `R-01`–`R-12` | Elemento del inventario de reubicación de backend (§I.2.2) |
| `D-01`–`D-12` | Decisión tomada |
| `A-01`–`A-10` | Pendiente de respuesta externa |

> Las tareas conservan la numeración de la versión anterior (`0.13`, `2.7b`, `5.3b`…) con el prefijo del
> lado que le corresponde, para que cualquier referencia previa siga siendo localizable. El Apéndice E
> tiene la tabla de correspondencia completa.

---

## Tabla de contenido

**Parte 0 — Contexto común**
- [0.1 Stack real](#01-stack-real-verificado-en-código-no-en-documentación)
- [0.2 Volumetría](#02-volumetría)
- [0.3 Principios de arquitectura comunes](#03-principios-de-arquitectura-comunes-a-ambos-lados)
- [0.4 Inventario de skills y reconciliación](#04-inventario-de-skills-y-reconciliación-con-la-arquitectura-objetivo)
- [0.5 Contratos compartidos backend ↔ frontend](#05-contratos-compartidos-backend--frontend)
- [0.6 Resumen de hallazgos por lado](#06-resumen-de-hallazgos-por-lado)

**Parte I — Backend (Django/DRF)**
- [I.1 Estado actual](#i1-estado-actual-del-backend)
- [I.2 Diagnóstico](#i2-diagnóstico-de-arquitectura--backend)
- [I.3 Auditoría de seguridad y malas prácticas](#i3-auditoría-de-seguridad-y-malas-prácticas--backend)
- [I.4 Arquitectura objetivo](#i4-arquitectura-objetivo--backend)
- [I.5 Mapa de migración](#i5-mapa-de-migración--backend)
- [I.6 Plan por fases](#i6-plan-por-fases--backend)
- [I.7 Reglas y divergencias frente a las skills](#i7-reglas-de-backend-y-divergencias-frente-a-las-skills)
- [I.8 Checklist por módulo](#i8-checklist-de-migración-por-módulo--backend)
- [I.9 Testing](#i9-testing--backend)

**Parte II — Frontend (Next.js)**
- [II.1 Estado actual](#ii1-estado-actual-del-frontend)
- [II.2 Diagnóstico](#ii2-diagnóstico-de-arquitectura--frontend)
- [II.3 Auditoría de seguridad y malas prácticas](#ii3-auditoría-de-seguridad-y-malas-prácticas--frontend)
- [II.4 Arquitectura objetivo](#ii4-arquitectura-objetivo--frontend)
- [II.5 Mapa de migración](#ii5-mapa-de-migración--frontend)
- [II.6 Plan por fases](#ii6-plan-por-fases--frontend)
- [II.7 Reglas y divergencias frente a las skills](#ii7-reglas-de-frontend-y-divergencias-frente-a-las-skills)
- [II.8 Checklist por módulo](#ii8-checklist-de-migración-por-módulo--frontend)
- [II.9 Calidad: tests, visual, accesibilidad y formato](#ii9-calidad-tests-visual-accesibilidad-y-formato--frontend)

**Parte III — Infraestructura y operación (transversal)**
**Parte IV — Secuencia conjunta y cronograma de dos carriles**
**Parte V — Decisiones tomadas (D-01…D-12)**
**Parte VI — Riesgos y pendientes**
**Apéndices** — A: reglas · B: SeaweedFS y RabbitMQ · C: matriz hallazgo→fase→lado · D: skills en detalle · E: trazabilidad con la versión anterior

---
---

# PARTE 0 — CONTEXTO COMÚN

## 0.1 Stack real (verificado en código, no en documentación)

| Capa | Lado | Tecnología | Versión real | Nota |
|---|---|---|---|---|
| Frontend | F | Next.js (App Router) + React | `16.1.3` / `19.2.3` | `next-auth@5.0.0-beta.25` (beta en producción) |
| Backend | B | Django + DRF | `5.2.7` / `3.16.1` | `simplejwt 5.5.1`, `drf-spectacular`, `django-filter` |
| Base de datos | T | PostgreSQL | — | **Instancia externa en otro servidor** (D-03): no se declara en `compose.yml` porque no forma parte de este despliegue. `wait-for-postgres.py`, versionado, expone su host y la contraseña de `postgres` (**CRIT-11**, sigue presente en `HEAD` al 20-08-2026) |
| Archivos | T | NestJS | `11.x` | 2 módulos: `file-save`, `read-file`. **Se retira** (D-01): la lógica se absorbe en el backend y el almacenamiento pasa a SeaweedFS |
| Cola de tareas | B | — | — | `celery` en `requirements.txt` **sin broker ni app**. Objetivo (D-02): Celery + **RabbitMQ** |
| Almacenamiento de objetos | T | — | — | Hoy dos sistemas de ficheros sueltos (§I.1.5). Objetivo (D-01): **SeaweedFS** por gateway S3 |
| Caché | B | — | — | **No existe backend de caché declarado.** Es el hallazgo ALTA-17: el throttling de DRF que la Fase 0 activa necesita uno (D-11) |
| Estilos | F | Tailwind v4 + Radix/shadcn | — | 3 librerías de gráficos simultáneas |
| Validación | F | Zod | `3.25.56` | Las skills objetivo asumen patrones v4 |
| Contenedores | T | Docker Compose | — | 4 servicios + Portainer |

## 0.2 Volumetría — verificada el 20-08-2026 sobre la rama `dev`

Los comandos que producen cada cifra están en §0.8, para que cualquiera pueda repetir la medición y
discutir el dato en vez de la impresión.

| Métrica | Backend | Frontend |
|---|---|---|
| Archivos de código | **103** `.py` (sin migraciones, porque no hay) | **404** archivos `.ts`/`.tsx` en `src/` + `actions/` + `types/` |
| Líneas de código | **16.222** | **57.394** |
| Archivo mayor | `RAC/views/personal_activo_views.py` — **3.174 líneas** | `gestion-pasivos/…/crear-familiar.tsx` — **1.708 líneas** |
| Archivos > 400 líneas | **8** | **34** (51 pasan de 300) |
| Puntos de entrada HTTP | **138 `@api_view`** + **10 clases `APIView`** · 0 `generics.*`, 0 `ViewSet` · **145 `path(...)`** en los 4 `urls.py` de app | **73** `page.tsx`/`layout.tsx`/`route.ts` · 1 `proxy.ts` |
| Tests | **4 funciones `def test_`** en 128 líneas (`AUTOGESTION` 125 + `CARNETIZACION` 3). **`RAC` y `USER` no tienen ninguno** | **0** |
| Migraciones versionadas | **0 archivos** (`**/migrations/` está en `.gitignore`) | — |
| Autorización por nombre de rol | comparaciones dispersas, sin resolutor | **35** referencias a `nombre_rol` en **24** archivos · **22** literales `"RECEPCIONISTA"` en 10 (MED-18) |
| Herramientas de calidad instaladas | ninguna (sin `ruff`, `black`, `mypy`, `pytest`, `import-linter`) | solo `eslint`; sin Prettier, Vitest, Playwright, Storybook ni reglas de frontera |

**Repartición del backend por app** (líneas, sin migraciones): `RAC` 12.225 (75 %) · `USER` 1.423 ·
`AUTOGESTION` 1.220 · `CARNETIZACION` 1.009 · `SIGEP` 277. La proporción es el argumento de §I.2: `RAC` no
es una app, es el sistema entero con un nombre que no dice nada.

**Repartición del frontend**: todo el código de dominio vive dentro de `src/app/(protected)/dashboard/`,
colocado por ruta (`api/`, `actions/`, `components/`, `schema/` dentro de cada carpeta de pantalla). No
existe `modules/`, ni `domain/`, ni `application/`. Sí existen **tres** carpetas transversales que se
solapan: `src/shared/`, `src/components/` y `src/lib/`.

## 0.3 Principios de arquitectura comunes a ambos lados

```
presentation/ui  →  application  →  domain
                         ↑
                  infrastructure (implementa los puertos de domain)
```

1. **SCREAM** — la estructura de carpetas nombra el dominio (`personal`, `cargos`, `familiares`),
   no la tecnología (`views`, `components`).
2. **Feature-Based** — cada módulo es autónomo y contiene sus cuatro capas completas.
3. **Onion** — las dependencias apuntan siempre hacia adentro. `domain` no importa nada externo.
4. **Un solo lenguaje de dominio** en backend y frontend: mismos nombres de módulo, mismas entidades.
   Es lo que permite que este documento esté dividido en dos partes sin que se conviertan en dos
   sistemas distintos: `apps/personal/activo/` del backend y `modules/personal/activo/` del frontend
   hablan de la misma cosa y se migran en la misma sub-fase.

**Equivalencia de nombres entre los dos lados** — la tabla que hace legible la división del documento:

| Concepto | Backend (`BACKEND/`) | Frontend (`NextJS/`) |
|---|---|---|
| Código transversal | `core/` | `shared/` |
| Módulo de dominio | `apps/[modulo]/` | `modules/[modulo]/` |
| Capa interna | `domain/` (entities, value_objects, ports) | `domain/` (entities, value-objects, ports) |
| Casos de uso | `application/use_cases/` | `application/use-cases/` |
| Adaptadores | `infrastructure/` (models, mappers, repositories, serializers) | `infrastructure/` (http, mappers, repositories, actions) |
| Capa externa | `presentation/` (views, filters, permissions, urls) | `ui/` (schema, forms, pages) |
| Punto de entrada | `config/urls.py` → `/api/v1/` | `app/` (App Router, thin wrappers) |
| Contrato de respuesta | `core/presentation/envelope.py` | `shared/types/api-respose.ts` |
| Nomenclatura de archivos | `snake_case.py` | `kebab-case.ts` |

## 0.4 Inventario de skills y reconciliación con la arquitectura objetivo

Las skills son la fuente de verdad de **cómo se escribe** el código; este plan es la fuente de verdad de
**qué se construye y en qué orden**. Cuando las dos cosas chocan, manda este plan y la divergencia queda
escrita (§0.4.3).

**Advertencia que aplica a las 18 skills:** todas fueron escritas para otros proyectos —las de frontend
para **FITELVEN**, las de backend para **FitVen/CONATEL**— y describen *lo que esos proyectos hacen hoy*,
no necesariamente lo que GATH debe hacer. Sus módulos de ejemplo (`transporte`, `comedor`, `operador`,
`inversor`, `recaudacion`) no existen aquí. Se leen como **especificación de patrón**, jamás como catálogo
de módulos.

### 0.4.1 Skills de backend — `BACKEND/.claude/skills/`

| Skill | Líneas | Qué aporta | Se usa en |
|---|---|---|---|
| `arquitectura-onion-feature-scream` | 317 | Capas y reglas de dependencia en Django, tabla de convención de nombres, patrón evento→signal→Celery con `transaction.on_commit()`, truco de `models.py` que re-exporta, árbol de decisión "¿dónde vive este código?", reglas R1–R9 propias | Fases B2, B3, B4, B5 |
| `patrones-drf-implementacion` | 303 | Serializers de lectura/escritura separados, `@extend_schema_field` obligatorio, guard `swagger_fake_view`, `_padre_o_404`, prohibición de `StringRelatedField` en endpoints públicos, `MensajeRespuestaSerializer`, scopes de throttling documentados | Fases B0, B2, B3, B4 |
| `autenticacion-permisos-jwt` | 190 | Modelo usuario/rol por FK, cookie `HttpOnly` + helpers `cookies.py`, rotación con blacklist, permisos componibles con `\|`, y la advertencia de **no confiar en claims de rol embebidos en el JWT** | Fases B0, B3, B9 |
| `uso-librerias-backend` | 168 | Configuración real de Celery (autodiscover, tasks con IDs y backoff), caché con `IGNORE_EXCEPTIONS` (falla abierto), `ENUM_NAME_OVERRIDES` de drf-spectacular, Argon2 como hasher activo, CORS por entorno | Fases B1, B5 |
| `testing-backend-django` | 185 | Factories que pasan por el servicio real, aislamiento de la caché de throttling en tests, mocking en el punto de entrada del servicio, un test de éxito y uno de error por invariante | Fases B3, B4, B6 |
| `integracion-bd-recaudacion` | 217 | Plantilla completa de integración con una base ajena: router por módulo de origen, `managed=False`, `allow_migrate=False`, rol SQL de solo lectura, `connect_timeout`, degradación a 503 cuando el sistema externo no está | §I.4.6 (fuentes legadas) y D-03 |

### 0.4.2 Skills de frontend — `NextJS/.claude/skills/`

| Skill | Líneas | Qué aporta | Se usa en |
|---|---|---|---|
| `arquitecto-scream-feature-onion` | 1.307 | **Fuente de verdad de la estructura**: patrón de módulo y sub-módulo, orden de creación en 16 pasos, mapa del flujo de datos de lectura y escritura, plantillas de los 13 tipos de archivo, convención de nombres, reglas de `.env`, árbol Server/Client Component, reglas R1–R10 | Fases F2, F3, F4 |
| `patrones-implementacion-frontend` | 1.449 | Formularios `react-hook-form`+Zod, wrappers `InputForm`/`SelectForm`/`DateForm`/`FileForm`/`TextareaForm`, `DireccionAdminSelects` (4 selects en cascada), `CedulaSearch`, 5 patrones de estado de carga, lectura y render condicional de permisos, `revalidatePath`, tema, proxy de PDF | Fases F3, F4, F5, F6 |
| `validacion-input-protegido` | 499 | Regla "no al hardcodeo", archivo único de regex y mensajes, plantillas Zod (regex, `refine`, `transform`, `z.enum`), validación zero-trust en server actions, saneamiento, casos borde de la cédula venezolana | Fases F2, F4 |
| `testing-e2e-playwright` | 458 | Config multi-navegador, fixture de login con `storageState`, Page Object genérico, especificaciones CRUD y de formularios, regla "módulo nuevo ⇒ E2E nuevo", mapa módulo→ruta | Fases F4, F6 |
| `testing-unit-vitest` | 209 | **Nueva.** Qué se puede y qué no testear con Vitest en Next.js 16 (los Server Components async y las server actions **no**), tests junto al archivo, plantillas para casos de uso con repo falso, schemas Zod, componentes y el cliente HTTP con MSW | Fases F1, F4, F6 |
| `storybook-chromatic` | 166 | **Nueva.** Stories junto al componente, plantilla con `Meta`/`StoryObj`, los **3 temas** del proyecto (ojo: `:root` es el tema *conatel*, no el claro), regresión visual con Chromatic, addon de a11y por componente | Fases F1, F6 |
| `testing-a11y-axe` | 95 | **Nueva.** `@axe-core/playwright` dentro de la suite E2E existente, alias `base`/`authTest`, regla "ruta nueva ⇒ caso de a11y", qué hacer con una violación real | Fases F4, F6 |
| `formato-prettier` | 124 | **Nueva.** Prettier como única fuente del formato y ESLint como fuente de la arquitectura, `eslint-config-prettier` **al final** del array, orden correcto `eslint --fix` → `prettier --write`, `format:check` como puerta del build | Fases F1, F6 |
| `despliegue-docker-django-nextjs` | 420 | Dockerfiles multi-stage con stage `tester` que corre lint, typecheck y tests, `output: standalone`, compose de producción y de desarrollo, `.dockerignore`, entrypoint del backend | Fases T1, T7 |
| `design-taste-frontend` | 1.304 | Criterio visual, tipografía, calibración de color, disciplina de layout, modo oscuro obligatorio, patrones prohibidos ("AI tells") | Fase F6 |
| `mobile-first-design` | 96 | Breakpoints, objetivos táctiles ≥ 48 px, colapso del sidebar, tablas responsivas | Fase F6 |
| `animaciones-frontend` | 278 | Árbol de decisión entre Motion/Anime/GSAP/CSS, patrones canónicos, `prefers-reduced-motion`, patrones prohibidos | Fase F6 |

### 0.4.3 Reconciliación: qué se adopta, qué se adapta y qué se rechaza

Esta tabla es el resultado de leer las 18 skills contra la arquitectura objetivo. **Sin ella, seguir las
skills al pie de la letra produciría un sistema distinto del que este plan describe.**

#### Backend

| # | Punto de la skill | Qué dice la skill | Qué hace GATH | Por qué |
|---|---|---|---|---|
| B-a | Nombre de la capa externa | `api/` | **`presentation/`** | Espejo simétrico del `ui/` del frontend y del vocabulario Onion del §0.3. Equivalencia documentada; los ejemplos de la skill se leen sustituyendo `api/` por `presentation/` |
| B-b | **Capa de repositorio** | Su regla **R5 la prohíbe explícitamente**: "este proyecto no usa el patrón repository, el acceso a datos es ORM directo desde `application/` y `api/`" | **GATH sí usa puertos y repositorios** (ver **D-09**) | Es la divergencia de mayor peso. En FitVen el ORM directo es sostenible: hay 120 tests y servicios pequeños. En GATH hay **148 puntos de entrada con ORM incrustado, 3.174 líneas en un archivo y cero tests en `RAC`**. El puerto es precisamente lo que permite probar un caso de uso sin base de datos, que es el criterio de salida de la Fase B4. Sin repositorio, la Fase B6 no es alcanzable |
| B-c | ViewSets y routers | Prohibidos: "100% `generics.*View` + `views.APIView`, sin `DefaultRouter`" | **Mixto** (ver **D-10**): router para los CRUD mecánicos de `catalogos/` y `organizacion/`; vistas explícitas para todo lo demás | GATH tiene ~35 endpoints de catálogo de solo lectura, prácticamente idénticos entre sí: escribirlos a mano 35 veces es el problema que ya tiene. Para el resto —acciones de negocio como egresar, prestar cargo, emitir carnet— la regla de la skill es la correcta y se adopta |
| B-d | Un archivo por capa y por app (`models.py`, `serializers.py`, `views.py` únicos) | Sí, "no un archivo por entidad" | **Un archivo por entidad o por caso de uso**, con techo de **400 líneas** | GATH llega a este plan *por haber hecho exactamente lo que la skill describe*: `personal_activo_views.py` tiene 3.174 líneas y `personal_activo_serializers.py` 768. La propia skill admite dividir "cuando el archivo crece demasiado"; aquí ya creció |
| B-e | `models.py` de la app re-exporta el módulo interno | Sí, con explicación: Django descubre modelos en `<app>.models` | **Se adopta tal cual** | Es la pieza que hacía falta para que `infrastructure/models/` no rompa el descubrimiento de Django. Entra como **B2.15** |
| B-f | Evento de dominio → signal → receiver → `transaction.on_commit()` → `.delay()` | Patrón obligatorio; `.delay()` directo solo en un caso documentado | **Se adopta**, con una excepción de forma: los casos de uso encolan por el **puerto `TaskQueue`** (regla B20), y es el adaptador el que respeta `on_commit()` | Cierra un hueco real del plan anterior: decía "los casos de uso encolan por el puerto" pero no decía *cuándo*. Encolar antes del commit hace que el worker lea filas que aún no existen. Nueva regla **B22** |
| B-g | Contrato de las tareas Celery | `@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=3)`, reciben **IDs** no instancias, toleran `DoesNotExist` con `warning` | **Se adopta y se endurece** con `acks_late=True`, `time_limit` y clave de idempotencia | El plan ya pedía `acks_late` e idempotencia; la skill aporta la firma concreta y la razón de pasar IDs. Nueva regla **B23** |
| B-h | Caché con `IGNORE_EXCEPTIONS: True` (falla abierto) | Sí, para que la app siga si la caché cae | **Se adopta el criterio, no el backend** (Redis): GATH usa **caché en PostgreSQL** para los contadores de throttling (**D-11**) | D-02 evitó deliberadamente añadir Redis como cuarto almacén. Pero el throttling de la Fase B0 **necesita** un contador compartido entre workers de gunicorn: sin backend declarado, la caché local por proceso hace que un límite de 5/min sea en realidad 5×N (**ALTA-17**) |
| B-i | Argon2 primero en `PASSWORD_HASHERS` | Sí, con advertencia de no reordenar | **Se adopta** | La Fase B0 reescribe el cambio de contraseña (CRIT-04) de todas formas: es el momento exacto para fijar el hasher. Entra como **B1.13** |
| B-j | `@extend_schema_field` en todo `SerializerMethodField`, guard `swagger_fake_view`, `ENUM_NAME_OVERRIDES` | Obligatorios | **Se adoptan como reglas B24, B25** | Sin costo y evitan que el esquema OpenAPI —que a partir de B0.11 queda autenticado y pasa a ser el contrato con el frontend— salga mal tipado |
| B-k | Prohibido `StringRelatedField` en serializers `AllowAny` | Sí, por fuga vía `__str__` | **Se adopta como regla S18** | Es exactamente el mecanismo de **ALTA-05** (`api_validar_carnet` devuelve el expediente por un `carnet_id` secuencial) |
| B-l | El rol **no** va dentro del JWT; se consulta `request.user` porque el claim se desactualiza | Sí | **GATH sí transporta permisos en el token, pero con `permisos_version`** (§I.6.9) | La advertencia de la skill es correcta y es justamente la razón de existir de `permisos_version`: al cambiar los permisos se incrementa el entero, el refresco detecta la diferencia y reconstruye el token. Un permiso revocado deja de aplicar en minutos, no en 8 horas |
| B-m | Herramienta de test: Django `TestCase`/`APITestCase`, **sin pytest** | Prohibido introducir pytest | **GATH usa `pytest` + `pytest-django`** (ver **D-12**), y **adopta** las tres prácticas valiosas de la skill: factories que pasan por el caso de uso real, aislamiento de la caché de throttling, y mocking en el punto de entrada del servicio | En FitVen la prohibición protege consistencia con 120 tests existentes. GATH tiene 128 *líneas* de test: no hay nada con lo que ser consistente, y el criterio de salida de B4 —probar casos de uso **sin base de datos**— se expresa mucho mejor con `pytest` |
| B-n | Router de base de datos ajena (`managed=False`, `allow_migrate=False`, rol de solo lectura, degradación a 503) | Patrón completo | **Se reserva** para las fuentes legadas de migración de datos (`SAGP`, `SIGEP`, la carpeta `migrar/`) — §I.4.6 | La base de PostgreSQL de GATH es la propia, no un espejo ajeno; pero el patrón es la plantilla exacta si hay que leer las bases viejas sin poder escribirlas. De ahí se toma además `connect_timeout` y `CONN_MAX_AGE` para la conexión externa de D-03 |

#### Frontend

| # | Punto de la skill | Qué dice la skill | Qué hace GATH | Por qué |
|---|---|---|---|---|
| F-a | **`.env` versionado** | "`.env` está en git — contiene defaults de desarrollo" | **Prohibido.** Ningún `.env` en el repositorio; solo `.env.example` sin valores reales | Es literalmente **CRIT-03**: los `.env` versionados de GATH contienen `AUTH_SECRET`, la clave de cifrado de server actions y una clave de API real. La regla de la skill se rechaza sin matices |
| F-b | `DJANGO_API_SERVER` server-only, sin `NEXT_PUBLIC_` | Sí | **Se adopta** | Cierra **ALTA-15**. La variable actual (`NEXT_PUBLIC_DJANGO_API_URL_SERVER`) mete el host interno de la API en el bundle del navegador |
| F-c | `apiClient` con `get/post/patch/put/delete/postForm/patchForm/getBlob` | Sí | **Se adopta y se endurece**: verificación de `response.ok` (ALTA-01) y refresco **sin promesa global compartida** (CRIT-09) | La forma del cliente de la skill es correcta; la implementación actual de GATH tiene dos defectos que la skill no contempla porque en su proyecto no existen |
| F-d | Permisos como `{id, code, name}[]` en `session.user.permisos` | Sí | **Se adopta como objetivo** (Fase F9) | El objetivo de la Fase 9 ya estaba previsto en la skill: es la forma exacta a la que hay que llegar |
| F-e | Zod v4 en las plantillas | Asumido | GATH está en **Zod 3.25.56** → subir a v4 en **F1.9** | Las plantillas de las skills no compilan tal cual contra v3 en algunos casos (`z.enum`, mensajes de error) |
| F-f | Tests unitarios junto al archivo, obligatorios para casos de uso, schemas y componentes presentacionales | Sí | **Se adopta como regla R11** | Es la pieza que faltaba: el plan anterior solo tenía E2E, y los casos de uso puros son justamente lo más barato de probar |
| F-g | Server actions y Server Components async **no** se testean con Vitest | Sí, con la razón (`cookies()` fuera del scope de petición) | **Se adopta tal cual** | Evita que el equipo pierda días peleando con un test que no puede funcionar. Van a Playwright |
| F-h | `:root` es el tema **conatel** (ni claro ni oscuro) | Sí, advertido | **Se verifica en GATH antes de copiar nada** (F6.4) | Es una particularidad del otro proyecto; en GATH hay que comprobar cuál es el tema por defecto real antes de escribir stories o pruebas visuales |
| F-i | `eslint-config-prettier` **al final** del array de configuración | Sí | **Se adopta como regla R14** | Si se coloca antes de los bloques de arquitectura, esos bloques vuelven a chocar con el formato sin que nadie lo note |
| F-j | Stories obligatorias para componentes con más de una variante visual | Sí | **Se adopta como regla R12**, limitada a `shared/ui/components/` y a los componentes de módulo con estados visuales relevantes | Cubrir 60+ componentes shadcn con stories no aporta; cubrir los wrappers de formulario y las tablas con y sin datos, sí |
| F-k | Regla "ruta nueva ⇒ caso de a11y" | Sí | **Se adopta como regla R13** | Se apoya en la suite de Playwright que la Fase F4 ya crea; costo marginal |
| F-l | Módulos de ejemplo (`transporte`, `comedor`, `apoyo`, `servicios`) | Ilustrativos | Se sustituyen por los **10 módulos de GATH** (§II.5) | Los ejemplos se actualizan al dominio real al cerrar la Fase F4 (tarea F8.6) |

## 0.5 Contratos compartidos backend ↔ frontend

Son los cinco puntos donde los dos lados se tocan. **Cambiar cualquiera de ellos exige coordinar los dos
carriles del cronograma (Parte IV); todo lo demás puede avanzar en paralelo.**

| # | Contrato | Forma | Lado que lo produce | Lado que lo consume | Se establece en |
|---|---|---|---|---|---|
| C-1 | **Sobre de respuesta** | `{status, message, data}` en toda respuesta, de éxito y de error | Backend (`core/presentation/envelope.py`) | Frontend (`apiClient` + `shared/types/api-respose.ts`) | B2.3 · se preserva sin cambios durante toda la migración |
| C-2 | **Autenticación y sesión** | Cookies `dj_access` (15 min) y `dj_refresh` (8 h) fijadas por `authorize()`; una sola llamada de login; `session.maxAge` alineado con `REFRESH_TOKEN_LIFETIME` | Backend emite y rota los tokens | Frontend los guarda y los adjunta como `Bearer` | B3.6 + F3.7 + F3.8 (**hito de sincronización H-2**) |
| C-3 | **Autorización por código de permiso** | `HasPermission("modulo.accion")` en el backend; `session.user.permisos = {id, code, name}[]` en el frontend; **cero comparaciones de nombre de rol en cualquiera de los dos lados** | Backend define el catálogo (`PERMISOS.md`) | Frontend construye menús y renderiza condicionalmente | B3.2/B3.3 + F3.9/F9.5 (**H-3**) |
| C-4 | **Trabajo asíncrono** | `202 Accepted` con `{status, message, data: {tarea_id}}`; `GET /api/v1/tareas/{id}/` → `pendiente\|en_proceso\|completada\|fallida` y, al completar, el `archivo.id` del resultado | Backend (Celery + RabbitMQ) | Frontend (`useSWR` con intervalo) | B5.17 + F5.4 (**H-5**) |
| C-5 | **Trazabilidad correlacionada** | `trace_id` generado en el frontend, enviado en cabecera, presente en los tres destinos de log | Frontend lo nace | Backend lo propaga a la tabla `auditoria`, al log técnico y a las tareas de Celery | F2.8d + B2.8 + T7.5 (**H-4**) |

**Contrato de versionado de rutas (C-6, D-06):** las rutas legadas siguen respondiendo igual mientras el
módulo nuevo publica bajo `/api/v1/`. El frontend se reapunta **módulo por módulo**; nunca hay un día de
cambio total. Una ruta legada se marca `deprecated` en el esquema OpenAPI y con cabecera `Deprecation`, y
solo se borra cuando la Fase 8 comprueba que no tiene consumidores.

## 0.6 Resumen de hallazgos por lado

| Severidad | Solo backend | Solo frontend | Ambos / infraestructura | Total |
|---|---|---|---|---|
| Críticos | CRIT-01, 02, 04, 05, 06, 07, 08, 11, **12** | CRIT-09 | CRIT-03, CRIT-10 | **12** |
| Altos | ALTA-04, 05, 06, 07, 08, 11, 14, 16, **17** | ALTA-01, 02, 15 | ALTA-03, 09, 10, 12, 13 | **17** |
| Medios | MED-01, 03, 04, 05, 06, 14, 16, 17 | MED-07, 08, 09, 10, 12, **18** | MED-02*, 11, 13, 15 | **18** |

<small>*MED-02 no existe en la serie: la numeración original salta de MED-01 a MED-03. Se conserva el salto para no romper referencias.</small>

**El escenario de mayor riesgo sigue siendo backend y sigue siendo el mismo**: la combinación de
**CRIT-04 + CRIT-05 + CRIT-08**, ahora agravada por **CRIT-12**. Un atacante sin credenciales cambia la
contraseña de un administrador (CRIT-04) o crea una cuenta con el rol que elija (CRIT-05); desde ahí la
API no impone ninguna restricción (CRIT-08) y además puede **crear, renombrar o borrar roles** del sistema
(CRIT-12). En paralelo, CRIT-06 y CRIT-07 permiten extraer documentación personal sin autenticarse en
absoluto, y **CRIT-10 + CRIT-11** significan que cualquiera con el repositorio ya tiene una copia del
expediente de personal *y la llave del original*.

Tratándose de datos de personal de un organismo público, la Fase 0 no es negociable ni postergable.

## 0.7 Arranque: la primera semana, por lado

Es la parte del plan que se puede empezar mañana. Las dos columnas corren **en paralelo** y se encuentran
en el hito H-1 (rotación de secretos en la misma ventana).

| Día | Backend (1 persona) | Frontend (1 persona) |
|---|---|---|
| **1** | **B0.0** — línea base de migraciones: quitar `**/migrations/` del `.gitignore`, `makemigrations` + `migrate --fake-initial` contra una **copia** de la base, comparar el esquema generado con el real y commitear. Nada más se despliega hasta que esto exista | **F0.2** — crear `.gitignore` en la raíz del repositorio con `*.xlsx`, `*.sql`, `.env*`, `migrar/`, `*.bak_*`; verificar con `git status --porcelain` que ningún dato personal ni secreto queda "listo para commitear" (ALTA-18) |
| **1–2** | **B0.12 + B0.13** — purgar del índice y del historial `SAGP_CONATEL.sql`, `SIGEP_MINISTERIO.sql` y `wait-for-postgres.py`; **rotar la contraseña de `postgres`** (CRIT-10, CRIT-11) | **F0.3** — purgar `NextJS/.env.docker` y los valores reales de `NextJS/.env.example`; preparar las claves nuevas (`AUTH_SECRET`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, Resend) sin aplicarlas todavía (CRIT-03) |
| **2** | **B0.1 + B0.2** — `SECRET_KEY` a variable y **rotada**, `SIGNING_KEY` del JWT independiente, `DEBUG` por variable, cookie `Secure` con variable propia (CRIT-01, CRIT-02) | **F0.17** — cookies con `httpOnly`/`secure`/`sameSite` explícitos, no derivados de `NODE_ENV` |
| **3** | **B0.4 + B0.5 + B0.15** — cambio de contraseña sobre `request.user` con contraseña actual; `register_view` sin `rol` asignable; los 3 endpoints de roles con permiso administrativo (CRIT-04, CRIT-05, CRIT-12) | **F0.4 + F0.9** — `changePasswordAction` deja de aceptar `userId`; `refreshPromise` pasa a ámbito por petición (ALTA-02, CRIT-09) |
| **4** | **B0.6 + B0.7** — documento familiar con permiso y UUID; retirar `static(MEDIA_URL, …)` de `urls.py` y servir por vista autenticada (CRIT-06, CRIT-07) | Verificación cruzada de F0: dos usuarios concurrentes con tokens por expirar **no** intercambian sesión; prueba documentada |
| **5** | **B0.8 + B0.10 + B0.11 + B0.16** — permisos explícitos en los ~20 endpoints de escritura de mayor impacto; throttling **con `DatabaseCache` declarado**; docs y admin cerrados; barrido de `AllowAny` con justificación escrita | **H-1** con backend: aplicar las rotaciones **en la misma ventana** (D-08 / A-05) y confirmar que el login funciona extremo a extremo |

**Al terminar la semana 1** el sistema ya no es vulnerable a los 12 hallazgos críticos y **existe una línea
base de migraciones**, que es la condición para que las fases 1 y 2 puedan tocar el esquema. Recién
entonces empieza el trabajo de arquitectura.

**Lo único que puede bloquear este arranque** es A-05: la ventana de mantenimiento acordada con operación,
porque rotar `SECRET_KEY` y `AUTH_SECRET` cierra todas las sesiones activas. Todo lo demás de la semana 1
se puede hacer sin ventana.

## 0.8 Cómo se verificó cada cifra de este documento

Se dejan los comandos porque un plan que afirma "34 archivos superan 400 líneas" y no dice cómo lo supo
envejece mal: dentro de tres meses nadie sabrá si la cifra bajó o si el criterio cambió.

```bash
# Volumetría de código
find BACKEND -name '*.py' -not -path '*/migrations/*' | wc -l                    # 103
find BACKEND -name '*.py' -not -path '*/migrations/*' -exec cat {} + | wc -l     # 16222
find NextJS/src NextJS/actions NextJS/types -name '*.ts*' | wc -l                # 404
find NextJS/src NextJS/actions -name '*.ts*' -exec cat {} + | wc -l              # 57394

# Archivos por encima del techo de 400 líneas (reglas B13 / MED-07)
find BACKEND -name '*.py' -not -path '*/migrations/*' -exec wc -l {} + | awk '$1>400 && $2!="total"'
find NextJS/src NextJS/actions -name '*.ts*' -exec wc -l {} + | awk '$1>400 && $2!="total"'

# Puntos de entrada HTTP del backend
grep -rh '@api_view' --include='*.py' BACKEND | wc -l                            # 138
grep -rhE 'class .*\((APIView|views\.APIView)' --include='*.py' BACKEND | wc -l  # 10
grep -c 'path(' BACKEND/{RAC,USER,CARNETIZACION,AUTOGESTION}/urls.py             # 112+14+13+6 = 145

# Tests
grep -rh 'def test_' --include='*.py' BACKEND | wc -l                            # 4

# Migraciones versionadas
find BACKEND -path '*/migrations/*.py' | wc -l                                   # 0
grep -n 'migrations' BACKEND/.gitignore                                          # las ignora

# Autorización por nombre de rol (MED-18, techo decreciente)
grep -rn 'nombre_rol' NextJS/src NextJS/actions | wc -l                          # 35
grep -rl 'nombre_rol' NextJS/src NextJS/actions | wc -l                          # 24 archivos
grep -rn 'RECEPCIONISTA' NextJS/src NextJS/actions | wc -l                       # 22

# Secretos y datos versionados (CRIT-03, CRIT-10, CRIT-11)
git ls-files | grep -E '\.env($|\.)|\.sql$|wait-for-postgres\.py'
git log --all --oneline --diff-filter=A -- '*.env'                               # vacío: los .env nunca se commitearon
git status --porcelain | grep '^??'                                              # ALTA-18: qué está sin ignorar

# Ausencia de autorización en NestJS-Files (D-01)
grep -rn 'Guard\|canActivate\|Authorization' NestJS-Files/src | wc -l            # 0
```


---
---
# PARTE I — BACKEND (Django / DRF)

## I.1 Estado actual del backend

### I.1.1 Apps y responsabilidad actual

| App | Contenido | Problema estructural |
|---|---|---|
| `RAC` | Personal activo/pasivo, cargos, ubicación organizacional, familiares, historial de movimientos, reportes PDF | God-app: 8 dominios distintos en una app; views de 3.174 líneas |
| `USER` | Cuentas, roles, departamentos, login/refresh/logout JWT, **y desde el 19-08-2026 el CRUD de roles** | Modelo `cuenta` sin `PermissionsMixin`; sin autorización (CRIT-08, CRIT-12) |
| `CARNETIZACION` | Plantillas de carnet, generación PDF, validación pública | `models.py` plano, `views.py` de 366 líneas |
| `AUTOGESTION` | Censo de vivienda (encuestas), export Excel, reporte por dependencias | Sin verificación de propiedad del recurso |
| `SIGEP` | Settings, URLs raíz | Secretos en código, media pública |

### I.1.2 Flujo de manejo actual

```
HTTP → urls.py (paths sueltos, sin router)
     → @api_view función (validación + reglas de negocio + ORM + formato de respuesta juntos)
       ├── serializers/*  (DRF, hace de DTO y de validador y de mapper)
       ├── services/*     (existe, pero solo para PDF, Excel, egreso y préstamo de cargo)
       ├── models/*       (ORM Django, acceso directo desde las views)
       └── filters/*      (django-filter)
     → Response({status, message, data})
```

- **No hay capa de aplicación.** Las reglas de negocio viven dentro de las funciones de vista.
- **No hay puertos ni inversión de dependencias.** Las views importan modelos concretos con `import *`.
- El sobre de respuesta `{status, message, data}` es una convención consistente y **debe preservarse**
  como contrato de la capa de presentación (C-1: el frontend depende de ella).
- Existe un embrión de capa de servicios (`RAC/services/`, `USER/services/token_service.py`) que
  es el punto de partida natural para `application/use_cases/`.

**Activos reutilizables** (no se tiran): los modelos ORM, los servicios de PDF y Excel, los serializers
como validadores de frontera, y `django-filter` como base de los filtros de presentación.

### I.1.3 Autenticación actual desde el lado del backend

`USER/authentication.py::CookieJWTAuthentication` acepta el token **por cookie (`access_token`) o por
header `Authorization: Bearer`**; `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]` para los **148 puntos de entrada** (138 `@api_view` + 10 clases `APIView`).

`USER/services/token_service.py` mezcla dos responsabilidades —emisión/rotación de tokens y fijación de
cookies HTTP— y contiene ALTA-08: pasa un `int` a `RefreshToken.for_user()`, lo que produce un
`AttributeError` no capturado por `except TokenError`; los tokens rotados pierden los claims
`cedula`/`rol`; y no se revalida `is_active`, así que **un usuario suspendido conserva sesión hasta 8 h**.

El contrato completo de autenticación extremo a extremo, con la parte del frontend, está en §II.1.3.

### I.1.4 Gestión de roles añadida el 19-08-2026 (fuera del plan original)

Mientras se redactaba este plan se incorporó al sistema en producción una **API de gestión de roles**
(`USER/views/rol_views.py`, commits `21fd7bc` y `4fdd073`) y un **rol `RECEPCIONISTA` de solo consulta**.
Es trabajo legítimo y necesario, pero llega con dos consecuencias que el plan tiene que absorber:

| Hecho verificado | Consecuencia | Se atiende en |
|---|---|---|
| `crear_rol` (línea 44), `actualizar_rol` (81) y `eliminar_rol` (131) declaran `@permission_classes([IsAuthenticated])` | Cualquier cuenta autenticada —incluidas las ~N cuentas con rol `AUTOGESTION` que `crear_usuarios.py` generó para todo el personal— puede **crear, renombrar o borrar cualquier rol del sistema**. Nuevo hallazgo **CRIT-12** | **B0.15** |
| El rol nuevo se implementó como comparación de nombre en el frontend: **22 apariciones de `"RECEPCIONISTA"`** y **35 de `nombre_rol`** en **24** archivos de `NextJS/src` | Cada rol nuevo que se agregue por este camino encarece la Fase 9. Nuevo hallazgo **MED-18** | **F3.13** (congelar) y **F9.5.2** (sustituir) |

**Lectura para el equipo:** no es un error de quien lo implementó — es la señal de que el sistema **no
tiene hoy ningún otro mecanismo disponible** para expresar "este rol solo consulta". Esa es exactamente la
carencia que cierran las fases B3 (autorización por código de permiso) y B9 (permisología por módulo).
Hasta que B3 exista, cualquier rol nuevo se seguirá implementando así.

### I.1.5 Manejo de archivos hoy — la parte del backend

Es la pieza que más cambia en este plan, así que se documenta el estado real antes de tocarla.

**Servicio NestJS-Files** — 2 módulos, ~150 líneas de lógica útil:

| Endpoint | Qué hace exactamente |
|---|---|
| `POST file-save/upload/:folderId` | Multer guarda en `uploads/temp/` con el **nombre original**; el pipe valida MIME (`jpeg/jpg/png`), normaliza con `sharp` a 1024×768 `fit: contain` y **mueve** el archivo a `uploads/:folderId/`, **borrando antes todos los archivos** de esa carpeta |
| `POST file-save/upload/profile/:folderId` | Igual, con destino `uploads/:folderId/profile/` |
| `GET read-file/:folderId` | Lista el directorio y devuelve **el primer** `.pdf/.png/.jpg/.jpeg` que encuentra, en streaming con `disposition: inline` |
| `GET read-file/profile/:folderId` | Igual, sobre `uploads/:folderId/profile/` |

**Consumidores desde el backend:** `CARNETIZACION/views.py::_upload_to_nestjs()` y
`_fetch_photo_from_nestjs()` — el backend **ya** habla HTTP con el servicio de archivos vía
`settings.NESTJS_URL`, con `urllib` y multipart armado a mano. (Los 7 consumidores del frontend están
en §II.1.5.)

**Hechos que condicionan la migración:**

1. **`folderId` es la cédula del empleado.** No hay identificador opaco: la URL de la foto de cualquier
   persona es adivinable, y el servicio **no tiene autenticación** — solo `NEST_CORS`, que no protege una
   petición directa.
2. **No existe ninguna tabla de archivos, y el campo que debería apuntar a la foto está roto.**
   `Employee.profile` (`RAC/models/personal_models.py:481`) **sí es el campo destinado a la foto**, pero
   hoy no cumple su función por tres razones acumuladas:
   - **Guarda solo el nombre original, no una dirección resoluble.** `foto.jpg` no dice en qué carpeta
     está; el único vínculo real empleado↔imagen sigue siendo la **convención de nombre de carpeta**.
   - **Nadie lo lee para localizar el archivo.** La lectura va siempre por cédula. El campo se usa solo
     como **bandera "¿tiene foto?"** en los PDF de reporte (`reportEmployeePDF.tsx:294`,
     `reportPasivoPDF.tsx:288`), que luego pintan la imagen desde otra fuente.
   - **La carga masiva lo sobrescribe y en la práctica lo borra.** `personal_activo_views.py:392` mapea
     `'profile': row.get('perfil_profesional')` dentro de un `Employee.objects.update_or_create(...,
     defaults=employee_data)` (línea 402). No existe ningún concepto de *perfil profesional* en el modelo,
     ni en los tipos del frontend, ni en ningún esquema: si la columna no viene en el Excel —el caso
     normal—, el valor resultante es `None` y **cada carga masiva deja sin referencia de foto a todos los
     empleados que toca**. Efecto visible: los reportes PDF dejan de mostrar la foto aunque el archivo
     siga en disco. Registrado como **ALTA-16**.

   El objetivo (D-01) es que `profile` deje de ser texto libre y pase a ser **`foto` → FK a `archivo`**
   (UUID): una referencia real, verificable y auditable.
3. **La lógica sí es necesaria y hay que conservarla:** validación de MIME, normalización a un tamaño
   único, un solo archivo vigente por carpeta (reemplazo, no acumulación) y respuesta en streaming con el
   `Content-Type` correcto.
4. **Convive con un segundo almacenamiento.** Django guarda en `MEDIA_ROOT` los documentos familiares
   (`FamilyDocument.file` → `familiares/`), las plantillas de carnet (`carnet_templates/`) y los PDF de
   carnet emitidos (`carnet_pdfs/`), y los sirve **públicamente** (CRIT-07). Hoy hay **dos gestores de
   archivos con dos modelos de seguridad distintos, y ninguno de los dos es correcto**.
5. **Los volúmenes no están en el repositorio.** `/var/www/backup/uploadsNestFS` (fotos) y
   `/opt/gath/BACKEND/media` (documentos) existen solo en el servidor. El inventario —cantidad, tamaño,
   cédulas sin foto, huérfanos— **debe levantarse en el host de producción** antes de la Fase B5; es el
   insumo que dimensiona la migración (**A-01**).

---

## I.2 Diagnóstico de arquitectura — backend

| Dimensión | Estado | Evidencia |
|---|---|---|
| Separación de capas | ❌ Ausente | Reglas de negocio dentro de `@api_view` |
| Inversión de dependencias | ❌ Ausente | `from ..models.personal_models import *` en views |
| Cohesión por feature | ⚠️ Por app monolítica | `RAC` = 8 dominios |
| Contratos tipados | ⚠️ Serializers hacen de DTO, validador y mapper a la vez | `personal_activo_serializers.py` (768 líneas) |
| Testabilidad | ❌ Nula | Reglas de negocio acopladas al ORM; `RAC` sin tests |
| Trazabilidad de dependencias | ❌ Imposible de validar | `import *` + re-export por `globals()` en `RAC/views/__init__.py` |
| Convención de nombres | ⚠️ Mezcla ES/EN, PascalCase en URLs | `Employeefamily/`, `asignacion_CodigoEspecia/` (typo) |
| Autorización | ❌ Inexistente más allá de `IsAuthenticated` | 148 puntos de entrada (138 `@api_view` + 10 `APIView`); ninguna verificación de rol ni de propiedad |

### I.2.1 Dependencia circular entre apps

`RAC` importa de `USER` en **8 lugares** (modelos, serializers, filtros, views) y `USER` importa de `RAC`
en **5** — incluido `from RAC.models import *` en `USER/serializers/USER_serializers.py:3`. Es un ciclo
entre las dos apps centrales: ninguna puede evolucionar ni probarse por separado.

### I.2.2 Inventario de reubicación (código compartido de facto)

Además de la falta de capas, hay funciones y responsabilidades **alojadas en la app equivocada**. Son
código que ya es compartido en la práctica, pero que vive dentro de un dominio concreto y se consume desde
fuera. Esto es lo que hoy produce el acoplamiento entre apps.

| # | Origen actual | Problema | Destino en la nueva arquitectura | Se mueve en |
|---|---|---|---|---|
| R-01 | `RAC/filters/filters_personal.py:7` → `CuentaFilter` | Filtra el modelo `cuenta` de **USER**, pero vive en RAC y lo consume `USER/views/user_views.py:26`. RAC importa el modelo de USER solo para esto | `apps/identidad/presentation/filters/cuenta_filters.py` | B3 |
| R-02 | `RAC/utils/data_formatters.py:12` → `CleanZerosMixin` | Usado por **7 serializers de 2 apps**, y `USER` lo importa **re-exportado** desde `personal_activo_serializers` (768 líneas) en lugar de su origen | `core/infrastructure/serializer_mixins.py` | B2.8b |
| R-03 | `RAC/utils/data_formatters.py:5` → `extract_first_error` | Usado por views de varias apps para desempacar errores de serializer | `core/presentation/` — o **desaparece**: el `exception_handler` centralizado (B2.4) lo vuelve innecesario | B2.8b |
| R-04 | `RAC/utils/constants.py` | Constantes de estatus (`ESTATUS_ACTIVO`, `PERSONAL_PASIVO`, `ESTATUS_PERMITIDOS`…) consumidas por views, services y comandos de varias apps. Son *strings* comparados contra valores de base de datos: cualquier edición en la tabla los desincroniza en silencio | Los que son invariantes de negocio → `apps/*/domain/value_objects/`; los que son datos → `catalogos` con acceso por clave natural | B4.2 |
| R-05 | `RAC/utils/tiempo_servicio.py` → `calcular_tiempo_comercial`, `calcular_total_apn` | **Lógica de dominio pura escondida en `utils/`** y **duplicada con dos representaciones distintas que hoy se publican juntas** (ver D-05) | Fuente autoritativa única — resuelto en D-05 con verificación previa obligatoria | B4.3 |
| R-06 | `RAC/utils/mapa_reporte.py` (190 líneas) y `AUTOGESTION/utils/mapa_reporte.py` (19 líneas) | **El mismo concepto implementado dos veces**: un registro que mapea nombre de campo → ruta de consulta ORM para armar reportes. Dos formatos distintos para el mismo problema | Contrato en `core/domain/ports.py` + registro declarado por cada módulo en su `infrastructure/` | B5.11 |
| R-07 | `RAC/services/pdf/{base_generator,templates/styles,templates/components}` (640 líneas) vs `CARNETIZACION/services/{designer,generator,helpers}` (488 líneas) | **Dos infraestructuras de reportlab independientes**, cada una con su propia base, estilos y componentes | Base, estilos y componentes → `core/infrastructure/pdf/`; los generadores concretos quedan en `reportes/` y `carnetizacion/` | B2.8b |
| R-08 | `RAC/serializers/personal_activo_serializers.py` | Importado por **4 módulos de serializers de otras apps**: los serializers de un dominio se usan como si fueran contratos compartidos | Cada módulo define sus propios serializers; lo verdaderamente común son entidades y DTOs en `personal/shared/domain` | B4.3 |
| R-09 | `RAC/services/profile_services.py` → `upsert_contrato` | Es un caso de uso (escribe y decide), pero se invoca desde serializers y desde comandos de management | `apps/personal/activo/application/use_cases/upsert_contrato.py` | B4.3 |
| R-10 | `USER/authentication.py` → `CookieJWTAuthentication` | Clase de autenticación global del proyecto (declarada en `DEFAULT_AUTHENTICATION_CLASSES`) alojada dentro de una app de dominio | `core/infrastructure/authentication.py` | B2.8b |
| R-11 | `USER/services/token_service.py` | Mezcla dos responsabilidades: emisión/rotación de tokens (identidad) y fijación de cookies HTTP (presentación) | Emisión → `apps/identidad/application/use_cases/`; cookies → `core/presentation/cookies.py` (patrón `api/cookies.py` de la skill `autenticacion-permisos-jwt`) | B3.6 |
| R-12 | `RAC` como god-app | `RAC` significa "Registro de Administración y Control", pero contiene 8 dominios. El nombre no comunica nada (falla el principio SCREAM) | Se disuelve en los 11 módulos de §I.5; el nombre `RAC` desaparece | B4 completa |

### I.2.3 La regla que evita la recaída

La causa de fondo es que no había un lugar donde poner el código compartido: al no existir `core/`, todo
lo transversal terminó en la app más grande (`RAC`), que se convirtió en dependencia de las demás.

> **Si 2+ módulos lo usan, va en `core/`. Si un módulo importa de otro módulo, es un error de diseño —
> salvo que el import sea de `core/`.** (regla **B16**)

`import-linter` lo verifica con un contrato de independencia entre módulos (§I.4.3), de modo que un ciclo
como el actual entre `RAC` y `USER` deja de ser posible.

**Conclusión:** el backend no requiere un reescrito desde cero. Requiere una **reorganización por capas
con estrangulamiento módulo a módulo** (patrón *strangler fig*), preservando el esquema de base de datos y
el contrato de respuesta `{status, message, data}`.

---

## I.3 Auditoría de seguridad y malas prácticas — backend

> Cada hallazgo indica la fase en la que se cierra. Los `CRIT-*` se corrigen en la Fase B0, **antes** de
> iniciar cualquier trabajo de arquitectura, porque el sistema está en operación.

### I.3.0 Bloqueador estructural: no hay migraciones versionadas

No es una vulnerabilidad, y por eso la versión anterior lo tenía como MED-01 en la Fase B1. Es un error de
prioridad: **es la única tarea del plan que bloquea a todas las demás**, así que sube a la Fase 0 como
**B0.0**.

| Hecho verificado (20-08-2026) | Comando |
|---|---|
| `**/migrations/` está en `.gitignore` (tres patrones, al final del archivo) | `grep -n migrations BACKEND/.gitignore` |
| **Hay 0 archivos de migración en el repositorio** | `find BACKEND -path '*/migrations/*.py' \| wc -l` → `0` |
| Los modelos son `managed = True` y las tablas existen en la base de producción | `RAC/models/*.py`, `USER/models/*.py` |

**Qué significa en la práctica.** El esquema de la base de datos de producción **no tiene representación en
el repositorio**. Nadie puede levantar el sistema desde cero, nadie puede correr pruebas de integración
contra una base limpia, y —lo determinante para este plan— **ningún cambio de esquema es desplegable**:

- **B2.7b** (tabla `archivo`) y **B2.7d** (`Employee.foto` → FK) son cambios de esquema.
- **B4** mueve modelos entre apps, lo que exige migraciones de estado (§I.4.7).
- **B9** crea cuatro tablas de permisos.
- **T7.1** pide un entrypoint que corra `migrate` de forma controlada; hoy no hay nada que correr.

Y hay un riesgo adicional que se materializa el día que alguien haga `makemigrations` sin línea base: Django
generará **la creación completa de todas las tablas**, y aplicarlo contra la base real fallará a mitad de
camino dejando el estado a medias. Por eso B0.0 se hace **contra una copia** y se valida comparando el
esquema generado con el real **antes** de commitear.

### I.3.1 Críticas — remediación inmediata (Fase B0)

| ID | Hallazgo | Ubicación | Impacto |
|---|---|---|---|
| **CRIT-01** | `SECRET_KEY` embebida en el código y reutilizada como `SIGNING_KEY` del JWT | `SIGEP/settings.py:25`, `:190` | Cualquiera con acceso al repositorio **forja tokens válidos de cualquier usuario**. Suplantación total |
| **CRIT-02** | `DEBUG = True` | `SIGEP/settings.py:28` | Trazas, SQL y settings expuestos en errores. Además `AUTH_COOKIE_SECURE = not DEBUG` ⇒ **cookies de sesión viajan por HTTP** |
| **CRIT-04** | `cambiar_password_primera_vez` con `@permission_classes([AllowAny])`: recibe `id` + `password` sin token, sin OTP y sin contraseña actual | `USER/views/user_views.py:458-485` | **Toma de control de cualquier cuenta sin autenticación**, incluidas las administrativas. Además omite `AUTH_PASSWORD_VALIDATORS` |
| **CRIT-05** | `register_view` con `AllowAny` y `RegisterSerializer` que acepta el campo `rol` | `USER/views/user_views.py:234-236`, `USER/serializers/USER_serializers.py:96` | **Alta de cuentas sin autenticar eligiendo el rol** ⇒ escalada de privilegios directa |
| **CRIT-06** | `descargar_documento_familiar` con `AllowAny` e `id` secuencial | `RAC/views/family_views.py:431-432` | **Descarga masiva no autenticada de documentos familiares** (partidas, cédulas, informes). Fuga de datos personales sensibles |
| **CRIT-07** | `MEDIA_ROOT` servido públicamente por Django sin autorización | `SIGEP/urls.py` (`+ static(settings.MEDIA_URL, ...)`) | Todo archivo subido (fotos, documentos) accesible por URL directa |
| **CRIT-08** | **Control de acceso roto de forma global:** los **148** puntos de entrada de la API con solo `IsAuthenticated`; cero verificación de rol o de propiedad | `SIGEP/settings.py:175-177` + todas las views | `USER/management/commands/crear_usuarios.py` crea una cuenta para **todo el personal** con rol `AUTOGESTION`. Cualquiera de esas cuentas puede leer/modificar todo el expediente de personal, asignar cargos, egresar empleados y emitir reportes llamando la API directamente. `src/proxy.ts` solo restringe la **UI**, no la API |
| **CRIT-11** | **Credenciales de la base de datos de producción versionadas en git** | `BACKEND/wait-for-postgres.py:13-17` (sigue en `git ls-files` y en `HEAD` al 20-08-2026) | Host `172.16.10.209` y contraseña del usuario `postgres` **como valores por defecto en el código**. Concede acceso directo de superusuario al servidor externo, sin pasar por la aplicación: lectura, modificación y borrado de todo el expediente, y omisión completa de la autorización. Agrava CRIT-10: quien tenga el repositorio no solo tiene una copia de los datos, tiene **la llave del original** |
| **CRIT-12** | **La API de roles no verifica ningún permiso.** `crear_rol`, `actualizar_rol` y `eliminar_rol` declaran `@permission_classes([IsAuthenticated])` | `USER/views/rol_views.py:44-46`, `:81-83`, `:131-133` (añadido el 19-08-2026) | Cualquier cuenta autenticada **crea, renombra o borra roles del sistema**. Combinado con ALTA-06 (`editar_usuario` sin permiso administrativo) permite fabricar un rol y asignárselo. Borrar el rol de un módulo puede además dejar sin acceso a los usuarios legítimos: es también un vector de denegación de servicio funcional |

**Críticos que comparte con el frontend / la infraestructura** (detalle en §II.3 y Parte III):
CRIT-03 (secretos versionados), CRIT-09 (mezcla de sesiones en el `apiClient`), CRIT-10 (volcados de
base de datos en git — verificado el 20-08-2026: los dos `.sql` **siguen versionados**; están borrados del
árbol de trabajo pero no del índice ni del historial, así que la exposición está intacta).

### I.3.2 Altas — backend (Fases B0–B4)

| ID | Hallazgo | Ubicación | Impacto | Fase |
|---|---|---|---|---|
| ALTA-04 | Sin limitación de tasa en ningún endpoint (`DEFAULT_THROTTLE_*` ausente) | `SIGEP/settings.py:171-181` | Fuerza bruta sobre `accounts/login/`; enumeración sobre `validar-carnet` y `empleados-cedula` | B0.10 → B3.12 |
| ALTA-05 | `api_validar_carnet` con `AllowAny` devuelve nombre, cédula, cargo y ubicación por `carnet_id` secuencial | `CARNETIZACION/views.py:237-238` | Enumeración no autenticada del directorio completo de personal | B4.8 |
| ALTA-06 | `editar_usuario`, `cambiar_estado_usuario`, `usuarios_lista` sin verificación de rol administrativo | `USER/views/user_views.py:275`, `:322`, `:367` | Cualquier usuario autenticado cambia el rol/departamento/contraseña de otro, lo suspende y lista todas las cuentas | B3.5 |
| ALTA-07 | Endpoints de autogestión sin verificación de propiedad de la cédula | `AUTOGESTION/urls.py` (`censo-vivienda/<cedula_empleado>/`, `consultar/<cedula>/`) | Un empleado registra y consulta el censo de vivienda de cualquier otro | B3.4 |
| ALTA-08 | `TokenService.refresh_access_token` pasa un `int` a `RefreshToken.for_user()` | `USER/services/token_service.py:112` | `AttributeError` no capturada por `except TokenError` ⇒ **500 en el refresco** con rotación activada; los tokens rotados pierden los claims `cedula`/`rol`; no se revalida `is_active` ⇒ un usuario suspendido conserva sesión hasta 8 h | B3.6 |
| ALTA-11 | Mensajes de error que filtran internos: `f"Ocurrió un error inesperado: {str(e)}"` | `USER/views/user_views.py:312`, `:395`; `CARNETIZACION/views.py:234`; `AUTOGESTION/views/encuesta_views.py:42` | Divulgación de estructura interna y de mensajes del ORM | B2.4 |
| ALTA-14 | `/api/docs/`, `/api/schema/`, `/api/redoc/` y `/admin/` públicos | `SIGEP/urls.py` | Mapa completo de la API entregado a un atacante | B0.11 |
| ALTA-16 | **Pérdida silenciosa de datos en la carga masiva:** `'profile': row.get('perfil_profesional')` dentro de un `update_or_create` con `defaults` — la columna no existe en ningún esquema, el valor queda en `None` y borra la referencia de foto de cada empleado procesado | `RAC/views/personal_activo_views.py:392,402` | Los reportes PDF dejan de mostrar la foto de todo empleado incluido en un Excel de carga, aunque el archivo siga en disco. Ninguna traza: no hay log ni aviso | B0.14 → B5.6b |
| **ALTA-17** | **El throttling que la Fase 0 activa no tiene dónde contar.** No hay `CACHES` declarado en `settings.py`, así que DRF usa `LocMemCache`: los contadores viven **en la memoria de cada proceso de gunicorn** y se pierden en cada reinicio | `SIGEP/settings.py` (ausencia de `CACHES`) + B0.10 | Un límite de "5 intentos por minuto" con 4 workers es en realidad **20 por minuto**, y basta un reinicio para reiniciar el contador. La contención de ALTA-04 sería aparente, no real. Ver **D-11** | B0.10 |
| **ALTA-18** | **La recaída de CRIT-10 está a un `git add -A` de distancia.** **No existe `.gitignore` en la raíz del repositorio.** En el árbol de trabajo, sin versionar y **sin ignorar**: `TRABAJADORES_UNIFICADO_ACTIVOS_PASIVOS.xlsx`, `PERSONAL QUE NO TIENEN TIPO DE NOMINA.xlsx`, `BACKEND/FAMILIARES_UNIFICADO_3.xlsx` y la carpeta `migrar/` con 5 `.xlsx` más —todos con datos de personal identificable— además de `NextJS/.env.bak_20260819_091833`, que contiene los secretos reales, y `compose.yml.bak_20260818_164546` | raíz del repositorio (`git status --porcelain \| grep '^??'`) | La disciplina de "commitear solo código" es hoy lo **único** que impide que el expediente de personal vuelva al historial de git. Un `git add -A` o `git commit -a` distraído reproduce CRIT-10 y añade CRIT-03. `NextJS/.gitignore` ignora `.env` y `.env.local`, pero **no** `.env.docker` (que sí está versionado) ni `.env.bak_*` | **B0.17** + **F0.2** |

### I.3.3 Medias — backend

| ID | Hallazgo | Ubicación | Fase |
|---|---|---|---|
| MED-01 | `**/migrations/` en `.gitignore` ⇒ migraciones no versionadas con modelos `managed = True` | `BACKEND/.gitignore` (final) | B1.2 |
| MED-03 | `import *` en views y re-export por `globals()` en `RAC/views/__init__.py` ⇒ grafo de dependencias no auditable | `RAC/views/*` | B4 |
| MED-04 | IDs mágicos codificados: `Tipo_personal…id=2`, `Dependencias…id=1`, `User…id=10` | `RAC/views/personal_activo_views.py:76-78` | B4 |
| MED-05 | `filterset.qs[:10]` en lugar de la paginación configurada | `USER/views/user_views.py:380` | B3.5 |
| MED-06 | `PAGE_SIZE = 10` global pero las funciones `@api_view` devuelven querysets completos; `select_related` inconsistente (N+1) | Global | B4 y B6 |
| MED-14 | `USE_TZ` duplicado; `POPPLER_PATH` con ruta de Windows en contenedor Linux; `CARNET_VALIDATOR_URL` con `https://midominio.com` | `settings.py:147,151,166-169` | B1.3 |
| MED-16 | Nomenclatura mixta ES/EN y PascalCase en URLs; typo `asignacion_CodigoEspecia`; `Employeefamily/<int:familiar_id>` sin barra final | `RAC/urls.py:129,198` | B4 |
| MED-17 | El sobre `{status, message, data}` se arma a mano en cada view (148 veces) | Todas las views | B2.3 |
| MED-11 (parte backend) | `celery` sin broker ni app; `django-simple-history` instalado pero **ausente de `INSTALLED_APPS`** | `requirements.txt`, `settings.py:38-54` | B1.8 — resuelto por D-02 y D-04 |
| MED-13 (parte backend) | Cero tests automatizados y cero CI | Todo el backend | B6.1 |
| **MED-19** | **`CORS_ALLOWED_HEADERS` no es un setting de `django-cors-headers`** — la librería lee `CORS_ALLOW_HEADERS`. El bloque de 9 cabeceras declarado se **ignora en silencio** y rige la lista por defecto | `SIGEP/settings.py:200-210` | B1.3 |
| **MED-20** | **No hay `PASSWORD_HASHERS`:** las contraseñas se guardan con el PBKDF2 por defecto de Django, no con Argon2 como asume la skill `uso-librerias-backend`; y **`argon2-cffi` no está en `requirements.txt`** | `SIGEP/settings.py` (ausencia) + `requirements.txt` | B1.13 |
| **MED-21** | **Los dos `Dockerfile` son de desarrollo.** Backend: `CMD ["python3", "manage.py", "runserver", "0.0.0.0:8000"]` —con `gunicorn` instalado y sin usar—, sin multi-stage, sin `collectstatic`, como `root`. Frontend: `FROM node` **sin fijar versión**, `npm i` ignorando los lockfiles (coexisten `pnpm-lock.yaml` y `package-lock.json`), sin `output: standalone`, sin stage de pruebas, como `root` | `BACKEND/django.dockerfile`, `NextJS/nextjs.dockerfile` | T1.7 |
| **MED-22** | El docstring de `settings.py` dice "Generated by django-admin startproject using Django 6.0.1" mientras `requirements.txt` fija `Django==5.2.7`, y el `Dockerfile` usa `python:3.11-slim`. Documentación interna que miente sobre la versión | `SIGEP/settings.py:1-10` | B8.4 |

---

## I.4 Arquitectura objetivo — backend

### I.4.1 Estructura de carpetas

```
BACKEND/
├── config/                    (renombra SIGEP/)
│   ├── settings.py            único — toda diferencia entre entornos va en variables
│   ├── urls.py                → /api/v1/ (router donde aplica, ver D-10)
│   ├── celery.py              app de Celery + autodiscover (D-02)
│   └── asgi.py · wsgi.py
├── core/                      ← equivalente a shared/ del frontend
│   ├── domain/
│   │   ├── entity.py          Entity base (dataclass congelada)
│   │   ├── value_objects.py   VO base
│   │   ├── exceptions.py      DomainError · NotFound · ValidationError · PermissionDenied · ConflictError
│   │   ├── events.py          señales de dominio (patrón adoptado, §0.4.3 B-f)
│   │   └── ports.py           Repository · UnitOfWork · FileStorage · TaskQueue · ReportGenerator
│   ├── application/
│   │   ├── use_case.py        contrato base
│   │   ├── unit_of_work.py
│   │   └── use_cases/         guardar_archivo · obtener_archivo · eliminar_archivo
│   ├── infrastructure/
│   │   ├── base_repository.py · orm_mixins.py · serializer_mixins.py (R-02)
│   │   ├── authentication.py  ← R-10
│   │   ├── models/            archivo.py · auditoria.py       (D-01, D-04: hoy no existen)
│   │   ├── storage/           seaweedfs_storage.py · filesystem_storage.py · image_processor.py
│   │   ├── pdf/               base_generator.py · styles.py · components.py  ← R-07
│   │   ├── tasks/             celery_app.py · task_queue.py   ← adaptador RabbitMQ (D-02)
│   │   └── receivers.py       conecta events.py con las tareas (dentro de on_commit)
│   └── presentation/
│       ├── envelope.py        {status, message, data} — único lugar donde se arma
│       ├── exception_handler.py · pagination.py · throttles.py
│       ├── permissions.py     HasPermission · IsOwnerOrHasPermission
│       ├── cookies.py         ← R-11 (parte de presentación de token_service)
│       ├── schema.py          MensajeRespuestaSerializer + helpers de drf-spectacular
│       ├── audit.py · logging.py
├── apps/
│   └── [modulo]/
│       ├── domain/            entities/ · value_objects/ · ports/ · exceptions.py
│       ├── application/       dtos/ · use_cases/
│       ├── infrastructure/    models/ · mappers/ · repositories/ · serializers/ · services/
│       ├── presentation/      views/ · permissions/ · filters/ · urls.py
│       ├── models.py          ← re-exporta infrastructure/models/ (patrón adoptado, §0.4.3 B-e)
│       ├── apps.py            AppConfig; ready() solo si el módulo tiene receivers propios
│       └── migrations/
└── tests/
    ├── unit/                  dominio y casos de uso — sin base de datos
    ├── integration/           repositorios y endpoints con base de datos
    └── e2e/                   flujos completos
```

### I.4.2 Reglas de dependencia entre capas

| Capa | Puede importar | No puede importar |
|---|---|---|
| `domain/` | solo `domain/` y la biblioteca estándar | Django, DRF, ORM, otras capas |
| `application/` | `domain/` | `infrastructure/`, `presentation/`, ORM, Celery |
| `infrastructure/` | `domain/`, `application/`, Django/DRF | `presentation/` |
| `presentation/` | `application/`, `domain/` (tipos), `core/presentation/` | ORM directo, `infrastructure/models` |
| cualquier módulo | `core/` | otro módulo de `apps/` |

**Contrato preservado:** `core/presentation/envelope.py` produce `{status, message, data}` de forma
centralizada, de modo que el frontend actual sigue funcionando durante toda la migración (C-1).

### I.4.3 Contratos de `import-linter` (archivo `.importlinter`)

Se declaran en la Fase B1.4 —**antes** de que exista un solo módulo migrado— y se endurecen en B2.8c:

| Contrato | Tipo | Qué prohíbe |
|---|---|---|
| `capas-core` | `layers` | `core.presentation` → `core.application` → `core.domain`; nada apunta hacia afuera |
| `capas-modulo-[n]` | `layers`, uno por módulo | `presentation` → `application` → `domain`, con `infrastructure` fuera de la pila salvo hacia adentro |
| `independencia-modulos` | `independence` | Que `apps.personal` importe de `apps.cargos`, etc. Es el contrato que hace imposible el ciclo `RAC ↔ USER` |
| `dominio-puro` | `forbidden` | Que `apps.*.domain` o `core.domain` importen `django`, `rest_framework`, `celery` |
| `aplicacion-sin-orm` | `forbidden` | Que `apps.*.application` importe `django.db`, `celery` o `apps.*.infrastructure.models` |
| `presentacion-sin-orm` | `forbidden` | Que `apps.*.presentation` importe `infrastructure.models` |

### I.4.4 Ubicación de las reglas de negocio (traslado concreto)

| Hoy | Mañana |
|---|---|
| Validación de formato en el serializer | `domain/value_objects/` (cédula, código de cargo, RIF) e invariantes en `domain/entities/` |
| `if`/`else` de negocio dentro de `@api_view` | `application/use_cases/[accion]_[entidad].py` |
| `Model.objects…` en la view | `infrastructure/repositories/` detrás de un puerto `domain/ports/` |
| `Response({...})` armado a mano | `core/presentation/envelope.py` + `exception_handler` |
| `try/except Exception → 500` genérico | Excepciones de dominio mapeadas a códigos HTTP en un único lugar |
| Cálculo repetido en serializer y en columna de BD | Una sola fuente autoritativa (regla B18, decisión D-05) |
| `.delay()` dentro de la transacción | Evento de dominio → receiver → `transaction.on_commit()` → puerto `TaskQueue` (B22) |

### I.4.5 Plantillas de archivo por capa

Son el contrato de forma que las revisiones verifican. Los nombres siguen la tabla de convención de la
skill `arquitectura-onion-feature-scream`, adaptados a la nomenclatura de capas de §I.4.1.

**Entidad — `apps/[modulo]/domain/entities/[nombre].py`**

```python
from dataclasses import dataclass
from datetime import date

from core.domain.exceptions import ValidationError
from ..value_objects.cedula import Cedula


@dataclass(frozen=True, slots=True)
class Empleado:
    """Entidad de dominio. Sin Django, sin ORM, sin DRF (regla B1)."""

    cedula: Cedula
    nombre: str
    apellido: str
    fecha_ingreso: date

    def __post_init__(self) -> None:
        if not self.nombre.strip():
            raise ValidationError("El nombre del empleado no puede estar vacío.")

    def antiguedad_en_dias(self, hasta: date) -> int:
        """Regla de negocio, no consulta: se prueba sin base de datos."""
        return (hasta - self.fecha_ingreso).days
```

**Value object — `apps/[modulo]/domain/value_objects/cedula.py`**

```python
import re
from dataclasses import dataclass

from core.domain.exceptions import ValidationError

_PATRON = re.compile(r"^[VE]-?\d{6,9}$")


@dataclass(frozen=True, slots=True)
class Cedula:
    valor: str

    def __post_init__(self) -> None:
        if not _PATRON.match(self.valor.upper()):
            raise ValidationError("Cédula inválida.")

    def canonica(self) -> str:
        """Forma única para comparar y consultar (patrón rif_canonico de la skill)."""
        return self.valor.upper().replace("-", "")
```

**Puerto de repositorio — `apps/[modulo]/domain/ports/repo_empleado.py`**

```python
from typing import Protocol

from ..entities.empleado import Empleado
from ..value_objects.cedula import Cedula


class RepoEmpleado(Protocol):
    def obtener(self, cedula: Cedula) -> Empleado | None: ...
    def listar(self, *, estatus: str | None = None, pagina: int = 1) -> list[Empleado]: ...
    def guardar(self, empleado: Empleado) -> Empleado: ...
```

**DTO — `apps/[modulo]/application/dtos/empleado_dto.py`**

```python
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class EmpleadoItemDTO:
    """Lo que sale hacia presentación. Nunca se expone la entidad (equivalente de R5)."""

    cedula: str
    nombre_completo: str
    antiguedad_dias: int
```

**Caso de uso — `apps/[modulo]/application/use_cases/registrar_empleado.py`**

```python
from datetime import date

from core.domain.exceptions import ConflictError

from ..dtos.empleado_dto import EmpleadoItemDTO
from ...domain.entities.empleado import Empleado
from ...domain.ports.repo_empleado import RepoEmpleado
from ...domain.value_objects.cedula import Cedula


def registrar_empleado(repo: RepoEmpleado, datos: dict) -> EmpleadoItemDTO:
    """El repositorio entra por parámetro (regla B4). No importa models ni Celery."""
    cedula = Cedula(datos["cedula"])
    if repo.obtener(cedula) is not None:
        raise ConflictError("Ya existe un empleado con esa cédula.")

    empleado = repo.guardar(
        Empleado(
            cedula=cedula,
            nombre=datos["nombre"],
            apellido=datos["apellido"],
            fecha_ingreso=datos["fecha_ingreso"],
        )
    )
    return EmpleadoItemDTO(
        cedula=empleado.cedula.canonica(),
        nombre_completo=f"{empleado.nombre} {empleado.apellido}",
        antiguedad_dias=empleado.antiguedad_en_dias(date.today()),
    )
```

**Modelo ORM — `apps/[modulo]/infrastructure/models/empleado.py`** y el re-export obligatorio:

```python
# apps/personal/activo/infrastructure/models/empleado.py
from django.db import models


class Employee(models.Model):
    """El nombre de tabla NO cambia: la reconstrucción no toca el esquema (riesgo #1)."""

    cedulaidentidad = models.CharField(max_length=15, primary_key=True)
    foto = models.ForeignKey(
        "core.Archivo", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        db_table = "Employee"
        managed = True
```

```python
# apps/personal/activo/models.py  ← patrón adoptado de la skill (§0.4.3 B-e)
"""Django descubre modelos en <app>.models. Este archivo mantiene domain/ e
infrastructure/ libres de esa convención sin romperla."""
from .infrastructure.models.empleado import Employee  # noqa: F401
```

**Mapper — `apps/[modulo]/infrastructure/mappers/mapper_empleado.py`**

```python
from ...domain.entities.empleado import Empleado
from ...domain.value_objects.cedula import Cedula
from ..models.empleado import Employee


def a_entidad(fila: Employee) -> Empleado:
    return Empleado(
        cedula=Cedula(fila.cedulaidentidad),
        nombre=fila.nombre,
        apellido=fila.apellido,
        fecha_ingreso=fila.fecha_ingreso,
    )


def a_fila(entidad: Empleado, fila: Employee | None = None) -> Employee:
    fila = fila or Employee(cedulaidentidad=entidad.cedula.canonica())
    fila.nombre = entidad.nombre
    fila.apellido = entidad.apellido
    fila.fecha_ingreso = entidad.fecha_ingreso
    return fila
```

**Repositorio — `apps/[modulo]/infrastructure/repositories/repo_empleado_orm.py`**

```python
from ...domain.entities.empleado import Empleado
from ...domain.value_objects.cedula import Cedula
from ..mappers.mapper_empleado import a_entidad, a_fila
from ..models.empleado import Employee


class RepoEmpleadoORM:
    """Implementa el puerto. Único lugar del módulo con select_related (B6/MED-06)."""

    def obtener(self, cedula: Cedula) -> Empleado | None:
        fila = (
            Employee.objects.select_related("foto")
            .filter(cedulaidentidad=cedula.canonica())
            .first()
        )
        return a_entidad(fila) if fila else None

    def guardar(self, empleado: Empleado) -> Empleado:
        fila = a_fila(empleado)
        fila.save()
        return a_entidad(fila)
```

**Serializer de frontera — `apps/[modulo]/infrastructure/serializers/empleado_serializers.py`**

```python
from rest_framework import serializers

from core.infrastructure.serializer_mixins import CleanZerosMixin  # ← R-02


class EmpleadoCrearSerializer(serializers.Serializer):
    """Solo valida y normaliza la entrada. Las reglas de negocio están en el caso de uso.
    Lectura y escritura se separan (patrón de la skill patrones-drf-implementacion)."""

    cedula = serializers.CharField(max_length=15)
    nombre = serializers.CharField(max_length=60)
    apellido = serializers.CharField(max_length=60)
    fecha_ingreso = serializers.DateField()


class EmpleadoItemSerializer(CleanZerosMixin, serializers.Serializer):
    cedula = serializers.CharField()
    nombre_completo = serializers.CharField()
    antiguedad_dias = serializers.IntegerField()
```

**Vista — `apps/[modulo]/presentation/views/empleado_views.py`**

```python
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.request import Request
from rest_framework.response import Response

from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from core.presentation.schema import MensajeRespuestaSerializer

from ...application.use_cases.registrar_empleado import registrar_empleado
from ...infrastructure.repositories.repo_empleado_orm import RepoEmpleadoORM
from ...infrastructure.serializers.empleado_serializers import (
    EmpleadoCrearSerializer,
    EmpleadoItemSerializer,
)


@extend_schema(
    request=EmpleadoCrearSerializer,
    responses={201: EmpleadoItemSerializer, 403: MensajeRespuestaSerializer,
               409: MensajeRespuestaSerializer},
)
@api_view(["POST"])
@permission_classes([HasPermission("personal.crear")])
def crear_empleado(request: Request) -> Response:
    """Vista delgada: valida, invoca, envuelve. Sin ORM (B7), sin try/except genérico (B9)."""
    entrada = EmpleadoCrearSerializer(data=request.data)
    entrada.is_valid(raise_exception=True)

    dto = registrar_empleado(RepoEmpleadoORM(), entrada.validated_data)
    return ok(EmpleadoItemSerializer(dto).data, "Empleado registrado.", status=201)
```

**Sobre de respuesta — `core/presentation/envelope.py`**

```python
from typing import Any

from rest_framework.response import Response


def ok(data: Any = None, message: str = "", status: int = 200) -> Response:
    return Response({"status": "success", "message": message, "data": data}, status=status)


def fail(message: str, status: int = 400, data: Any = None) -> Response:
    """Nunca recibe str(excepción): el exception_handler ya lo registró con trace_id (S6)."""
    return Response({"status": "error", "message": message, "data": data}, status=status)
```

**Tarea de Celery — `core/infrastructure/tasks/` (contrato adoptado de la skill, §0.4.3 B-g)**

```python
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue="cargas",
    acks_late=True,                    # el mensaje vuelve a la cola si el worker muere
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    time_limit=1800,
)
def cargar_personal_masivo(self, archivo_id: str, actor_id: int, trace_id: str) -> dict:
    """Recibe IDs, nunca instancias ni el Excel completo (B23 + regla práctica de RabbitMQ).
    Escribe SIEMPRE por el mismo caso de uso que usa la vista sincrónica (B5.18)."""
    ...
```

### I.4.6 Fuentes de datos legadas y bases ajenas

GATH no tiene hoy una base externa de solo lectura, pero **sí tiene el problema equivalente**: las
fuentes de la migración de datos (`SAGP_CONATEL.sql`, `SIGEP_MINISTERIO.sql`, los Excel de RRHH y la
carpeta `migrar/`). Cuando haga falta leer una de esas fuentes desde la aplicación —y no por un script de
una sola vez—, el patrón obligatorio es el de la skill `integracion-bd-recaudacion`:

1. Alias de conexión propio, declarado **solo si la variable de entorno existe**; si no existe, el alias
   no está en `DATABASES` y esa ausencia es la señal de "no disponible" (no un `try/except` de arranque).
2. `CONN_MAX_AGE = 0` y `OPTIONS['connect_timeout'] = 5`: una base ajena no merece conexiones persistentes.
3. Modelos espejo **mínimos** (solo las columnas que se usan) con `managed = False`, todos en un mismo
   módulo, y un router que enruta **por módulo de origen** y devuelve `allow_migrate = False` para ese alias.
4. Rol SQL de solo lectura con `CONNECT` + `USAGE` + `SELECT` sobre las tablas concretas: la restricción
   la impone la base, no el código.
5. Degradación explícita: excepción propia → **503**, y el resto del sistema sigue funcionando.

Lo que **sí se toma ya** de ese patrón para D-03 (PostgreSQL externo): `connect_timeout`, `sslmode=require`
y la prohibición de valores por defecto en el código.

### I.4.7 Mover un modelo de app a app sin perder la tabla — procedimiento obligatorio

Es el riesgo técnico más alto de toda la Fase B4 y no puede improvisarse. Mover `Employee` de `RAC` a
`apps/personal` **no cambia ninguna tabla** —el `db_table` se declara explícito—, pero **sí cambia el
`app_label`** con el que Django registra el modelo. Con un `makemigrations` ingenuo, Django no ve un
movimiento: ve un modelo que desaparece de una app y otro que nace en otra, y genera `DeleteModel` +
`CreateModel` **reales**. Aplicado contra producción, eso **borra la tabla con todos los datos**.

El procedimiento, por módulo:

1. Con la línea base de **B0.0** ya en git, generar la migración del módulo **destino** con
   `SeparateDatabaseAndState`, que cambia el estado de Django sin tocar la base:

   ```python
   # apps/personal/migrations/0002_mover_employee_desde_rac.py
   operations = [
       migrations.SeparateDatabaseAndState(
           database_operations=[],          # ← la base de datos NO se toca
           state_operations=[
               migrations.CreateModel(
                   name="Employee",
                   fields=[...],            # idénticos a los de RAC
                   options={"db_table": "Employee", "managed": True},
               ),
           ],
       ),
   ]
   ```

2. En el módulo **origen**, la operación espejo con `state_operations=[migrations.DeleteModel("Employee")]`
   y `database_operations=[]`, dependiente de la anterior.
3. `python manage.py migrate --plan` y **leer la salida a mano**: no debe aparecer ninguna operación real
   de base de datos.
4. `python manage.py sqlmigrate <app> <n>` → debe devolver **SQL vacío o solo comentarios**. Si devuelve
   `CREATE TABLE` o `DROP TABLE`, la migración está mal escrita: no se aplica.
5. Aplicar primero sobre una **copia** de la base de producción, comparar `\d+` de la tabla antes y después,
   y solo entonces sobre producción.

**El caso más delicado es `cuenta`, que es `AUTH_USER_MODEL`.** Cambiar la app dueña del modelo de usuario
exige además actualizar `AUTH_USER_MODEL` en settings y las `swappable_dependency` de **todas** las
migraciones que lo referencian. Se ensaya completo sobre una copia y se ejecuta en su propia ventana, con
respaldo previo tomado por el equipo dueño del servidor (**A-08**).

**Alternativa que también es válida y a veces preferible:** no mover el modelo, sino **dejar la tabla donde
está y mover solo el código de dominio**, declarando el modelo ORM en el módulo nuevo con el mismo
`db_table` y retirando el viejo cuando no queden referencias. Es menos elegante en el árbol de
`INSTALLED_APPS`, pero no toca el estado de migraciones. Se decide por módulo; para `cuenta` es la opción
recomendada.

---
## I.5 Mapa de migración — backend

| Origen | Módulo objetivo `apps/` | Dominios que absorbe | Endpoints aprox. | Orden |
|---|---|---|---|---|
| `USER/` | `identidad/` | cuentas, roles, departamentos, permisos, tokens | ~15 + 3 de roles | **1 (piloto)** |
| `RAC/models/ubicacion_models.py` + views de dependencias | `organizacion/` | dependencias, dirección general, dirección de línea, coordinaciones, organismos adscritos, ubicación geográfica | ~18 | 2 |
| `RAC/` (sexo, estado civil, tallas, sangre, patologías, niveles académicos, carreras, instituciones) | `catalogos/` | ~35 endpoints de solo lectura | ~35 | 3 |
| `RAC/views/personal_activo_views.py` | `personal/activo/` | datos personales, perfil salud/físico, vivienda, formación, antecedentes | ~30 | 4 |
| `RAC/views/personal_pasivo_views.py` | `personal/pasivo/` | jubilados, herederos, egresos | ~12 | 5 |
| `RAC/` (códigos y asignaciones) | `cargos/` | denominaciones, códigos, vacantes, asignación, préstamo de cargo | ~15 | 6 |
| `RAC/views/family_views.py` | `familiares/` | familiares y documentos adjuntos | ~10 | 7 |
| `RAC/views/historial_views.py` + `services/egreso_services.py` | `movimientos/` | historial de cargo, cambios de estatus, motivos | ~8 | 8 |
| `RAC/views/report_*_views.py` + `services/pdf/` | `reportes/` | PDF activo/pasivo/familiar/movimientos, Excel | ~10 | 9 |
| `CARNETIZACION/` | `carnetizacion/` | plantillas, emisión, validación | ~8 | 10 |
| `AUTOGESTION/` | `autogestion/` | censo de vivienda, encuestas, reporte por dependencia | ~7 | 11 |

**Submódulos:** `personal/` es el único módulo con submódulos (`activo/`, `pasivo/`, `shared/`), siguiendo
el patrón 2 de la skill de arquitectura. `personal/shared/domain/` alberga lo común a los dos —la entidad
`Empleado`, los VO de cédula y estatus, y el servicio de tiempo de servicio de D-05—; `activo/` y
`pasivo/` tienen sus propios casos de uso y repositorios.

**Correspondencia con el frontend:** los mismos nombres, en el mismo orden, en §II.5. Cada sub-fase de B4
tiene su gemela en F4, y el reapuntado del frontend a `/api/v1/` es lo que cierra la sub-fase.

---

## I.6 Plan por fases — backend

> Las duraciones son órdenes de magnitud para 1–2 personas dedicadas al backend. Cada fase tiene un
> **criterio de salida verificable**; ninguna fase se cierra por calendario.

### FASE B0 — Contención de seguridad · 5–7 días · **bloqueante para todo**

Se ejecuta sobre el sistema en operación. **No se toca la estructura de carpetas.**

| # | Acción | Cierra |
|---|---|---|
| **B0.0** | **Línea base de migraciones — primera tarea del plan, bloqueante.** Quitar los tres patrones `**/migrations/` del `.gitignore`; crear los paquetes `migrations/` en las cuatro apps; `makemigrations` y **validar contra una copia** de la base de producción con `migrate --fake-initial`, `migrate --plan` y `sqlmigrate` (el SQL debe ser vacío o solo comentarios); comparar el esquema generado con el real —`\d+` de cada tabla— **antes** de commitear. Solo entonces `--fake-initial` sobre producción. Sin esto no hay Fase 1, ni tabla `archivo`, ni Fase 9 (§I.3.0, **D-16**) | **MED-01** — y desbloquea B2.7b, B2.7d, B4, B9, T7.1 |
| B0.1 | Mover `SECRET_KEY` a variable de entorno, **rotarla** y separar `SIMPLE_JWT['SIGNING_KEY']` a una clave propia e independiente | CRIT-01 |
| B0.2 | `DEBUG = config('DJANGO_DEBUG', cast=bool, default=False)`; forzar `AUTH_COOKIE_SECURE = True` en producción, con **variable propia** y no derivada de `DEBUG` | CRIT-02 |
| B0.4 | Rediseñar el cambio de contraseña: `IsAuthenticated` + contraseña actual obligatoria + `validate_password()`, operando **siempre** sobre `request.user` (nunca sobre un `id` del cuerpo) | CRIT-04 |
| B0.5 | `register_view` ⇒ `IsAuthenticated` + permiso administrativo; quitar `rol` y `departamento` de los campos asignables por el solicitante | CRIT-05 |
| B0.6 | `descargar_documento_familiar` ⇒ `IsAuthenticated` + verificación de permiso sobre el empleado dueño del documento; sustituir el `id` secuencial por UUID | CRIT-06 |
| B0.7 | Retirar `static(MEDIA_URL, …)` de `urls.py`; servir archivos solo por vista autenticada (`FileResponse`) | CRIT-07 |
| B0.8 | Aplicar `permission_classes` explícitas y por rol en los ~20 endpoints de escritura de mayor impacto (empleados, cargos, egresos, usuarios) como parche puente hasta B3 | CRIT-08 (parcial) |
| B0.10 | Activar `DEFAULT_THROTTLE_CLASSES` con `ScopedRateThrottle` y scopes estrictos en `login` y `cambiar-password`, **y declarar el backend de caché que sostiene los contadores** (D-11): `DatabaseCache` en PostgreSQL con `python manage.py createcachetable`, `IGNORE_EXCEPTIONS` en `False` para este uso —un contador de seguridad que falla debe notarse— y **un comentario por scope justificando el número**, como exige la skill | ALTA-04, **ALTA-17** |
| B0.11 | Cerrar `/api/docs/`, `/api/schema/`, `/api/redoc/` detrás de autenticación (patrón `EXPOSE_API_DOCS` de la skill `uso-librerias-backend`); restringir `/admin/` por red | ALTA-14 |
| B0.12 | **Retirar los volcados de base de datos del repositorio y purgar el historial completo** (`SAGP_CONATEL.sql`, `SIGEP_MINISTERIO.sql`, y `ENVIADA.sql` que está en el árbol sin versionar). **Verificado el 20-08-2026: los dos primeros siguen en `git ls-files`** —borrarlos del árbol de trabajo no los saca del índice ni del historial—, así que la tarea está **abierta**. Añadir `*.sql` al `.gitignore`. Inventariar quién tuvo acceso al repositorio. Los respaldos van a almacenamiento cifrado con control de acceso, nunca a git | CRIT-10 |
| B0.13 | **Rotar la contraseña del usuario `postgres` y eliminar `wait-for-postgres.py` del índice y del historial.** Host y credencial pasan a variables de entorno **sin default**; el script de espera se reescribe para leerlas del entorno y **fallar si faltan**. Restringir por red qué hosts pueden conectar al 5432 del servidor externo. Requiere coordinación con el dueño del servidor (A-04) | CRIT-11 |
| B0.14 | **Corregir la pérdida de datos de la carga masiva:** quitar `'profile'` del `employee_data` de `personal_activo_views.py:392`. Es una línea, y evita que cada carga siga borrando referencias de foto. Contar cuántos `Employee.profile` quedaron en `NULL` para dimensionar lo ya perdido | ALTA-16 |
| **B0.15** | **`crear_rol`, `actualizar_rol` y `eliminar_rol` ⇒ permiso administrativo explícito.** Parche puente equivalente a B0.8, en el mismo estilo, sobre `USER/views/rol_views.py`. Añadir además dos protecciones de integridad: **no permitir borrar un rol que tenga cuentas asociadas** (hoy nada lo impide) y registrar la operación en log con actor y rol afectado | **CRIT-12** |
| B0.16 | Barrido de verificación: `grep -rn "AllowAny" BACKEND/` y dejar en cada aparición restante un comentario con la razón y el dato expuesto. Toda aparición sin comentario es un fallo de CI a partir de B1 (regla S1) | CRIT-08, S1 |
| **B0.17** | **`.gitignore` en la raíz del repositorio** —hoy no existe— con `*.xlsx`, `*.sql`, `*.bak_*`, `.env`, `.env.*` (excepto `.env.example`), `migrar/`, `media/`, `staticfiles/`. Y en `NextJS/.gitignore`, añadir `.env.*` para que `.env.docker` y los `.env.bak_*` no puedan volver. Es la tarea que convierte la disciplina de "commitear solo código" en una garantía del repositorio en lugar de una costumbre | **ALTA-18**, y previene la recaída de CRIT-03 y CRIT-10 |

**Criterio de salida de B0:**
- **Existe una línea base de migraciones versionada** y `python manage.py migrate --plan` sobre la base de
  producción no propone **ninguna** operación (B0.0).
- `git status --porcelain` no muestra ningún archivo sin ignorar que contenga datos de personal o secretos
  (B0.17).
- Ningún `AllowAny` sin justificación escrita en el código.
- `python manage.py check --deploy` sin hallazgos de severidad alta.
- Prueba manual documentada: los 10 hallazgos `CRIT-*` de backend no son reproducibles.
- Todos los secretos rotados y el historial de git purgado (secretos **y** volcados de base de datos),
  verificado con `git log --all --full-history -- '*.sql' 'BACKEND/wait-for-postgres.py'` sin resultados.
- El contador de throttling sobrevive a un reinicio y es compartido entre workers (prueba: 4 workers,
  límite de 5/min, el sexto intento recibe 429 sin importar a qué worker llegue).

### FASE B1 — Cimientos, herramientas y contratos · 1–2 semanas

| # | Entregable |
|---|---|
| B1.2 | **Verificación de la línea base** creada en B0.0: que las cuatro apps tengan su `migrations/` en git, que `makemigrations --check --dry-run` salga limpio (no hay deriva entre modelos y migraciones) y que ese chequeo entre en el CI como puerta. Cierra MED-01 (definitivo) |
| B1.3 | **Settings único parametrizado.** Un solo `config/settings.py` (sin dividir en base/development/production): la diferencia entre entornos son los **valores** de las variables, no el código. Añadir `SECURE_HSTS_SECONDS`, `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `CSRF_TRUSTED_ORIGINS`, `X_FRAME_OPTIONS`; `ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS` desde entorno (sin IPs en código, sin `testserver`). CORS con el patrón de la skill: lista por variable, y el permitir-todo **solo** si `DEBUG` y la lista está vacía. Corregir `USE_TZ` duplicado, `POPPLER_PATH` (ruta de Windows en contenedor Linux), `CARNET_VALIDATOR_URL` (`https://midominio.com`) y **`CORS_ALLOWED_HEADERS` → `CORS_ALLOW_HEADERS`**, que hoy no tiene ningún efecto. Retirar `testserver` y `allowedDevOrigins` con IPs del código. Cierra ALTA-13, MED-14, **MED-19** |
| B1.4 | **Tooling:** `ruff` + `black` + `mypy` + `pytest` + `pytest-django` + **`import-linter`** con los seis contratos de §I.4.3 declarados desde ya |
| B1.8 | **Poda y configuración de dependencias.** Retirar `django-simple-history` (D-04). Configurar `celery` de verdad (D-02): fijar la serie 5.5.x validada contra Django 5.2, añadir `django-celery-results` (resultados en PostgreSQL) y `boto3` (gateway S3 de SeaweedFS, D-01). Cierra MED-11 (backend) |
| B1.11 | **Conexión a la base de datos externa** (D-03): `DJANGO_DB_*` sin valores por defecto, `sslmode=require`, `connect_timeout`, y comprobación de conectividad al arranque que **falla ruidosamente** si la variable no está. Servicio `postgres` **efímero solo en el compose de desarrollo/CI**, sin datos reales |
| B1.12 | **Contrato de logging** (D-04): un evento por línea en JSON con `trace_id`, `actor`, `accion`, `recurso`, `resultado`; destino doble — `stdout` (lo recoge Docker) y archivo rotado en `logs/`. Se declara aquí, se implementa en B2.8 y T7.5 |
| **B1.13** | **`PASSWORD_HASHERS` con Argon2 primero** y el resto como cadena de lectura para los hashes ya almacenados (patrón de la skill `uso-librerias-backend`). **Requiere añadir `argon2-cffi` a `requirements.txt`**: hoy no está, y sin él la lista falla al arrancar. Cierra **MED-20**. Se hace ahora porque B0.4 ya reescribió el cambio de contraseña: es el momento en que el rehasheo ocurre solo, al iniciar sesión |
| **B1.14** | **`SPECTACULAR_SETTINGS` con `ENUM_NAME_OVERRIDES`** para los `TextChoices` reutilizados (estatus de empleado, tipo de personal, estado de archivo). Sin esto el esquema OpenAPI —que a partir de B0.11 es el contrato revisable con el frontend— genera nombres colisionantes (regla B25) |
| **B1.15** | **`MensajeRespuestaSerializer` en `core/presentation/schema.py`** y su uso obligatorio en `@extend_schema(responses={4xx: …})`. Un solo serializer de error para toda la API, en lugar de uno por vista |

**Criterio de salida:** CI verde en `dev`; `import-linter` corre en cada commit (aún sin módulos migrados,
los contratos ya están declarados y pasan); `manage.py check --deploy` limpio; la app arranca contra la
base externa sin ningún valor por defecto en el código.

### FASE B2 — Núcleo compartido `core/` · 2 semanas · sin cambios funcionales visibles

| # | Entregable |
|---|---|
| B2.1 | `core/domain/`: `Entity` base (dataclass congelada), `ValueObject`, jerarquía de excepciones (`DomainError`, `NotFound`, `ValidationError`, `PermissionDenied`, `ConflictError`) |
| B2.2 | `core/domain/ports.py`: protocolos `Repository`, `UnitOfWork`, `FileStorage`, `ReportGenerator` |
| B2.3 | `core/presentation/envelope.py`: `ok()` / `fail()` — **único** lugar donde se arma la respuesta. Cierra MED-17 |
| B2.4 | `core/presentation/exception_handler.py`: `EXCEPTION_HANDLER` de DRF que traduce excepciones de dominio a HTTP y **nunca filtra `str(e)`** al cliente (se registra en log con `trace_id`). Cierra ALTA-11 |
| B2.5 | `core/presentation/permissions.py`: catálogo de permisos por código + `HasPermission("codigo")`, `IsOwnerOrHasPermission` (autogestión). Componibles con `\|` y `,` como en la skill |
| B2.6 | `core/presentation/pagination.py` + `throttles.py`: paginación uniforme y scopes de tasa por tipo de endpoint, cada uno con su justificación en comentario |
| B2.7 | `core/infrastructure/base_repository.py` (implementación ORM genérica) y el **puerto `FileStorage`** con dos adaptadores: `filesystem_storage.py` (lee el legado) y `seaweedfs_storage.py` (destino). Validación de MIME **por firma real** (no por extensión), límite de tamaño, extensión en lista blanca y nombres opacos. Cierra ALTA-10 (backend) |
| B2.7b | **Modelo de metadatos de archivo** (`core/infrastructure/models/archivo.py`): `id` (UUID), `clave` en SeaweedFS, `nombre_original`, `mime`, `bytes`, `sha256`, `propietario_tipo` + `propietario_id`, `categoria` (`foto_perfil`, `documento_familiar`, `plantilla_carnet`, `carnet_emitido`, `reporte`), `subido_por`, `subido_en`, `estado` (`vigente`, `reemplazado`, `migrado`). Es la pieza que **hoy no existe** y sin la cual no hay auditoría ni borrado consistente. Vive en `core/` porque la consumen 4 módulos (B16). **Requiere ventana coordinada con el dueño de la base (A-08)** |
| B2.7c | **Puerto `TaskQueue`** en `core/domain/ports.py` + adaptador Celery/RabbitMQ en `core/infrastructure/tasks/`. Los casos de uso encolan por el puerto; **ninguno importa Celery** (B4, B20) |
| B2.7d | **`Employee.foto` → FK a `archivo`** (null permitido), en migración propia. Sustituye el `profile` de texto libre. Los PDF cambian la bandera `employee.profile` por `employee.foto_id`. Si el negocio confirma que además quiere un campo de *perfil profesional*, se crea con su propio nombre y su propia columna |
| B2.8 | `core/presentation/audit.py` — **D-04, trazabilidad en dos niveles.** (a) Tabla `auditoria` en PostgreSQL, **append-only**: `actor`, `accion`, `recurso`, `antes`/`después` (solo campos afectados), `trace_id`, IP, fecha. (b) Archivo JSON por línea con rotación. Toda escritura sobre datos de personal pasa por aquí. **No se activa `django-simple-history`** |
| B2.8b | **Reubicación del código compartido de facto (§I.2.2).** Mover a `core/` R-02, R-03, R-07 y R-10, y **romper el ciclo `RAC ↔ USER`** sustituyendo los imports directos por `settings.AUTH_USER_MODEL` y referencias de modelo por string. R-01, R-05, R-06, R-08, R-09 y R-11 se reubican al migrar su módulo (B3 y B4) |
| B2.8c | **Contrato de independencia entre módulos activo en `import-linter`.** A partir de aquí, un módulo que importe de otro rompe el CI. Es lo que impide que `core/` se degrade y que reaparezca una god-app |
| **B2.15** | **`models.py` de re-export por app** (patrón de la skill, §0.4.3 B-e): cada `apps/[modulo]/models.py` re-exporta lo que vive en `infrastructure/models/`, para que Django descubra los modelos sin que la capa interna dependa de esa convención. Se crea junto con el primer módulo (B3) y se replica en cada uno |
| **B2.16** | **Eventos de dominio + receivers** (`core/domain/events.py`, `core/infrastructure/receivers.py`) y la regla que los acompaña: el receiver despacha por el puerto `TaskQueue` **dentro de `transaction.on_commit()`**, nunca antes. Los receivers se conectan en `AppConfig.ready()` del módulo dueño. Regla **B22** |
| **B2.17** | **`core/presentation/cookies.py`**: `set_refresh_cookie` / `clear_refresh_cookie` / `get_refresh_from_request` (patrón `api/cookies.py` de la skill). Es la mitad de presentación de R-11; la mitad de emisión de tokens va a `identidad` en B3.6 |

**Criterio de salida:** todo endpoint existente responde a través de `envelope.py`; ninguna respuesta de
error contiene `str(e)`; `import-linter` pasa con el contrato de independencia activo; la tabla `archivo`
existe y `Employee.foto` está creada (aunque todavía vacía).

### FASE B3 — Identidad y autorización (módulo piloto) · 2 semanas

Se elige `identidad` como piloto porque es el módulo más pequeño, el más crítico en seguridad y el que
desbloquea la autorización de todos los demás.

| # | Entregable |
|---|---|
| B3.1 | `apps/identidad/` completo con las cuatro capas, incluido su `models.py` de re-export y su `apps.py` |
| B3.2 | **Abstracción de autorización con respaldo de roles.** `HasPermission("codigo")` como *única* forma de autorizar en las views; su resolutor consulta —en esta fase— un mapa `rol → códigos` declarado en el dominio. Ninguna view compara nombres de rol. Cierra el agujero ahora y deja el intercambio de B9 confinado al resolutor |
| B3.3 | **Aplicar `HasPermission` a los 148 puntos de entrada** (138 `@api_view` + 10 `APIView`).** Inventario endpoint → código requerido como artefacto revisable (`PERMISOS.md`). Cierra CRIT-08 (definitivo) y CRIT-12 (definitivo) |
| B3.4 | `IsOwnerOrHasPermission` en los endpoints de autogestión: un empleado solo accede a su propia cédula. Cierra ALTA-07 |
| B3.5 | Permiso administrativo en `editar_usuario`, `cambiar_estado_usuario`, `usuarios_lista`; sustituir `qs[:10]` por paginación. Cierra ALTA-06, MED-05 |
| B3.6 | **Corregir `TokenService.refresh_access_token`:** pasar la instancia de usuario, preservar los claims `cedula`/`rol`/permisos y **revalidar `is_active` en cada refresco**. La emisión queda en `apps/identidad/application/use_cases/`, la fijación de cookies en `core/presentation/cookies.py` (R-11). Cierra ALTA-08 |
| B3.12 | Rate limiting definitivo por scope y **bloqueo temporal tras N intentos fallidos**, sobre el backend de caché de B0.10. Cierra ALTA-04 (definitivo) |
| B3.13 | Reubicar R-01 (`CuentaFilter` → `apps/identidad/presentation/filters/`) y retirar el import de RAC que lo sostenía |
| B3.14 | **Tests de la fase**, con las prácticas adoptadas de la skill de testing: clase base que **aísla la caché de throttling** de la de la aplicación (`LocMemCache` con `override_settings`), factories que crean cuentas **pasando por el caso de uso real** de registro, y un test de éxito y uno de 403 por cada permiso |

**Criterio de salida de B3:**
- Una cuenta con rol `AUTOGESTION` recibe **403 desde la API** (no solo una redirección de la UI) en todo
  endpoint de gestión de personal — verificado con prueba de integración automatizada.
- `import-linter` pasa sobre `identidad` sin excepciones.
- Existe `PERMISOS.md` con la matriz endpoint × código de permiso × rol.
- **Ninguna comparación de `nombre_rol` fuera del resolutor de permisos**, verificado con grep en CI. Es
  la condición que hace que B9 sea un cambio contenido y no una reescritura de 148 puntos de entrada.
- Los tests de throttling no tocan la caché de la aplicación (comprobado a propósito: correr la suite dos
  veces seguidas no agota ningún cupo).

### FASE B4 — Migración de módulos de dominio (estrangulamiento) · 8–12 semanas

**Regla de oro:** el módulo antiguo permanece operativo hasta que el nuevo pasa sus criterios de salida.
`/api/v1/` convive con las rutas legadas; el frontend se reapunta módulo a módulo (C-6, D-06).

| Sub-fase | Módulo | Justificación del orden | Gemela en frontend |
|---|---|---|---|
| B4.1 | `organizacion` | Sin dependencias de entrada; lo consumen casi todos los formularios (los 4 selects en cascada) | F4.1 |
| B4.2 | `catalogos` | ~35 endpoints de solo lectura; migración mecánica y de bajo riesgo; **es donde se prueba el router de D-10** y donde mueren las constantes de R-04 | F4.2 |
| B4.3 | `personal/activo` | Núcleo del sistema; **aquí se rompe `personal_activo_views.py` (3.174 líneas)** y se ejecuta la verificación de D-05 (total APN) | F4.3 |
| B4.4 | `personal/pasivo` | Reutiliza `personal/shared/domain`; elimina la duplicación activo/pasivo | F4.4 |
| B4.5 | `cargos` | Depende de `organizacion` y `personal`; incluye préstamo de cargo y códigos especiales | F4.5 |
| B4.6 | `familiares` | Documentos con almacenamiento seguro; unifica activo y pasivo | F4.6 |
| B4.7 | `movimientos` | Historial, egresos, cambios de estatus | F4.7 |
| B4.8 | `carnetizacion` | Rediseñar `api_validar_carnet`: exigir el hash firmado como entrada y devolver **solo validez + datos mínimos**, no el expediente; prohibido `StringRelatedField` en ese serializer (S18). Cierra ALTA-05 | F4.8 |
| B4.9 | `autogestion` | Censo de vivienda con propiedad del recurso ya resuelta en B3 | F4.9 |

El checklist detallado que se repite en cada sub-fase está en §I.8.

**Criterio de salida por módulo:** ver §I.8 (11 puntos verificables).

### FASE B5 — Archivos, documentos, reportes y trabajos asíncronos · 4–5 semanas

Aquí se ejecutan **D-01** (SeaweedFS, retiro de NestJS-Files) y **D-02** (Celery + RabbitMQ). El principio
que ordena la fase: **nada se apaga hasta que lo nuevo sabe leer lo viejo.**

#### B5.A — Almacenamiento: de NestJS + `MEDIA_ROOT` a SeaweedFS

| # | Entregable |
|---|---|
| B5.1 | **D-01 registrada como ADR.** NestJS-Files se retira: dos módulos y ~150 líneas no justifican un servicio, una red y un runtime aparte, y su modelo de acceso (cédula en la URL, sin autenticación) es incompatible con B0. Su **lógica sí se conserva**, reimplementada en el backend (B5.2) |
| B5.2 | **Reimplementación de la lógica del gestor** en `core/` — traducción literal, no rediseño: ① validación de MIME **por firma real** (`Pillow` + lista blanca) en lugar de confiar en el `mimetype` declarado por el cliente; ② normalización equivalente a `sharp().resize(1024,768,{fit:'contain'})` con `Pillow` (`ImageOps.contain` + lienzo 1024×768); ③ **un solo archivo vigente por propietario y categoría**, marcando el anterior como `reemplazado` en lugar del `unlink` ciego actual; ④ streaming con `Content-Type` correcto y `Content-Disposition: inline`. **Test de paridad** sobre un lote de imágenes reales |
| B5.3 | **Metadatos primero.** Antes de mover un byte se puebla `archivo` desde un **inventario del disco de producción**: `find /var/www/backup/uploadsNestFS -type f -printf '%p\t%s\t%TY-%Tm-%Td\n'` y equivalente en `/opt/gath/BACKEND/media`. De cada ruta se derivan cédula, categoría y nombre original, y se calcula `sha256`. Se contrasta con `Employee.cedulaidentidad` y `FamilyDocument.file` para clasificar **válidos**, **huérfanos** y **faltantes**. Entregable: un informe revisable, no un log |
| B5.3b | **Reconstrucción de la referencia de foto.** Con el inventario se puebla `Employee.foto` cruzando carpeta↔cédula, lo que **recupera lo que ALTA-16 fue borrando**. El informe distingue los tres casos que interesan al negocio: empleado con foto en disco, empleado sin foto, y foto huérfana |
| B5.4 | **Comando de migración idempotente**: `manage.py migrar_archivos_a_seaweedfs [--categoria] [--lote N] [--dry-run]`. Lee por el adaptador de sistema de archivos, escribe por el puerto, guarda `clave` + `sha256`, y **verifica releyendo desde SeaweedFS y comparando `sha256`**. Reejecutable. Corre por lotes como tarea de Celery |
| B5.5 | **Lectura dual con degradación (el puente).** `obtener_archivo` resuelve en este orden: SeaweedFS → sistema de archivos legado → 404. Mientras el puente está activo **toda escritura va solo a SeaweedFS**: el legado queda de solo lectura y no crece. Se retira cuando el informe de B5.3 llega a cero pendientes |
| B5.6 | **Compatibilidad de contrato para el frontend.** `POST` y `GET /api/v1/archivos/foto-perfil/{cedula}/` con respuesta **equivalente** a la de NestJS (imagen en streaming), de modo que las 7 llamadas del frontend se reapunten cambiando variable y ruta, sin tocar la lógica de los formularios. Al mismo tiempo se corrige la seguridad: lectura con sesión y permiso; escritura con propiedad o `personal.editar` |
| B5.6b | **Cierre del `profile` de texto libre.** El backend **deja de aceptar** `profile`: la referencia la crea el caso de uso de subida, que devuelve `archivo.id` y actualiza `Employee.foto`. Los PDF usan `foto_id` como bandera. Es lo que hace que ALTA-16 no pueda repetirse |
| B5.7 | **Sustitución de `_upload_to_nestjs` / `_fetch_photo_from_nestjs`** en `carnetizacion` por el caso de uso de `core/`: llamada en proceso, sin HTTP interno ni multipart armado a mano |
| B5.8 | **Identificadores opacos y URLs firmadas.** El acceso por cédula desaparece: los documentos se piden por `archivo.id` (UUID) a una vista autorizada, o por URL firmada de corta duración (≤ 5 min). SeaweedFS **no se expone a internet**. Cierra CRIT-06, CRIT-07 y la parte de archivos de ALTA-05 |
| B5.9 | **Retiro de NestJS-Files.** Se apaga el servicio y se elimina del `compose.yml`, junto con la red `file_manager` y las variables `NEXT_PUBLIC_NEST_API_URL*`. El volumen viejo se conserva **en solo lectura** 90 días como red de seguridad, y se archiva cifrado antes de borrarse (A-06) |
| B5.10 | Auditoría de acceso a documentos personales: quién descargó qué y cuándo, en la tabla `auditoria` y en el log |
| B5.11 | `apps/reportes/`: los generadores de `RAC/services/pdf/` pasan a `infrastructure/services/` detrás del puerto `ReportGenerator`; los filtros se validan con serializer; **R-06 (los dos `mapa_reporte`) se unifica** en un registro por módulo detrás de un contrato de `core/domain/ports.py`. El PDF resultante se guarda como `archivo` (categoría `reporte`), no en `MEDIA_ROOT` |
| B5.12 | URLs firmadas para descargas (el proxy del frontend se ajusta en F5.5) |

#### B5.B — Trabajos asíncronos: Celery con RabbitMQ

| # | Entregable |
|---|---|
| B5.13 | **D-02 registrada como ADR.** Broker **RabbitMQ** (`amqp://`) y **backend de resultados en PostgreSQL** (`django-celery-results`). RabbitMQ **no** se usa como backend de resultados: transporta mensajes, no los almacena para consulta por clave |
| B5.14 | `config/celery.py` con la app y `autodiscover_tasks`. Servicios nuevos en `compose.yml`: `rabbitmq` (healthcheck, credenciales por variable, volumen), `celery-worker` (misma imagen que Django, `--concurrency` acotada, usuario no root) y `celery-beat` **solo si aparece una tarea periódica real** |
| B5.15 | **Topología de colas explícita**, no una cola única: `default`, `reportes` (PDF/Excel pesados), `cargas` (importación de Excel), `archivos` (normalización de imagen y migración). Cada tarea declara `queue`, `acks_late=True`, `autoretry_for` con `retry_backoff`, `max_retries` y `time_limit`. Cola de descartados con alerta. Declarar las colas como **quorum** (`x-queue-type`) y verificar el soporte en la versión fijada |
| B5.16 | **Catálogo de tareas, derivado del código actual y no especulativo:** ① `cargar_personal_masivo` — los 4 `pd.read_excel()` de `personal_activo_views.py` (líneas 51, 219, 316, 575); ② `generar_reporte_pdf` — los 5 generadores de `RAC/services/pdf/generators/`; ③ `exportar_censo_excel` — `AUTOGESTION/services/excel_service.py`; ④ `emitir_carnet_pdf` — `CARNETIZACION/services/generator.py`; ⑤ `normalizar_imagen` — el equivalente de `sharp`; ⑥ `migrar_archivos_lote` |
| B5.17 | **Contrato de trabajo asíncrono en la API (C-4):** `202 Accepted` con `{status, message, data: {tarea_id}}`; `GET /api/v1/tareas/{id}/` devuelve `pendiente\|en_proceso\|completada\|fallida` y, al completar, el `archivo.id` del resultado. **El sobre se conserva** |
| B5.18 | **Idempotencia y trazabilidad:** cada tarea recibe el `trace_id` de la petición que la originó y una clave de idempotencia (`sha256` del Excel + usuario), de modo que un reintento no duplique expedientes. Regla: **ninguna tarea escribe datos de personal sin pasar por el mismo caso de uso que usa la vista sincrónica** — aplica también a los `manage.py` de carga que hoy escriben directo |
| B5.19 | **Umbral medido, no supuesto:** si la generación supera **3 s** en el percentil 95, va a cola; por debajo se resuelve en la petición |
| **B5.20** | **Contrato de las tareas** (adoptado de la skill, B23): reciben **IDs, nunca instancias ni archivos**; toleran `DoesNotExist` con `logger.warning` y `return` en lugar de fallar —la fila pudo borrarse entre el encolado y la ejecución—; y **nunca** se despachan fuera de `transaction.on_commit()` (B22) |

**Criterio de salida de B5:**
- Ninguna URL de archivo es adivinable ni accesible sin autorización; hay prueba automatizada del 403 al
  pedir el documento de otro empleado.
- El informe de B5.3 reporta **cero archivos pendientes y cero divergencias de `sha256`**; la lectura dual
  se retira con esa evidencia sobre la mesa.
- NestJS-Files está apagado y **no queda ninguna referencia a `NEXT_PUBLIC_NEST_API_URL*`** en el árbol
  (verificado con grep en CI).
- Una carga masiva de Excel responde `202` en menos de 1 s y su resultado se consulta por `tarea_id`.
- Matar el worker a mitad de una tarea y reiniciarlo **no duplica ni pierde** registros (prueba manual
  documentada de `acks_late` + idempotencia).

### FASE B6 — Calidad y rendimiento · 2 semanas (solapa con F6)

| # | Entregable |
|---|---|
| B6.1 | Suite completa: unitarios de dominio y casos de uso **sin base de datos**, integración por endpoint, y **una prueba de regresión por cada hallazgo `CRIT-*` y `ALTA-*`** de §I.3. Cierra MED-13 (backend) |
| B6.5 | Rendimiento: eliminar N+1 **medido, no supuesto** (`django-debug-toolbar` en desarrollo o `assertNumQueries` en los tests de integración), índices en los campos de filtro más usados (cédula, código, estatus), paginación obligatoria en todos los listados. Cierra MED-06 |
| B6.8 | Cobertura de los casos de uso ≥ 80 %, medida y publicada en CI |
| B6.9 | Revisión de esquema OpenAPI: todo endpoint con `@extend_schema`, respuestas de error declaradas con `MensajeRespuestaSerializer`, y `operation_id` explícito donde haya ambigüedad (B24) |

### FASE B7 — Despliegue y observabilidad (backend) · ver Parte III

Tareas T7.1–T7.8. Lo específico del backend: `gunicorn` con workers en lugar de `runserver`, entrypoint
que espera la base y corre migraciones de forma controlada, y los tres destinos de log de D-04.

### FASE B8 — Retiro del legado · 1–2 semanas

| # | Entregable |
|---|---|
| B8.1 | Eliminar rutas y views legadas sin consumidores; retirar `RAC/`, `USER/`, `CARNETIZACION/`, `AUTOGESTION/` una vez vacías, y eliminar el directorio `NestJS-Files/` (tras la ventana de solo lectura de B5.9) |
| B8.3 | Poda final de dependencias del `requirements.txt` |
| B8.4 | Actualizar `SAGP - Sistema Automatizado de Gestión de Personal.md`: el documento actual nombra `GATH/` donde existe `SIGEP/`, omite `CARNETIZACION` y `AUTOGESTION`, y documenta un `compose.yml` con PostgreSQL que no está declarado |
| B8.5 | ADRs de D-01…D-12 |
| B8.6 | `CLAUDE.md` / `AGENTS.md` en `BACKEND/` con las convenciones y el mapa de módulos, **y actualización de las 6 skills de `BACKEND/.claude/skills/`** para que sus ejemplos sean de GATH y no de FitVen — incluyendo las divergencias de §0.4.3, que a esa altura ya son la práctica real del proyecto |

### FASE B9 — Permisología por módulo · 2–3 semanas · última fase

Hoy el acceso se decide por **rol y módulo**: `cuenta.rol.nombre_rol` determina a qué módulo entra el
usuario. Es una autorización de grano grueso: pertenecer al rol de un módulo concede *todo* lo de ese
módulo, y conceder una excepción a una sola persona obliga a crear un rol nuevo — que es exactamente lo
que pasó con `RECEPCIONISTA` en agosto de 2026 (§I.1.4).

Esta fase va al final porque para entonces los módulos ya existen con fronteras nítidas (B4) y el catálogo
de permisos se puede derivar de la estructura real. Gracias a B3.2, **los 148 puntos de entrada no se modifican**.

#### B9.1 Modelo de datos

```
Modulo(codigo, nombre, orden)                     personal, cargos, familiares, movimientos,
                                                  reportes, carnetizacion, autogestion,
                                                  organizacion, identidad, catalogos
Permiso(codigo, nombre, modulo_fk, accion)        ~60–80 registros
Rol(id, nombre_rol, descripcion)                  se conserva — pasa a ser una plantilla
RolPermiso(rol_fk, permiso_fk)                    composición del rol
CuentaPermiso(cuenta_fk, permiso_fk, concedido)   excepción individual (concede o revoca)
```

**Permisos efectivos** = permisos del rol ∪ concedidos individualmente − revocados individualmente. La
resolución vive en un caso de uso del dominio, no en el ORM.

#### B9.2 Convención de códigos `[modulo].[accion]`

| Módulo | Permisos |
|---|---|
| `personal` | `personal.ver`, `personal.crear`, `personal.editar`, `personal.egresar`, `personal.ver_salud` |
| `cargos` | `cargos.ver`, `cargos.crear`, `cargos.editar`, `cargos.asignar`, `cargos.prestar` |
| `familiares` | `familiares.ver`, `familiares.crear`, `familiares.editar`, `familiares.descargar_documento` |
| `movimientos` | `movimientos.ver`, `movimientos.cambiar_estatus`, `movimientos.ver_historial` |
| `reportes` | `reportes.generar_activos`, `reportes.generar_pasivos`, `reportes.generar_familiares` |
| `carnetizacion` | `carnetizacion.ver`, `carnetizacion.emitir`, `carnetizacion.gestionar_plantillas` |
| `autogestion` | `autogestion.registrar_propio`, `autogestion.consultar_todos`, `autogestion.exportar` |
| `organizacion` | `organizacion.ver`, `organizacion.gestionar` |
| `catalogos` | `catalogos.ver`, `catalogos.gestionar` |
| `identidad` | `identidad.ver_usuarios`, `identidad.gestionar_usuarios`, `identidad.gestionar_roles`, `identidad.gestionar_permisos` |

Dos reglas de diseño del catálogo:

1. **Separar lectura de escritura, y aislar los datos sensibles.** `personal.ver` no debe implicar
   `personal.ver_salud` ni `familiares.descargar_documento`: son los datos de mayor sensibilidad del
   sistema y merecen un permiso propio (A-07).
2. **El código nombra el módulo.** Al leer un log de auditoría o una matriz de permisos, el módulo
   afectado se identifica sin consultar otra tabla.

> **Nota derivada de CRIT-12:** `identidad.gestionar_roles` se separa de `identidad.gestionar_usuarios`
> precisamente porque el CRUD de roles cambia la forma del sistema de permisos, no solo un dato. Quien
> administra cuentas no necesariamente debe poder redefinir roles.

#### B9.3 Migración sin pérdida de acceso (equivalencia, no rediseño)

| # | Acción |
|---|---|
| B9.3.1 | Sembrar `Modulo` y `Permiso` con una migración de datos, derivados de `PERMISOS.md` (B3.3) |
| B9.3.2 | **Traducir el mapa `rol → códigos` de B3 a filas de `RolPermiso`.** El punto de partida es la equivalencia exacta del comportamiento actual: nadie gana ni pierde accesos el día del cambio |
| B9.3.3 | **Modo dual con bandera.** El resolutor consulta el catálogo y, en paralelo, el mapa de roles; ante divergencia registra el caso y aplica el resultado del mapa antiguo. Se ejecuta en producción hasta que las divergencias sean cero durante un periodo acordado |
| B9.3.4 | Retirar el respaldo de roles y el mapa del dominio; `Rol` queda como plantilla de permisos |
| B9.3.5 | **`departamento` deja de participar en la autorización.** Pasa a ser metadato organizacional (hoy el frontend lo usa como criterio de acceso: `proxy.ts:15`) |

#### B9.4 Transporte y vigencia de los permisos

| # | Entregable |
|---|---|
| B9.4.1 | El JWT transporta los códigos de permiso más un claim `permisos_version` (entero por cuenta) |
| B9.4.2 | Al modificar los permisos de una cuenta o de su rol se incrementa `permisos_version`. El refresco compara el claim con la base y, si difiere, reconstruye el token. **Un permiso revocado deja de aplicar en minutos, no en 8 horas.** Es la respuesta concreta a la advertencia de la skill `autenticacion-permisos-jwt` sobre claims desactualizados (§0.4.3 B-l) |
| B9.4.3 | Si el conjunto de códigos hace crecer el token en exceso, transportar solo `permisos_version` y resolver en servidor con caché por cuenta. **Decidir con medición, no por anticipado** |

#### B9.6 Auditoría de permisos

Toda concesión o revocación se audita con quién, a quién, qué código, antes/después y cuándo (S15). El
historial de permisos de una cuenta debe poder reconstruirse: es el registro que responde "quién autorizó
a esta persona a ver los perfiles de salud".

**Criterio de salida de B9:**
- Cero comparaciones de `nombre_rol` o `nombre_departamento` en todo el backend (verificado en CI).
- El modo dual reporta cero divergencias durante el periodo acordado antes de retirar el respaldo.
- Tests de integración por módulo: para cada permiso, una cuenta que lo tiene obtiene 200 y una cuenta
  que no lo tiene obtiene 403.
- Un administrador puede conceder una acción puntual a una persona **sin crear un rol nuevo** — es la
  prueba funcional de que la granularidad se logró, y la que habría evitado MED-18.
- `PERMISOS.md` regenerado **desde el catálogo en base de datos**, no mantenido a mano.

---

## I.7 Reglas de backend y divergencias frente a las skills

### I.7.1 Reglas de arquitectura B1–B26

| # | Regla | Se verifica con |
|---|---|---|
| **B1** | `domain/` no importa Django, DRF, ORM ni Celery | `import-linter` (`dominio-puro`) |
| **B2** | `application/` importa solo `domain/` | `import-linter` |
| **B3** | `infrastructure/` no importa `presentation/` | `import-linter` |
| **B4** | Los casos de uso reciben el repositorio por inyección; nunca importan `models` | `import-linter` + revisión |
| **B5** | Un value object valida su invariante en construcción y es inmutable | revisión |
| **B6** | Una entidad no conoce el ORM ni el serializer | revisión |
| **B7** | Las views no acceden al ORM; solo invocan casos de uso | grep `objects.` en `presentation/` |
| **B8** | Los serializers son validadores de frontera, no portadores de reglas de negocio | revisión |
| **B9** | Ninguna respuesta se arma a mano: siempre por `envelope` | grep `Response({` fuera de `core/presentation/` |
| **B10** | Una excepción de dominio nunca se traduce a HTTP en la view, solo en el `exception_handler` | grep |
| **B11** | Ningún módulo declara su propia paginación ni su propio formato de error | revisión |
| **B12** | Toda ruta nueva vive bajo `/api/v1/`, en minúscula-guion y con barra final | revisión de `urls.py` |
| **B13** | Ningún archivo supera 400 líneas | script en CI |
| **B14** | Prohibido `import *` y el re-export por `globals()` | `ruff` (F403/F405) |
| **B15** | Prohibidos los IDs mágicos: se consulta por clave natural o se declara constante de dominio | grep `id=\d` |
| **B16** | Un módulo nunca importa de otro módulo; lo transversal vive en `core/` | `import-linter` (`independencia-modulos`) |
| **B17** | `utils/` y `services/` no contienen reglas de negocio (de hecho `utils/` desaparece) | revisión |
| **B18** | Ninguna regla implementada a la vez en Python y en la base de datos | revisión + D-05 |
| **B19** | Ningún módulo accede al almacenamiento por ruta de archivo: solo por `archivo.id` a través del puerto `FileStorage` | grep `MEDIA_ROOT`, `open(` |
| **B20** | Ningún caso de uso importa Celery: se encola por el puerto `TaskQueue` | `import-linter` |
| **B21** | **Todo acceso a datos desde un caso de uso pasa por un puerto de repositorio** (divergencia declarada frente a la regla R5 de la skill — ver D-09) | `import-linter` + revisión |
| **B22** | **Ningún despacho de tarea ocurre dentro de una transacción abierta:** el receiver lo envuelve en `transaction.on_commit()` | grep `.delay(` fuera de `on_commit` |
| **B23** | **Toda tarea recibe identificadores, no instancias ni archivos**; declara `queue`, `acks_late`, `autoretry_for`, `retry_backoff`, `max_retries` y `time_limit`; y tolera `DoesNotExist` con `warning` | revisión de `tasks/` |
| **B24** | Todo endpoint declara `@extend_schema` con sus respuestas de error reales usando `MensajeRespuestaSerializer`, y `operation_id` explícito donde haya ambigüedad | generación del esquema en CI |
| **B25** | Todo `SerializerMethodField` lleva `@extend_schema_field`; todo `TextChoices` reutilizado está en `ENUM_NAME_OVERRIDES`; toda vista con `get_queryset()` dependiente de `self.request` lleva el guard `swagger_fake_view` | generación del esquema en CI |
| **B26** | Cada app tiene su `models.py` de re-export y su `AppConfig`; `ready()` solo si tiene receivers propios | revisión |

### I.7.2 Reglas de seguridad S1–S19 (las de backend)

| # | Regla |
|---|---|
| **S1** | Ningún endpoint sin `permission_classes` explícitas; `AllowAny` requiere justificación escrita en el código con el dato que expone |
| **S2** | Ninguna autorización por comparación de nombre de rol: solo por código de permiso |
| **S3** | Ningún secreto en el código ni en el repositorio; ningún valor por defecto para credenciales |
| **S4** | Ninguna operación sobre una cuenta se identifica por un `id` del cuerpo de la petición: siempre `request.user` |
| **S5** | Todo cambio de contraseña exige la contraseña actual y pasa por `validate_password()` |
| **S6** | Ninguna respuesta de error contiene `str(exception)` |
| **S7** | Todo endpoint de escritura sobre datos de personal deja registro en `auditoria` |
| **S8** | Todo endpoint que recibe un archivo valida tamaño, extensión en lista blanca y MIME **por firma real** |
| **S9** | Ningún archivo servido sin autorización ni con identificador adivinable |
| **S10** | Ningún identificador de recurso sensible es secuencial y adivinable (UUID) |
| **S11** | Toda verificación de propiedad se hace en el servidor, sobre el sujeto del token, no sobre un parámetro |
| **S12** | Todo endpoint de autenticación con límite de tasa, sobre un contador **compartido y persistente** |
| **S13** | El esquema OpenAPI y el admin no son públicos |
| **S14** | Todo refresco de token revalida `is_active` y preserva los claims |
| **S15** | Toda concesión o revocación de permiso se audita |
| **S16** | Ninguna URL de archivo es pública ni adivinable: descarga por vista autorizada o URL firmada de corta duración |
| **S17** | Ningún log contiene tokens, contraseñas, cuerpos completos de petición ni datos personales en texto libre |
| **S18** | **Prohibido `StringRelatedField` (y cualquier serialización que delegue en `__str__`) en un serializer alcanzable sin autenticación**: filtra lo que el `__str__` del modelo relacionado decida exponer |
| **S19** | **Ningún borrado de una entidad de configuración del sistema (rol, permiso, módulo) procede si tiene dependientes**: se rechaza con 409 y se audita el intento |

### I.7.3 Divergencias declaradas frente a las skills de backend

Se repiten aquí en forma corta para que queden localizables en la revisión de código; el razonamiento
completo está en §0.4.3.

| Divergencia | Skill dice | GATH hace | Decisión |
|---|---|---|---|
| Capa de repositorio | No usarla (su R5) | Usarla siempre (B21) | **D-09** |
| Routers y ViewSets | Prohibidos | Router en `catalogos` y `organizacion`; vistas explícitas en el resto | **D-10** |
| Backend de caché | Redis con fallo abierto | PostgreSQL, fallo **cerrado** para contadores de seguridad | **D-11** |
| Herramienta de test | Django `TestCase`, sin pytest | `pytest` + `pytest-django`, adoptando sus prácticas de factories y aislamiento | **D-12** |
| Granularidad de archivos | Uno por capa y app | Uno por entidad/caso de uso, techo de 400 líneas | B13 |
| Nombre de la capa externa | `api/` | `presentation/` | §0.3 |
| Rol en el JWT | No transportarlo | Transportarlo con `permisos_version` | B9.4 |

---

## I.8 Checklist de migración por módulo — backend

Se repite idéntico en cada sub-fase de B4. Ninguna sub-fase se declara cerrada sin los 11 puntos.

**Trabajo**

1. **Extraer el dominio.** Entidades y value objects a partir de los modelos y serializers actuales.
   Las validaciones de formato que hoy están en el serializer pasan a VO; las invariantes, a la entidad.
2. **Declarar los puertos** de repositorio en `domain/ports/` (solo los métodos que los casos de uso
   usan; no un CRUD completo por reflejo).
3. **Extraer las reglas de negocio** de las views hacia `application/use_cases/`, una función por caso
   de uso, con el repositorio por parámetro.
4. **Implementar repositorios ORM + mappers**; eliminar `import *` y el re-export por `globals()`
   (MED-03). Crear el `models.py` de re-export (B26).
5. **Revisar el inventario de §I.2.2** y reubicar lo que corresponda a este módulo. Al terminar, ningún
   archivo del módulo debe ser importado por otro módulo: si algo se necesita fuera, sube a `core/` o se
   expone como caso de uso.
6. **Sustituir los IDs mágicos** por constantes de dominio o consultas por clave natural (MED-04).
7. **Views delgadas:** validar entrada (serializer) → invocar caso de uso → `envelope.ok()`. Cada una con
   `HasPermission` del código que le toca en `PERMISOS.md` y con `@extend_schema` completo.
8. **Normalizar rutas** en `/api/v1/` con nombres coherentes en minúscula-guion y barra final (MED-16);
   marcar las legadas como `deprecated` en el esquema y con cabecera `Deprecation`.
9. **`select_related`/`prefetch_related` en los repositorios**; paginación obligatoria en los listados
   (MED-06).
10. **Tests:** unitarios del dominio y de los casos de uso **sin base de datos**, integración de la API
    con permisos (un 200 y un 403 por permiso), y regresión de los hallazgos que el módulo cierra.
11. **Auditoría:** toda escritura del módulo emite su evento a `auditoria` (S7).

**Criterio de salida por módulo**

- [ ] `import-linter` sin violaciones (B1–B4, B16, B20, B21).
- [ ] **Cero imports entrantes desde otros módulos.**
- [ ] Ningún archivo del módulo supera 400 líneas (B13).
- [ ] Cobertura de los casos de uso ≥ 80 %.
- [ ] Todo endpoint del módulo tiene su fila en `PERMISOS.md` y su test de 403.
- [ ] El esquema OpenAPI del módulo se genera sin advertencias (B24, B25).
- [ ] Ninguna respuesta del módulo se arma sin `envelope` (B9).
- [ ] Las rutas legadas del módulo están marcadas obsoletas y **sin consumidores en el frontend**
      (lo confirma la sub-fase gemela de F4).
- [ ] Los elementos del inventario §I.2.2 asignados a este módulo están reubicados.
- [ ] `manage.py check --deploy` limpio.
- [ ] Prueba de regresión de cada hallazgo que el módulo cierra, en verde.

---

## I.9 Testing — backend

**Decisión D-12: `pytest` + `pytest-django`.** La skill `testing-backend-django` prohíbe pytest para
mantener consistencia con 120 tests existentes en su proyecto; GATH tiene **128 líneas** de test y `RAC`
—el 60 % del código— no tiene ninguno. No hay consistencia que preservar, y el criterio de salida de B4
(probar casos de uso **sin base de datos**) se expresa con mucho menos ceremonia en pytest.

**Lo que sí se adopta de esa skill, sin cambios:**

| Práctica | Por qué importa aquí |
|---|---|
| **Factories que pasan por el caso de uso real**, no por `Model.objects.create()` | Si una cuenta de prueba se crea con el ORM directo, se salta las invariantes, los eventos y la auditoría que sí ocurren en producción: el test pasa por razones equivocadas |
| **Aislamiento de la caché de throttling** con `override_settings(CACHES=LocMemCache)` en una clase base | GATH pasa a tener contadores de throttling en PostgreSQL (D-11): sin aislamiento, la suite consumiría cupos reales y dejaría residuos que hacen fallar tests posteriores sin relación aparente |
| **Mockear en el punto de entrada del servicio**, no la librería de bajo nivel | Aplica a SeaweedFS (`FileStorage`), a RabbitMQ (`TaskQueue`) y a la generación de PDF: se mockea el puerto, no `boto3` ni `reportlab` |
| **Un test de éxito y uno de error por invariante** | La mitad de los hallazgos de §I.3 existen porque nadie probó el camino denegado |
| **Tolerancia a filas borradas en tareas** | Una tarea que falla porque el empleado se borró entre el encolado y la ejecución llena la cola de descartados sin motivo |

**Estructura y ejecución**

```
tests/
├── conftest.py            fixtures compartidas: repos falsos, cuentas por permiso, cliente API
├── unit/                  dominio y casos de uso — sin marca de BD, corren en segundos
│   └── [modulo]/test_[caso_de_uso].py
├── integration/           repositorios y endpoints — con @pytest.mark.django_db
│   └── [modulo]/test_[recurso]_api.py
└── seguridad/             una prueba por hallazgo CRIT-*/ALTA-* (B6.1)
```

```bash
pytest tests/unit                      # rápido, sin base de datos — es el que corre en cada guardado
pytest -m "not django_db"              # equivalente por marca
pytest --cov=apps --cov=core           # cobertura para el umbral de B6.8
```

**Plantilla de test de caso de uso (sin base de datos)**

```python
from apps.personal.activo.application.use_cases.registrar_empleado import registrar_empleado
from core.domain.exceptions import ConflictError


class RepoFalso:
    """El puerto es lo que hace posible este test: no hay Django en toda la prueba (B21)."""

    def __init__(self, existentes=()):
        self.existentes = list(existentes)
        self.guardados = []

    def obtener(self, cedula):
        return next((e for e in self.existentes if e.cedula == cedula), None)

    def guardar(self, empleado):
        self.guardados.append(empleado)
        return empleado


def test_registrar_empleado_devuelve_dto():
    dto = registrar_empleado(RepoFalso(), {"cedula": "V12345678", ...})
    assert dto.cedula == "V12345678"


def test_registrar_empleado_rechaza_cedula_duplicada(empleado_existente):
    with pytest.raises(ConflictError):
        registrar_empleado(RepoFalso([empleado_existente]), {"cedula": "V12345678", ...})
```

**Plantilla de test de permiso (integración)** — es la que cierra CRIT-08 y CRIT-12:

```python
@pytest.mark.django_db
@pytest.mark.parametrize("codigo,url,metodo", [
    ("personal.crear", "/api/v1/personal/", "post"),
    ("identidad.gestionar_roles", "/api/v1/identidad/roles/", "post"),
])
def test_sin_permiso_responde_403(api_client, cuenta_sin_permisos, codigo, url, metodo):
    api_client.force_authenticate(cuenta_sin_permisos)
    assert getattr(api_client, metodo)(url, {}).status_code == 403
```

**Nota de entorno:** la skill advierte de dos problemas de setup que aparecen antes que cualquier fallo
real —dependencias declaradas pero no instaladas en el entorno virtual, y un usuario de PostgreSQL sin
permiso `CREATEDB` para crear la base de test—. En GATH el segundo es **muy probable**, porque la base es
externa y administrada por otro equipo (D-03): de ahí que B1.11 declare un `postgres` efímero en el
compose de desarrollo/CI. Antes de reportar un test como roto, verificar que el entorno pueda siquiera
levantar la aplicación.

---
---
# PARTE II — FRONTEND (Next.js / App Router)

## II.1 Estado actual del frontend

### II.1.1 Estructura por ruta

```
app/(protected)/dashboard/[modulo]/
├── page.tsx                    ← página + lógica de UI + estado + composición
├── actions/*.ts                ← "use server", llama a api/ y arma la respuesta
├── api/getInfoX.ts             ← "use server", ~60 fetchers en un solo archivo (551 líneas)
├── schemas/*.ts                ← Zod
├── components/                 ← formularios y tablas del módulo (hasta 1.708 líneas)
└── tableX/page.tsx             ← ⚠️ rutas accidentales creadas por carpetas de tablas
```

Directorios que se superponen hoy: `src/shared/`, `src/components/` y `src/lib/`; `actions/` existe en la
raíz **y** dentro de `app/`; y hay **dos** implementaciones de `use-mobile` (MED-10).

### II.1.2 Flujo de datos real

```
Componente cliente ("use client")
  → server action (actions/*.ts)
    → apiFetchGet / apiFetch  (src/lib/api-client.ts, "use server")
      → fetch(NEXT_PUBLIC_DJANGO_API_URL_SERVER + path, Bearer dj_access)
        → Django
```

- El patrón `Server Action → fetch centralizado → Django` **ya es correcto** y coincide con la
  arquitectura objetivo (el `apiClient` de la skill). Se conserva y se endurece.
- Lo que falta es la separación en capas: hoy no existen `domain/`, `application/` ni `infrastructure/`.
  Un solo archivo (`getInfoRac.ts`) concentra el HTTP de todo un dominio y un solo archivo
  (`app/types/types.ts`, 579 líneas) concentra todos los tipos.

### II.1.3 Autenticación actual, extremo a extremo

```
LoginForm
 → loginAction (actions/auth-actions.ts)
   ├── fetch POST accounts/login/          ← 1.ª autenticación: guarda dj_access/dj_refresh en cookies
   └── signIn("credentials")
       └── authorize() en auth.config.ts
           └── fetch POST accounts/login/  ← 2.ª autenticación con la misma contraseña
 → jwt callback → session callback
 → src/proxy.ts (middleware) protege rutas por nombre de rol
```

Tres defectos en esa secuencia:

1. **La contraseña se envía dos veces** a Django y las cookies `dj_*` se fijan **antes** de que `signIn`
   valide: si `signIn` falla, quedan tokens de Django válidos en cookies sin sesión NextAuth (ALTA-03).
2. **`session.maxAge = 10 h` contra `REFRESH_TOKEN_LIFETIME = 8 h`** (ALTA-09): sesión viva con tokens
   muertos, y errores opacos durante las últimas dos horas.
3. **El middleware es la única barrera**, y decide por **nombre de rol y de departamento**
   (`proxy.ts:14-17`), no por permiso. La API no impone nada (CRIT-08), así que la protección es
   puramente cosmética: basta llamar a Django directamente.

### II.1.4 Duplicación estructural masiva

`gestion-trabajadores/` y `gestion-pasivos/` son copias casi literales:

| Par duplicado | Líneas |
|---|---|
| `crear-familiar.tsx` (activo) vs `crear-familiar.tsx` (pasivo) | 1.677 vs 1.708 |
| `tableEmployees/` vs `tablePasive/` | estructura equivalente |
| `movimientos/cambiar-*` | duplicado completo |
| `components/reports/` | generadores paralelos por tipo de personal |

Es el argumento más fuerte para el rediseño modular y **la mayor reducción de código del proyecto**:
estimación de **−35 % a −45 % de líneas** en el frontend al unificar `familiares`, `cargos`,
`movimientos` y `reportes` en un módulo parametrizado por tipo de personal.

### II.1.5 Manejo de archivos — la parte del frontend

**7 llamadas al servicio NestJS-Files:**

- **5 server actions escriben la foto**: `registerEmployeesActions.ts:34`, `formStepActions.ts:131`,
  `update-info.ts:151`, y sus dos gemelos de pasivos. Las cinco envían `profile: file.name` — un nombre
  suelto que nadie resuelve (§I.1.5).
- **1 lectura**: `getInfoRac.ts::imageProfileFn` la lee como `blob` desde `read-file/profile/{cedula}`.
- **2 banderas en PDF**: `reportEmployeePDF.tsx:294` y `reportPasivoPDF.tsx:288` usan `employee.profile`
  solo para decidir si pintan la foto, y la imagen la traen de otra fuente.

Las 7 se reapuntan en **F5.2** cambiando variable de entorno y ruta, sin tocar la lógica de los
formularios, porque B5.6 mantiene un contrato equivalente a propósito.

---

## II.2 Diagnóstico de arquitectura — frontend

| Dimensión | Estado | Evidencia |
|---|---|---|
| Separación de capas | ❌ Ausente | Reglas de negocio dentro de componentes |
| Cohesión por feature | ⚠️ Por ruta, no por dominio | `app/(protected)/dashboard/**` |
| Duplicación | ❌ Crítica | `gestion-trabajadores` ≈ `gestion-pasivos` |
| Contratos tipados | ⚠️ Un god-file de tipos, sin entidades ni DTOs | `src/app/types/types.ts` (579 líneas) |
| Testabilidad | ❌ Nula | **0 tests**; lógica acoplada a React y a server actions |
| Autorización | ❌ Cosmética | 35 comparaciones de `nombre_rol` en la UI; nada en la API |
| Convención de nombres | ⚠️ Mezcla de estilos | carpetas de tabla que generan rutas |
| Formato de código | ❌ Sin herramienta | Sin Prettier; sin reglas de frontera de import |

### II.2.1 God-files

| Archivo | Líneas | Contenido |
|---|---|---|
| `src/app/types/types.ts` | 579 | Todos los tipos del sistema |
| `.../api/getInfoRac.ts` | 551 | ~60 fetchers de todos los dominios |
| `gestion-pasivos/.../crear-familiar.tsx` | 1.708 | Formulario completo con estado, validación y composición |
| `gestion-trabajadores/.../crear-familiar.tsx` | 1.677 | Su gemelo |

**34 archivos superan 400 líneas** (MED-07).

### II.2.2 Rutas accidentales

Las carpetas de tablas (`tableEmployees/`, `tablePasive/`, `tableRole/`, `tableUser/`…) contienen un
`page.tsx`, así que el App Router **publica una ruta navegable por cada una** (MED-08). Son páginas que
nadie diseñó y que no pasan por ninguna verificación de acceso pensada.

### II.2.3 Ausencia de capa transversal real

No existe `shared/` en el sentido de la skill. Existen tres carpetas que se solapan (`src/shared/`,
`src/components/`, `src/lib/`) sin criterio de reparto, y el único elemento verdaderamente transversal
—el cliente HTTP— vive en `src/lib/api-client.ts` con dos defectos graves (ALTA-01 y CRIT-09).

### II.2.4 Autorización por nombre de rol: la deuda que crece

Estado verificado el 20-08-2026:

| Medida | Valor |
|---|---|
| Referencias a `nombre_rol` en `NextJS/src` | **35** |
| Referencias literales a `"RECEPCIONISTA"` | **22** |
| Archivos afectados | **24** (verificado con `grep -rl`) |
| Lugares que deciden acceso por rol o departamento | `proxy.ts:14-17`, 4 `app-sidebar.tsx`, `autogestion/layout.tsx`, columnas y `detail-info` de 4 tablas, 4 componentes de reportes |

Registrado como **MED-18**. Cada rol nuevo implementado por este camino añade ~20 puntos de cambio a la
Fase 9. La contención está en **F3.13** (congelar: prohibido añadir comparaciones nuevas) y el cierre en
**F9.5.2**.

**Conclusión:** igual que en el backend, el frontend no requiere reescribirse. Requiere **reorganizarse
por módulos y capas**, unificando los pares duplicados. Los activos reutilizables son: el patrón
`Server Action → apiClient → Django`, los ~60 componentes shadcn ya integrados, los formularios
`react-hook-form` + Zod, y los generadores de PDF de cliente.

---

## II.3 Auditoría de seguridad y malas prácticas — frontend

### II.3.1 Críticas

| ID | Hallazgo | Ubicación | Impacto |
|---|---|---|---|
| **CRIT-03** | **Secretos de producción versionados en git, con valor real** | `NextJS/.env.docker` y `NextJS/.env.example` — **los dos en `git ls-files` el 20-08-2026**, y con los **mismos valores** que el `.env` en uso | `AUTH_SECRET` (`kUf4…`) ⇒ **falsificación de sesiones NextAuth**; `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` ⇒ descifrado de payloads de server actions; clave de API de Resend (`re_EKque…`) utilizable por cualquiera. **Matiz verificado que cambia el alcance de la limpieza:** `NextJS/.env` y `BACKEND/.env` **nunca estuvieron en el historial** (`git log --all --diff-filter=A -- '*.env'` no devuelve nada) — la fuga viene del `.example` y del `.docker`, que se escribieron con valores reales en lugar de plantillas |
| **CRIT-09** | `refreshPromise` como singleton a nivel de módulo en código de servidor compartido | `NextJS/src/lib/api-client.ts:9,50-95` | Peticiones concurrentes de distintos usuarios **comparten la misma promesa de refresco**: el usuario B puede recibir el `access_token` del usuario A. **Mezcla de sesiones entre usuarios** |

### II.3.2 Altas

| ID | Hallazgo | Ubicación | Impacto | Fase |
|---|---|---|---|---|
| ALTA-01 | `apiFetch` nunca verifica `response.ok` (solo intercepta 401): devuelve el cuerpo de 403/404/500 como si fuera dato válido | `src/lib/api-client.ts:120-125` | Las denegaciones de permiso se muestran como "sin datos"; errores del servidor silenciados. Con la autorización real de B3, **todo el sistema empezaría a mentir en silencio** si esto no se corrige antes | F2.10 |
| ALTA-02 | `changePasswordAction(userId, newPassword)` envía un `userId` controlado por el cliente al endpoint `AllowAny` | `actions/auth-actions.ts:96-120` | IDOR explotable desde el navegador (par de CRIT-04) | F0.4 |
| ALTA-03 | Doble autenticación en login; las cookies `dj_*` se fijan antes de que `signIn` valide | `actions/auth-actions.ts:36-90`, `auth.config.ts` | Tokens de Django válidos sin sesión NextAuth; duplica la superficie de fuerza bruta | F3.7 |
| ALTA-09 | `session.maxAge = 10 h` contra `REFRESH_TOKEN_LIFETIME = 8 h` | `auth.ts:6` | Sesión viva con tokens muertos: errores opacos las últimas 2 horas | F3.8 |
| ALTA-10 (frontend) | `bodySizeLimit: "250mb"` | `next.config.ts:6-8` | Un solo archivo agota la memoria del proceso | F1.10 |
| ALTA-15 | `NEXT_PUBLIC_DJANGO_API_URL_SERVER` usada para todas las llamadas de servidor | `src/lib/api-client.ts` y ~50 archivos | El host interno de la API queda **incrustado en el bundle del navegador**. Viola la regla explícita de la skill (`.env` ⇒ sin `NEXT_PUBLIC_`) | F1.1 |
| **ALTA-18** (parte frontend) | `NextJS/.gitignore` ignora `.env` y `.env.local`, pero **no** `.env.docker` (versionado) ni `.env.bak_*`. `NextJS/.env.bak_20260819_091833` está hoy en el árbol con los secretos reales, sin versionar y **sin ignorar** | `NextJS/.gitignore` | Un `git add -A` recommitea los secretos que F0.3 acaba de purgar | F0.2 |

### II.3.3 Medias

| ID | Hallazgo | Fase |
|---|---|---|
| MED-07 | 34 archivos > 400 líneas (máx. 1.708) | F4 |
| MED-08 | Rutas accidentales por carpetas de tablas | F4 |
| MED-09 | God-files: `app/types/types.ts` (579), `getInfoRac.ts` (551, ~60 fetchers) | F2.14 y F4 |
| MED-10 | Directorios superpuestos `src/shared/` + `src/components/` + `src/lib/`; `actions/` duplicado; dos `use-mobile` | F2.9 |
| MED-11 (frontend) | Dependencias muertas: `prisma`, `bcryptjs`, `@formity/react`, `html2canvas` + `html-to-image`, y **tres** librerías de gráficos (`chart.js`, `recharts`, `d3`) | F1.8 |
| MED-12 | `next-auth@5.0.0-beta` y `zod@3` frente a los patrones v4 de las skills | F1.9 |
| MED-13 (frontend) | **Cero tests y cero CI** | F1.6, F6 |
| **MED-23** | **Tres gestores de paquetes a la vez:** `pnpm-lock.yaml`, `package-lock.json` y `pnpm-workspace.yaml` conviven, y `nextjs.dockerfile` hace `npm i` (que ignora ambos lockfiles) sobre `FROM node` sin versión fijada. La imagen de producción **no reproduce** las versiones que se prueban en desarrollo | F1.5, T1.7 |
| **MED-24** | **Las plantillas de las skills no compilan tal cual en GATH:** importan iconos de `@phosphor-icons/react`, que **no está instalado** —GATH usa `lucide-react`— y asumen alias sin `src/` (`@/shared/...` resuelve a `./src/*` aquí). Copiar una plantilla literal produce un error de build, no un aviso. Ver **D-13** y **D-14** | F2.13, F4 |
| **MED-25** | `next.config.ts` lleva `allowedDevOrigins` con dos IPs internas escritas en el código, y `experimental.serverActions.bodySizeLimit: "250mb"` (ALTA-10). Configuración de una máquina concreta dentro del repositorio | F1.1, F1.10 |
| **MED-18** | **35 comparaciones de `nombre_rol` y 22 de `"RECEPCIONISTA"` en 24 archivos** deciden qué ve el usuario | F3.13 → F9.5.2 |

---

## II.4 Arquitectura objetivo — frontend

### II.4.1 Estructura de carpetas

**El código de dominio se queda dentro de `src/` (D-13).** Las skills lo ponen en la raíz del proyecto
porque su proyecto no usa `src/`; GATH sí, y los 404 archivos actuales resuelven el alias `@/*` a `./src/*`.
Mover todo fuera de `src/` sería un cambio mecánico en cada import del repositorio sin ninguna ganancia
arquitectónica. Al leer una plantilla de la skill, `shared/…` se lee como `src/shared/…`.

```
NextJS/
├── auth.ts · auth.config.ts · next.config.ts          ← raíz: configuración
├── eslint.config.mjs · .prettierrc.json · vitest.config.mts · playwright.config.ts
├── types/next-auth.d.ts
├── src/
│   ├── proxy.ts                         middleware de rutas (defensa en profundidad, no barrera única)
│   ├── lib/utils.ts                     cn() y nada más
│   ├── shared/                          ← código compartido entre módulos (= core/ del backend)
│   │   ├── commons/api.ts               API.url (server-only, sin NEXT_PUBLIC_)
│   │   ├── infrastructure/
│   │   │   ├── http/                    fetcher-api.ts · errors.ts · query-params.ts · blob-utils.ts
│   │   │   ├── actions/                 acciones transversales (direcciones, cédula)
│   │   │   └── logging/logger.ts        trace_id + log rotado (D-04, C-5)
│   │   ├── validation/                  regex.ts · messages.ts · sanitize.ts · index.ts
│   │   ├── authorization/puede.ts       helper único de permisos (R16)
│   │   ├── types/                       api-respose.ts · layout-props.ts · types-apis.ts
│   │   ├── hooks/                       use-mobile.ts (uno solo)
│   │   └── ui/
│   │       ├── components/              shadcn + wrappers de formulario
│   │       └── layout/                  page-layout · header-layout · breadcrumb · session-wrapper
│   ├── modules/
│   │   └── [modulo]/
│   │       ├── domain/         entities/ · value-objects/ · ports/
│   │       ├── application/    dtos/ · use-cases/
│   │       ├── infrastructure/ http/ · mappers/ · repositories/ · actions/
│   │       └── ui/             schema/ · [nombre]-form.tsx · [nombres]-page.tsx
│   └── app/                             App Router — SOLO thin wrappers
│       ├── (auth)/login · signout
│       ├── (app)/[ruta]/page.tsx
│       └── api/reportes/[tipo]/route.ts proxy de PDF binario
└── e2e/                                 Playwright: fixtures · pages · specs
```

**Lo que desaparece:** `src/components/` y `src/lib/` como carpetas de cajón —sus contenidos se reparten
entre `src/shared/ui/components/` y `src/shared/…`—, el `actions/` de la raíz del proyecto, y todo
`src/app/(protected)/dashboard/**` una vez migrado (F8.2).

**Submódulos:** igual que en el backend, `personal/` es el único con submódulos (`activo/`, `pasivo/`,
`shared/`), siguiendo el patrón 2 de la skill.

**Alias de importación** (ya existen en `tsconfig.json`, no cambian): `@/*` → `./src/*`, `#/*` → `./*`
(para `auth.ts` y `auth.config.ts` de la raíz), `$/*` → `./public/*`.

### II.4.2 Orden de creación por capa (16 pasos)

De adentro hacia afuera. Cada archivo solo depende de los anteriores. **Este orden no es una
recomendación: es lo que hace que las reglas R1–R3 se cumplan por construcción.**

| # | Capa | Archivo | Depende de |
|---|---|---|---|
| 1 | `domain/value-objects/` | `[nombre]-vo.ts` | — |
| 2 | `domain/entities/` | `[nombre]-entity.ts` | VOs (1) |
| 3 | `domain/ports/` | `repo-[nombre].ts` | entities (2) |
| 4 | `application/dtos/` | `[nombre]-dto.ts` | entities (2) |
| 5–7 | `application/use-cases/` | `list-`, `create-`, `update-[nombre].ts` | ports (3), dtos (4) |
| 8 | `infrastructure/mappers/` | `mapper-[nombre].ts` | entities (2) |
| 9 | `infrastructure/http/` | `[nombres]-api.ts` | mappers (8), `apiClient` |
| 10 | `infrastructure/repositories/` | `repo-[nombre]-api.ts` | ports (3), http (9) |
| 11 | `infrastructure/actions/` | `[nombres]-actions.ts` | repos (10), use-cases (5–7), `handleSessionExpired` |
| 12 | `ui/schema/` | `schema-[nombre].ts` | zod + `shared/validation` |
| 13–14 | `ui/` | `[nombre]-form.tsx`, `[nombre]-edit-form.tsx` | schema (12), actions (11) |
| 15 | `ui/` | `[nombres]-page.tsx` | actions (11), form (13) |
| 16 | `app/` | `(app)/[ruta]/page.tsx` | page (15) |

**Y dos pasos que este plan añade a los 16 de la skill:**

| # | Capa | Archivo | Cuándo |
|---|---|---|---|
| 17 | test unitario | `[archivo].test.ts(x)` junto a cada caso de uso, schema y componente presentacional | **en el mismo commit** (R11) |
| 18 | E2E | `e2e/pages/[modulo].page.ts` + `e2e/specs/[modulo].spec.ts` + caso en `accesibilidad.spec.ts` | al cerrar el módulo (R13) |

### II.4.3 Flujo de datos objetivo

**Escritura:**

```
form submit → [Nombre]Form.tsx            "use client" + useTransition (R8)
  → create[Nombre]Action(data)            "use server"  — safeParse zero-trust
    → create[Nombre](repo, data)          use case      — repo por parámetro (R4)
      → repo[Nombre]Api.create(dto)       repository impl
        → post[Nombre](dto)               http
          → apiClient.post("path/", dto)  shared
            → fetch(API.url + path, Bearer dj_access)  → Django /api/v1/
```

**Lectura:**

```
page mount → [Nombres]Page.tsx            "use client" + useSWR("clave", fetch[Nombres]Action)
  → fetch[Nombres]Action()                "use server"
    → list[Nombres](repo)                 use case → devuelve DTOs (R5)
      → repo[Nombre]Api.getAll()
        → get[Nombres]()                  http → data.map(mapper)
          → apiClient.get("path/")
```

### II.4.4 Plantillas de archivo

**Value object — `domain/value-objects/cedula-vo.ts`**

```typescript
import { CEDULA } from "@/shared/validation";

export type CedulaVO = { readonly valor: string };

export function crearCedulaVO(entrada: string): CedulaVO {
  const valor = entrada.trim().toUpperCase();
  if (!CEDULA.test(valor)) throw new Error("Cédula inválida.");
  return { valor };
}
```

**Entidad — `domain/entities/empleado-entity.ts`**

```typescript
import type { CedulaVO } from "../value-objects/cedula-vo";

export interface EmpleadoEntity {
  readonly cedula: CedulaVO;
  readonly nombre: string;
  readonly apellido: string;
  readonly fechaIngreso: string;
}

export function createEmpleadoEntity(datos: Omit<EmpleadoEntity, never>): EmpleadoEntity {
  return { ...datos };
}
```

**Puerto — `domain/ports/repo-empleado.ts`**

```typescript
import type { EmpleadoEntity } from "../entities/empleado-entity";

export interface RepoEmpleado {
  getAll(filtros?: { estatus?: string }): Promise<EmpleadoEntity[]>;
  getByCedula(cedula: string): Promise<EmpleadoEntity | null>;
  create(datos: unknown): Promise<EmpleadoEntity>;
  update(cedula: string, datos: unknown): Promise<EmpleadoEntity>;
}
```

**DTO — `application/dtos/empleado-dto.ts`**

```typescript
export interface EmpleadoItemDTO {
  cedula: string;
  nombreCompleto: string;
  estatus: string;
}
```

**Caso de uso — `application/use-cases/list-empleados.ts`**

```typescript
import type { RepoEmpleado } from "../../domain/ports/repo-empleado";
import type { EmpleadoItemDTO } from "../dtos/empleado-dto";

export async function listEmpleados(repo: RepoEmpleado): Promise<EmpleadoItemDTO[]> {
  const entidades = await repo.getAll();
  return entidades.map((e) => ({
    cedula: e.cedula.valor,
    nombreCompleto: `${e.nombre} ${e.apellido}`,
    estatus: e.estatus,
  }));
}
```

**HTTP — `infrastructure/http/empleados-api.ts`**

```typescript
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

import type { EmpleadoEntity } from "../../domain/entities/empleado-entity";
import { mapperEmpleado } from "../mappers/mapper-empleado";

export async function getEmpleados(): Promise<EmpleadoEntity[]> {
  const data = await apiClient.get<unknown[]>("personal/");
  return data.map(mapperEmpleado);
}
```

**Server action — `infrastructure/actions/empleados-actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { logAction } from "@/shared/infrastructure/logging/logger";

import { listEmpleados } from "../../application/use-cases/list-empleados";
import { empleadoFormSchema } from "../../ui/schema/schema-empleado";
import { repoEmpleadoApi } from "../repositories/repo-empleado-api";

export async function fetchEmpleadosAction() {
  try {
    return await listEmpleados(repoEmpleadoApi);
  } catch (error) {
    handleSessionExpired(error);   // R7
    throw error;
  }
}

export async function createEmpleadoAction(rawData: unknown) {
  const validation = empleadoFormSchema.safeParse(rawData);   // zero-trust: el cliente puede mentir
  if (!validation.success) {
    return { error: "Datos inválidos", campos: validation.error.flatten().fieldErrors };
  }
  try {
    await repoEmpleadoApi.create(validation.data);
    logAction({ accion: "personal.crear", resultado: "ok" });  // sin datos personales (S17)
    revalidatePath("/personal");
    return { success: "Empleado registrado exitosamente" };
  } catch (error) {
    handleSessionExpired(error);
    return { error: error instanceof Error ? error.message : "Error al registrar" };
  }
}
```

**Schema Zod — `ui/schema/schema-empleado.ts`**

```typescript
import { z } from "zod";

import { CEDULA, ERROR, SOLO_LETRAS } from "@/shared/validation";   // nunca regex en línea

export const empleadoFormSchema = z.object({
  cedula: z.string().regex(CEDULA, ERROR.INVALID_CEDULA),
  nombre: z.string().min(2, ERROR.MIN_LENGTH(2)).regex(SOLO_LETRAS, ERROR.ONLY_LETTERS),
  fechaIngreso: z.string().date(ERROR.INVALID_DATE),
});

export type EmpleadoFormType = z.infer<typeof empleadoFormSchema>;
```

**Página de `app/` — thin wrapper (R10)**

```tsx
// app/(app)/personal/page.tsx
import EmpleadosPage from "@/modules/personal/activo/ui/empleados-page";

export default function Page() {
  return <EmpleadosPage />;
}
```

### II.4.5 Cliente HTTP objetivo — `shared/infrastructure/http/fetcher-api.ts`

Interfaz según la skill, **con los tres endurecimientos que GATH necesita**:

```typescript
export const apiClient = {
  get<T>(path): Promise<T>;
  post<T>(path, body?): Promise<T>;
  patch<T>(path, body?): Promise<T>;
  put<T>(path, body?): Promise<T>;
  delete<T>(path): Promise<T>;
  postForm<T>(path, formData): Promise<T>;    // multipart
  patchForm<T>(path, formData): Promise<T>;
  getBlob(path): Promise<Blob>;               // binario
};
```

| # | Comportamiento | Por qué |
|---|---|---|
| 1 | Lee `dj_access` de cookies `httpOnly` y lo inyecta como `Authorization: Bearer`; si el cuerpo es `FormData` elimina `Content-Type`; `cache: "no-store"` en todo | Patrón de la skill, ya correcto |
| 2 | **Verifica `response.ok` siempre**, no solo el 401. 403 ⇒ error de permiso explícito; 4xx/5xx ⇒ error con el `message` del sobre `{status, message, data}` | Cierra **ALTA-01**. Es prerrequisito de B3: sin esto, la autorización real se vería como "no hay datos" |
| 3 | 401 ⇒ intenta refrescar con `dj_refresh`; si falla lanza `SessionExpiredError`. **El refresco se serializa por sesión, nunca en una promesa a nivel de módulo** | Cierra **CRIT-09** (mezcla de sesiones entre usuarios) |
| 4 | Adjunta el `trace_id` de la petición en cabecera | Contrato **C-5** con el backend |

**Excepciones legítimas que no usan `apiClient`** (documentadas en la skill y válidas aquí):
`auth.config.ts` (necesita fijar las cookies antes de que exista el cliente), y
`app/api/reportes/[tipo]/route.ts` (proxy que transmite un PDF binario).

### II.4.6 Variables de entorno

| Variable | Server-only | Uso |
|---|---|---|
| `DJANGO_API_SERVER` | ✅ | Única URL de la API; centralizada en `shared/commons/api.ts` |
| `NEXTAUTH_URL` | ✅ | Callbacks de NextAuth |
| `AUTH_SECRET` | ✅ | Firma del JWT de sesión — **rotada en F0.3** |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | ✅ | Cifrado de payloads de server actions — **rotada en F0.3** |

**Reglas (R15):**

1. **Ninguna variable de API con prefijo `NEXT_PUBLIC_`.** El `apiClient` corre solo en server actions y
   server components; la URL nunca se expone al navegador. Cierra ALTA-15.
2. `shared/commons/api.ts` es el único lugar que lee `process.env` para la URL de la API; los módulos no
   la tocan.
3. **Ningún `.env` en el repositorio** — solo `.env.example` sin valores reales. Esto **contradice
   explícitamente** la práctica descrita en la skill (§0.4.3 F-a) y es deliberado: los `.env` versionados
   de GATH son CRIT-03.
4. El Dockerfile **no copia** `.env`: las variables se pasan en tiempo de ejecución.

### II.4.7 Server Components vs Client Components

| Si el componente necesita… | Marca |
|---|---|
| Hooks (`useState`, `useTransition`, `useForm`, `useSWR`, `useSession`) | `"use client"` |
| Eventos (`onClick`, `onChange`, `onSubmit`) | `"use client"` |
| Solo renderizar props + JSX | **sin** `"use client"` |
| `async`/`await` para traer datos | **sin** `"use client"` |
| `auth()` de next-auth | **sin** `"use client"` |

Regla práctica: las páginas de `app/` son server components; las páginas de `modules/*/ui/` suelen ser
`"use client"`; los componentes de `shared/ui/components/` traen su propia directiva.

---

## II.5 Mapa de migración — frontend

| Origen | Módulo objetivo `modules/` | Rutas objetivo en `app/(app)/` | Gemela backend |
|---|---|---|---|
| `actions/auth-actions.ts` + `(auth)/login` | `auth/` | `(auth)/login`, `(auth)/signout` | B3 |
| `dashboard/seguridad/**` (usuarios + `gestionar-roles`) | `identidad/` | `usuarios/`, `usuarios/crear`, `usuarios/[id]/editar`, `roles/`, `permisos/` | B3 |
| `dashboard/gestion-trabajadores/ubicacion-administrativa/**` | `organizacion/` | `organizacion/*` | B4.1 |
| (selects y catálogos dispersos) | `catalogos/` | — (se consume, no tiene pantalla propia salvo mantenimiento) | B4.2 |
| `dashboard/gestion-trabajadores/personal-trabajador/**` | `personal/activo/` | `personal/`, `personal/registrar`, `personal/[cedula]`, `personal/[cedula]/editar` | B4.3 |
| `dashboard/gestion-pasivos/personal-jubilado/**` | `personal/pasivo/` | `pasivos/*` | B4.4 |
| `dashboard/**/cargos/**` + `movimientos/asignar-*` | `cargos/` | `cargos/*` | B4.5 |
| `**/familiares/**` + `crear-familiar.tsx` (×2) | `familiares/` | `familiares/*` — **unifica activo y pasivo** | B4.6 |
| `**/movimientos/**` | `movimientos/` | `movimientos/*` | B4.7 |
| `**/reportes/**` + `components/reports/**` | `reportes/` | `reportes/*` | B5.11 |
| `dashboard/carnetizacion/**` | `carnetizacion/` | `carnetizacion/*` | B4.8 |
| `dashboard/autogestion/**` + `(auth)/censo-vivienda` | `autogestion/` | `autogestion/*` | B4.9 |

**Nota clave:** `familiares/`, `cargos/`, `movimientos/` y `reportes/` hoy existen **duplicados** para
activos y pasivos. En el objetivo son **un solo módulo** parametrizado por tipo de personal. Aquí está la
mayor reducción de código del proyecto.

**Las carpetas de tabla desaparecen como rutas:** `tableEmployees/`, `tablePasive/`, `tableRole/`,
`tableUser/`, `tableFamilys/` pasan a ser componentes dentro de `modules/[modulo]/ui/` sin `page.tsx`,
lo que elimina las rutas accidentales (MED-08).

---

## II.6 Plan por fases — frontend

### FASE F0 — Contención de seguridad · en paralelo con B0 · bloqueante

| # | Acción | Cierra |
|---|---|---|
| **F0.2** | **Crear el `.gitignore` de la raíz** —hoy no existe— y ampliar el de `NextJS/` con `.env.*` (salvo `.env.example`) y `*.bak_*`. Comprobar con `git status --porcelain | grep '^??'` que no queda ningún `.xlsx` de personal, ningún volcado y ningún respaldo de `.env` en estado "listo para commitear". **Se hace antes de F0.3**: purgar el historial mientras los mismos secretos siguen sin ignorar en el árbol es trabajo que se deshace solo | **ALTA-18** |
| F0.3 | **Eliminar `.env.docker` y los secretos de `.env.example` del índice de git, purgar el historial** (`git filter-repo`), y **rotar** `AUTH_SECRET`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` y la clave de Resend. Verificado el 20-08-2026: los dos archivos **siguen en `git ls-files`**, así que la tarea está abierta | CRIT-03 |
| F0.4 | Ajustar `changePasswordAction` para **no aceptar `userId`**: el cambio de contraseña opera siempre sobre la sesión actual, en coordinación con B0.4 | ALTA-02 |
| F0.9 | Mover `refreshPromise` a un ámbito **por petición** (`React.cache()` o mapa con clave de sesión) y serializar el refresco por usuario. Es un parche puente; la reescritura definitiva del cliente es F2.10 | CRIT-09 |
| F0.17 | Revisión de las cookies: `httpOnly`, `secure` y `sameSite` explícitos y **no derivados de `DEBUG`** ni de `NODE_ENV` a solas | CRIT-02 (parte frontend) |

**Criterio de salida de F0:** ningún secreto en el árbol ni en el historial (`git log --all
--full-history -- 'NextJS/.env*'` sin resultados); todas las claves rotadas; dos usuarios concurrentes con
tokens a punto de expirar **no** intercambian sesión (prueba manual documentada).

> **Aviso de coordinación (D-08 / A-05):** rotar `AUTH_SECRET` invalida todas las sesiones activas, igual
> que rotar `SECRET_KEY` en el backend. Las dos rotaciones se hacen **en la misma ventana**, o el sistema
> queda en un estado en que la sesión de NextAuth es válida y los tokens de Django no.

### FASE F1 — Cimientos, herramientas y contratos · 1–2 semanas

| # | Entregable |
|---|---|
| F1.1 | **Contrato de entorno.** `.env.example` sin valores reales. Renombrar `NEXT_PUBLIC_DJANGO_API_URL_SERVER` → `DJANGO_API_SERVER` (server-only) y centralizarla en `shared/commons/api.ts`. Cierra ALTA-15 |
| F1.5 | **Tooling de lint y frontera:** `eslint` con `no-explicit-any` en **error** y `eslint-plugin-boundaries` con los bloques `architectureBoundaries` (R1–R3), `sharedIsolation` (nada de `shared/` importa de `modules/`) y `codeStyle` (`import/order`, `consistent-type-imports`). Unificar el gestor de paquetes en **pnpm** (hoy coexisten `pnpm-lock.yaml`, `package-lock.json` y un `npm i` en el Dockerfile) |
| **F1.5b** | **Prettier** (`.prettierrc.json` con `semi`, `singleQuote: false`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100`), `.prettierignore`, y `eslint-config-prettier` **como último elemento** del array de configuración (R14). Scripts `format` y `format:check`; `format:check` es puerta del build |
| **F1.5c** | **Vitest + RTL + MSW** instalados con el proyecto `"unit"` separado en `vitest.config.mts`, `vitest.setup.ts` con `@testing-library/jest-dom/vitest`, y scripts `test:unit` / `test:unit:watch` **siempre con `--project=unit`** |
| **F1.5d** | **Storybook + Chromatic** con `@storybook/nextjs-vite`, addons de a11y, docs y vitest; toolbar de temas; `test:storybook` en su propio proyecto de Vitest. **Antes de escribir la primera story hay que verificar cuál es el tema por defecto real de GATH** — en el proyecto de la skill `:root` es un tema de marca, no el claro (§0.4.3 F-h) |
| F1.6 | **CI del frontend:** `format:check` → `eslint` (incluye boundaries) → `tsc --noEmit` → `test:unit` → `build` → (desde F4) `test:e2e` |
| F1.7 | **Dockerfile de producción** multi-stage con stage `tester` que corre lint, typecheck y tests; `output: standalone`; imagen fijada por versión; usuario no root; `pnpm install --frozen-lockfile`. Cierra ALTA-12 (frontend) |
| F1.8 | **Poda de dependencias:** retirar `prisma`, `bcryptjs`, `@formity/react`, uno de `html2canvas`/`html-to-image`, y **quedarse con una sola librería de gráficos (`recharts`)**. Cierra MED-11 (frontend) |
| F1.9 | **Actualizaciones planificadas:** subir `zod` a **v4** (las plantillas de las skills asumen v4) y decidir sobre `next-auth` (v5 estable cuando exista, o fijar el beta con nota de riesgo). Cierra MED-12 |
| F1.10 | Limitar `bodySizeLimit` a lo realmente necesario (**≤ 25 MB**) en coordinación con el límite del backend. Cierra ALTA-10 (frontend) |

**Criterio de salida:** CI verde en `dev` con las seis puertas; `pnpm format:check` en 0 diffs; el build
standalone arranca en contenedor; `eslint-plugin-boundaries` ya rechaza un import que viole R1–R3 (probado
a propósito con un import inválido temporal).

### FASE F2 — Núcleo compartido `shared/` · 2 semanas · sin cambios funcionales visibles

| # | Entregable |
|---|---|
| F2.9 | Reorganizar `src/shared/` + `src/components/` + `src/lib/` en el `shared/` de §II.4.1; **eliminar el `use-mobile` duplicado** y el `actions/` de la raíz. Cierra MED-10 |
| F2.10 | **`shared/infrastructure/http/fetcher-api.ts`**: reescribir `api-client.ts` como el `apiClient` de §II.4.5 — los 8 métodos, **verificación de `response.ok`**, 403 explícito, refresco sin estado global compartido. Cierra ALTA-01 y CRIT-09 (definitivo) |
| F2.11 | `errors.ts` (`SessionExpiredError`, `handleSessionExpired`), `query-params.ts` (filtra `null`/`undefined`/`""`), `blob-utils.ts` (`createDownloadUrl`, `revokeDownloadUrl`) |
| F2.12 | **`shared/validation/`** según la skill `validacion-input-protegido`: `regex.ts` (cédula con sus casos borde `V/E/J/P/G` + variante de solo dígitos que usa el backend, RIF, teléfono, email, nombres, direcciones, contraseña, fecha), `messages.ts` (objeto `ERROR` con mensajes y funciones), `sanitize.ts` (`normalizeSpaces`, `stripHtml`, `stripControlChars`) y `index.ts`. Migrar `src/lib/regex.ts` y **borrar todo regex en línea** |
| F2.13 | `shared/ui/components/` (shadcn ya existente + los wrappers de formulario `InputForm`, `SelectForm`, `DateForm`, `FileForm`, `TextareaForm` con su `Field`/`FieldLabel`/`FieldError`) y `shared/ui/layout/` (`page-layout`, `header-layout`, `breadcrumb`, `session-wrapper`) |
| F2.14 | Descomponer `src/app/types/types.ts` (579 líneas): lo transversal a `shared/types/`, el resto se disuelve en entidades y DTOs de cada módulo durante F4. Cierra MED-09 (parte de tipos) |
| F2.8d | **`shared/infrastructure/logging/logger.ts`** (D-04, C-5): las server actions y el `apiClient` escriben en archivo rotado del contenedor de Next.js el **mismo `trace_id`** que viaja en cabecera hacia Django. **Prohibido registrar datos personales, tokens o cuerpos completos**: solo identificadores, códigos y resultado (S17) |
| **F2.18** | **Tests unitarios del núcleo**: `fetcher-api` con **MSW** (es la pieza de red que de verdad vale la pena aislar: 401→refresco, 403→error de permiso, 500→error con mensaje del sobre), los helpers de `validation/`, y `query-params`. Es el primer test del proyecto y el que demuestra que la infraestructura de F1.5c funciona |
| **F2.19** | **Stories de los wrappers de formulario** (`Field` con y sin error, `SelectForm` con y sin opciones, `FileForm` con archivo seleccionado) y línea base de Chromatic. Sin línea base, la regresión visual de F6 no tiene contra qué comparar |

**Criterio de salida:** al menos una ruta ya usa el `apiClient` nuevo conviviendo con el viejo; los tests
de MSW cubren los cuatro caminos de respuesta (200/401/403/500); Chromatic tiene línea base aceptada;
`grep -rn "new RegExp\|/\^" modules/ app/` no encuentra regex fuera de `shared/validation/`.

### FASE F3 — Identidad, autorización y auth · 2 semanas · piloto

| # | Entregable |
|---|---|
| F3.7 | **Unificar el login:** una sola llamada a Django. `authorize()` de NextAuth es el **único** punto que autentica y fija las cookies `dj_*`; `loginAction` solo invoca `signIn`. Cierra ALTA-03 (**hito H-2** con B3.6) |
| F3.8 | Alinear `session.maxAge` con `REFRESH_TOKEN_LIFETIME` (8 h). Cierra ALTA-09 |
| F3.9 | **Autorización también en el servidor de Next.js**, no solo en el middleware: verificación de permisos en los layouts de `app/(app)/` y **en cada server action**. El middleware es defensa en profundidad, no la única barrera |
| F3.10 | `modules/identidad/` con el patrón completo de 18 pasos (entidad, VO, puerto, DTO, casos de uso, mapper, http, repositorio, acciones, schema, formularios, página, tests, E2E) — incluida la pantalla de **roles** que hoy vive en `dashboard/seguridad/gestionar-roles/` |
| F3.11 | `modules/auth/` con `login-form.tsx`, `schema-login.ts` y `auth-actions.ts` |
| **F3.13** | **Congelar MED-18.** Regla de CI: **prohibido añadir comparaciones nuevas de `nombre_rol` o `nombre_departamento`**; el conteo actual (35 y 22) se fija como techo y solo puede bajar. Las que existen se envuelven en **un único helper** `puede(accion)` de `shared/` —que en esta fase resuelve por el mapa rol→códigos de B3.2 y en F9 pasa a leer permisos— de modo que la sustitución final sea un cambio de una función y no de 24 archivos |
| F3.14 | `types/next-auth.d.ts` extendido para que `session.user` transporte `permisos: {id, code, name}[]` desde ya, aunque en esta fase se rellene desde el mapa de roles. Es el contrato C-3 |

**Criterio de salida de F3:**
- Iniciar sesión hace **una sola** petición de autenticación a Django (verificado en el log del backend).
- Una cuenta sin permiso que navega directamente a una ruta protegida recibe la pantalla de acceso
  denegado **desde el servidor**, no un redireccionamiento del middleware.
- El conteo de comparaciones de nombre de rol **no aumentó**; todas las existentes pasan por `puede()`.
- E2E de autenticación en verde en los tres navegadores.

### FASE F4 — Migración de módulos · 8–12 semanas · iterativa

Cada sub-fase es la gemela de la de backend y **se cierra cuando el módulo consume `/api/v1/`**, no antes.

| Sub-fase | Módulo | Trabajo característico |
|---|---|---|
| F4.1 | `organizacion` | `DireccionAdminSelects`: los 4 selects en cascada pasan a `shared/ui/components/` porque los usan casi todos los formularios |
| F4.2 | `catalogos` | Los ~35 catálogos pasan a un módulo consumido por selects; se elimina el fetcher por catálogo en `getInfoRac.ts` |
| F4.3 | `personal/activo` | El módulo más grande; `CedulaSearch` a `shared/`; descomposición de los formularios por pasos |
| F4.4 | `personal/pasivo` | **Reutiliza `personal/shared/`**: aquí se mide la reducción real de código |
| F4.5 | `cargos` | Unifica las pantallas duplicadas de asignación |
| F4.6 | `familiares` | **Une `crear-familiar.tsx` ×2 (1.677 + 1.708 líneas) en un módulo** parametrizado por tipo de personal. Es la sub-fase de mayor ganancia |
| F4.7 | `movimientos` | Unifica `cambiar-*` duplicado |
| F4.8 | `carnetizacion` | Se ajusta al nuevo contrato de validación de carnet (B4.8): la pantalla pública deja de recibir el expediente |
| F4.9 | `autogestion` | Un empleado solo ve su propia cédula (ya impuesto en el servidor por B3.4) |

El checklist detallado por módulo está en §II.8.

### FASE F5 — Archivos, reportes y trabajos asíncronos · 2–3 semanas · sigue a B5

| # | Entregable |
|---|---|
| F5.2 | **Reapuntar las 7 llamadas de archivos** de NestJS a `/api/v1/archivos/…` (B5.6): 5 escrituras y 1 lectura de foto, más las 2 banderas de PDF. Cambio de variable y de ruta, sin tocar la lógica de los formularios |
| F5.2b | **Dejar de enviar `profile: file.name`** en las 5 server actions: la subida devuelve `archivo.id` y el backend actualiza la referencia (B5.6b). Los PDF usan `foto_id` como bandera. Es la mitad de frontend del cierre de ALTA-16 |
| F5.3 | Retirar `NEXT_PUBLIC_NEST_API_URL*` del árbol y del `compose.yml`; grep en CI que impide que vuelva |
| F5.4 | **Contrato de trabajo asíncrono (C-4):** al recibir `202` con `tarea_id`, la UI muestra estado en progreso y consulta `GET /api/v1/tareas/{id}/` con `useSWR` + `refreshInterval`, con estado de error explícito y sin bloquear la pantalla. Aplica a carga masiva de Excel, reportes por dependencia y exportaciones |
| F5.5 | El proxy de PDF pasa a `app/api/reportes/[tipo]/route.ts` con URLs firmadas (B5.12) y usa `blob-utils.ts` para la descarga; nunca expone la URL del almacenamiento |
| F5.6 | Subida de archivos: validación de tamaño y extensión **también en el cliente** (mensaje inmediato), sabiendo que la validación que manda es la del servidor (B5.2) |

### FASE F6 — Calidad, UX, accesibilidad y rendimiento · 3 semanas

| # | Entregable |
|---|---|
| F6.2 | **Suite E2E de Playwright** (chromium + firefox + webkit) cubriendo autenticación, permisos por rol y el CRUD de cada módulo, con fixture de login y `storageState` |
| F6.2b | **Tests unitarios al día**: todo caso de uso, schema Zod y componente presentacional con su `.test.ts(x)` (R11); umbral publicado en CI |
| F6.2c | **Accesibilidad automática**: `e2e/specs/accesibilidad.spec.ts` con un caso por ruta, separando rutas públicas (`base`/`page`) de protegidas (`authTest`/`authPage`). El objetivo es `violations` vacío; si una página arranca con demasiado ruido se acota **temporalmente** a `serious`/`critical` con la razón escrita en el propio test |
| F6.2d | **Regresión visual**: Chromatic sobre las stories, revisando los cambios en cada PR que toque `shared/ui/` |
| F6.3 | **`mobile-first-design`**: breakpoints, objetivos táctiles ≥ 48 px, tablas responsivas, colapso del sidebar, texto legible sin zoom |
| F6.4 | **`design-taste-frontend` y `animaciones-frontend`**: sistema visual coherente, `prefers-reduced-motion` obligatorio, una sola librería de animación por componente, y **verificación del tema por defecto** antes de tocar tokens de color |
| F6.6 | Rendimiento: `useSWR` con **claves estables** (una clave construida en el render rompe la caché), `Suspense` y los 5 patrones de estado de carga de la skill —`useTransition` en formularios, `isLoading` de SWR en listas, `Skeleton` como placeholder, `loading.tsx` de ruta, `EmptyState` sin datos— aplicados de forma consistente |
| F6.7 | Accesibilidad manual: `aria-invalid` en todos los campos (ya presente en los wrappers `Field`), navegación por teclado, contraste en ambos temas |

**Criterio de salida de F6:** CI ejecuta `format:check` + eslint + typecheck + unitarios + E2E + a11y;
Chromatic sin cambios inesperados; los tests de regresión de seguridad del frontend (CRIT-09, ALTA-01,
ALTA-02) son parte del pipeline.

### FASE F8 — Retiro del legado · 1–2 semanas

| # | Entregable |
|---|---|
| F8.2 | Eliminar `src/app/(protected)/dashboard/**` legado, `getInfoRac.ts`, `app/types/types.ts` y los componentes duplicados |
| F8.3 | Poda final de dependencias y de assets no referenciados en `public/` |
| F8.6 | **Actualizar las 12 skills de `NextJS/.claude/skills/`** para que sus ejemplos usen los módulos de GATH (`personal`, `cargos`, `familiares`…) en lugar de los de FITELVEN (`transporte`, `comedor`, `apoyo`, `servicios`), y para que la regla de `.env` refleje la de este plan (§0.4.3 F-a) |
| F8.7 | Medir y publicar la reducción real de líneas de código frente a la estimación de −35 % a −45 % |

### FASE F9 — Permisología en la UI · 2–3 semanas · sigue a B9

| # | Entregable |
|---|---|
| F9.5.1 | `session.user.permisos` como `{id, code, name}[]` alimentado desde el catálogo real (el contrato ya existía desde F3.14) |
| F9.5.2 | **Sustituir en `proxy.ts` la comparación de nombre de rol y departamento por verificación de códigos.** Gracias a F3.13, el cambio se concentra en el helper `puede()`; el middleware sigue siendo defensa en profundidad, no la barrera única |
| F9.5.3 | Sidebar y menús construidos a partir de los permisos: un módulo sin ningún permiso concedido **no se renderiza** |
| F9.5.4 | Renderizado condicional por acción: `puede("cargos.asignar")` decide si el botón existe |
| F9.5.5 | Pantalla de gestión de permisos en `modules/identidad/ui/permisos-page.tsx`: catálogo agrupado por módulo con botones de alternancia, plantillas de rol aplicables y excepciones individuales |
| F9.5.6 | E2E por rol: para cada permiso, una cuenta que lo tiene ve el control y una que no lo tiene **no lo ve ni puede alcanzarlo por URL directa** |

**Criterio de salida de F9:** cero comparaciones de `nombre_rol` o `nombre_departamento` en todo el
frontend (verificado en CI); el sidebar de una cuenta sin permisos está vacío en lugar de mostrar
opciones que fallan al abrirse.

---

## II.7 Reglas de frontend y divergencias frente a las skills

### II.7.1 Reglas R1–R16

| # | Regla | Se verifica con |
|---|---|---|
| **R1** | `domain/` no importa de `application/`, `infrastructure/`, `ui/` ni de nada externo | `eslint-plugin-boundaries` |
| **R2** | `application/` importa solo de `domain/` | boundaries |
| **R3** | `ui/` no importa de `infrastructure/`: los datos llegan por props (DTOs) o server actions | boundaries |
| **R4** | Los casos de uso reciben el repositorio **por parámetro**; nunca importan una implementación concreta | revisión + test unitario con repo falso |
| **R5** | La UI recibe **DTOs**, no entidades de dominio | revisión |
| **R6** | Sin imports relativos de más de 2 niveles: usar alias `@/` | eslint |
| **R7** | Toda server action captura el error y llama `handleSessionExpired(error)` | revisión + grep |
| **R8** | Toda operación asíncrona en UI usa `useTransition` + `startTransition` | revisión |
| **R9** | Archivos en **kebab-case** | eslint / script |
| **R10** | Las páginas de `app/` son thin wrappers | revisión |
| **R11** | **Todo caso de uso, schema Zod y componente presentacional nuevo lleva su `.test.ts(x)` junto al archivo, en el mismo commit** | cobertura en CI |
| **R12** | **Todo componente de `shared/ui/components/` con más de una variante visual relevante lleva su `.stories.tsx`** | revisión + Chromatic |
| **R13** | **Toda ruta nueva con Page Object en `e2e/pages/` lleva su caso en `accesibilidad.spec.ts`** | CI |
| **R14** | **`eslint-config-prettier` es el último elemento del array de configuración**, y `format:check` pasa en 0 diffs | CI |
| **R15** | **Ninguna variable de API con `NEXT_PUBLIC_`; ningún `.env` en el repositorio**; solo `shared/commons/api.ts` lee la URL | grep en CI |
| **R16** | **Ninguna decisión de acceso por nombre de rol o de departamento**: solo por código de permiso, a través del helper `puede()` | grep en CI (techo decreciente desde F3.13) |

**Reglas de seguridad que aplican al frontend:** S3 (sin secretos), S11 (la propiedad se verifica en el
servidor), S17 (el log no lleva datos personales ni tokens), y la regla zero-trust: **toda server action
revalida su entrada con `safeParse` contra el mismo schema del formulario** — el cliente puede mentir.

### II.7.2 Divergencias declaradas frente a las skills de frontend

| Divergencia | Skill dice | GATH hace | Razón |
|---|---|---|---|
| `.env` en git | "`.env` está en git con defaults de desarrollo" | **Prohibido**; solo `.env.example` sin valores | Es CRIT-03 (§0.4.3 F-a) |
| `apiClient` en 403 | Lanza `Error` genérico | Error de permiso **explícito y distinguible** | Con la autorización real de B3, un 403 mal manejado se ve como "sin datos" (ALTA-01) |
| Refresco de token | No especifica el ámbito | **Por sesión, nunca en ámbito de módulo** | Es CRIT-09 |
| Zod | Patrones v4 | Migrar de v3 a v4 en F1.9 antes de copiar plantillas | Compatibilidad |
| Tema por defecto | `:root` es el tema de marca | **Verificar en GATH** antes de tocar tokens | Es una particularidad del otro proyecto |
| Módulos de ejemplo | `transporte`, `comedor`, `apoyo`, `servicios` | Los 10 módulos de §II.5 | Dominio distinto |
| **Raíz del código** | `modules/`, `shared/`, `app/` en la raíz del proyecto | **Dentro de `src/`** (`src/modules/`, `src/shared/`, `src/app/`) | **D-13**: los 404 archivos actuales resuelven `@/*` a `./src/*`. Sacar todo de `src/` es un cambio mecánico de 404 archivos que no aporta nada arquitectónicamente |
| **Librería de iconos** | `@phosphor-icons/react` en todas las plantillas | **`lucide-react`** | **D-14**: es la que está instalada y en uso. Las plantillas se adaptan al importar, no se copian literales (MED-24) |
| **Estado de cliente** | No lo menciona | `zustand` ya instalado; se conserva para estado de UI local, **nunca** para datos del servidor (eso es `useSWR`) | Evita que aparezca un tercer patrón de datos sin decidirlo |
| Stories | Todo componente con variantes | Limitado a `shared/ui/components/` y componentes de módulo con estados relevantes | 60+ componentes shadcn no necesitan stories propias |

---

## II.8 Checklist de migración por módulo — frontend

Se repite idéntico en cada sub-fase de F4.

**Trabajo**

1. **Crear `modules/[modulo]/`** siguiendo el orden de 18 pasos de §II.4.2 (los 16 de la skill + tests +
   E2E). No saltarse el orden: es lo que hace que R1–R3 se cumplan por construcción.
2. **Extraer los tipos** correspondientes de `app/types/types.ts` hacia entidades y DTOs (MED-09).
3. **Extraer los fetchers** correspondientes de `getInfoRac.ts` hacia
   `infrastructure/http/[nombres]-api.ts`, uno por recurso.
4. **Descomponer los componentes de más de 400 líneas** en formulario, tabla, detalle y filtros (MED-07).
5. **Reescribir la ruta en `app/(app)/` como thin wrapper** y **eliminar las carpetas de tabla que
   generaban rutas accidentales** (MED-08).
6. **Schemas Zod con los regex compartidos** de `shared/validation/`; cero regex en línea.
7. **Server actions** con `safeParse` de entrada, `try/catch` + `handleSessionExpired` (R7),
   `revalidatePath` donde corresponda, y log con `trace_id` sin datos personales.
8. **Formularios** con `useTransition` (R8) y los wrappers de `shared/ui/components/`.
9. **Permisos**: ningún control visible sin su verificación por código (R16, a través de `puede()`).
10. **Tests unitarios** de los casos de uso (con repo falso) y de los schemas (casos válidos **e**
    inválidos, no solo "requerido") (R11).
11. **E2E**: Page Object + spec CRUD + caso de a11y (R13); stories si el módulo aporta componentes
    visuales nuevos (R12).
12. **Reapuntar a `/api/v1/`** cuando la sub-fase gemela del backend esté cerrada. **Esto es lo que
    cierra la sub-fase.**

**Criterio de salida por módulo**

- [ ] `eslint-plugin-boundaries` sin violaciones (R1–R3).
- [ ] Ningún archivo del módulo supera 400 líneas.
- [ ] Cero imports desde otro módulo (lo transversal está en `shared/`).
- [ ] Todo caso de uso y todo schema con test unitario; suite en verde.
- [ ] E2E del CRUD en verde en **chromium, firefox y webkit**.
- [ ] Caso de accesibilidad de cada ruta nueva, sin violaciones `serious`/`critical`.
- [ ] `format:check` y `tsc --noEmit` limpios.
- [ ] Cero regex en línea y cero literales de estatus hardcodeados (salvo la excepción documentada de la
      skill: los estatus que el backend define como cadena).
- [ ] Cero comparaciones nuevas de nombre de rol (R16).
- [ ] Las pantallas legadas del módulo quedan sin enlaces entrantes y el módulo consume `/api/v1/`.
- [ ] Reducción de líneas del módulo medida y anotada (insumo de F8.7).

---

## II.9 Calidad: tests, visual, accesibilidad y formato — frontend

Cuatro herramientas nuevas, cada una con un alcance distinto. La razón de tenerlas todas es que **ninguna
cubre lo de la otra**, y hoy el frontend tiene **cero** de las cuatro.

| Herramienta | Qué prueba | Qué **no** prueba | Cuándo corre |
|---|---|---|---|
| **Vitest + RTL + MSW** | Casos de uso puros (con repo falso), schemas Zod, componentes presentacionales, y el `apiClient` con red simulada | **Server actions** (usan `cookies()` de `next/headers`, solo válido dentro del scope de petición) y **Server Components async** (no soportados) | En cada guardado y en CI |
| **Playwright** | Flujos completos con backend real: login, permisos por rol, CRUD por módulo, subida y descarga de archivos | Lógica pura (sería lentísimo) y detalles visuales | En CI y antes de cada entrega |
| **axe-core sobre Playwright** | Accesibilidad de la **página completa renderizada**, con datos reales, en navegador real | Accesibilidad de un componente aislado (eso lo hace el addon de Storybook) | Junto a la suite E2E |
| **Storybook + Chromatic** | Aspecto de cada componente en sus variantes y en los temas; **regresión visual** entre versiones | Comportamiento de la aplicación completa | En cada PR que toque `shared/ui/` |

**Convenciones (de las skills, adoptadas sin cambios):**

- Los tests unitarios y las stories van **junto al archivo** que prueban, no en carpetas separadas.
- `test:unit` **siempre** con `--project=unit`: sin el filtro, Vitest intenta correr también el proyecto
  `storybook` (stories en Chromium headless), que es lento y no pertenece a esa suite.
- En los tests de a11y, usar alias distintos (`base` para rutas públicas, `authTest` para protegidas):
  reusar el nombre `test` para dos instancias de `test.extend()` distintas produce un error silencioso.
- En los tests de schemas, casos válidos **e** inválidos: probar solo "campo requerido" no prueba nada.
- El orden que evita que las herramientas se pisen: **`eslint --fix` primero** (reordena imports, añade
  `import type`), **`prettier --write` después** (ajusta espacios y comillas sobre el resultado ya
  reordenado), y `format:check` al final para confirmar.

**Qué se prueba primero (orden de adopción real):** el `apiClient` con MSW (F2.18) → los casos de uso del
módulo piloto (F3.10) → los schemas de cada módulo migrado (F4.x) → E2E por módulo (F4.x) → a11y y
regresión visual (F6). Adoptar las cuatro a la vez sobre el código legado sería tiempo perdido: el código
legado se va a borrar.

---
---
# PARTE III — INFRAESTRUCTURA Y OPERACIÓN (transversal)

## III.1 Infraestructura objetivo (tras D-01, D-02 y D-03)

```
                       ┌───────────────┐
        navegador ─TLS─▶ reverse proxy │
                       └───┬───────┬───┘
                           ▼       ▼
                  ┌───────────┐  ┌──────────────┐
                  │  Next.js  │─▶│    Django    │ gunicorn · /api/v1/
                  │  SSR + SA │  └──┬────┬──────┘
                  └───────────┘     │    │ encola (puerto TaskQueue)
                     puerto         │    ▼
                  FileStorage │     │  ┌──────────┐     ┌────────────────┐
                              ▼     │  │ RabbitMQ │────▶│ celery-worker  │
                    ┌──────────────┐│  └──────────┘     └────────┬───────┘
                    │  SeaweedFS   ││                            │
                    │ master·volume│◀───────────────────────────-┘
                    │ filer· S3 gw │
                    └──────────────┘
                           ▲
                    ┌──────┴────────┐
                    │  PostgreSQL   │  datos · auditoría · resultados de tareas · caché de throttling
                    │  (EXTERNO)    │  servidor aparte, no gobernado por este compose (D-03)
                    └───────────────┘
```

**Reglas de exposición:** ningún servicio de infraestructura (SeaweedFS, RabbitMQ) publica puerto al host
ni sale a internet: viven en la red interna de Docker y solo Django los alcanza. El servicio `nestjs` y la
red `file_manager` desaparecen (D-01). PostgreSQL vive fuera y se alcanza por variable con
`sslmode=require`.

**Lo que cambia respecto de hoy:** de 4 servicios (django, nextjs, nestjs, portainer) se pasa a
6 gobernados por este compose (nextjs, django, celery-worker, rabbitmq, seaweedfs, reverse-proxy) más
PostgreSQL externo. Es más superficie de operación, y es la contra principal de D-01 y D-02 (Apéndice B).

## III.2 Contenedores y compose

| # | Tarea | Lado |
|---|---|---|
| T1.7 | **Dockerfiles de producción** multi-stage según la skill `despliegue-docker-django-nextjs`: stages `base` → `deps` → `tester` → `builder` → `runner`. El stage `tester` corre lint, typecheck y tests: **si falla, el build no llega a producción**. `gunicorn` con workers en el backend (hoy es `manage.py runserver`), `output: standalone` en Next.js, imágenes fijadas por versión (hoy `FROM node` sin fijar), usuario no root, `pnpm install --frozen-lockfile` (hoy `npm i` ignorando el lockfile). Cierra ALTA-12 | ambos |
| T1.11 | **Infraestructura declarada:** `seaweedfs` (master + volume + filer + gateway S3) y `rabbitmq` (con plugin de management), con healthcheck, volumen nombrado y credenciales por variable. **PostgreSQL no se declara como servicio de producción**; sí un `postgres` **efímero en el compose de desarrollo/CI**, sin datos reales | infra |
| T7.1 | `compose.yml` completo: healthchecks en todos los servicios, límites de recursos, `depends_on` por condición, y comprobación de conectividad a la base externa al arranque. Cierra MED-15 | infra |
| T7.2 | Reverse proxy (nginx/Traefik) con TLS, HSTS, cabeceras de seguridad y servicio de estáticos; Django deja de exponer el puerto directamente | infra |
| T7.3 | **Retirar el montaje de `/var/run/docker.sock`** o aislar Portainer de la red pública. Hoy está expuesto en 9443 con el socket montado: es escape de contenedor. Cierra ALTA-12 (definitivo) | infra |
| T7.4 | Gestión de secretos: Docker secrets o gestor externo; **ningún `.env` en el repositorio** | infra |
| T1.12 | `.dockerignore` por imagen (que no entren `node_modules`, `.next`, `test-results`, `e2e/.auth`, `storybook-static`, `.env*`) | ambos |

## III.3 Observabilidad por logs (D-04)

Tres destinos, un solo `trace_id` (contrato C-5):

| Destino | Qué registra | Se implementa en |
|---|---|---|
| Tabla `auditoria` en PostgreSQL | Evento de negocio: actor, acción, recurso, campos afectados (antes/después), `trace_id`, IP, fecha. **Append-only** | B2.8 |
| Archivo JSON rotado en el contenedor de **Django** | Detalle técnico: peticiones, errores con traza completa, tareas de Celery, accesos a documentos | B2.8 + T7.5 |
| Archivo JSON rotado en el contenedor de **Next.js** | Server actions: qué acción, con qué resultado, con el mismo `trace_id` | F2.8d + T7.5 |

El `trace_id` **nace en el frontend**, viaja en cabecera y aparece en los tres. Los errores se registran
completos en el servidor y se devuelven **genéricos** al cliente (S6).

**T7.5b — Retención y protección del log.** El log de auditoría contiene datos de personal: acceso
restringido, respaldo cifrado y **política de retención escrita** (A-06). Un log de PII sin política de
retención reproduce CRIT-10 en otro formato.

## III.4 Respaldos y alertas

| # | Tarea |
|---|---|
| T7.6 | Respaldos automatizados de **PostgreSQL, los volúmenes de SeaweedFS y las definiciones de RabbitMQ**, con **prueba de restauración documentada**. El respaldo de SeaweedFS **incluye el `filer`**: un volumen sin sus metadatos es un montón de bytes sin nombre. Recomendación: almacén de metadatos del filer **en PostgreSQL** para que entre en el mismo respaldo que la base. **Bloqueado por A-04**: no se puede certificar el respaldo de un servidor que no administramos |
| T7.7 | Alertas mínimas: tasa de 5xx, intentos de login fallidos por IP, uso de disco de los volúmenes de SeaweedFS, **profundidad de cola y tamaño de la cola de descartados en RabbitMQ**, y tareas de Celery fallidas |
| T7.8 | Runbook de despliegue y de reversión |

**Criterio de salida de la Parte III:** despliegue reproducible desde cero en un entorno limpio siguiendo
solo el runbook; restauración de respaldo verificada; ningún servicio de infraestructura alcanzable desde
fuera de la red interna.

## III.5 Integración continua: qué corre de cada lado

| Etapa | Backend | Frontend |
|---|---|---|
| 1 · Formato | `ruff format --check` / `black --check` | `prettier --check` |
| 2 · Lint | `ruff` | `eslint` (incluye `boundaries` = R1–R3, R6, R9) |
| 3 · Tipos | `mypy` | `tsc --noEmit` |
| 4 · Arquitectura | **`import-linter`** (los 6 contratos de §I.4.3) | **`eslint-plugin-boundaries`** + los greps de R15/R16 |
| 5 · Unitarios | `pytest tests/unit` (sin base de datos) | `vitest run --project=unit` |
| 6 · Integración | `pytest tests/integration` (con `postgres` efímero) | — |
| 7 · E2E | — | `playwright test` (chromium + firefox + webkit) |
| 8 · A11y | — | `playwright test accesibilidad` |
| 9 · Visual | — | `chromatic` |
| 10 · Build | imagen de producción | imagen de producción (stage `tester` incluido) |

**Greps de CI que codifican reglas** (fallan el pipeline si encuentran algo):

```bash
# S1 — AllowAny sin justificación
grep -rn "AllowAny" BACKEND/apps BACKEND/core | grep -v "# JUSTIFICADO:"
# S2 / R16 — autorización por nombre de rol (techo decreciente desde B3/F3)
grep -rn "nombre_rol\|nombre_departamento" BACKEND/apps NextJS/modules NextJS/app
# B9 — respuestas armadas a mano
grep -rn "Response({" BACKEND/apps
# R15 — variables públicas de API y .env versionados
grep -rn "NEXT_PUBLIC_DJANGO\|NEXT_PUBLIC_NEST" NextJS/ ; git ls-files | grep -E "\.env($|\.)"
# B13 / MED-07 — archivos de más de 400 líneas
find BACKEND/apps BACKEND/core NextJS/modules NextJS/shared -name '*.py' -o -name '*.ts*' | xargs wc -l | awk '$1>400'
# CRIT-10 / CRIT-11 — datos y credenciales versionadas
git ls-files | grep -E "\.sql$|wait-for-postgres\.py"
```

---
---

# PARTE IV — SECUENCIA CONJUNTA Y CRONOGRAMA

## IV.1 Dos carriles y cinco hitos de sincronización

```
        │ Fase 0 │ Fase 1 │ Fase 2 │ Fase 3 │      Fase 4       │ Fase 5 │ Fase 6 │ 7 │ 8 │ Fase 9 │
BACKEND │  B0    │  B1    │  B2    │  B3    │ B4.1 … B4.9       │  B5    │  B6    │ T7│ B8│  B9    │
FRONTEND│  F0    │  F1    │  F2    │  F3    │ F4.1 … F4.9       │  F5    │  F6    │ T7│ F8│  F9    │
        └───H-1──┴────────┴────────┴──H-2/3─┴──H-4 (por módulo)─┴──H-5───┴────────┴───┴───┴────────┘
```

| Hito | Qué sincroniza | Backend | Frontend | Regla |
|---|---|---|---|---|
| **H-1** | **Rotación de secretos en una sola ventana** | B0.1 (`SECRET_KEY`, `SIGNING_KEY`) | F0.3 (`AUTH_SECRET`, clave de server actions) | Ambas rotaciones **el mismo día, en la misma ventana** (D-08, A-05). Rotar solo una deja el sistema en un estado inconsistente: sesión válida con tokens muertos o al revés |
| **H-2** | **Login unificado** | B3.6 (refresco corregido, claims preservados, `is_active` revalidado) | F3.7 (una sola llamada) + F3.8 (`maxAge` alineado) | Se despliegan **juntos**. Si el frontend unifica antes de que el backend preserve los claims, el token rotado pierde `cedula`/`rol` |
| **H-3** | **Autorización real** | B3.3 (`HasPermission` en los 148 puntos de entrada) | F2.10 (el `apiClient` distingue 403) + F3.9 (verificación en servidor) | **F2.10 debe estar desplegado antes de B3.3.** Si no, el día que la API empiece a responder 403 el frontend lo mostrará como "sin datos" (ALTA-01) y parecerá una pérdida de información masiva |
| **H-4** | **Reapuntado por módulo** | B4.n cerrada (rutas `/api/v1/` estables) | F4.n reapunta y cierra | Por módulo, no global (D-06). El módulo antiguo sigue vivo hasta que su gemelo pasa los criterios de salida |
| **H-5** | **Archivos y tareas** | B5.6 (contrato equivalente al de NestJS) + B5.17 (`202` + `tarea_id`) | F5.2 (reapuntar las 7 llamadas) + F5.4 (consulta de estado) | **B5.6 antes de F5.2**, y NestJS no se apaga (B5.9) hasta que F5.3 confirme que no queda ninguna referencia |

## IV.2 Orden de precedencias que no se puede violar

```
B0 + F0  (H-1)
   ↓
B1 ─┬─→ B2 ─→ B3 ─┬─→ B4.1 → B4.2 → B4.3 → B4.4 → B4.5 → B4.6 → B4.7 → B4.8 → B4.9 ─→ B5 ─→ B8 ─→ B9
    │             │
F1 ─┴─→ F2 ─→ F3 ─┴─→ F4.1 → F4.2 → F4.3 → F4.4 → F4.5 → F4.6 → F4.7 → F4.8 → F4.9 ─→ F5 ─→ F8 ─→ F9
                      ↑ (cada F4.n espera a su B4.n)
B6/F6 y T7 pueden solaparse con la parte final de la Fase 4.
```

- **B0/F0 son estrictamente lo primero.** Ninguna otra tarea empieza antes.
- **F2.10 antes de B3.3** (ver H-3). Es la única precedencia cruzada dentro de la fase 3.
- **B4.1 y B4.2 antes de B4.3**: `organizacion` y `catalogos` alimentan los formularios de personal.
- **B4.3 antes de B4.4/B4.5/B4.6/B4.7**: `personal` es el dominio del que dependen los demás.
- **B5 después de toda la Fase 4**: la migración de archivos toca `personal`, `familiares`,
  `carnetizacion` y `reportes`; hacerla antes obligaría a repetirla.
- **B9/F9 al final, por decisión explícita** (D-07): requieren que los módulos ya estén delimitados para
  que el catálogo de permisos se derive de la estructura real y no de una suposición.

## IV.3 Resumen de fases y duración

| Fase | Nombre | Backend | Frontend | Duración | Cierra |
|---|---|---|---|---|---|
| 0 | Contención de seguridad | **B0.0**–B0.17 | **F0.2**, F0.3, F0.4, F0.9, F0.17 | 5–7 días | 12 críticas + 6 altas + MED-01 |
| 1 | Cimientos y contratos | B1.2–B1.15 | F1.1–F1.10 | 1–2 sem | ALTA-12/13/15/17, MED-01/11/12/14 |
| 2 | Núcleo compartido | B2.1–B2.17 | F2.8d–F2.19 | 2 sem | ALTA-01/11, CRIT-09, MED-09/10/17 |
| 3 | Identidad y autorización (piloto) | B3.1–B3.14 | F3.7–F3.14 | 2 sem | CRIT-08/12, ALTA-02/03/04/06/07/08/09, MED-05 |
| 4 | Módulos de dominio (9 sub-fases) | B4.1–B4.9 | F4.1–F4.9 | 8–12 sem | ALTA-05, MED-03/04/06/07/08/16 |
| 5 | Archivos (SeaweedFS) y tareas (RabbitMQ) | B5.1–B5.20 | F5.2–F5.6 | 4–5 sem | ALTA-05/10/16, CRIT-06/07 (definitivo), MED-11 |
| 6 | Calidad, UX y rendimiento | B6.1–B6.9 | F6.2–F6.7 | 3 sem | MED-13 |
| 7 | Despliegue y observabilidad | T7.1–T7.8 | idem | 2 sem | ALTA-12, MED-15 |
| 8 | Retiro del legado | B8.1–B8.6 | F8.2–F8.7 | 1–2 sem | MED-11 (final) |
| 9 | **Permisología por módulo** | B9.1–B9.6 | F9.5.1–F9.5.6 | 2–3 sem | MED-18; sustituye la autorización por rol |

**Total estimado: 24–33 semanas** para un equipo pequeño (2–3 personas), con los dos carriles corriendo en
paralelo. Las fases 6 y 7 pueden solaparse parcialmente con la 4 si hay capacidad; **las fases 0 a 3 son
estrictamente secuenciales**.

**Si solo hay una persona:** el orden es B0 → F0 → B1 → F1 → B2 → F2 → B3 → F3 → (B4.n → F4.n) … y la
duración se aproxima a la suma de los dos carriles, no al máximo. Conviene decirlo con claridad al
planificar: este plan supone paralelismo.

**Lo que se puede entregar antes que nada, si hace falta mostrar valor temprano:** la Fase 0 completa es
un entregable en sí mismo —cierra 12 hallazgos críticos en menos de una semana— y no depende de ninguna
decisión pendiente salvo la ventana de mantenimiento (A-05).

---
---
# PARTE V — DECISIONES TOMADAS

D-01 a D-08 se cerraron el **18-08-2026**. D-09 a D-12 salieron de leer las skills de `.claude/` contra la
arquitectura objetivo (§0.4.3). **D-13 a D-16 son de esta versión** y salieron de verificar el código: son
cuatro puntos donde seguir el plan al pie de la letra habría producido trabajo perdido o un despliegue
roto. Cada fase referencia estas decisiones por su identificador.

| # | Decisión | Lado | Estado |
|---|---|---|---|
| D-01 | Gestor de archivos: **SeaweedFS**; NestJS-Files se retira | ambos | cerrada |
| D-02 | Tareas asíncronas: **Celery con RabbitMQ**, resultados en PostgreSQL | backend | cerrada |
| D-03 | PostgreSQL: **instancia externa** en otro servidor | infra | cerrada |
| D-04 | Trazabilidad: **logs en tres destinos**, no `django-simple-history` | ambos | cerrada |
| D-05 | Cálculo del total APN: **una sola fuente autoritativa**, con verificación previa obligatoria | backend | cerrada, con A-02/A-03 pendientes |
| D-06 | Versionado de la API: **`/api/v1/` con convivencia** y obsolescencia declarada | ambos | cerrada |
| D-07 | Roles → **permisología por módulo**, al final (Fase 9) | ambos | cerrada |
| D-08 | Ventana de mantenimiento para la Fase 0 | operación | **pendiente (A-05)** |
| **D-09** | **Capa de repositorio: sí** — divergencia frente a la regla R5 de la skill | backend | nueva, cerrada |
| **D-10** | **Routers y ViewSets: uso mixto y acotado** | backend | nueva, cerrada |
| **D-11** | **Caché de throttling: PostgreSQL, con fallo cerrado** | backend | nueva, cerrada |
| **D-12** | **Herramienta de test del backend: `pytest`** | backend | cerrada |
| **D-13** | **El frontend conserva `src/`** como raíz del código | frontend | **nueva**, cerrada |
| **D-14** | **Iconos: `lucide-react`**; las plantillas de las skills se adaptan, no se copian | frontend | **nueva**, cerrada |
| **D-15** | **Zod v4 antes del primer schema nuevo**, no "en algún momento de la Fase 1" | frontend | **nueva**, cerrada |
| **D-16** | **La línea base de migraciones es requisito de entrada del plan**, no una tarea de la Fase 1 | backend | **nueva**, cerrada |

## D-01 · Gestor de archivos: SeaweedFS, y NestJS-Files se retira

**Decisión.** El almacenamiento pasa a **SeaweedFS**; la lógica del gestor se reimplementa dentro del
backend Django (B5.A); el servicio NestJS se apaga cuando la migración está verificada.

**Cómo se resuelve lo que ya existe** — son dos problemas distintos y se atacan por separado:

1. *La lógica que hace falta* (validación de MIME, normalización a 1024×768, un archivo vigente por
   carpeta, streaming con el `Content-Type` correcto) **no se descarta: se traduce** de `sharp` a `Pillow`,
   con un test de paridad que compara ambas salidas sobre las mismas imágenes (B5.2). De paso se corrigen
   dos defectos del original: la validación de MIME pasa a ser **por firma real** —hoy se confía en el
   `mimetype` que declara el cliente— y el borrado ciego de la carpeta pasa a ser un cambio de estado
   registrado.
2. *Los archivos ya guardados* se migran con un procedimiento de cuatro pasos que **en ningún momento deja
   al sistema sin poder leer un archivo**: **inventario y metadatos** (B5.3) → **migración idempotente
   verificada por `sha256`** (B5.4) → **lectura dual** mientras quede algo sin migrar, escribiendo ya solo
   en SeaweedFS (B5.5) → **retiro** del servicio, con el volumen viejo en solo lectura 90 días (B5.9).

**Interfaz elegida:** el **gateway S3** de SeaweedFS con `boto3`, no la API HTTP del filer. Razón: deja el
adaptador escrito contra un protocolo estándar, de modo que cambiar a MinIO, a S3 o a disco local sea
sustituir una clase y no reescribir el módulo; además da URLs prefirmadas sin código propio.

**Tercer problema, que apareció al revisar `Employee.profile`:** la referencia al archivo. El campo existe
y está pensado para la foto, pero guarda un nombre suelto que nadie resuelve y que la carga masiva borra
(ALTA-16). Se sustituye por **`Employee.foto` → FK a `archivo`** (B2.7d), se repuebla desde el inventario
(B5.3b) y se cierra el camino de escritura por texto libre (B5.6b + F5.2b). El resultado es que por primera
vez existe una referencia verificable entre un empleado y su imagen, que es también la condición para
poder auditar accesos y borrar de forma consistente.

**Requisito previo que no está en el repositorio:** el inventario en producción (**A-01**). Los volúmenes
no existen en desarrollo, así que hoy **no se sabe** cuántos archivos hay ni cuánto pesan. Ese dato decide
si la migración es un `manage.py` de una tarde o una campaña por lotes de varios días.

## D-02 · Tareas asíncronas: Celery con RabbitMQ como broker

**Decisión.** Se conserva **Celery** como marco de tareas —ya está en `requirements.txt`, aunque sin
configurar— y el broker es **RabbitMQ**. El backend de resultados es **PostgreSQL** vía
`django-celery-results`, **no** RabbitMQ.

Conviene precisar los términos, porque "Celery o RabbitMQ" no son alternativas entre sí: **Celery es la
biblioteca** que define tareas, las serializa, reintenta y ejecuta en un worker; **RabbitMQ es el broker**,
la cola por la que viajan los mensajes. La decisión real es *qué broker*: RabbitMQ en lugar de Redis. Se
descarta Redis no por calidad, sino porque añadiría un cuarto almacén de datos sin necesidad, y porque el
reparto con confirmación (`ack`) de RabbitMQ es exactamente lo que se quiere para tareas que escriben
expedientes de personal: si un worker muere a mitad, el mensaje **vuelve a la cola** en lugar de
desaparecer.

**Ampliación de esta versión** (§0.4.3 B-f y B-g): el patrón de despacho queda fijado como
**evento de dominio → receiver → `transaction.on_commit()` → puerto `TaskQueue`** (B22), y el contrato de
las tareas incluye recibir **IDs y nunca instancias ni archivos**, tolerar `DoesNotExist` con `warning`, y
declarar `queue`, `acks_late`, `autoretry_for`, `retry_backoff`, `max_retries` y `time_limit` (B23).

## D-03 · PostgreSQL: instancia externa en otro servidor

**Respuesta.** La base de datos **corre en un servidor aparte y no forma parte de este despliegue**. Por
eso no está en `compose.yml`, y es correcto que no esté.

| | |
|---|---|
| **Producción** | Servicio **externo**. Django se conecta por `DJANGO_DB_HOST`/`PORT`/`NAME`/`USER`/`PASSWORD`, **sin valores por defecto en el código**, con `sslmode=require` (el tráfico cruza la red entre hosts, hoy va en claro) y `connect_timeout` acotado |
| **Desarrollo y CI** | Un servicio `postgres` **efímero**, sin ningún dato real, para correr las pruebas de integración sin depender del servidor externo (B1.11) |
| **Documentación** | El servidor externo se documenta como dependencia con su runbook: host, versión, dueño, ventana de mantenimiento y procedimiento de respaldo/restauración (B8.4). No se declara como servicio |

**Consecuencias:** 7.1 solo declara SeaweedFS y RabbitMQ; y las migraciones —en particular la tabla
`archivo` y la FK `Employee.foto` (B2.7b, B2.7d)— **se coordinan con quien administra ese servidor**, con
respaldo previo tomado por ellos y ventana acordada (**A-08**). El equipo de la aplicación no controla ese
respaldo, así que no puede asumirlo.

**Y de aquí salió CRIT-11.** Al verificar cómo se conecta la aplicación se encontró que
`BACKEND/wait-for-postgres.py` —**versionado en git, y todavía presente en `HEAD` el 20-08-2026**— lleva
como valores por defecto el host real del servidor y la contraseña del usuario `postgres`. Eso es acceso
de superusuario para cualquiera que tenga el repositorio, **sin pasar por la aplicación ni por su
autorización**. Se atiende en B0.13. Es más grave que CRIT-10: aquel expone una copia de los datos, éste
expone la llave del original.

**Pendiente de operación (A-04):** versión de PostgreSQL, si existe respaldo automático y con qué
frecuencia, dónde se guarda, si alguna vez se probó una restauración, y quién es el responsable. No
bloquea el diseño; **sí bloquea T7.6** y condiciona B0.13.

## D-04 · Trazabilidad: logs, no `django-simple-history`

**Decisión.** `django-simple-history` **se retira** de `requirements.txt`. La trazabilidad se cubre con
logs en los tres destinos de §III.3.

**Qué se gana y qué se pierde, para que quede documentado:** `simple-history` guarda **una copia completa
de cada fila en cada cambio** y permite reconstruir el estado de un registro en cualquier fecha pasada; el
log de auditoría guarda **el evento** y los campos que cambiaron. El log responde "quién cambió qué y
cuándo" —que es lo que se necesita ante una auditoría— pero **no** permite reconstruir el expediente tal
como estaba hace dos años ni deshacer un cambio desde la propia base de datos. Si más adelante aparece una
obligación normativa de conservar el estado histórico completo, la vía es activar el historial **solo en
las tablas afectadas** (típicamente `Employee`, `AsigTrabajo`, `EmployeeMovementHistory`), no reabrir la
decisión.

Dos condiciones hacen que esta opción sea suficiente y no un riesgo nuevo:

- **El log tiene que ser inviolable para la aplicación:** la tabla `auditoria` no se actualiza ni se borra
  desde el código; solo se inserta. Un log que la aplicación puede editar no sirve como evidencia.
- **El log no es un vertedero de datos personales:** identificadores y códigos, nunca tokens, contraseñas,
  cuerpos completos de petición ni datos personales en texto libre (S17). Con política de retención
  escrita (T7.5b).

## D-05 · Cálculo del total APN: una sola fuente autoritativa

**Decisión.** Se acepta el criterio: **una sola implementación, y el dominio lee el valor en lugar de
recalcularlo** —es también lo que exige B18—. Pero la condición *"siempre y cuando el cálculo sea
correcto"* **no puede darse por cumplida todavía**:

| Hecho verificado | Dónde |
|---|---|
| El trigger PL/pgSQL **no aparece en ningún artefacto del repositorio**: ni en los tres volcados, ni existe ningún `migrations.RunSQL` en las cuatro apps | grep sobre los volcados y todas las migraciones |
| La columna existe y **Django nunca la escribe**: `total_anos_apn = DecimalField(max_digits=5, decimal_places=2, editable=False)` | `RAC/models/personal_models.py:482` |
| **Hoy se publican las dos cosas a la vez y pueden discrepar**: `anos_apn` (lee la columna, expuesto como `IntegerField`, lo que **trunca los decimales**) y `total_apn` (lo calcula Python en el momento) | `personal_activo_serializers.py:676,751`; `personal_pasivo_serializers.py:118,192` |
| Los consumidores están divididos: los **PDF** y los **filtros de reporte** (`apn_min`/`apn_max`) usan la columna; la **UI** muestra el cálculo de Python | `pdf/generators/employee_{active,passive}_pdf.py:195,203`; `utils/mapa_reporte.py:25,51-52` |
| Las dos representaciones **no son comparables tal cual**: la columna es un decimal de años; Python devuelve `{years, months, days}` por método comercial 30/360, **suma un día** al período y **solo cuenta antecedentes cerrados** (`fecha_egreso__isnull=False`), es decir excluye el tiempo en curso | `utils/tiempo_servicio.py` |

Por eso, antes de escribir código, en **B4.3** se ejecuta esta verificación —es un día de trabajo, no una
investigación—:

1. **Extraer el trigger de la base de producción y leerlo:**
   `SELECT p.proname, pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.proname ILIKE '%apn%';`
   y `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal;`
2. **Comparar ambos resultados sobre datos reales:** una muestra de empleados con historial variado (un
   solo antecedente, varios, uno abierto, ninguno) y una tabla de diferencias.
3. **Resolver tres preguntas de negocio con el área funcional** (A-03), porque son reglas y no
   implementación: ¿el tiempo **en curso** cuenta para el total APN? ¿cuenta el día de ingreso (el `+1` de
   Python)? ¿el valor oficial se expresa en años decimales o en años/meses/días?

Y según el resultado:

- **Si el trigger existe y su regla coincide con la decisión funcional** → se conserva como fuente
  autoritativa, la columna es el único valor publicado, se retira `calcular_total_apn()` de Python, se
  corrige `anos_apn` para que **no trunque** (decimal, no entero) y **la función SQL se versiona en una
  migración `RunSQL`** para que deje de ser conocimiento oral.
- **Si el trigger no existe, o su regla no coincide** → la fuente autoritativa pasa a ser el **servicio de
  dominio** `apps/personal/shared/domain/services/tiempo_servicio.py`, la columna se actualiza desde el
  caso de uso que escribe antecedentes, y desaparece el cálculo al vuelo en los serializers. **En ningún
  escenario quedan dos implementaciones.**

Requisito adicional: **confirmar que ninguna integración externa escribe en `antecedentes_servicio` ni en
`Employee`**. Los comandos `manage.py` de carga masiva **sí** escriben directo hoy, y por eso pasan a usar
los mismos casos de uso (B5.18).

## D-06 · Versionado de la API: qué significa `/api/v1/`

Hoy las rutas del backend son planas y en su mayoría sin prefijo de versión: `listar-estatus/`,
`Employeefamily/<id>`, `asignacion_CodigoEspecia/`. El plan crea las rutas nuevas bajo un prefijo.

- Durante la migración **las dos formas conviven**: la ruta vieja sigue respondiendo exactamente igual —el
  sistema está en producción y no se puede romper— y la nueva aparece a medida que cada módulo se migra.
- El frontend se reapunta **módulo por módulo** (H-4). **Nunca hay un día de cambio total**, y si un módulo
  sale mal se revierte solo ese módulo.
- *"Obsolescencia declarada"* significa marcar la ruta vieja como tal —`deprecated` en el esquema OpenAPI,
  cabecera `Deprecation` en la respuesta y anotación en el código— **sin dejar de funcionar** hasta que la
  Fase 8 compruebe que no tiene consumidores.
- El `v1` es la puerta para el futuro: cuando haya que cambiar la forma de una respuesta de manera
  incompatible, se publica `/api/v2/` de ese recurso.

**Lo único que hay que aceptar** es que durante la Fase 4 el árbol de URLs tenga rutas duplicadas y exista
una lista de rutas legadas que se va vaciando. La alternativa —renombrar en el sitio— obliga a cambiar
backend y frontend en el mismo despliegue por cada módulo y no permite revertir uno solo.

## D-07 · Modelo de roles → permisología por módulo

Se mantiene: la autorización pasa de rol/módulo a permisos granulares y el cambio se ejecuta **al final**
(Fase 9). Durante las fases 3 a 8 la autorización es de grano grueso —equivalente a la actual, pero **ya
impuesta en la API**—.

Queda por confirmar el **catálogo concreto de acciones por módulo** de §B9.2 con los responsables
funcionales, en particular que `personal.ver_salud` y `familiares.descargar_documento` sean permisos
separados; la recomendación es que sí, por ser los datos más sensibles del sistema (**A-07**).

**Refuerzo de esta versión:** la aparición de `RECEPCIONISTA` (§I.1.4) es la confirmación empírica de que
la decisión es correcta y de que **posponerla tiene un costo medible**: 22 literales nuevos en la UI y una
API de roles sin autorización (CRIT-12). Se añade `identidad.gestionar_roles` como permiso propio,
separado de `identidad.gestionar_usuarios`.

## D-08 · Ventana de mantenimiento para la Fase 0 — **pendiente**

La rotación de `SECRET_KEY` y `AUTH_SECRET` invalida todas las sesiones activas. Hay que acordar el momento
con operación antes de ejecutar la Fase 0 (**A-05**), y **las dos rotaciones van en la misma ventana**
(hito H-1). Es lo único que bloquea el arranque del plan.

## D-09 · Capa de repositorio: sí, aunque la skill diga que no · **nueva**

**Decisión.** Todo acceso a datos desde un caso de uso pasa por un **puerto de repositorio** definido en
`domain/ports/` e implementado en `infrastructure/repositories/` (regla **B21**).

**Qué dice la skill.** `arquitectura-onion-feature-scream` lo prohíbe explícitamente en su regla R5: *"este
proyecto no usa el patrón repository. El acceso a datos es ORM directo desde `application/` y `api/`. No la
inventes."*

**Por qué GATH se separa.** Porque las condiciones son distintas, no porque la regla esté mal:

| | FitVen (donde la regla es correcta) | GATH |
|---|---|---|
| Tests existentes | ~120, con factories y clase base | **128 líneas**; `RAC` (60 % del código) sin ninguno |
| Tamaño de los servicios | Métodos cortos, `@staticmethod` | Vistas de hasta 3.174 líneas con ORM incrustado |
| Objetivo declarado | Mantener lo que funciona | **Probar casos de uso sin base de datos** (criterio de salida de B4) |

Sin puerto, un test de caso de uso arrastra Django, la base y el esquema completo: deja de ser unitario y
tarda lo que tarde PostgreSQL. Con puerto, el test de §I.9 no importa Django en ninguna línea. **Ése es
todo el argumento**, y es el que sostiene la cobertura ≥ 80 % de B6.8.

**Coste que se acepta.** Un mapper y un repositorio por entidad —dos archivos más por módulo— y la
disciplina de no colar `Model.objects` en un caso de uso. Se compensa con que el ORM queda confinado a un
solo lugar por módulo, que es también donde vive `select_related` (MED-06).

**Dónde NO se aplica.** En lecturas de presentación puras —un listado paginado de catálogo que no tiene
ninguna regla— la vista puede consultar por el repositorio sin caso de uso intermedio. Lo que no se
permite es lo contrario: un caso de uso que toque el ORM.

## D-10 · Routers y ViewSets: uso mixto y acotado · **nueva**

**Decisión.**

| Tipo de recurso | Forma | Ejemplos |
|---|---|---|
| **Catálogo de solo lectura o CRUD mecánico** | `ViewSet` + `DefaultRouter` bajo `/api/v1/` | los ~35 endpoints de `catalogos/`, las tablas de `organizacion/` |
| **Acción de negocio** | Vista explícita (`APIView` o `@api_view`) registrada a mano, con su caso de uso | `egresar_empleado`, `prestar_cargo`, `emitir_carnet`, `cargar_personal_masivo` |

**Qué dice la skill.** Los prohíbe: *"100 % `generics.*View` + `views.APIView`. No se usa `ModelViewSet`,
`ViewSet`, ni `DefaultRouter`."*

**Por qué el uso mixto.** La regla de la skill es la correcta **para las acciones de negocio**, y ahí se
adopta sin matices: una acción que egresa a un empleado no es un `PATCH` sobre un recurso, y forzarla a un
ViewSet la vuelve ilegible. Pero GATH tiene ~35 endpoints de catálogo **prácticamente idénticos entre sí**,
y escribirlos a mano 35 veces es exactamente el problema que ya tiene (`RAC` creció así). El router
también da nombres de ruta consistentes gratis, que es lo que cierra MED-16.

**Regla práctica:** si el endpoint se describe por completo con "listar / ver / crear / editar / borrar
este recurso", va al router. Si el nombre natural del endpoint es un **verbo de negocio**, va como vista
explícita. En caso de duda, vista explícita: es más fácil pasar de vista explícita a router que al revés.

## D-11 · Caché de throttling: PostgreSQL, con fallo cerrado · **nueva**

**Decisión.** Los contadores de límite de tasa viven en **`DatabaseCache` sobre PostgreSQL**
(`python manage.py createcachetable`), no en memoria local ni en Redis.

**El problema que resuelve (ALTA-17).** `settings.py` no declara `CACHES`, así que Django usa
`LocMemCache`: cada proceso de gunicorn tiene su propio contador y todos se pierden al reiniciar. Un
límite de "5 intentos por minuto" con 4 workers **es en realidad 20 por minuto**, y un reinicio lo pone a
cero. Activar el throttling de B0.10 sin resolver esto daría una contención aparente, que es peor que
ninguna porque nadie la revisaría.

**Por qué PostgreSQL y no Redis.** D-02 evitó deliberadamente añadir Redis como cuarto almacén de datos;
para el volumen de este sistema (decenas de logins por minuto en el peor caso) una tabla de caché es de
sobra, y entra en el mismo respaldo que el resto.

**Divergencia con la skill:** `uso-librerias-backend` usa `IGNORE_EXCEPTIONS: True` para que la aplicación
siga funcionando si la caché cae ("falla abierto"). **Para contadores de seguridad se hace lo contrario:
falla cerrado.** Si el almacén de contadores no responde, un endpoint de autenticación sin límite es un
agujero, no una degradación aceptable. Si más adelante se añade caché de negocio (catálogos), *esa* sí usa
`IGNORE_EXCEPTIONS: True`, en una configuración de caché aparte.

**Nota de tests:** la suite debe aislar esta caché (§I.9), o consumirá cupos reales y dejará residuos entre
corridas.

## D-12 · Herramienta de test del backend: `pytest` · **nueva**

**Decisión.** `pytest` + `pytest-django`, con las prácticas de la skill `testing-backend-django` adoptadas
íntegras (factories por el caso de uso real, aislamiento de la caché de throttling, mocking en el punto de
entrada del servicio, un test de éxito y uno de error por invariante).

**Qué dice la skill.** *"No introduzcas pytest… el proyecto usa deliberadamente el framework nativo de
Django/DRF."* En su proyecto la razón es sólida: 120 tests ya escritos en ese estilo.

**Por qué GATH se separa.** No hay nada con lo que ser consistente (128 líneas de test, `RAC` sin
ninguno), y el criterio de salida de B4 —casos de uso probados **sin base de datos**— se expresa con menos
ceremonia en pytest: marcas para separar unitario de integración, fixtures componibles, y un
`pytest tests/unit` que corre en segundos porque no toca Django.

**Lo que no cambia:** la estructura de las pruebas y sus criterios son los de la skill. La herramienta es
el detalle; las prácticas son lo valioso.

## D-13 · El frontend conserva `src/` como raíz del código · **nueva**

**Decisión.** `modules/` y `shared/` se crean **dentro de `src/`**. Los alias de `tsconfig.json` no cambian.

**Qué dice la skill.** Su árbol de proyecto pone `modules/`, `shared/`, `app/` y `lib/` en la raíz, porque
el proyecto para el que se escribió no usa `src/`.

**Por qué GATH se separa.** Porque no es una decisión de arquitectura, es una de mudanza. Los 404 archivos
del frontend importan por `@/*`, que `tsconfig.json` resuelve a `./src/*`. Sacar el código de `src/` obliga
a reescribir el alias y a tocar cada archivo del repositorio para no ganar nada: Onion no sabe si hay una
carpeta `src` por encima. Y en un plan que ya mueve 404 archivos entre módulos, añadir un movimiento
transversal sin beneficio es la clase de cambio que hace que un `git diff` deje de ser revisable.

**Consecuencia de lectura:** en todas las plantillas y ejemplos de las skills de frontend, `shared/…` y
`modules/…` se leen como `src/shared/…` y `src/modules/…`. Es la única traducción necesaria.

## D-14 · Iconos: `lucide-react`, y las plantillas se adaptan · **nueva**

**Decisión.** La librería de iconos sigue siendo **`lucide-react`**, que es la instalada y la que usan los
componentes shadcn ya integrados. **No se instala `@phosphor-icons/react`.**

**El problema concreto (MED-24).** Todas las plantillas de `patrones-implementacion-frontend` y de
`arquitecto-scream-feature-onion` importan `{ Plus, Spinner, FloppyDisk, MagnifyingGlass }` de
`@phosphor-icons/react`. Ese paquete **no está en `package.json`**. Copiar una plantilla literal no produce
un aviso de estilo: produce un error de compilación. Y los nombres no son equivalentes uno a uno
(`FloppyDisk` → `Save`, `MagnifyingGlass` → `Search`, `Spinner` → `Loader2`).

**Regla práctica:** al usar una plantilla de la skill, se sustituye el import de iconos y se conserva todo
lo demás. La tabla de equivalencias vive en `src/shared/ui/components/README.md`, creada en F2.13, para que
nadie la reconstruya dos veces.

**Lo mismo aplica a los otros dos supuestos de las plantillas** que en GATH no se cumplen: `@/auth` (aquí es
`#/auth`, alias `#/*` → `./*`) y `shared/commons/api.ts` con `DJANGO_API_SERVER` (aquí la variable se
renombra en F1.1; hasta entonces es `NEXT_PUBLIC_DJANGO_API_URL_SERVER`).

## D-15 · Zod v4 antes del primer schema nuevo · **nueva**

**Decisión.** La subida de `zod` de `3.25.56` a **v4** se hace en **F1.9**, y F1.9 es **prerrequisito de
F2.12** (`shared/validation/`). No se escribe ni un schema nuevo en v3.

**Por qué se precisa el orden.** La versión anterior ponía la subida en la Fase 1 sin decir que bloqueaba
nada, y la creación de `shared/validation/` en la Fase 2. Si se hacen en ese orden pero con la subida
pendiente, los ~30 schemas que la Fase 4 va a escribir nacen con la API de v3 (`errorMap`, mensajes
posicionales, `z.string().date()`) y hay que reescribirlos. Es trabajo perdido evitable con una línea de
plan.

**Riesgo asumido y cómo se acota:** v4 tiene cambios de ruptura en mensajes de error y en `z.enum`. La
migración toca los schemas que ya existen en `src/app/…/schema*`, que son pocos y van a desaparecer en F8.2
de todas formas. Se hace con la suite de F1.5c ya instalada, aunque todavía casi vacía, para que al menos
los schemas migrados tengan un test de caso válido e inválido (R11).

## D-16 · La línea base de migraciones es requisito de entrada, no tarea de la Fase 1 · **nueva**

**Decisión.** Crear y versionar la línea base de migraciones es **B0.0**, la primera tarea del plan, y su
criterio de salida es parte del criterio de salida de la Fase 0.

**Por qué se mueve.** Estaba como MED-01 → B1.2, clasificada como "mala práctica media". Pero no es una
mala práctica: es una **precondición**. Sin línea base no se puede desplegar la tabla `archivo` (B2.7b), ni
la FK `Employee.foto` (B2.7d), ni mover un modelo entre apps (§I.4.7), ni crear las tablas de permisos
(B9.1), ni escribir el entrypoint que corre `migrate` (T7.1). Dejarla en la Fase 1 significa que la Fase 2
descubre el bloqueo a mitad de camino.

**Y hay un riesgo que solo desaparece haciéndola primero:** mientras no exista, cualquier `makemigrations`
ejecutado por cualquiera genera la creación completa del esquema. Aplicado por error contra la base real,
falla a mitad y deja el estado inconsistente. Es un accidente de una sola línea de comando que hoy nada
impide.

---
---

# PARTE VI — RIESGOS Y PENDIENTES

## VI.1 Riesgos y mitigación

| Riesgo | Lado | Mitigación |
|---|---|---|
| El esquema de base de datos es compartido y está en producción con datos reales | backend | La reconstrucción **no cambia el esquema**; los modelos ORM se mueven a `infrastructure/models/` sin alterar tablas (`db_table` explícito). Todo cambio de esquema (tabla `archivo`, FK `Employee.foto`, tablas de permisos) va en migración propia, revisada, con respaldo previo y ventana acordada (A-08) |
| Migraciones no versionadas hoy ⇒ riesgo al generar el estado inicial | backend | B1.2 usa `--fake-initial` contra la base existente y **valida comparando el esquema generado con el real antes de commitear** |
| Duración larga con el legado en paralelo | ambos | Estrangulamiento por módulo con `/api/v1/` conviviendo; cada sub-fase entrega valor y es reversible de forma independiente |
| Los secretos ya expuestos pueden estar comprometidos desde hace tiempo | ambos | La Fase 0 no solo purga el historial: **rota** todas las claves y fuerza el cierre de sesiones activas |
| Los volcados con datos de personal están en el historial de git desde el commit inicial | infra | La purga elimina el dato del repositorio, pero **no revoca las copias ya distribuidas**. Además de la limpieza técnica, hay que inventariar quién clonó el repositorio y evaluar si corresponde una notificación formal de incidente conforme a la política del organismo |
| **La autorización real (B3.3) puede parecer una pérdida de datos** si el frontend no distingue el 403 | ambos | Hito **H-3**: F2.10 se despliega **antes** de B3.3. Es la precedencia cruzada más fácil de olvidar y la de peor efecto visible |
| Las skills son de otros proyectos y en varios puntos contradicen este plan | ambos | §0.4.3 documenta las 8+7 divergencias, y las reglas B21–B26 / R11–R16 las convierten en verificaciones de CI. Los ejemplos se actualizan al dominio de GATH en B8.6 y F8.6 |
| **Se sigue desarrollando sobre el legado mientras el plan avanza** (como pasó con la API de roles) | ambos | F3.13 congela MED-18 con un techo decreciente en CI; y toda funcionalidad nueva a partir de B1 nace dentro de la arquitectura, no en `RAC`. Si aparece una urgencia que obligue a lo contrario, se registra como deuda con su ticket |
| Un solo nodo de SeaweedFS no da redundancia | infra | Si el objetivo es tolerancia a fallos hacen falta **≥ 2 volume servers en hosts distintos**; si no, hay que asumir explícitamente que la protección la da el respaldo (T7.6), no la replicación |
| El `filer` de SeaweedFS es un punto crítico y silencioso | infra | T7.6 obliga a respaldarlo junto con los volúmenes; recomendación adicional: metadatos del filer **en PostgreSQL** |
| RabbitMQ aplica contrapresión si se llena la memoria | infra | Límite de memoria y alerta de profundidad de cola (T7.7); las tareas **nunca** transportan archivos, solo el `archivo.id` |

## VI.2 Pendientes de respuesta externa

| # | Pendiente | Bloquea | Quién lo responde |
|---|---|---|---|
| **A-05** | **Ventana de mantenimiento para la rotación de secretos** (backend y frontend en la misma ventana) | **Fase 0 — bloquea el arranque del plan** | Operación |
| A-01 | Inventario de archivos en producción: cantidad, tamaño, huérfanos | B5.3 — dimensiona toda la migración de archivos | Operación |
| A-02 | Existencia y definición real del trigger `calcular_total_apn()` | B4.3 (D-05) | Operación / DBA |
| A-03 | Regla funcional del total APN: ¿tiempo en curso?, ¿día de ingreso?, ¿años decimales o y/m/d? | B4.3 (D-05) | Área de personal |
| A-04 | Del servidor externo de PostgreSQL: versión, existencia y frecuencia de respaldo, dónde se guarda, si se probó restaurar, y responsable | **T7.6** (no se certifica el respaldo de un servidor ajeno) y coordinación de B0.13 | Operación / dueño del servidor de BD |
| A-06 | Retención acordada del log de auditoría y del volumen viejo de archivos | B5.9 y T7.5b | Seguridad de la información |
| A-07 | Catálogo de permisos por módulo (§B9.2), en particular si `personal.ver_salud` y `familiares.descargar_documento` son permisos separados | Fase 9 | Responsables funcionales |
| A-08 | Ventana acordada con el dueño del servidor de BD para las migraciones de `archivo` y `Employee.foto`, con respaldo previo tomado por ellos | B2.7b y B2.7d | Operación / dueño del servidor de BD |
| **A-09** | **Alcance de la exposición de CRIT-10 y CRIT-11**: quién clonó el repositorio y desde cuándo; si corresponde notificación formal de incidente | Cierre documental de la Fase 0 | Seguridad de la información / dirección |
| **A-10** | **Quién administra los roles** hoy y con qué criterio, para poder sembrar `RolPermiso` en B9.3.2 sin cambiar accesos | B9.3.2 | Responsables funcionales |

---
---
# APÉNDICE A — Reglas de validación de arquitectura (consolidado)

## A.1 Frontend — R1–R16

R1 `domain/` no importa de capas externas · R2 `application/` solo importa de `domain/` ·
R3 `ui/` no importa de `infrastructure/` · R4 casos de uso reciben el repositorio por parámetro ·
R5 la UI recibe DTOs, no entidades · R6 sin rutas relativas de más de 2 niveles ·
R7 toda server action captura y llama `handleSessionExpired` · R8 toda operación asíncrona en UI usa
`useTransition` · R9 archivos en kebab-case · R10 las páginas de `app/` son thin wrappers ·
**R11** test unitario junto a cada caso de uso, schema y componente presentacional, en el mismo commit ·
**R12** story para cada componente compartido con más de una variante visual ·
**R13** caso de accesibilidad para cada ruta nueva ·
**R14** `eslint-config-prettier` al final del array y `format:check` en 0 diffs ·
**R15** sin `NEXT_PUBLIC_` para la API y sin `.env` en el repositorio ·
**R16** ninguna decisión de acceso por nombre de rol o departamento.

<small>R1–R10 provienen de la skill `arquitecto-scream-feature-onion`. R11–R16 se añaden en este plan:
R11 de `testing-unit-vitest`, R12 de `storybook-chromatic`, R13 de `testing-a11y-axe`, R14 de
`formato-prettier`, y R15/R16 de la auditoría (ALTA-15, CRIT-03, MED-18).</small>

## A.2 Backend — B1–B26

Ver la tabla completa con el método de verificación de cada una en §I.7.1. Las de mayor impacto:

- **B1** `domain/` no importa Django, DRF ni ORM.
- **B4** los casos de uso reciben el repositorio por inyección; nunca importan `models`.
- **B7** las views no acceden al ORM; solo invocan casos de uso.
- **B9** ninguna respuesta se arma a mano: siempre por `envelope`.
- **B13** ningún archivo supera 400 líneas.
- **B16** un módulo nunca importa de otro módulo; lo transversal vive en `core/`.
- **B17** `utils/` y `services/` no contienen reglas de negocio.
- **B18** ninguna regla implementada a la vez en Python y en la base de datos.
- **B19** ningún módulo accede al almacenamiento por ruta: solo por `archivo.id` a través de `FileStorage`.
- **B20** ningún caso de uso importa Celery: se encola por el puerto `TaskQueue`.
- **B21** todo acceso a datos desde un caso de uso pasa por un puerto de repositorio (D-09).
- **B22** ningún despacho de tarea dentro de una transacción abierta: `transaction.on_commit()`.
- **B23** las tareas reciben IDs, declaran su cola y su política de reintento, y toleran filas borradas.
- **B24/B25** contrato de esquema OpenAPI (`extend_schema`, `extend_schema_field`, `ENUM_NAME_OVERRIDES`,
  guard `swagger_fake_view`).
- **B26** cada app con su `models.py` de re-export y su `AppConfig`.

<small>B1–B20 provienen del plan original y de las skills `.opencode`. B21–B26 se añaden en esta versión:
B21 por D-09, B22/B23 de `arquitectura-onion-feature-scream` y `uso-librerias-backend`, B24/B25 de
`patrones-drf-implementacion`, B26 del truco de `models.py` de la skill de arquitectura.</small>

## A.3 Seguridad — S1–S19

Ver §I.7.2 para el listado completo. Las que se verifican con grep en CI están en §III.5.

- **S1** ningún endpoint sin `permission_classes` explícitas; `AllowAny` con justificación escrita.
- **S2** ninguna autorización por comparación de nombre de rol.
- **S3** ningún secreto en el código ni en el repositorio.
- **S6** ninguna respuesta de error contiene `str(exception)`.
- **S9/S16** ningún archivo servido sin autorización ni con identificador adivinable.
- **S12** todo endpoint de autenticación con límite de tasa sobre un contador compartido y persistente.
- **S17** ningún log con tokens, contraseñas, cuerpos completos ni datos personales en texto libre.
- **S18** prohibido `StringRelatedField` (o cualquier serialización vía `__str__`) en serializers
  alcanzables sin autenticación.
- **S19** ningún borrado de rol, permiso o módulo con dependientes: 409 y auditoría del intento.

---

# APÉNDICE B — Informe: beneficios y contras de SeaweedFS y RabbitMQ

Evaluación de las dos herramientas **en el contexto concreto de GATH**, no en abstracto. El dato que falta
para cerrar la evaluación de SeaweedFS es el volumen real de archivos (A-01).

## B.1 SeaweedFS como gestor de archivos

**A favor**

| Beneficio | Por qué aplica aquí |
|---|---|
| Diseñado para **muchos archivos pequeños** | Es exactamente el perfil del sistema: fotos de carnet de ~100–300 KB, una por persona, más documentos familiares en PDF. SeaweedFS guarda los metadatos en memoria y resuelve una lectura con **un solo acceso a disco**; un sistema de ficheros clásico degrada cuando un directorio acumula decenas de miles de entradas |
| **Gateway S3** | Permite hablar un protocolo estándar con `boto3`/`django-storages`. El adaptador queda intercambiable: mañana MinIO, S3 o disco local sin tocar el dominio (B19). Es el mayor beneficio arquitectónico y **no depende del volumen de datos** |
| **URLs prefirmadas** de serie | Resuelve CRIT-07 y CRIT-06 sin escribir un esquema propio de firmas |
| **Replicación configurable** y TTL por archivo | Da una respuesta operativa a "¿qué pasa si se pierde un disco?" y permite expirar automáticamente artefactos temporales (reportes generados) |
| Huella pequeña: un binario en Go, sin JVM ni dependencias externas | Realista para el equipo y el hardware disponible; más ligero de operar que HDFS o Ceph |
| Desacopla el almacenamiento del ciclo de vida de los contenedores | Hoy los archivos viven en rutas del host montadas a mano; un `docker compose down -v` mal ejecutado o un cambio de host son un riesgo real |

**En contra**

| Contra | Mitigación en el plan |
|---|---|
| **Es un componente más que operar**: master, volume server, filer y gateway S3 — cuatro procesos con su propia configuración | Se declara en el compose desde T1.11, meses antes de depender de él, para que la operación se aprenda sin presión. Un solo nodo con los cuatro roles es suficiente al inicio |
| **Sobredimensionado para el volumen actual.** Si el inventario (A-01) arroja unos pocos miles de archivos y menos de 10 GB, un `FileField` de Django sobre un volumen respaldado cubriría el caso con cero componentes nuevos. **Este es el punto que hay que aceptar de forma consciente**: la decisión se justifica por el gateway S3 y el camino de crecimiento, no por el tamaño de hoy | El puerto `FileStorage` deja la puerta abierta: si se decidiera lo contrario, cambiar de adaptador es una clase, no una reescritura |
| **Un nodo único no da redundancia.** Configurar `replication` con un solo volume server no protege de nada | Si el objetivo es tolerancia a fallos, hacen falta **≥ 2 volume servers en hosts distintos**; si no, asumir explícitamente que la protección la da el respaldo (T7.6) |
| **El `filer` es un punto crítico y silencioso**: guarda la relación nombre → archivo. Perderlo deja los bytes sin manera de encontrarlos | T7.6 obliga a respaldar el filer junto con los volúmenes. Recomendación adicional: **metadatos del filer en PostgreSQL** en lugar del embebido por defecto |
| Comunidad y documentación menores que MinIO o S3 | El adaptador S3 reduce el riesgo de quedar atrapado: la salida hacia MinIO es un cambio de credenciales y de endpoint |
| El gateway S3 tiene su propia gestión de identidades y claves | Entra en la gestión de secretos de T7.4; SeaweedFS no se expone a internet (B5.8) |

**Alternativas descartadas y por qué:** *Django `FileField` sobre volumen* — la más simple, pero no da API
de objetos ni URLs firmadas y mantiene el acoplamiento a rutas del host. *MinIO* — funcionalmente el
competidor directo y con mejor documentación, pero su rendimiento con muchos archivos muy pequeños es menos
favorable y su licenciamiento ha cambiado en años recientes. *S3 gestionado* — descartado por tratarse de
datos de personal de un organismo público, que deben permanecer en infraestructura propia.

## B.2 RabbitMQ como broker de Celery

**A favor**

| Beneficio | Por qué aplica aquí |
|---|---|
| **Confirmación de entrega (`ack`) y reencolado** | Es la propiedad decisiva: las tareas escriben expedientes de personal. Con `acks_late=True`, si el worker muere a mitad de una carga masiva el mensaje **vuelve a la cola** en lugar de perderse |
| **Colas durables persistidas en disco** | Un reinicio del broker no borra el trabajo pendiente |
| **Enrutamiento real** (exchanges, colas por tipo de trabajo) | Permite la topología de B5.15: los PDF pesados no bloquean la normalización de imágenes ni la carga de Excel |
| **Cola de descartados** nativa | Lo que agota reintentos queda visible para revisión en lugar de desaparecer en un log |
| **Interfaz de administración** | Profundidad de cola, consumidores y mensajes fallidos observables sin instrumentar nada; alimenta las alertas de T7.7 |
| Es el **transporte de referencia de Celery** | La combinación mejor probada y documentada |

**En contra**

| Contra | Mitigación en el plan |
|---|---|
| **Componente con estado más que operar**, con conceptos propios (exchange, binding, prefetch, marca de agua de memoria) | Se levanta en T1.11 para practicar; la topología se declara explícita y por escrito en B5.15 |
| **Más pesado que Redis** en memoria y arranque; requiere Erlang en la imagen | Irrelevante al volumen esperado (decenas de tareas al día, no miles por segundo) |
| **Mal backend de resultados** | Ya resuelto en D-02: los resultados van a PostgreSQL con `django-celery-results` |
| Si se llena la memoria, **aplica contrapresión y bloquea a los publicadores** | Límite de memoria y alerta de profundidad de cola (T7.7); **regla práctica: nunca pasar un Excel de 20 MB como argumento de la tarea** (B23) |
| Las colas espejadas clásicas están en desuso; lo actual son **colas quorum** | Declarar `x-queue-type: quorum` y verificar el soporte en la versión de Celery que se fije (B1.8) |
| Un servicio adicional que respaldar y actualizar | T7.6 incluye las definiciones (`definitions.json`); el contenido de las colas es transitorio |

**Alternativas descartadas y por qué:** *Redis como broker* — más simple y ligero, pero añadiría un cuarto
almacén de datos y su modelo de entrega es menos estricto para trabajo que modifica expedientes. *Cola
sobre PostgreSQL* (`django-tasks`, `procrastinate`) — cero componentes nuevos y suficiente para el volumen
actual; se descarta porque no ofrece enrutamiento por tipo de trabajo ni observabilidad de cola, y porque
mezcla la carga transaccional del expediente con la de la cola en la misma base.

## B.3 Lectura conjunta

Ambas decisiones **aumentan la superficie de operación** y esa es la contra principal y común a las dos. Se
justifican porque resuelven problemas que el sistema **ya tiene**, no problemas hipotéticos:

- SeaweedFS + el puerto `FileStorage` cierra CRIT-06 y CRIT-07 (archivos personales accesibles sin
  autenticación) y elimina el segundo gestor de archivos y su red aparte.
- Celery + RabbitMQ saca del ciclo de petición cuatro cargas de Excel sin límite y cinco generadores de PDF
  que hoy pueden agotar la memoria del proceso (ALTA-10).

Las tres condiciones que hacen que el resultado sea mejor y no solo más grande: **(1)** ambos quedan detrás
de un puerto del dominio, de modo que son reemplazables; **(2)** ninguno se expone a internet; **(3)** ambos
entran en el respaldo con restauración probada —el filer incluido— antes de que se apague el almacenamiento
viejo.

---

# APÉNDICE C — Matriz hallazgo → lado → fase → tarea

| Hallazgo | Lado | Fase | Tarea(s) | Estado al 20-08-2026 |
|---|---|---|---|---|
| CRIT-01 `SECRET_KEY` en código | B | 0 | B0.1 | abierto |
| CRIT-02 `DEBUG = True` | B (+F) | 0 | B0.2, F0.17 | abierto |
| CRIT-03 secretos versionados | F | 0 | F0.3 | **abierto — los `.env` siguen en `git ls-files`** |
| CRIT-04 cambio de contraseña sin auth | B | 0 | B0.4 | abierto |
| CRIT-05 registro con rol elegible | B | 0 | B0.5 | abierto |
| CRIT-06 documentos familiares sin auth | B | 0 → 5 | B0.6, B5.8 | abierto |
| CRIT-07 `MEDIA_ROOT` público | B | 0 → 5 | B0.7, B5.8 | abierto |
| CRIT-08 control de acceso roto | B | 0 → 3 | B0.8, B3.3 | abierto |
| CRIT-09 mezcla de sesiones | F | 0 → 2 | F0.9, F2.10 | abierto |
| CRIT-10 volcados de BD en git | infra | 0 | B0.12 | **abierto — siguen versionados** |
| CRIT-11 credenciales de BD en git | infra | 0 | B0.13 | **abierto — sigue en `HEAD`** |
| **CRIT-12 API de roles sin permiso** | B | 0 → 3 | B0.15, B3.3 | **nuevo (19-08-2026)** |
| ALTA-01 `response.ok` no verificado | F | 2 | F2.10 | abierto |
| ALTA-02 IDOR en cambio de contraseña | F | 0 | F0.4 | abierto |
| ALTA-03 doble autenticación en login | ambos | 3 | F3.7 (+B3.6) | abierto |
| ALTA-04 sin límite de tasa | B | 0 → 3 | B0.10, B3.12 | abierto |
| ALTA-05 validar-carnet expone expediente | B | 4 | B4.8 | abierto |
| ALTA-06 gestión de usuarios sin permiso | B | 3 | B3.5 | abierto |
| ALTA-07 autogestión sin propiedad | B | 3 | B3.4 | abierto |
| ALTA-08 refresco de token roto | B | 3 | B3.6 | abierto |
| ALTA-09 `maxAge` desalineado | F | 3 | F3.8 | abierto |
| ALTA-10 carga de archivos sin límite | ambos | 1 → 2/5 | F1.10, B2.7, B5.2 | abierto |
| ALTA-11 errores que filtran internos | B | 2 | B2.4 | abierto |
| ALTA-12 Docker de desarrollo en producción | infra | 1 → 7 | T1.7, T7.3 | abierto |
| ALTA-13 cabeceras de seguridad ausentes | B | 1 | B1.3 | abierto |
| ALTA-14 esquema y admin públicos | B | 0 | B0.11 | abierto |
| ALTA-15 URL de API en el bundle | F | 1 | F1.1 | abierto |
| ALTA-16 carga masiva borra la foto | B | 0 → 5 | B0.14, B5.3b, B5.6b, F5.2b | abierto |
| **ALTA-17 throttling sin backend de caché** | B | 0 | B0.10 (D-11) | **nuevo** |
| MED-01 migraciones no versionadas | B | 1 | B1.2 | abierto |
| MED-03 `import *` | B | 4 | checklist §I.8 | abierto |
| MED-04 IDs mágicos | B | 4 | checklist §I.8 | abierto |
| MED-05 `qs[:10]` | B | 3 | B3.5 | abierto |
| MED-06 N+1 y paginación | B | 4 → 6 | §I.8, B6.5 | abierto |
| MED-07 archivos > 400 líneas (34) | F | 4 | §II.8 | abierto |
| MED-08 rutas accidentales | F | 4 | §II.8 | abierto |
| MED-09 god-files de tipos y fetchers | F | 2 → 4 | F2.14, §II.8 | abierto |
| MED-10 directorios superpuestos | F | 2 | F2.9 | abierto |
| MED-11 dependencias muertas | ambos | 1 → 8 | B1.8, F1.8 | abierto |
| MED-12 `next-auth` beta y `zod` v3 | F | 1 | F1.9 | abierto |
| MED-13 sin tests ni CI | ambos | 1 → 6 | B1.4/F1.5c/F1.6, B6.1, F6.2 | abierto |
| MED-14 settings inconsistentes | B | 1 | B1.3 | abierto |
| MED-15 compose incompleto | infra | 7 | T7.1 | abierto |
| MED-16 nomenclatura de URLs | B | 4 | §I.8 | abierto |
| MED-17 sobre armado a mano ×148 | B | 2 | B2.3 | abierto |
| **MED-18 hardcodeo de roles en la UI** | F | 3 → 9 | F3.13, F9.5.2 | **nuevo (crece)** |

---

# APÉNDICE D — Las 18 skills en detalle: qué usar de cada una y cuándo

## D.1 Backend

| Skill | Se consulta al… | Lo más valioso que aporta | Cuidado con |
|---|---|---|---|
| `arquitectura-onion-feature-scream` | crear cualquier módulo, decidir dónde vive un archivo | Árbol de decisión "¿dónde va esta lógica?", truco de `models.py`, patrón evento→receiver→`on_commit` | Su **R5** prohíbe el repositorio; GATH lo usa (D-09). Su capa se llama `api/`; aquí es `presentation/` |
| `patrones-drf-implementacion` | escribir un endpoint, un serializer o documentar el esquema | Separar serializer de lectura y de escritura, `@extend_schema_field`, guard `swagger_fake_view`, `_padre_o_404`, `MensajeRespuestaSerializer` | Prohíbe routers; GATH los usa de forma acotada (D-10) |
| `autenticacion-permisos-jwt` | tocar login, refresco, cookies o permisos | Helpers de cookie `HttpOnly`, permisos componibles con `\|`, y la **advertencia sobre claims de rol desactualizados** que justifica `permisos_version` | Su modelo de usuario es otro; no copiar campos |
| `uso-librerias-backend` | configurar Celery, caché, CORS, hashers o drf-spectacular | Firma canónica de una tarea, `ENUM_NAME_OVERRIDES`, Argon2 primero, criterio de fallo abierto en caché | Su broker es Redis (GATH: RabbitMQ) y su caché falla abierto (GATH: cerrado para contadores de seguridad, D-11) |
| `testing-backend-django` | escribir cualquier test de backend | Factories que pasan por el servicio real, aislamiento de la caché de throttling, mocking en el punto de entrada | Prohíbe pytest; GATH lo usa (D-12) |
| `integracion-bd-recaudacion` | leer una base ajena o de solo lectura | Plantilla completa: router por módulo, `managed=False`, `allow_migrate=False`, rol SQL restringido, degradación a 503 | No aplica tal cual: la base de GATH es propia. Se usa para fuentes legadas (§I.4.6) |

## D.2 Frontend

| Skill | Se consulta al… | Lo más valioso que aporta | Cuidado con |
|---|---|---|---|
| `arquitecto-scream-feature-onion` | crear un módulo o una feature | Los 16 pasos de creación, el mapa de flujo de datos, las 13 plantillas, R1–R10 | Su regla de `.env` versionado **no aplica** (CRIT-03). Sus módulos de ejemplo no existen aquí |
| `patrones-implementacion-frontend` | construir un formulario, una tabla, un estado de carga o un reporte | Wrappers de campo, `DireccionAdminSelects` (los 4 selects en cascada), `CedulaSearch`, los 5 patrones de carga, proxy de PDF | Sus ejemplos de permisos asumen el modelo de la Fase 9: hasta entonces se usa el helper `puede()` |
| `validacion-input-protegido` | escribir un schema Zod o validar entrada en el servidor | Regla "no al hardcodeo", regex y mensajes centralizados, casos borde de la cédula, plantilla zero-trust con `safeParse` | Plantillas en Zod v4: migrar antes (F1.9) |
| `testing-e2e-playwright` | cerrar un módulo | Fixture de login con `storageState`, Page Object genérico, spec CRUD, regla "módulo nuevo ⇒ E2E nuevo" | El mapa módulo→ruta es de otro proyecto |
| `testing-unit-vitest` | escribir un test unitario | **Qué NO se puede testear** (server actions, Server Components async) y por qué; plantillas de caso de uso con repo falso y de `apiClient` con MSW | `--project=unit` siempre |
| `storybook-chromatic` | añadir un componente compartido | Stories junto al componente, plantilla `Meta`/`StoryObj`, flujo de regresión visual | **Verificar cuál es el tema por defecto de GATH** antes de copiar la configuración de temas |
| `testing-a11y-axe` | añadir una ruta | Patrón con `base`/`authTest`, qué hacer con una violación real | No reusar el nombre `test` para las dos instancias |
| `formato-prettier` | configurar el formato | `eslint-config-prettier` al final, orden `eslint --fix` → `prettier --write`, `format:check` como puerta | — |
| `despliegue-docker-django-nextjs` | escribir Dockerfiles o compose | Stages `base`/`deps`/`tester`/`builder`/`runner`, `.dockerignore`, entrypoint | Su compose incluye Redis y PostgreSQL; en GATH el broker es RabbitMQ y la base es externa |
| `design-taste-frontend` | revisar el sistema visual | Disciplina de layout, calibración de color, patrones prohibidos | Está escrita para páginas de marketing: en un sistema de gestión pesa más la densidad de datos que el impacto visual |
| `mobile-first-design` | revisar responsividad | Breakpoints, 48 px de objetivo táctil, tablas responsivas | — |
| `animaciones-frontend` | añadir una animación | Árbol de decisión entre librerías, `prefers-reduced-motion` | Una sola librería de animación por componente; el proyecto ya arrastra dependencias de sobra |

---

# APÉNDICE E — Trazabilidad con la versión anterior del plan

Toda tarea conserva su número; cambia el prefijo y la ubicación en el documento.

| Versión anterior | En esta versión | Nota |
|---|---|---|
| §1 Estado actual | §0.1, §0.2, §I.1, §II.1 | dividido por lado |
| §1.4 Lógica backend | §I.1.2 | — |
| §1.5 Lógica frontend | §II.1.1, §II.1.2 | — |
| §1.6 Autenticación | §I.1.3 (backend) + §II.1.3 (frontend) | dividido; el contrato conjunto está en C-2 |
| §1.7 Archivos | §I.1.5 (backend + inventario) + §II.1.5 (los 7 consumidores) | dividido |
| §2 Diagnóstico | §I.2 + §II.2 | dividido |
| §2.1 Inventario R-01…R-12 | §I.2.2 | ahora con la columna "se mueve en" |
| §3 Auditoría | §I.3 + §II.3 + §0.6 | dividido; +CRIT-12, +ALTA-17, +MED-18 |
| §4 Arquitectura objetivo | §0.3 (común) + §I.4 + §II.4 | +plantillas de archivo en ambos lados |
| §4.5 Infraestructura | §III.1 | — |
| §5 Mapa de migración | §I.5 + §II.5 | +columna de gemela |
| Fase 0 (0.1…0.14) | B0.1…B0.14 + F0.3/F0.4/F0.9 | +B0.15 (CRIT-12), +B0.16, +F0.17 |
| Fase 1 (1.1…1.12) | B1.2…B1.12 + F1.1/F1.5/F1.6…F1.10 + T1.7/T1.11 | +B1.13/14/15, +F1.5b/c/d |
| Fase 2 (2.1…2.14) | B2.1…B2.8c + F2.8d…F2.14 | +B2.15/16/17, +F2.18/19 |
| Fase 3 (3.1…3.12) | B3.1…B3.12 + F3.7…F3.11 | +B3.13/14, +F3.13/14 |
| Fase 4 (4.1…4.9) | B4.1…B4.9 + F4.1…F4.9 | checklists separados en §I.8 y §II.8 |
| Fase 5 (5.1…5.19) | B5.1…B5.19 + F5.2…F5.5 | +B5.20, +F5.6 |
| Fase 6 (6.1…6.7) | B6.1/B6.5 + F6.2…F6.7 | +B6.8/9, +F6.2b/c/d |
| Fase 7 (7.1…7.8) | T7.1…T7.8 (Parte III) | transversal |
| Fase 8 (8.1…8.6) | B8.1…B8.6 + F8.2/F8.3/F8.6 | +F8.7 |
| Fase 9 (9.1…9.6) | B9.1…B9.6 + F9.5.1…F9.5.5 | +F9.5.6; +`identidad.gestionar_roles` |
| §6.1 Resumen de fases | §IV.3 | +carriles y hitos |
| §7 Skills de soporte | §0.4 + Apéndice D | de 10 skills `.opencode` a 18 skills `.claude`, con reconciliación |
| §8.1 Riesgos | §VI.1 | +2 riesgos nuevos |
| §8.2 Decisiones D-01…D-08 | Parte V | +D-09…D-12 |
| §8.3 Pendientes A-01…A-08 | §VI.2 | +A-09, A-10 |
| Apéndice A | Apéndice A | +R11–R16, +B21–B26, +S18–S19 |
| Apéndice B | Apéndice B | sin cambios de fondo |
| — | Apéndice C | nuevo: matriz hallazgo→lado→fase→tarea |
| — | Apéndice D | nuevo: guía de uso de las 18 skills |
| — | Apéndice E | esta tabla |

**Fin del documento.** Última actualización: 2026-08-20. Rama `dev`.
