import { describe, expect, it } from "vitest";
import type { RepoReportes } from "../../domain/ports/repo-reportes";
import {
  generarReportePasivos,
  generarReportePersonal,
  generarReporteVacantes,
} from "./generar-reportes";

class RepoReportesMemoria implements RepoReportes {
  async generarReportePersonal() {
    return [
      {
        cedula: "12345678",
        nombreCompleto: "Pedro Pérez",
        dependencia: "Tecnología",
        cargo: "ANALISTA I",
        tipoPersonal: "EMPLEADO FIJO",
        fechaIngreso: "2020-01-01",
        totalAnosApn: 4,
      },
    ];
  }

  async generarReportePasivos() {
    return [
      {
        cedula: "87654321",
        nombreCompleto: "Rosa Gómez",
        tipoPersonal: "JUBILADO",
        fechaEgreso: "2025-12-31",
        motivoEgreso: "Jubilación",
      },
    ];
  }

  async generarReporteVacantes() {
    return [
      {
        id: 1,
        codigoNomina: "VAC-001",
        denominacionCargo: "ESPECIALISTA",
        dependencia: "RRHH",
        direccionGeneral: "Planificación",
      },
    ];
  }

  async descargarPdf(tipo: "personal-activo" | "personal-pasivo" | "vacantes") {
    return new Blob([`pdf-${tipo}`], { type: "application/pdf" });
  }

  async descargarExcel(tipo: "personal-activo" | "personal-pasivo" | "vacantes") {
    return new Blob([`excel-${tipo}`], { type: "application/vnd.ms-excel" });
  }
}

describe("Casos de uso de Reportes", () => {
  const repo = new RepoReportesMemoria();

  it("generarReportePersonal retorna DTOs de personal activo", async () => {
    const res = await generarReportePersonal(repo);
    expect(res.length).toBe(1);
    expect(res[0].cedula).toBe("12345678");
  });

  it("generarReportePasivos retorna DTOs de jubilados y egresos", async () => {
    const res = await generarReportePasivos(repo);
    expect(res.length).toBe(1);
    expect(res[0].motivoEgreso).toBe("Jubilación");
  });

  it("generarReporteVacantes retorna listado de cargos disponibles", async () => {
    const res = await generarReporteVacantes(repo);
    expect(res.length).toBe(1);
    expect(res[0].codigoNomina).toBe("VAC-001");
  });
});
