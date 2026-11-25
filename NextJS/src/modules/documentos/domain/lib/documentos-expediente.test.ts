import { describe, expect, it } from "vitest";
import {
  cuerpoDeValores,
  hayCambios,
  huellaCorta,
  obligatoriosVacios,
  pendientesDeDocumentos,
  valorAControl,
  valoresAControles,
  type CampoPropioDTO,
  type DocumentoExpedienteDTO,
} from "./documentos-expediente";

const campo = (c: Partial<CampoPropioDTO> & Pick<CampoPropioDTO, "clave" | "tipo">): CampoPropioDTO => ({
  etiqueta: c.clave,
  obligatorio: false,
  ayuda: "",
  opciones: [],
  ...c,
});

const CAMPOS = [
  campo({ clave: "sueldo", tipo: "texto", etiqueta: "Sueldo", obligatorio: true }),
  campo({ clave: "inicio", tipo: "fecha", etiqueta: "Inicio" }),
  campo({ clave: "traslado", tipo: "si_no" }),
];

const doc = (d: Partial<DocumentoExpedienteDTO>): DocumentoExpedienteDTO => ({
  plantillaId: "p", codigo: "OFERTA", nombre: "Oferta", descripcion: "", proceso: "ventana2", procesoEtiqueta: "Datos complementarios", version: 1, firmante: "postulante",
  requiereFirma: true, camposPropios: [], valores: {}, faltan: [], estado: "listo_para_revisar", firmaInvalidada: false,
  documentoId: null, firma: null, textoConformidad: "", trabajadorCedula: "", archivoUrl: null, ...d,
});

describe("valores de los campos propios", () => {
  it("la fecha del servidor (DD/MM/AAAA) pasa al control como AAAA-MM-DD", () => {
    expect(valorAControl({ tipo: "fecha" }, "01/12/2026")).toBe("2026-12-01");
    expect(valorAControl({ tipo: "fecha" }, "")).toBe("");
    expect(valorAControl({ tipo: "texto" }, "01/12/2026")).toBe("01/12/2026");
  });

  it("arma todos los controles, también los vacíos", () => {
    expect(valoresAControles(CAMPOS, { sueldo: "10", inicio: "05/01/2027" })).toEqual({ sueldo: "10", inicio: "2027-01-05", traslado: "" });
  });

  it("el cuerpo solo lleva lo que tiene valor", () => {
    expect(cuerpoDeValores(CAMPOS, { sueldo: " 10 ", inicio: "", traslado: "SI" })).toEqual({ sueldo: "10", traslado: "SI" });
  });

  it("lista los obligatorios vacíos por etiqueta", () => {
    expect(obligatoriosVacios(CAMPOS, { sueldo: "  " })).toEqual(["Sueldo"]);
    expect(obligatoriosVacios(CAMPOS, { sueldo: "1" })).toEqual([]);
  });

  it("detecta los cambios sin guardar comparando con lo guardado", () => {
    const guardados = { sueldo: "10", inicio: "05/01/2027" };
    expect(hayCambios(CAMPOS, valoresAControles(CAMPOS, guardados), guardados)).toBe(false);
    expect(hayCambios(CAMPOS, { sueldo: "11", inicio: "2027-01-05", traslado: "" }, guardados)).toBe(true);
    expect(hayCambios(CAMPOS, { sueldo: "10", inicio: "2027-01-06", traslado: "" }, guardados)).toBe(true);
  });
});

describe("estado de los documentos", () => {
  it("cuenta como pendiente lo que falta llenar o firmar", () => {
    const docs = [
      doc({ estado: "firmado" }),
      doc({ codigo: "B", faltan: ["Sueldo"], estado: "pendiente_datos" }),
      doc({ codigo: "C" }),
      doc({ codigo: "D", requiereFirma: false }),
    ];
    expect(pendientesDeDocumentos(docs)).toBe(2);
    expect(pendientesDeDocumentos([])).toBe(0);
  });

  it("acorta la huella para mostrarla", () => {
    const sha = "a".repeat(8) + "0".repeat(48) + "f".repeat(8);
    expect(huellaCorta(sha)).toBe("aaaaaaaa…ffffffff");
    expect(huellaCorta("abc")).toBe("abc");
  });
});
