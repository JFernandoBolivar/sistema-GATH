"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ChevronRight } from "lucide-react";
import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { AccionesListadoMenu } from "@/shared/ui/components/acciones-listado-menu";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatearFechaHora, nombreCompleto } from "@/modules/captacion/domain/formato";
import { InsigniaEstado } from "@/modules/captacion/ui/components/insignia-estado";
import { Paginador } from "@/modules/captacion/ui/components/paginador";
import { BarraFiltros, type FiltroActivoChip } from "@/shared/ui/components/barra-filtros";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import {
  PESTANAS_PRESUPUESTO,
  type FilaArea,
  type PaginaArea,
  type PestanaPresupuesto,
} from "../../domain/solicitud";
import { contarSolicitudesAction, listarSolicitudesAction } from "../../infrastructure/actions/presupuesto-actions";

const TAMANO = 10;

type Conteos = Record<PestanaPresupuesto, number | null>;

async function cargarConteos(): Promise<Conteos> {
  const resultados = await Promise.all(PESTANAS_PRESUPUESTO.map((p) => contarSolicitudesAction(p.estados, p.vista)));
  return Object.fromEntries(
    PESTANAS_PRESUPUESTO.map((p, i) => [p.id, resultados[i].ok ? resultados[i].data : null]),
  ) as Conteos;
}

function useRetraso<T>(valor: T, ms: number): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setRetrasado(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}

function textoCargo(f: FilaArea): string {
  return f.cargoTexto || "Cargo sin texto (ver detalle)";
}

function FilaTabla({ fila }: { fila: FilaArea }) {
  const router = useRouter();
  const abrir = () => router.push(`/presupuesto/solicitudes/${fila.id}`);
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button,[role=menuitem]")) return;
        abrir();
      }}
      className={`cursor-pointer border-b transition-colors hover:bg-muted/40 ${fila.pendiente ? "bg-warning-soft/40" : ""}`}>
      <td className="whitespace-nowrap p-3 font-mono text-sm">{fila.numero}</td>
      <td className="p-3">
        <Link href={`/presupuesto/solicitudes/${fila.id}`} className="font-semibold hover:underline" aria-label={`Abrir solicitud ${fila.numero} de ${nombreCompleto(fila.postulante)}`}>{nombreCompleto(fila.postulante)}</Link>
        <p className="font-mono text-xs text-muted-foreground">C.I. {fila.postulante.cedula}</p>
      </td>
      <td className="p-3 text-sm">
        <p className="break-words">{textoCargo(fila)}</p>
        <p className="break-words text-xs text-muted-foreground">{fila.oficinaTexto}</p>
      </td>
      <td className="p-3"><InsigniaEstado estado={fila.estado} /></td>
      <td className="whitespace-nowrap p-3 text-sm text-muted-foreground">{formatearFechaHora(fila.ultimoCambio)}</td>
      <td className="p-3 text-right">
        <AccionesListadoMenu etiquetaMenu={`Acciones del solicitud ${fila.numero}`} acciones={[]} accionPrincipal={{ etiqueta: "Abrir solicitud", onSelect: abrir }} />
      </td>
    </tr>
  );
}

