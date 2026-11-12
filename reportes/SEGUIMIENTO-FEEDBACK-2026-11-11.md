# Seguimiento de los comentarios del 11/11/2026

Rama: `feature/fe-de-vida-pasivos`. Se actualiza a medida que avanza el trabajo.

**Estados:**
- ✅ Completado (con su commit)
- ⏳ En proceso
- ❓ Pregunta respondida
- 🟡 Espera tu decisión

## Resumen

| Estado | Cantidad |
|---|---|
| ✅ Completado | 63 |
| ⏳ En proceso | 7 |
| ❓ Respondida | 9 |
| 🟡 Espera tu decisión | 0 |

## Cambios urgentes y administración

| # | Comentario | Estado | Resultado / respuesta | Commit |
|---|---|---|---|---|
| 1 | «No tiene correo» también para el pasivo en la fe de vida en línea | ✅ | Casilla con justificación obligatoria en ambos canales. La constancia llega al correo principal | `b7b1914b` |
| 2 | Restablecer contraseñas en bloque (activos/pasivos, sin primer ingreso/todos, con o sin correo) | ✅ | En Parámetros, solo superadministrador | `27e1b1ab` |
| 3 | Vista previa del restablecimiento: lenta y «fetch failed» | ✅ | De minutos a segundos; reintenta si hay cortes | `326eb407` |
| 4 | Rediseño del restablecimiento: poco atractivo y después de aplicar «sigue igual» | ✅ | Asistente de 3 pasos, alcance por defecto «contraseña vencida» (baja a 0 al aplicar), lista y Excel de cuentas | `561d274d` |
| 5 | Usuarios: «Siguiente» muy seguido rompe la página | ✅ | Muestra un error y no se cae | `b7b1914b` |
| 6 | «Último acceso» siempre vacío | ✅ | Se registra en cada inicio de sesión | `b7b1914b` |
| 7 | ¿«No» en «Contraseña inicial» quiere decir que ya la cambió? | ❓ | No siempre. Las cuentas antiguas sin registro también dicen «No». S2-02 lo corrige al desplegar | — |
| 8 | Filtro de filas de Usuarios | ✅ | Se agregó la opción de 20 | `9fa48159` |
| 9 | Pasivos: con 50 filas solo mostraba 10 | ✅ | La tabla muestra todas las filas que recibe | `9f674655` |
| 10 | Corregir la cédula de un trabajador | ✅ | Va en «Actualizar Información Básica» con el permiso «Corregir cédula del trabajador» (grupo Personal Activo) | `f4df9c68` `9d51cb21` |
| 11 | La corrección de cédula no salía en pasivos | ✅ | Ya sale en la ficha del pasivo | `00d2c66e` |
| 12 | Confirmación de la cédula con demasiada información | ✅ | Ahora muestra un resumen claro y el detalle queda plegado | `5c37ccfe` |
| 13 | Caso Odalis (10510831 → 10510821) | ❓ | Se hará desde el sistema con «Corregir cédula». La vista previa muestra los datos antes de confirmar y no se permite cambiar a una cédula que ya existe | — |
| 14 | ¿Cómo se llama el permiso y a qué grupo pertenece? | ❓ | «Corregir cédula del trabajador» (`personal.corregir_cedula`), grupo Personal Activo; el Administrador lo tiene | — |
| 15 | Control de cambio del pase | ✅ | `reportes/CONTROL-CAMBIO-GATH-2026-11-11.md` (40 archivos) | `d54c08c5` |
| 16 | Pantalla «No pudimos cargar la página» después de un despliegue | ✅ | Recarga sola una vez si la versión está desfasada | `4a6dded7` |
| 17 | Build de 2 horas | ❓ | Probablemente fue el primer build del servidor. Usar `up -d --build`. Anotado en `NOCHE-DECISIONES.md` | `9c2fbf48` `11fe8df2` |
| 18 | Actualizar Next y next-auth | ✅ | Rama aparte `chore/next-upgrade`; vulnerabilidades críticas de 7 a 0. Va en el próximo pase | `cb6183a8` |
| 19 | Contraseña inicial del superadministrador | ❓ | Ya está cambiada en producción, así que no hay riesgo hoy. Se mejora en el código más adelante | — |
| 20 | Índices faltantes | ✅ | Bitácora del QR, invitados y cargas masivas | `4c312859` |
| 21 | Regla de capas en ESLint | ✅ | Activada; 6 casos viejos quedan como advertencia | `b8d3ba7b` |
| 22 | Inventario de listados sin paginar, y paginarlos | ✅ | Censo, invitados de evento y cargos/vacantes | `91535bf6` |
| 23 | Selector de cargos en Préstamo (unos 1.071) | ✅ | Buscador en el servidor | `611958a9` |
| 24 | Foto del trabajador en el detalle del usuario | ✅ | Si no tiene foto, muestra las iniciales | `e0be7298` |
| 25 | «Versiones anteriores» del cintillo sin imagen | ✅ | La ruta faltaba en la lista blanca del proxy | `59f69066` |
| 26 | Punto de cuenta e Identidad visual pegados a la izquierda | ✅ | Ahora usan todo el ancho | `0a590ab8` |
| 27 | «Previsualizar PDF formal» no hacía nada | ✅ | El navegador bloqueaba la pestaña; ahora se abre en el mismo clic o se descarga | `cc061feb` |
| 28 | Filtros de Auditoría desalineados y pequeños | ✅ | Grilla alineada, controles legibles | `8455e2b7` |
| 29 | Auditoría: el rol no aparece | ✅ | Se guarda desde ahora; en los registros viejos se muestra el rol actual | `e27125db` |
| 58 | El campo «Escriba la cédula nueva para confirmar» aceptaba letras | ✅ | Ese campo y el de la cédula solo aceptan números | `f33fc3fb` |
| 59 | Nacionalidad con permiso propio, separado del de la cédula | ✅ | Permiso «Actualizar nacionalidad del trabajador» | `71cb939a` |
| 60 | El familiar registrado en una fe de vida aprobada no aparece en Familiares del pasivo | ✅ | Corregido: los familiares de la fe de vida aprobada se muestran en Familiares del pasivo | `f16df37a` |
| 61 | «¿Tiene hijos?» de la fe de vida debe actualizar el expediente y verse y editarse en la ficha de activos y pasivos | ✅ | Tarjeta «Grupo Familiar» en la ficha de activos y pasivos, con botón Actualizar (Sí/No) y auditoría | `0eb90c4c` |
| 62 | Botón «Contacto de emergencia» distinto a los demás | ✅ | Mismo estilo e ícono que las otras secciones | `0dcb8f4d` |
| 63 | Organización: el encabezado azul de la tabla se sale del recuadro redondeado | ✅ | El encabezado queda dentro del recuadro | `a9e0d523` |
| 64 | Cargos: la página no se adapta al ancho de la pantalla | ✅ | Las tablas anchas se desplazan dentro de su tarjeta; corregido para todas las páginas | `a9e0d523` |
| 65 | «Asignar código especial» debe tener el mismo formato que «Asignar cargo» | ✅ | Se iguala el diseño | `4b7ff4fb` |
| 66 | Encargaduría: después de buscar al trabajador no aparece el buscador del cargo | ✅ | Se revisa el flujo: trabajador, contrato, cargo y guardar | `4b7ff4fb` |
| 67 | Los campos obligatorios deben llevar asterisco | ✅ | En los formularios de Movimientos | `4b7ff4fb` |
| 68 | Al guardar el contrato: «Ha ocurrido un error interno» | ✅ | Causa: el estatus del contrato no existe en el catálogo. Se corrige, y si falla dará un mensaje claro | `4b7ff4fb` |
| 69 | ¿Se corrigió que no se pudiera reenviar ni regenerar la constancia después de unos días, y que no llegara el correo? | ❓ | Sí, en `b268731a` (cada reenvío tiene su propia clave y se agregó la recuperación). Aún no está en producción: entra con el próximo pase. En local no llegó porque el pasivo de prueba no tiene correo (el log dice «sin correo para enviar») | `b268731a` |
| 70 | Reporte de pasivos: subir los grupos de filtros para quitar los espacios en blanco y verificar que todos los filtros se apliquen en el PDF | ✅ | Diseño en columnas sin huecos y revisión de cada filtro | `57a480a3` |
| 71 | «Tipo de Pasivo» en el reporte debe listar solo los tipos de pasivo | ✅ | Mismo filtro que se usa al pasar a pasivo | `57a480a3` |
| 72 | El PDF de pasivos perdió los totales de femeninos y masculinos | ✅ | Se recupera el conteo por sexo sobre el resultado filtrado | `57a480a3` |
| 73 | Consultar pasivos: quitar el filtro «Tipo de Jubilación / Pensión» (permitía crear motivos) | ✅ | Eliminado; se sube con el permiso de nacionalidad | `71cb939a` |
| 74 | Ficha de pasivos: no deben salir Grado, «Cargo cubierto por encargaduría» ni Encargadurías | ✅ | Ocultos en la ficha de pasivos | `71cb939a` |
| 75 | Familiares: menú de acciones como el de Personal y botón de editar por bloque en Ver detalle | ✅ | Menú de acciones como Personal y edición por bloque en Ver detalle | `f16df37a` |
| 76 | Movimientos (contrato con error 500, buscador de cargo, asteriscos, código especial) | ✅ | Ver los puntos 65 a 68 | `4b7ff4fb` |
| 77 | ¿La regla «familiar con la misma cédula del titular» afecta a los hijos menores con cédula «titular-n»? | ❓ | No: solo bloquea cuando las cédulas son exactamente iguales. «5132733-1» sigue permitida y se agregó una prueba | — |
| 78 | Autogestión: la vivienda como un solo bloque «Actualizar mi vivienda», respetando la cascada país → estado → municipio → parroquia | ✅ | Una casilla abre el formulario completo con la cascada; además ahora se valida la coherencia en los cambios de un solo campo | `97d1e7ca` |
| 79 | «Mi carnet» en autogestión muestra un diseño fijo, no la plantilla configurada | ⏳ | Se mostrará la imagen real del carnet con la plantilla vigente y el QR verdadero. En cola | — |
| 30 | Familiares: grupo sanguíneo obligatorio, errores que no se marcan, error en el flujo de registro y actualización, documentos en la actualización | ✅ | Grupo sanguíneo obligatorio, errores marcados en cada campo, flujo de registro y actualización corregido, documentos en la actualización | `f16df37a` |

