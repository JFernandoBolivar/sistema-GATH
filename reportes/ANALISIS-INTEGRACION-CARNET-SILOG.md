# Análisis de integración del carnet QR de GATH con SILOG

**Fecha:** 2026-11-10
**Insumo:** `INTEGRACION_CARNET_QR (1).md`
**Alcance:** responder las 17 preguntas de SILOG y registrar los ajustes necesarios en GATH.
**Estado:** análisis. No se modificó código para esta integración.

---

## 1. Resumen ejecutivo

El QR de GATH **no contiene la cédula**. Contiene una URL con un `security_hash`
opaco de 64 caracteres hexadecimales. Para obtener la cédula hay que verificar ese
hash contra GATH en línea.

El endpoint público actual (`/api/v1/carnetizacion/public/qr/<hash>/`) es
**anónimo** y aplica la privacidad configurada por el trabajador. Por defecto la
cédula está en nivel `CON_SESION`, así que **una consulta anónima devuelve
`cedula: null`**. Por eso SILOG **no puede usar el endpoint público tal cual**
para marcar asistencia: necesita una integración autenticada de sistema a sistema.

La recomendación es agregar en GATH un **endpoint de verificación para sistemas
autorizados** (API key o mTLS) que devuelva lo mínimo: `cedula`, `valido`,
`estado`, `fecha_vencimiento` y, si se decide, `estado_laboral`. SILOG envía el
hash leído del QR y GATH responde. La verificación debe ser en el backend de
SILOG, nunca en el teléfono.

Hallazgo adicional importante: el QR del **anverso mide 9,5 × 9,5 mm** y el
contenido actual (URL + 64 hex) produce un QR **versión 9–10 con corrección H**
(53–57 módulos). Eso es demasiado denso para leerlo con la cámara de un teléfono
de gama media a 15–30 cm, sobre todo plastificado y con el logo al centro. Para
SILOG debe usarse el QR del **reverso (16 × 16 mm)** o ampliarse el del anverso a
≥ 20 mm; idealmente, acortar el token/URL para bajar la versión del QR.

### Decisiones confirmadas (2026-11-10)

1. **QR para SILOG:** se usa el **QR del reverso**. El diseño puede cambiar en el
   futuro; el requisito no es “siempre el reverso”, sino que **al menos uno de los
   dos QR sea suficientemente grande y legible**. GATH debe validar esa condición
   al publicar una plantilla.
2. **Vigencia del carnet:** **sí se define** y debe ser **parametrizable desde
   Gestión del Sistema**, no fija en código ni en `.env`. Se manejarán **3 tipos**
   de vigencia (trabajador, pasivo y externo/temporal), con un valor global de
   respaldo.
3. **Valores iniciales confirmados (opción recomendada):**
   - Trabajador activo: **12 meses**.
   - Pasivo/jubilado: **12 meses**.
   - Externo/temporal: **30 días**.
   - Respaldo global: **12 meses**.
4. **La página del expediente no desaparece al vencer.** El QR sigue abriendo
   `/carnet/<hash>`. Si el carnet está vigente, muestra la información permitida;
   si está vencido o anulado, la página muestra el estado y **no presenta los
   datos personales** (comportamiento actual de carnet no válido). La vigencia
   controla la validez, no la existencia de la página.
5. **Dónde se configura:** en **Gestión del Sistema** (parámetros en base de
   datos y pantalla de administración). **No va en `.env`**: el `.env` es para
   infraestructura (host de BD, URLs, secretos) y exige redeploy; las reglas de
   negocio deben cambiarse desde la interfaz y auditarse.
6. **BD compartida:** SILOG hoy lee **solo `Employee` y `AsigTrabajo`**. No lee
   `CarnetEmitido`, así que **no puede resolver el hash por sí solo**: la
   resolución `hash → cédula` debe hacerse por el endpoint de GATH. La lectura
   directa de `CarnetEmitido` queda descartada salvo que se otorgue un permiso
   nuevo y se asuma el riesgo de exponer todos los hashes.
7. **La integración no se implementa hoy.** Este documento deja el plan; la
   ejecución queda pendiente de aprobación.
8. **Visitantes y externos de GATH en SILOG** (aprobada por el usuario el 11/11): si
   el endpoint responde `valido:true` con `tipo_credencial` externo/visitante y la
   cédula no existe en Employee ni en Apoyo, SILOG crea o actualiza automáticamente
   el registro Apoyo (cédula, nombre, interno=False) y luego registra la asistencia.
   Como GATH verifica el carnet en cada lectura, al vencer o anularse la credencial
   SILOG la rechaza sin intervención manual. Si SILOG quiere restringir servicios por
   tipo de credencial (p. ej. comedor sí, transporte no), lo decide con su propia regla.

---

## 2. Respuestas a las 17 preguntas

### 1. ¿Qué contiene exactamente el QR?

