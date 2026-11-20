"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2, Loader2, PackageCheck, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { EstadoFisicoCarnet } from "../../domain/entities/carnet";
import { cicloCarnetAction } from "../../infrastructure/actions/carnetizacion-actions";

interface CicloCarnetAccionesProps {
  carnetId: number;
  estado: EstadoFisicoCarnet;
  nombreTitular: string;
  /** Se llama tras un cambio para recargar los datos del titular. */
  onCambio: () => void | Promise<void>;
}

/** Acciones del ciclo físico del carnet vigente (B-5): imprimir → entregar; anular con motivo. */
export function CicloCarnetAcciones({ carnetId, estado, nombreTitular, onCambio }: CicloCarnetAccionesProps) {
  const [pendiente, iniciar] = useTransition();
  const [dialogo, setDialogo] = useState<"entrega" | "anulacion" | null>(null);
  const [recibidoPor, setRecibidoPor] = useState(nombreTitular);
  const [motivo, setMotivo] = useState("");

  const ejecutar = (accion: "impreso" | "entregado" | "revocar", datos = {}) =>
    iniciar(async () => {
      const res = await cicloCarnetAction(carnetId, accion, datos);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setDialogo(null);
      setMotivo("");
      await onCambio();
    });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {estado === "EMITIDO" && (
          <Button size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar("impreso")}>
            {pendiente ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
            Marcar impreso
          </Button>
        )}
        {estado === "IMPRESO" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pendiente}
            onClick={() => {
              setRecibidoPor(nombreTitular);
              setDialogo("entrega");
            }}
          >
            <PackageCheck className="size-3.5" />
            Registrar entrega
          </Button>
        )}
        {estado === "ENTREGADO" && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="size-3.5" /> Ciclo completo
          </span>
        )}
        {estado !== "ANULADO" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={pendiente}
            onClick={() => setDialogo("anulacion")}
          >
            <Ban className="size-3.5" />
            Anular carnet
          </Button>
        )}
      </div>

      <Dialog open={dialogo === "entrega"} onOpenChange={(abierto) => !abierto && setDialogo(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Registrar entrega del carnet</DialogTitle>
            <DialogDescription>Indique quién recibe el carnet impreso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="recibido-por">Recibido por</Label>
            <Input
              id="recibido-por"
              value={recibidoPor}
              maxLength={150}
              onChange={(e) => setRecibidoPor(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button
              disabled={pendiente || !recibidoPor.trim()}
              onClick={() => ejecutar("entregado", { recibido_por: recibidoPor.trim() })}
            >
              Registrar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === "anulacion"} onOpenChange={(abierto) => !abierto && setDialogo(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Anular carnet</DialogTitle>
            <DialogDescription>
              El carnet deja de ser válido (su QR lo mostrará como anulado). Esta acción queda registrada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-anulacion">Motivo de la anulación</Label>
            <Textarea
              id="motivo-anulacion"
              value={motivo}
              maxLength={500}
              placeholder="Ej.: extravío reportado, error en los datos, egreso…"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pendiente || !motivo.trim()}
              onClick={() => ejecutar("revocar", { motivo: motivo.trim() })}
            >
              Anular carnet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
