import type { ValorCambio } from "../domain/entities/solicitud-actualizacion";

const FECHA_HORA = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Caracas",
});

/** `29/10/2026, 03:45 p. m.` (hora de Venezuela). Sin fecha: «—». */
export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : FECHA_HORA.format(fecha);
}

/** Mapa `id → nombre` por clave de catálogo, usado para mostrar nombres en lugar de códigos. */
export type NombresCatalogo = Record<string, Record<number, string>>;

const CATALOGO_POR_CAMPO: Record<string, string> = {
  estado_id: "estados",
  municipio_id: "municipios",
  parroquia_id: "parroquias",
  condicion_vivienda_id: "condicionesVivienda",
  codigo_postal_id: "codigosPostales",
  nivel_academico_id: "nivelesAcademicos",
  carrera_id: "carreras",
  mencion_id: "menciones",
  institucion_id: "instituciones",
  parentesco_id: "parentescos",
  relacion_id: "parentescos",
  sexo_id: "sexos",
};

export function catalogoDeCampo(campo: string): string | undefined {
  return CATALOGO_POR_CAMPO[campo];
}

/** Texto legible de un valor del comparativo: Sí/No, nombre de catálogo, o «Sin dato». */
export function formatearValor(
  valor: ValorCambio | undefined,
  campo: string,
  nombres: NombresCatalogo = {},
): string {
  if (valor === null || valor === undefined || valor === "") return "Sin dato";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "object") {
    return Object.entries(valor)
      .filter(([, v]) => v !== null && v !== "")
      .map(([k, v]) => formatearValor(v as ValorCambio, k, nombres))
      .join(" · ");
  }
  const clave = catalogoDeCampo(campo);
  if (clave && typeof valor === "number") {
    return nombres[clave]?.[valor] ?? `Código ${valor}`;
  }
  return String(valor);
}