En producción, una URL absoluta:

```
https://<FRONTEND_URL>/carnet/<security_hash>
```

- `<FRONTEND_URL>` sale de `settings.FRONTEND_URL`.
- `<security_hash>` es un SHA-256 hexadecimal de 64 caracteres, único e indexado
  en `CarnetEmitido.security_hash`.
- **No contiene cédula, nombre, cargo ni foto** en el contenido del QR.

Ejemplo real de QA (carnet vigente de prueba):

```
http://192.168.1.3:3001/carnet/625fd98ef74c94a532e6951945ac6e5b450a4d0d1872ad4395f5a71606d23064
```

Ejemplo real de QA (carnet revocado):

```
http://192.168.1.3:3001/carnet/bb7d834c4cb9780cc50657ea917d724d580bcab7fc8e87dd219676e52bde03ac
```

> Los hashes de QA deben rotarse/revocarse después de las pruebas. El hash es
> un token portador: quien lo tenga puede consultar la ficha pública permitida.

Si `FRONTEND_URL` está vacío, GATH genera un texto de respaldo:

```
GATH-ID: <hash>
CI: <cedula>
Titular: <nombre>
```

Ese respaldo **incluye datos personales en texto plano** y no debe usarse en
producción. Es un ajuste pendiente: eliminarlo o hacer que falle de forma
segura.

### 2. Codificación, longitud, versión y corrección de errores

| Dato | Valor actual |
|---|---|
| Codificación | UTF-8; el contenido es ASCII (URL + hex) |
| Longitud típica | 95–120 caracteres según el dominio |
| Biblioteca | `qrcode` de Python, `version=None` (automática) |
| Corrección de errores | **H** (30 %) desde el cambio que agregó el logo al centro |
| Versión resultante | **9–10** para la URL + hash de 64 caracteres (53–57 módulos) |
| Borde | 1 módulo en el PDF; 2 en la imagen pública |
| `box_size` | 4 en el PDF; 8 en la imagen pública |

Ejemplo medido: URL de 95 caracteres → **versión 9, 53 × 53 módulos**; URL de
99 caracteres → **versión 10, 57 × 57 módulos**.

### 3. ¿Está firmado? ¿Con qué algoritmo? ¿Cómo se distribuye la clave?

**No.** El QR no lleva JWS/JWT ni firma asimétrica. El `security_hash` es un
identificador opaco generado con `SHA-256(cedula|motivo|fecha|SECRET_KEY|random)`.
No se puede revertir a la cédula; solo se valida contra la base de datos.

- No hay clave pública, JWKS ni `kid`.
- No hay rotación de clave para el QR.
- El hash es un **token portador**: fotografiarlo equivale a tener el carnet
  físico. La protección real es la verificación en línea y la revocación.

Si SILOG necesita verificar sin conexión, GATH tendría que añadir un token
firmado (JWS con Ed25519/ES256) y publicar el JWKS. Hoy no existe.

### 4. Endpoint de verificación

```
GET /api/v1/carnetizacion/public/qr/<security_hash>/
```

- **Autenticación:** `AllowAny` (sin API key).
- **Permisos:** ninguno; la privacidad por dato se aplica según sesión.
- **Límite:** DRF `AnonRateThrottle` 60/minuto y `UserRateThrottle` 300/minuto.
- **Tiempo de respuesta:** consulta indexada por `security_hash`; típicamente
  < 100 ms, sin SLA formal.
- **Cabeceras:** `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow,
  noarchive`.
- **Respuesta:** `FichaQr` con `es_valido`, `estado`, `mensaje`,
  `security_hash`, `nivel_acceso`, `datos`, `salud_disponible`,
  `fecha_emision`, `fecha_vencimiento`.

Respuesta real de un carnet vigente **sin sesión** (se observa el problema de la
cédula):

```json
{
  "es_valido": true,
  "estado": "VIGENTE",
  "mensaje": "Carnet vigente y verificado.",
  "security_hash": "625fd98e...",
  "nivel_acceso": "PUBLICO",
  "datos": {
    "nombre": "SURELIS ELENA ALIENDRES ROJAS",
    "foto_url": "",
    "cargo": "PERSONAL PASIVO",
    "ubicacion": "OFICINA DE GESTION HUMANA",
    "cedula": null,
    "fecha_nacimiento": null,
    "contactos_emergencia": [],
    "salud": null
  },
  "salud_disponible": true,
  "fecha_emision": "10/11/2026",
  "fecha_vencimiento": null
}
```

Respuesta real de un carnet revocado:

```json
{
  "es_valido": false,
  "estado": "ANULADO",
  "mensaje": "Este carnet fue anulado. Si lo encontró, entréguelo a la institución.",
  "security_hash": "bb7d834c...",
  "nivel_acceso": "PUBLICO",
  "datos": null,
  "salud_disponible": false,
  "fecha_emision": null,
  "fecha_vencimiento": null
}
```

