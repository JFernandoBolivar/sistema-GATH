/**
 * Tipos e interfaces para el sistema de guías interactivas (O35).
 */

export interface PasoGuia {
  id: string;
  selector: string; // e.g. "[data-guia-id='inicio-cabecera']"
  titulo: string;
  descripcion: string;
  posicion?: "top" | "bottom" | "left" | "right" | "over";
  alineacion?: "start" | "center" | "end";
}

export interface DefinicionGuia {
  id: string; // e.g. 'autogestion_inicio'
  version: number;
  titulo: string;
  pasos: PasoGuia[];
}

export interface RegistroGuiaVista {
  guia_id: string;
  version: number;
  fecha_vista: string;
}
