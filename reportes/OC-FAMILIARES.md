# OC — Familiares: registro, actualización y consulta (11–12/11/2026)

**Rama:** `feature/fe-de-vida-pasivos` · **Sin commit** (lo hace el coordinador).
**Alcance:** `BACKEND/apps/familiares`, `NextJS/src/modules/familiares` y las
páginas `src/app/(app)/familiares/*`. Para el punto 7 se tocó también la regla
compartida en `apps/autogestion` (lector de la ficha) que usa la fe de vida.
**No se tocó** `carnetizacion`, `GATH/settings.py` ni `configuracion`.

> Verificación con una base de pruebas propia (`DJANGO_DB_NAME=GATH-OC-FAM`,
> `test_GATH-OC-FAM`) para no chocar con las corridas simultáneas de otros
> agentes sobre `test_GATH-PRODUCT`. Mismos settings y mismas pruebas.

---

## 1. «Hay 2 datos por corregir» sin campos en rojo

### Causa

El frontend arma el cuerpo del alta con los campos opcionales en `null`:

- `NextJS/src/modules/familiares/infrastructure/repositories/repo-familiares-api.ts`
  envía `segundo_nombre: data.segundoNombre` y `segundo_apellido: data.segundoApellido`.
- `familiarSchema` (`NextJS/src/modules/familiares/ui/schema/schema-familiar.ts`)
  deja ambos como `null` cuando el usuario no los llena.

En el backend esos dos campos eran `CharField(required=False, allow_blank=True)`
**sin `allow_null`** (`BACKEND/apps/familiares/presentation/serializers/familiares_serializers.py`).
DRF rechaza un `null` explícito con «This field may not be null.» por cada uno:
dos errores. El manejador central los resume como
«Hay 2 datos por corregir. Revise los campos marcados en rojo.»
(`BACKEND/core/presentation/exception_handler.py`, rama de `DRFValidationError`).

El formulario no pintaba el error de `segundoNombre` ni `segundoApellido`
(no tenían `<p role="alert">` ni `aria-invalid`), así que `aplicarErroresServidor`
los marcaba en el formulario pero no había nada visible. De ahí el mensaje
genérico sin campos rojos.

### Correcciones

- **Backend:** `segundo_nombre` y `segundo_apellido` ahora son
  `allow_blank=True, allow_null=True` (se guardan como `NULL`).
- **Frontend:** los dos campos muestran su mensaje y `aria-invalid`.
- **Mapeo de errores:** `MAPA_ERRORES_FAMILIAR` cubre las rutas anidadas
  (`perfil_salud.*`, `perfil_fisico.*`, `formacion_academica.*`).
- **`aplicarErroresServidor`:** reconoce rutas anidadas aunque el objeto aún no
  exista (por la raíz), de modo que el error se pinta en el campo correcto.
- **Aviso general:** si hay errores sin campo visible se muestra su texto; si
  hay campos marcados se dice «Revise los campos marcados en rojo»; nunca al
  revés. El aviso queda fijo sobre el formulario además del toast.
- **Foco y scroll:** al fallar se desplaza al primer control con
  `aria-invalid="true"` (o al primer `role="alert"`) y le da el foco.
- **Sección colapsada:** «Más detalles» de Información Académica se despliega
  sola si el error cae en uno de sus campos.

---

## 2. «Sigue dando error»: causa real

La causa del error al guardar era la misma de arriba: **todo alta o
actualización enviaba `segundo_nombre` y `segundo_apellido` en `null`**, y el
backend los rechazaba. Por eso fallaban por igual:

- el familiar mayor con cédula,
- el hijo menor sin cédula (mismo cuerpo con `cedula_familiar: null`),
- la actualización de un familiar existente (el diálogo reenvía el formulario
  completo, también con los segundos nombres en `null`).

Evidencia en código:

- `repo-familiares-api.ts` → `segundo_nombre`/`segundo_apellido` sin convertir
  `null` a `""`.
- `familiares_serializers.py` → `CharField(..., allow_blank=True)` sin
  `allow_null`.
- `core/presentation/exception_handler.py` → dos mensajes = el texto genérico.

