"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Loader2, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paginador } from "@/modules/captacion/ui/components/paginador";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import {
  opcionesDeFiltro,
  type FilaVacante,
  type OpcionFiltro,
  type PaginaVacantes,
  type ResultadoAccion,
} from "../../domain/solicitud";
import type { FiltrosVacantes } from "../../domain/solicitud";

interface Props {
  titulo: string;
  /** Carga las vacantes del expediente con los filtros dados. */
  cargar: (filtros: FiltrosVacantes) => Promise<ResultadoAccion<PaginaVacantes>>;
  /** Reserva el puesto elegido; devuelve el error en español o `null` si salió bien. */
  onReservar: (puestoId: number) => Promise<string | null>;
  onCerrar: () => void;
  /** Distingue la caché de cada expediente y de cada módulo que usa este panel. */
  claveCache?: string;
  /** El expediente no trae cargo ni oficina propuestos (Captación sin Presupuesto): se busca entre todas las vacantes. */
  sinPropuesta?: boolean;
}

const TAMANO = 6;

type ClaveFiltro = "cargo" | "dependencia" | "direccionLinea" | "coordinacion";
const SELECTS: { clave: ClaveFiltro; etiqueta: string; todos: string }[] = [
  { clave: "cargo", etiqueta: "Cargo", todos: "Cargo de la propuesta" },
  { clave: "dependencia", etiqueta: "Dependencia", todos: "Cualquier dependencia" },
  { clave: "direccionLinea", etiqueta: "Dirección de línea", todos: "Cualquier dirección de línea" },
  { clave: "coordinacion", etiqueta: "Coordinación", todos: "Cualquier coordinación" },
];

