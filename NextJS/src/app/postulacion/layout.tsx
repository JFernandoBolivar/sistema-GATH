import type { Metadata } from "next";
import { auth } from "#/auth";
import { EncabezadoPostulante } from "@/modules/postulacion/ui/encabezado-postulante";
import { ROL_POSTULANTE } from "@/modules/postulacion/domain/acceso-ruta";

export const metadata: Metadata = {
  title: "Portal del postulante · CONATEL",
  description: "Completa tus datos de postulación en CONATEL.",
  robots: { index: false, follow: false },
};

/**
 * Layout propio del postulante: sin sidebar ni menú del personal. El nombre y «Salir» solo
 * aparecen con sesión de postulante; el acceso y «Recibido» muestran solo el encabezado.
 */
export default async function PostulacionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sesion = await auth();
  const esPostulante = sesion?.user?.role?.nombre_rol === ROL_POSTULANTE;
  const nombre = esPostulante ? sesion?.user?.name || "Postulante" : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <EncabezadoPostulante nombre={nombre} />
      <main id="contenido" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">
        Comisión Nacional de Telecomunicaciones · Talento Humano
      </footer>
    </div>
  );
}
