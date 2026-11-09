/**
 * Contrato C-1 (sobre de respuesta unificado) tal como lo emite el backend
 * (`core/presentation/envelope.py` — `ok()`/`fail()`). F2.14: extraído como primer
 * corte del monolito `src/app/types/types.ts` (579 líneas); la descomposición completa
 * de ese archivo por entidad/módulo se difiere a Fase F4.
 */
export interface ApiResponse<T> {
  status: "success";
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  status: "error";
  message: string;
  data: null;
}

export type ApiEnvelope<T> = ApiResponse<T> | ApiErrorResponse;

export function isApiSuccess<T>(envelope: ApiEnvelope<T>): envelope is ApiResponse<T> {
  return envelope.status === "success";
}

/** Metadatos de paginación estándar de los listados DRF. */
export interface PaginationMeta {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  meta: PaginationMeta;
  results: T[];
}
