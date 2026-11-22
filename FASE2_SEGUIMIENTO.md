# GATH Fase 2 — Seguimiento de pendientes

Rama: `feature/fase2-captacion-carnet` · Creado: 2026-11-20 · Referencia: `FASE2_PROPUESTA_TECNICA.md`

## ▶ Cómo continuar (actualizado 2026-11-22)

**Dónde quedamos:** bloques A, B, K (carnet), C (decisiones), D (Captación Ventana 1) **completos**. **Siguiente: bloque E** (Presupuesto y Dirección General: bandeja de Presupuesto, reserva de puesto, declaración de disponibilidad, Punto de Cuenta de ingreso, aprobación de Dirección General y tarea que libera reservas vencidas). Después F, G y H.

**Código:** rama `feature/fase2-captacion-carnet` en GitHub (`git fetch github && git checkout feature/fase2-captacion-carnet`). GitLab (`origin`) sigue sin resolver DNS: subir ahí cuando vuelva (`git push origin feature/fase2-captacion-carnet`). Nunca push a `dev` ni `qa`.

**En otra PC hace falta preparar:**
1. `BACKEND/.env` y `.env` de la raíz (no están en git; copiarlos de la PC anterior o del gestor de secretos).
2. `NextJS/.env.test.local` (no está en git) con `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` del usuario de pruebas `e2e.carnet.qa@conatel.gob.ve` (C.I. 99000990, rol ADMINISTRADOR). Si no se tiene la contraseña, crear otro usuario de pruebas.
3. Migraciones de esta rama ya aplicadas en la base de desarrollo de la PC anterior: carnetizacion 0013–0022, configuracion 0013–0015, identidad 0016, notificaciones 0003, postulacion 0001–0004. En una base nueva: `python manage.py migrate`.
4. Entorno de la rama (sin tocar el del usuario en 8001/3001): backend en **:8005** (contenedor `gath-fase2-django`, montado desde `BACKEND` de esta rama) y Next dev en **:3005**:
   `NEXT_PUBLIC_DJANGO_API_URL_SERVER=http://127.0.0.1:8005 NEXT_PUBLIC_DJANGO_API_URL=http://127.0.0.1:8005 NEXTAUTH_URL=http://127.0.0.1:3005 AUTH_URL=http://127.0.0.1:3005 AUTH_TRUST_HOST=true npx next dev --turbopack -p 3005`
   El contenedor de :3001 se construye desde `gath-nueva-arquitectura` (otra rama): los cambios de la Fase 2 solo se ven en :3005 hasta integrar la rama.

**Verificación habitual:**
- Backend (contenedor desechable, desde la raíz del repo): `docker run --rm --entrypoint sh --network gath-nueva-arquitectura_backend --add-host host.docker.internal:host-gateway --env-file .env -e DJANGO_DB_HOST=host.docker.internal -e DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,testserver -v "$PWD/BACKEND":/app/Django -w /app/Django gath-backend:latest -c "lint-imports && python manage.py makemigrations --check --dry-run && python -m pytest -q -p no:cacheprovider -o addopts='--nomigrations --create-db'"` (último resultado: 3217 ✅, 109 contratos).
- Frontend (desde `NextJS`): `npx tsc --noEmit -p .` · `npx vitest run` (1486 ✅).
- E2E: `set -a; . ./.env.test.local; set +a; E2E_BASE_URL=http://127.0.0.1:3005 E2E_DJANGO_URL=http://127.0.0.1:8005 npx playwright test e2e/postulacion-acceso.spec.ts e2e/captacion-bandeja.spec.ts e2e/carnetizacion.spec.ts e2e/carnet-disenador-imprime.spec.ts e2e/carnet-disenador-movil.spec.ts e2e/dashboard-permisos.spec.ts`

**Forma de trabajo acordada con el usuario:**
- Responder siempre en español.
- Los workers implementan (subagentes Sonnet; opencode/Antigravity cuando tengan cuota) y Claude audita: código, pruebas y **verificación visual con Playwright** (escritorio 1280 y teléfono 390x844). Diseño amigable, intuitivo y atractivo.
- Por cada tarea: especificación clara al worker (sin git que escriba, sin servidores), auditoría, commit con el detalle y push a GitHub; actualizar este archivo (estado 🟦 al empezar, ✅ con commit, bitácora).
- Pedir aprobación antes de cambios grandes o de decisiones de negocio.
- Cuidado: la base de desarrollo **envía correos reales** por el outbox; en pruebas en vivo usar direcciones `@ejemplo.invalid` y limpiar.

**Pendientes abiertos fuera de E:** C-9 (¿jubilados pueden postularse? provisional: sí), enlace de aviso de Presupuesto `/postulacion/solicitudes/{id}` (se hace en E), correo al postulante al «observar faltantes» de la Ventana 2 (fácil de agregar), `verificar_plantilla_legacy` en producción antes de desplegar el carnet, prueba con S3 autenticado en el servidor real, `test_pdf_emitido` inestable una vez (vigilar), datos de prueba de las E2E en la base de desarrollo.

---

**Estados:** ⬜ Pendiente · 🟦 En curso · ✅ Completado · ⏸️ En espera (decisión externa)

Cómo actualizar: cambiar el ícono de la columna **Estado**, la **Fecha** del último cambio y, si aplica, la **Nota** (commit, PR, bloqueo).

---

## Resumen

| Bloque | Total | ⬜ | 🟦 | ✅ | ⏸️ |
|---|---|---|---|---|---|
| A · Carnet: corrección de impresión | 9 | 0 | 0 | 9 | 0 |
| B · Carnet: funciones faltantes | 11 | 0 | 0 | 11 | 0 |
| C · Decisiones para Captación | 10 | 0 | 0 | 9 | 1 |
| D · Captación Ventana 1 (E-3) | 9 | 0 | 0 | 9 | 0 |
| E · Presupuesto y Dirección General (E-4) | 7 | 7 | 0 | 0 | 0 |
| F · Documentos digitales (E-5) | 7 | 6 | 0 | 0 | 1 |
| G · Ventana 2 y asignación de cargo (E-6) | 6 | 6 | 0 | 0 | 0 |
| H · Transversales / deuda técnica | 13 | 7 | 0 | 6 | 0 |
| I · Sincronización con nómina (E-9) | 1 | 0 | 0 | 0 | 1 |
| K · Hallazgos de auditoría (opencode) | 16 | 0 | 0 | 16 | 0 |
| J · Documentación del plan | 2 | 2 | 0 | 0 | 0 |

---

## Plan de trabajo (orden)

