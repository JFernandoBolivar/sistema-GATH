import { describe, expect, it } from "vitest";
import {
  alinearElementoKonva,
  aplicarColoresAValores,
  cargarValoresSugeridos,
  quitarTodosLosValores,
  cambiarCriterioColor,
  CRITERIOS_COLOR_SOPORTADOS,
  sugerenciasCriterio,
  duplicarElementoKonva,
  moverCapaKonva,
  normalizarClaveColor,
  PERSONA_FICTICIA_DEFECTO,
  REGLAS_COLOR_DEFECTO,
  resolverColorDeRegla,
  type ElementoKonva,
  type ReglasColorConfig,
} from "./disenador";
import { crearElementosInicialesDefecto } from "./disenador-plantilla-defecto";

describe("Reglas de Color de Carnetización (O44 - E7)", () => {

  it("normaliza cadenas de color agnósticas a mayúsculas y acentos", () => {
    expect(normalizarClaveColor("Oficina de Gestión Humana")).toBe("OFICINA_DE_GESTION_HUMANA");
    expect(normalizarClaveColor("Empleado Fijo")).toBe("EMPLEADO_FIJO");
    expect(normalizarClaveColor("Jubilado(a)")).toBe("JUBILADO(A)");
  });

  it("resuelve Funcionario institucional en azul marino #1f3a5f", () => {
    const persona = { ...PERSONA_FICTICIA_DEFECTO, nomina: "Funcionario" };
    const res = resolverColorDeRegla(REGLAS_COLOR_DEFECTO, persona);
    expect(res.primario).toBe("#1f3a5f");
    expect(res.acento).toBe("#1273bd");
    expect(res.texto).toBe("#ffffff");
  });

  it("resuelve Contratado y Jubilado con sus acentos correspondientes", () => {
    const personaContratado = { ...PERSONA_FICTICIA_DEFECTO, nomina: "Contratado" };
    const resContratado = resolverColorDeRegla(REGLAS_COLOR_DEFECTO, personaContratado);
    expect(resContratado.primario).toBe("#c79a12");
    expect(resContratado.acento).toBe("#16264a");

    const personaJubilado = { ...PERSONA_FICTICIA_DEFECTO, nomina: "Jubilado" };
    const resJubilado = resolverColorDeRegla(REGLAS_COLOR_DEFECTO, personaJubilado);
    expect(resJubilado.primario).toBe("#1f4e38");
    expect(resJubilado.acento).toBe("#2d7a58");
  });

  it("cae a valor de respaldo cuando el valor no coincide", () => {
    const personaDesconocida = { ...PERSONA_FICTICIA_DEFECTO, nomina: "ValorInexistente" };
    const res = resolverColorDeRegla(REGLAS_COLOR_DEFECTO, personaDesconocida);
    expect(res).toEqual(REGLAS_COLOR_DEFECTO.respaldo);
  });

  it("respeta criterio unico devolviendo el respaldo sin importar la persona", () => {
    const configUnica: ReglasColorConfig = {
      criterio: "unico",
      respaldo: { primario: "#0f172a", acento: "#0284c7", texto: "#ffffff" },
      valores: {
        Funcionario: { primario: "#ff0000", acento: "#00ff00", texto: "#0000ff" },
      },
    };
    const persona = { ...PERSONA_FICTICIA_DEFECTO, nomina: "Funcionario" };
    const res = resolverColorDeRegla(configUnica, persona);
    expect(res.primario).toBe("#0f172a");
    expect(res.acento).toBe("#0284c7");
  });

  it("resuelve criterios por cargo u oficina", () => {
    const configCargo: ReglasColorConfig = {
      criterio: "cargo",
      respaldo: { primario: "#1f3a5f", acento: "#1273bd", texto: "#ffffff" },
      valores: {
        Director: { primario: "#4c0519", acento: "#f43f5e", texto: "#ffffff" },
      },
    };
    const personaDirector = { ...PERSONA_FICTICIA_DEFECTO, cargo: "Director" };
    const res = resolverColorDeRegla(configCargo, personaDirector);
    expect(res.primario).toBe("#4c0519");
  });

  describe("Funciones de manipulación de elementos del diseñador (O44-R1)", () => {
    const dummyElemento: ElementoKonva = {
      id: "el-1",
      t: "rect",
      name: "Caja",
      cara: "anverso",
      x: 10,
      y: 10,
      w: 20,
      h: 15,
      r: 0,
      fill: "#1f3a5f",
      stroke: "",
      sw: 0,
      rad: 0,
      shadow: 0,
      op: 100,
    };

    it("duplica un elemento desplazándolo con nuevo id y nombre copia", () => {
      const duplicado = duplicarElementoKonva(dummyElemento, 54, 85.6, "el-2");
      expect(duplicado.id).toBe("el-2");
      expect(duplicado.name).toBe("Caja (Copia)");
      expect(duplicado.x).toBe(13);
      expect(duplicado.y).toBe(13);
    });

    it("alinea elementos a la izquierda, centro horizontal, derecha, centro vertical y abajo", () => {
      expect(alinearElementoKonva(dummyElemento, "left", 54, 85.6)).toEqual({ x: 0, y: 10 });
      expect(alinearElementoKonva(dummyElemento, "center-h", 54, 85.6)).toEqual({ x: 17, y: 10 });
      expect(alinearElementoKonva(dummyElemento, "right", 54, 85.6)).toEqual({ x: 34, y: 10 });
      expect(alinearElementoKonva(dummyElemento, "top", 54, 85.6)).toEqual({ x: 10, y: 0 });
      expect(alinearElementoKonva(dummyElemento, "center-v", 54, 85.6)).toEqual({ x: 10, y: 35.3 });
      expect(alinearElementoKonva(dummyElemento, "bottom", 54, 85.6)).toEqual({ x: 10, y: 70.6 });
    });

    it("reordena capas hacia arriba y hacia abajo", () => {
      const lista: ElementoKonva[] = [
        { ...dummyElemento, id: "1" },
        { ...dummyElemento, id: "2" },
        { ...dummyElemento, id: "3" },
      ];

      const subida = moverCapaKonva(lista, "1", "arriba");
      expect(subida.map((e) => e.id)).toEqual(["2", "1", "3"]);

      const bajada = moverCapaKonva(subida, "1", "abajo");
      expect(bajada.map((e) => e.id)).toEqual(["1", "2", "3"]);
    });

    it("genera los elementos iniciales canónicos con anverso y reverso", () => {
      const iniciales = crearElementosInicialesDefecto(54);
      expect(iniciales.length).toBeGreaterThan(0);
      expect(iniciales.some((e) => e.cara === "anverso")).toBe(true);
      expect(iniciales.some((e) => e.cara === "reverso")).toBe(true);
    });
  });
});


