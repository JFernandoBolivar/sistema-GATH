import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

interface Props<T extends FieldValues> {
  form: UseFormReturn<T>;
  nameInput: Path<T>;
  label: string;
  placeholder?: string;
  description?: string;
  type: string;
  className?: string;
}
export default function InputForm<T extends FieldValues>({
  form,
  nameInput,
  label,
  description,
  placeholder,
  type,
  className,
}: Props<T>) {
  return (
    <>
      <FormField
        name={nameInput}
        control={form.control}
        render={({ field }) => (
          <FormItem className={cn(className)}>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <Input {...field} placeholder={placeholder} type={type} />
            </FormControl>
            {description !== undefined && (
              <FormDescription>{description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
