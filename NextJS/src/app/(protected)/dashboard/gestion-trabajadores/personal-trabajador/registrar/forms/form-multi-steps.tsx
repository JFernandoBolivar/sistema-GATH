"use client";
import {
  type Schema as SchemaFormity,
  type Form as FormFormity,
  type Return as ReturnFormity,
  OnReturn,
  Formity,
} from "@formity/react";

import FormAcademyLevel from "@/shared/forms/employees/register/form-academic_training";
import FormPhysical from "@/shared/forms/employees/register/form-physical_profile";
import FormDwelling from "@/shared/forms/employees/register/form-dwelling";
import FormHealth from "@/shared/forms/employees/register/form-health_profile";
import { FormBasicInfo } from "@/shared/forms/employees/register/form-basic-info";
import FormBackground from "@/shared/forms/employees/register/form-background";
import FormSupplementaryTraining from "@/shared/forms/employees/register/form-supplementary_training";

import { toast } from "sonner";
import { useCallback, useEffect, useState, useTransition } from "react";
import { BasicInfoType } from "@/shared/schemas/employees/register/schema-basic-info";
import { AcademyType } from "@/shared/schemas/employees/register/schema-academic_training";
import { BackgroundType } from "@/shared/schemas/employees/register/schema-background";
import { SupplementaryTrainingType } from "@/shared/schemas/employees/register/schema-supplementary_training";
import { HealthType } from "@/shared/schemas/employees/register/schema-health_profile";
import { PhysicalProfileType } from "@/shared/schemas/employees/register/schema-physical_profile";
import { DwellingType } from "@/shared/schemas/employees/register/schema-dwelling";
import { registerEmployeeSteps } from "../actions/formStepActions";
import { FamilyEmployeeType } from "@/shared/schemas/employees/register/schema-family_employee";
import { FormFamilyEmployee } from "@/shared/forms/employees/register/form-family";
import Loading from "../../../components/loading/loading";
type Values = [
  FormFormity<BasicInfoType>,
  FormFormity<AcademyType>,
  FormFormity<SupplementaryTrainingType>,
  FormFormity<BackgroundType>,
  FormFormity<HealthType>,
  FormFormity<PhysicalProfileType>,
  FormFormity<DwellingType>,
  ReturnFormity<
    BasicInfoType &
      AcademyType &
      SupplementaryTrainingType &
      BackgroundType &
      HealthType &
      PhysicalProfileType &
      DwellingType
  >,
];

const schema: SchemaFormity<Values> = [
  {
    form: {
      values: () => ({
        usuario_id: [0, []],
        cedulaidentidad: ["", []],
        nombres: ["", []],
        apellidos: ["", []],
        file: [null as unknown as File, []],
        fecha_nacimiento: [new Date(), []],
        sexoid: [0, []],
        estadoCivil: [0, []],
      }),
      render: ({ values, onNext }) => (
        <FormBasicInfo defaultValues={values} onSubmit={onNext} />
      ),
    },
  },

  {
    form: {
      values: () => ({
        formacion_academica: [
          [
            {
              nivel_Academico_id: 0,
              carrera_id: undefined,
              mencion_id: undefined,
              institucion_id: undefined,
            },
          ],
          [],
        ],
      }),
      render: ({ values, onNext }) => (
        <FormAcademyLevel
          defaultValues={values}
          onSubmit={onNext}
        />
      ),
    },
  },
  {
    form: {
      values: () => ({
        formacion_complementaria: [
          [
            {
              fecha_inicio: undefined,
              fecha_fin: undefined,
              institucion_id: 0,
              capacitacion_id: 0,
              procedencia_id: 0,
              horas_completadas: undefined,
            },
          ],
          [],
        ],
      }),
      render: ({ values, onNext }) => (
        <FormSupplementaryTraining
          defaultValues={values}
          onSubmit={onNext}
        />
      ),
    },
  },
  {
    form: {
      values: () => ({
        antecedentes: [
          [
            {
              organismo_id: undefined,
              fecha_ingreso: undefined,
              fecha_egreso: undefined,
            },
          ],
          [],
        ],
      }),
      render: ({ values, onNext }) => (
        <FormBackground defaultValues={values} onSubmit={onNext} />
      ),
    },
  },
  {
    form: {
      values: () => ({
        perfil_salud: [
          {
            grupoSanguineo: 0,
            discapacidad: [],
            patologiaCronica: [],
            alergias: [],
          },
          [],
        ],
      }),
      render: ({ values, onNext }) => (
        <FormHealth defaultValues={values} onSubmit={onNext} />
      ),
    },
  },
  {
    form: {
      values: () => ({
        perfil_fisico: [
          {
            tallaCamisa: 0,
            tallaPantalon: 0,
            tallaZapatos: 0,
            tallaChaqueta: 0,
          },
          [],
        ],
      }),
      render: ({ values, onNext }) => (
        <FormPhysical defaultValues={values} onSubmit={onNext} />
      ),
    },
  },
  {
    form: {
      values: () => ({
        datos_vivienda: [
          {
            direccion_exacta: "",
            estado_id: 0,
            municipio_id: 0,
            parroquia: 0,
            condicion_vivienda_id: 0,
          },
          [],
        ],
      }),
      render: ({ values, onNext }) => (
        <FormDwelling defaultValues={values} onSubmit={onNext} />
      ),
    },
  },

  {
    return: (data) => {
      return data;
    },
  },
];
export default function MultiStepForm() {
  const [isPending, startTransition] = useTransition();

  const onReturn = useCallback<OnReturn<Values>>((output) => {
    startTransition(async () => {
      const message = await registerEmployeeSteps(output);
      if (message.success) {
        toast.success(message.message);
      } else {
        toast.error(message.message);
      }
    });
  }, []);

  if (isPending) {
    return (
      <Loading
        promiseMessage="Registrando Nuevo Trabajador"
        className="w-full h-full m-auto"
      />
    );
  }
  return <Formity schema={schema} onReturn={onReturn} />;
}