describe("Cambio de criterio de color", () => {
  it("al cambiar el criterio cambian las opciones y se recuperan al volver", () => {
    const nomina = REGLAS_COLOR_DEFECTO;
    expect(Object.keys(nomina.valores)).toContain("Funcionario");

    const porCargo = cambiarCriterioColor(nomina, "cargo");
    expect(porCargo.criterio).toBe("cargo");
    expect(Object.keys(porCargo.valores)).toEqual([]);

    const conCargo = {
      ...porCargo,
      valores: { Analista: { primario: "#111111", acento: "#222222", texto: "#ffffff" } },
    };
    const aNomina = cambiarCriterioColor(conCargo, "nomina");
    expect(Object.keys(aNomina.valores)).toContain("Funcionario");
    expect(Object.keys(cambiarCriterioColor(aNomina, "cargo").valores)).toEqual(["Analista"]);

    expect(sugerenciasCriterio("nomina")).toContain("Pasante");
    expect(sugerenciasCriterio("cargo")).toEqual([]);
    expect(CRITERIOS_COLOR_SOPORTADOS).not.toContain("nivel");
  });
});

describe("Aplicar colores en bloque a los valores de una regla", () => {
  const base: ReglasColorConfig = {
    criterio: "cargo",
    respaldo: REGLAS_COLOR_DEFECTO.respaldo,
    valores: {
      A: { primario: "#000001", acento: "#000002", texto: "#ffffff" },
      B: { primario: "#000003", acento: "#000004", texto: "#ffffff" },
      C: { primario: "#000005", acento: "#000006", texto: "#ffffff" },
    },
  };
  const nuevo = { primario: "#abcdef", acento: "#fedcba" };

  it("Aplicar a todos pone la combinación en todos", () => {
    const r = aplicarColoresAValores(base, nuevo);
    for (const v of Object.values(r.valores)) {
      expect(v.primario).toBe("#abcdef");
      expect(v.acento).toBe("#fedcba");
      expect(v.texto).toBe("#ffffff");
    }
  });

  it("Aplicar a seleccionados solo cambia los marcados", () => {
    const r = aplicarColoresAValores(base, nuevo, ["B"]);
    expect(r.valores.B.primario).toBe("#abcdef");
    expect(r.valores.A).toEqual(base.valores.A);
    expect(r.valores.C).toEqual(base.valores.C);
  });

  it("Quitar todos deja los valores sin regla", () => {
    expect(quitarTodosLosValores(base).valores).toEqual({});
  });
});

