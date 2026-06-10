import { EmployeeData } from "@/app/types/types";
import cintillo from "$/cintillo2.png";
import juntosPorVida from "$/juntosPorVida.png";
import logoOAC from "$/logoOAC.png";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatInTimeZone } from "date-fns-tz";
import { useSession } from "next-auth/react";

// Crear estilos
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    paddingBottom: 100,
    fontFamily: "Helvetica",
    position: "relative",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  logoLeft: {
    width: 210,
    height: 90,
  },
  logoRight: {
    width: 100,
    height: 60,
  },
  title: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    color: "#666666",
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#bfbfbf",
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#bfbfbf",
    borderBottomStyle: "solid",
    minHeight: 30,
  },
  tableRowHeader: {
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
  },
  tableCol: {
    padding: 5,
    fontSize: 10,
    borderRightWidth: 1,
    borderRightColor: "#bfbfbf",
    borderRightStyle: "solid",
  },
  col1: {
    width: "8%",
  },
  col2: {
    width: "15%",
  },
  col3: {
    width: "20%",
  },
  col4: {
    width: "15%",
  },
  col5: {
    width: "20%",
  },
  col6: {
    width: "22%"
  },
  colEnc1: { width: "8%" },
  colEnc2: { width: "22%" },
  colEnc3: { width: "25%" },
  colEnc4: { width: "18%" },
  colEnc5: { width: "12%" },
  colEnc6: { width: "15%" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  footerImage: {
    width: "100%",
    height: "100%",
  },
  pageNumber: {
    position: "absolute",
    bottom: 70,
    right: 30,
    fontSize: 10,
    color: "#666666",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 8,
    backgroundColor: "#e8e8e8",
    padding: 5,
  },
  // Nuevos estilos para la sección de información personal con imagen
  personalInfoContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  personalInfoText: {
    flex: 1,
    paddingRight: 15,
  },
  photoContainer: {
    width: 100,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  photoFrame: {
    width: 80,
    height: 100,
    borderWidth: 1,
    borderColor: "#bfbfbf",
    borderStyle: "solid",
    backgroundColor: "#f9f9f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  photoText: {
    fontSize: 8,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 5,
  },
  photoPlaceholder: {
    fontSize: 10,
    color: "#999",
    textAlign: "center",
  },
  employeePhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    width: 130,
    fontSize: 10,
    fontWeight: "bold",
  },
  infoValue: {
    fontSize: 10,
    flex: 1,
  },
});

