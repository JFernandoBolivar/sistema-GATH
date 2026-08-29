/**
 * Puente F2.13: re-exporta el primitivo shadcn desde su ubicación legacy
 * (`@/components/ui/`). Todo código nuevo debe importar desde
 * `@/shared/ui/components`; el movimiento físico se ejecuta en F8 para no
 * romper la app legada.
 */
export * from "@/components/ui/dialog";

