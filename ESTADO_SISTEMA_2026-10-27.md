# Estado del sistema GATH — 2026-10-27

Snapshot de coordinación: qué está culminado y verificado, y qué queda pendiente,
al cierre de la rama `feature/arquitectura-onion` antes de abrir
`feature/fe-de-vida-pasivos` y de subir el repositorio a GitHub.

**Nota de proceso:** los planes detallados de dos tareas grandes (Solicitudes de
Actualización de Datos y CarnetDesigner) se generaron en sesiones de worker que
ya cerraron sin guardar su reporte en un archivo — solo quedaron en el scroll de
esa terminal. Lo que sigue en este documento para esas dos tareas es una
reconstrucción fiel desde el contexto de coordinación (decisiones ya tomadas
con el usuario), no una copia literal del reporte original. **Lección aplicada
de aquí en adelante: todo plan de worker se vuelca a un `.md` antes de darlo
por cerrado.**

---

## 1. Completado y verificado (comiteado en `feature/arquitectura-onion`)

### Migración Onion base
- Los 12 módulos (identidad/usuarios, personal, cargos, familiares,
  organización, movimientos, pasivos, carnetización, autogestión, reportes,
  catálogos, auth/sesión) migrados a Onion + Feature-Based + SCREAM, con
  paridad visual/funcional verificada contra el legado módulo por módulo.
- `import-linter`: 94 `__init__.py` faltantes agregados — el gate de
  arquitectura (70+ contratos) ahora audita realmente todo el árbol en vez de
  pasar en falso por paquetes no indexados.

### Seguridad (crítico)
- Eliminada una puerta trasera de login (bypass con cédula+contraseña fija que
  además sobrescribía la contraseña real de esa cuenta).
- Eliminada una contraseña SMTP institucional hardcodeada como valor por
  defecto en `settings.py`.
- Restaurado el permiso específico (`personal.editar_personales`) en el POST
  de subida de foto de perfil, que había quedado abierto a cualquier usuario
  autenticado.
- Mitigado IDOR en autogestión, escape XML en PDF, throttling y validación de
  contraseña (commit `5d722a5`).

### Features nuevas (post-migración, pedidas directamente)
- **Recuperar/restablecer contraseña**: flujo completo (token seguro con
  expiración, correo real vía SMTP, páginas `/recuperar-password` y
  `/restablecer-password`).
- **Mi Expediente** (autogestión, autoservicio): el empleado ve su propio
  expediente completo (datos + familiares) — **hoy es de solo lectura**, sin
  capacidad de editar nada.
- **Cintillo Editable / Configuración Visual** (`apps.configuracion`): panel
  de administración con carga real de imágenes (logo izquierdo, logo derecho,
  cintillo de pie), conectado a los 4 motores de PDF del sistema.
- **Consolidación de PDFs**: los 3 PDFs que antes se renderizaban en el
  frontend (movimientos, pasivos, personal) ahora se generan en el backend
  con ReportLab, reutilizando los mismos componentes que ya usaba
  `apps.reportes`. Se eliminó por completo la dependencia
  `@react-pdf/renderer`.
- **Punto de Cuenta automático** (`apps.puntocuenta`): se genera solo al
  cambiar la dependencia (gerencia/oficina) de un empleado, con su propio PDF,
  respetando RN-006-01 (no se dispara por cambios de cargo/salario dentro de
  la misma oficina).
- **Contactos de emergencia**: alta en registro y edición en el detalle del
  trabajador.
- **Nacionalidad (V/E)**: expuesta y editable en registro/edición/detalle.

### Cierre de pendientes del plan de reparación original (Fase 2)
- **2.4 — Motor de reportes**: `ReportFieldRegistry` reparado — 81 de 148
  rutas de filtro estaban rotas por relaciones sin `related_name` y campos
  renombrados en el esquema nuevo; de paso quedó arreglado `CuentaFilter`, que
  tenía el mismo problema.
- **Validaciones de carga masiva de personal**: réplica de la regla real del
  legado (`validate_contrato`) — un solo contrato FIJO, máximo 3 contratos,
  no se crea uno nuevo si ya hay otro activo, valida fechas y solapamiento;
  un empleado egresado queda exento.
- **Filtros de listado de personal** por dependencia, dirección general,
  dirección de línea y coordinación (`presentation/filters/` nuevo en
  `apps.personal`).
