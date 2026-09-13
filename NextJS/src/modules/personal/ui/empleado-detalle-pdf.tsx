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
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { DetalleExpedienteViewModel } from "./expediente-detalle-view-model";

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    fontFamily: "Helvetica",
  },
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
}

export function EmpleadoDetallePdf({ detalle, generadoPor, generadoEn }: EmpleadoDetallePdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
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
        <InfoRow label="Total años APN:" value={detalle.totalAnosApn} />

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
          <Text style={styles.sectionTitle}>ANTECEDENTES DE SERVICIO</Text>
          <TablaSimple
            encabezados={["Ingreso", "Egreso", "Organismo"]}
            filas={detalle.antecedentes.map((a) => [a.fechaIngreso, a.fechaEgreso, a.organismo])}
          />
        </View>

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
            <InfoRow label="Alergias:" value={detalle.salud.alergias.join(", ") || "Ninguna"} />
            <InfoRow label="Patologías crónicas:" value={detalle.salud.patologiasCronicas.join(", ") || "Ninguna"} />
            <InfoRow label="Discapacidades:" value={detalle.salud.discapacidades.join(", ") || "Ninguna"} />
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
