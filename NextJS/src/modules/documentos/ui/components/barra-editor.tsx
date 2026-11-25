"use client";

import Link from "next/link";
import { ArrowLeft, Copy, History, MoreHorizontal, Power, Rocket, Save, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRutaDocumentos } from "../hooks/use-ruta-documentos";
import type { PlantillaCompleta } from "../../domain/entities/plantilla";
import { ETIQUETA_MODO, estaPublicada } from "../lib/etiquetas";
import { EstadoPlantilla } from "./estado-plantilla";

interface Props {
  nombre: string;
  servidor: PlantillaCompleta;
  dirty: boolean;
  ocupado: string | null;
  puedeGestionar: boolean;
  onGuardar: () => void;
  onPublicar: () => void;
  onActivar: () => void;
  onDuplicar: () => void;
  onHistorial: () => void;
  onMetadatos: () => void;
}

/** Barra superior común: identidad, estado y acciones de la plantilla. */
export function BarraEditor({
  nombre,
  servidor,
  dirty,
  ocupado,
  puedeGestionar,
  onGuardar,
  onPublicar,
  onActivar,
  onDuplicar,
  onHistorial,
  onMetadatos,
}: Props) {
  const RUTA_DOCUMENTOS = useRutaDocumentos();
  const publicada = estaPublicada(servidor);
  return (
    <header className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 border-b bg-background/95 px-3 py-2 backdrop-blur sm:flex sm:flex-wrap sm:gap-x-3 sm:px-4">
      <Button asChild variant="ghost" size="icon-sm">
        <Link href={RUTA_DOCUMENTOS} aria-label="Volver a la lista de plantillas">
          <ArrowLeft aria-hidden />
        </Link>
      </Button>
      <div className="min-w-0 sm:flex-1">
        <h1 className="line-clamp-2 break-words text-lg font-semibold leading-tight sm:truncate sm:line-clamp-none">{nombre || "Plantilla sin nombre"}</h1>
      </div>
      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:order-3 sm:col-span-1 sm:basis-full lg:order-none lg:basis-auto">
        <EstadoPlantilla plantilla={servidor} />
        <Badge variant="secondary">{ETIQUETA_MODO[servidor.modo]}</Badge>
        {dirty && (
          <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400" role="status">
            Cambios sin guardar
          </Badge>
        )}
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        {puedeGestionar && (
          <>
            <Button size="sm" onClick={onGuardar} disabled={!dirty || ocupado !== null} title="Guardar borrador (Ctrl+S)" className="flex-1 sm:flex-none">
              <Save aria-hidden /> <span className="hidden sm:inline">Guardar borrador</span>
              <span className="sm:hidden">Guardar</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={onPublicar} disabled={ocupado !== null || (publicada && !servidor.cambios_sin_publicar && !dirty)} className="flex-1 sm:flex-none">
              <Rocket aria-hidden /> Publicar
            </Button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="outline" aria-label="Más acciones">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={onMetadatos}>
              <Settings2 aria-hidden /> Datos de la plantilla
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onHistorial}>
              <History aria-hidden /> Historial de versiones
            </DropdownMenuItem>
            {puedeGestionar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onDuplicar}>
                  <Copy aria-hidden /> Duplicar como borrador
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onActivar} disabled={!publicada}>
                  <Power aria-hidden /> {servidor.activa ? "Desactivar" : "Activar"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
