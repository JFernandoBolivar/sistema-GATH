"use client";

/**
 * Buscador de cargos en el servidor (Popover + Command, igual que `Combobox`,
 * pero sin lista previa): con 2 caracteres o más y 300 ms de espera consulta
 * `/cargos/?busqueda=` y se queda con la última respuesta.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { unstable_rethrow } from "next/navigation";

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
import { getCargosPaginadoAction } from "@/modules/cargos/infrastructure/actions/cargos-actions";
import type { CargoAsignacionDTO } from "@/modules/cargos/application/dtos/cargo-dto";

export const MIN_CARACTERES_BUSQUEDA = 2;
export const ESPERA_BUSQUEDA_MS = 300;
const TAMANO_PAGINA = 20;

export function etiquetaCargo(c: CargoAsignacionDTO): string {
  const ocupante = c.empleadoNombre
    ? ` — Titular: ${c.empleadoNombre}`
    : c.empleadoCedula
      ? ` — Titular: ${c.empleadoCedula}`
      : " — (Vacante)";
  return `${c.codigo} - ${c.denominacionNombre} (${c.especificaNombre})${ocupante}`;
}

interface CargoBuscadorProps {
  value: CargoAsignacionDTO | null;
  onSelect: (cargo: CargoAsignacionDTO | null) => void;
  /** Oculta los cargos que ya ocupa esta cédula. */
  excluirCedula?: string;
  id?: string;
  disabled?: boolean;
}

export function CargoBuscador({ value, onSelect, excluirCedula, id, disabled }: CargoBuscadorProps) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<CargoAsignacionDTO[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ultimaPeticion = useRef(0);

  const termino = texto.trim();
  const listo = termino.length >= MIN_CARACTERES_BUSQUEDA;

  useEffect(() => {
    // Cada cambio invalida la petición anterior: su respuesta se descarta.
    const numero = ++ultimaPeticion.current;
    if (!listo) {
      setResultados([]);
      setBuscando(false);
      setError(null);
      return;
    }
    setBuscando(true);
    setError(null);
    const temporizador = setTimeout(async () => {
      try {
        const pagina = await getCargosPaginadoAction({
          busqueda: termino,
          pagina: 1,
          pageSize: TAMANO_PAGINA,
        });
        if (numero !== ultimaPeticion.current) return;
        setResultados(pagina.resultados);
      } catch (err) {
        unstable_rethrow(err);
        if (numero !== ultimaPeticion.current) return;
        setResultados([]);
        setError(err instanceof Error ? err.message : "Error al buscar cargos");
      } finally {
        if (numero === ultimaPeticion.current) setBuscando(false);
      }
    }, ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(temporizador);
  }, [termino, listo]);

  const visibles = excluirCedula
    ? resultados.filter((c) => c.empleadoCedula !== excluirCedula)
    : resultados;

  let mensaje: string | null = null;
  if (!listo) mensaje = `Escriba al menos ${MIN_CARACTERES_BUSQUEDA} caracteres`;
  else if (buscando) mensaje = "Buscando…";
  else if (error) mensaje = error;
  else if (visibles.length === 0) mensaje = "Sin resultados";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          id={id}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="min-w-0 flex-1 truncate text-left" title={value ? etiquetaCargo(value) : undefined}>
            {value ? etiquetaCargo(value) : "Buscar por código, cargo, unidad u ocupante"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        {/* El filtrado lo hace el servidor: cmdk no debe volver a filtrar. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar código, cargo, unidad u ocupante..." value={texto} onValueChange={setTexto} />
          <CommandList>
            {mensaje ? (
              <CommandEmpty>{mensaje}</CommandEmpty>
            ) : (
              <CommandGroup>
                {visibles.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={String(c.id)}
                    onSelect={() => {
                      onSelect(c);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 size-4", value?.id === c.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{etiquetaCargo(c)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
