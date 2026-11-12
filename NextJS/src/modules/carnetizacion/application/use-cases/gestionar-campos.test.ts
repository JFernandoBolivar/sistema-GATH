import { describe, expect, it } from "vitest";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import type { CampoCredencial } from "../../domain/entities/carnet";
import { campoSinOrigen, etiquetaOrigenCampo, ORIGENES_CAMPO } from "../../domain/entities/origen-campo";
import {
  actualizarCampoPersonalizado,
  crearCampoPersonalizado,
  eliminarCampoPersonalizado,
  listarCamposCredencial,
} from "./gestionar-campos";

class RepoCamposMemoria implements Partial<RepoCarnetizacion> {
  campos: CampoCredencial[] = [
    {
      codigo: "nombre",
      etiqueta: "Nombre y Apellido",
      grupo: "identificacion",
      tipo_credencial: "todos",
      sensible: false,
      es_personalizado: false,
      descripcion: "Nombre del titular",
      valor_ejemplo: "Pedro Pérez",
    },
    {
      codigo: "cedula",
      etiqueta: "Cédula de Identidad",
      grupo: "identificacion",
      tipo_credencial: "todos",
      sensible: true,
      es_personalizado: false,
      descripcion: "Documento nacional",
      valor_ejemplo: "V-12.345.678",
    },
    {
      codigo: "cargo",
      etiqueta: "Cargo",
      grupo: "laboral",
      tipo_credencial: "trabajador",
      sensible: false,
      es_personalizado: false,
      descripcion: "Cargo desempeñado",
      valor_ejemplo: "Especialista",
    },
  ];

  async listarCampos(tipo: string = "trabajador"): Promise<CampoCredencial[]> {
    return this.campos.filter((c) => c.tipo_credencial === "todos" || c.tipo_credencial === tipo);
  }

  async crearCampoPersonalizado(campo: {
    codigo: string;
    etiqueta: string;
    grupo?: string;
    tipo_credencial?: string;
    sensible?: boolean;
    descripcion?: string;
    valor_ejemplo?: string;
    origen: string;
  }): Promise<CampoCredencial> {
    const nuevo: CampoCredencial = {
      codigo: campo.codigo,
      etiqueta: campo.etiqueta,
      grupo: (campo.grupo || "personalizado") as CampoCredencial["grupo"],
      tipo_credencial: campo.tipo_credencial || "todos",
      sensible: Boolean(campo.sensible),
      es_personalizado: true,
      descripcion: campo.descripcion || "",
      valor_ejemplo: campo.valor_ejemplo || "",
      origen: campo.origen,
    };
    this.campos.push(nuevo);
    return nuevo;
  }

  async actualizarCampoPersonalizado(
    codigo: string,
    campo: { etiqueta: string; origen: string },
  ): Promise<CampoCredencial> {
    const actual = this.campos.find((c) => c.codigo === codigo);
    if (!actual) throw new Error("no existe");
    actual.etiqueta = campo.etiqueta;
    actual.origen = campo.origen;
    return actual;
  }

  async eliminarCampoPersonalizado(codigo: string): Promise<boolean> {
    this.campos = this.campos.filter((c) => c.codigo !== codigo);
    return true;
  }
}

describe("Casos de uso de Registro de Campos (O44 - E5)", () => {
  it("listarCamposCredencial lista campos autorizados y filtra por tipo", async () => {
    const repo = new RepoCamposMemoria() as unknown as RepoCarnetizacion;
    const camposTrabajador = await listarCamposCredencial(repo, "trabajador");
    expect(camposTrabajador.length).toBe(3);

    const camposPasivo = await listarCamposCredencial(repo, "pasivo");
    expect(camposPasivo.length).toBe(2);
    expect(camposPasivo.map((c) => c.codigo)).not.toContain("cargo");
  });

  it("crearCampoPersonalizado agrega un nuevo campo", async () => {
    const repo = new RepoCamposMemoria() as unknown as RepoCarnetizacion;
    const nuevo = await crearCampoPersonalizado(repo, {
      codigo: "turno",
      etiqueta: "Turno de Guardia",
      grupo: "laboral",
      tipo_credencial: "trabajador",
      sensible: false,
      descripcion: "Turno asignado",
      valor_ejemplo: "Guardia Nocturna",
      origen: "tipo_nomina",
    });

    expect(nuevo.codigo).toBe("turno");
    expect(nuevo.es_personalizado).toBe(true);
    expect(nuevo.sensible).toBe(false);
    expect(nuevo.origen).toBe("tipo_nomina");

    const todos = await listarCamposCredencial(repo, "trabajador");
    expect(todos.length).toBe(4);
  });

  it("actualizarCampoPersonalizado asigna el origen a un campo viejo", async () => {
    const repo = new RepoCamposMemoria();
    repo.campos.push({
      codigo: "viejo",
      etiqueta: "Viejo",
      grupo: "personalizado",
      tipo_credencial: "todos",
      sensible: false,
      es_personalizado: true,
      descripcion: "",
      valor_ejemplo: "",
      origen: "",
    });
    expect(campoSinOrigen(repo.campos[3])).toBe(true);

    const editado = await actualizarCampoPersonalizado(repo as unknown as RepoCarnetizacion, "viejo", {
      etiqueta: "Sexo",
      origen: "sexo",
    });

    expect(editado.origen).toBe("sexo");
    expect(campoSinOrigen(editado)).toBe(false);
    expect(etiquetaOrigenCampo("sexo")).toBe("Sexo");
  });

  it("la lista de orígenes es cerrada y trae los diez datos del expediente", () => {
    expect(ORIGENES_CAMPO.map((o) => o.valor)).toEqual([
      "tipo_sangre",
      "telefono_movil",
      "correo_acceso",
      "correo_alternativo",
      "fecha_ingreso",
      "nivel",
      "tipo_nomina",
      "sexo",
      "fecha_nacimiento",
      "nacionalidad",
    ]);
    expect(etiquetaOrigenCampo("salario")).toBe("");
  });

  it("eliminarCampoPersonalizado elimina el campo por código", async () => {
    const repo = new RepoCamposMemoria() as unknown as RepoCarnetizacion;
    const res = await eliminarCampoPersonalizado(repo, "nombre");
    expect(res).toBe(true);

    const restantes = await listarCamposCredencial(repo, "trabajador");
    expect(restantes.length).toBe(2);
  });
});
