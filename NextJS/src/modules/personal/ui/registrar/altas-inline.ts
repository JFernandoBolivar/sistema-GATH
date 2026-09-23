/**
 * Opción "Otra" del wizard de registro: recolecta las altas inline pendientes
 * (id `-1` + `nueva_*_nombre`) de formación académica y complementaria, y
 * aplica los ids que devuelve `resolverAltasInlineAction`, como hacía el
 * legado en `formStepActions.ts` antes de registrar al trabajador.
 */
import type { SolicitudAltaInline } from "../../application/use-cases/resolver-altas-inline";
import { ID_OTRA } from "../catalogo-otra";
import type { RegistroPasosType } from "../schema/schema-registro-pasos";

type Asignar = (v: RegistroPasosType, id: number) => void;

export function recolectarAltasInline(valores: RegistroPasosType) {
  const solicitudes: SolicitudAltaInline[] = [];
  const asignaciones: Asignar[] = [];
  const pedir = (s: SolicitudAltaInline, asignar: Asignar) => {
    solicitudes.push(s);
    asignaciones.push(asignar);
  };

  (valores.formacion_academica ?? []).forEach((f, i) => {
    if (f.carrera_id === ID_OTRA) {
      pedir({ tipo: "carreras", nombre: f.nueva_carrera_nombre ?? "", padreId: f.nivel_Academico_id }, (v, id) => {
        v.formacion_academica![i].carrera_id = id;
      });
    }
    if (f.mencion_id === ID_OTRA) {
      pedir({ tipo: "menciones", nombre: f.nueva_mencion_nombre ?? "", padreId: f.carrera_id }, (v, id) => {
        v.formacion_academica![i].mencion_id = id;
      });
    }
    if (f.institucion_id === ID_OTRA) {
      pedir({ tipo: "instituciones", nombre: f.nueva_institucion_nombre ?? "" }, (v, id) => {
        v.formacion_academica![i].institucion_id = id;
      });
    }
  });

  (valores.formacion_complementaria ?? []).forEach((f, i) => {
    if (f.capacitacion_id === ID_OTRA) {
      pedir({ tipo: "capacitaciones", nombre: f.nueva_capacitacion_nombre ?? "" }, (v, id) => {
        v.formacion_complementaria![i].capacitacion_id = id;
      });
    }
    if (f.institucion_id === ID_OTRA) {
      pedir({ tipo: "instituciones", nombre: f.nueva_institucion_nombre ?? "" }, (v, id) => {
        v.formacion_complementaria![i].institucion_id = id;
      });
    }
  });

  /** Devuelve una copia de `valores` con los ids resueltos (mismo orden que `solicitudes`). */
  const aplicar = (ids: number[]): RegistroPasosType => {
    const copia = structuredClone(valores);
    asignaciones.forEach((asignar, k) => asignar(copia, ids[k]));
    return copia;
  };

  return { solicitudes, aplicar };
}
