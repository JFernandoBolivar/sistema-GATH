import { describe, expect, it } from "vitest";
import type { GuardarEmpleadoDatos, RepoPersonal } from "../../domain/ports/repo-personal";
import type { EntradaIdioma, Empleado, IdiomaEmpleado } from "../../domain/entities/empleado";
import {
  actualizarEmpleado,
  actualizarIdiomas,
  actualizarRif,
  actualizarTieneHijos,
  listarIdiomasCatalogo,
  registrarEmpleado,
} from "./gestionar-empleado";
import { listarEmpleados, obtenerEmpleadoPorCedula } from "./listar-empleados";

class RepoPersonalMemoria implements RepoPersonal {
  tieneHijosGuardado: Record<string, boolean | null> = {};
  async actualizarTieneHijos(cedula: string, tieneHijos: boolean | null) {
    this.tieneHijosGuardado[cedula] = tieneHijos;
    return tieneHijos;
  }
  rifGuardado: Record<string, string> = {};
  async actualizarRif(cedula: string, rif: string) {
    this.rifGuardado[cedula] = rif;
    return rif || null;
  }
  idiomasGuardados: Record<string, EntradaIdioma[]> = {};
  async actualizarIdiomas(cedula: string, idiomas: EntradaIdioma[]): Promise<IdiomaEmpleado[]> {
    this.idiomasGuardados[cedula] = idiomas;
    return idiomas.map((i, n) => ({ id: n + 1, idiomaId: i.idiomaId, otroIdioma: i.otroIdioma, nombre: i.otroIdioma || "Inglés", nivel: i.nivel }));
  }
  async listarIdiomas() {
    return [{ id: 1, nombre: "Inglés" }];
  }
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
      carnetPatriaSerial: null,
      totalAnosApn: 4,
      asignaciones: [
        {
          id: 101,
          codigo: "J_0001",
          denominacionCargo: "PERSONAL PASIVO",
          denominacionCargoEspecifico: "PERSONAL PASIVO",
          tipoNomina: "JUBILADO",
          dependencia: "NIVEL DE APOYO",
          direccionGeneral: "OFICINA DE GESTION HUMANA",
          direccionLinea: "N/A",
          coordinacion: "N/A",
          grado: "99",
          estatus: "PASIVO",
          organismoAdscrito: "CONATEL",
          tipoProcedencia: "N/A",
          cargoCubiertoEncargaduria: false,
        },
      ],
      contratos: [
        {
          id: 201,
          nContrato: "CT-2024-001",
          fechaIngreso: "2020-01-01",
          fechaCulminacion: null,
          politicaId: 1,
          politicaNombre: "EMPLEADO",
          estatusId: 1,
          estatusNombre: "ACTIVO",
          esFijo: true,
        },
      ],
    },
  ];

  async listarEmpleados() {
    return {
      items: this.empleados,
      total: this.empleados.length,
      page: 1,
      pageSize: 10,
    };
  }
  async obtenerPorCedula(cedula: string) {
    return this.empleados.find((e) => e.cedula === cedula)!;
  }
  async descargarPdf() {
    return new Blob(["%PDF"], { type: "application/pdf" });
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
      paises: [],
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
}

describe("Casos de uso de Gestión de Personal", () => {
  it("listarEmpleados y obtenerEmpleadoPorCedula retornan datos DTO", async () => {
    const repo = new RepoPersonalMemoria();
    const lista = await listarEmpleados(repo);
    expect(lista.items.length).toBe(1);
    expect(lista.total).toBe(1);
    expect(lista.items[0].cedula).toBe("11223344");

    const emp = await obtenerEmpleadoPorCedula(repo, "11223344");
    expect(emp.nombreCompleto).toBe("Juan Carlos García Mendoza");
    expect(emp.asignaciones).toBeDefined();
    expect(emp.asignaciones?.length).toBe(1);
    expect(emp.asignaciones?.[0].codigo).toBe("J_0001");
    expect(emp.asignaciones?.[0].denominacionCargo).toBe("PERSONAL PASIVO");
    expect(emp.contratos).toBeDefined();
    expect(emp.contratos?.length).toBe(1);
    expect(emp.contratos?.[0].nContrato).toBe("CT-2024-001");
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

  it("actualizarTieneHijos delega en el repositorio y devuelve el valor guardado", async () => {
    const repo = new RepoPersonalMemoria();
    expect(await actualizarTieneHijos(repo, "11223344", true)).toBe(true);
    expect(await actualizarTieneHijos(repo, "11223344", false)).toBe(false);
    expect(repo.tieneHijosGuardado["11223344"]).toBe(false);
  });

  it("actualizarRif y actualizarIdiomas delegan en el repositorio", async () => {
    const repo = new RepoPersonalMemoria();
    expect(await actualizarRif(repo, "11223344", "V-12345678-9")).toBe("V-12345678-9");
    expect(await actualizarRif(repo, "11223344", "")).toBeNull();
    const guardados = await actualizarIdiomas(repo, "11223344", [{ idiomaId: 1, otroIdioma: "", nivel: "BIEN" }]);
    expect(guardados).toHaveLength(1);
    expect(repo.idiomasGuardados["11223344"][0].nivel).toBe("BIEN");
    expect(await listarIdiomasCatalogo(repo)).toEqual([{ id: 1, nombre: "Inglés" }]);
  });

  it("el detalle conserva el RIF y los idiomas del backend", async () => {
    const repo = new RepoPersonalMemoria();
    repo.empleados[0] = { ...repo.empleados[0], rif: "V-12345678-9", idiomas: [{ id: 1, idiomaId: 2, otroIdioma: "", nombre: "Francés", nivel: "POCO" }] };
    const emp = await obtenerEmpleadoPorCedula(repo, "11223344");
    expect(emp.rif).toBe("V-12345678-9");
    expect(emp.idiomas).toEqual([{ id: 1, idiomaId: 2, otroIdioma: "", nombre: "Francés", nivel: "POCO" }]);
    expect((await listarEmpleados(repo)).items[0].idiomas).toEqual(emp.idiomas);
  });
});
