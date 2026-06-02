# API Censo Vivienda — AUTOGESTION

Base URL: `/api/autogestion/`

---

## `GET /preguntas/`

Lista todas las preguntas activas del censo con su tipo y opciones.

**Request:** sin body.

**Response 200:**

```json
{
  "status": "success",
  "message": "Preguntas obtenidas correctamente",
  "data": [
    {
      "id": 1,
      "enunciado": "¿La vivienda tiene acceso a agua potable?",
      "tipo": {
        "id": 1,
        "nombre": "cerrada"
      },
      "opciones": [
        { "id": 1, "tipo_opcion": "Sí, todos los días" },
        { "id": 2, "tipo_opcion": "Sí, algunos días" },
        { "id": 3, "tipo_opcion": "No" }
      ]
    },
    {
      "id": 2,
      "enunciado": "¿Cuántas personas habitan en la vivienda?",
      "tipo": {
        "id": 2,
        "nombre": "abierta"
      },
      "opciones": []
    },
    {
      "id": 3,
      "enunciado": "¿Posee todos los servicios básicos?",
      "tipo": {
        "id": 3,
        "nombre": "binaria"
      },
      "opciones": [
        { "id": 4, "tipo_opcion": "Sí" },
        { "id": 5, "tipo_opcion": "No" }
      ]
    }
  ]
}
```

---

## `POST /censo-vivienda/<cedula_empleado>/`

Registra las respuestas del censo de vivienda para un trabajador.

**Request body:**

```json
{
  "carnet_patria": "1234567890",
  "datos_vivienda": {
    "direccion_exacta": "Av. Bolívar, Edif. Las Flores, Piso 3, Apto 3B",
    "parroquia": 2,
    "estado_id": 14,
    "municipio_id": 105,
    "condicion_vivienda_id": 1,
    "codigo_postal": "1010"
  },
  "respuestas": [
    { "pregunta": 1, "opcion": 1 },
    { "pregunta": 2, "respuesta": "verdadero" },
    { "pregunta": 3, "opcion": 4 }
  ]
}
```

### Reglas de validacion

| Tipo de pregunta | `opcion` | `respuesta` |
|---|---|---|
| `cerrada` | requerido | ignorado |
| `binaria` | requerido | ignorado |
| `abierta` | no requerido | texto libre |

### Responses

**201 Created:**

```json
{
  "status": "success",
  "message": "Censo de vivienda registrado correctamente",
  "data": {
    "carnet_patria": "1234567890",
    "datos_vivienda": {
      "direccion_exacta": "Av. Bolívar, Edif. Las Flores, Piso 3, Apto 3B",
      "parroquia": 2,
      "estado_id": 14,
      "municipio_id": 105,
      "condicion_vivienda_id": 1,
      "codigo_postal": "1010"
    },
    "respuestas": [
      { "pregunta": 1, "opcion": 1, "respuesta": "" },
      { "pregunta": 2, "opcion": null, "respuesta": "4" },
      { "pregunta": 3, "opcion": 4, "respuesta": "" }
    ]
  }
}
```

**400 Bad Request (validacion):**

```json
{
  "status": "error",
  "message": "La opción 99 no pertenece a la pregunta '¿La vivienda tiene acceso a agua potable?'.",
  "data": null
}
```

```json
{
  "status": "error",
  "message": "Debe enviar al menos una respuesta.",
  "data": null
}
```

```json
{
  "status": "error",
  "message": "Debe seleccionar una opción para '¿La vivienda tiene acceso a agua potable?'.",
  "data": null
}
```

**404 Not Found:**

```json
{
  "status": "error",
  "message": "No se encontró un trabajador con esa cédula.",
  "data": null
}
```

---

## `GET /censo-vivienda/consultar/<cedula>/`

Consulta el perfil censal completo de un trabajador.

**Request:** sin body.

**Response 200:**

