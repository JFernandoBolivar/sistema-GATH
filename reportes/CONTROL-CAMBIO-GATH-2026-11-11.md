# CONTROL DE CAMBIO

| Campo | Descripción |
|---|---|
| ID del Cambio | CC-APP-2026-11-11-xxxx |
| Fecha de Solicitud | 11 de Noviembre de 2026 |
| Solicitante | [completar] |
| Prioridad | Alta (emergencia) |

## 2. Especificaciones Técnicas
Detalle de los activos de información y componentes que serán modificados en el sistema:

| Elemento | Detalle / Configuración |
|---|---|
| Servidor / Instancia | GATH (Gestión Administrativa de Talento Humano), ambiente de producción (prod), `/opt/gath`, proyecto Docker `gath` |
| Base de Datos | PostgreSQL de GATH, esquema `public` |
| Tabla a Intervenir | `fe_de_vida_solicitud` (marca «sin correo alternativo» y su justificación).<br>`USER_cuenta` (contraseña de las cuentas restablecidas).<br>`identidad_cuenta_password_inicial` (vencimiento nuevo de la contraseña inicial).<br>`auditoria_log` (registro de cada restablecimiento en bloque). |
| Campo(s) | `fe_de_vida_solicitud.sin_correo_alternativo` y `fe_de_vida_solicitud.justificacion_sin_correo` (ya existen; ahora también se llenan desde la fe de vida en línea).<br>`USER_cuenta.password` (vuelve a ser la cédula, solo en las cuentas que se restablezcan).<br>`identidad_cuenta_password_inicial.vence_en` (nuevo plazo, según el parámetro `plazos.password_inicial_dias`). |
| Tipo de Acción | Actualización de código mediante GitLab (merge request a la rama de producción). **Sin cambios de esquema ni migraciones.** |
| Cantidad de archivos | 40 archivos únicos (13 de la fe de vida y 27 del restablecimiento en bloque) |

## 3. Descripción de la Modificación
**1. Fe de vida en línea: «No tiene correo alternativo» para el pasivo.**
- El pasivo ve la misma casilla que hoy usa el analista en el registro presencial, con una justificación obligatoria de al menos 10 caracteres.
- El servidor acepta esta opción en los dos canales y la guarda en el borrador.
- La constancia sigue llegando al correo principal del pasivo, que es con el que ingresa al sistema. Solo se omite la copia al correo alternativo.

**2. Restablecimiento de contraseñas en bloque** (Gestión del sistema → Parámetros):
- Resuelve el caso de los trabajadores que ingresan por primera vez después del plazo y encuentran «Su contraseña inicial venció». Hoy hay que restablecerlos uno por uno.
- **Clasificación:** activos, pasivos o ambos.
- **Alcance:**
  - solo quienes aún no han ingresado por primera vez, es decir, cuya clave sigue siendo la cédula. Es el valor por defecto;
  - o todos, con una advertencia y doble confirmación.
- **Avisos:** se puede elegir si se envía o no un correo de aviso a cada usuario.
- **Pasos:**
  1. Se indica un motivo obligatorio.
  2. Se calcula la vista previa con el total.
  3. Se confirma escribiendo ese número.
- **Ejecución:** corre en segundo plano y no detiene el sistema. Queda registrada en la bitácora de auditoría con el usuario, los filtros, el motivo y los totales.
- **Restricciones:**
  - solo lo puede usar el superadministrador;
  - nunca toca las cuentas administrativas ni las desactivadas.

**No se borran datos.** No hay migraciones ni cambios de estructura en la base de datos.

## 4. Plan de Ejecución y Contingencia

### 4.0 Antes del despliegue
1. Respaldar la base de datos:
   ```bash
   cd /opt/gath
   sudo docker compose -p gath exec db pg_dump -U <usuario> -Fc <bd> > /opt/respaldos/gath_antes_CC-2026-11-11.dump
   ```
2. Confirmar que el parámetro `plazos.password_inicial_dias` está en **30**, en Gestión del sistema → Parámetros.

### 4.1 Despliegue
```bash
cd /opt/gath
git fetch origin
git checkout prod
git pull
sudo docker compose -p gath up -d --build --force-recreate
# El entrypoint ya migra; se deja explícito (idempotente):
sudo docker compose -p gath exec django python manage.py migrate --noinput
```

### 4.2 Verificación
```bash
sudo docker compose -p gath ps
```
**Esperado:** django, celery_worker, celery_beat y nextjs en estado `Up`.

**Pruebas funcionales:**
1. Un pasivo abre su fe de vida en línea y ve la casilla «No tiene correo» en el paso de contacto.
2. El superadministrador entra en Parámetros → «Restablecer contraseñas en bloque» y pulsa **Calcular**, sin ejecutar. Debe mostrarse el total de cuentas.
3. Se ejecuta con el alcance «Solo quienes aún no han ingresado» y se anotan los totales del resultado.

### 4.3 Contingencia: revertir
**Código:** se vuelve al commit anterior y se reconstruye:
```bash
cd /opt/gath
git checkout <commit anterior al despliegue>
sudo docker compose -p gath up -d --build --force-recreate
```
No hay migraciones que revertir.

**Datos:**
- Las solicitudes de fe de vida enviadas sin correo alternativo conservan su justificación. No afectan al código anterior.
- Los restablecimientos ya ejecutados no se revierten con el código: las cuentas quedan con la cédula como clave y el plazo nuevo, que es el estado esperado. Si hace falta volver al estado previo completo, se restaura el respaldo del paso 4.0.
