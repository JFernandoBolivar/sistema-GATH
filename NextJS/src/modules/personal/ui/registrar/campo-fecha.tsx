"use client";

/**
 * Selector de fecha (Popover + Calendar) con el mismo aspecto que el legado
 * en los pasos de formación complementaria y antecedentes.
 */
import { formatInTimeZone } from "date-fns-tz";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Calendar } from "@/shared/ui/components/calendar";
import { FormControl } from "@/shared/ui/components/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";

export function CampoFecha({
  value,
  onChange,
  desde = new Date("1930-01-01"),
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  desde?: Date;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <FormControl>
          <Button type="button" variant="outline" className="w-48 justify-between font-normal">
            {value ? formatInTimeZone(value, "UTC", "dd/MM/yyy") : <span>Selecciona una fecha</span>}
            <ChevronDownIcon />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          captionLayout="dropdown"
          disabled={(date) => date > new Date() || date < desde}
          onSelect={(date) => onChange(date)}
        />
      </PopoverContent>
    </Popover>
  );
}
