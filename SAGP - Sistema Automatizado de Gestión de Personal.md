
## 1. Descripción General

**SAGP** es una aplicación full-stack para la gestión integral de personal del Organismo de Comisión Nacional de Telecomunicación  (CONATEL). El sistema permite administrar información de empleados, asignaciones de trabajo, datos familiares, perfil de salud, formación académica, y más.

---

## 2. Arquitectura del Sistema

### 2.1 Stack Tecnológico

| Capa                    | Tecnología            | Versión  |
| ----------------------- | --------------------- | -------- |
| **Frontend**            | Next.js (React)       | 16.1.3   |
| **Backend**             | Django REST Framework | 5.2.7    |
| **Base de Datos**       | PostgreSQL            | 18       |
| **Gestión de Archivos** | NestJS                | 11.0.1   |
| **Contenedores**        | Docker Compose        | -        |
| **Autenticación**       | NextAuth.js           | 5.0 Beta |
|                         |                       |          |

### 2.2 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Next.js    │────▶│    Django    │────▶│  PostgreSQL  │    │
│  │  (Frontend)  │     │   (Backend)  │     │     (DB)     │    │
│  │   :3000      │     │    :8000     │     │    :5432     │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                    │                    │             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │  NestJS FS   │     │   pgAdmin    │     │  Portainer   │    │
│  │ (File Mgr)   │     │   :8080      │     │    :9443     │    │
│  │   :5000      │     │              │     │              │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Redes Docker

| Red | Driver | Propósito |
|-----|--------|----------|
| `default` | bridge | Red principal de Portainer |
| `backend` | bridge | Comunicación Frontend ↔ Backend |
| `postgres` | bridge | Conexión a base de datos |
| `file_manager` | bridge | Gestión de archivos |

---

## 3. Estructura del Proyecto

```
SISTEMA/
├── BACKEND/                 # Aplicación Django
│   ├── SAGP/              # Configuración principal Django
│   │   ├── settings.py     # Configuraciones
│   │   ├── urls.py         # Rutas principales
│   │   ├── wsgi.py         # Entry point WSGI
│   │   └── asgi.py         # Entry point ASGI
│   ├── RAC/                # App principal (Gestión de Personal)
│   │   ├── models/         # Modelos de datos
│   │   ├── views/          # Vistas API
│   │   ├── serializers/    # Serializadores DRF
│   │   ├── services/       # Lógica de negocio
│   │   ├── urls.py         # Rutas de la app
│   │   └── filters/        # Filtros personalizados
│   ├── USER/               # App de usuarios
│   ├── requirements.txt    # Dependencias Python
│   ├── django.dockerfile   # Imagen Docker
│   └── manage.py           # CLI de Django
│
├── NextJS/                 # Aplicación Next.js
│   ├── src/
│   │   ├── app/            # App Router
│   │   │   ├── (auth)/    # Rutas de autenticación
│   │   │   ├── (protected)/ # Rutas protegidas
│   │   │   │   ├── admin/
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── gestion-trabajadores/
│   │   │   │   │   ├── gestion-pasivos/
│   │   │   │   │   └── seguridad/
│   │   │   │   └── layout.tsx
│   │   │   ├── api/       # Rutas API
│   │   │   └── page.tsx   # Página principal
│   │   ├── actions/       # Server Actions
│   │   ├── components/     # Componentes React
│   │   ├── hooks/         # Custom Hooks
│   │   ├── lib/           # Utilidades
│   │   └── constants/     # Constantes
│   ├── next.config.ts     # Configuración Next.js
│   ├── package.json       # Dependencias Node
│   └── nextjs.dockerfile   # Imagen Docker
│
├── NestJS-Files/           # Gestor de archivos
│   ├── src/
│   │   ├── file-save/     # Módulo para guardar archivos
│   │   ├── read-file/     # Módulo para leer archivos
│   │   ├── app.module.ts  # Módulo principal
│   │   ├── app.controller.ts
│   │   └── app.service.ts
│   └── package.json       # Dependencias NestJS
│
├── compose.yml             # Docker Compose
└── .env                    # Variables de entorno
```

