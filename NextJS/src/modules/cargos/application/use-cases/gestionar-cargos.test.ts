import { describe, expect, it } from "vitest";
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import {
  CatalogoCargoItem,
  CargoAsignacion,
  DenominacionCargo,
  PrestamoCargo,
} from "../../domain/entities/cargo";
import { asignarCargo, cambiarCargo, desasignarCargo, gestionarEstatus } from "./asignar-cargo";
import { listarCargos, listarDenominaciones } from "./listar-cargos";
import { crearPrestamo, finalizarPrestamo, listarPrestamos } from "./prestamo-cargo";
import { crearDenominacion, eliminarDenominacion } from "./gestionar-denominaciones";

class RepoCargosMemoria implements RepoCargos {
  cargos: CargoAsignacion[] = [
    {
      id: 1,
      codigo: "COD-001",
      empleadoCedula: null,
      denominacionId: 10,
      denominacionNombre: "ANALISTA I",
      especificaId: 100,
      especificaNombre: "ANALISTA JUNIOR",
      tipoNominaId: 1,
      tipoNominaNombre: "PRESUPUESTO",
      estatusId: 1,
      estatusNombre: "ACTIVO",
      dependenciaId: 1,
      dependenciaNombre: "Tecnología",
      direccionGeneralId: 100,
      direccionGeneralNombre: "Dirección de TI",
      direccionLineaId: null,
      direccionLineaNombre: null,
      coordinacionId: null,
      coordinacionNombre: null,
      observaciones: null,
      estaVacante: true,
    },
  ];

  denominaciones: DenominacionCargo[] = [{ id: 10, nombre: "ANALISTA I", orden: 30 }];

  prestamos: PrestamoCargo[] = [];

  async listarCargos() {
    return this.cargos;
  }
  async listarDenominaciones(): Promise<DenominacionCargo[]> {
    return this.denominaciones;
  }
  async listarDenominacionesEspecificas(): Promise<DenominacionCargo[]> {
    return this.denominaciones;
  }
  async asignarCargo(cargoId: number, empleadoCedula: string) {
    const c = this.cargos.find((x) => x.id === cargoId)!;
    c.empleadoCedula = empleadoCedula;
    c.estaVacante = false;
    return c;
  }
  async desasignarCargo(cargoId: number) {
    const c = this.cargos.find((x) => x.id === cargoId)!;
    c.empleadoCedula = null;
    c.estaVacante = true;
    return c;
  }
  async cambiarCargo(cargoActualId: number, cargoNuevoId: number, _motivoId: number) {
    const actual = this.cargos.find((x) => x.id === cargoActualId)!;
    actual.estaVacante = true;
    const destino = this.cargos.find((x) => x.id === cargoNuevoId)!;
    const cedula = actual.empleadoCedula;
    actual.empleadoCedula = null;
    destino.empleadoCedula = cedula;
    destino.estaVacante = false;
    return destino;
  }
  async gestionarEstatus(cargoId: number, estatusId: number, _motivoId: number) {
    const c = this.cargos.find((x) => x.id === cargoId)!;
    c.estatusId = estatusId;
    return c;
  }
  async listarPrestamos(): Promise<PrestamoCargo[]> {
    return this.prestamos;
  }
  async crearPrestamo(input: { cedulaEncargado: string; cargoId: number; motivoId: number; fechaInicio: string; fechaFin: string }) {
    const p: PrestamoCargo = {
      id: this.prestamos.length + 1,
      empleadoEncargadoCedula: input.cedulaEncargado,
      empleadoEncargadoNombre: "Encargado",
      cargoEncargadoId: input.cargoId,
      cargoEncargadoCodigo: "COD-X",
      titularCedula: null,
      titularNombre: null,
      motivoId: input.motivoId,
      motivoNombre: "Motivo",
      estatusId: 1,
      estatusNombre: "ACTIVA",
      fechaInicio: input.fechaInicio,
      fechaFin: input.fechaFin,
      ejecutadoPorId: 1,
      estaFinalizada: false,
    };
    this.prestamos.push(p);
    return p;
  }
  async finalizarPrestamo(prestamoId: number) {
    const p = this.prestamos.find((x) => x.id === prestamoId)!;
    p.estatusNombre = "FINALIZADA";
    p.estaFinalizada = true;
    return p;
  }
  async crearDenominacion(input: { nombre: string; orden: number }) {
    const d: DenominacionCargo = { id: this.denominaciones.length + 1, nombre: input.nombre, orden: input.orden };
    this.denominaciones.push(d);
    return d;
  }
  async actualizarDenominacion(id: number, input: { nombre: string; orden: number }) {
    const d = this.denominaciones.find((x) => x.id === id)!;
    d.nombre = input.nombre;
    return d;
  }
  async eliminarDenominacion(id: number) {
    this.denominaciones = this.denominaciones.filter((x) => x.id !== id);
  }
  async crearDenominacionEspecifica(input: { nombre: string; orden: number }) {
    return this.crearDenominacion(input);
  }
  async actualizarDenominacionEspecifica(id: number, input: { nombre: string; orden: number }) {
    return this.actualizarDenominacion(id, input);
  }
  async eliminarDenominacionEspecifica(id: number) {
    return this.eliminarDenominacion(id);
  }
  async listarMotivos(): Promise<CatalogoCargoItem[]> {
    return [{ id: 1, nombre: "Traslado" }];
  }
  async listarEstatus(): Promise<CatalogoCargoItem[]> {
    return [{ id: 1, nombre: "ACTIVO" }];
  }
}

