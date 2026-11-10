/**
 * Resultados serializables de constancias de fe de vida.
 *
 * Viven en `domain/` porque el puerto `RepoFeDeVida` los usa: un `domain` no
 * puede depender de `application/` (S5-02). `application/dtos/fe-de-vida-dto`
 * los reexporta para no romper los imports existentes.
 */

export interface ReenvioConstanciaDTO {
  numero: string;
  destinatario: string;
  destinatarioEnmascarado: string;
  copia: string | null;
  copiaEnmascarada: string | null;
  reenviosHoy: number;
  limiteDiario: number;
}

export interface RegenerarConstanciaDTO {
  numero: string;
  plantillaVersion: number;
  reenviado: boolean;
  destinatarioEnmascarado?: string | null;
  copiaEnmascarada?: string | null;
  reenviosHoy?: number | null;
}
