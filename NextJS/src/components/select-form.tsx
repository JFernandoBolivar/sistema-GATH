import { FieldValues, Form, Path, UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "@/lib/utils";

interface Props<T extends FieldValues, D> {
  form: UseFormReturn<T>;
  nameSalect: Path<T>;
  Formlabel: string;
  SelectLabelItem: string;
  description?: string;
  placeholder: string;
  options: D[];
  isLoading: boolean;
  valueKey: keyof D;
  labelKey: keyof D;
  classNameItem?: string;
  clasNameSelect?: string;
  onCustomChange?: (value: string) => void;
  selectedValue?: string;
  children?: React.ReactNode;
}
export function SelectForm<T extends FieldValues, D>({
  form,
  nameSalect,
  isLoading,
  Formlabel,
  description,
  SelectLabelItem,
  placeholder,
  options,
  valueKey,
  labelKey,
  classNameItem,
  clasNameSelect,
  onCustomChange,
  selectedValue,
  children,
}: Props<T, D>) {
  return (
    <>
      <FormField
        name={nameSalect}
        control={form.control}
        render={({ field }) => (
          <FormItem className={cn(classNameItem)}>
            <FormLabel>{Formlabel}</FormLabel>
            <FormControl>
              <Select
                onValueChange={(value) => {
                  onCustomChange ? onCustomChange(value) : field.onChange(value);
                }}
                value={selectedValue ?? field.value?.toString() ?? ""}
              >
                <SelectTrigger
                  className={`${cn(clasNameSelect)} w-full truncate`}
                >
                  <SelectValue
                    placeholder={isLoading ? "Cargando..." : placeholder}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{SelectLabelItem}</SelectLabel>

                    {options?.map((item, index) => (
                      <SelectItem key={index} value={String(item[valueKey])}>
                        {String(item[labelKey])}
                      </SelectItem>
                    ))}
                    {children}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
