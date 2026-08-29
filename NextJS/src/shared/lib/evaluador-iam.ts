/**
 * Motor de evaluación de políticas de autorización IAM / PBAC (estilo AWS) en Frontend.
 *
 * Reglas de Evaluación:
 * 1. Explicit Deny: Si el código coincide con algún patrón en `deny`, el resultado es `false`.
 * 2. Explicit Allow: Si el código coincide con algún patrón en `allow`, el resultado es `true`.
 * 3. Implicit Deny: Si no hay coincidencia, el resultado es `false` (fail-closed).
 */

export interface PoliticaAccesoDTO {
  allow: string[];
  deny: string[];
}

export function patronesCandidatos(codigoRequerido: string): Set<string> {
  const normalizado = codigoRequerido.trim().toLowerCase();
  const candidatos = new Set<string>(['*', normalizado]);
  if (normalizado.includes('.')) {
    const modulo = normalizado.split('.')[0];
    candidatos.add(`${modulo}.*`);
  }
  return candidatos;
}

export function puede(
  politica: PoliticaAccesoDTO | null | undefined,
  codigoRequerido: string
): boolean {
  if (!politica || !codigoRequerido || !codigoRequerido.trim()) {
    return false;
  }

  const candidatos = patronesCandidatos(codigoRequerido);
  const allowSet = new Set((politica.allow || []).map((x) => x.trim().toLowerCase()));
  const denySet = new Set((politica.deny || []).map((x) => x.trim().toLowerCase()));

  // 1. Regla AWS: Deny explícito tiene prioridad máxima
  for (const patron of candidatos) {
    if (denySet.has(patron)) {
      return false;
    }
  }

  // 2. Concesión explícita
  for (const patron of candidatos) {
    if (allowSet.has(patron)) {
      return true;
    }
  }

  // 3. Denegación implícita
  return false;
}