1. **A — Carnet: lo diseñado = lo impreso.** Sin decisiones pendientes; corrige carnets que hoy salen distintos al diseño.
2. **C — Cerrar decisiones de Captación** (en paralelo con A/B; las toma el área usuaria).
3. **B — Carnet: funciones faltantes** (vista previa de borrador, estados de emisión, lote de trabajadores…).
4. **D — Captación Ventana 1** (app `postulacion`, credencial, acceso de invitado, bandeja).
5. **E — Presupuesto y Dirección General** (reserva, constancia, Punto de Cuenta de ingreso).
6. **F — Documentos digitales** (requiere los PDF oficiales de HCM, Caja de Ahorro, Oferta).
7. **G — Ventana 2 y asignación atómica del cargo.**
8. **H — Transversales**, intercalados según convenga.
9. **I — Nómina:** en espera hasta conocer el sistema destino.

---

## A · Carnet: corrección de impresión

| ID | Tarea | Estado | Fecha | Nota |
|---|---|---|---|---|
| A-1 | Unificar el dibujador de cara: el PDF individual y el de lote usan la misma función (hoy el lote no tiene `radios`, `puntos`, ajuste de texto ni estilo de QR) y cada tarjeta del lote se recorta a su borde | ✅ Completado | 2026-11-20 | `dibujar_cara` único en `carnet_pdf.py`; commit `874e8f36` |
| A-2 | Imágenes de la biblioteca: guardar `biblioteca_id` al guardar la plantilla, dibujarlas en el PDF desde SeaweedFS y reconstruir la vista al recargar el diseñador | ✅ Completado | 2026-11-20 | también en la miniatura de plantillas; commit `874e8f36` |
| A-3 | Rotación (`r`) y opacidad (`op`) aplicadas en el PDF; guardar `op` en la plantilla | ✅ Completado | 2026-11-20 | corrige además que volver a 0° / 100 % no se guardaba; commit `874e8f36` |
| A-4 | Elegir la plantilla al emitir y en la vista previa con la misma regla (activa y publicada), según la condición REAL del titular; exigir plantilla publicada; no registrar `version=1` falsa | ✅ Completado | 2026-11-20 | commit `8f751d97`. Causa real: el carnet trataba como pasivo a cualquier egresado (un abandono de cargo recibía el carnet de jubilado). Ahora usa el resolutor central, corregido para que solo los egresos de categoría pasiva cuenten como pasivo legado; sin asignación vigente no se emite. La consola muestra la condición real |
| A-5 | `activar_plantilla` exige estado publicada; no se borra una plantilla con versiones derivadas (cascada) ni con carnets emitidos | ✅ Completado | 2026-11-20 | commit `ae53a219`. La FK no se cambió a PROTECT: la raíz se referencia a sí misma y bloquearía todo borrado; la regla vive en el repositorio |
| A-6 | Solicitudes de carnet reales: el trabajador SOLICITA desde Autogestión y RRHH emite o rechaza desde la bandeja (adiós `SOLICITUDES_INICIALES`) | ✅ Completado | 2026-11-20 | commit `677cc0e1`. Decisión del usuario: solicitud + bandeja RRHH. Modelo `CarnetSolicitud` (migración 0013, **aplicada en la BD de desarrollo**), avisos, auditoría, retiro por el trabajador. Corrige además la invalidación de caché de «Mi expediente» al emitir carnet |
| A-7 | Campo «Rotación (°)» en el panel de propiedades: el tirador de giro de Konva queda fuera del lienzo si el elemento está cerca del borde superior y no había otra forma de girar | ✅ Completado | 2026-11-20 | hallado en la prueba con Playwright; commit `874e8f36` |
| A-8 | Miniatura de plantillas: mostrar imagen de biblioteca, rotación y opacidad igual que el PDF | ✅ Completado | 2026-11-20 | commit `874e8f36` |
| A-9 | Prueba E2E `e2e/carnet-disenador-imprime.spec.ts` (biblioteca + rotación + opacidad: guardar, recargar, miniatura) | ✅ Completado | 2026-11-20 | crea y borra sus propios datos; commit `874e8f36` |

## B · Carnet: funciones faltantes

