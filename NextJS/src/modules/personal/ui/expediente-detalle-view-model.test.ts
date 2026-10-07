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
    sexos: [],
    estadosCiviles: [],
    organismos: [],
    nacionalidades: [],
    parentescos: [],
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
      alergias: [{ id: 5, nombre: "Penicilina", categoriaNombre: "Medicamentos" }],
    };
    const empleado: EmpleadoDTO = {
      ...empleadoBase(),
      perfilSalud: { grupoSanguineoId: 3, alergias: [5], patologiasCronicas: [], discapacidades: [] },
    };

    const vm = construirDetalleExpediente(empleado, catalogos);

    expect(vm.salud?.grupoSanguineo).toBe("O+");
    expect(vm.salud?.alergias).toEqual([
      { id: 5, nombre: "Penicilina", categoria: "Medicamentos" },
    ]);
  });

  it("antepone la letra de nacionalidad a la cédula cuando viene del backend", () => {
    expect(construirDetalleExpediente({ ...empleadoBase(), nacionalidadCodigo: "E" }, catalogosVacios()).cedula).toBe("E-12345678");
    expect(construirDetalleExpediente(empleadoBase(), catalogosVacios()).cedula).toBe("12345678");
  });

  it("resuelve el parentesco del contacto de emergencia con el catálogo", () => {
    const vm = construirDetalleExpediente(
      { ...empleadoBase(), contactoEmergencia: [{ nombres: "Ana", apellidos: "Ruiz", telefono: "04121234567", relacionId: 7 }] },
      { ...catalogosVacios(), parentescos: [{ id: 7, nombre: "MADRE" }] },
    );
    expect(vm.contactoEmergencia).toEqual([{ nombreCompleto: "Ana Ruiz", telefono: "04121234567", relacion: "MADRE" }]);
  });

  it("cae a 'ID <n>' cuando el catálogo no contiene el id referenciado", () => {
    const empleado: EmpleadoDTO = {
      ...empleadoBase(),
      perfilSalud: {
        grupoSanguineoId: 99,
        alergias: [88],
        patologiasCronicas: [77],
        discapacidades: [66],
      },
    };

    const vm = construirDetalleExpediente(empleado, catalogosVacios());

    expect(vm.salud?.grupoSanguineo).toBe("ID 99");
    expect(vm.salud?.alergias).toEqual([{ id: 88, nombre: "ID 88", categoria: "General" }]);
    expect(vm.salud?.patologiasCronicas).toEqual([{ id: 77, nombre: "ID 77", categoria: "General" }]);
    expect(vm.salud?.discapacidades).toEqual([{ id: 66, nombre: "ID 66", categoria: "General" }]);
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

  it("formatea el total de años APN al formato normalizado años, meses, días", () => {
    const vm = construirDetalleExpediente(empleadoBase(), catalogosVacios());
    expect(vm.totalAnosApn).toBe("4 años, 6 meses, 0 días");
  });

  it("mapea cargos asignados y calcula fecha de ingreso de organismo", () => {
    const empleado: EmpleadoDTO = {
      ...empleadoBase(),
      contratos: [
        { id: 1, nContrato: "CTR-01", fechaIngreso: "2018-03-01", fechaCulminacion: "2019-03-01" },
        { id: 2, nContrato: "CTR-02", fechaIngreso: "2015-01-10", fechaCulminacion: null },
      ],
      asignaciones: [
        {
          id: 10,
          codigo: "CARGO-001",
          denominacionCargo: "ESPECIALISTA",
          denominacionCargoEspecifico: "ESPECIALISTA EN TELECOM",
          tipoNomina: "EMPLEADO FIJO",
          dependencia: "GERENCIA",
          direccionGeneral: "DG TECNOLOGÍA",
          direccionLinea: "DL REDES",
          coordinacion: "COORD SOPORTE",
          grado: "9",
          estatus: "ACTIVO",
          organismoAdscrito: "CONATEL",
          tipoProcedencia: "INTERNA",
          cargoCubiertoEncargaduria: false,
        },
      ],
    };

    const vm = construirDetalleExpediente(empleado, catalogosVacios());

    expect(vm.fechaIngresoOrganismo).toBe("10/01/2015");
    expect(vm.cargosAsignados).toHaveLength(1);
    expect(vm.cargosAsignados[0].codigo).toBe("CARGO-001");
    expect(vm.cargosAsignados[0].cargoEspecifico).toBe("ESPECIALISTA EN TELECOM");
    expect(vm.cargosAsignados[0].direccionResumida).toBe("COORD SOPORTE");
  });

  it("mapea encargadurias con cargo, titular y fechas formateadas", () => {
    const empleado: EmpleadoDTO = {
      ...empleadoBase(),
      encargadurias: [
        {
          id: 12,
          cargoEncargado: "GERENTE DE INFORMATICA",
          empleadoNombre: "Pedro Pérez",
          empleadoCedula: "11223344",
          fechaInicio: "2024-01-01",
          fechaFin: null,
          estatusNombre: "ACTIVO",
        },
      ],
    };

    const vm = construirDetalleExpediente(empleado, catalogosVacios());

    expect(vm.encargadurias).toHaveLength(1);
    expect(vm.encargadurias[0].cargoEncargado).toBe("GERENTE DE INFORMATICA");
    expect(vm.encargadurias[0].titular).toBe("Pedro Pérez (11223344)");
    expect(vm.encargadurias[0].fechaInicio).toBe("01/01/2024");
    expect(vm.encargadurias[0].fechaFin).toBe("Presente");
    expect(vm.encargadurias[0].estatus).toBe("ACTIVO");
  });
});
