/**
 * Reporte PDF del expediente de un pasivo — cliente (`@react-pdf/renderer`),
 * mismo patrón que el legado `dashboard/gestion-pasivos/components/pdf/
 * reportPasivoPDF.tsx` (no un PDF generado en el backend, como
 * `modules/reportes`: aquí se imprime UN expediente ya cargado en pantalla,
 * no un reporte masivo). Sin foto de perfil: ver nota en `detalle-pasivo.tsx`.
 */
import cintillo from "$/cintillo2.png";
import logoOAC from "$/logoOAC.png";
import juntosPorVida from "$/juntosPorVida.png";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { CatalogosExpedientePasivoDTO, PasivoDTO } from "../../application/dtos/pasivos-dto";

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
    marginBottom: 20,
  },
  logoLeft: { width: 210, height: 90 },
  logoRight: { width: 100, height: 60 },
  title: { fontSize: 18, textAlign: "center", marginBottom: 20, fontWeight: "bold" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 8,
    backgroundColor: "#e8e8e8",
    padding: 5,
  },
  infoRow: { flexDirection: "row", marginBottom: 4 },
  infoLabel: { width: 160, fontSize: 10, fontWeight: "bold" },
  infoValue: { fontSize: 10, flex: 1 },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#bfbfbf",
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#bfbfbf",
    minHeight: 24,
  },
  tableRowHeader: { backgroundColor: "#f0f0f0", fontWeight: "bold" },
  tableCol: {
    padding: 5,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: "#bfbfbf",
  },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 60 },
  footerImage: { width: "100%", height: "100%" },
  pageNumber: { position: "absolute", bottom: 70, right: 30, fontSize: 10, color: "#666666" },
});

function nombreCatalogo(lista: { id: number; nombre: string }[], id?: number | null): string {
  if (id === null || id === undefined) return "N/A";
  return lista.find((c) => c.id === id)?.nombre ?? "N/A";
}

