import type { Metadata } from "next";
import { AccesoPostulanteForm } from "@/modules/postulacion/ui/acceso-postulante-form";

export const metadata: Metadata = { title: "Ingresar · Portal del postulante" };

export default async function AccesoPostulantePage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  return <AccesoPostulanteForm sesionTerminada={motivo === "sesion"} />;
}
