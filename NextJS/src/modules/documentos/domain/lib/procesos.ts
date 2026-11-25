import type {
  CampoPropio,
  CatalogoVariables,
  DefinicionDocumento,
  ErrorValidacion,
  ProcesoPlantilla,
  VariableCatalogo,
} from "../entities/plantilla";
import { extraerVariables, PREFIJO_PROPIO, TIPOS_ESCALARES } from "./variables";

export interface GrupoProcesos {
  grupo: string;
  procesos: ProcesoPlantilla[];
}

/** Agrupa procesos por área funcional conservando el orden del catálogo. */
export function agruparProcesos(procesos: readonly ProcesoPlantilla[]): GrupoProcesos[] {
  const grupos: GrupoProcesos[] = [];
  for (const proceso of procesos) {
    let grupo = grupos.find((g) => g.grupo === proceso.grupo);
    if (!grupo) {
      grupo = { grupo: proceso.grupo, procesos: [] };
      grupos.push(grupo);
    }
    grupo.procesos.push(proceso);
  }
  return grupos;
}

/** Solo deja las variables pertenecientes a los grupos declarados por el proceso. */
export function filtrarVariablesPorProceso(
  variables: readonly VariableCatalogo[],
  proceso: ProcesoPlantilla | null | undefined,
): VariableCatalogo[] {
  if (!proceso) return [...variables];
  const grupos = new Set(proceso.grupos_variables);
  return variables.filter((variable) => grupos.has(variable.grupo));
}

/** Catálogo listo para el editor: el proceso limita también las colecciones y los valores sugeridos. */
export function catalogoParaProceso(
  catalogo: CatalogoVariables | null | undefined,
  codigoProceso: string | null | undefined,
): CatalogoVariables | null {
  if (!catalogo) return null;
  const proceso = catalogo.procesos.find((p) => p.codigo === codigoProceso);
  return {
    ...catalogo,
    proceso: codigoProceso ?? undefined,
    variables: proceso ? filtrarVariablesPorProceso(catalogo.variables, proceso) : [],
  };
}

function validador(
  todas: readonly VariableCatalogo[],
  proceso: ProcesoPlantilla,
  propios: readonly CampoPropio[],
) {
  const disponibles = filtrarVariablesPorProceso(todas, proceso);
  const escalares = new Set(disponibles.filter((v) => TIPOS_ESCALARES.includes(v.tipo)).map((v) => v.clave));
  const colecciones = new Set(disponibles.filter((v) => v.tipo === "coleccion").map((v) => v.clave));
  const clavesPropias = new Set(propios.map((c) => PREFIJO_PROPIO + c.clave));
  const etiquetas = new Map(todas.map((v) => [v.clave, v.etiqueta]));

  const escalar = (clave: string, ruta: string, errores: ErrorValidacion[]) => {
    if (!clave || escalares.has(clave) || clavesPropias.has(clave)) return;
    const nombre = etiquetas.get(clave) ?? clave;
    errores.push({
      ruta,
      mensaje: `La variable «${nombre}» no está disponible para el proceso «${proceso.etiqueta}».`,
    });
  };

  const coleccion = (clave: string, ruta: string, errores: ErrorValidacion[]) => {
    if (!clave || colecciones.has(clave)) return;
    const nombre = etiquetas.get(clave) ?? clave;
    errores.push({
      ruta,
      mensaje: `La lista de datos «${nombre}» no está disponible para el proceso «${proceso.etiqueta}».`,
    });
  };

  return { escalar, coleccion };
}

/**
 * Recorre formularios y PDF overlay para detectar referencias incompatibles antes
 * de cambiar el proceso. Las columnas de una tabla se validan contra su colección
 * en el esquema Zod; aquí se comprueba que la colección misma esté permitida.
 */
export function validarVariablesParaProceso(
  definicion: DefinicionDocumento,
  todas: readonly VariableCatalogo[],
  proceso: ProcesoPlantilla,
  propios: readonly CampoPropio[] = [],
): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];
  const { escalar, coleccion } = validador(todas, proceso, propios);

  if ("bloques" in definicion) {
    definicion.bloques.forEach((bloque, i) => {
      const ruta = `bloques.${i}`;
      if (bloque.tipo === "fila_campos") {
        bloque.celdas.forEach((celda, j) => escalar(celda.variable ?? "", `${ruta}.celdas.${j}.variable`, errores));
      } else if (bloque.tipo === "casillas") {
        escalar(bloque.variable, `${ruta}.variable`, errores);
      } else if (bloque.tipo === "tabla") {
        coleccion(bloque.coleccion, `${ruta}.coleccion`, errores);
      } else if (bloque.tipo === "parrafo") {
        for (const clave of extraerVariables(bloque.texto)) escalar(clave, `${ruta}.texto`, errores);
      }
    });
    return errores;
  }

  definicion.paginas.forEach((pagina, i) => {
    pagina.campos.forEach((campo, j) => {
      const ruta = `paginas.${i}.campos.${j}`;
      if (campo.tipo === "texto") {
        for (const clave of extraerVariables(campo.texto)) escalar(clave, `${ruta}.texto`, errores);
      } else if (campo.tipo === "casilla") {
        escalar(campo.condicion.variable, `${ruta}.condicion.variable`, errores);
      } else if (campo.tipo === "tabla") {
        coleccion(campo.coleccion, `${ruta}.coleccion`, errores);
      }
    });
  });
  return errores;
}