| ID | Tarea | Estado | Fecha | Nota |
|---|---|---|---|---|
| B-1 | Vista previa con el motor PDF y las dos caras: de una plantilla en borrador o con cambios sin guardar (botón «Vista previa PDF» del diseñador) y reverso real en la consola de emisión | ✅ Completado | 2026-11-20 | commit `0e88364b` |
| B-2 | Modo carga directa: fondo por cara desde imagen o PDF de la biblioteca, con campos encima | ✅ Completado | 2026-11-20 | commit `a098856f`. `fondos: {anverso|reverso: {biblioteca_id, nombre, mime_type, ...}}` en la definición; se conserva al guardar/recargar y se congela en `plantilla_snapshot`. El PDF dibuja la imagen a sangre (con sangrado) antes de los elementos; sin fondo queda el color de `bg`. Diseñador: sección «Fondo» por cara con selector de la Biblioteca, miniatura, quitar y estados de carga/error; el lienzo Konva muestra el mismo fondo. PDF histórico: `POST /biblioteca/<id>/rasterizar-fondo/` convierte la primera página a PNG con `pdf2image`/Poppler (ya en `requirements.txt`) y guarda un medio PNG (si el mismo PDF se elige otra vez, reutiliza el PNG ya generado, commit `f4b86084`); no se sirve ni incrusta el PDF. Si falta Poppler se rechaza con «convierta la página a PNG». 378 pruebas backend + 177 frontend ✅ |
| B-3 | PDF «formato imprenta»: sangrado configurable (`carnetizacion.sangrado_mm`, 2 mm) y marcas de corte en el carnet individual, con TrimBox/BleedBox | ✅ Completado | 2026-11-20 | commit `40b040a3`. Casilla en la consola y `?formato=imprenta` al reimprimir. Las formas diagonales/libres en el borde no se estiran: deben diseñarse pasando 2 mm el borde. Migración `configuracion.0013` (siembra el parámetro) aplicada en la BD de desarrollo |
| B-4 | Guardar el PDF emitido y reimprimirlo idéntico | ✅ Completado | 2026-11-20 | commit `2c2361af`. En lugar de columnas en `CarnetEmitido` (tabla heredada sin migraciones) se creó `CarnetEmitidoArchivo` (migración 0014, aplicada en desarrollo): clave opaca, sha256, formato. Verificado en el entorno real: la reimpresión devuelve los mismos bytes. Ojo: si SeaweedFS está caído, cada emisión espera los reintentos de red antes de seguir sin copia |
| B-5 | Ciclo físico del carnet: EMITIDO → IMPRESO → ENTREGADO, y ANULADO con motivo | ✅ Completado | 2026-11-20 | commit `1f127aa2`. Tabla `CarnetCiclo` (migración 0015, aplicada en desarrollo); revocar ahora exige motivo; aviso «listo para retirar»; controles en la consola. Nota: `ui/carnetizacion-page.tsx` es código sin ruta que llama al revocar antiguo sin motivo |
| B-6 | Impresión por lote para trabajadores (hoy solo credenciales externas) | ✅ Completado | 2026-11-20 | commit `5bf3bdb6`. Cola en `GET /carnetizacion/cola-impresion/` y lote en `POST /carnetizacion/lote-trabajadores/pdf/`; pestaña «Trabajadores» con «Marcar como impresos». `modo_duplex` (ninguno/largo/corto) configurable en ambos lotes porque el espejado del reverso depende del equipo; se conserva el comportamiento anterior por defecto en credenciales externas. 342 pruebas backend + 169 frontend ✅ |
| B-7 | Tipos de credencial contratado, pasante y autoridad; sembrar el diseño heredado como plantilla v1 LEGACY con prueba de comparación de imagen; retirar `CarnetTemplate` | ✅ Completado | 2026-11-20 | commit `26ae0609`. Migración `0017` siembra los 3 tipos y la plantilla LEGACY v1 (imagen heredada embebida; si falta el archivo, fondo vectorial institucional). Prueba de comparación de imagen con tolerancia documentada (máx. por canal ≤ 2, media ≤ 0.05, < 0.1 % de píxeles con diferencia > 8). `CarnetTemplate` retirado del código (`0018`; tabla física intacta); reimpresión antigua: snapshot → plantilla → LEGACY → por defecto. 367 pruebas backend + 169 frontend ✅. En dev falta `Director_General.png`, por eso la LEGACY local usa el fondo vectorial |
| B-8 | Seguridad de la biblioteca: SVG con lista blanca o rasterizado, servido como adjunto (hoy un SVG no sale en el PDF: ReportLab no lo dibuja) | ✅ Completado | 2026-11-20 | commit `8bcdedce`. Subidas nuevas: tipo real por magic bytes y solo PNG/JPEG/WebP; SVG rechazado con mensaje claro. SVG históricos se sanean al descargar (lista blanca estricta; si no es saneable, `application/octet-stream`), `attachment` + `nosniff` + CSP sandbox; el PDF ignora SVG. 362 pruebas backend + 190 frontend ✅ |
| B-9 | Medios sembrados sin archivo en SeaweedFS: «Firma Dirección General», «Sello y Marca de Agua CONATEL», «Logo Oficial CONATEL» (clave en BD sin objeto → 404 en el diseñador y recuadro en el PDF). Volver a subirlos o corregir la siembra | ✅ Completado | 2026-11-20 | commit `5dad5b6d`. Causa: la migración 0008 creaba las filas sin subir el objeto. Migración `0016` retira las 3 filas fantasma (aplicada en desarrollo); `0008` corregida para instalaciones nuevas; los 3 medios pueden cargarse desde Biblioteca de Medios (categorías Logo, Firma o Imagen/Sello); el comando `verificar_biblioteca_institucional` queda para carga masiva desde disco (rutas en `BACKEND/media/biblioteca_institucional/`). El diseñador muestra «Archivo no disponible» mientras no exista el archivo |
| B-10 | Accesibilidad del diseñador: las etiquetas de `CampoNumerico` (X, Y, Ancho, Alto) no están asociadas a su input | ✅ Completado | 2026-11-20 | commit `62f7ac66`. `useId` + `htmlFor` en `CampoNumerico`; 13 pruebas del diseñador ✅ |
| B-11 | E2E `carnetizacion.spec.ts` prueba 2: dependía de una cédula fija que resultó ser un egresado y de un `h4` que ya no existe | ✅ Completado | 2026-11-20 | commit `8f751d97`; ahora busca un titular ACTIVO y uno SIN_ASIGNACION por la API |

## C · Decisiones para Captación (área usuaria)

| ID | Decisión | Estado | Fecha | Nota |
|---|---|---|---|---|
| C-1 | DEC-4 · Reingreso de un egresado (recomendado: expediente nuevo sobre el `Employee` existente) | ✅ Decidido | 2026-11-20 | Misma persona (`Employee` existente) con expediente nuevo: conserva historial, sin duplicar cédula |
| C-2 | DEC-5 · Quién declara la disponibilidad presupuestaria (recomendado: usuario nominal) | ✅ Decidido | 2026-11-20 | Quien tenga el permiso de declarar disponibilidad (p. ej. administrador de Presupuesto o quien designe el usuario); queda registrado con nombre |
| C-3 | DEC-6 · Vigencia de las ventanas del postulante (configurable) | ✅ Decidido | 2026-11-20 | Parámetro configurable por ventana (p. ej. 15 días) · implementado en `4643d885` |
| C-4 | DEC-7 · Vigencia de la reserva de puesto | ✅ Decidido | 2026-11-20 | Parámetro configurable (p. ej. 30 días); al vencer se libera sola · implementado en `4643d885` |
| C-5 | DEC-9 · Firma del postulante (recomendado: clic de conformidad con evidencia) | ✅ Decidido | 2026-11-20 | Clic de «acepto y declaro» con fecha, hora, IP y huella (sha256) del documento; sin firma electrónica certificada por ahora |
| C-6 | DEC-11 · Test psicofísico: en el sistema o solo resultado (recomendado: solo resultado) | ✅ Decidido | 2026-11-20 | Solo se carga resultado e informe (por ahora); que sea obligatorio o no, parametrizable · implementado en `4643d885` |
| C-7 | DEC-3 · Plazo de retención de expedientes rechazados (Consultoría Jurídica) | ✅ Decidido | 2026-11-20 | Plazo de retención parametrizable (el valor lo fija Consultoría Jurídica) · implementado en `4643d885` |
| C-8 | Definir roles y permisos: CAPTACION, DIRECCION_GENERAL (y PRESUPUESTO para el flujo) | ✅ Decidido | 2026-11-20 | Crear roles CAPTACION, PRESUPUESTO y DIRECCION_GENERAL con sus permisos; el usuario los asigna a las personas · implementado en `4643d885` |
| C-9 | ¿Un jubilado o pensionado puede volver a postularse? | ⏸️ Por aclarar | 2026-11-20 | Provisional: SÍ (solo se rechaza a quien está ACTIVO). Confirmar con el área usuaria |
| C-10 | Espera máxima de un expediente DIFERIDO_PRESUPUESTO antes de pasar a DESISTIDO | ✅ Decidido | 2026-11-20 | Parámetro configurable, 90 días por defecto (se aplica con los vencimientos automáticos) · implementado en `18282e98` (`captacion.espera_diferido_dias`, guarda DIFERIDO→DESISTIDO) |

