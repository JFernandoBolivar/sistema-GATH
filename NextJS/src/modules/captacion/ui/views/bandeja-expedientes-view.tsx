"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { useSession } from "next-auth/react";
import { ChevronRight, Inbox, UserPlus } from "lucide-react";
import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { BarraFiltros, type FiltroActivoChip } from "@/shared/ui/components/barra-filtros";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import {
  estadosDePestana,
  PESTANAS,
  type FilaBandeja,
  type PaginaBandeja,
  type PestanaBandeja,
} from "../../domain/expediente";
import { formatearFechaHora, nombreCompleto } from "../../domain/formato";
import {
  contarExpedientesAction,
  crearPostulanteAction,
  listarBandejaAction,
  resumenPorContactarAction,
} from "../../infrastructure/actions/captacion-actions";
import { DialogoNuevoPostulante } from "../components/dialogo-nuevo-postulante";
import { InsigniaContacto } from "../components/insignia-contacto";
import { InsigniaEstado } from "../components/insignia-estado";
import { Paginador } from "../components/paginador";

const TAMANO = 10;
const PERMISO_CREAR = "postulacion.crear_postulante";

type Conteos = Record<PestanaBandeja, number | null> & { atrasados: number };

async function cargarConteos(): Promise<Conteos> {
  const [resultados, resumen] = await Promise.all([
    Promise.all(PESTANAS.map((p) => contarExpedientesAction(p.estados, p.porContactar))),
    resumenPorContactarAction(),
  ]);
  const conteos = Object.fromEntries(
    PESTANAS.map((p, i) => {
      const r = resultados[i];
      return [p.id, r.ok ? r.data : null];
    }),
  ) as Record<PestanaBandeja, number | null>;
  return { ...conteos, atrasados: resumen.ok ? resumen.data.atrasados : 0 };
}

/** Color del contador de cada pestaña: «Por revisar» y «Por contactar» se destacan (rojo si hay atrasados). */
function claseContador(id: PestanaBandeja, conteos: Conteos | undefined): string {
  const n = conteos?.[id] ?? 0;
  if (id === "por_contactar" && n > 0) return conteos && conteos.atrasados > 0 ? "bg-danger text-white" : "bg-warning text-white";
  if (id === "por_revisar" && n > 0) return "bg-warning text-white";
  return "bg-muted text-muted-foreground";
}

function useRetraso<T>(valor: T, ms: number): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setRetrasado(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}

function EtiquetaReingreso() {
  return <span className="rounded-full border border-info/40 bg-info-soft px-2 py-0.5 text-xs font-semibold text-info">Reingreso</span>;
}

