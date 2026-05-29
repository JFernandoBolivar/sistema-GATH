# File Manager - Documentación Completa

## Información General

- **Nombre del Proyecto**: File Manager
- **Versión**: 0.0.1
- **Framework**: NestJS v11.0.1
- **Lenguaje**: TypeScript
- **Runtime**: Node.js
- **Puerto por defecto**: 4000
- **Manejo de archivos**: Multer + Express

## Descripción del Proyecto

File Manager es una API REST desarrollada con NestJS que permite la gestión de archivos (subida, almacenamiento y descarga) organizados por carpetas. El sistema está especialmente diseñado para manejar archivos PDF, imágenes (PNG, JPEG) y recetas múltiples.

## Arquitectura del Proyecto

```
src/
├── app.controller.ts          # Controlador principal
├── app.service.ts            # Servicio principal
├── app.module.ts             # Módulo raíz
├── main.ts                   # Punto de entrada de la aplicación
├── file-save/                # Módulo para guardar archivos
│   ├── file-save.controller.ts
│   ├── file-save.service.ts
│   ├── file-save.module.ts
│   └── file-validation-pipe/
│       └── file-validation-pipe.pipe.ts
└── read-file/                # Módulo para leer archivos
    ├── read-file.controller.ts
    ├── read-file.service.ts
    └── read-file.module.ts
```

## Estructura de Carpetas del Sistema de Archivos

```
uploads/
├── temp/                     # Carpeta temporal
│   ├── {archivo_temporal}    # Archivos individuales temporales
│   └── arrayFiles/           # Archivos múltiples temporales
│       └── {archivo_temporal}
└── {folderId}/               # Carpetas organizadas por ID
    ├── {archivo_principal}   # Archivo principal (PDF/imagen)
    └── recipes/              # Subcarpeta de recetas
        └── {archivos_receta}
```

## Configuración de la Aplicación

### main.ts

```typescript
// Puerto: 4000
// CORS habilitado para 172.16.26.48:3000
// Métodos permitidos: POST, GET
```

### Dependencias Principales

```json
{
  "@nestjs/common": "^11.0.1",
  "@nestjs/core": "^11.0.1",
  "@nestjs/platform-express": "^11.0.1",
  "@nestjs/serve-static": "^5.0.3",
  "multer": "integrado con platform-express"
}
```

## API Endpoints

### 1. Endpoint Principal

