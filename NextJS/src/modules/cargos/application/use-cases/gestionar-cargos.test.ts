import { describe, expect, it } from "vitest";
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import type { CargoAsignacion, DenominacionCargo } from "../../domain/entities/cargo";
import { asignarCargo, desasignarCargo } from "./asignar-cargo";
import { listarCargos, listarDenominaciones } from "./listar-cargos";

class RepoCargosMemoria implements RepoCargos {
  cargos: CargoAsignacion[] = [
    {
      id: 1,
      codigoNomina: "COD-001",
      empleadoCedula: null,
      empleadoNombre: null,
      denominacionCargoId: 10,
      denominacionCargoNombre: "ANALISTA I",
      dependenciaId: 1,
      dependenciaNombre: "Tecnología",
      direccionGeneralId: 100,
      direccionGeneralNombre: "Dirección de TI",
      activo: true,
      estaVacante: true,
    },
  ];

  async listarCargos() {
    return this.cargos;
  }
  async listarDenominaciones(): Promise<DenominacionCargo[]> {
    return [{ id: 10, nombre: "ANALISTA I" }];
  }
  async asignarCargo(cargoId: number, empleadoCedula: string) {
    const c = this.cargos.find((x) => x.id === cargoId)!;
    c.empleadoCedula = empleadoCedula;
    c.empleadoNombre = "Trabajador Asignado";
    c.estaVacante = false;
    return c;
  }
  async desasignarCargo(cargoId: number) {
    const c = this.cargos.find((x) => x.id === cargoId)!;
    c.empleadoCedula = null;
    c.empleadoNombre = null;
    c.estaVacante = true;
    return c;
  }
}

describe("Casos de uso de Cargos", () => {
  it("listarCargos y listarDenominaciones retornan listas", async () => {
    const repo = new RepoCargosMemoria();
    const cargos = await listarCargos(repo);
    expect(cargos.length).toBe(1);
    expect(cargos[0].estaVacante).toBe(true);

    const denoms = await listarDenominaciones(repo);
    expect(denoms[0].nombre).toBe("ANALISTA I");
  });

  it("asignarCargo y desasignarCargo modifican la asignación", async () => {
    const repo = new RepoCargosMemoria();
    const asignado = await asignarCargo(repo, 1, "12345678");
    expect(asignado.empleadoCedula).toBe("12345678");
    expect(asignado.estaVacante).toBe(false);

    const desasignado = await desasignarCargo(repo, 1);
    expect(desasignado.empleadoCedula).toBeNull();
    expect(desasignado.estaVacante).toBe(true);
  });
});
