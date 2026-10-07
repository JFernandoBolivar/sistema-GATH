/**
 * Resuelve los IDs de catálogo del expediente de un empleado a nombres
 * legibles. Función pura (sin React), usada por la vista de detalle
 * (`empleado-detalle-sheet.tsx`) -- la exportación a PDF ahora se genera en
 * backend (`apps.personal.infrastructure.pdf_empleado`, que replica esta
 * misma lógica de formato en Python) y ya no la consume (regla R3: ui/ no
 * reimplementa lógica de negocio, pero sí puede tener helpers de
 * presentación puros — mismo patrón que `modules/reportes/ui/tendencia-chart-data.ts`).
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

export interface DetalleItemSaludVM {
  id: number;
  nombre: string;
  categoria: string;
}

export interface DetalleSaludVM {
  grupoSanguineo: string;
  alergias: DetalleItemSaludVM[];
  patologiasCronicas: DetalleItemSaludVM[];
  discapacidades: DetalleItemSaludVM[];
}

export interface DetalleEncargaduriaVM {
  id: number;
  cargoEncargado: string;
  titular: string;
  fechaInicio: string;
  fechaFin: string;
  estatus: string;
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

export interface DetalleCargoAsignadoVM {
  id: number;
  codigo: string;
  cargo: string;
  cargoEspecifico: string;
  tipoNomina: string;
  dependencia: string;
  direccionGeneral: string;
  direccionLinea: string;
  coordinacion: string;
  grado: string;
  estatus: string;
  organismoAdscrito: string;
  tipoProcedencia: string;
  cargoCubiertoEncargaduria: boolean;
  direccionResumida: string;
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
  fechaIngresoOrganismo: string;
  cargosAsignados: DetalleCargoAsignadoVM[];
  vivienda: DetalleViviendaVM | null;
  salud: DetalleSaludVM | null;
  fisico: DetalleFisicoVM | null;
  formacionAcademica: DetalleFormacionAcademicaVM[];
  formacionComplementaria: DetalleFormacionComplementariaVM[];
  contactoEmergencia: DetalleContactoEmergenciaVM[];
  antecedentes: DetalleAntecedenteVM[];
  contratoActual: DetalleContratoVM | null;
  encargadurias: DetalleEncargaduriaVM[];
}

function itemsSaludPorIds(
  catalogo: CatalogosExpedienteDTO["alergias"] | undefined,
  ids: number[] | undefined,
): DetalleItemSaludVM[] {
  if (!ids || ids.length === 0) return [];
  const map = new Map((catalogo ?? []).map((c) => [c.id, c]));
  return ids.map((id) => {
    const c = map.get(id);
    return {
      id,
      nombre: c?.nombre ?? `ID ${id}`,
      categoria: c?.categoriaNombre || "General",
    };
  });
}

export function construirDetalleExpediente(
  empleado: EmpleadoDTO,
  catalogos: CatalogosExpedienteDTO,
): DetalleExpedienteViewModel {
  const anosApn = empleado.totalAnosApn ?? 0;
  const anos = Math.floor(anosApn);
  const meses = Math.round((anosApn % 1) * 12);

  const todosContratos = empleado.contratos && empleado.contratos.length > 0
    ? empleado.contratos
    : empleado.contratoActual
    ? [empleado.contratoActual]
    : [];
  const contratosConFecha = todosContratos
    .filter((c) => c.fechaIngreso)
    .sort((a, b) => new Date(a.fechaIngreso!).getTime() - new Date(b.fechaIngreso!).getTime());
  const fechaIngresoOrg = contratosConFecha[0]?.fechaIngreso
    ? formatearFecha(contratosConFecha[0].fechaIngreso)
    : SIN_DATO;

  return {
    cedula: empleado.nacionalidadCodigo ? `${empleado.nacionalidadCodigo}-${empleado.cedula}` : empleado.cedula,
    nombreCompleto: empleado.nombreCompleto,
    sexo: empleado.sexoNombre || SIN_DATO,
    correo: empleado.correo ?? SIN_DATO,
    telefonoMovil: empleado.telefonoMovil ?? SIN_DATO,
    telefonoHabitacion: empleado.telefonoHabitacion ?? SIN_DATO,
    fechaNacimiento: formatearFecha(empleado.fechaNacimiento),
    estadoCivil: empleado.estadoCivilNombre ?? SIN_DATO,
    carnetPatria: empleado.carnetPatria ?? SIN_DATO,
    totalAnosApn: `${anos} años, ${meses} meses, 0 días`,
    fechaIngresoOrganismo: fechaIngresoOrg,
    cargosAsignados: (empleado.asignaciones ?? []).map((asig) => ({
      id: asig.id,
      codigo: asig.codigo || SIN_DATO,
      cargo: asig.denominacionCargo || SIN_DATO,
      cargoEspecifico: asig.denominacionCargoEspecifico || SIN_DATO,
      tipoNomina: asig.tipoNomina || SIN_DATO,
      dependencia: asig.dependencia || SIN_DATO,
      direccionGeneral: asig.direccionGeneral || SIN_DATO,
      direccionLinea: asig.direccionLinea || SIN_DATO,
      coordinacion: asig.coordinacion || SIN_DATO,
      grado: asig.grado || SIN_DATO,
      estatus: asig.estatus || SIN_DATO,
      organismoAdscrito: asig.organismoAdscrito || SIN_DATO,
      tipoProcedencia: asig.tipoProcedencia || SIN_DATO,
      cargoCubiertoEncargaduria: asig.cargoCubiertoEncargaduria,
      direccionResumida:
        asig.coordinacion ||
        asig.direccionLinea ||
        asig.direccionGeneral ||
        "No especificado",
    })),
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
          alergias: itemsSaludPorIds(catalogos.alergias, empleado.perfilSalud.alergias),
          patologiasCronicas: itemsSaludPorIds(catalogos.patologias, empleado.perfilSalud.patologiasCronicas),
          discapacidades: itemsSaludPorIds(catalogos.discapacidades, empleado.perfilSalud.discapacidades),
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
      relacion: nombrePorId(catalogos.parentescos, c.relacionId),
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
    encargadurias: (empleado.encargadurias ?? []).map((enc) => {
      const cargoEsp = enc.cargoInfo?.denominacioncargoespecifico?.cargo;
      const cargoGen = enc.cargoInfo?.denominacioncargo?.cargo;
      const cargo = cargoEsp || cargoGen || enc.cargoEncargado || SIN_DATO;
      const titularNombre = enc.empleadoNombre || enc.titularNombre || "";
      const titularCedula = enc.empleadoCedula || enc.titularCedula || SIN_DATO;
      const titular = titularNombre ? `${titularNombre} (${titularCedula})` : titularCedula;
      return {
        id: enc.id,
        cargoEncargado: cargo,
        titular: titular || SIN_DATO,
        fechaInicio: formatearFecha(enc.fechaInicio),
        fechaFin: formatearFecha(enc.fechaFin, "Presente"),
        estatus: enc.estatusNombre || "ACTIVO",
      };
    }),
  };
}
