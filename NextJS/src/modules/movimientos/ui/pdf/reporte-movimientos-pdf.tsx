"use client";

/**
 * Documento PDF del historial de movimientos de un trabajador.
 * Paridad visual y estructural con el reporte legado:
 * `gestion-trabajadores/components/movimientos/pdf/reportMovementsPDF.tsx`.
 * Generado en cliente con `@react-pdf/renderer` en orientación horizontal (landscape).
 */
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
import type { MovimientoCargoDTO } from "../../application/dtos/movimientos-dto";

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
  },
  tableRowHeader: {
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
  },
  tableCol: {
    padding: 4,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: "#bfbfbf",
    borderRightStyle: "solid",
  },
  colNum: { width: "4%" },
  colCodigo: { width: "8%" },
  colFecha: { width: "9%" },
  colTipo: { width: "12%" },
  colCargoAnt: { width: "13%" },
  colCargoNue: { width: "13%" },
  colGradoAnt: { width: "6%" },
  colGradoNuevo: { width: "6%" },
  colEstatusAnt: { width: "10%" },
  colEstatusNuevo: { width: "10%" },
  colUsuario: { width: "9%" },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    width: 100,
    fontSize: 10,
    fontWeight: "bold",
  },
  infoValue: {
    fontSize: 10,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 8,
    backgroundColor: "#e8e8e8",
    padding: 5,
  },
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
});

function fmtFecha(fecha: string): string {
  try {
    return formatInTimeZone(new Date(fecha), "UTC", "dd/MM/yyyy");
  } catch {
    return fecha || "N/A";
  }
}

function val(v: string | null | undefined): string {
  return v && v.trim().length > 0 ? v : "N/A";
}

export interface ReporteMovimientosPDFProps {
  moves: MovimientoCargoDTO[];
  cedula: string;
  userName?: string;
}

export function ReporteMovimientosPDF({
  moves,
  cedula,
  userName = "Sistema",
}: ReporteMovimientosPDFProps) {
  // Ordenar movimientos de más reciente a más antiguo
  const sortedMoves = [...moves].sort((a, b) => {
    const tA = new Date(a.fechaMovimiento).getTime();
    const tB = new Date(b.fechaMovimiento).getTime();
    return Number.isNaN(tB) || Number.isNaN(tA) ? 0 : tB - tA;
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={{ fontSize: 8, textAlign: "right" }}>
          Usuario: {userName}, Fecha De Generación:{" "}
          {formatInTimeZone(new Date(), "UTC", "dd/MM/yyyy HH:mm:ss")}
        </Text>
        <View style={styles.header} fixed>
          <Image style={styles.logoLeft} src={logoOAC.src} />
          <View>
            <Image style={styles.logoRight} src={juntosPorVida.src} />
          </View>
        </View>

        <View>
          <Text style={styles.title}>HISTORIAL DE MOVIMIENTOS DEL TRABAJADOR</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Cédula:</Text>
          <Text style={styles.infoValue}>{cedula}</Text>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>MOVIMIENTOS REGISTRADOS</Text>

          {sortedMoves.length > 0 ? (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <Text style={[styles.tableCol, styles.colNum]}>#</Text>
                <Text style={[styles.tableCol, styles.colCodigo]}>Código</Text>
                <Text style={[styles.tableCol, styles.colFecha]}>Fecha</Text>
                <Text style={[styles.tableCol, styles.colTipo]}>Tipo Movimiento</Text>
                <Text style={[styles.tableCol, styles.colCargoAnt]}>Cargo Anterior</Text>
                <Text style={[styles.tableCol, styles.colCargoNue]}>Cargo Nuevo</Text>
                <Text style={[styles.tableCol, styles.colGradoAnt]}>Grado Ant</Text>
                <Text style={[styles.tableCol, styles.colGradoNuevo]}>Grado Nuevo</Text>
                <Text style={[styles.tableCol, styles.colEstatusAnt]}>Estatus Ant</Text>
                <Text style={[styles.tableCol, styles.colEstatusNuevo]}>Estatus Nuevo</Text>
                <Text style={[styles.tableCol, styles.colUsuario]}>Modificado Por</Text>
              </View>
              {sortedMoves.map((m, idx) => {
                // El predecesor cronológico inmediato
                const prev = sortedMoves[idx + 1];
                const tipoTexto = m.motivoNombre || m.tipoMovimiento || "N/A";
                const cargoAnt = prev ? (prev.especificaNombre || prev.denominacionNombre) : null;
                const cargoNue = m.especificaNombre || m.denominacionNombre;

                return (
                  <View key={m.id} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCol, styles.colNum]}>{idx + 1}</Text>
                    <Text style={[styles.tableCol, styles.colCodigo]}>{m.codigoPuesto || "N/A"}</Text>
                    <Text style={[styles.tableCol, styles.colFecha]}>{fmtFecha(m.fechaMovimiento)}</Text>
                    <Text style={[styles.tableCol, styles.colTipo]}>{tipoTexto}</Text>
                    <Text style={[styles.tableCol, styles.colCargoAnt]}>{val(cargoAnt)}</Text>
                    <Text style={[styles.tableCol, styles.colCargoNue]}>{val(cargoNue)}</Text>
                    <Text style={[styles.tableCol, styles.colGradoAnt]}>{val(prev?.gradoNombre)}</Text>
                    <Text style={[styles.tableCol, styles.colGradoNuevo]}>{val(m.gradoNombre)}</Text>
                    <Text style={[styles.tableCol, styles.colEstatusAnt]}>{val(prev?.estatusNombre)}</Text>
                    <Text style={[styles.tableCol, styles.colEstatusNuevo]}>{val(m.estatusNombre)}</Text>
                    <Text style={[styles.tableCol, styles.colUsuario]}>{val(m.ejecutadoPorNombre)}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>Sin movimientos registrados</Text>
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Image style={styles.footerImage} src={cintillo.src} />
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
