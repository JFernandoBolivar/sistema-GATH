import { describe, expect, it } from "vitest";

import { destinoDeRuta, erroresSinCampo, primerPasoConErrores } from "./errores-registro";

describe("errores del servidor en el registro multipaso", () => {
  it("traduce rutas del API al paso y campo del formulario", () => {
    expect(destinoDeRuta("cedula")).toEqual({ paso: 0, campo: "cedulaidentidad" });
    expect(destinoDeRuta("correo")).toEqual({ paso: 0, campo: "correo" });
    expect(destinoDeRuta("contacto_emergencia.1.telefono")).toEqual({
      paso: 0,
      campo: "contacto_emergencia.1.telefono",
    });
    expect(destinoDeRuta("contacto_emergencia.0.relacion")).toEqual({
      paso: 0,
      campo: "contacto_emergencia.0.relacion_id",
    });
    expect(destinoDeRuta("formacion_academica.0.nivel_academico")).toEqual({
      paso: 1,
      campo: "formacion_academica.0.nivel_Academico_id",
    });
    expect(destinoDeRuta("antecedentes.2.organismo")).toEqual({ paso: 3, campo: "antecedentes.2.organismo_id" });
    expect(destinoDeRuta("perfil_fisico.tallaZapatos")).toEqual({ paso: 5, campo: "perfil_fisico.tallaZapatos" });
    expect(destinoDeRuta("datos_vivienda.estado")).toEqual({ paso: 6, campo: "datos_vivienda.estado_id" });
    expect(destinoDeRuta("algo_desconocido")).toBeNull();
  });

  it("vuelve al primer paso con errores y separa los mensajes sin campo", () => {
    const errores = {
      datos_vivienda: ["x"],
      "datos_vivienda.estado": ["Estado inválido"],
      "formacion_academica.0.carrera": ["Carrera inválida"],
      non_field: ["General"],
    };
    expect(primerPasoConErrores(errores)).toBe(1);
    expect(erroresSinCampo(errores)).toEqual(["x", "General"]);
    expect(primerPasoConErrores({ otra: ["a"] })).toBeNull();
  });
});
