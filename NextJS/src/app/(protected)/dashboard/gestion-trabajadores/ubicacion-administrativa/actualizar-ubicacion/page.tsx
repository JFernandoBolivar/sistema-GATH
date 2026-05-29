"use client";
import PageLayout from "@/components/layout/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UpdateDependency from "../../components/dependencias/update-dependency";
import UpdateDireccionGeneralCoord from "../../components/dependencias/update-direction-general-coordination";
import UpdateDireccionLineCoord from "../../components/dependencias/update-direction-line-coordination";
import UpdateCoord from "../../components/dependencias/update-coordination";
export default function UpgradeDependency() {
  return (
    <PageLayout title="Actualizar Informacion De Dependencias">
      <Tabs defaultValue="direccion-general/coord">
        <TabsList>
          <TabsTrigger value="direccion-general/coord">
            Dirección / Gerencia / Oficina
          </TabsTrigger>
          <TabsTrigger value="direccion-linea/coord">
            División / Coordinación
          </TabsTrigger>
          <TabsTrigger value="coord">Coordinación</TabsTrigger>
        </TabsList>

        <TabsContent value="direccion-general/coord">
          <Card>
            <CardHeader>
              <CardTitle>Actualizar Dirección / Gerencia / Oficina</CardTitle>
            </CardHeader>
            <CardContent>
              <UpdateDireccionGeneralCoord />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="direccion-linea/coord">
          <Card>
            <CardHeader>
              <CardTitle>Actualizar División / Coordinación</CardTitle>
            </CardHeader>
            <CardContent>
              <UpdateDireccionLineCoord />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="coord">
          <Card>
            <CardHeader>
              <CardTitle>Actualizar Coordinación</CardTitle>
            </CardHeader>
            <CardContent>
              <UpdateCoord />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
