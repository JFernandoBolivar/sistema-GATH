import { FieldValues, Path, UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";
interface Props<T extends FieldValues> {
  form: UseFormReturn<T>;
  nameInput: Path<T>;
  label: string;
  className?: string;
}
export default function TextAreaForm<T extends FieldValues>({
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
        <FormItem className={cn(className)}>
          <FormLabel htmlFor="observaciones" className="cursor-pointer">
            {label}
          </FormLabel>
          <FormControl>
            <Textarea
              id="observaciones"
              placeholder="Describa las observaciones del familiar..."
              value={field.value}
              onChange={field.onChange}
              className="mt-1"
              rows={4}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
