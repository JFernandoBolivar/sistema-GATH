"use client";

/**
 * Campo de teléfono con código de país (D-13).
 * - País: botón compacto con el prefijo (`+58`) y lista con buscador.
 * - Venezuela: además, el código de operadora (0412, 0414…) o de área (0212 Caracas…) con buscador,
 *   y los 7 dígitos del número. Si se escribe o pega el número completo, se separa solo.
 * - Otros países: el número nacional completo.
 * Emite el valor en E.164 (`+584121234567`) o "" si está vacío; la validación la hace `telefonoZod`.
 */
import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { CountryCode } from "libphonenumber-js/max";
import { cn } from "@/lib/utils";
import { Input } from "@/shared/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/components/command";
import {
  OPERADORAS_VE,
  ZONAS_VE,
  paisDesdeInternacional,
  paisesTelefono,
  separarPrefijoVE,
  separarTelefono,
  unirTelefono,
  type TipoTelefono,
} from "@/shared/domain/validation/telefono";

interface CampoTelefonoProps {
  id?: string;
  value: string | null | undefined;
  onChange: (valor: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalido?: boolean;
  /** "movil": en Venezuela solo ofrece códigos de operadoras móviles. */
  tipo?: TipoTelefono;
  placeholder?: string;
  className?: string;
  "aria-describedby"?: string;
}

interface Estado {
  pais: CountryCode;
  /** Solo Venezuela: «0412», «0212»… o "" si aún no se eligió. */
  prefijo: string;
  /** Venezuela: los 7 dígitos; otros países: el número nacional completo. */
  numero: string;
}

const CLASE_BOTON = cn(
  "flex h-11 shrink-0 items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2 sm:px-3 text-sm",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

function estadoDesde(valor: string | null | undefined): Estado {
  const { pais, nacional } = separarTelefono(valor);
  if (pais === "VE") return { pais, ...separarPrefijoVE(nacional) };
  return { pais, prefijo: "", numero: nacional };
}

function nacionalDe(e: Estado): string {
  if (e.pais !== "VE") return e.numero;
  return `${e.prefijo.replace(/^0/, "")}${e.numero}`;
}

export function CampoTelefono({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalido,
  tipo = "cualquiera",
  placeholder,
  className,
  "aria-describedby": describedBy,
}: CampoTelefonoProps) {
  const paises = useMemo(() => paisesTelefono(), []);
  const [paisAbierto, setPaisAbierto] = useState(false);
  const [prefijoAbierto, setPrefijoAbierto] = useState(false);
  // Lo escrito se guarda tal cual; al formulario se le entrega E.164. Solo se vuelve a leer
  // `value` si cambia desde fuera (reset o carga de datos).
  const [estado, setEstado] = useState<Estado>(() => estadoDesde(value));
  const [emitido, setEmitido] = useState(value ?? "");
  if ((value ?? "") !== emitido) {
    setEmitido(value ?? "");
    setEstado(estadoDesde(value));
  }
  const actual = paises.find((p) => p.codigo === estado.pais);
  const esVE = estado.pais === "VE";

  function emitir(nuevo: Estado) {
    const nacional = nacionalDe(nuevo);
    const valor = nacional ? unirTelefono(nuevo.pais, nacional) : "";
    setEstado(nuevo);
    setEmitido(valor);
    onChange(valor);
  }

  function alEscribir(texto: string) {
    const internacional = paisDesdeInternacional(texto);
    if (internacional) {
      const { pais, nacional } = internacional;
      emitir(
        pais === "VE"
          ? { pais, ...separarPrefijoVE(nacional) }
          : { pais, prefijo: "", numero: nacional },
      );
      return;
    }
    const digitos = texto.replace(/\D/g, "");
    if (esVE) {
      // Número completo escrito o pegado (04121234567 / 4121234567): se separa en código y número.
      if (digitos.length >= 10) {
        const separado = separarPrefijoVE(digitos);
        if (separado.prefijo) {
          emitir({ pais: "VE", ...separado, numero: separado.numero.slice(0, 7) });
          return;
        }
      }
      emitir({ ...estado, numero: digitos.slice(0, 7) });
      return;
    }
    emitir({ ...estado, numero: digitos });
  }

  const codigosMovil = Object.entries(OPERADORAS_VE);
  const codigosFijo = tipo === "movil" ? [] : Object.entries(ZONAS_VE);
  const descripcionPrefijo = OPERADORAS_VE[estado.prefijo] ?? ZONAS_VE[estado.prefijo];

  return (
    <div className={cn("flex w-full min-w-0 items-center gap-1.5 sm:gap-2", className)}>
      <Popover open={paisAbierto} onOpenChange={setPaisAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Código de país: ${actual?.nombre ?? estado.pais} (${actual?.prefijo ?? ""})`}
            title={actual ? `${actual.nombre} (${actual.prefijo})` : undefined}
            data-pais={estado.pais}
            className={cn(CLASE_BOTON, "w-[3.75rem] min-w-[3.75rem] px-1.5 sm:w-[4.75rem] sm:min-w-[4.75rem] sm:px-2.5")}
          >
            <span className="tabular-nums text-xs sm:text-sm font-medium">{actual?.prefijo ?? "+"}</span>
            <ChevronDown className="size-3.5 sm:size-4 opacity-60 shrink-0" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar país o código…" />
            <CommandList>
              <CommandEmpty>No se encontró ese país.</CommandEmpty>
              {paises.map((p) => (
                <CommandItem
                  key={p.codigo}
                  value={`${p.nombre} ${p.prefijo} ${p.codigo}`}
                  onSelect={() => {
                    emitir({ pais: p.codigo, prefijo: "", numero: "" });
                    setPaisAbierto(false);
                  }}
                >
                  <Check
                    className={cn("size-4", p.codigo === estado.pais ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{p.nombre}</span>
                  <span className="tabular-nums text-muted-foreground">{p.prefijo}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {esVE ? (
        <Popover open={prefijoAbierto} onOpenChange={setPrefijoAbierto}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={
                estado.prefijo
                  ? `Código: ${estado.prefijo} ${descripcionPrefijo ?? ""}`
                  : tipo === "movil"
                    ? "Código de operadora"
                    : "Código de operadora o de área"
              }
              title={descripcionPrefijo}
              data-prefijo={estado.prefijo}
              className={cn(
                CLASE_BOTON,
                "w-[4.25rem] min-w-[4.25rem] px-1.5 sm:w-[5.25rem] sm:min-w-[5.25rem] sm:px-2.5",
                !estado.prefijo && "text-muted-foreground",
                invalido && !estado.prefijo && "border-destructive",
              )}
            >
              <span className="tabular-nums text-xs sm:text-sm font-medium truncate">{estado.prefijo || "Cód."}</span>
              <ChevronDown className="size-3.5 sm:size-4 opacity-60 shrink-0" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar código, operadora o zona…" />
              <CommandList>
                <CommandEmpty>No se encontró ese código.</CommandEmpty>
                <CommandGroup heading="Móvil">
                  {codigosMovil.map(([codigo, operadora]) => (
                    <CommandItem
                      key={codigo}
                      value={`${codigo} ${operadora} movil celular`}
                      onSelect={() => {
                        emitir({ ...estado, prefijo: codigo });
                        setPrefijoAbierto(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "size-4",
                          codigo === estado.prefijo ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      <span className="tabular-nums font-medium">{codigo}</span>
                      <span className="flex-1 truncate text-muted-foreground">{operadora}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {codigosFijo.length > 0 && (
                  <CommandGroup heading="Fijo (código de área)">
                    {codigosFijo.map(([codigo, zona]) => (
                      <CommandItem
                        key={codigo}
                        value={`${codigo} ${zona} fijo`}
                        onSelect={() => {
                          emitir({ ...estado, prefijo: codigo });
                          setPrefijoAbierto(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "size-4",
                            codigo === estado.prefijo ? "opacity-100" : "opacity-0",
                          )}
                          aria-hidden
                        />
                        <span className="tabular-nums font-medium">{codigo}</span>
                        <span className="flex-1 truncate text-muted-foreground">{zona}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : null}

      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className="min-w-0 flex-1 px-2.5 sm:px-3 text-sm sm:text-base tabular-nums"
        placeholder={placeholder ?? (esVE ? "1234567" : "Número")}
        value={estado.numero}
        disabled={disabled}
        aria-invalid={invalido || undefined}
        aria-describedby={describedBy}
        onBlur={onBlur}
        onChange={(e) => alEscribir(e.target.value)}
      />
    </div>
  );
}
