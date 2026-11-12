"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronsUpDown,
  Image as ImageIcon,
  PenTool,
  QrCode,
  Shapes,
  Slash,
  Square,
  Triangle,
  Type,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CampoCredencial } from "../../../domain/entities/carnet";
import type { ElementoKonva } from "../../../domain/entities/disenador";
import {
  crearElementoDeForma,
  FORMAS_INSTITUCIONALES,
} from "../../../domain/entities/formas-institucionales";
import { colorParaMiniatura, MiniaturaForma } from "./miniatura-forma";

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
  const [campoAbierto, setCampoAbierto] = useState(false);
  const [busquedaCampo, setBusquedaCampo] = useState("");

  const insertarCampo = (campo: CampoCredencial) => {
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
    setCampoAbierto(false);
    setBusquedaCampo("");
  };

  const consulta = busquedaCampo.trim().toLowerCase();
  const camposFiltrados = consulta
    ? camposDisponibles.filter((c) =>
        `${c.etiqueta} ${c.codigo} ${c.grupo}`.toLowerCase().includes(consulta),
      )
    : camposDisponibles;

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="border-b border-border p-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Shapes className="size-4 text-primary" aria-hidden />
          Elementos e inserción
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-3">
        {/* Formas */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">Formas</span>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
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
              <Square className="size-4" aria-hidden />
              Rectángulo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
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
              <span className="size-4 rounded-full border-2 border-current" aria-hidden />
              Círculo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "tri",
                  name: "Triángulo",
                  cara: caraActual,
                  x: 10,
                  y: 10,
                  w: 18,
                  h: 16,
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
              <Triangle className="size-4" aria-hidden />
              Triángulo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "diag",
                  name: "Franja diagonal",
                  cara: caraActual,
                  x: 0,
                  y: 0,
                  w: 40,
                  h: 12,
                  r: 0,
                  fill: "rule:primario",
                  stroke: "",
                  sw: 0,
                  rad: 0,
                  shadow: 0,
                  op: 100,
                })
              }
            >
              <Slash className="size-4" aria-hidden />
              Franja diagonal
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "path",
                  name: "Onda superior",
                  cara: caraActual,
                  x: 0,
                  y: 0,
                  w: 54,
                  h: 20,
                  r: 0,
                  fill: "rule:primario",
                  stroke: "",
                  sw: 0,
                  rad: 0,
                  shadow: 0,
                  op: 100,
                  path: "M 0 0 H 100 V 38 C 74 62 26 22 0 52 Z",
                })
              }
            >
              <PenTool className="size-4" aria-hidden />
              Onda superior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "path",
                  name: "Corte diagonal",
                  cara: caraActual,
                  x: 0,
                  y: 40,
                  w: 54,
                  h: 30,
                  r: 0,
                  fill: "rule:primario",
                  stroke: "",
                  sw: 0,
                  rad: 0,
                  shadow: 0,
                  op: 100,
                  path: "M 0 0 H 100 V 100 L 0 62 Z",
                })
              }
            >
              <PenTool className="size-4" aria-hidden />
              Corte diagonal
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
              onClick={() =>
                onAnadirElemento({
                  t: "path",
                  name: "Forma libre",
                  cara: caraActual,
                  x: 10,
                  y: 10,
                  w: 30,
                  h: 30,
                  r: 0,
                  fill: "rule:primario",
                  stroke: "",
                  sw: 0,
                  rad: 0,
                  shadow: 0,
                  op: 100,
                  path: "M 0 100 C 0 32 32 0 100 0 V 100 Z",
                })
              }
            >
              <PenTool className="size-4" aria-hidden />
              Forma SVG
            </Button>
          </div>
        </div>

        {/* Formas institucionales: calcadas de la propuesta oficial del carnet */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">
            Formas institucionales
          </span>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS_INSTITUCIONALES.map((forma) => (
              <Button
                key={forma.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto flex-col items-stretch gap-1.5 px-2 py-2 text-xs"
                title={`${forma.nombre} (${forma.cara})`}
                onClick={() => onAnadirElemento(crearElementoDeForma(forma, caraActual))}
              >
                <span className="flex h-10 items-center justify-center rounded bg-muted/40">
                  <MiniaturaForma
                    path={forma.elemento.path ?? ""}
                    color={colorParaMiniatura(forma.elemento.fill)}
                    tamano={36}
                    proporcion={forma.elemento.w / forma.elemento.h}
                  />
                </span>
                <span className="truncate text-center">{forma.nombre}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Texto y campos */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">Texto y datos</span>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
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
              <Type className="size-4" aria-hidden />
              Texto estático
            </Button>

            {/* Selector con búsqueda de campos del expediente */}
            <Popover open={campoAbierto} onOpenChange={setCampoAbierto}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={campoAbierto}
                  className="h-10 w-full justify-between gap-2 text-xs font-normal"
                >
                  <span className="truncate text-muted-foreground">
                    Insertar campo del expediente…
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-(--radix-popover-trigger-width) min-w-[280px] p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar campo del expediente…"
                    value={busquedaCampo}
                    onValueChange={setBusquedaCampo}
                  />
                  <CommandList className="max-h-64 overflow-y-auto">
                    <CommandEmpty>No hay campos que coincidan.</CommandEmpty>
                    <CommandGroup>
                      {camposFiltrados.map((c) => (
                        <CommandItem
                          key={c.codigo}
                          value={c.codigo}
                          onSelect={() => insertarCampo(c)}
                          className="cursor-pointer"
                        >
                          <span className="flex-1 truncate">{c.etiqueta}</span>
                          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                            {c.grupo}
                          </span>
                          {c.sensible && (
                            <AlertTriangle
                              className="ml-1.5 size-3.5 shrink-0 text-warning"
                              aria-label="Dato sensible"
                            />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Gráficos y seguridad */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">
            Gráficos y seguridad
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
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
              <User className="size-4" aria-hidden />
              Fotografía
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 justify-start gap-2 text-xs"
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
              <QrCode className="size-4" aria-hidden />
              Código QR
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-1 h-10 w-full justify-start gap-2 text-xs"
            onClick={onAbrirBiblioteca}
          >
            <ImageIcon className="size-4" aria-hidden />
            Elegir de biblioteca de medios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
