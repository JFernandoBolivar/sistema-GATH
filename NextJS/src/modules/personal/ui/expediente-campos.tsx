"use client";

/**
 * Campos completos del expediente (básicos + vivienda + salud + físico +
 * formación académica/complementaria + contacto de emergencia +
 * antecedentes + contrato), factorizados en un solo componente para que lo
 * reutilicen tanto `personal-registrar-page.tsx` (alta) como
 * `empleado-editar-dialog.tsx` (edición) sin duplicar el JSX de cada campo.
 */
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import type { CatalogosExpedienteDTO } from "../application/dtos/empleado-dto";
import type { EmpleadoFormType } from "./schema/schema-empleado";
import { CatalogSelect, MultiCatalogCheckbox } from "./catalogo-controls";

interface ExpedienteCamposProps {
  form: UseFormReturn<EmpleadoFormType>;
  catalogos: CatalogosExpedienteDTO | null;
  isPending: boolean;
  /** Oculta cédula/nombres/apellidos (no editables una vez creado el empleado). */
  soloDatosExtendidos?: boolean;
}

export function ExpedienteCampos({ form, catalogos, isPending, soloDatosExtendidos = false }: ExpedienteCamposProps) {
  const { fields: camposAcad, append: appendAcad, remove: removeAcad } = useFieldArray({ control: form.control, name: "formacionAcademica" });
  const { fields: camposComp, append: appendComp, remove: removeComp } = useFieldArray({ control: form.control, name: "formacionComplementaria" });
  const { fields: camposContacto, append: appendContacto, remove: removeContacto } = useFieldArray({ control: form.control, name: "contactoEmergencia" });
  const { fields: camposAnte, append: appendAnte, remove: removeAnte } = useFieldArray({ control: form.control, name: "antecedentes" });
  const { fields: camposContrato, append: appendContrato, remove: removeContrato } = useFieldArray({ control: form.control, name: "contrato" });

  return (
    <>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Datos básicos</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {!soloDatosExtendidos && (
            <>
              <Field data-invalid={!!form.formState.errors.cedula}>
                <Label htmlFor="cedula">Cédula</Label>
                <Input id="cedula" {...form.register("cedula")} aria-invalid={!!form.formState.errors.cedula} />
              </Field>
              <Field data-invalid={!!form.formState.errors.nombres}>
                <Label htmlFor="nombres">Nombres</Label>
                <Input id="nombres" {...form.register("nombres")} aria-invalid={!!form.formState.errors.nombres} />
              </Field>
              <Field data-invalid={!!form.formState.errors.apellidos}>
                <Label htmlFor="apellidos">Apellidos</Label>
                <Input id="apellidos" {...form.register("apellidos")} aria-invalid={!!form.formState.errors.apellidos} />
              </Field>
            </>
          )}
          <Field data-invalid={!!form.formState.errors.sexoId}>
            <Label htmlFor="sexoId">Sexo (id)</Label>
            <Input type="number" id="sexoId" {...form.register("sexoId", { valueAsNumber: true })} aria-invalid={!!form.formState.errors.sexoId} />
          </Field>
          <Field data-invalid={!!form.formState.errors.fechaNacimiento}>
            <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
            <Input type="date" id="fechaNacimiento" {...form.register("fechaNacimiento")} aria-invalid={!!form.formState.errors.fechaNacimiento} />
          </Field>
          <Field>
            <Label htmlFor="correo">Correo</Label>
            <Input id="correo" {...form.register("correo")} />
          </Field>
          <Field>
            <Label htmlFor="telefonoMovil">Teléfono móvil</Label>
            <Input id="telefonoMovil" {...form.register("telefonoMovil")} />
          </Field>
          <Field>
            <Label htmlFor="telefonoHabitacion">Teléfono habitación</Label>
            <Input id="telefonoHabitacion" {...form.register("telefonoHabitacion")} />
          </Field>
          <Field>
            <Label htmlFor="estadoCivilId">Estado civil (id)</Label>
            <Input type="number" id="estadoCivilId" {...form.register("estadoCivilId", { valueAsNumber: true })} />
          </Field>
          <Field>
            <Label htmlFor="carnetPatria">Carnet de la patria</Label>
            <Input id="carnetPatria" {...form.register("carnetPatria")} />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Vivienda</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field>
            <Label htmlFor="vivEstado">Estado</Label>
            <CatalogSelect id="vivEstado" value={form.watch("datosVivienda.estadoId") ? String(form.watch("datosVivienda.estadoId")) : undefined} onChange={(v) => form.setValue("datosVivienda.estadoId", v)} options={catalogos?.estados ?? []} placeholder="Seleccione estado" />
          </Field>
          <Field>
            <Label htmlFor="vivMunicipio">Municipio</Label>
            <CatalogSelect id="vivMunicipio" value={form.watch("datosVivienda.municipioId") ? String(form.watch("datosVivienda.municipioId")) : undefined} onChange={(v) => form.setValue("datosVivienda.municipioId", v)} options={catalogos?.municipios ?? []} placeholder="Seleccione municipio" />
          </Field>
          <Field>
            <Label htmlFor="vivParroquia">Parroquia</Label>
            <CatalogSelect id="vivParroquia" value={form.watch("datosVivienda.parroquiaId") ? String(form.watch("datosVivienda.parroquiaId")) : undefined} onChange={(v) => form.setValue("datosVivienda.parroquiaId", v)} options={catalogos?.parroquias ?? []} placeholder="Seleccione parroquia" />
          </Field>
          <Field>
            <Label htmlFor="vivDireccion">Dirección exacta</Label>
            <Input id="vivDireccion" {...form.register("datosVivienda.direccionExacta")} />
          </Field>
          <Field>
            <Label htmlFor="vivCondicion">Condición de vivienda</Label>
            <CatalogSelect id="vivCondicion" value={form.watch("datosVivienda.condicionViviendaId") ? String(form.watch("datosVivienda.condicionViviendaId")) : undefined} onChange={(v) => form.setValue("datosVivienda.condicionViviendaId", v)} options={catalogos?.condicionesVivienda ?? []} placeholder="Seleccione condición" />
          </Field>
          <Field>
            <Label htmlFor="vivCodigoPostal">Código postal</Label>
            <CatalogSelect id="vivCodigoPostal" value={form.watch("datosVivienda.codigoPostalId") ? String(form.watch("datosVivienda.codigoPostalId")) : undefined} onChange={(v) => form.setValue("datosVivienda.codigoPostalId", v)} options={catalogos?.codigosPostales ?? []} placeholder="Seleccione código postal" />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Perfil de salud</h3>
        <div className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="saludGrupo">Grupo sanguíneo</Label>
            <CatalogSelect id="saludGrupo" value={form.watch("perfilSalud.grupoSanguineoId") ? String(form.watch("perfilSalud.grupoSanguineoId")) : undefined} onChange={(v) => form.setValue("perfilSalud.grupoSanguineoId", v)} options={catalogos?.gruposSanguineos ?? []} placeholder="Seleccione grupo" />
          </Field>
          <Field>
            <Label>Alergias</Label>
            <MultiCatalogCheckbox value={form.watch("perfilSalud.alergias") ?? []} onChange={(ids) => form.setValue("perfilSalud.alergias", ids)} options={catalogos?.alergias ?? []} />
          </Field>
          <Field>
            <Label>Patologías crónicas</Label>
            <MultiCatalogCheckbox value={form.watch("perfilSalud.patologiasCronicas") ?? []} onChange={(ids) => form.setValue("perfilSalud.patologiasCronicas", ids)} options={catalogos?.patologias ?? []} />
          </Field>
          <Field>
            <Label>Discapacidades</Label>
            <MultiCatalogCheckbox value={form.watch("perfilSalud.discapacidades") ?? []} onChange={(ids) => form.setValue("perfilSalud.discapacidades", ids)} options={catalogos?.discapacidades ?? []} />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Perfil físico (tallas)</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field><Label htmlFor="fisCamisa">Talla camisa</Label><CatalogSelect id="fisCamisa" value={form.watch("perfilFisico.tallaCamisaId") ? String(form.watch("perfilFisico.tallaCamisaId")) : undefined} onChange={(v) => form.setValue("perfilFisico.tallaCamisaId", v)} options={catalogos?.tallas ?? []} placeholder="Seleccione talla" /></Field>
          <Field><Label htmlFor="fisPantalon">Talla pantalón</Label><CatalogSelect id="fisPantalon" value={form.watch("perfilFisico.tallaPantalonId") ? String(form.watch("perfilFisico.tallaPantalonId")) : undefined} onChange={(v) => form.setValue("perfilFisico.tallaPantalonId", v)} options={catalogos?.tallas ?? []} placeholder="Seleccione talla" /></Field>
          <Field><Label htmlFor="fisZapatos">Talla zapatos</Label><CatalogSelect id="fisZapatos" value={form.watch("perfilFisico.tallaZapatosId") ? String(form.watch("perfilFisico.tallaZapatosId")) : undefined} onChange={(v) => form.setValue("perfilFisico.tallaZapatosId", v)} options={catalogos?.tallas ?? []} placeholder="Seleccione talla" /></Field>
          <Field><Label htmlFor="fisChaqueta">Talla chaqueta</Label><CatalogSelect id="fisChaqueta" value={form.watch("perfilFisico.tallaChaquetaId") ? String(form.watch("perfilFisico.tallaChaquetaId")) : undefined} onChange={(v) => form.setValue("perfilFisico.tallaChaquetaId", v)} options={catalogos?.tallas ?? []} placeholder="Seleccione talla" /></Field>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Formación académica</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => appendAcad({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
        </div>
        <div className="flex flex-col gap-3">
          {camposAcad.map((item, i) => (
            <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-5">
              <Field><Label>Nivel académico</Label><CatalogSelect id={`acadNivel${i}`} value={form.watch(`formacionAcademica.${i}.nivelAcademicoId`) ? String(form.watch(`formacionAcademica.${i}.nivelAcademicoId`)) : undefined} onChange={(v) => form.setValue(`formacionAcademica.${i}.nivelAcademicoId`, v)} options={catalogos?.nivelesAcademicos ?? []} placeholder="Seleccione nivel" /></Field>
              <Field><Label>Carrera</Label><CatalogSelect id={`acadCarrera${i}`} value={form.watch(`formacionAcademica.${i}.carreraId`) ? String(form.watch(`formacionAcademica.${i}.carreraId`)) : undefined} onChange={(v) => form.setValue(`formacionAcademica.${i}.carreraId`, v)} options={catalogos?.carreras ?? []} placeholder="Seleccione carrera" /></Field>
              <Field><Label>Mención</Label><CatalogSelect id={`acadMencion${i}`} value={form.watch(`formacionAcademica.${i}.mencionId`) ? String(form.watch(`formacionAcademica.${i}.mencionId`)) : undefined} onChange={(v) => form.setValue(`formacionAcademica.${i}.mencionId`, v)} options={catalogos?.menciones ?? []} placeholder="Seleccione mención" /></Field>
              <Field><Label>Institución</Label><CatalogSelect id={`acadInst${i}`} value={form.watch(`formacionAcademica.${i}.institucionId`) ? String(form.watch(`formacionAcademica.${i}.institucionId`)) : undefined} onChange={(v) => form.setValue(`formacionAcademica.${i}.institucionId`, v)} options={catalogos?.instituciones ?? []} placeholder="Seleccione institución" /></Field>
              <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeAcad(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
            </div>
          ))}
          {camposAcad.length === 0 && <p className="text-xs text-muted-foreground">Sin formación académica registrada.</p>}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Formación complementaria</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => appendComp({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
        </div>
        <div className="flex flex-col gap-3">
          {camposComp.map((item, i) => (
            <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-4">
              <Field><Label>Capacitación</Label><CatalogSelect id={`compCap${i}`} value={form.watch(`formacionComplementaria.${i}.capacitacionId`) ? String(form.watch(`formacionComplementaria.${i}.capacitacionId`)) : undefined} onChange={(v) => form.setValue(`formacionComplementaria.${i}.capacitacionId`, v)} options={catalogos?.capacitaciones ?? []} placeholder="Seleccione" /></Field>
              <Field><Label>Institución</Label><CatalogSelect id={`compInst${i}`} value={form.watch(`formacionComplementaria.${i}.institucionId`) ? String(form.watch(`formacionComplementaria.${i}.institucionId`)) : undefined} onChange={(v) => form.setValue(`formacionComplementaria.${i}.institucionId`, v)} options={catalogos?.instituciones ?? []} placeholder="Seleccione" /></Field>
              <Field><Label>Fecha inicio</Label><Input type="date" {...form.register(`formacionComplementaria.${i}.fechaInicio`)} /></Field>
              <Field><Label>Fecha fin</Label><Input type="date" {...form.register(`formacionComplementaria.${i}.fechaFin`)} /></Field>
              <Field><Label>Días completados</Label><Input {...form.register(`formacionComplementaria.${i}.diasCompletados`)} /></Field>
              <Field><Label>Horas completadas</Label><Input {...form.register(`formacionComplementaria.${i}.horasCompletadas`)} /></Field>
              <Field><Label>Procedencia</Label><CatalogSelect id={`compProc${i}`} value={form.watch(`formacionComplementaria.${i}.procedenciaId`) ? String(form.watch(`formacionComplementaria.${i}.procedenciaId`)) : undefined} onChange={(v) => form.setValue(`formacionComplementaria.${i}.procedenciaId`, v)} options={catalogos?.tiposProcedencia ?? []} placeholder="Seleccione" /></Field>
              <Field><Label>Grupo</Label><CatalogSelect id={`compGrupo${i}`} value={form.watch(`formacionComplementaria.${i}.grupoId`) ? String(form.watch(`formacionComplementaria.${i}.grupoId`)) : undefined} onChange={(v) => form.setValue(`formacionComplementaria.${i}.grupoId`, v)} options={catalogos?.gruposCapacitacion ?? []} placeholder="Seleccione" /></Field>
              <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeComp(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
            </div>
          ))}
          {camposComp.length === 0 && <p className="text-xs text-muted-foreground">Sin formación complementaria registrada.</p>}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Contacto de emergencia</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => appendContacto({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
        </div>
        <div className="flex flex-col gap-3">
          {camposContacto.map((item, i) => (
            <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-5">
              <Field><Label>Nombres</Label><Input {...form.register(`contactoEmergencia.${i}.nombres`)} /></Field>
              <Field><Label>Apellidos</Label><Input {...form.register(`contactoEmergencia.${i}.apellidos`)} /></Field>
              <Field><Label>Teléfono</Label><Input {...form.register(`contactoEmergencia.${i}.telefono`)} /></Field>
              <Field><Label>Relación (id)</Label><Input type="number" {...form.register(`contactoEmergencia.${i}.relacionId`, { valueAsNumber: true })} /></Field>
              <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeContacto(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
            </div>
          ))}
          {camposContacto.length === 0 && <p className="text-xs text-muted-foreground">Sin contactos de emergencia.</p>}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Antecedentes de servicio</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => appendAnte({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
        </div>
        <div className="flex flex-col gap-3">
          {camposAnte.map((item, i) => (
            <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-4">
              <Field><Label>Organismo (id)</Label><Input type="number" {...form.register(`antecedentes.${i}.organismoId`, { valueAsNumber: true })} /></Field>
              <Field><Label>Fecha ingreso</Label><Input type="date" {...form.register(`antecedentes.${i}.fechaIngreso`)} /></Field>
              <Field><Label>Fecha egreso</Label><Input type="date" {...form.register(`antecedentes.${i}.fechaEgreso`)} /></Field>
              <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeAnte(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
            </div>
          ))}
          {camposAnte.length === 0 && <p className="text-xs text-muted-foreground">Sin antecedentes registrados.</p>}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Contrato</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => appendContrato({})} disabled={isPending}><Plus className="size-4" aria-hidden="true" /> Añadir</Button>
        </div>
        <div className="flex flex-col gap-3">
          {camposContrato.map((item, i) => (
            <div key={item.id} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-5">
              <Field><Label>Nº contrato</Label><Input {...form.register(`contrato.${i}.nContrato`)} /></Field>
              <Field><Label>Fecha ingreso</Label><Input type="date" {...form.register(`contrato.${i}.fechaIngreso`)} /></Field>
              <Field><Label>Fecha culminación</Label><Input type="date" {...form.register(`contrato.${i}.fechaCulminacion`)} /></Field>
              <Field><Label>Política</Label><CatalogSelect id={`ctrPol${i}`} value={form.watch(`contrato.${i}.politicaId`) ? String(form.watch(`contrato.${i}.politicaId`)) : undefined} onChange={(v) => form.setValue(`contrato.${i}.politicaId`, v)} options={catalogos?.politicas ?? []} placeholder="Seleccione política" /></Field>
              <Field className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => removeContrato(i)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button></Field>
            </div>
          ))}
          {camposContrato.length === 0 && <p className="text-xs text-muted-foreground">Sin contratos registrados.</p>}
        </div>
      </div>
    </>
  );
}
