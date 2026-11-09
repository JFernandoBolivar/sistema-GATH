"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  obtenerAccionesAgrupadas,
  obtenerEtiquetaAccion,
} from "../../domain/value-objects/catalogo-acciones";

interface ComboboxAccionesProps {
  accionesDisponibles?: string[];
  valor?: string;
  onCambiar: (valor: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function ComboboxAcciones({
  accionesDisponibles = [],
  valor = "",
  onCambiar,
  id = "aud-accion-combobox",
  className,
  disabled = false,
}: ComboboxAccionesProps) {
  const [abierto, setAbierto] = React.useState(false);
  const grupos = React.useMemo(
    () => obtenerAccionesAgrupadas(accionesDisponibles),
    [accionesDisponibles],
  );

  const etiquetaSeleccionada = valor ? obtenerEtiquetaAccion(valor) : "";

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          disabled={disabled}
          className={cn(
            "h-10 w-full min-w-0 justify-between font-normal bg-background px-3 text-sm border-input",
            !valor && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate text-left" title={etiquetaSeleccionada || "Todas las acciones"}>
            {etiquetaSeleccionada || "Todas las acciones"}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {valor ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onCambiar("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onCambiar("");
                  }
                }}
                className="p-0.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Limpiar acción seleccionada"
              >
                <X className="size-3.5" aria-hidden="true" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 opacity-50" aria-hidden="true" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-[320px] max-w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por acción o descripción…" className="h-9" />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No se encontraron acciones coincidentes.</CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="todas las acciones limpiar filtro"
                onSelect={() => {
                  onCambiar("");
                  setAbierto(false);
                }}
                className="font-medium cursor-pointer"
              >
                <Check
                  className={cn("mr-2 size-4", !valor ? "opacity-100 text-primary" : "opacity-0")}
                />
                <span>Todas las acciones</span>
              </CommandItem>
            </CommandGroup>

            {grupos.map((grupo) => (
              <CommandGroup key={grupo.modulo} heading={grupo.moduloVisible} className="text-xs">
                {grupo.acciones.map((acc) => {
                  const seleccionada = valor === acc.codigo;
                  return (
                    <CommandItem
                      key={acc.codigo}
                      value={`${acc.etiqueta} ${acc.codigo} ${grupo.moduloVisible}`}
                      onSelect={() => {
                        onCambiar(acc.codigo);
                        setAbierto(false);
                      }}
                      className="cursor-pointer py-1.5"
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4 shrink-0",
                          seleccionada ? "opacity-100 text-primary" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {acc.etiqueta}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono truncate">
                          {acc.codigo}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
