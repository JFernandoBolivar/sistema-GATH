"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VersionPlantilla } from "../../domain/entities/plantilla";
import { listarVersionesAction } from "../../infrastructure/actions/documentos-actions";
import { formatearFecha } from "../lib/etiquetas";

interface Props {
  plantillaId: string;
  abierto: boolean;
  onCerrar: () => void;
  /** Cambia al publicar: fuerza a recargar el historial. */
  ultimaVersion: number | null;
}

export function HistorialVersionesDialog({ plantillaId, abierto, onCerrar, ultimaVersion }: Props) {
  const clave = `${plantillaId}:${ultimaVersion}`;
  const [resultado, setResultado] = useState<{ clave: string; versiones: VersionPlantilla[] | null; error: string | null } | null>(null);
  const vigente = resultado?.clave === clave ? resultado : null;
  const versiones = vigente?.versiones ?? null;
  const error = vigente?.error ?? null;

  useEffect(() => {
    if (!abierto) return;
    let activo = true;
    void listarVersionesAction(plantillaId).then((r) => {
      if (!activo) return;
      setResultado(r.success ? { clave, versiones: r.data, error: null } : { clave, versiones: null, error: r.error });
    });
    return () => {
      activo = false;
    };
  }, [abierto, plantillaId, clave]);

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial de versiones</DialogTitle>
          <DialogDescription>Cada publicación crea una versión inmutable; los documentos generados conservan la que usaron.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!error && versiones === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {versiones?.length === 0 && <p className="text-sm text-muted-foreground">Todavía no se ha publicado ninguna versión.</p>}
        <ol className="grid gap-2">
          {[...(versiones ?? [])]
            .sort((a, b) => b.numero - a.numero)
            .map((v, i) => (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">
                    Versión {v.numero} {i === 0 && <Badge className="ml-1">Vigente</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatearFecha(v.publicada_en)}</p>
                </div>
                <code className="text-xs text-muted-foreground" title="Huella SHA-256 de la definición">
                  {v.definicion_sha256.slice(0, 10)}
                </code>
              </li>
            ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
