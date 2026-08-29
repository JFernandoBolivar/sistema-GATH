CONTROL DE CAMBIO


Campo

Descripción

ID del Cambio

CC-APP-2026-08-001



Fecha de Solicitud

 19  de agosto de 2026

Solicitante

Jose Bolívar
Prioridad

Media


2. Especificaciones Técnicas
Detalle de los activos de información y componentes que serán modificados en el sistema:

Elemento

Detalle / Configuración

Servidor / Instancia

GATH  - Ambiente de Produccion (prod)

Base de Datos

NUEVABD-GATH

Tabla a Intervenir

USER_rol

Campo(s)

nombre_rol, descripcion_rol

Tipo de Acción

Actualización de código mediante GitLab (Merge Request a rama de Produccion)

Cantidad de archivos



Se realizaron modificaciones en 12 componentes/archivos del sistema y la creación de 1 archivo nuevo, para un total de 13 componentes intervenidos.


3. Descripción de la Modificación
Se realizaron ajustes a nivel de código (Backend y Frontend)

para implementar la adaptación del sistema al nuevo rol de Recepcionista,

además de habilitar la administración del catálogo de roles (creación, actualización y eliminación) por parte del administrador.



Motivo de la modificación:



El objetivo principal de esta actualización es incorporar un perfil de sólo consulta que permita

revisar la información de trabajadores y familiares, tanto activos como pasivos, sin capacidad de

registrar, actualizar, gestionar códigos ni extraer reportes.

Esto se diseñó para que el sistema, al detectar que la cuenta autenticada posee el rol de Recepcionista,

muestre en el menú lateral únicamente las pantallas de consulta de ambos módulos y oculte dentro de ellas

los accesos a los formularios de actualización y la exportación de expedientes, mientras el control de rutas

del frontend redirige al inicio cualquier intento de ingresar de forma manual a una pantalla de escritura.

Adicionalmente se incorporaron los servicios necesarios para que el administrador pueda dar de alta,

modificar y eliminar roles desde el módulo de Seguridad sin intervención directa en la base de datos,

ya que hasta ahora los cinco roles existentes contaban todos con capacidades de escritura sobre algún

módulo y no existía un perfil destinado a la atención en recepción.



4. Plan de Ejecución y Contingencia
Paso 1: Despliegue de Código en Ambiente de Producción
Acceder al directorio del proyecto en el servidor de produccion.

Asegurar que no existan cambios locales sin confirmar: git status.

Realizar la descarga de la rama de produccion: git pull origin prod (o la rama designada para produccion).

Reconstruir la imagen y levantar el contenedor: docker compose up -d --build 

Verificar el estado del servicio y logs de contenedor para asegurar su correcta inicialización: docker compose ps and docker compose logs -f 

Plan de Contingencia (Rollback)
Escenario A: Error en la descarga del código (Conflictos de Git)
Acción: Abortar el proceso de fusión (merge) y restablecer el repositorio al último estado de código estable conocido:

git merge --abort
git reset --hard HEAD
Nota: Para conocer la firma exacta del HEAD activo previo al cambio, ejecute git log -n 5 antes de iniciar el procedimiento.

Escenario B: Error de Compilación en Build o Fallo Crítico en Ejecución (Runtime)
Acción: Revertir el código al tag o commit estable inmediatamente anterior:

git reset --hard 0247def
docker compose up -d --build 
# Confirmar que la versión anterior esté de nuevo en línea
