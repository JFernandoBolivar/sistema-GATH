# Feedback de GATH — lista de seguimiento

Fecha: 2026-11-01  
Rama: `feature/fe-de-vida-pasivos`  
Estado: **sin commit**. Este archivo solo registra feedback y su avance.

## Leyenda

- `[x]` Implementado en código.
- `[~]` Implementado parcialmente / falta verificación en vivo.
- `[ ]` Pendiente.
- `[!]` Bloqueado por credenciales o entorno.

## Resumen


| #   | Feedback                                                                          | Pantalla / área                     | Estado |
| --- | --------------------------------------------------------------------------------- | ----------------------------------- | ------ |
| 1   | La imagen del login debe ocupar todo, sin fondo azul                              | `/login`, recuperar, restablecer    | `[x]`  |
| 2   | En activos, el selector de nómina no debe mostrar nóminas de pasivos              | `/cargos/crear-codigo`              | `[x]`  |
| 3   | El menú de pasivos debe tener la misma estructura/estilo que activos              | Sidebar pasivos                     | `[x]`  |
| 4   | Agregar pasivo debe pedir foto y todo el proceso, como activos                    | `/pasivos/registrar`                | `[~]`  |
| 5   | El selector de activo/pasivo no debe desaparecer en familiares y otros submódulos | Header                              | `[x]`  |
| 6   | Eliminar las tarjetas «Consultar Trabajadores» y «Registrar Trabajador»           | `/personal`                         | `[x]`  |
| 7   | «Agregar Familiar» de pasivos no debe llevar al módulo de activos                 | Sidebar pasivos / familiares        | `[~]`  |
| 8   | Los filtros de pasivos deben ser como los de activos; sobran las fechas           | `/pasivos/consultar`                | `[x]`  |
| 9   | En pasivos solo deben aparecer nóminas con `es_activo=False`                      | `/pasivos/consultar`                | `[x]`  |
| 10  | La tabla de pasivos debe mostrar información similar a la de activos              | `/pasivos/consultar`                | `[~]`  |
| 11  | Restaurar el egreso propio del pasivo (fallecimiento + sobrevivientes)            | Menú pasivos                        | `[~]`  |
| 12  | Quitar «Procesar egreso» (activo → pasivo) del menú de pasivos                    | Menú pasivos                        | `[x]`  |
| 13  | Quitar «Sobrevivientes» como opción suelta; integrarlo al egreso                  | Menú pasivos                        | `[x]`  |
| 14  | Restaurar el menú de activos completo desde HEAD                                  | Sidebar activos                     | `[x]`  |
| 15  | Quitar «Configuración visual» del sidebar de activos                              | Sidebar activos                     | `[x]`  |
| 16  | Quitar el grupo «Autogestión» del sidebar de activos y mover Censo                | Sidebar activos / `/personal/censo` | `[x]`  |
| 17  | El selector de header debe reflejar activo/pasivo según la ruta                   | Header                              | `[x]`  |
| 18  | Subir la versión del service worker para evitar caché vieja                       | PWA                                 | `[x]`  |
| 19  | Autogestión debe ser responsive (tablas, componentes y texto)                     | `/autogestion/**`                   | `[~]`  |
| 20  | Mostrar los antecedentes laborales en la ficha                                    | `/autogestion/ficha`                | `[x]`  |
| 21  | Mostrar la oficina, no «NIVEL DE APOYO», en la cabecera                           | `/autogestion`                      | `[x]`  |
| 22  | Ocultar «Mi Carnet Digital» mientras no esté en producción                        | `/autogestion`                      | `[x]`  |
| 23  | Quitar «Censo de Vivienda» de la cabecera de Autogestión                          | `/autogestion`                      | `[x]`  |
| 24  | Mostrar la foto del trabajador si la tiene                                        | `/autogestion`                      | `[x]`  |
| 25  | «Bienestar Social» debe llamarse por lo que gestiona y depender de permisos       | Sidebar activos                     | `[x]`  |
| 26  | Entregar el reporte de la auditoría integral                                      | Raíz del repo                       | `[x]`  |
| 27  | Corregir «Cédula del trabajador» (aparecía como «CÃ©dula») en la bandeja        | `/personal/bienestar/solicitudes`   | `[x]`  |
| 28  | Orden laboral: Dependencia, Oficina/Gerencia, Dirección de Línea, Coordinación     | `/autogestion/ficha`                | `[x]`  |
| 29  | No inventar «Indefinido / Permanente» si no hay fecha de culminación              | `/autogestion/ficha`                | `[x]`  |
| 30  | «Fe de vida» de pasivos no debe llevar al módulo de activos                       | Sidebar pasivos                     | `[~]`  |
| 31  | «Reportes de pasivos» debe descargar PDF/Excel como activos                       | Sidebar pasivos / reportes          | `[~]`  |