---

## 4. Base de Datos - Modelos

### 4.1 Modelos Principales (RAC App)

#### Empleados
| Modelo                        | Descripción                   |
| ----------------------------- | ----------------------------- |
| `Employee`                    | Datos personales del empleado |
| `AsigTrabajo`                 | Asignación de trabajo/cargo   |
| `Denominacioncargo`           | Cargos/Denominaciones         |
| `Denominacioncargoespecifico` | Cargos específicos            |

#### Estructura Organizacional
| Modelo | Descripción |
|--------|-------------|
| `Dependencias` | Dependencias organizacionales |
| `DireccionGeneral` | Direcciones generales |
| `DireccionLinea` | Direcciones de línea |
| `Coordinaciones` | Coordinaciones |
| `OrganismoAdscrito` | Organismos adsueltos |

#### Datos Complementarios
| Modelo | Descripción |
|--------|-------------|
| `Sexo` | Sexo del empleado |
| `EstadoCivil` | Estado civil |
| `NivelAcademico` | Niveles académicos |
| `Grado` | Grados militares |
| `TipoNomina` | Tipos de nómina |
| `Estatus` | Estados del empleado |
| `TipoPersonal` | Tipo (Activo/Pasivo) |

#### Perfil del Empleado
| Modelo | Descripción |
|--------|-------------|
| `PerfilSalud` | Salud (alergias, patologías, sangre) |
| `PerfilFisico` | Tallas (camisa, pantalón, zapatos) |
| `DatosVivienda` | Información de vivienda |
| `FormacionAcademica` | Estudios realizados |
| `AntecedentesServicio` | Historial laboral |
| `ContactoEmergencia` | Contactos de emergencia |

#### Catalogos
| Modelo | Descripción |
|--------|-------------|
| `TallaCamisas` | Tallas de camisas |
| `TallaPantalones` | Tallas de pantalones |
| `TallaZapatos` | Tallas de zapatos |
| `GrupoSanguineo` | Grupos sanguíneos |
| `Alergias` | Catálogo de alergias |
| `PatologiasCronicas` | Enfermedades crónicas |
| `Discapacidades` | Tipos de discapacidad |

#### Familiares
| Modelo | Descripción |
|--------|-------------|
| `Parentesco` | Tipos de parentesco |
| `Employeefamily` | Datos familiares |

### 4.2 Modelo de Usuario (USER App)

| Campo         | Tipo          | Descripción        |
| ------------- | ------------- | ------------------ |
| `password`    | CharField     | Contraseña         |
| `is_active`   | BooleanField  | Estado activo      |
| `is_staff`    | BooleanField  | Es administrador   |
| `date_joined` | DateTimeField | Fecha de registro  |

---

## 5. API REST - Endpoints

### 5.1 Endpoints del Backend (Django)

```
/api/
├── employee/                    # Gestión de empleados
│   ├── GET    /                # Listar empleados
│   ├── POST   /                # Crear empleado
│   ├── GET    /{cedula}/      # Obtener empleado
│   ├── PUT    /{cedula}/      # Actualizar empleado
│
├── cargos/                     # Denominaciones de cargo
├── direcciones-generales/       # Direcciones generales
├── direcciones-linea/          # Direcciones de línea
├── coordinaciones/             # Coordinaciones
├── dependencias/               # Dependencias
├── organismo-adscrito/          # Organismos adsueltos
├── niveles-academicos/         # Niveles académicos
├── grados/                     # Grados militares
├── tipos-nomina/               # Tipos de nómina
├── estatus/                    # Estados de empleados
├── sexos/                      # Sexos
├── estados-civiles/            # Estados civiles
├── grupos-sanguineos/          # Grupos sanguíneos
├── alergias/                   # Catálogo de alergias
├── patologias/                 # Patologías crónicas
├── incapacidades/              # Discapacidades
├── vivienda/                   # Datos de vivienda
├── perfil-salud/              # Perfil de salud
├── perfil-fisico/             # Perfil físico
├── formacion-academica/        # Formación académica
├── antecedentes-servicio/      # Antecedentes de servicio
├── contacto-emergencia/         # Contactos de emergencia
├── familiares/                 # Datos familiares
├── auth/                       # Autenticación
│   ├── POST   /login/         # Iniciar sesión
│   ├── POST   /logout/        # Cerrar sesión
│   └── GET    /user/          # Obtener usuario actual
│
└── docs/                       # Documentación Swagger
```

