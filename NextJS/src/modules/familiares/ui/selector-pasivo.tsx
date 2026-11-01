"use client";

/** Selector de pasivo para las pantallas de familiares (`?pasivo=1`). */
import useSWR from "swr";
import { UserRound } from "lucide-react";

import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import { listarPasivosParaFamiliarAction } from "../infrastructure/actions/pasivos-familiares-actions";

export function SelectorPasivo({
  onSelect,
  disabled,
}: {
  onSelect: (cedula: string) => void;
  disabled?: boolean;
}) {
  const { data } = useSWR("pasivos-selector-familiares", listarPasivosParaFamiliarAction);

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Label htmlFor="pasivo-selector" className="flex items-center gap-2">
        <UserRound className="size-4" aria-hidden="true" />
        Pasivo
      </Label>
      <Select onValueChange={onSelect} disabled={disabled}>
        <SelectTrigger id="pasivo-selector" className="w-full">
          <SelectValue placeholder="Seleccione un pasivo" />
        </SelectTrigger>
        <SelectContent>
          {(data ?? []).map((p) => (
            <SelectItem key={p.cedula} value={p.cedula}>
              {p.nombreCompleto} — C.I. {p.cedula}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