Reproducido en local contra la BD de pruebas: con el serializer corregido, el
alta del mayor y la del hijo menor (`<titular>-N`) responden **200**; sin
`allow_null` devolvían 400 por los dos campos nulos. La regla de los 12 años del
parentesco sigue vigente (un HIJO con diferencia menor se rechaza con su
mensaje, no con el genérico).

---

## 3. Grupo sanguíneo obligatorio

- **Frontend (zod):** `perfilSaludFamiliarSchema` deja de ser opcional;
  `grupoSanguineoId` debe ser un entero positivo con el mensaje
  «Seleccione el grupo sanguíneo». El formulario arranca en `0` para que el
  campo se marque hasta elegir un grupo.
- **Backend:** `RegistrarFamiliarInputSerializer.validate()` exige
  `perfil_salud.grupo_sanguineo_id` en alta y en actualización y devuelve el
  error en `perfil_salud.grupo_sanguineo_id` (el formulario lo pinta en su
  campo).
- **«N/S»:** no se acepta como valor especial. Solo se admite un id existente de
  `RAC_gruposanguineo` (`GrupoSanguineoModel`); si el negocio necesitara «N/S»
  tendría que existir como fila del catálogo, y hoy no se creó ninguna.

---

## 4. Documentos en la actualización

- Nuevo bloque **Documentos Del Familiar** dentro del diálogo de edición
  (`familiar-documentos-actualizacion.tsx`):
  - lista **tipo, nombre y fecha** de cada documento;
  - **Ver** abre el proxy existente `familiares/<id>/documentos/<id>/archivo/`
    (autenticado, permiso `familiares.ver`);
  - **Reemplazar** sube una nueva versión del mismo documento;
  - **Agregar** permite cédula o partida de nacimiento.
- Backend: se agregó `PATCH /api/v1/familiares/<familiar_id>/documentos/<documento_id>/`
  (no existía reemplazo) con el mismo permiso de escritura
  (`familiares.editar`). Antes de subir nada comprueba que el documento
  pertenezca a ese familiar (404 si no).
- El campo `nombre_archivo` se expone en el DTO/serializer a partir del nombre
  del objeto en el almacenamiento; **la tabla legada `RAC_familydocument` no
  guarda el nombre original** del archivo, así que se muestra ese nombre de
  objeto (la etiqueta del tipo va como título de la fila).

---

## 5. Pruebas (puntos 1–4)

Backend (`tests -k familiar`):

| Archivo | Qué cubre |
| ------- | --------- |
| `tests/integration/familiares/test_actualizacion_familiar.py` (8) | grupo sanguíneo obligatorio en alta y edición, alta con segundos nombres nulos, hijo menor con sintética, reemplazo de documento (200 y archivo cambiado), 403 sin `familiares.editar`, 404 con documento de otro familiar |
| `tests/integration/familiares/test_fix_fam2.py`, `test_orden_hijo.py` | actualizados para enviar el grupo sanguíneo |
| `tests/integration/catalogos/test_parentescos_filtro_y_alta.py` | actualizado con el grupo sanguíneo |
| `tests/unit/core/test_archivos.py` | el mapper tolera `file` como cadena |

Frontend (`npx vitest run src/modules/familiares`, 8 archivos, 31 pruebas):

- `errores-familiar.test.ts`: los errores del servidor aparecen en su campo
  (incluido el anidado del grupo sanguíneo) y los sin campo vuelven al aviso.
- `schema-familiar.test.ts`: grupo sanguíneo obligatorio; cédula igual al
  titular rechazada y sintética `<titular>-1` aceptada.
- `familiar-documentos-actualizacion.test.tsx`: lista tipo/nombre/fecha y el
  botón Ver apunta al proxy; ofrece reemplazar/agregar; muestra el error del
  servidor.

---

## Parte 2

## 7. Cédula del familiar igual a la del titular

### Validación (igualdad exacta)

Mensaje único: **«La cédula del familiar no puede ser la misma del titular»**.

- **Registro y actualización (familiares):**
  `validaciones_familiar.MENSAJE_CEDULA_TITULAR` y la comparación exacta en
  `resolver_cedula_familiar` + el `validate()` del serializer (también detecta
  filas legadas que ya tienen la cédula del titular y bloquea su edición hasta
  corregir el dato).
