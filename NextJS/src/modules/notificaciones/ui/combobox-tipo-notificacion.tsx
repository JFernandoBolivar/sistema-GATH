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
import { TIPOS_NOTIFICACION, type TipoNotificacion } from "./tipos-notificacion";

const NOMBRES_MODULOS: Record<string, string> = {
  autogestion: "Autogestión",
  fe_de_vida: "Fe de vida",
  identidad: "Cuentas y acceso",
  movimiento: "Movimientos de personal",
};

interface ComboboxTipoNotificacionProps {
  valor?: string;
  onCambiar: (valor: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

interface GrupoModulo {
  clave: string;
  nombre: string;
  tipos: TipoNotificacion[];
}

export function ComboboxTipoNotificacion({
  valor = "",
  onCambiar,
  id = "filtro-tipo-notificacion",
  className,
  disabled = false,
}: ComboboxTipoNotificacionProps) {
  const [abierto, setAbierto] = React.useState(false);

  // Agrupar tipos por módulo derivado del prefijo (ej: 'autogestion.x' -> 'autogestion')
  const grupos = React.useMemo<GrupoModulo[]>(() => {
    const mapa = new Map<string, TipoNotificacion[]>();
    for (const t of TIPOS_NOTIFICACION) {
      const prefijo = t.codigo.split(".")[0] || "otros";
      const lista = mapa.get(prefijo) ?? [];
      lista.push(t);
      mapa.set(prefijo, lista);
    }

    return Array.from(mapa.entries()).map(([clave, tipos]) => ({
      clave,
      nombre: NOMBRES_MODULOS[clave] ?? clave,
      tipos: tipos.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
    }));
  }, []);

  const tipoSeleccionado = TIPOS_NOTIFICACION.find((t) => t.codigo === valor);
  const etiquetaSeleccionada = tipoSeleccionado?.etiqueta ?? "";

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
          <span className="truncate text-left" title={etiquetaSeleccionada || "Todos los tipos"}>
            {etiquetaSeleccionada || "Todos los tipos"}
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
                aria-label="Limpiar tipo seleccionado"
              >
                <X className="size-3.5" aria-hidden="true" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 opacity-50" aria-hidden="true" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-[300px] max-w-[420px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar tipo de notificación…" className="h-9" />
          <CommandList className="max-h-[280px] overflow-y-auto">
            <CommandEmpty>No se encontraron tipos coincidentes.</CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="todos los tipos limpiar filtro"
                onSelect={() => {
                  onCambiar("");
                  setAbierto(false);
                }}
                className="font-medium text-muted-foreground"
              >
                <Check
                  className={cn("mr-2 size-4", !valor ? "opacity-100 text-primary" : "opacity-0")}
                />
                Todos los tipos
              </CommandItem>
            </CommandGroup>

            {grupos.map((grupo) => (
              <CommandGroup key={grupo.clave} heading={grupo.nombre}>
                {grupo.tipos.map((t) => {
                  const seleccionado = valor === t.codigo;
                  return (
                    <CommandItem
                      key={t.codigo}
                      value={`${grupo.nombre} ${t.etiqueta} ${t.codigo}`}
                      onSelect={() => {
                        onCambiar(t.codigo);
                        setAbierto(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          seleccionado ? "opacity-100 text-primary" : "opacity-0",
                        )}
                      />
                      <span className="flex-1 truncate">{t.etiqueta}</span>
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
