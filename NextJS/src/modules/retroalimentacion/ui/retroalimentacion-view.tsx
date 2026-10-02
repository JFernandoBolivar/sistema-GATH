"use client";

import InputForm from "@/components/input-form";
import PageLayout from "@/components/layout/page-layout";
import { SelectForm } from "@/components/select-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { useState, useTransition } from "react";
import { Sheet } from "lucide-react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import Loading from "@/shared/ui/components/loading";

import {
  AdsType,
  AdsUpdateType,
  schemaAds,
  schemaAdsUpdate,
} from "./schemas/schemaAds";
import { AllergiesSchema, schemaAllergies } from "./schemas/schemaAllergies";
import { CategoryGroup, schemaCategory } from "./schemas/schemaCategory";
import { DisabitySchema, schemaDisability } from "./schemas/schemaDisability";
import { PatologySchema, schemaPatologys } from "./schemas/schemaPatologys";
import { TallaSchema, schemaTalla } from "./schemas/schemaTalla";
import { RegionTallaSchema, schemaRegionTalla } from "./schemas/schemaRegionTalla";
import {
  adsCreateActions,
  adsUpdateActions,
  allergiesCreateActions,
  allergiesGroup,
  disabilityCreateActions,
  disabilityGroup,
  getCategory,
  getExcel,
  getOrganismosAds,
  getRegionTalla,
  getTipoPrenda,
  patologyCreateActions,
  patologyGroup,
  regionTallaCreateActions,
  tallaCreateActions,
} from "./services/retroalimentacion-services";

