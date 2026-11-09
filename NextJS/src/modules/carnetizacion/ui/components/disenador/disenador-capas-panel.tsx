"use client";

import { Eye, EyeOff, Layers, Lock, MoveDown, MoveUp, QrCode, Square, Type, User, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ElementoKonva } from "../../../domain/entities/disenador";

interface DisenadorCapasPanelProps {
  caraActual: "anverso" | "reverso";
  elementos: ElementoKonva[];
  elementoSeleccionadoId: string | null;
  onSeleccionarElemento: (id: string | null) => void;
  onMoverCapa: (direccion: "arriba" | "abajo") => void;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
}

export function DisenadorCapasPanel({
  caraActual,
  elementos,
  elementoSeleccionadoId,
  onSeleccionarElemento,
  onMoverCapa,
  onActualizarElemento,
}: DisenadorCapasPanelProps) {
  const elementosCara = elementos
    .filter((e) => e.cara === caraActual)
    .slice()
    .reverse();

  return (
    <Card className="shadow-xs border">
      <CardHeader className="p-3 pb-2 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          Capas ({caraActual})
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={!elementoSeleccionadoId}
            onClick={() => onMoverCapa("arriba")}
            title="Subir nivel"
          >
            <MoveUp className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={!elementoSeleccionadoId}
            onClick={() => onMoverCapa("abajo")}
            title="Bajar nivel"
          >
            <MoveDown className="size-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-1 max-h-[260px] overflow-y-auto divide-y">
        {elementosCara.map((el) => {
          const seleccionado = el.id === elementoSeleccionadoId;
          return (
            <div
              key={el.id}
              onClick={() => onSeleccionarElemento(el.id)}
              className={`flex items-center justify-between p-2 text-xs cursor-pointer transition-colors ${
                seleccionado
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted/40 text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 truncate flex-1 mr-2">
                {el.t === "rect" && <Square className="size-3.5 shrink-0" />}
                {el.t === "circle" && (
                  <div className="size-3 rounded-full border border-current shrink-0" />
                )}
                {(el.t === "text" || el.t === "field") && <Type className="size-3.5 shrink-0" />}
                {el.t === "photo" && <User className="size-3.5 shrink-0" />}
                {el.t === "qr" && <QrCode className="size-3.5 shrink-0" />}
                {el.t === "image" && <ImageIcon className="size-3.5 shrink-0" />}
                <span className="truncate">{el.name}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onActualizarElemento(el.id, { oculto: !el.oculto });
                  }}
                >
                  {el.oculto ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onActualizarElemento(el.id, { bloqueado: !el.bloqueado });
                  }}
                >
                  {el.bloqueado ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Unlock({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}