- **Censo de autogestión**: valida que la pregunta exista y esté activa, que
  la opción pertenezca a esa pregunta, guardado atómico (antes una respuesta
  inválida a mitad de camino dejaba datos sueltos guardados).
- **Bitácora**: `BITACORA_RECONSTRUCCION.md` actualizada con las cifras
  reales (de "69 tests" a 464 backend / 283 frontend) y las features nuevas
  listadas arriba.

**Verificación de cierre de este ciclo:** 464 tests backend, 283 tests
frontend (55 suites), `tsc --noEmit` limpio, `manage.py check` limpio.

---

## 2. Pendiente — grande, con plan ya decidido (listo para implementar, NO implementado aún)

### 2.1 Solicitudes de Actualización de Datos Personales
Pedido del usuario: un trabajador debe poder solicitar la corrección de sus
propios datos (nombre, fecha de nacimiento, etc.) o agregar/quitar un
familiar (ej. divorcio), siempre con una justificación obligatoria. Flujo de
**dos etapas de aprobación por RRHH** (`apps.personal`):

1. **Etapa 1**: el trabajador solicita (campo + justificación, o
   alta/baja de familiar). RRHH ve la solicitud pendiente y la **habilita** o
   **rechaza**. Si la rechaza, el trabajador ve el motivo y el caso se cierra.
2. **Etapa 2**: con el campo habilitado, el trabajador entra y escribe el
   valor real. Vuelve a RRHH como pendiente de aprobación **definitiva**. Si
   aprueba, el cambio se aplica de verdad al expediente (reutilizando los
   casos de uso/repos ya existentes de `apps.personal`/`apps.familiares`, sin
   duplicar esa lógica). Si rechaza, **vuelve a estado habilitado** (no cierra
   el caso) para que el trabajador pueda corregir y reintentar.

Decisiones ya confirmadas con el usuario:
- **Alcance de campos**: TODO el expediente (no solo datos básicos) —
  vivienda, salud, contacto de emergencia, formación académica, además de
  identidad y familiares. Esto es lo que más infla el frontend de la etapa 2
  (un formulario de edición por cada sección).
- **Quitar un familiar**: mismas 2 etapas, **borrado real** al aprobar en
  definitiva (no baja lógica — evita tocar la tabla legada de familiares).
- **Notificaciones**: NO basta con un badge simple. El usuario pidió
  explícitamente un **centro de notificaciones completo** (campana + tabla de
  notificaciones persistente, leído/no leído) **más correo SMTP** en las
  transiciones clave, razón textual: *"el sistema va a crecer y hay más
  lógica que voy a gestionar a través de las notificaciones"* — se diseña
  como pieza razonablemente reutilizable por otros módulos a futuro (entidad
  `Notificacion` con destinatario, tipo, mensaje, entidad de referencia,
  leído, fecha), sin acoplarla solo a Solicitudes.
- **Migración**: autorizada — tabla nueva propia (`CREATE TABLE`, sin FKs ni
  `ALTER` a tablas existentes), mismo patrón ya usado y aprobado para Punto de
  Cuenta. Probar primero en una copia aislada antes de aplicar contra la BD
  real.
- **Rechazo en etapa 2**: vuelve a `HABILITADA`, no cierra el caso.
- **Documentos de soporte** (ej. acta de divorcio): NO obligatorios en esta
  versión.
- **Cancelación**: el trabajador puede cancelar una solicitud abierta.
- **Quién es "RRHH"**: roles Analista + Administrador (mismo patrón que el
  resto del sistema); Recepcionista sin acceso a esta bandeja.

Alcance estimado por el worker antes de la ampliación de campos/notificaciones
(con el alcance mínimo): ~40 piezas, 7 commits atómicos. Con el expediente
completo + centro de notificaciones, el alcance real es mayor — falta una
re-estimación una vez que se retome el diseño.

**Riesgo identificado por el worker, sin resolver:** la parte más delicada es
el adaptador que aplica el cambio reutilizando los serializers de personal y
familiares, sobre todo en familiares con cédula sintética (hijos menores) o
con heredero único — hay que revisar con cuidado que las validaciones de
negocio existentes (`validaciones_familiar.py`) se respeten también cuando el
cambio llega por esta vía, no solo por el alta/edición directa.

