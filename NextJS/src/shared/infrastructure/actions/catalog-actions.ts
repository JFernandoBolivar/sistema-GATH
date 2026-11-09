"use server";

/**
 * Shared bridge for catalog actions across modules (Regla R16).
 * Permite a módulos como Reportes o Movimientos acceder a catálogos
 * organizacionales y de cargos sin acoplamiento transversal directo.
 */
import {
  getCoordinacionesAction as getCoordinacionesOrgAction,
  getDependenciasAction as getDependenciasOrgAction,
  getDireccionesGeneralesAction as getDireccionesGeneralesOrgAction,
  getDireccionesLineaAction as getDireccionesLineaOrgAction,
  getOrganismosAdscritosAction as getOrganismosAdscritosOrgAction,
} from "@/modules/organizacion/infrastructure/actions/organizacion-actions";

import {
  getDenominacionesAction as getDenominacionesCargoAction,
  getDenominacionesEspecificasAction as getDenominacionesEspecificasCargoAction,
  getEstatusAction as getEstatusCargoActionOriginal,
} from "@/modules/cargos/infrastructure/actions/cargos-actions";

export async function getCoordinacionesAction(direccionLineaId?: number) {
  return getCoordinacionesOrgAction(direccionLineaId);
}

export async function getDependenciasAction() {
  return getDependenciasOrgAction();
}

export async function getDireccionesGeneralesAction(dependenciaId?: number) {
  return getDireccionesGeneralesOrgAction(dependenciaId);
}

export async function getDireccionesLineaAction(direccionGeneralId?: number) {
  return getDireccionesLineaOrgAction(direccionGeneralId);
}

export async function getOrganismosAdscritosAction() {
  return getOrganismosAdscritosOrgAction();
}

export async function getDenominacionesAction() {
  return getDenominacionesCargoAction();
}

export async function getDenominacionesEspecificasAction() {
  return getDenominacionesEspecificasCargoAction();
}

export async function getEstatusCargoAction() {
  return getEstatusCargoActionOriginal();
}
