import { formatearTelefono } from "@/shared/domain/validation/telefono";
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
  pais_id: "paises",
  estado_id: "estados",
  municipio_id: "municipios",
  parroquia_id: "parroquias",
  condicion_vivienda_id: "condicionesVivienda",
  codigo_postal_id: "codigosPostales",
  nivel_academico_id: "nivelesAcademicos",
  carrera_id: "carreras",
  mencion_id: "menciones",
  institucion_id: "instituciones",
  capacitacion_id: "capacitaciones",
  grupo_id: "gruposCapacitacion",
  parentesco_id: "parentescosFamilia",
  relacion_id: "parentescos",
  sexo_id: "sexos",
  estadoCivil_id: "estadosCiviles",
  grupo_sanguineo_id: "gruposSanguineos",
  alergias: "alergias",
  patologias_cronicas: "patologias",
  discapacidades: "discapacidades",
  talla_camisa_id: "tallasCamisa",
  talla_pantalon_id: "tallasPantalon",
  talla_zapatos_id: "tallasZapatos",
  talla_chaqueta_id: "tallasChaqueta",
  organismo_id: "organismos",
};

/** Campos que guardan teléfonos (E.164): se muestran con código de país. */
const CAMPOS_TELEFONO = new Set(["telefono", "telefono_movil", "telefono_habitacion"]);

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
  if (Array.isArray(valor)) {
    if (valor.length === 0) return "Ninguno";
    return valor.map((v) => formatearValor(v as ValorCambio, campo, nombres)).join(", ");
  }
  if (typeof valor === "object") {
    return Object.entries(valor)
      .filter(([, v]) => v !== null && v !== "")
      .map(([k, v]) => formatearValor(v as ValorCambio, k, nombres))
      .join(" · ");
  }
  if (typeof valor === "string" && CAMPOS_TELEFONO.has(campo)) return formatearTelefono(valor);
  const clave = catalogoDeCampo(campo);
  if (clave && (typeof valor === "number" || /^\d+$/.test(String(valor)))) {
    const id = Number(valor);
    return nombres[clave]?.[id] ?? `Código ${valor}`;
  }
  return String(valor);
}
