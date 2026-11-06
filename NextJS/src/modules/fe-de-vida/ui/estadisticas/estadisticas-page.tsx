"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { Download, FileSpreadsheet, FileText, ImageDown, Inbox, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/shared/ui/components/page-header";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import {
  archivoDeRespuesta,
  esCancelacion,
  guardarArchivo,
} from "@/shared/lib/exportaciones-asincronas";
import { useProgresoExportacion } from "@/shared/lib/use-progreso-exportacion";
import type { PasivoEstadisticaDTO } from "../../application/dtos/fe-de-vida-dto";
import type { OpcionesReporteEstadisticas } from "../../application/use-cases/gestionar-estadisticas";
import {
  parametrosExportacion,
} from "../../application/use-cases/gestionar-estadisticas";
import type { EstadoSolicitud } from "../../domain/value-objects/estados";
import { ESTADOS_SOLICITUD, LIMITE_PAGINA, PERMISOS_FE_DE_VIDA } from "../../domain/value-objects/estados";
import {
  listarPasivosEstadisticaAction,
  obtenerEstadisticasAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { PaginacionNav } from "../comun/paginacion-nav";
import { useSesionFeDeVida } from "../comun/use-sesion-fe-de-vida";
import { DialogoExportarEstadisticas } from "./dialogo-exportar-estadisticas";
import { capturarGraficoPng, descargarPng } from "./capturar-grafico";
import {
  ETIQUETAS_ESTADO_MATRIZ,
  ETIQUETA_CANAL,
  datosBarrasEstados,
  datosBarrasTipos,
  datosDonutCobertura,
  filasMatriz,
  tituloCasilla,
} from "./datos-graficos";
import { GraficoDonut, GraficoEstados, GraficoTipos } from "./graficos-estadisticas";

const CLASE_CONTROL =
  "h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const FILTROS_VACIOS = {
  procesoId: "",
  tipoNominaId: "",
  estado: "",
  canal: "",
  desde: "",
  hasta: "",
};
type Filtros = typeof FILTROS_VACIOS;

type Detalle =
  | { modo: "faltantes" }
  | { modo: "celda"; tipoNominaId: number | null; tipoNomina: string; estado: EstadoSolicitud };

function Kpi({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle: string; tono: string }) {
  return (
    <article className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
      <p className={`text-3xl font-bold ${tono}`}>{valor}</p>
      <p className="text-sm text-muted-foreground">{detalle}</p>
    </article>
  );
}

