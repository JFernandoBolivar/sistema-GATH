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