export default function RetroalimentacionView() {
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState<string>("");

  const { data: organismoAds, isLoading: isLoadingAds, mutate: mutateAds } = useSWR(
    "retro-ads",
    async () => await getOrganismosAds(),
  );
  const { data: disabilityCategory, isLoading: isLoadingDisabilityCategory, mutate: mutateDisabilityCat } =
    useSWR("retro-disabilityCategory", async () => await getCategory("discapacidad"));
  const { data: patologyCategory, isLoading: isLoadingPatologyCategory, mutate: mutatePatologyCat } =
    useSWR("retro-patologyCategory", async () => await getCategory("patologias"));
  const { data: allergiesCategory, isLoading: isLoadingAllergiesCategory, mutate: mutateAllergiesCat } =
    useSWR("retro-allergiesCategory", async () => await getCategory("alergias"));
  const { data: tipoPrendaData, isLoading: isLoadingTipoPrenda } =
    useSWR("retro-tipoPrenda", async () => await getTipoPrenda());
  const { data: regionTallaData, isLoading: isLoadingRegionTalla, mutate: mutateRegionTalla } =
    useSWR("retro-regionTalla", async () => await getRegionTalla());

  const formAdsUpdate = useForm<AdsUpdateType>({
    defaultValues: {
      id: 0,
      Organismoadscrito: "",
    },
    resolver: zodResolver(schemaAdsUpdate),
  });

  const formAds = useForm<AdsType>({
    defaultValues: {
      Organismoadscrito: "",
    },
    resolver: zodResolver(schemaAds),
  });

  const formDisabilityGroup = useForm<CategoryGroup>({
    defaultValues: {
      nombre_categoria: "",
    },
    resolver: zodResolver(schemaCategory),
  });

  const formPatology = useForm<PatologySchema>({
    defaultValues: {
      categoria_id: 0,
      patologia: "",
    },
    resolver: zodResolver(schemaPatologys),
  });

  const formPatologyGroup = useForm<CategoryGroup>({
    defaultValues: {
      nombre_categoria: "",
    },
    resolver: zodResolver(schemaCategory),
  });

  const formAllergiesGroup = useForm<CategoryGroup>({
    defaultValues: {
      nombre_categoria: "",
    },
    resolver: zodResolver(schemaCategory),
  });

  const formAllergies = useForm<AllergiesSchema>({
    defaultValues: {
      categoria_id: 0,
      alergia: "",
    },
    resolver: zodResolver(schemaAllergies),
  });

  const formDisability = useForm<DisabitySchema>({
    defaultValues: {
      categoria_id: 0,
      discapacidad: "",
    },
    resolver: zodResolver(schemaDisability),
  });

  const formTalla = useForm<TallaSchema>({
    defaultValues: {
      valor: "",
      tipo_prenda: 0,
      region: 0,
    },
    resolver: zodResolver(schemaTalla),
  });

  const formRegionTalla = useForm<RegionTallaSchema>({
    defaultValues: {
      codigo: "",
    },
    resolver: zodResolver(schemaRegionTalla),
  });

  const onSubmitAds = (values: AdsType) => {
    startTransition(async () => {
      const response = await adsCreateActions(values);
      if (response.success) {
        toast.success(response.message);
        formAds.reset();
        mutateAds();
      } else {
        toast.error(response.message);
      }
    });
  };

  const onSubmitUpdateAds = (values: AdsUpdateType) => {
    startTransition(async () => {
      const response = await adsUpdateActions(values);
      if (response.success) {
        toast.success(response.message);
        formAdsUpdate.reset();
        mutateAds();
      } else {
        toast.error(response.message);
      }
    });
  };

  const onSubmitDisability = (values: DisabitySchema) => {
    startTransition(async () => {
      const response = await disabilityCreateActions(values);
      if (response.success) {
        toast.success(response.message);
        formDisability.reset();
      } else {
        toast.error(response.message);
      }
    });
  };

  const onSubmitDisabilityGroup = (values: CategoryGroup) => {
    startTransition(async () => {
      const response = await disabilityGroup(values);
      if (response.success) {
        toast.success(response.message);
        formDisabilityGroup.reset();
        mutateDisabilityCat();
      } else {
        toast.error(response.message);
      }
    });
  };

  const onSubmitTalla = (values: TallaSchema) => {
    startTransition(async () => {
      const response = await tallaCreateActions(values);
      if (response.success) {
        toast.success(response.message);
        formTalla.reset();
      } else {
        toast.error(response.message);
      }
    });
  };

  const onSubmitRegionTalla = (values: RegionTallaSchema) => {
    startTransition(async () => {
      const response = await regionTallaCreateActions(values);
      if (response.success) {
        toast.success(response.message);
        formRegionTalla.reset();
        mutateRegionTalla();
      } else {
        toast.error(response.message);
      }
    });
  };

  const onSubmitPatology = (values: PatologySchema) => {
    startTransition(async () => {
      const response = await patologyCreateActions(values);
      if (response.success) {
        toast.success(response.message);
        formPatology.reset();
      } else {
        toast.error(response.message);
      }
    });
  };

  const onSubmitPatologyGroup = (values: CategoryGroup) => {
    startTransition(async () => {
      const response = await patologyGroup(values);
      if (response.success) {
        toast.success(response.message);
        formPatologyGroup.reset();
        mutatePatologyCat();
      } else {
        toast.error(response.message);
      }
    });
  };

  const onSubmitAllergiesGroup = (values: CategoryGroup) => {
    startTransition(async () => {
      const response = await allergiesGroup(values);
      if (response.success) {
        toast.success(response.message);
        formAllergiesGroup.reset();
        mutateAllergiesCat();
      } else {
        toast.error(response.message);
      }
    });
  };

  const onSubmitAllergies = (values: AllergiesSchema) => {
    startTransition(async () => {
      const response = await allergiesCreateActions(values);
      if (response.success) {
        toast.success(response.message);
        formAllergies.reset();
      } else {
        toast.error(response.message);
      }
    });
  };

  const getExcelDownload = () => {
    startTransition(async () => {
      try {
        const response = await getExcel();
        if (response instanceof Blob) {
          setLink(URL.createObjectURL(response));
        } else if (response && typeof response === "object" && "error" in response) {
          toast.error((response as { error: string }).error || "Error al generar el archivo Excel");
        } else {
          toast.error("Error al generar el archivo Excel");
        }
      } catch (err) {
        toast.error("Error al generar el archivo Excel");
      }
    });
  };

  return (
    <PageLayout
      title="Retroalimentación"
      description="Registre Nueva Información Para Mantener El Sistema"
    >
      <Tabs defaultValue="ads" className="m-auto">
        <TabsList className="gap-4">
          <TabsTrigger value="ads">Organismo Adscrito</TabsTrigger>
          <TabsTrigger value="dis">Discapacidades</TabsTrigger>
          <TabsTrigger value="pat">Patologias</TabsTrigger>
          <TabsTrigger value="aler">Alergias</TabsTrigger>
          <TabsTrigger value="tallas">Tallas</TabsTrigger>
          <TabsTrigger value="retro-beneficio">
            Retroalimentar El Sistema De Beneficios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ads">
          <div className="flex flex-row gap-2">
            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevo Organismo Adscrito
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formAds}>
                  <form
                    onSubmit={formAds.handleSubmit(onSubmitAds)}
                    className="gap-3 flex flex-col"
                  >
                    <InputForm
                      form={formAds}
                      label="Agregar Nuevo Organismo Adscrito"
                      nameInput="Organismoadscrito"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Agregar Nuevo Organismo Adscrito
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Actualizar Organismo Adscrito
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formAdsUpdate}>
                  <form
                    onSubmit={formAdsUpdate.handleSubmit(onSubmitUpdateAds)}
                    className="gap-3 flex flex-col"
                  >
                    <SelectForm
                      Formlabel="Organismo Adscrito"
                      SelectLabelItem="Organismo Adscrito"
                      form={formAdsUpdate}
                      isLoading={isLoadingAds}
                      options={organismoAds?.data ?? []}
                      labelKey="Organismoadscrito"
                      valueKey="id"
                      nameSalect="id"
                      placeholder="Seleccione un organismo adscrito"
                      onCustomChange={(val) => {
                        const numId = Number(val);
                        formAdsUpdate.setValue("id", numId, { shouldValidate: true });
                        const found = organismoAds?.data?.find((o) => o.id === numId);
                        if (found) {
                          formAdsUpdate.setValue("Organismoadscrito", found.Organismoadscrito, {
                            shouldValidate: true,
                          });
                        }
                      }}
                      selectedValue={
                        formAdsUpdate.watch("id")
                          ? String(formAdsUpdate.watch("id"))
                          : ""
                      }
                    />
                    <InputForm
                      form={formAdsUpdate}
                      label="Actualizar Organismo Adscrito"
                      nameInput="Organismoadscrito"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Actualizar Organismo Adscrito
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dis">
          <div className="flex gap-2">
            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Categoria de Discapidades
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formDisabilityGroup}>
                  <form
                    onSubmit={formDisabilityGroup.handleSubmit(onSubmitDisabilityGroup)}
                    className="gap-3 flex flex-col justify-between"
                  >
                    <InputForm
                      form={formDisabilityGroup}
                      label="Nueva Categoria de Discapacidad"
                      nameInput="nombre_categoria"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Agregar Nueva Categoria
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Discapacidades
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formDisability}>
                  <form
                    onSubmit={formDisability.handleSubmit(onSubmitDisability)}
                    className="gap-3 flex flex-col"
                  >
                    <SelectForm
                      Formlabel="Categoria"
                      SelectLabelItem="Categoria"
                      form={formDisability}
                      isLoading={isLoadingDisabilityCategory}
                      options={disabilityCategory?.data ?? []}
                      labelKey="nombre_categoria"
                      valueKey="id"
                      nameSalect="categoria_id"
                      placeholder="Seleccione una categoria"
                    />
                    <InputForm
                      form={formDisability}
                      label="Nueva Discapacidad"
                      nameInput="discapacidad"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Agregar Discapacidad
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pat">
          <div className="flex gap-2">
            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Categoria de Patologias
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formPatologyGroup}>
                  <form
                    onSubmit={formPatologyGroup.handleSubmit(onSubmitPatologyGroup)}
                    className="gap-3 flex flex-col"
                  >
                    <InputForm
                      form={formPatologyGroup}
                      label="Nueva Categoria de Patologia"
                      nameInput="nombre_categoria"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Agregar Nueva Categoria
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Patologias
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formPatology}>
                  <form
                    onSubmit={formPatology.handleSubmit(onSubmitPatology)}
                    className="gap-3 flex flex-col"
                  >
                    <SelectForm
                      Formlabel="Categoria"
                      SelectLabelItem="Categoria"
                      form={formPatology}
                      isLoading={isLoadingPatologyCategory}
                      options={patologyCategory?.data ?? []}
                      labelKey="nombre_categoria"
                      valueKey="id"
                      nameSalect="categoria_id"
                      placeholder="Seleccione una categoria"
                    />
                    <InputForm
                      form={formPatology}
                      label="Nueva Patologia"
                      nameInput="patologia"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Agregar Patologia
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aler">
          <div className="flex gap-2">
            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Categoria de Alergias
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formAllergiesGroup}>
                  <form
                    onSubmit={formAllergiesGroup.handleSubmit(onSubmitAllergiesGroup)}
                    className="gap-3 flex flex-col"
                  >
                    <InputForm
                      form={formAllergiesGroup}
                      label="Nueva Categoria de Alergias"
                      nameInput="nombre_categoria"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Agregar Nueva Categoria
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">Agregar Nuevas Alergias</h2>
              </CardHeader>
              <CardContent>
                <Form {...formAllergies}>
                  <form
                    onSubmit={formAllergies.handleSubmit(onSubmitAllergies)}
                    className="gap-3 flex flex-col"
                  >
                    <SelectForm
                      Formlabel="Categoria"
                      SelectLabelItem="Categoria"
                      form={formAllergies}
                      isLoading={isLoadingAllergiesCategory}
                      options={allergiesCategory?.data ?? []}
                      labelKey="nombre_categoria"
                      valueKey="id"
                      nameSalect="categoria_id"
                      placeholder="Seleccione una categoria"
                    />
                    <InputForm
                      form={formAllergies}
                      label="Nueva Alergia"
                      nameInput="alergia"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Agregar Alergia
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tallas">
          <div className="flex gap-2">
            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">Agregar Nueva Region</h2>
              </CardHeader>
              <CardContent>
                <Form {...formRegionTalla}>
                  <form
                    onSubmit={formRegionTalla.handleSubmit(onSubmitRegionTalla)}
                    className="gap-3 flex flex-col"
                  >
                    <InputForm
                      form={formRegionTalla}
                      label="Nueva Region"
                      nameInput="codigo"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Agregar Region
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="grow bg-white">
              <CardHeader>
                <h2 className="text-2xl font-bold">Agregar Nueva Talla</h2>
              </CardHeader>
              <CardContent>
                <Form {...formTalla}>
                  <form
                    onSubmit={formTalla.handleSubmit(onSubmitTalla)}
                    className="gap-3 flex flex-col"
                  >
                    <SelectForm
                      Formlabel="Tipo De Prenda"
                      SelectLabelItem="Tipo De Prenda"
                      form={formTalla}
                      isLoading={isLoadingTipoPrenda}
                      options={tipoPrendaData?.data ?? []}
                      labelKey="categoria"
                      valueKey="id"
                      nameSalect="tipo_prenda"
                      placeholder="Seleccione un tipo de prenda"
                    />
                    <SelectForm
                      Formlabel="Region"
                      SelectLabelItem="Region"
                      form={formTalla}
                      isLoading={isLoadingRegionTalla}
                      options={regionTallaData?.data ?? []}
                      labelKey="codigo"
                      valueKey="id"
                      nameSalect="region"
                      placeholder="Seleccione una region"
                    />
                    <InputForm
                      form={formTalla}
                      label="Nueva Talla"
                      nameInput="valor"
                      type="text"
                    />
                    <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
                      Agregar Talla
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="retro-beneficio">
          <div className="flex flex-row gap-2">
            <Card className="grow bg-white">
              <CardContent className="flex flex-col justify-center gap-5">
                <div className="flex gap-2">
                  {isPending ? (
                    <Loading promiseMessage="Generando Excel" />
                  ) : (
                    <>
                      <Button
                        type="button"
                        className="bg-green-700 hover:bg-green-800 cursor-pointer m-auto"
                        onClick={getExcelDownload}
                      >
                        <Sheet className="mr-2 h-4 w-4" />
                        Generar Excel
                      </Button>
                      {link && (
                        <Link
                          download={`retroalimentacion_beneficios_${formatInTimeZone(new Date(), "UTC", "dd/MM/yyyy")}`}
                          href={link}
                          className={`${buttonVariants({ variant: "default" })} `}
                          onClick={() => setLink("")}
                        >
                          Descargar excel
                        </Link>
                      )}
                    </>
                  )}
                </div>
                <CardDescription className="text-center">
                  Este archivo generado tiene como proposito alimentar el
                  sistema de beneficios que no pertenece a este sistema,
                  motivado a preservar la agilidad de entrega de los recursos
                  alimenticios
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
