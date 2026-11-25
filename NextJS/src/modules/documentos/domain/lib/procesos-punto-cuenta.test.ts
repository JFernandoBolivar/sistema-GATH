import { describe, expect, it } from "vitest";

import { CATALOGO } from "./fixtures";
import {
  claveConfiguracion,
  etiquetaCortaProceso,
  procesosPuntoCuenta,
  PROCESO_INGRESO_POSTULACION,
} from "./procesos-punto-cuenta";

describe("procesos del Punto de Cuenta", () => {
  it("convierte el código del catálogo en la clave de la configuración", () => {
    expect(claveConfiguracion("punto_cuenta:cambio_oficina")).toBe("cambio_oficina");
    expect(claveConfiguracion("punto_cuenta:pase_a_pasivo")).toBe("pase_a_pasivo");
    expect(claveConfiguracion("ingreso_ventana2")).toBe("ingreso_ventana2");
  });

  it("quita el prefijo «Punto de Cuenta: » de la etiqueta", () => {
    expect(etiquetaCortaProceso("Punto de Cuenta: cambio de oficina")).toBe("cambio de oficina");
    expect(etiquetaCortaProceso("Cambio de oficina")).toBe("Cambio de oficina");
  });

  it("solo devuelve el grupo Punto de Cuenta y marca el ingreso como siempre activo", () => {
    const procesos = procesosPuntoCuenta([
      ...CATALOGO.procesos,
      {
        codigo: `punto_cuenta:${PROCESO_INGRESO_POSTULACION}`,
        etiqueta: "Punto de Cuenta: ingreso por postulación",
        descripcion: "Punto de Cuenta para el ingreso de un postulante.",
        grupo: "punto_cuenta",
        grupos_variables: [],
      },
    ]);
    expect(procesos.map((p) => p.clave)).toEqual([
      "cambio_oficina",
      "cambio_nivel",
      PROCESO_INGRESO_POSTULACION,
    ]);
    expect(procesos.filter((p) => p.siempreActivo).map((p) => p.clave)).toEqual([PROCESO_INGRESO_POSTULACION]);
    expect(procesos[0]).toMatchObject({
      etiqueta: "cambio de oficina",
      codigo: "punto_cuenta:cambio_oficina",
      descripcion: "Punto de cuenta que se emite al cambiar de oficina.",
    });
  });
});
