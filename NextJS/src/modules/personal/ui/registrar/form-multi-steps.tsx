"use client";

/**
 * Wizard multi-paso de registro de trabajador, paridad visual/UX con el
 * legado (`personal-trabajador/registrar/forms/form-multi-steps.tsx`, que
 * usaba `@formity/react`). Mismos 7 pasos y orden: BasicInfo, Academy,
 * SupplementaryTraining, Background, Health, PhysicalProfile, Dwelling; cada
 * paso valida con su propio schema y avanza con "Siguiente" (el legado no
 * tiene botón "Atrás"). Al completar el último paso se mapea la salida a
 * `GuardarEmpleadoInputDTO` y se delega a la Server Action (R5, R7, R8).
 *
 * Se implementa como stepper propio (sin `@formity/react`) porque cada paso
 * ya es un formulario react-hook-form + zod independiente; el estado
 * acumulado se conserva si el registro falla, para no perder lo capturado.
 */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import Loading from "@/shared/ui/components/loading";

import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import {
  registrarEmpleadoAction,
  subirFotoEmpleadoAction,
} from "../../infrastructure/actions/personal-actions";
import { obtenerCatalogosExpediente } from "../../infrastructure/cache/catalogos-expediente-cache";
import { resolverAltasInlineAction } from "../../infrastructure/actions/registro-actions";
import type { RegistroPasosType } from "../schema/schema-registro-pasos";
import { recolectarAltasInline } from "./altas-inline";
import { avisarErrorDeRegistro, primerPasoConErrores, type ErroresServidor } from "./errores-registro";
import { registroPasosADTO } from "./registro-a-dto";
import { PasoAcademic } from "./paso-academic";
import { PasoBackground } from "./paso-background";
import { PasoBasicInfo } from "./paso-basic-info";
import { PasoDwelling } from "./paso-dwelling";
import { PasoHealth } from "./paso-health";
import { PasoPhysicalProfile } from "./paso-physical-profile";
import { PasoSupplementaryTraining } from "./paso-supplementary-training";

type Acumulado = Partial<RegistroPasosType>;

const valoresIniciales = {
  cedulaidentidad: "",
  nombres: "",
  apellidos: "",
  file: null,
  fecha_nacimiento: undefined,
  nacionalidad_id: 0,
  sexoid: 0,
  estadoCivil: 0,
  correo: "",
  correoAlternativo: "",
  telefono_movil: "",
  telefono_habitacion: "",
  carnet_patria: "",
  carnet_patria_serial: "",
  contacto_emergencia: [],
  formacion_academica: [{ nivel_Academico_id: 0, carrera_id: undefined, mencion_id: undefined, institucion_id: undefined }],
  formacion_complementaria: [],
  antecedentes: [{ organismo_id: undefined, fecha_ingreso: undefined, fecha_egreso: undefined }],
  perfil_salud: { grupoSanguineo: 0, discapacidad: [], patologiaCronica: [], alergias: [] },
  perfil_fisico: { tallaCamisa: 0, tallaPantalon: 0, tallaZapatos: 0, tallaChaqueta: 0 },
  datos_vivienda: {
    direccion_exacta: "",
    estado_id: 0,
    municipio_id: 0,
    parroquia: 0,
    condicion_vivienda_id: 0,
    codigo_postal_id: 0,
  },
} as unknown as RegistroPasosType;

function mensajeDeError(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Ocurrio Un Error ";
}

export default function MultiStepForm() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [valores, setValores] = useState<RegistroPasosType>(valoresIniciales);
  const [catalogos, setCatalogos] = useState<CatalogosExpedienteDTO | null>(null);
  const [errores, setErrores] = useState<ErroresServidor | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let vigente = true;
    obtenerCatalogosExpediente()
      .then((c) => vigente && setCatalogos(c))
      .catch(() => toast.error("No fue posible cargar los catálogos del expediente."));
    return () => {
      vigente = false;
    };
  }, []);

  const isLoadingCatalogos = catalogos === null;

  const siguiente = (parcial: Acumulado) => {
    setErrores(null);
    setValores((prev) => ({ ...prev, ...parcial }));
    setPaso((p) => p + 1);
  };

  const finalizar = (parcial: Acumulado) => {
    const completo = { ...valores, ...parcial } as RegistroPasosType;
    setValores(completo);
    startTransition(async () => {
      try {
        // Opción "Otra": se crean (o reutilizan) los catálogos nuevos antes de registrar.
        const { solicitudes, aplicar } = recolectarAltasInline(completo);
        let conIds = completo;
        if (solicitudes.length > 0) {
          const altas = await resolverAltasInlineAction(solicitudes);
          if ("error" in altas) {
            toast.error(altas.error);
            return;
          }
          conIds = aplicar(altas.ok.map((a) => a.id));
        }
        const resultado = await registrarEmpleadoAction(registroPasosADTO(conIds));
        if (resultado && typeof resultado === "object" && "error" in resultado) {
          const fallo = resultado as { error: string; errores?: ErroresServidor };
          // Si el campo culpable está en otro paso, se vuelve a ese paso con el campo en rojo.
          const pasoCulpable = primerPasoConErrores(fallo.errores);
          if (pasoCulpable !== null) {
            setErrores(fallo.errores ?? null);
            setPaso(pasoCulpable);
          }
          avisarErrorDeRegistro(fallo.error, fallo.errores);
          return;
        }
        if (completo.file) {
          const formData = new FormData();
          formData.append("file", completo.file);
          try {
            const foto = await subirFotoEmpleadoAction(completo.cedulaidentidad.trim(), formData);
            if (foto && typeof foto === "object" && "error" in foto) {
              const falloFoto = foto as { error: string; errores?: Record<string, string[]> };
              const detalle = falloFoto.errores?.file?.[0] ?? falloFoto.error;
              toast.error(`El trabajador se registró, pero no fue posible subir la foto: ${detalle}`);
            }
          } catch {
            toast.error("El trabajador se registró, pero no fue posible subir la foto.");
          }
        }
        toast.success("Trabajador registrado exitosamente");
        router.push("/personal/consultar");
      } catch (error) {
        toast.error(mensajeDeError(error));
      }
    });
  };

  if (isPending) {
    return <Loading promiseMessage="Registrando Nuevo Trabajador" className="w-full h-full m-auto" />;
  }

  const comunes = { catalogos, isLoadingCatalogos, erroresServidor: errores };
  switch (paso) {
    case 0:
      return <PasoBasicInfo key="p1" defaultValues={valores} onSubmit={siguiente} {...comunes} />;
    case 1:
      return <PasoAcademic key="p2" defaultValues={valores} onSubmit={siguiente} {...comunes} />;
    case 2:
      return <PasoSupplementaryTraining key="p3" defaultValues={valores} onSubmit={siguiente} catalogos={catalogos} erroresServidor={errores} />;
    case 3:
      return <PasoBackground key="p4" defaultValues={valores} onSubmit={siguiente} catalogos={catalogos} erroresServidor={errores} />;
    case 4:
      return <PasoHealth key="p5" defaultValues={valores} onSubmit={siguiente} {...comunes} />;
    case 5:
      return <PasoPhysicalProfile key="p6" defaultValues={valores} onSubmit={siguiente} catalogos={catalogos} erroresServidor={errores} />;
    default:
      return (
        <PasoDwelling key="p7" defaultValues={valores} onSubmit={finalizar} isPending={isPending} {...comunes} />
      );
  }
}
