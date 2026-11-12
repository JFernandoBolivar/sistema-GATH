import { describe, expect, it } from "vitest";
import { diferencias } from "./borrador";

describe("vivienda: solo viajan los campos que cambiaron", () => {
  const vigente = {
    pais_id: 1,
    ciudad_region: null,
    estado_id: 2,
    municipio_id: 13,
    parroquia_id: 47,
    codigo_postal_id: 100,
    direccion_exacta: "Calle Bolívar casa 5",
    condicion_vivienda_id: 1,
  };

  it("reenviar los mismos valores (ciudad vacía incluida) no es un cambio", () => {
    expect(diferencias(vigente, { ...vigente, ciudad_region: "" })).toEqual({});
  });

  it("cambiar solo la dirección envía solo la dirección", () => {
    const cambios = diferencias(vigente, {
      ...vigente,
      direccion_exacta: "Avenida Principal casa 9",
    });
    expect(cambios).toEqual({ direccion_exacta: "Avenida Principal casa 9" });
  });

  it("pasar a un país extranjero envía el país, la ciudad y vacía la geografía", () => {
    const cambios = diferencias(vigente, {
      ...vigente,
      pais_id: 25,
      ciudad_region: "BERLIN",
      estado_id: "",
      municipio_id: "",
      parroquia_id: "",
      codigo_postal_id: "",
    });
    expect(cambios).toEqual({
      pais_id: 25,
      ciudad_region: "BERLIN",
      estado_id: null,
      municipio_id: null,
      parroquia_id: null,
      codigo_postal_id: null,
    });
  });
});
