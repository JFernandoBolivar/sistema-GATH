import type { Metadata } from "next";
import { ListaPlantillasView } from "@/modules/documentos/ui/views/lista-plantillas-view";

export const metadata: Metadata = {
  title: "Plantillas de documentos | GATH",
  description: "Diseño y filtrado de plantillas por proceso y grupo funcional.",
};

type Busqueda = { grupo?: string; proceso?: string; crear?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const filtros = await searchParams;
  return (
    <ListaPlantillasView
      key={`${filtros.proceso ?? ""}:${filtros.crear ?? ""}`}
      filtrosIniciales={{ grupo: filtros.grupo, proceso: filtros.proceso }}
      crearAbiertoInicial={filtros.crear === "1"}
      procesoCrearInicial={filtros.proceso}
    />
  );
}