- **Frontend (zod):** `superRefine` en `familiarSchema` y en
  `familiarUpdateSchema`, comparando `cedulaFamiliar` con `empleadoCedula`
  (solo cuando ambos vienen).
- **Fe de vida / autogestión:** la regla vive en una sola función
  (`apps/autogestion/infrastructure/repositories/lector_ficha_orm.py::validar_familiar_cambio`),
  que usan el acta (`ValidadorCambiosActaORM.validar_conjunto`), la edición de
  autogestión y el aplicador de cambios aprobados.
- **La sintética no se bloquea:** la comparación es `==` entre cadenas, así que
  `<titular>-1` (hijo menor sin cédula) sigue permitida. Además el formulario de
  edición acepta `^\d{5,9}-\d+$` para poder guardar la sintética ya generada.

### Pruebas de esta regla

- `tests/integration/familiares/test_cedula_titular.py` (6):
  alta con la cédula exacta del titular → 400 con el mensaje; alta del hijo
  menor → 200 con `<titular>-1`; actualización de fila legada con la cédula del
  titular → 400; `validar_familiar_cambio` rechaza la exacta y acepta la
  sintética; `ValidadorCambiosActaORM.validar_conjunto` (fe de vida) rechaza la
  exacta.
- `tests/unit/familiares/test_validaciones_familiar.py`: misma regla en la
  función pura y aceptación de la sintética generada.
- Vitest (`schema-familiar.test.ts`): rechazo exacto y aceptación de
  `<titular>-1`.

### Consulta `/pasivos/familiares/consultar` con la cédula 5132733

Se verificó contra la BD local (solo lectura):

- `RAC_employeefamily` id 5642 → `employeeCedula = 5132733`,
  `cedulaFamiliar = 5132733`, PADRE de LUIS MORA.
- `Employee` tiene a `5132733` (YONNI GOMEZ).
- La consulta real que usa el endpoint,
  `RepoFamiliaresORM().listar_por_empleado('5132733')`, devuelve
  `[(5642, '5132733', 'PADRE')]`; el backend filtra por `employeeCedula`, así
  que la API sí lo lista.

**Conclusión:** no se encontró un error en la consulta; el registro sí se
devuelve. Lo que hacía confuso el caso es el dato inconsistente: el familiar
5642 tiene la misma cédula que su titular, de modo que al buscar la cédula del
titular aparece una carga familiar con esa misma cédula. Queda cerrado con la
validación del punto 7 (ya no se puede proponer/guardar) y el reporte de datos
de abajo. No se modificaron datos.

### Datos existentes (consulta de solo lectura, sin cambios)

`SELECT f.id, f."employeeCedula", f."cedulaFamiliar" FROM "RAC_employeefamily" f WHERE f."cedulaFamiliar" = f."employeeCedula"`

**7 casos** (2538 familiares con cédula en total):

| id | titular | familiar |
| -- | ------- | -------- |
| 2832 | 13515027 | ALONDRA VARGAS |
| 3823 | 28058782 | ELEIMAR RODRIGUEZ |
| 5642 | 5132733 | LUIS MORA |
| 5655 | 1716666 | YOLANDA MARTINEZ |
| 5656 | 3465146 | YARLAN ALBERTO |
| 5657 | 5140021 | VIRGINIA PERNIA |
| 5658 | 6358192 | NORMA GRAGIRENA |

## 8. Consultar familiares: menú y edición como Personal

- **Menú de acciones** (`familiares-columns.tsx`): ahora usa el componente
  compartido `AccionesListadoMenu`, igual que Personal activo y pasivo:
  - sección «Acciones»: copiar cédula;
  - sección «Extras»: «Eliminar» solo si el usuario tiene `familiares.eliminar`
    (Personal no borra; se conserva la capacidad real del módulo);
  - botón principal «Ver detalle», con el mismo orden y estilo.
- **Detalle** (`detalle-familiar.tsx`): se quitó el botón general de arriba. Cada
  tarjeta tiene su propio **Actualizar**:
  - Información Básica → diálogo de identidad;
  - Relación/Parentesco → diálogo de parentesco;
  - Formaciones Académicas → diálogo académico;
  - Información de Vestimenta → diálogo de tallas;
  - Información de Salud → diálogo de salud (grupo sanguíneo obligatorio);
  - Documentos → diálogo de documentos (listar, ver, reemplazar, agregar).
  Todos reutilizan `FamiliarFormDialog` con un `bloque`, comparten estilo y
  respetan los permisos (`puedeEditar`).
