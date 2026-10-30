"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { ArrowRight, FilePenLine, ListChecks, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { cumpleCondicion, tienePermiso } from "@/shared/lib/evaluador-iam";
import { listarMisSolicitudesAction } from "../../infrastructure/actions/solicitudes-actions";
import { PRESENTACION_ESTADO } from "../estado-solicitud-ui";
import { textoTiempoRestante, tiempoRestante } from "../../domain/services/reglas-solicitud";
import { useAhora } from "../solicitudes/use-ahora";

function saludo(hora: number | null): string {
  if (hora === null) return "Bienvenido";
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

const sinSuscripcion = () => () => {};

/**
 * Hora local del navegador; `null` durante el render del servidor. El servidor corre en UTC y el
 * usuario en hora de Venezuela: calcular el saludo en ambos lados rompe la hidratación (React #418).
 */
function useHoraLocal(): number | null {
  return useSyncExternalStore(
    sinSuscripcion,
    () => new Date().getHours(),
    () => null,
  );
}

function primerNombre(nombre: string | null | undefined): string {
  return (nombre ?? "").trim().split(/\s+/)[0] ?? "";
}

function Acceso({
  href,
  icono: Icono,
  titulo,
  texto,
}: {
  href: string;
  icono: typeof UserRound;
  titulo: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-28 flex-col gap-2 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary"
    >
      <Icono className="size-7 text-primary" aria-hidden />
      <span className="text-lg font-bold">{titulo}</span>
      <span className="text-base text-muted-foreground">{texto}</span>
    </Link>
  );
}

/** Inicio de Autogestión: saludo, aviso de plazo abierto (si lo hay) y accesos a lo que el usuario puede hacer. */
export default function AutogestionInicio() {
  const { data: session } = useSession();
  const ahora = useAhora();
  const hora = useHoraLocal();
  const permisos = session?.user?.permisos;
  const esActivo = cumpleCondicion("ACTIVO", session?.user?.condicionTrabajador);
  const verSolicitudes = esActivo && tienePermiso(permisos, "autogestion.ver_propio");

  const { data: solicitudes } = useSWR(verSolicitudes ? "mis-solicitudes" : null, async () => {
    const res = await listarMisSolicitudesAction();
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });

  const abierta = solicitudes?.find((s) => s.estado === "HABILITADA");
  const enCurso =
    solicitudes?.filter((s) => s.estado === "SOLICITADA" || s.estado === "ENVIADA").length ?? 0;
  const restante = abierta ? tiempoRestante(abierta.ventanaFin, ahora) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo={`${saludo(hora)}${primerNombre(session?.user?.name) ? `, ${primerNombre(session?.user?.name)}` : ""}`}
        descripcion={session?.user?.cedula ? `Cédula ${session.user.cedula}` : undefined}
      />

      {abierta && restante && !restante.vencida ? (
        <section
          aria-labelledby="aviso-plazo"
          className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft p-5 text-warning"
        >
          <h2 id="aviso-plazo" className="text-xl font-bold">
            Tiene un plazo abierto: le quedan {textoTiempoRestante(restante)}
          </h2>
          <p className="text-base">
            Bienestar Social habilitó su solicitud. Cargue sus cambios y envíelos a tiempo.
          </p>
          <Button asChild size="lg" className="w-full sm:w-fit">
            <Link href={`/autogestion/solicitudes/${abierta.id}`}>
              Completar mi actualización <ArrowRight aria-hidden />
            </Link>
          </Button>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {tienePermiso(permisos, "autogestion.ver_propio") ? (
          <Acceso
            href="/autogestion/ficha"
            icono={UserRound}
            titulo="Mi ficha"
            texto="Consulte todos sus datos registrados en CONATEL."
          />
        ) : null}
        {esActivo && tienePermiso(permisos, "autogestion.solicitar_actualizacion") ? (
          <Acceso
            href="/autogestion/solicitudes/nueva"
            icono={FilePenLine}
            titulo="Solicitar actualización"
            texto="Corrija o complete sus datos de contacto, vivienda, estudios, familia o foto."
          />
        ) : null}
        {verSolicitudes ? (
          <Acceso
            href="/autogestion/solicitudes"
            icono={ListChecks}
            titulo="Mis solicitudes"
            texto={enCurso > 0 ? `${enCurso} en revisión` : "Vea el avance de sus solicitudes."}
          />
        ) : null}
      </div>

      {abierta ? (
        <p className="text-sm text-muted-foreground">
          Estado de su solicitud más reciente:{" "}
          <StatusBadge
            texto={PRESENTACION_ESTADO[abierta.estado].texto}
            tono={PRESENTACION_ESTADO[abierta.estado].tono}
            icono={PRESENTACION_ESTADO[abierta.estado].icono}
          />
        </p>
      ) : null}
    </div>
  );
}
