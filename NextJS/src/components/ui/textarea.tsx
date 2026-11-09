import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Fuerza u oculta la visualización del contador de caracteres */
  mostrarContador?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      minLength,
      maxLength,
      mostrarContador,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref,
  ) => {
    const [longitudInterna, setLongitudInterna] = React.useState<number>(() => {
      if (typeof value === "string") return value.length;
      if (typeof defaultValue === "string") return defaultValue.length;
      return 0;
    });

    React.useEffect(() => {
      if (typeof value === "string") {
        setLongitudInterna(value.length);
      }
    }, [value]);

    const longitudActual = typeof value === "string" ? value.length : longitudInterna;

    const tieneMin = minLength !== undefined && minLength > 0;
    const tieneMax = maxLength !== undefined && maxLength > 0;
    const deberiaMostrarContador =
      mostrarContador ?? (tieneMin || tieneMax);

    const alcanzoMinimo = !tieneMin || longitudActual >= (minLength as number);

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
      setLongitudInterna(e.target.value.length);
      onChange?.(e);
    }

    const textareaElement = (
      <textarea
        data-slot="textarea"
        ref={ref}
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex h-28 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm overflow-y-auto",
          className,
          "resize-none",
        )}
        {...props}
      />
    );

    if (!deberiaMostrarContador) {
      return textareaElement;
    }

    let textoContador = "";
    if (tieneMax && tieneMin) {
      textoContador = `${longitudActual} / ${maxLength} · mínimo ${minLength}`;
    } else if (tieneMax) {
      textoContador = `${longitudActual} / ${maxLength}`;
    } else if (tieneMin) {
      textoContador = `${longitudActual} caracteres · mínimo ${minLength}`;
    } else {
      textoContador = `${longitudActual} caracteres`;
    }

    return (
      <div className="w-full space-y-1">
        {textareaElement}
        <div className="flex justify-end pr-0.5">
          <span
            data-slot="textarea-counter"
            className={cn(
              "text-xs transition-colors select-none",
              !alcanzoMinimo ? "text-destructive font-medium" : "text-muted-foreground",
            )}
          >
            {textoContador}
          </span>
        </div>
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