### 2.2 CarnetDesigner — editor visual de posicionamiento
Ya existe un generador de carnet por empleado (`disenador-carnet.tsx`, 521
líneas) con posiciones **fijas/hardcodeadas**. Falta que el administrador
pueda, sobre una plantilla subida, **mover** (sin redimensionar ni rotar) los
campos dinámicos: foto, nombre, cédula, cargo, departamento, código y QR.

Decisiones confirmadas:
- Un layout por plantilla (no global).
- Solo mover (ancho/alto por inputs numéricos), sin redimensión por drag ni
  rotación.
- Fuentes: se mantiene Helvetica/Helvetica-Bold, sin embeber fuentes nuevas
  por ahora.
- `mi-expediente-view.tsx` (autogestión) también debe reflejar el layout de
  la plantilla activa al mostrar la vista previa del carnet — consistencia
  visual entre el panel de carnetización y la autogestión.
- Migración: tabla propia nueva, mismo criterio que el punto anterior
  (probar en copia aislada primero).
- Sin librería de drag-and-drop pesada (`react-moveable`/`konva` evaluadas y
  descartadas por el worker — es exceso para mover 7 cajas); mouse events
  nativos.

**Riesgo de choque señalado por el propio worker:** este ítem toca
`mi-expediente-view.tsx`, el mismo archivo que puede tocar la sección de
carnet dentro de la UI de "Mi Expediente" de Solicitudes/autogestión —
coordinar el orden de los commits entre ambos frentes cuando se retomen.

### 2.3 Constancias individuales (certificados)
**Hallazgo del worker, cambia la premisa original:** no hay nada real del
legado que "recuperar" — los 5 generadores de constancia del legado
(`employee_active_pdf.py`, `employee_passive_pdf.py`, `family_pdf.py`,
`assignment_pdf.py`, `graduate_pdf.py`) no tienen contenido institucional
documentado disponible (texto oficial, firmante, sello). Construir
constancias reales sería **inventar contenido institucional sin respaldo**.

Decisión: por ahora solo se documenta el gap en `PLAN_REPARACION_GATH.md`
(pendiente de hacer — no se tocó código). La construcción real de
constancias queda pausada hasta que RRHH entregue el texto oficial de cada
una, el firmante y su cargo. "Egresado" no necesitaría una constancia
aparte: sería la misma que la de pasivo.

---

## 3. Pendiente — suelto, menor

1. El frontend de `/personal` consultar todavía no envía los filtros nuevos
   de dependencia/dirección/coordinación al backend (el backend ya los
   soporta, falta la UI que los dispare).
2. La edición manual de un contrato (vía API, fuera de carga masiva) no pasa
   todavía por la validación nueva de `validate_contrato`.
3. 4 errores en `test_bloqueo_cuentas` — preexistentes, causa: a la base de
   datos de test le falta el registro de catálogo de Nacionalidad.
4. 12 contratos de `import-linter` siguen rotos (deuda de arquitectura ya
   documentada en una auditoría anterior en esta misma sesión — en su
   mayoría es el patrón ya sancionado de `infrastructure/` cruzando módulos,
   no violaciones nuevas; requiere una decisión de recalibrar los contratos,
   no es código roto).
5. Hay registros legados reales con texto literal en el campo `profile`
   (foto) que generan error al intentar descargarla de SeaweedFS al listar
   personal — detectado, no corregido.

---

## 4. Nunca iniciado (fuera de alcance de este ciclo)

- Alta/edición manual de cargo con código no autogenerado.
- Reescritura completa de `ReportFieldRegistry` más allá del fix puntual ya
  aplicado (solo si se decide ampliar el motor de filtros más adelante).
- Igualar el formato de los reportes tabulares (agrupación jerárquica,
  columnas) al legado — cruza con el worker de reportes, evaluado pero no
  priorizado.
- **Fe de vida de personal pasivo** (autogestión) — nueva rama
  `feature/fe-de-vida-pasivos`, a diseñar desde cero.

---

## 5. Próximos pasos acordados

1. ✅ Working tree limpio, todo comiteado en `feature/arquitectura-onion`.
2. Crear rama `feature/fe-de-vida-pasivos` desde el HEAD actual de
   `feature/arquitectura-onion`.
3. Agregar remoto hacia `https://github.com/JFernandoBolivar/sistema-GATH.git`
   para que el usuario pueda hacer `git push` desde su casa (sin acceso al
   GitLab institucional desde ahí). El push lo hace el usuario directamente.