## Detalle

### 1. Imagen del login

- [x] Quitar `bg-brand-deep`.
- [x] Volver a imagen a sangre completa (`object-cover`).
- [x] Aplicar en login, recuperar y restablecer.

- Archivos: `NextJS/src/app/(auth)/login/page.tsx`, `recuperar-password/page.tsx`, `restablecer-password/page.tsx`.
- Verificación: pendiente de rebuild y captura final.

### 2. Nóminas en activos

- [x] Agregar filtro `solo_activos=true` al catálogo de tipos de nómina para activos.
- [x] Usarlo en `/cargos/crear-codigo`, modal de actualización de cargo, filtro de `/cargos` y `/personal/consultar`.
- [x] Pasivos ya usa `solo_pasivos=true` (`es_activo=False`).

- Estado: **implementado**; el catálogo de administración sigue mostrando todos los tipos (es su función). Verificado contra la BD: 7 activos / 3 pasivos.
- Archivos: `catalogos` (backend), `cargos-api.ts`, `personal-api.ts`.

### 3. Menú de pasivos con estructura de activos

- [x] Grupos desplegables con el mismo patrón visual.
- [x] Iconos, chevrons y footer iguales.

- Archivo: `NextJS/src/modules/pasivos/ui/components/app-sidebar-pasivos.tsx`.

### 4. Agregar pasivo con foto y proceso completo

- [x] Wizard de 7 pasos reutilizando los pasos de activos.
- [x] Incluye foto (`PasoBasicInfo`), académico, formación complementaria, antecedentes, salud, perfil físico y vivienda.
- [x] Paso previo de pensión con nóminas `es_activo=False`.

- \[\~\] Falta verificación E2E de escritura (requiere `E2E_ADMIN_PASSWORD`).
- Archivo: `NextJS/src/modules/pasivos/ui/registrar-pasivo-directo-page.tsx`.

### 5. Selector en familiares y otros submódulos

- [x] `familiares`, `organizacion`, `cargos`, `movimientos`, `reportes` y `retroalimentacion` se consideran parte de Gestión de Trabajadores.
- [x] El selector se mantiene visible en esas rutas.

- Archivo: `NextJS/src/components/layout/header.tsx`.

### 6. Tarjetas de `/personal`

- [x] Eliminadas «Consultar Trabajadores» y «Registrar Trabajador».
- [x] Se conserva el encabezado de bienvenida.

- Archivo: `NextJS/src/app/(app)/personal/page.tsx`.

### 7. Familiares de pasivos sin saltar a activos

- [x] Rutas propias: `/pasivos/familiares/registrar` y `/pasivos/familiares/consultar`.
- [x] El layout padre es el de pasivos.
- [x] Los enlaces del sidebar apuntan a esas rutas.

- \[\~\] Falta rebuild y verificación en vivo.
- Archivos: `NextJS/src/app/(app)/pasivos/familiares/**`, `app-sidebar-pasivos.tsx`, `evaluador-iam.ts`.

### 8. Filtros de pasivos

- [x] Eliminados «Egreso desde» y «Egreso hasta».
- [x] Quedan cédula, nombre y tipo de nómina.
- [x] Misma tarjeta y botones de filtro.

- Archivo: `NextJS/src/modules/pasivos/ui/pasivos-page.tsx`.

### 9. Nóminas de pasivos

- [x] El filtro usa `getTiposNominaAction(true)` → `solo_pasivos=true`.
- [x] El backend traduce a `TipoNomina.es_activo = false`.
- [x] Los valores observados son JUBILADO, PENSIONADO y PENSIONADO SOBREVIVIENTE.

### 10. Tabla de pasivos

- [x] Columnas reordenadas: Código, Cédula, Nombre completo, Tipo de nómina, Fecha de egreso, Acciones.

- \[\~\] No se añadieron cargo/dependencia porque el listado de pasivos no los trae; sería un cambio de backend.
- Archivo: `NextJS/src/modules/pasivos/ui/pasivos-columns.tsx`.

### 11. Egreso de pasivo

