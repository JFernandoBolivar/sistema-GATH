import { etiquetaCampo } from "@/modules/autogestion/domain/value-objects/campos-seccion";
import type { CambioEntity, FichaPasivoEntity } from "../../domain/entities/fe-de-vida";
import { edadEn, oficinaDeAdscripcion } from "../../domain/services/reglas";
import { formatearFechaCivil } from "../comun/formato";

/**
 * Modelo de la ficha completa del pasivo para quien revisa: datos actuales del sistema + lo que el pasivo
 * DECLARA en el acta. El dato principal es siempre el valor declarado; el comparativo se reduce a una marca
 * («Nuevo» o «Modificado» con el valor anterior), porque al aprobar el acta reemplaza al expediente (C19).
 * Puro: sin React ni red; los nombres de catálogo llegan por `formatear`.
 */

export type MarcaCambio = { tipo: "nuevo" } | { tipo: "modificado"; anterior: string };

export interface DatoRevision {
  clave: string;
  etiqueta: string;
  /** `null` = sin dato. */
  valor: string | null;
  marca?: MarcaCambio;
  /** La ficha cambió después de que el pasivo propuso el valor. */
  conflicto?: boolean;
}

export interface FilaRevision {
  id: string;
  celdas: string[];
  marca?: "nuevo" | "modificado";
  /** Cambios sueltos de un registro existente, ya con su etiqueta («Teléfono: 0414… (antes: 0412…)»). */
  detalles: string[];
}

export interface TablaRevision {
  id: string;
  titulo: string;
  columnas: string[];
  filas: FilaRevision[];
  vacio: string;
}

export interface SeccionRevision {
  id: string;
  titulo: string;
  datos: DatoRevision[];
  tablas: TablaRevision[];
}

/** Convierte el valor declarado (puede ser un código de catálogo) en texto con su nombre. */
export type Formateador = (valor: unknown, campo: string) => string;

export interface EntradaModelo {
  ficha: FichaPasivoEntity | null;
  cambios: readonly CambioEntity[];
  formatear: Formateador;
  hoy: Date;
}

const vacio = (v: unknown): boolean => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const limpio = (v: string | null | undefined): string | null => (vacio(v) ? null : (v as string).trim());
const unir = (...partes: Array<string | null | undefined>): string | null => limpio(partes.filter((p) => !vacio(p)).join(" "));

/** Declarado frente a lo que hay hoy: sin cambio no hay marca; sin dato previo es «Nuevo». */
function marcar(actual: string | null, declarado: string | null): MarcaCambio | undefined {
  if (declarado === actual) return undefined;
  return actual ? { tipo: "modificado", anterior: actual } : { tipo: "nuevo" };
}

class Constructor {
  private readonly unicos = new Map<string, CambioEntity>();
  private readonly registros: CambioEntity[] = [];
  private readonly usados = new Set<string>();

  constructor(private readonly e: EntradaModelo) {
    for (const c of e.cambios) {
      if (c.entidad === "familiar" || c.entidad === "contacto_emergencia") this.registros.push(c);
      else if (c.campo === "*" && c.valorPropuesto && typeof c.valorPropuesto === "object") {
        // Registro único que aún no existía (p. ej. la vivienda): cada campo declarado es un dato nuevo.
        for (const [campo, valor] of Object.entries(objeto(c.valorPropuesto))) {
          this.unicos.set(`${c.entidad}.${campo}`, { ...c, id: `${c.id}-${campo}`, campo, valorPropuesto: valor, valorActual: null });
        }
      } else this.unicos.set(`${c.entidad}.${c.campo}`, c);
    }
  }

  /** Dato de entidad única (empleado, vivienda, complementarios) con su cambio declarado, si lo hay. */
  dato(
    clave: string,
    etiqueta: string,
    actual: string | null,
    opciones: { formato?: (v: string) => string; sufijo?: (declarado: string) => string } = {},
  ): DatoRevision {
    const cambio = this.unicos.get(clave);
    if (!cambio) return { clave, etiqueta, valor: opciones.sufijo && actual ? opciones.sufijo(actual) : actual };
    this.usados.add(clave);
    const crudo = vacio(cambio.valorPropuesto) ? null : this.e.formatear(cambio.valorPropuesto, cambio.campo);
    const declarado = crudo && opciones.formato ? opciones.formato(crudo) : crudo;
    const marca = marcar(actual, declarado);
    const valor = declarado && opciones.sufijo ? opciones.sufijo(declarado) : declarado;
    return { clave, etiqueta, valor, marca, conflicto: cambio.conflicto || undefined };
  }

  /** Cambios de registros (familiares, contactos de emergencia) que ningún renglón existente absorbió. */
  registrosDe(entidad: string): CambioEntity[] {
    return this.registros.filter((c) => c.entidad === entidad);
  }

  sinUsar(): CambioEntity[] {
    return [
      ...[...this.unicos.entries()].filter(([clave]) => !this.usados.has(clave)).map(([, c]) => c),
      ...this.registros.filter((c) => !this.usados.has(`reg:${c.id}`)),
    ];
  }

