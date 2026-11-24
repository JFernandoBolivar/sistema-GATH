"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronRight, Inbox } from "lucide-react";
import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatearFechaHora, nombreCompleto } from "@/modules/captacion/domain/formato";
import { InsigniaEstado } from "@/modules/captacion/ui/components/insignia-estado";
import { Paginador } from "@/modules/captacion/ui/components/paginador";
import type { FilaArea, PaginaArea } from "@/modules/presupuesto/domain/solicitud";
import { BarraFiltros, type FiltroActivoChip } from "@/shared/ui/components/barra-filtros";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { PESTANAS_DIRECCION, type PestanaDireccion } from "../../domain/ingreso";
import { contarIngresosAction, listarIngresosAction } from "../../infrastructure/actions/direccion-actions";

const TAMANO = 10;

type Conteos = Record<PestanaDireccion, number | null>;

async function cargarConteos(): Promise<Conteos> {
  const resultados = await Promise.all(PESTANAS_DIRECCION.map((p) => contarIngresosAction(p.estados, p.vista)));
  return Object.fromEntries(
    PESTANAS_DIRECCION.map((p, i) => [p.id, resultados[i].ok ? resultados[i].data : null]),
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

function FilaTabla({ fila }: { fila: FilaArea }) {
  return (
    <tr className={`border-b transition-colors hover:bg-muted/40 ${fila.pendiente ? "bg-warning-soft/40" : ""}`}>
      <td className="p-3 font-mono text-sm">{fila.numero}</td>
      <td className="p-3">
        <p className="font-semibold">{nombreCompleto(fila.postulante)}</p>
        <p className="font-mono text-xs text-muted-foreground">C.I. {fila.postulante.cedula}</p>
      </td>
      <td className="p-3 text-sm">
        <p className="break-words">{fila.cargoTexto || "—"}</p>
        <p className="break-words text-xs text-muted-foreground">{fila.oficinaTexto}</p>
      </td>
      <td className="p-3 font-mono text-sm">{fila.puntoCuentaNumero ?? "—"}</td>
      <td className="p-3"><InsigniaEstado estado={fila.estado} /></td>
      <td className="p-3 text-sm text-muted-foreground">{formatearFechaHora(fila.ultimoCambio)}</td>
      <td className="p-3 text-right">
        <Button asChild size="sm" variant={fila.pendiente ? "default" : "outline"}>
          <Link href={`/direccion/ingresos/${fila.id}`} aria-label={`${fila.pendiente ? "Decidir" : "Ver"} ingreso ${fila.numero}`}>
            {fila.pendiente ? "Decidir" : "Ver"}
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function TarjetaFila({ fila }: { fila: FilaArea }) {
  return (
    <li>
      <Link
        href={`/direccion/ingresos/${fila.id}`}
        aria-label={`Abrir ingreso ${fila.numero} de ${nombreCompleto(fila.postulante)}`}
        className={`flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm active:bg-muted/50 ${fila.pendiente ? "border-l-4 border-l-warning" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words font-semibold">{nombreCompleto(fila.postulante)}</p>
            <p className="font-mono text-xs text-muted-foreground">C.I. {fila.postulante.cedula}</p>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        {fila.cargoTexto ? <p className="break-words text-sm">{fila.cargoTexto}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaEstado estado={fila.estado} />
        </div>
        <p className="text-xs text-muted-foreground">
          {fila.puntoCuentaNumero ? `Punto de Cuenta ${fila.puntoCuentaNumero} · ` : ""}
          {fila.numero} · {formatearFechaHora(fila.ultimoCambio)}
        </p>
      </Link>
    </li>
  );
}

export function BandejaIngresosView() {
  const [pestana, setPestana] = useState<PestanaDireccion>("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(1);
  const q = useRetraso(busqueda.trim(), 350);
  const def = PESTANAS_DIRECCION.find((p) => p.id === pestana) ?? PESTANAS_DIRECCION[0];

  const { data, error, isLoading, isValidating, mutate } = useSWR<PaginaArea>(
    ["direccion-bandeja", pestana, q, desde, hasta, pagina],
    async () => {
      const r = await listarIngresosAction({ estados: def.estados, vista: def.vista, q, desde, hasta, pagina, tamano: TAMANO });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    { keepPreviousData: true, revalidateOnFocus: true },
  );
  const { data: conteos } = useSWR("direccion-conteos", cargarConteos, { refreshInterval: 60_000, revalidateOnFocus: true });

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
    <PageLayout title="Ingresos por decidir" description="Revise el Punto de Cuenta de cada postulante y apruebe o rechace su ingreso.">
      <div className="mt-4 flex flex-col gap-5">
        <Tabs
          value={pestana}
          onValueChange={(v) => {
            setPestana(v as PestanaDireccion);
            setPagina(1);
          }}
          className="min-w-0"
        >
          <div className="-mx-1 snap-x snap-mandatory overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max min-w-full justify-start gap-1 group-data-[orientation=horizontal]/tabs:h-auto md:min-w-0">
              {PESTANAS_DIRECCION.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="min-h-10 shrink-0 snap-start gap-2 whitespace-nowrap px-3">
                  {p.etiqueta}
                  <span
                    aria-label={conteos?.[p.id] != null ? `${conteos[p.id]} ingresos` : undefined}
                    className={`min-w-6 rounded-full px-1.5 text-xs font-semibold ${p.id === "pendientes" && (conteos?.[p.id] ?? 0) > 0 ? "bg-warning text-white" : "bg-muted text-muted-foreground"}`}
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
          etiquetaResultados="ingresos"
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
          <VistaCargando mensaje="Cargando ingresos…" />
        ) : error ? (
          <VistaError mensaje={error instanceof Error ? error.message : "No fue posible cargar la bandeja."} onReintentar={() => void mutate()} />
        ) : filas.length === 0 ? (
          <VistaVacia
            titulo={hayFiltros ? "Ningún ingreso coincide" : pestana === "pendientes" ? "No hay ingresos por decidir" : "Aún no hay decisiones registradas"}
            descripcion={hayFiltros ? "Pruebe con otra búsqueda o limpie los filtros." : "Cuando Presupuesto emita un Punto de Cuenta aparecerá aquí."}
            accion={hayFiltros ? <Button type="button" variant="outline" onClick={limpiar}>Limpiar filtros</Button> : <Inbox className="size-6 text-muted-foreground" aria-hidden />}
          />
        ) : (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="hidden md:block">
              <table className="w-full text-left" aria-label="Ingresos de Dirección General">
                <thead className="border-b bg-muted/50 text-sm text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 font-semibold">Expediente</th>
                    <th scope="col" className="p-3 font-semibold">Postulante</th>
                    <th scope="col" className="p-3 font-semibold">Cargo y oficina</th>
                    <th scope="col" className="p-3 font-semibold">Punto de Cuenta</th>
                    <th scope="col" className="p-3 font-semibold">Estado</th>
                    <th scope="col" className="p-3 font-semibold">Último cambio</th>
                    <th scope="col" className="p-3"><span className="sr-only">Acción</span></th>
                  </tr>
                </thead>
                <tbody>{filas.map((f) => <FilaTabla key={f.id} fila={f} />)}</tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-3 p-3 md:hidden" aria-label="Ingresos de Dirección General">
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
