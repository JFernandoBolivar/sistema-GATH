"use client";

/**
 * Documento PDF del expediente de un empleado, generado 100% en el cliente
 * con `@react-pdf/renderer` (misma librería y patrón visual del legado
 * `dashboard/gestion-trabajadores/reportes/empleados/pdf/reportEmployeePDF.tsx`).
 * No hay generador de PDF en el backend para este expediente (a diferencia
 * de `apps/reportes`, que solo produce tablas planas genéricas, no un
 * dossier de secciones); replicar el patrón cliente del legado es la opción
 * consistente con lo que ya usan `carnetizacion`/`reportes` en el backend y
 * lo que el propio legado hacía para este caso puntual.
 *
 * Componente de presentación pura: recibe el mismo `DetalleExpedienteViewModel`
 * que consume `empleado-detalle-sheet.tsx` (regla R3, una sola resolución de
 * catálogos para ambas vistas).
 */
import cintillo from "$/cintillo2.png";
import logoOAC from "$/logoOAC.png";
import juntosPorVida from "$/juntosPorVida.png";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { CintilloConfigPdf } from "../infrastructure/actions/cintillo-pdf-action";
import type { DetalleExpedienteViewModel } from "./expediente-detalle-view-model";

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    paddingBottom: 90,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  logoLeft: { width: 210, height: 90 },
  logoRight: { width: 100, height: 60 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 60 },
  footerImage: { width: "100%", height: "100%" },
  title: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 4,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 16,
    color: "#666666",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: "#e8e8e8",
    padding: 5,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  infoLabel: {
    width: 150,
    fontSize: 9,
    fontWeight: "bold",
  },
  infoValue: {
    fontSize: 9,
    flex: 1,
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#bfbfbf",
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#bfbfbf",
    minHeight: 20,
  },
  tableRowHeader: {
    backgroundColor: "#f0f0f0",
  },
  tableCol: {
    padding: 4,
    fontSize: 8,
    borderRightWidth: 1,
    borderRightColor: "#bfbfbf",
    flex: 1,
  },
  emptyText: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 8,
  },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 30,
    fontSize: 8,
    color: "#666666",
  },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function TablaSimple({ encabezados, filas }: { encabezados: string[]; filas: string[][] }) {
  if (filas.length === 0) return <Text style={styles.emptyText}>Sin registros.</Text>;
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableRowHeader]}>
        {encabezados.map((h, i) => <Text key={i} style={styles.tableCol}>{h}</Text>)}
      </View>
      {filas.map((fila, i) => (
        <View key={i} style={styles.tableRow}>
          {fila.map((celda, j) => <Text key={j} style={styles.tableCol}>{celda}</Text>)}
        </View>
      ))}
    </View>
  );
}

interface EmpleadoDetallePdfProps {
  detalle: DetalleExpedienteViewModel;
  generadoPor?: string;
  generadoEn: string;
  /** HU 0009: cintillo configurable. `undefined`/`null` o sin imágenes configuradas -> assets estáticos de respaldo. "GENERICO" oculta los logos institucionales. Antes de esta HU este documento no tenía membrete institucional (gap P2 de AUDITORIA_CALIDAD_FRONTEND_2026-09-15.md). */
  cintilloConfig?: CintilloConfigPdf | null;
}

