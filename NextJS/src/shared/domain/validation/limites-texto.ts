/**
 * Límites de los campos de texto libre. El backend los repite en
 * `BACKEND/core/domain/limites_texto.py`: cambiar ambos a la vez.
 */
export const LIMITES_TEXTO = {
  /** «Dirección exacta» de cualquier formulario. */
  direccion: { min: 10, max: 500 },
  /** Motivos y justificaciones obligatorios. */
  motivo: { min: 10, max: 500 },
  /** Observaciones y comentarios opcionales: si se escriben, mínimo `min`. */
  observacion: { min: 5, max: 500 },
} as const;

export type LimiteTexto = { readonly min: number; readonly max: number };