**Conclusión:** el endpoint público sirve para la ficha humana, pero **no es
suficiente para SILOG** porque no entrega la cédula a un cliente anónimo.

### 5. ¿El QR o el token vencen o rotan?

- El `security_hash` **no rota** mientras el carnet exista.
- **Decisión:** el carnet **sí vence**. La vigencia es parametrizable desde
  Gestión del Sistema por tipo de credencial:
  - Trabajador activo: **12 meses**.
  - Pasivo/jubilado: **12 meses**.
  - Externo/temporal: **30 días**.
  - Respaldo global: **12 meses** (`carnetizacion.vencimiento_meses`).
- **La página del expediente sigue existiendo al vencer.** El QR abre
  `/carnet/<hash>`; si el carnet está vencido o anulado, la página muestra ese
  estado y no presenta los datos personales, igual que hoy con un carnet no
  válido. La vigencia no elimina la ruta ni el QR, solo cambia la validez.
- Al emitir un carnet nuevo, GATH desactiva el anterior
  (`CarnetEmitido.objects.filter(employee=..., activo=True).update(activo=False)`).
  El QR viejo pasa a `ANULADO`.
- Un carnet impreso sigue sirviendo hasta que se revoque o venza.

### 6. ¿Cómo se revoca un carnet extraviado o reemplazado?

- Se marca `CarnetEmitido.activo = False`.
- El endpoint devuelve `estado: "ANULADO"` y `datos: null`.
- No hay lista de revocación separada; la consulta es en línea.
- No existe un estado `EXTRAVIADO`: la pérdida se maneja revocando el carnet y
  emitiendo uno nuevo (el nuevo deja inactivo el anterior).
- Recomendación: si SILOG necesita distinguir “extraviado” de “anulado”,
  agregar un estado explícito o documentar que ambos se tratan como inválidos.

### 7. ¿Qué estados puede tener un carnet?

Estados de la ficha (`FichaQr.estado`):

| Estado | Significado |
|---|---|
| `VIGENTE` | Carnet activo y no vencido |
| `ANULADO` | Carnet desactivado |
| `VENCIDO` | Superó la vigencia configurada |
| `NO_REGISTRADO` | El hash no existe |

No hay `SUSPENDIDO` ni `EXTRAVIADO`. El `estatus` laboral
(`AsigTrabajo.estatusid`: ACTIVO, EGRESADO, SUSPENDIDO) **no forma parte de la
ficha**. SILOG no debe confundir “carnet vigente” con “trabajador activo”.

### 8. ¿Cómo se llega a la cédula desde el QR?

- El QR no trae la cédula.
- El hash resuelve a `Employee.cedulaidentidad` (sin `V-` ni puntos; 6–9
  dígitos) en la base de GATH.
- El endpoint público devuelve `datos.cedula` **solo si la privacidad del
  titular lo permite**. Por defecto está en `CON_SESION`, así que un cliente
  anónimo recibe `null`.
- Para SILOG la vía correcta es el endpoint de sistema a sistema propuesto.

### 9. ¿GATH lee la misma BD de RRHH? ¿Emite solo a ACTIVOS?

- **Confirmado por el usuario:** SILOG consulta la misma base de datos que GATH
  para validar a los trabajadores. GATH lee `Employee` y `AsigTrabajo` como
  tablas **no gestionadas** (`managed=False`): son las tablas institucionales
  existentes.
- GATH usa la base `GATH-PRODUCT`; el alias `legacy` de SILOG debe apuntar a esa
  misma instancia/esquema. Hay que confirmar host, puerto, nombre de BD y usuario
  de solo lectura con infraestructura.
- **GATH no exige `AsigTrabajo.estatus = ACTIVO` al emitir ni al verificar.**
  Puede emitir a trabajadores activos, pasivos o con otros estatus. El buscador
  de emisión muestra todos.
- Con la BD compartida, SILOG puede validar el estatus laboral directamente en
  `AsigTrabajo` usando la cédula que le devuelva GATH. No es obligatorio que GATH
  incluya `estado_laboral` en la respuesta, aunque sigue siendo útil para
  simplificar la integración.
- Decisión pendiente: si GATH debe impedir la emisión a no activos. Si SILOG
  filtra por `AsigTrabajo.estatus = ACTIVO`, el carnet puede existir pero SILOG
  no registra la asistencia.

### 10. ¿Se emiten carnets a externos, apoyo, contratados o visitantes?

Sí. GATH maneja:

- Trabajadores activos y pasivos (`CarnetEmitido`, con cédula).
- Credenciales externas/temporales/eventos (`CarnetCredencialExterna`).
- La ficha de una credencial externa devuelve nombre, empresa/contrato,
  ubicación/persona visitada, tipo, motivo y vigencia.
- **La ficha externa no devuelve `documento`/cédula** en el JSON actual; el
  modelo sí tiene `documento`.

