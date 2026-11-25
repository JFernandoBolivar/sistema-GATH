"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Copy, FilePlus2, FileStack, FileText, FileUp, Pencil, Power } from "lucide-react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRutaDocumentos } from "../hooks/use-ruta-documentos";
import type { PlantillaResumen } from "../../domain/entities/plantilla";
import { activarPlantillaAction, duplicarPlantillaAction } from "../../infrastructure/actions/documentos-actions";
import { CrearPlantillaDialog } from "../components/crear-plantilla-dialog";
import { EstadoPlantilla } from "../components/estado-plantilla";
import { usePermisosDocumentos } from "../hooks/use-permisos-documentos";
import { usePlantillas, useVariables } from "../hooks/use-documentos-datos";
import { agruparProcesos } from "../../domain/lib/procesos";
import { ETIQUETA_FIRMANTE, ETIQUETA_MODO, estaPublicada, formatearFecha, tituloGrupoProceso } from "../lib/etiquetas";

type FiltroEstado = "todas" | "activas" | "inactivas" | "borrador";
const FILTROS_ESTADO: { id: FiltroEstado; etiqueta: string }[] = [
  { id: "todas", etiqueta: "Todas" },
  { id: "activas", etiqueta: "Activas" },
  { id: "inactivas", etiqueta: "Inactivas" },
  { id: "borrador", etiqueta: "Borradores" },
];

function coincideEstado(p: PlantillaResumen, f: FiltroEstado): boolean {
  if (f === "todas") return true;
  if (f === "borrador") return !estaPublicada(p);
  return estaPublicada(p) && (f === "activas" ? p.activa : !p.activa);
}

interface PropsLista {
  /** Filtros que llegan por la URL (`?grupo=punto_cuenta&proceso=…`). */
  filtrosIniciales?: { grupo?: string; proceso?: string };
  /** Abre el diálogo de creación al entrar (`?crear=1`). */
  crearAbiertoInicial?: boolean;
  procesoCrearInicial?: string;
}

