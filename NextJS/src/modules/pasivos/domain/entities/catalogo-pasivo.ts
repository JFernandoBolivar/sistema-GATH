/**
 * Ítem genérico de catálogo de Pasivos (`id` + `nombre`).
 *
 * Vive en `domain/entities` para que la UI no dependa de `infrastructure/http`.
 */
export interface CatalogoPasivo {
  id: number;
  nombre: string;
}
