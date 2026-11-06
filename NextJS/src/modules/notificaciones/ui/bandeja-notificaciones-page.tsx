"use client";

import { useEffect, useId, useState, useTransition } from "react";
import useSWR, { useSWRConfig } from "swr";
import { CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/shared/ui/components/page-header";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import type { ModuloNotificaciones } from "../domain/entities/notificacion";
import type { FiltrosNotificaciones } from "../domain/ports/repo-notificaciones";
import {
  listarNotificacionesAction,
  marcarLeidaAction,
  marcarTodasLeidasAction,
} from "../infrastructure/actions/notificaciones-actions";
import { NotificacionItem } from "./notificacion-item";
import {
  claveBandeja,
  desenvolver,
  esClaveDeNotificaciones,
  usePuedeAbrirEnlace,
} from "./notificaciones-swr";
import { TIPOS_NOTIFICACION } from "./tipos-notificacion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

/** Radix no admite value="" en un ítem: «Todos» usa este centinela. */
const TODOS = "__todos__";

export const TAMANO_PAGINA = 10;
export const RETARDO_BUSQUEDA_MS = 400;

type EstadoLectura = "todas" | "no" | "si";

interface Props {
  /** Se conserva por compatibilidad con los shells; la bandeja ahora es única por usuario. */
  modulo: ModuloNotificaciones;
}

/**
 * Bandeja completa de notificaciones del usuario: filtros (texto con retardo, tipo,
 * lectura y fechas) y paginación en servidor (anterior/siguiente + total).
 */
export default function BandejaNotificacionesPage({ modulo }: Props) {
  // La lectura es por usuario: el módulo del shell ya no filtra la bandeja.
  void modulo;
  const id = useId();
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState<EstadoLectura>("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(0);
  const [pendiente, startTransition] = useTransition();
  const { mutate } = useSWRConfig();
  const puedeAbrirEnlace = usePuedeAbrirEnlace();
  const tipos = TIPOS_NOTIFICACION;

  // Búsqueda con retardo: no se consulta al servidor en cada pulsación.
  useEffect(() => {
    const nuevo = texto.trim();
    if (nuevo === q) return;
    const t = setTimeout(() => {
      setQ(nuevo);
      setPagina(0);
    }, RETARDO_BUSQUEDA_MS);
    return () => clearTimeout(t);
  }, [texto, q]);

  const fechasInvertidas = Boolean(desde && hasta && desde > hasta);
  const filtros: FiltrosNotificaciones = {
    q: q || undefined,
    tipo: tipo || undefined,
    leida: estado === "todas" ? undefined : estado === "si",
    desde: desde || undefined,
    hasta: hasta || undefined,
    limite: TAMANO_PAGINA,
    desplazamiento: pagina * TAMANO_PAGINA,
  };

  const { data, error, isLoading } = useSWR(
    fechasInvertidas ? null : claveBandeja(filtros),
    async () => desenvolver(await listarNotificacionesAction(filtros)),
    { shouldRetryOnError: false, keepPreviousData: true },
  );

  const refrescar = () => mutate(esClaveDeNotificaciones);

  const marcarLeida = (idNotificacion: string) =>
    startTransition(async () => {
      await marcarLeidaAction(idNotificacion);
      await refrescar();
    });

  const marcarTodas = () =>
    startTransition(async () => {
      await marcarTodasLeidasAction();
      await refrescar();
    });

  const total = data?.total ?? 0;
  const totalPaginas = Math.max(Math.ceil(total / TAMANO_PAGINA), 1);
  const primero = total === 0 ? 0 : pagina * TAMANO_PAGINA + 1;
  const ultimo = Math.min((pagina + 1) * TAMANO_PAGINA, total);
  const hayNoLeidas = data?.resultados.some((n) => !n.leida) ?? false;
  const hayFiltros = Boolean(q || tipo || estado !== "todas" || desde || hasta);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        titulo="Notificaciones"
        descripcion="Aquí encuentra todos sus avisos, sin importar el módulo en que se generaron."
        accion={
          <Button
            type="button"
            size="lg"
            disabled={pendiente || !hayNoLeidas}
            onClick={marcarTodas}
          >
            <CheckCheck aria-hidden /> Marcar todas como leídas
          </Button>
        }
      />

      <form
        role="search"
        aria-label="Filtros de notificaciones"
        className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <Label htmlFor={`${id}-q`}>Buscar</Label>
          <Input
            id={`${id}-q`}
            type="search"
            value={texto}
            maxLength={100}
            placeholder="Título o mensaje"
            className="h-11"
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-tipo`}>Tipo</Label>
          <Select
            value={tipo || TODOS}
            onValueChange={(v) => {
              setTipo(v === TODOS ? "" : v);
              setPagina(0);
            }}
          >
            <SelectTrigger id={`${id}-tipo`} className="h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t.codigo} value={t.codigo}>
                  {t.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-leida`}>Estado</Label>
          <Select
            value={estado}
            onValueChange={(v) => {
              setEstado(v as EstadoLectura);
              setPagina(0);
            }}
          >
            <SelectTrigger id={`${id}-leida`} className="h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="no">No leídas</SelectItem>
              <SelectItem value="si">Leídas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-desde`}>Desde</Label>
            <Input
              id={`${id}-desde`}
              type="date"
              value={desde}
              max={hasta || undefined}
              className="h-11"
              onChange={(e) => {
                setDesde(e.target.value);
                setPagina(0);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-hasta`}>Hasta</Label>
            <Input
              id={`${id}-hasta`}
              type="date"
              value={hasta}
              min={desde || undefined}
              className="h-11"
              onChange={(e) => {
                setHasta(e.target.value);
                setPagina(0);
              }}
            />
          </div>
        </div>
      </form>
      {fechasInvertidas ? (
        <p role="alert" className="text-sm font-medium text-danger">
          La fecha «Desde» no puede ser posterior a «Hasta».
        </p>
      ) : null}

      {fechasInvertidas ? null : isLoading ? (
        <VistaCargando mensaje="Cargando sus notificaciones…" />
      ) : error ? (
        <VistaError
          mensaje="No se pudieron cargar sus notificaciones."
          onReintentar={() => void refrescar()}
        />
      ) : !data?.resultados.length ? (
        <VistaVacia
          titulo={
            hayFiltros ? "Ninguna notificación coincide con los filtros" : "No tiene notificaciones"
          }
          descripcion={
            hayFiltros
              ? "Pruebe con otros filtros."
              : "Cuando haya novedades, las verá aquí."
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3" aria-label="Lista de notificaciones">
            {data.resultados.map((n) => (
              <NotificacionItem
                key={n.id}
                notificacion={n}
                deshabilitado={pendiente}
                onMarcarLeida={marcarLeida}
                puedeAbrirEnlace={puedeAbrirEnlace}
              />
            ))}
          </ul>
          <nav
            aria-label="Paginación de notificaciones"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              Mostrando {primero}–{ultimo} de {total} · Página {pagina + 1} de {totalPaginas}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => Math.max(p - 1, 0))}
              >
                <ChevronLeft aria-hidden /> Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={pagina + 1 >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente <ChevronRight aria-hidden />
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
