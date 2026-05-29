# SAGP - Sistema Automatizado de Gestión de Personal

**Análisis completo de la arquitectura, componentes y funcionamiento del sistema.**

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Backend Django](#2-backend-django)
3. [Backend NestJS](#3-backend-nestjs-file-manager)
4. [Frontend NextJS](#4-frontend-nextjs)
5. [Flujo de Datos](#5-flujo-de-datos-típico)
6. [Despliegue](#6-despliegue)
7. [Observaciones y Riesgos](#7-observaciones-y-riesgos)

---

## 1. Arquitectura General

```
┌────────────────────────────────────────────────────┐
│                   NextJS (Frontend)                │
│                  :3000 / App Router                │
│           Server Actions + SWR + NextAuth          │
└────────┬───────────────────────────────┬───────────┘
         │ HTTP (fetch)                  │ HTTP (fetch)
         ▼                               ▼
┌──────────────────┐          ┌──────────────────────┐
│  Django (API)     │          │  NestJS (File Server)│
│  :8000 / DRF      │          │  :5000 / Multer+Sharp│
│  PostgreSQL (ext.)│          │  Filesystem uploads/ │
└──────────────────┘          └──────────────────────┘

          Orquestación: Docker Compose + Portainer :9443
          Redes: backend (Django↔NextJS)
                 file_manager (NestJS↔NextJS)
```

| Componente | Tecnología | Puerto | Rol |
|---|---|---|---|
| **Django** | Django 5.2 + DRF 3.16 | `:8000` | API REST principal, lógica de negocio, BD |
| **NestJS** | NestJS 11 + Express | `:5000` | Microservicio de archivos (subida/lectura) |
| **NextJS** | Next.js 16.1 + Tailwind v4 | `:3000` | Frontend SPA, Server Actions, SSR |
| **Portainer** | Portainer CE | `:9443` | Panel de gestión Docker |

---

## 2. Backend Django

### 2.1 Estructura del Proyecto

```
BACKEND/
├── manage.py
├── requirements.txt                    # 38 dependencias
├── .env / .env.example                 # Config BD PostgreSQL
├── django.dockerfile
├── wait-for-db.sh / wait-for-postgres.py
├── SAGP_CONATEL.sql                    # Dump PostgreSQL (326 KB)
├── SIGEP_MINISTERIO.sql                # Dump PostgreSQL (1.1 MB)
├── SIGEP/                              # Proyecto Django
│   ├── settings.py                     # Django 6.0.1 (generated)
│   ├── urls.py                         # Raíz: /admin, /api/, /api/schema/docs/redoc
│   └── asgi.py / wsgi.py
├── RAC/                                # App core (Registro Asignación Cargos)
│   ├── models/                         # 4 archivos de modelos
│   │   ├── personal_models.py          # Employee, AsigTrabajo, catálogos
│   │   ├── family_personal_models.py   # Employeefamily, Parentesco
│   │   ├── historial_personal_models.py# EmployeeMovementHistory, egresados
│   │   └── ubicacion_models.py         # Región, Estado, Municipio, Parroquia
│   ├── serializers/                    # 7 serializadores
│   ├── views/                          # 7 views (function-based)
│   ├── services/                       # Lógica de negocio + PDF generation (ReportLab)
│   ├── filters/                        # Django-filter FilterSets
│   ├── utils/                          # Utilidades (formateo de datos)
│   └── urls.py                         # ~60 endpoints
└── USER/                               # App de autenticación
    ├── models/                         # cuenta, departaments, Rol
    ├── serializers/
    ├── views/
    └── urls.py                         # ~8 endpoints
```

### 2.2 Configuración (`settings.py`)

| Aspecto | Valor |
|---|---|
| Framework | Django 5.2 (settings generado como 6.0.1) |
| Debug | `True` |
| Timezone | `America/Caracas` |
| DB | PostgreSQL vía `python-decouple` |
| Default Auth | Custom (NO `AbstractUser`, comparación directa de password) |
| REST Framework | PageNumberPagination (page_size=10), drf-spectacular schema |
| CORS | Múltiples orígenes en :3000, credentials=True |
| Apps instaladas | corsheaders, rest_framework, drf_spectacular, django_filters, RAC, USER |

### 2.3 Dependencias Clave (`requirements.txt`)

| Paquete | Versión | Propósito |
|---|---|---|
| Django | 5.2.7 | Framework web |
| djangorestframework | 3.16.1 | API REST |
| django-cors-headers | 4.9.0 | CORS |
| djangorestframework_simplejwt | 5.5.1 | JWT **(instalado pero NO configurado)** |
| drf-spectacular | 0.28.0 | OpenAPI/Swagger |
| django-filter | 25.1 | Filtros de consultas |
| django-simple-history | 3.10.1 | Historial de cambios en modelos |
| psycopg2 | — | Conector PostgreSQL |
| reportlab | 4.4.9 | Generación PDF |
| openpyxl / pandas | 3.1.5 / 2.3.3 | Lectura Excel |
| celery | 5.3.4 | Tareas asíncronas **(instalado pero NO configurado)** |
| gunicorn | 23.0.0 | Servidor WSGI |

### 2.4 Modelos de Datos

#### 2.4.1 Catálogos (RAC)

| Modelo | Tabla | Campos clave |
|---|---|---|
| Denominacioncargo | DenominacionCargo | cargo (unique), orden_by_cargo |
| Denominacioncargoespecifico | DenominacionCargoEspecifico | cargo (unique) |
| TipoComision | TipoComision | tipo_comision |
| OrganismoAdscrito | OrganismoAdscrito | Organismoadscrito, FK parent (jerarquía) |
| NivelAcademico | NivelAcademico | nivelacademico |
| Grado | Grado | grado |
| Tiponomina | TipoNomina | nomina, requiere_codig, es_activo |
| Dependencias | Dependencias | Codigo (unique), dependencia |
| DireccionGeneral | DireccionGeneral | Codigo, direccion_general, FK Dependencias |
| DireccionLinea | DireccionLinea | Codigo, direccion_linea, FK DireccionGeneral |
| Coordinaciones | Coordinaciones | Codigo, coordinacion, FK DireccionLinea |
| Estatus | Estatus | estatus |
| Tipo_personal | TipoPersonal | tipo_personal (ACTIVO/PASIVO) |
| Sexo | Sexo | sexo |
| estado_civil | (auto) | estadoCivil |
| Talla_Camisas / Pantalones / Zapatos | (auto) | talla |
| GrupoSanguineo | GrupoSanguineo | GrupoSanguineo |
| categorias_discapacidad / patologias / alergias | (auto) | nombre_categoria |
| Discapacidades / patologias_Cronicas / Alergias | (auto) | nombre + FK categoria |
| carreras / Menciones / Instituciones / Capacitaciones | (auto) | nombre + FKs |

#### 2.4.2 Modelos de Negocio (RAC)

**Employee**
- `cedulaidentidad` (PK, unique), `nombres`, `apellidos`, `fecha_nacimiento`
- `fechaingresoorganismo`, `total_anos_apn`, `n_contrato`, `correo`
- `telefono_*`, `fecha_actualizacion`
- FK: `sexoid → Sexo`, `estadoCivil → estado_civil`
- Historial vía `django-simple-history`

**AsigTrabajo** (asignación de puesto)
- `codigo`, `encargaduria`, `observaciones`
- FK: `employee → Employee`, `denominacioncargoid/especificoid`
- FK: `OrganismoAdscritoid`, `gradoid`, `tiponominaid`
- FK jerarquía: `Dependencia → DireccionGeneral → DireccionLinea → Coordinacion`
- FK: `estatusid`, `Tipo_personal`, `tipo_comision`
- Unique: `(codigo, tiponominaid)`
- Historial vía `django-simple-history`

**Employeefamily** (familiares)
- `cedulaFamiliar`, `primer_nombre`, `segundo_nombre`, `primer_apellido`, `segundo_apellido`
- `fechanacimiento`, `mismo_ente`, `heredero` (solo 1 por empleado), `observaciones`
- FK: `employeecedula → Employee`, `parentesco → Parentesco`, `sexo → Sexo`, `estadoCivil`
- Unique: `(employeecedula, cedulaFamiliar)`
- Historial vía `django-simple-history`

**EmployeeMovementHistory** (historial de movimientos)
- `codigo_puesto`, `tipo_movimiento` (INGRESO/TRASLADO/EGRESO/CAMBIO DE ESTATUS)
- `fecha_movimiento`
- FK: `empleado → Employee`, denomación/específico/grado/nómina/estatus/tipo_personal
- FK jerarquía organizacional completa
- FK: `motivo → Tipo_movimiento`, `ejecutado_por → cuenta`

**EmployeeEgresado** / **CargoEgresado** (personal retirado)
- EmployeeEgresado: `n_contrato`, `fechas`, FK `employee`, FK `motivo_egreso`
- CargoEgresado: `codigo` (unique), FK `egreso`, más FKs de puesto

**Perfiles complementarios** (todo con FK a Employee o Employeefamily):
- `contacto_emergencia` — nombre, teléfono, FK Parentesco
- `datos_vivienda` — dirección, FK Estado/Municipio/Parroquia/condición_vivienda
- `perfil_salud` — M2M alergias/patologías/discapacidades, FK GrupoSanguineo
- `perfil_fisico` — FK Talla_Camisas/Pantalones/Zapatos
- `formacion_academica` — FK NivelAcademico/carreras/Menciones
- `formacion_complementaria` — capacitaciones, fechas
- `antecedentes_servicio` — instituciones previas

#### 2.4.3 Ubicación (RAC)

| Modelo | FK |
|---|---|
| Region | — |
| Estado | FK Region |
| Municipio | FK Estado |
| Parroquia | FK Municipio |

#### 2.4.4 Usuarios (USER)

| Modelo | Campos |
|---|---|
| departaments | nombre_departamento (unique), descripcion |
| Rol | nombre_rol (unique), descripcion |
| cuenta | password, is_active, O2O `cedula → RAC.Employee`, FK `departamento`, FK `rol` |

### 2.5 Endpoints REST (~68 total)

#### Rutas raíz (`SIGEP/urls.py`)

| Método | Ruta | Descripción |
|---|---|---|
| — | `/admin/` | Django Admin |
| — | `/api/` | App RAC |
| — | `/api/accounts/` | App USER |
| GET | `/api/schema/` | OpenAPI schema (drf-spectacular) |
| GET | `/api/docs/` | Swagger UI |
| GET | `/api/redoc/` | ReDoc |

#### Endpoints RAC (`RAC/urls.py`)

**Personal**
| Método | Ruta | Función |
|---|---|---|
| POST | `api/employees_register/` | Crear empleado |
| PATCH | `api/Employee/<int:id>/` | Actualizar empleado |
| GET | `api/listar-data-empleados/<str:cedulaidentidad>/` | Obtener empleado |
| GET | `api/employee/pasivo/` | Listar empleados pasivos |
| GET | `api/employee/pasivo/<str:cedulaidentidad>/` | Obtener pasivo por cédula |

**Salud**
| Método | Ruta |
|---|---|
| GET | `api/listar-grupoSanguineos/` |
| GET/POST | `api/patologias/categorias/` |
| GET/POST | `api/Patologias/` |
| GET/POST | `api/discapacidad/categorias/` |
| GET/POST | `api/Discapacidades/` |
| GET/POST | `api/alergias/categorias/` |
| GET/POST | `api/alergias/` |

**TallasyCatálogos**
| Método | Ruta |
|---|---|
| GET | `api/listar-tallasCamisas/` / `listar-tallaPantalones/` / `listar-tallaZapatos/` |
| GET | `api/listar-nivel-academico/` / `carreras/` / `instituciones/` |
| GET | `api/Menciones/<int:carrera_id>/` |
| GET | `api/listar-sexo/` / `listar-estadoCivil/` |

**Ubicación**
| Método | Ruta |
|---|---|
| GET | `api/direccion/regiones/` |
| GET | `api/direccion/estado/<int:region_id>/` / `estados/` |
| GET | `api/direccion/municipios/<int:estadoid>/` |
| GET | `api/direccion/parroquias/<int:municipioid>/` |
| GET | `api/condicion_vivienda/` |

**Jerarquía Organizacional**
| Método | Ruta |
|---|---|
| POST | `api/dependencia/` / `register-direccionGeneral/` / `register-direccionLinea/` / `register-Coordinacion/` |
| PATCH | `api/Dependencia/<int:id>/` / `DireccionGeneral/<int:id>/` / `DireccionLinea/<int:id>/` / `Coordinacion/<int:id>/` |
| GET | `api/dependencias/` |
| GET | `api/direccionGeneral/<int:dependencia_id>/` |
| GET | `api/listar-DireccionGeneral/` |
| GET | `api/listar-DireccionLinea/<int:general_id>/` |
| GET | `api/listar-Coordinacion/<int:line_id>/` |

**Códigos/Cargos**
| Método | Ruta |
|---|---|
| POST | `api/empleados-codigo/` |
| PUT | `api/codigos/<int:id>/` |
| GET | `api/cargos/vacantes/` / `cargos/general/` / `cargos/pasivo/` |
| GET | `api/listar-denominacion-cargo/` / `listar-denominacion-cargo-especifico/` / `listar-grado/` |
| GET | `api/nomina/general/` / `listar-nominaPasivo/` / `listar-tipo-nomina/` / `listar-nomina-especial/` |
| GET | `api/estatus/` / `estatus/reports/` / `estatus-gestion/` |

**Movimientos**
| Método | Ruta |
|---|---|
| PATCH | `api/asignar_codigo/<int:id>/` |
| POST | `api/asignacion_CodigoEspecia/` |
| GET | `api/Employee/cargos/` / `empleados-cedula/<str:cedulaidentidad>/` |
| GET | `api/EmployeeMovementHistory/<str:cedulaidentidad>/` |
| PATCH | `api/historyEmployee/cargo-movimiento/<int:cargo_id>/` |
| PATCH | `api/historyEmployee/egreso/<str:cedulaidentidad>/` |
| PATCH | `api/historyEmployee/Estatus/<int:cargo_id>/` |
| GET | `api/motivos/egreso/` / `motivos/egreso/fallecimineto/` / `motivos/movimiento/` / `motivos/estatus/` / `motivos/estatus/pasivos/` |

**Familiares**
| Método | Ruta |
|---|---|
| POST | `api/Employeefamily/<str:cedula_empleado>/` (individual) |
| POST | `api/Employeefamily/masivo/<str:cedula_empleado>/` (masivo) |
| PATCH | `api/Employeefamily/<int:familiar_id>` |
| GET | `api/Employeefamily/` / `Employeefamilys/<int:id_empleado>/` |
| GET | `api/Passivefamily/` / `Passivefamily/<int:id_empleado>/` |
| GET | `api/Parentesco/` |

**Organismos**
| Método | Ruta |
|---|---|
| POST | `api/OrganismoAdscrito/` |
| PATCH | `api/OrganismoAdscrito/<int:id>/` |
| GET | `api/organismos-adscritos/` / `organismos-adscritos/padre/` |
| GET | `api/tiposComision/` |

**Reportes**
| Método | Ruta |
|---|---|
| GET | `api/EmployeeMovementHistory/reporte/` |
| POST | `api/reports/pdf/` (4 categorías: empleados, familiares, asignaciones, egresados) |
| POST | `api/reports/pasivo/` (2 categorías: empleados, familiares) |
| GET | `api/reports/config/empleados/` / `asignaciones/` / `familiares/` / `egresados/` / `tipos/` / `todas/` |

**Importación Masiva**
| Método | Ruta |
|---|---|
| POST | `api/menciones/create/` |
| POST | `api/carga/cargos/` | Importación cargos desde Excel |
| POST | `api/carga/trabajador/` | Importación empleados desde Excel |
| POST | `api/carga/familiares/` | Importación familiares desde Excel |

#### Endpoints USER (`USER/urls.py`)

| Método | Ruta | Función |
|---|---|---|
| POST | `api/accounts/login/` | Iniciar sesión |
| POST | `api/accounts/registro/` | Registrar usuario |
| GET | `api/accounts/usuarios/` | Listar usuarios |
| GET | `api/accounts/roles/` | Listar roles |
| GET | `api/accounts/departamentos/` | Listar departamentos |
| PATCH/PUT | `api/accounts/usuarios/<int:id>/` | Editar usuario |
| PATCH | `api/accounts/usuarios/estado/<int:id>/` | Activar/suspender usuario |

### 2.6 Generación de PDF (ReportLab)

Arquitectura:

```
services/pdf/
├── base_generator.py          # Clase abstracta BasePDFGenerator
├── templates/
│   ├── styles.py              # Colores, fuentes, config página
│   └── components.py          # Header, footer, tablas
└── generators/
    ├── employee_active_pdf.py  # EmployeePDFGenerator
    ├── employee_passive_pdf.py # EmployeePassivePDFGenerator
    ├── family_pdf.py           # FamilyPDFGenerator
    ├── assignment_pdf.py       # AssignmentPDFGenerator
    └── graduate_pdf.py         # GraduatePDFGenerator
```

**Categorías:**
1. `empleados` — empleados activos (13+ columnas)
2. `familiares` — empleados con familiares (11 columnas)
3. `asignaciones` — códigos/puestos (10 columnas)
4. `egresados` — empleados egresados (7+ columnas)

**Request:**
```json
{
  "categoria": "empleados|familiares|asignaciones|egresados",
  "filtros": { "campo": "valor" }
}
```

### 2.7 Servicios Auxiliares

- **`services/constants.py`** — Constantes: ESTATUS_ACTIVO, ESTATUS_VACANTE, PERSONAL_ACTIVO/PASIVO, etc.
- **`services/constants_historial.py`** — `registrar_historial_movimiento()`: registra automáticamente en EmployeeMovementHistory
- **`services/generacion_codigo.py`** — `generador_codigos(prefix)`: genera códigos secuenciales (CS_0001, HP_0002)
- **`services/mapa_reporte.py`** — Mapa de configuración de campos y filtros por categoría de reporte
- **`utils/data_formatters.py`** — `CleanZerosMixin`: limpia ceros/None/null/undefined de JSON
- **`filters/filters_personal.py`** — FilterSets: CuentaFilter, EmployeeFilter, AsigTrabajoFilter, EmployeeFamilyFilter

---

## 3. Backend NestJS (File Manager)

### 3.1 Estructura del Proyecto

```
NestJS-Files/
├── nest-cli.json
├── package.json
├── tsconfig.json
├── nestjs.dockerfile
├── .env.example                    # NEST_CORS, NEST_PORT
├── uploads/                        # Archivos subidos (creado en runtime)
│   └── {cedula}/
│       └── profile/                # Fotos de perfil
├── test/
│   └── app.e2e-spec.ts
└── src/
    ├── main.ts                     # bootstrap() - puerto 5000
    ├── app.module.ts               # Módulo raíz
    ├── app.controller.ts           # GET / → "Hello World!"
    ├── app.service.ts
    ├── file-save/                  # Módulo de subida
    │   ├── file-save.module.ts     # MulterModule.register({ dest: './uploads' })
    │   ├── file-save.controller.ts # POST endpoints
    │   ├── file-save.service.ts    # Lógica de guardado
    │   └── file-validation-pipe/
    │       └── file-validation-pipe.pipe.ts  # Validación + Sharp
    └── read-file/                  # Módulo de lectura
        ├── read-file.module.ts     # ServeStaticModule
        ├── read-file.controller.ts # GET endpoints
        └── read-file.service.ts    # Streaming de archivos
```

### 3.2 Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Health check ("Hello World!") |
| POST | `/file-save/upload/:folderId` | Subir archivo (reemplaza contenido de la carpeta) |
| POST | `/file-save/upload/profile/:folderId` | Subir foto de perfil (subcarpeta `profile/`) |
| GET | `/read-file/:folderId` | Stream primer PDF/imagen de la carpeta |
| GET | `/read-file/profile/:folderId` | Stream primera imagen de `profile/` |

### 3.3 Procesamiento de Archivos

**Subida (Multer):**
- Almacenamiento temporal en `./uploads/temp/`
- `FileInterceptor('file')` captura el archivo
- `FileValidationPipePipe` valida MIME y procesa con **Sharp**
- Servicio mueve el archivo a destino final, eliminando archivos previos

**Sharp (FileValidationPipePipe):**
- MIME permitidos: `image/jpeg`, `image/jpg`, `image/png`
- Redimensiona: 1024×768, `fit: contain`, `position: center`
- **Bug:** llama `.png({force:true})` luego `.jpeg({force:true})` — el último gana, por lo que **todas las imágenes se convierten a JPEG**

### 3.4 Dependencias Clave

| Paquete | Versión | Propósito |
|---|---|---|
| @nestjs/common/core/platform-express | ^11.0.1 | Framework |
| @nestjs/serve-static | ^5.0.3 | Archivos estáticos |
| sharp | ^0.34.4 | Procesamiento de imágenes |
| helmet | ^8.1.0 | **(instalado pero NO usado)** |
| date-fns | ^4.1.0 | **(instalado pero NO usado)** |
| uuid | ^11.1.0 | **(instalado pero NO usado)** |

### 3.5 Observaciones del Módulo NestJS

- **Sin base de datos** — todo es filesystem
- **Sin autenticación** — no hay guards, no hay rate limiting
- **Sin sanitización** — `folderId` se usa directamente en rutas del filesystem (riesgo de **directory traversal**)
- **Condición de carrera** — `saveOneFile`/`saveProfile` eliminan archivos existentes antes de mover el nuevo
- **Variables de entorno inconsistentes** — `main.ts` lee `process.env.PORT` pero `.env.example` define `NEST_PORT`
- **Documentación desactualizada** — `DOCUMENTATION.md` describe endpoints de "recipes" que no existen en código

---

## 4. Frontend NextJS

### 4.1 Estructura del Proyecto

```
NextJS/
├── next.config.ts                       # bodySizeLimit: 250mb
├── auth.config.ts                       # NextAuth credentials provider
├── auth.ts                              # NextAuth instance (JWT, 5min)
├── package.json                         # Next.js 16.1, React 19.2
├── tsconfig.json                        # Paths: @/*, #/*, $/*
├── .env / .env.docker / .env.example    # URLs de backends
├── env.d.ts                             # Types de variables de entorno
├── actions/                             # Server Actions raíz
│   └── auth-actions.ts                  # loginAction()
├── types/
│   ├── next-auth.d.ts                   # Augmentación de tipos de sesión
│   └── types.ts                         # Interfaces compartidas
├── public/
├── src/
│   ├── proxy.ts                         # Middleware NextAuth (protección rutas)
│   ├── app/
│   │   ├── layout.tsx                   # Root layout
│   │   ├── page.tsx                     # Redirige a /login
│   │   ├── not-found.tsx                # Página 404 animada
│   │   ├── api/auth/[...nextauth]/      # NextAuth handler
│   │   ├── (auth)/                      # Rutas públicas
│   │   │   ├── layout.tsx
│   │   │   └── login/page.tsx           # LoginForm
│   │   └── (protected)/                 # Rutas autenticadas
│   │       ├── admin/page.tsx           # Dashboard wrapper
│   │       └── dashboard/
│   │           ├── layout.tsx           # SessionProvider + Toaster
│   │           ├── page.tsx             # Dashboard principal (tarjetas módulos)
│   │           ├── seguridad/           # Módulo Seguridad
│   │           │   └── gestionar-usuarios/
│   │           │       ├── registrar/   # RegisterForm
│   │           │       └── modificar/   # TableUser + update
│   │           ├── gestion-trabajadores/ # Módulo Trabajadores
│   │           │   ├── personal-trabajador/
│   │           │   │   ├── registrar/    # MultiStepForm (7 pasos)
│   │           │   │   ├── consultar/    # TableEmployee
│   │           │   │   └── familiares/   # Agregar/consultar
│   │           │   ├── ubicacion-administrativa/
│   │           │   ├── movimientos/
│   │           │   ├── reportes/
│   │           │   ├── retroalimentacion/
│   │           │   └── cargos/
│   │           └── gestion-pasivos/     # Módulo Pasivos
│   │               ├── personal-jubilado/
│   │               ├── cargos/
│   │               ├── movimientos/
│   │               └── reportes/
│   ├── components/                      # Componentes compartidos
│   │   ├── login-form.tsx
│   │   ├── auth-timer.tsx               # Timeout inactividad (10 min)
│   │   ├── layout/                      # HeaderLayout, PageLayout
│   │   └── ui/                          # shadcn/ui components
│   └── lib/
│       ├── utils.ts                     # cn(), apiFetchGet(), calcularEdad()
│       └── types/                       # employee.ts, codigo.ts, hr.ts
```

### 4.2 Autenticación (NextAuth v5 beta)

**Flujo de login:**
1. Usuario ingresa cédula + password en `LoginForm`
2. Client llama `loginAction()` → `signIn("credentials", {...})`
3. NextAuth ejecuta `authorize()` en `auth.config.ts`:
   - Valida con Zod (`signInSchema`)
   - POST a Django: `{DJANGO_API_URL_SERVER}accounts/login/`
4. Django devuelve datos del usuario: id, name, role, department, cedula, phone, email, jerarquía organizacional
5. JWT se crea con esos datos (callbacks `jwt` y `session`)
6. Redirige a `/dashboard`

**Protección de rutas (`src/proxy.ts`):**
- Rutas públicas: `/`, `/login`, `/register`
- Usuario no logueado → redirige a `/login`
- Usuario logueado → redirige a `/dashboard`
- Excluye archivos estáticos vía matcher

**Timeout de inactividad (`auth-timer.tsx`):**
- 10 minutos total, avisa a los 5
- Escucha eventos mouse/teclado/touch
- Cierra sesión al expirar

### 4.3 Módulos del Dashboard

#### Seguridad

| Ruta | Descripción |
|---|---|
| `/dashboard/seguridad/gestionar-usuarios/registrar` | Registrar usuario (cédula, password, rol, departamento) |
| `/dashboard/seguridad/gestionar-usuarios/modificar` | Buscar/editar usuarios, activar/suspender |

#### Gestión de Trabajadores

| Sección | Rutas |
|---|---|
| **Personal** | `registrar` (formulario multi-step 7 pasos), `consultar` (búsqueda + tabla detalle), `familiares/agregar-familiar`, `familiares/consultar` |
| **Ubicación Administrativa** | `crear-ubicacion`, `crear-ubicacion-administrativa-direccion`, `actualizar-ubicacion`, `listado-ubicacion-administrativa` |
| **Movimientos** | `asignar-codigo`, `asignar-codigo-especial`, `cambiar-codigo`, `cambiar-estatus`, `cambiar-pasivo`, `consultar` |
| **Reportes** | Dashboard, `empleados`, `familiares`, `egresados`, `codigos` |
| **Retroalimentación** | Gestión de organismos adscritos, discapacidades, patologías, alergias + generación Excel |
| **Cargos** | `crear-codigo`, `listado-codigo` |

#### Gestión de Pasivos

| Sección | Rutas |
|---|---|
| **Personal Jubilado** | `registrar` (multi-step), `consultar`, `familiares/agregar-familiar`, `familiares/consultar` |
| **Cargos** | `crear-codigo`, `listado-codigo` |
| **Movimientos** | `cambiar-estatus`, `cambiar-pasivo` |
| **Reportes** | `pasivos` |

### 4.4 Integración con Backends

#### Conexión Django (API principal)

```
NEXT_PUBLIC_DJANGO_API_URL_SERVER = "http://localhost:8000/api/"    # Servidor
NEXT_PUBLIC_DJANGO_API_URL        = "http://localhost:8000/api/"    # Cliente
```

**Patrón de datos:**
```
Server Action ("use server") → fetch(DJANGO_API_URL_SERVER + endpoint) → Django
Cliente: useSWR("key", action) → cachea y revalida
```

**Endpoint genérico (`apiFetchGet`):**
```typescript
export const apiFetchGet = async <T>(url: string) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    { headers: { "Content-Type": "application/json" } }
  );
  return (await response.json()) as ApiResponse<T>;
};
```

#### Conexión NestJS (Archivos)

```
NEXT_PUBLIC_NEST_API_URL_SERVER = "http://localhost:5000/"
```

**Uso exclusivo para:**
- Subir foto de perfil: `POST file-save/upload/profile/{cedula}` (FormData)
- Leer foto de perfil: `GET read-file/profile/{cedula}`

### 4.5 Server Actions

Todas las operaciones CRUD se realizan mediante Server Actions (`"use server"`):

| Módulo | Archivo | Acciones |
|---|---|---|
| Auth | `actions/auth-actions.ts` | loginAction |
| Seguridad | `registrar/action/register-action.ts` | registerAction |
| Seguridad | `modificar/action/update-user-action.ts` | updateAction, blockUserAction |
| Trabajadores | `registrar/actions/registerEmployeesActions.ts` | registerEmployee |
| Trabajadores | `registrar/actions/formStepActions.ts` | registerEmployeeSteps (multi-step) |
| Trabajadores | `actions/updateEmployee.ts` | updateEmployee |
| Trabajadores | `familiares/.../create-family-actions.ts` | createFamilyMember |
| Trabajadores | `movimientos/*/actions/` | changeCode, changeStatus, gestionPasivo |
| Trabajadores | `ubicacion-administrativa/*/actions/` | create/update dependencies, directions, coordinations |
| Trabajadores | `retroalimentacion/actions/` | CRUD organismos, alergias, discapacidades, patologías |
| Trabajadores | `cargos/*/actions/` | createCode, updateCode |
| Pasivos | (paralelo a trabajadores) | Acciones para pasivos |

### 4.6 Estado y Data Fetching

| Librería | Propósito |
|---|---|
| **SWR** | Caching y revalidación de datos del servidor |
| **Zustand** | Estado local mínimo (`searchParams` para búsquedas entre componentes) |
| **React Hook Form + Zod** | Validación de formularios |
| **@formity/react** | Formularios multi-paso (registro empleado 7 pasos) |
| **TanStack React Table** | Tablas de datos con ordenamiento y paginación |

### 4.7 UI Components (shadcn/ui + Radix)

Componentes base: Button, Card, Dialog, Sheet, Sidebar, DropdownMenu, Select, Tabs, Table, Calendar, Popover, Toast (sonner), Skeleton, Badge, Avatar, Breadcrumb, Input, Textarea, Label, Switch, Slider, Progress, RadioGroup, Checkbox, Tooltip, Command, ContextMenu, Menubar, NavigationMenu, HoverCard, Collapsible, Carousel, Chart, Accordion, Alert, AlertDialog, AspectRatio, Separator, ScrollArea, Toggle, ToggleGroup, Pagination, InputOTP, Kbd, Spinner.

### 4.8 Variables de Entorno

| Variable | Dev (localhost) | Docker (172.16.10.209) |
|---|---|---|
| `NEXT_PUBLIC_DJANGO_API_URL_SERVER` | `http://localhost:8000/api/` | `http://172.16.10.209:8000/api/` |
| `NEXT_PUBLIC_DJANGO_API_URL` | `http://localhost:8000/api/` | `http://172.16.10.209:8000/api/` |
| `NEXT_PUBLIC_NEST_API_URL_SERVER` | `http://localhost:5000/` | `http://172.16.10.209:5000/` |
| `NEXT_PUBLIC_NEST_API_URL` | `http://localhost:5000/` | `http://172.16.10.209:5000/` |
| `NEXTAUTH_URL` | `http://localhost:3000` | `http://172.16.10.209:3000` |
| `AUTH_SECRET` | (hardcodeada) | (hardcodeada) |

---

## 5. Flujo de Datos Típico

### 5.1 Login

```
Usuario → LoginForm → loginAction() → signIn("credentials")
  → auth.config.ts (Zod + fetch Django accounts/login/)
  → Django valida password → devuelve user data
  → NextAuth crea JWT → session establecida
  → Redirige a /dashboard
```

### 5.2 Registro de Empleado (7 pasos)

```
MultiStepForm (7 pasos, @formity):
  1. Información básica (nombres, cédula, fecha nacimiento, sexo, estado civil, contacto)
  2. Nivel académico (carrera, mención, institución, fechas)
  3. Formación complementaria (capacitaciones)
  4. Antecedentes de servicio (instituciones previas)
  5. Perfil de salud (grupo sanguíneo, alergias, patologías, discapacidades)
  6. Perfil físico (tallas de camisa, pantalón, zapatos)
  7. Datos de vivienda (dirección, estado/municipio/parroquia, condición)

Al submit:
  Server Action → POST Django employees_register/ (todos los datos)
  Si hay foto: POST NestJS file-save/upload/profile/{cedula} (FormData)
```

### 5.3 Asignación de Código

```
Formulario Asignar Código → Server Action → PATCH Django asignar_codigo/{id}
  → Django actualiza AsigTrabajo.employee + registra EmployeeMovementHistory
  → Respuesta: success/error
```

### 5.4 Reporte PDF

```
Formulario Reporte → Server Action → POST Django reports/pdf/
  → Django: selecciona datos según filtros + categoría
  → ReportLab genera PDF en memoria
  → Stream response → NextJS lo recibe y renderiza o descarga
```

### 5.5 Integración General

```
┌──────────┐   Server Actions    ┌──────────┐   SQL    ┌────────────┐
│  NextJS  │ ──────────────────▶ │  Django  │ ────────▶│ PostgreSQL │
│          │ ◀────────────────── │          │ ◀────────│  (externa) │
│  :3000   │     JSON Response   │  :8000   │          └────────────┘
│          │                     │          │
│          │   FormData          └──────────┘
│          │ ──────────────────▶ ┌──────────┐
│          │   file-save/upload  │  NestJS  │ ┌──────────────┐
│          │ ◀────────────────── │  :5000   │ │  Filesystem  │
│          │   read-file/profile │          │ │  ./uploads/  │
└──────────┘                     └──────────┘ └──────────────┘
```

---

## 6. Despliegue

### 6.1 Docker Compose (`compose.yml`)

```yaml
Servicios:
  django:    puerto 8000, red: backend
  nestjs:    puerto 5000, red: file_manager (volumen: /var/www/backup/uploadsNestFS)
  nextjs:    puerto 3000, redes: backend + file_manager (depende de django y nestjs)
  portainer: puerto 9443, volumen portainer_data

Redes: default (portainer_network), backend, file_manager, postgres
Volúmenes: portainer_data
```

**Nota:** No hay servicio PostgreSQL en el compose — la BD es externa.

### 6.2 Dockerfiles

- **Django:** `python:3.x` → pip install → gunicorn
- **NestJS:** `node` → pnpm install → pnpm start
- **NextJS:** `node:lts` → pnpm install → pnpm dev

---

## 7. Observaciones y Riesgos

### 7.1 Seguridad

| Riesgo | Detalle |
|---|---|
| **Secret Key hardcodeada** | Django `SECRET_KEY` visible en `settings.py` |
| **DEBUG=True** | En lo que parece configuración de producción |
| **Password en .env** | BD: `admin`, script wait: `3054=HitM` |
| **JWT no activo** | `djangorestframework_simplejwt` instalado pero no configurado |
| **Sin autenticación NestJS** | No hay guards, cualquier cliente puede subir/leer archivos |
| **Directory traversal** | NestJS usa `folderId` directamente en rutas del FS |
| **AUTH_SECRET hardcodeada** | NextJS `.env` contiene secretos de autenticación |

### 7.2 Calidad de Código

| Issue | Detalle |
|---|---|
| **Sin tests Django** | No hay archivos de test en ninguna app |
| **Tests NestJS mínimos** | Solo verifican que el componente existe |
| **Naming inconsistente** | Mezcla de español e inglés en vistas y URLs |
| **Código no usado** | helmet, date-fns, uuid (NestJS); celery, simplejwt (Django) |
| **Bug Sharp** | PNG→JPEG inconsistente, el último `force:true` gana |

### 7.3 Configuración

| Issue | Detalle |
|---|---|
| **PORT vs NEST_PORT** | `.env.example` define `NEST_PORT=5000`, pero `main.ts` lee `process.env.PORT` |
| **Documentación desactualizada** | NestJS DOCUMENTATION.md describe endpoints que no existen |
| **BD no containerizada** | PostgreSQL no está en compose.yml, asume instancia externa |

### 7.4 Operacional

| Issue | Detalle |
|---|---|
| **Condición de carrera** | NestJS elimina archivos antes de mover, riesgoso con concurrencia |
| **Sin rate limiting** | No hay límite de peticiones en ningún servicio |
| **Sin límite de tamaño** | bodySizeLimit 250MB en NextJS, sin límite en NestJS |
| **CORS permisivo** | Múltiples orígenes permitidos en Django |