## D · Captación Ventana 1 (E-3)

| ID | Tarea | Estado | Fecha | Nota |
|---|---|---|---|---|
| D-1 | App `apps/postulacion`: `Postulante`, `ExpedientePostulacion`, `TransicionExpediente` | ✅ Completado | 2026-11-20 | `29ec691e`: 17 estados (el diagrama de §4.2 tiene 17, no 16) y 24 transiciones con permiso y guardas; historial inmutable; un expediente abierto por postulante; un trabajador ACTIVO no puede postularse |
| D-2 | Máquina de estados (16 estados) con pruebas de todas las transiciones legales e ilegales | ✅ Completado | 2026-11-20 | `29ec691e`: 17 estados (el diagrama de §4.2 tiene 17, no 16) y 24 transiciones con permiso y guardas; historial inmutable; un expediente abierto por postulante; un trabajador ACTIVO no puede postularse |
| D-3 | `CredencialPostulante`: hash, ventana, vencimiento, bloqueo por intentos, cambio obligatorio | ✅ Completado | 2026-11-21 | `f7386b4e`: credencial con hash, bloqueo 5/15 min, cambio obligatorio, vigencia de la ventana |
| D-4 | Endpoints del postulante: acceso, cambiar clave, mi expediente, borrador, enviar | ✅ Completado | 2026-11-21 | `f7386b4e`: API del postulante (acceso, cambiar-clave, mi-expediente, borrador, enviar) y de Captación (alta, reponer); sesión de invitado aislada; probado en vivo |
| D-5 | Proveedor NextAuth de invitado (cédula + contraseña, rol sintético, sesión ≤ 2 h) | ✅ Completado | 2026-11-21 | `cd6e8ce4`: proveedor NextAuth «postulante», token solo en el JWT cifrado (verificado: /api/auth/session no lo expone), sesión ≤ 2 h |
| D-6 | Rutas `/postulacion/*` y regla de invitado en `proxy.ts` / `REGLAS_RUTA` | ✅ Completado | 2026-11-21 | `cd6e8ce4`: rutas /postulacion (acceso, cambiar-clave, inicio con Ventana 1, recibido), layout móvil, reglas del proxy; E2E escritorio y 390x844 |
| D-7 | Bandeja de Captación: alta de postulante, verificación, devolución, rechazo | ✅ Completado | 2026-11-21 | backend `3966b354` + pantallas `4780950e` (bandeja, nuevo postulante, detalle con acciones del backend) |
| D-8 | Registro del resultado del test psicofísico | ✅ Completado | 2026-11-21 | backend `3966b354` + pantalla `4780950e` (registro APTO/NO_APTO e informe PDF) |
| D-9 | Notificaciones del flujo (expediente recibido, observado) | ✅ Completado | 2026-11-21 | `3966b354`: avisos RECIBIDO, REVISION_FINAL y EN_PRESUPUESTO con bandeja compartida, etiquetas en la campana; correo al postulante (devolver, Ventana 2, rechazo) en `392cee9e` |

## E · Presupuesto y Dirección General (E-4)

| ID | Tarea | Estado | Fecha | Nota |
|---|---|---|---|---|
| E-1 | Consulta de vacantes por cargo y oficina para el expediente | ⬜ Pendiente | | reutiliza `cargos/vacantes` |
| E-2 | `ReservaPuesto` con vencimiento y restricción de una reserva activa por puesto | ⬜ Pendiente | | |
| E-3 | `ConstanciaPresupuestaria` (declarado por, fecha, referencia, adjunto) | ⬜ Pendiente | | |
| E-4 | Devoluciones diferenciadas: `EN_CORRECCION_CARGO` y `DIFERIDO_PRESUPUESTO` | ⬜ Pendiente | | |
| E-5 | Punto de Cuenta de ingreso: proceso `ingreso_postulacion` en `apps/puntocuenta`, ligado al expediente, con estados emitido/firmado | ⬜ Pendiente | | |
| E-6 | Bandeja de Dirección General: aprobar o rechazar (libera la reserva) | ⬜ Pendiente | | |
| E-7 | Tarea programada: liberar reservas vencidas | ⬜ Pendiente | | |

## F · Documentos digitales (E-5)

| ID | Tarea | Estado | Fecha | Nota |
|---|---|---|---|---|
| F-1 | App `apps/documentos`: `PlantillaDocumento`, `DocumentoGenerado` (con snapshot y sha256), `FirmaDocumento` | ⬜ Pendiente | | |
| F-2 | Motor `pdf_overlay` compartido con el carnet | ⬜ Pendiente | | |
| F-3 | Obtener los PDF oficiales vigentes: HCM, Caja de Ahorro, Oferta de Servicios | ⏸️ En espera | | lo entrega el área usuaria |
| F-4 | Planillas prellenadas: Oferta de Servicios, Caja de Ahorro, HCM | ⬜ Pendiente | | depende de F-3 |
| F-5 | Contrato, Notificación de Itinerancia, Declaración jurada, Autorización de datos | ⬜ Pendiente | | |
| F-6 | Firma por clic de conformidad con evidencia | ⬜ Pendiente | | depende de C-5 |
| F-7 | Descarga autenticada con registro en bitácora | ⬜ Pendiente | | ver H-3 |

## G · Ventana 2 y asignación de cargo (E-6)

| ID | Tarea | Estado | Fecha | Nota |
|---|---|---|---|---|
| G-1 | Reapertura de Ventana 2 y tarea `CONTACTAR_POSTULANTE` con antigüedad visible | ⬜ Pendiente | | |
| G-2 | Carga de grupo familiar, vivienda, salud, tallas y foto por el postulante | ⬜ Pendiente | | |
| G-3 | Revisión final de Captación (observar faltantes / conforme) | ⬜ Pendiente | | |
| G-4 | Caso de uso de promoción atómica: crear `Employee`, asignar puesto revalidado, INGRESO, cuenta, cerrar expediente | ⬜ Pendiente | | orquesta `crear_empleado` + `asignar_cargo_a_empleado` + `aprovisionar_cuenta_trabajador` |
| G-5 | `Employee.origen_expediente`, `foto_objeto`, `foto_actualizada` | ⬜ Pendiente | | |
| G-6 | Prueba de concurrencia: dos expedientes al mismo puesto | ⬜ Pendiente | | |

