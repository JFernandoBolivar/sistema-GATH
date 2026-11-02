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
export function registrosFicha(d: MiExpedienteDTO, entidad: string): FichaRegistro[] {
  const e = d.empleado;
  switch (entidad) {
    case "employee":
      return [
        {
          id: null,
          valores: {
            telefono_movil: e.telefono_movil ?? null,
            telefono_habitacion: e.telefono_habitacion ?? null,
          },
          resumen: unir(
            e.telefono_movil ? `Móvil ${e.telefono_movil}` : null,
            e.telefono_habitacion ? `Habitación ${e.telefono_habitacion}` : null,
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
    case "contacto_emergencia":
      return (e.contacto_emergencia ?? []).map((c) => ({
        id: String(c.id),
        valores: {
          nombres: c.nombres,
          apellidos: c.apellidos,
          telefono: c.telefono,
          relacion_id: c.relacion_id,
        },
        resumen: unir(`${c.nombres} ${c.apellidos}`, c.relacion_nombre, c.telefono),
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
    default:
      return [];
  }
}
