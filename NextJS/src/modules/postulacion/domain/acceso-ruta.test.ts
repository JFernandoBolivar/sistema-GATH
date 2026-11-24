import { describe, expect, it } from "vitest";
import { puedeVerRuta } from "@/shared/lib/evaluador-iam";
import { decidirRutaPostulacion, type SesionRuta } from "./acceso-ruta";

const postulante: SesionRuta = { rol: "POSTULANTE", debeCambiarClave: false };
const postulanteNuevo: SesionRuta = { rol: "POSTULANTE", debeCambiarClave: true };
const empleado: SesionRuta = { rol: "ADMINISTRADOR", debeCambiarClave: false };

const redirige = (destino: string) => ({ tipo: "redirigir", destino });
const continua = { tipo: "continuar" };
const noAplica = { tipo: "no_aplica" };

describe("sin sesión", () => {
  it("/postulacion/acceso es pública; el resto del área manda a acceso", () => {
    expect(decidirRutaPostulacion("/postulacion/acceso", null)).toEqual(continua);
    expect(decidirRutaPostulacion("/postulacion", null)).toEqual(redirige("/postulacion/acceso"));
    expect(decidirRutaPostulacion("/postulacion/cambiar-clave", null)).toEqual(redirige("/postulacion/acceso"));
  });

  it("«Recibido» es pública (la sesión ya se cerró)", () => {
    expect(decidirRutaPostulacion("/postulacion/recibido", null)).toEqual(continua);
  });

  it("«activar» (enlace del correo) es pública con o sin sesión, para empleado y postulante", () => {
    expect(decidirRutaPostulacion("/postulacion/activar", null)).toEqual(continua);
    expect(decidirRutaPostulacion("/postulacion/activar/", null)).toEqual(continua);
    expect(decidirRutaPostulacion("/postulacion/activar", { rol: "POSTULANTE", debeCambiarClave: true })).toEqual(continua);
    expect(decidirRutaPostulacion("/postulacion/activar", { rol: "ADMIN", debeCambiarClave: false })).toEqual(continua);
  });

  it("las rutas del personal siguen su flujo normal (login)", () => {
    expect(decidirRutaPostulacion("/carnetizacion", null)).toEqual(noAplica);
  });
});

describe("postulante contra rutas del personal", () => {
  it.each(["/dashboard", "/carnetizacion", "/personal", "/usuarios/roles", "/autogestion", "/", "/login"])(
    "%s lo devuelve a /postulacion",
    (ruta) => {
      expect(decidirRutaPostulacion(ruta, postulante)).toEqual(redirige("/postulacion"));
    },
  );

  it("con cambio de clave pendiente, lo manda a cambiar-clave", () => {
    expect(decidirRutaPostulacion("/dashboard", postulanteNuevo)).toEqual(redirige("/postulacion/cambiar-clave"));
  });

  it("puede abrir la pantalla sin conexión de la PWA", () => {
    expect(decidirRutaPostulacion("/offline", postulante)).toEqual(noAplica);
  });

  it("no confunde un prefijo parecido con su área", () => {
    expect(decidirRutaPostulacion("/postulaciones", postulante)).toEqual(redirige("/postulacion"));
  });
});

describe("empleado contra /postulacion", () => {
  it.each(["/postulacion", "/postulacion/cambiar-clave", "/postulacion/acceso"])("%s va al inicio del personal", (ruta) => {
    expect(decidirRutaPostulacion(ruta, empleado)).toEqual(redirige("/dashboard"));
  });

  it("sus rutas normales no cambian", () => {
    expect(decidirRutaPostulacion("/carnetizacion", empleado)).toEqual(noAplica);
  });

  it("el rol POSTULANTE no da permisos de empleado en el evaluador de rutas", () => {
    expect(puedeVerRuta([], "/carnetizacion")).toBe(false);
    expect(puedeVerRuta([], "/personal")).toBe(false);
  });
});

describe("cambio de clave obligatorio", () => {
  it("todo el área redirige a cambiar-clave", () => {
    expect(decidirRutaPostulacion("/postulacion", postulanteNuevo)).toEqual(redirige("/postulacion/cambiar-clave"));
    expect(decidirRutaPostulacion("/postulacion/otra", postulanteNuevo)).toEqual(redirige("/postulacion/cambiar-clave"));
  });

  it("cambiar-clave y acceso siguen abiertas", () => {
    expect(decidirRutaPostulacion("/postulacion/cambiar-clave", postulanteNuevo)).toEqual(continua);
    expect(decidirRutaPostulacion("/postulacion/acceso", postulanteNuevo)).toEqual(continua);
  });

  it("con la clave al día, cambiar-clave devuelve al inicio", () => {
    expect(decidirRutaPostulacion("/postulacion/cambiar-clave", postulante)).toEqual(redirige("/postulacion"));
    expect(decidirRutaPostulacion("/postulacion", postulante)).toEqual(continua);
  });

  it("acceso queda abierta con sesión para poder reingresar si el token cayó (sin bucle)", () => {
    expect(decidirRutaPostulacion("/postulacion/acceso", postulante)).toEqual(continua);
  });
});
