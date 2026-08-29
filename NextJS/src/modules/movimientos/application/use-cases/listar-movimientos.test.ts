import { describe, expect, it } from "vitest";
import type { RepoMovimientos } from "../../domain/ports/repo-movimientos";
import type { MovimientoCargo } from "../../domain/entities/movimiento";
import {
  listarHistorialPorCargo,
  listarHistorialPorEmpleado,
} from "./listar-movimientos";

class RepoMovimientosMemoria implements RepoMovimientos {
  movimientos: MovimientoCargo[] = [
    {
      id: 1,
      empleadoCedula: "12345678",
      codigoPuesto: "0-00-000000-00",
      tipoMovimiento: "Ascenso",
      motivoId: 1,
      motivoNombre: "Ascenso merecido",
      denominacionNombre: "ANALISTA I",
      especificaNombre: "Analista de Sistemas",
      gradoNombre: "Grado 12",
      tipoNominaNombre: "Sueldo",
      estatusNombre: "Activo",
      tipoPersonalNombre: "Empleado",
      dependenciaNombre: "Tecnología",
      direccionGeneralNombre: "Dirección de TI",
      direccionLineaNombre: "Línea 1",
      coordinacionNombre: "Coordinación de Sistemas",
      fechaMovimiento: "2026-01-15",
      ejecutadoPorId: 10,
      ejecutadoPorNombre: "Rosa Peña",
    },
    {
      id: 2,
      empleadoCedula: "87654321",
      codigoPuesto: "1-03-123456-00",
      tipoMovimiento: "Transferencia",
      motivoId: null,
      motivoNombre: null,
      denominacionNombre: "SOPORTE II",
      especificaNombre: "Soporte Técnico",
      gradoNombre: null,
      tipoNominaNombre: "Sueldo",
      estatusNombre: "Activo",
      tipoPersonalNombre: null,
      dependenciaNombre: null,
      direccionGeneralNombre: null,
      direccionLineaNombre: null,
      coordinacionNombre: null,
      fechaMovimiento: "2026-02-20",
      ejecutadoPorId: 11,
      ejecutadoPorNombre: "Carlos Guzmán",
    },
  ];

  async listarHistorialPorEmpleado(cedula: string) {
    return this.movimientos.filter((m) => m.empleadoCedula === cedula);
  }

  async listarHistorialPorCargo(codigoPuesto: string) {
    return this.movimientos.filter((m) => m.codigoPuesto === codigoPuesto);
  }
}

describe("Casos de uso de Historiamiento de Movimientos", () => {
  it("listarHistorialPorEmpleado mapea todos los campos a DTO", async () => {
    const repo = new RepoMovimientosMemoria();
    const dtos = await listarHistorialPorEmpleado(repo, "12345678");
    expect(dtos.length).toBe(1);

    const dto = dtos[0];
    expect(dto.id).toBe(1);
    expect(dto.empleadoCedula).toBe("12345678");
    expect(dto.codigoPuesto).toBe("0-00-000000-00");
    expect(dto.tipoMovimiento).toBe("Ascenso");
    expect(dto.motivoId).toBe(1);
    expect(dto.motivoNombre).toBe("Ascenso merecido");
    expect(dto.denominacionNombre).toBe("ANALISTA I");
    expect(dto.especificaNombre).toBe("Analista de Sistemas");
    expect(dto.gradoNombre).toBe("Grado 12");
    expect(dto.tipoNominaNombre).toBe("Sueldo");
    expect(dto.estatusNombre).toBe("Activo");
    expect(dto.tipoPersonalNombre).toBe("Empleado");
    expect(dto.dependenciaNombre).toBe("Tecnología");
    expect(dto.direccionGeneralNombre).toBe("Dirección de TI");
    expect(dto.direccionLineaNombre).toBe("Línea 1");
    expect(dto.coordinacionNombre).toBe("Coordinación de Sistemas");
    expect(dto.fechaMovimiento).toBe("2026-01-15");
    expect(dto.ejecutadoPorId).toBe(10);
    expect(dto.ejecutadoPorNombre).toBe("Rosa Peña");
  });

  it("listarHistorialPorEmpleado conserva campos nullable", async () => {
    const repo = new RepoMovimientosMemoria();
    const dtos = await listarHistorialPorEmpleado(repo, "87654321");
    expect(dtos.length).toBe(1);
    expect(dtos[0].motivoId).toBeNull();
    expect(dtos[0].motivoNombre).toBeNull();
    expect(dtos[0].gradoNombre).toBeNull();
    expect(dtos[0].tipoPersonalNombre).toBeNull();
    expect(dtos[0].dependenciaNombre).toBeNull();
    expect(dtos[0].direccionGeneralNombre).toBeNull();
    expect(dtos[0].direccionLineaNombre).toBeNull();
    expect(dtos[0].coordinacionNombre).toBeNull();
  });

  it("listarHistorialPorCargo retorna los movimientos del puesto", async () => {
    const repo = new RepoMovimientosMemoria();
    const dtos = await listarHistorialPorCargo(repo, "1-03-123456-00");
    expect(dtos.length).toBe(1);
    expect(dtos[0].empleadoCedula).toBe("87654321");
    expect(dtos[0].tipoMovimiento).toBe("Transferencia");
  });

  it("retorna lista vacía cuando no hay coincidencias", async () => {
    const repo = new RepoMovimientosMemoria();
    const porEmpleado = await listarHistorialPorEmpleado(repo, "00000000");
    const porCargo = await listarHistorialPorCargo(repo, "9-99-999999-99");
    expect(porEmpleado).toEqual([]);
    expect(porCargo).toEqual([]);
  });
});