describe("sugerencias de nómina con tipos de credencial externa", () => {
  it("suma los códigos del catálogo en mayúsculas y los etiqueta legiblemente", async () => {
    const { sugerenciasCriterio: sugerir, etiquetaSugerencia } = await import("./disenador");
    const tipos = [
      { codigo: "visitante", nombre: "Visitante" },
      { codigo: "trabajador_temporal", nombre: "Trabajador temporal" },
    ];
    const sugerencias = sugerir("nomina", tipos);
    expect(sugerencias).toContain("VISITANTE");
    expect(sugerencias).toContain("TRABAJADOR_TEMPORAL");
    expect(etiquetaSugerencia("VISITANTE", tipos)).toBe("Visitante");
    expect(sugerir("cargo", tipos)).toEqual([]);
  });
});

describe("sugerencias reales de cargo y oficina (reglas de color)", () => {
  const listas = {
    cargos: ["ANALISTA", "DIRECTOR", "ANALISTA"],
    oficinas: ["GESTION HUMANA"],
  };

  it("devuelve los cargos del backend sin duplicados", () => {
    expect(sugerenciasCriterio("cargo", [], listas)).toEqual(["ANALISTA", "DIRECTOR"]);
  });

  it("devuelve las oficinas del backend", () => {
    expect(sugerenciasCriterio("oficina", [], listas)).toEqual(["GESTION HUMANA"]);
  });

  it("no mezcla las listas entre criterios ni con nomina", () => {
    expect(sugerenciasCriterio("cargo", [], { oficinas: ["GESTION HUMANA"] })).toEqual([]);
    expect(sugerenciasCriterio("oficina", [], { cargos: ["ANALISTA"] })).toEqual([]);
    expect(sugerenciasCriterio("nomina", [], listas)).not.toContain("ANALISTA");
  });

  it("sin listas del backend no inventa valores", () => {
    expect(sugerenciasCriterio("cargo")).toEqual([]);
    expect(sugerenciasCriterio("oficina")).toEqual([]);
  });
});

describe("cargar todos los valores sugeridos", () => {
  const base: ReglasColorConfig = {
    criterio: "cargo",
    respaldo: { primario: "#111111", acento: "#222222", texto: "#ffffff" },
    valores: {
      DIRECTOR: { primario: "#000001", acento: "#000002", texto: "#eeeeee" },
    },
  };

  it("agrega los valores nuevos con el color de respaldo", () => {
    const r = cargarValoresSugeridos(base, ["ANALISTA", "DIRECTOR", "SECRETARIA"]);
    expect(Object.keys(r.valores)).toEqual(["DIRECTOR", "ANALISTA", "SECRETARIA"]);
    expect(r.valores.ANALISTA).toEqual(base.respaldo);
    expect(r.valores.SECRETARIA).toEqual(base.respaldo);
  });

  it("respeta el color ya configurado de un valor", () => {
    const r = cargarValoresSugeridos(base, ["DIRECTOR"]);
    expect(r.valores.DIRECTOR).toEqual(base.valores.DIRECTOR);
  });

  it("ignora valores vacios y no muta las reglas originales", () => {
    const r = cargarValoresSugeridos(base, ["  ", "ANALISTA"]);
    expect(Object.keys(r.valores)).toEqual(["DIRECTOR", "ANALISTA"]);
    expect(Object.keys(base.valores)).toEqual(["DIRECTOR"]);
  });

  it("sin valores devuelve las reglas intactas", () => {
    expect(cargarValoresSugeridos(base, []).valores).toEqual(base.valores);
  });
});
