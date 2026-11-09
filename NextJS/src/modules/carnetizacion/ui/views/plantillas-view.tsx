"use client";

import { Database, ImagePlus, Images, Layers } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BibliotecaMediosTab } from "../components/biblioteca-medios-tab";
import { RegistroCamposTab } from "../components/registro-campos-tab";
import { usePlantillasGestor } from "../hooks/use-plantillas-gestor";
import { PlantillasMotorGrid } from "../components/plantillas/plantillas-motor-grid";
import { PlantillasClasicasTab } from "../components/plantillas/plantillas-clasicas-tab";
import { PlantillasCrearDialog } from "../components/plantillas/plantillas-crear-dialog";
import { PlantillasVersionesDialog } from "../components/plantillas/plantillas-versiones-dialog";

export function PlantillasView() {
  const gestor = usePlantillasGestor();

  return (
    <PageLayout
      title="Plantillas de Carnet"
      description="Motor institucional de plantillas de carnet con control de versiones, dimensiones en mm y reglas por tipo de credencial."
    >
      <Tabs defaultValue="motor" className="space-y-6 mt-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="motor" className="flex items-center gap-2">
              <Layers className="size-4" />
              Plantillas por Capas (Motor)
            </TabsTrigger>
            <TabsTrigger value="clasicas" className="flex items-center gap-2">
              <ImagePlus className="size-4" />
              Fondos Fijos (Clásico)
            </TabsTrigger>
            <TabsTrigger value="biblioteca" className="flex items-center gap-2">
              <Images className="size-4" />
              Biblioteca de Medios
            </TabsTrigger>
            <TabsTrigger value="campos" className="flex items-center gap-2">
              <Database className="size-4" />
              Registro de Campos
            </TabsTrigger>
          </TabsList>
        </div>

        {/* --- PESTAÑA MOTOR DE PLANTILLAS (O44 - E3) --- */}
        <TabsContent value="motor" className="space-y-6">
          <PlantillasMotorGrid
            tipoActivo={gestor.tipoActivo}
            onCambiarTipoActivo={gestor.setTipoActivo}
            tiposCredencial={gestor.tiposCredencial}
            plantillasMotor={gestor.listaMotor}
            cargandoMotor={gestor.cargandoMotor}
            isPending={gestor.isPending}
            onAbrirModalNuevo={() => gestor.setModalNuevoOpen(true)}
            onAbrirHistorialVersiones={gestor.abrirHistorialVersiones}
            onPublicarMotor={gestor.publicarMotor}
            onActivarMotor={gestor.activarMotor}
          />
        </TabsContent>

        {/* --- PESTAÑA CLÁSICA (COMPATIBILIDAD CON IMÁGENES FIJAS) --- */}
        <TabsContent value="clasicas">
          <PlantillasClasicasTab
            formClasico={gestor.formClasico}
            isPending={gestor.isPending}
            fileInputKey={gestor.fileInputKey}
            fileInputRef={gestor.fileInputRef}
            preview={gestor.preview}
            fileName={gestor.fileName}
            onFileChange={gestor.handleFileChange}
            onSubmitClasico={gestor.onSubmitClasico}
            cargandoClasicas={gestor.cargandoClasicas}
            listaClasicas={gestor.listaClasicas}
            onActivarPlantillaClasica={gestor.activarPlantillaClasica}
          />
        </TabsContent>

        {/* --- PESTAÑA BIBLIOTECA DE MEDIOS (O44 - E4) --- */}
        <TabsContent value="biblioteca">
          <BibliotecaMediosTab />
        </TabsContent>

        {/* --- PESTAÑA REGISTRO DE CAMPOS (O44 - E5) --- */}
        <TabsContent value="campos">
          <RegistroCamposTab />
        </TabsContent>
      </Tabs>

      {/* --- MODAL NUEVA PLANTILLA BORRADOR --- */}
      <PlantillasCrearDialog
        open={gestor.modalNuevoOpen}
        onOpenChange={gestor.setModalNuevoOpen}
        tipoActivo={gestor.tipoActivo}
        nuevoNombre={gestor.nuevoNombre}
        onCambiarNuevoNombre={gestor.setNuevoNombre}
        nuevaOrientacion={gestor.nuevaOrientacion}
        onCambiarNuevaOrientacion={gestor.setNuevaOrientacion}
        nuevoAncho={gestor.nuevoAncho}
        onCambiarNuevoAncho={gestor.setNuevoAncho}
        nuevoAlto={gestor.nuevoAlto}
        onCambiarNuevoAlto={gestor.setNuevoAlto}
        nuevoCriterio={gestor.nuevoCriterio}
        onCambiarNuevoCriterio={gestor.setNuevoCriterio}
        isPending={gestor.isPending}
        onCrearBorrador={gestor.crearNuevoBorrador}
      />

      {/* --- MODAL HISTORIAL DE VERSIONES --- */}
      <PlantillasVersionesDialog
        open={gestor.modalVersionesOpen}
        onOpenChange={gestor.setModalVersionesOpen}
        plantillaSeleccionada={gestor.plantillaSeleccionada}
        versionesPlantilla={gestor.versionesPlantilla}
        cargandoVersiones={gestor.cargandoVersiones}
        isPending={gestor.isPending}
        onActivarMotor={gestor.activarMotor}
      />
    </PageLayout>
  );
}
