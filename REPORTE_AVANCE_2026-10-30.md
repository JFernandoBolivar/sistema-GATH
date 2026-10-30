# Reporte de avance — 2026-10-30

Rama `feature/fe-de-vida-pasivos`. Todo está subido a GitHub.

## 1. Resultado

**La Fase 4 (fe de vida de pasivos) está culminada** y verificada en vivo en el entorno local. El plan `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md` ya está actualizado.

| Commit | Contenido |
|---|---|
| `b9adff2` | Frontend del pasivo y de Bienestar (C10–C16, C18) |
| `95b7d7a` | Backend final: devuelta para corrección, alcance por tipo de pensión (`TipoNomina.es_activo=False`), recordatorios y acceso del pasivo (decisión H, C7, C8) |
| `726e449` | Correos formales, enlace de Bienestar corregido y E2E de fe de vida alineado con la UI real |

## 2. Constancia de ejemplo por correo

- El correo se envió a **`josefernandobolivar2+e2e.pasivo@gmail.com`**, que llega a su bandeja de Gmail.
  - Asunto: **«Constancia de Fe de Vida validada: PRUEBA E2E fe de vida 2026 - GATH CONATEL»**.
  - Adjunto: **`FV-2026-000001.pdf`**.
  - Hora: 30/10 a la 01:32 (hora de Venezuela).
  - El outbox (fila `d4981060…`) lo registra como ENVIADO y el relay `mail.conatel.gob.ve` lo aceptó.
  - **No pude confirmar que haya llegado a Gmail.** La búsqueda desde mi conector tampoco encuentra los correos de prueba de días anteriores que usted sí recibió. Por eso no sé si el problema es del conector o de la entrega.
  - Busque en Gmail «Constancia de Fe de Vida», incluida la carpeta Spam.
- Al mismo correo se enviaron también los avisos de «Hemos recibido su fe de vida» y «Su fe de vida fue devuelta para corrección» que generaron las pruebas.
- El PDF se revisó. Trae:
  - el cintillo;
  - el número;
  - el hash y el código QR;
  - los datos del pasivo;
  - el nombre de quien aprobó.
- ⚠️ El logo derecho del PDF dice «Bolivia 2026». Revise si es la imagen institucional correcta.
- El flujo seguido fue este:
  1. El pasivo envió el acta con una foto subida.
  2. La Administradora de Bienestar la aprobó directamente con justificación.
  3. La solicitud quedó **VALIDADA**.

## 3. Correos: asunto y mensaje formales

Todos los correos llevan ahora:
- el saludo «Estimado(a) usuario(a):»;
- un texto en tono de usted que explica qué pasó, qué debe hacer la persona y hasta cuándo;
- la firma «Atentamente, Gestión Humana — CONATEL»;
- el aviso de correo automático.

| Módulo | Asuntos |
|---|---|
| Fe de vida | Hemos recibido su fe de vida · Su fe de vida fue devuelta para corrección · Recordatorio: fe de vida pendiente · Su fe de vida fue rechazada · Constancia de Fe de Vida validada: {proceso} · Fe de vida pendiente de revisión (a Bienestar) |
| Autogestión | Nueva solicitud de actualización de datos · Actualización de datos habilitada · Plazo de actualización de datos extendido · Actualización de datos lista para revisar · Solicitud de actualización de datos devuelta · Corrección de actualización de datos reenviada · Actualización de datos aprobada (o aprobada parcialmente) · Actualización de datos rechazada · Su plazo de actualización de datos está por vencer · Plazo de actualización de datos vencido |
| Cuentas (identidad) | Su cuenta de GATH está lista · La contraseña de su cuenta fue cambiada · Este es ahora su correo de acceso a GATH, entre otros |
| Recuperación de contraseña | [GATH - CONATEL] Solicitud de Restablecimiento de Contraseña (ya cumplía; sin cambios) |

Todos los asuntos, salvo el de recuperación, terminan en «- GATH CONATEL».

## 4. Pruebas

- Backend: **869 passed**.
- `makemigrations --check`: sin cambios.
- `lint-imports`: 82 contratos, 0 rotos.
- Vitest: **500 passed** en 83 archivos.
- `tsc` y `eslint` sin errores.
- E2E en vivo con Chromium:
  - `fe-de-vida`: 5/5.
  - Las 4 specs juntas: **33 passed y 5 skipped**.
  - `accesibilidad`: completa.
  - `autogestion-fase2`: pasa. Tuvo un fallo pasajero por las trazas en OneDrive y pasó al repetir.