Si SILOG debe aceptar credenciales externas, GATH debe exponer `documento` y
validar que coincida con `Apoyo.cedula` (6–9 dígitos). Si no, SILOG debe
rechazarlas y aceptar solo trabajadores/pasivos.

### 11. ¿El QR tiene datos personales visibles?

- El QR en sí: **no**. Solo la URL con el hash.
- La página pública muestra nombre, foto, cargo, ubicación, contactos y salud
  según la privacidad del titular; cédula y fecha de nacimiento requieren sesión
  por defecto; vivienda es solo personal.
- El respaldo de texto cuando `FRONTEND_URL` está vacío **sí incluye cédula y
  nombre**; hay que eliminarlo.

### 12. ¿Se puede verificar sin conexión?

**Hoy no.** El hash es opaco y requiere consultar la base de datos. No hay firma
ni clave pública.

Opciones:

- **En línea (recomendado):** SILOG verifica contra GATH y reintenta si falla.
  Para el autobús, cachear localmente los resultados exitosos del día y avisar
  que la revocación no se puede garantizar sin conexión.
- **Sin conexión real:** GATH debe emitir un JWS firmado (Ed25519/ES256) con
  `cedula`, `hash`, `iat`, `exp`, `kid`, `v`, publicar el JWKS y entregar una
  lista de revocación. Es un proyecto aparte.

### 13. ¿El contenido tiene versión (`v`)?

**No.** Es una URL sin versión. Cambiar el formato rompería a los lectores.
**Decisión final (11/11/2026): NO se agrega `?v=1` a la URL.** La URL queda `<FRONTEND_URL>/carnet/<código>` sin parámetros; la versión del contrato va en el campo `version` de la respuesta del endpoint. SILOG debe tomar el último segmento de la ruta e ignorar cualquier query string.

### 14. ¿Tiene propósito o ámbito (`aud`)?

**No.** El mismo hash sirve para cualquier sistema que consulte el endpoint. No
hay `aud` ni restricción por aplicación. SILOG puede usarlo, pero conviene que
el nuevo endpoint de integración tenga un **scope/audiencia** (`asistencia`) y
una API key propia.

### 15. ¿Pueden entregar imágenes de QR de prueba?

Sí. GATH puede entregar:

- Un hash vigente de QA (ejemplo arriba).
- Un hash revocado de QA (ejemplo arriba).
- Hashes inexistentes para probar `NO_REGISTRADO`.
- Un carnet vencido si se configura `vencimiento_meses` o se crea un registro
  de prueba.

No hay claves de firma porque hoy no hay firma. Para pruebas de SILOG se
recomienda un **entorno QA** y una **API key de prueba**, no el hash de
producción.

### 16. Tamaño de impresión y material

- Plantilla activa v4:
  - Anverso: QR de **9,5 × 9,5 mm** (muy pequeño para el contenido actual).
  - Reverso: QR de **16 × 16 mm**.
- **Decisión:** para SILOG se usa el **QR del reverso**. El requisito de fondo es
  que **al menos uno de los dos QR sea suficientemente grande y legible**; si un
  rediseño mueve o elimina el reverso, la validación de plantilla debe exigir que
  el otro QR cumpla el mínimo.
- El PDF es vectorial/imagen de alta resolución; el material y laminado los
  define la imprenta.
- Recomendación: mínimo **20 × 20 mm** (o 16 mm con token corto y prueba real),
  laminado mate antirreflejo y prueba con teléfonos de gama media a 15–30 cm.

### 17. Restricciones legales o de privacidad

GATH ya aplica:

- Privacidad por campo: `PUBLICO`, `CON_SESION`, `SOLO_PERSONAL`.
- Vivienda nunca pública.
- Bitácora de escaneos (`BitacoraAccesoQrModel`: hash, carnet, acción, usuario,
  IP, user-agent).
- `noindex`, `no-store`, rate limit.

Para SILOG:

- Guardar solo lo necesario: cédula, fecha/hora, servicio (comedor/transporte),
  operador y método (`qr`/`manual`). No guardar la ficha completa ni el hash si
  no hace falta.
- Definir base legal (relación laboral/asistencia), retención y acceso.
- Documentar que un sistema autorizado de asistencia recibe la cédula aunque el
  titular la tenga en `CON_SESION`; eso debe reflejarse en el aviso de
  privacidad.
- Auditar las consultas del sistema integrador.

---

## 3. Integración con la BD compartida

SILOG y GATH comparten la base de RRHH. Eso abre tres caminos para resolver el
hash del QR:

