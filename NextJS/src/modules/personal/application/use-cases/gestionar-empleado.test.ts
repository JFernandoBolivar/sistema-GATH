import { describe, expect, it } from "vitest";
import type { GuardarEmpleadoDatos, RepoPersonal } from "../../domain/ports/repo-personal";
import type { Empleado } from "../../domain/entities/empleado";
import { actualizarEmpleado, registrarEmpleado } from "./gestionar-empleado";
import { listarEmpleados, obtenerEmpleadoPorCedula } from "./listar-empleados";

class RepoPersonalMemoria implements RepoPersonal {
  empleados: Empleado[] = [
    {
      id: 1,
      cedula: "11223344",
      nombres: "Juan Carlos",
      apellidos: "García Mendoza",
      nombreCompleto: "Juan Carlos García Mendoza",
      sexoId: 1,
      sexoNombre: "MASCULINO",
      correo: "juan.garcia@organismo.gob.ve",
      telefonoMovil: "04121112233",
      telefonoHabitacion: null,
      fechaNacimiento: "1990-05-10",
      estadoCivilId: 1,
      estadoCivilNombre: "SOLTERO",
      carnetPatria: null,
      totalAnosApn: 4,
    },
  ];

  async listarEmpleados() {
    return this.empleados;
  }
  async obtenerPorCedula(cedula: string) {
    return this.empleados.find((e) => e.cedula === cedula)!;
  }
  async crearEmpleado(data: GuardarEmpleadoDatos) {
    const { contrato: _contrato, ...rest } = data;
    const e: Empleado = {
      id: 2,
      ...rest,
      nombreCompleto: `${data.nombres} ${data.apellidos}`,
      sexoNombre: "MASCULINO",
      estadoCivilNombre: "SOLTERO",
      totalAnosApn: 0,
    } as Empleado;
    this.empleados.push(e);
    return e;
  }
  async actualizarEmpleado(cedula: string, data: Partial<GuardarEmpleadoDatos>) {
    const e = this.empleados.find((x) => x.cedula === cedula)!;
    Object.assign(e, data);
    return e;
  }
  async listarCatalogosExpediente() {
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
}

describe("Casos de uso de Gestión de Personal", () => {
  it("listarEmpleados y obtenerEmpleadoPorCedula retornan datos DTO", async () => {
    const repo = new RepoPersonalMemoria();
    const lista = await listarEmpleados(repo);
    expect(lista.length).toBe(1);
    expect(lista[0].cedula).toBe("11223344");

    const emp = await obtenerEmpleadoPorCedula(repo, "11223344");
    expect(emp.nombreCompleto).toBe("Juan Carlos García Mendoza");
  });

  it("registrarEmpleado y actualizarEmpleado funcionan correctamente", async () => {
    const repo = new RepoPersonalMemoria();
    const nuevo = await registrarEmpleado(repo, {
      cedula: "99887766",
      nombres: "Ana",
      apellidos: "López",
      sexoId: 2,
      fechaNacimiento: "1995-03-01",
    });
    expect(nuevo.cedula).toBe("99887766");
    expect(nuevo.nombreCompleto).toBe("Ana López");

    const actualizado = await actualizarEmpleado(repo, "99887766", { telefonoMovil: "04141234567" });
    expect(actualizado.telefonoMovil).toBe("04141234567");
  });
});
