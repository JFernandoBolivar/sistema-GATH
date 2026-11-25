"use client";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BorradorPlantilla, FirmanteDocumento, ProcesoPlantilla } from "../../domain/entities/plantilla";
import { ETIQUETA_FIRMANTE } from "../lib/etiquetas";
import { SelectSimple } from "./select-simple";
import { SelectorProceso } from "./selector-proceso";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  borrador: BorradorPlantilla;
  publicada: boolean;
  soloLectura: boolean;
  errores: Record<string, string>;
  procesos: readonly ProcesoPlantilla[];
  /** Cambia el proceso solo si el diseño es compatible; devuelve si se aplicó. */
  onCambioProceso: (codigo: string) => boolean;
  /** Aviso de por qué no se pudo cambiar el proceso. */
  errorProceso?: string | null;
  onCambio: (parcial: Partial<Omit<BorradorPlantilla, "definicion" | "campos_propios" | "proceso">>) => void;
}

/** Metadatos de la plantilla. El código es de solo lectura una vez publicada. */
export function MetadatosDialog({ abierto, onCerrar, borrador, publicada, soloLectura, errores, procesos, onCambioProceso, errorProceso, onCambio }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Datos de la plantilla</DialogTitle>
          <DialogDescription>Los cambios se guardan con el borrador (botón «Guardar borrador»).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="meta-nombre">Nombre</Label>
            <Input id="meta-nombre" value={borrador.nombre} maxLength={160} disabled={soloLectura} aria-invalid={Boolean(errores.nombre)} onChange={(e) => onCambio({ nombre: e.target.value })} />
            {errores.nombre && <p className="text-sm text-destructive">{errores.nombre}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-codigo">Código</Label>
            <Input
              id="meta-codigo"
              className="font-mono"
              value={borrador.codigo}
              maxLength={60}
              readOnly={publicada}
              disabled={soloLectura}
              aria-invalid={Boolean(errores.codigo)}
              onChange={(e) => onCambio({ codigo: e.target.value.toUpperCase() })}
            />
            <p className="text-xs text-muted-foreground">{publicada ? "El código no cambia después de publicar." : "Podrá editarlo hasta publicar la primera versión."}</p>
            {errores.codigo && <p className="text-sm text-destructive">{errores.codigo}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-desc">Descripción</Label>
            <Textarea id="meta-desc" rows={2} value={borrador.descripcion} disabled={soloLectura} onChange={(e) => onCambio({ descripcion: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <SelectorProceso
                id="meta-proceso"
                procesos={procesos}
                valor={borrador.proceso}
                deshabilitado={soloLectura}
                bloqueado={publicada}
                onCambio={onCambioProceso}
                error={errorProceso ?? errores.proceso}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Quién firma</Label>
              <SelectSimple valor={borrador.firmante} deshabilitado={soloLectura} onCambio={(v) => onCambio({ firmante: v as FirmanteDocumento })} opciones={Object.entries(ETIQUETA_FIRMANTE).map(([valor, etiqueta]) => ({ valor, etiqueta }))} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="meta-firma">Requiere firma por clic</Label>
            <Switch id="meta-firma" checked={borrador.requiere_firma_clic} disabled={soloLectura} onCheckedChange={(v) => onCambio({ requiere_firma_clic: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onCerrar}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
