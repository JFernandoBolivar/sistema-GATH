import { describe, expect, it } from "vitest";
import type { CrearPlantillaBorradorInput, RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import type {
  CampoCredencial,
  Carnet,
  CategoriaBiblioteca,
  ElementoBiblioteca,
  EstadisticasCarnet,
  FichaQr,
  PlantillaCarnet,
  PlantillaMotor,
  PreferenciasPrivacidadCarnet,
  TipoCredencial,
} from "../../domain/entities/carnet";
import { emitirCarnet, listarCarnets } from "./emitir-carnet";
import { obtenerEstadisticas } from "./obtener-estadisticas";
import { validarCarnetPorHash } from "./validar-qr";

function paginaVaciaPrueba<T>() {
  return { resultados: [] as T[], total: 0, pagina: 1, tamano: 12, totalPaginas: 1 };
}

class RepoCarnetizacionMemoria implements RepoCarnetizacion {
  carnets: Carnet[] = [
    {
      id: 1,
      empleadoCedula: "12345678",
      empleadoNombres: "Pedro",
      empleadoApellidos: "Pérez",
      securityHash: "hash-abc-123",
      fechaEmision: "2026-01-01",
      motivoId: 1,
      motivoNombre: "Ingreso",
      activo: true,
      observaciones: null,
    },
  ];
  plantillas: PlantillaCarnet[] = [];

  async listarCarnets(cedula?: string) {
    return cedula ? this.carnets.filter((c) => c.empleadoCedula === cedula) : this.carnets;
  }
  async emitirCarnet(empleadoCedula: string, motivoId: number, observaciones?: string) {
    const c: Carnet = {
      id: 2,
      empleadoCedula,
      empleadoNombres: "Nuevo",
      empleadoApellidos: "Empleado",
      securityHash: "hash-new-456",
      fechaEmision: "2026-08-01",
      motivoId,
      motivoNombre: "Reposición",
      activo: true,
      observaciones: observaciones ?? null,
    };
    this.carnets.push(c);
    return c;
  }
  async validarPorHash(securityHash: string) {
    const carnet = this.carnets.find((c) => c.securityHash === securityHash);
    if (!carnet) return { esValido: false, mensaje: "Carnet no encontrado", carnet: null };
    return { esValido: carnet.activo, mensaje: "Carnet válido", carnet };
  }
  async validarPorId(carnetId: number) {
    const carnet = this.carnets.find((c) => c.id === carnetId);
    if (!carnet) return { esValido: false, mensaje: "Carnet no encontrado", carnet: null };
    return { esValido: carnet.activo, mensaje: "Carnet válido", carnet };
  }
  async listarPlantillas() {
    return this.plantillas;
  }
  async crearPlantilla(nombre: string, _imagen: File, activar?: boolean): Promise<PlantillaCarnet> {
    const p: PlantillaCarnet = {
      id: this.plantillas.length + 1,
      nombre,
      imagenUrl: `/storage/plantillas/${nombre}.png`,
      activo: activar ?? false,
      creado: "2026-08-01",
    };
    this.plantillas.push(p);
    return p;
  }
  async activarPlantilla(plantillaId: number) {
    const p = this.plantillas.find((x) => x.id === plantillaId)!;
    p.activo = true;
    return p;
  }
  async descargarPdf(_carnetId: number) {
    return new Blob(["%PDF-simulado"], { type: "application/pdf" });
  }
  async revocarCarnet(carnetId: number) {
    const c = this.carnets.find((x) => x.id === carnetId)!;
    c.activo = false;
    return c;
  }
  async obtenerEstadisticas(): Promise<EstadisticasCarnet> {
    return {
      total: 2,
      activos: 1,
      revocados: 1,
      emitidosHoy: 1,
      emitidosMes: 2,
      porMotivo: [{ motivoId: 1, motivo: "Ingreso", total: 2 }],
    };
  }
  async obtenerDatosEmpleado(cedula: string) {
    const c = this.carnets.find((x) => x.empleadoCedula === cedula);
    if (!c) return null;
    return {
      cedula: c.empleadoCedula,
      nombres: c.empleadoNombres,
      apellidos: c.empleadoApellidos,
      nombreCompleto: `${c.empleadoNombres} ${c.empleadoApellidos}`,
      cargo: "Especialista",
      departamento: "Tecnología",
    };
  }

  async listarTiposCredencial(): Promise<TipoCredencial[]> {
    return [
      {
        codigo: "trabajador",
        nombre: "Trabajador",
        descripcion: "Credencial de empleado",
        ancho_mm: 54,
        alto_mm: 85.6,
        orientacion: "vertical",
        grupo: "trabajador",
        activo: true,
        orden: 1,
      },
    ];
  }

  async listarPlantillasMotorPagina() {
    return paginaVaciaPrueba<PlantillaMotor>();
  }
  async listarFondosFijos() {
    return paginaVaciaPrueba<PlantillaCarnet>();
  }
  async eliminarFondoFijo(): Promise<void> {}
  async listarBibliotecaPagina() {
    return paginaVaciaPrueba<ElementoBiblioteca>();
  }
  async listarPlantillasMotor(): Promise<PlantillaMotor[]> {
    return [];
  }

  async obtenerPlantillaMotor(id: string): Promise<PlantillaMotor> {
    return {
      id,
      nombre: "Plantilla Base",
      codigo_tipo: "trabajador",
      ancho_mm: 54,
      alto_mm: 85.6,
      orientacion: "vertical",
      regla_criterio: "todos",
      regla_valor: "*",
      estado: "publicada",
      activa: true,
      version: 1,
      definicion: {},
      creado: "2026-01-01",
      actualizado: "2026-01-01",
    };
  }

  async crearPlantillaBorrador(input: CrearPlantillaBorradorInput): Promise<PlantillaMotor> {
    return {
      id: "nueva-id",
      nombre: input.nombre,
      codigo_tipo: input.codigo_tipo ?? "trabajador",
      ancho_mm: input.ancho_mm ?? 54,
      alto_mm: input.alto_mm ?? 85.6,
      orientacion: input.orientacion ?? "vertical",
      regla_criterio: input.regla_criterio ?? "todos",
      regla_valor: input.regla_valor ?? "*",
      estado: "borrador",
      activa: false,
      version: 1,
      definicion: input.definicion ?? {},
      creado: "2026-01-01",
      actualizado: "2026-01-01",
    };
  }

  async actualizarPlantillaBorrador(id: string, input: Partial<CrearPlantillaBorradorInput>): Promise<PlantillaMotor> {
    return {
      id,
      nombre: input.nombre ?? "Actualizada",
      codigo_tipo: input.codigo_tipo ?? "trabajador",
      ancho_mm: input.ancho_mm ?? 54,
      alto_mm: input.alto_mm ?? 85.6,
      orientacion: input.orientacion ?? "vertical",
      regla_criterio: input.regla_criterio ?? "todos",
      regla_valor: input.regla_valor ?? "*",
      estado: "borrador",
      activa: false,
      version: 1,
      definicion: input.definicion ?? {},
      creado: "2026-01-01",
      actualizado: "2026-01-01",
    };
  }

  async eliminarPlantillaMotor(): Promise<void> {
    return;
  }

  async publicarPlantilla(id: string): Promise<PlantillaMotor> {
    return {
      id,
      nombre: "Publicada",
      codigo_tipo: "trabajador",
      ancho_mm: 54,
      alto_mm: 85.6,
      orientacion: "vertical",
      regla_criterio: "todos",
      regla_valor: "*",
      estado: "publicada",
      activa: true,
      version: 2,
      definicion: {},
      creado: "2026-01-01",
      actualizado: "2026-01-01",
    };
  }

  async activarPlantillaMotor(id: string): Promise<PlantillaMotor> {
    return {
      id,
      nombre: "Activa",
      codigo_tipo: "trabajador",
      ancho_mm: 54,
      alto_mm: 85.6,
      orientacion: "vertical",
      regla_criterio: "todos",
      regla_valor: "*",
      estado: "publicada",
      activa: true,
      version: 1,
      definicion: {},
      creado: "2026-01-01",
      actualizado: "2026-01-01",
    };
  }

  async listarVersionesPlantilla(): Promise<PlantillaMotor[]> {
    return [];
  }

  async obtenerPlantillaActiva(): Promise<PlantillaMotor> {
    return {
      id: "activa-id",
      nombre: "Activa Oficial",
      codigo_tipo: "trabajador",
      ancho_mm: 54,
      alto_mm: 85.6,
      orientacion: "vertical",
      regla_criterio: "todos",
      regla_valor: "*",
      estado: "publicada",
      activa: true,
      version: 1,
      definicion: {},
      creado: "2026-01-01",
      actualizado: "2026-01-01",
    };
  }

  biblioteca: ElementoBiblioteca[] = [];

  async listarBiblioteca(categoria?: CategoriaBiblioteca): Promise<ElementoBiblioteca[]> {
    return categoria ? this.biblioteca.filter((b) => b.categoria === categoria) : this.biblioteca;
  }

  async subirElementoBiblioteca(
    nombre: string,
    categoria: CategoriaBiblioteca,
    _archivo: File,
    descripcion?: string
  ): Promise<ElementoBiblioteca> {
    const item: ElementoBiblioteca = {
      id: "elem-test-1",
      nombre,
      categoria,
      archivo_url: "/api/v1/carnetizacion/biblioteca/elem-test-1/archivo/",
      tamano_bytes: 1024,
      mime_type: "image/png",
      ancho_px: 200,
      alto_px: 100,
      descripcion: descripcion ?? null,
      creado: "2026-01-01",
    };
    this.biblioteca.push(item);
    return item;
  }

  async eliminarElementoBiblioteca(id: string): Promise<boolean> {
    this.biblioteca = this.biblioteca.filter((b) => b.id !== id);
    return true;
  }

  campos: CampoCredencial[] = [];

  async listarCampos(): Promise<CampoCredencial[]> {
    return this.campos;
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
    const c: CampoCredencial = {
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
    this.campos.push(c);
    return c;
  }

  async actualizarCampoPersonalizado(
    codigo: string,
    campo: { etiqueta: string; origen: string },
  ): Promise<CampoCredencial> {
    const c = this.campos.find((x) => x.codigo === codigo);
    if (!c) throw new Error("no existe");
    c.etiqueta = campo.etiqueta;
    c.origen = campo.origen;
    return c;
  }

  async eliminarCampoPersonalizado(codigo: string): Promise<boolean> {
    this.campos = this.campos.filter((c) => c.codigo !== codigo);
    return true;
  }

  async consultarFichaQr(securityHash: string): Promise<FichaQr> {
    const c = this.carnets.find((item) => item.securityHash === securityHash);
    return {
      esValido: Boolean(c?.activo),
      estado: c?.activo ? "VIGENTE" : "ANULADO",
      mensaje: c?.activo ? "Carnet vigente" : "Carnet anulado",
      securityHash,
      nivelAcceso: "PUBLICO",
      datos: c
        ? {
            nombre: `${c.empleadoNombres} ${c.empleadoApellidos}`,
            cargo: "Analista",
            ubicacion: "Gestión Humana",
            contactos_emergencia: [],
          }
        : null,
      saludDisponible: true,
      fechaEmision: c?.fechaEmision ?? null,
      fechaVencimiento: null,
    };
  }

  async consultarSaludEmergencia(securityHash: string): Promise<FichaQr> {
    const ficha = await this.consultarFichaQr(securityHash);
    if (ficha.datos) {
      ficha.datos.salud = { alergias: ["ninguna"], patologias: [], discapacidades: [] };
    }
    return ficha;
  }

  async obtenerPreferenciasPrivacidad(): Promise<PreferenciasPrivacidadCarnet> {
    return {};
  }

  async guardarPreferenciasPrivacidad(preferencias: PreferenciasPrivacidadCarnet): Promise<PreferenciasPrivacidadCarnet> {
    return preferencias;
  }
}

describe("Casos de uso de Carnetización", () => {
  it("listarCarnets y emitirCarnet operan sobre el dominio", async () => {
    const repo = new RepoCarnetizacionMemoria();
    const lista = await listarCarnets(repo);
    expect(lista.length).toBe(1);

    const nuevo = await emitirCarnet(repo, "87654321", 2, "Carnet de reposición");
    expect(nuevo.empleadoCedula).toBe("87654321");
    expect(nuevo.activo).toBe(true);
  });

  it("validarCarnetPorHash verifica autenticidad del carnet", async () => {
    const repo = new RepoCarnetizacionMemoria();
    const resValido = await validarCarnetPorHash(repo, "hash-abc-123");
    expect(resValido.esValido).toBe(true);
    expect(resValido.carnet?.empleadoNombres).toBe("Pedro");

    const resInvalido = await validarCarnetPorHash(repo, "hash-falso");
    expect(resInvalido.esValido).toBe(false);
    expect(resInvalido.carnet).toBeNull();
  });

  it("obtenerEstadisticas retorna el consolidado por motivo", async () => {
    const repo = new RepoCarnetizacionMemoria();
    const stats = await obtenerEstadisticas(repo);
    expect(stats.total).toBe(2);
    expect(stats.porMotivo).toHaveLength(1);
    expect(stats.porMotivo[0].motivo).toBe("Ingreso");
  });
});
