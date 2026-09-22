/**
 * Resuelve los IDs de catálogo del expediente de un empleado a nombres
 * legibles. Función pura (sin React), compartida por la vista de detalle
 * (`empleado-detalle-sheet.tsx`) y la exportación a PDF
 * (`empleado-detalle-pdf.tsx`) para no resolver los mismos catálogos dos
 * veces (regla R3: ui/ no reimplementa lógica de negocio, pero sí puede
 * tener helpers de presentación puros — mismo patrón que
 * `modules/reportes/ui/tendencia-chart-data.ts`).
 */
import { nombrePorId, nombresPorIds } from "@/shared/lib/catalogos";
import { formatearFecha } from "@/shared/lib/formato-fecha";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../application/dtos/empleado-dto";

const SIN_DATO = "N/A";

export interface DetalleViviendaVM {
  estado: string;
  municipio: string;
  parroquia: string;
  direccionExacta: string;
  condicion: string;
  codigoPostal: string;
}

export interface DetalleSaludVM {
  grupoSanguineo: string;
  alergias: string[];
  patologiasCronicas: string[];
  discapacidades: string[];
}

export interface DetalleFisicoVM {
  tallaCamisa: string;
  tallaPantalon: string;
  tallaZapatos: string;
  tallaChaqueta: string;
}

export interface DetalleFormacionAcademicaVM {
  nivelAcademico: string;
  carrera: string;
  mencion: string;
  institucion: string;
}

export interface DetalleFormacionComplementariaVM {
  capacitacion: string;
  institucion: string;
  fechaInicio: string;
  fechaFin: string;
  procedencia: string;
  grupo: string;
  horasCompletadas: string;
}

export interface DetalleContactoEmergenciaVM {
  nombreCompleto: string;
  telefono: string;
  relacion: string;
}

export interface DetalleAntecedenteVM {
  fechaIngreso: string;
  fechaEgreso: string;
  organismo: string;
}

export interface DetalleContratoVM {
  nContrato: string;
  fechaCulminacion: string;
  politica: string;
  esFijo: string;
}

export interface DetalleExpedienteViewModel {
  cedula: string;
  nombreCompleto: string;
  sexo: string;
  correo: string;
  telefonoMovil: string;
  telefonoHabitacion: string;
  fechaNacimiento: string;
  estadoCivil: string;
  carnetPatria: string;
  totalAnosApn: string;
  vivienda: DetalleViviendaVM | null;
  salud: DetalleSaludVM | null;
  fisico: DetalleFisicoVM | null;
  formacionAcademica: DetalleFormacionAcademicaVM[];
  formacionComplementaria: DetalleFormacionComplementariaVM[];
  contactoEmergencia: DetalleContactoEmergenciaVM[];
  antecedentes: DetalleAntecedenteVM[];
  contratoActual: DetalleContratoVM | null;
}

export function construirDetalleExpediente(
  empleado: EmpleadoDTO,
  catalogos: CatalogosExpedienteDTO,
): DetalleExpedienteViewModel {
  return {
    cedula: empleado.cedula,
    nombreCompleto: empleado.nombreCompleto,
    sexo: empleado.sexoNombre || SIN_DATO,
    correo: empleado.correo ?? SIN_DATO,
    telefonoMovil: empleado.telefonoMovil ?? SIN_DATO,
    telefonoHabitacion: empleado.telefonoHabitacion ?? SIN_DATO,
    fechaNacimiento: formatearFecha(empleado.fechaNacimiento),
    estadoCivil: empleado.estadoCivilNombre ?? SIN_DATO,
    carnetPatria: empleado.carnetPatria ?? SIN_DATO,
    totalAnosApn: `${empleado.totalAnosApn.toFixed(1)} años`,
    vivienda: empleado.datosVivienda
      ? {
          estado: nombrePorId(catalogos.estados, empleado.datosVivienda.estadoId),
          municipio: nombrePorId(catalogos.municipios, empleado.datosVivienda.municipioId),
          parroquia: nombrePorId(catalogos.parroquias, empleado.datosVivienda.parroquiaId),
          direccionExacta: empleado.datosVivienda.direccionExacta ?? SIN_DATO,
          condicion: nombrePorId(catalogos.condicionesVivienda, empleado.datosVivienda.condicionViviendaId),
          codigoPostal: nombrePorId(catalogos.codigosPostales, empleado.datosVivienda.codigoPostalId),
        }
      : null,
    salud: empleado.perfilSalud
      ? {
          grupoSanguineo: nombrePorId(catalogos.gruposSanguineos, empleado.perfilSalud.grupoSanguineoId),
          alergias: nombresPorIds(catalogos.alergias, empleado.perfilSalud.alergias),
          patologiasCronicas: nombresPorIds(catalogos.patologias, empleado.perfilSalud.patologiasCronicas),
          discapacidades: nombresPorIds(catalogos.discapacidades, empleado.perfilSalud.discapacidades),
        }
      : null,
    fisico: empleado.perfilFisico
      ? {
          tallaCamisa: nombrePorId(catalogos.tallas, empleado.perfilFisico.tallaCamisaId),
          tallaPantalon: nombrePorId(catalogos.tallas, empleado.perfilFisico.tallaPantalonId),
          tallaZapatos: nombrePorId(catalogos.tallas, empleado.perfilFisico.tallaZapatosId),
          tallaChaqueta: nombrePorId(catalogos.tallas, empleado.perfilFisico.tallaChaquetaId),
        }
      : null,
    formacionAcademica: (empleado.formacionAcademica ?? []).map((fa) => ({
      nivelAcademico: nombrePorId(catalogos.nivelesAcademicos, fa.nivelAcademicoId),
      carrera: nombrePorId(catalogos.carreras, fa.carreraId),
      mencion: nombrePorId(catalogos.menciones, fa.mencionId),
      institucion: nombrePorId(catalogos.instituciones, fa.institucionId),
    })),
    formacionComplementaria: (empleado.formacionComplementaria ?? []).map((fc) => ({
      capacitacion: nombrePorId(catalogos.capacitaciones, fc.capacitacionId),
      institucion: nombrePorId(catalogos.instituciones, fc.institucionId),
      fechaInicio: formatearFecha(fc.fechaInicio),
      fechaFin: formatearFecha(fc.fechaFin),
      procedencia: nombrePorId(catalogos.tiposProcedencia, fc.procedenciaId),
      grupo: nombrePorId(catalogos.gruposCapacitacion, fc.grupoId),
      horasCompletadas: fc.horasCompletadas ?? SIN_DATO,
    })),
    contactoEmergencia: (empleado.contactoEmergencia ?? []).map((c) => ({
      nombreCompleto: `${c.nombres ?? ""} ${c.apellidos ?? ""}`.trim() || SIN_DATO,
      telefono: c.telefono ?? SIN_DATO,
      relacion: nombrePorId(undefined, c.relacionId),
    })),
    antecedentes: (empleado.antecedentes ?? []).map((a) => ({
      fechaIngreso: formatearFecha(a.fechaIngreso),
      fechaEgreso: formatearFecha(a.fechaEgreso, "Presente"),
      organismo: nombrePorId(catalogos.organismos, a.organismoId),
    })),
    contratoActual: empleado.contratoActual
      ? {
          nContrato: empleado.contratoActual.nContrato ?? SIN_DATO,
          fechaCulminacion: formatearFecha(empleado.contratoActual.fechaCulminacion, "Indefinido"),
          politica: nombrePorId(catalogos.politicas, empleado.contratoActual.politicaId),
          esFijo: empleado.contratoActual.esFijo ? "Fijo" : "Suplente/Contratado",
        }
      : null,
  };
}
