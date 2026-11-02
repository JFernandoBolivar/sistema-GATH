"use client";

import { useState, useTransition } from "react";
import useSWR from "swr";
import { CalendarClock, DoorClosed, DoorOpen, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import type { ProcesoDTO } from "../../application/dtos/fe-de-vida-dto";
import type { DatosProceso } from "../../domain/ports/repo-fe-de-vida";
import { describirDiaRecordatorio } from "../../domain/services/reglas";
import { LIMITE_PAGINA, PERMISOS_FE_DE_VIDA } from "../../domain/value-objects/estados";
import {
  abrirProcesoAction,
  cerrarProcesoAction,
  crearProcesoAction,
  editarProcesoAction,
  listarProcesosAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { OPCIONES_ESTADO_PROCESO, PRESENTACION_PROCESO } from "../comun/estado-ui";
import { formatearFechaHora } from "../comun/formato";
import { PaginacionNav } from "../comun/paginacion-nav";
import { useSesionFeDeVida } from "../comun/use-sesion-fe-de-vida";
import { DialogoProrrogas } from "./dialogo-prorrogas";
import { FormularioProceso } from "./formulario-proceso";

type Dialogo = { tipo: "form"; proceso: ProcesoDTO | null } | { tipo: "prorrogas"; proceso: ProcesoDTO } | null;

/** Procesos de fe de vida: lista paginada, crear/editar, abrir, cerrar y prórrogas (según permiso). */
export default function ProcesosPage() {
  const { puede } = useSesionFeDeVida();
  const gestiona = puede(PERMISOS_FE_DE_VIDA.gestionarProcesos);
  const prorroga = puede(PERMISOS_FE_DE_VIDA.prorrogar);
  const [estado, setEstado] = useState("");
  const [offset, setOffset] = useState(0);
  const [limite, setLimite] = useState(LIMITE_PAGINA);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [pendiente, iniciar] = useTransition();
  const { data, error, isLoading, mutate } = useSWR(["fe-de-vida-procesos", estado, offset, limite], async () => {
    const res = await listarProcesosAction({ estado, limit: limite, offset });
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });

  function ejecutar(fn: () => ReturnType<typeof abrirProcesoAction>) {
    iniciar(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      toast.success(res.mensaje);
      setDialogo(null);
      void mutate();
    });
  }

  function guardar(datos: DatosProceso) {
    const proceso = dialogo?.tipo === "form" ? dialogo.proceso : null;
    ejecutar(() => (proceso ? editarProcesoAction(proceso.id, datos) : crearProcesoAction(datos)));
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        titulo="Procesos de fe de vida"
        descripcion="Cree, abra y cierre los procesos y conceda prórrogas."
        accion={
          gestiona ? (
            <Button type="button" className="min-h-11" onClick={() => setDialogo({ tipo: "form", proceso: null })}>
              <Plus aria-hidden /> Nuevo proceso
            </Button>
          ) : undefined
        }
      />
      <div className="flex max-w-sm flex-col gap-1.5">
        <label htmlFor="pr-estado" className="text-base font-medium">Estado</label>
        <select
          id="pr-estado"
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-base"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            setOffset(0);
          }}
        >
          {OPCIONES_ESTADO_PROCESO.map((o) => (
            <option key={o.valor} value={o.valor}>{o.texto}</option>
          ))}
        </select>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {isLoading ? <VistaCargando mensaje="Cargando procesos…" onReintentar={() => mutate()} /> : null}
        {error ? <VistaError mensaje="No se pudieron cargar los procesos." onReintentar={() => mutate()} /> : null}
        {data && data.results.length === 0 ? <VistaVacia titulo="No hay procesos" descripcion="Ningún proceso coincide con el filtro." /> : null}
        {data?.results.map((p) => {
          const pe = PRESENTACION_PROCESO[p.estado];
          return (
            <article key={p.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{p.nombre}</h2>
                <StatusBadge texto={pe.texto} tono={pe.tono} icono={pe.icono} />
              </div>
              <dl className="grid gap-2 text-base sm:grid-cols-2">
                <div><dt className="text-sm text-muted-foreground">Apertura</dt><dd>{formatearFechaHora(p.apertura)}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Cierre</dt><dd>{formatearFechaHora(p.cierre)}</dd></div>
                <div>
                  <dt className="text-sm text-muted-foreground">Alcance</dt>
                  <dd>
                    {p.tiposNomina.length === 0 ? (
                      "Todos los pasivos"
                    ) : (
                      <ListaEtiquetas textos={p.tiposNomina.map((t) => t.nombre)} />
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Recordatorios antes del cierre</dt>
                  <dd>
                    {p.diasRecordatorio.length === 0 ? (
                      "Sin recordatorios"
                    ) : (
                      <ListaEtiquetas textos={p.diasRecordatorio.map(describirDiaRecordatorio)} />
                    )}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                {gestiona && p.estado !== "CERRADO" ? (
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogo({ tipo: "form", proceso: p })}>
                    <Pencil aria-hidden /> Editar
                  </Button>
                ) : null}
                {gestiona && p.estado === "BORRADOR" ? (
                  <Button type="button" className="min-h-11" disabled={pendiente} onClick={() => ejecutar(() => abrirProcesoAction(p.id))}>
                    <DoorOpen aria-hidden /> Abrir
                  </Button>
                ) : null}
                {gestiona && p.estado === "ABIERTO" ? (
                  <Button type="button" variant="destructive" className="min-h-11" disabled={pendiente} onClick={() => ejecutar(() => cerrarProcesoAction(p.id))}>
                    <DoorClosed aria-hidden /> Cerrar
                  </Button>
                ) : null}
                {prorroga && p.estado !== "BORRADOR" ? (
                  <Button type="button" variant="secondary" className="min-h-11" onClick={() => setDialogo({ tipo: "prorrogas", proceso: p })}>
                    <CalendarClock aria-hidden /> Prórrogas
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {data && data.count > 0 ? (
        <PaginacionNav
          etiqueta="Paginación de procesos"
          total={data.count}
          offset={offset}
          limite={limite}
          onOffset={setOffset}
          tamanos={[10, 50]}
          onLimite={(l) => {
            setLimite(l);
            setOffset(0);
          }}
        />
      ) : null}

      {dialogo?.tipo === "form" ? (
        <FormularioProceso proceso={dialogo.proceso} pendiente={pendiente} onCerrar={() => setDialogo(null)} onGuardar={guardar} />
      ) : null}
      {dialogo?.tipo === "prorrogas" ? <DialogoProrrogas proceso={dialogo.proceso} onCerrar={() => setDialogo(null)} /> : null}
    </div>
  );
}

/** Valores múltiples como etiquetas en lugar de texto separado por comas. */
function ListaEtiquetas({ textos }: { textos: readonly string[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {textos.map((texto) => (
        <li key={texto} className="rounded-md border bg-muted px-2 py-0.5 text-sm font-medium">
          {texto}
        </li>
      ))}
    </ul>
  );
}
