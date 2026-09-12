import { describe, expect, it } from "vitest";
import type { RepoReportes } from "../../domain/ports/repo-reportes";
import type { TipoReportePersonalVO } from "../../domain/value-objects/tipo-reporte-vo";
import {
  generarReporteCodigos,
  generarReporteFamiliares,
  generarReportePasivos,
  generarReportePersonal,
  generarReporteVacantes,
  obtenerTendenciasPersonal,
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

  async generarReporteFamiliares() {
    return [
      {
        cedulaFamiliar: "99999999",
        nombres: "Ana",
        apellidos: "Pérez",
        parentesco: "HIJO(A)",
        sexo: "FEMENINO",
        fechaNacimiento: "2015-05-20",
        cedulaEmpleado: "12345678",
      },
    ];
  }

  async generarReporteCodigos() {
    return [
      {
        codigo: "COD-001",
        cargo: "ANALISTA I",
        cargoEspecifico: "ANALISTA I",
        tipoNomina: "FIJO",
        dependencia: "RRHH",
        direccionGeneral: "Planificación",
        estatus: "ACTIVO",
      },
    ];
  }

  async obtenerTendenciasPersonal() {
    return [{ periodo: "2026-08", ingresos: 3, egresos: 1 }];
  }

  async descargarPdf(tipo: TipoReportePersonalVO) {
    return new Blob([`pdf-${tipo}`], { type: "application/pdf" });
  }

  async descargarExcel(tipo: TipoReportePersonalVO) {
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

  it("generarReporteFamiliares retorna DTOs de cargas familiares", async () => {
    const res = await generarReporteFamiliares(repo);
    expect(res.length).toBe(1);
    expect(res[0].parentesco).toBe("HIJO(A)");
  });

  it("generarReporteCodigos retorna DTOs de códigos de cargo", async () => {
    const res = await generarReporteCodigos(repo);
    expect(res.length).toBe(1);
    expect(res[0].codigo).toBe("COD-001");
  });

  it("obtenerTendenciasPersonal retorna la serie mensual de ingresos/egresos", async () => {
    const res = await obtenerTendenciasPersonal(repo);
    expect(res.length).toBe(1);
    expect(res[0].periodo).toBe("2026-08");
    expect(res[0].ingresos).toBe(3);
    expect(res[0].egresos).toBe(1);
  });
});
