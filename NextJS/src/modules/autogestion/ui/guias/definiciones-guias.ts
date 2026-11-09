/**
 * Definiciones de las tres guías interactivas de Autogestión (O35).
 * Diseñadas con lenguaje claro, directo y accesible para usuarios de todas las edades.
 */
import type { DefinicionGuia } from "@/shared/ui/guias/tipos-guia";

export const GUIA_AUTOGESTION_INICIO: DefinicionGuia = {
  id: "autogestion_inicio",
  version: 1,
  titulo: "Guía de inicio en Autogestión",
  pasos: [
    {
      id: "inicio-cabecera",
      selector: "[data-guia-id='inicio-cabecera']",
      titulo: "Bienvenido(a) a su espacio personal",
      descripcion:
        "En esta sección puede ver un resumen de su expediente laboral, sus datos registrados y su información de contacto en CONATEL.",
      posicion: "bottom",
    },
    {
      id: "inicio-boton-solicitar",
      selector: "[data-guia-id='inicio-boton-solicitar']",
      titulo: "Solicitar actualización de datos",
      descripcion:
        "Si necesita actualizar su dirección, teléfonos, familiares o estudios, presione este botón para enviar su requerimiento a Bienestar Social.",
      posicion: "bottom",
    },
    {
      id: "inicio-pestanas",
      selector: "[data-guia-id='inicio-pestanas']",
      titulo: "Secciones de su expediente",
      descripcion:
        "Navegue entre las pestañas para revisar en detalle sus datos personales, laborales, vivienda, salud y grupo familiar.",
      posicion: "bottom",
    },
    {
      id: "inicio-menu-lateral",
      selector: "[data-guia-id='inicio-menu-lateral']",
      titulo: "Menú de trámites y opciones",
      descripcion:
        "Desde esta barra lateral puede consultar el histórico de sus solicitudes, ingresar a la Fe de vida y revisar sus notificaciones.",
      posicion: "right",
    },
    {
      id: "inicio-tamano-texto",
      selector: "[data-guia-id='inicio-tamano-texto']",
      titulo: "Ajuste del tamaño de letra",
      descripcion:
        "Si lo necesita, puede aumentar el tamaño del texto para leer toda la información con mayor comodidad y claridad.",
      posicion: "top",
    },
  ],
};

export const GUIA_MI_FICHA: DefinicionGuia = {
  id: "autogestion_mi_ficha",
  version: 1,
  titulo: "Guía de Mi ficha",
  pasos: [
    {
      id: "ficha-datos-personales",
      selector: "[data-guia-id='ficha-datos-personales']",
      titulo: "Datos personales y de contacto",
      descripcion:
        "Consulte su información básica, cédula, fecha de nacimiento, estado civil y vías de contacto registradas.",
      posicion: "bottom",
    },
    {
      id: "ficha-datos-laborales",
      selector: "[data-guia-id='ficha-datos-laborales']",
      titulo: "Información laboral y antigüedad",
      descripcion:
        "Verifique su cargo actual, dependencia de adscripción y los años de servicio acumulados en la Administración Pública.",
      posicion: "bottom",
    },
    {
      id: "ficha-carnet",
      selector: "[data-guia-id='ficha-carnet']",
      titulo: "Carnet institucional digital",
      descripcion:
        "Vea el estado de su carnet de trabajador o solicite su emisión ante la oficina encargada si aún no lo posee.",
      posicion: "left",
    },
    {
      id: "ficha-reportar-error",
      selector: "[data-guia-id='ficha-reportar-error']",
      titulo: "Aviso de discrepancia laboral",
      descripcion:
        "Si nota algún dato laboral que no coincide con sus registros, puede reportarlo directamente para que Recursos Humanos lo revise.",
      posicion: "top",
    },
    {
      id: "ficha-solicitar",
      selector: "[data-guia-id='ficha-solicitar']",
      titulo: "Actualizar datos con soporte",
      descripcion:
        "Inicie la solicitud oficial de cambios para adjuntar documentos probatorios que certifiquen sus nuevas modificaciones.",
      posicion: "bottom",
    },
  ],
};

export const GUIA_NUEVA_SOLICITUD: DefinicionGuia = {
  id: "autogestion_nueva_solicitud",
  version: 1,
  titulo: "Guía para solicitar actualización de datos",
  pasos: [
    {
      id: "solicitud-selector-campos",
      selector: "[data-guia-id='solicitud-selector-campos']",
      titulo: "Elija los datos a actualizar",
      descripcion:
        "Marque únicamente las casillas de los datos que desea modificar (dirección, teléfonos, carga familiar, formación académica).",
      posicion: "bottom",
    },
    {
      id: "solicitud-motivo",
      selector: "[data-guia-id='solicitud-motivo']",
      titulo: "Explique el motivo del cambio",
      descripcion:
        "Escriba una breve explicación del porqué requiere la actualización para facilitar la revisión por parte de Bienestar Social.",
      posicion: "top",
    },
    {
      id: "solicitud-boton-enviar",
      selector: "[data-guia-id='solicitud-boton-enviar']",
      titulo: "Envío de su solicitud",
      descripcion:
        "Presione este botón para enviar el trámite. Recibirá una notificación con el plazo otorgado para cargar sus recaudos de soporte.",
      posicion: "top",
    },
  ],
};

