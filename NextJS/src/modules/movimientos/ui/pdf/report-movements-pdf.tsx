import type { MovimientoCargoDTO } from "../../application/dtos/movimientos-dto";
import type { CintilloConfigPdf } from "../../infrastructure/actions/cintillo-pdf-action";
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
  colCodigo: { width: "10%" },
  colFecha: { width: "10%" },
  colTipo: { width: "12%" },
  colDenominacion: { width: "16%" },
  colEspecifica: { width: "16%" },
  colGrado: { width: "8%" },
  colEstatus: { width: "10%" },
  colUsuario: { width: "14%" },
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

function fmt(fecha: string): string {
  try {
    return formatInTimeZone(fecha, "UTC", "dd/MM/yyyy");
  } catch {
    return fecha || "N/A";
  }
}

function val(v: string | null | undefined): string {
  return v ?? "N/A";
}

export function ReportMovementsPDF({
  moves,
  cedula,
  userName,
  cintilloConfig,
}: {
  moves: MovimientoCargoDTO[];
  cedula: string;
  userName?: string | null;
  /** HU 0009: cintillo configurable. `undefined`/`null` o sin imágenes configuradas -> assets estáticos de respaldo. "GENERICO" oculta los logos institucionales. */
  cintilloConfig?: CintilloConfigPdf | null;
}) {
  const esGenerico = cintilloConfig?.tipoCintillo === "GENERICO";
  const srcLogoIzq = cintilloConfig?.logoPrincipalUrl ?? logoOAC.src;
  const srcLogoDer = cintilloConfig?.logoSecundarioUrl ?? juntosPorVida.src;
  const srcCintilloPie = cintilloConfig?.cintilloPieUrl ?? cintillo.src;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={{ fontSize: 8, textAlign: "right" }}>
          Usuario: {userName ?? "Sistema"}, Fecha De Generacion:{" "}
          {formatInTimeZone(new Date(), "UTC", "dd/MM/yyyy HH:mm:ss")}
        </Text>
        {!esGenerico && (
          <View style={styles.header} fixed>
            <Image style={styles.logoLeft} src={srcLogoIzq} />
            <View>
              <Image style={styles.logoRight} src={srcLogoDer} />
            </View>
          </View>
        )}

        <View>
          <Text style={styles.title}>HISTORIAL DE MOVIMIENTOS DEL TRABAJADOR</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{cedula ? "Cédula:" : "Criterio:"}</Text>
          <Text style={styles.infoValue}>{cedula ? cedula : "Historial General de Movimientos"}</Text>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>MOVIMIENTOS REGISTRADOS</Text>

          {moves.length > 0 ? (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <Text style={[styles.tableCol, styles.colNum]}>#</Text>
                <Text style={[styles.tableCol, styles.colCodigo]}>Código</Text>
                <Text style={[styles.tableCol, styles.colFecha]}>Fecha</Text>
                <Text style={[styles.tableCol, styles.colTipo]}>Tipo Movimiento</Text>
                <Text style={[styles.tableCol, styles.colDenominacion]}>Denominación</Text>
                <Text style={[styles.tableCol, styles.colEspecifica]}>Cargo Específico</Text>
                <Text style={[styles.tableCol, styles.colGrado]}>Grado</Text>
                <Text style={[styles.tableCol, styles.colEstatus]}>Estatus</Text>
                <Text style={[styles.tableCol, styles.colUsuario]}>Modificado Por</Text>
              </View>
              {moves.map((m, idx) => (
                <View key={m.id} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCol, styles.colNum]}>{idx + 1}</Text>
                  <Text style={[styles.tableCol, styles.colCodigo]}>{m.codigoPuesto}</Text>
                  <Text style={[styles.tableCol, styles.colFecha]}>{fmt(m.fechaMovimiento)}</Text>
                  <Text style={[styles.tableCol, styles.colTipo]}>{m.tipoMovimiento || "N/A"}</Text>
                  <Text style={[styles.tableCol, styles.colDenominacion]}>
                    {val(m.denominacionNombre)}
                  </Text>
                  <Text style={[styles.tableCol, styles.colEspecifica]}>
                    {val(m.especificaNombre)}
                  </Text>
                  <Text style={[styles.tableCol, styles.colGrado]}>
                    {val(m.gradoNombre)}
                  </Text>
                  <Text style={[styles.tableCol, styles.colEstatus]}>
                    {val(m.estatusNombre)}
                  </Text>
                  <Text style={[styles.tableCol, styles.colUsuario]}>
                    {m.ejecutadoPorNombre || "N/A"}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>Sin movimientos registrados</Text>
            </View>
          )}
        </View>

        {!esGenerico && (
          <View style={styles.footer} fixed>
            <Image style={styles.footerImage} src={srcCintilloPie} />
          </View>
        )}

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