function FilaTabla({ fila, ahora }: { fila: FilaBandeja; ahora: Date }) {
  return (
    <tr className={`border-b transition-colors hover:bg-muted/40 ${fila.contactoAtrasado ? "bg-danger-soft/40" : fila.pendienteDeCaptacion || fila.contactoPendiente ? "bg-warning-soft/40" : ""}`}>
      <td className="p-3 font-mono text-sm">{fila.numero}</td>
      <td className="p-3">
        <p className="font-semibold">{nombreCompleto(fila.postulante)}</p>
        <p className="font-mono text-xs text-muted-foreground">C.I. {fila.postulante.cedula}</p>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaEstado estado={fila.estado} />
          {fila.esReingreso ? <EtiquetaReingreso /> : null}
        </div>
        <InsigniaContacto contacto={fila} ahora={ahora} className="mt-1.5" />
      </td>
      <td className="p-3 text-sm text-muted-foreground">{formatearFechaHora(fila.ultimoCambio)}</td>
      <td className="p-3 text-right">
        <Button asChild size="sm" variant={fila.pendienteDeCaptacion ? "default" : "outline"}>
          <Link href={`/captacion/expedientes/${fila.id}`} aria-label={`${fila.pendienteDeCaptacion ? "Revisar" : "Abrir"} expediente ${fila.numero}`}>
            {fila.pendienteDeCaptacion ? "Revisar" : "Abrir"}
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function TarjetaFila({ fila, ahora }: { fila: FilaBandeja; ahora: Date }) {
  return (
    <li>
      <Link
        href={`/captacion/expedientes/${fila.id}`}
        aria-label={`Abrir expediente ${fila.numero} de ${nombreCompleto(fila.postulante)}`}
        className={`flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm active:bg-muted/50 ${fila.contactoAtrasado ? "border-l-4 border-l-danger" : fila.pendienteDeCaptacion || fila.contactoPendiente ? "border-l-4 border-l-warning" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words font-semibold">{nombreCompleto(fila.postulante)}</p>
            <p className="font-mono text-xs text-muted-foreground">C.I. {fila.postulante.cedula}</p>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaEstado estado={fila.estado} />
          {fila.esReingreso ? <EtiquetaReingreso /> : null}
        </div>
        <InsigniaContacto contacto={fila} ahora={ahora} />
        <p className="text-xs text-muted-foreground">
          {fila.numero} · Último cambio: {formatearFechaHora(fila.ultimoCambio)}
        </p>
      </Link>
    </li>
  );
}

export function BandejaExpedientesView() {
  const { data: session } = useSession();
  const puedeCrear = tienePermiso(session?.user?.permisos, PERMISO_CREAR);
  const { mutate: mutarGlobal } = useSWRConfig();

  const [pestana, setPestana] = useState<PestanaBandeja>("por_revisar");
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const q = useRetraso(busqueda.trim(), 350);

  const clave = ["captacion-bandeja", pestana, q, desde, hasta, pagina] as const;
  const { data, error, isLoading, isValidating, mutate } = useSWR<PaginaBandeja>(
    clave,
    async () => {
      const r = await listarBandejaAction({ estados: estadosDePestana(pestana), porContactar: PESTANAS.find((p) => p.id === pestana)?.porContactar, q, desde, hasta, pagina, tamano: TAMANO });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    { keepPreviousData: true, revalidateOnFocus: true },
  );
  const { data: conteos, mutate: recargarConteos } = useSWR("captacion-conteos", cargarConteos, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });

  const chips = useMemo<FiltroActivoChip[]>(() => {
    const c: FiltroActivoChip[] = [];
    if (busqueda.trim()) c.push({ id: "q", label: "Búsqueda", valorLegible: busqueda.trim(), onRemover: () => { setBusqueda(""); setPagina(1); } });
    if (desde) c.push({ id: "desde", label: "Desde", valorLegible: desde, onRemover: () => { setDesde(""); setPagina(1); } });
    if (hasta) c.push({ id: "hasta", label: "Hasta", valorLegible: hasta, onRemover: () => { setHasta(""); setPagina(1); } });
    return c;
  }, [busqueda, desde, hasta]);

  function limpiar() {
    setBusqueda("");
    setDesde("");
    setHasta("");
    setPagina(1);
  }

  const filas = data?.resultados ?? [];
  const ahora = new Date();
  const hayFiltros = chips.length > 0;

  return (
    <PageLayout title="Bandeja de Captación" description="Expedientes de postulantes: revise lo que espera su decisión y siga el avance de los demás.">
      <div className="mt-4 flex flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row-reverse md:items-center md:justify-between">
          {puedeCrear ? (
            <Button type="button" onClick={() => setDialogoAbierto(true)} className="w-full shrink-0 md:w-auto">
              <UserPlus aria-hidden /> Nuevo postulante
            </Button>
          ) : null}
          <Tabs
            value={pestana}
            onValueChange={(v) => {
              setPestana(v as PestanaBandeja);
              setPagina(1);
            }}
            className="min-w-0 md:flex-1"
          >
            <div className="-mx-1 snap-x snap-mandatory overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="w-max min-w-full justify-start gap-1 group-data-[orientation=horizontal]/tabs:h-auto md:min-w-0">
                {PESTANAS.map((p) => (
                  <TabsTrigger key={p.id} value={p.id} className="min-h-10 shrink-0 snap-start gap-2 whitespace-nowrap px-3">
                    {p.etiqueta}
                    <span
                      aria-label={conteos?.[p.id] != null ? `${conteos[p.id]} expedientes` : undefined}
                      className={`min-w-6 rounded-full px-1.5 text-xs font-semibold ${claseContador(p.id, conteos)}`}
                    >
                      {conteos?.[p.id] ?? "–"}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        </div>

        <BarraFiltros
          busqueda={busqueda}
          onBusquedaChange={(v) => { setBusqueda(v); setPagina(1); }}
          placeholderBusqueda="Buscar por cédula, nombre o número de expediente…"
          totalResultados={data?.total}
          etiquetaResultados="expedientes"
          hayFiltrosActivos={hayFiltros}
          onLimpiarFiltros={limpiar}
          chipsActivos={chips}
          tituloFiltrosMovil="Filtrar por fecha"
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="filtro-desde">Último cambio desde</Label>
            <Input id="filtro-desde" type="date" value={desde} max={hasta || undefined} onChange={(e) => { setDesde(e.target.value); setPagina(1); }} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="filtro-hasta">Último cambio hasta</Label>
            <Input id="filtro-hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => { setHasta(e.target.value); setPagina(1); }} />
          </div>
        </BarraFiltros>

        {isLoading ? (
          <VistaCargando mensaje="Cargando expedientes…" />
        ) : error ? (
          <VistaError mensaje={error instanceof Error ? error.message : "No fue posible cargar la bandeja."} onReintentar={() => void mutate()} />
        ) : filas.length === 0 ? (
          <VistaVacia
            titulo={hayFiltros ? "Ningún expediente coincide" : pestana === "por_revisar" ? "No hay expedientes por revisar" : pestana === "por_contactar" ? "No hay postulantes por contactar" : "No hay expedientes en esta vista"}
            descripcion={hayFiltros ? "Pruebe con otra búsqueda o limpie los filtros." : "Cuando llegue uno que requiera su atención aparecerá aquí."}
            accion={hayFiltros ? <Button type="button" variant="outline" onClick={limpiar}>Limpiar filtros</Button> : <Inbox className="size-6 text-muted-foreground" aria-hidden />}
          />
        ) : (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="hidden md:block">
              <table className="w-full text-left" aria-label="Expedientes de postulantes">
                <thead className="border-b bg-muted/50 text-sm text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 font-semibold">Expediente</th>
                    <th scope="col" className="p-3 font-semibold">Postulante</th>
                    <th scope="col" className="p-3 font-semibold">Estado</th>
                    <th scope="col" className="p-3 font-semibold">Último cambio</th>
                    <th scope="col" className="p-3"><span className="sr-only">Acción</span></th>
                  </tr>
                </thead>
                <tbody>{filas.map((f) => <FilaTabla key={f.id} fila={f} ahora={ahora} />)}</tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-3 p-3 md:hidden" aria-label="Expedientes de postulantes">
              {filas.map((f) => <TarjetaFila key={f.id} fila={f} ahora={ahora} />)}
            </ul>
            <div className="px-4 pb-4">
              <Paginador pagina={data?.pagina ?? 1} totalPaginas={data?.totalPaginas ?? 1} total={data?.total ?? 0} cargando={isValidating} onPagina={setPagina} />
            </div>
          </Card>
        )}
      </div>

      <DialogoNuevoPostulante
        abierto={dialogoAbierto}
        onCerrar={() => setDialogoAbierto(false)}
        crear={crearPostulanteAction}
        onCreado={() => {
          void mutate();
          void recargarConteos();
          void mutarGlobal((k) => Array.isArray(k) && k[0] === "captacion-bandeja");
        }}
      />
    </PageLayout>
  );
}