### 5.2 Endpoints del File Manager (NestJS)

```
/api/
├── upload/                     # Subir archivos
├── download/{filename}         # Descargar archivos
├── list/                       # Listar archivos
```

---

## 6. Frontend - Next.js

### 6.1 Estructura de Páginas

```
/ (root)
├── /                           # Página de inicio/login
├── /(auth)/
│   └── /signin                # Página de inicio de sesión
│
└── /(protected)/
    └── /dashboard/
        ├── /                  # Dashboard principal
        ├── /admin/            # Panel de administración
        ├── /gestion-trabajadores/
        │   ├── /              # Lista de trabajadores
        │   ├── /nuevo         # Crear trabajador
        │   ├── /{id}          # Detalle de trabajador
        │   └── /{id}/editar   # Editar trabajador
        │
        ├── /gestion-pasivos/
        │   └── /              # Gestión de pasivos
        │
        └── /seguridad/
            └── /              # Gestión de seguridad
```

### 6.2 Componentes Principales

| Componente      | Descripción                    |
| --------------- | ------------------------------ |
| `LoginForm`     | Formulario de inicio de sesión |
| `InputForm`     | Campo de entrada genérico      |
| `SelectForm`    | Selector genérico              |
| `FormDate`      | Selector de fecha              |
| `FormTextArea`  | Campo de texto largo           |
| `FormCheck`     | Casilla de verificación        |
| `AuthTimer`     | Temporizador de sesión         |
| `SigninButton`  | Botón de inicio de sesión      |
| `SignoutButton` | Botón de cierre de sesión      |

### 6.3 Librerías UI

| Librería          | Propósito              |
| ----------------- | ---------------------- |
| Radix UI          | Componentes primitives |
| Tailwind CSS      | Estilos (v4)           |
| Lucide React      | Iconos                 |
| Recharts          | Gráficos               |
| React Hook Form   | Formularios            |
| Zod               | Validación de esquemas |
| TanStack Table    | Tablas avanzadas       |
| Sonner            | Notificaciones toast   |
| Radix UI Toast    | Notificaciones         |
| Radix UI Dialog   | Diálogos modales       |
| Radix UI Dropdown | Menús desplegables     |

---

## 7. Docker - Configuración

### 7.1 Servicios

#### PostgreSQL
```yaml
postgres:
  image: postgres:18
  ports:
    - "5400:5432"
  environment:
    POSTGRES_DB: ${DB_NAME}
    POSTGRES_USER: ${DB_USER}
    POSTGRES_PASSWORD: ${DB_PASSWORD}
  volumes:
    - pgdata:/var/lib/postgresql
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres -d SIGEP"]
```

#### Django (Backend)
```yaml
django:
  build: ./BACKEND
  ports:
    - "8000:8000"
  environment:
    - DJANGO_DB_HOST=${DB_HOST}
    - DJANGO_DB_PORT=${DB_PORT}
    - DJANGO_DB_NAME=${DB_NAME}
    - DJANGO_DB_USER=${DB_USER}
    - DJANGO_DB_PASSWORD=${DB_PASSWORD}
  depends_on:
    postgres:
      condition: service_healthy
```

#### Next.js (Frontend)
```yaml
nextjs:
  build: ./NextJS
  ports:
    - "3000:3000"
  environment:
    - NEXT_PUBLIC_DJANGO_API_URL=http://django:8000/api/
  depends_on:
    - django
```

#### NestJS (File Manager)
```yaml
nestjs:
  build: ./NestJS-Files
  ports:
    - "5000:5000"
  volumes:
    - uploadsNestFS:/app/NestFS-Files/src/uploads
```

#### pgAdmin
```yaml
pgadmin4:
  image: dpage/pgadmin4
  ports:
    - "8080:80"
  environment:
    PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL}
    PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASS}
```

