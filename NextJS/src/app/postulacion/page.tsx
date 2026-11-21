import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import type { MiExpedienteDTO } from "@/modules/postulacion/application/dtos/postulacion-dto";
import { obtenerMiExpediente } from "@/modules/postulacion/application/use-cases/gestionar-postulacion";
import {
  RUTA_ACCESO_POSTULANTE,
  RUTA_CAMBIAR_CLAVE,
} from "@/modules/postulacion/domain/acceso-ruta";
import { presentarErrorApi } from "@/modules/postulacion/domain/errores-acceso";
import { ErrorPostulacion } from "@/modules/postulacion/infrastructure/http/postulacion-api";
import { repoPostulacionApi } from "@/modules/postulacion/infrastructure/repositories/repo-postulacion-api";
import { leerSesionPostulante } from "@/modules/postulacion/infrastructure/sesion-postulante";
import { InicioPostulacion } from "@/modules/postulacion/ui/inicio-postulacion";

export const metadata: Metadata = { title: "Mi postulación · Portal del postulante" };
export const dynamic = "force-dynamic";

export default async function InicioPostulantePage() {
  const sesion = await leerSesionPostulante();
  if (!sesion) redirect(`${RUTA_ACCESO_POSTULANTE}?motivo=sesion`);

  let vista: MiExpedienteDTO | null = null;
  let aviso = "";
  let destino: string | null = null;
  try {
    vista = await obtenerMiExpediente(repoPostulacionApi, sesion.tokenDjango);
  } catch (e) {
    if (e instanceof ErrorPostulacion) {
      const p = presentarErrorApi({
        status: e.status,
        codigo: e.codigo,
        bloqueadaHasta: e.bloqueadaHasta,
        mensajeServidor: e.message,
        conErroresDeCampo: !!e.errores,
      });
      if (p.sesionCaida) destino = `${RUTA_ACCESO_POSTULANTE}?motivo=sesion`;
      else if (e.codigo === "CAMBIO_CLAVE_OBLIGATORIO") destino = RUTA_CAMBIAR_CLAVE;
      else aviso = p.mensaje;
    } else {
      aviso = "No pudimos cargar tu postulación. Inténtalo de nuevo.";
    }
  }
  if (destino) redirect(destino);

  if (!vista) {
    return (
      <section
        role="alert"
        className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-10 text-center"
      >
        <AlertTriangle className="size-10 text-amber-600" aria-hidden />
        <h1 className="text-lg font-semibold">No pudimos mostrar tu postulación</h1>
        <p className="text-pretty text-muted-foreground">{aviso}</p>
        <a
          href="/postulacion"
          className="mt-2 inline-flex min-h-11 items-center rounded-md border px-5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reintentar
        </a>
      </section>
    );
  }
  return <InicioPostulacion vista={vista} />;
}
