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
                  className="flex min-h-[44px] items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 cursor-pointer"
                >
                  <FormControl>
                    <RadioGroupItem value={option.value} className="size-5 shrink-0" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer text-sm text-foreground flex-1">
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