export function ReportPDFEmployee({
  employeeData,
  id,
  photoUrl,
  session,
}: {
  employeeData: EmployeeData[];
  id: string;
  photoUrl: string;
  session?: ReturnType<typeof useSession>;
}) {
  return (
    <Document>
      {employeeData.map((employee, index) => (
        <Page key={employee.id} size="A4" style={styles.page} wrap>
          {/* Logos en la cabecera */}
          <Text style={{ fontSize: 8, textAlign: "right" }}>
            Usuario: {session?.data?.user.name}, Fecha De Generacion:{" "}
            {formatInTimeZone(new Date(), "UTC", "dd/MM/yyyy HH:mm:ss")}
          </Text>
          <View style={styles.header} fixed>
            <Image style={styles.logoLeft} src={logoOAC.src} />
            <View>
              <Image style={styles.logoRight} src={juntosPorVida.src} />
            </View>
          </View>

          {/* Título principal */}
          <View>
            <Text style={styles.title}>INFORMACIÓN DEL TRABAJADOR</Text>
          </View>

          {/* Información básica del empleado con imagen */}
          <View wrap={false}>
            <Text style={styles.sectionTitle}>DATOS PERSONALES</Text>

            <View style={styles.personalInfoContainer}>
              {/* Columna izquierda: Información textual */}
              <View style={styles.personalInfoText}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Cédula de Identidad:</Text>
                  <Text style={styles.infoValue}>
                    {employee.cedulaidentidad}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nombres y Apellidos:</Text>
                  <Text style={styles.infoValue}>
                    {employee.nombres} {employee.apellidos}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Fecha de Nacimiento:</Text>
                  <Text style={styles.infoValue}>
                    {employee.fecha_nacimiento
                      ? formatInTimeZone(
                          employee.fecha_nacimiento,
                          "UTC",
                          "dd/MM/yyyy",
                        )
                      : "N/A"}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Sexo:</Text>
                  <Text style={styles.infoValue}>{employee.sexo.sexo[0]}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Estado Civil:</Text>
                  <Text style={styles.infoValue}>
                    {employee.estadoCivil.estadoCivil}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Domicilio Fiscal:</Text>
                  <Text style={styles.infoValue}>
                    {employee.datos_vivienda?.direccion_exacta ?? "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Código Postal:</Text>
                  <Text style={styles.infoValue}>
                    {employee.datos_vivienda?.codigo_postal?.codigo ?? "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Correo:</Text>
                  <Text style={styles.infoValue}>
                    {employee.correo ?? "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Teléfono De Habitación:</Text>
                  <Text style={styles.infoValue}>
                    {employee.telefono_habitacion || "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Teléfono Móvil:</Text>
                  <Text style={styles.infoValue}>
                    {employee.telefono_movil ?? "N/A"}
                  </Text>
                </View>
              </View>

              {/* Columna derecha: Foto del empleado */}
              <View style={styles.photoContainer}>
                <View style={styles.photoFrame}>
                  {employee.profile ? (
                    <Image
                      style={styles.employeePhoto}
                      src={photoUrl || "/bg.png"}
                    />
                  ) : (
                    <Text style={styles.photoPlaceholder}>
                      Foto no disponible
                    </Text>
                  )}
                </View>
                <Text style={styles.photoText}>{employee.cedulaidentidad}</Text>
              </View>
            </View>
          </View>

          {/* Resto del código permanece igual */}
          {/* Información de formación académica */}
          <View wrap={false}>
            <Text style={styles.sectionTitle}>FORMACIÓN ACADÉMICA</Text>

            {employee.formacion_academica && employee.formacion_academica.length > 0 ? (
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableRowHeader]}>
                  <Text style={[styles.tableCol, { width: "8%" }]}>#</Text>
                  <Text style={[styles.tableCol, { width: "27%" }]}>Nivel Académico</Text>
                  <Text style={[styles.tableCol, { width: "25%" }]}>Carrera</Text>
                  <Text style={[styles.tableCol, { width: "20%" }]}>Mención</Text>
                  <Text style={[styles.tableCol, { width: "20%" }]}>Institución</Text>
                </View>
                {employee.formacion_academica.map((fa, idx) => (
                  <View key={fa.nivel_Academico_id ?? idx} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCol, { width: "8%" }]}>{idx + 1}</Text>
                    <Text style={[styles.tableCol, { width: "27%" }]}>
                      {fa.nivelAcademico?.nivelacademico ?? "N/A"}
                    </Text>
                    <Text style={[styles.tableCol, { width: "25%" }]}>
                      {fa.carrera?.nombre_carrera ?? "N/A"}
                    </Text>
                    <Text style={[styles.tableCol, { width: "20%" }]}>
                      {fa.mencion?.nombre_mencion ?? "N/A"}
                    </Text>
                    <Text style={[styles.tableCol, { width: "20%" }]}>
                      {fa.institucion?.nombre_institucion ?? "N/A"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nivel Académico:</Text>
                <Text style={styles.infoValue}>No especificado</Text>
              </View>
            )}
          </View>

          {/* Tabla de asignaciones */}
          <View wrap={false}>
            <Text style={styles.sectionTitle}>DATOS LABORALES</Text>

            <View style={styles.table}>
              {/* Encabezado de la tabla */}
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <Text style={[styles.tableCol, styles.col1]}>#</Text>
                <Text style={[styles.tableCol, styles.col2]}>Código</Text>
                <Text style={[styles.tableCol, styles.col3]}>
                  Cargo Específico
                </Text>
                <Text style={[styles.tableCol, styles.col4]}>Grado</Text>
                <Text style={[styles.tableCol, styles.col5]}>Nómina</Text>
                <Text style={[styles.tableCol, styles.col6]}>Direccion</Text>
              </View>

              {/* Filas de datos */}
              {employee.asignaciones.map((asignacion, idx) => (
                <View key={asignacion.id} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCol, styles.col1]}>{idx + 1}</Text>
                  <Text style={[styles.tableCol, styles.col2]}>
                    {asignacion.codigo}
                  </Text>
                  <Text style={[styles.tableCol, styles.col3]}>
                    {asignacion.denominacioncargoespecifico.cargo}
                  </Text>
                  <Text style={[styles.tableCol, styles.col4]}>
                    {asignacion?.grado?.grado ?? "N/A"}
                  </Text>
                  <Text style={[styles.tableCol, styles.col5]}>
                    {asignacion.tiponomina.nomina}
                  </Text>
                  <Text style={[styles.tableCol, styles.col6]}>
                    {asignacion.Coordinacion?.coordinacion ||
                      asignacion.DireccionLinea?.direccion_linea ||
                      asignacion.DireccionGeneral?.direccion_general ||
                      "No especificado"}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fecha de ingreso:</Text>
              <Text style={styles.infoValue}>
                {(() => {
                  const sorted = employee?.contrato
                    ?.filter(c => c.fecha_ingreso)
                    .sort((a, b) => new Date(a.fecha_ingreso!).getTime() - new Date(b.fecha_ingreso!).getTime());
                  const fecha = sorted?.[0]?.fecha_ingreso;
                  return fecha
                    ? formatInTimeZone(fecha, "UTC", "dd/MM/yyyy")
                    : "N/A";
                })()}
              </Text>
            </View>
          </View>

          {/* Antecedentes Laborales */}
          <View wrap={false}>
            <Text style={styles.sectionTitle}>ANTECEDENTES LABORALES</Text>

            {employee.antecedentes && employee.antecedentes.length > 0 ? (
              <>
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableRowHeader]}>
                    <Text style={[styles.tableCol, { width: "8%" }]}>#</Text>
                    <Text style={[styles.tableCol, { width: "25%" }]}>Fecha Ingreso</Text>
                    <Text style={[styles.tableCol, { width: "25%" }]}>Fecha Egreso</Text>
                    <Text style={[styles.tableCol, { width: "42%" }]}>Organismo</Text>
                  </View>
                  {employee.antecedentes.map((ant, idx) => (
                    <View key={ant.id} style={styles.tableRow} wrap={false}>
                      <Text style={[styles.tableCol, { width: "8%" }]}>{idx + 1}</Text>
                      <Text style={[styles.tableCol, { width: "25%" }]}>
                        {ant.fecha_ingreso
                          ? formatInTimeZone(ant.fecha_ingreso, "UTC", "dd/MM/yyyy")
                          : "N/A"}
                      </Text>
                      <Text style={[styles.tableCol, { width: "25%" }]}>
                        {ant.fecha_egreso
                          ? formatInTimeZone(ant.fecha_egreso, "UTC", "dd/MM/yyyy")
                          : "Activo"}
                      </Text>
                      <Text style={[styles.tableCol, { width: "42%" }]}>
                        {ant.organismo?.Organismoadscrito ?? "N/A"}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total APN:</Text>
                  <Text style={styles.infoValue}>
                    {employee.total_apn
                      ? `${employee.total_apn.years} años, ${employee.total_apn.months} meses, ${employee.total_apn.days} días`
                      : "0 años, 0 meses, 0 días"}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Antecedentes:</Text>
                <Text style={styles.infoValue}>Sin antecedentes registrados</Text>
              </View>
            )}
          </View>

          {/* Encargadurías */}
          {employee.encargadurias && employee.encargadurias.length > 0 && (
            <View wrap={false}>
              <Text style={styles.sectionTitle}>ENCARGADURÍAS</Text>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableRowHeader]}>
                  <Text style={[styles.tableCol, styles.colEnc1]}>#</Text>
                  <Text style={[styles.tableCol, styles.colEnc2]}>Cargo Encargado</Text>
                  <Text style={[styles.tableCol, styles.colEnc3]}>Titular</Text>
                  <Text style={[styles.tableCol, styles.colEnc4]}>Fecha Inicio</Text>
                  <Text style={[styles.tableCol, styles.colEnc5]}>Fecha Fin</Text>
                  <Text style={[styles.tableCol, styles.colEnc6]}>Estatus</Text>
                </View>
                {employee.encargadurias.map((enc, idx) => (
                  <View key={enc.id} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCol, styles.colEnc1]}>{idx + 1}</Text>
                    <Text style={[styles.tableCol, styles.colEnc2]}>
                      {enc.cargo_info?.denominacioncargoespecifico?.cargo ?? "N/A"}
                    </Text>
                    <Text style={[styles.tableCol, styles.colEnc3]}>
                      {enc.empleado_nombre ?? ""} ({enc.empleado_cedula ?? "N/A"})
                    </Text>
                    <Text style={[styles.tableCol, styles.colEnc4]}>
                      {enc.fecha_inicio
                        ? formatInTimeZone(enc.fecha_inicio, "UTC", "dd/MM/yyyy")
                        : "N/A"}
                    </Text>
                    <Text style={[styles.tableCol, styles.colEnc5]}>
                      {enc.fecha_fin
                        ? formatInTimeZone(enc.fecha_fin, "UTC", "dd/MM/yyyy")
                        : "N/A"}
                    </Text>
                    <Text style={[styles.tableCol, styles.colEnc6]}>
                      {enc.estatus_nombre ?? "N/A"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Información de salud */}
          <View wrap={false}>
            <Text style={styles.sectionTitle}>SALUD Y BIENESTAR</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Grupo Sanguíneo:</Text>
              <Text style={styles.infoValue}>
                {employee?.perfil_salud?.grupoSanguineo?.GrupoSanguineo ??
                  "N/A"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Discapacidades:</Text>
              <Text style={styles.infoValue}>
                {employee.perfil_salud?.discapacidad &&
                employee.perfil_salud.discapacidad.length > 0
                  ? employee.perfil_salud.discapacidad
                      .map((d) => d.discapacidad)
                      .join(", ")
                  : "Ninguna"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Patologías Crónicas:</Text>
              <Text style={styles.infoValue}>
                {employee.perfil_salud?.patologiasCronicas &&
                employee.perfil_salud.patologiasCronicas.length > 0
                  ? employee.perfil_salud.patologiasCronicas
                      .map((p) => p.patologia)
                      .join(", ")
                  : "Ninguna"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Alergias:</Text>
              <Text style={styles.infoValue}>
                {employee.perfil_salud?.alergias &&
                employee.perfil_salud?.alergias.length > 0
                  ? employee.perfil_salud?.alergias
                      .map((p) => p.alergia)
                      .join(", ")
                  : "Ninguna"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Talla Camisa:</Text>
              <Text style={styles.infoValue}>
                {employee?.perfil_fisico?.tallaCamisa?.valor ??
                  "No especificado"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Talla Pantalón:</Text>
              <Text style={styles.infoValue}>
                {employee?.perfil_fisico?.tallaPantalon?.valor ??
                  "No especificado"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Talla Zapatos:</Text>
              <Text style={styles.infoValue}>
                {employee?.perfil_fisico?.tallaZapatos?.valor ??
                  "No especificado"}
              </Text>
            </View>
          </View>

          {/* Información física */}

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Image style={styles.footerImage} src={cintillo.src} />
          </View>

          {/* Número de página */}
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `Trabajador ${index + 1} de ${employeeData.length} - Página ${pageNumber} de ${totalPages}`
            }
            fixed
          />
        </Page>
      ))}
    </Document>
  );
}
