import type { PhysicalProfileUpdateType } from "@/shared/schemas/employees/update/schema-physical_profile";
import type { BackgroundUpdateType } from "@/shared/schemas/employees/update/schema-background";
import type { HealthUpdateType } from "@/shared/schemas/employees/update/schema-health_profile";
import type { DwellingUpdateType } from "@/shared/schemas/employees/update/schema-dwelling";
import type { AcademyUpdateUpdateType } from "@/shared/schemas/employees/update/schema-academic_training";
import type { BasicInfoUpdateType } from "@/shared/schemas/employees/update/schemaEmployeeUpdate";
import type { SupplementaryTrainingUpdateType } from "@/shared/schemas/employees/update/schema-supplementary_training";
import type { ContratoUpdateType } from "@/shared/schemas/employees/update/schema-contrato";

export type UpdateEmployeeData =
  | PhysicalProfileUpdateType
  | BackgroundUpdateType
  | HealthUpdateType
  | DwellingUpdateType
  | AcademyUpdateUpdateType
  | BasicInfoUpdateType
  | SupplementaryTrainingUpdateType
  | ContratoUpdateType;

export type UpdateEmployeeFn = (
  data: UpdateEmployeeData,
  idEmployee: string,
  cedulaidentidad?: string,
) => Promise<{ success: boolean; message: string }>;
