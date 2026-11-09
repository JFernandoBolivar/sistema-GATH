"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  History,
  Upload,
  CheckCircle,
  FileCheck,
  Download,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasoDescargarPlantilla } from "./paso-descargar-plantilla";
import { PasoSubirArchivo } from "./paso-subir-archivo";
import { PasoRevisionAnalisis } from "./paso-revision-analisis";
import { PasoConfirmarAplicacion } from "./paso-confirmar-aplicacion";
import { HistorialCargas } from "./historial-cargas";
import type {
  CargaMasivaDetalle,
  CargaMasivaResumen,
  ModoCarga,
  PoblacionCarga,
} from "../domain/entities/carga-masiva";

interface PropsCargaMasivaPage {
  poblacionFija?: PoblacionCarga;
}

export function CargaMasivaPage({ poblacionFija }: PropsCargaMasivaPage) {
  const [tabActiva, setTabActiva] = useState<string>("asistente");

  // Estado del asistente de 4 pasos
  const [pasoActual, setPasoActual] = useState<number>(1);
  const [poblacion, setPoblacion] = useState<PoblacionCarga>(poblacionFija ?? "ACTIVOS");
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>([]);
  const [modoSeleccionado, setModoSeleccionado] = useState<ModoCarga>("obligatorios");
  const [resumenCarga, setResumenCarga] = useState<CargaMasivaResumen | null>(null);
  const [detalleCarga, setDetalleCarga] = useState<CargaMasivaDetalle | null>(null);

  const irAlPaso2 = (
    tipos: string[],
    modo: ModoCarga,
    poblacionElegida: PoblacionCarga,
  ) => {
    setTiposSeleccionados(tipos);
    setModoSeleccionado(modo);
    setPoblacion(poblacionElegida);
    setPasoActual(2);
  };

  const irAlPaso3 = (resumen: CargaMasivaResumen) => {
    setResumenCarga(resumen);
    setPasoActual(3);
  };

  const irAlPaso4 = (detalle: CargaMasivaDetalle) => {
    setDetalleCarga(detalle);
    setPasoActual(4);
  };

  const reiniciarAsistente = () => {
    setPasoActual(1);
    setResumenCarga(null);
    setDetalleCarga(null);
    setPoblacion(poblacionFija ?? "ACTIVOS");
  };

  const finalizarCargaEIrAHistorial = () => {
    reiniciarAsistente();
    setTabActiva("historial");
  };

  const pasos = [
    { num: 1, label: "Plantilla", icon: Download },
    { num: 2, label: "Subida", icon: Upload },
    { num: 3, label: "Análisis", icon: FileCheck },
    { num: 4, label: "Aplicar", icon: CheckCircle },
  ];

  const titulo =
    poblacionFija === "PASIVOS" ? "Carga Masiva de Pasivos" : "Carga Masiva de Personal";

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSpreadsheet className="size-6 text-primary" />
            {titulo}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Importación asistida por Excel con validación en seco, catálogo dinámico, historial y reversión.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tabActiva} onValueChange={setTabActiva} className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full sm:w-80 h-9">
          <TabsTrigger value="asistente" className="text-xs gap-1.5">
            <Upload className="size-3.5" />
            Asistente de Carga
          </TabsTrigger>
          <TabsTrigger value="historial" className="text-xs gap-1.5">
            <History className="size-3.5" />
            Historial de Cargas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="asistente" className="space-y-6 mt-0">
          {/* Stepper Visual de 4 pasos */}
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="grid grid-cols-4 gap-2">
              {pasos.map((p) => {
                const Icono = p.icon;
                const esActual = pasoActual === p.num;
                const esCompletado = pasoActual > p.num;

                return (
                  <div
                    key={p.num}
                    className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                      esActual
                        ? "bg-primary/10 border border-primary/30"
                        : esCompletado
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    <div
                      className={`size-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        esActual
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : esCompletado
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {esCompletado ? <CheckCircle className="size-4" /> : <Icono className="size-3.5" />}
                    </div>
                    <div className="hidden sm:block min-w-0">
                      <p
                        className={`text-xs font-medium truncate ${
                          esActual ? "text-primary font-semibold" : ""
                        }`}
                      >
                        {p.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contenido según el paso */}
          {pasoActual === 1 && (
            <PasoDescargarPlantilla
              onAvanzar={irAlPaso2}
              poblacionFija={poblacionFija}
            />
          )}

          {pasoActual === 2 && (
            <PasoSubirArchivo
              tiposSeleccionados={tiposSeleccionados}
              modo={modoSeleccionado}
              poblacion={poblacion}
              onRetroceder={() => setPasoActual(1)}
              onCargaAnalizada={irAlPaso3}
            />
          )}

          {pasoActual === 3 && resumenCarga && (
            <PasoRevisionAnalisis
              resumen={resumenCarga}
              onRetroceder={() => setPasoActual(2)}
              onContinuar={irAlPaso4}
            />
          )}

          {pasoActual === 4 && detalleCarga && (
            <PasoConfirmarAplicacion
              detalle={detalleCarga}
              onRetroceder={() => setPasoActual(3)}
              onFinalizado={finalizarCargaEIrAHistorial}
            />
          )}
        </TabsContent>

        <TabsContent value="historial" className="mt-0">
          <HistorialCargas poblacionFija={poblacionFija} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