export function EmpleadoDetallePdf({ detalle, generadoPor, generadoEn, cintilloConfig }: EmpleadoDetallePdfProps) {
  const esGenerico = cintilloConfig?.tipoCintillo === "GENERICO";
  const srcLogoIzq = cintilloConfig?.logoPrincipalUrl ?? logoOAC.src;
  const srcLogoDer = cintilloConfig?.logoSecundarioUrl ?? juntosPorVida.src;
  const srcCintilloPie = cintilloConfig?.cintilloPieUrl ?? cintillo.src;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {!esGenerico && (
          <View style={styles.header} fixed>
            <Image style={styles.logoLeft} src={srcLogoIzq} />
            <Image style={styles.logoRight} src={srcLogoDer} />
          </View>
        )}
        <Text style={{ fontSize: 8, textAlign: "right", marginBottom: 8 }}>
          {generadoPor ? `Usuario: ${generadoPor}, ` : ""}Fecha de generación: {generadoEn}
        </Text>
        <Text style={styles.title}>EXPEDIENTE DEL TRABAJADOR</Text>
        <Text style={styles.subtitle}>{detalle.nombreCompleto} — Cédula {detalle.cedula}</Text>

        <Text style={styles.sectionTitle}>DATOS PERSONALES</Text>
        <InfoRow label="Sexo:" value={detalle.sexo} />
        <InfoRow label="Fecha de nacimiento:" value={detalle.fechaNacimiento} />
        <InfoRow label="Estado civil:" value={detalle.estadoCivil} />
        <InfoRow label="Carnet de la patria:" value={detalle.carnetPatria} />
        <InfoRow label="Correo:" value={detalle.correo} />
        <InfoRow label="Teléfono móvil:" value={detalle.telefonoMovil} />
        <InfoRow label="Teléfono habitación:" value={detalle.telefonoHabitacion} />
        <InfoRow label="Total APN:" value={detalle.totalAnosApn} />

        <View wrap={false}>
          <Text style={styles.sectionTitle}>DATOS LABORALES</Text>
          {detalle.cargosAsignados.length > 0 ? (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <Text style={[styles.tableCol, { width: "6%", flex: 0 }]}>#</Text>
                <Text style={[styles.tableCol, { width: "16%", flex: 0 }]}>Código</Text>
                <Text style={[styles.tableCol, { width: "24%", flex: 0 }]}>Cargo Específico</Text>
                <Text style={[styles.tableCol, { width: "12%", flex: 0 }]}>Grado</Text>
                <Text style={[styles.tableCol, { width: "18%", flex: 0 }]}>Nómina</Text>
                <Text style={[styles.tableCol, { width: "24%", flex: 0 }]}>Dirección</Text>
              </View>
              {detalle.cargosAsignados.map((asig, idx) => (
                <View key={asig.id || idx} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCol, { width: "6%", flex: 0 }]}>{idx + 1}</Text>
                  <Text style={[styles.tableCol, { width: "16%", flex: 0 }]}>{asig.codigo}</Text>
                  <Text style={[styles.tableCol, { width: "24%", flex: 0 }]}>{asig.cargoEspecifico}</Text>
                  <Text style={[styles.tableCol, { width: "12%", flex: 0 }]}>{asig.grado}</Text>
                  <Text style={[styles.tableCol, { width: "18%", flex: 0 }]}>{asig.tipoNomina}</Text>
                  <Text style={[styles.tableCol, { width: "24%", flex: 0 }]}>{asig.direccionResumida}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Sin cargos asignados registrados</Text>
          )}
          <InfoRow label="Fecha de ingreso:" value={detalle.fechaIngresoOrganismo} />
        </View>

        {detalle.contratoActual && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>CONTRATO ACTUAL</Text>
            <InfoRow label="N° contrato:" value={detalle.contratoActual.nContrato} />
            <InfoRow label="Fecha de culminación:" value={detalle.contratoActual.fechaCulminacion} />
            <InfoRow label="Política:" value={detalle.contratoActual.politica} />
            <InfoRow label="Tipo:" value={detalle.contratoActual.esFijo} />
          </View>
        )}

        <View wrap={false}>
          <Text style={styles.sectionTitle}>ANTECEDENTES LABORALES</Text>
          {detalle.antecedentes.length > 0 ? (
            <>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableRowHeader]}>
                  <Text style={[styles.tableCol, { width: "8%", flex: 0 }]}>#</Text>
                  <Text style={[styles.tableCol, { width: "25%", flex: 0 }]}>Fecha Ingreso</Text>
                  <Text style={[styles.tableCol, { width: "25%", flex: 0 }]}>Fecha Egreso</Text>
                  <Text style={[styles.tableCol, { width: "42%", flex: 0 }]}>Organismo</Text>
                </View>
                {detalle.antecedentes.map((a, idx) => (
                  <View key={idx} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCol, { width: "8%", flex: 0 }]}>{idx + 1}</Text>
                    <Text style={[styles.tableCol, { width: "25%", flex: 0 }]}>{a.fechaIngreso}</Text>
                    <Text style={[styles.tableCol, { width: "25%", flex: 0 }]}>{a.fechaEgreso}</Text>
                    <Text style={[styles.tableCol, { width: "42%", flex: 0 }]}>{a.organismo}</Text>
                  </View>
                ))}
              </View>
              <InfoRow label="Total APN:" value={detalle.totalAnosApn} />
            </>
          ) : (
            <Text style={styles.emptyText}>Sin antecedentes registrados</Text>
          )}
        </View>

        {detalle.encargadurias && detalle.encargadurias.length > 0 && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>ENCARGADURÍAS</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <Text style={[styles.tableCol, { width: "6%", flex: 0 }]}>#</Text>
                <Text style={[styles.tableCol, { width: "24%", flex: 0 }]}>Cargo Encargado</Text>
                <Text style={[styles.tableCol, { width: "28%", flex: 0 }]}>Titular</Text>
                <Text style={[styles.tableCol, { width: "16%", flex: 0 }]}>Fecha Inicio</Text>
                <Text style={[styles.tableCol, { width: "14%", flex: 0 }]}>Fecha Fin</Text>
                <Text style={[styles.tableCol, { width: "12%", flex: 0 }]}>Estatus</Text>
              </View>
              {detalle.encargadurias.map((enc, idx) => (
                <View key={enc.id || idx} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCol, { width: "6%", flex: 0 }]}>{idx + 1}</Text>
                  <Text style={[styles.tableCol, { width: "24%", flex: 0 }]}>{enc.cargoEncargado}</Text>
                  <Text style={[styles.tableCol, { width: "28%", flex: 0 }]}>{enc.titular}</Text>
                  <Text style={[styles.tableCol, { width: "16%", flex: 0 }]}>{enc.fechaInicio}</Text>
                  <Text style={[styles.tableCol, { width: "14%", flex: 0 }]}>{enc.fechaFin}</Text>
                  <Text style={[styles.tableCol, { width: "12%", flex: 0 }]}>{enc.estatus}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {detalle.vivienda && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>DATOS DE VIVIENDA</Text>
            <InfoRow label="Estado:" value={detalle.vivienda.estado} />
            <InfoRow label="Municipio:" value={detalle.vivienda.municipio} />
            <InfoRow label="Parroquia:" value={detalle.vivienda.parroquia} />
            <InfoRow label="Dirección:" value={detalle.vivienda.direccionExacta} />
            <InfoRow label="Condición de vivienda:" value={detalle.vivienda.condicion} />
            <InfoRow label="Código postal:" value={detalle.vivienda.codigoPostal} />
          </View>
        )}

        <View wrap={false}>
          <Text style={styles.sectionTitle}>FORMACIÓN ACADÉMICA</Text>
          <TablaSimple
            encabezados={["Nivel", "Carrera", "Mención", "Institución"]}
            filas={detalle.formacionAcademica.map((fa) => [fa.nivelAcademico, fa.carrera, fa.mencion, fa.institucion])}
          />
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>FORMACIÓN COMPLEMENTARIA</Text>
          <TablaSimple
            encabezados={["Capacitación", "Institución", "Inicio", "Fin", "Horas"]}
            filas={detalle.formacionComplementaria.map((fc) => [fc.capacitacion, fc.institucion, fc.fechaInicio, fc.fechaFin, fc.horasCompletadas])}
          />
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>CONTACTO DE EMERGENCIA</Text>
          <TablaSimple
            encabezados={["Nombre", "Teléfono", "Relación"]}
            filas={detalle.contactoEmergencia.map((c) => [c.nombreCompleto, c.telefono, c.relacion])}
          />
        </View>

        {detalle.fisico && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>PERFIL FÍSICO (TALLAS)</Text>
            <InfoRow label="Talla camisa:" value={detalle.fisico.tallaCamisa} />
            <InfoRow label="Talla pantalón:" value={detalle.fisico.tallaPantalon} />
            <InfoRow label="Talla zapatos:" value={detalle.fisico.tallaZapatos} />
            <InfoRow label="Talla chaqueta:" value={detalle.fisico.tallaChaqueta} />
          </View>
        )}

        {detalle.salud && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>SALUD</Text>
            <InfoRow label="Grupo sanguíneo:" value={detalle.salud.grupoSanguineo} />
            <InfoRow label="Alergias:" value={detalle.salud.alergias.map((a) => a.nombre).join(", ") || "Ninguna"} />
            <InfoRow label="Patologías crónicas:" value={detalle.salud.patologiasCronicas.map((p) => p.nombre).join(", ") || "Ninguna"} />
            <InfoRow label="Discapacidades:" value={detalle.salud.discapacidades.map((d) => d.nombre).join(", ") || "Ninguna"} />
          </View>
        )}

        {!esGenerico && (
          <View style={styles.footer} fixed>
            <Image style={styles.footerImage} src={srcCintilloPie} />
          </View>
        )}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
