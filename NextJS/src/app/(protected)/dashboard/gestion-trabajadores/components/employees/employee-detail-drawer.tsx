"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, User } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { useState } from "react";
import { EmployeeData } from "@/app/types/types";
import Image from "next/image";
interface EmployeeDetailDrawerProps {
  employee: EmployeeData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EmployeeDetailDrawer({
  employee,
  isOpen,
  onClose,
}: EmployeeDetailDrawerProps) {
  const [profile, setProfile] = useState<string>("");
  if (!isOpen || !employee) return null;
  const imageProfileFn = async () => {
    const profileImg = await fetch(
      `http://172.16.26.48:4000/read-file/profile/${employee.cedulaidentidad}`,
    );
    const getProfile = await profileImg.blob();
    setProfile(URL.createObjectURL(getProfile));
  };
  imageProfileFn();

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto h-full w-full max-w-2xl bg-background shadow-lg overflow-y-auto">
        <div className="sticky top-0 z-40 border-b bg-background p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">
            Detalles del Empleado
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {employee ? (
            <div className="flex justify-center">
              <Image
                height={150}
                width={100}
                src={profile || "/default-profile.png"}
                alt={`${employee.nombres} ${employee.apellidos}`}
                className="w-36 h-40 object-cover rounded-2xl border border-border shadow-md"
              />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-36 h-40 bg-muted rounded-2xl border border-border flex items-center justify-center">
                <User className="h-16 w-16 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Información Personal */}
          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Cédula de Identidad
                </p>
                <p className="font-semibold text-foreground">
                  {employee.cedulaidentidad}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nombres</p>
                <p className="font-semibold text-foreground">
                  {employee.nombres}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Apellidos</p>
                <p className="font-semibold text-foreground">
                  {employee.apellidos}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sexo</p>
                <p className="font-semibold text-foreground">
                  {employee.sexo.sexo}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Número De Contrato
                </p>
                <p className="font-semibold text-foreground">
                  {employee.contrato?.find(c => c.estatus?.estatus === 'ACTIVO' || c.estatus?.estatus === 'POR VENCER')?.n_contrato || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Política</p>
                <p className="font-semibold text-foreground">
                  {employee.contrato?.find(c => c.estatus?.estatus === 'ACTIVO' || c.estatus?.estatus === 'POR VENCER')?.politica?.tipo_politica || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nivel Academico</p>
                <p className="font-semibold text-foreground">
                  {/* {employee.nivelAcademico.nivelacademico} */}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dirección </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <p className="font-semibold text-foreground">
                  {/* {employee.estado.estado || "N/A"} */}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Municipio</p>
                <p className="font-semibold text-foreground">
                  {/* {employee.municipio.municipio || "N/A"} */}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Parroquia</p>
                <p className="font-semibold text-foreground">
                  {/* {employee.parroquia.parroquia || "N/A"} */}
                </p>
              </div>

              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">
                  Dirección Detallada
                </p>
                <p className="font-semibold text-foreground">
                  {/* {employee.direccion_exacta || "N/A"} */}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Información de Cargo */}
          <Card>
            <CardHeader>
              <CardTitle>Dimensiones de los Cargos</CardTitle>
            </CardHeader>
            <CardContent>
              {employee.asignaciones.map((asignacion, i) => (
                <div key={i} className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Denominación de Cargo
                    </p>
                    <p className="font-semibold text-foreground">
                      {asignacion.denominacioncargo.cargo}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Denominación Específica
                    </p>
                    <p className="font-semibold text-foreground">
                      {asignacion.denominacioncargoespecifico.cargo}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Grado</p>
                    <p className="font-semibold text-foreground">
                      {/* {asignacion.grado.grado || "N/A"} */}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Tipo De Nomina
                    </p>
                    <p className="font-semibold text-foreground">
                      {asignacion.tiponomina.nomina || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Dirección General
                    </p>
                    <p className="font-semibold text-foreground">
                      {/* {asignacion.DireccionGeneral.direccion_general || "N/A"} */}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Dirección De Linea
                    </p>
                    <p className="font-semibold text-foreground">
                      {asignacion.DireccionLinea?.direccion_linea || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Coordinación
                    </p>
                    <p className="font-semibold text-foreground">
                      {asignacion.Coordinacion?.coordinacion || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estatus</p>
                    <p className="font-semibold text-foreground">
                      {asignacion.estatusid.estatus || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Código</p>
                    <p className="font-semibold text-foreground">
                      {asignacion.codigo || "N/A"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <h2 className="text-center">Observaciones</h2>
                    <p className="font-semibold text-foreground text-center">
                      {asignacion.observaciones || "N/A"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Ubicación */}

          {/* Fechas de Ingreso */}
          <Card>
            <CardHeader>
              <CardTitle>Fechas de Ingreso</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Fecha de Ingreso al Organismo
                </p>
                <p className="font-semibold text-foreground">
                  {(() => {
                    const activo = employee.contrato?.find(c => c.estatus?.estatus === 'ACTIVO' || c.estatus?.estatus === 'POR VENCER');
                    return activo?.fecha_ingreso
                      ? new Date(activo.fecha_ingreso).toLocaleDateString("es-ES")
                      : "N/A";
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Fecha de Ingreso al APN
                </p>
                <p className="font-semibold text-foreground">
                  {/* {new Date(employee.fechaingresoapn).toLocaleDateString( */}
                  {/* "es-ES",
                  )} */}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Estatus */}
          <Card>
            <CardHeader>
              <CardTitle>Ultima Fecha De Actualizacion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full bg-green-500`} />
                <p className="font-semibold text-foreground">
                  {formatInTimeZone(
                    employee.fecha_actualizacion,
                    "UTC",
                    "dd/MM/yyyy",
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 pt-6">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 bg-transparent"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
