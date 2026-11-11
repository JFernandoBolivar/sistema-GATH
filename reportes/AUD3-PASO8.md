# AUD3 PASO 8 — Simplicidad y despliegue

**Skills usadas:** `ponytail-audit` (simplicidad) y
`despliegue-docker-django-nextjs` (solo reporte; el plan excluye tocar
Docker/compose).

## Resumen

No se borró nada: el plan pide **confirmar antes de borrar** y el árbol tiene
trabajo de otros agentes. Se deja la lista de código muerto confirmada por
`grep` (41 archivos del frontend y 3 casos de uso del backend) y las
duplicaciones que conviene unificar. En despliegue, el hallazgo principal es
que el contenedor de Django corre como **root** y que las dependencias no están
fijadas.

## Código muerto confirmado (no borrado)

### Frontend (41 archivos sin ninguna referencia)

| Grupo | Archivos |
| ----- | -------- |
| Pantallas sustituidas por la Consola O51 | `carnetizacion/ui/carnetizacion-page.tsx`, `ui/views/buscar-personal-view.tsx`, `ui/views/emitir-carnet-view.tsx`, `ui/components/generar-form-fields.tsx` |
| Organización antigua | `organizacion/ui/organizacion-{dependencias,direcciones-generales,direcciones-linea,coordinaciones}-page.tsx` y `{dependencia,direccion-linea,coordinacion,organismo}-admin.tsx` (las rutas de `app/` redirigen a `/organizacion` o usan `organizacion-page`) |
| Otras pantallas | `autogestion/ui/inicio/autogestion-inicio.tsx`, `reportes/ui/reportes-page.tsx`, `pasivos/ui/editar-pasivo-dialog.tsx`, `personal/ui/expediente-campos.tsx` |
| Value objects sin uso | `autogestion/.../respuesta-texto-censo-vo.ts`, `cargos/.../{codigo-nomina,estado-cargo}-vo.ts`, `carnetizacion/.../{estado-carnet,security-hash-carnet}-vo.ts`, `catalogos/.../codigo-catalogo-vo.ts`, `familiares/.../nombre-persona-vo.ts`, `movimientos/.../{codigo-puesto,tipo-movimiento}-vo.ts`, `organizacion/.../nombre-unidad-vo.ts`, `pasivos/.../motivo-egreso-vo.ts`, `personal/.../{cedula-empleado,telefono-empleado}-vo.ts` |
| Utilidades legadas | `components/form-check.tsx`, `components/form-text-area.tsx`, `constants/fileSize.ts`, `hooks/use-search-params.ts`, `lib/action-utils.ts`, `lib/types/{codigo,hr}.ts`, `shared/infrastructure/http/blob-utils.ts`, `shared/schemas/employees/register/schema-{basic-info,family_employee}.ts`, `autogestion/infrastructure/repositories/repo-autogestion-api.ts` |

**Cómo se confirmó:** búsqueda de cualquier `import … from '…/<nombre>'` o
`import('…/<nombre>')` en todo `src/` (incluidos barriles y tests). No se
encontró ninguna.

### Backend

- `autogestion/application/use_cases/{consultar_censo,listar_preguntas,reporte_censo}.py`
  (PASO 1, 01-03): las vistas de censo usan el repositorio porque el JSON que
  consume el frontend no coincide con sus DTO.
- `core/infrastructure/error_utils.py::extract_first_error`: la propia cabecera
  del módulo dice que no tiene call-sites en producción.

**Recomendación:** rama `chore/dead-code` con `tsc`, `eslint`, `vitest` y
`next build`; borrar por grupos (primero las pantallas O51/organización, luego
los VO). No se hace esta noche para no mezclar con trabajo en curso.

## Duplicación y sobreingeniería

| ID | Hallazgo | Estado |
| -- | -------- | ------ |
| P8-01 | Dos árboles de componentes (`src/components` 76 / `src/shared/ui` 80) y dos `lib` | Decisión AUD3-02-02 |
| P8-02 | `src/lib/api-client.ts` (legado) sigue importado por 13 archivos, casi todos pruebas de paridad; el cliente canónico es `shared/infrastructure/http/fetcher-api.ts` | Documentado: retirar cuando migren las pruebas PBAC |
| P8-03 | `carga-masiva` tiene adaptadores fuera de `repositories/` (`analisis.py`, `aplicacion.py`, `consultas_carga.py`, `exportacion_resultados.py`) | Decisión AUD3-01-04 |
| P8-04 | `requirements.txt` mezcla dependencias de desarrollo y producción y deja 7 sin fijar | Decisión AUD3-01-02 |
| P8-05 | Prettier: 1192 archivos sin formatear | Decisión AUD3-02-03 |

## Despliegue (solo reporte)

| ID | Hallazgo | Recomendación |
| -- | -------- | ------------- |
| P8-06 | `BACKEND/django.dockerfile` no declara `USER`: gunicorn corre como **root** | Crear usuario sin privilegios y `USER app` en la etapa final; ajustar permisos de `logs/` y del volumen de estáticos |
| P8-07 | `pip install -r requirements.txt` sin versiones fijas | Fijar (`pip-compile`/`pip freeze`) en la misma tarea que `requirements-dev.txt` |
| P8-08 | `compose.yml` no aplica `read_only`, `cap_drop` ni límites de CPU/memoria al `django` (solo rabbit/redis tienen límite de memoria) | Endurecer el servicio en el servidor: `read_only` con volúmenes de escritura, `cap_drop: [ALL]`, límites |
| P8-09 | `portainer/portainer-ce:latest` y otras imágenes con etiqueta flotante (`redis:7.4-alpine`, `rabbitmq:3.13-management-alpine`) | Fijar digest o versión exacta |
| P8-10 | Puertos publicados: `django` `${PUERTO_DJANGO:-8001}:8000` y `nextjs` `${PUERTO_NEXTJS:-3001}:3000` | En producción, publicar solo el proxy (nginx) y dejar Django/Next en la red interna |
| P8-11 | Secretos por variables de entorno con **fallo cerrado** (`:?`) y `portainer` solo en `127.0.0.1` | Correcto: mantener; rotar `SECRET_KEY`/`JWT_SIGNING_KEY`/claves de integración en la ventana coordinada (D-08) |
| P8-12 | `NextJS/nextjs.dockerfile` multi-stage con `USER nextjs` | Correcto: sirve de modelo para el backend |

## Verificación de este paso

- Sin cambios de código: `tsc`, `eslint`, `vitest` y `next build` no se ven
  afectados.
- El listado de código muerto se verificó con `grep` de imports (no con
  heurísticas de tamaño).