function TarjetaFila({ fila }: { fila: FilaArea }) {
  return (
    <li>
      <Link
        href={`/presupuesto/solicitudes/${fila.id}`}
        aria-label={`Abrir solicitud ${fila.numero} de ${nombreCompleto(fila.postulante)}`}
        className={`flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm active:bg-muted/50 ${fila.pendiente ? "border-l-4 border-l-warning" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words font-semibold">{nombreCompleto(fila.postulante)}</p>
            <p className="font-mono text-xs text-muted-foreground">C.I. {fila.postulante.cedula}</p>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <p className="break-words text-sm">{textoCargo(fila)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaEstado estado={fila.estado} />
        </div>
        <p className="text-xs text-muted-foreground">
          {fila.numero} · Último cambio: {formatearFechaHora(fila.ultimoCambio)}
        </p>
      </Link>
    </li>
  );
}

export function BandejaSolicitudesView() {
  const [pestana, setPestana] = useState<PestanaPresupuesto>("por_atender");
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(1);
  const q = useRetraso(busqueda.trim(), 350);
  const def = PESTANAS_PRESUPUESTO.find((p) => p.id === pestana) ?? PESTANAS_PRESUPUESTO[0];

  const { data, error, isLoading, isValidating, mutate } = useSWR<PaginaArea>(
    ["presupuesto-bandeja", pestana, q, desde, hasta, pagina],
    async () => {
      const r = await listarSolicitudesAction({ estados: def.estados, vista: def.vista, q, desde, hasta, pagina, tamano: TAMANO });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    { keepPreviousData: true, revalidateOnFocus: true },
  );
  const { data: conteos } = useSWR("presupuesto-conteos", cargarConteos, { refreshInterval: 60_000, revalidateOnFocus: true });

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
  const hayFiltros = chips.length > 0;

  return (
    <PageLayout title="Solicitudes de Presupuesto" description="Reserve el puesto, declare la disponibilidad presupuestaria y emita el Punto de Cuenta de cada postulante.">
      <div className="mt-4 flex flex-col gap-5">
        <Tabs
          value={pestana}
          onValueChange={(v) => {
            setPestana(v as PestanaPresupuesto);
            setPagina(1);
          }}
          className="min-w-0"
        >
          <div className="-mx-1 snap-x snap-mandatory overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max min-w-full justify-start gap-1 group-data-[orientation=horizontal]/tabs:h-auto md:min-w-0">
              {PESTANAS_PRESUPUESTO.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="min-h-10 shrink-0 snap-start gap-2 whitespace-nowrap px-3">
                  {p.etiqueta}
                  <span
                    aria-label={conteos?.[p.id] != null ? `${conteos[p.id]} solicitudes` : undefined}
                    className={`min-w-6 rounded-full px-1.5 text-xs font-semibold ${p.id === "por_atender" && (conteos?.[p.id] ?? 0) > 0 ? "bg-warning text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    {conteos?.[p.id] ?? "–"}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <BarraFiltros
          busqueda={busqueda}
          onBusquedaChange={(v) => { setBusqueda(v); setPagina(1); }}
          placeholderBusqueda="Buscar por cédula, nombre o número de expediente…"
          totalResultados={data?.total}
          etiquetaResultados="solicitudes"
          hayFiltrosActivos={hayFiltros}
          onLimpiarFiltros={limpiar}
          chipsActivos={chips}
          conteoFiltrosActivos={(desde ? 1 : 0) + (hasta ? 1 : 0)}
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
          <VistaCargando mensaje="Cargando solicitudes…" />
        ) : error ? (
          <VistaError mensaje={error instanceof Error ? error.message : "No fue posible cargar la bandeja."} onReintentar={() => void mutate()} />
        ) : filas.length === 0 ? (
          <VistaVacia
            titulo={hayFiltros ? "Ninguna solicitud coincide" : pestana === "por_atender" ? "No hay solicitudes por atender" : "No hay solicitudes en esta vista"}
            descripcion={hayFiltros ? "Pruebe con otra búsqueda o limpie los filtros." : "Cuando Captación abra un expediente hacia Presupuesto aparecerá aquí."}
            accion={hayFiltros ? <Button type="button" variant="outline" onClick={limpiar}>Limpiar filtros</Button> : undefined}
          />
        ) : (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="hidden md:block">
              <table className="w-full text-left" aria-label="Solicitudes de Presupuesto">
                <thead className="border-b bg-muted/50 text-sm text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 font-semibold">Expediente</th>
                    <th scope="col" className="p-3 font-semibold">Postulante</th>
                    <th scope="col" className="p-3 font-semibold">Cargo y oficina propuestos</th>
                    <th scope="col" className="p-3 font-semibold">Estado</th>
                    <th scope="col" className="p-3 font-semibold">Último cambio</th>
                    <th scope="col" className="p-3"><span className="sr-only">Acción</span></th>
                  </tr>
                </thead>
                <tbody>{filas.map((f) => <FilaTabla key={f.id} fila={f} />)}</tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-3 p-3 md:hidden" aria-label="Solicitudes de Presupuesto">
              {filas.map((f) => <TarjetaFila key={f.id} fila={f} />)}
            </ul>
            <div className="px-4 pb-4">
              <Paginador pagina={data?.pagina ?? 1} totalPaginas={data?.totalPaginas ?? 1} total={data?.total ?? 0} cargando={isValidating} onPagina={setPagina} />
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
