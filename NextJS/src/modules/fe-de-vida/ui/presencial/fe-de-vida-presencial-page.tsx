"use client";

import { useState, useTransition } from "react";
import useSWR from "swr";
import {
  ArrowLeft,
  ChevronRight,
  FileCheck,
  FileText,
  Loader2,
  MailX,
  Printer,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import type {
  InicioPresencialDTO,
  PasivoPresencialDTO,
} from "../../application/dtos/fe-de-vida-dto";
import {
  buscarPasivosPresencialAction,
  descargarConstanciaBienestarAction,
  iniciarSolicitudPresencialAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { PRESENTACION_SOLICITUD } from "../comun/estado-ui";
import { FormularioFeDeVida } from "../pasivo/formulario-fe-de-vida";
import { PaginacionNav } from "../comun/paginacion-nav";

export default function FeDeVidaPresencialPage() {
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [offset, setOffset] = useState(0);
  const [limite, setLimite] = useState(10);

  // Pasivo en proceso de registro presencial
  const [activo, setActivo] = useState<InicioPresencialDTO | null>(null);
  const [cargandoActivo, iniciarActivo] = useTransition();
  const [imprimiendoId, setImprimiendoId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    ["fe-de-vida-presencial-buscar", busqueda, offset, limite],
    async () => {
      const res = await buscarPasivosPresencialAction({
        texto: busqueda,
        limit: limite,
        offset: offset,
      });
      if (!res.ok) throw new Error(res.mensaje);
      return res.datos;
    },
  );

  function abrirRegistro(pasivo: PasivoPresencialDTO) {
    iniciarActivo(async () => {
      const res = await iniciarSolicitudPresencialAction(pasivo.cedula);
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      setActivo(res.datos);
    });
  }

  async function imprimirConstancia(solicitudId: string, cedula: string) {
    setImprimiendoId(solicitudId);
    try {
      const res = await descargarConstanciaBienestarAction(solicitudId);
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      const byteCharacters = atob(res.datos);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `constancia-${cedula}.pdf`;
        a.click();
      }
    } catch {
      toast.error("No se pudo generar la constancia para impresión.");
    } finally {
      setImprimiendoId(null);
    }
  }

  // Vista del formulario presencial
  if (activo) {
    const { solicitud, cambios, ficha } = activo;
    const migas = (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 gap-2 rounded-full px-4 shadow-xs"
        onClick={() => {
          setActivo(null);
          void mutate();
        }}
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver a la búsqueda
      </Button>
    );

    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader
          migas={migas}
          titulo={`Registro presencial: ${solicitud.nombre || solicitud.cedula}`}
          descripcion="Atención presencial del pasivo en sede. Consigne los datos declarados y capture su evidencia de identidad."
        />
        <div className="rounded-xl border bg-card p-4">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase">Cédula</dt>
              <dd className="text-base font-medium">{solicitud.cedula}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase">Nombre</dt>
              <dd className="text-base font-medium">{solicitud.nombre || "Sin nombre"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase">Canal</dt>
              <dd className="text-base font-medium text-primary">Presencial</dd>
            </div>
          </dl>
        </div>
        <FormularioFeDeVida
          solicitud={solicitud}
          detalle={{ solicitud, cambios }}
          modo="presencial"
          fichaInicial={ficha}
          onActualizar={() => {
            setActivo(null);
            void mutate();
          }}
        />
      </div>
    );
  }

  // Vista de búsqueda
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        titulo="Fe de vida presencial"
        descripcion="Búsqueda y consignación de fe de vida para el personal pasivo que asiste presencialmente a la institución."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setBusqueda(texto.trim());
        }}
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
      >
        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <label htmlFor="p-texto" className="text-base font-medium">
            Buscar por cédula o nombre
          </label>
          <Input
            id="p-texto"
            placeholder="Ej. 12345678 o Pérez…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button type="submit" className="min-h-11">
          <Search aria-hidden /> Buscar
        </Button>
        {busqueda ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setTexto("");
              setBusqueda("");
              setOffset(0);
            }}
          >
            Limpiar
          </Button>
        ) : null}
      </form>

      <div aria-live="polite" className="flex flex-col gap-4">
        {isLoading || cargandoActivo ? (
          <VistaCargando mensaje="Buscando pasivos…" onReintentar={() => mutate()} />
        ) : null}
        {error ? (
          <VistaError mensaje="No se pudo realizar la búsqueda." onReintentar={() => mutate()} />
        ) : null}
        {data && data.results.length === 0 ? (
          <VistaVacia
            titulo="Sin resultados"
            descripcion={
              busqueda
                ? `No se encontraron pasivos que coincidan con «${busqueda}».`
                : "No hay registros disponibles en este momento."
            }
          />
        ) : null}

        {data && data.results.length > 0 ? (
          <div
            role="region"
            aria-label="Resultados de pasivos"
            tabIndex={0}
            className="overflow-x-auto rounded-xl border bg-card"
          >
            <table className="w-full min-w-[760px] text-left text-base">
              <caption className="sr-only">Pasivos para atención presencial</caption>
              <thead className="border-b bg-muted text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Pasivo
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Pensión
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Acceso
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Estado fe de vida
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((p) => {
                  const est = p.solicitud?.estado ?? null;
                  const pres = est ? PRESENTACION_SOLICITUD[est] : null;

                  return (
                    <tr key={p.cedula} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-medium">{p.nombreCompleto}</span>
                        <br />
                        <span className="text-sm text-muted-foreground">{p.cedula}</span>
                      </td>
                      <td className="px-4 py-3">{p.tipoNomina || "Sin pensión"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {p.tieneCuenta ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                              <UserCheck className="size-3" /> Con cuenta
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
                              <UserX className="size-3" /> Sin cuenta
                            </span>
                          )}
                          {!p.correo ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                              <MailX className="size-3" /> Sin correo
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {pres ? (
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge texto={pres.texto} tono={pres.tono} icono={pres.icono} />
                            {p.solicitud?.canal === "PRESENCIAL" ? (
                              <span className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                                Presencial
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                En línea
                              </span>
                            )}
                          </div>
                        ) : (
                          <StatusBadge texto="Sin solicitud" tono="neutral" icono={FileText} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {p.puedeImprimir && p.solicitud ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-10 gap-1.5"
                              disabled={imprimiendoId === p.solicitud.id}
                              onClick={() => imprimirConstancia(p.solicitud!.id, p.cedula)}
                            >
                              {imprimiendoId === p.solicitud.id ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <Printer className="size-4" aria-hidden />
                              )}
                              Imprimir constancia
                            </Button>
                          ) : null}

                          {p.puedeIniciar || p.puedeContinuar ? (
                            <Button
                              type="button"
                              size="sm"
                              className="min-h-10 gap-1"
                              onClick={() => abrirRegistro(p)}
                            >
                              {p.puedeContinuar ? "Continuar" : "Iniciar"}
                              <ChevronRight className="size-4" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {data && data.count > 0 ? (
        <PaginacionNav
          etiqueta="Paginación de resultados presenciales"
          total={data.count}
          offset={offset}
          limite={limite}
          onOffset={setOffset}
          tamanos={[10, 25, 50]}
          onLimite={(l) => {
            setLimite(l);
            setOffset(0);
          }}
        />
      ) : null}
    </div>
  );
}
