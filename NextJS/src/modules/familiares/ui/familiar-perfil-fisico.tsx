"use client";

/**
 * Sección "Perfil físico" (tallas) del mini-expediente del familiar
 * (`/familiares/registrar`): un solo objeto opcional (camisa/pantalón/
 * zapatos/chaqueta), paridad con el legado `perfil_fisico_familiar`. Mismo
 * patrón de filtrado por tipo de prenda + agrupación por región que
 * `modules/personal/ui/dialogs/form-physical-profile-update-dialog.tsx`.
 */
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Field } from "@/shared/ui/components/field";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogoFamiliarDTO, CatalogosFamiliarDTO } from "../application/dtos/familiar-dto";
import type { FamiliarFormType } from "./schema/schema-familiar";

function groupByRegion(tallasList: CatalogoFamiliarDTO[]) {
  return tallasList.reduce(
    (acc, item) => {
      const region = item.regionCodigo || item.regionDescripcion || "General";
      if (!acc[region]) acc[region] = [];
      acc[region].push(item);
      return acc;
    },
    {} as Record<string, CatalogoFamiliarDTO[]>,
  );
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function TallaSelect({
  label,
  campo,
  value,
  onChange,
  opciones,
  errorMensaje,
}: {
  label: string;
  campo: string;
  value: number | undefined;
  onChange: (v: number) => void;
  opciones: Record<string, CatalogoFamiliarDTO[]>;
  errorMensaje?: string;
}) {
  return (
    <Field>
      <Label htmlFor={campo}>{label}</Label>
      <Select value={value ? String(value) : ""} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger id={campo} className="w-full">
          <SelectValue placeholder="Seleccione una talla" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(opciones).map(([region, items]) => (
            <SelectGroup key={region}>
              <SelectLabel className="text-xs font-bold text-muted-foreground">{region}</SelectLabel>
              {items.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {errorMensaje && <p role="alert" className="text-sm text-destructive">{errorMensaje}</p>}
    </Field>
  );
}

export function FamiliarPerfilFisico({
  form,
  catalogos,
}: {
  form: UseFormReturn<FamiliarFormType>;
  catalogos: CatalogosFamiliarDTO | null;
}) {
  const tallaCamisaId = form.watch("perfilFisico.tallaCamisaId") ?? undefined;
  const tallaPantalonId = form.watch("perfilFisico.tallaPantalonId") ?? undefined;
  const tallaZapatosId = form.watch("perfilFisico.tallaZapatosId") ?? undefined;
  const tallaChaquetaId = form.watch("perfilFisico.tallaChaquetaId") ?? undefined;

  const tallas = catalogos?.tallas ?? [];
  const tipos = catalogos?.tiposPrenda ?? [];

  const tipoCamisaId = tipos.find((tp) => normalizar(tp.nombre).includes("camisa"))?.id;
  const tipoPantalonId = tipos.find((tp) => normalizar(tp.nombre).includes("pantalon"))?.id;
  const tipoZapatoId = tipos.find((tp) => normalizar(tp.nombre).includes("zapato"))?.id;
  const tipoChaquetaId = tipos.find((tp) => normalizar(tp.nombre).includes("chaqueta"))?.id;

  const camisas = useMemo(
    () => tallas.filter((t) => normalizar(t.tipoPrendaNombre ?? "").includes("camisa") || (tipoCamisaId && t.tipoPrendaId === tipoCamisaId)),
    [tallas, tipoCamisaId],
  );
  const pantalones = useMemo(
    () => tallas.filter((t) => normalizar(t.tipoPrendaNombre ?? "").includes("pantalon") || (tipoPantalonId && t.tipoPrendaId === tipoPantalonId)),
    [tallas, tipoPantalonId],
  );
  const zapatos = useMemo(
    () => tallas.filter((t) => normalizar(t.tipoPrendaNombre ?? "").includes("zapato") || (tipoZapatoId && t.tipoPrendaId === tipoZapatoId)),
    [tallas, tipoZapatoId],
  );
  const chaquetas = useMemo(
    () => tallas.filter((t) => normalizar(t.tipoPrendaNombre ?? "").includes("chaqueta") || (tipoChaquetaId && t.tipoPrendaId === tipoChaquetaId)),
    [tallas, tipoChaquetaId],
  );

  const camisasGrouped = useMemo(() => groupByRegion(camisas), [camisas]);
  const pantalonesGrouped = useMemo(() => groupByRegion(pantalones), [pantalones]);
  const zapatosGrouped = useMemo(() => groupByRegion(zapatos), [zapatos]);
  const chaquetasGrouped = useMemo(() => groupByRegion(chaquetas), [chaquetas]);

  const errores = form.formState.errors.perfilFisico as
    | {
        tallaCamisaId?: { message?: string };
        tallaPantalonId?: { message?: string };
        tallaZapatosId?: { message?: string };
        tallaChaquetaId?: { message?: string };
      }
    | undefined;

  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Perfil físico (opcional)</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TallaSelect
          label="Talla de camisa"
          campo="tallaCamisaId"
          value={tallaCamisaId}
          onChange={(v) => form.setValue("perfilFisico.tallaCamisaId", v, { shouldValidate: true })}
          opciones={camisasGrouped}
          errorMensaje={errores?.tallaCamisaId?.message}
        />
        <TallaSelect
          label="Talla de pantalón"
          campo="tallaPantalonId"
          value={tallaPantalonId}
          onChange={(v) => form.setValue("perfilFisico.tallaPantalonId", v, { shouldValidate: true })}
          opciones={pantalonesGrouped}
          errorMensaje={errores?.tallaPantalonId?.message}
        />
        <TallaSelect
          label="Talla de zapatos"
          campo="tallaZapatosId"
          value={tallaZapatosId}
          onChange={(v) => form.setValue("perfilFisico.tallaZapatosId", v, { shouldValidate: true })}
          opciones={zapatosGrouped}
          errorMensaje={errores?.tallaZapatosId?.message}
        />
        <TallaSelect
          label="Talla de chaqueta (opcional)"
          campo="tallaChaquetaId"
          value={tallaChaquetaId}
          onChange={(v) => form.setValue("perfilFisico.tallaChaquetaId", v, { shouldValidate: true })}
          opciones={chaquetasGrouped}
          errorMensaje={errores?.tallaChaquetaId?.message}
        />
      </div>
    </div>
  );
}
