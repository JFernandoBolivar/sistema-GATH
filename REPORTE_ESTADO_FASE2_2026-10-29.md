# Estado de la Fase 2 — 2026-10-29

## 1. En qué fase quedó el sistema

En los documentos, "Fase 2" significa dos cosas distintas:

| Sentido | Documento | Estado |
|---|---|---|
| Fase 2 del **plan de reparación**: recuperar la funcionalidad del legado (§2.1–2.6) | `PLAN_REPARACION_GATH.md`, `ESTADO_SISTEMA_2026-10-27.md` | **Prácticamente cerrada** |
| Fase 2 del **producto**: onboarding, autogestión con aprobación, notificaciones, carnet de dos caras, sincronización con SIGESP | `FASE2_PROPUESTA_TECNICA.md`, `PROPUESTA_FASE2_GATH.md`, `Propuesta_Fase2_GATH.html` | **Recién iniciada** (E-0 y E-1 parciales; E-2 a E-9 sin empezar) |

Etapas del producto:
- **E-0, infraestructura: parcial.**
  - Hecho: SeaweedFS 3.80, RabbitMQ y Redis en `compose.yml`, en redes internas y sin puertos al host.
  - Falta la app Celery (worker y beat) y el endurecimiento de §12: `sw_s3` sin identidades, un solo bucket en lugar de cuatro, sin modelo `Archivo`.
- **E-1, permisos: parcial.**
  - Hecho: el backend usa `HasPermission`, y hoy los menús, el selector y `proxy.ts` también deciden por permisos.
  - Falta: `Rol.codigo`, los roles CAPTACION y DIRECCION_GENERAL, la tabla de capacidades y que `permisos_version` funcione.
- **E-2 a E-9: sin empezar.** No existen las apps `postulacion`, `documentos`, `notificaciones` ni `sincronizacion`; no hay autogestión con aprobación; el carnet sigue siendo de una sola cara; la fe de vida no tiene código.

## 2. LISTO (verificado en código y en ejecución)

- Migración a arquitectura Onion de 12 módulos backend, con contratos de import-linter sin violaciones.
- Seguridad base:
  - JWT en cookies HttpOnly, bloqueo por intentos y throttling sobre Redis.
  - Recuperación de contraseña, ahora protegida contra enlaces envenenados.
  - Archivos servidos solo a través de Django y autenticados.
- Personal:
  - Registro y consulta, con listado de ~1 s.
  - Filtros de estructura y carga masiva con validación de contratos.
- Egreso de activo a pasivo y PDF del pasivo.
- Carnetización: emisión, revocación, plantillas (miniatura autenticada) y PDF de una cara.
- Mi Expediente en autogestión (solo lectura), censo, métricas y Excel.
- Movimientos: traslado, cambio de estatus, préstamo y encargaduría, e historial en PDF.
- Punto de Cuenta automático al cambiar de dependencia (backend; no tiene pantalla).
- Configuración visual de logos y cintillo, y los PDF del backend.
- Reportes de empleados, egresados, códigos y familiares (PDF y Excel).
- Infraestructura: Python 3.14 / Node 26 / pnpm, imágenes reproducibles, Redis, migraciones automáticas.

## 3. PENDIENTE (lo planificado para Fase 2 que no existe)

1. Autogestión con solicitudes de actualización, ventanas, soportes y visor comparativo (E-7).
2. Notificaciones en el sistema y por correo (E-2), con Celery real.
3. Postulación y onboarding en dos ventanas, vacantes y asignación atómica (E-3 a E-6).
4. Documentos y planillas prellenadas (E-5).
5. Carnet de dos caras con diseñador (E-8).
6. Sincronización con SIGESP-Nómina (E-9).
7. Fe de vida de pasivos: requerimiento nuevo, sin diseño previo en la propuesta.
8. Constancias: en pausa hasta tener el texto oficial de RRHH.
9. Retiro del legado `app/(protected)/dashboard/` (Fase 8 del plan de reconstrucción).

## 4. A CORREGIR (discrepancias entre documentos y código)

- La bitácora #026/#028 dice "Celery/RabbitMQ 100% completado". **No existe la app Celery**: hasta hoy la cola fingía éxito; ya se corrigió para que falle de forma explícita.
- El "Punto de Cuenta" implementado se genera al cambiar de dependencia. El de la propuesta (§4.4) es el documento de ingreso que firma la Dirección General. Son cosas distintas con el mismo nombre.
- Las cifras de `ESTADO_SISTEMA_2026-10-27.md` (464 backend / 283 frontend) están obsoletas. Hoy son **500 / 310**.
- `PERMISOS.md` no refleja los permisos reales de la BD.
- La §2.6 de `PLAN_REPARACION_GATH.md` no está marcada como hecha, aunque el código la implementa.

Los hallazgos técnicos y su corrección están en `REPORTE_PRUEBAS_Y_HALLAZGOS_2026-10-29.md`.

## 5. Cambio de prioridad (decidido el 2026-10-29)

Dentro del alcance de la Fase 2 se adelanta lo siguiente:

1. **Autogestión del empleado activo:** ficha integral, solicitudes de actualización, soportes obligatorios y aprobación campo por campo por Bienestar Social.
2. **Notificaciones** en Autogestión y Gestión de Trabajadores, y correo con PDF.
3. **Fe de vida del personal pasivo** (requerimiento nuevo):
   - Formulario más selfie con la cédula, con **dos vías equivalentes**: cámara en vivo o subida de una foto ya tomada (la falta de cámara nunca bloquea; se registra el origen CAMARA | ARCHIVO).
   - Revisión por Bienestar Social: aprobar, rechazar o pedir repetición.
   - Al aprobarse, constancia en PDF por correo y notificación.
4. **Regla de aprobación:** flujo normal con doble check (Analista y Administradora de Bienestar Social, orden indistinto), como en la HU (RN-03/RN-22); excepción: la Administradora puede aprobar sola por aprobación directa (justificación obligatoria, permiso `fe_de_vida.aprobar_directo` y auditoría propia). La Analista nunca valida sola. La aprobación directa es la única divergencia con la HU y hay que formalizarla.
5. **Usuarios por roles y permisos**, sin depender de departamentos. Ya avanzó en menús, selector y `proxy.ts`.
6. **Rediseño institucional de Autogestión y PWA.**

Se posponen: postulación y onboarding, planillas prellenadas, carnet de dos caras y sincronización con SIGESP.

Planes para revisión, aún no implementados:
- `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md`: auditoría, máquinas de estado, modelo de datos, matriz de permisos, etapas A–E (más C0, requisito de despliegue de Infraestructura: HTTPS en producción), 13 preguntas abiertas y trazabilidad HU-0001 a HU-0014.
- `PLAN_REDISENO_AUTOGESTION_PWA_2026-10-29.md`: diagnóstico visual, dirección institucional, wireframes (incluido el flujo de captura con cámara o subida de foto), accesibilidad para usuarios mayores, PWA y etapas alineadas con el plan anterior.

**Camino crítico:** Celery y permisos (A) → solicitudes de autogestión (B) → fe de vida (C, con cámara o subida de foto; se desarrolla y prueba en `localhost`) → usuarios por permisos (D) → endurecimiento (E). El HTTPS/nginx de producción lo gestiona Infraestructura al desplegar y **no** es parte del camino crítico.