const CLASE_SELECT =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function fusionarOpciones(previas: Record<ClaveFiltro, OpcionFiltro[]>, filas: readonly FilaVacante[]) {
  const siguiente = { ...previas };
  for (const s of SELECTS) {
    const mapa = new Map(previas[s.clave].map((o) => [o.id, o]));
    for (const o of opcionesDeFiltro(filas, s.clave)) mapa.set(o.id, o);
    siguiente[s.clave] = [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
  return siguiente;
}

function useRetraso<T>(valor: T, ms: number): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setRetrasado(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}

/**
 * Panel con los puestos vacantes compatibles con la propuesta. Sin filtros rige la propuesta; al elegir un
 * filtro la búsqueda pasa a ser la que usted indica (el servidor lo avisa en `deLaPropuesta`).
 */
export function DialogoVacantes({ titulo, cargar, onReservar, onCerrar, claveCache = "presupuesto", sinPropuesta = false }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Partial<Record<ClaveFiltro, number>>>({});
  const [pagina, setPagina] = useState(1);
  const [reservando, setReservando] = useState<number | null>(null);
  const [errorReserva, setErrorReserva] = useState<string | null>(null);
  // Los filtros se arman con lo que el servidor ya mostró (se acumulan para no perder el elegido).
  const [opciones, setOpciones] = useState<Record<ClaveFiltro, OpcionFiltro[]>>({
    cargo: [], dependencia: [], direccionLinea: [], coordinacion: [],
  });
  const q = useRetraso(busqueda.trim(), 350);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ["vacantes", claveCache, q, seleccion, pagina],
    async () => {
      const r = await cargar({ ...seleccion, q, pagina, tamano: TAMANO });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      onSuccess: (pagina) => setOpciones((previas) => fusionarOpciones(previas, pagina.resultados)),
    },
  );

  const hayFiltros = Boolean(busqueda.trim()) || Object.values(seleccion).some((v) => v !== undefined);

  function limpiar() {
    setBusqueda("");
    setSeleccion({});
    setPagina(1);
  }

  async function reservar(f: FilaVacante) {
    setReservando(f.id);
    setErrorReserva(null);
    const e = await onReservar(f.id);
    setReservando(null);
    if (e) {
      setErrorReserva(e);
      void mutate();
    }
  }

  const filas = data?.resultados ?? [];

  return (
    <Dialog open onOpenChange={(a) => (!a && reservando === null ? onCerrar() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {sinPropuesta
              ? "Puestos vacantes libres. Busque por código o filtre por cargo y unidad para encontrar el adecuado."
              : data?.deLaPropuesta === false
                ? "Búsqueda personalizada: se muestran los puestos vacantes que coinciden con sus filtros."
                : "Puestos vacantes compatibles con el cargo y la oficina que propuso Captación."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="relative">
            <Label htmlFor="buscar-vacante" className="sr-only">Buscar puesto</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="buscar-vacante"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              placeholder="Buscar por código, cargo o unidad…"
              className="pl-9"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SELECTS.map((s) => (
              <div key={s.clave} className="flex min-w-0 flex-col gap-1">
                <Label htmlFor={`filtro-${s.clave}`} className="text-xs">{s.etiqueta}</Label>
                <select
                  id={`filtro-${s.clave}`}
                  className={CLASE_SELECT}
                  value={seleccion[s.clave] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : undefined;
                    setSeleccion((p) => ({ ...p, [s.clave]: v }));
                    setPagina(1);
                  }}
                >
                  <option value="">{sinPropuesta && s.clave === "cargo" ? "Cualquier cargo" : s.todos}</option>
                  {opciones[s.clave].map((o) => (
                    <option key={o.id} value={o.id}>{o.nombre}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {hayFiltros ? (
            <Button type="button" variant="ghost" size="sm" onClick={limpiar} className="w-fit">
              <RotateCcw aria-hidden /> {sinPropuesta ? "Quitar los filtros" : "Volver a la propuesta"}
            </Button>
          ) : null}
        </div>

        {errorReserva ? (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{errorReserva}</p>
        ) : null}

        {isLoading ? (
          <VistaCargando mensaje="Buscando puestos vacantes…" />
        ) : error ? (
          <VistaError mensaje={error instanceof Error ? error.message : "No fue posible cargar los puestos."} onReintentar={() => void mutate()} />
        ) : filas.length === 0 ? (
          <VistaVacia
            titulo="No hay puestos vacantes con estos criterios"
            descripcion={
              sinPropuesta
                ? hayFiltros
                  ? "Pruebe con otro filtro o quite los filtros."
                  : "No hay puestos vacantes libres: todos pueden estar reservados para otros expedientes."
                : hayFiltros
                  ? "Pruebe con otro filtro o vuelva a la propuesta."
                  : "No hay puestos vacantes libres para esta propuesta. Pruebe ampliar la búsqueda con los filtros."
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="hidden overflow-hidden rounded-lg border md:block">
              <table className="w-full text-left" aria-label="Puestos vacantes">
                <thead className="border-b bg-muted/50 text-sm text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 font-semibold">Código</th>
                    <th scope="col" className="p-3 font-semibold">Cargo</th>
                    <th scope="col" className="p-3 font-semibold">Unidad</th>
                    <th scope="col" className="p-3"><span className="sr-only">Acción</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id} data-testid="fila-vacante" className="border-b last:border-0">
                      <td className="p-3 font-mono text-sm font-semibold">{f.codigo}</td>
                      <td className="p-3 text-sm">{f.cargo.nombre}</td>
                      <td className="p-3 text-sm text-muted-foreground">{unidadDe(f)}</td>
                      <td className="p-3 text-right">
                        <BotonReservar fila={f} reservando={reservando} onReservar={reservar} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-3 md:hidden" aria-label="Puestos vacantes">
              {filas.map((f) => (
                <li key={f.id} data-testid="fila-vacante" className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                  <p className="font-mono font-bold">{f.codigo}</p>
                  <p className="text-sm font-medium">{f.cargo.nombre}</p>
                  <p className="text-sm text-muted-foreground">{unidadDe(f)}</p>
                  <BotonReservar fila={f} reservando={reservando} onReservar={reservar} bloque />
                </li>
              ))}
            </ul>
            <Paginador pagina={data?.pagina ?? 1} totalPaginas={data?.totalPaginas ?? 1} total={data?.total ?? 0} cargando={isValidating} onPagina={setPagina} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function unidadDe(f: FilaVacante): string {
  return [f.direccionGeneral.nombre, f.direccionLinea.nombre, f.coordinacion.nombre, f.dependencia.nombre].filter(Boolean).join(" › ") || "—";
}

function BotonReservar({
  fila,
  reservando,
  onReservar,
  bloque = false,
}: {
  fila: FilaVacante;
  reservando: number | null;
  onReservar: (f: FilaVacante) => void;
  bloque?: boolean;
}) {
  if (fila.reservaPropia) {
    return <span className="text-sm font-semibold text-success">Reservado para este expediente</span>;
  }
  return (
    <Button
      type="button"
      size="sm"
      className={bloque ? "w-full" : undefined}
      disabled={reservando !== null}
      aria-label={`Reservar el puesto ${fila.codigo}`}
      onClick={() => onReservar(fila)}
    >
      {reservando === fila.id ? <Loader2 className="animate-spin" aria-hidden /> : null}
      Reservar
    </Button>
  );
}
