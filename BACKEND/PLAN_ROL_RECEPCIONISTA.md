# Plan — Rol RECEPCIONISTA (solo backend)

**Objetivo**: un rol que sólo pueda **consultar** trabajadores y familiares. Sin
registrar, sin actualizar, sin ver el resto de las opciones del menú. Incluye una
API para crear roles nuevos.

**Estado:**

- **Fase 1: IMPLEMENTADA** el 2026-08-19 (rol creado con id 9 + 3 endpoints de
  gestión de roles). Probada de punta a punta.
- **Fase 1b (frontend): pendiente.** Sin ella el rol existe pero no ve nada.
- **Fase 2: pendiente de aprobación.** Sin ella el rol no restringe de verdad.

---

## 1. Cómo funciona el control de acceso hoy

Indispensable para entender el plan.

| Capa | Qué hace hoy |
|---|---|
| Base de datos | `USER_rol` guarda sólo el nombre del rol. **No hay tabla de permisos** |
| Backend | Sólo exige estar autenticado. **Ningún endpoint valida el rol** |
| Frontend | Aquí está todo el control: `NextJS/src/proxy.ts` y los arreglos `roleAccept` de cada sidebar |

Cifras verificadas: de **135 vistas**, **127** heredan el permiso global
`IsAuthenticated` y **8** declaran `AllowAny`. Ninguna comprueba `rol`.

**Consecuencia**: el rol decide qué se *ve*, no qué se *puede hacer*. Un usuario
autenticado puede llamar por API a un endpoint de escritura aunque su menú no lo
muestre. Esto es clave para el alcance: un rol de sólo consulta implementado
únicamente con la lógica actual es **cosmético**.

### Los 5 roles y 4 departamentos actuales

| id | Rol | Cuentas | | id | Departamento | Cuentas |
|---|---|---|---|---|---|---|
| 1 | ADMINISTRADOR | 5 | | 1 | Carnetizacion | 0 |
| 2 | ANALISTA | 7 | | 2 | Seguridad | 1 |
| 3 | AUTOGESTION | 867 | | 3 | AUTOGESTION | 867 |
| 4 | PRESUPUESTO | 1 | | 5 | RAC | 13 |
| 5 | BIENSTAR SOCIAL | 1 | | | | |

### Lo que ya existe y NO se toca

`GET /api/accounts/roles/` (vista `list_rols`, nombre `lista_roles`) ya resuelve
la consulta de roles. La consume el módulo de Seguridad:

```ts
// NextJS/src/app/(protected)/dashboard/seguridad/api/getInfo.ts
export const getRole = async () => {
  return await apiFetchGet<Role[]>("accounts/roles/");
};
```

Y el tipo del frontend coincide exactamente con lo que devuelve:

```ts
// NextJS/src/app/types/types.ts:337
export interface Role {
  id: number;
  nombre_rol: string;
}
```

Se usa para poblar el desplegable de rol en los formularios de registrar y
modificar usuario.

**Por lo tanto, el plan NO agrega ningún endpoint de consulta de roles y NO
modifica `RolSerializer`.** Tampoco se expone `descripcion_rol` en ese contrato
(decisión tomada: queda fuera del alcance), aunque la columna exista en la base.

---

## 2. Fase 1 — Con la lógica actual — **IMPLEMENTADA**

Lo mínimo para tener el rol operativo sin cambiar cómo el sistema valida hoy.

### Resultado de la implementación

| Archivo | Cambio real |
|---|---|
| `USER/views/rol_views.py` | nuevo, 3 vistas |
| `USER/serializers/USER_serializers.py` | +34 líneas (`RolEscrituraSerializer`) |
| `USER/views/__init__.py` | +8 líneas |
| `USER/urls.py` | +5 líneas |
| tabla `USER_rol` | +1 fila (`RECEPCIONISTA`, **id 9**) |
| `SIGEP/settings.py` | **sin cambios** |
| `RolSerializer` | **sin cambios** — contrato de Seguridad preservado |

Total: 47 líneas agregadas, ninguna eliminada. Todo aditivo.

