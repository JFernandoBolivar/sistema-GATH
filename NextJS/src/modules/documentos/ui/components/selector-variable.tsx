"use client";

import { useMemo, useState } from "react";
import { Braces, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { VariableCatalogo } from "../../domain/entities/plantilla";
import { agruparVariables, filtrarVariables } from "../../domain/lib/variables";

interface Props {
  variables: VariableCatalogo[];
  /** Variable actual (`modo="campo"`). `null` = en blanco. */
  valor?: string | null;
  onElegir: (clave: string | null) => void;
  /**
   * `campo`: el botón muestra la variable elegida (celdas, casillas, condiciones).
   * `insertar`: botón «Variable» que inserta `{variable}` en un texto.
   */
  modo?: "campo" | "insertar";
  /** Ofrece «En blanco (se completa a mano)» como primera opción. */
  permitirVacio?: boolean;
  deshabilitado?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/** Selector con búsqueda de variables, agrupado y con descripción. */
export function SelectorVariable({
  variables,
  valor,
  onElegir,
  modo = "campo",
  permitirVacio = false,
  deshabilitado,
  placeholder = "Elegir variable…",
  className,
  ...resto
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const grupos = useMemo(() => agruparVariables(filtrarVariables(variables, consulta)), [variables, consulta]);
  const actual = valor ? variables.find((v) => v.clave === valor) : undefined;

  const elegir = (clave: string | null) => {
    onElegir(clave);
    setAbierto(false);
    setConsulta("");
  };

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        {modo === "insertar" ? (
          <Button type="button" variant="outline" size="sm" disabled={deshabilitado} className={className} aria-label={resto["aria-label"] ?? "Insertar variable"}>
            <Braces aria-hidden /> Variable
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={abierto}
            aria-label={resto["aria-label"]}
            disabled={deshabilitado}
            className={cn("w-full justify-between font-normal", className)}
          >
            <span className={cn("truncate", !valor && "text-muted-foreground")}>
              {valor ? (actual?.etiqueta ?? `{${valor}}`) : permitirVacio ? "En blanco (a mano)" : placeholder}
            </span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,92vw)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar variable…" value={consulta} onValueChange={setConsulta} />
          <CommandList className="max-h-72">
            <CommandEmpty>No hay variables que coincidan.</CommandEmpty>
            {permitirVacio && modo === "campo" && !consulta && (
              <>
                <CommandGroup>
                  <CommandItem value="__vacio__" onSelect={() => elegir(null)}>
                    <Check className={cn("size-4", valor ? "opacity-0" : "opacity-100")} aria-hidden />
                    <div>
                      <div>En blanco</div>
                      <div className="text-xs text-muted-foreground">Se completa a mano al imprimir.</div>
                    </div>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {grupos.map((g) => (
              <CommandGroup key={g.grupo} heading={g.grupo}>
                {g.variables.map((v) => (
                  <CommandItem key={v.clave} value={v.clave} onSelect={() => elegir(v.clave)} className="items-start">
                    <Check className={cn("mt-0.5 size-4 shrink-0", valor === v.clave ? "opacity-100" : "opacity-0")} aria-hidden />
                    <div className="min-w-0">
                      <div className="truncate">{v.etiqueta}</div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">
                        <span className="font-mono">{`{${v.clave}}`}</span>
                        {v.descripcion ? ` — ${v.descripcion}` : ""}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