- **Pruebas vitest:** `familiares-columns.test.tsx` (opciones y orden del menú,
  acción principal y eliminación con permiso) y `detalle-familiar.test.tsx`
  (sin botón general, un «Actualizar» por bloque, ninguno sin permiso).

---

## Archivos

### Backend

| Archivo | Cambio |
| ------- | ------ |
| `apps/familiares/presentation/serializers/familiares_serializers.py` | `allow_null` en segundos nombres; grupo sanguíneo obligatorio; cédula exacta del titular; `nombre_archivo` |
| `apps/familiares/application/use_cases/validaciones_familiar.py` | `MENSAJE_CEDULA_TITULAR` (comparación exacta) |
| `apps/familiares/application/use_cases/listar_familiares.py` | caso de uso de reemplazo de documento y `nombre_archivo` |
| `apps/familiares/application/dtos/familiares_dtos.py` | `nombre_archivo` |
| `apps/familiares/domain/entities/documento_familiar.py` | `nombre_archivo` |
| `apps/familiares/domain/ports/repo_familiares.py` | `reemplazar_documento` |
| `apps/familiares/infrastructure/mappers/mapper_familiares.py` | `nombre_archivo` |
| `apps/familiares/infrastructure/repositories/repo_familiares_orm.py` | `reemplazar_documento` |
| `apps/familiares/presentation/views/familiares_views.py` | `PATCH` de documento; verificación previa del documento |
| `apps/familiares/presentation/urls.py` | ruta del documento |
| `apps/autogestion/infrastructure/repositories/lector_ficha_orm.py` | regla exacta cédula familiar ≠ titular (la usa la fe de vida) |

### Frontend

| Archivo | Cambio |
| ------- | ------ |
| `ui/schema/schema-familiar.ts` | grupo sanguíneo obligatorio; cédula exacta vs titular; sintética admitida; `familiarUpdateSchema` |
| `ui/errores-familiar.ts` | mapeo de rutas anidadas |
| `ui/familiar-registrar-page.tsx` | errores por campo, aviso general, foco/scroll, payload de salud |
| `ui/familiar-form-dialog.tsx` | diálogo por bloque; salud obligatoria; documentos |
| `ui/familiar-campos.tsx` | bloques identidad/parentesco; errores de segundos nombres |
| `ui/familiar-perfil-salud.tsx` | grupo obligatorio visible y accesible |
| `ui/familiar-formacion-academica.tsx` | despliegue automático si hay errores |
| `ui/familiar-documentos-actualizacion.tsx` | **nuevo**: lista, Ver, Reemplazar, Agregar |
| `ui/detalle-familiar.tsx` | botón por bloque; sin botón general |
| `ui/familiares-columns.tsx` | menú compartido como Personal |
| `application/*`, `domain/*`, `infrastructure/*` | DTO/entidad/puerto/repositorio/API/action del reemplazo y `nombreArchivo` |
| `shared/ui/forms/aplicar-errores-servidor.ts` | rutas anidadas con raíz existente |

## Resultados

| Comprobación | Resultado |
| ------------ | --------- |
| `pytest tests -k familiar` (sin `--create-db`) | **120 passed**, 2268 deselected (2:14) |
| `lint-imports` | **103 contratos, 0 rotos** |
| `makemigrations --check --dry-run` | **No changes detected** |
| `npx tsc --noEmit` | sin errores |
| `npx eslint src --quiet` | sin errores |
| `npx vitest run src/modules/familiares` | **31 passed** (8 archivos) |

## Notas

- No se corrigieron datos en la BD: solo la consulta de lectura del punto 7.
- Las filas legadas con cédula igual a la del titular (tabla de arriba) quedan
  bloqueadas para edición hasta que se corrija el dato; es el efecto buscado de
  la validación.
- `N/S` no es un grupo válido: solo ids reales del catálogo.
- Sin migraciones ni cambios de esquema.
