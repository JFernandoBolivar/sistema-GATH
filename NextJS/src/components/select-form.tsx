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
import { Combobox } from "./ui/combobox";
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
  /** Usa un select con buscador (shadcn Combobox) en vez del <Select> nativo.
   * Pensado para catalogos largos (paises, cargos, dependencias, etc.). */
  searchable?: boolean;
  /** Opciones extra (ej. "Otra") que en el <Select> nativo se pasan como
   * `children` (<SelectItem>): el Combobox no renderiza children, asi que
   * cuando `searchable` esta activo se deben repetir aqui. */
  extraOptions?: { value: string; label: string }[];
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
  searchable,
  extraOptions,
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
              {searchable ? (
                <Combobox
                  className={cn(clasNameSelect)}
                  options={[
                    ...(options ?? []).map((item) => ({
                      value: String(item[valueKey]),
                      label: String(item[labelKey]),
                    })),
                    ...(extraOptions ?? []),
                  ]}
                  value={selectedValue ?? field.value?.toString() ?? ""}
                  onChange={(value) => {
                    onCustomChange
                      ? onCustomChange(value)
                      : field.onChange(value);
                  }}
                  placeholder={isLoading ? "Cargando..." : placeholder}
                  searchPlaceholder={`Buscar ${SelectLabelItem.toLowerCase()}...`}
                  disabled={isLoading}
                />
              ) : (
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
              )}
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
