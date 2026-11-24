import type {
  EnvioDTO,
  ExpedienteDTO,
  FaltanteDTO,
  FotoDTO,
  MiExpedienteDTO,
  SesionInvitadoDTO,
  Ventana2DTO,
} from "../../application/dtos/postulacion-dto";
import type { CarreraCatalogo, CatalogosVentana2, MencionCatalogo, OpcionCatalogo, ParentescoCatalogo, TallaCatalogo } from "../../domain/ventana2";

type Crudo = Record<string, unknown>;

const texto = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const textoONulo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const objeto = (v: unknown): Crudo =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Crudo) : {};

export function mapearExpediente(crudo: unknown): ExpedienteDTO {
  const e = objeto(crudo);
  const obs = e.ultima_observacion ? objeto(e.ultima_observacion) : null;
  return {
    id: texto(e.id),
    numero: texto(e.numero),
    estado: texto(e.estado),
    ventana: Number(e.ventana ?? 1),
    venceEl: textoONulo(e.vence_el),
    observaciones: texto(e.observaciones),
    fechaApertura: textoONulo(e.fecha_apertura),
    ultimaObservacion: obs ? { motivo: texto(obs.motivo), fecha: textoONulo(obs.fecha) } : null,
  };
}

export function mapearFaltantes(crudo: unknown): FaltanteDTO[] {
  if (!Array.isArray(crudo)) return [];
  return crudo.map((f) => {
    const o = objeto(f);
    return { seccion: texto(o.seccion), campo: texto(o.campo), mensaje: texto(o.mensaje) };
  });
}

function mapearFoto(crudo: unknown): FotoDTO {
  const f = objeto(crudo);
  return {
    tiene: f.tiene === true,
    subidaEl: textoONulo(f.subida_el),
    tamano: typeof f.tamano === "number" ? f.tamano : null,
  };
}

export function mapearVentana2(crudo: unknown): Ventana2DTO {
  const d = objeto(crudo);
  return {
    expediente: mapearExpediente(d.expediente),
    datos: objeto(d.datos_ventana2),
    faltantes: mapearFaltantes(d.faltantes),
    completa: d.completa === true,
    foto: mapearFoto(d.foto),
  };
}

const opciones = (v: unknown, campo = "nombre"): OpcionCatalogo[] =>
  Array.isArray(v) ? v.map((o) => ({ id: Number(objeto(o).id), nombre: texto(objeto(o)[campo]) })) : [];

const tallas = (v: unknown): TallaCatalogo[] =>
  Array.isArray(v)
    ? v.map((o) => {
        const t = objeto(o);
        return { id: Number(t.id), valor: texto(t.valor), region: texto(t.region) };
      })
    : [];

const carreras = (v: unknown): CarreraCatalogo[] =>
  Array.isArray(v)
    ? v.map((o) => {
        const c = objeto(o);
        return { id: Number(c.id), nombre: texto(c.nombre), nivelAcademicoId: typeof c.nivel_academico_id === "number" ? c.nivel_academico_id : null };
      })
    : [];

const menciones = (v: unknown): MencionCatalogo[] =>
  Array.isArray(v)
    ? v.map((o) => {
        const c = objeto(o);
        return { id: Number(c.id), nombre: texto(c.nombre), carreraId: Number(c.carrera_id) };
      })
    : [];

export function mapearCatalogosVentana2(crudo: unknown): CatalogosVentana2 {
  const d = objeto(crudo);
  const t = objeto(d.tallas);
  const parentescos: ParentescoCatalogo[] = Array.isArray(d.parentescos)
    ? d.parentescos.map((p) => {
        const o = objeto(p);
        return {
          id: Number(o.id),
          nombre: texto(o.nombre),
          esHijo: o.es_hijo === true,
          menorACargo: o.menor_a_cargo === true,
          sinCedulaHastaEdad: typeof o.sin_cedula_hasta_edad === "number" ? o.sin_cedula_hasta_edad : null,
          permiteOrdenHijo: o.permite_orden_hijo === true,
        };
      })
    : [];
  return {
    parentescos,
    sexos: opciones(d.sexos),
    condicionesVivienda: opciones(d.condiciones_vivienda),
    estados: opciones(d.estados),
    municipios: opciones(d.municipios),
    parroquias: opciones(d.parroquias),
    gruposSanguineos: opciones(d.grupos_sanguineos),
    alergias: opciones(d.alergias),
    patologiasCronicas: opciones(d.patologias_cronicas),
    discapacidades: opciones(d.discapacidades),
    tallas: { camisa: tallas(t.camisa), pantalon: tallas(t.pantalon), calzado: tallas(t.calzado), chaqueta: tallas(t.chaqueta) },
    nivelesAcademicos: opciones(d.niveles_academicos),
    carreras: carreras(d.carreras),
    menciones: menciones(d.menciones),
    instituciones: opciones(d.instituciones),
    capacitaciones: opciones(d.capacitaciones),
    organismos: opciones(d.organismos),
    idiomas: opciones(d.idiomas),
  };
}

export function mapearMiExpediente(crudo: unknown): MiExpedienteDTO {
  const d = objeto(crudo);
  const p = objeto(d.postulante);
  return {
    expediente: mapearExpediente(d.expediente),
    postulante: {
      cedula: texto(p.cedula),
      nombres: texto(p.nombres),
      apellidos: texto(p.apellidos),
      correo: texto(p.correo),
      telefonoMovil: texto(p.telefono_movil),
    },
    datosVentana1: objeto(d.datos_ventana1),
    camposPendientes: Array.isArray(d.campos_pendientes) ? d.campos_pendientes.map(texto) : [],
    formulario: d.formulario === "ventana1" || d.formulario === "ventana2" ? d.formulario : null,
    datosVentana2: objeto(d.datos_ventana2),
    tieneFoto: d.tiene_foto === true,
    faltantesVentana2: mapearFaltantes(d.faltantes_ventana2),
  };
}

export function mapearSesionInvitado(crudo: unknown): SesionInvitadoDTO {
  const d = objeto(crudo);
  const e = objeto(d.expediente);
  return {
    token: texto(d.token),
    scope: texto(d.scope),
    expiraEl: texto(d.expira_el),
    expiraEnSegundos: Number(d.expira_en_segundos ?? 0),
    debeCambiarClave: d.debe_cambiar_clave === true,
    expediente: {
      id: texto(e.id),
      numero: texto(e.numero),
      estado: texto(e.estado),
      ventana: Number(e.ventana ?? 1),
      venceEl: textoONulo(e.vence_el),
    },
  };
}

export function mapearEnvio(crudo: unknown): EnvioDTO {
  const d = objeto(crudo);
  return { sesionCerrada: d.sesion_cerrada === true, expediente: mapearExpediente(d.expediente) };
}
