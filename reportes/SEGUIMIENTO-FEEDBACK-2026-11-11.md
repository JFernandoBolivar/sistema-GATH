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
| ✅ Completado | 35 |
| ⏳ En proceso | 7 |
| ❓ Respondida | 6 |
| 🟡 Espera tu decisión | 4 |

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
| 13 | Caso Odalis (10510831 → 10510821) | 🟡 | La 10510821 ya existe (es ella) y la 10510831 no existe. Falta confirmar en qué dirección va el cambio | — |
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
| 30 | Familiares: grupo sanguíneo obligatorio, errores que no se marcan, error en el flujo de registro y actualización, documentos en la actualización | ⏳ | OpenCode lo está corrigiendo | — |

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
| 48 | Mensajes de error en inglés («This field may not be blank») | ⏳ | El sistema pasa a español, con el nombre del campo en cada error | — |
| 49 | Estadísticas de carnetización en 0 | ⏳ | En investigación y corrección | — |
| 50 | Tarjetas de eventos muy simples y lista de eventos sin paginar | ⏳ | Rediseño y paginación | — |
| 51 | Agregar invitados sin escribir: buscar y seleccionar (todos, activos, pasivos, por dependencia, externos) | ⏳ | Diálogo de búsqueda con selección | — |
| 52 | «PDF Gafetes» da error y abre una página en blanco; zonas y categorías; utilidad de «Importar lista» | ⏳ | Se corrige el botón, se pueden gestionar zonas y categorías, e «Importar externos (Excel)» queda para los no registrados | — |
| 53 | Fondos Fijos (Clásico): ¿qué es?, mejorar el diseño, paginar plantillas, fondos y biblioteca | ⏳ | Explicación, rediseño y paginación | — |
| 54 | Eventos: ¿los trabajadores entran con su carnet o con un gafete del evento? | 🟡 | Recomendado: con su carnet institucional | — |
| 55 | Campos personalizados: no tienen de dónde sacar el dato | 🟡 | Hoy salen vacíos. Opciones: a) elegir el origen del dato del expediente (recomendado); b) quitarlos | — |
| 56 | ¿Se puede emitir el carnet cuantas veces se quiera? | 🟡 | Hoy sí, y cada emisión anula la anterior. Propuesta: aviso «ya tiene carnet vigente» y motivo obligatorio para reemitir | — |
| 57 | ¿Autogestión muestra el carnet nuevo? | ❓ | Sí, siempre muestra el vigente | — |

## Pendiente técnico conocido
- El PDF debe dibujar las formas editadas por puntos y los radios por esquina. Hoy usa la copia del path.
- La rama `chore/next-upgrade` hay que ponerla al día con la feature antes del próximo pase.