## H · Transversales / deuda técnica

| ID | Tarea | Estado | Fecha | Nota |
|---|---|---|---|---|
| H-1 | SeaweedFS: `sw_s3` del `compose.yml` real sin `identities.json` (S3 sin autenticación) | ✅ Completado | | prioridad alta. Contenido: `sw_s3` no publica puertos al host, solo red interna; el riesgo es defensa en profundidad. Añadir `identities.json` + `-s3.config`, montarlo de solo lectura y alinear `S3_ACCESS_KEY`/`S3_SECRET_KEY` del backend · `97daab51`: `sw_s3` con `identities.json` (generado con `infra-fase2/seaweedfs/generar-identidades.sh`). `a8894e00`: ya no es manual; `sw_s3` genera `identities.json` al arrancar desde las claves de `BACKEND/.env` (sin claves no arranca). Para desplegar basta `docker compose up -d` |
| H-2 | Claves de soportes de autogestión sin cédula (`autogestion/soportes/{cedula}/…` → `clave_segura`) | ⬜ Pendiente | | |
| H-3 | Bitácora de descargas de archivos (quién, qué, cuándo) | ⬜ Pendiente | | |
| H-4 | Bandeja compartida: cuando alguien atiende un caso avisado a varias cuentas (envío por permiso), marcar como atendidas las copias de los demás («el primero que actúa la resuelve», propuesta §5.6) | ✅ Completado | 2026-11-20 | `32bc0ac5`: `Notificador.resolver_avisos(ref_tipo, ref_id, por_cedula, tipo=None)`; falta llamarlo desde Captación/Presupuesto cuando existan (D/E) |
| H-5 | Notificaciones en tiempo real (SSE) | ⬜ Pendiente | | opcional |
| H-6 | Separar colas de Celery (docs, mail, maint) | ⬜ Pendiente | | baja prioridad |
| H-7 | Ejecutar migraciones en CI al menos una vez (hoy `--nomigrations`) | ⬜ Pendiente | | Nota 2026-11-20: en las pruebas no se pueden aplicar todas las migraciones desde cero (`conftest.py` pone managed=True y faltan tablas heredadas como Employee); las migraciones 0017/0020 se prueban llamando sus funciones |
| H-8 | Escritura sin permiso explícito: `ConfirmarFilasCargaMasivaView` (solo `IsAuthenticated`) | ✅ Completado | | Revisado 2026-11-20: `SolicitarCarnetView` es autoservicio correcto (Zero-IDOR); las vistas de gestión de `reportes_error_views` ya exigen `personal.reportes_error_ver`; `carnetizacion_views.py:829` era una referencia obsoleta (bloque `except` de auditoría). Exigir `HasPermission(APLICAR)` o un permiso `CONFIRMAR` + prueba de 403 · `d4f5ee5f`: exige `personal.carga_masiva_aplicar` |
| H-11 | Corrección EXIF de los fondos de carnet (fotos de teléfono rotadas) | ✅ Completado | | B-2: aplicar `ImageOps.exif_transpose` al rasterizar/dibujar el fondo + prueba con JPEG rotado · `b7702e1b`: `ImageOps.exif_transpose` en el fondo |
| H-12 | SeaweedFS caído: la emisión espera los reintentos de red antes de continuar sin copia | ✅ Completado | | B-4: acortar timeouts o guardar el PDF de forma no bloqueante; prueba con almacén caído · `e83034ed`: timeouts y reintentos acotados en SeaweedFS; guardar el PDF emitido falla en < 6 s sin bloquear la emisión |
| H-13 | Fondo desde PDF: permitir elegir la página, no solo la primera | ✅ Completado | | B-2: mejora opcional; hoy se usa la primera página · `b7702e1b` + `e15d8d3d`: selector «Página del PDF» en el diseñador |
| H-9 | Renombrar BD local `SIGEP` → `gath` en `.env.example` y `compose.example.yml` | ⬜ Pendiente | | baja prioridad |
| H-10 | Limpiar la tolerancia a la errata «BIENSTAR» en `verificar_esquema.py` | ⬜ Pendiente | | ya corregido en producción |

## K · Hallazgos de la auditoría del trabajo de opencode (B-2, B-6 a B-10)

> **Plan aprobado por el usuario (2026-11-20):** corregir K-1…K-12, H-11, H-12, H-13, H-1 y H-8. Decisiones: **K-7** marcar impreso desde el lote exige `carnetizacion.emitir`; **K-8** el lote de visitantes vuelve a «una cara» por defecto (dúplex como opción); **B-2/H-13** se permite subir PDF solo como fondo, con límites y elección de página; **K-11** los tipos contratado/pasante/autoridad quedan como están hasta recibir el formato (DEC-10). K-9 no se modifica (migración ya aplicada; el comando de verificación cubre el caso).


