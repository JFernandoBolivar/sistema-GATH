"use client";

import { useMemo, useState } from "react";
import type { FaltanteDTO, Ventana2DTO } from "../../application/dtos/postulacion-dto";
import { RUTA_ACCESO_POSTULANTE } from "../../domain/acceso-ruta";
import { calcularAvance, SECCIONES_VENTANA2, type CatalogosVentana2, type SeccionVentana2 } from "../../domain/ventana2";
import { catalogosVentana2Action, guardarVentana2Action } from "../../infrastructure/actions/postulacion-actions";
import type { ResultadoGuardado } from "./comun";
import { IndicadorAvance } from "./indicador-avance";
import { SeccionCursos } from "./seccion-cursos";
import { SeccionEstudios } from "./seccion-estudios";
import { SeccionExperiencia } from "./seccion-experiencia";
import { SeccionFamiliares } from "./seccion-familiares";
import { SeccionFoto } from "./seccion-foto";
import { SeccionIdiomas } from "./seccion-idiomas";
import { SeccionRevisar } from "./seccion-revisar";
import { SeccionSalud } from "./seccion-salud";
import { SeccionTallas } from "./seccion-tallas";
import { SeccionVivienda } from "./seccion-vivienda";

interface Props {
  datosIniciales: Record<string, unknown>;
  faltantesIniciales: FaltanteDTO[];
  tieneFotoInicial: boolean;
  catalogosIniciales: CatalogosVentana2;
}

/** Formulario de la Ventana 2 por pasos: cada sección guarda su propio borrador. */
export function FormularioVentana2({ datosIniciales, faltantesIniciales, tieneFotoInicial, catalogosIniciales }: Props) {
  const [datos, setDatos] = useState(datosIniciales);
  const [faltantes, setFaltantes] = useState(faltantesIniciales);
  const [foto, setFoto] = useState<Ventana2DTO["foto"]>({ tiene: tieneFotoInicial, subidaEl: null, tamano: null });
  const [catalogos, setCatalogos] = useState(catalogosIniciales);
  const avance = useMemo(() => calcularAvance(faltantes), [faltantes]);
  const [actual, setActual] = useState<SeccionVentana2>(() => avance.secciones.find((s) => !s.completa)?.id ?? "revisar");
  const [validarAlEntrar, setValidarAlEntrar] = useState(false);

  function ir(s: SeccionVentana2, desdeFaltante = false) {
    setValidarAlEntrar(desdeFaltante);
    setActual(s);
    document.getElementById("ventana2-pasos")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  const indice = SECCIONES_VENTANA2.findIndex((s) => s.id === actual);
  const siguiente = () => ir(SECCIONES_VENTANA2[Math.min(indice + 1, SECCIONES_VENTANA2.length - 1)].id);
  const anterior = indice > 0 ? () => ir(SECCIONES_VENTANA2[indice - 1].id) : undefined;
  const sesionCaida = () => { window.location.href = `${RUTA_ACCESO_POSTULANTE}?motivo=sesion`; };

  async function guardar(cuerpo: Record<string, unknown>): Promise<ResultadoGuardado> {
    const r = await guardarVentana2Action(cuerpo);
    if (!r.ok) {
      if (r.sesionCaida) sesionCaida();
      return { ok: false, mensaje: r.mensaje, errores: r.errores };
    }
    setDatos(r.datos.datos);
    setFaltantes(r.datos.faltantes);
    setFoto(r.datos.foto);
    return { ok: true };
  }

  async function cargarGeografia(estadoId?: number, municipioId?: number): Promise<boolean> {
    const r = await catalogosVentana2Action(estadoId, municipioId);
    if (!r.ok) return false;
    setCatalogos((c) => ({
      ...c,
      municipios: r.datos.municipios,
      parroquias: municipioId ? r.datos.parroquias : [],
    }));
    return true;
  }

  const comunes = { datos, catalogos, guardar, onContinuar: siguiente, onAnterior: anterior, validarAlEntrar };

  return (
    <div id="ventana2-pasos" className="flex flex-col gap-5" style={{ scrollMarginTop: "4rem" }}>
      <IndicadorAvance avance={avance} actual={actual} onIr={(s) => ir(s)} />
      <div key={actual}>
        {actual === "familiares" && <SeccionFamiliares {...comunes} />}
        {actual === "vivienda" && <SeccionVivienda {...comunes} cargarGeografia={cargarGeografia} />}
        {actual === "salud" && <SeccionSalud {...comunes} />}
        {actual === "tallas" && <SeccionTallas {...comunes} />}
        {actual === "estudios" && <SeccionEstudios {...comunes} />}
        {actual === "cursos" && <SeccionCursos {...comunes} />}
        {actual === "experiencia" && <SeccionExperiencia {...comunes} />}
        {actual === "idiomas" && <SeccionIdiomas {...comunes} />}
        {actual === "foto" && (
          <SeccionFoto
            foto={foto}
            onSubida={(v) => { setFaltantes(v.faltantes); setFoto(v.foto); setDatos(v.datos); }}
            onContinuar={siguiente}
            onAnterior={anterior}
            onSesionCaida={sesionCaida}
          />
        )}
        {actual === "revisar" && (
          <SeccionRevisar
            datos={datos}
            catalogos={catalogos}
            faltantes={faltantes}
            tieneFoto={foto.tiene}
            fotoVersion={foto.subidaEl ?? "0"}
            onIrA={ir}
            onAnterior={anterior ?? (() => undefined)}
            onFaltantes={setFaltantes}
            onSesionCaida={sesionCaida}
          />
        )}
      </div>
    </div>
  );
}
