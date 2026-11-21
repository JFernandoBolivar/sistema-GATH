"use client";

import { useState } from "react";
import { Eraser, Eye, EyeOff, Loader2, MoreHorizontal, Search, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AlcanceLimpieza, PersonaMuestra } from "../../../domain/entities/disenador";

interface Props {
  caraActual: "anverso" | "reverso";
  mostrarGuias: boolean;
  onAlternarGuias: () => void;
  onVistaPrevia: () => void;
  vistaPreviaDeshabilitada: boolean;
  onLimpiar: (alcance: AlcanceLimpieza) => void;
  modoPreviewReal: boolean;
  datosPersona: PersonaMuestra;
  cedulaBusqueda: string;
  onCambiarCedulaBusqueda: (cedula: string) => void;
  buscandoCedula: boolean;
  onBuscarPersonaReal: (e: React.FormEvent) => void;
  onRestaurarPersonaFicticia: () => void;
  /** Botón táctil de 44 px (móvil). */
  tactil?: boolean;
}

/**
 * Menú «⋯» del encabezado del diseñador: acciones secundarias que no caben en la
 * fila compacta (vista previa en móvil, guías, persona real y limpiar diseño).
 */
export function DisenadorMenuAcciones({
  caraActual,
  mostrarGuias,
  onAlternarGuias,
  onVistaPrevia,
  vistaPreviaDeshabilitada,
  onLimpiar,
  modoPreviewReal,
  datosPersona,
  cedulaBusqueda,
  onCambiarCedulaBusqueda,
  buscandoCedula,
  onBuscarPersonaReal,
  onRestaurarPersonaFicticia,
  tactil = false,
}: Props) {
  const [buscarAbierto, setBuscarAbierto] = useState(false);
  const [limpiarAbierto, setLimpiarAbierto] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={tactil ? "size-11" : "size-9"}
            aria-label="Más acciones del diseñador"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem
            onClick={onVistaPrevia}
            disabled={vistaPreviaDeshabilitada}
            className="sm:hidden gap-2"
          >
            <Eye className="size-4" aria-hidden />
            Vista previa PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator className="sm:hidden" />
          <DropdownMenuItem onClick={onAlternarGuias} className="gap-2">
            {mostrarGuias ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
            {mostrarGuias ? "Ocultar guías" : "Mostrar guías"}
          </DropdownMenuItem>
          {modoPreviewReal ? (
            <DropdownMenuItem
              onClick={() => {
                setBuscarAbierto(false);
                onRestaurarPersonaFicticia();
              }}
              className="gap-2"
            >
              <UserRound className="size-4" aria-hidden />
              <span className="truncate">Volver a ficticios ({datosPersona.nombre})</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setBuscarAbierto(true)} className="gap-2">
              <Search className="size-4" aria-hidden />
              Probar con persona real…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLimpiarAbierto(true)} className="gap-2">
            <Eraser className="size-4" aria-hidden />
            Limpiar diseño…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={buscarAbierto && !modoPreviewReal} onOpenChange={setBuscarAbierto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Probar con persona real</DialogTitle>
            <DialogDescription>
              Escriba una cédula para ver el carnet con los datos reales de esa persona.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onBuscarPersonaReal} className="flex items-center gap-2">
            <Input
              placeholder="Cédula para prueba real..."
              aria-label="Cédula para prueba real"
              value={cedulaBusqueda}
              onChange={(e) => onCambiarCedulaBusqueda(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
            <Button type="submit" variant="outline" className="h-9 gap-1" disabled={buscandoCedula}>
              {buscandoCedula ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Search className="size-3" aria-hidden />
              )}
              Buscar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={limpiarAbierto} onOpenChange={setLimpiarAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar el diseño?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitarán los elementos de la cara elegida; las dimensiones, la orientación y el
              tipo de la plantilla no cambian. Podrá deshacerlo; no se guarda hasta pulsar Guardar
              Borrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onLimpiar("cara-actual")}>
              Solo esta cara ({caraActual})
            </AlertDialogAction>
            <AlertDialogAction onClick={() => onLimpiar("ambas")}>Ambas caras</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