| ID | Hallazgo | Estado | Fecha | Nota |
|---|---|---|---|---|
| K-1 | **Alta** · Lote a doble cara: las páginas salen «todos los anversos y luego todos los reversos»; con más de 9 carnets los reversos no caen detrás de su anverso. Intercalar A1, R1, A2, R2… (`carnet_pdf_lote.py:75`) | ✅ Completado | 2026-11-20 | auditoría de B-6 (opencode) · `b7702e1b`: páginas intercaladas A1,R1,A2,R2… por hoja |
| K-2 | **Alta** · Migración `carnetizacion.0017`: consulta `CarnetTemplate` sin savepoint; en una base nueva (sin esa tabla) PostgreSQL aborta la transacción y la migración falla. Además importa código vivo de la app | ✅ Completado | 2026-11-20 | auditoría de B-7; no se nota en desarrollo ni en pruebas (`--nomigrations`) · `b7702e1b`: comprueba la tabla antes de consultar y congela el diseño heredado |
| K-3 | **Media** · Cola de impresión: los carnets anteriores a B-5 (sin `CarnetCiclo`) cuentan como «pendientes de impresión» y llenan la cola (orden ascendente, tope 500). Sembrar su ciclo o usar fecha de corte | ✅ Completado | 2026-11-20 | auditoría de B-6 · `b7702e1b`: migración 0020 marca ENTREGADOS los carnets activos sin ciclo (aplicada en desarrollo) |
| K-4 | **Media** · Rasterizar PDF sin límite de tiempo ni de tamaño de página (`rasterizar_pdf.py:58`); y la subida no acepta PDF, así que «fondo desde PDF» de B-2 hoy no se puede usar | ✅ Completado | 2026-11-20 | auditoría de B-2 · `b7702e1b`: límites de páginas (50), tamaño (A2), tiempo (20 s) y PDF solo en la categoría «fondo» (migración 0019) |
| K-5 | **Media** · Imágenes de fondo sin límite de píxeles (PNG de 13000×13000 px < 1 MB decodifica a cientos de MB) | ✅ Completado | 2026-11-20 | auditoría de B-2 · `b7702e1b`: máximo 40 MP en subida y al dibujar |
| K-6 | **Media** · Lote: el fondo se vuelve a procesar por cada tarjeta y cara (hasta ~180 veces en un lote de 90); memoizar | ✅ Completado | 2026-11-20 | auditoría de B-2/B-6 · `b7702e1b`: fondo memoizado (lru_cache) y caché negativa de rasterizado |
| K-7 | **Media** · Marcar impreso desde el lote basta con `carnetizacion.lote`; el endpoint individual exige `carnetizacion.emitir` | ✅ Completado | 2026-11-20 | decidir permiso · `e83034ed`: marcar impreso desde el lote exige `carnetizacion.emitir` (403) |
| K-8 | **Media** · El lote de visitantes cambió a «dúplex borde largo» por defecto en el frontend sin anunciarlo | ✅ Completado | 2026-11-20 | decidir el valor por defecto · `e15d8d3d`: lote a una cara por defecto; dúplex como opción |
| K-9 | **Media** · Migración 0016 borra los 3 medios sin comprobar si el archivo existe en SeaweedFS | ✅ Cerrado sin cambios | 2026-11-20 | riesgo bajo en la práctica · decisión del usuario: la migración ya está aplicada; queda la nota |
| K-10 | **Media** · Reimpresión de carnets antiguos sin diseño congelado: ahora usan la plantilla LEGACY; si la 0017 no encontró la imagen, se sembró un fondo vectorial que nunca existió | ✅ Completado | 2026-11-20 | verificar en producción antes de desplegar · `e83034ed`: comando `verificar_plantilla_legacy` (en desarrollo: fondo vectorial, 0 carnets dependientes). **Correrlo en producción antes de desplegar** |
| K-11 | **Baja** · Tipos contratado/pasante/autoridad: nada los asigna al emitir (solo si el operador elige la plantilla a mano). Depende de DEC-10 | ✅ Completado | 2026-11-20 | `5fa465e2`: el formato ya existía (plantilla con colores por nómina, en QA desde el 12/11). Se retiró «autoridad» (Alto Nivel = FUNCIONARIO) (migración 0021). Después, por decisión del usuario, también se retiraron los tipos contratado y pasante: su carnet es el de trabajador con el diseño de su nómina (`1a85cff1`, migración 0022) |
| K-12 | **Baja** · Varios: lote con hojas de otro tamaño/orientación se descuadra; la UI permite seleccionar hasta 500 pero el backend admite 90; LEGACY sin reverso deja página en blanco en el lote; carrera al borrar medios compartidos; borrar un medio usado como fondo no avisa; `fondos` fuera del deshacer; imagen LEGACY en base64 en los listados | ✅ Completado | 2026-11-20 | `b7702e1b` (tamaños mezclados, LEGACY sin página en blanco) + `e83034ed`/`e15d8d3d` (409 al borrar un medio en uso con confirmación, bloqueo y borrado en on_commit, sin base64 en listados, máximo 90 en la UI) |
| K-13 | **Alta** · El PDF nunca recibía la nómina del titular: todos los carnets salían con el color de Funcionario aunque la plantilla tuviera reglas por nómina (también en QA). Tampoco el nivel | ✅ Completado | 2026-11-20 | `5fa465e2`: nómina y nivel de la asignación vigente en emisión, reimpresión, lote, vista previa y Mi carnet; prueba de píxel (contratado amarillo, obrero rojo, funcionario azul) |
| K-14 | **Media** · La regla de uso de cada plantilla (p. ej. nómina = CONTRATADO) se ignoraba al emitir | ✅ Completado | 2026-11-20 | `5fa465e2`: gana la plantilla cuya regla coincide con el titular; si no, la genérica |
| K-15 | **Alta** · Diseñador: al volver a la ventana SWR revalidaba la plantilla y el editor se reiniciaba, perdiendo lo no guardado (reporte del usuario) | ✅ Completado | 2026-11-21 | `3b8f7b18`: inicializa solo al cambiar de plantilla, sin revalidación automática, indicador «Cambios sin guardar», aviso al salir |
| K-16 | **Media** · Diseñador: no se podía dar forma libre a un rectángulo o círculo; el radio de esquinas era poco visible (reporte del usuario) | ✅ Completado | 2026-11-21 | `3b8f7b18`: control visual de esquinas y «Convertir en forma libre (editar puntos)» |

## I · Sincronización con nómina (E-9)

| ID | Tarea | Estado | Fecha | Nota |
|---|---|---|---|---|
| I-1 | Outbox, mapeo de catálogos, despacho y conciliación con el sistema de nómina | ⏸️ En espera | 2026-11-20 | Sistema destino por definir (probablemente no SIGESP) |

## J · Documentación del plan

| ID | Tarea | Estado | Fecha | Nota |
|---|---|---|---|---|
| J-1 | Actualizar `FASE2_PROPUESTA_TECNICA.md` (§1, §4.6, §7.1, §12.6, §13 describen un estado que ya no existe) y marcar §4.7/E-9 como pendiente de definición | ⬜ Pendiente | | |
| J-2 | Corregir en `Propuesta_Fase2_GATH.html` la sección de nómina (escritura directa / SIGESP) | ⬜ Pendiente | | |

---

## Bitácora de cambios

