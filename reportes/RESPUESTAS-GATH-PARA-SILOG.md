# Respuestas de GATH al equipo de SILOG

Integración del carnet con QR para comedor y transporte. Fecha: 11/11/2026.
Contrato completo: `reportes/ANALISIS-INTEGRACION-CARNET-SILOG.md`, sección 9.

---

## Preguntas de SILOG

### 1. La cédula viene con prefijo (V30799436). ¿Pueden mandarla solo con números? ¿Cómo evitar que una E y una V con los mismos números se confundan?
- El campo `cedula` viene **siempre solo con números**, sin prefijo ni puntos. Ejemplo: `"cedula": "30799436"`. El «V30799436» de la versión anterior del documento era un error del ejemplo.
- La nacionalidad llega en un campo aparte, `nacionalidad`, con el valor `"V"`, `"E"` o `null` si se desconoce.
- En la tabla `Employee` de RR. HH. la cédula es **única**, así que no pueden existir dos personas con el mismo número aunque una sea V y otra E.

### 3. ¿Qué documento llevan los externos? ¿Puede ser un pasaporte?
- Sí. La credencial externa guarda el documento como **texto libre**: cédula venezolana, cédula extranjera o pasaporte.
- El endpoint lo envía así:

| Campo | Externo con cédula (`V-12.345.678`) | Externo con pasaporte (`AB1234567`) |
|---|---|---|
| `cedula` | `"12345678"` (solo números) | `null` |
| `nacionalidad` | `"V"` | `null` |
| `documento` | `"V-12.345.678"` (tal como se registró) | `"AB1234567"` |

- **Externos con cédula:** SILOG los registra **automáticamente** como «Apoyo» con el campo `cedula`.
- **Externos con pasaporte:** GATH envía `cedula: null`. Como la tabla «Apoyo» de SILOG exige una cédula numérica, por ahora **los atiende el operador a mano**.

### 4. ¿Qué códigos de `tipo_credencial` existen para externos?

| Código | Para quién |
|---|---|
| `trabajador` | Trabajador activo |
| `pasivo` | Jubilado o pensionado |
| `visitante` | Visitante (externo) |
| `contratista` | Contratista (externo) |
| `trabajador_temporal` | Trabajador temporal (externo) |

En los externos, `estado_laboral` viene en `null` y `fecha_vencimiento` trae la fecha final de la credencial.

### 5. ¿Cómo entregan la API key y el entorno de pruebas?
- **La clave de pruebas** (solo para QA) **se entrega aparte**, no va en este documento. GATH la cambiará antes de producción, y **producción tendrá una clave distinta**.
- SILOG la guarda en el `.env` **de su backend**, nunca en el frontend ni en el teléfono, y la envía en la cabecera `X-API-Key`.
- **Entorno de pruebas:**
  - URL: `https://gathqa.conatel.gob.ve/api/v1/integraciones/carnet/verificar/?hash=<código del QR>`
  - Cabecera: `X-API-Key: <clave de pruebas>`
  - El endpoint estará disponible cuando QA tenga el build con estos cambios. Antes de eso responde 404.
  - GATH entregará **QR de prueba** de cada caso: vigente, anulado, vencido y código inexistente.

### 6. ¿Cómo se manejará el `?v=1` que pensaban agregar a la URL?
- **No se agrega.** La URL del QR queda sin parámetros: `https://gath.conatel.gob.ve/carnet/<código>`.
- La versión del contrato va en el campo **`"version": 1`** de la respuesta del endpoint.
- SILOG debe tomar **el último segmento de la ruta** como código e **ignorar cualquier parámetro** que venga después de `?`.
- Hay dos formatos de código válidos:
  - **22 caracteres:** carnets nuevos. Son letras, números, `-` y `_`, y distingue mayúsculas.
  - **64 caracteres hexadecimales:** carnets anteriores.

  SILOG lo envía tal cual y GATH valida el formato.
- Si algún día cambia el formato, será un formato distinto y se avisará con anticipación.

---

## Decisiones para arrancar

### 1. Quién puede usar cada servicio
**Se deja como hoy: se acepta todo carnet vigente.**
- GATH solo responde `valido: true` si el carnet está **vigente**. Los vencidos o anulados se rechazan solos.
- Exigir el estatus ACTIVO dejaría fuera a los **pasivos**, que también deben ser atendidos.
- Si en el futuro se quiere restringir un servicio, por ejemplo que los visitantes no usen el transporte, SILOG puede hacerlo con el campo `tipo_credencial`, sin cambios en GATH.

### 2. Origen de los externos creados automáticamente
**«Credencial externa GATH», con el tipo agregado**, para que el operador identifique a la persona:
- Credencial externa GATH – Visitante
- Credencial externa GATH – Contratista
- Credencial externa GATH – Trabajador temporal

El tipo sale del campo `tipo_credencial` del endpoint.

### 4. Las confirmaciones reenvían el mismo QR (una consulta más a GATH)
**Se acepta así.**
- El límite de GATH es de **600 consultas por minuto** para SILOG, así que una consulta extra por confirmación no tiene impacto.
- Además, se comprueba de nuevo que el carnet sigue vigente justo antes de registrar.
- Es opcional: si SILOG prefiere evitar esa consulta, puede reutilizar el resultado de la primera durante 1 o 2 minutos.