| Camino | Cómo funciona | Ventajas | Riesgos |
|---|---|---|---|
| **A. API de GATH (recomendado)** | SILOG envía el hash a GATH; GATH responde cédula + estado | No expone hashes; aplica revocación, vigencia y auditoría; contrato estable | Requiere endpoint y API key |
| **B. Lectura directa de `CarnetEmitido`** | SILOG consulta `CarnetEmitido.security_hash` y obtiene `employeeId`; luego `Employee.cedulaIdentidad` | Sin endpoint nuevo; usa la BD que ya tiene | El usuario de SILOG podría leer todos los hashes (tokens portadores); duplica la lógica de vigencia/revocación; sin auditoría de GATH |
| **C. Híbrido** | SILOG resuelve el hash por API y enriquece nombre/cargo/estatus con `Employee`/`AsigTrabajo` de la BD compartida | Mínimo dato personal en la API; SILOG ya tiene el estatus laboral | Dos fuentes que deben estar sincronizadas |

**Recomendación:** camino **A** o **C**. La API de GATH resuelve el hash y
devuelve la cédula; SILOG consulta `AsigTrabajo` en la BD compartida para el
estatus laboral, el cargo y la dependencia. Así no se duplica la lógica de
revocación/vigencia y no se exponen todos los hashes a un usuario de BD.

Si se elige B, se debe:

- Dar a SILOG un usuario SQL de **solo lectura** y limitado a las columnas
  necesarias (`security_hash`, `employeeId`, `activo`, `fecha_emision`).
- Replicar en SILOG la regla de vencimiento (`carnetizacion.vencimiento_meses`).
- Aceptar que una revocación o cambio de formato en GATH afecta a SILOG sin
  contrato de API.

### Consecuencia para la respuesta de GATH

Con la BD compartida, la respuesta mínima de la API puede ser:

```json
{
  "valido": true,
  "estado": "VIGENTE",
  "cedula": "30799436",
  "fecha_vencimiento": null,
  "version": 1
}
```

SILOG completa `nombre`, `cargo`, `dependencia` y `estado_laboral` desde
`Employee`/`AsigTrabajo`. Si se prefiere una sola llamada, GATH puede incluir
esos campos, pero no es imprescindible.

---

## 4. Ajustes necesarios en GATH

### P0 — Bloqueantes para la integración

1. **Endpoint de verificación para sistemas autorizados**
   - `GET /api/v1/integraciones/carnet/verificar/?hash=<64>`
   - Autenticación: API key (`X-API-Key`) o mTLS; una clave por sistema
     (`SILOG`), con scope `asistencia`.
   - Respuesta mínima:
     ```json
     {
       "valido": true,
       "estado": "VIGENTE",
       "cedula": "30799436",
       "nombre": "JOSE FERNANDO BOLIVAR HURTADO",
       "tipo_credencial": "trabajador",
       "estado_laboral": "ACTIVO",
       "fecha_emision": "2026-11-10",
       "fecha_vencimiento": null,
       "version": 1
     }
     ```
   - La cédula se devuelve al sistema autorizado aunque la privacidad pública la
     oculte; se registra en la bitácora con el identificador del sistema.
   - Rate limit propio (p. ej. 600/min por clave) y respuesta < 200 ms.

2. **Decidir la exposición de la cédula**
   - Hoy el endpoint público devuelve `cedula: null` a anónimos.
   - El endpoint de integración debe ser la única vía que garantice la cédula.
   - Actualizar el aviso de privacidad: “sistemas institucionales autorizados de
     asistencia reciben la cédula para validar el acceso”.

3. **Tamaño y densidad del QR**
   - **Decisión:** usar el QR del reverso (16 mm) para SILOG; el anverso puede
     quedar como está.
   - La validación de plantillas debe exigir que **al menos uno de los QR** mida
     ≥ 20 mm (o el mínimo que resulte de la prueba real con el contenido final).
     Si un rediseño elimina el reverso, el anverso debe cumplir el mínimo.
   - Evaluar acortar el token (menos de 64 hex) y la URL (`/c/<token>`) para
     bajar de versión 9–10 a 4–6, o usar un token firmado compacto.
   - Probar con el logo al centro, carnet plastificado y teléfono de gama media.

4. **`FRONTEND_URL` y respaldo**
   - Garantizar `FRONTEND_URL` con HTTPS público en producción.
   - Eliminar el respaldo que imprime cédula/nombre en el QR; si falta la URL,
     fallar la generación o usar solo el hash.

### P1 — Necesarios para una integración estable

5. **Versión y ámbito**
   - Agregar `v=1` al contenido/URL y documentar el contrato.
   - Agregar `aud`/scope `asistencia` al token o a la API key.

6. **Estado laboral**
   - SILOG consulta la misma BD y puede leer `AsigTrabajo.estatusid`
     directamente con la cédula que devuelve GATH. Por eso **no es obligatorio**
     incluir `estado_laboral` en la respuesta de GATH.
   - Decidir si GATH debe impedir la emisión a no activos. Si no, SILOG debe
     filtrar por `AsigTrabajo.estatus = ACTIVO` antes de registrar la asistencia.

