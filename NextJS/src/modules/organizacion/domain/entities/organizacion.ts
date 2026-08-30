/**
 * Entidades de Dominio de Organización (Regla R1).
 *
 * Alineadas a los serializers de lectura/writura del backend
 * (`apps/organizacion/presentation/serializers/organizacion_serializers.py`).
 * `codigo` y los identificadores de jerarquía pueden ser nulos: el contrato
 * del backend los declara `allow_null=True` en los Write serializers.
 */
export interface Dependencia {
  id: number;
  codigo?: string;
  nombre: string;
}

export interface DireccionGeneral {
  id: number;
  codigo?: string;
  nombre: string;
  dependenciaId: number | null;
}

export interface DireccionLinea {
  id: number;
  codigo?: string;
  nombre: string;
  direccionGeneralId: number | null;
}

export interface Coordinacion {
  id: number;
  codigo?: string;
  nombre: string;
  direccionLineaId: number | null;
}

export interface OrganismoAdscrito {
  id: number;
  nombre: string;
  parentId?: number | null;
}
