"use client";

/**
 * Campo de teléfono con código de país (D-13). Selector de país (Venezuela +58 por
 * defecto) y el número nacional al lado. Emite el valor en E.164 (`+584121234567`)
 * o "" si está vacío; la validación la hace `telefonoZod` del formulario.
 */
import { useMemo, useState } from "react";
import type { CountryCode } from "libphonenumber-js/max";
import { cn } from "@/lib/utils";
import { Input } from "@/shared/ui/components/input";
import {
  paisDesdeInternacional,
  paisesTelefono,
  separarTelefono,
  unirTelefono,
} from "@/shared/domain/validation/telefono";

interface CampoTelefonoProps {
  id?: string;
  value: string | null | undefined;
  onChange: (valor: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalido?: boolean;
  placeholder?: string;
  className?: string;
  "aria-describedby"?: string;
}

const PLACEHOLDER_VE = "0412 1234567";

export function CampoTelefono({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalido,
  placeholder,
  className,
  "aria-describedby": describedBy,
}: CampoTelefonoProps) {
  const paises = useMemo(() => paisesTelefono(), []);
  // Lo que la persona escribe se guarda tal cual (p. ej. «0412…»); al formulario se le entrega
  // E.164. Solo se vuelve a leer `value` si cambia desde fuera (reset o carga de datos).
  const [estado, setEstado] = useState(() => separarTelefono(value));
  const [emitido, setEmitido] = useState(value ?? "");
  if ((value ?? "") !== emitido) {
    setEmitido(value ?? "");
    setEstado(separarTelefono(value));
  }
  const { pais, nacional } = estado;

  function emitir(nuevoPais: CountryCode, nuevoNacional: string) {
    const valor = unirTelefono(nuevoPais, nuevoNacional);
    setEstado({ pais: nuevoPais, nacional: nuevoNacional });
    setEmitido(valor);
    onChange(valor);
  }

  return (
    <div className={cn("flex w-full gap-2", className)}>
      <select
        aria-label="Código de país"
        className={cn(
          "h-11 w-28 shrink-0 rounded-md border border-input bg-transparent px-2 text-base md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        value={pais}
        disabled={disabled}
        onChange={(e) => emitir(e.target.value as CountryCode, nacional)}
      >
        {paises.map((p) => (
          <option key={p.codigo} value={p.codigo}>
            {p.prefijo} {p.nombre}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className="min-w-0 flex-1"
        placeholder={placeholder ?? (pais === "VE" ? PLACEHOLDER_VE : "Número")}
        value={nacional}
        disabled={disabled}
        aria-invalid={invalido || undefined}
        aria-describedby={describedBy}
        onBlur={onBlur}
        onChange={(e) => {
          // Si se escribe o pega con «+código» (p. ej. +57 300 1234567) el selector cambia a ese país.
          const internacional = paisDesdeInternacional(e.target.value);
          if (internacional) emitir(internacional.pais, internacional.nacional);
          else emitir(pais, e.target.value.replace(/[^\d]/g, ""));
        }}
      />
    </div>
  );
}