7. **Vigencia y revocación**
   - **Decisión:** el carnet vence. La vigencia es parametrizable desde Gestión
     del Sistema por **3 tipos** (trabajador, pasivo, externo/temporal), con un
     valor global de respaldo. Ver el plan de implementación al final.
   - Evaluar estados `EXTRAVIADO`/`SUSPENDIDO` o documentar que se mapean a
     `ANULADO`.
   - Confirmar que la reemisión siempre desactiva el carnet anterior (hoy sí).

8. **Credenciales externas**
   - Si SILOG acepta visitantes/apoyo, exponer `documento` en la ficha de
     integración y validar el formato de cédula.
   - Si no, documentar que SILOG solo acepta carnets de trabajadores/pasivos.

### P2 — Mejoras

9. **Verificación sin conexión**
   - JWS firmado + JWKS + lista de revocación, solo si el autobús lo exige.
10. **Rate limit dedicado** para la API key de SILOG.
11. **Datos de prueba**: entorno QA con hashes vigente/revocado/vencido/
    inexistente y API key de prueba.
12. **Auditoría de integración**: registrar sistema, clave, hash, resultado y
    tiempo de respuesta.
13. **Cache local en SILOG** (no en GATH) para los escaneos del día, con aviso de
    que la revocación no se garantiza sin conexión.

---

## 5. Contrato propuesto para SILOG

### Verificación

```
GET /api/v1/integraciones/carnet/verificar/?hash=<security_hash>
X-API-Key: <clave-de-silog>
```

Respuesta `200`:

```json
{
  "valido": true,
  "estado": "VIGENTE",
  "cedula": "30799436",
  "nombre": "JOSE FERNANDO BOLIVAR HURTADO",
  "tipo_credencial": "trabajador",
  "estado_laboral": "ACTIVO",
  "fecha_emision": "2026-11-10",
  "fecha_vencimiento": null,
  "version": 1
}
```

Carnet inválido:

```json
{
  "valido": false,
  "estado": "ANULADO",
  "cedula": null,
  "mensaje": "Carnet anulado.",
  "version": 1
}
```

Recomendación: responder siempre `200` con `valido` y `estado` para que SILOG
distinga “no válido” de “error de red/servidor”.

### Flujo recomendado

1. SILOG decodifica el QR en el teléfono (solo extrae el hash; no valida nada).
2. Envía el hash al backend de SILOG.
3. El backend de SILOG llama al endpoint de GATH con su API key.
4. GATH responde cédula + estado.
5. SILOG aplica sus reglas actuales (comedor/transporte) con esa cédula.
6. Si GATH no responde, SILOG muestra “no se pudo verificar” y no registra; o usa
   un cache local previo con advertencia.

---

## 6. Ajustes en SILOG (resumen, no en GATH)

- Agregar lector de QR en la PWA (`BarcodeDetector` o librería) con cámara
  trasera, modo ráfaga y sonido/vibración.
- Llamar al backend de SILOG, no a GATH directamente desde el teléfono.
- Guardar `metodo_registro` (`qr`/`manual`) y el operador en `ServicioLog` y
  `ViajePasajero`.
- HTTPS de confianza en los teléfonos (la cámara solo funciona en contexto
  seguro).
- Definir política para carnet vencido/revocado: rechazar, no solo avisar.
- Si se requiere sin conexión, implementar cache/cola local; hoy SILOG no la
  tiene.

---

## 7. Decisiones pendientes

1. ¿Se implementa el endpoint de integración con API key/mTLS? (recomendado)
2. ¿GATH debe exigir `AsigTrabajo.estatus = ACTIVO` para emitir?
3. ¿SILOG acepta pasivos y credenciales externas, o solo trabajadores activos?
4. ¿Se requiere verificación sin conexión? Si sí, ¿se aprueba el proyecto de JWS?
5. ¿Se acorta el token/URL para mejorar la lectura del QR?

**Resueltas:** el QR de SILOG es el del reverso; la vigencia es parametrizable y
obligatoria; la integración no se ejecuta hoy.

---

## 8. Plan de implementación (no ejecutado)

> Este plan queda documentado. No se ejecutará hasta aprobación expresa.

### 8.1 Parámetros de vigencia

Se administran desde **Gestión del Sistema** (`configuracion`), no en código.
Se separan dos grupos para no mezclar la vigencia del carnet con las reglas de
solicitud.

**Vigencia del carnet (3 tipos + respaldo global):**

| Clave propuesta | Tipo | Valor inicial propuesto | Aplica a |
|---|---|---|---|
| `carnetizacion.vencimiento_meses` | entero (meses) | 12 | Respaldo global si falta el tipo |
| `renovacion_carnet_meses` | entero (meses) | 12 | Trabajador activo |
| `carnet_vigencia_pasivo_meses` | entero (meses) | 12 | Pasivo/jubilado |
| `carnet_vigencia_externo_dias` | entero (días) | 30 | Externo/visitante/temporal |

