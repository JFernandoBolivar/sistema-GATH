# CONTROL DE CAMBIO

## 1. Identificación

| Campo | Descripción |
|---|---|
| ID del Cambio | CC-APP-2026-11-16-0001 |
| Fecha de Solicitud | 16 de noviembre de 2026 |
| Solicitante | [completar] |
| Prioridad | Alta |
| Ambiente | QA (rama `qa`) |

## 2. Especificaciones Técnicas

| Elemento | Detalle |
|---|---|
| Servidor / Instancia | GATH QA (`https://gathqa.conatel.gob.ve`), proyecto Docker `gath`, ruta `/opt/gath` (confirmar en QA) |
| Base de Datos | PostgreSQL de GATH — **sin cambios** |
| Tabla / Campo(s) | Ninguno. Cambio exclusivo de frontend (Next.js), sin DDL ni DML |
| Tipo de Acción | Actualización de código por GitLab (merge a `qa`) y despliegue del contenedor `nextjs`. **Sin migraciones** |
| Archivos / Commits | 7 archivos (+217 / −1). Fix `81d8eeb8` · merge en `qa` `45da65d2` · QA anterior `0895af4a` |

## 3. Descripción de la Modificación

En teléfono, al cambiar entre **Gestión Personal Activo** y **Pasivo** desde el menú lateral, la página quedaba con `pointer-events: none` en el `body`: ningún toque respondía hasta recargar. Causa: el `Sheet` del menú y el `DropdownMenu` del selector anidaban dos capas modales de Radix.

Corrección:
1. Selector sin modal (`modal={false}`): solo el `Sheet` controla el bloqueo del `body`.
2. El menú móvil se cierra automáticamente al cambiar de ruta.
3. Limpieza de seguridad de `pointer-events` y scroll residuales al navegar y al volver desde bfcache (iOS), solo si no hay un overlay abierto.

**Alcance:** menú móvil de Personal y Pasivos. Escritorio sin cambios. No se modifican datos ni permisos.

## 4. Plan de Ejecución

```bash
cd /opt/gath
git fetch origin
git checkout qa
git pull origin qa
git log -1 --oneline        # debe mostrar 45da65d2

sudo docker compose -p gath up -d --build --force-recreate nextjs
```

No ejecutar `migrate`: no hay migraciones.

**Verificación:** en un teléfono, abrir el menú en `/personal`, cambiar a Pasivo y volver a Activo; el menú debe reabrir sin recargar. Navegar dentro del módulo debe cerrar el menú. En escritorio, el selector de la cabecera sigue igual.

## 5. Rollback

```bash
cd /opt/gath
git checkout 0895af4a
sudo docker compose -p gath up -d --build --force-recreate nextjs
```

Solo se revierte el frontend. No hay migraciones ni datos que revertir.
