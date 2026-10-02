import z from "zod";

export const schemaAds = z.object({
  Organismoadscrito: z
    .string({
      required_error: "Este Campo Es Requerido",
    })
    .min(1, {
      message: "Mínimo 3 Caracteres",
    })
    .max(100, { message: "Máximo 100 Caracteres" }),
});

export const schemaAdsUpdate = z.object({
  id: z.coerce
    .number()
    .min(1, { message: "Debe Seleccionar Un Organismo Adscrito" }),
  Organismoadscrito: z
    .string({
      required_error: "Este Campo Es Requerido",
    })
    .min(1, {
      message: "Mínimo 3 Caracteres",
    })
    .max(100, { message: "Máximo 100 Caracteres" }),
});

export type AdsType = z.infer<typeof schemaAds>;
export type AdsUpdateType = z.infer<typeof schemaAdsUpdate>;
