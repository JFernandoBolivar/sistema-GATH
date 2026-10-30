"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import useSWR from "swr";
import { History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/components/page-header";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { esEditablePorPasivo } from "../../domain/services/reglas";
import {
  iniciarSolicitudAction,
  obtenerMiSolicitudAction,
  obtenerVigenteAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { formatearFechaHora } from "../comun/formato";
import { FormularioFeDeVida } from "./formulario-fe-de-vida";
import { SeguimientoSolicitud } from "./seguimiento-solicitud";

/** Fe de vida del pasivo: proceso vigente, formulario por pasos o seguimiento de su solicitud. */
export default function FeDeVidaPasivoPage() {
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [iniciando, iniciar] = useTransition();
  const vigente = useSWR("fe-de-vida-vigente", async () => {
    const res = await obtenerVigenteAction();
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });
  const solicitudId = vigente.data?.solicitud?.id ?? null;
  const detalle = useSWR(solicitudId ? ["fe-de-vida-mi-solicitud", solicitudId] : null, async () => {
    const res = await obtenerMiSolicitudAction(solicitudId as string);
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });

  const historial = (
    <Button asChild variant="outline" className="min-h-11">
      <Link href="/autogestion/fe-de-vida/historial">
        <History aria-hidden /> Historial
      </Link>
    </Button>
  );

  function recargar() {
    setCorrigiendo(false);
    void vigente.mutate();
    void detalle.mutate();
  }

  function empezar() {
    iniciar(async () => {
      const res = await iniciarSolicitudAction();
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      recargar();
    });
  }

  let cuerpo;
  if (vigente.isLoading) {
    cuerpo = <VistaCargando mensaje="Cargando su fe de vida…" onReintentar={() => vigente.mutate()} />;
  } else if (vigente.error) {
    cuerpo = <VistaError mensaje="No se pudo cargar el proceso de fe de vida." onReintentar={() => vigente.mutate()} />;
  } else if (!vigente.data) {
    cuerpo = (
      <VistaVacia
        titulo="No hay un proceso de fe de vida abierto"
        descripcion="Cuando Bienestar Social abra uno, le avisaremos y podrá hacerlo aquí."
      />
    );
  } else {
    const { proceso, solicitud, puedeEnviar } = vigente.data;
    const encabezado = (
      <p className="text-base">
        <span className="font-semibold">{proceso.nombre}</span> · abierto hasta {formatearFechaHora(proceso.cierre)}
      </p>
    );
    if (!solicitud) {
      cuerpo = (
        <div className="flex flex-col gap-4">
          {encabezado}
          {puedeEnviar ? (
            <Button type="button" className="min-h-11 w-fit" onClick={empezar} disabled={iniciando}>
              {iniciando ? "Iniciando…" : "Comenzar mi fe de vida"}
            </Button>
          ) : (
            <p role="status" className="text-base">El plazo de este proceso ya terminó.</p>
          )}
        </div>
      );
    } else if (detalle.isLoading) {
      cuerpo = <VistaCargando mensaje="Cargando su solicitud…" onReintentar={() => detalle.mutate()} />;
    } else if (detalle.error || !detalle.data) {
      cuerpo = <VistaError mensaje="No se pudo cargar su solicitud." onReintentar={() => detalle.mutate()} />;
    } else if (esEditablePorPasivo(solicitud) && puedeEnviar && (solicitud.estado === "BORRADOR" || corrigiendo)) {
      cuerpo = (
        <div className="flex flex-col gap-4">
          {encabezado}
          <FormularioFeDeVida solicitud={solicitud} detalle={detalle.data} onActualizar={recargar} />
        </div>
      );
    } else {
      cuerpo = (
        <div className="flex flex-col gap-4">
          {encabezado}
          <SeguimientoSolicitud solicitud={solicitud} onCorregir={puedeEnviar ? () => setCorrigiendo(true) : undefined} />
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        titulo="Fe de vida"
        descripcion="Confirme sus datos y envíe su foto con la cédula para recibir su constancia."
        accion={historial}
      />
      <div aria-live="polite">{cuerpo}</div>
    </div>
  );
}
