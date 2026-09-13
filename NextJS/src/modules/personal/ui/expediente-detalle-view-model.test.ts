import { describe, expect, it } from "vitest";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../application/dtos/empleado-dto";
import { construirDetalleExpediente } from "./expediente-detalle-view-model";

function catalogosVacios(): CatalogosExpedienteDTO {
  return {
    estados: [],
    municipios: [],
    parroquias: [],
    condicionesVivienda: [],
    codigosPostales: [],
    gruposSanguineos: [],
    nivelesAcademicos: [],
    carreras: [],
    menciones: [],
    instituciones: [],
    capacitaciones: [],
    gruposCapacitacion: [],
    tiposProcedencia: [],
    tiposPrenda: [],
    tallas: [],
    politicas: [],
    alergias: [],
    patologias: [],
    discapacidades: [],
  };
}

function empleadoBase(): EmpleadoDTO {
  return {
    id: 1,
    cedula: "12345678",
    nombres: "Juan",
    apellidos: "Pérez",
    nombreCompleto: "Juan Pérez",
    sexoId: 2,
    sexoNombre: "MASCULINO",
    correo: "juan@example.com",
    telefonoMovil: "04121234567",
    telefonoHabitacion: null,
    fechaNacimiento: "1990-05-10",
    estadoCivilId: 1,
    estadoCivilNombre: "SOLTERO",
    carnetPatria: null,
    totalAnosApn: 4.5,
    datosVivienda: null,
    perfilSalud: null,
    perfilFisico: null,
    formacionAcademica: [],
    formacionComplementaria: [],
    contactoEmergencia: [],
    antecedentes: [],
    contratoActual: null,
  };
}

describe("construirDetalleExpediente", () => {
  it("resuelve catálogos a nombres cuando el expediente trae IDs conocidos", () => {
    const catalogos: CatalogosExpedienteDTO = {
      ...catalogosVacios(),
      gruposSanguineos: [{ id: 3, nombre: "O+" }],
      alergias: [{ id: 5, nombre: "Penicilina" }],
    };
    const empleado: EmpleadoDTO = {
      ...empleadoBase(),
      perfilSalud: { grupoSanguineoId: 3, alergias: [5], patologiasCronicas: [], discapacidades: [] },
    };

    const vm = construirDetalleExpediente(empleado, catalogos);

    expect(vm.salud?.grupoSanguineo).toBe("O+");
    expect(vm.salud?.alergias).toEqual(["Penicilina"]);
  });

  it("cae a 'ID <n>' cuando el catálogo no contiene el id referenciado", () => {
    const empleado: EmpleadoDTO = {
      ...empleadoBase(),
      perfilSalud: { grupoSanguineoId: 99, alergias: [], patologiasCronicas: [], discapacidades: [] },
    };

    const vm = construirDetalleExpediente(empleado, catalogosVacios());

    expect(vm.salud?.grupoSanguineo).toBe("ID 99");
  });

  it("formatea fechas a dd/MM/yyyy y usa el valor de reemplazo cuando falta", () => {
    const empleado: EmpleadoDTO = {
      ...empleadoBase(),
      antecedentes: [{ organismoId: 7, fechaIngreso: "2020-01-15", fechaEgreso: null }],
    };

    const vm = construirDetalleExpediente(empleado, catalogosVacios());

    expect(vm.antecedentes[0].fechaIngreso).toBe("15/01/2020");
    expect(vm.antecedentes[0].fechaEgreso).toBe("Presente");
    expect(vm.antecedentes[0].organismo).toBe("ID 7");
  });

  it("da valores 'N/A' cuando las secciones anidadas vienen nulas", () => {
    const vm = construirDetalleExpediente(empleadoBase(), catalogosVacios());

    expect(vm.vivienda).toBeNull();
    expect(vm.salud).toBeNull();
    expect(vm.fisico).toBeNull();
    expect(vm.contratoActual).toBeNull();
    expect(vm.correo).toBe("juan@example.com");
    expect(vm.telefonoHabitacion).toBe("N/A");
  });

  it("formatea el total de años APN con un decimal", () => {
    const vm = construirDetalleExpediente(empleadoBase(), catalogosVacios());
    expect(vm.totalAnosApn).toBe("4.5 años");
  });
});