**GET /**

- **Descripción**: Endpoint de bienvenida
- **Respuesta**: `"Hello World!"`

### 2. Módulo File-Save (Guardado de Archivos)

#### 2.1 Subir Archivo Único

**POST /file-save/upload/:folderId**

- **Descripción**: Sube un archivo individual a una carpeta específica
- **Content-Type**: `multipart/form-data`
- **Parámetros**:
  - `folderId` (path): Identificador de la carpeta destino
  - `file` (form-data): Archivo a subir

**Proceso**:

1. Guarda temporalmente en `./uploads/temp/`
2. Valida el tipo de archivo
3. Crea la carpeta destino si no existe
4. Mueve el archivo a `./uploads/{folderId}/`

**Respuesta de éxito**: HTTP 200 - "Archivo Guardado"
**Respuesta de error**: HTTP 300 - "Error Al Mover El Archivo"

#### 2.2 Subir Múltiples Archivos (Recetas)

**POST /file-save/upload/:folderId/recipe**

- **Descripción**: Sube hasta 5 archivos como recetas
- **Content-Type**: `multipart/form-data`
- **Parámetros**:
  - `folderId` (path): Identificador de la carpeta destino
  - `recipe` (form-data): Array de hasta 5 archivos

**Proceso**:

1. Guarda temporalmente en `./uploads/temp/arrayFiles/`
2. Crea estructura `./uploads/{folderId}/recipes/`
3. Mueve todos los archivos a la carpeta de recetas

**Limitaciones**: Máximo 5 archivos por petición

### 3. Módulo Read-File (Lectura de Archivos)

#### 3.1 Obtener Archivo Principal

**GET /read-file/:folderId**

- **Descripción**: Retorna el primer archivo PDF/imagen encontrado en la carpeta
- **Parámetros**: `folderId` (path): Identificador de la carpeta
- **Búsqueda**: En `./uploads/{folderId}/`
- **Filtros**: Archivos con extensión .pdf, .png, .jpg, .jpeg

**Respuesta exitosa**:

```typescript
StreamableFile {
  type: string,        // MIME type del archivo
  disposition: 'inline' // Para mostrar en el navegador
}
```

**Error**: HTTP 404 - "Archivo no encontrado"

#### 3.2 Obtener Lista de Recetas

**GET /read-file/:folderId/recipes**

- **Descripción**: Lista todos los archivos en la carpeta de recetas
- **Parámetros**: `folderId` (path): Identificador de la carpeta
- **Búsqueda**: En `./uploads/{folderId}/recipes/`

**Estructura de respuesta**:

```json
{
  "success": true,
  "files": [
    {
      "name": "archivo.pdf",
      "size": 1024,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error**: HTTP 404 - "No se encontró la carpeta de recetas"

#### 3.3 Obtener Archivo de Receta Específico

**GET /read-file/:folderId/recipes/:fileName**

- **Descripción**: Retorna un archivo específico de la carpeta de recetas
- **Parámetros**:
  - `folderId` (path): Identificador de la carpeta
  - `fileName` (path): Nombre del archivo específico

**Respuesta**: StreamableFile con el archivo solicitado

## Validaciones de Archivos

### Tipos MIME Permitidos

```typescript
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
```

### FileValidationPipe

- **Ubicación**: `src/file-save/file-validation-pipe/file-validation-pipe.pipe.ts`
- **Función**: Valida que los archivos subidos tengan tipos MIME permitidos
- **Error**: HTTP 422 - "Tipo de archivo no permitido"

## Configuración Multer

### Para Archivo Individual

```typescript
{
  storage: diskStorage({
    destination: './uploads/temp',
    filename: (req, file, cb) => {
      cb(null, file.originalname); // Mantiene nombre original
    },
  });
}
```

### Para Múltiples Archivos

```typescript
{
  storage: diskStorage({
    destination: './uploads/temp/arrayFiles',
    filename: (req, file, cb) => {
      cb(null, file.originalname); // Mantiene nombre original
    }
  }),
  limits: { files: 5 } // Máximo 5 archivos
}
```

## Códigos de Estado HTTP

| Código | Descripción          | Mensaje                                |
| ------ | -------------------- | -------------------------------------- |
| 200    | OK                   | "Archivo Guardado"                     |
| 300    | Ambiguous            | "Error Al Mover El Archivo"            |
| 404    | Not Found            | "Archivo no encontrado"                |
| 404    | Not Found            | "No se encontró la carpeta de recetas" |
| 422    | Unprocessable Entity | "Tipo de archivo no permitido"         |

## Características Técnicas

### Manejo de Archivos

- **Asíncrono**: Todas las operaciones de archivos usan `fs/promises`
- **Creación automática**: Las carpetas se crean automáticamente si no existen
- **Nombres originales**: Se preservan los nombres originales de los archivos
- **Movimiento**: Los archivos se mueven (no se copian) desde carpetas temporales

### Streaming de Archivos

- **Método**: `fs.createReadStream()`
- **Disposición**: `inline` para mostrar en navegador
- **MIME Types**: Detección automática por extensión

### CORS Configuration

```typescript
app.enableCors({
  origin: 'http://172.16.26.48:3000/',
  methods: 'POST,GET',
});
```

## Scripts de NPM

```json
{
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:prod": "node dist/main",
  "build": "nest build",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:e2e": "jest --config ./test/jest-e2e.json",
  "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
}
```

## Instalación y Configuración

### Prerrequisitos

- Node.js (versión compatible con NestJS 11)
- NPM o Yarn

### Instalación

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

### Estructura de Pruebas

- **Unit tests**: `*.spec.ts` en cada módulo
- **E2E tests**: Carpeta `test/`
- **Coverage**: Configurado con Jest

## Consideraciones de Seguridad

1. **Validación de tipos de archivo**: Solo permite PDF, JPEG y PNG
2. **Límite de archivos**: Máximo 5 archivos por petición de recetas
3. **CORS restrictivo**: Solo permite 172.16.26.48:3000
4. **Validación de rutas**: Previene directory traversal

## Notas de Implementación

- Los archivos temporales se eliminan al moverlos a su ubicación final
- El sistema es stateless: no mantiene información sobre archivos en memoria
- Las operaciones de I/O son no bloqueantes
- Se utiliza el patrón Repository para operaciones de archivos
- Error handling robusto con excepciones específicas de NestJS

## Posibles Mejoras Futuras

1. **Autenticación y autorización** de usuarios
2. **Límites de tamaño de archivo** configurables
3. **Compresión de imágenes** automática
4. **Base de datos** para metadatos de archivos
5. **API de eliminación** de archivos
6. **Versionado de archivos**
7. **Logs de auditoría** para operaciones de archivos
