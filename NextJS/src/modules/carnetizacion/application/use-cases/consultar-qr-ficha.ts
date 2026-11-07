/**
 * Casos de uso de Ficha QR y Privacidad por Dato (O44 - E9).
 * Reglas de visibilidad, anti-rastreo y bitácora.
 */
import type { FichaQr, PreferenciasPrivacidadCarnet } from "../../domain/entities/carnet";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";

export async function consultarFichaQrUC(
  repo: RepoCarnetizacion,
  securityHash: string
): Promise<FichaQr> {
  return repo.consultarFichaQr(securityHash);
}

export async function consultarSaludEmergenciaUC(
  repo: RepoCarnetizacion,
  securityHash: string
): Promise<FichaQr> {
  return repo.consultarSaludEmergencia(securityHash);
}

export async function obtenerPreferenciasPrivacidadUC(
  repo: RepoCarnetizacion
): Promise<PreferenciasPrivacidadCarnet> {
  return repo.obtenerPreferenciasPrivacidad();
}

export async function guardarPreferenciasPrivacidadUC(
  repo: RepoCarnetizacion,
  preferencias: PreferenciasPrivacidadCarnet
): Promise<PreferenciasPrivacidadCarnet> {
  // Invariante de seguridad: la dirección de vivienda jamás puede configurarse como pública
  if (preferencias.direccion_vivienda === "PUBLICO") {
    throw new Error("La dirección de vivienda es información personal reservada y no puede ser pública.");
  }
  return repo.guardarPreferenciasPrivacidad(preferencias);
}