> Interpretación de «los 3 tipos»: trabajador, pasivo y externo/temporal. Si te
> referías a los tres parámetros temporales del flujo de solicitud, también
> quedan cubiertos en la tabla siguiente.

**Reglas de solicitud (Fase 1 ya planificada):**

| Clave | Tipo | Valor inicial | Uso |
|---|---|---|---|
| `solicitud_espera_rechazo_dias` | entero (días) | 7 | Espera para volver a solicitar tras un rechazo |
| `reposicion_extravio_dias` | entero (días) | 30 | Vigencia/validez de una reposición por extravío |
| `solicitud_max_anio` | entero | 3 | Máximo de solicitudes por año |

**Reglas:**

- Si el parámetro del tipo existe y es > 0, prevalece.
- Si falta o es 0, se usa `carnetizacion.vencimiento_meses`.
- Si ambos faltan/0, el carnet no vence (solo para compatibilidad; la decisión
  es que **sí vence**, por lo que se siembran valores por defecto).
- Los cambios se auditan y se validan (entero positivo, rango razonable).

### 8.2 Cálculo y persistencia del vencimiento

- **Recomendado:** guardar `fecha_vencimiento` y `vigencia_meses`/`vigencia_dias`
  en `CarnetEmitido` al momento de emitir, para que un cambio posterior de
  parámetros no altere carnets ya impresos.
- `CarnetEmitido` es `managed=False`; agregar columnas requiere migración/DDL
  controlada. Si no se quiere tocar la tabla, se puede calcular en lectura con
  el parámetro vigente, asumiendo que el cambio es retroactivo (menos deseable).
- Para credenciales externas, usar `CredencialExternaModel.vigencia_hasta`, que
  ya existe.
- `consultar_ficha_qr` y el endpoint de integración deben devolver `VENCIDO`
  cuando `fecha_vencimiento < ahora`.
- El PDF puede imprimir «Vence: dd/mm/aaaa» si el parámetro lo permite.

### 8.3 Validación del tamaño del QR en plantillas

- Al guardar/publicar una plantilla, verificar que **al menos un elemento QR**
  cumpla:
  - ancho y alto ≥ mínimo configurable (propuesta: **20 mm**; 16 mm solo si la
    prueba real con el contenido final lo valida);
  - relación de aspecto cuadrada;
  - sin recortes ni superposición que tapen más del área permitida.
- Si no cumple, **bloquear la publicación** con un mensaje claro:
  «La plantilla no tiene un QR de al menos 20 × 20 mm; SILOG no podrá escanearlo».
- El diseñador debe mostrar una advertencia visible en el panel del QR.
- La plantilla v4 actual usa el reverso de 16 mm; se puede mantener si la prueba
  con el contenido final (URL + hash) es satisfactoria; si no, ampliar a 20 mm.
- Evaluar acortar el token/URL para reducir la versión del QR (de 9–10 a 4–6),
  lo que mejora la lectura sin agrandar tanto el impreso.

### 8.4 Endpoint de integración

- `GET /api/v1/integraciones/carnet/verificar/?hash=<64>` con API key/mTLS.
- Respuesta mínima: `valido`, `estado`, `cedula`, `fecha_vencimiento`, `version`.
- SILOG enriquece nombre/cargo/estatus desde la BD compartida.
- Auditoría por sistema/clave, rate limit propio y `no-store`.
- Errores: siempre `200` con `valido:false` + `estado`, salvo error de
  autenticación/red.

### 8.5 Fases de ejecución

| Fase | Entregable | Archivos principales | Criterio de aceptación |
|---|---|---|---|
| 1 | Parámetros de vigencia en Gestión del Sistema | `BACKEND/apps/configuracion/...`, `core/domain/configuracion.py`, UI de configuración | Cambiar un parámetro y verlo reflejado en una emisión nueva |
| 2 | Persistencia y cálculo de `fecha_vencimiento` | `CarnetEmitido`, `repo_carnetizacion_orm.py`, `consultar_qr.py`, PDF | Carnet vencido devuelve `VENCIDO` y SILOG lo rechaza |
| 3 | Validación de tamaño de QR en plantillas | diseñador, publicación de plantillas, backend de validación | No se publica una plantilla sin un QR ≥ mínimo |
| 4 | Endpoint de integración con API key | `apps/integraciones` o `apps/carnetizacion/presentation`, settings, auditoría | SILOG obtiene cédula + estado con su clave |
| 5 | Pruebas integrales | unitarias, integración, E2E con QR impreso | Vigente, vencido, revocado e inexistente se comportan igual en GATH y SILOG |

### 8.6 Pruebas mínimas