- [x] Página `/pasivos/egreso-pasivo` con búsqueda, motivo de fallecimiento y sobrevivientes.
- [x] Backend `POST /api/v1/pasivos/<cedula>/egreso/`.
- [x] Motivos `GET /api/v1/pasivos/motivos-egreso/` filtrados por fallecimiento.
- [x] Rechazo 400 de motivos de activo.
- [x] C20 reutilizado para sobrevivientes.
- [x] Tests backend 3/3.

- \[!\] E2E de escritura bloqueado por `E2E_ADMIN_PASSWORD`.

### 12. «Procesar egreso» fuera de pasivos

- [x] Eliminado del menú de pasivos.
- [x] Eliminada la ruta duplicada `/pasivos/egreso`.
- [x] El flujo activo → pasivo queda en `/movimientos/cambiar-pasivo`.

### 13. «Sobrevivientes» suelto

- [x] Eliminado del menú de pasivos.
- [x] Integrado dentro del egreso de pasivo.
- [x] Eliminada la ruta `/pasivos/sobrevivientes`.

### 14. Menú de activos completo

- [x] Restaurados Organización, Cargos, Movimientos, Reportes, Retroalimentación, Bienestar y Fe de vida.
- [x] Conservado «Inicio» → `/dashboard` (R-6c).

- Archivo: `NextJS/src/modules/personal/ui/components/app-sidebar-personal.tsx`.

### 15. «Configuración visual»

- [x] Eliminada del sidebar de activos.
- [x] Permanece en Administración del sistema → Configuración.

### 16. Autogestión y Censo

- [x] Eliminado el grupo «Autogestión» del sidebar de activos.
- [x] Censo movido a `/personal/censo/respuestas` y `/personal/censo/metricas`.
- [x] Rutas viejas redirigen en `proxy.ts`.
- [x] Sidebars de Carnetización/Administración sin enlace a Autogestión.

### 17. Selector de header

- [x] Etiqueta «Gestion Personal Activo» / «Gestion Personal Pasivo» según ruta.
- [x] Cambia el menú al elegir el otro módulo.

### 18. Caché PWA

- [x] `CACHE_VERSION` de `gath-shell-v3` a `gath-shell-v4` en `public/sw.js`.

### 19. Autogestión responsive

- [x] Cabecera con foto, nombre y datos que se apilan en móvil; correo con `break-all`.
- [x] Pestañas en `ScrollArea` con disparadores `shrink-0` y padding reducido en móvil.
- [x] Encabezados de tarjeta con `flex-col` en móvil y `sm:flex-row` desde tablet.
- [x] Tablas de contratos y cargas familiares con desplazamiento horizontal y ancho mínimo.
- [x] Formulario de censo: `p-4` en móvil, grillas de 1 columna y `sm:col-span-2`.

- \[\~\] Falta verificación visual en un teléfono real.
- Archivos: `mi-expediente-view.tsx`, `app/(app)/autogestion/censo/page.tsx`.

### 20. Antecedentes laborales

- [x] Nueva tarjeta «Antecedentes de Servicio» en «Ubicación Laboral».
- [x] Muestra organismo, fecha de ingreso/egreso y duración calculada.
- [x] Usa `empleado.antecedentes`, que el backend ya enviaba pero la vista no renderizaba.

- Archivo: `mi-expediente-view.tsx`.

### 21. Oficina en la cabecera

- [x] La cabecera prioriza `direccion_general` («OFICINA DE SISTEMAS…») sobre `dependencia`.
- [x] En la ficha se separan «Oficina / Dirección General» y «Dependencia (Nivel)».
- [x] `NIVEL DE APOYO` deja de ocupar el lugar de la ubicación real.

### 22. Mi Carnet Digital oculto

- [x] Bandera `MOSTRAR_CARNET = false` en `mi-expediente-view.tsx`.
- [x] Oculta el botón de la cabecera, la insignia de carnet, la pestaña, el contenido y el diálogo de solicitud.
- [x] Para habilitarlo: cambiar la bandera a `true` (el backend ya está listo).

### 23. Censo de Vivienda

- [x] Quitado el botón de la cabecera de Autogestión.
- [x] Se mantiene en el menú lateral, gobernado por el permiso `autogestion.censo_ver_propio` (condición `ACTIVO`).
- [x] Se puede conceder o retirar por rol (matriz de permisos) o por usuario (permisos individuales allow/deny).

### 24. Foto del trabajador

- [x] La vista ya renderiza `empleado.foto_url` con respaldo al icono y `onError`.
- [x] La cuenta de prueba (`30799436`) tiene `profile` vacío en la base, por eso no hay foto que mostrar; el circuito funciona cuando existe.

