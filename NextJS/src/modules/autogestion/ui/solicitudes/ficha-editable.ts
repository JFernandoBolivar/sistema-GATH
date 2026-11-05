import { formatearTelefono } from "@/shared/domain/validation/telefono";
import type { MiExpedienteDTO } from "../../application/dtos/mi-expediente-dto";

/** Registro vigente de la ficha tal como lo edita el formulario (ids de catálogo + texto resumen). */
export interface FichaRegistro {
  /** Identificador del registro; `null` en los registros únicos. */
  id: string | null;
  valores: Record<string, unknown>;
  resumen: string;
}

const unir = (...partes: (string | null | undefined)[]) =>
  partes.filter(Boolean).join(" · ") || "Sin datos";

/** Datos vigentes por entidad, derivados de «mi expediente». Solo lectura: la ficha no se toca. */
export function registrosFicha(
  d: MiExpedienteDTO,
  entidad: string,
  seccion?: string,
): FichaRegistro[] {
  const e = d.empleado;
  switch (entidad) {
    case "employee":
      if (seccion === "identidad") {
        return [
          {
            id: null,
            valores: {
              nombres: e.nombres,
              apellidos: e.apellidos,
              fecha_nacimiento: e.fecha_nacimiento?.slice(0, 10),
              cedulaidentidad: e.cedula,
              estadoCivil_id: e.estado_civil_id ?? null,
              carnet_patria: e.carnet_patria ?? null,
              carnet_patria_serial: e.carnet_patria_serial ?? null,
            },
            resumen: unir(
              `${e.nombres} ${e.apellidos}`,
              `C.I. ${e.cedula}`,
              e.estado_civil_nombre,
            ),
          },
        ];
      }
      return [
        {
          id: null,
          valores: {
            telefono_movil: e.telefono_movil ?? null,
            telefono_habitacion: e.telefono_habitacion ?? null,
          },
          resumen: unir(
            e.telefono_movil ? `Móvil ${formatearTelefono(e.telefono_movil)}` : null,
            e.telefono_habitacion ? `Habitación ${formatearTelefono(e.telefono_habitacion)}` : null,
          ),
        },
      ];
    case "datos_complementarios": {
      const c = d.datos_complementarios;
      return [
        {
          id: null,
          valores: {
            correo_alternativo: c?.correo_alternativo ?? null,
            tiene_hijos: c?.tiene_hijos ?? null,
          },
          resumen: unir(
            c?.correo_alternativo,
            c?.tiene_hijos === null || c?.tiene_hijos === undefined
              ? null
              : c.tiene_hijos
                ? "Tiene hijos"
                : "No tiene hijos",
          ),
        },
      ];
    }
    case "datos_vivienda": {
      const v = e.datos_vivienda;
      if (!v || !v.estado_id) return [];
      return [
        {
          id: null,
          valores: {
            estado_id: v.estado_id,
            municipio_id: v.municipio_id,
            parroquia_id: v.parroquia_id,
            direccion_exacta: v.direccion_exacta,
            condicion_vivienda_id: v.condicion_vivienda_id,
            codigo_postal_id: v.codigo_postal_id,
          },
          resumen: unir(
            v.estado_nombre,
            v.municipio_nombre,
            v.parroquia_nombre,
            v.direccion_exacta,
          ),
        },
      ];
    }
    case "formacion_academica":
      return (e.formacion_academica ?? []).map((f) => ({
        id: String(f.id),
        valores: {
          nivel_academico_id: f.nivel_academico_id,
          carrera_id: f.carrera_id,
          mencion_id: f.mencion_id,
          institucion_id: f.institucion_id,
        },
        resumen: unir(f.nivel_academico_nombre, f.carrera_nombre, f.institucion_nombre),
      }));
    case "formacion_complementaria":
      return (e.formacion_complementaria ?? []).map((f) => ({
        id: String(f.id),
        valores: {
          capacitacion_id: f.capacitacion_id,
          institucion_id: f.institucion_id,
          fecha_inicio: f.fecha_inicio?.slice(0, 10),
          fecha_fin: f.fecha_fin?.slice(0, 10),
          horas_completadas: f.horas_completadas,
          dias_completados: f.dias_completados,
          grupo_id: f.grupo_id,
        },
        resumen: unir(f.capacitacion_nombre, f.institucion_nombre, f.fecha_inicio),
      }));
    case "contacto_emergencia":
      return (e.contacto_emergencia ?? []).map((c) => ({
        id: String(c.id),
        valores: {
          nombres: c.nombres,
          apellidos: c.apellidos,
          telefono: c.telefono,
          relacion_id: c.relacion_id,
        },
        resumen: unir(
          `${c.nombres} ${c.apellidos}`,
          c.relacion_nombre,
          formatearTelefono(c.telefono),
        ),
      }));
    case "familiar":
      return d.familiares.map((f) => ({
        id: String(f.id),
        valores: {
          primer_nombre: f.primer_nombre,
          segundo_nombre: f.segundo_nombre,
          primer_apellido: f.primer_apellido,
          segundo_apellido: f.segundo_apellido,
          cedula_familiar: f.cedula_familiar,
          parentesco_id: f.parentesco_id,
          fecha_nacimiento: f.fecha_nacimiento?.slice(0, 10),
          sexo_id: f.sexo_id,
          observaciones: f.observaciones,
        },
        resumen: unir(`${f.primer_nombre} ${f.primer_apellido}`, f.parentesco_nombre),
      }));
    case "perfil_salud": {
      const s = e.perfil_salud;
      return [
        {
          id: null,
          valores: {
            grupo_sanguineo_id: s?.grupo_sanguineo_id ?? null,
            alergias: s?.alergias ?? [],
            patologias_cronicas: s?.patologias_cronicas ?? [],
            discapacidades: s?.discapacidades ?? [],
          },
          resumen: unir(
            s?.grupo_sanguineo_nombre ? `Grupo sanguíneo ${s.grupo_sanguineo_nombre}` : null,
            s?.alergias_nombres?.length ? `Alergias: ${s.alergias_nombres.join(", ")}` : null,
            s?.patologias_cronicas_nombres?.length
              ? `Patologías: ${s.patologias_cronicas_nombres.join(", ")}`
              : null,
            s?.discapacidades_nombres?.length
              ? `Discapacidades: ${s.discapacidades_nombres.join(", ")}`
              : null,
          ),
        },
      ];
    }
    case "perfil_fisico": {
      const pf = e.perfil_fisico;
      return [
        {
          id: null,
          valores: {
            talla_camisa_id: pf?.talla_camisa_id ?? null,
            talla_pantalon_id: pf?.talla_pantalon_id ?? null,
            talla_zapatos_id: pf?.talla_zapatos_id ?? null,
            talla_chaqueta_id: pf?.talla_chaqueta_id ?? null,
          },
          resumen: unir(
            pf?.talla_camisa_nombre ? `Camisa ${pf.talla_camisa_nombre}` : null,
            pf?.talla_pantalon_nombre ? `Pantalón ${pf.talla_pantalon_nombre}` : null,
            pf?.talla_zapatos_nombre ? `Zapatos ${pf.talla_zapatos_nombre}` : null,
            pf?.talla_chaqueta_nombre ? `Chaqueta ${pf.talla_chaqueta_nombre}` : null,
          ),
        },
      ];
    }
    default:
      return [];
  }
}
