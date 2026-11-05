"use client";

import { useWatch, type Control, type FieldPath, type FieldValues } from "react-hook-form";

interface Props {
  /** Texto actual del campo. */
  valor: string | null | undefined;
  max: number;
  /** Para `aria-describedby` del textarea. */
  id?: string;
}

/** Contador «N/max» de los campos de texto libre. */
export function ContadorCaracteres({ valor, max, id }: Props) {
  const n = (valor ?? "").length;
  return (
    <p id={id} className={`text-right text-xs ${n >= max ? "text-destructive" : "text-muted-foreground"}`}>
      {n}/{max}
    </p>
  );
}

interface PropsCampo<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  max: number;
  id?: string;
}

/** Contador «N/max» enlazado a un campo de react-hook-form. */
export function ContadorCampo<T extends FieldValues>({ control, name, max, id }: PropsCampo<T>) {
  const valor = useWatch({ control, name }) as unknown;
  return <ContadorCaracteres valor={typeof valor === "string" ? valor : ""} max={max} id={id} />;
}
