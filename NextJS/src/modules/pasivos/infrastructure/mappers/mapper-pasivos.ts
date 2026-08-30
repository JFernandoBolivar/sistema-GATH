/**
 * Mappers para convertir datos de Pasivos a entidades de dominio.
 */
import type { CatalogoPasivo, Pasivo } from "../../domain/entities/pasivo";
import type { CatalogoPasivoApiItem, PasivoApiItem } from "../http/pasivos-api";

export function pasivoApiAEntidad(raw: PasivoApiItem): Pasivo {
  return {
    id: raw.id,
    cedula: raw.cedula,
    nombres: raw.nombres,
    apellidos: raw.apellidos,
    nombreCompleto: raw.nombre_completo,
    tipoPasivo: raw.tipo_pasivo,
    fechaEgreso: raw.fecha_egreso,
    resolucion: raw.resolucion,
    observaciones: raw.observaciones,
    datosVivienda: raw.datos_vivienda,
    perfilSalud: raw.perfil_salud,
    formacionAcademica: raw.formacion_academica,
    contactoEmergencia: raw.contacto_emergencia,
    antecedentes: raw.antecedentes,
    contratoActual: raw.contrato_actual,
    cargosHistorial: raw.cargos_historial ?? [],
  };
}

export function catalogoPasivoApiAEntidad(raw: CatalogoPasivoApiItem): CatalogoPasivo {
  return { id: raw.id, nombre: raw.nombre };
}
