# 📄 Sistema de Generación de PDFs - Documentación

## Índice

1. [Resumen](#resumen)
2. [Arquitectura](#arquitectura)
3. [Endpoint](#endpoint)
4. [Categorías y Filtros](#categorías-y-filtros)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Integración Frontend](#integración-frontend)
7. [Pendientes](#pendientes)

---

## Resumen

Sistema modular para generación de reportes PDF usando **ReportLab**. Soporta 4 categorías de reportes con filtros dinámicos.

| Categoría      | Descripción                  | Generador                |
| -------------- | ---------------------------- | ------------------------ |
| `empleados`    | Lista de empleados activos   | `EmployeePDFGenerator`   |
| `familiares`   | Empleados con sus familiares | `FamilyPDFGenerator`     |
| `asignaciones` | Códigos de trabajo           | `AssignmentPDFGenerator` |
| `egresados`    | Empleados egresados          | `GraduatePDFGenerator`   |

---

## Arquitectura

```
BACKEND/RAC/services/pdf/
├── __init__.py
├── base_generator.py          # Clase abstracta base
├── templates/
│   ├── __init__.py
│   ├── styles.py              # Colores, fuentes
│   └── components.py          # Headers, tablas, footer
└── generators/
    ├── __init__.py
    ├── employee_pdf.py        # Generador empleados
    ├── family_pdf.py          # Generador familiares
    ├── assignment_pdf.py      # Generador asignaciones
    └── graduate_pdf.py        # Generador egresados
```

---

## Endpoint

```
POST /api/reports/pdf/
Content-Type: application/json
```

### Request Body

```json
{
  "categoria": "string", // Requerido: empleados | familiares | asignaciones | egresados
  "filtros": {} // Opcional: objeto con filtros
}
```

### Response

- **200**: Archivo PDF (Content-Type: application/pdf)
- **400**: Error de validación
- **500**: Error interno

---

## Categorías y Filtros

### 1. Empleados (`categoria: "empleados"`)

**Columnas del PDF:**

- Cédula, Nombres, Apellidos, F. Nacimiento, F. Ingreso, Años APN, Contrato, Sexo, Estado Civil

**Filtros disponibles:**

| Filtro                  | Tipo    | Descripción                      |
| ----------------------- | ------- | -------------------------------- |
| `dependencia_id`        | integer | ID de la dependencia             |
| `direccion_general_id`  | integer | ID de dirección general          |
| `direccion_linea_id`    | integer | ID de dirección de línea         |
| `coordinacion_id`       | integer | ID de coordinación               |
| `sexo_id`               | integer | ID del sexo                      |
| `discapacidad_id`       | integer | ID de discapacidad               |
| `grupo_sanguineo_id`    | integer | ID grupo sanguíneo               |
| `patologia_id`          | integer | ID de patología                  |
| `nomina_id`             | integer | ID tipo de nómina                |
| `grado_id`              | integer | ID del grado                     |
| `cargo_id`              | integer | ID del cargo                     |
| `cargo_especifico_id`   | integer | ID cargo específico              |
| `nivel_academico_id`    | integer | ID nivel académico               |
| `carrera_id`            | integer | ID de carrera                    |
| `mencion_id`            | integer | ID de mención                    |
| `estatus_id`            | integer | ID del estatus                   |
| `tipo_personal`         | integer | ID tipo personal                 |
| `apn_min`               | decimal | Años APN mínimos                 |
| `apn_max`               | decimal | Años APN máximos                 |
| `edad_min`              | integer | Edad mínima                      |
| `edad_max`              | integer | Edad máxima                      |
| `fecha_ingreso_Desde`   | date    | Fecha ingreso desde (dd/MM/yyyy) |
| `fecha_ingreso_Hasta`   | date    | Fecha ingreso hasta              |
| `region_id`             | integer | ID de región                     |
| `estado_id`             | integer | ID de estado                     |
| `municipio_id`          | integer | ID de municipio                  |
| `parroquia_id`          | integer | ID de parroquia                  |
| `condicion_vivienda_id` | integer | ID condición vivienda            |

---

### 2. Familiares (`categoria: "familiares"`)

**Columnas del PDF:**

- # | Cédula Emp. | Empleado | Cédula Fam. | Familiar | Parentesco | F. Nacimiento | Sexo | Heredero | Mismo Ente

**Filtros disponibles:**

| Filtro                 | Tipo    | Descripción                 |
| ---------------------- | ------- | --------------------------- |
| `parentesco_id`        | integer | ID del parentesco           |
| `patologias_id`        | integer | ID patología familiar       |
| `grupo_sanguineo_id`   | integer | ID grupo sanguíneo familiar |
| `discapacidades_id`    | integer | ID discapacidad familiar    |
| `sexo_familiar_id`     | integer | ID sexo del familiar        |
| `estado_civil_id`      | integer | ID estado civil familiar    |
| `sexo_empleado_id`     | integer | ID sexo del empleado        |
| `edad_empleado_min`    | integer | Edad mínima empleado        |
| `edad_empleado_max`    | integer | Edad máxima empleado        |
| `nomina_id`            | integer | ID tipo de nómina           |
| `dependencia_id`       | integer | ID de dependencia           |
| `direccion_general_id` | integer | ID dirección general        |
| `direccion_linea_id`   | integer | ID dirección línea          |
| `coordinacion_id`      | integer | ID coordinación             |
| `region_id`            | integer | ID de región                |
| `estado_id`            | integer | ID de estado                |
| `municipio_id`         | integer | ID de municipio             |

---

### 3. Asignaciones (`categoria: "asignaciones"`)

**Columnas del PDF:**

- # | Código | Cédula | Empleado | Cargo | Cargo Esp. | Grado | Nómina | Dirección | Estatus

**Filtros disponibles:**

| Filtro                | Tipo    | Descripción          |
| --------------------- | ------- | -------------------- |
| `cargo_id`            | integer | ID del cargo         |
| `cargo_especifico_id` | integer | ID cargo específico  |
| `nomina_id`           | integer | ID tipo de nómina    |
| `grado_id`            | integer | ID del grado         |
| `dependencia_id`      | integer | ID de dependencia    |
| `general_id`          | integer | ID dirección general |
| `linea_id`            | integer | ID dirección línea   |
| `coordinacion_id`     | integer | ID coordinación      |
| `estatus_id`          | integer | ID del estatus       |

---

### 4. Egresados (`categoria: "egresados"`)

**Columnas del PDF:**

- # | Cédula | Nombre Completo | F. Ingreso | F. Egreso | Motivo | Último Cargo | Dirección

**Filtros disponibles:**

| Filtro                 | Tipo     | Descripción           |
| ---------------------- | -------- | --------------------- |
| `motivo_id`            | integer  | ID motivo de egreso   |
| `fecha_egreso_Desde`   | datetime | Fecha egreso desde    |
| `fecha_egreso_Hasta`   | datetime | Fecha egreso hasta    |
| `cargo_id`             | integer  | ID del cargo          |
| `cargo_especifico_id`  | integer  | ID cargo específico   |
| `grado_id`             | integer  | ID del grado          |
| `nomina_id`            | integer  | ID tipo de nómina     |
| `dependencia_id`       | integer  | ID de dependencia     |
| `direccion_general_id` | integer  | ID dirección general  |
| `direccion_linea_id`   | integer  | ID dirección línea    |
| `coordinacion_id`      | integer  | ID coordinación       |
| `organismo_id`         | integer  | ID organismo adscrito |
| `sexo_id`              | integer  | ID sexo del empleado  |

---

## Ejemplos de Uso

### Empleados - Sin filtros

```json
{
  "categoria": "empleados",
  "filtros": {}
}
```

### Empleados - Filtrado por dependencia y nómina

```json
{
  "categoria": "empleados",
  "filtros": {
    "dependencia_id": 1,
    "nomina_id": 2,
    "sexo_id": 1
  }
}
```

### Empleados - Por rango de años APN

```json
{
  "categoria": "empleados",
  "filtros": {
    "apn_min": 5,
    "apn_max": 15
  }
}
```

### Empleados - Por rango de fechas de ingreso

```json
{
  "categoria": "empleados",
  "filtros": {
    "fecha_ingreso_Desde": "2020-01-01",
    "fecha_ingreso_Hasta": "2023-12-31"
  }
}
```

### Familiares - Todos

```json
{
  "categoria": "familiares",
  "filtros": {}
}
```

### Familiares - Por parentesco

```json
{
  "categoria": "familiares",
  "filtros": {
    "parentesco_id": 1
  }
}
```

### Familiares - Por dependencia y sexo

```json
{
  "categoria": "familiares",
  "filtros": {
    "dependencia_id": 1,
    "sexo_familiar_id": 2
  }
}
```

### Asignaciones - Todas

```json
{
  "categoria": "asignaciones",
  "filtros": {}
}
```

### Asignaciones - Por estatus (vacantes)

```json
{
  "categoria": "asignaciones",
  "filtros": {
    "estatus_id": 2
  }
}
```

### Asignaciones - Por dirección y cargo

```json
{
  "categoria": "asignaciones",
  "filtros": {
    "general_id": 1,
    "cargo_id": 5
  }
}
```

### Egresados - Todos

```json
{
  "categoria": "egresados",
  "filtros": {}
}
```

### Egresados - Por motivo

```json
{
  "categoria": "egresados",
  "filtros": {
    "motivo_id": 1
  }
}
```

### Egresados - Por rango de fechas

```json
{
  "categoria": "egresados",
  "filtros": {
    "fecha_egreso_Desde": "2024-01-01",
    "fecha_egreso_Hasta": "2024-12-31"
  }
}
```

---

## Integración Frontend

### 1. Servicio de API

Crear/modificar el servicio de reportes en Next.js:

```typescript
// src/lib/api/reports.ts

interface PDFReportRequest {
  categoria: "empleados" | "familiares" | "asignaciones" | "egresados";
  filtros?: Record<string, any>;
}

export const reportsService = {
  async generatePDF(params: PDFReportRequest): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/reports/pdf/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return response.blob();
  },

  downloadPDF(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  },
};
```

### 2. Componente de Botón de Descarga

```tsx
// src/components/reports/PDFDownloadButton.tsx
"use client";

import { useState } from "react";
import { reportsService } from "@/lib/api/reports";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface PDFDownloadButtonProps {
  categoria: "empleados" | "familiares" | "asignaciones" | "egresados";
  filtros?: Record<string, any>;
  label?: string;
}

export function PDFDownloadButton({
  categoria,
  filtros = {},
  label = "Descargar PDF",
}: PDFDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const blob = await reportsService.generatePDF({ categoria, filtros });
      const filename = `reporte_${categoria}_${new Date().toISOString().split("T")[0]}.pdf`;
      reportsService.downloadPDF(blob, filename);
    } catch (error) {
      console.error("Error al generar PDF:", error);
      // Mostrar notificación de error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleDownload} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
```

### 3. Uso en Páginas

```tsx
// En cualquier página de reportes
import { PDFDownloadButton } from "@/components/reports/PDFDownloadButton";

export default function ReportesPage() {
  const [filtros, setFiltros] = useState({});

  return (
    <div>
      {/* Formulario de filtros... */}

      <PDFDownloadButton
        categoria="empleados"
        filtros={filtros}
        label="Exportar Empleados"
      />

      <PDFDownloadButton
        categoria="familiares"
        filtros={filtros}
        label="Exportar Familiares"
      />
    </div>
  );
}
```

### 4. Formulario de Filtros Dinámico (Opcional)

```tsx
// src/components/reports/PDFFilterForm.tsx
"use client";

import { useState } from "react";
import { PDFDownloadButton } from "./PDFDownloadButton";

const CATEGORIAS = [
  { value: "empleados", label: "Empleados" },
  { value: "familiares", label: "Familiares" },
  { value: "asignaciones", label: "Asignaciones" },
  { value: "egresados", label: "Egresados" },
];

export function PDFFilterForm() {
  const [categoria, setCategoria] = useState<string>("empleados");
  const [filtros, setFiltros] = useState<Record<string, any>>({});

  return (
    <div className="space-y-4">
      <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        {CATEGORIAS.map((cat) => (
          <option key={cat.value} value={cat.value}>
            {cat.label}
          </option>
        ))}
      </select>

      {/* Campos de filtro según la categoría seleccionada */}

      <PDFDownloadButton categoria={categoria as any} filtros={filtros} />
    </div>
  );
}
```

---

## Pendientes

### Alta Prioridad

| Tarea                    | Descripción                                                                           | Estado    |
| ------------------------ | ------------------------------------------------------------------------------------- | --------- |
| 🔴 Logos institucionales | Agregar `logoOAC.png`, `juntosPorVida.png`, `cintillo.png` a `RAC/static/pdf_assets/` | Pendiente |
| 🔴 Header con logos      | Modificar `base_generator.py` para incluir logos en el encabezado                     | Pendiente |
| 🔴 Pruebas unitarias     | Crear tests para cada generador                                                       | Pendiente |

### Media Prioridad

| Tarea                             | Descripción                                                      | Estado                    |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------- |
| 🟡 Paginación de tabla            | Dividir tablas largas en múltiples páginas con headers repetidos | Implementado (automático) |
| 🟡 Filtros de fecha en familiares | Agregar filtros por fecha de nacimiento del familiar             | Pendiente                 |
| 🟡 Preview en navegador           | Opción para abrir PDF en nueva pestaña en lugar de descargar     | Pendiente                 |

### Baja Prioridad

| Tarea                      | Descripción                                   | Estado    |
| -------------------------- | --------------------------------------------- | --------- |
| 🟢 Exportar a Excel        | Crear generadores paralelos para Excel        | Pendiente |
| 🟢 Gráficos estadísticos   | Agregar charts con conteos y distribuciones   | Pendiente |
| 🟢 Template personalizable | Permitir al usuario elegir columnas a incluir | Pendiente |
| 🟢 Marca de agua           | Agregar marca de agua configurable            | Pendiente |

---

## Notas de Desarrollo

### Agregar nuevo generador

1. Crear archivo en `generators/nuevo_pdf.py`
2. Extender `BasePDFGenerator`
3. Implementar `_build_content()`, `_get_footer_text()`, `_generate_filename()`
4. Agregar import en `generators/__init__.py`
5. Agregar import en `views/report_views.py`
6. Agregar categoría en `categorias_soportadas`
7. Agregar función `_generate_nuevo_pdf(filtros)`

### Agregar nuevos filtros

1. Modificar `MAPA_REPORTES` en `services/mapa_reporte.py`
2. Agregar la clave en `filtros_permitidos` con su campo de base de datos correspondiente
