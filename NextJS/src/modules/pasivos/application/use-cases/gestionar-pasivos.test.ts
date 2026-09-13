import { describe, expect, it } from "vitest";
import type { RepoPasivos } from "../../domain/ports/repo-pasivos";
import type { Pasivo } from "../../domain/entities/pasivo";
import { listarPasivos, obtenerPasivoPorCedula, procesarEgreso } from "./gestionar-pasivos";

class RepoPasivosMemoria implements RepoPasivos {
  pasivos: Pasivo[] = [
    {
      id: 1,
      cedula: "12345678",
      nombres: "JUAN",
      apellidos: "PEREZ",
      nombreCompleto: "JUAN PEREZ",
      tipoPasivo: "JUBILADO",
      fechaEgreso: "2026-01-01",
      resolucion: "CONTRATO-1",
      observaciones: null,
      datosVivienda: null,
      perfilSalud: null,
      perfilFisico: null,
      formacionAcademica: [],
      contactoEmergencia: [],
      antecedentes: [],
      contratoActual: null,
      cargosHistorial: [],
    },
  ];

  async listarPasivos(busqueda?: string) {
    if (!busqueda) return this.pasivos;
    return this.pasivos.filter((p) =>
      `${p.cedula} ${p.nombres} ${p.apellidos}`.toLowerCase().includes(busqueda.toLowerCase()),
    );
  }

  async listarMotivosEgreso() {
    return [{ id: 1, nombre: "Jubilación" }];
  }

  async listarTiposNomina() {
    return [{ id: 1, nombre: "Nómina fija" }];
  }

  async listarCatalogosExpediente() {
    return {
      estados: [],
      municipios: [],
      parroquias: [],
      condicionesVivienda: [],
      codigosPostales: [],
      gruposSanguineos: [],
      alergias: [],
      patologias: [],
      discapacidades: [],
      tallas: [],
      nivelesAcademicos: [],
      carreras: [],
      menciones: [],
      instituciones: [],
      politicas: [],
    };
  }

  async obtenerPorCedula(cedula: string) {
    const p = this.pasivos.find((x) => x.cedula === cedula);
    if (!p) throw new Error("No encontrado");
    return p;
  }

  async procesarEgreso(cedula: string, input: { cedula: string; motivoMovimientoId: number; tipoNominaId: number; liberarActivos: boolean }) {
    const nuevo: Pasivo = {
      id: 2,
      cedula,
      nombres: "MARIA",
      apellidos: "GOMEZ",
      nombreCompleto: "MARIA GOMEZ",
      tipoPasivo: "PASIVO",
      fechaEgreso: "2026-08-29",
      resolucion: "ASIG-000002",
      observaciones: null,
      datosVivienda: null,
      perfilSalud: null,
      perfilFisico: null,
      formacionAcademica: [],
      contactoEmergencia: [],
      antecedentes: [],
      contratoActual: null,
      cargosHistorial: [],
    };
    this.pasivos.push(nuevo);
    return nuevo;
  }
}

describe("Casos de uso de Pasivos", () => {
  it("listarPasivos mapea todos los campos a DTO", async () => {
    const repo = new RepoPasivosMemoria();
    const dtos = await listarPasivos(repo);
    expect(dtos.length).toBe(1);
    const dto = dtos[0];
    expect(dto.id).toBe(1);
    expect(dto.cedula).toBe("12345678");
    expect(dto.nombres).toBe("JUAN");
    expect(dto.apellidos).toBe("PEREZ");
    expect(dto.nombreCompleto).toBe("JUAN PEREZ");
    expect(dto.tipoPasivo).toBe("JUBILADO");
    expect(dto.fechaEgreso).toBe("2026-01-01");
    expect(dto.resolucion).toBe("CONTRATO-1");
  });

  it("listarPasivos filtra por búsqueda", async () => {
    const repo = new RepoPasivosMemoria();
    const dtos = await listarPasivos(repo, "juan");
    expect(dtos.length).toBe(1);
  });

  it("obtenerPasivoPorCedula retorna el pasivo", async () => {
    const repo = new RepoPasivosMemoria();
    const dto = await obtenerPasivoPorCedula(repo, "12345678");
    expect(dto.cedula).toBe("12345678");
  });

  it("procesarEgreso crea el pasivo", async () => {
    const repo = new RepoPasivosMemoria();
    const dto = await procesarEgreso(repo, {
      cedula: "87654321",
      motivoMovimientoId: 1,
      tipoNominaId: 2,
      liberarActivos: true,
    });
    expect(dto.cedula).toBe("87654321");
    expect(dto.tipoPasivo).toBe("PASIVO");
  });
});