```json
{
  "status": "success",
  "message": "Respuestas obtenidas correctamente",
  "data": [
    {
      "id": 42,
      "cedula": "12345678",
      "nombres": "Juan Carlos",
      "apellidos": "Pérez Rodríguez",
      "fecha_nacimiento": "1985-03-15",
      "carnet_patria": "1234567890",
      "cargos": [
        {
          "id": 10,
          "codigo": "ADM-001",
          "denominacioncargo": {
            "id": 5,
            "cargo": "Analista de Sistemas"
          },
          "denominacioncargoespecifico": null,
          "grado": null,
          "tiponomina": {
            "id": 2,
            "nomina": "Alto Nivel"
          },
          "OrganismoAdscrito": {
            "id": 3,
            "Organismoadscrito": "Ministerio del Poder Popular para la Educación"
          },
          "tipo_procedencia": null,
          "Dependencia": {
            "id": 8,
            "dependencia": "Dirección de Tecnología"
          },
          "DireccionGeneral": {
            "id": 4,
            "direccion_general": "Consultoría Jurídica"
          },
          "DireccionLinea": null,
          "Coordinacion": null,
          "estatusid": {
            "id": 1,
            "estatus": "Activo"
          },
          "observaciones": "",
          "fecha_actualizacion": "2025-11-20T14:30:00Z"
        }
      ],
      "datos_vivienda": {
        "id": 5,
        "direccion_exacta": "Av. Bolívar, Edif. Las Flores, Piso 3, Apto 3B",
        "parroquia": {
          "id": 2,
          "nombre": "Catedral"
        },
        "estado_id": 14,
        "municipio_id": 105,
        "condicion_vivienda_id": 1,
        "codigo_postal": "1010"
      },
      "total_apn": {
        "years": 12,
        "months": 6,
        "days": 10
      },
      "fecha_ingreso_organismo": "2010-01-15",
      "preguntas": [
        {
          "id": 1,
          "pregunta": "¿La vivienda tiene acceso a agua potable?",
          "tipo": "cerrada",
          "opcion": {
            "id": 1,
            "opcion": "Sí, todos los días"
          },
          "respuesta": ""
        },
        {
          "id": 2,
          "pregunta": "¿Cuántas personas habitan en la vivienda?",
          "tipo": "abierta",
          "opcion": null,
          "respuesta": "4"
        },
        {
          "id": 3,
          "pregunta": "¿Posee todos los servicios básicos?",
          "tipo": "binaria",
          "opcion": {
            "id": 4,
            "opcion": "Sí"
          },
          "respuesta": ""
        }
      ]
    }
  ]
}
```

**404 Not Found:**

```json
{
  "status": "error",
  "message": "No se encontró un trabajador con esa cédula.",
  "data": []
}
```

---

## `GET /censo-vivienda/consultar/`

Consulta el perfil censal de todos los trabajadores que han respondido el censo.

**Request:** sin body.

**Response 200:**

```json
{
  "status": "success",
  "message": "Respuestas obtenidas correctamente",
  "data": [
    {
      "id": 42,
      "cedula": "12345678",
      "nombres": "Juan Carlos",
      "apellidos": "Pérez Rodríguez",
      "fecha_nacimiento": "1985-03-15",
      "carnet_patria": "1234567890",
      "cargos": [ "..." ],
      "datos_vivienda": { "..." },
      "total_apn": { "years": 12, "months": 6, "days": 10 },
      "fecha_ingreso_organismo": "2010-01-15",
      "preguntas": [ "..." ]
    },
    {
      "id": 58,
      "cedula": "87654321",
      "nombres": "María Elena",
      "apellidos": "González López",
      "fecha_nacimiento": "1990-07-22",
      "carnet_patria": "0987654321",
      "cargos": [ "..." ],
      "datos_vivienda": { "..." },
      "total_apn": { "years": 5, "months": 3, "days": 0 },
      "fecha_ingreso_organismo": "2020-02-10",
      "preguntas": [ "..." ]
    }
  ]
}
```

---

## `POST /censo-vivienda/exportar-excel/`

Genera y descarga un archivo Excel con los datos del censo, aplicando filtros opcionales.

**Request body:**

Sin filtros:
```json
{
  "filtros": {}
}
```

Con filtros:
```json
{
  "filtros": {
    "direccion_general": "Consultoría Jurídica",
    "tipo_nomina": "Alto Nivel"
  }
}
```

### Filtros disponibles

| Campo | Descripcion |
|---|---|
| `direccion_general` | Filtrar por direccion general del cargo |
| `direccion_linea` | Filtrar por direccion de linea |
| `dependencia` | Filtrar por dependencia |
| `coordinacion` | Filtrar por coordinacion |
| `tipo_nomina` | Filtrar por tipo de nomina |

### Response

**200 OK:** archivo `.xlsx` con las columnas:

| Columna |
|---|
| Cédula |
| Nombres |
| Apellidos |
| Fecha Nacimiento |
| Carnet Patria |
| APN (años) |
| APN (meses) |
| APN (días) |
| F. Ingreso Organismo |
| Dirección General |
| Tipo de Nómina |
| Dirección Vivienda |
| Código Postal |
| *(una columna por cada pregunta activa del censo)* |

**400 Bad Request:**

```json
{
  "status": "error",
  "message": "El filtro 'campo_invalido' no esta permitido. Filtros disponibles: ['direccion_general', 'direccion_linea', 'dependencia', 'coordinacion', 'tipo_nomina']",
  "data": []
}
```