#### Portainer
```yaml
portainer:
  image: portainer/portainer-ce:latest
  ports:
    - "9443:9443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
```

---

## 8. Variables de Entorno

### 8.1 Backend (.env)
```env
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=True
DJANGO_DB_NAME=SIGEP
DJANGO_DB_USER=postgres
DJANGO_DB_PASSWORD=your-password
DJANGO_DB_HOST=postgres-DB
DJANGO_DB_PORT=5432
```

### 8.2 Frontend (.env)
```env
# Desarrollo local
NEXT_PUBLIC_DJANGO_API_URL=http://localhost:8000/api/
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Producción Docker
NEXT_PUBLIC_DJANGO_API_URL=http://django-App:8000/api/
```

---

## 9. Autenticación

### 9.1 NextAuth.js Configuration

```typescript
// auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password" },
      },
      authorize: async (credentials) => {
        // Lógica de autenticación con Django
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
});
```

---

## 10. Despliegue

### 10.1 Requisitos

- Docker Desktop
- Docker Compose
- PostgreSQL 18 (si se ejecuta localmente)

### 10.2 Comandos de Despliegue

```bash
# Desarrollo local
docker compose up -d

# Reconstruir servicios
docker compose up -d --build

# Ver logs
docker compose logs -f

# Detener servicios
docker compose down

# Limpiar volúmenes
docker compose down -v
```

### 10.3 URLs de Acceso

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/ |
| pgAdmin | http://localhost:8080 |
| Portainer | https://localhost:9443 |
| File Manager | http://localhost:5000 |

---

## 11. Workflows de Datos

### 11.1 Registro de Empleado

```
1. Usuario accede a /dashboard/gestion-trabajadores/nuevo
2. Formulario captura datos personales
3. POST /api/employee/
4. Django valida y guarda en PostgreSQL
5. Respuesta con ID del empleado creado
6. Redirección a detalle del empleado
```

### 11.2 Autenticación

```
1. Usuario ingresa credenciales en /signin
2. NextAuth valida con credentials provider
3. Django verifica usuario/password
4. JWT token generado
5. Sesión establecida en NextAuth
6. Redirección a /dashboard
```

---

## 12. Seguridad

### 12.1 Medidas Implementadas

| Medida | Descripción |
|--------|-------------|
| CORS | Configurado para orígenes específicos |
| CSRF | Middleware habilitado en Django |
| JWT | Tokens para autenticación |
| HTTPS | Recomendado para producción |
| Sanitización | Validación de inputs con Zod |
| Historial | Registro de cambios con django-simple-history |

### 12.2 Recomendaciones para Producción

1. Cambiar `DEBUG=False` en settings.py
2. Usar variables de entorno para secrets
3. Configurar HTTPS/SSL
4. Implementar rate limiting
5. Configurar backups de base de datos
6. Usar secretos seguros en producción

---

## 13. Mantenimiento

### 13.1 Comandos Útiles

```bash
# Django
docker exec django-App python manage.py migrate
docker exec django-App python manage.py createsuperuser
docker exec django-App python manage.py collectstatic

# Base de datos
docker exec postgres-DB pg_dump -U postgres SIGEP > backup.sql
docker exec -i postgres-DB psql -U postgres SIGEP < backup.sql

# Logs
docker compose logs django
docker compose logs nextjs
docker compose logs postgres
```

---

## 14. Glosario

| Término | Descripción                                 |
| ------- | ------------------------------------------- |
| RAC     | Registro de Administrativo y Control        |
| SAGP    | Sistema Automatizado de Gestión de Personal |
| FANB    | Fuerza Armada Nacional Bolivariana          |
| DRF     | Django REST Framework                       |
| SSR     | Server-Side Rendering                       |
| SSG     | Static Site Generation                      |
| CORS    | Cross-Origin Resource Sharing               |
| CSRF    | Cross-Site Request Forgery                  |

---

## 15. Contacto y Soporte

Para soporte técnico, contactar al equipo de desarrollo del proyecto SAGP.