## Carnetización

| # | Comentario | Estado | Resultado / respuesta | Commit |
|---|---|---|---|---|
| 31 | La vista previa y la emisión del carnet tardan mucho | ✅ | De unos 19 s a unos 2 s; las fotos se reducen al subirlas | `d2a332e4` |
| 32 | QR con logo atractivo, sin cuadro blanco | ✅ | Diseño «Institucional» por defecto | `8a2f465c` |
| 33 | Elegir o diseñar el QR en el sistema, con el logo de la Biblioteca | ✅ | «Estilo del QR» por plantilla: presets, forma, colores, ojos y logo; valida la legibilidad al publicar | `8a2f465c` |
| 34 | Miniatura y editor deformados respecto al PDF; botones desbordados | ✅ | Editor y miniatura iguales al PDF | `77aa8c35` |
| 35 | Botón «Limpiar diseño» | ✅ | Para esta cara o para ambas, y se puede deshacer | `77aa8c35` |
| 36 | Selección múltiple y borrar con el teclado (Supr/Retroceso) | ✅ | Shift/Ctrl, recuadro y Ctrl+A | `77aa8c35` |
| 37 | Controles del panel de propiedades desparejos (tipografía, color) | ✅ | Stepper de tamaño, muestras de color, alturas iguales | `77aa8c35` |
| 38 | «Criterio de color» no cambiaba la lista | ✅ | Cada criterio tiene sus valores; Nivel y Otro quedan deshabilitados | `77aa8c35` |
| 39 | Aplicar una combinación de colores a todos o a varios | ✅ | Aplicar a todos o a los seleccionados, buscador y quitar todos | `77aa8c35` |
| 40 | Colores distintos para los visitantes | ✅ | Visitante, Contratista y Temporal dentro de las categorías | `8a2f465c` |
| 41 | Biblioteca de Medios: imágenes rotas | ✅ | En la base local faltan los archivos; ahora se muestra «Archivo no disponible» | `c4a649d5` |
| 42 | Formas de la propuesta (diagonales y esquinas curvas) | ✅ | 6 «Formas institucionales» calcadas de la propuesta | `0188cf46` |
| 43 | Poder construir formas uno mismo (redondear una esquina, mover puntos) | ✅ | 4 radios por rectángulo y «Editar puntos». **Pendiente:** que el PDF lea la edición por puntos | `0188cf46` |
| 44 | ¿Para qué sirve el recuadro «Forma SVG»? Se ve anticuado | ❓ | Es el código de dibujo de la figura. Ahora queda en «Avanzado», con validación y miniatura | `0188cf46` |
| 45 | Texto que se desborda al imprimir por lotes | ✅ | Reduce el tamaño, parte en dos líneas o recorta; nunca sale de la tarjeta | `8a2f465c` |
| 46 | Visitantes: mensaje «No se encontraron» con el buscador vacío, ícono del calendario, correo ambiguo | ✅ | Mensajes correctos, calendario a la derecha y «Correo del visitante» | `e0d15ed2` |
| 47 | Credencial temporal: selector de un solo tipo, nombre en un campo gris, correo suelto | ✅ | Tipo fijo y tarjeta resumen del trabajador | `3df08f3f` |
| 48 | Mensajes de error en inglés («This field may not be blank») | ✅ | El sistema está en español; los errores indican el campo | `71cb939a` |
| 49 | Estadísticas de carnetización en 0 | ✅ | Contaba claves equivocadas; ahora incluye credenciales externas y cuenta las de hoy y del mes | `71cb939a` |
| 50 | Tarjetas de eventos muy simples y lista de eventos sin paginar | ✅ | Tarjetas rediseñadas y lista paginada con filtros | `71cb939a` |
| 51 | Agregar invitados sin escribir: buscar y seleccionar (todos, activos, pasivos, por dependencia, externos) | ✅ | Diálogo con búsqueda: personal (todos, activos, pasivos o por dependencia) y externos registrados | `71cb939a` |
| 52 | «PDF Gafetes» da error y abre una página en blanco; zonas y categorías; utilidad de «Importar lista» | ✅ | «Descargar gafetes (PDF)», pestaña «Zonas y categorías» e «Importar externos (Excel)» en «Más opciones» | `71cb939a` |
| 53 | Fondos Fijos (Clásico): ¿qué es?, mejorar el diseño, paginar plantillas, fondos y biblioteca | ✅ | Fondos Fijos es un respaldo (se usa solo si no hay plantilla por capas); rediseño y paginación de plantillas, fondos y biblioteca | `71cb939a` |
| 54 | Eventos: ¿los trabajadores entran con su carnet o con un gafete del evento? | ⏳ | Decidido: con su carnet institucional. En cola | — |
| 55 | Campos personalizados: no tienen de dónde sacar el dato | ⏳ | Hoy salen vacíos. Decidido: a) elegir el origen del dato del expediente, con un permiso propio asignable por rol. En cola | — |
| 56 | ¿Se puede emitir el carnet cuantas veces se quiera? | ⏳ | Hoy sí, y cada emisión anula la anterior. Decidido: aviso «ya tiene carnet vigente», motivo obligatorio y registro en la bitácora. En cola | — |
| 57 | ¿Autogestión muestra el carnet nuevo? | ❓ | Sí, siempre muestra el vigente | — |

## Cierre: auditoría final (pedida por el usuario)
Cuando todo lo de arriba esté completado, se hará una auditoría de todos los cambios del día (desde `e1062e8e`) con las skills del proyecto (`BACKEND/.claude/skills` y `NextJS/.claude/skills`):
- arquitectura: Onion en el backend y Scream + Onion en el frontend (capas, puertos y repositorios, fronteras de import);
- valores fijos en el código (cédulas, ids, colores, textos, URLs) que deberían ir en configuración o catálogo;
- malas prácticas: duplicación, sobreingeniería (`ponytail-review`), errores tragados, N+1, validación de entradas (`validacion-input-protegido`), seguridad (`owasp-top-10-testing`) y pruebas;
- corrección de los hallazgos que no requieran tu decisión; los demás se anotan para que decidas.

## Pendiente técnico conocido
- El PDF debe dibujar las formas editadas por puntos y los radios por esquina. Hoy usa la copia del path.
- La rama `chore/next-upgrade` hay que ponerla al día con la feature antes del próximo pase.