export default function EstadisticasPage() {
  const { puede } = useSesionFeDeVida();
  const autorizado = puede(PERMISOS_FE_DE_VIDA.verEstadisticas);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [offset, setOffset] = useState(0);
  const [limite, setLimite] = useState(LIMITE_PAGINA);
  const exportacion = useProgresoExportacion();
  const [exportando, setExportando] = useState<string | null>(null);
  const [dialogoExportarAbierto, setDialogoExportarAbierto] = useState(false);
  const refCobertura = useRef<HTMLDivElement>(null);
  const refTipos = useRef<HTMLDivElement>(null);
  const refEstados = useRef<HTMLDivElement>(null);

  const { data, error, isLoading, mutate } = useSWR(
    ["fe-de-vida-estadisticas", filtros],
    async () => {
      const res = await obtenerEstadisticasAction({
        procesoId: filtros.procesoId || undefined,
        tipoNominaId: filtros.tipoNominaId ? Number(filtros.tipoNominaId) : undefined,
        estado: (filtros.estado || undefined) as EstadoSolicitud | undefined,
        canal: (filtros.canal || undefined) as "EN_LINEA" | "PRESENCIAL" | undefined,
        desde: filtros.desde || undefined,
        hasta: filtros.hasta || undefined,
      });
      if (!res.ok) throw new Error(res.mensaje);
      return res.datos;
    },
    { isPaused: () => !autorizado },
  );

  const { data: listado, isLoading: cargandoListado } = useSWR(
    detalle ? ["fe-de-vida-estadisticas-detalle", detalle, filtros, offset, limite] : null,
    async () => {
      const res = await listarPasivosEstadisticaAction({
        procesoId: filtros.procesoId || undefined,
        tipoNominaId:
          detalle?.modo === "celda" && detalle.tipoNominaId
            ? detalle.tipoNominaId
            : filtros.tipoNominaId
              ? Number(filtros.tipoNominaId)
              : undefined,
        estado: detalle?.modo === "celda" ? detalle.estado : undefined,
        canal: (filtros.canal || undefined) as "EN_LINEA" | "PRESENCIAL" | undefined,
        desde: filtros.desde || undefined,
        hasta: filtros.hasta || undefined,
        faltantes: detalle?.modo === "faltantes" || undefined,
        limit: limite,
        offset,
      });
      if (!res.ok) throw new Error(res.mensaje);
      return res.datos;
    },
  );

  function aplicar(v: Filtros) {
    setFiltros(v);
    setDetalle(null);
    setOffset(0);
  }

  async function capturar(nombre: string, ref: React.RefObject<HTMLDivElement | null>) {
    if (!ref.current) throw new Error(`El gráfico «${nombre}» no está visible.`);
    return capturarGraficoPng(ref.current);
  }

  async function descargarGrafico(nombre: string, ref: React.RefObject<HTMLDivElement | null>) {
    try {
      descargarPng(await capturar(nombre, ref), `grafico-${nombre}-fe-de-vida`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el gráfico.");
    }
  }

  async function descargarTodosLosGraficos() {
    for (const [nombre, ref] of [
      ["cobertura", refCobertura],
      ["tipos", refTipos],
      ["estados", refEstados],
    ] as const) {
      if (!ref.current) continue;
      await descargarGrafico(nombre, ref);
    }
  }

  async function exportar(
    formato: "pdf" | "excel",
    listadoExportacion: "faltantes" | "celda",
    celda?: { tipoNominaId: number | null; estado: EstadoSolicitud },
  ) {
    const etiqueta = `${formato === "pdf" ? "PDF" : "Excel"} ${listadoExportacion}`;
    setExportando(etiqueta);
    const opciones = exportacion.iniciar();
    const canal = filtros.canal === "EN_LINEA" || filtros.canal === "PRESENCIAL" ? filtros.canal : undefined;
    try {
      const params = parametrosExportacion(
        {
          ...filtros,
          canal,
          tipoNominaId: celda?.tipoNominaId ?? (filtros.tipoNominaId ? Number(filtros.tipoNominaId) : undefined),
          estado: celda?.estado ?? ((filtros.estado || undefined) as EstadoSolicitud | undefined),
        },
        listadoExportacion,
      );
      const query = new URLSearchParams();
      for (const [clave, valor] of Object.entries({ ...params, formato })) {
        if (valor !== undefined && valor !== null && String(valor) !== "") query.set(clave, String(valor));
      }
      const respuesta = await fetch(`/api/fe-de-vida/estadisticas/exportar?${query.toString()}`, {
        signal: opciones.signal,
        cache: "no-store",
      });
      const archivo = await archivoDeRespuesta(respuesta, "No se pudo generar el archivo.", opciones);
      guardarArchivo(
        archivo.blob,
        `${listadoExportacion === "faltantes" ? "faltan-por-responder" : "casilla-fe-de-vida"}.${formato === "pdf" ? "pdf" : "xlsx"}`,
      );
    } catch (e) {
      if (!esCancelacion(e)) toast.error(e instanceof Error ? e.message : "No se pudo generar el archivo.");
    } finally {
      setExportando(null);
    }
  }

  async function exportarReporte(opciones: OpcionesReporteEstadisticas) {
    const etiqueta = `${opciones.formato.toUpperCase()} (${opciones.alcanceListado})`;
    setExportando(etiqueta);
    const progreso = exportacion.iniciar();
    const canal = filtros.canal === "EN_LINEA" || filtros.canal === "PRESENCIAL" ? filtros.canal : undefined;
    try {
      const params = parametrosExportacion(
        {
          ...filtros,
          canal,
          tipoNominaId: filtros.tipoNominaId ? Number(filtros.tipoNominaId) : undefined,
          estado: (filtros.estado || undefined) as EstadoSolicitud | undefined,
        },
        opciones,
      );
      const query = new URLSearchParams();
      for (const [clave, valor] of Object.entries(params)) {
        if (valor !== undefined && valor !== null && String(valor) !== "") query.set(clave, String(valor));
      }

      const imagenes: Array<{ nombre: string; data: string }> = [];
      if (opciones.formato === "pdf" && opciones.incluirGraficos) {
        for (const [nombre, ref] of [
          ["cobertura", refCobertura],
          ["tipos", refTipos],
          ["estados", refEstados],
        ] as const) {
          if (!ref.current) continue;
          imagenes.push({ nombre, data: await capturar(nombre, ref) });
        }
      }

      const respuesta = await fetch(`/api/fe-de-vida/estadisticas/exportar?${query.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenes }),
        signal: progreso.signal,
        cache: "no-store",
      });
      const archivo = await archivoDeRespuesta(respuesta, "No se pudo generar el archivo.", progreso);
      guardarArchivo(
        archivo.blob,
        `estadisticas-fe-de-vida.${opciones.formato === "pdf" ? "pdf" : "xlsx"}`,
      );
      toast.success(`Reporte ${opciones.formato.toUpperCase()} generado exitosamente.`);
    } catch (e) {
      if (!esCancelacion(e)) toast.error(e instanceof Error ? e.message : "No se pudo generar el archivo.");
    } finally {
      setExportando(null);
    }
  }

  if (!autorizado) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader titulo="Estadísticas de fe de vida" descripcion="Resumen del proceso para Bienestar Social." />
        <VistaVacia
          titulo="Sin permiso para ver las estadísticas"
          descripcion="Solicite el permiso «Ver estadísticas de fe de vida» a la administradora del sistema."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        titulo="Estadísticas de fe de vida"
        descripcion="Cuántos pasivos debían hacerla, cuántos respondieron, quiénes faltan y en qué estado está cada solicitud."
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setDetalle(null);
          setOffset(0);
          void mutate();
        }}
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-proceso" className="text-base font-medium">Proceso</label>
          <select
            id="e-proceso"
            className={CLASE_CONTROL}
            value={filtros.procesoId}
            onChange={(e) => aplicar({ ...filtros, procesoId: e.target.value })}
          >
            <option value="">Proceso vigente</option>
            {(data?.procesos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.estado === "ABIERTO" ? "abierto" : p.estado === "CERRADO" ? "cerrado" : "en preparación"})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-tipo" className="text-base font-medium">Tipo de pasivo</label>
          <select
            id="e-tipo"
            className={CLASE_CONTROL}
            value={filtros.tipoNominaId}
            onChange={(e) => aplicar({ ...filtros, tipoNominaId: e.target.value })}
          >
            <option value="">Todos</option>
            {(data?.tipos ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-estado" className="text-base font-medium">Estado</label>
          <select
            id="e-estado"
            className={CLASE_CONTROL}
            value={filtros.estado}
            onChange={(e) => aplicar({ ...filtros, estado: e.target.value })}
          >
            <option value="">Todos</option>
            {ESTADOS_SOLICITUD.map((estado) => (
              <option key={estado} value={estado}>{ETIQUETAS_ESTADO_MATRIZ[estado]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-canal" className="text-base font-medium">Canal</label>
          <select
            id="e-canal"
            className={CLASE_CONTROL}
            value={filtros.canal}
            onChange={(e) => aplicar({ ...filtros, canal: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="EN_LINEA">En línea</option>
            <option value="PRESENCIAL">Presencial</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-desde" className="text-base font-medium">Enviadas desde</label>
          <Input id="e-desde" type="date" value={filtros.desde} onChange={(e) => aplicar({ ...filtros, desde: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-hasta" className="text-base font-medium">Enviadas hasta</label>
          <Input id="e-hasta" type="date" value={filtros.hasta} onChange={(e) => aplicar({ ...filtros, hasta: e.target.value })} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit" className="min-h-11"><Search aria-hidden /> Actualizar</Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => aplicar(FILTROS_VACIOS)}>
            Limpiar filtros
          </Button>
          <p className="ml-auto text-sm text-muted-foreground">
            Los indicadores son del proceso y tipo elegidos; estado, canal y fechas afinan los desgloses.
          </p>
        </div>
      </form>

      <div aria-live="polite" className="flex flex-col gap-6">
        {isLoading ? <VistaCargando mensaje="Calculando estadísticas…" onReintentar={() => mutate()} /> : null}
        {error ? (
          <VistaError
            mensaje={error instanceof Error ? error.message : "No se pudieron cargar las estadísticas."}
            onReintentar={() => mutate()}
          />
        ) : null}
        {!isLoading && !error && data && !data.proceso ? (
          <VistaVacia
            titulo="No hay un proceso abierto"
            descripcion="Elija un proceso del histórico en el filtro «Proceso» para consultar sus estadísticas."
          />
        ) : null}

        {data?.proceso ? (
          <>
            <section aria-label="Indicadores del proceso" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                titulo="Total de pasivos"
                valor={String(data.kpis.total)}
                detalle={`${data.proceso.nombre} · ${data.proceso.estado.toLowerCase()}`}
                tono="text-foreground"
              />
              <Kpi
                titulo="Respondieron"
                valor={`${data.kpis.respondieron}`}
                detalle={`${data.kpis.porcentajeRespondieron.toFixed(1)} % del total`}
                tono="text-emerald-700 dark:text-emerald-400"
              />
              <Kpi
                titulo="Faltan por responder"
                valor={`${data.kpis.faltan}`}
                detalle={`${data.kpis.porcentajeFaltan.toFixed(1)} % · sin envío (incluye borradores)`}
                tono="text-amber-700 dark:text-amber-400"
              />
              <Kpi
                titulo="Validadas por Bienestar"
                valor={`${data.kpis.validadas}`}
                detalle={`${data.kpis.porcentajeValidadas.toFixed(1)} % del total`}
                tono="text-sky-700 dark:text-sky-400"
              />
            </section>

            <section className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Gráficos del proceso</h2>
                <p className="text-sm text-muted-foreground">
                  Se incluyen en el PDF y puede descargarlos como PNG.
                </p>
              </div>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => void descargarTodosLosGraficos()}>
                <ImageDown aria-hidden /> Descargar todos
              </Button>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-xl border bg-card p-4 lg:col-span-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">Cobertura</h2>
                    <p className="mb-2 text-sm text-muted-foreground">Respondieron frente a quienes faltan.</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" aria-label="Descargar gráfico de cobertura" onClick={() => void descargarGrafico("cobertura", refCobertura)}>
                    <ImageDown aria-hidden />
                  </Button>
                </div>
                <GraficoDonut
                  contenedorRef={refCobertura}
                  datos={datosDonutCobertura(data.kpis.respondieron, data.kpis.faltan)}
                  total={data.kpis.total}
                />
              </article>
              <article className="rounded-xl border bg-card p-4 lg:col-span-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">Respondieron por tipo de pasivo</h2>
                    <p className="mb-2 text-sm text-muted-foreground">
                      Barras apiladas: respondieron y faltan por tipo de pasivo.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" aria-label="Descargar gráfico por tipo de pasivo" onClick={() => void descargarGrafico("tipos", refTipos)}>
                    <ImageDown aria-hidden />
                  </Button>
                </div>
                <GraficoTipos contenedorRef={refTipos} datos={datosBarrasTipos(data.porTipo)} />
              </article>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">Solicitudes por estado</h2>
                    <p className="mb-2 text-sm text-muted-foreground">Incluye borradores y vencidas del proceso.</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" aria-label="Descargar gráfico por estado" onClick={() => void descargarGrafico("estados", refEstados)}>
                    <ImageDown aria-hidden />
                  </Button>
                </div>
                <GraficoEstados contenedorRef={refEstados} datos={datosBarrasEstados(data.porEstado)} />
              </article>
              <article className="rounded-xl border bg-card p-4">
                <h2 className="text-lg font-semibold">Canal de las respuestas</h2>
                <p className="mb-3 text-sm text-muted-foreground">Solo cuentan las solicitudes enviadas.</p>
                {data.porCanal.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no hay respuestas con estos filtros.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.porCanal.map((c) => (
                      <li key={c.canal} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                        <span>{ETIQUETA_CANAL[c.canal] ?? c.canal}</span>
                        <span className="font-semibold">{c.total}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </section>

            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Matriz tipo de pasivo × estado</h2>
                  <p className="text-sm text-muted-foreground">
                    Pulse una casilla para ver y exportar sus pasivos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => { setDetalle({ modo: "faltantes" }); setOffset(0); }}
                  >
                    <Inbox aria-hidden /> Ver faltantes ({data.kpis.faltan})
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11 gap-2"
                    onClick={() => setDialogoExportarAbierto(true)}
                    disabled={exportando !== null}
                  >
                    <Download aria-hidden /> Generar reporte
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <caption className="sr-only">Matriz de tipos de pasivo por estado de fe de vida</caption>
                  <thead className="border-b bg-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Tipo de pasivo</th>
                      {ESTADOS_SOLICITUD.map((estado) => (
                        <th key={estado} scope="col" className="px-2 py-2 text-center font-semibold">
                          {ETIQUETAS_ESTADO_MATRIZ[estado]}
                        </th>
                      ))}
                      <th scope="col" className="px-3 py-2 text-center font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasMatriz(data.porTipo, data.matriz).map((fila) => (
                      <tr key={fila.tipoNomina} className="border-b last:border-0">
                        <th scope="row" className="px-3 py-2 text-left font-medium">{fila.tipoNomina}</th>
                        {ESTADOS_SOLICITUD.map((estado) => {
                          const total = fila.celdas[estado];
                          return (
                            <td key={estado} className="px-1 py-1 text-center">
                              <button
                                type="button"
                                disabled={total === 0}
                                onClick={() => { setDetalle({ modo: "celda", tipoNominaId: fila.tipoNominaId, tipoNomina: fila.tipoNomina, estado }); setOffset(0); }}
                                className="min-h-9 min-w-10 rounded-md px-2 py-1 font-medium underline-offset-2 hover:bg-muted disabled:cursor-default disabled:no-underline disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`${tituloCasilla(estado, fila.tipoNomina)}: ${total} pasivos`}
                              >
                                {total}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-semibold">{fila.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {detalle ? (
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    {detalle.modo === "faltantes"
                      ? "Faltan por responder"
                      : tituloCasilla(detalle.estado, detalle.tipoNomina)}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void exportar("excel", detalle.modo === "faltantes" ? "faltantes" : "celda",
                        detalle.modo === "celda" ? { tipoNominaId: detalle.tipoNominaId, estado: detalle.estado } : undefined)}
                      disabled={exportando !== null}
                    >
                      <Download aria-hidden /> Excel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void exportar("pdf", detalle.modo === "faltantes" ? "faltantes" : "celda",
                        detalle.modo === "celda" ? { tipoNominaId: detalle.tipoNominaId, estado: detalle.estado } : undefined)}
                      disabled={exportando !== null}
                    >
                      <Download aria-hidden /> PDF
                    </Button>
                  </div>
                </div>
                {exportando ? <p className="text-sm text-muted-foreground">{exportacion.texto}</p> : null}
                {cargandoListado ? <VistaCargando mensaje="Cargando pasivos…" onReintentar={() => undefined} /> : null}
                {listado && listado.results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay pasivos en esta casilla con los filtros aplicados.</p>
                ) : null}
                {listado && listado.results.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <caption className="sr-only">Pasivos del detalle seleccionado</caption>
                        <thead className="border-b bg-muted">
                          <tr>
                            <th scope="col" className="px-3 py-2 font-semibold">Pasivo</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Tipo de pasivo</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Correo</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Teléfono</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Envío</th>
                          </tr>
                        </thead>
                        <tbody>
                          {listado.results.map((p: PasivoEstadisticaDTO) => (
                            <tr key={p.cedula} className="border-b last:border-0">
                              <td className="px-3 py-2">
                                <span className="font-medium">{p.nombreCompleto}</span>
                                <br />
                                <span className="text-muted-foreground">{p.cedula}</span>
                              </td>
                              <td className="px-3 py-2">{p.tipoNomina || "—"}</td>
                              <td className="px-3 py-2 break-all">{p.correo || "—"}</td>
                              <td className="px-3 py-2">{p.telefono || "—"}</td>
                              <td className="px-3 py-2">
                                {p.estado ? ETIQUETAS_ESTADO_MATRIZ[p.estado] : "Sin solicitud"}
                              </td>
                              <td className="px-3 py-2">
                                {p.fechaEnvio ? new Date(p.fechaEnvio).toLocaleDateString("es-VE") : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginacionNav
                      etiqueta="Paginación del detalle de estadísticas"
                      total={listado.count}
                      offset={offset}
                      limite={limite}
                      onOffset={setOffset}
                      tamanos={[10, 50]}
                      onLimite={(l) => { setLimite(l); setOffset(0); }}
                    />
                  </>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <DialogoExportarEstadisticas
        abierto={dialogoExportarAbierto}
        alCerrar={() => setDialogoExportarAbierto(false)}
        alConfirmar={exportarReporte}
        estadisticas={data ?? null}
        filtrosActivos={filtros}
      />
    </div>
  );
}
