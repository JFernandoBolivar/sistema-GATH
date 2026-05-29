import { Label } from "recharts";
import { FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Switch } from "./ui/switch";
import { FieldValues, Path, UseFormReturn } from "react-hook-form";
interface Props<T extends FieldValues> {
  form: UseFormReturn<T>;
  nameInput: Path<T>;
  label: string;
  id: string;
}
export default function FormCheck<T extends FieldValues>({
  form,
  nameInput,
  label,
  id,
}: Props<T>) {
  return (
    <FormField
      name={nameInput}
      control={form.control}
      render={({ field }) => (
        <>
          <FormItem className="flex flex-row items-center  m-auto">
            <FormLabel htmlFor={id}>{label}</FormLabel>
            <Switch
              id={id}
              onCheckedChange={field.onChange}
              className="scale-100 cursor-pointer"
            />
          </FormItem>
          <FormMessage />
        </>
      )}
    />
  );
}
