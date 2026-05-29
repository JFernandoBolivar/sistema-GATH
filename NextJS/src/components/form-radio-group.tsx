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
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import { cn } from "@/lib/utils"

interface RadioOption {
  value: string
  label: string
}

interface Props<T extends FieldValues> {
  form: UseFormReturn<T>
  nameInput: Path<T>
  label: string
  description?: string
  options: RadioOption[]
  orientation?: "vertical" | "horizontal"
  className?: string
}

export default function RadioGroupForm<T extends FieldValues>({
  form,
  nameInput,
  label,
  description,
  options,
  orientation = "vertical",
  className,
}: Props<T>) {
  return (
    <FormField
      control={form.control}
      name={nameInput}
      render={({ field }) => (
        <FormItem className={cn(className)}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className={cn(
                orientation === "horizontal" ? "flex flex-wrap gap-4" : "grid gap-2"
              )}
            >
              {options.map((option) => (
                <FormItem
                  key={option.value}
                  className="flex items-center gap-2 space-y-0"
                >
                  <FormControl>
                    <RadioGroupItem value={option.value} />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    {option.label}
                  </FormLabel>
                </FormItem>
              ))}
            </RadioGroup>
          </FormControl>
          {description !== undefined && (
            <FormDescription>{description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
