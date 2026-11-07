"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PlantillasCrearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoActivo: string;
  nuevoNombre: string;
  onCambiarNuevoNombre: (nombre: string) => void;
  nuevaOrientacion: "vertical" | "horizontal";
  onCambiarNuevaOrientacion: (orientacion: "vertical" | "horizontal") => void;
  nuevoAncho: number;
  onCambiarNuevoAncho: (ancho: number) => void;
  nuevoAlto: number;
  onCambiarNuevoAlto: (alto: number) => void;
  nuevoCriterio: string;
  onCambiarNuevoCriterio: (criterio: string) => void;
  isPending: boolean;
  onCrearBorrador: () => void;
}

export function PlantillasCrearDialog({
  open,
  onOpenChange,
  tipoActivo,
  nuevoNombre,
  onCambiarNuevoNombre,
  nuevaOrientacion,
  onCambiarNuevaOrientacion,
  nuevoAncho,
  onCambiarNuevoAncho,
  nuevoAlto,
  onCambiarNuevoAlto,
  nuevoCriterio,
  onCambiarNuevoCriterio,
  isPending,
  onCrearBorrador,
}: PlantillasCrearDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nueva Plantilla de Carnet</DialogTitle>
          <DialogDescription>
            Crea un borrador paramétrico con dimensiones físicas en milímetros para {tipoActivo}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-plantilla">Nombre de la Plantilla</Label>
            <Input
              id="nombre-plantilla"
              placeholder="Ej. Oficial 2026 - Conatel"
              value={nuevoNombre}
              onChange={(e) => onCambiarNuevoNombre(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Orientación</Label>
              <Select
                value={nuevaOrientacion}
                onValueChange={(v: "vertical" | "horizontal") => {
                  onCambiarNuevaOrientacion(v);
                  if (v === "vertical") {
                    onCambiarNuevoAncho(54.0);
                    onCambiarNuevoAlto(85.6);
                  } else {
                    onCambiarNuevoAncho(85.6);
                    onCambiarNuevoAlto(54.0);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">Vertical</SelectItem>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Criterio de Regla</Label>
              <Select value={nuevoCriterio} onValueChange={onCambiarNuevoCriterio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos (General)</SelectItem>
                  <SelectItem value="nomina">Por Nómina</SelectItem>
                  <SelectItem value="cargo">Por Cargo</SelectItem>
                  <SelectItem value="oficina">Por Oficina</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ancho-mm">Ancho (mm)</Label>
              <Input
                id="ancho-mm"
                type="number"
                step="0.1"
                value={nuevoAncho}
                onChange={(e) => onCambiarNuevoAncho(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alto-mm">Alto (mm)</Label>
              <Input
                id="alto-mm"
                type="number"
                step="0.1"
                value={nuevoAlto}
                onChange={(e) => onCambiarNuevoAlto(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border">
            💡 Estándar CR-80 estándar: 54.0 × 85.6 mm (vertical) u 85.6 × 54.0 mm (horizontal).
            La plantilla iniciará en estado <strong>Borrador</strong> para editar capas con el diseñador.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onCrearBorrador} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Crear Borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