| Fecha | Cambio |
|---|---|
| 2026-11-22 | Documentos versionados en GitHub para continuar desde otra PC (`FASE2_SEGUIMIENTO.md`, `FASE2_PROPUESTA_TECNICA.md`, `Propuesta_Fase2_GATH.html`) y sección «Cómo continuar». Siguiente: bloque E. |
| 2026-11-21 | Pendientes del bloque D cerrados (commit `392cee9e`, GitHub ✅): correo al postulante por el outbox (puerto nuevo del kernel) y sesión vencida del postulante a su portal. En la auditoría en vivo se detectó y corrigió que un borrador sin correo borraba el registrado por Captación. Ojo: el outbox de la base de desarrollo SÍ envía correos reales (las pruebas en vivo usan direcciones `.invalid` y se limpian). Suite 3217 ✅, frontend 1486 ✅, E2E 11 ✅. |
| 2026-11-21 | **Bloque D completo** (9/9). Pantallas de Captación (commit `4780950e`, GitHub ✅): bandeja, nuevo postulante, detalle y psicofísico. Worker Sonnet; en la auditoría visual se corrigió el botón que tapaba las pestañas en el teléfono y la E2E frágil. Frontend 1479 ✅, E2E Captación/postulante/carnet ✅. Pendientes menores: correo al postulante, cierre por inactividad del postulante a /login, enlace de aviso de Presupuesto `/postulacion/solicitudes/{id}` (se hará en E). En la base de desarrollo quedan expedientes de prueba creados por las E2E. |
| 2026-11-21 | Backend de D-7, D-8 y D-9 (commit `3966b354`, GitHub ✅): bandeja de Captación, psicofísico y avisos del flujo. Worker Sonnet; suite 3191 ✅; probado en vivo (aviso a 8 cuentas y resuelto al devolver; avisos de prueba borrados). Migración postulacion 0004 aplicada en desarrollo. Sigue: pantallas de la bandeja y etiqueta del módulo «postulacion» en la campana. |
| 2026-11-21 | D-5 y D-6 completados (commit `cd6e8ce4`, GitHub ✅): portal del postulante. Worker Sonnet; en la auditoría se corrigieron los radios (anidados en label) y la validación «onTouched» que movía la página bajo el dedo en el teléfono. Frontend 1440 ✅, E2E postulante (escritorio y móvil) + carnet ✅, capturas revisadas. Pendiente menor: el cierre por inactividad del postulante manda a /login en vez de /postulacion/acceso. |
| 2026-11-21 | K-15 y K-16 (commit `3b8f7b18`, GitHub ✅): el diseñador ya no pierde el trabajo al volver a la ventana y permite formas libres y esquinas redondeadas de forma visible. Worker Sonnet; auditoría visual con Playwright. Frontend 1364 ✅. |
| 2026-11-21 | D-3 y D-4 completados (commit `f7386b4e`, GitHub ✅): credencial y sesión de invitado del postulante. Worker Sonnet; auditado el aislamiento de tokens y probado en vivo contra :8005. Suite 3152 ✅ (`test_pdf_emitido` falló una vez en la suite y pasa aislada y en la siguiente corrida: inestable, vigilar). Migración postulacion 0003 aplicada en desarrollo; queda un postulante de prueba (C.I. 18823370, EXP-2026-00001) en la base de desarrollo. En paralelo: corrección del diseñador (pérdida de trabajo por revalidación de SWR y formas libres desde rectángulo/círculo). |
| 2026-11-21 | C-10 implementado (commit `18282e98`, GitHub ✅, GitLab pendiente por DNS): parámetro de espera del diferido (90 días) y guarda temporal DIFERIDO→DESISTIDO. Worker Sonnet; suite 3074 ✅, import-linter 109/109; migraciones configuracion 0015 y postulacion 0002 aplicadas en desarrollo; verificado en Gestión del sistema. Aclarado: el contenedor de :3001 se construye desde `gath-nueva-arquitectura` (rama `feature/fe-de-vida-pasivos`), no desde esta rama: los cambios de la Fase 2 se ven en :3005/:8005. |
| 2026-11-20 | D-1 y D-2 completados (commit `29ec691e`, GitHub ✅): app `postulacion` con expediente, historial y máquina de 17 estados / 24 transiciones. Worker Sonnet; en la auditoría se agregó el rechazo de trabajadores activos. Suite 3070 ✅, import-linter 109/109. Migración postulacion 0001 aplicada en desarrollo. Nuevas C-9 (jubilados: por aclarar, provisional sí) y C-10 (espera de diferido: parámetro 90 días). |
| 2026-11-20 | C-8 y parámetros C-3/C-4/C-6/C-7 (commit `4643d885`, GitHub ✅): 15 permisos `postulacion.*`, roles CAPTACION y DIRECCION_GENERAL (sin usuarios), PRESUPUESTO ampliado; 5 parámetros en el grupo «Captación». Opencode se detuvo sin cambios (cuota baja) y lo hizo un worker Sonnet. Migraciones identidad 0016 y configuracion 0014 aplicadas en desarrollo; verificado en navegador. Pruebas 292 ✅ + suite completa del worker 2655 ✅, frontend configuración 63 ✅. |
| 2026-11-20 | H-4 completado (commit `32bc0ac5`, GitHub ✅): bandeja compartida. Worker Sonnet; en la auditoría se corrigió que también marcaba avisos personales del mismo caso. Verificado en navegador («Atendido por …», fuera del contador de la campana). Migración notificaciones 0003 aplicada en desarrollo. Pruebas notificaciones + fe de vida 316 ✅, frontend notificaciones 38 ✅. |
| 2026-11-20 | Rediseño del diseñador (commit `6f1cfef1`, GitHub ✅): carnet siempre visible en escritorio y teléfono; primer intento de Antigravity (se quedó sin cuota), correcciones de un subagente Sonnet y auditoría visual con Playwright (1280x720 y 390x844). Frontend 1353 ✅, E2E diseñador escritorio + móvil ✅. Decisiones C-1…C-8 tomadas por el usuario y H-4 aprobado (bandeja compartida: «el primero que actúa la resuelve»). Forma de trabajo: workers (opencode, Antigravity, Sonnet) implementan y Claude audita código y visual. |
| 2026-11-20 | K-11 ajustado (commit `1a85cff1`, GitHub ✅): se retiran los tipos de credencial «contratado» y «pasante» (migración 0022, aplicada en desarrollo). Quedan trabajador, pasivo y los externos (visitante, contratista, trabajador temporal). Carnetización 406 ✅. |
| 2026-11-20 | K-11, K-13 y K-14 (commit `5fa465e2`, GitHub ✅). El carnet ahora toma el color por tipo de nómina real (antes todos salían como Funcionario, también en QA) y la plantilla por su regla de uso; «autoridad» retirado y contratado/pasante como externos (migración 0021, aplicada en desarrollo). Verificado con datos reales: contratado amarillo, obrero rojo, funcionario azul, jubilado blanco. Backend carnetización 405 ✅ (suite completa 2637 + 2 ajustadas), import-linter 103/103, E2E carnet 8/8 ✅. **Bloque K del carnet cerrado.** |
| 2026-11-20 | H-1 simplificado (commit `a8894e00`, GitHub ✅): `sw_s3` construye `identities.json` en cada arranque con `s3-entrypoint.sh` desde `BACKEND/.env`; se retira `generar-identidades.sh`. Probado en contenedor aislado: sin claves no arranca; con claves, `weed s3 -config=/tmp/identities.json` con entorno limpio. |
| 2026-11-20 | Correcciones de la auditoría completadas: K-1…K-12 (K-9 cerrado sin cambios, K-11 en espera de DEC-10), H-1, H-8, H-11, H-12 y H-13. Commits `d4f5ee5f`, `97daab51`, `b7702e1b`, `e83034ed` y `e15d8d3d`; GitHub ✅, GitLab pendiente por DNS. Migraciones carnetizacion 0019/0020 aplicadas en desarrollo. Backend 2630 ✅ (import-linter 103/103), frontend 1333 ✅, E2E carnet 9/9 ✅ (la de solicitudes, con los parámetros de «Mi carnet» puestos de forma temporal y restaurados). |
| 2026-11-20 | Creación del documento a partir del análisis de brechas contra el plan. Inicio de A-1, A-2 y A-3. |
| 2026-11-20 | Auditoría (Claude) del trabajo de opencode (B-2, B-6–B-10): pruebas backend 2611 ✅, frontend 1338 ✅, E2E carnet 8/8 ✅ tras corregir la prueba de la pestaña «Fondos fijos» que B-7 retiró. 12 hallazgos registrados como bloque K (2 altos: orden de páginas del lote dúplex y migración 0017 en bases nuevas). |
| 2026-11-20 | H-8 acotado tras revisión: solo `ConfirmarFilasCargaMasivaView` es un hueco real. Nuevas H-11 (EXIF), H-12 (timeout SeaweedFS) y H-13 (página del PDF) para asignar a Claude. |
| 2026-11-20 | B-2: deduplicación del PNG de fondo (commit `f4b86084`). Elegir dos veces el mismo PDF reutiliza el medio ya convertido; al borrar un medio compartido no se elimina el objeto del storage hasta la última fila. 378 pruebas backend ✅. |
| 2026-11-20 | B-2 completado (commit `a098856f`). Fondo por cara desde la biblioteca (imagen o primera página de PDF rasterizada a PNG) con los campos encima; persiste en la definición y el snapshot. Bloque B del carnet **11/11**. 376 pruebas backend + 177 frontend ✅. |
| 2026-11-20 | B-7 completado (commit `26ae0609`). Tipos contratado/pasante/autoridad, plantilla v1 LEGACY con comparación de imagen y retiro de `CarnetTemplate` (tabla física intacta). 367 pruebas backend + 169 frontend ✅. |
| 2026-11-20 | B-8 y B-9 completados (commits `8bcdedce` y `5dad5b6d`). Biblioteca: solo PNG/JPEG/WebP en subidas, SVG históricos saneados al descargar, `attachment`+`nosniff`; medios sembrados sin archivo retirados y comando de verificación. 362 pruebas backend + 190 frontend ✅. Los 3 medios institucionales se cargan desde la Biblioteca de Medios cuando se disponga de ellos. |
| 2026-11-20 | B-10 completado (commit `62f7ac66`). Las etiquetas de `CampoNumerico` (X, Y, Ancho, Alto) quedaron asociadas a su input. 13 pruebas del diseñador ✅. |
| 2026-11-20 | B-6 completado (commit `5bf3bdb6`, GitHub ✅; GitLab pendiente por DNS). Impresión por lote de trabajadores con cola, marcado como impreso y `modo_duplex` configurable (ninguno/largo/corto) en ambos lotes. 342 pruebas backend + 169 frontend ✅. |
| 2026-11-20 | B-5 completado (commit `1f127aa2`, GitHub ✅; migración `carnetizacion.0015` aplicada en desarrollo). Inicio de B-6. |
| 2026-11-20 | B-4 completado (commit `2c2361af`, GitHub ✅; migración `carnetizacion.0014` aplicada en desarrollo). Inicio de B-5. |
| 2026-11-20 | B-3 completado (commit `40b040a3`, GitHub ✅). Inicio de B-4. |
| 2026-11-20 | B-1 completado (commit `0e88364b`, GitHub ✅). Inicio de B-3. |
| 2026-11-20 | A-6 completado (commit `677cc0e1`, GitHub ✅, GitLab pendiente). Bloque A terminado. **Estado del entorno de desarrollo:** migración `carnetizacion.0013` aplicada (tabla nueva `CarnetSolicitud`); el usuario de pruebas 99000990 quedó marcado como pasivo legado (registro de egreso «JUBILACION ORDINARIA», sin cargo) para poder probar «Mi carnet»; los parámetros de «Mi carnet» se restauraron a su valor original (alcance «nadie», usuarios «30799436»). |
| 2026-11-20 | A-5 completado (commit `ae53a219`, GitHub ✅). Carnetización 296 pruebas ✅. Inicio de A-6. |
| 2026-11-20 | A-4 y B-11 completados (commit `8f751d97`, GitHub ✅, GitLab pendiente por DNS). **Efecto fuera del carnet:** el resolutor central de condición ya no trata como pasivo a un egresado por renuncia/destitución/abandono; en esta base solo afecta a C.I. 30540767 (abandono de cargo), que pasa a SIN_ASIGNACION también en autogestión y en el ciclo de vida de su cuenta. Backend 2522 ✅, frontend 1320 ✅, E2E carnet 7/7 ✅. |
| 2026-11-20 | Commit `874e8f36` en `feature/fase2-captacion-carnet`. Subido a **GitHub** ✅. **GitLab pendiente**: `gitlab.conatel.int` no resuelve por DNS desde el equipo (reintentar `git push origin feature/fase2-captacion-carnet`). No se tocó `dev` ni `qa`. |
| 2026-11-20 | Pruebas en navegador (Playwright) sobre entorno propio de la rama (backend :8005, frontend :3005). Se encendieron SeaweedFS, Redis y RabbitMQ, que estaban caídos. Usuario de pruebas `e2e.carnet.qa@conatel.gob.ve` (C.I. 99000990, rol ADMINISTRADOR, credenciales en `NextJS/.env.test.local`, no versionado). Completados A-7, A-8, A-9; nuevos hallazgos B-9, B-10, B-11; A-4 confirmado visualmente. Frontend 1317 pruebas ✅, backend carnetización 285 ✅. |
| 2026-11-20 | A-1, A-2 y A-3 completados: backend 285 pruebas de carnetización ✅ (8 nuevas), frontend 154 ✅ (5 nuevas), tsc y eslint ✅, verificación visual del PDF individual y de lote. |
