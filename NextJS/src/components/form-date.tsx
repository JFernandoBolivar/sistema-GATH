import { formatInTimeZone } from "date-fns-tz";
import { Button } from "./ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { cn } from "@/lib/utils";
interface Props<T extends FieldValues> {
  form: UseFormReturn<T>;
  nameInput: Path<T>;
  label: string;
  className?: string;
}
export default function FormDate<T extends FieldValues>({
  form,
  nameInput,
  label,
  className,
}: Props<T>) {
  return (
    <FormField
      control={form.control}
      name={nameInput}
      render={({ field }) => (
        <FormItem className={`${cn(className)}`}>
          <FormLabel> {label}</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button variant={"outline"} className="font-light">
                  {field.value ? (
                    formatInTimeZone(field.value, "UTC", "dd/MM/yyy")
                  ) : (
                    <span>Selecciona una fecha</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                selected={field.value ? new Date(field.value) : undefined}
                mode="single"
                onSelect={(date) => field.onChange(date)}
                disabled={(date: Date) =>
                  date > new Date() || date < new Date("1900-01-01")
                }
                captionLayout="dropdown"
              />
            </PopoverContent>
          </Popover>

          <FormMessage />
        </FormItem>
      )}
    />
  );
}
