"use client"

import { FieldValues, Path, UseFormReturn } from "react-hook-form"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form"
import { Checkbox } from "./ui/checkbox"
import { cn } from "@/lib/utils"

interface Props<T extends FieldValues> {
  form: UseFormReturn<T>
  nameInput: Path<T>
  label: string
  description?: string
  className?: string
}

export default function CheckboxForm<T extends FieldValues>({
  form,
  nameInput,
  label,
  description,
  className,
}: Props<T>) {
  return (
    <FormField
      control={form.control}
      name={nameInput}
      render={({ field }) => (
        <FormItem
          className={cn(
            "flex flex-row items-start gap-2 space-y-0",
            className
          )}
        >
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              className="mt-1"
            />
          </FormControl>
          <div className="grid gap-1.5 leading-none">
            <FormLabel className="font-normal cursor-pointer">
              {label}
            </FormLabel>
            {description !== undefined && (
              <FormDescription>{description}</FormDescription>
            )}
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  )
}
