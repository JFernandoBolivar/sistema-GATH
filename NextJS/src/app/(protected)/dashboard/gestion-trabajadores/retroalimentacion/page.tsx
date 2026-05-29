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
import { getCategory, getOrganismosAds, getTipoPrenda, getRegionTalla } from "../api/getInfoRac";
import {
  disabilityCreateActions,
  disabilityGroup,
} from "./actions/actionsDisability";
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
import {
  patologyCreateActions,
  patologyGroup,
} from "./actions/actionsPatologys";
import {
  allergiesCreateActions,
  allergiesGroup,
} from "./actions/actionsAllergies";
import { adsCreateActions, adsUpdateActions } from "./actions/actionsAds";
import { tallaCreateActions } from "./actions/actionsTalla";
import { regionTallaCreateActions } from "./actions/actionsRegionTalla";
import { TallaSchema, schemaTalla } from "./schemas/schemaTalla";
import { RegionTallaSchema, schemaRegionTalla } from "./schemas/schemaRegionTalla";
import { Sheet } from "lucide-react";
import { getExcel } from "../../gestion-pasivos/api/getInfoPasive";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { useState, useTransition } from "react";
import Loading from "../components/loading/loading";
export default function FeedBack() {
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState<string>("");
  const { data: organismoAds, isLoading: isLoadingAds } = useSWR(
    "ads",
    async () => getOrganismosAds(),
  );
  const { data: disabilityCategory, isLoading: isLoadingDisabilityCategory } =
    useSWR("disabiltyCategory", async () => getCategory("discapacidad"));
  const { data: patologyCategory, isLoading: isLoadingPatologyCategory } =
    useSWR("patologyCategory", async () => getCategory("patologias"));
  const { data: allergiesCategory, isLoading: isLoadingAllergiesCategory } =
    useSWR("allergiesCategory", async () => getCategory("alergias"));
  const { data: tipoPrendaData, isLoading: isLoadingTipoPrenda } =
    useSWR("tipoPrenda", async () => getTipoPrenda());
  const { data: regionTallaData, isLoading: isLoadingRegionTalla } =
    useSWR("regionTalla", async () => getRegionTalla());
  const formAdsUpdate = useForm<AdsUpdateType>({
    defaultValues: {
      id: 0,
      Organismoadscrito: undefined,
    },
    resolver: zodResolver(schemaAdsUpdate),
  });
  const formAds = useForm<AdsType>({
    defaultValues: {
      Organismoadscrito: undefined,
    },
    resolver: zodResolver(schemaAds),
  });
  const formDisabilityGroup = useForm<CategoryGroup>({
    defaultValues: {
      nombre_categoria: undefined,
    },
    resolver: zodResolver(schemaCategory),
  });

  const formPatology = useForm<PatologySchema>({
    defaultValues: {
      categoria_id: 0,
      patologia: undefined,
    },
    resolver: zodResolver(schemaPatologys),
  });
  const formPatologyGroup = useForm<CategoryGroup>({
    defaultValues: {
      nombre_categoria: undefined,
    },
    resolver: zodResolver(schemaCategory),
  });
  const formAllergiesGroup = useForm<CategoryGroup>({
    defaultValues: {
      nombre_categoria: undefined,
    },
    resolver: zodResolver(schemaCategory),
  });
  const formAllergies = useForm<AllergiesSchema>({
    defaultValues: {
      categoria_id: 0,
      alergia: undefined,
    },
    resolver: zodResolver(schemaAllergies),
  });
  const formDisability = useForm<DisabitySchema>({
    defaultValues: {
      categoria_id: 0,
      discapacidad: undefined,
    },
    resolver: zodResolver(schemaDisability),
  });
  const formTalla = useForm<TallaSchema>({
    defaultValues: {
      valor: undefined,
      tipo_prenda: 0,
      region: 0,
    },
    resolver: zodResolver(schemaTalla),
  });
  const formRegionTalla = useForm<RegionTallaSchema>({
    defaultValues: {
      codigo: undefined,
    },
    resolver: zodResolver(schemaRegionTalla),
  });
  const onSubmitAds = (values: AdsType) => {
    startTransition(async () => {
      const response = await adsCreateActions(values);
      if (response.success) {
        toast.success(response.message);
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
      } else {
        toast.error(response.message);
      }
    });
  };
  const getExcelDownload = () => {
    startTransition(async () => {
      const response = await getExcel();
      setLink(URL.createObjectURL(response));
    });
  };
  return (
    <PageLayout
      title="Retroalimentación"
      description="Registre Nueva Información Para Mantener El Sistema"
    >
      <Tabs defaultValue="ads" className=" m-auto">
        <TabsList className="gap-4">
          <TabsTrigger value="ads">Organismo Adscrito</TabsTrigger>
          <TabsTrigger value="dis">Discapacidades</TabsTrigger>
          <TabsTrigger value="pat">Patologias</TabsTrigger>
          <TabsTrigger value="aler">Alergias</TabsTrigger>
          <TabsTrigger value="tallas">Tallas</TabsTrigger>
          {/*<TabsTrigger value="retro-beneficio">
            Retroalimentar El Sistema De Beneficios
          </TabsTrigger>*/}
        </TabsList>
        <TabsContent value="ads">
          <div className="flex flex-row gap-2">
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevo Organismo Adscrito
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formAds}>
                  <form
                    onSubmit={formAds.handleSubmit(onSubmitAds)}
                    className="space-y-3"
                  >
                    <InputForm
                      form={formAds}
                      label="Agregar Nuevo Organismo Adscrito"
                      nameInput="Organismoadscrito"
                      type="text"
                    />
                    <Button type="submit" className="w-full">
                      Agregar Nuevo Organismo Adscrito
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Actualizar Organismo Adscrito
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formAdsUpdate}>
                  <form
                    onSubmit={formAdsUpdate.handleSubmit(onSubmitUpdateAds)}
                    className="space-y-3"
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
                    />
                    <InputForm
                      form={formAdsUpdate}
                      label="Actualizar Organismo Adscrito"
                      nameInput="Organismoadscrito"
                      type="text"
                    />
                    <Button type="submit" className="w-full">
                      Agregar Nuevo Organismo Adscrito
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="dis">
          <div className=" flex gap-2">
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Categoria de Discapidades
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formDisabilityGroup}>
                  <form
                    onSubmit={formDisabilityGroup.handleSubmit(
                      onSubmitDisabilityGroup,
                    )}
                    className="space-y-3 flex flex-col justify-between"
                  >
                    <InputForm
                      form={formDisabilityGroup}
                      label="Nueva Categoria de Discapacidad"
                      nameInput="nombre_categoria"
                      type="text"
                    />
                    <Button type="submit" className="w-full">
                      Agregar Nueva Categoria
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Dispacidades
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formDisability}>
                  <form
                    onSubmit={formDisability.handleSubmit(onSubmitDisability)}
                    className="space-y-3"
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

                    <Button type="submit" className="w-full">
                      Agregar Discapacidad
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="pat">
          <div className=" flex gap-2">
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Categoria de Patologias
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formPatologyGroup}>
                  <form
                    onSubmit={formPatologyGroup.handleSubmit(
                      onSubmitPatologyGroup,
                    )}
                    className="space-y-3 "
                  >
                    <InputForm
                      form={formPatologyGroup}
                      label="Nueva Categoria de Patologia"
                      nameInput="nombre_categoria"
                      type="text"
                    />
                    <Button type="submit" className="w-full">
                      Agregar Nueva Categoria
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Patologias
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formPatology}>
                  <form
                    onSubmit={formPatology.handleSubmit(onSubmitPatology)}
                    className="space-y-3"
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

                    <Button type="submit" className="w-full">
                      Agregar Patologia
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="aler">
          <div className=" flex gap-2">
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">
                  Agregar Nuevas Categoria de Alergias
                </h2>
              </CardHeader>
              <CardContent>
                <Form {...formAllergiesGroup}>
                  <form
                    onSubmit={formAllergiesGroup.handleSubmit(
                      onSubmitAllergiesGroup,
                    )}
                    className="space-y-3 "
                  >
                    <InputForm
                      form={formAllergiesGroup}
                      label="Nueva Categoria de Alergias"
                      nameInput="nombre_categoria"
                      type="text"
                    />
                    <Button type="submit" className="w-full">
                      Agregar Nueva Categoria
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">Agregar Nuevas Alergias</h2>
              </CardHeader>
              <CardContent>
                <Form {...formAllergies}>
                  <form
                    onSubmit={formAllergies.handleSubmit(onSubmitAllergies)}
                    className="space-y-3"
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

                    <Button type="submit" className="w-full">
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
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">Agregar Nueva Region</h2>
              </CardHeader>
              <CardContent>
                <Form {...formRegionTalla}>
                  <form
                    onSubmit={formRegionTalla.handleSubmit(onSubmitRegionTalla)}
                    className="space-y-3"
                  >
                    <InputForm
                      form={formRegionTalla}
                      label="Nueva Region"
                      nameInput="codigo"
                      type="text"
                    />
                    <Button type="submit" className="w-full">
                      Agregar Region
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            <Card className="grow">
              <CardHeader>
                <h2 className="text-2xl font-bold">Agregar Nueva Talla</h2>
              </CardHeader>
              <CardContent>
                <Form {...formTalla}>
                  <form
                    onSubmit={formTalla.handleSubmit(onSubmitTalla)}
                    className="space-y-3"
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
                    <Button type="submit" className="w-full">
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
            <Card className="grow">
              <CardContent className="flex flex-col justify-center space-y-5">
                <div className="flex gap-2">
                  {isPending ? (
                    <Loading promiseMessage="Generando Excel" />
                  ) : (
                    <>
                      <Button
                        className="bg-green-700 hover:bg-green-800 cursor-pointer m-auto"
                        onClick={getExcelDownload}
                      >
                        <Sheet />
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
