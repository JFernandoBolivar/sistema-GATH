/**
 * Casos de uso de Validación de Carnets (Reglas R2, R4).
 *
 * La validación pública (por QR) se hace por `security_hash`, no por un
 * "código de validación" separado — el QR embebe directamente el hash.
 */
import type { Carnet } from "../../domain/entities/carnet";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import type { CarnetDTO, ValidacionCarnetDTO } from "../dtos/carnet-dto";

function aCarnetDTO(e: Carnet): CarnetDTO {
  return {
    id: e.id,
    empleadoCedula: e.empleadoCedula,
    empleadoNombres: e.empleadoNombres,
    empleadoApellidos: e.empleadoApellidos,
    securityHash: e.securityHash,
    fechaEmision: e.fechaEmision,
    motivoId: e.motivoId,
    motivoNombre: e.motivoNombre,
    activo: e.activo,
    observaciones: e.observaciones,
  };
}

export async function validarCarnetPorHash(
  repo: RepoCarnetizacion,
  securityHash: string
): Promise<ValidacionCarnetDTO> {
  const res = await repo.validarPorHash(securityHash);
  return {
    esValido: res.esValido,
    mensaje: res.mensaje,
    carnet: res.carnet ? aCarnetDTO(res.carnet) : null,
  };
}

export async function validarCarnetPorId(
  repo: RepoCarnetizacion,
  carnetId: number
): Promise<ValidacionCarnetDTO> {
  const res = await repo.validarPorId(carnetId);
  return {
    esValido: res.esValido,
    mensaje: res.mensaje,
    carnet: res.carnet ? aCarnetDTO(res.carnet) : null,
  };
}
