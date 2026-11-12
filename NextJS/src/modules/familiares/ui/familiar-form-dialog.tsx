"use client";

/**
 * Diálogo de edición de una carga familiar existente, abierto desde el Sheet
 * de detalle (`detalle-familiar.tsx`). El alta vive en su propia ruta
 * (`/familiares/registrar`, paridad con `familiares/agregar-familiar/page.tsx`
 * del legado) — este diálogo ya no cubre creación.
 *
 * OC 2026-11-11: se abre por bloque (identidad, parentesco, salud, vestimenta,
 * formación o documentos), como los diálogos modulares del detalle de
 * Personal. El grupo sanguíneo es obligatorio también al actualizar.
 */
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import { MAPA_ERRORES_FAMILIAR } from "./errores-familiar";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";

import { CATALOGOS_FAMILIAR_VACIOS, type CatalogosFamiliarDTO, type FamiliarDTO, type GuardarFamiliarInputDTO } from "../application/dtos/familiar-dto";
import {
  actualizarFamiliarAction,
  getCatalogosFamiliarAction,
} from "../infrastructure/actions/familiares-actions";
import { familiarSchema, type FamiliarFormType } from "./schema/schema-familiar";
import { FamiliarCampos, type BloqueFamiliar } from "./familiar-campos";
import { FamiliarPerfilSalud } from "./familiar-perfil-salud";
import { FamiliarPerfilFisico } from "./familiar-perfil-fisico";
import { FamiliarFormacionAcademica } from "./familiar-formacion-academica";
import { FamiliarDocumentosActualizacion } from "./familiar-documentos-actualizacion";

export type BloqueEdicionFamiliar =
  | BloqueFamiliar
  | "salud"
  | "vestimenta"
  | "formacion"
  | "documentos";

interface FamiliarFormDialogProps {
  familiar: FamiliarDTO;
  onGuardado: (familiar: FamiliarDTO) => void;
  bloque?: BloqueEdicionFamiliar;
  triggerLabel?: string;
}

const TITULOS: Record<BloqueEdicionFamiliar, string> = {
  identidad: "Actualizar datos personales",
  parentesco: "Actualizar relación y parentesco",
  salud: "Actualizar información de salud",
  vestimenta: "Actualizar información de vestimenta",
  formacion: "Actualizar información académica",
  documentos: "Documentos del familiar",
  todos: "Editar carga familiar",
};

function valoresIniciales(familiar: FamiliarDTO): FamiliarFormType {
  const salud = familiar.perfilSalud;
  const fisico = familiar.perfilFisico;
  const academico = familiar.formacionAcademica;
  const fisicoCompleto =
    fisico?.tallaCamisaId && fisico?.tallaPantalonId && fisico?.tallaZapatosId
      ? {
          tallaCamisaId: fisico.tallaCamisaId,
          tallaPantalonId: fisico.tallaPantalonId,
          tallaZapatosId: fisico.tallaZapatosId,
          tallaChaquetaId: fisico.tallaChaquetaId ?? null,
        }
      : undefined;
  return {
    empleadoCedula: familiar.empleadoCedula,
    cedulaFamiliar: familiar.cedulaFamiliar,
    primerNombre: familiar.primerNombre,
    segundoNombre: familiar.segundoNombre,
    primerApellido: familiar.primerApellido,
    segundoApellido: familiar.segundoApellido,
    parentescoId: familiar.parentescoId,
    ordenHijo: familiar.ordenHijo ?? null,
    fechaNacimiento: familiar.fechaNacimiento,
    sexoId: familiar.sexoId,
    mismoEnte: familiar.mismoEnte,
    heredero: familiar.heredero,
    observaciones: familiar.observaciones,
    // El grupo sanguíneo es obligatorio: si el registro viejo no lo tiene,
    // se arranca en 0 para que zod lo marque hasta elegirlo.
    perfilSalud: {
      grupoSanguineoId: salud?.grupoSanguineoId ?? 0,
      alergias: salud?.alergias ?? [],
      patologiasCronicas: salud?.patologiasCronicas ?? [],
      discapacidades: salud?.discapacidades ?? [],
    },
    perfilFisico: fisicoCompleto,
    formacionAcademica: academico?.nivelAcademicoId
      ? {
          nivelAcademicoId: academico.nivelAcademicoId,
          carreraId: academico.carreraId ?? null,
          mencionId: academico.mencionId ?? null,
          institucionId: academico.institucionId ?? null,
        }
      : undefined,
  };
}

function enfocarPrimerError() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    const control = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    const destino = control ?? document.querySelector<HTMLElement>('[role="alert"]');
    if (!destino) return;
    destino.scrollIntoView?.({ behavior: "smooth", block: "center" });
    destino.focus?.();
  }, 50);
}

export function FamiliarFormDialog({
  familiar,
  onGuardado,
  bloque = "todos",
  triggerLabel = "Actualizar",
}: FamiliarFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosFamiliarDTO | null>(null);

  useEffect(() => {
    if (!open || catalogos) return;
    getCatalogosFamiliarAction().then(setCatalogos).catch(() => setCatalogos(CATALOGOS_FAMILIAR_VACIOS));
  }, [open, catalogos]);

  const form = useForm<FamiliarFormType>({
    resolver: zodResolver(familiarSchema),
    defaultValues: valoresIniciales(familiar),
  });

  const onAbrir = (siguiente: boolean) => {
    setOpen(siguiente);
    if (siguiente) {
      setError(null);
      form.reset(valoresIniciales(familiar));
    }
  };

  const onGuardar = (data: FamiliarFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = await actualizarFamiliarAction(familiar.id, data as Partial<GuardarFamiliarInputDTO>);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const fallo = resultado as { error: string; errores?: Record<string, string[]> };
        const sinUbicar = aplicarErroresServidor(form, fallo.errores, MAPA_ERRORES_FAMILIAR);
        const hayCamposMarcados = Object.keys(fallo.errores ?? {}).length > 0 && sinUbicar.length === 0;
        setError(
          sinUbicar.length
            ? sinUbicar.join(" ")
            : hayCamposMarcados
              ? "Revise los campos marcados en rojo."
              : fallo.error,
        );
        enfocarPrimerError();
        return;
      }
      setOpen(false);
      onGuardado(resultado as FamiliarDTO);
    });
  };

  const onInvalid = () => {
    setError(null);
    enfocarPrimerError();
  };

  const verFormulario = bloque !== "documentos";

  return (
    <Dialog open={open} onOpenChange={onAbrir}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-4" aria-hidden="true" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{TITULOS[bloque]}</DialogTitle>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {bloque === "documentos" ? (
          <div className="flex flex-col gap-4">
            <FamiliarDocumentosActualizacion familiarId={familiar.id} />
            <Button type="button" variant="outline" className="self-start" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onGuardar, onInvalid)} className="flex flex-col gap-4" noValidate>
            {(bloque === "identidad" || bloque === "parentesco" || bloque === "todos") && (
              <FamiliarCampos
                form={form}
                catalogos={catalogos}
                bloque={bloque === "todos" ? "todos" : bloque}
              />
            )}
            {(bloque === "salud" || bloque === "todos") && (
              <FamiliarPerfilSalud form={form} catalogos={catalogos} />
            )}
            {(bloque === "vestimenta" || bloque === "todos") && (
              <FamiliarPerfilFisico form={form} catalogos={catalogos} />
            )}
            {(bloque === "formacion" || bloque === "todos") && (
              <FamiliarFormacionAcademica form={form} catalogos={catalogos} />
            )}
            {verFormulario && (
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Pencil className="size-4" aria-hidden="true" />}
                  Guardar cambios
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              </div>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
