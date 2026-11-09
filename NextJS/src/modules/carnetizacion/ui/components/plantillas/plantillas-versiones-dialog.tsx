"use client";

import { History, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlantillaMotor } from "../../../domain/entities/carnet";

interface PlantillasVersionesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantillaSeleccionada: PlantillaMotor | null;
  versionesPlantilla: PlantillaMotor[];
  cargandoVersiones: boolean;
  isPending: boolean;
  onActivarMotor: (id: string) => void;
}

export function PlantillasVersionesDialog({
  open,
  onOpenChange,
  plantillaSeleccionada,
  versionesPlantilla,
  cargandoVersiones,
  isPending,
  onActivarMotor,
}: PlantillasVersionesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            Historial de Versiones: {plantillaSeleccionada?.nombre}
          </DialogTitle>
          <DialogDescription>
            Trazabilidad completa. Puedes reactivar una versión anterior en cualquier momento.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 max-h-[420px] overflow-y-auto space-y-2.5">
          {cargandoVersiones ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : versionesPlantilla.length === 0 ? (
            <p className="text-sm text-center py-6 text-muted-foreground">
              No hay otras versiones registradas para esta plantilla.
            </p>
          ) : (
            versionesPlantilla.map((v) => (
              <div
                key={v.id}
                className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-sm ${
                  v.activa ? "bg-emerald-500/10 border-emerald-400" : "bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono text-sm">v{v.version}</span>
                      {v.activa ? (
                        <Badge className="bg-emerald-600 text-white text-xs">Activa Oficial</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs capitalize">
                          {v.estado}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      Creada:{" "}
                      {new Date(v.creado).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!v.activa && v.estado === "publicada" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      disabled={isPending}
                      onClick={() => onActivarMotor(v.id)}
                    >
                      Reactivar esta versión
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
