"use client";

/**
 * Alta directa de jubilado/pensionado con el MISMO wizard de 7 pasos del alta
 * de trabajador activo (información básica con foto, académico, formación
 * complementaria, antecedentes, salud, perfil físico y vivienda), precedido
 * por el paso de pensión. Reutiliza los componentes del módulo Personal para
 * no duplicar formularios ni validaciones.
 */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import Loading from "@/shared/ui/components/loading";
import {
  getCatalogosExpedienteAction,
  subirFotoEmpleadoAction,
} from "@/modules/personal/infrastructure/actions/personal-actions";
import { resolverAltasInlineAction } from "@/modules/personal/infrastructure/actions/registro-actions";
import type { CatalogosExpedienteDTO } from "@/modules/personal/application/dtos/empleado-dto";
import type { RegistroPasosType } from "@/modules/personal/ui/schema/schema-registro-pasos";
import { recolectarAltasInline } from "@/modules/personal/ui/registrar/altas-inline";
import { registroPasosADTO } from "@/modules/personal/ui/registrar/registro-a-dto";
import { PasoAcademic } from "@/modules/personal/ui/registrar/paso-academic";
import { PasoBackground } from "@/modules/personal/ui/registrar/paso-background";
import { PasoBasicInfo } from "@/modules/personal/ui/registrar/paso-basic-info";
import { PasoDwelling } from "@/modules/personal/ui/registrar/paso-dwelling";
import { PasoHealth } from "@/modules/personal/ui/registrar/paso-health";
import { PasoPhysicalProfile } from "@/modules/personal/ui/registrar/paso-physical-profile";
import { PasoSupplementaryTraining } from "@/modules/personal/ui/registrar/paso-supplementary-training";

import type { CatalogoPasivoDTO } from "../application/dtos/pasivos-dto";
import {
  getTiposNominaAction,
  registrarPasivoCompletoAction,
} from "../infrastructure/actions/pasivos-actions";

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
  telefono_movil: "",
  telefono_habitacion: "",
  carnet_patria: "",
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

export default function RegistrarPasivoDirectoPage() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [tipoNominaId, setTipoNominaId] = useState(0);
  const [tiposNomina, setTiposNomina] = useState<CatalogoPasivoDTO[]>([]);
  const [valores, setValores] = useState<RegistroPasosType>(valoresIniciales);
  const [catalogos, setCatalogos] = useState<CatalogosExpedienteDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let vigente = true;
    Promise.all([getCatalogosExpedienteAction(), getTiposNominaAction(true)])
      .then(([cats, nominas]) => {
        if (!vigente) return;
        setCatalogos(cats);
        setTiposNomina(nominas);
      })
      .catch(() => toast.error("No fue posible cargar los catálogos del registro."));
    return () => {
      vigente = false;
    };
  }, []);

  const siguiente = (parcial: Acumulado) => {
    setValores((prev) => ({ ...prev, ...parcial }));
    setPaso((p) => p + 1);
  };

  const finalizar = (parcial: Acumulado) => {
    const completo = { ...valores, ...parcial } as RegistroPasosType;
    setValores(completo);
    startTransition(async () => {
      try {
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
        const dto = registroPasosADTO(conIds);
        const resultado = await registrarPasivoCompletoAction(dto, tipoNominaId);
        if (resultado && typeof resultado === "object" && "error" in resultado) {
          toast.error((resultado as { error: string }).error);
          return;
        }
        if (completo.file) {
          const formData = new FormData();
          formData.append("file", completo.file);
          try {
            await subirFotoEmpleadoAction(completo.cedulaidentidad.trim(), formData);
          } catch {
            toast.error("El pasivo se registró, pero no fue posible subir la foto.");
          }
        }
        toast.success("Pasivo registrado exitosamente");
        router.push("/pasivos/consultar");
      } catch (error) {
        toast.error(error instanceof Error && error.message ? error.message : "Ocurrió un error");
      }
    });
  };

  if (isPending) {
    return <Loading promiseMessage="Registrando Personal Pasivo" className="w-full h-full m-auto" />;
  }

  const comunes = { catalogos, isLoadingCatalogos: catalogos === null };

  if (paso === 0) {
    return (
      <PageLayout title="Agregar Pasivo" description="Registro directo de jubilado o pensionado.">
        <div className="mx-auto max-w-xl rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Datos de pensión</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo se listan nóminas con <code>es_activo=False</code>.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <label htmlFor="tipo-nomina-pasivo" className="text-sm font-medium">
              Tipo de nómina
            </label>
            <select
              id="tipo-nomina-pasivo"
              className="h-11 w-full rounded-md border bg-transparent px-3 text-base"
              value={tipoNominaId || ""}
              onChange={(e) => setTipoNominaId(Number(e.target.value))}
            >
              <option value="">Seleccione una nómina de pasivo</option>
              {tiposNomina.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mt-2 h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
              disabled={!tipoNominaId}
              onClick={() => setPaso(1)}
            >
              Continuar
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  switch (paso) {
    case 1:
      return <PasoBasicInfo key="p1" defaultValues={valores} onSubmit={siguiente} {...comunes} />;
    case 2:
      return <PasoAcademic key="p2" defaultValues={valores} onSubmit={siguiente} {...comunes} />;
    case 3:
      return <PasoSupplementaryTraining key="p3" defaultValues={valores} onSubmit={siguiente} catalogos={catalogos} />;
    case 4:
      return <PasoBackground key="p4" defaultValues={valores} onSubmit={siguiente} catalogos={catalogos} />;
    case 5:
      return <PasoHealth key="p5" defaultValues={valores} onSubmit={siguiente} {...comunes} />;
    case 6:
      return <PasoPhysicalProfile key="p6" defaultValues={valores} onSubmit={siguiente} catalogos={catalogos} />;
    default:
      return (
        <PasoDwelling key="p7" defaultValues={valores} onSubmit={finalizar} isPending={isPending} {...comunes} />
      );
  }
}
