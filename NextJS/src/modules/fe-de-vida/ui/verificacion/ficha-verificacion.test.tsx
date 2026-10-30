import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ResultadoVerificacion } from "../../application/use-cases/verificar-constancia";
import type { ConstanciaVerificadaEntity } from "../../domain/entities/verificacion-constancia";
import { FichaVerificacion } from "./ficha-verificacion";

const publica: ConstanciaVerificadaEntity = {
  numero: "FV-2026-000001",
  emitidaEn: "2026-11-02T12:00:00Z",
  procesoNombre: "Fe de vida 2026-2027",
  nombreCompleto: "MARIA PEREZ",
  cedula: "51***11",
  cedulaOculta: true,
  solicitudId: null,
  certificantes: [],
};
const interna: ConstanciaVerificadaEntity = {
  ...publica,
  cedula: "5111111",
  cedulaOculta: false,
  solicitudId: "11111111-1111-4111-8111-111111111111",
  certificantes: [
    { nombre: "ANA ANALISTA", cedula: "20000001" },
    { nombre: "ADA ADMIN", cedula: "20000002" },
  ],
};

const ver = (r: ResultadoVerificacion) => render(<FichaVerificacion resultado={r} />);

describe("FichaVerificacion", () => {
  it("válida pública: sello, datos con las etiquetas del PDF y cédula enmascarada", () => {
    ver({ tipo: "valida", constancia: publica, interna: false });
    expect(
      screen.getByRole("heading", { level: 1, name: "Constancia de Comparecencia o Fe de Vida" }),
    ).toBeTruthy();
    expect(screen.getByText("Comisión Nacional de Telecomunicaciones (CONATEL)")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/Constancia válida/);
    expect(screen.getByText("Fe de vida 2026-2027")).toBeTruthy();
    for (const etiqueta of [
      "N.° de constancia",
      "Fecha de emisión",
      "Nombre y apellido",
      "Cédula de identidad",
    ]) {
      expect(screen.getByText(etiqueta)).toBeTruthy();
    }
    expect(screen.getByText("51***11")).toBeTruthy();
    expect(screen.getByText("Compare estos datos con el documento impreso.")).toBeTruthy();
  });

  it("la vista pública no muestra certificantes, enlace a la solicitud ni descarga del PDF", () => {
    ver({ tipo: "valida", constancia: publica, interna: false });
    expect(screen.queryByText(/Funcionario\(s\) que certifica/)).toBeNull();
    expect(screen.queryByRole("link", { name: /ver solicitud/i })).toBeNull();
    expect(screen.queryByText(/descargar/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /pdf/i })).toBeNull();
  });

  it("inválida: sello rojo con texto, sin datos", () => {
    ver({ tipo: "invalida" });
    expect(screen.getByRole("status").textContent).toMatch(/Constancia no encontrada o inválida/);
    expect(screen.queryByText("N.° de constancia")).toBeNull();
  });

  it("error de consulta: alerta con el mensaje, sin sello de validez", () => {
    ver({ tipo: "error", mensaje: "Intente de nuevo en un minuto." });
    expect(screen.getByRole("alert").textContent).toMatch(/Intente de nuevo/);
    expect(screen.queryByText("Constancia válida")).toBeNull();
  });

  it("interna: cédula completa, tabla de certificantes y enlace a la solicitud, sin descarga", () => {
    ver({ tipo: "valida", constancia: interna, interna: true });
    expect(screen.getByText("5111111")).toBeTruthy();
    expect(screen.getByText("Funcionario(s) que certifica(n)")).toBeTruthy();
    expect(screen.getByText("ANA ANALISTA")).toBeTruthy();
    expect(screen.getByText("20000002")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver solicitud" }).getAttribute("href")).toBe(
      "/personal/fe-de-vida/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.queryByText(/descargar/i)).toBeNull();
  });
});