function fechaLegible(fecha?: string | null): string {
  if (!fecha) return "N/A";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ReportePasivoPDF({
  pasivo,
  catalogos,
}: {
  pasivo: PasivoDTO;
  catalogos: CatalogosExpedientePasivoDTO;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={{ fontSize: 8, textAlign: "right" }}>
          Fecha de generación: {fechaLegible(new Date().toISOString())}
        </Text>
        <View style={styles.header} fixed>
          <Image style={styles.logoLeft} src={logoOAC.src} />
          <Image style={styles.logoRight} src={juntosPorVida.src} />
        </View>

        <Text style={styles.title}>INFORMACIÓN DEL JUBILADO/PASIVO</Text>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>DATOS PERSONALES</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cédula de Identidad:</Text>
            <Text style={styles.infoValue}>{pasivo.cedula}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nombres y Apellidos:</Text>
            <Text style={styles.infoValue}>{pasivo.nombreCompleto}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={styles.infoValue}>{pasivo.tipoPasivo}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de egreso:</Text>
            <Text style={styles.infoValue}>{fechaLegible(pasivo.fechaEgreso)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Resolución:</Text>
            <Text style={styles.infoValue}>{pasivo.resolucion ?? "N/A"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dirección de habitación:</Text>
            <Text style={styles.infoValue}>{pasivo.datosVivienda?.direccionExacta ?? "N/A"}</Text>
          </View>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>FORMACIÓN ACADÉMICA</Text>
          {pasivo.formacionAcademica.length > 0 ? (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <Text style={[styles.tableCol, { width: "8%" }]}>#</Text>
                <Text style={[styles.tableCol, { width: "27%" }]}>Nivel académico</Text>
                <Text style={[styles.tableCol, { width: "25%" }]}>Carrera</Text>
                <Text style={[styles.tableCol, { width: "20%" }]}>Mención</Text>
                <Text style={[styles.tableCol, { width: "20%" }]}>Institución</Text>
              </View>
              {pasivo.formacionAcademica.map((fa, idx) => (
                <View key={fa.id ?? idx} style={styles.tableRow}>
                  <Text style={[styles.tableCol, { width: "8%" }]}>{idx + 1}</Text>
                  <Text style={[styles.tableCol, { width: "27%" }]}>{nombreCatalogo(catalogos.nivelesAcademicos, fa.nivelAcademicoId)}</Text>
                  <Text style={[styles.tableCol, { width: "25%" }]}>{nombreCatalogo(catalogos.carreras, fa.carreraId)}</Text>
                  <Text style={[styles.tableCol, { width: "20%" }]}>{nombreCatalogo(catalogos.menciones, fa.mencionId)}</Text>
                  <Text style={[styles.tableCol, { width: "20%" }]}>{nombreCatalogo(catalogos.instituciones, fa.institucionId)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.infoValue}>Sin formación académica registrada.</Text>
          )}
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>HISTORIAL DE CARGOS (AL MOMENTO DEL EGRESO)</Text>
          {pasivo.cargosHistorial.length > 0 ? (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <Text style={[styles.tableCol, { width: "8%" }]}>#</Text>
                <Text style={[styles.tableCol, { width: "14%" }]}>Código</Text>
                <Text style={[styles.tableCol, { width: "23%" }]}>Cargo específico</Text>
                <Text style={[styles.tableCol, { width: "20%" }]}>Nómina</Text>
                <Text style={[styles.tableCol, { width: "35%" }]}>Dependencia</Text>
              </View>
              {pasivo.cargosHistorial.map((c, idx) => (
                <View key={`${c.codigo}-${idx}`} style={styles.tableRow}>
                  <Text style={[styles.tableCol, { width: "8%" }]}>{idx + 1}</Text>
                  <Text style={[styles.tableCol, { width: "14%" }]}>{c.codigo}</Text>
                  <Text style={[styles.tableCol, { width: "23%" }]}>{c.denominacionCargoEspecificoNombre}</Text>
                  <Text style={[styles.tableCol, { width: "20%" }]}>{c.tipoNominaNombre}</Text>
                  <Text style={[styles.tableCol, { width: "35%" }]}>
                    {c.coordinacionNombre ?? c.direccionLineaNombre ?? c.direccionGeneralNombre ?? c.dependenciaNombre}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.infoValue}>Sin cargos registrados.</Text>
          )}
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>ANTECEDENTES LABORALES</Text>
          {pasivo.antecedentes.length > 0 ? (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <Text style={[styles.tableCol, { width: "8%" }]}>#</Text>
                <Text style={[styles.tableCol, { width: "30%" }]}>Fecha ingreso</Text>
                <Text style={[styles.tableCol, { width: "30%" }]}>Fecha egreso</Text>
                <Text style={[styles.tableCol, { width: "32%" }]}>Organismo (id)</Text>
              </View>
              {pasivo.antecedentes.map((a, idx) => (
                <View key={a.id ?? idx} style={styles.tableRow}>
                  <Text style={[styles.tableCol, { width: "8%" }]}>{idx + 1}</Text>
                  <Text style={[styles.tableCol, { width: "30%" }]}>{fechaLegible(a.fechaIngreso)}</Text>
                  <Text style={[styles.tableCol, { width: "30%" }]}>{a.fechaEgreso ? fechaLegible(a.fechaEgreso) : "Presente"}</Text>
                  <Text style={[styles.tableCol, { width: "32%" }]}>{a.organismoId ?? "N/A"}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.infoValue}>Sin antecedentes registrados.</Text>
          )}
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>SALUD Y BIENESTAR</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Grupo sanguíneo:</Text>
            <Text style={styles.infoValue}>{nombreCatalogo(catalogos.gruposSanguineos, pasivo.perfilSalud?.grupoSanguineoId)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alergias:</Text>
            <Text style={styles.infoValue}>
              {pasivo.perfilSalud?.alergias?.length
                ? pasivo.perfilSalud.alergias.map((id) => nombreCatalogo(catalogos.alergias, id)).join(", ")
                : "Ninguna"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patologías crónicas:</Text>
            <Text style={styles.infoValue}>
              {pasivo.perfilSalud?.patologiasCronicas?.length
                ? pasivo.perfilSalud.patologiasCronicas.map((id) => nombreCatalogo(catalogos.patologias, id)).join(", ")
                : "Ninguna"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Discapacidades:</Text>
            <Text style={styles.infoValue}>
              {pasivo.perfilSalud?.discapacidades?.length
                ? pasivo.perfilSalud.discapacidades.map((id) => nombreCatalogo(catalogos.discapacidades, id)).join(", ")
                : "Ninguna"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Talla de camisa:</Text>
            <Text style={styles.infoValue}>{nombreCatalogo(catalogos.tallas, pasivo.perfilFisico?.tallaCamisaId)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Talla de pantalón:</Text>
            <Text style={styles.infoValue}>{nombreCatalogo(catalogos.tallas, pasivo.perfilFisico?.tallaPantalonId)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Talla de zapatos:</Text>
            <Text style={styles.infoValue}>{nombreCatalogo(catalogos.tallas, pasivo.perfilFisico?.tallaZapatosId)}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Image style={styles.footerImage} src={cintillo.src} />
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
