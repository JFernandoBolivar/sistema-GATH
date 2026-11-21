import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "#/auth";
import { RUTA_ACCESO_POSTULANTE } from "@/modules/postulacion/domain/acceso-ruta";
import { CambiarClaveForm } from "@/modules/postulacion/ui/cambiar-clave-form";

export const metadata: Metadata = { title: "Crea tu contraseña · Portal del postulante" };

export default async function CambiarClavePage() {
  const sesion = await auth();
  const cedula = sesion?.user?.cedula;
  if (!cedula) redirect(RUTA_ACCESO_POSTULANTE);
  return <CambiarClaveForm cedula={cedula} />;
}
