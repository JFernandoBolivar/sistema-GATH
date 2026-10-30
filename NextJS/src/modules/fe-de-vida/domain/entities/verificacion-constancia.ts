export interface CertificanteEntity {
  readonly nombre: string;
  readonly cedula: string;
}

/**
 * Datos de una constancia verificada. En la vista pública la cédula llega enmascarada
 * (`cedulaOculta`) y no hay certificantes ni solicitud.
 */
export interface ConstanciaVerificadaEntity {
  readonly numero: string;
  readonly emitidaEn: string | null;
  readonly procesoNombre: string;
  readonly nombreCompleto: string;
  readonly cedula: string;
  readonly cedulaOculta: boolean;
  readonly solicitudId: string | null;
  readonly certificantes: readonly CertificanteEntity[];
}