Pruebas ejecutadas contra la API real: `GET /roles/` devuelve los 6 roles con el
contrato original `{id, nombre_rol}`; crear normaliza `"  consulta   externa "` a
`CONSULTA EXTERNA`; duplicado en minúsculas rechazado en español; nombre vacío y
en blanco rechazados en español; actualizar avisa del cambio de nombre; eliminar
un rol en uso responde `409` con el conteo (867 cuentas); rol inexistente `404`;
sin token `401`.

### 2.1 Crear el rol

Un `INSERT` en la tabla existente. **Sin cambios de esquema.**

```sql
INSERT INTO "USER_rol" (nombre_rol, descripcion_rol)
VALUES ('RECEPCIONISTA',
        'Consulta de trabajadores y familiares. Sin registrar, actualizar ni gestionar.');
```

`USER_rol` pasa de 5 a 6 filas. Ninguna cuenta se modifica.

### 2.2 API de gestión de roles — sólo lo que falta

La consulta ya existe, así que se agregan únicamente las tres operaciones de
escritura:

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/accounts/roles/create/` | Crea un rol |
| `PATCH` | `/api/accounts/roles/<id>/update/` | Cambia nombre o descripción |
| `DELETE` | `/api/accounts/roles/<id>/delete/` | Elimina, sólo si no tiene cuentas |

Reglas de negocio propuestas:

- **Normalizar el nombre** a mayúsculas y sin espacios repetidos, porque el
  frontend compara el rol por su texto: `"  consulta   externa "` →
  `"CONSULTA EXTERNA"`.
- **Unicidad sin distinguir mayúsculas**, con mensaje en español. Requiere
  desactivar el `UniqueValidator` que DRF agrega solo desde el modelo, porque
  corre antes de normalizar y responde en inglés.
- **No permitir eliminar un rol en uso**: responder `409` indicando cuántas
  cuentas lo tienen (con un `count()` directo en la vista).
- Al crear, **advertir en la respuesta** que el rol no se verá en el sistema
  hasta incluirlo en los `roleAccept` del frontend.

### 2.3 Archivos que se tocan en la fase 1

| # | Archivo | Estado hoy | Cómo queda |
|---|---|---|---|
| 1 | `USER/views/rol_views.py` | no existe | **nuevo**, ~130 líneas: `crear_rol`, `actualizar_rol`, `eliminar_rol` |
| 2 | `USER/urls.py` | 20 líneas | **+5** al final. La línea 16 (`roles/`) no se toca |
| 3 | `USER/views/__init__.py` | 27 líneas | **+8**: import y `__all__` de las 3 vistas |
| 4 | `USER/serializers/USER_serializers.py` | 171 líneas | **+30**: sólo `RolEscrituraSerializer`. `RolSerializer` intacto |
| 5 | tabla `USER_rol` | 5 filas | **+1 fila**. Sin cambio de esquema |

**`settings.py` NO se toca en la fase 1.** Todo es aditivo: ningún endpoint
existente cambia de comportamiento.

#### `USER/urls.py` — antes y después

Hoy termina en:

```python
    path('usuarios/<int:id>/', views.editar_usuario, name='api_editar_usuario'),
    path('usuarios/estado/<int:id>/', views.cambiar_estado_usuario, name='api_cambiar_estado_usuario'),
]
```

Quedaría:

```python
    path('usuarios/<int:id>/', views.editar_usuario, name='api_editar_usuario'),
    path('usuarios/estado/<int:id>/', views.cambiar_estado_usuario, name='api_cambiar_estado_usuario'),

    # ─── Gestión de roles ───
    path('roles/create/', views.crear_rol, name='crear_rol'),
    path('roles/<int:id>/update/', views.actualizar_rol, name='actualizar_rol'),
    path('roles/<int:id>/delete/', views.eliminar_rol, name='eliminar_rol'),
]
```

### 2.4 Fase 1b — Frontend (pendiente de ejecutar)

Alcance decidido: **consulta de trabajadores y familiares, tanto ACTIVOS como
PASIVOS**. Sin reportes.

#### Cómo funciona el frontend hoy (verificado)

| Pieza | Comportamiento |
|---|---|
| `dashboard/page.tsx` | El selector de módulos filtra **por departamento**, no por rol: `departments.filter(d => d.id === session.user.department.nombre_departamento)`. RAC → tarjeta "Gestión de Trabajadores" |
| `components/layout/header.tsx` | Si el departamento es RAC muestra un desplegable para alternar entre **Gestión Personal Activo** y **Gestión Personal Pasivo**. Es la única vía para llegar a `gestion-pasivos` |
| Sidebars | Filtran con `roleAccept.includes(rol) && departmentAccept.includes(depto)`. Un ítem sin `permission` es visible para todos |
| `proxy.ts` | Sólo encierra a AUTOGESTION. El resto navega libre por cualquier `/dashboard/*` |

**Consecuencias para RECEPCIONISTA / RAC**: el selector de módulos y el
desplegable del header **ya funcionan sin cambios**. Hoy el sidebar le mostraría
únicamente "Inicio", porque es el único ítem sin `permission`.

#### a) Sidebar de activos

`app/(protected)/dashboard/gestion-trabajadores/components/layout/app-sidebar.tsx`

Agregar `"RECEPCIONISTA"` a **3** arreglos `roleAccept` (el `departmentAccept`
ya contiene `"RAC"`):

| Ítem | Motivo |
|---|---|
| `"Personal Trabajador"` (padre) | sin el padre, todo el grupo se oculta |
| `"Consultar/Actualizar"` | consulta de trabajador |
| `"Consultar Familiar"` | consulta de familiar |

**No se tocan**: Agregar Trabajador · Agregar Familiar · Ub. Administrativas ·
Gestión De Codigos · Movimientos · **Reportes** (decidido: fuera) ·
Retroalimentación · Autogestión.

#### b) Sidebar de pasivos

`app/(protected)/dashboard/gestion-pasivos/components/layout/app-sidebar.tsx`

Agregar `"RECEPCIONISTA"` a **3** arreglos `roleAccept`:

| Ítem | URL |
|---|---|
| `"Personal Jubilado/Pasivo"` (padre) | `#` |
| `"Consultar/Actualizar"` | `/dashboard/gestion-pasivos/personal-jubilado/consultar` |
| `"Consultar Familiar"` | `/dashboard/gestion-pasivos/personal-jubilado/familiares/consultar` |

**No se tocan**: Registrar · Agregar Familiar · Gestión De Codigos ·
Movimientos · Reportes.

#### c) Ocultar los botones de edición

Las pantallas de consulta son búsqueda + tabla; la edición vive en los
`detail-info.tsx`, detrás de `DialogTrigger`:

| Archivo | Puntos de edición |
|---|---|
| `components/employees/tableEmployees/detail-info.tsx` | 23 `DialogTrigger`, 7 formularios de actualización |
| `components/employees/tableFamilys/detail-info.tsx` | 11 `DialogTrigger`, 4 formularios |
| `components/employees/tableEmployees/columns.tsx` | `EmployeeActionsCell` (acciones de fila) |
| equivalentes en `gestion-pasivos` | por revisar al ejecutar |

Ninguno condiciona por rol hoy. Enfoque: una guarda al inicio de cada archivo

```tsx
const soloLectura = session?.user.role.nombre_rol === "RECEPCIONISTA";
```

y envolver cada disparador de edición con `{!soloLectura && ( ... )}`. Los
paneles de visualización quedan intactos.

#### d) `proxy.ts` — lista blanca de rutas

`app/(protected)` no distingue módulos, así que sin esto un recepcionista podría
escribir a mano `/dashboard/gestion-trabajadores/movimientos/cambiar-estatus` y
la pantalla cargaría, aunque no esté en su menú.

**Solución elegida: lista blanca explícita de las rutas de consulta**, no un
prefijo por módulo. Un prefijo como `/dashboard/gestion-trabajadores` dejaría
pasar también las pantallas de escritura del mismo módulo, así que no sirve.

```ts
const esRecepcionista = auth?.user?.role?.nombre_rol === "RECEPCIONISTA";

const RUTAS_RECEPCIONISTA = [
  "/dashboard",                                                          // selector
  "/dashboard/gestion-trabajadores",                                     // inicio del módulo
  "/dashboard/gestion-trabajadores/personal-trabajador/consultar",
  "/dashboard/gestion-trabajadores/personal-trabajador/familiares/consultar",
  "/dashboard/gestion-pasivos",                                          // inicio del módulo
  "/dashboard/gestion-pasivos/personal-jubilado/consultar",
  "/dashboard/gestion-pasivos/personal-jubilado/familiares/consultar",
];

if (isLoggedIn && esRecepcionista) {
  const permitida =
    RUTAS_RECEPCIONISTA.includes(nextUrl.pathname) ||
    nextUrl.pathname.startsWith("/api/auth");
  if (!permitida) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
}
```

Se usa `includes` (coincidencia exacta) y no `startsWith`, para que
`/dashboard/gestion-trabajadores/movimientos/...` quede fuera. Va después del
bloque de AUTOGESTION y antes del `return NextResponse.next()`.

Nota: si al ejecutar se detecta que alguna pantalla de consulta usa subrutas
(por ejemplo `.../consultar/[id]`), esas entradas puntuales pasarían a
`startsWith` con el prefijo de la propia pantalla de consulta.

#### Resumen de la fase 1b

| # | Archivo | Cambio |
|---|---|---|
| 1 | `gestion-trabajadores/.../app-sidebar.tsx` | +`"RECEPCIONISTA"` en 3 `roleAccept` |
| 2 | `gestion-pasivos/.../app-sidebar.tsx` | +`"RECEPCIONISTA"` en 3 `roleAccept` |
| 3 | `tableEmployees/detail-info.tsx` | guarda `soloLectura` + envolver 23 disparadores |
| 4 | `tableFamilys/detail-info.tsx` | guarda `soloLectura` + envolver 11 disparadores |
| 5 | `tableEmployees/columns.tsx` | ocultar `EmployeeActionsCell` |
| 6 | equivalentes en `gestion-pasivos` | por revisar al ejecutar |
| 7 | `src/proxy.ts` | lista blanca (~10 líneas) |

**Sin cambios** en `dashboard/page.tsx` ni en `header.tsx`: ya resuelven por
departamento.

#### Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| ¿Reportes → Consultar Trabajador / Familiares? | **No** |
| ¿Personal pasivo? | **Sí**, también pasivos |
| ¿Encierro en `proxy.ts`? | **Sí**, con lista blanca de coincidencia exacta |

## 3. Fase 2 — Validación real en el backend

**El problema que resuelve**: ocultar el botón no impide la operación. Un
recepcionista con sesión abierta podría hacer `PATCH /api/Employee/<id>/` y el
backend lo aceptaría.

Diseño propuesto (borrador funcional en
`migrar/propuesta_permisos/permissions.py.propuesta`):

1. **Módulo con la matriz de permisos** (`USER/permissions.py`): agrupa los
   endpoints por función (`consulta_trabajadores`, `consulta_familiares`,
   `catalogos`, `sesion`) usando los `name=` de los `urls.py` — son estables
   aunque cambie la URL — y declara por rol si es de sólo lectura y a qué
   módulos llega.

2. **Clase de permiso DRF** (`RolPermission`) como `DEFAULT_PERMISSION_CLASSES`.
   Con **un solo cambio en `settings.py`** cubre las 127 vistas que heredan el
   permiso global; las 8 con `AllowAny` siguen públicas porque el decorador
   local tiene prioridad.

3. **Compatibilidad**: los 5 roles actuales se marcan `sin_restriccion`, así que
   **nadie pierde accesos**. La restricción aplica sólo a los roles declarados.
   El cambio es aditivo.

4. **Falla cerrado**: un rol que no figure en la matriz no puede hacer nada. Si
   se crea un rol por la API y nadie lo configura, el sistema niega en vez de
   permitir.

5. **Endpoint `/api/accounts/mis-permisos/`**: devuelve los permisos del rol de
   la sesión, para que el frontend arme el menú desde el backend en lugar de
   tener los roles escritos a mano en cuatro sidebars distintos.

### Archivos que se tocan en la fase 2

| # | Archivo | Estado hoy | Cómo queda |
|---|---|---|---|
| 6 | `USER/permissions.py` | no existe | **nuevo**, ~275 líneas |
| 7 | `SIGEP/settings.py` | `'rest_framework.permissions.IsAuthenticated'` en `DEFAULT_PERMISSION_CLASSES` (líneas 175-177) | `'USER.permissions.RolPermission'` — **1 línea** |

El cambio en `settings.py` es **el único de riesgo real del plan**, porque aplica
a las 127 vistas que heredan el permiso global. Mitigación: los 5 roles actuales
quedan `sin_restriccion`, así que su comportamiento es idéntico al de hoy.

### Por qué la matriz iría en código y no en la base de datos

Sería más flexible una tabla de permisos configurable por API. **No se puede
hacer limpiamente hoy**: el proyecto no tiene archivos de migración.
`.gitignore` excluye `**/migrations/` y no existen ni en el repo ni en la imagen
Docker, aunque la base registra 125 migraciones aplicadas y
`makemigrations --check` reporta limpio. Agregar una tabla o una columna
obligaría a aplicar el DDL a mano y dejaría el estado de migraciones
inconsistente.

Mientras eso no se resuelva, la matriz en código es la opción de menor riesgo:
un diccionario en un solo archivo, versionado y revisable. Asignar permisos a un
rol nuevo es editar dos líneas.

**Recomendación aparte**: restablecer el control de migraciones — quitar
`**/migrations/` del `.gitignore` y versionar las migraciones existentes. Sin
eso, cualquier cambio de modelo va a ser frágil.

---

## 4. Hallazgos de seguridad (fuera del pedido)

Encontrados al revisar los permisos. Son independientes del rol RECEPCIONISTA y
más graves:

| # | Endpoint | Problema |
|---|---|---|
| 1 | `POST /api/accounts/registro/` | `AllowAny`: **cualquiera sin autenticarse puede crear cuentas** |
| 2 | `POST /api/accounts/cambiar-password/` | `AllowAny`: cambia contraseñas sin sesión |
| 3 | `GET /api/Employeefamily/documentos/<id>/descargar/` | `AllowAny`: descarga documentos de familiares sin autenticación |
| 4 | Todo el backend | Ningún endpoint valida el rol (lo resuelve la fase 2) |

Los dos primeros permiten tomar control de cuentas; el tercero expone datos
personales.

---

## 5. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Endpoint de consulta de roles | **No se crea.** `GET /api/accounts/roles/` ya existe y lo usa Seguridad |
| `RolSerializer` | **No se modifica.** Se preserva el contrato `{id, nombre_rol}` |
| `descripcion_rol` en el contrato del frontend | **Queda fuera del alcance** |
| Cambios de esquema | **Ninguno** |

---

## 6. Resumen para autorizar

| Fase | Alcance | Riesgo | Resultado |
|---|---|---|---|
| **1** | 1 `INSERT` + 1 archivo nuevo + 3 modificados (~43 líneas agregadas). Sin esquema, sin `settings.py` | Bajo: sólo agrega 3 endpoints nuevos, no altera nada existente | Rol creado y API de roles completa. El rol **no restringe de verdad** hasta el frontend |
| **1b** | Frontend: `proxy.ts` + sidebars + botones | Medio: toca archivos compartidos | El recepcionista ve sólo consulta |
| **2** | 1 archivo nuevo + 1 línea en `settings.py` | Medio: cambia el permiso global, aunque los roles actuales quedan sin restricción | La restricción se cumple de verdad, también por API |

**Recomendación**: hacer 1 y 2 juntas. La fase 1 sola crea la apariencia de un
rol restringido sin la restricción, y eso puede dar una falsa sensación de
seguridad.
