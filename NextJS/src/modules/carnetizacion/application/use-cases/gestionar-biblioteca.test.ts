import { describe, expect, it } from "vitest";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import type { CategoriaBiblioteca, ElementoBiblioteca } from "../../domain/entities/carnet";
import {
  eliminarElementoBiblioteca,
  listarBiblioteca,
  subirElementoBiblioteca,
} from "./gestionar-biblioteca";

class RepoBibliotecaMemoria implements Partial<RepoCarnetizacion> {
  elementos: ElementoBiblioteca[] = [
    {
      id: "elem-1",
      nombre: "Logo Conatel",
      categoria: "logo",
      archivo_url: "/api/v1/carnetizacion/biblioteca/elem-1/archivo/",
      tamano_bytes: 5000,
      mime_type: "image/png",
      ancho_px: 300,
      alto_px: 120,
      descripcion: "Logo institucional",
      creado: "2026-01-01",
    },
    {
      id: "elem-2",
      nombre: "Firma Director",
      categoria: "firma",
      archivo_url: "/api/v1/carnetizacion/biblioteca/elem-2/archivo/",
      tamano_bytes: 2500,
      mime_type: "image/png",
      ancho_px: 250,
      alto_px: 80,
      descripcion: null,
      creado: "2026-01-01",
    },
  ];

  async listarBiblioteca(categoria?: string): Promise<ElementoBiblioteca[]> {
    return categoria ? this.elementos.filter((e) => e.categoria === categoria) : this.elementos;
  }

  async subirElementoBiblioteca(
    nombre: string,
    categoria: CategoriaBiblioteca,
    _archivo: File,
    descripcion?: string
  ): Promise<ElementoBiblioteca> {
    const nuevo: ElementoBiblioteca = {
      id: `elem-${this.elementos.length + 1}`,
      nombre,
      categoria,
      archivo_url: `/api/v1/carnetizacion/biblioteca/elem-${this.elementos.length + 1}/archivo/`,
      tamano_bytes: 1500,
      mime_type: "image/svg+xml",
      ancho_px: null,
      alto_px: null,
      descripcion: descripcion ?? null,
      creado: "2026-01-02",
    };
    this.elementos.push(nuevo);
    return nuevo;
  }

  async eliminarElementoBiblioteca(id: string): Promise<boolean> {
    this.elementos = this.elementos.filter((e) => e.id !== id);
    return true;
  }
}

describe("Casos de uso de Biblioteca de Medios (O44 - E4)", () => {
  it("listarBiblioteca lista todos o filtra por categoría", async () => {
    const repo = new RepoBibliotecaMemoria() as unknown as RepoCarnetizacion;
    const todos = await listarBiblioteca(repo);
    expect(todos.length).toBe(2);

    const soloLogos = await listarBiblioteca(repo, "logo");
    expect(soloLogos.length).toBe(1);
    expect(soloLogos[0].nombre).toBe("Logo Conatel");

    const soloFirmas = await listarBiblioteca(repo, "firma");
    expect(soloFirmas.length).toBe(1);
    expect(soloFirmas[0].categoria).toBe("firma");
  });

  it("subirElementoBiblioteca agrega el elemento a la biblioteca", async () => {
    const repo = new RepoBibliotecaMemoria() as unknown as RepoCarnetizacion;
    const dummyFile = new File(["<svg></svg>"], "sello.svg", { type: "image/svg+xml" });

    const nuevo = await subirElementoBiblioteca(repo, "Sello Auditoría", "imagen", dummyFile, "Sello oficial");
    expect(nuevo.id).toBe("elem-3");
    expect(nuevo.nombre).toBe("Sello Auditoría");
    expect(nuevo.categoria).toBe("imagen");

    const todos = await listarBiblioteca(repo);
    expect(todos.length).toBe(3);
  });

  it("eliminarElementoBiblioteca retira el elemento por ID", async () => {
    const repo = new RepoBibliotecaMemoria() as unknown as RepoCarnetizacion;
    const ok = await eliminarElementoBiblioteca(repo, "elem-1");
    expect(ok).toBe(true);

    const restantes = await listarBiblioteca(repo);
    expect(restantes.length).toBe(1);
    expect(restantes[0].id).toBe("elem-2");
  });
});