- Parámetro por tipo y respaldo global.
- Cambio de parámetro no altera carnets ya emitidos (si se persiste la fecha).
- Carnet vencido → `VENCIDO`; revocado → `ANULADO`; inexistente → `NO_REGISTRADO`.
- Plantilla sin QR grande → publicación bloqueada.
- API key inválida → 401/403; clave válida → cédula correcta; rate limit.
- Escaneo real con el QR del reverso, carnet plastificado y teléfono de gama
  media.


---

## 9. Contrato implementado (fase 4, endpoint de verificación)

Entregable para el equipo de SILOG. Implementado el 2026-11-10; no incluye vigencia
parametrizable, plantillas ni JWS (siguen pendientes).

**URL:** `GET /api/v1/integraciones/carnet/verificar/?hash=<codigo>`

**Formato del parámetro `hash`:** 22 caracteres base64url (`[A-Za-z0-9_-]`, distingue
mayúsculas) en los carnets y credenciales NUEVOS, o 64 hexadecimales en los anteriores
(ambos siguen vigentes). SILOG debe extraer el último segmento de la URL del QR,
`/carnet/<codigo>`, y enviarlo sin cambiar mayúsculas ni minúsculas.

**Autenticación:** cabecera `X-API-Key: <clave-de-silog>`. La clave la entrega GATH por un
canal seguro; se rota cambiando la variable de entorno del servidor GATH:

```
INTEGRACION_CARNET_API_KEYS="silog:<clave-de-al-menos-16-caracteres>"
```

Varios sistemas se separan por coma (`silog:...,otro:...`). Sin variable (o vacía) el
endpoint responde 503. La clave se compara en tiempo constante y no se registra en logs.

**Límite de uso:** 600 peticiones por minuto por sistema (`INTEGRACION_CARNET_THROTTLE_RATE`).
Al excederlo, 429.

**Códigos HTTP:** `200` siempre que la clave sea válida (incluso si el carnet no vale);
`401` clave ausente o errónea; `429` límite excedido; `503` integración sin claves
configuradas. La respuesta lleva `Cache-Control: no-store`. El JSON es plano (sin sobre
`status/message/data`).

Carnet vigente (trabajador, pasivo o credencial externa):

```json
{
  "valido": true,
  "estado": "VIGENTE",
  "cedula": "30799436",
  "nombre": "JOSE FERNANDO BOLIVAR HURTADO",
  "tipo_credencial": "trabajador",
  "estado_laboral": "ACTIVO",
  "fecha_emision": "2026-11-10",
  "fecha_vencimiento": "2027-11-10",
  "version": 1
}
```

Carnet no válido (`estado`: `ANULADO`, `VENCIDO` o `NO_REGISTRADO`; este último también
para un código con formato inválido):

```json
{
  "valido": false,
  "estado": "ANULADO",
  "cedula": null,
  "mensaje": "Carnet anulado.",
  "version": 1
}
```

Notas:

- `tipo_credencial` es `trabajador`, `pasivo` o el código del tipo de credencial externa
  (p. ej. `visitante`); en externas, `cedula` es el documento registrado y
  `estado_laboral` es `null`.
- `fecha_vencimiento` es `null` para trabajadores mientras no se defina la vigencia; en
  credenciales externas trae la fecha de fin de vigencia.
- La respuesta nunca incluye datos de salud, foto, contactos ni datos de vivienda.
- Cada consulta queda auditada en GATH (sistema, resultado, 8 primeros caracteres del
  código e IP de origen).
- Ejemplo: `curl -H "X-API-Key: $CLAVE" "https://<host-gath>/api/v1/integraciones/carnet/verificar/?hash=<codigo>"`
- Instrucción para SILOG: si la respuesta es `valido:true` con `tipo_credencial` externo o
  visitante y la cédula no existe en Employee ni en Apoyo, crear o actualizar el registro
  Apoyo (cédula, nombre, `interno=False`) y luego registrar la asistencia; GATH verifica en
  cada lectura, así que una credencial vencida o anulada se rechaza sola. Restringir
  servicios por tipo de credencial es regla propia de SILOG.

---

## 10. Propuestas futuras (no aprobadas)

### Verificación sin conexión con QR firmado (JWS Ed25519)

Propuesta, sin aprobación ni fecha. El QR llevaría un JWS compacto firmado con Ed25519
(carga útil: cédula, código, `iat`, `exp`, `kid`, `v`); GATH conserva la clave privada y
entrega a SILOG solo la clave pública, con la que verificaría la firma sin consultar a GATH.

Limitaciones que habría que aceptar:

- Requiere reimprimir todos los carnets: el JWS es mucho más largo que el código de 22
  caracteres y el QR volvería a tener más módulos.
- Un carnet anulado seguiría pareciendo válido sin conexión hasta que venza el JWS o SILOG
  reciba una lista de revocación; la verificación en línea sigue siendo la fuente de verdad.
- Exige gestión y rotación de claves (`kid`) y publicar el JWKS.
