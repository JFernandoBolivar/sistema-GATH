"use client";

import { AlertTriangle, Image as ImageIcon, QrCode, Shapes, Square, Type, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CampoCredencial } from "../../../domain/entities/carnet";
import type { ElementoKonva } from "../../../domain/entities/disenador";

interface DisenadorHerramientasPanelProps {
  caraActual: "anverso" | "reverso";
  camposDisponibles: CampoCredencial[];
  onAnadirElemento: (nuevo: Omit<ElementoKonva, "id">) => void;
  onAbrirBiblioteca: () => void;
}

export function DisenadorHerramientasPanel({
  caraActual,
  camposDisponibles,
  onAnadirElemento,
  onAbrirBiblioteca,
}: DisenadorHerramientasPanelProps) {
  return (
    <Card className="shadow-xs border">
      <CardHeader className="p-3 pb-2 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shapes className="size-4 text-primary" />
          Elementos e Inserción
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-4">
        {/* Formas Básicas */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground block">Formas</span>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-2 h-8 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "rect",
                  name: "Rectángulo",
                  cara: caraActual,
                  x: 5,
                  y: 10,
                  w: 40,
                  h: 15,
                  r: 0,
                  fill: "rule:primario",
                  stroke: "",
                  sw: 0,
                  rad: 1,
                  shadow: 0,
                  op: 100,
                })
              }
            >
              <Square className="size-3.5" />
              Rectángulo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-2 h-8 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "circle",
                  name: "Círculo",
                  cara: caraActual,
                  x: 10,
                  y: 10,
                  w: 20,
                  h: 20,
                  r: 0,
                  fill: "rule:acento",
                  stroke: "",
                  sw: 0,
                  rad: 0,
                  shadow: 0,
                  op: 100,
                })
              }
            >
              <div className="size-3.5 rounded-full border border-current" />
              Círculo
            </Button>
          </div>
        </div>

        {/* Textos y Campos de Expediente */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground block">Texto y Datos</span>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-2 h-8 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "text",
                  name: "Texto Libre",
                  cara: caraActual,
                  x: 5,
                  y: 20,
                  w: 40,
                  h: 6,
                  r: 0,
                  fill: "#111827",
                  stroke: "",
                  sw: 0,
                  rad: 0,
                  shadow: 0,
                  op: 100,
                  text: "Texto de ejemplo",
                  font: "Source Sans 3, Arial",
                  size: 9,
                  align: "left",
                })
              }
            >
              <Type className="size-3.5" />
              Texto Estático
            </Button>

            {/* Desplegable de Campos Autorizados */}
            <Select
              onValueChange={(cod) => {
                const campo = camposDisponibles.find((c) => c.codigo === cod);
                if (!campo) return;
                onAnadirElemento({
                  t: "field",
                  field: campo.codigo,
                  name: campo.etiqueta,
                  cara: caraActual,
                  x: 5,
                  y: 25,
                  w: 40,
                  h: 6,
                  r: 0,
                  fill: "#111827",
                  stroke: "",
                  sw: 0,
                  rad: 0,
                  shadow: 0,
                  op: 100,
                  font: "Source Sans 3, Arial",
                  size: 8.5,
                  bold: campo.codigo === "nombre" || campo.codigo === "cedula",
                  align: "left",
                });
                if (campo.sensible) {
                  toast.warning(`Aviso: '${campo.etiqueta}' es un dato sensible y quedará impreso.`);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Insertar Campo del Expediente..." />
              </SelectTrigger>
              <SelectContent>
                {camposDisponibles.map((c) => (
                  <SelectItem key={c.codigo} value={c.codigo}>
                    <div className="flex items-center gap-1.5">
                      {c.sensible && <AlertTriangle className="size-3 text-amber-500 shrink-0" />}
                      <span>{c.etiqueta}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Gráficos Institucionales */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground block">
            Gráficos y Seguridad
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5 h-8 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "photo",
                  name: "Foto Oficial",
                  cara: caraActual,
                  x: 10,
                  y: 10,
                  w: 24,
                  h: 30,
                  r: 0,
                  fill: "#e2e8f0",
                  stroke: "#94a3b8",
                  sw: 1,
                  rad: 2,
                  shadow: 0,
                  op: 100,
                })
              }
            >
              <User className="size-3.5" />
              Fotografía
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5 h-8 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "qr",
                  name: "Código QR",
                  cara: caraActual,
                  x: 15,
                  y: 15,
                  w: 22,
                  h: 22,
                  r: 0,
                  fill: "#ffffff",
                  stroke: "#cbd5e1",
                  sw: 1,
                  rad: 1,
                  shadow: 0,
                  op: 100,
                })
              }
            >
              <QrCode className="size-3.5" />
              Código QR
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-8 text-xs mt-1"
            onClick={onAbrirBiblioteca}
          >
            <ImageIcon className="size-3.5" />
            Elegir de Biblioteca de Medios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