- ❌ **`notificaciones.spec.ts:63`** (vista de Bienestar) falla siempre. El análisis de accesibilidad (axe) se cuelga más de 2 minutos, aunque la página carga y se ve bien.
  - Sospecha, sin confirmar: la bandeja de Bienestar guarda 10 notificaciones viejas con un enlace que daba 404. El enlace ya se corrigió para las notificaciones nuevas.
  - No modifiqué esas notificaciones porque son escrituras en la BD.

## 5. Datos de prueba que quedaron en la BD local

No se borró nada. Se conservan para pruebas futuras.

- **Cuenta E2E del pasivo:**
  - Cédula 10079123, MAITE MARISELA SOJO R, nómina JUBILADO.
  - Correo de acceso `josefernandobolivar2+e2e.pasivo@gmail.com`, rol AUTOGESTION.
  - La contraseña está solo en `NextJS/.env.test.local`, que git ignora.
  - Antes no tenía correo (null). El respaldo para deshacer está en `e2e_pasivo_deshacer.json`, en el scratchpad de la sesión.
- **Proceso abierto:**
  - «PRUEBA E2E fe de vida 2026», id `01a18b33-7825-7b33-8368-325509e33806`.
  - Alcance: todos los pasivos.
  - Vigencia: del 29/10 al 31/12/2026.
  - Recordatorios a 7, 3 y 1 días del cierre.
  - **Sigue abierto.** Si no lo quiere abierto, ciérrelo desde Bienestar. Mientras esté abierto, el beat puede enviar recordatorios a los pasivos con correo.
- **Solicitud del pasivo E2E:** `01a18b37-5f7f-7ce1-ae3a-8fbb573428cb`, en estado VALIDADA. Para repetir el flujo del pasivo, Bienestar debe devolverla.
- Siguen igual las cuentas E2E del trabajador (3333333), de Bienestar (437999434) y el cargo de prueba 109050.

## 6. Qué hacer al despertar

1. Revise el correo de la constancia en Gmail. Si quiere, revise también otros correos de prueba que hayan llegado.
2. **Reconstruya las imágenes.** Claude Code detuvo la reconstrucción final porque el equipo se quedó sin memoria. Los contenedores siguen con la versión anterior al commit `726e449`, que trae el enlace viejo de Bienestar y los textos de correo anteriores. Ejecute:
   `docker compose build django nextjs && docker compose up -d django celery_worker celery_beat nextjs`
   y después recargue el navegador con **Ctrl+Shift+R** para evitar el error «Failed to find Server Action».
3. Si no recibió el correo, revise el outbox `notificaciones_evento_outbox` y el log de `gath_celery_worker`.

## 7. Pendientes

**Del cierre de la Fase 4**
- Corregir el cuelgue de axe en `notificaciones.spec.ts:63` (punto 4).
- Poner el nombre del destinatario en el saludo de los correos. Hoy dice «Estimado(a) usuario(a)» porque el outbox no trae el nombre; falta un puerto que lo obtenga.
- Crear la pantalla para que RRHH asigne el correo de acceso (D8). El endpoint ya existe: `POST cuentas/{cedula}/correo-acceso/`.
- Confirmar el logo «Bolivia 2026» de la constancia.

**Deuda técnica conocida**
- `POST autogestion/solicitar-carnet/` no exige la condición ACTIVO.
- No se recalculó la fila TOTAL de `PERMISOS.md`.
- FALLECIMIENTO no existe como categoría de movimiento en la BD.
- La deduplicación de recordatorios no se probó con el notificador real.
- El correo a Bienestar sigue apagado (`NOTIFICAR_BIENESTAR_POR_CORREO=False`) hasta que usted lo confirme.

**Siguientes bloques del plan**
- **G1–G8:** hallazgos de la auditoría de Gestión de Trabajadores. Cada uno se verifica en vivo con Playwright antes de corregirlo.
  - G1: los filtros del reporte quedan ocultos.
  - G5: motor de «Documentos por movimiento».
  - G6: exportar movimientos con sus filtros.
  - G8: notificaciones de movimientos.
- **D9:** Administración del sistema (hoy «Seguridad») con la sección Configuración: cintillo, avisos, reglas de documentos y plazos.
- **D10:** visor de la auditoría por log.
- **Fase 5:** usuarios por roles y permisos.
- **Fase 6 y R-6c:** interfaz única en todos los módulos, con las skills de diseño.
- **Fase 7.**

**Recomendación de consumo:** estos bloques son grandes. Conviene hacer G1–G8, D9 y D10 con OpenCode (Kimi), dándole el prompt que respete la arquitectura y no meta valores fijos en el código, y reservar Claude para revisar y hacer los commits.