export function ListaPlantillasView({ filtrosIniciales, crearAbiertoInicial, procesoCrearInicial }: PropsLista = {}) {
  const RUTA_DOCUMENTOS = useRutaDocumentos();
  const router = useRouter();
  const pathname = usePathname();
  const grupoActivo = filtrosIniciales?.grupo ?? "";
  const [filtroProceso, setFiltroProceso] = useState(filtrosIniciales?.proceso ?? "");
  const { plantillas, alertas, cargando, error, recargar } = usePlantillas({
    grupo: grupoActivo || undefined,
    proceso: filtroProceso || undefined,
  });
  const { catalogo, error: errorCatalogo, recargar: recargarCatalogo } = useVariables();
  const { puedeGestionar } = usePermisosDocumentos();
  const [creando, setCreando] = useState(Boolean(crearAbiertoInicial));
  const [procesoNueva, setProcesoNueva] = useState<string | undefined>(procesoCrearInicial);
  const [aActivar, setAActivar] = useState<PlantillaResumen | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todas");
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const duplicar = async (p: PlantillaResumen) => {
    setTrabajando(p.id);
    const r = await duplicarPlantillaAction(p.id);
    setTrabajando(null);
    if (!r.success) return toast.error(r.error);
    toast.success("Plantilla duplicada como borrador.");
    await recargar();
    router.push(`${RUTA_DOCUMENTOS}/${r.data.id}`);
  };

  const confirmarActivacion = async () => {
    if (!aActivar) return;
    const objetivo = aActivar;
    setTrabajando(objetivo.id);
    const r = await activarPlantillaAction(objetivo.id, !objetivo.activa);
    setTrabajando(null);
    setAActivar(null);
    if (!r.success) return toast.error(r.error);
    toast.success(objetivo.activa ? "Plantilla desactivada." : "Plantilla activada.");
    await recargar();
  };

  const procesos = catalogo?.procesos ?? [];
  const gruposProceso = agruparProcesos(procesos);
  const procesosDelGrupo = grupoActivo ? procesos.filter((p) => p.grupo === grupoActivo) : procesos;

  const elegirGrupo = (grupo: string) => {
    setFiltroProceso("");
    router.replace(grupo ? `${pathname}?grupo=${encodeURIComponent(grupo)}` : pathname);
  };

  const abrirCreacion = (proceso?: string) => {
    setProcesoNueva(proceso);
    setCreando(true);
  };

  const texto = busqueda.trim().toLowerCase();
  const visibles = plantillas.filter(
    (p) =>
      coincideEstado(p, filtroEstado) &&
      (!filtroProceso || p.proceso === filtroProceso) &&
      (!texto || `${p.nombre} ${p.codigo} ${p.descripcion ?? ""} ${p.proceso_etiqueta}`.toLowerCase().includes(texto)),
  );

  return (
    <PageLayout
      title="Plantillas de documentos"
      description="Plantillas de los documentos que se generan en el sistema: formularios propios y formatos de terceros."
    >
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {cargando ? "Cargando…" : `${visibles.length} de ${plantillas.length} plantilla${plantillas.length === 1 ? "" : "s"}`}
        </p>
        {puedeGestionar && catalogo && (
          <Button onClick={() => abrirCreacion()}>
            <FilePlus2 aria-hidden /> Nueva plantilla
          </Button>
        )}
      </div>

      {errorCatalogo && (
        <div role="alert" className="mt-4 flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>No se pudo cargar el catálogo de procesos. Reintente antes de diseñar una plantilla.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void recargarCatalogo()}>
            Reintentar
          </Button>
        </div>
      )}

      {alertas.length > 0 && (
        <section
          aria-label="Plantillas pendientes de crear"
          className="mt-4 grid gap-2 rounded-xl border border-amber-500/50 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> Faltan plantillas por crear
          </h2>
          <ul className="grid gap-2">
            {alertas.map((a) => (
              <li key={a.proceso} className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>{a.mensaje}</span>
                {puedeGestionar && catalogo && (
                  <Button asChild size="sm" variant="outline" className="self-start bg-background sm:self-auto">
                    <Link href={`${RUTA_DOCUMENTOS}?crear=1&proceso=${encodeURIComponent(a.proceso)}&grupo=punto_cuenta`}>
                      <FilePlus2 aria-hidden /> Diseñar plantilla
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gruposProceso.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por grupo de procesos">
          <Button type="button" size="sm" variant={grupoActivo ? "outline" : "default"} aria-pressed={!grupoActivo} onClick={() => elegirGrupo("")}>
            Todos los procesos
          </Button>
          {gruposProceso.map((g) => (
            <Button key={g.grupo} type="button" size="sm" variant={grupoActivo === g.grupo ? "default" : "outline"} aria-pressed={grupoActivo === g.grupo} onClick={() => elegirGrupo(g.grupo)}>
              {tituloGrupoProceso(g.grupo)}
            </Button>
          ))}
        </div>
      )}

      {plantillas.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código o proceso…"
            aria-label="Buscar plantillas por nombre, código o proceso"
            className="sm:max-w-sm"
          />
          {procesosDelGrupo.length > 1 && (
            <select
              aria-label="Filtrar por proceso"
              value={filtroProceso}
              onChange={(e) => setFiltroProceso(e.target.value)}
              className="h-11 rounded-md border border-input bg-background px-3 text-base sm:h-9 sm:max-w-56 sm:text-sm"
            >
              <option value="">Todos los procesos</option>
              {procesosDelGrupo.map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.etiqueta}</option>
              ))}
            </select>
          )}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            {FILTROS_ESTADO.map((f) => (
              <Button key={f.id} type="button" size="sm" variant={filtroEstado === f.id ? "default" : "outline"} aria-pressed={filtroEstado === f.id} onClick={() => setFiltroEstado(f.id)}>
                {f.etiqueta}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!cargando && plantillas.length > 0 && visibles.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Ninguna plantilla coincide con la búsqueda o el filtro.</p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {cargando && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {!cargando && !error && plantillas.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed bg-background p-10 text-center">
          <FileStack className="size-10 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold">Aún no hay plantillas de documentos</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Cree una plantilla para generar documentos con los datos del sistema: un formulario propio de CONATEL o un
            formato de terceros sobre su PDF.
          </p>
          {puedeGestionar && catalogo && (
            <Button onClick={() => abrirCreacion()}>
              <FilePlus2 aria-hidden /> Crear la primera plantilla
            </Button>
          )}
        </div>
      )}

      <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibles.map((p) => (
          <li key={p.id}>
            <Card className="h-full">
              <CardHeader className="gap-2">
                <CardTitle className="flex items-start gap-2 text-base">
                  {p.modo === "formulario" ? (
                    <FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <FileUp className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  )}
                  <span className="min-w-0 break-words">{p.nombre}</span>
                </CardTitle>
                <p className="font-mono text-xs text-muted-foreground">{p.codigo}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="max-w-full whitespace-normal text-left" title={p.proceso}>
                    {p.proceso_etiqueta || p.proceso}
                  </Badge>
                  <EstadoPlantilla plantilla={p} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {p.descripcion && <p className="line-clamp-2 text-muted-foreground">{p.descripcion}</p>}
                <p className="text-xs text-muted-foreground">
                  {ETIQUETA_MODO[p.modo]} · Firma: {ETIQUETA_FIRMANTE[p.firmante]}
                  {p.requiere_firma_clic ? " (por clic)" : ""}
                </p>
                <p className="text-xs text-muted-foreground">Actualizada: {formatearFecha(p.actualizada_en)}</p>
              </CardContent>
              <CardFooter className="mt-auto flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`${RUTA_DOCUMENTOS}/${p.id}`}>
                    <Pencil aria-hidden /> {puedeGestionar ? "Editar" : "Abrir"}
                  </Link>
                </Button>
                {puedeGestionar && (
                  <>
                    <Button size="sm" variant="outline" disabled={trabajando === p.id} onClick={() => duplicar(p)}>
                      <Copy aria-hidden /> Duplicar
                    </Button>
                    {estaPublicada(p) && (
                      <Button size="sm" variant="outline" disabled={trabajando === p.id} onClick={() => setAActivar(p)}>
                        <Power aria-hidden /> {p.activa ? "Desactivar" : "Activar"}
                      </Button>
                    )}
                  </>
                )}
              </CardFooter>
            </Card>
          </li>
        ))}
      </ul>

      <CrearPlantillaDialog
        key={procesoNueva ?? "sin-proceso"}
        abierto={creando}
        procesos={procesos}
        procesoInicial={procesoNueva}
        onCerrar={() => setCreando(false)}
        onCreada={(p) => {
          setCreando(false);
          void recargar();
          router.push(`${RUTA_DOCUMENTOS}/${p.id}`);
        }}
      />

      <AlertDialog open={aActivar !== null} onOpenChange={(v) => !v && setAActivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{aActivar?.activa ? "Desactivar plantilla" : "Activar plantilla"}</AlertDialogTitle>
            <AlertDialogDescription>
              {aActivar?.activa
                ? `«${aActivar?.nombre}» dejará de ofrecerse para generar documentos nuevos. Los ya generados no cambian.`
                : `«${aActivar?.nombre}» se usará para generar documentos nuevos con su última versión publicada.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarActivacion}>
              {aActivar?.activa ? "Desactivar" : "Activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