- Archivo: `mi-expediente-view.tsx`.

### 25. «Bienestar Social» → «Actualización de Datos»

- [x] Renombrado el grupo del sidebar de activos a «Actualización de Datos».
- [x] El grupo ya estaba gobernado por `bienestar.ver_solicitudes`; sus ítems también.
- [x] Actualizados el resaltado del submenú y los E2E que buscaban el texto anterior.

- Archivos: `app-sidebar-personal.tsx`, `e2e/g13-pasivos.spec.ts`.

### 26. Reporte de auditoría

- [x] Creado `REPORTE_AUDITORIA_INTEGRAL_2026-11-01.md` con resumen, hallazgos, pruebas, matriz de roles, rendimiento, carga, bloqueos y datos creados.
- [x] Los hallazgos incluyen el peso del listado de personal (670 KB/10 filas), las 14 consultas de `/me`, la carga a 50 usuarios y los flags de seguridad apagados.

### 27. Texto dañado en la bandeja de solicitudes

- [x] Corregidos los acentos dañados del archivo: «Cédula del trabajador», «Solicitudes de actualización de datos», «Filtro inválido», «Acción» y «Paginación».
- [x] La tabla y los textos visibles quedan igual; solo cambia la codificación.
- Archivo: `src/modules/autogestion/ui/bienestar/bandeja-solicitudes-page.tsx`.

### 28. Orden de la ubicación laboral

- [x] Orden en «Estructura y Ubicación Administrativa»: Dependencia → Oficina / Gerencia → Dirección de Línea → Coordinación.
- [x] «Dependencia» muestra el nivel (p. ej. NIVEL DE APOYO) y «Oficina / Gerencia» la dirección general.
- [~] Pendiente rebuild y verificación visual.
- Archivo: `src/modules/autogestion/ui/mi-expediente-view.tsx`.

### 29. Fecha de culminación sin inventar datos

- [x] Si no hay `fecha_culminacion`, se muestra «—» en lugar de «Indefinido / Permanente».
- [x] Se quitaron otros valores inventados de la ficha laboral (N° de contrato, política, ingreso, línea, coordinación, nómina, grado y modalidad): ahora muestran «—» cuando el backend no trae el dato.
- [~] Pendiente rebuild y verificación visual.
- Archivo: `src/modules/autogestion/ui/mi-expediente-view.tsx`.

### 30. «Fe de vida» de pasivos

- [~] En curso: se agregó `baseFeDeVida(pathname)` para que los enlaces internos permanezcan en `/pasivos/fe-de-vida` cuando se entra desde pasivos, con test unitario.
- [ ] Falta crear las rutas `app/(app)/pasivos/fe-de-vida/{,procesos,cobertura,[id]}` y cambiar los enlaces del sidebar y del módulo.
- Archivos: `src/modules/fe-de-vida/ui/rutas-fe-de-vida.ts`, `rutas-fe-de-vida.test.ts`.

### 31. Reportes de pasivos con descarga

- [~] En curso: se identificó que `ReportesPage` (tabs con pasivos y botones PDF/Excel) existe pero no está montado en ninguna ruta; `/reportes` solo muestra el panel de distribución.
- [ ] Falta montar el reporte en `/pasivos/reportes` con la pestaña «Pasivos» activa y apuntar el sidebar allí, sin tocar los reportes de activos.
- Archivos por tocar: `src/app/(app)/pasivos/reportes/page.tsx`, `app-sidebar-pasivos.tsx`, `evaluador-iam.ts`.

## Pendientes reales

1. ~~Implementar `solo_activos`~~: implementado en backend y consumidores; verificado con 7 nóminas activas / 3 pasivas.
2. Rebuild de Next.js/Django y verificación en vivo de los puntos 1, 4, 5, 7, 10, 11, 19, 28 y 29.
3. E2E de escritura (alta, edición y egreso) cuando exista `E2E_ADMIN_PASSWORD`.
4. Capturas finales actualizadas.
5. Ejecutar la fase C de la auditoría (flujos de escritura) y `EXPLAIN ANALYZE` cuando se desbloqueen las credenciales.
6. Corregir el contrato de `getPorEmpleado` en `familiares-api.ts` (hallazgo A-07 del reporte).
7. Completar «Fe de vida» y «Reportes de pasivos» dentro del módulo de pasivos (puntos 30 y 31).
8. Ejecutar las mediciones antes→después de A-01/A-02/A-04 y cerrar la sección «Mensaje 2» de `REPORTE_CORRECCIONES_2026-11-01.md`.

