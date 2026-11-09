import z from "zod";

const nombreOrganismo = z
  .string({ required_error: "Este Campo Es Requerido" })
  .trim()
  .min(2, { message: "Mínimo 2 Caracteres" })
  .max(50, { message: "Máximo 50 Caracteres" });

export const schemaAds = z.object({
  Organismoadscrito: nombreOrganismo,
});

export const schemaAdsUpdate = z.object({
  id: z.coerce
    .number()
    .min(1, { message: "Debe Seleccionar Un Organismo Adscrito" }),
  Organismoadscrito: nombreOrganismo,
});

export type AdsType = z.infer<typeof schemaAds>;
export type AdsUpdateType = z.infer<typeof schemaAdsUpdate>;