describe("Casos de uso de Cargos", () => {
  it("listarCargos y listarDenominaciones retornan listas", async () => {
    const repo = new RepoCargosMemoria();
    const cargos = await listarCargos(repo);
    expect(cargos.length).toBe(1);
    expect(cargos[0].estaVacante).toBe(true);
    expect(cargos[0].codigo).toBe("COD-001");

    const denoms = await listarDenominaciones(repo);
    expect(denoms[0].nombre).toBe("ANALISTA I");
    expect(denoms[0].orden).toBe(30);
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

  it("cambiarCargo traslada al empleado al destino vacante", async () => {
    const repo = new RepoCargosMemoria();
    repo.cargos.push({
      id: 2,
      codigo: "COD-002",
      empleadoCedula: null,
      denominacionId: 20,
      denominacionNombre: "ANALISTA II",
      especificaId: 200,
      especificaNombre: "ANALISTA",
      tipoNominaId: 1,
      tipoNominaNombre: "PRESUPUESTO",
      estatusId: 1,
      estatusNombre: "ACTIVO",
      dependenciaId: null,
      dependenciaNombre: null,
      direccionGeneralId: null,
      direccionGeneralNombre: null,
      direccionLineaId: null,
      direccionLineaNombre: null,
      coordinacionId: null,
      coordinacionNombre: null,
      observaciones: null,
      estaVacante: true,
    });
    await asignarCargo(repo, 1, "12345678");
    const trasladado = await cambiarCargo(repo, { cargoActualId: 1, cargoNuevoId: 2, motivoId: 5 });
    expect(trasladado.empleadoCedula).toBe("12345678");
  });

  it("gestionarEstatus actualiza el estatus del cargo", async () => {
    const repo = new RepoCargosMemoria();
    const actualizado = await gestionarEstatus(repo, { cargoId: 1, estatusId: 99, motivoId: 5 });
    expect(actualizado.estatusId).toBe(99);
  });

  it("crearPrestamo, listarPrestamos y finalizarPrestamo funcionan", async () => {
    const repo = new RepoCargosMemoria();
    const creado = await crearPrestamo(repo, { cedulaEncargado: "12345678", cargoId: 1, motivoId: 5, fechaInicio: "2026-01-01", fechaFin: "2026-02-01" });
    expect(creado.estaFinalizada).toBe(false);
    expect((await listarPrestamos(repo)).length).toBe(1);
    const finalizado = await finalizarPrestamo(repo, creado.id);
    expect(finalizado.estaFinalizada).toBe(true);
  });

  it("crearDenominacion y eliminarDenominacion modifican el catálogo", async () => {
    const repo = new RepoCargosMemoria();
    const d = await crearDenominacion(repo, { nombre: "DIRECTOR", orden: 50 });
    expect(d.orden).toBe(50);
    await eliminarDenominacion(repo, d.id);
    expect((await repo.listarDenominaciones()).length).toBe(1);
  });
});
