/**
 * Base de las rutas de Fe de vida según el módulo activo.
 *
 * El mismo módulo se sirve bajo Gestión de Personal Activo
 * (`/personal/fe-de-vida`) y bajo Gestión de Personal Pasivo
 * (`/pasivos/fe-de-vida`). Los enlaces internos deben permanecer en el módulo
 * desde el que se entró: un pasivo nunca debe saltar al de activos.
 */
export function baseFeDeVida(pathname: string | null | undefined): string {
  return pathname?.startsWith("/pasivos") ? "/pasivos/fe-de-vida" : "/personal/fe-de-vida";
}