export const GUIA_MIS_SOLICITUDES: DefinicionGuia = {
  id: "autogestion_mis_solicitudes",
  version: 1,
  titulo: "Guía de Mis solicitudes",
  pasos: [
    {
      id: "mis-solicitudes-cabecera",
      selector: "[data-guia-id='mis-solicitudes-cabecera']",
      titulo: "Histórico de sus solicitudes",
      descripcion:
        "Aquí puede consultar todas las solicitudes de actualización que haya enviado y el estado en que se encuentra cada una.",
      posicion: "bottom",
    },
    {
      id: "mis-solicitudes-filtros",
      selector: "[data-guia-id='mis-solicitudes-filtros']",
      titulo: "Filtros de búsqueda",
      descripcion:
        "Filtre por estado o por fecha para encontrar rápidamente una solicitud concreta.",
      posicion: "bottom",
    },
    {
      id: "mis-solicitudes-lista",
      selector: "[data-guia-id='mis-solicitudes-lista']",
      titulo: "Avance de cada solicitud",
      descripcion:
        "Cada tarjeta muestra los datos solicitados, el estado actual y la línea de tiempo del trámite.",
      posicion: "top",
    },
    {
      id: "mis-solicitudes-paginacion",
      selector: "[data-guia-id='mis-solicitudes-paginacion']",
      titulo: "Navegación entre páginas",
      descripcion:
        "Si tiene muchas solicitudes, use «Anterior» y «Siguiente» para recorrer el listado completo.",
      posicion: "top",
    },
  ],
};

export const GUIA_CENSO_VIVIENDA: DefinicionGuia = {
  id: "autogestion_censo_vivienda",
  version: 1,
  titulo: "Guía del censo de vivienda",
  pasos: [
    {
      id: "censo-cabecera",
      selector: "[data-guia-id='censo-cabecera']",
      titulo: "Autogestión de personal",
      descripcion:
        "Complete el formulario con sus datos actuales. Los campos marcados con asterisco son obligatorios.",
      posicion: "bottom",
    },
    {
      id: "censo-preguntas",
      selector: "[data-guia-id='censo-preguntas']",
      titulo: "Preguntas del censo",
      descripcion:
        "Responda cada pregunta según su situación actual. Sus respuestas se guardan al enviar el formulario.",
      posicion: "top",
    },
    {
      id: "censo-vivienda",
      selector: "[data-guia-id='censo-vivienda']",
      titulo: "Datos de vivienda",
      descripcion:
        "Indique estado, municipio, parroquia, condición de la vivienda, dirección exacta y código postal.",
      posicion: "top",
    },
    {
      id: "censo-enviar",
      selector: "[data-guia-id='censo-enviar']",
      titulo: "Enviar el censo",
      descripcion:
        "Al terminar, presione «Enviar autogestión». Recibirá una confirmación y no necesitará repetirlo.",
      posicion: "top",
    },
  ],
};

export const GUIA_NOTIFICACIONES: DefinicionGuia = {
  id: "autogestion_notificaciones",
  version: 1,
  titulo: "Guía de Notificaciones",
  pasos: [
    {
      id: "notificaciones-cabecera",
      selector: "[data-guia-id='notificaciones-cabecera']",
      titulo: "Todos sus avisos en un solo lugar",
      descripcion:
        "Aquí llegan las notificaciones de Autogestión y de los demás módulos, sin importar dónde se generaron.",
      posicion: "bottom",
    },
    {
      id: "notificaciones-filtros",
      selector: "[data-guia-id='notificaciones-filtros']",
      titulo: "Buscar y filtrar",
      descripcion:
        "Busque por título o mensaje y filtre por tipo, estado de lectura o rango de fechas.",
      posicion: "bottom",
    },
    {
      id: "notificaciones-lista",
      selector: "[data-guia-id='notificaciones-lista']",
      titulo: "Lista de notificaciones",
      descripcion:
        "Pulse una notificación para ver su detalle y, si corresponde, abrir el trámite relacionado. También puede marcarla como leída.",
      posicion: "top",
    },
    {
      id: "notificaciones-paginacion",
      selector: "[data-guia-id='notificaciones-paginacion']",
      titulo: "Paginación",
      descripcion:
        "Use «Anterior» y «Siguiente» para recorrer sus notificaciones cuando haya más de una página.",
      posicion: "top",
    },
  ],
};
