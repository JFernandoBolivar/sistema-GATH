import type { CampoPropio, CatalogoVariables, VariableCatalogo } from "../../domain/entities/plantilla";
import { contextoDeVariables, variablesDisponibles, type ContextoVariables } from "../../domain/lib/variables";

/** Todo lo que los formularios de propiedades necesitan saber del catálogo y de los errores. */
export interface EntornoEditor {
  catalogo: CatalogoVariables | null;
  propios: CampoPropio[];
  /** Escalares (catálogo + `propio.*`): lo que cabe en celdas, textos y condiciones. */
  escalares: VariableCatalogo[];
  colecciones: VariableCatalogo[];
  ctx: ContextoVariables;
  /** Mensajes de error por ruta (`bloques.2.celdas.0.variable`). */
  errores: Record<string, string>;
  /** Solo lectura (sin permiso de gestión). */
  soloLectura: boolean;
}

export function crearEntorno(
  catalogo: CatalogoVariables | null,
  propios: CampoPropio[],
  errores: Record<string, string>,
  soloLectura: boolean,
): EntornoEditor {
  return {
    catalogo,
    propios,
    escalares: variablesDisponibles(catalogo, propios, { soloEscalares: true }),
    colecciones: variablesDisponibles(catalogo, propios, { soloColecciones: true }),
    ctx: contextoDeVariables(catalogo, propios),
    errores,
    soloLectura,
  };
}
