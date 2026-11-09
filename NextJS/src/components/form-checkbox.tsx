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
            "flex min-h-[44px] flex-row items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 cursor-pointer",
            className
          )}
        >
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              className="size-5 shrink-0"
            />
          </FormControl>
          <div className="flex-1 leading-none">
            <FormLabel className="font-normal cursor-pointer text-sm text-foreground">
              {label}
            </FormLabel>
            {description !== undefined && (
              <FormDescription className="mt-1">{description}</FormDescription>
            )}
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  )
}