  usarRegistro(c: CambioEntity): void {
    this.usados.add(`reg:${c.id}`);
  }

  private esRegistro(c: CambioEntity): boolean {
    return c.entidad === "familiar" || c.entidad === "contacto_emergencia";
  }
}

function lineaDeCambio(c: CambioEntity, formatear: Formateador): string {
  const declarado = vacio(c.valorPropuesto) ? "sin dato" : formatear(c.valorPropuesto, c.campo);
  const antes = vacio(c.valorActual) ? null : formatear(c.valorActual, c.campo);
  return `${etiquetaCampo(c.campo, c.entidad)}: ${declarado}${antes ? ` (antes: ${antes})` : ""}`;
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function tablaFamiliares(k: Constructor, e: EntradaModelo): TablaRevision {
  const filas: FilaRevision[] = (e.ficha?.familiares ?? []).map((f) => {
    const propios = k.registrosDe("familiar").filter((c) => c.accion !== "CREAR" && c.entidadId === f.id);
    propios.forEach((c) => k.usarRegistro(c));
    return {
      id: `fam-${f.id}`,
      celdas: [f.nombre, f.parentesco ?? "", f.cedula ?? "", f.fechaNacimiento ? formatearFechaCivil(f.fechaNacimiento) : ""],
      marca: propios.length ? "modificado" : undefined,
      detalles: propios.map((c) => lineaDeCambio(c, e.formatear)),
    };
  });
  for (const c of k.registrosDe("familiar").filter((x) => x.accion === "CREAR")) {
    k.usarRegistro(c);
    const v = objeto(c.valorPropuesto);
    const f = (campo: string) => (vacio(v[campo]) ? "" : e.formatear(v[campo], campo));
    filas.push({
      id: `fam-nuevo-${c.id}`,
      celdas: [
        unir(f("primer_nombre"), f("segundo_nombre"), f("primer_apellido"), f("segundo_apellido")) ?? "",
        f("parentesco_id"),
        f("cedula_familiar"),
        v.fecha_nacimiento ? formatearFechaCivil(String(v.fecha_nacimiento)) : "",
      ],
      marca: "nuevo",
      detalles: [],
    });
  }
  return {
    id: "familiares",
    titulo: "Familiares e hijos",
    columnas: ["Nombre", "Parentesco", "Cédula", "Fecha de nacimiento"],
    filas,
    vacio: "No hay familiares registrados ni declarados.",
  };
}

function tablaEmergencia(k: Constructor, e: EntradaModelo): TablaRevision {
  const filas: FilaRevision[] = (e.ficha?.contactosEmergencia ?? []).map((c) => {
    const propios = k.registrosDe("contacto_emergencia").filter((x) => x.accion !== "CREAR" && x.entidadId === c.id);
    propios.forEach((x) => k.usarRegistro(x));
    return {
      id: `emer-${c.id}`,
      celdas: [unir(c.nombres, c.apellidos) ?? "", c.parentesco ?? "", c.telefono ?? ""],
      marca: propios.length ? "modificado" : undefined,
      detalles: propios.map((x) => lineaDeCambio(x, e.formatear)),
    };
  });
  for (const c of k.registrosDe("contacto_emergencia").filter((x) => x.accion === "CREAR")) {
    k.usarRegistro(c);
    const v = objeto(c.valorPropuesto);
    const f = (campo: string) => (vacio(v[campo]) ? "" : e.formatear(v[campo], campo));
    filas.push({
      id: `emer-nuevo-${c.id}`,
      celdas: [unir(f("nombres"), f("apellidos")) ?? "", f("relacion_id"), f("telefono")],
      marca: "nuevo",
      detalles: [],
    });
  }
  return {
    id: "emergencia",
    titulo: "Contacto de emergencia",
    columnas: ["Nombre", "Parentesco", "Teléfono"],
    filas,
    vacio: "No hay contacto de emergencia registrado ni declarado.",
  };
}

/** Las cinco secciones de la planilla, en su orden, más «Otros datos» si el acta propone algo fuera de ellas. */
export function construirSecciones(entrada: EntradaModelo): SeccionRevision[] {
  const { ficha, hoy } = entrada;
  const k = new Constructor(entrada);
  const v = ficha?.vivienda ?? null;
  const asig = ficha?.asignacion ?? null;

  const personales: SeccionRevision = {
    id: "personales",
    titulo: "Datos personales",
    datos: [
      { clave: "cedula", etiqueta: "Cédula", valor: limpio(ficha?.cedula) },
      k.dato("employee.nombres", "Nombres", limpio(ficha?.nombres)),
      k.dato("employee.apellidos", "Apellidos", limpio(ficha?.apellidos)),
      k.dato("employee.fecha_nacimiento", "Fecha de nacimiento", limpio(ficha?.fechaNacimiento) && formatearFechaCivil(ficha?.fechaNacimiento), {
        formato: (d) => formatearFechaCivil(d),
        sufijo: (d) => {
          // La edad se calcula sobre la fecha declarada (ISO), no sobre el texto ya formateado.
          const cambio = entrada.cambios.find((c) => c.entidad === "employee" && c.campo === "fecha_nacimiento");
          const iso = cambio && typeof cambio.valorPropuesto === "string" ? cambio.valorPropuesto : ficha?.fechaNacimiento;
          const edad = edadEn(iso, hoy);
          return edad === null ? d : `${d} (${edad} años)`;
        },
      }),
      { clave: "sexo", etiqueta: "Sexo", valor: limpio(ficha?.sexo) },
    ],
    tablas: [],
  };

  const pension: SeccionRevision = {
    id: "pension",
    titulo: "Datos de la pensión",
    datos: [
      { clave: "tipo", etiqueta: "Tipo de pensión o jubilación", valor: limpio(asig?.tipoNomina) },
      { clave: "cargo", etiqueta: "Cargo", valor: limpio(asig?.cargo) },
      {
        clave: "oficina",
        etiqueta: "Oficina de adscripción",
        valor: asig
          ? oficinaDeAdscripcion({
              dependencia: asig.dependencia,
              direccion_general: asig.direccionGeneral,
              direccion_linea: asig.direccionLinea,
              coordinacion: asig.coordinacion,
            })
          : null,
      },
      { clave: "ingreso", etiqueta: "Fecha de ingreso", valor: ficha?.fechaIngreso ? formatearFechaCivil(ficha.fechaIngreso) : null },
      { clave: "egreso", etiqueta: "Fecha de egreso", valor: ficha?.fechaEgreso ? formatearFechaCivil(ficha.fechaEgreso) : null },
    ],
    tablas: [],
  };

  const contacto: SeccionRevision = {
    id: "contacto",
    titulo: "Contacto",
    datos: [
      { clave: "correo", etiqueta: "Correo principal", valor: limpio(ficha?.correo) },
      k.dato("datos_complementarios.correo_alternativo", "Correo alternativo", limpio(ficha?.correoAlternativo)),
      k.dato("employee.telefono_movil", "Teléfono móvil", limpio(ficha?.telefonoMovil)),
      k.dato("employee.telefono_habitacion", "Teléfono de habitación", limpio(ficha?.telefonoHabitacion)),
    ],
    tablas: [tablaEmergencia(k, entrada)],
  };

  const vivienda: SeccionRevision = {
    id: "vivienda",
    titulo: "Vivienda",
    datos: [
      k.dato("datos_vivienda.estado_id", "Estado", limpio(v?.estado)),
      k.dato("datos_vivienda.municipio_id", "Municipio", limpio(v?.municipio)),
      k.dato("datos_vivienda.parroquia_id", "Parroquia", limpio(v?.parroquia)),
      k.dato("datos_vivienda.codigo_postal_id", "Código postal", limpio(v?.codigoPostal)),
      k.dato("datos_vivienda.direccion_exacta", "Dirección", limpio(v?.direccion)),
      k.dato("datos_vivienda.condicion_vivienda_id", "Condición de la vivienda", limpio(v?.condicion)),
    ],
    tablas: [],
  };

  const familia: SeccionRevision = {
    id: "familia",
    titulo: "Grupo familiar e hijos",
    datos: [
      k.dato(
        "datos_complementarios.tiene_hijos",
        "¿Tiene hijos?",
        ficha?.tieneHijos === null || ficha?.tieneHijos === undefined ? null : ficha.tieneHijos ? "Sí" : "No",
      ),
    ],
    tablas: [tablaFamiliares(k, entrada)],
  };

  const secciones = [personales, pension, contacto, vivienda, familia];
  const otros = k.sinUsar();
  if (otros.length > 0) {
    secciones.push({
      id: "otros",
      titulo: "Otros datos propuestos",
      datos: otros.flatMap((c): DatoRevision[] => {
        // Un registro nuevo llega como objeto: cada campo va aparte, con su etiqueta (nunca unidos con «·»).
        if (c.valorPropuesto && typeof c.valorPropuesto === "object") {
          return Object.entries(objeto(c.valorPropuesto))
            .filter(([, v]) => !vacio(v))
            .map(([campo, v]) => ({
              clave: `${c.entidad}.${campo}.${c.id}`,
              etiqueta: etiquetaCampo(campo, c.entidad),
              valor: entrada.formatear(v, campo),
              marca: { tipo: "nuevo" as const },
            }));
        }
        const declarado = vacio(c.valorPropuesto) ? null : entrada.formatear(c.valorPropuesto, c.campo);
        const actual = vacio(c.valorActual) ? null : entrada.formatear(c.valorActual, c.campo);
        return [
          {
            clave: `${c.entidad}.${c.campo}.${c.id}`,
            etiqueta: etiquetaCampo(c.campo, c.entidad),
            valor: declarado,
            marca: marcar(actual, declarado),
            conflicto: c.conflicto || undefined,
          },
        ];
      }),
      tablas: [],
    });
  }
  return secciones;
}
